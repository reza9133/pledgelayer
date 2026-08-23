import clsx from 'clsx';
import { Gavel } from 'lucide-react';

export function VerdictStamp({
  decision,
  animate = false,
}: {
  decision: 'APPROVED' | 'REJECTED';
  animate?: boolean;
}) {
  const approved = decision === 'APPROVED';
  return (
    <div
      className={clsx(
        'inline-flex -rotate-6 select-none items-center gap-2 rounded-sm border-[3px] px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.12em]',
        approved
          ? 'border-verdict-approve/70 text-verdict-approve'
          : 'border-verdict-reject/70 text-verdict-reject',
        animate && 'animate-stampdown',
      )}
      style={{
        boxShadow: approved
          ? 'inset 0 0 0 1px rgba(63,190,124,0.25)'
          : 'inset 0 0 0 1px rgba(217,96,92,0.25)',
      }}
    >
      <Gavel size={14} />
      {approved ? 'Approved' : 'Rejected'}
    </div>
  );
}
