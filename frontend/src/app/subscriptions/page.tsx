import type { Metadata } from 'next';
import { SubscriptionsPageContent } from '@/features/subscriptions/components/SubscriptionsPageContent';

export const metadata: Metadata = { title: 'ダッシュボード' };

export default function SubscriptionsPage() {
  return <SubscriptionsPageContent />;
}
