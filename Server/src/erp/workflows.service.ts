import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, type DocStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Actor } from '../auth/auth.guard.js';
import type { DocumentDto, AdjustmentDto, PaymentDto, ReceiveDto, ListDto } from '../common/dto.js';
import { totals } from './money.js';

export const docKinds = ['quotes', 'sales-orders', 'invoices', 'purchase-orders'] as const;
export type DocKind = typeof docKinds[number];
const models = { quotes: 'quote', 'sales-orders': 'salesOrder', invoices: 'invoice', 'purchase-orders': 'purchaseOrder' } as const;
const prefixes = { quotes: 'QT', 'sales-orders': 'SO', invoices: 'INV', 'purchase-orders': 'PO' };
@Injectable()
export class WorkflowsService {
  constructor(private db: PrismaService) {}
  authorize(a: Actor, kind: DocKind) {
    const roles = kind === 'invoices' ? ['FINANCE'] : kind === 'purchase-orders' ? ['INVENTORY'] : ['SALES'];
    if (!['OWNER','ADMIN',...roles].includes(a.role)) throw new ForbiddenException();
  }
  audit(tx: Prisma.TransactionClient, a: Actor, action: string, entityType: string, entityId: string) {
    return tx.auditLog.create({ data: { organizationId: a.orgId, userId: a.userId, action, entityType, entityId } });
  }
  async number(tx: Prisma.TransactionClient, orgId: string, kind: DocKind) {
    const seq = await tx.numberSequence.upsert({ where: { organizationId_key: { organizationId: orgId, key: kind } }, create: { organizationId: orgId, key: kind, prefix: prefixes[kind], nextValue: 2 }, update: { nextValue: { increment: 1 } } });
    return `${seq.prefix}-${String(seq.nextValue - 1).padStart(5, '0')}`;
  }
  async list(a: Actor, kind: DocKind, q: ListDto) {
    const where = { organizationId: a.orgId, ...(a.role === 'SALES' && kind !== 'purchase-orders' ? { createdById: a.userId } : {}), ...(q.status ? { status: q.status as DocStatus } : {}), ...(q.q ? { number: { contains: q.q, mode: 'insensitive' as const } } : {}) };
    const args = { where, orderBy: { createdAt: 'desc' as const }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { lines: true } };
    // Identical document list signatures, with generated return types retained.
    const [data, total] = await (kind === 'quotes' ? Promise.all([this.db.quote.findMany({ ...args, include: { lines: true, contact: true } }), this.db.quote.count({ where })]) : kind === 'sales-orders' ? Promise.all([this.db.salesOrder.findMany({ ...args, include: { lines: true, contact: true } }), this.db.salesOrder.count({ where })]) : kind === 'invoices' ? Promise.all([this.db.invoice.findMany({ ...args, include: { lines: true, contact: true } }), this.db.invoice.count({ where })]) : Promise.all([this.db.purchaseOrder.findMany({ ...args, include: { lines: true, vendor: true } }), this.db.purchaseOrder.count({ where })]));
    return { data, meta: { page: q.page, pageSize: q.pageSize, total } };
  }
  async detail(a: Actor, kind: DocKind, id: string) {
    const where = { id, organizationId: a.orgId, ...(a.role === 'SALES' && kind !== 'purchase-orders' ? { createdById: a.userId } : {}) };
    const doc = kind === 'quotes' ? await this.db.quote.findFirst({ where, include: { lines: true, contact: true, salesOrder: true } }) : kind === 'sales-orders' ? await this.db.salesOrder.findFirst({ where, include: { lines: true, contact: true, quote: true, invoices: true } }) : kind === 'invoices' ? await this.db.invoice.findFirst({ where, include: { lines: true, contact: true, salesOrder: { include: { quote: true } }, allocations: { include: { payment: true } } } }) : await this.db.purchaseOrder.findFirst({ where, include: { lines: true, vendor: true } });
    if (!doc) throw new NotFoundException();
    return doc;
  }
  async create(a: Actor, kind: DocKind, dto: DocumentDto) {
    this.authorize(a, kind);
    const sums = totals(dto.lines);
    return this.db.$transaction(async tx => {
      if (dto.contactId && !(await tx.contact.findFirst({ where: { id: dto.contactId, organizationId: a.orgId } }))) throw new NotFoundException('Contact not found');
      if (kind === 'purchase-orders' && (!dto.vendorId || !(await tx.vendor.findFirst({ where: { id: dto.vendorId, organizationId: a.orgId } })))) throw new NotFoundException('Vendor not found');
      for (const line of dto.lines) if (line.productId && !(await tx.product.findFirst({ where: { id: line.productId, organizationId: a.orgId, isActive: true } }))) throw new NotFoundException('Product not found');
      const number = await this.number(tx, a.orgId, kind);
      const common = { organizationId: a.orgId, number, ...sums, ...(kind !== 'purchase-orders' ? { createdById: a.userId } : {}) };
      const lines = dto.lines.map((l, i) => ({ productId: l.productId || null, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxBps: l.taxBps ?? 0, sortOrder: i }));
      const contactId = dto.contactId || null;
      const doc = kind === 'quotes' ? await tx.quote.create({ data: { ...common, contactId, notes: dto.notes, validUntil: dto.validUntil ? new Date(dto.validUntil) : null, lines: { create: lines } } }) : kind === 'sales-orders' ? await tx.salesOrder.create({ data: { ...common, contactId, lines: { create: lines } } }) : kind === 'invoices' ? await tx.invoice.create({ data: { ...common, contactId, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, lines: { create: lines } } }) : await tx.purchaseOrder.create({ data: { ...common, vendorId: dto.vendorId!, lines: { create: lines.map(({ taxBps: _tax, ...line }) => line) } } });
      await this.audit(tx, a, 'created', kind, doc.id);
      return doc;
    });
  }
  async convert(a: Actor, id: string) {
    this.authorize(a, 'quotes');
    return this.db.$transaction(async tx => {
      const quote = await tx.quote.findFirst({ where: { id, organizationId: a.orgId, ...(a.role === 'SALES' ? { createdById: a.userId } : {}) }, include: { lines: true, salesOrder: true } });
      if (!quote) throw new NotFoundException();
      if (quote.salesOrder) return quote.salesOrder;
      if (['VOID','CANCELLED'].includes(quote.status)) throw new BadRequestException('This quote cannot be converted');
      const order = await tx.salesOrder.create({ data: { organizationId: a.orgId, createdById: quote.createdById, number: await this.number(tx, a.orgId, 'sales-orders'), quoteId: id, contactId: quote.contactId, subtotal: quote.subtotal, taxTotal: quote.taxTotal, total: quote.total, lines: { create: quote.lines.map(({ id: _id, quoteId: _qid, ...l }) => l) } } });
      await tx.quote.update({ where: { id }, data: { status: 'OPEN' } });
      await this.audit(tx, a, 'converted to sales order', 'quotes', id);
      return order;
    }, { isolationLevel: 'Serializable' });
  }
  async invoice(a: Actor, id: string) {
    if (!['OWNER','ADMIN','SALES','FINANCE'].includes(a.role)) throw new ForbiddenException();
    return this.db.$transaction(async tx => {
      const order = await tx.salesOrder.findFirst({ where: { id, organizationId: a.orgId, ...(a.role === 'SALES' ? { createdById: a.userId } : {}) }, include: { lines: true, invoices: true } });
      if (!order) throw new NotFoundException();
      if (order.invoices.length) return order.invoices[0];
      if (['VOID','CANCELLED'].includes(order.status)) throw new BadRequestException('Cancelled orders cannot be invoiced');
      const doc = await tx.invoice.create({ data: { organizationId: a.orgId, createdById: order.createdById, salesOrderId: id, number: await this.number(tx, a.orgId, 'invoices'), contactId: order.contactId, subtotal: order.subtotal, taxTotal: order.taxTotal, total: order.total, dueDate: new Date(Date.now() + 30 * 86400000), lines: { create: order.lines.map(({ id: _id, salesOrderId: _so, ...line }) => line) } } });
      await this.audit(tx, a, 'invoiced', 'sales-orders', id);
      return doc;
    }, { isolationLevel: 'Serializable' });
  }
  async send(a: Actor, id: string) {
    this.authorize(a, 'invoices');
    return this.db.$transaction(async tx => {
      const invoice = await tx.invoice.findFirst({ where: { id, organizationId: a.orgId } });
      if (!invoice) throw new NotFoundException();
      if (invoice.status !== 'DRAFT') throw new BadRequestException('Only draft invoices can be issued');
      const doc = await tx.invoice.update({ where: { id }, data: { status: invoice.total.isZero() ? 'PAID' : 'SENT' } });
      await this.audit(tx, a, 'issued', 'invoices', id);
      return doc;
    }, { isolationLevel: 'Serializable' });
  }
  async payment(a: Actor, dto: PaymentDto) {
    this.authorize(a, 'invoices');
    return this.db.$transaction(async tx => {
      const inv = await tx.invoice.findFirst({ where: { id: dto.invoiceId, organizationId: a.orgId } });
      if (!inv) throw new NotFoundException();
      if (!['SENT','PARTIAL'].includes(inv.status)) throw new BadRequestException('Issue the invoice before recording a payment');
      const paid = inv.amountPaid.add(dto.amount);
      if (paid.greaterThan(inv.total)) throw new BadRequestException('Payment exceeds the outstanding balance');
      const payment = await tx.payment.create({ data: { organizationId: a.orgId, amount: dto.amount, method: dto.method, reference: dto.reference, paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(), allocations: { create: { invoiceId: inv.id, amount: dto.amount } } } });
      await tx.invoice.update({ where: { id: inv.id }, data: { amountPaid: paid, status: paid.equals(inv.total) ? 'PAID' : 'PARTIAL' } });
      await this.audit(tx, a, 'payment recorded', 'invoices', inv.id);
      return payment;
    }, { isolationLevel: 'Serializable' });
  }
  async stockChange(tx: Prisma.TransactionClient, a: Actor, productId: string, warehouseId: string, quantity: number, type: 'ADJUST'|'RECEIVE'|'SHIP', reason: string, referenceId?: string) {
    if (!(await tx.product.findFirst({ where: { id: productId, organizationId: a.orgId } })) || !(await tx.warehouse.findFirst({ where: { id: warehouseId, organizationId: a.orgId } }))) throw new NotFoundException('Product or warehouse not found');
    const level = await tx.stockLevel.upsert({ where: { productId_warehouseId: { productId, warehouseId } }, create: { productId, warehouseId, quantity: 0 }, update: {} });
    if (level.quantity + quantity < 0) throw new BadRequestException('Insufficient stock in this warehouse');
    await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: { increment: quantity } } });
    await tx.stockMovement.create({ data: { organizationId: a.orgId, productId, warehouseId, quantity, type, reason, referenceId, referenceType: type === 'RECEIVE' ? 'purchase-orders' : type === 'SHIP' ? 'sales-orders' : undefined, createdById: a.userId } });
  }
  async adjust(a: Actor, dto: AdjustmentDto) {
    this.authorize(a, 'purchase-orders');
    if (!dto.quantity) throw new BadRequestException('Quantity must be non-zero');
    return this.db.$transaction(async tx => {
      await this.stockChange(tx, a, dto.productId, dto.warehouseId, dto.quantity, 'ADJUST', dto.reason);
      await this.audit(tx, a, 'stock adjusted', 'products', dto.productId);
      return { ok: true };
    }, { isolationLevel: 'Serializable' });
  }
  async receive(a: Actor, id: string, dto: ReceiveDto) {
    this.authorize(a, 'purchase-orders');
    if (!dto.lines.length || new Set(dto.lines.map(l => l.lineId)).size !== dto.lines.length) throw new BadRequestException('Supply unique receipt lines');
    return this.db.$transaction(async tx => {
      const po = await tx.purchaseOrder.findFirst({ where: { id, organizationId: a.orgId }, include: { lines: true } });
      if (!po) throw new NotFoundException();
      if (['VOID','CANCELLED','PAID'].includes(po.status)) throw new BadRequestException('This purchase order cannot be received');
      for (const receipt of dto.lines) {
        const line = po.lines.find(l => l.id === receipt.lineId);
        if (!line?.productId || receipt.quantity > line.quantity - line.quantityReceived) throw new BadRequestException('Receipt exceeds the remaining quantity or product is missing');
        await this.stockChange(tx, a, line.productId, dto.warehouseId, receipt.quantity, 'RECEIVE', `Received ${po.number}`, id);
        await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { quantityReceived: { increment: receipt.quantity } } });
      }
      const remaining = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: id } });
      const doc = await tx.purchaseOrder.update({ where: { id }, data: { status: remaining.every(l => l.quantityReceived === l.quantity) ? 'PAID' : 'PARTIAL' } });
      await this.audit(tx, a, 'stock received', 'purchase-orders', id);
      return doc;
    }, { isolationLevel: 'Serializable' });
  }
  async ship(a: Actor, id: string, warehouseId: string) {
    if (!['OWNER','ADMIN','INVENTORY'].includes(a.role)) throw new ForbiddenException();
    return this.db.$transaction(async tx => {
      const order = await tx.salesOrder.findFirst({ where: { id, organizationId: a.orgId }, include: { lines: true } });
      if (!order) throw new NotFoundException();
      if (order.status !== 'OPEN') throw new BadRequestException('Only open orders can be shipped');
      for (const line of order.lines) if (line.productId) await this.stockChange(tx, a, line.productId, warehouseId, -line.quantity, 'SHIP', `Shipped ${order.number}`, id);
      const doc = await tx.salesOrder.update({ where: { id }, data: { status: 'PAID' } });
      await this.audit(tx, a, 'shipped', 'sales-orders', id);
      return doc;
    }, { isolationLevel: 'Serializable' });
  }
  async cancel(a: Actor, kind: DocKind, id: string) {
    this.authorize(a, kind);
    return this.db.$transaction(async tx => {
      const model = tx[models[kind]] as unknown as { findFirst(args: object): Promise<{ status: string } | null>; update(args: object): Promise<unknown> };
      const doc = await model.findFirst({ where: { id, organizationId: a.orgId } });
      if (!doc) throw new NotFoundException();
      if (doc.status !== 'DRAFT') throw new BadRequestException('Only draft documents can be voided');
      const updated = await model.update({ where: { id }, data: { status: 'VOID' } });
      await this.audit(tx, a, 'voided', kind, id);
      return updated;
    }, { isolationLevel: 'Serializable' });
  }
}
