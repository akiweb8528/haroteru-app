'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';
import type { TrackedSubscription, CreateTrackedSubscriptionInput, UpdateTrackedSubscriptionInput, ListMeta } from '@/types';
import { ApiError } from '@/shared/api/http-client';
import { subscriptionApi, type SubscriptionListParams } from '@/features/subscriptions/api/subscription-client';
import { reorderSubscriptionsWithHiddenItems } from '@/features/subscriptions/lib/reorder';
import {
  applySubscriptionFilters,
  buildSubscriptionSummary,
  SUBSCRIPTIONS_FETCH_LIMIT,
} from '@/features/subscriptions/lib/subscription-filters';
import {
  AUTHENTICATED_SUBSCRIPTIONS_UPDATED_EVENT,
  clearAuthenticatedPendingOperations,
  emptyAuthenticatedSubscriptionsState,
  isTemporarySubscriptionId,
  queueAuthenticatedCreate,
  queueAuthenticatedDelete,
  queueAuthenticatedReorder,
  queueAuthenticatedUpdate,
  readAuthenticatedSubscriptionsState,
  replaceAuthenticatedSubscriptionsFromServer,
  replaceAuthenticatedTemporaryId,
  setAuthenticatedSyncError,
  shiftAuthenticatedPendingOperation,
  type AuthenticatedSubscriptionsState,
  type PendingSubscriptionOperation,
} from '@/features/subscriptions/lib/authenticated-sync-storage';

const SUBSCRIPTION_KEY = ['subscriptions', 'all'] as const;

type SyncState = {
  pendingCount: number;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  isOfflineReady: boolean;
  isOnline: boolean;
};

function buildSyncState(state: AuthenticatedSubscriptionsState, isSyncing: boolean, isOnline: boolean): SyncState {
  return {
    pendingCount: state.pendingOperations.length,
    isSyncing,
    syncError: state.syncError,
    lastSyncedAt: state.lastSyncedAt,
    isOfflineReady: state.subscriptions.length > 0 || state.pendingOperations.length > 0,
    isOnline,
  };
}

function resolveApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '同期に失敗しました。通信が戻ってからもう一度お試しください。';
}

export function useSubscriptions(params: SubscriptionListParams | null = {}) {
  const { data: session, status } = useSession();
  const userId = session?.user.id ?? null;
  const hasBackendAccessToken = Boolean(session?.backendAccessToken);
  const [isOnline, setIsOnline] = useState(true);
  const [authenticatedState, setAuthenticatedState] = useState<AuthenticatedSubscriptionsState>(emptyAuthenticatedSubscriptionsState());
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlightRef = useRef(false);

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
    if (!userId) {
      setAuthenticatedState(emptyAuthenticatedSubscriptionsState());
      setIsInitialized(status !== 'loading');
      return;
    }

    const syncFromStorage = () => {
      setAuthenticatedState(readAuthenticatedSubscriptionsState(userId));
      setIsInitialized(true);
    };

    syncFromStorage();
    window.addEventListener(AUTHENTICATED_SUBSCRIPTIONS_UPDATED_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener(AUTHENTICATED_SUBSCRIPTIONS_UPDATED_EVENT, syncFromStorage);
    };
  }, [status, userId]);

  const shouldFetchServerList = Boolean(
    userId
    && hasBackendAccessToken
    && isOnline
    && authenticatedState.pendingOperations.length === 0
    && !syncInFlightRef.current,
  );

  const { data, error, isLoading, isValidating } = useSWR(
    shouldFetchServerList ? [...SUBSCRIPTION_KEY, userId] : null,
    () => subscriptionApi.list({ page: 1, limit: SUBSCRIPTIONS_FETCH_LIMIT }),
    {
      revalidateOnFocus: true,
    },
  );

  useEffect(() => {
    if (!userId || !data) {
      return;
    }

    const stored = readAuthenticatedSubscriptionsState(userId);
    if (stored.pendingOperations.length > 0) {
      return;
    }

    const next = replaceAuthenticatedSubscriptionsFromServer(userId, data.data);
    setAuthenticatedState(next);
  }, [data, userId]);

  const syncNow = useCallback(async () => {
    if (!userId || !hasBackendAccessToken || !isOnline || syncInFlightRef.current) {
      return;
    }

    let workingState = readAuthenticatedSubscriptionsState(userId);
    if (workingState.pendingOperations.length === 0) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);
    setAuthenticatedState(setAuthenticatedSyncError(userId, null));

    try {
      while (workingState.pendingOperations.length > 0) {
        const operation = workingState.pendingOperations[0] as PendingSubscriptionOperation;

        if (operation.type === 'create') {
          const created = await subscriptionApi.create(operation.payload);
          workingState = replaceAuthenticatedTemporaryId(userId, operation.targetId, created);
          workingState = shiftAuthenticatedPendingOperation(userId);
          continue;
        }

        if (operation.type === 'update') {
          await subscriptionApi.update(operation.targetId, operation.payload);
          workingState = shiftAuthenticatedPendingOperation(userId);
          continue;
        }

        if (operation.type === 'delete') {
          await subscriptionApi.delete(operation.targetId);
          workingState = shiftAuthenticatedPendingOperation(userId);
          continue;
        }

        const validItems = operation.items.filter((item) => !isTemporarySubscriptionId(item.id));
        if (validItems.length > 0) {
          await subscriptionApi.reorder({ items: validItems });
        }
        workingState = shiftAuthenticatedPendingOperation(userId);
      }

      const latest = await subscriptionApi.list({ page: 1, limit: SUBSCRIPTIONS_FETCH_LIMIT });
      replaceAuthenticatedSubscriptionsFromServer(userId, latest.data);
      workingState = clearAuthenticatedPendingOperations(userId);
      setAuthenticatedState(workingState);
      await mutate((key) => Array.isArray(key) && key[0] === 'subscriptions');
      await mutate('users/me');
    } catch (syncError) {
      const next = setAuthenticatedSyncError(userId, resolveApiErrorMessage(syncError));
      setAuthenticatedState(next);
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [hasBackendAccessToken, isOnline, userId]);

  useEffect(() => {
    if (!userId || !hasBackendAccessToken || !isOnline || authenticatedState.pendingOperations.length === 0) {
      return;
    }

    void syncNow();
  }, [authenticatedState.pendingOperations.length, hasBackendAccessToken, isOnline, syncNow, userId]);

  const currentSubscriptions = useMemo(
    () => (
      authenticatedState.subscriptions.length > 0 || authenticatedState.pendingOperations.length > 0
        ? authenticatedState.subscriptions
        : (data?.data ?? [])
    ),
    [authenticatedState.pendingOperations.length, authenticatedState.subscriptions, data?.data],
  );

  const filteredSubscriptions = useMemo(
    () => applySubscriptionFilters(currentSubscriptions, params ?? {}),
    [currentSubscriptions, params],
  );

  const meta = useMemo<ListMeta | undefined>(() => {
    const source = currentSubscriptions;
    if (!userId && !data?.meta) {
      return undefined;
    }

    return {
      page: 1,
      limit: Math.max(filteredSubscriptions.length, 1),
      total: filteredSubscriptions.length,
      totalPages: 1,
      summary: buildSubscriptionSummary(source),
    };
  }, [currentSubscriptions, data?.meta, filteredSubscriptions.length, userId]);

  const create = useCallback(async (input: CreateTrackedSubscriptionInput): Promise<TrackedSubscription> => {
    if (!userId) {
      throw new Error('Missing authenticated user');
    }

    const { state, subscription } = queueAuthenticatedCreate(userId, input);
    setAuthenticatedState(state);
    if (isOnline) {
      void syncNow();
    }
    return subscription;
  }, [isOnline, syncNow, userId]);

  const update = useCallback(async (id: string, input: UpdateTrackedSubscriptionInput): Promise<TrackedSubscription> => {
    if (!userId) {
      throw new Error('Missing authenticated user');
    }

    const state = queueAuthenticatedUpdate(userId, id, input);
    setAuthenticatedState(state);
    if (isOnline) {
      void syncNow();
    }

    const updated = state.subscriptions.find((item) => item.id === id);
    if (!updated) {
      throw new Error('Updated subscription not found');
    }
    return updated;
  }, [isOnline, syncNow, userId]);

  const remove = useCallback(async (id: string): Promise<void> => {
    if (!userId) {
      throw new Error('Missing authenticated user');
    }

    const state = queueAuthenticatedDelete(userId, id);
    setAuthenticatedState(state);
    if (isOnline) {
      void syncNow();
    }
  }, [isOnline, syncNow, userId]);

  const reorder = useCallback(async (draggedId: string, targetId: string): Promise<void> => {
    if (!userId) {
      throw new Error('Missing authenticated user');
    }

    const allSubscriptions = readAuthenticatedSubscriptionsState(userId).subscriptions;
    const visible = applySubscriptionFilters(allSubscriptions, params ?? {});
    if (visible.length === 0) {
      return;
    }

    const reordered = reorderSubscriptionsWithHiddenItems(allSubscriptions, visible, draggedId, targetId);
    const state = queueAuthenticatedReorder(userId, reordered);
    setAuthenticatedState(state);
    if (isOnline) {
      void syncNow();
    }
  }, [isOnline, params, syncNow, userId]);

  const shouldHideNetworkError = !isOnline && authenticatedState.subscriptions.length > 0;
  const resolvedError = shouldHideNetworkError ? null : error;

  return {
    subscriptions: filteredSubscriptions,
    meta,
    isLoading: !isInitialized || (currentSubscriptions.length === 0 && isLoading),
    isValidating,
    error: resolvedError,
    create,
    update,
    remove,
    reorder,
    syncState: buildSyncState(authenticatedState, isSyncing, isOnline),
    syncNow,
  };
}
