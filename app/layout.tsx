import type { Metadata } from 'next';
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/useWallet';
import { ToastProvider } from '@/lib/useToast';
import { ToastViewport } from '@/components/Toast';
import { Navbar } from '@/components/Navbar';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PledgeLayer — AI-Adjudicated Crowdfunding',
  description:
    'On-chain crowdfunding where every milestone is evaluated by an impartial AI adjudicator, secured by GenLayer consensus.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-ink-900 bg-grain font-body text-paper-100 antialiased">
        <ToastProvider>
          <WalletProvider>
            <Navbar />
            <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">{children}</main>
            <ToastViewport />
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
