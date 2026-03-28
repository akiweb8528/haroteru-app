'use client';

import type { TrackedSubscription, UpdateTrackedSubscriptionInput } from '@/types';
import { SubscriptionCard } from '@/features/subscriptions/components/SubscriptionCard';

interface Props {
  subscriptions: TrackedSubscription[];
  isLoading: boolean;
  error: Error | null | undefined;
  onUpdate: (id: string, input: UpdateTrackedSubscriptionInput) => Promise<TrackedSubscription>;
  onDelete: (id: string) => Promise<void>;
}

export function SubscriptionList({ subscriptions, isLoading, error, onUpdate, onDelete }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">一覧を読み込めへんかった。</div>;
  }

  if (subscriptions.length === 0) {
    return <div className="rounded-2xl border-2 border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">まだサブスクがあらへん。まず1件登録して、今の支出を見える化しようや。</div>;
  }

  return <div className="space-y-3">{subscriptions.map((item) => <SubscriptionCard key={item.id} subscription={item} onUpdate={onUpdate} onDelete={onDelete} />)}</div>;
}
