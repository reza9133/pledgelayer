'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface WalletState {
  address: `0x${string}` | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

const LAST_ADDRESS_KEY = 'pledgelayer.lastConnectedAddress';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet found. Install MetaMask (or a compatible wallet) to continue.');
      return;
    }
    try {
      setConnecting(true);
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (accounts?.[0]) {
        setAddress(accounts[0] as `0x${string}`);
        window.sessionStorage.setItem(LAST_ADDRESS_KEY, accounts[0]);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to connect wallet.');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    window.sessionStorage.removeItem(LAST_ADDRESS_KEY);
  }, []);

  // Silently reconnect if this wallet already granted access this session.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const remembered = window.sessionStorage.getItem(LAST_ADDRESS_KEY);
    if (!remembered) return;
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.[0]) setAddress(list[0] as `0x${string}`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum?.on) return;
    const handleAccountsChanged = (accounts: string[]) => {
      setAddress((accounts?.[0] as `0x${string}`) ?? null);
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
  }, []);

  const value = useMemo(
    () => ({ address, connecting, error, connect, disconnect }),
    [address, connecting, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
