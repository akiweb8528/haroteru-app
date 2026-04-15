'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR, { mutate as globalMutate } from 'swr';
import { userApi } from '@/features/account/api/user-client';
import type { CopyTaste } from '@/lib/taste';

export type Theme = 'light' | 'dark';

// Module-level flags so useMe can skip fetching while local preferences are
// still authoritative, even before React finishes propagating provider state.
let _isRecoveringPreferences = false;
let _hasPendingPreferenceSync = false;
export function getIsRecoveringPreferences() { return _isRecoveringPreferences || _hasPendingPreferenceSync; }

interface PreferencesContextValue {
  theme: Theme;
  useGoogleAvatar: boolean;
  taste: CopyTaste;
  setTheme: (theme: Theme) => Promise<void>;
  setUseGoogleAvatar: (value: boolean) => Promise<void>;
  setTaste: (taste: CopyTaste) => Promise<void>;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const ME_KEY = 'users/me';
const PENDING_PREFERENCES_SYNC_KEY = 'pending_preferences_sync';

interface PreferenceSnapshot {
  theme: Theme;
  useGoogleAvatar: boolean;
  taste: CopyTaste;
}

function applyThemeToDom(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('theme', theme); } catch {}
}

function readPreferenceSnapshot(): PreferenceSnapshot {
  try {
    const storedTheme = localStorage.getItem('theme');
    const storedAvatar = localStorage.getItem('useGoogleAvatar');
    const storedTaste = localStorage.getItem('taste');

    return {
      theme: storedTheme === 'dark' ? 'dark' : 'light',
      useGoogleAvatar: storedAvatar !== 'false',
      taste: storedTaste === 'simple' ? 'simple' : 'ossan',
    };
  } catch {
    return {
      theme: 'light',
      useGoogleAvatar: true,
      taste: 'ossan',
    };
  }
}

function writePreferenceSnapshot(next: PreferenceSnapshot) {
  try {
    localStorage.setItem('theme', next.theme);
    localStorage.setItem('useGoogleAvatar', String(next.useGoogleAvatar));
    localStorage.setItem('taste', next.taste);
  } catch {}
}

function normalizePreferenceSnapshot(input: unknown): PreferenceSnapshot | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Partial<PreferenceSnapshot>;
  const theme = candidate.theme === 'dark' ? 'dark' : candidate.theme === 'light' ? 'light' : null;
  const useGoogleAvatar = typeof candidate.useGoogleAvatar === 'boolean' ? candidate.useGoogleAvatar : null;
  const taste = candidate.taste === 'simple' ? 'simple' : candidate.taste === 'ossan' ? 'ossan' : null;

  if (theme === null || useGoogleAvatar === null || taste === null) {
    return null;
  }

  return {
    theme,
    useGoogleAvatar,
    taste,
  };
}

function readPendingPreferenceSnapshot(): PreferenceSnapshot | null {
  try {
    const stored = localStorage.getItem(PENDING_PREFERENCES_SYNC_KEY);
    if (!stored) {
      return null;
    }

    return normalizePreferenceSnapshot(JSON.parse(stored));
  } catch {
    return null;
  }
}

function writePendingPreferenceSnapshot(next: PreferenceSnapshot | null) {
  try {
    if (next) {
      localStorage.setItem(PENDING_PREFERENCES_SYNC_KEY, JSON.stringify(next));
      return;
    }

    localStorage.removeItem(PENDING_PREFERENCES_SYNC_KEY);
  } catch {}
}

function getInitialOnlineState() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.navigator.onLine;
}

function getInitialPendingPreferenceSyncState() {
  const hasPendingPreferenceSync = readPendingPreferenceSnapshot() !== null;
  _hasPendingPreferenceSync = hasPendingPreferenceSync;
  return hasPendingPreferenceSync;
}

function arePreferenceSnapshotsEqual(left: PreferenceSnapshot | null, right: PreferenceSnapshot | null) {
  if (!left || !right) {
    return left === right;
  }

  return left.theme === right.theme
    && left.useGoogleAvatar === right.useGoogleAvatar
    && left.taste === right.taste;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [theme, setThemeState] = useState<Theme>('light');
  const [useGoogleAvatar, setUseGoogleAvatarState] = useState(true);
  const [taste, setTasteState] = useState<CopyTaste>('ossan');
  const [localInitialized, setLocalInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [hasPendingPreferenceSync, setHasPendingPreferenceSync] = useState(getInitialPendingPreferenceSyncState);
  const [pendingPreferenceSyncVersion, setPendingPreferenceSyncVersion] = useState(() => (_hasPendingPreferenceSync ? 1 : 0));
  const [isRecoveringPreferences, setIsRecoveringPreferences] = useState(false);
  const recoveryInFlightRef = useRef(false);

  // Fetch from API when authenticated (shares cache with useMe hook via same key)
  const { data: me, isValidating: isMeValidating } = useSWR(
    session?.backendAccessToken && isOnline && !isRecoveringPreferences && !hasPendingPreferenceSync ? ME_KEY : null,
    () => userApi.me(),
    { revalidateOnFocus: false },
  );

  const applyPreferenceSnapshot = useCallback((next: PreferenceSnapshot) => {
    setThemeState(next.theme);
    applyThemeToDom(next.theme);
    setUseGoogleAvatarState(next.useGoogleAvatar);
    setTasteState(next.taste);
    writePreferenceSnapshot(next);
  }, []);

  const setPendingPreferenceSync = useCallback((next: PreferenceSnapshot) => {
    _hasPendingPreferenceSync = true;
    setHasPendingPreferenceSync(true);
    setPendingPreferenceSyncVersion((current) => current + 1);
    writePendingPreferenceSnapshot(next);
  }, []);

  const clearPendingPreferenceSync = useCallback(() => {
    _hasPendingPreferenceSync = false;
    setHasPendingPreferenceSync(false);
    writePendingPreferenceSnapshot(null);
  }, []);

  const syncStoredPreferencesToServer = useCallback(async () => {
    if (!session?.backendAccessToken) {
      return false;
    }

    const next = readPendingPreferenceSnapshot() ?? readPreferenceSnapshot();
    let shouldContinueSync = false;

    try {
      const updated = await userApi.updatePreferences(next);
      const confirmed = {
        theme: updated.theme,
        useGoogleAvatar: updated.useGoogleAvatar,
        taste: updated.taste,
      } satisfies PreferenceSnapshot;
      const latestPending = readPendingPreferenceSnapshot();

      if (!latestPending || arePreferenceSnapshotsEqual(latestPending, next)) {
        applyPreferenceSnapshot(confirmed);
        clearPendingPreferenceSync();
        await globalMutate(ME_KEY, updated, false);
      } else {
        shouldContinueSync = true;
      }
    } catch {
      // Keep the local snapshot authoritative until we can sync successfully.
    } finally {
      _isRecoveringPreferences = false;
      recoveryInFlightRef.current = false;
      setIsRecoveringPreferences(false);
    }

    return shouldContinueSync;
  }, [applyPreferenceSnapshot, clearPendingPreferenceSync, session?.backendAccessToken]);

  const startPreferenceRecovery = useCallback(() => {
    if (
      !localInitialized
      || !hasPendingPreferenceSync
      || !isOnline
      || !session?.backendAccessToken
      || recoveryInFlightRef.current
    ) {
      return;
    }

    _isRecoveringPreferences = true;
    recoveryInFlightRef.current = true;
    setIsRecoveringPreferences(true);

    void syncStoredPreferencesToServer().then((shouldContinueSync) => {
      if (shouldContinueSync) {
        startPreferenceRecovery();
      }
    });
  }, [hasPendingPreferenceSync, isOnline, localInitialized, session?.backendAccessToken, syncStoredPreferencesToServer]);

  // Step 1: read localStorage on mount (before API response)
  useEffect(() => {
    applyPreferenceSnapshot(readPreferenceSnapshot());
    setLocalInitialized(true);
  }, [applyPreferenceSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
      setIsOnline(window.navigator.onLine);
    };

    syncOnlineState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    startPreferenceRecovery();
  }, [hasPendingPreferenceSync, isOnline, localInitialized, pendingPreferenceSyncVersion, session?.backendAccessToken, startPreferenceRecovery]);

  // Step 2: once API data arrives, sync to local state + localStorage cache.
  useEffect(() => {
    if (!me || !localInitialized || isMeValidating || isRecoveringPreferences || hasPendingPreferenceSync) return;

    applyPreferenceSnapshot({
      theme: me.theme === 'dark' ? 'dark' : 'light',
      useGoogleAvatar: me.useGoogleAvatar,
      taste: me.taste === 'simple' ? 'simple' : 'ossan',
    });
  }, [applyPreferenceSnapshot, hasPendingPreferenceSync, isMeValidating, isRecoveringPreferences, localInitialized, me]);

  async function setTheme(t: Theme) {
    const next = { theme: t, useGoogleAvatar, taste } satisfies PreferenceSnapshot;
    applyPreferenceSnapshot(next);
    setPendingPreferenceSync(next);
  }

  async function setUseGoogleAvatar(value: boolean) {
    const next = { theme, useGoogleAvatar: value, taste } satisfies PreferenceSnapshot;
    applyPreferenceSnapshot(next);
    setPendingPreferenceSync(next);
  }

  async function setTaste(value: CopyTaste) {
    const next = { theme, useGoogleAvatar, taste: value } satisfies PreferenceSnapshot;
    applyPreferenceSnapshot(next);
    setPendingPreferenceSync(next);
  }

  // Used on sign-out: resets local state/DOM without calling API
  function resetPreferences() {
    _isRecoveringPreferences = false;
    recoveryInFlightRef.current = false;
    setIsRecoveringPreferences(false);
    clearPendingPreferenceSync();
    setThemeState('light');
    setUseGoogleAvatarState(true);
    setTasteState('ossan');
    document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('useGoogleAvatar', 'true');
      localStorage.setItem('taste', 'ossan');
    } catch {}
  }

  return (
    <PreferencesContext.Provider value={{ theme, useGoogleAvatar, taste, setTheme, setUseGoogleAvatar, setTaste, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
