import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Actor } from '../auth/auth.guard.js';
import type { CrmQueryDto,CrmRecordDto,PipelineDto,ConvertLeadDto,ImportDto } from './crm.dto.js';

const config={
  leads:{model:'lead',fields:['name','email','phone','company','source','status','score','value','ownerId','tags','notes','customFields'],statuses:['NEW','CONTACTED','QUALIFIED','DISQUALIFIED']},
  deals:{model:'deal',fields:['name','stageId','contactId','leadId','value','ownerId','expectedClose','lostReason','notes','customFields'],statuses:[]},
  tasks:{model:'crmTask',fields:['name','status','priority','type','ownerId','contactId','leadId','dealId','dueAt','notes'],statuses:['OPEN','IN_PROGRESS','COMPLETED','CANCELLED']},
  activities:{model:'crmActivity',fields:['name','type','status','ownerId','contactId','leadId','dealId','startsAt','endsAt','outcome','notes'],statuses:['SCHEDULED','COMPLETED','CANCELLED']},
  campaigns:{model:'campaign',fields:['name','channel','status','segmentId','budget','spent','startsAt','endsAt','subject','body','notes'],statuses:['DRAFT','PLANNED','ACTIVE','COMPLETED','PAUSED']},
  tickets:{model:'supportTicket',fields:['name','contactId','ownerId','status','priority','category','channel','dueAt','notes','resolution'],statuses:['OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED']},
  segments:{model:'crmSegment',fields:['name','lifecycle','tag','source','ownerId'],statuses:[]},
  automations:{model:'crmAutomation',fields:['name','trigger','action','taskTitle','dueDays','ownerId','enabled'],statuses:[]},
  fields:{model:'crmCustomField',fields:['name','key','entity','type','options','required'],statuses:[]},
} as const;
export type CrmKind=keyof typeof config;
type Row=Record<string,unknown>&{id:string;name?:string;status?:string;stageId?:string;contactId?:string|null;ownerId?:string|null;startsAt?:Date;endsAt?:Date;customFields?:Prisma.JsonValue};
type Delegate={findMany(args:object):Promise<Row[]>;findFirst(args:object):Promise<Row|null>;count(args:object):Promise<number>;create(args:object):Promise<Row>;update(args:object):Promise<Row>;delete(args:object):Promise<unknown>};
@Injectable()
export class CrmService {
  constructor(private db:PrismaService){}
  kind(value:string):CrmKind{if(!Object.hasOwn(config,value))throw new NotFoundException();return value as CrmKind;}
  model(tx:Prisma.TransactionClient,kind:CrmKind){return tx[config[kind].model] as unknown as Delegate;}
  write(a:Actor,admin=false){if(!(admin?['OWNER','ADMIN']:['OWNER','ADMIN','SALES']).includes(a.role))throw new ForbiddenException('Your role cannot change this CRM record');}
  audit(tx:Prisma.TransactionClient,a:Actor,action:string,kind:string,id:string){return tx.auditLog.create({data:{organizationId:a.orgId,userId:a.userId,action,entityType:`crm/${kind}`,entityId:id}});}
  async number(tx:Prisma.TransactionClient,a:Actor,key:string,prefix:string){const s=await tx.numberSequence.upsert({where:{organizationId_key:{organizationId:a.orgId,key:`crm-${key}`}},create:{organizationId:a.orgId,key:`crm-${key}`,prefix,nextValue:2},update:{nextValue:{increment:1}}});return `${s.prefix}-${String(s.nextValue-1).padStart(5,'0')}`;}
  async getRecord(tx:Prisma.TransactionClient,a:Actor,kind:CrmKind,id:string,include?:object){const row=await this.model(tx,kind).findFirst({where:{id,organizationId:a.orgId},...(include?{include}:{})});if(!row)throw new NotFoundException('CRM record not found');return row;}
  async validateLinks(tx:Prisma.TransactionClient,a:Actor,dto:CrmRecordDto){
    if(dto.ownerId&&!await tx.membership.findFirst({where:{organizationId:a.orgId,userId:dto.ownerId,role:{in:['OWNER','ADMIN','SALES']}}}))throw new NotFoundException('Choose a CRM teammate from this workspace');
    if(dto.contactId&&!await tx.contact.findFirst({where:{id:dto.contactId,organizationId:a.orgId}}))throw new NotFoundException('Contact not found');
    if(dto.leadId&&!await tx.lead.findFirst({where:{id:dto.leadId,organizationId:a.orgId}}))throw new NotFoundException('Lead not found');
    if(dto.dealId&&!await tx.deal.findFirst({where:{id:dto.dealId,organizationId:a.orgId}}))throw new NotFoundException('Deal not found');
    if(dto.segmentId&&!await tx.crmSegment.findFirst({where:{id:dto.segmentId,organizationId:a.orgId}}))throw new NotFoundException('Segment not found');
    if(dto.stageId&&!await tx.crmStage.findFirst({where:{id:dto.stageId,pipeline:{organizationId:a.orgId}}}))throw new NotFoundException('Pipeline stage not found');
  }
  async validateCustom(tx:Prisma.TransactionClient,a:Actor,entity:string,values:unknown){
    const definitions=await tx.crmCustomField.findMany({where:{organizationId:a.orgId,entity}});
    const data=(values??{}) as Record<string,unknown>;
    if(Array.isArray(data)||typeof data!=='object'||Object.keys(data).length>50)throw new BadRequestException('Custom fields must be an object with at most 50 values');
    for(const [key,value] of Object.entries(data)){
      const field=definitions.find(f=>f.key===key);if(!field)throw new BadRequestException(`Unknown custom field: ${key}`);
      if(value===''||value===null)continue;
      if(field.type==='NUMBER'?(typeof value!=='number'||!Number.isFinite(value)):typeof value!=='string'||value.length>2000)throw new BadRequestException(`Invalid value for ${field.name}`);
      if(field.type==='SELECT'&&!field.options.includes(String(value)))throw new BadRequestException(`Choose a valid option for ${field.name}`);
      if(field.type==='DATE'&&!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw new BadRequestException(`Use a date for ${field.name}`);
    }
    for(const f of definitions)if(f.required&&(data[f.key]===undefined||data[f.key]===null||data[f.key]===''))throw new BadRequestException(`${f.name} is required`);
  }
  includes(kind:CrmKind,detail=false):object|undefined{
    if(kind==='leads')return {contact:true,...(detail?{deals:{include:{stage:true}},tasks:{orderBy:{createdAt:'desc'},take:50},activities:{orderBy:{startsAt:'desc'},take:50}}:{})};
    if(kind==='deals')return {stage:{include:{pipeline:true}},contact:true,lead:true,...(detail?{tasks:{orderBy:{createdAt:'desc'},take:50},activities:{orderBy:{startsAt:'desc'},take:50}}:{})};
    if(kind==='tasks'||kind==='activities')return {contact:true,lead:true,deal:true};
    if(kind==='campaigns')return {segment:true};
    if(kind==='tickets')return {contact:true,_count:{select:{replies:true}},...(detail?{replies:{orderBy:{createdAt:'asc'},take:100}}:{})};
    return undefined;
  }
  async list(a:Actor,kind:CrmKind,q:CrmQueryDto){
    const where:Record<string,unknown>={organizationId:a.orgId};
    if(q.q)where.OR=[{name:{contains:q.q,mode:'insensitive'}},...(['leads','deals','tickets'].includes(kind)?[{number:{contains:q.q,mode:'insensitive'}}]:[])];
    if(q.status&&config[kind].statuses.length)where.status=q.status;
    if(q.ownerId&&(config[kind].fields as readonly string[]).includes('ownerId'))where.ownerId=q.ownerId==='me'?a.userId:q.ownerId;
    if(q.priority&&['tasks','tickets'].includes(kind))where.priority=q.priority;
    if(q.contactId&&(config[kind].fields as readonly string[]).includes('contactId'))where.contactId=q.contactId;
    if(kind==='deals'){if(q.pipelineId)where.stage={pipelineId:q.pipelineId};if(q.stageId)where.stageId=q.stageId;}
    if(q.overdue==='true'&&['tasks','tickets'].includes(kind)){where.dueAt={lt:new Date()};where.status={notIn:kind==='tasks'?['COMPLETED','CANCELLED']:['RESOLVED','CLOSED']};}
    const model=this.model(this.db,kind);const include=this.includes(kind);
    const [data,total]=await this.db.$transaction([model.findMany({where,orderBy:{createdAt:'desc'},skip:(q.page-1)*q.pageSize,take:q.pageSize,...(include?{include}:{})}) as Prisma.PrismaPromise<Row[]>,model.count({where}) as Prisma.PrismaPromise<number>]);
    return {data,meta:{page:q.page,pageSize:q.pageSize,total}};
  }
  detail(a:Actor,kind:CrmKind,id:string){return this.getRecord(this.db,a,kind,id,this.includes(kind,true));}
  async rules(tx:Prisma.TransactionClient,a:Actor,trigger:string,record:Row,eventId:string){
    const rules=await tx.crmAutomation.findMany({where:{organizationId:a.orgId,trigger,enabled:true}});
    for(const rule of rules){
      const owner=rule.ownerId??record.ownerId??a.userId;
      const validOwner=await tx.membership.findFirst({where:{organizationId:a.orgId,userId:owner,role:{in:['OWNER','ADMIN','SALES']}}});
      const task=await tx.crmTask.create({data:{organizationId:a.orgId,name:rule.taskTitle.replaceAll('{{name}}',record.name??'Record').slice(0,160),ownerId:validOwner?owner:a.userId,dueAt:new Date(Date.now()+rule.dueDays*86400000),contactId:record.contactId??undefined,...(trigger==='LEAD_CREATED'?{leadId:record.id}:trigger==='DEAL_STAGE_CHANGED'?{dealId:record.id}:{}),notes:`Created by automation: ${rule.name}`,automationKey:`${rule.id}:${eventId}`}});
      await tx.crmAutomation.update({where:{id:rule.id},data:{runCount:{increment:1},lastRunAt:new Date()}});await this.audit(tx,a,'follow-up created by automation','tasks',task.id);
    }
  }
  async save(a:Actor,kind:CrmKind,dto:CrmRecordDto,id?:string){
    this.write(a,['automations','fields'].includes(kind));
    const entries=Object.entries(dto).filter(([,v])=>v!==undefined);
    if(entries.some(([k])=>!(config[kind].fields as readonly string[]).includes(k)))throw new BadRequestException('Unexpected field for this CRM record');
    if(!id&&!dto.name?.trim())throw new BadRequestException('Name is required');
    if(dto.status&&!(config[kind].statuses as readonly string[]).includes(dto.status))throw new BadRequestException('Invalid status');
    if(kind==='tasks'&&dto.type&&!['FOLLOW_UP','CALL','EMAIL','MEETING','TODO'].includes(dto.type))throw new BadRequestException('Invalid task type');
    if(kind==='activities'&&dto.type&&!['CALL','EMAIL','MEETING','NOTE'].includes(dto.type))throw new BadRequestException('Invalid activity type');
    if(kind==='fields'&&dto.type&&!['TEXT','NUMBER','DATE','SELECT'].includes(dto.type))throw new BadRequestException('Invalid field type');
    if(kind==='fields'&&!id&&(!dto.key||!dto.entity))throw new BadRequestException('Field key and entity are required');
    if(kind==='fields'&&dto.type==='SELECT'&&!dto.options?.length)throw new BadRequestException('Select fields need options');
    if(kind==='automations'&&!id&&(!dto.trigger||!dto.taskTitle))throw new BadRequestException('Trigger and task title are required');
    return this.db.$transaction(async tx=>{
      const existing=id?await this.getRecord(tx,a,kind,id):undefined;
      if(kind==='leads'&&existing?.status==='CONVERTED')throw new BadRequestException('Converted leads are preserved; edit their contact or deal');
      await this.validateLinks(tx,a,dto);
      const input:Record<string,unknown>=Object.fromEntries(entries);
      if(input.name)input.name=String(input.name).trim();
      for(const key of ['ownerId','contactId','leadId','dealId','segmentId'])if(input[key]==='')input[key]=null;
      for(const key of ['expectedClose','dueAt','startsAt','endsAt'])if(typeof input[key]==='string')input[key]=new Date(input[key] as string);
      if(['leads','deals'].includes(kind))await this.validateCustom(tx,a,kind,dto.customFields??existing?.customFields);
      if(kind==='leads'&&!id)Object.assign(input,{number:await this.number(tx,a,'leads','LD'),tags:dto.tags??[]});
      if(kind==='deals'&&!id)input.number=await this.number(tx,a,'deals','DL');
      if(kind==='tickets'&&!id)input.number=await this.number(tx,a,'tickets','TK');
      if(['leads','deals','tasks','activities','tickets'].includes(kind)&&!id&&dto.ownerId===undefined)input.ownerId=a.userId;
      if(kind==='deals'){
        const stageId=dto.stageId??existing?.stageId;if(!stageId)throw new BadRequestException('Select a pipeline stage');
        const stage=await tx.crmStage.findFirst({where:{id:stageId,pipeline:{organizationId:a.orgId}}});if(!stage)throw new NotFoundException('Pipeline stage not found');
        if(stage.outcome==='LOST'&&!(dto.lostReason??existing?.lostReason))throw new BadRequestException('A lost deal requires a reason');
        input.closedAt=stage.outcome==='OPEN'?null:new Date();
      }
      if(kind==='tasks'&&dto.status)input.completedAt=dto.status==='COMPLETED'?new Date():null;
      if(kind==='tickets'&&dto.status){if(['RESOLVED','CLOSED'].includes(dto.status)&&!(dto.resolution??existing?.resolution))throw new BadRequestException('Add a resolution before closing this ticket');input.resolvedAt=['RESOLVED','CLOSED'].includes(dto.status)?new Date():null;}
      if(kind==='activities'&&!id&&!dto.startsAt)throw new BadRequestException('Activity start time is required');
      const start=(input.startsAt??existing?.startsAt) as Date|undefined;const end=(input.endsAt??existing?.endsAt) as Date|undefined;
      if(start&&end&&end<start)throw new BadRequestException('End time must not precede start time');
      const model=this.model(tx,kind);const saved=id?await model.update({where:{id,organizationId:a.orgId},data:input}):await model.create({data:{...input,organizationId:a.orgId}});
      await this.audit(tx,a,id?'updated':'created',kind,saved.id);
      if(kind==='leads'&&!id)await this.rules(tx,a,'LEAD_CREATED',saved,saved.id);
      if(kind==='tickets'&&!id)await this.rules(tx,a,'TICKET_CREATED',saved,saved.id);
      if(kind==='deals'&&existing&&dto.stageId&&dto.stageId!==existing.stageId)await this.rules(tx,a,'DEAL_STAGE_CHANGED',saved,randomUUID());
      return saved;
    },{isolationLevel:'Serializable'});
  }
  async remove(a:Actor,kind:CrmKind,id:string){this.write(a,['automations','fields'].includes(kind));if(['leads','deals','tickets'].includes(kind))throw new BadRequestException('Use lifecycle status to preserve customer history');return this.db.$transaction(async tx=>{await this.getRecord(tx,a,kind,id);await this.model(tx,kind).delete({where:{id,organizationId:a.orgId}});await this.audit(tx,a,'deleted',kind,id);return {ok:true};});}
  async pipeline(a:Actor,dto:PipelineDto){this.write(a,true);const stages=dto.stages??[{name:'Discovery',probability:10,outcome:'OPEN'},{name:'Qualified',probability:30,outcome:'OPEN'},{name:'Proposal',probability:60,outcome:'OPEN'},{name:'Negotiation',probability:80,outcome:'OPEN'},{name:'Won',probability:100,outcome:'WON'},{name:'Lost',probability:0,outcome:'LOST'}];if(stages.length<3||!stages.some(s=>s.outcome==='WON')||!stages.some(s=>s.outcome==='LOST')||!stages.some(s=>s.outcome==='OPEN')||new Set(stages.map(s=>s.name.trim().toLowerCase())).size!==stages.length)throw new BadRequestException('Use unique stages with at least one open, won and lost stage');return this.db.$transaction(async tx=>{const p=await tx.crmPipeline.create({data:{organizationId:a.orgId,name:dto.name.trim(),stages:{create:stages.map((s,i)=>({...s,name:s.name.trim(),position:i}))}},include:{stages:{orderBy:{position:'asc'}}}});await this.audit(tx,a,'pipeline created','pipelines',p.id);return p;});}
  async meta(a:Actor){const [pipelines,members,fields]=await Promise.all([this.db.crmPipeline.findMany({where:{organizationId:a.orgId},include:{stages:{orderBy:{position:'asc'}}},orderBy:{createdAt:'asc'}}),this.db.membership.findMany({where:{organizationId:a.orgId,role:{in:['OWNER','ADMIN','SALES']}},select:{user:{select:{id:true,name:true,email:true}}}}),this.db.crmCustomField.findMany({where:{organizationId:a.orgId},orderBy:{createdAt:'asc'}})]);return {pipelines,members:members.map(m=>m.user),fields};}
  async convert(a:Actor,id:string,dto:ConvertLeadDto){this.write(a);return this.db.$transaction(async tx=>{
    const lead=await tx.lead.findFirst({where:{id,organizationId:a.orgId},include:{deals:true}});if(!lead)throw new NotFoundException();if(lead.status==='CONVERTED')return {contactId:lead.contactId,dealId:lead.deals[0]?.id??null};if(lead.status==='DISQUALIFIED')throw new BadRequestException('Disqualified leads cannot be converted');
    const match=lead.email?await tx.contact.findFirst({where:{organizationId:a.orgId,email:{equals:lead.email,mode:'insensitive'}}}):null;
    const contact=match??await tx.contact.create({data:{organizationId:a.orgId,name:lead.name,email:lead.email,phone:lead.phone,tags:lead.tags,lifecycle:'PROSPECT',source:lead.source,ownerId:lead.ownerId}});
    let dealId:string|null=null;if(dto.createDeal){if(!dto.stageId)throw new BadRequestException('Choose a stage');await this.validateLinks(tx,a,{stageId:dto.stageId});const stage=await tx.crmStage.findUniqueOrThrow({where:{id:dto.stageId}});if(stage.outcome!=='OPEN')throw new BadRequestException('Start a converted deal in an open stage');const deal=await tx.deal.create({data:{organizationId:a.orgId,number:await this.number(tx,a,'deals','DL'),name:`${lead.company??lead.name} opportunity`,contactId:contact.id,leadId:id,stageId:stage.id,value:lead.value,ownerId:lead.ownerId,notes:lead.notes}});dealId=deal.id;}
    await tx.lead.update({where:{id},data:{status:'CONVERTED',contactId:contact.id}});await tx.crmTask.updateMany({where:{organizationId:a.orgId,leadId:id,contactId:null},data:{contactId:contact.id}});await tx.crmActivity.updateMany({where:{organizationId:a.orgId,leadId:id,contactId:null},data:{contactId:contact.id}});await this.audit(tx,a,'converted to contact and opportunity','leads',id);return {contactId:contact.id,dealId};
  },{isolationLevel:'Serializable'});}
  async importContacts(a:Actor,dto:ImportDto){this.write(a);if(!dto.rows.length)throw new BadRequestException('Import at least one row');return this.db.$transaction(async tx=>{let created=0,skipped=0;for(const row of dto.rows){if(row.email&&await tx.contact.findFirst({where:{organizationId:a.orgId,email:{equals:row.email,mode:'insensitive'}}})){skipped++;continue;}const c=await tx.contact.create({data:{organizationId:a.orgId,name:row.name.trim(),email:row.email?.toLowerCase(),phone:row.phone,tags:[],source:'IMPORT',ownerId:a.userId,lifecycle:'PROSPECT'}});await this.audit(tx,a,'imported','contacts',c.id);created++;}return {created,skipped};},{isolationLevel:'Serializable',timeout:30000});}
  segmentWhere(a:Actor,segment:{lifecycle:string|null;tag:string|null;source:string|null;ownerId:string|null}):Prisma.ContactWhereInput{return {organizationId:a.orgId,...(segment.lifecycle?{lifecycle:segment.lifecycle}:{}),...(segment.tag?{tags:{has:segment.tag}}:{}),...(segment.source?{source:segment.source}:{}),...(segment.ownerId?{ownerId:segment.ownerId}:{})};}
  async audience(a:Actor,id:string,q:CrmQueryDto){const segment=await this.db.crmSegment.findFirst({where:{id,organizationId:a.orgId}});if(!segment)throw new NotFoundException();const where=this.segmentWhere(a,segment);const [data,total]=await Promise.all([this.db.contact.findMany({where,take:q.pageSize,skip:(q.page-1)*q.pageSize,orderBy:{name:'asc'}}),this.db.contact.count({where})]);return {data,meta:{page:q.page,pageSize:q.pageSize,total}};}
  async context(a:Actor,id:string){if(!await this.db.contact.findFirst({where:{id,organizationId:a.orgId}}))throw new NotFoundException();const where={organizationId:a.orgId,contactId:id};const [leads,deals,tasks,activities,tickets]=await Promise.all([this.db.lead.findMany({where,take:20,orderBy:{createdAt:'desc'}}),this.db.deal.findMany({where,include:{stage:true},take:20,orderBy:{createdAt:'desc'}}),this.db.crmTask.findMany({where,take:20,orderBy:{dueAt:'asc'}}),this.db.crmActivity.findMany({where,take:20,orderBy:{startsAt:'desc'}}),this.db.supportTicket.findMany({where,take:20,orderBy:{createdAt:'desc'}})]);return {leads,deals,tasks,activities,tickets};}
  async summary(a:Actor){const where={organizationId:a.orgId};const now=new Date();const [leads,deals,tasks,activities,tickets,campaigns]=await Promise.all([this.db.lead.findMany({where,select:{status:true,source:true,score:true,createdAt:true}}),this.db.deal.findMany({where,include:{stage:true}}),this.db.crmTask.groupBy({by:['status'],where,_count:true}),this.db.crmActivity.count({where:{...where,startsAt:{gte:new Date(now.getTime()-30*86400000)},status:'COMPLETED'}}),this.db.supportTicket.groupBy({by:['status'],where,_count:true}),this.db.campaign.count({where:{...where,status:'ACTIVE'}})]);
    const open=deals.filter(d=>d.stage.outcome==='OPEN');const won=deals.filter(d=>d.stage.outcome==='WON');const lost=deals.filter(d=>d.stage.outcome==='LOST');const overdue=await this.db.crmTask.count({where:{...where,status:{in:['OPEN','IN_PROGRESS']},dueAt:{lt:now}}});
    return {leads:leads.length,newLeads:leads.filter(l=>l.status==='NEW').length,convertedLeads:leads.filter(l=>l.status==='CONVERTED').length,openDeals:open.length,pipelineValue:Number(open.reduce((n,d)=>n.add(d.value),new Prisma.Decimal(0))),weightedValue:Number(open.reduce((n,d)=>n.add(d.value.mul(d.stage.probability).div(100)),new Prisma.Decimal(0))),wonValue:Number(won.reduce((n,d)=>n.add(d.value),new Prisma.Decimal(0))),winRate:won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100):0,overdueTasks:overdue,completedActivities:activities,activeCampaigns:campaigns,tasks,tickets,sources:Object.entries(leads.reduce<Record<string,number>>((n,l)=>{n[l.source]=(n[l.source]??0)+1;return n;},{})).map(([name,total])=>({name,total})),stages:await this.db.crmStage.findMany({where:{pipeline:{organizationId:a.orgId}},include:{_count:{select:{deals:true}}},orderBy:{position:'asc'}}),recentDeals:deals.sort((x,y)=>y.updatedAt.getTime()-x.updatedAt.getTime()).slice(0,6)};
  }
}
