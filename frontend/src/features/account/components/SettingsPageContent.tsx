'use client';

import { useSession } from 'next-auth/react';
import { AuthenticatedAppShell } from '@/components/layout/AuthenticatedAppShell';
import { GuestAppShell } from '@/components/layout/GuestAppShell';
import { OfflineAwareLink } from '@/components/navigation/OfflineAwareLink';
import { SettingsView } from '@/features/account/components/SettingsView';

export function SettingsPageContent() {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  if (status === 'loading' && !user) {
    return <div className="min-h-app bg-gray-50 dark:bg-gray-950" />;
  }

  if (user) {
    return (
      <AuthenticatedAppShell user={user}>
        <SettingsView />
      </AuthenticatedAppShell>
    );
  }

  return (
    <GuestAppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">設定</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            設定は Google で同期しているときに利用できます。オフラインで開き直す場合も、先に一度サインインしておいてください。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <OfflineAwareLink
              href="/auth/signin?callbackUrl=%2Fsettings"
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Googleで同期を有効にする
            </OfflineAwareLink>
            <OfflineAwareLink
              href="/"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              ダッシュボードへ戻る
            </OfflineAwareLink>
          </div>
        </div>
      </div>
    </GuestAppShell>
  );
}
