import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const port = process.env.TEST_PORT ?? '4101';
const base = `http://127.0.0.1:${port}`;
const prefix = `qa-${randomUUID()}`;
const userIds = [];
const orgIds = [];
let output = '';
let server;
before(async () => {
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`API failed to start: ${output}`);
});
after(async () => {
  server?.kill();
  await db.bill.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.invitation.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
async function call(
  path,
  { token, method = 'GET', body, cookie, status = 200 } = {},
) {
  const options = {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  };
  if (body) {
    assert.notEqual(method, 'GET');
    Object.assign(options, { body: JSON.stringify(body) });
  }
  const res = await fetch(base + path, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  assert.equal(res.status, status, `${method} ${path}: ${text}`);
  return { data, res };
}
async function register(suffix) {
  const { data, res } = await call('/auth/register', {
    method: 'POST',
    body: {
      email: `${prefix}-${suffix}@example.com`,
      password: 'TestWorkspace!2026',
      name: `QA ${suffix}`,
      organization: `QA ${suffix}`,
    },
    status: 201,
  });
  const me = (await call('/me', { token: data.accessToken })).data;
  userIds.push(me.id);
  orgIds.push(me.activeOrgId);
  return {
    token: data.accessToken,
    me,
    cookie: res.headers.get('set-cookie').split(';')[0],
  };
}

test('production API acceptance', async (t) => {
  const owner = await register('owner');
  const other = await register('other');
  let company, contact, product, warehouse, vendor, quote, order, invoice, po;
  await t.test(
    'registration creates owner membership and scoped warehouse',
    async () => {
      assert.equal(owner.me.role, 'OWNER');
      assert.equal(owner.me.memberships.length, 1);
      warehouse = (await call('/warehouses', { token: owner.token })).data
        .data[0];
      assert.equal(warehouse.code, 'MAIN');
    },
  );
  await t.test(
    'strict validation rejects tenant injection and invalid quantities',
    async () => {
      await call('/contacts', {
        token: owner.token,
        method: 'POST',
        body: { name: 'Injection', organizationId: other.me.activeOrgId },
        status: 400,
      });
      await call('/products?page=0', { token: owner.token, status: 400 });
      await call('/quotes', {
        token: owner.token,
        method: 'POST',
        body: { lines: [] },
        status: 400,
      });
    },
  );
  await t.test(
    'CRM and products persist with exact decimal prices',
    async () => {
      company = (
        await call('/companies', {
          token: owner.token,
          method: 'POST',
          body: { name: 'QA Company' },
          status: 201,
        })
      ).data;
      contact = (
        await call('/contacts', {
          token: owner.token,
          method: 'POST',
          body: {
            name: 'QA Contact',
            companyId: company.id,
            email: 'contact@example.com',
          },
          status: 201,
        })
      ).data;
      product = (
        await call('/products', {
          token: owner.token,
          method: 'POST',
          body: {
            name: 'QA Product',
            sku: 'QA-001',
            unitPrice: 19.99,
            costPrice: 8.5,
            reorderPoint: 5,
          },
          status: 201,
        })
      ).data;
      vendor = (
        await call('/vendors', {
          token: owner.token,
          method: 'POST',
          body: { name: 'QA Vendor' },
          status: 201,
        })
      ).data;
      assert.equal(product.unitPrice, '19.99');
    },
  );
  await t.test(
    'cross-organization reads, edits, references and deletes are denied',
    async () => {
      for (const resource of ['contacts', 'products'])
        await call(
          `/${resource}/${resource === 'contacts' ? contact.id : product.id}`,
          { token: other.token, status: 404 },
        );
      await call(`/contacts/${contact.id}`, {
        token: other.token,
        method: 'PATCH',
        body: { name: 'Hijacked' },
        status: 404,
      });
      await call(`/products/${product.id}`, {
        token: other.token,
        method: 'DELETE',
        status: 404,
      });
      await call('/contacts', {
        token: other.token,
        method: 'POST',
        body: { name: 'Bad link', companyId: company.id },
        status: 404,
      });
    },
  );
  await t.test(
    'quote converts once and preserves totals and lines',
    async () => {
      quote = (
        await call('/quotes', {
          token: owner.token,
          method: 'POST',
          body: {
            contactId: contact.id,
            lines: [
              {
                productId: product.id,
                description: 'QA Product',
                quantity: 3,
                unitPrice: 19.99,
                taxBps: 1000,
              },
            ],
          },
          status: 201,
        })
      ).data;
      assert.equal(quote.total, '65.97');
      order = (
        await call(`/quotes/${quote.id}/convert`, {
          token: owner.token,
          method: 'POST',
          status: 201,
        })
      ).data;
      const again = (
        await call(`/quotes/${quote.id}/convert`, {
          token: owner.token,
          method: 'POST',
          status: 201,
        })
      ).data;
      assert.equal(again.id, order.id);
      const detail = (
        await call(`/sales-orders/${order.id}`, { token: owner.token })
      ).data;
      assert.equal(detail.lines[0].quantity, 3);
      assert.equal(detail.total, quote.total);
      await call(`/quotes/${quote.id}/convert`, {
        token: other.token,
        method: 'POST',
        status: 404,
      });
    },
  );
  await t.test(
    'invoice issues, rejects overpayment, allocates partial and full payments',
    async () => {
      invoice = (
        await call(`/sales-orders/${order.id}/invoice`, {
          token: owner.token,
          method: 'POST',
          status: 201,
        })
      ).data;
      const repeat = (
        await call(`/sales-orders/${order.id}/invoice`, {
          token: owner.token,
          method: 'POST',
          status: 201,
        })
      ).data;
      assert.equal(repeat.id, invoice.id);
      await call('/payments', {
        token: owner.token,
        method: 'POST',
        body: { invoiceId: invoice.id, amount: 1, method: 'BANK' },
        status: 400,
      });
      await call(`/invoices/${invoice.id}/send`, {
        token: owner.token,
        method: 'POST',
        status: 201,
      });
      await call('/payments', {
        token: owner.token,
        method: 'POST',
        body: { invoiceId: invoice.id, amount: 100, method: 'BANK' },
        status: 400,
      });
      await call('/payments', {
        token: owner.token,
        method: 'POST',
        body: { invoiceId: invoice.id, amount: 20, method: 'BANK' },
        status: 201,
      });
      assert.equal(
        (await call(`/invoices/${invoice.id}`, { token: owner.token })).data
          .status,
        'PARTIAL',
      );
      await call('/payments', {
        token: owner.token,
        method: 'POST',
        body: { invoiceId: invoice.id, amount: 45.97, method: 'CARD' },
        status: 201,
      });
      const inv = (
        await call(`/invoices/${invoice.id}`, { token: owner.token })
      ).data;
      assert.equal(inv.status, 'PAID');
      assert.equal(inv.amountPaid, '65.97');
      assert.equal(inv.allocations.length, 2);
    },
  );
  await t.test(
    'partial receipts update stock and reject over-receiving or duplicate lines',
    async () => {
      po = (
        await call('/purchase-orders', {
          token: owner.token,
          method: 'POST',
          body: {
            vendorId: vendor.id,
            lines: [
              {
                productId: product.id,
                description: 'QA Product',
                quantity: 10,
                unitPrice: 8.5,
                taxBps: 0,
              },
            ],
          },
          status: 201,
        })
      ).data;
      const detail = (
        await call(`/purchase-orders/${po.id}`, { token: owner.token })
      ).data;
      const lineId = detail.lines[0].id;
      await call(`/purchase-orders/${po.id}/receive`, {
        token: owner.token,
        method: 'POST',
        body: { warehouseId: warehouse.id, lines: [{ lineId, quantity: 4 }] },
        status: 201,
      });
      assert.equal(
        (await call(`/purchase-orders/${po.id}`, { token: owner.token })).data
          .status,
        'PARTIAL',
      );
      await call(`/purchase-orders/${po.id}/receive`, {
        token: owner.token,
        method: 'POST',
        body: { warehouseId: warehouse.id, lines: [{ lineId, quantity: 7 }] },
        status: 400,
      });
      await call(`/purchase-orders/${po.id}/receive`, {
        token: owner.token,
        method: 'POST',
        body: {
          warehouseId: warehouse.id,
          lines: [
            { lineId, quantity: 1 },
            { lineId, quantity: 1 },
          ],
        },
        status: 400,
      });
      await call(`/purchase-orders/${po.id}/receive`, {
        token: owner.token,
        method: 'POST',
        body: { warehouseId: warehouse.id, lines: [{ lineId, quantity: 6 }] },
        status: 201,
      });
      assert.equal(
        (await call('/stock', { token: owner.token })).data.data[0].quantity,
        10,
      );
    },
  );
  await t.test('shipping is atomic and cannot deduct stock twice', async () => {
    await call(`/sales-orders/${order.id}/ship`, {
      token: owner.token,
      method: 'POST',
      body: { warehouseId: warehouse.id },
      status: 201,
    });
    await call(`/sales-orders/${order.id}/ship`, {
      token: owner.token,
      method: 'POST',
      body: { warehouseId: warehouse.id },
      status: 400,
    });
    assert.equal(
      (await call('/stock', { token: owner.token })).data.data[0].quantity,
      7,
    );
    await call('/stock/adjustments', {
      token: owner.token,
      method: 'POST',
      body: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: -8,
        reason: 'Insufficient stock test',
      },
      status: 400,
    });
    assert.equal(
      (await call('/stock', { token: owner.token })).data.data[0].quantity,
      7,
    );
    await call('/stock/adjustments', {
      token: owner.token,
      method: 'POST',
      body: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: -3,
        reason: 'Count adjustment',
      },
      status: 201,
    });
    assert.equal(
      (await call('/stock?low=true', { token: owner.token })).data.meta.total,
      1,
    );
  });
  await t.test(
    'dashboard, stock valuation and audit match persisted math',
    async () => {
      const d = (await call('/reports/dashboard', { token: owner.token })).data;
      assert.equal(d.revenue, 65.97);
      assert.equal(d.openAR, 0);
      assert.equal(d.stockAlerts, 1);
      const s = (await call('/stock', { token: owner.token })).data;
      assert.equal(s.valuation, 34);
      const logs = (await call('/audit-logs', { token: owner.token })).data;
      assert.ok(logs.meta.total >= 10);
      assert.ok(
        (await call('/reports/accounts', { token: owner.token })).data.length >=
          5,
      );
    },
  );
  await t.test('bills are linked once and payment cannot repeat', async () => {
    const bill = (
      await call(`/purchase-orders/${po.id}/bill`, {
        token: owner.token,
        method: 'POST',
        status: 201,
      })
    ).data;
    assert.equal(bill.total, '85');
    assert.equal(
      (
        await call(`/purchase-orders/${po.id}/bill`, {
          token: owner.token,
          method: 'POST',
          status: 201,
        })
      ).data.id,
      bill.id,
    );
    await call(`/bills/${bill.id}/pay`, {
      token: owner.token,
      method: 'POST',
      status: 201,
    });
    await call(`/bills/${bill.id}/pay`, {
      token: owner.token,
      method: 'POST',
      status: 400,
    });
  });
  await t.test('invitations are one-use and VIEWER cannot mutate', async () => {
    const invite = (
      await call('/orgs/current/members', {
        token: owner.token,
        method: 'POST',
        body: { email: `${prefix}-viewer@example.com`, role: 'VIEWER' },
        status: 201,
      })
    ).data;
    const token = invite.url.split('/').at(-1);
    const body = { token, name: 'QA Viewer', password: 'TestWorkspace!2026' };
    const accepted = (
      await call('/auth/accept-invite', { method: 'POST', body, status: 201 })
    ).data;
    const me = (await call('/me', { token: accepted.accessToken })).data;
    userIds.push(me.id);
    assert.equal(me.role, 'VIEWER');
    await call('/auth/accept-invite', { method: 'POST', body, status: 401 });
    await call('/products', { token: accepted.accessToken });
    await call('/products', {
      token: accepted.accessToken,
      method: 'POST',
      body: { name: 'Blocked', sku: 'BLOCK', unitPrice: 1 },
      status: 403,
    });
    await call('/payments', {
      token: accepted.accessToken,
      method: 'POST',
      body: { invoiceId: invoice.id, amount: 1, method: 'BANK' },
      status: 403,
    });
    await call('/orgs/current/members', {
      token: accepted.accessToken,
      status: 403,
    });
  });
  await t.test(
    'draft edits recalculate totals and processed documents cannot be edited',
    async () => {
      const body = {
        lines: [
          {
            description: 'Custom service',
            quantity: 1,
            unitPrice: 10,
            taxBps: 0,
          },
        ],
      };
      const draft = (
        await call('/quotes', {
          token: owner.token,
          method: 'POST',
          body,
          status: 201,
        })
      ).data;
      body.lines[0].unitPrice = 25;
      const updated = (
        await call(`/quotes/${draft.id}`, {
          token: owner.token,
          method: 'PATCH',
          body,
        })
      ).data;
      assert.equal(updated.total, '25');
      await call(`/quotes/${draft.id}/convert`, {
        token: owner.token,
        method: 'POST',
        status: 201,
      });
      await call(`/quotes/${draft.id}`, {
        token: owner.token,
        method: 'PATCH',
        body,
        status: 400,
      });
      await call('/contacts', {
        token: owner.token,
        method: 'POST',
        body: { name: null },
        status: 400,
      });
    },
  );
  await t.test(
    'notes, number prefixes and templates persist with tenant protection',
    async () => {
      await call(`/contacts/${contact.id}/notes`, {
        token: owner.token,
        method: 'POST',
        body: { text: 'Discussed next delivery.' },
        status: 201,
      });
      const history = (
        await call(`/contacts/${contact.id}/activity`, { token: owner.token })
      ).data;
      assert.equal(history[0].metaJson.note, 'Discussed next delivery.');
      await call(`/contacts/${contact.id}/notes`, {
        token: other.token,
        method: 'POST',
        body: { text: 'Blocked cross-tenant note' },
        status: 404,
      });
      await call('/orgs/current/sequences/quotes', {
        token: owner.token,
        method: 'PATCH',
        body: { prefix: 'EST' },
      });
      const doc = (
        await call('/quotes', {
          token: owner.token,
          method: 'POST',
          body: {
            lines: [
              {
                description: 'Renumbered draft',
                quantity: 1,
                unitPrice: 2,
                taxBps: 0,
              },
            ],
          },
          status: 201,
        })
      ).data;
      assert.ok(doc.number.startsWith('EST-'));
      await call('/orgs/current/templates', {
        token: owner.token,
        method: 'PATCH',
        body: {
          subject: 'Invoice {{number}}',
          body: 'Thank you for your business.',
        },
      });
      assert.equal(
        (await call('/orgs/current/templates', { token: owner.token })).data
          .subject,
        'Invoice {{number}}',
      );
      await call('/orgs/current', {
        token: owner.token,
        method: 'PATCH',
        body: { name: 'QA Updated', currency: 'EUR', timezone: 'UTC' },
        status: 400,
      });
    },
  );
  await t.test(
    'role changes take effect immediately and sales cannot read other users documents',
    async () => {
      const viewer = await db.membership.findFirst({
        where: { organizationId: owner.me.activeOrgId, role: 'VIEWER' },
        include: { user: true },
      });
      const login = (
        await call('/auth/login', {
          method: 'POST',
          body: { email: viewer.user.email, password: 'TestWorkspace!2026' },
        })
      ).data;
      await call(`/orgs/current/members/${viewer.id}`, {
        token: owner.token,
        method: 'PATCH',
        body: { role: 'SALES' },
      });
      assert.equal(
        (await call('/me', { token: login.accessToken })).data.role,
        'SALES',
      );
      await call(`/quotes/${quote.id}`, {
        token: login.accessToken,
        status: 404,
      });
      await call(`/quotes/${quote.id}/void`, {
        token: login.accessToken,
        method: 'POST',
        status: 404,
      });
      await call('/payments', { token: login.accessToken, status: 403 });
      await call(`/orgs/current/members/${viewer.id}`, {
        token: owner.token,
        method: 'PATCH',
        body: { role: 'INVENTORY' },
      });
      await call('/invoices', { token: login.accessToken, status: 403 });
      const dashboard = (
        await call('/reports/dashboard', { token: login.accessToken })
      ).data;
      assert.equal(dashboard.revenue, 0);
      assert.deepEqual(dashboard.recentInvoices, []);
      await call(`/orgs/current/members/${viewer.id}`, {
        token: owner.token,
        method: 'DELETE',
      });
      await call('/me', { token: login.accessToken, status: 401 });
    },
  );
  await t.test(
    'concurrent payments cannot over-allocate an invoice',
    async () => {
      const inv = (
        await call('/invoices', {
          token: owner.token,
          method: 'POST',
          body: {
            lines: [
              {
                description: 'Concurrency test',
                quantity: 1,
                unitPrice: 100,
                taxBps: 0,
              },
            ],
          },
          status: 201,
        })
      ).data;
      await call(`/invoices/${inv.id}/send`, {
        token: owner.token,
        method: 'POST',
        status: 201,
      });
      const outcomes = await Promise.all(
        [1, 2].map(() =>
          fetch(base + '/payments', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${owner.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoiceId: inv.id,
              amount: 80,
              method: 'BANK',
            }),
          }),
        ),
      );
      assert.equal(outcomes.filter((r) => r.status === 201).length, 1);
      assert.ok(outcomes.every((r) => [201, 400, 409].includes(r.status)));
      const final = (await call(`/invoices/${inv.id}`, { token: owner.token }))
        .data;
      assert.equal(final.amountPaid, '80');
      assert.equal(final.allocations.length, 1);
    },
  );
  await t.test(
    'active organization survives refresh after switching workspaces',
    async () => {
      const invite = (
        await call('/orgs/current/members', {
          token: other.token,
          method: 'POST',
          body: { email: owner.me.email, role: 'ADMIN' },
          status: 201,
        })
      ).data;
      const accepted = await call('/auth/accept-invite', {
        method: 'POST',
        body: {
          token: invite.url.split('/').at(-1),
          name: owner.me.name,
          password: 'TestWorkspace!2026',
        },
        status: 201,
      });
      const refreshed = await call('/auth/refresh', {
        method: 'POST',
        cookie: accepted.res.headers.get('set-cookie').split(';')[0],
      });
      assert.equal(
        (await call('/me', { token: refreshed.data.accessToken })).data
          .activeOrgId,
        other.me.activeOrgId,
      );
      const switched = await call(`/auth/switch/${owner.me.activeOrgId}`, {
        method: 'POST',
        token: refreshed.data.accessToken,
        status: 201,
      });
      const ownRefresh = await call('/auth/refresh', {
        method: 'POST',
        cookie: switched.res.headers.get('set-cookie').split(';')[0],
      });
      assert.equal(
        (await call('/me', { token: ownRefresh.data.accessToken })).data
          .activeOrgId,
        owner.me.activeOrgId,
      );
    },
  );
  await t.test(
    'refresh rotates and revoked cookies cannot be reused',
    async () => {
      const refreshed = await call('/auth/refresh', {
        method: 'POST',
        cookie: owner.cookie,
      });
      assert.ok(refreshed.data.accessToken);
      await call('/auth/refresh', {
        method: 'POST',
        cookie: owner.cookie,
        status: 401,
      });
      const cookie = refreshed.res.headers.get('set-cookie').split(';')[0];
      await call('/auth/logout', { method: 'POST', cookie });
      await call('/auth/refresh', { method: 'POST', cookie, status: 401 });
    },
  );
});
