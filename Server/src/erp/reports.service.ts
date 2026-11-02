import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Actor } from '../auth/auth.guard.js';
import type { ListDto } from '../common/dto.js';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class ReportsService {
  constructor(private db: PrismaService) {}
  async stock(a: Actor, q: ListDto) {
    const products = await this.db.product.findMany({
      where: {
        organizationId: a.orgId,
        isActive: true,
        ...(q.q
          ? {
              OR: [
                { name: { contains: q.q, mode: 'insensitive' as const } },
                { sku: { contains: q.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { stockLevels: { include: { warehouse: true } } },
      orderBy: { name: 'asc' },
    });
    const all = products
      .map((p) => ({
        ...p,
        quantity: p.stockLevels.reduce((n, s) => n + s.quantity, 0),
        value: Number(
          p.costPrice.mul(p.stockLevels.reduce((n, s) => n + s.quantity, 0)),
        ),
      }))
      .filter((p) => q.low !== 'true' || p.quantity <= p.reorderPoint);
    return {
      data: all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      meta: { page: q.page, pageSize: q.pageSize, total: all.length },
      valuation: Number(
        all.reduce((n, p) => n.add(p.value), new Prisma.Decimal(0)),
      ),
    };
  }
  async aging(a: Actor) {
    const invoices = await this.db.invoice.findMany({
      where: { organizationId: a.orgId, status: { in: ['SENT', 'PARTIAL'] } },
      include: { contact: true },
    });
    const buckets = [
      { name: 'Current', total: 0 },
      { name: '1–30 days', total: 0 },
      { name: '31–60 days', total: 0 },
      { name: '61–90 days', total: 0 },
      { name: '90+ days', total: 0 },
    ];
    for (const i of invoices) {
      const days = i.dueDate
        ? Math.floor((Date.now() - i.dueDate.getTime()) / 86400000)
        : 0;
      const index =
        days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
      buckets[index].total += Number(i.total.sub(i.amountPaid));
    }
    return { buckets, invoices };
  }
  async sales(a: Actor, q: ListDto) {
    const end = q.to ? new Date(q.to) : new Date();
    if (q.to?.length === 10) end.setUTCHours(23, 59, 59, 999);
    const start = q.from
      ? new Date(q.from)
      : new Date(end.getTime() - 29 * 86400000);
    start.setUTCHours(0, 0, 0, 0);
    if (start > end)
      throw new BadRequestException('Start date must not be after end date');
    const invoices = await this.db.invoice.findMany({
      where: {
        organizationId: a.orgId,
        ...(a.role === 'SALES' ? { createdById: a.userId } : {}),
        status: { in: ['SENT', 'PARTIAL', 'PAID'] },
        issueDate: { gte: start, lte: end },
      },
      include: { lines: true },
    });
    const byDay: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    for (const invoice of invoices) {
      const day = invoice.issueDate.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + Number(invoice.total);
      for (const l of invoice.lines)
        byProduct[l.description] =
          (byProduct[l.description] ?? 0) + Number(l.unitPrice) * l.quantity;
    }
    return {
      from: start,
      to: end,
      total: invoices.reduce((s, i) => s + Number(i.total), 0),
      count: invoices.length,
      series: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total })),
      topProducts: Object.entries(byProduct)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    };
  }
  async profitLoss(a: Actor, q: ListDto) {
    const end = q.to ? new Date(q.to) : new Date();
    if (q.to?.length === 10) end.setUTCHours(23, 59, 59, 999);
    const start = q.from
      ? new Date(q.from)
      : new Date(end.getTime() - 29 * 86400000);
    start.setUTCHours(0, 0, 0, 0);
    if (start > end)
      throw new BadRequestException('Start date must not be after end date');
    const [invoices, products] = await Promise.all([
      this.db.invoice.findMany({
        where: {
          organizationId: a.orgId,
          status: { in: ['SENT', 'PARTIAL', 'PAID'] },
          issueDate: { gte: start, lte: end },
        },
        include: { lines: true },
      }),
      this.db.product.findMany({
        where: { organizationId: a.orgId },
        select: { id: true, costPrice: true },
      }),
    ]);
    const costs = new Map(products.map((p) => [p.id, p.costPrice]));
    const revenue = invoices.reduce(
      (n, i) => n.add(i.subtotal),
      new Prisma.Decimal(0),
    );
    const costOfGoods = invoices
      .flatMap((i) => i.lines)
      .reduce(
        (n, l) =>
          n.add(
            (costs.get(l.productId ?? '') ?? new Prisma.Decimal(0)).mul(
              l.quantity,
            ),
          ),
        new Prisma.Decimal(0),
      );
    return {
      revenue: Number(revenue),
      costOfGoods: Number(costOfGoods),
      grossProfit: Number(revenue.sub(costOfGoods)),
      from: start,
      to: end,
    };
  }
  async dashboard(a: Actor) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    if (a.role === 'INVENTORY') {
      const [stock, ordersToday, activity] = await Promise.all([
        this.stock(a, { page: 1, pageSize: 100, low: 'true' }),
        this.db.salesOrder.count({
          where: { organizationId: a.orgId, createdAt: { gte: today } },
        }),
        this.db.auditLog.findMany({
          where: {
            organizationId: a.orgId,
            entityType: {
              in: ['products', 'warehouses', 'purchase-orders', 'vendors'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { name: true } } },
        }),
      ]);
      return {
        revenue: 0,
        openAR: 0,
        ordersToday,
        stockAlerts: stock.meta.total,
        lowStock: stock.data.slice(0, 4),
        overdue: [],
        pendingQuotes: 0,
        activity,
        recentInvoices: [],
        sales: { total: 0, count: 0, series: [], topProducts: [] },
      };
    }
    const own = a.role === 'SALES' ? { createdById: a.userId } : {};
    const [
      payments,
      receivables,
      ordersToday,
      stock,
      activity,
      invoices,
      quotes,
      sales,
    ] = await Promise.all([
      this.db.payment.aggregate({
        where: {
          organizationId: a.orgId,
          ...(a.role === 'SALES'
            ? { allocations: { some: { invoice: { createdById: a.userId } } } }
            : {}),
          paidAt: { gte: monthStart, lte: now },
        },
        _sum: { amount: true },
      }),
      this.db.invoice.findMany({
        where: {
          organizationId: a.orgId,
          ...own,
          status: { in: ['SENT', 'PARTIAL'] },
        },
      }),
      this.db.salesOrder.count({
        where: { organizationId: a.orgId, ...own, createdAt: { gte: today } },
      }),
      this.stock(a, { page: 1, pageSize: 100, low: 'true' }),
      this.db.auditLog.findMany({
        where: {
          organizationId: a.orgId,
          ...(a.role === 'SALES' ? { userId: a.userId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      this.db.invoice.findMany({
        where: { organizationId: a.orgId, ...own },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { contact: true },
      }),
      this.db.quote.count({
        where: {
          organizationId: a.orgId,
          ...own,
          status: { in: ['DRAFT', 'SENT'] },
        },
      }),
      this.sales(a, { page: 1, pageSize: 20 }),
    ]);
    return {
      revenue: Number(payments._sum.amount ?? 0),
      openAR: receivables.reduce(
        (s, i) => s + Number(i.total.sub(i.amountPaid)),
        0,
      ),
      ordersToday,
      stockAlerts: stock.meta.total,
      lowStock: stock.data.slice(0, 4),
      overdue: receivables.filter((i) => i.dueDate && i.dueDate < today),
      pendingQuotes: quotes,
      activity,
      recentInvoices: invoices,
      sales,
    };
  }
}
