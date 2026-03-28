'use client';

import { useState } from 'react';
import type { BillingCycle, CreateTrackedSubscriptionInput, ReviewPriority, SubscriptionCategory, UpdateTrackedSubscriptionInput } from '@/types';
import { cn } from '@/lib/utils';
import { ApiError } from '@/shared/api/http-client';

type Input = CreateTrackedSubscriptionInput & UpdateTrackedSubscriptionInput;

interface Props {
  initialValues?: Partial<Input>;
  onSubmit: (input: Input) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

const categories: { value: SubscriptionCategory; label: string }[] = [
  { value: 'video', label: '動画' },
  { value: 'music', label: '音楽' },
  { value: 'productivity', label: '仕事効率化' },
  { value: 'learning', label: '学習' },
  { value: 'shopping', label: '買い物' },
  { value: 'lifestyle', label: '生活' },
  { value: 'utilities', label: 'インフラ' },
  { value: 'other', label: 'その他' },
];

const priorities: { value: ReviewPriority; label: string }[] = [
  { value: 'low', label: '見直し候補' },
  { value: 'medium', label: 'ふつう' },
  { value: 'high', label: '優先度高め' },
];

export function SubscriptionForm({ initialValues, onSubmit, onCancel, submitLabel = 'サブスクを追加' }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [amountYen, setAmountYen] = useState(String(initialValues?.amountYen ?? ''));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialValues?.billingCycle ?? 'monthly');
  const [category, setCategory] = useState<SubscriptionCategory>(initialValues?.category ?? 'other');
  const [reviewPriority, setReviewPriority] = useState<ReviewPriority>(initialValues?.reviewPriority ?? 'medium');
  const [locked, setLocked] = useState(initialValues?.locked ?? false);
  const [billingDay, setBillingDay] = useState(initialValues?.billingDay ? String(initialValues.billingDay) : '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountYen);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        amountYen: amount,
        billingCycle,
        category,
        reviewPriority,
        locked,
        billingDay: billingDay ? Number(billingDay) : undefined,
        clearBillingDay: !billingDay && initialValues?.billingDay !== undefined,
        note: note.trim(),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('保存でけへんかった。もういっぺん試してや。');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">サービス名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" placeholder="Amazon Prime、Netflix、 など" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">金額</span>
          <input type="number" min={1} value={amountYen} onChange={(e) => setAmountYen(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" placeholder="980" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">支払い頻度</span>
          <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as BillingCycle)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="monthly">月額</option>
            <option value="yearly">年額</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">カテゴリ</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as SubscriptionCategory)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">見直し優先度</span>
          <div className="flex flex-wrap gap-2">
            {priorities.map((item) => (
              <button key={item.value} type="button" onClick={() => setReviewPriority(item.value)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', reviewPriority === item.value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700')}>
                {item.label}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">支払い日</span>
          <input type="number" min={1} max={31} value={billingDay} onChange={(e) => setBillingDay(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" placeholder="15" />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">メモ</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" placeholder="家族共有、年払い、見直し候補など" />
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">キャンセル</button>
        <button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">{isSubmitting ? '保存中...' : submitLabel}</button>
      </div>
    </form>
  );
}
