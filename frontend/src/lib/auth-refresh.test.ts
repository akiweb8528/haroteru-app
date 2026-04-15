import type { JWT } from 'next-auth/jwt';
import { describe, expect, it } from 'vitest';
import {
  buildRefreshFailureToken,
  isAbortError,
  REFRESH_RETRY_DELAY_MS,
  shouldAttemptTokenRefresh,
} from '@/lib/auth-refresh';

const baseToken: JWT = {
  backendAccessToken: 'access-token',
  backendRefreshToken: 'refresh-token',
  accessTokenExpires: 1_000,
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Haroteru User',
    avatarUrl: '',
    tier: 'free',
  },
};

describe('auth refresh helpers', () => {
  it('does not refresh guest tokens', () => {
    expect(shouldAttemptTokenRefresh({}, 2_000)).toBe(false);
  });

  it('refreshes expired authenticated tokens that still have a refresh token', () => {
    expect(shouldAttemptTokenRefresh(baseToken, 2_000)).toBe(true);
  });

  it('skips refresh while backoff is active', () => {
    expect(shouldAttemptTokenRefresh({
      ...baseToken,
      accessTokenExpires: 0,
      refreshRetryAt: 5_000,
    }, 4_000)).toBe(false);
  });

  it('clears the backend access token and schedules a retry after refresh failure', () => {
    const nextToken = buildRefreshFailureToken(baseToken, 10_000);

    expect(nextToken.backendAccessToken).toBe('');
    expect(nextToken.error).toBe('RefreshAccessTokenError');
    expect(nextToken.refreshRetryAt).toBe(10_000 + REFRESH_RETRY_DELAY_MS);
  });

  it('recognizes AbortError instances from fetch timeouts', () => {
    expect(isAbortError(new DOMException('This operation was aborted', 'AbortError'))).toBe(true);
  });
});
