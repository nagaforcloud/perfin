import { test, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('signup → upload CSV → see categorized transactions', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-up-${stamp}@perfin.dev`;
  const password = 'password12345';
  const dir = resolve(tmpdir(), `perfin-up-${stamp}`);
  await mkdir(dir, { recursive: true });
  const csvPath = resolve(dir, 'apr.csv');
  await writeFile(
    csvPath,
    'Date,Description,Amount\n2026-04-01,Swiggy Bangalore,-450\n2026-04-02,Salary Acme,80000\n',
  );

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/onboarding/welcome');
  await page.getByRole('link', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('link', { name: /upload a statement/i }).click();

  await page.waitForURL('**/upload');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(csvPath);

  await page.waitForURL('**/app/transactions', { timeout: 30_000 });
  await expect(page.getByText('Swiggy Bangalore', { exact: false })).toBeVisible();
  await expect(page.getByText('Salary Acme',     { exact: false })).toBeVisible();
});
