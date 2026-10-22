import { expect, test } from '@playwright/test';
import { signInWithDevAuth } from './e2e-helpers';

test('authenticated sign-in navigation rejects a callback that normalizes to a protocol-relative URL', async ({ page, baseURL }) => {
  await signInWithDevAuth(page);
  await page.goto(`/auth/signin?callbackUrl=${encodeURIComponent('/.//evil.com')}`);
  await expect(page).toHaveURL(`${baseURL}/subscriptions`);
});

test('dev sign-in returns to the dashboard when the supplied callback normalizes to a protocol-relative URL', async ({ page, baseURL }) => {
  await page.goto(`/auth/signin?callbackUrl=${encodeURIComponent('/.//evil.com')}`);
  await page.getByLabel('検証コード').fill(process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE ?? 'playwright-dev-code');
  await page.getByRole('button', { name: '検証用でサインイン' }).click();
  await expect(page).toHaveURL(`${baseURL}/subscriptions`);
});
