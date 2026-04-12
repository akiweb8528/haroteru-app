const FALLBACK_BASE_URL = 'http://localhost';

/**
 * Patches window.fetch to convert RSC navigation fetches into full-page loads
 * when the device is offline.
 *
 * Next.js App Router performs client-side navigation by issuing same-origin
 * fetch requests carrying the "RSC: 1" header.  These are not navigate-mode
 * requests so the service worker precache does not intercept them, and they
 * fail with a network error when offline, leaving the user stuck on an
 * unrecoverable error screen.
 *
 * This guard intercepts those requests before they reach the network, converts
 * them to full-page navigations via window.location.assign(), and returns a
 * promise that never settles (the page load is already underway).  The service
 * worker then serves the correct HTML from its precache — giving reliable
 * offline navigation for every route that has been precached.
 *
 * Prefetch requests (Next-Router-Prefetch: 1) are intentionally excluded:
 * they do not cause visible navigation and failing silently is fine.
 *
 * Returns a cleanup function that restores the original window.fetch.
 */
export function installOfflineFetchGuard(): () => void {
  // Keep a reference to the original for both calling and restoring.
  // We bind a separate copy for calling so we never pass context = undefined,
  // but restore the un-bound original so identity checks (e.g. in tests) work.
  const savedFetch = window.fetch;
  const callFetch = savedFetch.bind(window);

  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let isNavigationRsc = false;
    try {
      const headers = new Headers(init?.headers);
      isNavigationRsc =
        headers.get('RSC') === '1' &&
        headers.get('Next-Router-Prefetch') !== '1';
    } catch {
      // Malformed headers — treat as non-RSC.
    }

    if (!isNavigationRsc) {
      return callFetch(input, init);
    }

    const url = input instanceof Request ? input.url : String(input);

    // Fast path: browser already knows we're offline — skip the round-trip.
    if (!navigator.onLine) {
      window.location.assign(url);
      return new Promise<Response>(() => {});
    }

    // Online path: let the request through (SW will NetworkFirst + cache it).
    // If the network call fails for any reason (navigator.onLine can be stale
    // when airplane mode is toggled), catch the error here rather than letting
    // Next.js Router receive a rejection and render its error UI.
    return callFetch(input, init).catch(() => {
      window.location.assign(url);
      return new Promise<Response>(() => {});
    });
  };

  return () => {
    window.fetch = savedFetch;
  };
}

type OfflineNavigationEventLike = {
  altKey?: boolean;
  button?: number;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

function resolveCurrentUrl(currentUrl?: string): URL {
  if (currentUrl) {
    return new URL(currentUrl, FALLBACK_BASE_URL);
  }

  if (typeof window !== 'undefined') {
    return new URL(window.location.href);
  }

  return new URL(FALLBACK_BASE_URL);
}

export function findOfflineNavigationAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Node)) {
    return null;
  }

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) {
    return null;
  }

  const anchor = element.closest('a[href]');
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function shouldForceDocumentNavigation(params: {
  anchor: HTMLAnchorElement;
  currentUrl?: string;
  event: OfflineNavigationEventLike;
  online: boolean;
}): boolean {
  const { anchor, currentUrl, event, online } = params;

  if (
    online
    || event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return false;
  }

  if (anchor.dataset.offlineNavigation === 'ignore' || anchor.hasAttribute('download')) {
    return false;
  }

  const target = anchor.target?.trim();
  if (target && target !== '_self') {
    return false;
  }

  let destination: URL;
  try {
    destination = new URL(anchor.href, resolveCurrentUrl(currentUrl));
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(destination.protocol)) {
    return false;
  }

  const current = resolveCurrentUrl(currentUrl);
  if (destination.origin !== current.origin) {
    return false;
  }

  if (
    destination.pathname === current.pathname
    && destination.search === current.search
    && destination.hash
  ) {
    return false;
  }

  return true;
}

/**
 * Handles a popstate event (browser back / forward) while offline.
 *
 * When the user presses back or forward, Next.js handles the event and tries to
 * fetch an RSC payload for the destination URL.  If that payload is not in the
 * SW cache the navigation silently fails.  By converting the event to a full
 * document navigation here, the SW precache can serve the cached HTML page.
 *
 * Only fires when the navigator is offline to avoid forcing a full page reload
 * during normal online usage.
 */
export function handleOfflinePopstate(online: boolean): void {
  if (online) {
    return;
  }

  // The URL has already been updated by the browser before popstate fires, so
  // window.location.href points to the destination page.
  window.location.assign(window.location.href);
}
