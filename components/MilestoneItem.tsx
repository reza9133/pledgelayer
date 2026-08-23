'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Gavel, Loader2, Send, FileText } from 'lucide-react';
import type { MilestoneView } from '@/lib/types';
import { bpsToPercentLabel } from '@/lib/format';
import { VerdictStamp } from './VerdictStamp';

const STATUS_TEXT: Record<string, string> = {
  PENDING: 'Awaiting submission',
  SUBMITTED: 'Awaiting AI adjudication',
  APPROVED: 'Approved — funds released',
  REJECTED: 'Rejected — may resubmit',
  FAILED: 'Failed after repeated rejection',
};

export function MilestoneItem({
  milestone,
  order,
  isCurrent,
  canManage,
  onSubmitEvidence,
  onAdjudicate,
  submitting,
  adjudicating,
}: {
  milestone: MilestoneView;
  order: number;
  isCurrent: boolean;
  canManage: boolean;
  onSubmitEvidence: (text: string) => void;
  onAdjudicate: () => void;
  submitting: boolean;
  adjudicating: boolean;
}) {
  const [evidence, setEvidence] = useState('');
  const [expanded, setExpanded] = useState(false);

  const showSubmitForm =
    canManage && isCurrent && (milestone.status === 'PENDING' || milestone.status === 'REJECTED');
  const showAdjudicateButton = isCurrent && milestone.status === 'SUBMITTED';
  const hasVerdict = milestone.status === 'APPROVED' || milestone.status === 'REJECTED';

  return (
    <div
      className={clsx(
        'ledger-card p-5 transition-colors',
        isCurrent ? 'border-brass-500/40' : 'opacity-80',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 font-mono text-xs text-paper-400">
            {String(order + 1).padStart(2, '0')}
          </span>
          <div>
            <h4 className="font-display text-base text-paper-100">{milestone.title}</h4>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-paper-400">
              {bpsToPercentLabel(milestone.ratioBps)} of goal ·{' '}
              {STATUS_TEXT[milestone.status] ?? milestone.status}
              {milestone.rejectionCount > 0 ? ` · ${milestone.rejectionCount} rejection(s)` : ''}
            </p>
          </div>
        </div>
        {hasVerdict && (
          <VerdictStamp decision={milestone.status as 'APPROVED' | 'REJECTED'} />
        )}
      </div>

      {(milestone.evidenceText || milestone.aiFeedback) && (
        <div className="mt-4 space-y-2">
          {milestone.evidenceText && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-[11px] text-paper-400 hover:text-paper-100"
            >
              <FileText size={12} />
              {expanded ? 'Hide submitted evidence' : 'View submitted evidence'}
            </button>
          )}
          {expanded && milestone.evidenceText && (
            <p className="whitespace-pre-wrap rounded-md border border-ink-600 bg-ink-900 p-3 text-sm text-paper-300">
              {milestone.evidenceText}
            </p>
          )}
          {milestone.aiFeedback && (
            <div className="flex gap-2 rounded-md border border-ink-600 bg-ink-900 p-3">
              <Gavel size={14} className="mt-0.5 shrink-0 text-brass-400" />
              <p className="text-sm text-paper-300">
                <span className="text-paper-400">Adjudicator: </span>
                {milestone.aiFeedback}
              </p>
            </div>
          )}
        </div>
      )}

      {showSubmitForm && (
        <div className="mt-4 space-y-2 border-t border-ink-600 pt-4">
          <label className="field-label" htmlFor={`evidence-${order}`}>
            Submit deliverable evidence
          </label>
          <textarea
            id={`evidence-${order}`}
            rows={3}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Describe (or link to) the completed work for this milestone…"
            className="field-input resize-y"
          />
          <button
            onClick={() => onSubmitEvidence(evidence)}
            disabled={submitting || evidence.trim().length === 0}
            className="btn-primary"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit for adjudication'}
          </button>
        </div>
      )}

      {showAdjudicateButton && (
        <div className="mt-4 border-t border-ink-600 pt-4">
          <button onClick={onAdjudicate} disabled={adjudicating} className="btn-primary">
            {adjudicating ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
            {adjudicating ? 'Adjudicator is deliberating…' : 'Trigger AI adjudication'}
          </button>
          <p className="mt-2 text-xs text-paper-400">
            Runs the evidence through GenLayer&rsquo;s validator-consensus AI adjudicator. Anyone can
            trigger this once evidence is submitted.
          </p>
        </div>
      )}
    </div>
  );
}
