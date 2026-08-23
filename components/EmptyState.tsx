import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ledger-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-500 text-paper-400">
        <Icon size={18} />
      </span>
      <h3 className="font-display text-lg text-paper-100">{title}</h3>
      <p className="max-w-sm text-sm text-paper-400">{description}</p>
      {action}
    </div>
  );
}
