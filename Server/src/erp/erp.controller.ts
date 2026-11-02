import { Body, Controller, Get, Post, Patch, Delete, Param, Query, Req, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, Roles, type AuthRequest } from '../auth/auth.guard.js';
import { CatalogService } from './catalog.service.js';
import { WorkflowsService, docKinds, type DocKind } from './workflows.service.js';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListDto, MasterDto, DocumentDto, AdjustmentDto, PaymentDto, ReceiveDto, WarehouseDto, OrgDto, MemberDto } from '../common/dto.js';
import { randomBytes, createHash } from 'node:crypto';

const masters = ['contacts','companies','products','warehouses','vendors','tax-rates'];
@ApiTags('Workspace') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller()
export class ErpController {
  constructor(private catalog: CatalogService, private flows: WorkflowsService, private reports: ReportsService, private db: PrismaService) {}
  private kind(kind: string): DocKind { if (!(docKinds as readonly string[]).includes(kind)) throw new NotFoundException(); return kind as DocKind; }

  @Get('orgs/current') org(@Req() r: AuthRequest) { return this.db.organization.findUniqueOrThrow({ where: { id: r.actor.orgId } }); }
  @Patch('orgs/current') @Roles() async updateOrg(@Req() r: AuthRequest, @Body() dto: OrgDto) {
    if (!/^[A-Z]{3}$/.test(dto.currency)) throw new BadRequestException('Use an uppercase ISO currency code');
    try { new Intl.DateTimeFormat('en', { timeZone: dto.timezone }); new Intl.NumberFormat('en', { style: 'currency', currency: dto.currency }); } catch { throw new BadRequestException('Invalid currency or timezone'); }
    const org = await this.db.organization.findUniqueOrThrow({ where: { id: r.actor.orgId } });
    if (org.currency !== dto.currency && (await this.db.invoice.count({ where: { organizationId: r.actor.orgId } }) || await this.db.quote.count({ where: { organizationId: r.actor.orgId } }) || await this.db.purchaseOrder.count({ where: { organizationId: r.actor.orgId } }) || await this.db.salesOrder.count({ where: { organizationId: r.actor.orgId } }))) throw new BadRequestException('Currency cannot change after documents have been created');
    return this.db.$transaction(async tx => {
      const result = await tx.organization.update({ where: { id: r.actor.orgId }, data: dto });
      await this.flows.audit(tx, r.actor, 'profile updated', 'organization', r.actor.orgId); return result;
    });
  }
  @Get('orgs/current/members') @Roles() async members(@Req() r: AuthRequest) {
    return this.db.membership.findMany({ where: { organizationId: r.actor.orgId }, include: { user: { select: { id: true, name: true, email: true } } } });
  }
  @Post('orgs/current/members') @Roles() async invite(@Req() r: AuthRequest, @Body() dto: MemberDto) {
    const token = randomBytes(32).toString('hex');
    const invitation = await this.db.invitation.create({ data: { organizationId: r.actor.orgId, email: dto.email.toLowerCase(), role: dto.role, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    await this.flows.audit(this.db, r.actor, 'member invited', 'members', invitation.id);
    return { url: `${process.env.CLIENT_ORIGIN ?? 'http://localhost:3000'}/invite/${token}`, expiresAt: invitation.expiresAt };
  }
  @Get('reports/dashboard') dashboard(@Req() r: AuthRequest) { return this.reports.dashboard(r.actor); }
  @Get('reports/ar-aging') aging(@Req() r: AuthRequest) { return this.reports.aging(r.actor); }
  @Get('reports/sales') sales(@Req() r: AuthRequest, @Query() q: ListDto) { return this.reports.sales(r.actor,q); }
  @Get('stock') stock(@Req() r: AuthRequest, @Query() q: ListDto) { return this.reports.stock(r.actor,q); }
  @Post('stock/adjustments') @Roles('INVENTORY') adjust(@Req() r: AuthRequest, @Body() dto: AdjustmentDto) { return this.flows.adjust(r.actor,dto); }
  @Get('stock/movements') async moves(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = { organizationId: r.actor.orgId };
    const [data, total, products, warehouses] = await Promise.all([this.db.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page-1)*q.pageSize, take: q.pageSize }), this.db.stockMovement.count({ where }), this.db.product.findMany({ where, select: { id: true, name: true, sku: true } }), this.db.warehouse.findMany({ where, select: { id: true, name: true } })]);
    return { data: data.map(m => ({ ...m, product: products.find(p => p.id === m.productId), warehouse: warehouses.find(w => w.id === m.warehouseId) })), meta: { page: q.page, pageSize: q.pageSize,total } };
  }
  @Get('audit-logs') @Roles() async audit(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = { organizationId: r.actor.orgId };
    const [data,total] = await Promise.all([this.db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page-1)*q.pageSize,take:q.pageSize,include:{user:{select:{name:true}}} }),this.db.auditLog.count({where})]);
    return {data,meta:{page:q.page,pageSize:q.pageSize,total}};
  }
  @Get('payments') async payments(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = { organizationId: r.actor.orgId };
    const [data,total] = await Promise.all([this.db.payment.findMany({ where,orderBy:{createdAt:'desc'},skip:(q.page-1)*q.pageSize,take:q.pageSize,include:{allocations:{include:{invoice:{select:{number:true,id:true}}}}} }),this.db.payment.count({where})]);
    return {data,meta:{page:q.page,pageSize:q.pageSize,total}};
  }
  @Post('payments') @Roles('FINANCE') payment(@Req() r: AuthRequest, @Body() dto: PaymentDto) { return this.flows.payment(r.actor,dto); }
  @Get('bills') async bills(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where={organizationId:r.actor.orgId}; const [data,total]=await Promise.all([this.db.bill.findMany({where,orderBy:{createdAt:'desc'},skip:(q.page-1)*q.pageSize,take:q.pageSize}),this.db.bill.count({where})]);return {data,meta:{page:q.page,pageSize:q.pageSize,total}};
  }
  @Post('purchase-orders/:id/bill') @Roles('FINANCE') async bill(@Req() r: AuthRequest,@Param('id') id:string) {
    return this.db.$transaction(async tx=>{
      const po=await tx.purchaseOrder.findFirst({where:{id,organizationId:r.actor.orgId},include:{vendor:true}}); if(!po)throw new NotFoundException();
      if(!['PARTIAL','PAID'].includes(po.status))throw new BadRequestException('Receive goods before creating a bill');
      const existing=await tx.bill.findUnique({where:{purchaseOrderId:id}});if(existing)return existing;
      const bill=await tx.bill.create({data:{organizationId:r.actor.orgId,purchaseOrderId:id,number:`BILL-${po.number}`,vendorName:po.vendor.name,total:po.total,dueDate:new Date(Date.now()+30*86400000)}});
      await this.flows.audit(tx,r.actor,'bill created','bills',bill.id);return bill;
    },{isolationLevel:'Serializable'});
  }
  @Post('bills/:id/pay') @Roles('FINANCE') async payBill(@Req() r:AuthRequest,@Param('id') id:string) {
    return this.db.$transaction(async tx=>{
      const bill=await tx.bill.findFirst({where:{id,organizationId:r.actor.orgId}});if(!bill)throw new NotFoundException();if(bill.status==='PAID')throw new BadRequestException('Bill already paid');
      const updated=await tx.bill.update({where:{id},data:{amountPaid:bill.total,status:'PAID'}});await this.flows.audit(tx,r.actor,'bill paid','bills',id);return updated;
    },{isolationLevel:'Serializable'});
  }
  @Post('quotes/:id/convert') @Roles('SALES') convert(@Req() r: AuthRequest,@Param('id') id:string) { return this.flows.convert(r.actor,id); }
  @Post('sales-orders/:id/invoice') @Roles('SALES','FINANCE') invoice(@Req() r:AuthRequest,@Param('id') id:string) { return this.flows.invoice(r.actor,id); }
  @Post('sales-orders/:id/ship') @Roles('INVENTORY') ship(@Req() r:AuthRequest,@Param('id') id:string,@Body() dto:WarehouseDto) { return this.flows.ship(r.actor,id,dto.warehouseId); }
  @Post('invoices/:id/send') @Roles('FINANCE') send(@Req() r:AuthRequest,@Param('id') id:string) { return this.flows.send(r.actor,id); }
  @Post('purchase-orders/:id/receive') @Roles('INVENTORY') receive(@Req() r:AuthRequest,@Param('id') id:string,@Body() dto:ReceiveDto) { return this.flows.receive(r.actor,id,dto); }
  @Post(':kind/:id/void') cancel(@Req() r:AuthRequest,@Param('kind') k:string,@Param('id') id:string) { return this.flows.cancel(r.actor,this.kind(k),id); }

  @Get(':resource') list(@Req() r:AuthRequest,@Param('resource') resource:string,@Query() q:ListDto) {
    return masters.includes(resource) ? this.catalog.list(r.actor,resource,q) : this.flows.list(r.actor,this.kind(resource),q);
  }
  @Get(':resource/:id') get(@Req() r:AuthRequest,@Param('resource') resource:string,@Param('id') id:string) {
    return masters.includes(resource) ? this.catalog.get(r.actor,resource,id) : this.flows.detail(r.actor,this.kind(resource),id);
  }
  @Post(masters) createMaster(@Req() r:AuthRequest,@Body() dto:MasterDto) { return this.catalog.save(r.actor,r.path.slice(1),dto); }
  @Patch(':resource/:id') updateMaster(@Req() r:AuthRequest,@Param('resource') resource:string,@Param('id') id:string,@Body() dto:MasterDto) { return this.catalog.save(r.actor,resource,dto,id); }
  @Delete(':resource/:id') deleteMaster(@Req() r:AuthRequest,@Param('resource') resource:string,@Param('id') id:string) { return this.catalog.remove(r.actor,resource,id); }
  @Post([...docKinds]) createDoc(@Req() r:AuthRequest,@Body() dto:DocumentDto) { return this.flows.create(r.actor,this.kind(r.path.slice(1)),dto); }
}
