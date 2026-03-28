'use client';

import useSWR, { mutate } from 'swr';
import type { TrackedSubscription, CreateTrackedSubscriptionInput, UpdateTrackedSubscriptionInput } from '@/types';
import { subscriptionApi, type SubscriptionListParams } from '@/features/subscriptions/api/subscription-client';
import { buildReorderPayload, reorderSubscriptionsWithHiddenItems } from '@/features/subscriptions/lib/reorder';

const SUBSCRIPTION_KEY = (params: SubscriptionListParams) => ['subscriptions', JSON.stringify(params)] as const;
const REORDER_FETCH_LIMIT = 1000;

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

  const reorder = async (draggedId: string, targetId: string): Promise<void> => {
    const visible = data?.data ?? [];
    if (visible.length === 0) return;

    const fullList = await subscriptionApi.list({
      sort: 'position',
      order: 'asc',
      page: 1,
      limit: REORDER_FETCH_LIMIT,
    });
    const reordered = reorderSubscriptionsWithHiddenItems(fullList.data, visible, draggedId, targetId);
    await subscriptionApi.reorder({ items: buildReorderPayload(reordered) });
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
    reorder,
  };
}
