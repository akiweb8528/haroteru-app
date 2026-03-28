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
  list(params: SubscriptionListParams = {}): Promise<SubscriptionListResponse> {
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
    return apiRequest<SubscriptionListResponse>(`/subscriptions${suffix}`);
  },
  create(input: CreateTrackedSubscriptionInput): Promise<TrackedSubscription> {
    return apiRequest<TrackedSubscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: UpdateTrackedSubscriptionInput): Promise<TrackedSubscription> {
    return apiRequest<TrackedSubscription>(`/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest<void>(`/subscriptions/${id}`, { method: 'DELETE' });
  },
  reorder(input: ReorderSubscriptionsInput): Promise<void> {
    return apiRequest<void>('/subscriptions/reorder', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
};
