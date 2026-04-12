import { describe, expect, it } from 'vitest';
import {
  buildConnectSrc,
  buildContentSecurityPolicy,
  extractOriginFromServiceUrl,
} from './security-headers.js';

describe('extractOriginFromServiceUrl', () => {
  it('keeps the origin of an absolute https URL', () => {
    expect(extractOriginFromServiceUrl('https://haroteru-backend-staging.onrender.com/api')).toBe('https://haroteru-backend-staging.onrender.com');
  });

  it('adds http to host:port values before extracting the origin', () => {
    expect(extractOriginFromServiceUrl('haroteru-api:10000')).toBe('http://haroteru-api:10000');
  });
});

describe('buildConnectSrc', () => {
  it('includes the configured API origin', () => {
    expect(buildConnectSrc({
      apiUrl: 'https://haroteru-backend-staging.onrender.com',
    })).toContain('https://haroteru-backend-staging.onrender.com');
  });

  it('falls back to localhost when no API URL is configured', () => {
    expect(buildConnectSrc()).toContain('http://localhost:8080');
  });

  it('does not duplicate sources when the API origin is already allowed', () => {
    const connectSrc = buildConnectSrc({
      apiUrl: 'https://www.google-analytics.com',
    });
    expect(connectSrc.match(/https:\/\/www\.google-analytics\.com/g)).toHaveLength(1);
  });
});

describe('buildContentSecurityPolicy', () => {
  it('embeds connect-src with the configured backend origin', () => {
    const csp = buildContentSecurityPolicy({
      apiUrl: 'https://haroteru-backend-staging.onrender.com',
    });

    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('https://haroteru-backend-staging.onrender.com');
  });
});
