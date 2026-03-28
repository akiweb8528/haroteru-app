import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SignInButton } from '@/components/auth/SignInButton';

export const metadata: Metadata = { title: 'サインイン' };

interface Props {
  searchParams: { callbackUrl?: string; error?: string };
}

const errorMessages: Record<string, string> = {
  OAuthSignin: 'Googleサインインがでけへんかった。もういっぺん試してや。',
  OAuthCallback: 'Googleサインインが途中で止まってもた。もういっぺん試してや。',
  OAuthAccountNotLinked: 'そのメアドはもう別のアカウントにくっついとるで。',
  BackendAuthError: 'サーバーにつながらへんかった。ちょい待ってからもういっぺん試してや。',
  SessionExpired: 'セッションが切れてもた。もういっぺんサインインしてや。',
  default: 'えらいこっちゃ、なんかこけた。もういっぺん試してや。',
};

export default async function SignInPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (session && !session.error) redirect(searchParams.callbackUrl || '/subscriptions');

  const errorMessage = searchParams.error
    ? (errorMessages[searchParams.error] ?? errorMessages.default)
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
              ¥
            </div>
          </div>

          <h1 className="mb-1 text-center text-2xl font-bold text-gray-900 dark:text-white">
            同期を有効にする
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
            サブスク払ろてるのデータをGoogleアカウントに保存するで
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <SignInButton callbackUrl={searchParams.callbackUrl} />
        </div>
      </div>
    </main>
  );
}
