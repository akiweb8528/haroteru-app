import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findOfflineNavigationAnchor,
  handleOfflinePopstate,
  installOfflineFetchGuard,
  shouldForceDocumentNavigation,
} from '@/features/pwa/lib/offline-navigation';

const currentUrl = 'https://haroteru.test/subscriptions';

function createAnchor(href: string) {
  const anchor = document.createElement('a');
  anchor.href = href;
  return anchor;
}

describe('findOfflineNavigationAnchor', () => {
  it('returns the closest anchor element', () => {
    const anchor = createAnchor('/settings');
    const child = document.createElement('span');
    anchor.appendChild(child);

    expect(findOfflineNavigationAnchor(child)).toBe(anchor);
  });

  it('returns null when the target is outside an anchor', () => {
    const element = document.createElement('div');

    expect(findOfflineNavigationAnchor(element)).toBeNull();
  });
});

describe('installOfflineFetchGuard', () => {
  let cleanup: (() => void) | null = null;
  const originalFetch = window.fetch;

  beforeEach(() => {
    // Restore fetch so each test starts with a known baseline.
    window.fetch = originalFetch;
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    window.fetch = originalFetch;
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  it('passes online fetches through to the original implementation', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('ok'));
    window.fetch = mock;
    cleanup = installOfflineFetchGuard();

    await window.fetch('/api/subscriptions');
    expect(mock).toHaveBeenCalledWith('/api/subscriptions', undefined);
  });

  it('calls window.location.assign for offline RSC navigation requests', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign },
      configurable: true,
    });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });

    cleanup = installOfflineFetchGuard();
    const promise = window.fetch('/settings', { headers: { RSC: '1' } });

    expect(assign).toHaveBeenCalledWith('/settings');
    // The returned promise must never settle.
    let settled = false;
    void promise.then(() => { settled = true; }).catch(() => { settled = true; });
    expect(settled).toBe(false);
  });

  it('does not intercept RSC prefetch requests when offline', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('prefetch'));
    window.fetch = mock;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });

    cleanup = installOfflineFetchGuard();
    await window.fetch('/settings', { headers: { RSC: '1', 'Next-Router-Prefetch': '1' } });

    expect(mock).toHaveBeenCalled();
  });

  it('does not intercept non-RSC fetches when offline', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('api'));
    window.fetch = mock;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });

    cleanup = installOfflineFetchGuard();
    await window.fetch('/api/subscriptions');

    expect(mock).toHaveBeenCalledWith('/api/subscriptions', undefined);
  });

  it('restores the original fetch when the cleanup function is called', () => {
    const savedFetch = window.fetch;
    const uninstall = installOfflineFetchGuard();
    expect(window.fetch).not.toBe(savedFetch);
    uninstall();
    expect(window.fetch).toBe(savedFetch);
  });
});

describe('handleOfflinePopstate', () => {
  it('calls window.location.assign when offline', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: 'https://haroteru.test/settings', assign },
      configurable: true,
    });

    handleOfflinePopstate(false);

    expect(assign).toHaveBeenCalledWith('https://haroteru.test/settings');
  });

  it('does nothing when online', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: 'https://haroteru.test/settings', assign },
      configurable: true,
    });

    handleOfflinePopstate(true);

    expect(assign).not.toHaveBeenCalled();
  });
});

describe('shouldForceDocumentNavigation', () => {
  it('forces same-origin offline navigation for normal left clicks', () => {
    const anchor = createAnchor('https://haroteru.test/settings');

    expect(shouldForceDocumentNavigation({
      anchor,
      currentUrl,
      event: { button: 0 },
      online: false,
    })).toBe(true);
  });

  it('does not force navigation while online', () => {
    const anchor = createAnchor('https://haroteru.test/settings');

    expect(shouldForceDocumentNavigation({
      anchor,
      currentUrl,
      event: { button: 0 },
      online: true,
    })).toBe(false);
  });

  it('does not force modified clicks', () => {
    const anchor = createAnchor('https://haroteru.test/settings');

    expect(shouldForceDocumentNavigation({
      anchor,
      currentUrl,
      event: { button: 0, metaKey: true },
      online: false,
    })).toBe(false);
  });

  it('does not force external navigation', () => {
    const anchor = createAnchor('https://example.com/privacy');

    expect(shouldForceDocumentNavigation({
      anchor,
      currentUrl,
      event: { button: 0 },
      online: false,
    })).toBe(false);
  });

  it('does not force target blank navigation', () => {
    const anchor = createAnchor('https://haroteru.test/privacy');
    anchor.target = '_blank';

    expect(shouldForceDocumentNavigation({
      anchor,
      currentUrl,
      event: { button: 0 },
      online: false,
    })).toBe(false);
  });

  it('does not force hash-only navigation on the current page', () => {
    const anchor = createAnchor('https://haroteru.test/subscriptions#summary');

    expect(shouldForceDocumentNavigation({
      anchor,
      currentUrl,
      event: { button: 0 },
      online: false,
    })).toBe(false);
  });
});
