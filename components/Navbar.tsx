'use client';

import Link from 'next/link';
import { Scale } from 'lucide-react';
import { WalletButton } from './WalletButton';
import { NETWORK_LABEL } from '@/lib/contract';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-600 bg-ink-900/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-brass-500/40 bg-brass-500/10 text-brass-400">
            <Scale size={16} strokeWidth={2} />
          </span>
          <span className="font-display text-lg italic tracking-tight text-paper-100">
            PledgeLayer
          </span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="/" className="text-sm text-paper-300 transition-colors hover:text-paper-100">
            Explore
          </Link>
          <Link href="/create" className="text-sm text-paper-300 transition-colors hover:text-paper-100">
            Start a campaign
          </Link>
          <Link href="/about" className="text-sm text-paper-300 transition-colors hover:text-paper-100">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-paper-400 md:inline">
            {NETWORK_LABEL}
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
