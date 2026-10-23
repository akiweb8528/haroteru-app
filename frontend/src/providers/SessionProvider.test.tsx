import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import { SessionProvider } from '@/providers/SessionProvider';
import { SESSION_CACHE_KEY } from '@/providers/session-cache';

const fetchMock = vi.fn<typeof fetch>();

function SessionStatus() {
  const { data, status, update } = useSession();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user-id">{data?.user.id ?? 'none'}</span>
      <span data-testid="has-backend-token">{String(Boolean(data?.backendAccessToken))}</span>
      <button onClick={() => void update()}>Refresh session</button>
    </div>
  );
}

function setNavigatorOnlineState(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

describe('SessionProvider', () => {
  const session: Session = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Offline User',
      tier: 'free',
    },
    backendAccessToken: 'token',
    expires: '2099-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    setNavigatorOnlineState(true);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the initial session while offline without refetching', async () => {
    setNavigatorOnlineState(false);

    render(
      <SessionProvider session={session}>
        <SessionStatus />
      </SessionProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hydrates the cached session when rendered offline without a server session', async () => {
    setNavigatorOnlineState(false);
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      user: session.user,
      expires: session.expires,
      backendAccessToken: '',
    }));

    render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not clear the session when the document becomes visible offline', async () => {
    render(
      <SessionProvider session={session}>
        <SessionStatus />
      </SessionProvider>,
    );

    setNavigatorOnlineState(false);
    window.dispatchEvent(new Event('offline'));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes the session when the document becomes visible online', async () => {
    fetchMock.mockResolvedValue(Response.json(session));

    render(
      <SessionProvider session={session}>
        <SessionStatus />
      </SessionProvider>,
    );

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
    });
  });

  it.each([
    ['network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['HTTP failure', () => Promise.resolve(Response.json({}, { status: 503 }))],
    ['invalid JSON', () => Promise.resolve(new Response('<html>Unavailable</html>'))],
    ['invalid session', () => Promise.resolve(Response.json({ error: 'Unavailable' }))],
  ])('keeps the cached identity after reload despite navigator reporting online: %s', async (_name, response) => {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      user: session.user,
      expires: session.expires,
      backendAccessToken: '',
    }));
    fetchMock.mockImplementation(response);

    await act(async () => {
      render(
        <SessionProvider>
          <SessionStatus />
        </SessionProvider>,
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(JSON.parse(localStorage.getItem(SESSION_CACHE_KEY) ?? '{}')).toEqual({
      user: session.user,
      expires: session.expires,
      backendAccessToken: '',
    });

    fetchMock.mockResolvedValueOnce(Response.json({ ...session, user: { ...session.user, id: 'user-2' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh session' }));

    await waitFor(() => expect(screen.getByTestId('user-id')).toHaveTextContent('user-2'));
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(JSON.parse(localStorage.getItem(SESSION_CACHE_KEY) ?? '{}')).toMatchObject({
      user: { id: 'user-2' },
      backendAccessToken: '',
    });
  });

  it('clears the session and cached identity after a successful anonymous response', async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    render(
      <SessionProvider session={session}>
        <SessionStatus />
      </SessionProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh session' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('user-id')).toHaveTextContent('none');
    expect(localStorage.getItem(SESSION_CACHE_KEY)).toBeNull();
  });

  it.each([true, false])('restores the token once on an online event after cached reload (initial onLine: %s)', async (initialOnline) => {
    setNavigatorOnlineState(initialOnline);
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      user: session.user,
      expires: session.expires,
      backendAccessToken: '',
    }));
    if (initialOnline) {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    }
    fetchMock.mockResolvedValueOnce(Response.json(session));

    await act(async () => {
      render(
        <SessionProvider>
          <SessionStatus />
        </SessionProvider>,
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(initialOnline ? 1 : 0);
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('has-backend-token')).toHaveTextContent('false');

    setNavigatorOnlineState(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(screen.getByTestId('has-backend-token')).toHaveTextContent('true'));
    expect(fetchMock).toHaveBeenCalledTimes(initialOnline ? 2 : 1);
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(JSON.parse(localStorage.getItem(SESSION_CACHE_KEY) ?? '{}').backendAccessToken).toBe('');
  });

  it('stores a minimal cached session without persisting the backend token', async () => {
    render(
      <SessionProvider session={session}>
        <SessionStatus />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(SESSION_CACHE_KEY) ?? '{}')).toEqual({
        user: session.user,
        expires: session.expires,
        backendAccessToken: '',
      });
    });
  });
});
