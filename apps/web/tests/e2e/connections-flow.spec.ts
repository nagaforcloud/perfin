import { test, expect } from '@playwright/test';

test('connections page renders all four tabs', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-conn-${stamp}@perfin.dev`;
  const password = 'password12345';

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/onboarding/welcome');
  await page.getByRole('link', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('link', { name: /skip for now/i }).click();
  await page.waitForURL('**/app');

  await page.goto('/app/accounts');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bank connections' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manual accounts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Uploads' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email forwarding' })).toBeVisible();

  await page.getByRole('button', { name: 'Email forwarding' }).click();
  await expect(page.locator('text=/^u_[a-f0-9]{16}@/').first()).toBeVisible();
});
