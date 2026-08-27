'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, LogOut, ChevronDown } from 'lucide-react';
import { useWallet, type WalletType } from '@/lib/useWallet';
import { shortenAddress } from '@/lib/format';

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = async (type: WalletType) => {
    setShowDropdown(false);
    await connect(type);
  };

  if (address) {
    return (
      <button
        onClick={disconnect}
        className="btn-secondary group flex items-center gap-2"
        title="Disconnect wallet"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-verdict-approve" />
        <span className="font-mono text-xs">{shortenAddress(address)}</span>
        <LogOut size={13} className="text-paper-400 group-hover:text-paper-100 transition-colors" />
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        disabled={connecting}
        className="btn-primary flex items-center gap-2"
      >
        <Wallet size={15} />
        {connecting ? 'Connecting…' : 'Connect wallet'}
        {!connecting && <ChevronDown size={14} className="ml-1 opacity-70" />}
      </button>

      {showDropdown && !connecting && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border border-ink-600 bg-ink-800 shadow-xl z-50 overflow-hidden">
          <div className="flex flex-col">
            <button
              onClick={() => handleConnect('metamask')}
              className="w-full text-left px-4 py-3 text-sm text-paper-100 hover:bg-ink-700 flex items-center gap-2 border-b border-ink-700"
            >
              <span className="text-base">🦊</span> MetaMask
            </button>
            <button
              onClick={() => handleConnect('okx')}
              className="w-full text-left px-4 py-3 text-sm text-paper-100 hover:bg-ink-700 flex items-center gap-2 border-b border-ink-700"
            >
              <span className="text-base">🏁</span> OKX Wallet
            </button>
            <button
              onClick={() => handleConnect('rabby')}
              className="w-full text-left px-4 py-3 text-sm text-paper-100 hover:bg-ink-700 flex items-center gap-2"
            >
              <span className="text-base">🐰</span> Rabby Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
