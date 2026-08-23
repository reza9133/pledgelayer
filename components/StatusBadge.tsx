import clsx from 'clsx';
import type { CampaignStatus } from '@/lib/contract';

const CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  FUNDING: { label: 'Funding', dot: 'bg-brass-400', text: 'text-brass-400' },
  ACTIVE: { label: 'Active', dot: 'bg-verdict-approve', text: 'text-verdict-approve' },
  COMPLETED: { label: 'Completed', dot: 'bg-paper-100', text: 'text-paper-100' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-paper-400', text: 'text-paper-400' },
  FAILED: { label: 'Failed', dot: 'bg-verdict-reject', text: 'text-verdict-reject' },
};

export function StatusBadge({ status }: { status: CampaignStatus | string }) {
  const cfg = CONFIG[status] ?? { label: status, dot: 'bg-paper-400', text: 'text-paper-400' };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border border-ink-500 bg-ink-900/60 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em]',
        cfg.text,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}
