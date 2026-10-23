import { sanitizeCallbackUrl } from './utils';

export function resolveAuthRedirectPath(value: string, origin: string): string {
  if (value.startsWith('/')) {
    return sanitizeCallbackUrl(value);
  }
  try {
    const url = new URL(value);
    if (url.origin === new URL(origin).origin) {
      return sanitizeCallbackUrl(`${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}
  return '/subscriptions';
}
