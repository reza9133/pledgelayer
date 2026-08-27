import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { TransactionStatus, ExecutionResult, type CalldataEncodable } from 'genlayer-js/types';
import { CONTRACT_ADDRESS } from './contract';
import type { CampaignView, MilestoneView } from './types';
import { toBigInt, toNumber } from './format';

let activeProvider: any = typeof window !== 'undefined' ? (window as any).ethereum : null;

export function setActiveProvider(provider: any) {
  activeProvider = provider;
}

/**
 * Read-only client. Talks directly to the GenLayer RPC — no wallet needed.
 * Safe to use on the server or before a wallet is connected.
 */
export const readClient = createClient({
  chain: testnetBradbury,
});

/**
 * Creates a write client bound to a connected wallet so
 * transactions are signed by the user rather than a local key.
 */
export function getWriteClient(address: `0x${string}`) {
  if (!activeProvider) {
    throw new Error('No wallet provider found. Please connect your wallet first.');
  }
  return createClient({
    chain: testnetBradbury,
    account: address,
    provider: activeProvider,
  });
}

/** Prompts the connected wallet to switch to / add the Bradbury testnet. */
export async function ensureCorrectNetwork(address: `0x${string}`) {
  const client = getWriteClient(address);
  await client.connect('testnetBradbury');
  return client;
}

// ---------------------------------------------------------------------------
// Normalizers
//
// NOTE: genlayer-js decodes contract dataclass returns into a plain JS object
// keyed by the dataclass's field names (snake_case, matching the Python
// source). These normalizers read snake_case keys defensively and fall back
// to camelCase in case a future SDK version changes that convention — but
// they have not been exercised against a live Bradbury node from this
// environment, so double check field names against one real
// `readContract({ functionName: 'get_campaign', ... })` call and adjust here
// if anything doesn't line up.
// ---------------------------------------------------------------------------

function pick(obj: any, snake: string, camel: string) {
  return obj?.[snake] !== undefined ? obj[snake] : obj?.[camel];
}

function normalizeCampaign(raw: any): CampaignView {
  return {
    exists: Boolean(pick(raw, 'exists', 'exists')),
    campaignId: toNumber(pick(raw, 'campaign_id', 'campaignId')),
    creator: String(pick(raw, 'creator', 'creator') ?? ''),
    title: String(pick(raw, 'title', 'title') ?? ''),
    fundingGoal: toBigInt(pick(raw, 'funding_goal', 'fundingGoal')),
    totalFunded: toBigInt(pick(raw, 'total_funded', 'totalFunded')),
    remainingFunds: toBigInt(pick(raw, 'remaining_funds', 'remainingFunds')),
    currentMilestoneIndex: toNumber(pick(raw, 'current_milestone_index', 'currentMilestoneIndex')),
    milestoneCount: toNumber(pick(raw, 'milestone_count', 'milestoneCount')),
    status: String(pick(raw, 'status', 'status') ?? ''),
  };
}

function normalizeMilestone(raw: any): MilestoneView {
  return {
    exists: Boolean(pick(raw, 'exists', 'exists')),
    index: toNumber(pick(raw, 'index', 'index')),
    title: String(pick(raw, 'title', 'title') ?? ''),
    ratioBps: toNumber(pick(raw, 'ratio_bps', 'ratioBps')),
    status: String(pick(raw, 'status', 'status') ?? ''),
    evidenceText: String(pick(raw, 'evidence_text', 'evidenceText') ?? ''),
    rejectionCount: toNumber(pick(raw, 'rejection_count', 'rejectionCount')),
    aiFeedback: String(pick(raw, 'ai_feedback', 'aiFeedback') ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getCampaign(campaignId: number): Promise<CampaignView> {
  const raw = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_campaign',
    args: [campaignId],
  });
  return normalizeCampaign(raw);
}

export async function getMilestone(campaignId: number, index: number): Promise<MilestoneView> {
  const raw = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_milestone',
    args: [campaignId, index],
  });
  return normalizeMilestone(raw);
}

/**
 * The contract does not expose a `get_campaign_count` (or equivalent) view
 * method, and `next_campaign_id` / `campaign_ids` are private state — so
 * there is no direct way to ask the contract "how many campaigns exist".
 *
 * Campaign IDs are assigned sequentially starting at 1 with no gaps
 * (create_campaign always increments next_campaign_id by exactly 1), so this
 * probes get_campaign(1), get_campaign(2), ... and stops once it hits
 * `missTolerance` consecutive non-existent IDs. This works reliably but
 * costs one RPC round-trip per campaign. See README.md for a two-line
 * contract addition that would make this instant and gap-proof.
 */
export async function listCampaigns(options?: {
  maxScan?: number;
  missTolerance?: number;
}): Promise<CampaignView[]> {
  const maxScan = options?.maxScan ?? 200;
  const missTolerance = options?.missTolerance ?? 2;

  const campaigns: CampaignView[] = [];
  let misses = 0;
  for (let id = 1; id <= maxScan; id++) {
    try {
      const campaign = await getCampaign(id);
      if (campaign.exists) {
        campaigns.push(campaign);
        misses = 0;
      } else {
        misses++;
        if (misses >= missTolerance) break;
      }
    } catch {
      misses++;
      if (misses >= missTolerance) break;
    }
  }
  return campaigns.reverse(); // newest first
}

export async function getAllMilestones(campaign: CampaignView): Promise<MilestoneView[]> {
  const indices = Array.from({ length: campaign.milestoneCount }, (_, i) => i);
  return Promise.all(indices.map((i) => getMilestone(campaign.campaignId, i)));
}

// ---------------------------------------------------------------------------
// Writes
//
// Every write follows the same shape: send the transaction, then wait for it
// to be ACCEPTED (fast) or FINALIZED (slower, fully settled) before treating
// it as done. We wait for ACCEPTED here for snappier UX and always check
// txExecutionResultName before assuming the state actually changed, since a
// transaction can reach consensus while its execution itself reverted.
// ---------------------------------------------------------------------------

async function sendWrite(
  address: `0x${string}`,
  functionName: string,
  args: CalldataEncodable[],
  value: bigint = 0n,
) {
  const client = await ensureCorrectNetwork(address);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });

  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error(`Transaction executed but reverted (${functionName}). Check the trace for details.`);
  }

  return { hash, receipt };
}

export async function createCampaign(
  address: `0x${string}`,
  params: {
    title: string;
    description: string;
    fundingGoalWholeTokens: number;
    milestoneTitles: string[];
    milestoneDescriptions: string[];
    milestoneRatiosBps: number[];
  },
) {
  return sendWrite(address, 'create_campaign', [
    params.title,
    params.description,
    params.fundingGoalWholeTokens,
    params.milestoneTitles,
    params.milestoneDescriptions,
    params.milestoneRatiosBps,
  ]);
}

export async function fundCampaign(address: `0x${string}`, campaignId: number, amountBaseUnits: bigint) {
  return sendWrite(address, 'fund_campaign', [campaignId], amountBaseUnits);
}

export async function cancelCampaign(address: `0x${string}`, campaignId: number) {
  return sendWrite(address, 'cancel_campaign', [campaignId]);
}

export async function submitMilestone(address: `0x${string}`, campaignId: number, evidenceText: string) {
  return sendWrite(address, 'submit_milestone', [campaignId, evidenceText]);
}

export async function adjudicateMilestone(address: `0x${string}`, campaignId: number) {
  return sendWrite(address, 'adjudicate_milestone', [campaignId]);
}

export async function claimRefund(address: `0x${string}`, campaignId: number) {
  return sendWrite(address, 'claim_refund', [campaignId]);
}

export async function revokeFunding(address: `0x${string}`, campaignId: number) {
  return sendWrite(address, 'revoke_funding', [campaignId]);
}
