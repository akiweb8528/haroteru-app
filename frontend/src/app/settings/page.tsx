import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { SettingsView } from '@/features/account/components/SettingsView';

export const metadata: Metadata = { title: '設定' };

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/signin');

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} />
      <main className="flex-1">
        <SettingsView />
      </main>
    </div>
  );
}
