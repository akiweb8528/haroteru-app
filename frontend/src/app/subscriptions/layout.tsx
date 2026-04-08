import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { SiteFooter } from '@/components/layout/SiteFooter';

export default async function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) return children;

  return (
    <div className="min-h-app flex flex-col">
      <Navbar user={session.user} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
