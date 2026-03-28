import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SessionProvider } from '@/providers/SessionProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { SubscriptionMigrationHandler } from '@/features/subscriptions/components/SubscriptionMigrationHandler';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const siteUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | サブスク払ろてる',
    default: 'サブスク払ろてる',
  },
  description: '登録なしですぐ使える、サブスクの軽量ダッシュボードやで。',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: siteUrl,
    siteName: 'サブスク払ろてる',
    title: 'サブスク払ろてる',
    description: '登録なしですぐ使える、サブスクの軽量ダッシュボードやで。',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'サブスク払ろてる',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'サブスク払ろてる',
    description: '登録なしですぐ使える、サブスクの軽量ダッシュボードやで。',
    images: ['/twitter-image'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="ja" className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} h-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100`}>
        <SessionProvider session={session}>
          <PreferencesProvider>
            <SubscriptionMigrationHandler />
            {children}
          </PreferencesProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
