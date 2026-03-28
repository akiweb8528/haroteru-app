import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { SignInButton } from '@/components/auth/SignInButton';
import { SubscriptionDashboard } from '@/features/subscriptions/components/SubscriptionDashboard';

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/subscriptions');
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">¥</div>
            サブスク払ろてる
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 sm:flex dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              ローカル保存
            </div>
            <SignInButton compact />
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <p className="text-sm font-semibold text-brand-600">サブスクって、払いたいから払っている。</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">でも、いくら払ろてるかは、たまに見返したい。</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-gray-600 dark:text-gray-300">サブスク払ろてるは、登録なしですぐ使える軽量ダッシュボードです。必要なサブスクも、なんとなく続いているサブスクも、まとめて把握して、見直しのきっかけを作れます。</p>
          </div>
        </section>
        <SubscriptionDashboard isGuest />
      </main>

      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between dark:text-gray-400">
          <p>ご利用にあたっては利用規約とプライバシーポリシーをご確認ください。</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="transition hover:text-gray-700 dark:hover:text-gray-200">利用規約</Link>
            <Link href="/privacy" className="transition hover:text-gray-700 dark:hover:text-gray-200">プライバシーポリシー</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
