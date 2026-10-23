const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { defineConfig } = require('@playwright/test');

const frontendDir = __dirname;
const repoRoot = resolve(frontendDir, '..');

function localUrl(value: string, label: string): URL {
  const parsed = new URL(value);
  const host = parsed.hostname;
  if (host !== 'localhost' && host !== '[::1]' && !/^127\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error(`${label} must point to an isolated local test service`);
  }
  return parsed;
}

const frontendUrl = process.env.PLAYWRIGHT_FRONTEND_URL || 'http://127.0.0.1:3000';
const frontendPort = localUrl(frontendUrl, 'PLAYWRIGHT_FRONTEND_URL').port || '3000';
const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:8080';
const backendPort = localUrl(backendUrl, 'PLAYWRIGHT_BACKEND_URL').port || '8080';
const databaseUrl = process.env.PLAYWRIGHT_E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set PLAYWRIGHT_E2E_DATABASE_URL to an isolated local PostgreSQL test database');
}
localUrl(databaseUrl, 'PLAYWRIGHT_E2E_DATABASE_URL');
const runId = process.env.PLAYWRIGHT_E2E_RUN_ID || randomUUID();
const devAuthCode = process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE || 'playwright-dev-code';
const devAuthEmail = process.env.PLAYWRIGHT_E2E_DEV_AUTH_EMAIL || `playwright-${runId}@haroteru.local`;
const devAuthName = process.env.PLAYWRIGHT_E2E_DEV_AUTH_NAME || 'Playwright E2E';

process.env.PLAYWRIGHT_E2E_RUN_ID = runId;
process.env.PLAYWRIGHT_E2E_DATABASE_URL = databaseUrl;
process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE = devAuthCode;
process.env.PLAYWRIGHT_E2E_DEV_AUTH_EMAIL = devAuthEmail;
process.env.PLAYWRIGHT_E2E_DEV_AUTH_NAME = devAuthName;
process.env.PLAYWRIGHT_FRONTEND_URL = frontendUrl;
process.env.PLAYWRIGHT_BACKEND_URL = backendUrl;

const jwtSecret = process.env.PLAYWRIGHT_JWT_SECRET || 'playwright-jwt-secret';
const nextAuthSecret = process.env.PLAYWRIGHT_NEXTAUTH_SECRET || 'playwright-nextauth-secret';
const googleClientId = 'playwright-google-client-id';
const googleClientSecret = 'playwright-google-client-secret';

process.env.PLAYWRIGHT_JWT_SECRET = jwtSecret;
process.env.PLAYWRIGHT_NEXTAUTH_SECRET = nextAuthSecret;

module.exports = defineConfig({
  testDir: resolve(frontendDir, 'e2e'),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI
    ? [['line'], ['github']]
    : [['list']],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: resolve(repoRoot, 'backend'),
      url: `${backendUrl}/health/ready`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        PORT: backendPort,
        ENVIRONMENT: 'development',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        GOOGLE_CLIENT_ID: googleClientId,
        GOOGLE_CLIENT_SECRET: googleClientSecret,
        FRONTEND_URL: frontendUrl,
        DEV_AUTH_ENABLED: 'true',
        DEV_AUTH_CODE: devAuthCode,
        DEV_AUTH_EMAIL: devAuthEmail,
        DEV_AUTH_NAME: devAuthName,
      },
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${frontendPort}`,
      cwd: frontendDir,
      url: frontendUrl,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXTAUTH_URL: frontendUrl,
        NEXTAUTH_SECRET: nextAuthSecret,
        GOOGLE_CLIENT_ID: googleClientId,
        GOOGLE_CLIENT_SECRET: googleClientSecret,
        NEXT_PUBLIC_API_URL: backendUrl,
        BACKEND_URL: backendUrl,
        DEV_AUTH_ENABLED: 'true',
        DEV_AUTH_CODE: devAuthCode,
        DEV_AUTH_EMAIL: devAuthEmail,
        DEV_AUTH_NAME: devAuthName,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
