const DEFAULT_API_FALLBACK_URL = 'http://localhost:8080';

const DEFAULT_CONNECT_SRC_SOURCES = [
  "'self'",
  'https://www.google-analytics.com',
  'https://analyticsengine.googleapis.com',
];

function normalizeServiceBaseUrl(value, fallback = DEFAULT_API_FALLBACK_URL) {
  const candidate = value?.trim();
  if (!candidate) {
    return fallback;
  }

  const withoutTrailingSlash = candidate.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `http://${withoutTrailingSlash}`;
}

function extractOriginFromServiceUrl(value, fallback = DEFAULT_API_FALLBACK_URL) {
  try {
    return new URL(normalizeServiceBaseUrl(value, fallback)).origin;
  } catch {
    return null;
  }
}

function buildConnectSrc({ apiUrl, fallbackApiUrl = DEFAULT_API_FALLBACK_URL } = {}) {
  const sources = new Set(DEFAULT_CONNECT_SRC_SOURCES);
  const apiOrigin = extractOriginFromServiceUrl(apiUrl, fallbackApiUrl);

  if (apiOrigin) {
    sources.add(apiOrigin);
  }

  return Array.from(sources).join(' ');
}

function buildContentSecurityPolicy({ apiUrl, fallbackApiUrl = DEFAULT_API_FALLBACK_URL } = {}) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    `connect-src ${buildConnectSrc({ apiUrl, fallbackApiUrl })}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

module.exports = {
  DEFAULT_API_FALLBACK_URL,
  DEFAULT_CONNECT_SRC_SOURCES,
  normalizeServiceBaseUrl,
  extractOriginFromServiceUrl,
  buildConnectSrc,
  buildContentSecurityPolicy,
};
