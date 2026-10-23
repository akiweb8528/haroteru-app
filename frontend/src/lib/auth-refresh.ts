import type { JWT } from 'next-auth/jwt';

export const REFRESH_REQUEST_TIMEOUT_MS = 3_000;
export const REFRESH_RETRY_DELAY_MS = 30_000;

export function shouldAttemptTokenRefresh(token: JWT, now = Date.now()): boolean {
  if (!token.user || !token.backendRefreshToken) {
    return false;
  }

  if (token.refreshRetryAt && now < token.refreshRetryAt) {
    return false;
  }

  if (!token.accessTokenExpires) {
    return true;
  }

  return now >= token.accessTokenExpires;
}

export function buildRefreshFailureToken(token: JWT, now = Date.now()): JWT {
  return {
    ...token,
    backendAccessToken: '',
    accessTokenExpires: undefined,
    refreshRetryAt: now + REFRESH_RETRY_DELAY_MS,
    error: 'RefreshAccessTokenError',
  };
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'name' in error && error.name === 'AbortError';
}
