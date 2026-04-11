import { describe, expect, it } from 'vitest';
import {
  findOfflineNavigationAnchor,
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
