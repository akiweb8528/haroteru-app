import { describe, expect, it } from 'vitest';
import { isDevAuthEnabled } from './dev-auth';

describe('検証用サインインの提供条件', () => {
  it.each(['development', 'test', 'staging'])('明示した %s 環境でだけ有効にできる', (ENVIRONMENT) => {
    expect(isDevAuthEnabled({ DEV_AUTH_ENABLED: 'true', ENVIRONMENT })).toBe(true);
  });
  it.each([{}, { ENVIRONMENT: 'prod' }, { NODE_ENV: 'production' }, { ENVIRONMENT: ' Production ' }])('不明・本番モードを無効にする: %j', (env) => {
    expect(isDevAuthEnabled({ ...env, DEV_AUTH_ENABLED: 'true' })).toBe(false);
  });
  it('有効化フラグがなければ staging でも無効にする', () => {
    expect(isDevAuthEnabled({ ENVIRONMENT: 'staging' })).toBe(false);
  });
});
