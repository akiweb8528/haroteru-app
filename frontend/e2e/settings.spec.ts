import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createAuthedApiContext,
  fetchMe,
  setTaste,
  setTheme,
  signInWithDevAuth,
} from './e2e-helpers';

test('guest settings page shows sign-in prompt', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Googleで同期を有効にする' }),
  ).toHaveAttribute('href', '/auth/signin?callbackUrl=%2Fsettings');
  await expect(
    page.getByRole('link', { name: 'ダッシュボードへ戻る' }),
  ).toHaveAttribute('href', '/');
});

test.describe('authenticated settings', () => {
  let api: APIRequestContext | undefined;

  const getApi = (): APIRequestContext => {
    if (!api) throw new Error('API context is not ready');
    return api;
  };

  test.beforeEach(async () => {
    api = await createAuthedApiContext();
    await setTaste(api, 'ossan');
    await setTheme(api, 'light');
  });

  test.afterEach(async () => {
    if (!api) return;
    await setTaste(api, 'ossan');
    await setTheme(api, 'light');
    await api.dispose();
    api = undefined;
  });

  test('taste toggle changes UI text and syncs to backend', async ({ page }) => {
    const apiContext = getApi();
    await signInWithDevAuth(page, '/settings');

    // おっさんテイストのページ説明文が見えていることを確認
    await expect(page.getByText('同期設定とアプリの見た目を管理するで。')).toBeVisible();

    // シンプルテイストに切り替え
    const updatePreferenceResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith('/api/v1/users/me')
      && response.request().method() === 'PATCH'
      && Boolean(response.request().postData()?.includes('"taste":"simple"'))
    ));
    await page.getByRole('button', { name: /シンプルテイスト/ }).click();
    const updatePreferenceResponse = await updatePreferenceResponsePromise;
    expect(updatePreferenceResponse.ok()).toBeTruthy();

    // 説明文が即座に変わること
    await expect(page.getByText('同期設定と表示設定を管理します。')).toBeVisible();

    // リロード後も維持されること（サーバー側に保存されていることの確認）
    await page.reload();
    await expect(page.getByText('同期設定と表示設定を管理します。')).toBeVisible();

    // バックエンドが変更を反映していること
    const me = await fetchMe(apiContext);
    expect(me.taste).toBe('simple');
  });

  test('theme toggle applies dark class to the document', async ({ page }) => {
    await signInWithDevAuth(page, '/settings');

    // ライトモードで始まっていること
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // ダークに切り替え
    await page.getByRole('button', { name: /ダーク/ }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // ライトに戻す
    await page.getByRole('button', { name: /ライト/ }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
