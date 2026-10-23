'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SessionContext } from 'next-auth/react';
import type { Session } from 'next-auth';
import type { SessionContextValue } from 'next-auth/react';
import { readCachedSession, writeCachedSession } from '@/providers/session-cache';

interface Props {
  children: React.ReactNode;
  session?: Session | null;
}

function getInitialOnlineState() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.navigator.onLine;
}

export function SessionProvider({ children, session }: Props) {
  const initialSession = session ?? null;
  const [currentSession, setCurrentSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState(session === undefined);
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [hasBootstrappedCache, setHasBootstrappedCache] = useState(session !== undefined);
  const currentSessionRef = useRef<Session | null>(initialSession);

  useEffect(() => {
    if (session === undefined) {
      return;
    }

    const nextSession = session ?? null;
    setCurrentSession(nextSession);
    currentSessionRef.current = nextSession;
    setIsLoading(false);
    setHasBootstrappedCache(true);
  }, [session]);

  const refreshSession = useCallback(async () => {
    if (typeof window === 'undefined' || !window.navigator.onLine) {
      return currentSessionRef.current;
    }

    const shouldBlock = currentSessionRef.current === null;
    if (shouldBlock) {
      setIsLoading(true);
    }

    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Session request failed');
      }

      const result: unknown = await response.json();
      if (result !== null && (typeof result !== 'object' || Array.isArray(result))) {
        throw new Error('Invalid session response');
      }

      const nextSession = result && Object.keys(result).length > 0 ? result as Session : null;
      if (nextSession && (typeof nextSession.user?.id !== 'string' || !nextSession.user.id || typeof nextSession.expires !== 'string')) {
        throw new Error('Invalid session response');
      }

      setCurrentSession(nextSession);
      currentSessionRef.current = nextSession;
      return nextSession;
    } catch {
      return currentSessionRef.current;
    } finally {
      if (shouldBlock) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (session !== undefined || typeof window === 'undefined') {
      return;
    }

    const cachedSession = readCachedSession();
    setCurrentSession(cachedSession);
    currentSessionRef.current = cachedSession;
    setHasBootstrappedCache(true);

    if (cachedSession || !window.navigator.onLine) {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
      setIsOnline(window.navigator.onLine);
    };
    const handleOnline = () => {
      syncOnlineState();
      // An offline reload can already report online, so the event itself must retry.
      void refreshSession();
    };

    syncOnlineState();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (session !== undefined || !hasBootstrappedCache) {
      return;
    }

    void refreshSession();
  }, [hasBootstrappedCache, refreshSession, session]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    writeCachedSession(currentSession);
  }, [currentSession, isLoading]);

  useEffect(() => {
    if (!isOnline || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !window.navigator.onLine) {
        return;
      }

      void refreshSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline, refreshSession]);

  const contextValue = useMemo<SessionContextValue>(() => {
    if (currentSession) {
      return {
        data: currentSession,
        status: 'authenticated',
        update: refreshSession,
      };
    }

    if (isLoading) {
      return {
        data: null,
        status: 'loading',
        update: refreshSession,
      };
    }

    return {
      data: null,
      status: 'unauthenticated',
      update: refreshSession,
    };
  }, [currentSession, isLoading, refreshSession]);

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}
