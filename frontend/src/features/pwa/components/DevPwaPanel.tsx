'use client';

/**
 * Development-only panel for simulating offline/online PWA behaviour.
 *
 * Returns null (no-op) in production so the import is safely tree-shaken.
 *
 * ## How it works
 *
 * Offline simulation does NOT require a service worker registration:
 *   1. `navigator.onLine` is patched via Object.defineProperty so that
 *      `window.navigator.onLine` returns false while simulation is active.
 *   2. The native `offline` / `online` Window events are dispatched so that
 *      any listeners (e.g. ServiceWorkerRegistration banners) react normally.
 *
 * The dev service worker (/sw-dev.js) is registered separately in the
 * background to additionally intercept fetches and serve cached pages.
 * It is shown as "SW: active" once ready, but the toggle always works
 * regardless of whether the SW has registered successfully.
 */

import { useEffect, useRef, useState } from 'react';

const DEV_SW_PATH = '/sw-dev.js';

type SwStatus = 'registering' | 'active' | 'unavailable';

export function DevPwaPanel() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <DevPwaPanelInner />;
}

function DevPwaPanelInner() {
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [swStatus, setSwStatus] = useState<SwStatus>('registering');
  // Holds the original descriptor so we can restore navigator.onLine on unmount.
  const savedDescriptorRef = useRef<PropertyDescriptor | null>(null);

  // Register the dev SW in the background. The toggle works even if this fails.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus('unavailable');
      return;
    }

    navigator.serviceWorker
      .register(DEV_SW_PATH)
      .then(() => setSwStatus('active'))
      .catch((err) => {
        console.warn('[DevPwaPanel] sw-dev.js registration failed:', err);
        setSwStatus('unavailable');
      });

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SIMULATE_OFFLINE_CHANGED') {
        setSimulateOffline(Boolean(event.data.payload?.offline));
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  // Restore navigator.onLine when the component unmounts.
  useEffect(() => {
    return () => {
      if (savedDescriptorRef.current) {
        Object.defineProperty(navigator, 'onLine', savedDescriptorRef.current);
        savedDescriptorRef.current = null;
      }
    };
  }, []);

  const toggle = () => {
    const next = !simulateOffline;

    if (next) {
      // Save and override navigator.onLine so listeners read `false`.
      const proto = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
      const own = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      savedDescriptorRef.current = own ?? proto ?? null;
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        enumerable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event('offline'));
    } else {
      // Restore the original descriptor and fire online.
      if (savedDescriptorRef.current) {
        Object.defineProperty(navigator, 'onLine', savedDescriptorRef.current);
        savedDescriptorRef.current = null;
      }
      window.dispatchEvent(new Event('online'));
    }

    setSimulateOffline(next);

    // Optionally propagate to the SW for actual fetch interception.
    if (swStatus === 'active') {
      navigator.serviceWorker.ready
        .then((reg) =>
          reg.active?.postMessage({
            type: 'SET_SIMULATE_OFFLINE',
            payload: { offline: next },
          }),
        )
        .catch(() => {});
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#111827',
        color: '#f9fafb',
        borderRadius: 12,
        padding: '6px 12px',
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        userSelect: 'none',
        opacity: 0.9,
      }}
    >
      <span style={{ color: '#9ca3af' }}>PWA</span>
      <button
        type="button"
        onClick={toggle}
        title={simulateOffline ? 'オフライン模擬中 — クリックでオンラインに戻す' : 'クリックでオフライン模擬を開始'}
        style={{
          background: simulateOffline ? '#ef4444' : '#22c55e',
          border: 'none',
          borderRadius: 8,
          padding: '3px 10px',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 11,
          fontFamily: 'inherit',
          lineHeight: 1.6,
          letterSpacing: '0.02em',
        }}
      >
        {simulateOffline ? 'OFFLINE' : 'ONLINE'}
      </button>
      <span
        title={
          swStatus === 'active' ? 'dev SW がアクティブです。フェッチもインターセプトされます。'
          : swStatus === 'registering' ? 'dev SW を登録中です…'
          : 'dev SW の登録に失敗しました。オフライン UI のテストは引き続き可能です。'
        }
        style={{
          color:
            swStatus === 'active' ? '#22c55e'
            : swStatus === 'registering' ? '#9ca3af'
            : '#f59e0b',
          fontSize: 10,
        }}
      >
        SW:{swStatus === 'active' ? '●' : swStatus === 'registering' ? '○' : '△'}
      </span>
    </div>
  );
}
