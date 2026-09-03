import type { CampaignStatus, MilestoneStatus } from './contract';

/** Mirrors the contract's CampaignView dataclass. */
export interface CampaignView {
  exists: boolean;
  campaignId: string;
  creator: string;
  title: string;
  fundingGoal: bigint;
  totalFunded: bigint;
  remainingFunds: bigint;
  currentMilestoneIndex: number;
  milestoneCount: number;
  status: CampaignStatus | string;
  deadline: bigint;
}

/** Mirrors the contract's MilestoneView dataclass. */
export interface MilestoneView {
  exists: boolean;
  index: number;
  title: string;
  description?: string;
  ratioBps: number;
  status: MilestoneStatus | string;
  evidenceUrl: string;
  rejectionCount: number;
  aiFeedback: string;
}

export interface TxState {
  status: 'idle' | 'pending' | 'success' | 'error';
  hash?: `0x${string}`;
  error?: string;
}
