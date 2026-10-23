import { Suspense } from 'react';
import type { Metadata } from 'next';
import { isDevAuthEnabled } from '@/lib/dev-auth';
import { SignInPageContent } from '@/components/auth/SignInPageContent';

export const metadata: Metadata = { title: 'サインイン' };
export const dynamic = 'force-static';

export default function SignInPage() {
  const devAuthEnabled = isDevAuthEnabled();

  return (
    <Suspense fallback={<div className="min-h-app bg-gray-50 dark:bg-gray-950" />}>
      <SignInPageContent devAuthEnabled={devAuthEnabled} />
    </Suspense>
  );
}
