'use client';

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
  const savedDescriptorRef = useRef<PropertyDescriptor | null>(null);

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
      if (savedDescriptorRef.current) {
        Object.defineProperty(navigator, 'onLine', savedDescriptorRef.current);
        savedDescriptorRef.current = null;
      }
      window.dispatchEvent(new Event('online'));
    }

    setSimulateOffline(next);

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
