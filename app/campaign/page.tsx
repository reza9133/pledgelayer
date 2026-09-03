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
  Timer,
  Download
} from 'lucide-react';
import { useWallet } from '@/lib/useWallet';
import { useToast } from '@/lib/useToast';
import {
  getCampaign,
  getAllMilestones,
  getPendingWithdrawal,
  getContribution,
  fundCampaign,
  cancelCampaign,
  submitMilestone,
  adjudicateMilestone,
  claimRefund,
  revokeFunding,
  triggerTimeout,
  withdraw
} from '@/lib/genlayerClient';
import type { CampaignView, MilestoneView } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { MilestoneItem } from '@/components/MilestoneItem';
import { FundModal } from '@/components/FundModal';
import { WalletButton } from '@/components/WalletButton';
import { formatTokenWithSymbol, fundingProgressPct, shortenAddress } from '@/lib/format';

function CampaignDetail({ id }: { id: string }) {
  const { address } = useWallet();
  const { push } = useToast();

  const [campaign, setCampaign] = useState<CampaignView | null>(null);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<bigint>(0n);
  const [myContribution, setMyContribution] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFundModal, setShowFundModal] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const [busy, setBusy] = useState<
    null | 'fund' | 'cancel' | 'submit' | 'adjudicate' | 'refund' | 'revoke' | 'timeout' | 'withdraw'
  >(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const c = await getCampaign(id);
      setCampaign(c);
      if (c.exists) {
        setMilestones(await getAllMilestones(c));
      }
      if (address) {
        setPendingWithdrawal(await getPendingWithdrawal(address));
        setMyContribution(await getContribution(id, address));
      }
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load this campaign.');
    } finally {
      setLoading(false);
    }
  }, [id, address]);

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

  async function handleSubmitEvidence(url: string) {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('submit');
    try {
      await submitMilestone(address, id, url);
      push('Evidence URL submitted for adjudication.', 'success');
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
      setClaimed(true);
      push('Refund moved to your pending withdrawals. Please withdraw to receive funds.', 'success');
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
      push('Funding revoked. Funds moved to pending withdrawals.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Revoke failed. You may not have a claimable contribution.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleTriggerTimeout() {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('timeout');
    try {
      await triggerTimeout(address, id);
      push('Campaign timed out successfully. Backers can now claim refunds.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Timeout trigger failed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    if (!address) return push('Connect your wallet first.', 'error');
    setBusy('withdraw');
    try {
      await withdraw(address);
      push('Funds withdrawn to your wallet.', 'success');
      await load();
    } catch (err: any) {
      push(err?.message ?? 'Withdrawal failed.', 'error');
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

  const peakFunded = campaign.totalFunded;
  const peakPct = fundingProgressPct(peakFunded, campaign.fundingGoal);
  const currentEffectiveFunded = (campaign.status === 'CANCELLED' || campaign.status === 'FAILED')
    ? campaign.remainingFunds
    : campaign.totalFunded;
  
  const currentPct = fundingProgressPct(currentEffectiveFunded, campaign.fundingGoal);

  const isCreator = !!address && address.toLowerCase() === campaign.creator.toLowerCase();
  const canRefund = campaign.status === 'FAILED' || campaign.status === 'CANCELLED';
  
  const now = Math.floor(Date.now() / 1000);
  const deadlinePassed = now > Number(campaign.deadline);
  const canTimeout = (campaign.status === 'FUNDING' || campaign.status === 'ACTIVE') && deadlinePassed;

  return (
    <div className="space-y-8">
      {pendingWithdrawal > 0n && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-brass-500/30 bg-brass-500/10 p-4">
          <p className="text-sm text-brass-400">
            You have <strong className="font-mono text-paper-100">{formatTokenWithSymbol(pendingWithdrawal)}</strong> pending to be withdrawn.
          </p>
          <button onClick={handleWithdraw} disabled={busy === 'withdraw'} className="btn-primary !bg-brass-500 !text-ink-950 hover:!bg-brass-400">
            {busy === 'withdraw' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Withdraw Funds
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Case No. {campaign.campaignId}</p>
          <h1 className="font-display text-3xl italic text-paper-100">{campaign.title}</h1>
          <p className="mt-2 font-mono text-xs text-paper-400">
            Filed by {shortenAddress(campaign.creator)}
            {isCreator && <span className="ml-2 text-brass-400">(you)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={campaign.status} />
          <button onClick={load} className="btn-secondary !px-2.5 !py-2" title="Refresh from chain">
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
        <div className="text-xs text-paper-400 flex justify-between">
          <span>{formatTokenWithSymbol(campaign.remainingFunds)} held in escrow, unreleased</span>
          <span>Deadline: {new Date(Number(campaign.deadline) * 1000).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {campaign.status === 'FUNDING' && !deadlinePassed && (
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

        {canTimeout && (
          <button onClick={handleTriggerTimeout} disabled={busy === 'timeout'} className="btn-danger">
            {busy === 'timeout' ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />}
            Trigger Timeout (Deadline Passed)
          </button>
        )}

        {canRefund && (
          <div className="flex flex-col gap-2 rounded-md border border-verdict-reject/30 bg-verdict-rejectDim/20 p-4 w-full sm:w-auto">
            <p className="text-xs font-mono text-paper-300">
              Your contribution: <strong className="font-mono text-paper-100">{formatTokenWithSymbol(myContribution)}</strong>
            </p>
            <button 
              onClick={handleClaimRefund} 
              disabled={busy === 'refund' || claimed || myContribution === 0n} 
              className="btn-primary"
            >
              {busy === 'refund' ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
              {claimed ? 'Refund claimed' : `Claim refund (${formatTokenWithSymbol(myContribution)})`}
            </button>
          </div>
        )}
        {campaign.status === 'COMPLETED' && (
          <span className="flex items-center gap-2 rounded-md border border-verdict-approve/30 bg-verdict-approveDim px-4 py-2.5 text-sm text-verdict-approve">
            <CheckCircle2 size={15} /> All milestones cleared — campaign complete
          </span>
        )}
      </div>

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

  if (!idParam) {
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
      <CampaignDetail id={idParam} />
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
