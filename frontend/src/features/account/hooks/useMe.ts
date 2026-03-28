'use client';

import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';
import { userApi } from '@/features/account/api/user-client';

const ME_KEY = 'users/me';

export function useMe() {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    session?.backendAccessToken ? ME_KEY : null,
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
