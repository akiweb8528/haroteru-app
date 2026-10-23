import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createAuthedApiContext,
  createSubscription,
  devAuthEmail,
  fetchMe,
  fetchSubscriptions,
  fillSubscriptionForm,
  resetSubscriptions,
  setTaste,
  signInWithDevAuth,
  subscriptionCard,
  subscriptionCardHeadings,
  submitSubscriptionForm,
  waitForEventually,
} from './e2e-helpers';

test.describe('authenticated subscription dashboard', () => {
  let api: APIRequestContext | undefined;

  const getApi = (): APIRequestContext => {
    if (!api) {
      throw new Error('API context is not ready');
    }

    return api;
  };

  test.beforeEach(async () => {
    api = await createAuthedApiContext();
    await resetSubscriptions(api);
    await setTaste(api, 'ossan');
  });

  test.afterEach(async () => {
    if (!api) {
      return;
    }

    await resetSubscriptions(api);
    await api.dispose();
    api = undefined;
  });

  test('adds and deletes a subscription while the backend stays in sync', async ({ page }) => {
    const apiContext = getApi();
    const subscriptionName = `Playwright E2E ${Date.now()}`;
    const note = `created through Playwright ${subscriptionName}`;

    const meBefore = await fetchMe(apiContext);
    expect(meBefore.email).toBe(devAuthEmail);
    expect(meBefore.summary.subscriptionCount).toBe(0);

    await signInWithDevAuth(page);

    await expect(page.getByRole('button', { name: 'サブスクを追加' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'サブスクを追加' }).first().click();
    await fillSubscriptionForm(page, {
      name: subscriptionName,
      amountYen: 980,
      billingCycle: 'monthly',
      category: 'video',
      note,
    });
    await submitSubscriptionForm(page);

    const card = subscriptionCard(page, subscriptionName);
    await expect(card).toBeVisible();

    const subscriptionsAfterCreate = await waitForEventually(
      () => fetchSubscriptions(apiContext),
      (subscriptions) => subscriptions.length === 1,
    );
    expect(subscriptionsAfterCreate).toHaveLength(1);

    const created = subscriptionsAfterCreate[0];
    expect(created.name).toBe(subscriptionName);
    expect(created.amountYen).toBe(980);
    expect(created.note).toBe(note);
    expect(created.locked).toBe(false);

    const createdById = await apiContext.get(`/api/v1/subscriptions/${created.id}`);
    expect(createdById.ok()).toBeTruthy();
    const createdByIdBody = await createdById.json() as {
      id: string;
      name: string;
    };
    expect(createdByIdBody.name).toBe(subscriptionName);

    const meAfterCreate = await fetchMe(apiContext);
    expect(meAfterCreate.summary.subscriptionCount).toBe(1);

    await page.reload();
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: '削除' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '削除する' }).click();
    await expect(subscriptionCard(page, subscriptionName)).toHaveCount(0);

    const subscriptionsAfterDelete = await waitForEventually(
      () => fetchSubscriptions(apiContext),
      (subscriptions) => subscriptions.length === 0,
    );
    expect(subscriptionsAfterDelete).toHaveLength(0);

    const deletedById = await apiContext.get(`/api/v1/subscriptions/${created.id}`);
    expect(deletedById.status()).toBe(404);

    const meAfterDelete = await fetchMe(apiContext);
    expect(meAfterDelete.summary.subscriptionCount).toBe(0);
  });

  test('filters to a locked subscription and edits it from the list', async ({ page }) => {
    const apiContext = getApi();
    const netflix = await createSubscription(apiContext, {
      name: 'Netflix',
      amountYen: 1490,
      billingCycle: 'monthly',
      category: 'video',
      note: '休日に見るやつ',
    });
    const spotify = await createSubscription(apiContext, {
      name: 'Spotify',
      amountYen: 980,
      billingCycle: 'yearly',
      category: 'music',
      locked: true,
      note: '通勤中に聴くやつ',
    });

    await signInWithDevAuth(page);

    await expect(subscriptionCard(page, netflix.name)).toBeVisible();
    await expect(subscriptionCard(page, spotify.name)).toBeVisible();

    await page.getByRole('button', { name: 'ロック中' }).click();

    await expect(subscriptionCard(page, spotify.name)).toBeVisible();
    await expect(subscriptionCard(page, netflix.name)).toHaveCount(0);

    await page.getByRole('button', { name: '編集' }).click();
    await fillSubscriptionForm(page, {
      name: spotify.name,
      amountYen: spotify.amountYen,
      billingCycle: spotify.billingCycle,
      category: 'music',
      note: '家族で共有しているやつ',
    });
    await submitSubscriptionForm(page, '変更を保存');

    await expect(subscriptionCard(page, spotify.name)).toBeVisible();
    await expect(page.getByText('家族で共有しているやつ')).toBeVisible();

    const updatedBody = await waitForEventually(
      async () => {
        const updated = await apiContext.get(`/api/v1/subscriptions/${spotify.id}`);
        expect(updated.ok()).toBeTruthy();
        return await updated.json() as {
          id: string;
          note: string;
        };
      },
      (subscription) => subscription.note === '家族で共有しているやつ',
    );
    expect(updatedBody.note).toBe('家族で共有しているやつ');
  });

  test('search input filters the subscription list by service name', async ({ page }) => {
    const apiContext = getApi();
    await createSubscription(apiContext, {
      name: 'Netflix',
      amountYen: 1490,
      billingCycle: 'monthly',
      category: 'video',
    });
    await createSubscription(apiContext, {
      name: 'Spotify',
      amountYen: 980,
      billingCycle: 'monthly',
      category: 'music',
    });
    await createSubscription(apiContext, {
      name: 'Amazon Prime',
      amountYen: 600,
      billingCycle: 'monthly',
      category: 'shopping',
    });

    await signInWithDevAuth(page);

    await expect(subscriptionCard(page, 'Netflix')).toBeVisible();
    await expect(subscriptionCard(page, 'Spotify')).toBeVisible();
    await expect(subscriptionCard(page, 'Amazon Prime')).toBeVisible();

    await page.getByPlaceholder('サービス名やメモで検索').fill('Netflix');

    await expect(subscriptionCard(page, 'Netflix')).toBeVisible();
    await expect(subscriptionCard(page, 'Spotify')).toHaveCount(0);
    await expect(subscriptionCard(page, 'Amazon Prime')).toHaveCount(0);

    // 検索をクリアすると全件表示に戻ること
    await page.getByPlaceholder('サービス名やメモで検索').clear();

    await expect(subscriptionCard(page, 'Netflix')).toBeVisible();
    await expect(subscriptionCard(page, 'Spotify')).toBeVisible();
    await expect(subscriptionCard(page, 'Amazon Prime')).toBeVisible();
  });

  test('billing cycle filter shows only the selected cycle', async ({ page }) => {
    const apiContext = getApi();
    await createSubscription(apiContext, {
      name: 'Netflix',
      amountYen: 1490,
      billingCycle: 'monthly',
      category: 'video',
    });
    await createSubscription(apiContext, {
      name: 'Adobe CC',
      amountYen: 72336,
      billingCycle: 'yearly',
      category: 'productivity',
    });

    await signInWithDevAuth(page);

    await expect(subscriptionCard(page, 'Netflix')).toBeVisible();
    await expect(subscriptionCard(page, 'Adobe CC')).toBeVisible();

    // 月額のみに絞り込む
    await page.locator('select').filter({ hasText: '支払い頻度すべて' }).selectOption('monthly');

    await expect(subscriptionCard(page, 'Netflix')).toBeVisible();
    await expect(subscriptionCard(page, 'Adobe CC')).toHaveCount(0);

    // 年額のみに切り替え
    await page.locator('select').filter({ hasText: '支払い頻度すべて' }).selectOption('yearly');

    await expect(subscriptionCard(page, 'Adobe CC')).toBeVisible();
    await expect(subscriptionCard(page, 'Netflix')).toHaveCount(0);
  });

  test('sort by amount orders cards from most to least expensive', async ({ page }) => {
    const apiContext = getApi();
    await createSubscription(apiContext, {
      name: 'Budget App',
      amountYen: 300,
      billingCycle: 'monthly',
      category: 'utilities',
    });
    await createSubscription(apiContext, {
      name: 'Premium Suite',
      amountYen: 2980,
      billingCycle: 'monthly',
      category: 'productivity',
    });
    await createSubscription(apiContext, {
      name: 'Standard Plan',
      amountYen: 980,
      billingCycle: 'monthly',
      category: 'lifestyle',
    });

    await signInWithDevAuth(page);

    // デフォルトは登録順
    await expect(subscriptionCardHeadings(page)).toHaveText(['Budget App', 'Premium Suite', 'Standard Plan']);

    // 金額順（降順）に切り替え
    await page.locator('select').filter({ hasText: '登録順' }).selectOption('amount_yen');

    await expect(subscriptionCardHeadings(page)).toHaveText(['Premium Suite', 'Standard Plan', 'Budget App']);
  });

  test('reorders cards by drag-and-drop and keeps the new order after reload', async ({ page }) => {
    const apiContext = getApi();
    await createSubscription(apiContext, {
      name: 'Alpha',
      amountYen: 500,
      billingCycle: 'monthly',
      category: 'video',
      note: 'alpha note',
    });
    await createSubscription(apiContext, {
      name: 'Beta',
      amountYen: 1000,
      billingCycle: 'monthly',
      category: 'music',
      note: 'beta note',
    });
    await createSubscription(apiContext, {
      name: 'Gamma',
      amountYen: 1500,
      billingCycle: 'monthly',
      category: 'learning',
      note: 'gamma note',
    });

    await signInWithDevAuth(page);

    await expect(subscriptionCardHeadings(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);

    await page.getByRole('button', { name: 'ドラッグして並び替える' }).nth(2).dragTo(subscriptionCard(page, 'Alpha'));

    await expect(subscriptionCardHeadings(page)).toHaveText(['Gamma', 'Alpha', 'Beta']);

    const reordered = await waitForEventually(
      () => fetchSubscriptions(apiContext),
      (subscriptions) => subscriptions.map((item) => item.name).join(',') === 'Gamma,Alpha,Beta',
    );
    expect(reordered.map((item) => item.name)).toEqual(['Gamma', 'Alpha', 'Beta']);

    await page.reload();
    await expect(subscriptionCardHeadings(page)).toHaveText(['Gamma', 'Alpha', 'Beta']);
  });
});
