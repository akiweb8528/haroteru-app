'use client';

import { useEffect, useRef, useState } from 'react';
import { usePreferences } from '@/providers/PreferencesProvider';

export function ServiceWorkerRegistration() {
  const { taste } = usePreferences();
  const [isOffline, setIsOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const hasSeenNetworkStateRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
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
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
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

  const offlineCopy = taste === 'simple'
    ? 'オフラインです。保存済みの画面はそのまま表示できますが、同期や更新は通信の復旧後に行われます。'
    : 'いまはオフラインやで。保存済みの画面は見られるけど、同期や更新は電波が戻ってからや。';
  const reconnectedCopy = taste === 'simple'
    ? '通信が復旧しました。必要なら最新情報を再読み込みできます。'
    : '通信が戻ったで。必要やったら最新の内容に読み込み直してな。';
  const updateCopy = taste === 'simple'
    ? '新しい版の準備ができました。更新すると最新のオフライン設定に切り替わります。'
    : '新しい版の用意ができとるで。更新したらオフライン対応も最新になるわ。';

  return (
    <>
      {(isOffline || reconnected || updateReady) && (
        <div className="safe-area-px pointer-events-none fixed inset-x-0 bottom-4 z-50">
          <div className="mx-auto max-w-5xl px-4">
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
