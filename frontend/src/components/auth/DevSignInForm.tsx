'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { DEV_AUTH_NETWORK_ERROR, resolveDevAuthErrorMessage } from '@/lib/auth-errors';

interface Props {
  callbackUrl?: string;
}

export function DevSignInForm({ callbackUrl = '/subscriptions' }: Props) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verificationCode.trim()) {
      setError('検証コードを入れてください。');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await signIn('dev', {
        callbackUrl,
        redirect: false,
        verificationCode: verificationCode.trim(),
      });

      if (result?.error || !result?.url) {
        setError(resolveDevAuthErrorMessage(result?.error));
        setIsSubmitting(false);
        return;
      }

      window.location.href = result.url;
    } catch {
      setError(resolveDevAuthErrorMessage(DEV_AUTH_NETWORK_ERROR));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
          DEV ONLY
        </span>
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">検証用サインイン</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-amber-800/80 dark:text-amber-200/80">
        Google 連携の切り分けや staging 確認用です。検証コードでそのままサインインできます。
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200">検証コード</span>
        <input
          type="password"
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value)}
          className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-amber-900/40 dark:bg-gray-900 dark:text-gray-100"
          placeholder="検証コード"
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {isSubmitting ? 'サインイン中...' : '検証用でサインイン'}
      </button>
    </form>
  );
}
