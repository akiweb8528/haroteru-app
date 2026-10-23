import { expect, test } from '@playwright/test';
import {
  fillSubscriptionForm,
  submitSubscriptionForm,
  subscriptionCard,
} from './e2e-helpers';

test('guest dashboard keeps local subscriptions across reloads', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Googleで同期を有効にする' })).toHaveAttribute(
    'href',
    '/auth/signin?callbackUrl=%2Fsubscriptions',
  );

  await page.getByRole('button', { name: 'サブスクを追加' }).first().click();

  await fillSubscriptionForm(page, {
    name: 'YouTube Premium',
    amountYen: 1280,
    billingCycle: 'monthly',
    category: 'video',
    note: '家族共有で使うやつ',
  });
  await submitSubscriptionForm(page);

  const card = subscriptionCard(page, 'YouTube Premium');
  await expect(card).toBeVisible();

  await page.reload();
  await expect(card).toBeVisible();
});
