const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { defineConfig } = require('@playwright/test');

const frontendDir = __dirname;
const repoRoot = resolve(frontendDir, '..');

const frontendUrl = process.env.PLAYWRIGHT_FRONTEND_URL || 'http://127.0.0.1:3000';
const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:8080';
const postgresUser = process.env.POSTGRES_USER || 'haroteru_user';
const postgresPassword = process.env.POSTGRES_PASSWORD || 'haroteru_password';
const postgresDb = process.env.POSTGRES_DB || 'haroteru_db';
const postgresHost = process.env.POSTGRES_HOST || '127.0.0.1';
const postgresPort = process.env.POSTGRES_PORT || '5432';
const postgresSslMode = process.env.POSTGRES_SSLMODE || 'disable';

const localDatabaseUrl = `postgres://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDb}?sslmode=${postgresSslMode}`;
const databaseUrl = process.env.PLAYWRIGHT_E2E_DATABASE_URL || process.env.DATABASE_URL || localDatabaseUrl;
const runId = process.env.PLAYWRIGHT_E2E_RUN_ID || randomUUID();
const devAuthCode = process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE || 'playwright-dev-code';
const devAuthEmail = process.env.PLAYWRIGHT_E2E_DEV_AUTH_EMAIL || `playwright-${runId}@haroteru.local`;
const devAuthName = process.env.PLAYWRIGHT_E2E_DEV_AUTH_NAME || 'Playwright E2E';
const shouldStartLocalPostgres = (() => {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
})();

process.env.PLAYWRIGHT_E2E_RUN_ID = runId;
process.env.PLAYWRIGHT_E2E_DATABASE_URL = databaseUrl;
process.env.PLAYWRIGHT_E2E_DEV_AUTH_CODE = devAuthCode;
process.env.PLAYWRIGHT_E2E_DEV_AUTH_EMAIL = devAuthEmail;
process.env.PLAYWRIGHT_E2E_DEV_AUTH_NAME = devAuthName;
process.env.PLAYWRIGHT_FRONTEND_URL = frontendUrl;
process.env.PLAYWRIGHT_BACKEND_URL = backendUrl;

const jwtSecret = process.env.PLAYWRIGHT_JWT_SECRET || process.env.JWT_SECRET || 'playwright-jwt-secret';
const nextAuthSecret = process.env.PLAYWRIGHT_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET || 'playwright-nextauth-secret';
const googleClientId = process.env.GOOGLE_CLIENT_ID || 'playwright-google-client-id';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'playwright-google-client-secret';

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
      command: shouldStartLocalPostgres
        ? `bash -lc 'set -euo pipefail; docker compose up -d postgres; until docker compose exec -T postgres pg_isready -U ${postgresUser} -d ${postgresDb}; do sleep 2; done; cd backend && go run ./cmd/server'`
        : 'bash -lc "cd backend && go run ./cmd/server"',
      cwd: repoRoot,
      url: `${backendUrl}/health/ready`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        PORT: '8080',
        ENVIRONMENT: 'development',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        GOOGLE_CLIENT_ID: googleClientId,
        GOOGLE_CLIENT_SECRET: googleClientSecret,
        FRONTEND_URL: frontendUrl,
        POSTGRES_USER: postgresUser,
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_DB: postgresDb,
        DEV_AUTH_ENABLED: 'true',
        DEV_AUTH_CODE: devAuthCode,
        DEV_AUTH_EMAIL: devAuthEmail,
        DEV_AUTH_NAME: devAuthName,
      },
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
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
