'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { useWallet } from '@/lib/useWallet';
import { useToast } from '@/lib/useToast';
import { createCampaign } from '@/lib/genlayerClient';
import { WalletButton } from '@/components/WalletButton';

export default function CreateCampaignPage() {
  const { address } = useWallet();
  const { push } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState<number | ''>('');
  const [durationDays, setDurationDays] = useState<number | ''>(30);

  const [milestones, setMilestones] = useState([
    { title: '', description: '', ratioPct: 100 }
  ]);

  const [submitting, setSubmitting] = useState(false);

  const totalPct = milestones.reduce((sum, m) => sum + (Number(m.ratioPct) || 0), 0);

  const handleAddMilestone = () => {
    setMilestones([...milestones, { title: '', description: '', ratioPct: 0 }]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestones.length === 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: string, value: string | number) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return push('Connect your wallet first.', 'error');
    if (!title || !description || !goal || !durationDays) return push('Fill out all campaign details.', 'error');
    if (totalPct !== 100) return push('Milestone percentages must sum to exactly 100%.', 'error');

    const mTitles = milestones.map(m => m.title);
    const mDescs = milestones.map(m => m.description);
    const mRatios = milestones.map(m => Math.floor(Number(m.ratioPct) * 100)); 

    setSubmitting(true);
    try {
      await createCampaign(
        address,
        title,
        description,
        Number(goal),
        Number(durationDays),
        mTitles,
        mDescs,
        mRatios
      );
      push('Campaign created successfully!', 'success');
      router.push('/'); 
    } catch (err: any) {
      push(err?.message || 'Failed to create campaign.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!address) {
    return (
      <div className="ledger-card p-12 text-center max-w-xl mx-auto mt-12">
        <h1 className="font-display text-2xl italic text-paper-100 mb-4">Identification Required</h1>
        <p className="text-paper-300 mb-6">You must connect a wallet to file a new campaign docket.</p>
        <div className="flex justify-center"><WalletButton /></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-4xl italic text-paper-100 mb-2">File a New Campaign</h1>
        <p className="text-paper-400">Establish an escrow and define AI-adjudicated milestones.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="ledger-card p-6 space-y-5">
          <h2 className="eyebrow border-b border-ink-700 pb-3">1. Campaign Docket</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-paper-400 mb-1">Title</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Project Name"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-mono text-paper-400 mb-1">Description</label>
              <textarea 
                className="input-field min-h-[100px]" 
                placeholder="What are you building?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-paper-400 mb-1">Funding Goal (GEN)</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  className="input-field" 
                  placeholder="e.g. 1000"
                  value={goal}
                  onChange={e => setGoal(Number(e.target.value) || '')}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-paper-400 mb-1">Duration (Days)</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  className="input-field" 
                  placeholder="e.g. 30"
                  value={durationDays}
                  onChange={e => setDurationDays(Number(e.target.value) || '')}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="ledger-card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-ink-700 pb-3">
            <h2 className="eyebrow">2. Milestones & Adjudication</h2>
            <span className={`text-xs font-mono ${totalPct === 100 ? 'text-verdict-approve' : 'text-verdict-reject'}`}>
              Total: {totalPct}% / 100%
            </span>
          </div>

          <div className="space-y-6">
            {milestones.map((m, i) => (
              <div key={i} className="relative space-y-4 rounded-md border border-ink-700 bg-ink-900/30 p-4">
                {milestones.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveMilestone(i)}
                    className="absolute -right-2 -top-2 rounded-full bg-ink-800 p-1.5 text-paper-500 hover:text-verdict-reject border border-ink-700"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-mono text-paper-400 mb-1">Milestone {i + 1} Title</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={m.title}
                      onChange={e => handleMilestoneChange(i, 'title', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-mono text-paper-400 mb-1">Payout %</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      className="input-field font-mono" 
                      value={m.ratioPct}
                      onChange={e => handleMilestoneChange(i, 'ratioPct', Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-paper-400 mb-1">Acceptance Criteria (For AI Adjudicator)</label>
                  <textarea 
                    className="input-field min-h-[80px]" 
                    placeholder="Be specific. How should the AI judge the evidence URL?"
                    value={m.description}
                    onChange={e => handleMilestoneChange(i, 'description', e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <button 
            type="button" 
            onClick={handleAddMilestone}
            className="btn-secondary w-full justify-center border-dashed"
          >
            <Plus size={15} /> Add Another Milestone
          </button>
        </div>

        <button 
          type="submit" 
          disabled={submitting || totalPct !== 100}
          className="btn-primary w-full justify-center py-4 text-sm"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          File Campaign on GenLayer
        </button>
      </form>
    </div>
  );
}
