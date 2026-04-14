import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@/types';
import { PreferencesProvider, usePreferences } from '@/providers/PreferencesProvider';

const useSessionMock = vi.fn();
const meMock = vi.fn();
const updatePreferencesMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/features/account/api/user-client', () => ({
  userApi: {
    me: (...args: Parameters<typeof meMock>) => meMock(...args),
    updatePreferences: (...args: Parameters<typeof updatePreferencesMock>) => updatePreferencesMock(...args),
    deleteAccount: vi.fn(),
  },
}));

function setNavigatorOnlineState(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

function buildMeResponse(prefs: Pick<MeResponse, 'theme' | 'useGoogleAvatar' | 'taste'>): MeResponse {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Offline User',
    avatarUrl: '',
    theme: prefs.theme,
    useGoogleAvatar: prefs.useGoogleAvatar,
    taste: prefs.taste,
    summary: {
      monthlyEstimate: 0,
      yearlyEstimate: 0,
      subscriptionCount: 0,
      lockedCount: 0,
      reviewCount: 0,
    },
  };
}

function PreferenceProbe() {
  const { theme, useGoogleAvatar, taste, setTheme } = usePreferences();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="avatar">{String(useGoogleAvatar)}</span>
      <span data-testid="taste">{taste}</span>
      <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        toggle-theme
      </button>
    </div>
  );
}

describe('PreferencesProvider', () => {
  const session = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Offline User',
      tier: 'free' as const,
    },
    backendAccessToken: 'token',
    expires: '2099-01-01T00:00:00.000Z',
  };

  let serverPreferences: Pick<MeResponse, 'theme' | 'useGoogleAvatar' | 'taste'>;
  let resolvePreferenceUpdate: (() => void) | null;

  beforeEach(() => {
    useSessionMock.mockReset();
    meMock.mockReset();
    updatePreferencesMock.mockReset();
    useSessionMock.mockReturnValue({ data: session, status: 'authenticated' });
    serverPreferences = {
      theme: 'light',
      useGoogleAvatar: true,
      taste: 'ossan',
    };
    resolvePreferenceUpdate = null;
    meMock.mockImplementation(async () => buildMeResponse(serverPreferences));
    updatePreferencesMock.mockImplementation(
      (input: { theme?: 'light' | 'dark'; useGoogleAvatar?: boolean; taste?: 'ossan' | 'simple' }) => (
        new Promise<MeResponse>((resolve) => {
          resolvePreferenceUpdate = () => {
            serverPreferences = {
              theme: input.theme ?? serverPreferences.theme,
              useGoogleAvatar: input.useGoogleAvatar ?? serverPreferences.useGoogleAvatar,
              taste: input.taste ?? serverPreferences.taste,
            };
            resolve(buildMeResponse(serverPreferences));
          };
        })
      ),
    );
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    setNavigatorOnlineState(true);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('keeps offline preference changes visible while they sync back after reconnecting', async () => {
    render(
      <PreferencesProvider>
        <PreferenceProbe />
      </PreferencesProvider>,
    );

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });

    await act(async () => {
      setNavigatorOnlineState(false);
      window.dispatchEvent(new Event('offline'));
    });

    await act(async () => {
      screen.getByRole('button', { name: 'toggle-theme' }).click();
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');

    await act(async () => {
      setNavigatorOnlineState(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledWith({
        theme: 'dark',
        useGoogleAvatar: true,
        taste: 'ossan',
      });
    });

    expect(meMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');

    await act(async () => {
      resolvePreferenceUpdate?.();
    });

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });
  });
});
