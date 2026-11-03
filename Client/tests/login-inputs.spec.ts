import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`login fields remain editable before and after a failed sign-in at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const submissions: unknown[] = [];
    await page.route('**/auth/refresh', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 401, json: { message: 'No session' } });
    });
    await page.route('**/auth/login', async (route) => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({ status: 401, json: { message: 'Incorrect email or password' } });
    });
    await page.goto('/login');
    const email = page.getByLabel('Work email');
    const password = page.getByLabel('Password', { exact: true });
    await email.pressSequentially('first@example.com', { delay: 45 });
    await expect(email).toBeFocused();
    await expect(email).toHaveValue('first@example.com');
    await email.press('ControlOrMeta+A');
    await email.press('Backspace');
    await expect(email).toHaveValue('');
    await email.fill('second@example.com');
    await email.press('Home');
    await email.press('Delete');
    await email.pressSequentially('s');
    await expect(email).toHaveValue('second@example.com');
    await password.pressSequentially('EditablePassword!2026', { delay: 35 });
    await expect(password).toBeFocused();
    await password.press('Backspace');
    await expect(password).toHaveValue('EditablePassword!202');
    await password.pressSequentially('6');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Incorrect email or password' }),
    ).toBeVisible();
    expect(submissions[0]).toEqual({
      email: 'second@example.com',
      password: 'EditablePassword!2026',
    });
    await expect(email).toHaveValue('second@example.com');
    await password.press('ControlOrMeta+A');
    await password.press('Backspace');
    await expect(password).toHaveValue('');
    // Password managers can update native values without sending React change events.
    await email.evaluate((el: HTMLInputElement) => {
      el.value = 'final@example.com';
    });
    await password.evaluate((el: HTMLInputElement) => {
      el.value = 'ReplacementPassword!2026';
    });
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect.poll(() => submissions.length).toBe(2);
    expect(submissions[1]).toEqual({
      email: 'final@example.com',
      password: 'ReplacementPassword!2026',
    });
    await expect(password).toHaveValue('ReplacementPassword!2026');
    expect(
      await email.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
  });
}
