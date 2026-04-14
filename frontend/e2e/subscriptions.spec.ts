import { expect, request, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

type DevAuthResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string;
    tier: 'free' | 'pro';
  };
};

type Subscription = {
  id: string;
  name: string;
  amountYen: number;
  note: string;
  locked: boolean;
};

const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:8080';
const devAuthCode = process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE || 'playwright-dev-code';
const devAuthEmail = process.env.PLAYWRIGHT_E2E_DEV_AUTH_EMAIL || 'playwright-e2e@haroteru.local';

async function createAuthedApiContext(): Promise<APIRequestContext> {
  const authContext = await request.newContext({ baseURL: backendUrl });
  try {
    const response = await authContext.post('/api/v1/auth/dev', {
      data: { code: devAuthCode },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json() as DevAuthResponse;

    return await request.newContext({
      baseURL: backendUrl,
      extraHTTPHeaders: {
        Authorization: `Bearer ${body.access_token}`,
        'Content-Type': 'application/json',
      },
    });
  } finally {
    await authContext.dispose();
  }
}

async function fetchSubscriptions(api: APIRequestContext): Promise<Subscription[]> {
  const response = await api.get('/api/v1/subscriptions?limit=1000&sort=position&order=asc');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { data: Subscription[] };
  return body.data;
}

test('dev auth, UI creation, API verification, and UI deletion stay in sync', async ({ page }) => {
  const api = await createAuthedApiContext();
  const subscriptionName = `Playwright E2E ${Date.now()}`;
  const note = `created through Playwright ${subscriptionName}`;

  try {
    const meBefore = await api.get('/api/v1/users/me');
    expect(meBefore.ok()).toBeTruthy();
    const meBeforeBody = await meBefore.json() as {
      email: string;
      summary: { subscriptionCount: number };
    };
    expect(meBeforeBody.email).toBe(devAuthEmail);
    expect(meBeforeBody.summary.subscriptionCount).toBe(0);

    await page.goto('/auth/signin?callbackUrl=%2Fsubscriptions');
    await page.getByLabel('検証コード').fill(devAuthCode);
    await page.getByRole('button', { name: '検証用でサインイン' }).click();
    await page.waitForURL(/\/subscriptions$/);

    await expect(page.getByRole('button', { name: 'サブスクを追加' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'サブスクを追加' }).first().click();
    await expect(page.getByLabel('サービス名')).toBeVisible();

    await page.getByLabel('サービス名').fill(subscriptionName);
    await page.getByLabel('金額').fill('980');
    await page.getByLabel('支払い頻度').selectOption('monthly');
    await page.getByLabel('カテゴリ').selectOption('video');
    await page.getByLabel('メモ').fill(note);

    await page.locator('form').getByRole('button', { name: 'サブスクを追加' }).click();

    const card = page.locator('[data-subscription-card-id]').filter({ hasText: subscriptionName });
    await expect(card).toBeVisible();

    const subscriptionsAfterCreate = await fetchSubscriptions(api);
    expect(subscriptionsAfterCreate).toHaveLength(1);

    const created = subscriptionsAfterCreate[0];
    expect(created.name).toBe(subscriptionName);
    expect(created.amountYen).toBe(980);
    expect(created.note).toBe(note);
    expect(created.locked).toBe(false);

    const createdById = await api.get(`/api/v1/subscriptions/${created.id}`);
    expect(createdById.ok()).toBeTruthy();
    const createdByIdBody = await createdById.json() as Subscription;
    expect(createdByIdBody.name).toBe(subscriptionName);

    const meAfterCreate = await api.get('/api/v1/users/me');
    expect(meAfterCreate.ok()).toBeTruthy();
    const meAfterCreateBody = await meAfterCreate.json() as {
      summary: { subscriptionCount: number };
    };
    expect(meAfterCreateBody.summary.subscriptionCount).toBe(1);

    await page.reload();
    await expect(page.locator('[data-subscription-card-id]').filter({ hasText: subscriptionName })).toBeVisible();

    await card.getByRole('button', { name: '削除' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '削除する' }).click();
    await expect(page.locator('[data-subscription-card-id]').filter({ hasText: subscriptionName })).toHaveCount(0);

    const subscriptionsAfterDelete = await fetchSubscriptions(api);
    expect(subscriptionsAfterDelete).toHaveLength(0);

    const deletedById = await api.get(`/api/v1/subscriptions/${created.id}`);
    expect(deletedById.status()).toBe(404);

    const meAfterDelete = await api.get('/api/v1/users/me');
    expect(meAfterDelete.ok()).toBeTruthy();
    const meAfterDeleteBody = await meAfterDelete.json() as {
      summary: { subscriptionCount: number };
    };
    expect(meAfterDeleteBody.summary.subscriptionCount).toBe(0);
  } finally {
    await api.dispose();
  }
});
