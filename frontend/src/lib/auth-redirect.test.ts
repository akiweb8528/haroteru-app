import { describe, expect, it } from 'vitest';
import { resolveAuthRedirectPath } from './auth-redirect';

describe('認証結果の戻り先', () => {
  it.each([
    '/.//evil.com', 'https://app.example.com/.//evil.com',
    'https://evil.com/subscriptions', '//evil.com', 'not a URL',
  ])('不正な認証応答 URL を相対 fallback に置き換える: %s', (value) => {
    expect(resolveAuthRedirectPath(value, 'https://app.example.com')).toBe('/subscriptions');
  });
  it.each(['/settings?tab=profile#avatar', 'https://app.example.com/settings?tab=profile#avatar'])('同一 origin のパスを保持する: %s', (value) => {
    expect(resolveAuthRedirectPath(value, 'https://app.example.com')).toBe('/settings?tab=profile#avatar');
  });
});
