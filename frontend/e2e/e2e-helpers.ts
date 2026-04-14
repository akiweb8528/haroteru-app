import { expect, request, type APIRequestContext, type Page } from '@playwright/test';

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
  billingCycle: 'monthly' | 'yearly';
  category?: string;
  reviewPriority: 'low' | 'medium' | 'high';
  locked: boolean;
  note: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type MeResponse = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  theme: 'light' | 'dark';
  useGoogleAvatar: boolean;
  taste: 'ossan' | 'simple';
  summary: {
    monthlyEstimate: number;
    yearlyEstimate: number;
    subscriptionCount: number;
    lockedCount: number;
    reviewCount: number;
  };
};

type CreateSubscriptionInput = {
  name: string;
  amountYen: number;
  billingCycle: 'monthly' | 'yearly';
  category?: 'video' | 'music' | 'productivity' | 'learning' | 'shopping' | 'lifestyle' | 'utilities' | 'other';
  reviewPriority?: 'low' | 'medium' | 'high';
  locked?: boolean;
  note?: string;
};

const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:8080';
const devAuthCode = process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE || 'playwright-dev-code';
export const devAuthEmail = process.env.PLAYWRIGHT_E2E_DEV_AUTH_EMAIL || 'playwright-e2e@haroteru.local';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createAuthedApiContext(): Promise<APIRequestContext> {
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

export async function signInWithDevAuth(page: Page, callbackUrl = '/subscriptions'): Promise<void> {
  await page.goto(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel('検証コード').fill(devAuthCode);
  await page.getByRole('button', { name: '検証用でサインイン' }).click();
  await page.waitForURL(new RegExp(`${escapeRegExp(callbackUrl)}$`));
}

export async function fetchSubscriptions(api: APIRequestContext): Promise<Subscription[]> {
  const response = await api.get('/api/v1/subscriptions?limit=1000&sort=position&order=asc');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { data: Subscription[] };
  return body.data;
}

export async function fetchMe(api: APIRequestContext): Promise<MeResponse> {
  const response = await api.get('/api/v1/users/me');
  expect(response.ok()).toBeTruthy();
  return await response.json() as MeResponse;
}

export async function setTaste(api: APIRequestContext, taste: MeResponse['taste']): Promise<void> {
  const response = await api.patch('/api/v1/users/me', {
    data: { taste },
  });
  expect(response.ok()).toBeTruthy();
}

export async function resetSubscriptions(api: APIRequestContext): Promise<void> {
  const subscriptions = await fetchSubscriptions(api);

  for (const subscription of subscriptions) {
    const response = await api.delete(`/api/v1/subscriptions/${subscription.id}`);
    expect(response.ok()).toBeTruthy();
  }
}

export async function createSubscription(api: APIRequestContext, input: CreateSubscriptionInput): Promise<Subscription> {
  const response = await api.post('/api/v1/subscriptions', {
    data: {
      name: input.name,
      amountYen: input.amountYen,
      billingCycle: input.billingCycle,
      category: input.category,
      reviewPriority: input.reviewPriority ?? 'medium',
      locked: input.locked ?? false,
      note: input.note ?? '',
    },
  });

  expect(response.ok()).toBeTruthy();
  return await response.json() as Subscription;
}

export function subscriptionCard(page: Page, name: string) {
  return page.locator('[data-subscription-card-id]').filter({ hasText: name });
}

export function subscriptionCardHeadings(page: Page) {
  return page.locator('[data-subscription-card-id] h3');
}

export async function fillSubscriptionForm(page: Page, input: CreateSubscriptionInput): Promise<void> {
  await page.getByLabel('サービス名').fill(input.name);
  await page.getByLabel('金額').fill(String(input.amountYen));
  await page.getByLabel('支払い頻度').selectOption(input.billingCycle);

  if (input.category) {
    await page.getByLabel('カテゴリ').selectOption(input.category);
  }

  if (input.note !== undefined) {
    await page.getByLabel('メモ').fill(input.note);
  }
}

export async function submitSubscriptionForm(page: Page, submitLabel = 'サブスクを追加'): Promise<void> {
  await page.locator('form').getByRole('button', { name: submitLabel }).click();
}
