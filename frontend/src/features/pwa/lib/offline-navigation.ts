const FALLBACK_BASE_URL = 'http://localhost';

export function installOfflineFetchGuard(): () => void {
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
    } catch {}

    if (!isNavigationRsc) {
      return callFetch(input, init);
    }

    const url = input instanceof Request ? input.url : String(input);

    if (!navigator.onLine) {
      window.location.assign(url);
      return new Promise<Response>(() => {});
    }

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
export function handleOfflinePopstate(online: boolean): void {
  if (online) {
    return;
  }

  window.location.assign(window.location.href);
}
