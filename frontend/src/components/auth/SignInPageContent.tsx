'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DEV_AUTH_NETWORK_ERROR, resolveDevAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeCallbackUrl } from '@/lib/utils';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { OfflineAwareLink } from '@/components/navigation/OfflineAwareLink';
import { SignInButton } from '@/components/auth/SignInButton';
import { DevSignInForm } from '@/components/auth/DevSignInForm';

const errorMessages: Record<string, string> = {
  OAuthSignin: 'Googleサインインがでけへんかった。もういっぺん試してや。',
  OAuthCallback: 'Googleサインインが途中で止まってもた。もういっぺん試してや。',
  OAuthAccountNotLinked: 'そのメアドはもう別のアカウントにくっついとるで。',
  BackendAuthError: 'サーバーにつながらへんかった。ちょい待ってからもういっぺん試してや。',
  CredentialsSignin: resolveDevAuthErrorMessage('CredentialsSignin'),
  [DEV_AUTH_NETWORK_ERROR]: resolveDevAuthErrorMessage(DEV_AUTH_NETWORK_ERROR),
  SessionExpired: 'セッションが切れてもた。もういっぺんサインインしてや。',
  default: 'えらいこっちゃ、なんかこけた。もういっぺん試してや。',
};

interface Props {
  devAuthEnabled: boolean;
}

export function SignInPageContent({ devAuthEnabled }: Props) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl') ?? undefined);
  const errorCode = searchParams.get('error') ?? undefined;
  const errorMessage = errorCode
    ? (errorMessages[errorCode] ?? errorMessages.default)
    : null;

  useEffect(() => {
    if (status !== 'authenticated' || session?.error) {
      return;
    }

    window.location.replace(callbackUrl);
  }, [callbackUrl, session?.error, status]);

  if (status === 'authenticated' && !session?.error) {
    return <div className="min-h-app bg-gray-50 dark:bg-gray-950" />;
  }

  return (
    <main className="min-h-app safe-area-pb safe-area-px flex items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 flex justify-center">
            <BrandLogo size={56} />
          </div>

          <h1 className="mb-1 text-center text-2xl font-bold text-gray-900 dark:text-white">
            同期を有効にする
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
            サブスク払ろてるのデータをGoogleアカウントに保存するで
          </p>
          <div className="mb-6 text-center">
            <OfflineAwareLink
              href="/"
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              ホーム画面に戻る
            </OfflineAwareLink>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <SignInButton callbackUrl={callbackUrl} />

          {devAuthEnabled && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-600">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                検証用
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              </div>
              <DevSignInForm callbackUrl={callbackUrl} />
            </>
          )}

          <p className="mt-6 text-center text-xs leading-6 text-gray-500 dark:text-gray-400">
            続行すると
            {' '}
            <OfflineAwareLink href="/terms" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 transition hover:text-gray-700 dark:hover:text-gray-200">
              利用規約
            </OfflineAwareLink>
            {' '}
            と
            {' '}
            <OfflineAwareLink href="/privacy" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 transition hover:text-gray-700 dark:hover:text-gray-200">
              プライバシーポリシー
            </OfflineAwareLink>
            {' '}
            に同意したものとみなします。
          </p>
        </div>
      </div>
    </main>
  );
}
