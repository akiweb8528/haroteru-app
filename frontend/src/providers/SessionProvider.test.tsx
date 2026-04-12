import { act, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import { SessionProvider } from '@/providers/SessionProvider';
import { SESSION_CACHE_KEY } from '@/providers/session-cache';

const getSessionMock = vi.fn();

vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual<typeof import('next-auth/react')>('next-auth/react');

  return {
    ...actual,
    getSession: (...args: Parameters<typeof actual.getSession>) => getSessionMock(...args),
  };
});

function SessionStatus() {
  const { data, status } = useSession();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user-id">{data?.user.id ?? 'none'}</span>
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
    getSessionMock.mockReset();
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
    expect(getSessionMock).not.toHaveBeenCalled();
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
    expect(getSessionMock).not.toHaveBeenCalled();
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
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('refreshes the session when the document becomes visible online', async () => {
    getSessionMock.mockResolvedValue(session);

    render(
      <SessionProvider session={session}>
        <SessionStatus />
      </SessionProvider>,
    );

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(getSessionMock).toHaveBeenCalledWith({ broadcast: false });
    });
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
