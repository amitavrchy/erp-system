import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { trackEmail, cleanupBrowserFixtures } from './fixtures';

test.afterEach(async () => {
  await cleanupBrowserFixtures();
});
test('sales, marketing and support teams can work through the connected CRM', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `browser-${randomUUID().slice(0, 8)}@example.com`;
  trackEmail(email);
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Browser QA');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Workspace name').fill('CRM Browser Workspace');
  await page.getByLabel('Password', { exact: true }).fill('CrmBrowserPass!2026');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await page.goto('/app/crm/pipelines');
  await page.getByRole('button', { name: 'New pipeline', exact: true }).click();
  await page.getByLabel('Pipeline name', { exact: true }).fill('Enterprise sales');
  await page.getByRole('button', { name: 'Save pipeline', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enterprise sales', exact: true })).toBeVisible();
  await page.goto('/app/crm/fields');
  await page.getByRole('button', { name: 'New field', exact: true }).click();
  await page.getByLabel('Field label *', { exact: true }).fill('Team size');
  await page.getByLabel('Field key (lowercase, underscores) *', { exact: true }).fill('team_size');
  await page.getByRole('combobox', { name: 'Applies to', exact: true }).selectOption('leads');
  await page.getByRole('combobox', { name: 'Field type', exact: true }).selectOption('NUMBER');
  await page.getByLabel('Required field', { exact: true }).check();
  await page.getByRole('button', { name: 'Create field', exact: true }).click();
  await expect(page.getByText('Team size', { exact: true })).toBeVisible();
  await page.goto('/app/crm/automations');
  await page.getByRole('button', { name: 'New automation', exact: true }).click();
  await page.getByLabel('Rule name *', { exact: true }).fill('New lead follow-up');
  await page.getByLabel('Create follow-up task titled *', { exact: true }).fill('Call {{name}}');
  await page.getByLabel('Due in days', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Create automation', exact: true }).click();
  await expect(page.getByText('New lead follow-up', { exact: true })).toBeVisible();
  await page.goto('/app/crm/leads');
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  await page.getByLabel('Lead name *', { exact: true }).fill('Browser Lead');
  await page.getByLabel('Company', { exact: true }).fill('Browser Labs');
  await page.getByLabel('Email', { exact: true }).fill('crm-lead@example.com');
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('REFERRAL');
  await page.getByLabel('Lead score', { exact: true }).fill('85');
  await page.getByLabel('Potential value', { exact: true }).fill('2500');
  await page.getByLabel('Team size *', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await page.getByRole('link', { name: 'Browser Lead', exact: true }).click();
  await expect(page.getByText('Call Browser Lead', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Convert lead', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Convert lead', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Browser Labs opportunity', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create quote', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Convert to sales order', exact: true }),
  ).toBeVisible();
  await page.goto('/app/crm/deals');
  await page
    .getByRole('combobox', { name: 'Move Browser Labs opportunity', exact: true })
    .selectOption({ label: 'Qualified' });
  await expect(
    page
      .locator('.crm-board-column')
      .filter({ has: page.getByRole('heading', { name: 'Qualified', exact: true }) })
      .getByRole('link', { name: 'Browser Labs opportunity', exact: true }),
  ).toBeVisible();
  await page.goto('/app/crm/tasks');
  await page.getByRole('button', { name: 'Complete Call Browser Lead', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reopen Call Browser Lead', exact: true }),
  ).toBeVisible();
  await page.goto('/app/crm/calendar');
  await page.getByRole('button', { name: 'Schedule activity', exact: true }).click();
  await page.getByLabel('Activity title *', { exact: true }).fill('Browser discovery meeting');
  const day = new Date().toISOString().slice(0, 10);
  await page.getByLabel('Starts at *', { exact: true }).fill(`${day}T10:00`);
  await page.getByLabel('Ends at', { exact: true }).fill(`${day}T11:00`);
  await page.getByRole('button', { name: 'Create activity', exact: true }).click();
  await expect(
    page.locator('.crm-agenda-card').filter({ hasText: 'Browser discovery meeting' }),
  ).toBeVisible();
  await page.goto('/app/crm/segments');
  await page.getByRole('button', { name: 'New segment', exact: true }).click();
  await page.getByLabel('Segment name *', { exact: true }).fill('Referral audience');
  await page
    .getByRole('combobox', { name: 'Contact lifecycle', exact: true })
    .selectOption('PROSPECT');
  await page.getByLabel('Acquisition source', { exact: true }).fill('REFERRAL');
  await page.getByRole('button', { name: 'Create segment', exact: true }).click();
  await page.getByRole('link', { name: 'Referral audience', exact: true }).click();
  await expect(page.getByText('1 contacts match this segment.', { exact: false })).toBeVisible();
  await page.goto('/app/crm/campaigns');
  await page.getByRole('button', { name: 'New campaign', exact: true }).click();
  await page.getByLabel('Campaign name *', { exact: true }).fill('CRM onboarding');
  await page
    .getByRole('combobox', { name: 'Audience segment', exact: true })
    .selectOption({ label: 'Referral audience' });
  await page.getByLabel('Budget', { exact: true }).fill('500');
  await page.getByLabel('Actual spend', { exact: true }).fill('125');
  await page.getByLabel('Message subject', { exact: true }).fill('A better working day');
  await page
    .getByLabel('Message draft', { exact: true })
    .fill('An outreach draft for our referral prospects.');
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await page.getByRole('link', { name: 'CRM onboarding', exact: true }).click();
  await expect(
    page.getByText('An outreach draft for our referral prospects.', { exact: true }),
  ).toBeVisible();
  await page.goto('/app/crm/tickets');
  await page.getByRole('button', { name: 'New ticket', exact: true }).click();
  await page.getByLabel('Ticket subject *', { exact: true }).fill('Browser delivery question');
  await page
    .getByRole('combobox', { name: 'Contact', exact: true })
    .selectOption({ label: 'Browser Lead' });
  await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('HIGH');
  await page.getByLabel('Notes', { exact: true }).fill('Customer would like a delivery update.');
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await page.getByRole('link', { name: 'Browser delivery question', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Confirmed delivery with the warehouse team.');
  await page.getByRole('button', { name: 'Add internal note', exact: true }).click();
  await expect(
    page.getByText('Confirmed delivery with the warehouse team.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit ticket', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('RESOLVED');
  await page
    .getByLabel('Resolution', { exact: true })
    .fill('Delivery date confirmed with customer.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('resolved', { exact: true })).toBeVisible();
  await page.goto('/app/crm/import');
  await page
    .getByLabel('Contacts CSV file', { exact: true })
    .setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'name,email,phone\nImported Contact,imported@example.com,5551234\nBrowser Lead,crm-lead@example.com,5555555',
      ),
    });
  await page.getByRole('button', { name: 'Import 2 contacts', exact: true }).click();
  await expect(
    page.getByText('1 contacts imported. 1 duplicate emails skipped.', { exact: false }),
  ).toBeVisible();
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'light theme', exact: true }).click();
  await page.goto('/app/crm/overview');
  await expect(
    page.getByRole('heading', { name: 'Turn conversations into customers.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add lead', exact: true })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await page.screenshot({
    path: 'test-results/crm-overview-light.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/app/crm/analytics');
  await expect(
    page.getByRole('heading', { name: 'Know what moves the needle.', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/crm/deals');
  await expect(page.getByRole('heading', { name: 'Deal pipeline', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'test-results/crm-pipeline-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
