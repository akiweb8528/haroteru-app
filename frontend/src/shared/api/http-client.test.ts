import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, signOut } = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock('next-auth/react', () => ({ getSession, signOut }));
import { ApiError, apiRequest } from './http-client';

describe('authenticated request ownership', () => {
  beforeEach(() => { vi.restoreAllMocks(); getSession.mockReset(); });

  it('never sends a queued user A mutation with user B credentials', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-b' }, backendAccessToken: 'b-token' });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/subscriptions', { method: 'POST', expectedUserId: 'owner-a' })).rejects.toMatchObject({ code: 'session_changed' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps request-only metadata out of fetch options', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-a' }, backendAccessToken: 'a-token' });
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await apiRequest('/subscriptions', { method: 'POST', expectedUserId: 'owner-a' });
    expect(fetch.mock.calls[0][1]).not.toHaveProperty('expectedUserId');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer a-token');
  });

  it('keeps queued changes and a newer login when an earlier owner request returns 401', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-a' }, backendAccessToken: 'a-token' });
    signOut.mockClear();
    const fetch = vi.fn().mockImplementation(async () => {
      getSession.mockResolvedValue({ user: { id: 'owner-b' }, backendAccessToken: 'b-token' });
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/subscriptions', { method: 'POST', expectedUserId: 'owner-a' })).rejects.toMatchObject({ status: 401, code: 'unauthorized', definitivelyRejected: false });
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'not_found', false],
    [400, 'invalid_body', false],
    [400, 'invalid_operation_id', false],
    [409, 'operation_conflict', false],
    [422, 'validation_error', true],
    [404, 'subscription_not_found', true],
  ])('marks only receipt-checked rejections as definitive (%s %s)', (status, code, rejected) => {
    expect(new ApiError('error', status, code).definitivelyRejected).toBe(rejected);
  });
});
