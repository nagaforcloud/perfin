import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Perfin — your money, finally explained',
  description: 'AI-powered personal finance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
