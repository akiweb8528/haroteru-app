'use client';

import { useEffect } from 'react';
import {
  findOfflineNavigationAnchor,
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

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}
