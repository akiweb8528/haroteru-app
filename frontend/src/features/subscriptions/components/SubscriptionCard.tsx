'use client';

import { useState } from 'react';
import type { TrackedSubscription, UpdateTrackedSubscriptionInput } from '@/types';
import { billingCycleLabels, categoryLabels, formatCurrency, reviewPriorityColors, reviewPriorityLabels, cn } from '@/lib/utils';
import { SubscriptionForm } from '@/features/subscriptions/components/SubscriptionForm';

interface Props {
  subscription: TrackedSubscription;
  onUpdate: (id: string, input: UpdateTrackedSubscriptionInput) => Promise<TrackedSubscription>;
  onDelete: (id: string) => Promise<void>;
}

export function SubscriptionCard({ subscription, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isEditing) {
    return (
      <SubscriptionForm
        initialValues={subscription}
        submitLabel="変更を保存"
        onSubmit={async (input) => {
          await onUpdate(subscription.id, input);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition dark:border-gray-700 dark:bg-gray-900', isDeleting && 'pointer-events-none opacity-50')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{subscription.name}</h3>
            {subscription.locked && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">ロック中</span>}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(subscription.amountYen)} / {billingCycleLabels[subscription.billingCycle]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsEditing(true)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">編集</button>
          <button onClick={async () => { setIsDeleting(true); try { await onDelete(subscription.id); } catch { setIsDeleting(false); } }} className="rounded-lg px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">削除</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{categoryLabels[subscription.category]}</span>
        <span className={cn('rounded-full px-2.5 py-1', reviewPriorityColors[subscription.reviewPriority])}>{reviewPriorityLabels[subscription.reviewPriority]}</span>
        {subscription.billingDay && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">毎月 {subscription.billingDay} 日前後</span>}
      </div>

      {subscription.note && <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{subscription.note}</p>}
    </div>
  );
}
