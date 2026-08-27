'use client';
import type { EIP1193Provider } from './providerDiscovery';

const SNAP_METHODS = new Set([
  'wallet_getSnaps',
  'wallet_requestSnaps',
  'wallet_invokeSnap',
  'wallet_snap',
]);

export function withSnapShim(provider: EIP1193Provider, isRealMetaMask: boolean): EIP1193Provider {
  if (isRealMetaMask) return provider; 

  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === 'request') {
        return async (args: { method: string; params?: unknown }) => {
          if (SNAP_METHODS.has(args?.method)) return {};
          return target.request(args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
