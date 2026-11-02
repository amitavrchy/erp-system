import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const base = 'http://127.0.0.1:4102';
const orgIds = [],
  userIds = [];
const prefix = `crm-${randomUUID()}`;
let server;
let output = '';
before(async () => {
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '4102' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + '/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(output);
});
after(async () => {
  server?.kill();
  await db.deal.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.bill.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
async function call(path, { token, method = 'GET', body, status = 200 } = {}) {
  const options = {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (body) Object.assign(options, { body: JSON.stringify(body) });
  const res = await fetch(base + path, options);
  const data = await res.json();
  assert.equal(
    res.status,
    status,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function register(suffix) {
  const r = await call('/auth/register', {
    method: 'POST',
    body: {
      name: `CRM QA ${suffix}`,
      email: `${prefix}-${suffix}@example.com`,
      password: 'CrmAcceptance!2026',
      organization: `CRM QA ${suffix}`,
    },
    status: 201,
  });
  const me = await call('/me', { token: r.accessToken });
  orgIds.push(me.activeOrgId);
  userIds.push(me.id);
  return { token: r.accessToken, me };
}
test('connected CRM acceptance', async (t) => {
  const owner = await register('owner');
  const other = await register('other');
  const token = owner.token;
  let pipeline,
    foreignPipeline,
    lead,
    deal,
    contact,
    ticket,
    rule,
    field,
    segment;
  await t.test(
    'pipelines have configurable stages and tenant-scoped references',
    async () => {
      pipeline = await call('/crm/pipelines', {
        token,
        method: 'POST',
        body: { name: 'Enterprise sales' },
        status: 201,
      });
      foreignPipeline = await call('/crm/pipelines', {
        token: other.token,
        method: 'POST',
        body: { name: 'Other sales' },
        status: 201,
      });
      assert.equal(pipeline.stages.length, 6);
      const stages = pipeline.stages.map((s) => ({
        id: s.id,
        name: s.name,
        probability: s.probability,
        outcome: s.outcome,
      }));
      stages[0].name = 'First conversation';
      pipeline = await call(`/crm/pipelines/${pipeline.id}`, {
        token,
        method: 'PATCH',
        body: { name: 'Enterprise sales', stages },
      });
      assert.equal(pipeline.stages[0].name, 'First conversation');
      await call('/crm/deals', {
        token,
        method: 'POST',
        body: {
          name: 'Foreign stage',
          stageId: foreignPipeline.stages[0].id,
          value: 100,
        },
        status: 404,
      });
    },
  );
  await t.test(
    'required custom fields validate types and cannot be reassigned',
    async () => {
      field = await call('/crm/fields', {
        token,
        method: 'POST',
        body: {
          name: 'Team size',
          key: 'team_size',
          entity: 'leads',
          type: 'NUMBER',
          required: true,
        },
        status: 201,
      });
      assert.deepEqual(field.options, []);
      await call('/crm/leads', {
        token,
        method: 'POST',
        body: { name: 'Missing required field' },
        status: 400,
      });
      await call('/crm/leads', {
        token,
        method: 'POST',
        body: {
          name: 'Invalid custom field',
          customFields: { team_size: 'twenty' },
        },
        status: 400,
      });
      await call(`/crm/fields/${field.id}`, {
        token,
        method: 'PATCH',
        body: { entity: 'deals' },
        status: 400,
      });
    },
  );
  await t.test(
    'automation creates audited follow-ups atomically on lead creation',
    async () => {
      rule = await call('/crm/automations', {
        token,
        method: 'POST',
        body: {
          name: 'Welcome follow-up',
          trigger: 'LEAD_CREATED',
          taskTitle: 'Call {{name}}',
          dueDays: 1,
          ownerId: owner.me.id,
          enabled: true,
        },
        status: 201,
      });
      lead = await call('/crm/leads', {
        token,
        method: 'POST',
        body: {
          name: 'Taylor Prospect',
          email: 'taylor@example.com',
          company: 'Aster Labs',
          source: 'REFERRAL',
          status: 'QUALIFIED',
          score: 85,
          value: 2500,
          customFields: { team_size: 25 },
        },
        status: 201,
      });
      const detail = await call(`/crm/leads/${lead.id}`, { token });
      assert.equal(detail.tasks.length, 1);
      assert.equal(detail.tasks[0].name, 'Call Taylor Prospect');
      const updated = await call(`/crm/automations/${rule.id}`, { token });
      assert.equal(updated.runCount, 1);
      assert.ok(updated.lastRunAt);
    },
  );
  await t.test(
    'cross-tenant record reads, writes, owners and linked entities are blocked',
    async () => {
      await call(`/crm/leads/${lead.id}`, { token: other.token, status: 404 });
      await call(`/crm/leads/${lead.id}`, {
        token: other.token,
        method: 'PATCH',
        body: { name: 'Hijacked' },
        status: 404,
      });
      await call('/crm/tasks', {
        token: other.token,
        method: 'POST',
        body: { name: 'Bad lead reference', leadId: lead.id },
        status: 404,
      });
      await call('/crm/tasks', {
        token,
        method: 'POST',
        body: { name: 'Foreign assignee', ownerId: other.me.id },
        status: 404,
      });
      await call('/crm/tasks', {
        token,
        method: 'POST',
        body: { name: 'Injected tenant', organizationId: other.me.activeOrgId },
        status: 400,
      });
    },
  );
  await t.test(
    'lead conversion links contact and deal and is repeat-safe',
    async () => {
      const converted = await call(`/crm/leads/${lead.id}/convert`, {
        token,
        method: 'POST',
        body: { createDeal: true, stageId: pipeline.stages[0].id },
        status: 201,
      });
      contact = await call(`/contacts/${converted.contactId}`, { token });
      deal = await call(`/crm/deals/${converted.dealId}`, { token });
      assert.equal(contact.lifecycle, 'PROSPECT');
      assert.equal(deal.value, '2500');
      const again = await call(`/crm/leads/${lead.id}/convert`, {
        token,
        method: 'POST',
        body: { createDeal: true, stageId: pipeline.stages[0].id },
        status: 201,
      });
      assert.deepEqual(again, converted);
      const context = await call(`/crm/contacts/${contact.id}/context`, {
        token,
      });
      assert.equal(context.deals.length, 1);
      assert.equal(context.tasks.length, 1);
      await call(`/crm/leads/${lead.id}`, {
        token,
        method: 'PATCH',
        body: { status: 'NEW' },
        status: 400,
      });
    },
  );
  await t.test(
    'deal movement enforces loss reasons and historical pipeline constraints',
    async () => {
      const lost = pipeline.stages.find((s) => s.outcome === 'LOST');
      await call(`/crm/deals/${deal.id}/move`, {
        token,
        method: 'POST',
        body: { stageId: lost.id },
        status: 400,
      });
      await call(`/crm/deals/${deal.id}/move`, {
        token,
        method: 'POST',
        body: { stageId: lost.id, lostReason: 'Budget deferred' },
        status: 201,
      });
      assert.ok((await call(`/crm/deals/${deal.id}`, { token })).closedAt);
      await call(`/crm/deals/${deal.id}/move`, {
        token,
        method: 'POST',
        body: { stageId: pipeline.stages[1].id },
        status: 201,
      });
      const stages = pipeline.stages
        .filter((s) => s.id !== pipeline.stages[1].id)
        .map((s) => ({
          id: s.id,
          name: s.name,
          probability: s.probability,
          outcome: s.outcome,
        }));
      await call(`/crm/pipelines/${pipeline.id}`, {
        token,
        method: 'PATCH',
        body: { name: pipeline.name, stages },
        status: 400,
      });
    },
  );
  await t.test('deals create linked ERP quotes exactly once', async () => {
    const quote = await call(`/crm/deals/${deal.id}/quote`, {
      token,
      method: 'POST',
      status: 201,
    });
    const again = await call(`/crm/deals/${deal.id}/quote`, {
      token,
      method: 'POST',
      status: 201,
    });
    assert.equal(quote.id, again.id);
    assert.equal(quote.total, '2500');
    assert.equal(quote.contactId, contact.id);
  });
  await t.test(
    'tasks complete and reopen; calendar respects time ranges',
    async () => {
      const task = await call('/crm/tasks', {
        token,
        method: 'POST',
        body: {
          name: 'Past-due call',
          contactId: contact.id,
          dealId: deal.id,
          priority: 'HIGH',
          dueAt: '2020-01-01T09:00:00Z',
        },
        status: 201,
      });
      assert.ok(
        (await call('/crm/tasks?overdue=true', { token })).data.some(
          (t) => t.id === task.id,
        ),
      );
      const completed = await call(`/crm/tasks/${task.id}`, {
        token,
        method: 'PATCH',
        body: { status: 'COMPLETED' },
      });
      assert.ok(completed.completedAt);
      assert.ok(
        !(await call('/crm/tasks?overdue=true', { token })).data.some(
          (t) => t.id === task.id,
        ),
      );
      const reopen = await call(`/crm/tasks/${task.id}`, {
        token,
        method: 'PATCH',
        body: { status: 'OPEN' },
      });
      assert.equal(reopen.completedAt, null);
      await call('/crm/activities', {
        token,
        method: 'POST',
        body: {
          name: 'Discovery meeting',
          type: 'MEETING',
          contactId: contact.id,
          startsAt: '2026-11-03T10:00:00Z',
          endsAt: '2026-11-03T11:00:00Z',
        },
        status: 201,
      });
      await call('/crm/activities', {
        token,
        method: 'POST',
        body: {
          name: 'Invalid meeting',
          startsAt: '2026-11-03T11:00:00Z',
          endsAt: '2026-11-03T10:00:00Z',
        },
        status: 400,
      });
      const range = await call(
        '/crm/activities?from=2026-11-01T00:00:00Z&to=2026-11-30T23:59:59Z',
        { token },
      );
      assert.equal(range.meta.total, 1);
      assert.equal(
        (await call('/crm/activities?from=2027-01-01T00:00:00Z', { token }))
          .meta.total,
        0,
      );
    },
  );
  await t.test(
    'support tickets set deadlines, store notes and require resolutions',
    async () => {
      ticket = await call('/crm/tickets', {
        token,
        method: 'POST',
        body: {
          name: 'Shipment question',
          contactId: contact.id,
          priority: 'URGENT',
          notes: 'Customer needs a delivery update',
        },
        status: 201,
      });
      assert.ok(ticket.dueAt);
      await call(`/crm/tickets/${ticket.id}/replies`, {
        token,
        method: 'POST',
        body: {
          body: 'Warehouse confirmed the delivery window.',
          isInternal: true,
        },
        status: 201,
      });
      await call(`/crm/tickets/${ticket.id}/replies`, {
        token: other.token,
        method: 'POST',
        body: { body: 'Blocked cross-tenant reply', isInternal: false },
        status: 404,
      });
      await call(`/crm/tickets/${ticket.id}`, {
        token,
        method: 'PATCH',
        body: { status: 'RESOLVED' },
        status: 400,
      });
      const resolved = await call(`/crm/tickets/${ticket.id}`, {
        token,
        method: 'PATCH',
        body: {
          status: 'RESOLVED',
          resolution: 'Delivery details confirmed with customer.',
        },
      });
      assert.ok(resolved.resolvedAt);
      assert.equal(
        (await call(`/crm/tickets/${ticket.id}`, { token })).replies.length,
        1,
      );
    },
  );
  await t.test(
    'dynamic segments, campaigns and imports preserve tenant boundaries',
    async () => {
      await call(`/contacts/${contact.id}`, {
        token,
        method: 'PATCH',
        body: { tags: ['priority'] },
      });
      segment = await call('/crm/segments', {
        token,
        method: 'POST',
        body: {
          name: 'Priority prospects',
          lifecycle: 'PROSPECT',
          tag: 'priority',
        },
        status: 201,
      });
      assert.equal(
        (await call(`/crm/segments/${segment.id}/audience`, { token })).meta
          .total,
        1,
      );
      await call(`/crm/segments/${segment.id}/audience`, {
        token: other.token,
        status: 404,
      });
      await call('/crm/campaigns', {
        token,
        method: 'POST',
        body: {
          name: 'Prospect launch',
          segmentId: segment.id,
          channel: 'EMAIL',
          status: 'PLANNED',
          budget: 500,
          spent: 125,
          subject: 'A better workspace',
          body: 'Draft outreach message',
        },
        status: 201,
      });
      await call('/crm/campaigns', {
        token: other.token,
        method: 'POST',
        body: { name: 'Foreign audience', segmentId: segment.id },
        status: 404,
      });
      const result = await call('/crm/contacts/import', {
        token,
        method: 'POST',
        body: {
          rows: [
            { name: 'Taylor Again', email: 'taylor@example.com' },
            { name: 'New Import', email: 'new-import@example.com' },
          ],
        },
        status: 201,
      });
      assert.deepEqual(result, { created: 1, skipped: 1 });
      await call('/crm/contacts/import', {
        token,
        method: 'POST',
        body: {
          rows: [
            { name: 'Valid first', email: 'atomic@example.com' },
            { name: 'X' },
          ],
        },
        status: 400,
      });
      assert.equal(
        (await call('/contacts?q=atomic@example.com', { token })).meta.total,
        0,
      );
    },
  );
  await t.test(
    'CRM analytics and audits match actual opportunity math',
    async () => {
      const summary = await call('/crm/summary', { token });
      assert.equal(summary.leads, 1);
      assert.equal(summary.convertedLeads, 1);
      assert.equal(summary.pipelineValue, 2500);
      assert.equal(summary.weightedValue, 750);
      assert.equal(summary.openDeals, 1);
      assert.equal(
        summary.tickets.find((s) => s.status === 'RESOLVED')._count,
        1,
      );
      const audit = await db.auditLog.count({
        where: {
          organizationId: owner.me.activeOrgId,
          entityType: { startsWith: 'crm/' },
        },
      });
      assert.ok(audit > 15);
    },
  );
  await t.test(
    'conversion replays retain the exact target even with earlier linked opportunities',
    async () => {
      const l = await call('/crm/leads', {
        token,
        method: 'POST',
        body: {
          name: 'Existing opportunity lead',
          customFields: { team_size: 10 },
          value: 300,
        },
        status: 201,
      });
      const prior = await call('/crm/deals', {
        token,
        method: 'POST',
        body: {
          name: 'An earlier opportunity',
          leadId: l.id,
          stageId: pipeline.stages[0].id,
          value: 100,
        },
        status: 201,
      });
      const body = { createDeal: true, stageId: pipeline.stages[0].id };
      const first = await call(`/crm/leads/${l.id}/convert`, {
        token,
        method: 'POST',
        body,
        status: 201,
      });
      const again = await call(`/crm/leads/${l.id}/convert`, {
        token,
        method: 'POST',
        body,
        status: 201,
      });
      assert.notEqual(first.dealId, prior.id);
      assert.deepEqual(again, first);
    },
  );
  await t.test(
    'required custom fields also apply to imported contacts and converted opportunities',
    async () => {
      await call('/crm/fields', {
        token,
        method: 'POST',
        body: {
          name: 'Region',
          key: 'region',
          entity: 'contacts',
          type: 'SELECT',
          options: ['APAC', 'EMEA'],
          required: true,
        },
        status: 201,
      });
      await call('/crm/fields', {
        token,
        method: 'POST',
        body: {
          name: 'Licenses',
          key: 'licenses',
          entity: 'deals',
          type: 'NUMBER',
          required: true,
        },
        status: 201,
      });
      await call('/crm/contacts/import', {
        token,
        method: 'POST',
        body: {
          rows: [
            { name: 'Missing region', email: 'missing-region@example.com' },
          ],
        },
        status: 400,
      });
      const imported = await call('/crm/contacts/import', {
        token,
        method: 'POST',
        body: {
          rows: [
            {
              name: 'Regional account',
              email: 'apac@example.com',
              customFields: { region: 'APAC' },
            },
          ],
        },
        status: 201,
      });
      assert.equal(imported.created, 1);
      const l = await call('/crm/leads', {
        token,
        method: 'POST',
        body: {
          name: 'Custom conversion lead',
          customFields: { team_size: 20 },
        },
        status: 201,
      });
      const body = {
        createDeal: true,
        stageId: pipeline.stages[0].id,
        customFields: { region: 'APAC' },
      };
      await call(`/crm/leads/${l.id}/convert`, {
        token,
        method: 'POST',
        body,
        status: 400,
      });
      const converted = await call(`/crm/leads/${l.id}/convert`, {
        token,
        method: 'POST',
        body: { ...body, dealCustomFields: { licenses: 20 } },
        status: 201,
      });
      assert.equal(
        (await call(`/contacts/${converted.contactId}`, { token })).customFields
          .region,
        'APAC',
      );
      assert.equal(
        (await call(`/crm/deals/${converted.dealId}`, { token })).customFields
          .licenses,
        20,
      );
    },
  );
  await t.test(
    'viewers can inspect CRM but cannot mutate or configure it',
    async () => {
      const invite = await call('/orgs/current/members', {
        token,
        method: 'POST',
        body: { email: `${prefix}-viewer@example.com`, role: 'VIEWER' },
        status: 201,
      });
      const joined = await call('/auth/accept-invite', {
        method: 'POST',
        body: {
          token: invite.url.split('/').at(-1),
          name: 'CRM Viewer',
          password: 'CrmAcceptance!2026',
        },
        status: 201,
      });
      const me = await call('/me', { token: joined.accessToken });
      userIds.push(me.id);
      await call('/crm/leads', { token: joined.accessToken });
      await call('/crm/summary', { token: joined.accessToken });
      await call('/crm/tasks', {
        token: joined.accessToken,
        method: 'POST',
        body: { name: 'Blocked task' },
        status: 403,
      });
      await call('/crm/pipelines', {
        token: joined.accessToken,
        method: 'POST',
        body: { name: 'Blocked pipeline' },
        status: 403,
      });
    },
  );
});
