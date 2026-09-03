'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, FilePlus2 } from 'lucide-react';
import { NATIVE_SYMBOL } from '@/lib/contract';

export interface MilestoneDraft {
  title: string;
  description: string;
  percent: string; 
}

export interface CampaignDraft {
  title: string;
  description: string;
  fundingGoal: string;
  durationDays: string;
  milestones: MilestoneDraft[];
}

const emptyMilestone = (): MilestoneDraft => ({ title: '', description: '', percent: '' });

export function CreateCampaignForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (draft: CampaignDraft) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fundingGoal, setFundingGoal] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([emptyMilestone(), emptyMilestone()]);
  const [formError, setFormError] = useState<string | null>(null);

  const percentTotal = useMemo(
    () => milestones.reduce((sum, m) => sum + (Number(m.percent) || 0), 0),
    [milestones],
  );

  function updateMilestone(index: number, patch: Partial<MilestoneDraft>) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, emptyMilestone()]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) return setFormError('Give the campaign a title.');
    if (!Number.isInteger(Number(fundingGoal)) || Number(fundingGoal) <= 0) {
      return setFormError(`Enter a whole-number funding goal in ${NATIVE_SYMBOL}.`);
    }
    if (!Number.isInteger(Number(durationDays)) || Number(durationDays) <= 0) {
      return setFormError('Enter a valid duration in days.');
    }
    if (milestones.some((m) => !m.title.trim() || !m.description.trim())) {
      return setFormError('Every milestone needs a title and description.');
    }
    if (milestones.some((m) => !Number(m.percent) || Number(m.percent) <= 0)) {
      return setFormError('Every milestone needs a payout percentage greater than 0.');
    }
    if (Math.round(percentTotal * 100) !== 100 * 100) {
      return setFormError(`Milestone percentages must add up to exactly 100% (currently ${percentTotal}%).`);
    }

    onSubmit({ title, description, fundingGoal, durationDays, milestones });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="ledger-card space-y-4 p-6">
        <p className="eyebrow">Campaign details</p>
        <div>
          <label className="field-label" htmlFor="c-title">
            Title
          </label>
          <input
            id="c-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Open-source GenVM debugger"
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="c-desc">
            Description
          </label>
          <textarea
            id="c-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you building, and why should backers fund it?"
            className="field-input resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="c-goal">
              Funding goal ({NATIVE_SYMBOL})
            </label>
            <input
              id="c-goal"
              inputMode="numeric"
              value={fundingGoal}
              onChange={(e) => setFundingGoal(e.target.value)}
              placeholder="1000"
              className="field-input font-mono"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="c-duration">
              Duration (Days)
            </label>
            <input
              id="c-duration"
              inputMode="numeric"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder="30"
              className="field-input font-mono"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">
            Milestones &middot; must total 100%{' '}
            <span className={percentTotal === 100 ? 'text-verdict-approve' : 'text-verdict-reject'}>
              (currently {percentTotal}%)
            </span>
          </p>
          <button type="button" onClick={addMilestone} className="btn-secondary !px-3 !py-1.5 text-xs">
            <Plus size={13} /> Add milestone
          </button>
        </div>

        {milestones.map((m, i) => (
          <div key={i} className="ledger-card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-paper-400">
                Milestone {String(i + 1).padStart(2, '0')}
              </span>
              {milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMilestone(i)}
                  className="text-paper-400 hover:text-verdict-reject"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr,140px]">
              <div>
                <label className="field-label">Title</label>
                <input
                  value={m.title}
                  onChange={(e) => updateMilestone(i, { title: e.target.value })}
                  placeholder="e.g. Alpha release"
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Payout %</label>
                <input
                  inputMode="decimal"
                  value={m.percent}
                  onChange={(e) => updateMilestone(i, { percent: e.target.value })}
                  placeholder="25"
                  className="field-input font-mono"
                />
              </div>
            </div>
            <div>
              <label className="field-label">Deliverable requirements</label>
              <textarea
                rows={2}
                value={m.description}
                onChange={(e) => updateMilestone(i, { description: e.target.value })}
                placeholder="What must be true for the AI adjudicator to approve this milestone?"
                className="field-input resize-y"
              />
            </div>
          </div>
        ))}
      </section>

      {formError && (
        <p className="rounded-md border border-verdict-reject/30 bg-verdict-rejectDim px-4 py-3 text-sm text-verdict-reject">
          {formError}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />}
        {submitting ? 'Deploying campaign…' : 'Launch campaign'}
      </button>
    </form>
  );
}
