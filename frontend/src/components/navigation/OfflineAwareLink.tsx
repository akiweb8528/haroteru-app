'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, MouseEvent } from 'react';

type OfflineAwareLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
};

function shouldHandleOfflineNavigation(event: MouseEvent<HTMLAnchorElement>, target?: string) {
  return !(
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || Boolean(target && target !== '_self')
  );
}

export function OfflineAwareLink({ href, onClick, target, ...props }: OfflineAwareLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      typeof window === 'undefined'
      || window.navigator.onLine
      || !shouldHandleOfflineNavigation(event, target)
    ) {
      return;
    }

    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  };

  return <Link href={href} onClick={handleClick} target={target} {...props} />;
}
