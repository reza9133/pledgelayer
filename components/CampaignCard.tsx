import Link from 'next/link';
import { ArrowUpRight, ListChecks } from 'lucide-react';
import type { CampaignView } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';
import { formatTokenWithSymbol, fundingProgressPct, shortenAddress } from '@/lib/format';

export function CampaignCard({ campaign }: { campaign: CampaignView }) {
  const pct = fundingProgressPct(campaign.totalFunded, campaign.fundingGoal);

  return (
    <Link
      href={`/campaign?id=${campaign.campaignId}`}
      className="ledger-card group flex flex-col gap-4 p-5 transition-colors hover:border-brass-500/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Case No. {String(campaign.campaignId).padStart(4, '0')}</p>
          <h3 className="font-display text-lg leading-snug text-paper-100">{campaign.title}</h3>
        </div>
        <ArrowUpRight
          size={16}
          className="mt-1 shrink-0 text-paper-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brass-400"
        />
      </div>

      <div className="flex items-center justify-between">
        <StatusBadge status={campaign.status} />
        <span className="flex items-center gap-1 font-mono text-[11px] text-paper-400">
          <ListChecks size={12} />
          {campaign.currentMilestoneIndex}/{campaign.milestoneCount} milestones
        </span>
      </div>

      <div className="space-y-2">
        <ProgressBar pct={pct} />
        <div className="flex items-baseline justify-between font-mono text-xs text-paper-400">
          <span className="text-paper-100">{formatTokenWithSymbol(campaign.totalFunded)}</span>
          <span>of {formatTokenWithSymbol(campaign.fundingGoal)} · {pct.toFixed(0)}%</span>
        </div>
      </div>

      <div className="border-t border-ink-600 pt-3 font-mono text-[11px] text-paper-400">
        Creator {shortenAddress(campaign.creator)}
      </div>
    </Link>
  );
}
