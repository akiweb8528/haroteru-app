import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInPageContent } from '@/components/auth/SignInPageContent';

export const metadata: Metadata = { title: 'サインイン' };
export const dynamic = 'force-static';

export default function SignInPage() {
  const devAuthEnabled = process.env.DEV_AUTH_ENABLED === 'true';

  return (
    <Suspense fallback={<div className="min-h-app bg-gray-50 dark:bg-gray-950" />}>
      <SignInPageContent devAuthEnabled={devAuthEnabled} />
    </Suspense>
  );
}
