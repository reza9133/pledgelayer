'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Upload, Gavel, Loader2, Link as LinkIcon } from 'lucide-react';
import type { MilestoneView } from '@/lib/types';

interface Props {
  milestone: MilestoneView;
  order: number;
  isCurrent: boolean;
  canManage: boolean;
  onSubmitEvidence: (url: string) => void;
  onAdjudicate: () => void;
  submitting: boolean;
  adjudicating: boolean;
}

export function MilestoneItem({
  milestone,
  order,
  isCurrent,
  canManage,
  onSubmitEvidence,
  onAdjudicate,
  submitting,
  adjudicating,
}: Props) {
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const isPending = milestone.status === 'PENDING';
  const isSubmitted = milestone.status === 'SUBMITTED';
  const isApproved = milestone.status === 'APPROVED';
  const isRejected = milestone.status === 'REJECTED';

  const pct = (milestone.ratioBps / 100).toFixed(1);

  return (
    <div className={`ledger-card space-y-4 p-5 ${isCurrent ? 'ring-1 ring-brass-500/50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-sm font-semibold text-paper-100 flex items-center gap-2">
            <span className="text-paper-400">M{order + 1}</span> {milestone.title}
          </h3>
          <p className="mt-1 text-sm text-paper-300">{milestone.description}</p>
        </div>
        
        {isApproved && (
          <div className="flex items-center gap-1.5 rounded-sm border border-verdict-approve/20 bg-verdict-approveDim px-2 py-1 font-mono text-xs text-verdict-approve">
            <CheckCircle2 size={13} /> APPROVED
          </div>
        )}
        {isRejected && (
          <div className="flex items-center gap-1.5 rounded-sm border border-verdict-reject/20 bg-verdict-rejectDim px-2 py-1 font-mono text-xs text-verdict-reject">
            <XCircle size={13} /> REJECTED
          </div>
        )}
        {isPending && (
          <div className="flex items-center gap-1.5 rounded-sm border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-xs text-paper-400">
            <Clock size={13} /> PENDING
          </div>
        )}
        {isSubmitted && (
          <div className="flex items-center gap-1.5 rounded-sm border border-brass-500/20 bg-brass-500/10 px-2 py-1 font-mono text-xs text-brass-400">
            <Clock size={13} /> AWAITING AI ADJUDICATION
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs font-mono text-paper-400">
        <span>{pct}% OF GOAL</span>
        {milestone.rejectionCount > 0 && (
          <span className="text-verdict-reject">REJECTIONS: {milestone.rejectionCount}</span>
        )}
      </div>

      {isCurrent && canManage && (isPending || isRejected) && (
        <div className="space-y-3 border-t border-ink-700 pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-500" />
              <input
                type="url"
                placeholder="https://github.com/... (Evidence URL)"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <button
              onClick={() => onSubmitEvidence(evidenceUrl)}
              disabled={submitting || !evidenceUrl.startsWith('http')}
              className="btn-primary whitespace-nowrap"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Submit URL
            </button>
          </div>
        </div>
      )}

      {isSubmitted && (
        <div className="border-t border-ink-700 pt-4 space-y-3">
          <div className="rounded-md bg-ink-900/50 p-3 font-mono text-xs text-paper-300">
            <span className="text-paper-500">Submitted URL: </span>
            <a href={milestone.evidenceUrl} target="_blank" rel="noreferrer" className="text-brass-400 hover:underline">
              {milestone.evidenceUrl}
            </a>
          </div>
          <button
            onClick={onAdjudicate}
            disabled={adjudicating}
            className="btn-primary w-full justify-center !bg-brass-500 !text-ink-950 hover:!bg-brass-400"
          >
            {adjudicating ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
            Trigger AI Adjudication
          </button>
          <p className="text-center text-xs text-paper-500">
            Anyone can trigger the decentralized AI validator consensus.
          </p>
        </div>
      )}

      {milestone.aiFeedback && (
        <div className={`mt-2 rounded-md border p-3 text-sm ${isApproved ? 'border-verdict-approve/20 bg-verdict-approveDim/30 text-verdict-approve' : 'border-verdict-reject/20 bg-verdict-rejectDim/30 text-verdict-reject'}`}>
          <span className="font-semibold">AI Adjudicator: </span>
          {milestone.aiFeedback}
        </div>
      )}
    </div>
  );
}
