'use client';

import { useState } from 'react';
import { X, Coins, Loader2 } from 'lucide-react';
import { NATIVE_SYMBOL } from '@/lib/contract';
import { parseTokenAmountToBaseUnits } from '@/lib/format';

export function FundModal({
  onClose,
  onConfirm,
  submitting,
}: {
  onClose: () => void;
  onConfirm: (amountBaseUnits: bigint) => void;
  submitting: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const base = parseTokenAmountToBaseUnits(amount);
      setError(null);
      onConfirm(base);
    } catch (err: any) {
      setError(err?.message ?? 'Invalid amount');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 px-4 backdrop-blur-sm">
      <div className="ledger-card w-full max-w-sm animate-fadeUp p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brass-500/40 bg-brass-500/10 text-brass-400">
              <Coins size={16} />
            </span>
            <div>
              <h3 className="font-display text-lg text-paper-100">Back this campaign</h3>
              <p className="text-xs text-paper-400">Funds are held in escrow until milestones clear.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-paper-400 hover:text-paper-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="fund-amount">
              Amount ({NATIVE_SYMBOL})
            </label>
            <input
              id="fund-amount"
              autoFocus
              inputMode="decimal"
              placeholder="10.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field-input font-mono"
            />
            {error && <p className="mt-1.5 text-xs text-verdict-reject">{error}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
              {submitting ? 'Confirming…' : 'Fund campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
