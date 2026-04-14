'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR, { mutate as globalMutate } from 'swr';
import { userApi } from '@/features/account/api/user-client';
import type { CopyTaste } from '@/lib/taste';

export type Theme = 'light' | 'dark';

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

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [theme, setThemeState] = useState<Theme>('light');
  const [useGoogleAvatar, setUseGoogleAvatarState] = useState(true);
  const [taste, setTasteState] = useState<CopyTaste>('ossan');
  const [localInitialized, setLocalInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isRecoveringPreferences, setIsRecoveringPreferences] = useState(false);
  const pendingThemeRef = useRef<Theme | null>(null);
  const previousOnlineStateRef = useRef<boolean | null>(null);

  // Fetch from API when authenticated (shares cache with useMe hook via same key)
  const { data: me, isValidating: isMeValidating } = useSWR(
    session?.backendAccessToken && isOnline && !isRecoveringPreferences ? ME_KEY : null,
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

  const syncStoredPreferencesToServer = useCallback(async () => {
    if (!session?.backendAccessToken) {
      return;
    }

    const next = readPreferenceSnapshot();

    try {
      const updated = await userApi.updatePreferences(next);
      applyPreferenceSnapshot({
        theme: updated.theme,
        useGoogleAvatar: updated.useGoogleAvatar,
        taste: updated.taste,
      });
      await globalMutate(ME_KEY, updated, false);
      setIsRecoveringPreferences(false);
    } catch {
      // Keep the local snapshot authoritative until we can sync successfully.
    }
  }, [applyPreferenceSnapshot, session?.backendAccessToken]);

  // Step 1: read localStorage on mount (before API response)
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const t: Theme = storedTheme === 'dark' ? 'dark' : 'light';
    setThemeState(t);
    applyThemeToDom(t);

    const storedAvatar = localStorage.getItem('useGoogleAvatar');
    if (storedAvatar !== null) {
      setUseGoogleAvatarState(storedAvatar !== 'false');
    }

    const storedTaste = localStorage.getItem('taste');
    setTasteState(storedTaste === 'simple' ? 'simple' : 'ossan');
    setLocalInitialized(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
      const online = window.navigator.onLine;
      const previousOnlineState = previousOnlineStateRef.current;
      previousOnlineStateRef.current = online;
      setIsOnline(online);

      if (previousOnlineState === false && online && session?.backendAccessToken) {
        setIsRecoveringPreferences(true);
        void syncStoredPreferencesToServer();
      }
    };

    syncOnlineState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, [session?.backendAccessToken, syncStoredPreferencesToServer]);

  // Step 2: once API data arrives, sync to local state + localStorage cache
  useEffect(() => {
    if (!me || !localInitialized || isMeValidating || isRecoveringPreferences) return;

    const serverTheme: Theme = me.theme === 'dark' ? 'dark' : 'light';
    if (pendingThemeRef.current && serverTheme !== pendingThemeRef.current) {
      return;
    }
    pendingThemeRef.current = null;
    applyPreferenceSnapshot({
      theme: serverTheme,
      useGoogleAvatar: me.useGoogleAvatar,
      taste: me.taste === 'simple' ? 'simple' : 'ossan',
    });
  }, [applyPreferenceSnapshot, isMeValidating, isRecoveringPreferences, localInitialized, me]);

  async function setTheme(t: Theme) {
    pendingThemeRef.current = t;
    setThemeState(t);
    applyThemeToDom(t);
    if (session?.backendAccessToken) {
      await globalMutate(
        ME_KEY,
        (current) => (current ? { ...current, theme: t } : current),
        false,
      );
      const updated = await userApi.updatePreferences({ theme: t });
      await globalMutate(ME_KEY, updated, false);
      setIsRecoveringPreferences(false);
    }
  }

  async function setUseGoogleAvatar(value: boolean) {
    setUseGoogleAvatarState(value);
    try { localStorage.setItem('useGoogleAvatar', String(value)); } catch {}
    if (session?.backendAccessToken) {
      const updated = await userApi.updatePreferences({ useGoogleAvatar: value });
      await globalMutate(ME_KEY, updated, false);
      setIsRecoveringPreferences(false);
    }
  }

  async function setTaste(value: CopyTaste) {
    setTasteState(value);
    try { localStorage.setItem('taste', value); } catch {}
    if (session?.backendAccessToken) {
      const updated = await userApi.updatePreferences({ taste: value });
      await globalMutate(ME_KEY, updated, false);
      setIsRecoveringPreferences(false);
    }
  }

  // Used on sign-out: resets local state/DOM without calling API
  function resetPreferences() {
    pendingThemeRef.current = null;
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
