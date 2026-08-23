'use client';

import { Wallet, LogOut } from 'lucide-react';
import { useWallet } from '@/lib/useWallet';
import { shortenAddress } from '@/lib/format';

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        className="btn-secondary group"
        title="Disconnect wallet"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-verdict-approve" />
        <span className="font-mono text-xs">{shortenAddress(address)}</span>
        <LogOut size={13} className="text-paper-400 group-hover:text-paper-100" />
      </button>
    );
  }

  return (
    <button onClick={connect} disabled={connecting} className="btn-primary">
      <Wallet size={15} />
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
