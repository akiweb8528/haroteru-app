'use client';

import useSWR, { mutate } from 'swr';
import type { TrackedSubscription, CreateTrackedSubscriptionInput, UpdateTrackedSubscriptionInput } from '@/types';
import { subscriptionApi, type SubscriptionListParams } from '@/features/subscriptions/api/subscription-client';

const SUBSCRIPTION_KEY = (params: SubscriptionListParams) => ['subscriptions', JSON.stringify(params)] as const;

export function useSubscriptions(params: SubscriptionListParams | null = {}) {
  const key = params !== null ? SUBSCRIPTION_KEY(params) : null;

  const { data, error, isLoading, isValidating } = useSWR(
    key,
    () => subscriptionApi.list(params!),
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const create = async (input: CreateTrackedSubscriptionInput): Promise<TrackedSubscription> => {
    const item = await subscriptionApi.create(input);
    await mutate((k) => Array.isArray(k) && k[0] === 'subscriptions');
    await mutate('users/me');
    return item;
  };

  const update = async (id: string, input: UpdateTrackedSubscriptionInput): Promise<TrackedSubscription> => {
    const item = await subscriptionApi.update(id, input);
    await mutate((k) => Array.isArray(k) && k[0] === 'subscriptions');
    await mutate('users/me');
    return item;
  };

  const remove = async (id: string): Promise<void> => {
    await subscriptionApi.delete(id);
    await mutate((k) => Array.isArray(k) && k[0] === 'subscriptions');
    await mutate('users/me');
  };

  return {
    subscriptions: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    isValidating,
    error,
    create,
    update,
    remove,
  };
}
