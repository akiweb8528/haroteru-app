'use client';

import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import type { TrackedSubscription, CreateTrackedSubscriptionInput, UpdateTrackedSubscriptionInput, ListMeta } from '@/types';
import { subscriptionApi, type SubscriptionListParams } from '@/features/subscriptions/api/subscription-client';
import { buildReorderPayload, reorderSubscriptionsWithHiddenItems } from '@/features/subscriptions/lib/reorder';
import {
  applySubscriptionFilters,
  buildSubscriptionSummary,
  SUBSCRIPTIONS_FETCH_LIMIT,
} from '@/features/subscriptions/lib/subscription-filters';

const SUBSCRIPTION_KEY = ['subscriptions', 'all'] as const;

export function useSubscriptions(params: SubscriptionListParams | null = {}) {
  const key = params !== null ? SUBSCRIPTION_KEY : null;

  const { data, error, isLoading, isValidating } = useSWR(
    key,
    () => subscriptionApi.list({ page: 1, limit: SUBSCRIPTIONS_FETCH_LIMIT }),
    {
      revalidateOnFocus: true,
    },
  );

  const filteredSubscriptions = useMemo(
    () => applySubscriptionFilters(data?.data ?? [], params ?? {}),
    [data?.data, params],
  );

  const meta = useMemo<ListMeta | undefined>(() => {
    if (!data?.meta) return undefined;

    return {
      page: 1,
      limit: Math.max(filteredSubscriptions.length, 1),
      total: filteredSubscriptions.length,
      totalPages: 1,
      summary: buildSubscriptionSummary(data.data),
    };
  }, [data, filteredSubscriptions.length]);

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
    const allSubscriptions = data?.data ?? [];
    const visible = applySubscriptionFilters(allSubscriptions, params ?? {});
    if (visible.length === 0) return;

    const reordered = reorderSubscriptionsWithHiddenItems(allSubscriptions, visible, draggedId, targetId);
    await subscriptionApi.reorder({ items: buildReorderPayload(reordered) });
    await mutate((k) => Array.isArray(k) && k[0] === 'subscriptions');
    await mutate('users/me');
  };

  return {
    subscriptions: filteredSubscriptions,
    meta,
    isLoading,
    isValidating,
    error,
    create,
    update,
    remove,
    reorder,
  };
}
