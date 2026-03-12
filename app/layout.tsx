import type { Metadata } from 'next';
import { Klee_One } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';

import './globals.css';

const kleeOne = Klee_One({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WAKARUMADE',
  description: 'わかるまで - 小学生向け算数学習アプリ',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${kleeOne.className} bg-[#fffefc]`}>
        {children}
        <Script
          src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
