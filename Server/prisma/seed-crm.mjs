import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { CrmService } from '../dist/crm/crm.service.js';
if (process.env.NODE_ENV === 'production')
  throw new Error('CRM demo seeding is disabled in production');
const db = new PrismaClient();
try {
  const org = await db.organization.findUnique({
    where: { slug: 'ledgerflow-demo' },
    include: {
      members: true,
      contacts: { orderBy: { createdAt: 'asc' }, take: 8 },
    },
  });
  if (!org) throw new Error('Run npm run seed first');
  if (
    await db.auditLog.findFirst({
      where: { organizationId: org.id, action: 'CRM demo seeded' },
    })
  ) {
    console.log('CRM demo already exists; customer records preserved.');
  } else
    await db.$transaction(
      async (tx) => {
        const transactionalDb = new Proxy(tx, {
          get(target, key) {
            return key === '$transaction'
              ? async (callback) => callback(tx)
              : target[key];
          },
        });
        const crm = new CrmService(transactionalDb);
        const actor = {
          orgId: org.id,
          userId: org.members.find((m) => m.role === 'OWNER').userId,
          role: 'OWNER',
        };
        const existing = await tx.crmPipeline.findFirst({
          where: { organizationId: org.id },
          include: { stages: { orderBy: { position: 'asc' } } },
        });
        const pipeline =
          existing ?? (await crm.pipeline(actor, { name: 'Sales pipeline' }));
        await crm.save(actor, 'fields', {
          name: 'Team size',
          key: 'team_size',
          entity: 'leads',
          type: 'NUMBER',
          required: false,
        });
        await crm.save(actor, 'fields', {
          name: 'Purchase timeline',
          key: 'purchase_timeline',
          entity: 'deals',
          type: 'SELECT',
          options: ['This month', 'This quarter', 'Next quarter'],
          required: false,
        });
        await crm.save(actor, 'automations', {
          name: 'Welcome every new lead',
          trigger: 'LEAD_CREATED',
          taskTitle: 'Reach out to {{name}}',
          dueDays: 1,
          ownerId: actor.userId,
          enabled: true,
        });
        await crm.save(actor, 'automations', {
          name: 'Support first response',
          trigger: 'TICKET_CREATED',
          taskTitle: 'Review {{name}}',
          dueDays: 0,
          ownerId: actor.userId,
          enabled: true,
        });
        const leads = [];
        for (const [i, name] of [
          'Jordan Lee',
          'Priya Shah',
          'Marcus Chen',
          'Sofia Rivera',
          'Noah Williams',
          'Amara Okafor',
          'Ethan Brooks',
          'Mia Anderson',
          'Lucas Miller',
          'Isabella Rossi',
          'Oliver Grant',
          'Aisha Rahman',
        ].entries()) {
          const lead = await crm.save(actor, 'leads', {
            name,
            email: name.toLowerCase().replace(' ', '.') + '@example.com',
            company: [
              'Aster Labs',
              'Northstar Works',
              'Forma Collective',
              'Meridian Group',
            ][i % 4],
            source: ['REFERRAL', 'WEBSITE', 'EVENT', 'SOCIAL'][i % 4],
            status: ['NEW', 'CONTACTED', 'QUALIFIED'][i % 3],
            score: 45 + i * 4,
            value: 1800 + i * 1250,
            ownerId: actor.userId,
            tags: i % 2 === 0 ? ['high-intent', 'workspace'] : ['workspace'],
            notes:
              'Demo prospect interested in a thoughtful workspace refresh.',
            customFields: { team_size: 10 + i * 5 },
          });
          leads.push(lead);
        }
        const converted = await crm.convert(actor, leads[2].id, {
          createDeal: true,
          stageId: pipeline.stages.find((s) => s.outcome === 'OPEN').id,
        });
        const names = [
          'Northstar office refresh',
          'Studio Forma expansion',
          'Meridian executive suite',
          'Aster Labs new workspace',
          'Design collective rollout',
          'Riverfront showroom',
          'Cedar coworking launch',
          'Summit team essentials',
          'Harbor studio upgrade',
        ];
        const deals = [];
        for (const [i, name] of names.entries()) {
          const stage = pipeline.stages[i % pipeline.stages.length];
          const d = await crm.save(actor, 'deals', {
            name,
            contactId: org.contacts[i % org.contacts.length].id,
            stageId: stage.id,
            value: [12500, 8400, 22750, 6800, 18900, 4200, 9750, 5600, 14300][
              i
            ],
            ownerId: actor.userId,
            expectedClose: new Date(
              Date.now() + (i + 3) * 86400000,
            ).toISOString(),
            notes:
              'Demo opportunity. Product mix and final terms to be confirmed.',
            ...(stage.outcome === 'LOST'
              ? { lostReason: 'Project deferred to the next budget cycle' }
              : {}),
            customFields: {
              purchase_timeline: i % 2 ? 'This quarter' : 'This month',
            },
          });
          deals.push(d);
        }
        for (let i = 0; i < 6; i++)
          await crm.save(actor, 'tasks', {
            name: [
              'Send revised proposal to Northstar',
              'Confirm Studio Forma sample delivery',
              'Follow up on Meridian budget',
              'Prepare Aster discovery agenda',
              'Review workspace product shortlist',
              'Share onboarding checklist',
            ][i],
            contactId: org.contacts[i % org.contacts.length].id,
            dealId: deals[i].id,
            type: ['EMAIL', 'CALL', 'FOLLOW_UP'][i % 3],
            priority: i < 2 ? 'HIGH' : 'MEDIUM',
            ownerId: actor.userId,
            dueAt: new Date(Date.now() + (i - 2) * 86400000).toISOString(),
            status: i === 5 ? 'COMPLETED' : 'OPEN',
          });
        for (let i = 0; i < 7; i++)
          await crm.save(actor, 'activities', {
            name: [
              'Northstar discovery call',
              'Studio Forma design review',
              'Meridian proposal walkthrough',
              'Aster Labs introductions',
              'Sample feedback conversation',
              'Showroom visit',
              'Quarterly account check-in',
            ][i],
            contactId: org.contacts[i % org.contacts.length].id,
            dealId: deals[i].id,
            type: i % 2 ? 'MEETING' : 'CALL',
            ownerId: actor.userId,
            startsAt: new Date(Date.now() + (i - 2) * 86400000).toISOString(),
            endsAt: new Date(
              Date.now() + (i - 2) * 86400000 + 3600000,
            ).toISOString(),
            status: i < 2 ? 'COMPLETED' : 'SCHEDULED',
            notes: 'Demo activity with next steps captured for the team.',
          });
        const segment = await crm.save(actor, 'segments', {
          name: 'Active customers',
          lifecycle: 'CUSTOMER',
        });
        const prospectSegment = await crm.save(actor, 'segments', {
          name: 'Referral prospects',
          lifecycle: 'PROSPECT',
          source: 'REFERRAL',
        });
        await crm.save(actor, 'campaigns', {
          name: 'Workspace refresh — Q4',
          channel: 'EMAIL',
          status: 'ACTIVE',
          segmentId: segment.id,
          budget: 2500,
          spent: 860,
          startsAt: new Date(Date.now() - 7 * 86400000).toISOString(),
          endsAt: new Date(Date.now() + 21 * 86400000).toISOString(),
          subject: 'Make room for a better working day',
          body: 'A draft invitation to explore our latest workspace essentials.',
          notes: 'Demo campaign plan. No emails have been delivered.',
        });
        await crm.save(actor, 'campaigns', {
          name: 'Partner introductions',
          channel: 'EVENT',
          status: 'PLANNED',
          segmentId: prospectSegment.id,
          budget: 1200,
          spent: 0,
          notes: 'Plan an intimate product walkthrough for referral partners.',
        });
        for (let i = 0; i < 4; i++) {
          const ticket = await crm.save(actor, 'tickets', {
            name: [
              'Update delivery address',
              'Desk lamp replacement request',
              'Invoice copy for purchasing',
              'Product care question',
            ][i],
            contactId: org.contacts[i].id,
            ownerId: actor.userId,
            priority: i === 1 ? 'HIGH' : 'MEDIUM',
            status: ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'][i],
            category: ['DELIVERY', 'PRODUCT', 'BILLING', 'GENERAL'][i],
            channel: 'EMAIL',
            notes: 'Demo customer request recorded for the support team.',
            ...(i === 3
              ? {
                  resolution:
                    'Care instructions shared and customer confirmed receipt.',
                }
              : {}),
          });
          await tx.ticketReply.create({
            data: {
              ticketId: ticket.id,
              userId: actor.userId,
              body: 'Context captured. The account owner will coordinate the next step.',
              isInternal: true,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            organizationId: org.id,
            userId: actor.userId,
            action: 'CRM demo seeded',
            entityType: 'crm',
            metaJson: { convertedDealId: converted.dealId },
          },
        });
        console.log(
          'CRM demo seeded: leads, deals, activities, campaigns, support and automation.',
        );
      },
      { timeout: 60000, isolationLevel: 'Serializable' },
    );
} finally {
  await db.$disconnect();
}
