'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { shouldForceDocumentNavigation } from '@/features/pwa/lib/offline-navigation';

type OfflineAwareLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
};

export function OfflineAwareLink({ href, onClick, target, ...props }: OfflineAwareLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (typeof window === 'undefined') {
      return;
    }

    if (!shouldForceDocumentNavigation({
      anchor: event.currentTarget,
      currentUrl: window.location.href,
      event,
      online: window.navigator.onLine,
    })) {
      return;
    }

    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  };

  return <Link href={href} onClick={handleClick} target={target} {...props} />;
}
