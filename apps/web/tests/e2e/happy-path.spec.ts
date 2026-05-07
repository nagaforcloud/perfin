import { test, expect } from '@playwright/test';

test('signup → onboarding → land on /app', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@perfin.dev`;
  const password = 'password12345';

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForURL('**/onboarding/welcome', { timeout: 10_000 });
  await page.getByRole('link', { name: /get started/i }).click();
  await page.waitForURL('**/onboarding/locale');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL('**/onboarding/connect');
  await page.getByRole('link', { name: /skip for now/i }).click();
  await page.waitForURL('**/app');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test('logout redirect: /app while logged out goes to /login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/app');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test.describe('Google button visibility', () => {
  test.skip(!process.env.GOOGLE_CLIENT_ID, 'requires GOOGLE_CLIENT_ID');

  test('Continue with Google button visible on /login when env is set', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('Continue with Google button visible on /signup when env is set', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });
});
