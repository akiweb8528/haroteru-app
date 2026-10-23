import type {
  TrackedSubscription,
  SubscriptionListResponse,
  CreateTrackedSubscriptionInput,
  UpdateTrackedSubscriptionInput,
} from '@/types';
import { apiRequest } from '@/shared/api/http-client';

export type SubscriptionListParams = {
  search?: string;
  category?: string;
  billingCycle?: string;
  reviewPriority?: string;
  locked?: boolean;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export type ReorderSubscriptionsInput = {
  items: { id: string; position: number }[];
};

export const subscriptionApi = {
  list(params: SubscriptionListParams = {}, expectedUserId?: string, signal?: AbortSignal): Promise<SubscriptionListResponse> {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.category) qs.set('category', params.category);
    if (params.billingCycle) qs.set('billingCycle', params.billingCycle);
    if (params.reviewPriority) qs.set('reviewPriority', params.reviewPriority);
    if (params.locked !== undefined) qs.set('locked', String(params.locked));
    if (params.sort) qs.set('sort', params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiRequest<SubscriptionListResponse>(`/subscriptions${suffix}`, { expectedUserId, signal });
  },
  create(input: CreateTrackedSubscriptionInput, operationId?: string, expectedUserId?: string, signal?: AbortSignal): Promise<TrackedSubscription> {
    return apiRequest<TrackedSubscription>(operationId ? '/sync/subscriptions' : '/subscriptions', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: operationId ? { 'Idempotency-Key': operationId } : undefined,
      expectedUserId,
      signal,
    });
  },
  update(id: string, input: UpdateTrackedSubscriptionInput, operationId?: string, expectedUserId?: string, signal?: AbortSignal): Promise<TrackedSubscription> {
    return apiRequest<TrackedSubscription>(`${operationId ? '/sync' : ''}/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      headers: operationId ? { 'Idempotency-Key': operationId } : undefined,
      expectedUserId,
      signal,
    });
  },
  delete(id: string, operationId?: string, expectedUserId?: string, signal?: AbortSignal): Promise<void> {
    return apiRequest<void>(`${operationId ? '/sync' : ''}/subscriptions/${id}`, {
      method: 'DELETE',
      headers: operationId ? { 'Idempotency-Key': operationId } : undefined,
      expectedUserId,
      signal,
    });
  },
  reorder(input: ReorderSubscriptionsInput, operationId?: string, expectedUserId?: string, signal?: AbortSignal): Promise<void> {
    return apiRequest<void>(operationId ? '/sync/subscriptions/reorder' : '/subscriptions/reorder', {
      method: 'PATCH',
      body: JSON.stringify(input),
      headers: operationId ? { 'Idempotency-Key': operationId } : undefined,
      expectedUserId,
      signal,
    });
  },
};
