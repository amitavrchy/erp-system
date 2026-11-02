import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { trackEmail, cleanupBrowserFixtures } from './fixtures';
import { readFile } from 'node:fs/promises';

test.afterEach(async () => {
  await cleanupBrowserFixtures();
});

test('a team can register, sell, receive payments and use the workspace on mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const unique = randomUUID().slice(0, 8);
  const email = `browser-${unique}@example.com`;
  trackEmail(email);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your business. Finally, in flow.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Create your workspace' }).click();
  await page.getByLabel('Your name').fill('Browser QA');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Workspace name').fill(`Browser QA ${unique}`);
  await page.getByLabel('Password', { exact: true }).fill('BrowserWorkspace!2026');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await page.goto('/app/inventory/products');
  await page.getByRole('button', { name: 'New product', exact: true }).click();
  await page.getByLabel('Product name', { exact: true }).fill('Browser desk lamp');
  await page.getByLabel('SKU', { exact: true }).fill(`BROWSER-${unique}`);
  await page.getByLabel('Selling price').fill('50');
  await page.getByLabel('Cost price').fill('20');
  await page.getByLabel('Reorder point').fill('5');
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('link', { name: 'Browser desk lamp', exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const csv = await downloading;
  expect(csv.suggestedFilename()).toBe('products.csv');
  const csvPath = await csv.path();
  expect(csvPath).toBeTruthy();
  expect(await readFile(csvPath!, 'utf8')).toContain(`BROWSER-${unique}`);
  await page.goto('/app/crm/contacts');
  await page.getByRole('button', { name: 'New contact', exact: true }).click();
  await page.getByLabel('Full name').fill('Browser Customer');
  await page.getByLabel('Email', { exact: true }).fill('customer@example.com');
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('link', { name: 'Browser Customer', exact: true })).toBeVisible();
  await page.goto('/app/sales/quotes');
  await page.getByRole('button', { name: 'New quote', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Customer', exact: true })
    .selectOption({ label: 'Browser Customer' });
  await page
    .getByLabel('Product 1', { exact: true })
    .selectOption({ label: `BROWSER-${unique} · Browser desk lamp` });
  await page.getByLabel('Quantity 1', { exact: true }).fill('2');
  await expect(page.getByLabel('Price 1', { exact: true })).toHaveValue('50');
  await page.getByRole('button', { name: 'Create quote', exact: true }).click();
  await page.getByRole('button', { name: 'Edit document', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Convert to sales order' })).toBeVisible();
  await page.getByRole('button', { name: 'Convert to sales order' }).click();
  await expect(page.getByRole('button', { name: 'Create invoice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
  await page.getByRole('button', { name: 'Issue invoice', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm issue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible();
  await page.goto('/app/purchasing/vendors');
  await page.getByRole('button', { name: 'New vendor', exact: true }).click();
  await page.getByLabel('Vendor name').fill('Browser Supplier');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(page.getByText('Browser Supplier', { exact: true })).toBeVisible();
  await page.goto('/app/purchasing/pos');
  await page.getByRole('button', { name: 'New purchase order', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Vendor', exact: true })
    .selectOption({ label: 'Browser Supplier' });
  await page
    .getByLabel('Product 1', { exact: true })
    .selectOption({ label: `BROWSER-${unique} · Browser desk lamp` });
  await page.getByLabel('Quantity 1', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Create purchase order', exact: true }).click();
  await page.getByRole('button', { name: 'Receive stock', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Warehouse', exact: true })
    .selectOption({ label: 'Main warehouse' });
  await page.getByRole('spinbutton').fill('4');
  await page.getByRole('button', { name: 'Confirm receive', exact: true }).click();
  await expect(page.getByText('partial', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Receive stock', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Warehouse', exact: true })
    .selectOption({ label: 'Main warehouse' });
  await page.getByRole('button', { name: 'Confirm receive', exact: true }).click();
  await expect(page.getByText('Fully received', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create vendor bill', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm bill', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/app/finance/bills');
  await page.getByRole('button', { name: 'Record paid', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByText('paid', { exact: true })).toBeVisible();
  await page.goto('/app/crm/contacts');
  await page.getByRole('link', { name: 'Browser Customer', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Add a note', exact: true })
    .fill('Confirmed the next delivery window.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(
    page.getByText('Confirmed the next delivery window.', { exact: true }),
  ).toBeVisible();
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  const small = await page.locator('body').evaluate((root) =>
    Array.from(root.querySelectorAll('*'))
      .filter(
        (el) =>
          Array.from(el.childNodes).some(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          ) &&
          el.getBoundingClientRect().width > 0 &&
          getComputedStyle(el).visibility !== 'hidden' &&
          parseFloat(getComputedStyle(el).fontSize) < 14,
      )
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent?.slice(0, 50),
        size: getComputedStyle(el).fontSize,
      })),
  );
  expect(small).toEqual([]);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search workspace' }).fill('Browser');
  await expect(page.getByRole('link', { name: /Browser Customer/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'light theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'compact', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.goto('/app/reports');
  await expect(page.getByRole('heading', { name: 'A clearer picture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accounts receivable aging' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/inventory-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
