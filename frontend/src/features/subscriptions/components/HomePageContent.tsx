'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { GuestAppShell } from '@/components/layout/GuestAppShell';
import { GuestLandingHero } from '@/features/subscriptions/components/GuestLandingHero';
import { SubscriptionDashboard } from '@/features/subscriptions/components/SubscriptionDashboard';

export function HomePageContent() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  useEffect(() => {
    if (!user) {
      return;
    }

    router.replace('/subscriptions');
  }, [router, user]);

  if (status === 'loading' && !user) {
    return <div className="min-h-app bg-gray-50 dark:bg-gray-950" />;
  }

  if (user) {
    return <div className="min-h-app bg-gray-50 dark:bg-gray-950" />;
  }

  return (
    <GuestAppShell>
      <GuestLandingHero />
      <SubscriptionDashboard isGuest />
    </GuestAppShell>
  );
}
