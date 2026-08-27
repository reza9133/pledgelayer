'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { setActiveProvider } from './genlayerClient';

export type WalletType = 'metamask' | 'okx' | 'rabby' | null;

interface WalletState {
  address: `0x${string}` | null;
  walletType: WalletType;
  connecting: boolean;
  error: string | null;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

const LAST_ADDRESS_KEY = 'pledgelayer.lastConnectedAddress';
const LAST_WALLET_TYPE_KEY = 'pledgelayer.lastWalletType';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProvider = useCallback((type: WalletType) => {
    if (typeof window === 'undefined') return null;

    if (type === 'okx' && (window as any).okxwallet) return (window as any).okxwallet;

    if (type === 'rabby') {
      if ((window as any).rabby) return (window as any).rabby;
      if ((window as any).ethereum?.isRabby) return (window as any).ethereum;
    }

    if (type === 'metamask') {
      const eth = (window as any).ethereum;
      if (eth?.providers) {
        return eth.providers.find((p: any) => p.isMetaMask) || eth;
      }
      return eth;
    }

    return (window as any).ethereum;
  }, []);

  const connect = useCallback(async (type: WalletType) => {
    setError(null);
    const provider = getProvider(type);

    if (!provider) {
      setError(`The ${type} extension was not found. Please install it to continue.`);
      return;
    }

    try {
      setConnecting(true);
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (accounts?.[0]) {
        const addr = accounts[0] as `0x${string}`;
        setAddress(addr);
        setWalletType(type);
        setActiveProvider(provider);
        window.sessionStorage.setItem(LAST_ADDRESS_KEY, addr);
        window.sessionStorage.setItem(LAST_WALLET_TYPE_KEY, type as string);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to connect wallet.');
    } finally {
      setConnecting(false);
    }
  }, [getProvider]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletType(null);
    setActiveProvider(null);
    window.sessionStorage.removeItem(LAST_ADDRESS_KEY);
    window.sessionStorage.removeItem(LAST_WALLET_TYPE_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rememberedAddress = window.sessionStorage.getItem(LAST_ADDRESS_KEY);
    const rememberedType = window.sessionStorage.getItem(LAST_WALLET_TYPE_KEY) as WalletType;

    if (!rememberedAddress || !rememberedType) return;

    const provider = getProvider(rememberedType);
    if (!provider) return;

    provider
      .request({ method: 'eth_accounts' })
      .then((accounts: unknown) => {
        const list = accounts as string[];
        if (list?.[0]) {
          setAddress(list[0] as `0x${string}`);
          setWalletType(rememberedType);
          setActiveProvider(provider);
        }
      })
      .catch(() => {});
  }, [getProvider]);

  useEffect(() => {
    if (!walletType) return;
    const provider = getProvider(walletType);
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list?.[0]) {
        setAddress(list[0] as `0x${string}`);
      } else {
        disconnect();
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);
    return () => {
      if (provider.removeListener) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [walletType, getProvider, disconnect]);

  const value = useMemo(
    () => ({ address, walletType, connecting, error, connect, disconnect }),
    [address, walletType, connecting, error, connect, disconnect]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
