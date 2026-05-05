import { test, expect } from '@playwright/test';

test('signup → land on /app → sidebar visible', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@perfin.dev`;
  const password = 'password12345';

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForURL('**/app', { timeout: 10_000 });
  await expect(page.getByText('Welcome.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Insights' })).toBeVisible();
});

test('logout redirect: /app while logged out goes to /login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/app');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});
