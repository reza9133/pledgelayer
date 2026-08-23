import type { CampaignStatus, MilestoneStatus } from './contract';

/** Mirrors the contract's CampaignView dataclass. */
export interface CampaignView {
  exists: boolean;
  campaignId: number;
  creator: string;
  title: string;
  fundingGoal: bigint;
  totalFunded: bigint;
  remainingFunds: bigint;
  currentMilestoneIndex: number;
  milestoneCount: number;
  status: CampaignStatus | string;
}

/** Mirrors the contract's MilestoneView dataclass. */
export interface MilestoneView {
  exists: boolean;
  index: number;
  title: string;
  ratioBps: number;
  status: MilestoneStatus | string;
  evidenceText: string;
  rejectionCount: number;
  aiFeedback: string;
}

export interface TxState {
  status: 'idle' | 'pending' | 'success' | 'error';
  hash?: `0x${string}`;
  error?: string;
}
