import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/shared/api/http-client', () => ({ apiRequest: request }));
import { subscriptionApi } from './subscription-client';

describe('subscription operation identity', () => {
  beforeEach(() => { request.mockReset(); });

  it('sends the same durable identity on create retries and binds the owner', async () => {
    const input = { name: 'Music', amountYen: 1000, billingCycle: 'monthly' as const, reviewPriority: 'medium' as const };
    await subscriptionApi.create(input, 'create-op', 'owner-a');
    await subscriptionApi.create(input, 'create-op', 'owner-a');
    for (const [path, options] of request.mock.calls) {
      expect(path).toBe('/sync/subscriptions');
      expect(options.headers).toEqual({ 'Idempotency-Key': 'create-op' });
      expect(options.expectedUserId).toBe('owner-a');
      expect(JSON.parse(options.body)).toEqual(input);
    }
  });

  it('identifies update, delete and reorder separately and propagates cancellation', async () => {
    const signal = new AbortController().signal;
    await subscriptionApi.update('sub-a', { name: 'New' }, 'update-op', 'owner-a', signal);
    await subscriptionApi.delete('sub-a', 'delete-op', 'owner-a', signal);
    await subscriptionApi.reorder({ items: [{ id: 'sub-b', position: 0 }] }, 'reorder-op', 'owner-a', signal);
    expect(request.mock.calls.map(([, options]) => options.headers['Idempotency-Key'])).toEqual(['update-op', 'delete-op', 'reorder-op']);
    expect(request.mock.calls.every(([, options]) => options.expectedUserId === 'owner-a' && options.signal === signal)).toBe(true);
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/sync/subscriptions/sub-a', '/sync/subscriptions/sub-a', '/sync/subscriptions/reorder']);
  });

  it('keeps legacy callers on the original mutation routes', async () => {
    await subscriptionApi.create({ name: 'Music', amountYen: 1000, billingCycle: 'monthly', reviewPriority: 'medium' });
    await subscriptionApi.update('sub-a', { name: 'New' });
    await subscriptionApi.delete('sub-a');
    await subscriptionApi.reorder({ items: [{ id: 'sub-b', position: 0 }] });
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/subscriptions', '/subscriptions/sub-a', '/subscriptions/sub-a', '/subscriptions/reorder']);
  });

  it('keeps a missing sync endpoint failure without falling back to an unsafe create', async () => {
    request.mockRejectedValue(Object.assign(new Error('endpoint missing'), { status: 404, code: 'not_found' }));
    await expect(subscriptionApi.create({ name: 'Music', amountYen: 1000, billingCycle: 'monthly', reviewPriority: 'medium' }, 'create-op', 'owner-a')).rejects.toMatchObject({ status: 404 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/sync/subscriptions');
  });
});
