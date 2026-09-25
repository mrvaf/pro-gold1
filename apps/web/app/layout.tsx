import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'V-GOLD — Digital Gold & Jewelry Ecosystem',
  description: 'Enterprise-grade platform for the gold and jewelry industry.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
