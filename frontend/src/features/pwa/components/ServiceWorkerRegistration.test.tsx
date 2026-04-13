import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerRegistration } from '@/features/pwa/components/ServiceWorkerRegistration';
import { INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY } from '@/features/pwa/lib/constants';

const useSessionMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/providers/PreferencesProvider', () => ({
  usePreferences: () => ({
    taste: 'simple',
  }),
}));

function setNavigatorOnlineState(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

function setNavigatorUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
}

function setNavigatorUserAgentData(mobile?: boolean) {
  Object.defineProperty(window.navigator, 'userAgentData', {
    configurable: true,
    value: mobile === undefined ? undefined : { mobile },
  });
}

function mockMatchMedia(matchesByQuery: Record<string, boolean>) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesByQuery[query] ?? false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createBeforeInstallPromptEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    platforms: string[];
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };

  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.platforms = ['web'];
  event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
  return event;
}

describe('ServiceWorkerRegistration', () => {
  const registerMock = vi.fn();
  const addServiceWorkerListenerMock = vi.fn();
  const removeServiceWorkerListenerMock = vi.fn();
  const updateMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    useSessionMock.mockReturnValue({ status: 'authenticated' });
    sessionStorage.clear();
    localStorage.clear();
    setNavigatorOnlineState(true);
    setNavigatorUserAgentData(undefined);
    setNavigatorUserAgent('Mozilla/5.0');
    mockMatchMedia({
      '(display-mode: standalone)': false,
      '(pointer: coarse) and (hover: none)': false,
    });

    registerMock.mockReset();
    addServiceWorkerListenerMock.mockReset();
    removeServiceWorkerListenerMock.mockReset();
    updateMock.mockReset();
    updateMock.mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: registerMock.mockResolvedValue({ update: updateMock }),
        addEventListener: addServiceWorkerListenerMock,
        removeEventListener: removeServiceWorkerListenerMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not show the install prompt on desktop browsers', async () => {
    sessionStorage.setItem(INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY, 'true');
    setNavigatorUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );

    render(<ServiceWorkerRegistration />);

    await act(async () => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(screen.queryByText('Google連携の次は、アプリとして追加できます。')).not.toBeInTheDocument();
  });

  it('shows the install prompt on supported mobile browsers', async () => {
    sessionStorage.setItem(INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY, 'true');
    setNavigatorUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );
    mockMatchMedia({
      '(display-mode: standalone)': false,
      '(pointer: coarse) and (hover: none)': true,
    });

    render(<ServiceWorkerRegistration />);

    await act(async () => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(screen.getByText('Google連携の次は、アプリとして追加できます。')).toBeInTheDocument();
  });

  it('checks for service worker updates when the app comes back online', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('/sw.js');
    });
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    updateMock.mockClear();

    act(() => {
      setNavigatorOnlineState(false);
      window.dispatchEvent(new Event('offline'));
    });

    act(() => {
      setNavigatorOnlineState(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
  });
});
