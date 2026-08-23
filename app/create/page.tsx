'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/useWallet';
import { useToast } from '@/lib/useToast';
import { createCampaign } from '@/lib/genlayerClient';
import { CreateCampaignForm, type CampaignDraft } from '@/components/CreateCampaignForm';
import { WalletButton } from '@/components/WalletButton';
import { BPS_DENOMINATOR } from '@/lib/contract';

export default function CreateCampaignPage() {
  const { address } = useWallet();
  const { push } = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(draft: CampaignDraft) {
    if (!address) {
      push('Connect your wallet first.', 'error');
      return;
    }

    // Convert human-entered percentages to exact basis points that sum to
    // BPS_DENOMINATOR (10000) — the contract rejects anything else, and
    // naive per-item rounding can drift by a point or two, so any rounding
    // remainder is folded into the last milestone.
    const rawBps = draft.milestones.map((m) => Math.round(Number(m.percent) * 100));
    const drift = BPS_DENOMINATOR - rawBps.reduce((a, b) => a + b, 0);
    const ratiosBps = rawBps.map((v, i) => (i === rawBps.length - 1 ? v + drift : v));

    setSubmitting(true);
    try {
      await createCampaign(address, {
        title: draft.title,
        description: draft.description,
        fundingGoalWholeTokens: Number(draft.fundingGoal),
        milestoneTitles: draft.milestones.map((m) => m.title),
        milestoneDescriptions: draft.milestones.map((m) => m.description),
        milestoneRatiosBps: ratiosBps,
      });
      push('Campaign filed on-chain. It will appear on the docket shortly.', 'success');
      router.push('/');
    } catch (err: any) {
      push(err?.message ?? 'Failed to create campaign.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow mb-2">New filing</p>
        <h1 className="font-display text-3xl italic text-paper-100">Start a campaign</h1>
        <p className="mt-2 text-sm text-paper-400">
          Break your project into milestones with clear, verifiable requirements — the AI
          adjudicator can only approve what the evidence supports.
        </p>
      </div>

      {!address ? (
        <div className="ledger-card flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-paper-300">Connect a wallet to file a campaign.</p>
          <WalletButton />
        </div>
      ) : (
        <CreateCampaignForm onSubmit={handleSubmit} submitting={submitting} />
      )}
    </div>
  );
}
