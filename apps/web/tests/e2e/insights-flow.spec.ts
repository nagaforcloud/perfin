import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test('signup → upload 60d sample → trigger regenerate → see insights', async ({ page, request }) => {
  const stamp = Date.now();
  const email = `e2e-ins-${stamp}@perfin.dev`;
  const password = 'password12345';
  const csv = resolve(__dirname, '../../../../data/seeds/60-day-sample.csv');

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/onboarding/welcome');
  await page.getByRole('link', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('link', { name: /upload a statement/i }).click();
  await page.waitForURL('**/upload');
  await page.locator('input[type="file"]').setInputFiles(csv);
  await page.waitForURL('**/app/transactions', { timeout: 30_000 });

  const reg = await request.post('/api/test-regenerate', { headers: { 'content-type': 'application/json' } });
  expect(reg.ok()).toBe(true);

  await page.goto('/app/insights');
  await expect(page.getByRole('heading', { name: /insights/i })).toBeVisible();
  await expect(page.locator('text=/Spotify|Netflix|Swiggy|Jio|Apple/i').first()).toBeVisible({ timeout: 10_000 });

  await page.goto('/app');
  await expect(page.getByText(/net worth/i)).toBeVisible();
});
