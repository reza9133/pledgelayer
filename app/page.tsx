'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderSearch, Search, ArrowRight } from 'lucide-react';
import { listCampaigns } from '@/lib/genlayerClient';
import type { CampaignView } from '@/lib/types';
import { CampaignCard } from '@/components/CampaignCard';
import { EmptyState } from '@/components/EmptyState';

function CardSkeleton() {
  return <div className="ledger-card h-52 animate-pulse bg-ink-700/40" />;
}

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jumpId, setJumpId] = useState('');

  useEffect(() => {
    let cancelled = false;
    listCampaigns()
      .then((list) => !cancelled && setCampaigns(list))
      .catch((err) => !cancelled && setLoadError(err?.message ?? 'Failed to load campaigns.'));
    return () => {
      cancelled = true;
    };
  }, []);

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const id = jumpId.trim();
    // اینجا فقط چک می‌کنیم که استرینگ خالی نباشد
    if (id) router.push(`/campaign?id=${id}`);
  }

  return (
    <div className="space-y-12">
      <section className="animate-fadeUp space-y-4 pt-6 text-center sm:pt-10">
        <p className="eyebrow justify-center text-brass-400">GenLayer Bradbury Testnet</p>
        <h1 className="font-display text-4xl italic tracking-tight text-paper-100 sm:text-5xl">
          Funding, adjudicated&nbsp;by&nbsp;evidence.
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-paper-400 sm:text-base">
          Every PledgeLayer campaign pays out in milestones. Creators submit evidence, an impartial
          AI adjudicator rules on it under GenLayer&rsquo;s validator consensus, and funds release
          automatically &mdash; no committee, no disputes.
        </p>
      </section>

      <section className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <form onSubmit={handleJump} className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper-400" />
            <input
              value={jumpId}
              onChange={(e) => setJumpId(e.target.value)}
              placeholder="Jump to case No."
              inputMode="text"
              className="field-input w-48 pl-8 font-mono"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Open <ArrowRight size={14} />
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">Open Docket</h2>
          {campaigns && <span className="font-mono text-[11px] text-paper-400">{campaigns.length} campaign(s)</span>}
        </div>

        {loadError && (
          <p className="rounded-md border border-verdict-reject/30 bg-verdict-rejectDim px-4 py-3 text-sm text-verdict-reject">
            {loadError}
          </p>
        )}

        {!campaigns && !loadError && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {campaigns && campaigns.length === 0 && (
          <EmptyState
            icon={FolderSearch}
            title="No campaigns filed yet"
            description="Be the first to bring a campaign before the docket — creators can launch one in a couple of minutes."
            action={
              <a href="/create" className="btn-primary mt-2">
                Start a campaign
              </a>
            }
          />
        )}

        {campaigns && campaigns.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.campaignId} campaign={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
