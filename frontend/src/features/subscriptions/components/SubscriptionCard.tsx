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

interface DeleteSubscriptionDialogProps {
  subscriptionName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteSubscriptionDialog({
  subscriptionName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteSubscriptionDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-subscription-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-1 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </span>
          <h2 id="delete-subscription-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            削除の確認
          </h2>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-gray-100">「{subscriptionName}」</span> を消すで。これ、取り消せへんからな。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            キャンセル
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {isDeleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionCard({ subscription, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setShowConfirm(false);
    setIsDeleting(true);

    try {
      await onDelete(subscription.id);
    } catch {
      setIsDeleting(false);
    }
  };

  const handleToggleLock = async () => {
    setIsTogglingLock(true);

    try {
      await onUpdate(subscription.id, { locked: !subscription.locked });
    } finally {
      setIsTogglingLock(false);
    }
  };

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
    <>
      <div
        className={cn(
          'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition dark:border-gray-700 dark:bg-gray-900',
          isDeleting && 'pointer-events-none opacity-50',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{subscription.name}</h3>
              {subscription.locked && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">ロック中</span>}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(subscription.amountYen)} / {billingCycleLabels[subscription.billingCycle]}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleToggleLock()}
              disabled={isDeleting || isTogglingLock}
              aria-pressed={subscription.locked}
              aria-label={subscription.locked ? 'ロックを解除' : 'ロックする'}
              title={subscription.locked ? 'ロックを解除' : 'ロックする'}
              className={cn(
                'rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-50',
                subscription.locked
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              )}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                {subscription.locked ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0 1 19.5 12.75v6A2.25 2.25 0 0 1 17.25 21h-10.5A2.25 2.25 0 0 1 4.5 18.75v-6A2.25 2.25 0 0 1 6.75 10.5Z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5V6.75a3.75 3.75 0 1 1 7.5 0m-9 3.75h10.5A2.25 2.25 0 0 1 19.5 12.75v6A2.25 2.25 0 0 1 17.25 21h-10.5A2.25 2.25 0 0 1 4.5 18.75v-6A2.25 2.25 0 0 1 6.75 10.5Z" />
                )}
              </svg>
            </button>
            <button onClick={() => setIsEditing(true)} disabled={isDeleting || isTogglingLock} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800">編集</button>
            {!subscription.locked && (
              <button onClick={() => setShowConfirm(true)} disabled={isDeleting || isTogglingLock} className="rounded-lg px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20">削除</button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{categoryLabels[subscription.category]}</span>
          <span className={cn('rounded-full px-2.5 py-1', reviewPriorityColors[subscription.reviewPriority])}>{reviewPriorityLabels[subscription.reviewPriority]}</span>
          {subscription.billingDay && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">毎月 {subscription.billingDay} 日前後</span>}
        </div>

        {subscription.note && <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{subscription.note}</p>}
      </div>

      {showConfirm && (
        <DeleteSubscriptionDialog
          subscriptionName={subscription.name}
          isDeleting={isDeleting}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
