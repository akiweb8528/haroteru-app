// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadAuth(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of ['DEV_AUTH_ENABLED', 'ENVIRONMENT', 'NODE_ENV', 'VERCEL_ENV', 'NEXT_PUBLIC_APP_ENV']) {
    vi.stubEnv(key, env[key] ?? '');
  }
  return (await import('./auth')).authOptions;
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('本番の開発用認証防御', () => {
  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', ENVIRONMENT: 'development' },
    { NODE_ENV: 'production', ENVIRONMENT: 'test' },
    { NODE_ENV: 'production', ENVIRONMENT: 'staging', VERCEL_ENV: 'production' },
    { NODE_ENV: 'development', ENVIRONMENT: 'production' },
    { NODE_ENV: 'production', ENVIRONMENT: 'staging', NEXT_PUBLIC_APP_ENV: 'production' },
  ])('本番・矛盾した設定では credentials provider を提供しない: %j', async (env) => {
    const options = await loadAuth({ ...env, DEV_AUTH_ENABLED: 'true' });
    expect(options.providers.map((provider) => provider.type)).not.toContain('credentials');
  });
  it('明示的な staging では検証用認証を許可する', async () => {
    const options = await loadAuth({ NODE_ENV: 'production', ENVIRONMENT: 'staging', VERCEL_ENV: 'preview', DEV_AUTH_ENABLED: 'true' });
    expect(options.providers.map((provider) => provider.type)).toContain('credentials');
  });
});

describe('NextAuth OAuth callback の redirect 防御', () => {
  it.each(['/.//evil.com', 'https://app.example.com/.//evil.com', 'https://evil.com', '//evil.com'])('戻り先 %s をアプリ内に制限する', async (url) => {
    const options = await loadAuth({ NODE_ENV: 'production' });
    expect(options.callbacks?.redirect).toBeDefined();
    expect(await options.callbacks!.redirect!({ url, baseUrl: 'https://app.example.com' })).toBe('https://app.example.com/subscriptions');
  });
  it('同一 origin の正当な absolute callback を保持する', async () => {
    const options = await loadAuth({ NODE_ENV: 'production' });
    expect(await options.callbacks!.redirect!({ url: 'https://app.example.com/settings?tab=profile#avatar', baseUrl: 'https://app.example.com' })).toBe('https://app.example.com/settings?tab=profile#avatar');
  });
});
