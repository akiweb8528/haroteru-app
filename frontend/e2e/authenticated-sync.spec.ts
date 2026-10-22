import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  createAuthedApiContext, createSubscription, fetchSubscriptions, fillSubscriptionForm,
  resetSubscriptions, setTaste, signInWithDevAuth, subscriptionCard, submitSubscriptionForm,
} from './e2e-helpers';

async function addSubscription(page: Page, name: string, note = '送信前のメモ') {
  await page.getByRole('button', { name: 'サブスクを追加' }).first().click();
  await fillSubscriptionForm(page, { name, amountYen: 980, billingCycle: 'monthly', note });
  await submitSubscriptionForm(page);
  await expect(subscriptionCard(page, name)).toBeVisible();
}

async function holdNextCreateResponse(page: Page) {
  let release!: () => void;
  let markCommitted!: () => void;
  let rejectCommitted!: (error: unknown) => void;
  let held = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const committed = new Promise<void>((resolve, reject) => { markCommitted = resolve; rejectCommitted = reject; });
  await page.route('**/api/v1/sync/subscriptions', async (route) => {
    if (route.request().method() !== 'POST' || held) return route.continue();
    held = true;
    try {
      const response = await route.fetch();
      expect(response.ok()).toBeTruthy();
      markCommitted();
      await gate;
      await route.fulfill({ response });
    } catch (error) {
      rejectCommitted(error);
      throw error;
    }
  });
  return { committed, release };
}

test.describe('authenticated subscription sync preserves edits', () => {
  let api: APIRequestContext;
  test.beforeEach(async () => {
    api = await createAuthedApiContext();
    await resetSubscriptions(api);
    await setTaste(api, 'ossan');
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'wait' });
    await resetSubscriptions(api);
    await api.dispose();
  });

  test('an edit made after create commits but before its response survives acknowledgement and reload', async ({ page }) => {
    await signInWithDevAuth(page);
    const pending = await holdNextCreateResponse(page);
    try {
      await addSubscription(page, '遅延中の編集');
      await pending.committed;
      const card = subscriptionCard(page, '遅延中の編集');
      await card.getByRole('button', { name: '編集' }).click();
      await page.getByLabel('メモ').fill('作成の応答を待つ間に変更したメモ');
      await submitSubscriptionForm(page, '変更を保存');
      await expect(card.getByText('作成の応答を待つ間に変更したメモ')).toBeVisible();
      expect((await fetchSubscriptions(api))[0].note).toBe('送信前のメモ');
      pending.release();
      await expect.poll(async () => (await fetchSubscriptions(api)).map((item) => item.note)).toEqual(['作成の応答を待つ間に変更したメモ']);
      await page.reload();
      await expect(subscriptionCard(page, '遅延中の編集').getByText('作成の応答を待つ間に変更したメモ')).toBeVisible();
    } finally {
      pending.release();
    }
  });

  test('a deletion made after create commits but before its response never resurrects the item', async ({ page }) => {
    await signInWithDevAuth(page);
    const pending = await holdNextCreateResponse(page);
    try {
      await addSubscription(page, '遅延中の削除');
      await pending.committed;
      expect((await fetchSubscriptions(api)).map((item) => item.name)).toEqual(['遅延中の削除']);
      await subscriptionCard(page, '遅延中の削除').getByRole('button', { name: '削除' }).click();
      await page.getByRole('button', { name: '削除する' }).click();
      await expect(subscriptionCard(page, '遅延中の削除')).toHaveCount(0);
      pending.release();
      await expect.poll(async () => (await fetchSubscriptions(api)).length).toBe(0);
      await page.reload();
      await expect(subscriptionCard(page, '遅延中の削除')).toHaveCount(0);
    } finally {
      pending.release();
    }
  });

  test('a failed mutation keeps the mobile list and saved status visible and recovers through retry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createSubscription(api, { name: '同期済みのサブスク', amountYen: 500, billingCycle: 'monthly' });
    await signInWithDevAuth(page);
    let rejectMutation = true;
    await page.route('**/api/v1/sync/subscriptions', async (route) => {
      if (route.request().method() === 'POST' && rejectMutation) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'sync_test_failure', message: '通信に失敗しました。時間を空けてもう一度お試しください。' }) });
      }
      return route.continue();
    });
    await addSubscription(page, '未同期のサブスク');
    await expect(page.getByRole('status')).toHaveText('通信に失敗しました。時間を空けてもう一度お試しください。');
    await expect(page.getByText('この端末に保存しとるで・未同期 1 件')).toBeVisible();
    await expect(subscriptionCard(page, '同期済みのサブスク')).toBeVisible();
    await expect(subscriptionCard(page, '未同期のサブスク')).toBeVisible();
    await page.screenshot({ path: '/tmp/haroteru-auth-e2e/sync-failure-mobile.png', fullPage: true });
    expect((await fetchSubscriptions(api)).map((item) => item.name)).toEqual(['同期済みのサブスク']);
    const retry = page.getByRole('button', { name: '同期を再試行する' });
    await expect(retry).toBeEnabled();
    rejectMutation = false;
    await retry.click();
    await expect.poll(async () => (await fetchSubscriptions(api)).length).toBe(2);
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.reload();
    await expect(subscriptionCard(page, '同期済みのサブスク')).toBeVisible();
    await expect(subscriptionCard(page, '未同期のサブスク')).toBeVisible();
  });

  test('a lost successful create response retries with the same operation key without a duplicate', async ({ page }) => {
    await signInWithDevAuth(page);
    const keys: (string | undefined)[] = [];
    let responseLost = false;
    await page.route('**/api/v1/sync/subscriptions', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      keys.push(route.request().headers()['idempotency-key']);
      if (!responseLost) {
        responseLost = true;
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        return route.abort('failed');
      }
      return route.continue();
    });
    await addSubscription(page, '応答が失われた作成');
    await expect.poll(() => keys.length).toBe(2);
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect((await fetchSubscriptions(api)).map((item) => item.name)).toEqual(['応答が失われた作成']);
    await page.reload();
    await expect(subscriptionCard(page, '応答が失われた作成')).toHaveCount(1);
  });

  test('an older backend keeps queued edits through reload and resumes with the same create key', async ({ page }) => {
    await createSubscription(api, { name: '配備前に保存済み', amountYen: 500, billingCycle: 'monthly' });
    await signInWithDevAuth(page);
    let olderBackend = true;
    const createKeys: (string | undefined)[] = [];
    const legacyMutations: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && /\/api\/v1\/subscriptions(?:\/|$)/.test(new URL(request.url()).pathname)) {
        legacyMutations.push(request.url());
      }
    });
    await page.route('**/api/v1/sync/subscriptions', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      createKeys.push(route.request().headers()['idempotency-key']);
      if (olderBackend) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', message: 'The requested endpoint does not exist' }) });
      }
      return route.continue();
    });
    await addSubscription(page, '旧backendへの未送信');
    await expect.poll(() => createKeys.length).toBeGreaterThan(0);
    const originalKey = createKeys[0];
    expect(originalKey).toBeTruthy();
    const card = subscriptionCard(page, '旧backendへの未送信');
    await card.getByRole('button', { name: '編集' }).click();
    await page.getByLabel('メモ').fill('旧backendの間の編集も保持');
    await submitSubscriptionForm(page, '変更を保存');
    await page.reload();
    await expect(subscriptionCard(page, '配備前に保存済み')).toBeVisible();
    await expect(subscriptionCard(page, '旧backendへの未送信').getByText('旧backendの間の編集も保持')).toBeVisible();
    expect((await fetchSubscriptions(api)).map((item) => item.name)).toEqual(['配備前に保存済み']);
    const queued = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('authenticated_subscriptions_sync_v1') || '{}')) as { pendingOperations: { id: string; type: string }[] }[]);
    expect(queued.flatMap((state) => state.pendingOperations).find((operation) => operation.type === 'create')?.id).toBe(originalKey);
    expect(legacyMutations).toEqual([]);
    olderBackend = false;
    await expect.poll(async () => (await fetchSubscriptions(api)).find((item) => item.name === '旧backendへの未送信')?.note, { timeout: 45_000 }).toBe('旧backendの間の編集も保持');
    expect(createKeys.every((key) => key === originalKey)).toBeTruthy();
    expect(legacyMutations).toEqual([]);
    await page.reload();
    await expect(subscriptionCard(page, '旧backendへの未送信')).toHaveCount(1);
  });
});
