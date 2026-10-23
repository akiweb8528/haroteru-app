import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useSubscriptions } from './useSubscriptions';
import { queueAuthenticatedCreate, queueAuthenticatedUpdate, readAuthenticatedSubscriptionsState, writeAuthenticatedSubscriptionsState } from '../lib/authenticated-sync-storage';
import type { TrackedSubscription } from '@/types';

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), reorder: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: () => mocks.session(), getSession: vi.fn() }));
vi.mock('@/features/subscriptions/api/subscription-client', () => ({ subscriptionApi: mocks }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function item(id = 'server-1', name = 'Original'): TrackedSubscription {
  return { id, userId: 'user-1', name, amountYen: 1000, billingCycle: 'monthly', reviewPriority: 'medium', locked: false, note: '', position: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}
const input = { name: 'Original', amountYen: 1000, billingCycle: 'monthly' as const, reviewPriority: 'medium' as const };
function seed(items = [item()]) {
  writeAuthenticatedSubscriptionsState('user-1', { subscriptions: items, pendingOperations: [], syncError: null, lastSyncedAt: null });
}
function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>{children}</SWRConfig>;
}
describe('authenticated subscriptions concurrency', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: 'token' }, status: 'authenticated' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    mocks.list.mockResolvedValue({ data: [item()], meta: {} });
    mocks.create.mockResolvedValue(item('server-created'));
    mocks.update.mockResolvedValue(item());
    mocks.delete.mockResolvedValue(undefined);
    mocks.reorder.mockResolvedValue(undefined);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('create送信中の編集を別操作として送り、一覧に残す', async () => {
    seed([]);
    mocks.list.mockResolvedValue({ data: [], meta: {} });
    const sending = deferred<TrackedSubscription>();
    mocks.create.mockReturnValueOnce(sending.promise);
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    let local!: TrackedSubscription;
    await act(async () => { local = await result.current.create(input); });
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.update(local.id, { name: 'Newer' }); });
    await act(async () => { sending.resolve(item('server-created')); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0].slice(0, 2)).toEqual(['server-created', { name: 'Newer' }]);
  });

  it('create送信中に削除しても復活せずサーバー削除を送る', async () => {
    seed([]);
    mocks.list.mockResolvedValue({ data: [], meta: {} });
    const sending = deferred<TrackedSubscription>();
    mocks.create.mockReturnValueOnce(sending.promise);
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    let local!: TrackedSubscription;
    await act(async () => { local = await result.current.create(input); });
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.remove(local.id); });
    await act(async () => { sending.resolve(item('server-created')); });
    await waitFor(() => expect(mocks.delete).toHaveBeenCalled());
    expect(mocks.delete.mock.calls[0][0]).toBe('server-created');
    expect(result.current.subscriptions).toEqual([]);
  });

  it('update送信中の追加更新を失わない', async () => {
    seed();
    const sending = deferred<TrackedSubscription>();
    mocks.update.mockReturnValueOnce(sending.promise);
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    await act(async () => { await result.current.update('server-1', { name: 'First' }); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.update('server-1', { amountYen: 2000 }); });
    await act(async () => { sending.resolve(item()); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update.mock.calls[1].slice(0, 2)).toEqual(['server-1', { amountYen: 2000 }]);
  });

  it('失敗操作を保持しながらサーバー一覧も取得する', async () => {
    seed([]);
    queueAuthenticatedCreate('user-1', input);
    mocks.create.mockRejectedValue(new Error('temporary failure'));
    mocks.list.mockResolvedValue({ data: [item('other', 'Server item')], meta: {} });
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => expect(result.current.syncState.syncError).toBeTruthy());
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(readAuthenticatedSubscriptionsState('user-1').pendingOperations).toHaveLength(1);
  });

  it('一覧取得中に追加した操作を上書きも一括削除もしない', async () => {
    seed();
    const listing = deferred<{ data: TrackedSubscription[]; meta: object }>();
    mocks.list.mockReturnValue(listing.promise);
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { queueAuthenticatedUpdate('user-1', 'server-1', { name: 'Local edit' }); });
    await act(async () => { listing.resolve({ data: [item()], meta: {} }); });
    expect(result.current.subscriptions[0]?.name).toBe('Local edit');
    expect(readAuthenticatedSubscriptionsState('user-1').pendingOperations).toHaveLength(1);
  });
  it('ユーザー切替時に前ユーザーの一覧も操作も漏らさない', async () => {
    seed();
    const { result, rerender } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => expect(result.current.subscriptions).toHaveLength(1));
    mocks.session.mockReturnValue({ data: null, status: 'unauthenticated' });
    rerender();
    expect(result.current.subscriptions).toEqual([]);
    await expect(result.current.update('server-1', { name: 'wrong user' })).rejects.toThrow();
    expect(readAuthenticatedSubscriptionsState('user-1').subscriptions[0].name).toBe('Original');
  });

  it('最終自動送信中に再読込しても手動再試行へ到達できる', async () => {
    seed();
    queueAuthenticatedUpdate('user-1', 'server-1', { name: 'Saved' });
    const saved = readAuthenticatedSubscriptionsState('user-1');
    saved.pendingOperations[0].attemptCount = 5;
    saved.pendingOperations[0].lastAttemptAt = new Date().toISOString();
    saved.syncError = null;
    writeAuthenticatedSubscriptionsState('user-1', saved);
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => expect(result.current.syncState.syncError).toContain('再試行'));
    expect(mocks.update).not.toHaveBeenCalled();
    await act(async () => { await result.current.syncNow(); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(readAuthenticatedSubscriptionsState('user-1').pendingOperations).toHaveLength(0);
  });

  it('オフラインで保存した操作を再マウント後のオンライン復帰で同期する', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    seed();
    const first = renderHook(() => useSubscriptions(), { wrapper });
    await act(async () => { await first.result.current.update('server-1', { amountYen: 4321 }); });
    expect(mocks.update).not.toHaveBeenCalled();
    first.unmount();
    const second = renderHook(() => useSubscriptions(), { wrapper });
    expect(second.result.current.subscriptions[0].amountYen).toBe(4321);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
  });

  it('キャッシュの利用者IDだけでも保存済み一覧と未同期操作を表示し、tokenなしでは通信しない', async () => {
    seed();
    queueAuthenticatedUpdate('user-1', 'server-1', { note: 'Pending before reload' });
    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: '' }, status: 'authenticated' });
    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    expect(result.current.subscriptions).toHaveLength(1);
    expect(result.current.subscriptions[0].note).toBe('Pending before reload');
    expect(result.current.syncState.pendingCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
    await act(async () => {
      await result.current.syncNow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(readAuthenticatedSubscriptionsState('user-1').pendingOperations[0].attemptCount ?? 0).toBe(0);
  });

  it('tokenなしのキャッシュ利用中もオフライン編集を保存し、再マウント後のtoken復帰で同期する', async () => {
    seed();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: '' }, status: 'authenticated' });
    const first = renderHook(() => useSubscriptions(), { wrapper });
    await act(async () => {
      await first.result.current.update('server-1', { amountYen: 4321, note: 'Offline edit' });
      await first.result.current.create({ ...input, name: 'Offline created', amountYen: 1700 });
    });
    expect(first.result.current.syncState.pendingCount).toBe(2);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    first.unmount();

    const second = renderHook(() => useSubscriptions(), { wrapper });
    expect(second.result.current.subscriptions.map(({ name, amountYen }) => ({ name, amountYen }))).toEqual([
      { name: 'Original', amountYen: 4321 },
      { name: 'Offline created', amountYen: 1700 },
    ]);
    expect(second.result.current.syncState.pendingCount).toBe(2);

    const created = { ...item('server-created', 'Offline created'), amountYen: 1700 };
    mocks.create.mockResolvedValue(created);
    mocks.list.mockResolvedValue({ data: [{ ...item(), amountYen: 4321, note: 'Offline edit' }, created], meta: {} });
    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: 'restored-token' }, status: 'authenticated' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
      second.rerender();
    });

    await waitFor(() => expect(second.result.current.syncState.pendingCount).toBe(0));
    expect(mocks.list).toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0].slice(0, 2)).toEqual(['server-1', { amountYen: 4321, note: 'Offline edit' }]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(readAuthenticatedSubscriptionsState('user-1').subscriptions.map(({ id }) => id)).toEqual(['server-1', 'server-created']);
  });

  it('tokenなしでもキャッシュと操作の所有者を分離し、前ユーザーの操作を拒否する', async () => {
    seed();
    queueAuthenticatedUpdate('user-1', 'server-1', { note: 'First user pending' });
    writeAuthenticatedSubscriptionsState('user-2', {
      subscriptions: [{ ...item('server-2', 'Second user'), userId: 'user-2' }],
      pendingOperations: [], syncError: null, lastSyncedAt: null,
    });
    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: '' }, status: 'authenticated' });
    const { result, rerender } = renderHook(() => useSubscriptions(), { wrapper });
    const previousUserUpdate = result.current.update;
    expect(result.current.syncState.pendingCount).toBe(1);

    mocks.session.mockReturnValue({ data: { user: { id: 'user-2' }, backendAccessToken: '' }, status: 'authenticated' });
    rerender();
    expect(result.current.subscriptions.map(({ id }) => id)).toEqual(['server-2']);
    expect(result.current.syncState.pendingCount).toBe(0);
    await expect(previousUserUpdate('server-1', { name: 'Wrong owner' })).rejects.toThrow('ログイン状態が変わりました');
    await act(async () => { await result.current.update('server-2', { note: 'Second user edit' }); });
    expect(readAuthenticatedSubscriptionsState('user-1').subscriptions[0].note).toBe('First user pending');
    expect(readAuthenticatedSubscriptionsState('user-2').subscriptions[0].note).toBe('Second user edit');
    expect(readAuthenticatedSubscriptionsState('user-2').pendingOperations).toHaveLength(1);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('送信中にtokenがなくなった場合は後続操作を保持し、復帰後に再開する', async () => {
    seed();
    const sending = deferred<TrackedSubscription>();
    mocks.update.mockReturnValueOnce(sending.promise);
    const { result, rerender } = renderHook(() => useSubscriptions(), { wrapper });
    await act(async () => { await result.current.update('server-1', { name: 'First edit' }); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.update('server-1', { amountYen: 4321 }); });

    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: '' }, status: 'authenticated' });
    rerender();
    mocks.list.mockClear();
    await act(async () => { sending.resolve(item()); });
    await waitFor(() => expect(result.current.syncState.isSyncing).toBe(false));
    expect(result.current.syncState.pendingCount).toBe(1);
    expect(result.current.subscriptions[0].amountYen).toBe(4321);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.list).not.toHaveBeenCalled();

    mocks.session.mockReturnValue({ data: { user: { id: 'user-1' }, backendAccessToken: 'restored-token' }, status: 'authenticated' });
    rerender();
    await waitFor(() => expect(result.current.syncState.pendingCount).toBe(0));
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update.mock.calls[1].slice(0, 2)).toEqual(['server-1', { amountYen: 4321 }]);
  });

  it('端末保存に失敗した削除は取り消し、一覧と保存エラーを残す', async () => {
    seed();
    const { result } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => expect(result.current.subscriptions).toHaveLength(1));
    const before = localStorage.getItem('authenticated_subscriptions_sync_v1');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await act(async () => {
      await expect(result.current.remove('server-1')).rejects.toThrow('ブラウザへの保存');
    });
    expect(result.current.subscriptions).toHaveLength(1);
    expect(result.current.syncState.syncError).toContain('ブラウザへの保存');
    expect(localStorage.getItem('authenticated_subscriptions_sync_v1')).toBe(before);
    write.mockRestore();
  });

});
