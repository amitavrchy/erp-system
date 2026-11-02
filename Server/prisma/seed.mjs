import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { WorkflowsService } from '../dist/erp/workflows.service.js';

if (process.env.NODE_ENV === 'production')
  throw new Error('Demo seeding is disabled in production');
if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 10)
  throw new Error('Set DEMO_PASSWORD (10+ characters) in .env before seeding');
const db = new PrismaClient();
try {
  if (
    await db.organization.findUnique({ where: { slug: 'ledgerflow-demo' } })
  ) {
    console.log(
      'Demo workspace already exists. Existing records were preserved.',
    );
  } else {
    await db.$transaction(
      async (tx) => {
        const db = new Proxy(tx, {
          get(target, key) {
            return key === '$transaction'
              ? async (callback) => callback(tx)
              : target[key];
          },
        });
        const passwordHash = await hash(process.env.DEMO_PASSWORD, 12);
        const result = await db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: 'owner@ledgerflow.demo',
              name: 'Alex Morgan',
              passwordHash,
            },
          });
          const org = await tx.organization.create({
            data: {
              name: 'Acme Studio',
              slug: 'ledgerflow-demo',
              currency: 'USD',
              timezone: 'UTC',
              members: { create: { userId: user.id, role: 'OWNER' } },
            },
          });
          const warehouse = await tx.warehouse.create({
            data: {
              organizationId: org.id,
              name: 'Main warehouse',
              code: 'MAIN',
              isDefault: true,
            },
          });
          const second = await tx.warehouse.create({
            data: {
              organizationId: org.id,
              name: 'Downtown showroom',
              code: 'DT',
            },
          });
          const companies = [];
          for (const name of [
            'Northstar Design',
            'Studio Forma',
            'Meridian Co.',
          ])
            companies.push(
              await tx.company.create({
                data: {
                  organizationId: org.id,
                  name,
                  website: `https://${name.toLowerCase().replaceAll(/[^a-z]/g, '')}.example`,
                },
              }),
            );
          const contacts = [];
          for (const [i, name] of [
            'Olivia Rhye',
            'Phoenix Baker',
            'Lana Steiner',
            'Demi Wilkinson',
            'Drew Cano',
            'Natali Craig',
            'Orlando Diggs',
            'Kate Morrison',
          ].entries())
            contacts.push(
              await tx.contact.create({
                data: {
                  organizationId: org.id,
                  companyId: companies[i % 3].id,
                  name,
                  email: name.toLowerCase().replace(' ', '.') + '@example.com',
                  title: ['Founder', 'Operations lead', 'Purchasing manager'][
                    i % 3
                  ],
                  tags: ['customer'],
                },
              }),
            );
          const products = [];
          const catalog = [
            ['Arc desk lamp', 129, 64, 5, 24],
            ['Everyday notebook', 18, 6, 20, 12],
            ['Studio task chair', 349, 180, 5, 18],
            ['Oak monitor stand', 89, 38, 10, 7],
            ['Canvas carry tote', 32, 12, 15, 48],
            ['Ceramic desk tray', 45, 18, 10, 32],
            ['Focus desk mat', 59, 24, 12, 54],
            ['Glass water bottle', 28, 10, 15, 9],
            ['Modular shelf', 199, 90, 4, 14],
            ['Wireless keyboard', 119, 62, 8, 27],
            ['Brass pen holder', 39, 14, 8, 42],
            ['Linen planner', 24, 8, 15, 36],
          ];
          for (const [
            i,
            [name, unitPrice, costPrice, reorderPoint, quantity],
          ] of catalog.entries()) {
            const p = await tx.product.create({
              data: {
                organizationId: org.id,
                name,
                sku: `ACM-${String(i + 1).padStart(3, '0')}`,
                unitPrice,
                costPrice,
                reorderPoint,
                description: 'Thoughtfully made for a better working day.',
                stockLevels: {
                  create: { warehouseId: warehouse.id, quantity },
                },
              },
            });
            await tx.stockMovement.create({
              data: {
                organizationId: org.id,
                productId: p.id,
                warehouseId: warehouse.id,
                quantity,
                type: 'ADJUST',
                reason: 'Opening demo balance',
                createdById: user.id,
              },
            });
            products.push(p);
          }
          const vendor = await tx.vendor.create({
            data: {
              organizationId: org.id,
              name: 'Fieldwork Supply Co.',
              email: 'orders@fieldwork.example',
            },
          });
          await tx.taxRate.createMany({
            data: [
              {
                organizationId: org.id,
                name: 'No tax',
                rateBps: 0,
                isDefault: true,
              },
              {
                organizationId: org.id,
                name: 'Standard sales tax',
                rateBps: 1000,
              },
            ],
          });
          return { user, org, warehouse, second, contacts, products, vendor };
        });
        const a = {
          userId: result.user.id,
          orgId: result.org.id,
          role: 'OWNER',
        };
        const flows = new WorkflowsService(db);
        for (let i = 0; i < 14; i++) {
          const p = result.products[i % result.products.length];
          const lines = [
            {
              productId: p.id,
              description: p.name,
              quantity: 2 + (i % 5),
              unitPrice: Number(p.unitPrice),
              taxBps: 1000,
            },
          ];
          const quote = await flows.create(a, 'quotes', {
            contactId: result.contacts[i % 8].id,
            lines,
            notes:
              'Thank you for considering Acme Studio. This quote is valid for 30 days.',
          });
          if (i >= 10) continue;
          const order = await flows.convert(a, quote.id);
          const invoice = await flows.invoice(a, order.id);
          await flows.send(a, invoice.id);
          const issued = new Date(Date.now() - i * 3 * 86400000);
          await db.invoice.update({
            where: { id: invoice.id },
            data: {
              issueDate: issued,
              createdAt: issued,
              dueDate: new Date(
                Date.now() + (i % 3 === 0 ? -10 : 15) * 86400000,
              ),
            },
          });
          if (i < 5)
            await flows.payment(a, {
              invoiceId: invoice.id,
              amount: Number(invoice.total),
              method: 'BANK',
              reference: `DEMO-TRANSFER-${i + 1}`,
            });
          if (i === 5)
            await flows.payment(a, {
              invoiceId: invoice.id,
              amount: Math.min(100, Number(invoice.total) / 2),
              method: 'CARD',
              reference: 'DEMO-PARTIAL',
            });
        }
        const po = await flows.create(a, 'purchase-orders', {
          vendorId: result.vendor.id,
          lines: [
            {
              productId: result.products[0].id,
              description: result.products[0].name,
              quantity: 20,
              unitPrice: Number(result.products[0].costPrice),
              taxBps: 0,
            },
          ],
        });
        const detail = await flows.detail(a, 'purchase-orders', po.id);
        await flows.receive(a, po.id, {
          warehouseId: result.warehouse.id,
          lines: [{ lineId: detail.lines[0].id, quantity: 8 }],
        });
        console.log(
          'Demo ready: owner@ledgerflow.demo - use DEMO_PASSWORD from your local .env',
        );
      },
      { timeout: 60000 },
    );
  }
} finally {
  await db.$disconnect();
}
