import { Navbar } from '@/components/layout/Navbar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import type { Session } from 'next-auth';

interface Props {
  children: React.ReactNode;
  user: Session['user'];
}

export function AuthenticatedAppShell({ children, user }: Props) {
  return (
    <div className="min-h-app flex flex-col">
      <Navbar user={user} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
