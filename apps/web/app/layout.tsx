import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query';
import Script from 'next/script';

export const metadata = {
  title: 'Perfin — your money, finally explained',
  description: 'AI-powered personal finance.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="icon" href="/icon-192.png" />
        <meta name="theme-color" content="#0F172A" />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Script id="register-sw" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`}
        </Script>
      </body>
    </html>
  );
}
