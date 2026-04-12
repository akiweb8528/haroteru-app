import type { Metadata } from 'next';
import { SettingsPageContent } from '@/features/account/components/SettingsPageContent';

export const metadata: Metadata = { title: '設定' };
export const dynamic = 'force-static';

export default function SettingsPage() {
  return <SettingsPageContent />;
}
