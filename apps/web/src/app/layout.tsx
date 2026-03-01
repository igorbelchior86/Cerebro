import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Playbook Brain',
  description: 'Intelligent playbook generation for IT support',
};

export default function AppRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${GeistMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`,
          }}
        />
      </head>
      <body className={GeistSans.className} style={{ background: 'var(--bg-root)' }}>
        {children}
      </body>
    </html>
  );
}
