import { Body,Controller,Delete,Get,Param,Patch,Post,Query,Req,UseGuards,BadRequestException,NotFoundException } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuthGuard,type AuthRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrmService } from './crm.service.js';
import { CrmQueryDto,CrmRecordDto,PipelineDto,ConvertLeadDto,MoveDealDto,ReplyDto,ImportDto } from './crm.dto.js';

@ApiTags('CRM suite') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('crm')
export class CrmController {
  constructor(private crm:CrmService,private db:PrismaService){}
  @Get('meta') meta(@Req() r:AuthRequest){return this.crm.meta(r.actor);}
  @Get('summary') summary(@Req() r:AuthRequest){return this.crm.summary(r.actor);}
  @Post('pipelines') pipeline(@Req() r:AuthRequest,@Body() dto:PipelineDto){return this.crm.pipeline(r.actor,dto);}
  @Post('contacts/import') import(@Req() r:AuthRequest,@Body() dto:ImportDto){return this.crm.importContacts(r.actor,dto);}
  @Get('contacts/:id/context') context(@Req() r:AuthRequest,@Param('id') id:string){return this.crm.context(r.actor,id);}
  @Get('segments/:id/audience') audience(@Req() r:AuthRequest,@Param('id') id:string,@Query() q:CrmQueryDto){return this.crm.audience(r.actor,id,q);}
  @Post('leads/:id/convert') convert(@Req() r:AuthRequest,@Param('id') id:string,@Body() dto:ConvertLeadDto){return this.crm.convert(r.actor,id,dto);}
  @Post('deals/:id/move') move(@Req() r:AuthRequest,@Param('id') id:string,@Body() dto:MoveDealDto){return this.crm.save(r.actor,'deals',dto,id);}
  @Post('deals/:id/quote') async quote(@Req() r:AuthRequest,@Param('id') id:string){
    this.crm.write(r.actor);return this.db.$transaction(async tx=>{
      const d=await tx.deal.findFirst({where:{id,organizationId:r.actor.orgId},include:{stage:true}});if(!d)throw new NotFoundException();if(d.quoteId)return tx.quote.findUniqueOrThrow({where:{id:d.quoteId}});
      if(d.stage.outcome==='LOST')throw new BadRequestException('Reopen a lost deal before creating a quote');
      const organization=await tx.organization.findUniqueOrThrow({where:{id:r.actor.orgId}});
      const sequence=await tx.numberSequence.upsert({where:{organizationId_key:{organizationId:r.actor.orgId,key:'quotes'}},create:{organizationId:r.actor.orgId,key:'quotes',prefix:'QT',nextValue:2},update:{nextValue:{increment:1}}});
      const q=await tx.quote.create({data:{organizationId:r.actor.orgId,createdById:r.actor.userId,contactId:d.contactId,currency:organization.currency,number:`${sequence.prefix}-${String(sequence.nextValue-1).padStart(5,'0')}`,subtotal:d.value,taxTotal:new Prisma.Decimal(0),total:d.value,notes:d.notes,lines:{create:{description:d.name,quantity:1,unitPrice:d.value}}}});
      await tx.deal.update({where:{id},data:{quoteId:q.id}});await this.crm.audit(tx,r.actor,'quote created','deals',id);return q;
    },{isolationLevel:'Serializable'});
  }
  @Post('tickets/:id/replies') async reply(@Req() r:AuthRequest,@Param('id') id:string,@Body() dto:ReplyDto){this.crm.write(r.actor);if(!dto.body.trim())throw new BadRequestException('Write a message');return this.db.$transaction(async tx=>{await this.crm.getRecord(tx,r.actor,'tickets',id);const result=await tx.ticketReply.create({data:{ticketId:id,userId:r.actor.userId,body:dto.body.trim(),isInternal:dto.isInternal}});await this.crm.audit(tx,r.actor,dto.isInternal?'internal note added':'customer reply recorded (not delivered)','tickets',id);return result;});}
  @Get(':kind') list(@Req() r:AuthRequest,@Param('kind') k:string,@Query() q:CrmQueryDto){return this.crm.list(r.actor,this.crm.kind(k),q);}
  @Get(':kind/:id') detail(@Req() r:AuthRequest,@Param('kind') k:string,@Param('id') id:string){return this.crm.detail(r.actor,this.crm.kind(k),id);}
  @Post(':kind') create(@Req() r:AuthRequest,@Param('kind') k:string,@Body() dto:CrmRecordDto){return this.crm.save(r.actor,this.crm.kind(k),dto);}
  @Patch(':kind/:id') update(@Req() r:AuthRequest,@Param('kind') k:string,@Param('id') id:string,@Body() dto:CrmRecordDto){return this.crm.save(r.actor,this.crm.kind(k),dto,id);}
  @Delete(':kind/:id') remove(@Req() r:AuthRequest,@Param('kind') k:string,@Param('id') id:string){return this.crm.remove(r.actor,this.crm.kind(k),id);}
}
