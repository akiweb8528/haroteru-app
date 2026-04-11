'use client';

import { useEffect } from 'react';
import {
  findOfflineNavigationAnchor,
  handleOfflinePopstate,
  shouldForceDocumentNavigation,
} from '@/features/pwa/lib/offline-navigation';

export function OfflineNavigationHandler() {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const anchor = findOfflineNavigationAnchor(event.target);
      if (!anchor) {
        return;
      }

      if (!shouldForceDocumentNavigation({
        anchor,
        currentUrl: window.location.href,
        event,
        online: window.navigator.onLine,
      })) {
        return;
      }

      event.preventDefault();
      window.location.assign(anchor.href);
    };

    const handlePopstate = () => {
      handleOfflinePopstate(window.navigator.onLine);
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopstate);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopstate);
    };
  }, []);

  return null;
}
