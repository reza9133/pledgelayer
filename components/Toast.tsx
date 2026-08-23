'use client';

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToast } from '@/lib/useToast';
import clsx from 'clsx';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES = {
  success: 'border-verdict-approve/40 text-verdict-approve',
  error: 'border-verdict-reject/40 text-verdict-reject',
  info: 'border-brass-500/40 text-brass-400',
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={clsx(
              'ledger-card animate-fadeUp flex items-start gap-2.5 border px-4 py-3',
              STYLES[toast.kind],
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-sm text-paper-100">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-paper-400 hover:text-paper-100"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
