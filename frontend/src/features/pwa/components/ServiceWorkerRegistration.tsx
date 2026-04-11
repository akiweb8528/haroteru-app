'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePreferences } from '@/providers/PreferencesProvider';

const INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY = 'install_prompt_after_google_auth';
const INSTALL_PROMPT_DISMISSED_KEY = 'install_prompt_dismissed';
const OFFLINE_ROUTE_URLS = [
  '/',
  '/subscriptions',
  '/settings',
  '/terms',
  '/privacy',
  '/auth/signin',
  '/auth/signin?callbackUrl=%2Fsubscriptions',
  '/auth/signin?callbackUrl=%2Fsettings',
] as const;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const isIosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia('(display-mode: standalone)').matches || isIosStandalone;
}

function isIosInstallableBrowser() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  return isIosDevice && isSafari;
}

function hasInstallPromptIntent() {
  try {
    return sessionStorage.getItem(INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

export function ServiceWorkerRegistration() {
  const { status } = useSession();
  const { taste } = usePreferences();
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const installPromptEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const hasSeenNetworkStateRef = useRef(false);

  const clearInstallPromptIntent = () => {
    try {
      sessionStorage.removeItem(INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY);
    } catch {}
  };

  const warmOfflineRoutes = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.navigator.onLine) {
      return;
    }

    try {
      const readyRegistration = await navigator.serviceWorker.ready;
      readyRegistration.active?.postMessage({
        type: 'CACHE_URLS',
        payload: {
          urlsToCache: [...OFFLINE_ROUTE_URLS],
        },
      });
    } catch {
      // Warmup failure should not block normal navigation.
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(display-mode: standalone)');
    const syncOnlineState = () => {
      setIsStandalone(isStandaloneDisplayMode());
      const online = window.navigator.onLine;
      setIsOffline(!online);
      if (!hasSeenNetworkStateRef.current) {
        hasSeenNetworkStateRef.current = true;
        return;
      }

      if (online) {
        setReconnected(true);
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          setReconnected(false);
        }, 4000);
      } else {
        setReconnected(false);
      }
    };

    syncOnlineState();
    const syncStandaloneState = () => {
      setIsStandalone(isStandaloneDisplayMode());
    };

    syncStandaloneState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);
    media.addEventListener('change', syncStandaloneState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
      media.removeEventListener('change', syncStandaloneState);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production'
      || typeof window === 'undefined'
      || !('serviceWorker' in navigator)
    ) {
      return;
    }

    let isMounted = true;

    const handleControllerChange = () => {
      window.location.reload();
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        registrationRef.current = registration;
        void warmOfflineRoutes();

        if (registration.waiting && isMounted) {
          setUpdateReady(true);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed'
              && navigator.serviceWorker.controller
              && isMounted
            ) {
              setUpdateReady(true);
            }
          });
        });
      } catch {
        // Registration failure should not block normal app usage.
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    void registerServiceWorker();

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || isOffline) {
      return;
    }

    void warmOfflineRoutes();
  }, [isOffline]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      if (!hasInstallPromptIntent() || isStandalone) {
        installPromptEventRef.current = null;
        return;
      }

      event.preventDefault();
      installPromptEventRef.current = event as BeforeInstallPromptEvent;
      setShowIosInstallHint(false);

      try {
        const dismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === 'true';
        if (status === 'authenticated' && !dismissed) {
          setShowInstallPrompt(true);
        }
      } catch {}
    };

    const handleAppInstalled = () => {
      installPromptEventRef.current = null;
      setShowInstallPrompt(false);
      setShowIosInstallHint(false);
      clearInstallPromptIntent();
      try {
        localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
      } catch {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone, status]);

  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') {
      return;
    }

    try {
      const dismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === 'true';
      const shouldShow = hasInstallPromptIntent() && !dismissed && !isStandalone;
      setShowInstallPrompt(Boolean(installPromptEventRef.current) && shouldShow);
      setShowIosInstallHint(!installPromptEventRef.current && shouldShow && isIosInstallableBrowser());
    } catch {}
  }, [isStandalone, status]);

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    setShowIosInstallHint(false);
    clearInstallPromptIntent();
    try {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
    } catch {}
  };

  const handleInstallPrompt = async () => {
    const promptEvent = installPromptEventRef.current;
    if (!promptEvent) {
      return;
    }

    setShowInstallPrompt(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    clearInstallPromptIntent();

    try {
      if (choice.outcome === 'accepted') {
        localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
      } else {
        localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
      }
    } catch {}

    if (choice.outcome !== 'accepted') {
      installPromptEventRef.current = promptEvent;
    }
  };

  const offlineCopy = taste === 'simple'
    ? 'オフラインです。保存済みの画面はそのまま表示できますが、同期や更新は通信の復旧後に行われます。'
    : 'いまはオフラインやで。保存済みの画面は見られるけど、同期や更新は電波が戻ってからや。';
  const reconnectedCopy = taste === 'simple'
    ? '通信が復旧しました。'
    : '通信が戻ったで。';
  const updateCopy = taste === 'simple'
    ? '新しい版の準備ができました。更新すると最新のオフライン設定に切り替わります。'
    : '新しい版の用意ができとるで。更新したらオフライン対応も最新になるわ。';
  const installCopy = taste === 'simple'
    ? {
        title: 'Google連携の次は、アプリとして追加できます。',
        description: 'ホーム画面に追加しておくと、次からすぐ開けて使いやすくなります。',
        action: 'アプリとして追加',
        dismiss: 'あとで',
      }
    : {
        title: 'Google連携できたし、このままアプリ化もしとこか。',
        description: 'ホーム画面に追加しといたら、次からすぐ開けてかなり楽やで。',
        action: 'ホームに追加する',
        dismiss: 'またあとで',
      };
  const iosInstallCopy = taste === 'simple'
    ? {
        title: 'iPhoneでは共有メニューから追加できます。',
        description: 'Safari の共有ボタンを開いて、「ホーム画面に追加」を選ぶとアプリのように使えます。',
        dismiss: '閉じる',
      }
    : {
        title: 'iPhone は共有メニューからホームに追加できるで。',
        description: 'Safari の共有ボタンを開いて、「ホーム画面に追加」を選んだらアプリみたいに使えるわ。',
        dismiss: '閉じる',
      };
  const showNetworkStatus = isOffline || reconnected || updateReady;

  return (
    <>
      {(showInstallPrompt || showIosInstallHint || showNetworkStatus) && (
        <div className="safe-area-px pointer-events-none fixed inset-x-0 bottom-4 z-50">
          <div className="mx-auto max-w-5xl px-4">
            {!isOffline && showInstallPrompt && (
              <div className="pointer-events-auto mb-3 rounded-3xl border border-brand-200 bg-white p-5 text-gray-900 shadow-2xl dark:border-brand-800/70 dark:bg-gray-900 dark:text-gray-100">
                <p className="text-base font-semibold">{installCopy.title}</p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{installCopy.description}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      void handleInstallPrompt();
                    }}
                    className="rounded-full bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
                  >
                    {installCopy.action}
                  </button>
                  <button
                    type="button"
                    onClick={dismissInstallPrompt}
                    className="rounded-full border border-gray-200 px-4 py-2 font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {installCopy.dismiss}
                  </button>
                </div>
              </div>
            )}

            {!isOffline && !showInstallPrompt && showIosInstallHint && (
              <div className="pointer-events-auto mb-3 rounded-3xl border border-brand-200 bg-white p-5 text-gray-900 shadow-2xl dark:border-brand-800/70 dark:bg-gray-900 dark:text-gray-100">
                <p className="text-base font-semibold">{iosInstallCopy.title}</p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{iosInstallCopy.description}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={dismissInstallPrompt}
                    className="rounded-full border border-gray-200 px-4 py-2 font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {iosInstallCopy.dismiss}
                  </button>
                </div>
              </div>
            )}

            {isOffline && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg shadow-amber-200/60 dark:border-amber-700 dark:bg-amber-900/80 dark:text-amber-100 dark:shadow-none">
                {offlineCopy}
              </div>
            )}

            {!isOffline && !updateReady && reconnected && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg shadow-emerald-200/50 dark:border-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-100 dark:shadow-none">
                {reconnectedCopy}
              </div>
            )}

            {!isOffline && updateReady && (
              <div className="pointer-events-auto rounded-2xl border border-brand-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-xl dark:border-brand-700 dark:bg-gray-900 dark:text-gray-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>{updateCopy}</p>
                  <button
                    type="button"
                    onClick={() => {
                      registrationRef.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
                    }}
                    className="rounded-full bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
                  >
                    更新する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
