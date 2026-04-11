const FALLBACK_BASE_URL = 'http://localhost';

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
