'use client';

import { useEffect, useState, useCallback } from 'react';
import type {
  TrackedSubscription,
  CreateTrackedSubscriptionInput,
  UpdateTrackedSubscriptionInput,
  ListMeta,
  DashboardSummary,
} from '@/types';
import type { SubscriptionListParams } from '@/features/subscriptions/api/subscription-client';

const STORAGE_KEY = 'local_subscriptions';

function loadFromStorage(): TrackedSubscription[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackedSubscription[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: TrackedSubscription[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function buildSummary(items: TrackedSubscription[]): DashboardSummary {
  const monthlyEstimate = items.reduce((sum, item) => sum + (item.billingCycle === 'yearly' ? Math.round(item.amountYen / 12) : item.amountYen), 0);
  const yearlyEstimate = items.reduce((sum, item) => sum + (item.billingCycle === 'yearly' ? item.amountYen : item.amountYen * 12), 0);
  const lockedCount = items.filter((item) => item.locked).length;
  const reviewCount = items.filter((item) => item.reviewPriority === 'low').length;

  return {
    monthlyEstimate,
    yearlyEstimate,
    subscriptionCount: items.length,
    lockedCount,
    reviewCount,
  };
}

function applyFilters(items: TrackedSubscription[], params: SubscriptionListParams): TrackedSubscription[] {
  let result = [...items];
  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter((item) => item.name.toLowerCase().includes(q) || item.note.toLowerCase().includes(q));
  }
  if (params.category) {
    result = result.filter((item) => item.category === params.category);
  }
  if (params.billingCycle) {
    result = result.filter((item) => item.billingCycle === params.billingCycle);
  }
  if (params.reviewPriority) {
    result = result.filter((item) => item.reviewPriority === params.reviewPriority);
  }
  if (params.locked !== undefined) {
    result = result.filter((item) => item.locked === params.locked);
  }

  const sortField = params.sort ?? 'position';
  const dir = params.order === 'desc' ? -1 : 1;
  result.sort((a, b) => {
    switch (sortField) {
      case 'name':
        return dir * a.name.localeCompare(b.name, 'ja');
      case 'amount_yen':
        return dir * (a.amountYen - b.amountYen);
      case 'created_at':
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default:
        return dir * (a.position - b.position);
    }
  });

  return result;
}

export function useLocalSubscriptions(params: SubscriptionListParams = {}) {
  const [allSubscriptions, setAllSubscriptions] = useState<TrackedSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAllSubscriptions(loadFromStorage());
    setIsLoading(false);
  }, []);

  const create = useCallback(async (input: CreateTrackedSubscriptionInput): Promise<TrackedSubscription> => {
    const now = new Date().toISOString();
    const current = loadFromStorage();
    const maxPos = current.reduce((m, item) => Math.max(m, item.position), -1);
    const item: TrackedSubscription = {
      id: crypto.randomUUID(),
      userId: 'local',
      name: input.name,
      amountYen: input.amountYen,
      billingCycle: input.billingCycle,
      category: input.category,
      reviewPriority: input.reviewPriority,
      locked: input.locked ?? false,
      billingDay: input.billingDay,
      note: input.note ?? '',
      position: maxPos + 1,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...current, item];
    saveToStorage(next);
    setAllSubscriptions(next);
    return item;
  }, []);

  const update = useCallback(async (id: string, input: UpdateTrackedSubscriptionInput): Promise<TrackedSubscription> => {
    const current = loadFromStorage();
    let updated!: TrackedSubscription;
    const next = current.map((item) => {
      if (item.id !== id) return item;
      updated = {
        ...item,
        ...input,
        billingDay: input.clearBillingDay ? undefined : input.billingDay !== undefined ? input.billingDay : item.billingDay,
        note: input.note !== undefined ? input.note : item.note,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    saveToStorage(next);
    setAllSubscriptions(next);
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    const next = loadFromStorage().filter((item) => item.id !== id);
    saveToStorage(next);
    setAllSubscriptions(next);
  }, []);

  const filtered = applyFilters(allSubscriptions, params);
  const meta: ListMeta = {
    page: 1,
    limit: Math.max(filtered.length, 1),
    total: filtered.length,
    totalPages: 1,
    summary: buildSummary(allSubscriptions),
  };

  return {
    subscriptions: filtered,
    meta,
    isLoading,
    isValidating: false,
    error: null as Error | null,
    create,
    update,
    remove,
  };
}
