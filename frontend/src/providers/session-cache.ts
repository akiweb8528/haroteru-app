import type { Session } from 'next-auth';

const SESSION_CACHE_KEY = 'haroteru_session_cache_v1';

function isExpired(expires: string): boolean {
  return Number.isNaN(Date.parse(expires)) || Date.parse(expires) <= Date.now();
}

function sanitizeSession(session: Session | null): Session | null {
  if (!session?.user?.id || !session.expires || isExpired(session.expires)) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      tier: session.user.tier,
    },
    expires: session.expires,
    backendAccessToken: '',
    error: session.error,
  };
}

export function readCachedSession(): Session | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Session;
    const cachedSession = sanitizeSession(parsed);
    if (!cachedSession) {
      localStorage.removeItem(SESSION_CACHE_KEY);
    }
    return cachedSession;
  } catch {
    return null;
  }
}

export function writeCachedSession(session: Session | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const cachedSession = sanitizeSession(session);

  try {
    if (!cachedSession) {
      localStorage.removeItem(SESSION_CACHE_KEY);
      return;
    }

    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cachedSession));
  } catch {}
}

export function clearCachedSession() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {}
}

export { SESSION_CACHE_KEY };
