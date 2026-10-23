'use client';

import { useSession } from 'next-auth/react';
import { AuthenticatedAppShell } from '@/components/layout/AuthenticatedAppShell';
import { GuestAppShell } from '@/components/layout/GuestAppShell';
import { SubscriptionDashboard } from '@/features/subscriptions/components/SubscriptionDashboard';

export function SubscriptionsPageContent() {
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
      <SubscriptionDashboard isGuest />
    </GuestAppShell>
  );
}
