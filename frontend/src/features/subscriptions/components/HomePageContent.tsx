'use client';

import { useSession } from 'next-auth/react';
import { AuthenticatedAppShell } from '@/components/layout/AuthenticatedAppShell';
import { GuestAppShell } from '@/components/layout/GuestAppShell';
import { GuestLandingHero } from '@/features/subscriptions/components/GuestLandingHero';
import { SubscriptionDashboard } from '@/features/subscriptions/components/SubscriptionDashboard';

export function HomePageContent() {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  if (status === 'loading' && !user) {
    return <div className="min-h-app bg-gray-50 dark:bg-gray-950" />;
  }

  if (user) {
    return (
      <AuthenticatedAppShell user={user}>
        <SubscriptionDashboard />
      </AuthenticatedAppShell>
    );
  }

  return (
    <GuestAppShell>
      <GuestLandingHero />
      <SubscriptionDashboard isGuest />
    </GuestAppShell>
  );
}
