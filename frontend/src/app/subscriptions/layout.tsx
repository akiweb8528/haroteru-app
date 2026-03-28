import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';

export default async function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) return children;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} />
      <main className="flex-1">{children}</main>
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
