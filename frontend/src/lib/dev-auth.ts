type AuthEnvironment = Partial<Record<
  'DEV_AUTH_ENABLED' | 'ENVIRONMENT' | 'NODE_ENV' | 'VERCEL_ENV' | 'NEXT_PUBLIC_APP_ENV', string>>;

export function isDevAuthEnabled(env: AuthEnvironment = process.env): boolean {
  const normalize = (value: string | undefined) => value?.trim().toLowerCase();
  const environment = normalize(env.ENVIRONMENT) || normalize(env.NODE_ENV);
  const production = [env.ENVIRONMENT, env.VERCEL_ENV, env.NEXT_PUBLIC_APP_ENV]
    .some((value) => normalize(value) === 'production');

  const productionBuildWithoutStaging = normalize(env.NODE_ENV) === 'production' && environment !== 'staging';

  return env.DEV_AUTH_ENABLED === 'true' && !production && !productionBuildWithoutStaging
    && ['development', 'test', 'staging'].includes(environment ?? '');
}
