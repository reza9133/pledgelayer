'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  Coins,
  Ban,
  Undo2,
  ScrollText,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useWallet } from '@/lib/useWallet';
import { useToast } from '@/lib/useToast';
import {
  getCampaign,
  getAllMilestones,
  fundCampaign,
  cancelCampaign,
  submitMilestone,
  adjudicateMilestone,
  claimRefund,
  revokeFunding, 
} from '@/lib/genlayerClient';
import type { CampaignView, MilestoneView } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { MilestoneItem } from '@/components/MilestoneItem';
import { FundModal } from '@/components/FundModal';
import { WalletButton } from '@/components/WalletButton';
import { formatTokenWithSymbol, fundingProgressPct, shortenAddress } from '@/lib/format';

function CampaignDetail({ id }: { id: number }) {
  const { address } = useWallet();
  const { push } = useToast();

  const [campaign, setCampaign] = useState<CampaignView | null>(null);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFundModal, setShowFundModal] = useState(false);

  const [busy, setBusy] = useState<
    null | 'fund' | 'cancel' | 'submit' | 'adjudicate' | 'refund' | 'revoke'
  >(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const c = await getCampaign(id);
      setCampaign(c);
      if (c.exists) {
        setMilestones(await getAllMilestones(c));
      }
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load this campaign.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFund(amountBaseUnits: bigint) {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('fund');
    try {
      await fundCampaign(address, id, amountBaseUnits);
      push('Contribution confirmed. Thank you for backing this campaign.', 'success');
      setShowFundModal(false);
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Funding failed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('cancel');
    try {
      await cancelCampaign(address, id);
      push('Campaign cancelled. Backers can now claim refunds.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Cancellation failed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmitEvidence(text: string) {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('submit');
    try {
      await submitMilestone(address, id, text);
      push('Evidence submitted for adjudication.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Submission failed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleAdjudicate() {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('adjudicate');
    try {
      await adjudicateMilestone(address, id);
      push('The adjudicator has ruled. Refreshing case file…', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Adjudication failed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleClaimRefund() {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('refund');
    try {
      await claimRefund(address, id);
      push('Refund claimed — check your wallet balance.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Refund claim failed. You may not have a claimable contribution.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeFunding() {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('revoke');
    try {
      await revokeFunding(address, id);
      push('Funding revoked — check your wallet balance.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Revoke failed. You may not have a claimable contribution.', 'error');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="ledger-card h-64 animate-pulse bg-ink-700/40" />;
  }

  if (loadError) {
    return (
      <p className="rounded-md border border-verdict-reject/30 bg-verdict-rejectDim px-4 py-3 text-sm text-verdict-reject">
        {loadError}
      </p>
    );
  }

  if (!campaign || !campaign.exists) {
    return (
      <div className="ledger-card p-8 text-center">
        <p className="text-sm text-paper-300">No campaign found with case No. {id}.</p>
      </div>
    );
  }

  // 1. Peak / Historical progress before cancellation or failure
  const peakFunded = campaign.totalFunded;
  const peakPct = fundingProgressPct(peakFunded, campaign.fundingGoal);

  // 2. Current effective funded amount based on remaining escrow (updates with refunds)
  const currentEffectiveFunded = (campaign.status === 'CANCELLED' || campaign.status === 'FAILED')
    ? campaign.remainingFunds
    : campaign.totalFunded;
  
  const currentPct = fundingProgressPct(currentEffectiveFunded, campaign.fundingGoal);

  const isCreator = !!address && address.toLowerCase() === campaign.creator.toLowerCase();
  const canRefund = campaign.status === 'FAILED' || campaign.status === 'CANCELLED';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Case No. {String(campaign.campaignId).padStart(4, '0')}</p>
          <h1 className="font-display text-3xl italic text-paper-100">{campaign.title}</h1>
          <p className="mt-2 font-mono text-xs text-paper-400">
            Filed by {shortenAddress(campaign.creator)}
            {isCreator && <span className="ml-2 text-brass-400">(you)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={campaign.status} />
          <button
            onClick={load}
            className="btn-secondary !px-2.5 !py-2"
            title="Refresh from chain"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="ledger-card space-y-3 p-5">
        <ProgressBar pct={currentPct} />
        <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm">
          <span className="text-paper-100">{formatTokenWithSymbol(currentEffectiveFunded)} raised</span>
          <span className="text-paper-400">
            of {formatTokenWithSymbol(campaign.fundingGoal)} goal &middot; {currentPct.toFixed(1)}%
            {(campaign.status === 'CANCELLED' || campaign.status === 'FAILED') && peakPct > currentPct && (
              <span className="ml-2 text-xs text-paper-500">
                (Peak: {peakPct.toFixed(1)}% before {campaign.status.toLowerCase()})
              </span>
            )}
          </span>
        </div>
        <div className="text-xs text-paper-400">
          {formatTokenWithSymbol(campaign.remainingFunds)} held in escrow, unreleased
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {campaign.status === 'FUNDING' && (
          <button onClick={() => setShowFundModal(true)} className="btn-primary">
            <Coins size={15} /> Fund this campaign
          </button>
        )}
        
        {campaign.status === 'FUNDING' && (
          <button onClick={handleRevokeFunding} disabled={busy === 'revoke'} className="btn-secondary">
            {busy === 'revoke' ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Revoke Funding
          </button>
        )}

        {campaign.status === 'FUNDING' && isCreator && (
          <button onClick={handleCancel} disabled={busy === 'cancel'} className="btn-danger">
            {busy === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            Cancel campaign
          </button>
        )}
        {canRefund && (
          <button onClick={handleClaimRefund} disabled={busy === 'refund'} className="btn-primary">
            {busy === 'refund' ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Claim refund
          </button>
        )}
        {campaign.status === 'COMPLETED' && (
          <span className="flex items-center gap-2 rounded-md border border-verdict-approve/30 bg-verdict-approveDim px-4 py-2.5 text-sm text-verdict-approve">
            <CheckCircle2 size={15} /> All milestones cleared — campaign complete
          </span>
        )}
      </div>

      {(canRefund || campaign.status === 'FUNDING') && (
        <p className="rounded-md border border-ink-600 bg-ink-800/60 px-4 py-3 text-xs text-paper-400">
          Refunds and revocations are safe. The contract does not expose a view method
          for your exact contribution, so the amount isn&rsquo;t shown ahead of time — claiming is
          safe even if you didn&rsquo;t contribute; it simply reverts.
        </p>
      )}

      <div className="space-y-3">
        <h2 className="eyebrow flex items-center gap-1.5">
          <ScrollText size={13} /> Milestones
        </h2>
        <div className="space-y-3">
          {milestones.map((m, i) => (
            <MilestoneItem
              key={m.index}
              milestone={m}
              order={i}
              isCurrent={i === campaign.currentMilestoneIndex}
              canManage={isCreator}
              onSubmitEvidence={handleSubmitEvidence}
              onAdjudicate={handleAdjudicate}
              submitting={busy === 'submit'}
              adjudicating={busy === 'adjudicate'}
            />
          ))}
        </div>
      </div>

      {showFundModal && (
        <FundModal
          onClose={() => setShowFundModal(false)}
          onConfirm={handleFund}
          submitting={busy === 'fund'}
        />
      )}
    </div>
  );
}

function CampaignPageInner() {
  const params = useSearchParams();
  const idParam = params.get('id');
  const id = Number(idParam);
  const { address } = useWallet();

  if (!idParam || !Number.isInteger(id) || id <= 0) {
    return (
      <div className="ledger-card p-8 text-center">
        <p className="text-sm text-paper-300">
          No campaign given. Open a campaign from the docket, or add{' '}
          <code className="font-mono text-brass-400">?id=1</code> to the URL.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!address && (
        <div className="ledger-card flex flex-wrap items-center gap-3 p-4">
          <p className="text-sm text-paper-300 flex-1">
            Connect a wallet to fund, manage, or claim refunds on this campaign.
          </p>
          <WalletButton />
        </div>
      )}
      <CampaignDetail id={id} />
    </div>
  );
}

export default function CampaignPage() {
  return (
    <Suspense fallback={<div className="ledger-card h-64 animate-pulse bg-ink-700/40" />}>
      <CampaignPageInner />
    </Suspense>
  );
}
