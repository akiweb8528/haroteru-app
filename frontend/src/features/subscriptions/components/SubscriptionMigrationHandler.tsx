'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { mutate } from 'swr';
import type { TrackedSubscription } from '@/types';
import { subscriptionApi } from '@/features/subscriptions/api/subscription-client';
import { clearLocalSubscriptions, readLocalSubscriptions } from '@/features/subscriptions/lib/local-storage';

export function SubscriptionMigrationHandler() {
  const { status } = useSession();
  const migrated = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || migrated.current) return;
    migrated.current = true;

    let subscriptions: TrackedSubscription[] = readLocalSubscriptions();

    if (!subscriptions.length) {
      clearLocalSubscriptions();
      return;
    }

    const sorted = [...subscriptions].sort((a, b) => a.position - b.position);

    (async () => {
      for (const item of sorted) {
        try {
          await subscriptionApi.create({
            name: item.name,
            amountYen: item.amountYen,
            billingCycle: item.billingCycle,
            category: item.category,
            reviewPriority: item.reviewPriority,
            locked: item.locked,
            billingDay: item.billingDay,
            note: item.note,
          });
        } catch {}
      }
      clearLocalSubscriptions();
      await mutate((key) => Array.isArray(key) && key[0] === 'subscriptions');
      await mutate('users/me');
    })();
  }, [status]);

  return null;
}
