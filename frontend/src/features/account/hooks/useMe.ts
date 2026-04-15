'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';
import { userApi } from '@/features/account/api/user-client';
import { getIsRecoveringPreferences } from '@/providers/PreferencesProvider';

const ME_KEY = 'users/me';

export function useMe() {
  const { data: session } = useSession();
  const [isOnline, setIsOnline] = useState(true);

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

  const { data, error, isLoading, mutate: revalidate } = useSWR(
    session?.backendAccessToken && isOnline && !getIsRecoveringPreferences() ? ME_KEY : null,
    () => userApi.me(),
    { revalidateOnFocus: false },
  );

  const refresh = () => mutate(ME_KEY);

  return {
    me: data,
    summary: data?.summary,
    isLoading,
    error,
    refresh,
    revalidate,
  };
}
