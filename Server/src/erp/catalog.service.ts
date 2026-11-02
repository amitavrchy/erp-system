import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Actor } from '../auth/auth.guard.js';
import type { ListDto, MasterDto } from '../common/dto.js';
import { CrmService } from '../crm/crm.service.js';

const resources = {
  contacts: {
    model: 'contact',
    fields: ['name', 'email', 'phone', 'title', 'companyId', 'tags','lifecycle','source','ownerId','customFields'],
    roles: ['SALES'],
    search: 'name',
  },
  companies: {
    model: 'company',
    fields: ['name', 'website', 'notes'],
    roles: ['SALES'],
    search: 'name',
  },
  products: {
    model: 'product',
    fields: [
      'name',
      'sku',
      'description',
      'unitPrice',
      'costPrice',
      'reorderPoint',
      'isActive',
      'attrsJson',
    ],
    roles: ['INVENTORY'],
    search: 'name',
  },
  warehouses: {
    model: 'warehouse',
    fields: ['name', 'code'],
    roles: ['INVENTORY'],
    search: 'name',
  },
  vendors: {
    model: 'vendor',
    fields: ['name', 'email', 'phone'],
    roles: ['INVENTORY'],
    search: 'name',
  },
  'tax-rates': {
    model: 'taxRate',
    fields: ['name', 'rateBps'],
    roles: [],
    search: 'name',
  },
} as const;
export type Resource = keyof typeof resources;
// A narrow adapter for shared CRUD; business workflows use generated Prisma types directly.
type Delegate = {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  findFirst(args: object): Promise<Record<string, unknown> | null>;
  count(args: object): Promise<number>;
  create(args: object): Promise<Record<string, unknown> & { id: string }>;
  update(args: object): Promise<Record<string, unknown>>;
  delete(args: object): Promise<unknown>;
};
@Injectable()
export class CatalogService {
  constructor(private db: PrismaService,private crm:CrmService) {}
  config(resource: string) {
    if (!Object.hasOwn(resources, resource)) throw new NotFoundException();
    return resources[resource as Resource];
  }
  delegate(db: Prisma.TransactionClient, resource: string) {
    return db[this.config(resource).model] as unknown as Delegate;
  }
  async list(a: Actor, resource: string, q: ListDto) {
    const config = this.config(resource);
    const where = {
      organizationId: a.orgId,
      ...(q.q
        ? {
            OR: [
              config.search,
              ...(resource === 'products'
                ? ['sku']
                : resource === 'contacts'
                  ? ['email', 'phone']
                  : []),
            ].map((field) => ({
              [field]: { contains: q.q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const model = this.delegate(this.db, resource);
    const [data, total] = await Promise.all([
      model.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        ...(resource === 'products'
          ? { include: { stockLevels: { include: { warehouse: true } } } }
          : {}),
        ...(resource === 'contacts' ? { include: { company: true } } : {}),
      }),
      model.count({ where }),
    ]);
    return { data, meta: { page: q.page, pageSize: q.pageSize, total } };
  }
  async get(a: Actor, resource: string, id: string) {
    const ownDocs =
      a.role === 'SALES' ? { where: { createdById: a.userId } } : true;
    const record = await this.delegate(this.db, resource).findFirst({
      where: { id, organizationId: a.orgId },
      ...(resource === 'contacts'
        ? {
            include: {
              company: true,
              quotes: ownDocs,
              salesOrders: ownDocs,
              invoices: ownDocs,
            },
          }
        : resource === 'products'
          ? { include: { stockLevels: { include: { warehouse: true } } } }
          : {}),
    });
    if (!record) throw new NotFoundException();
    return record;
  }
  async save(a: Actor, resource: string, dto: MasterDto, id?: string) {
    const config = this.config(resource);
    if (!['OWNER', 'ADMIN', ...config.roles].includes(a.role))
      throw new ForbiddenException();
    if (
      dto.attrsJson &&
      (Object.keys(dto.attrsJson).length > 20 ||
        Object.entries(dto.attrsJson).some(
          ([key, value]) =>
            key.length > 50 || typeof value !== 'string' || value.length > 200,
        ))
    )
      throw new BadRequestException(
        'Use at most 20 text attributes, with keys up to 50 and values up to 200 characters',
      );
    const supplied = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    );
    const input = Object.fromEntries(
      supplied.filter(([key]) =>
        (config.fields as readonly string[]).includes(key),
      ),
    );
    if (resource === 'contacts' && dto.companyId === '') input.companyId = null;
    if (
      supplied.some(
        ([key]) => !(config.fields as readonly string[]).includes(key),
      )
    )
      throw new BadRequestException('Unexpected field for this record type');
    if (!id && !dto.name) throw new BadRequestException('Name is required');
    if (
      !id &&
      resource === 'products' &&
      (!dto.sku || dto.unitPrice === undefined)
    )
      throw new BadRequestException('SKU and unit price are required');
    if (!id && resource === 'warehouses' && !dto.code)
      throw new BadRequestException('Warehouse code is required');
    if (!id && resource === 'tax-rates' && dto.rateBps === undefined)
      throw new BadRequestException('Tax rate is required');
    return this.db.$transaction(async (tx) => {
      if(resource==='contacts'){
        await this.crm.validateLinks(tx,a,{ownerId:dto.ownerId});
        if(dto.customFields!==undefined)await this.crm.validateCustom(tx,a,'contacts',dto.customFields);
        if(input.ownerId==='')input.ownerId=null;
      }
      if (
        dto.companyId &&
        !(await tx.company.findFirst({
          where: { id: dto.companyId, organizationId: a.orgId },
        }))
      )
        throw new NotFoundException('Company not found');
      const model = this.delegate(tx, resource);
      if (
        id &&
        !(await model.findFirst({ where: { id, organizationId: a.orgId } }))
      )
        throw new NotFoundException();
      const record = id
        ? await model.update({
            where: { id, organizationId: a.orgId },
            data: input,
          })
        : await model.create({
            data: {
              ...input,
              organizationId: a.orgId,
              ...(resource === 'contacts' && !dto.tags ? { tags: [] } : {}),
            },
          });
      await tx.auditLog.create({
        data: {
          organizationId: a.orgId,
          userId: a.userId,
          action: id ? 'updated' : 'created',
          entityType: resource,
          entityId: String(record.id),
        },
      });
      return record;
    });
  }
  async remove(a: Actor, resource: string, id: string) {
    const config = this.config(resource);
    if (!['OWNER', 'ADMIN', ...config.roles].includes(a.role))
      throw new ForbiddenException();
    return this.db.$transaction(async (tx) => {
      const model = this.delegate(tx, resource);
      if (!(await model.findFirst({ where: { id, organizationId: a.orgId } })))
        throw new NotFoundException();
      if (resource === 'products') {
        if (
          await tx.stockLevel.count({
            where: { productId: id, quantity: { not: 0 } },
          })
        )
          throw new BadRequestException(
            'Clear remaining stock before archiving this product',
          );
        await model.update({
          where: { id, organizationId: a.orgId },
          data: { isActive: false },
        });
      } else if (resource === 'warehouses') {
        if (
          await tx.stockMovement.count({
            where: { warehouseId: id, organizationId: a.orgId },
          })
        )
          throw new BadRequestException(
            'A warehouse with stock history cannot be deleted',
          );
        await model.delete({ where: { id, organizationId: a.orgId } });
      } else await model.delete({ where: { id, organizationId: a.orgId } });
      await tx.auditLog.create({
        data: {
          organizationId: a.orgId,
          userId: a.userId,
          action: resource === 'products' ? 'archived' : 'deleted',
          entityType: resource,
          entityId: id,
        },
      });
      return { ok: true };
    });
  }
}
