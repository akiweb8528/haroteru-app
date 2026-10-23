'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePreferences } from '@/providers/PreferencesProvider';
import { INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY } from '@/features/pwa/lib/constants';

const INSTALL_PROMPT_DISMISSED_KEY = 'install_prompt_dismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

interface NavigatorWithUserAgentData extends Navigator {
  readonly userAgentData?: {
    readonly mobile?: boolean;
  };
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

function isMobileInstallPromptTarget() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithUserAgentData = window.navigator as NavigatorWithUserAgentData;
  if (typeof navigatorWithUserAgentData.userAgentData?.mobile === 'boolean') {
    return navigatorWithUserAgentData.userAgentData.mobile;
  }

  const userAgent = window.navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) {
    return true;
  }

  return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const installPromptEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  const clearInstallPromptIntent = () => {
    try {
      sessionStorage.removeItem(INSTALL_PROMPT_AFTER_GOOGLE_AUTH_KEY);
    } catch {}
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(display-mode: standalone)');
    const syncStandaloneState = () => {
      setIsStandalone(isStandaloneDisplayMode());
    };

    syncStandaloneState();
    media.addEventListener('change', syncStandaloneState);

    return () => {
      media.removeEventListener('change', syncStandaloneState);
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

    const refreshServiceWorker = async () => {
      const registration = registrationRef.current;
      if (!registration || !window.navigator.onLine) {
        return;
      }

      try {
        await registration.update();
      } catch {}
    };

    const handleOnline = () => {
      void refreshServiceWorker();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void refreshServiceWorker();
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (!isMounted) {
          return;
        }

        registrationRef.current = registration;
        void refreshServiceWorker();
      } catch {}
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void registerServiceWorker();

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      if (!hasInstallPromptIntent() || isStandalone || !isMobileInstallPromptTarget()) {
        installPromptEventRef.current = null;
        setShowInstallPrompt(false);
        setShowIosInstallHint(false);
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
      const shouldShow = hasInstallPromptIntent() && !dismissed && !isStandalone && isMobileInstallPromptTarget();
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
        description: 'Safari の共有ボタンを開いて、「ホーム画面に追加」を選んでアプリみたいに使ってや。',
        dismiss: '閉じる',
      };

  return (
    <>
      {(showInstallPrompt || showIosInstallHint) && (
        <div className="safe-area-px pointer-events-none fixed inset-x-0 bottom-4 z-50">
          <div className="mx-auto max-w-5xl px-4">
            {showInstallPrompt && (
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

            {!showInstallPrompt && showIosInstallHint && (
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
          </div>
        </div>
      )}
    </>
  );
}
