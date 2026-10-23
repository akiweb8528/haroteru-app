export const DEV_AUTH_NETWORK_ERROR = 'DevAuthNetworkError';

export function resolveDevAuthErrorMessage(errorCode?: string | null) {
  if (errorCode === DEV_AUTH_NETWORK_ERROR) {
    return 'ネットワークエラーで検証用サインインに失敗しました。少し待ってからもう一度お試しください。';
  }

  return '検証用サインインに失敗しました。コードを確認してください。';
}
