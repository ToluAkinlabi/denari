import type { Metadata } from 'next';
import { Providers } from './providers';
import { Navigation } from '@/components/navigation';
import { DevSwGuard } from '@/components/dev-sw-guard';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ledge - Personal Financial Command Center',
  description: 'Track cash, spending, savings, and wealth growth',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ledge',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="bg-app-atmosphere text-gray-900 dark:text-gray-50">
        <Providers>
          <DevSwGuard />
          <div className="min-h-screen flex flex-col">
            <main className="flex-1 pb-20">
              {children}
            </main>
            <Navigation />
          </div>
        </Providers>
      </body>
    </html>
  );
}
