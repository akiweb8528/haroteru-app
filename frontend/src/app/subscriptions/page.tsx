import type { Metadata } from 'next';
import { SubscriptionsPageContent } from '@/features/subscriptions/components/SubscriptionsPageContent';

export const metadata: Metadata = { title: 'ダッシュボード' };
export const dynamic = 'force-static';

export default function SubscriptionsPage() {
  return <SubscriptionsPageContent />;
}
