import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { CONTRACT_ADDRESS } from './contract';
import type { CampaignView, MilestoneView } from './types';

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toCamelCase(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/([-_][a-z])/g, (group) =>
        group.toUpperCase().replace('-', '').replace('_', '')
      );
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

export function getClient(accountAddress?: string) {
  return createClient({
    chain: testnetBradbury,
    account: accountAddress ? (accountAddress as `0x${string}`) : undefined,
  });
}

export async function getCampaign(id: string): Promise<CampaignView> {
  const client = getClient();
  const res: any = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_campaign',
    args: [id],
  });
  return toCamelCase(res) as CampaignView;
}

export async function getMilestone(campaignId: string, index: number): Promise<MilestoneView> {
  const client = getClient();
  const res: any = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_milestone',
    args: [campaignId, index],
  });
  return toCamelCase(res) as MilestoneView;
}

export async function getAllMilestones(campaign: CampaignView): Promise<MilestoneView[]> {
  const ms: MilestoneView[] = [];
  for (let i = 0; i < campaign.milestoneCount; i++) {
    ms.push(await getMilestone(campaign.campaignId, i));
  }
  return ms;
}

export async function getPendingWithdrawal(accountAddress: string): Promise<bigint> {
  const client = getClient();
  const res: any = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_pending_withdrawal',
    args: [accountAddress],
  });
  return BigInt(res);
}

export async function withdraw(accountAddress: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'withdraw',
    args: [],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function triggerTimeout(accountAddress: string, campaignId: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'trigger_timeout',
    args: [campaignId],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function createCampaign(
  accountAddress: string,
  title: string,
  description: string,
  fundingGoal: number,
  durationDays: number,
  milestoneTitles: string[],
  milestoneDescriptions: string[],
  milestoneRatiosBps: number[]
) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'create_campaign',
    args: [
      title,
      description,
      fundingGoal,
      durationDays,
      milestoneTitles,
      milestoneDescriptions,
      milestoneRatiosBps,
    ],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function fundCampaign(accountAddress: string, campaignId: string, amount: bigint) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'fund_campaign',
    args: [campaignId],
    value: amount,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function revokeFunding(accountAddress: string, campaignId: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'revoke_funding',
    args: [campaignId],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function cancelCampaign(accountAddress: string, campaignId: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'cancel_campaign',
    args: [campaignId],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function claimRefund(accountAddress: string, campaignId: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'claim_refund',
    args: [campaignId],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function submitMilestone(accountAddress: string, campaignId: string, evidenceUrl: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'submit_milestone',
    args: [campaignId, evidenceUrl],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function adjudicateMilestone(accountAddress: string, campaignId: string) {
  const client = getClient(accountAddress);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'adjudicate_milestone',
    args: [campaignId],
    value: 0n,
  });
  return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
}

export async function listCampaigns(): Promise<CampaignView[]> {
  const campaigns: CampaignView[] = [];
  let id = 1;
  let consecutiveMisses = 0;
  
  while (consecutiveMisses < 2) {
    try {
      const c = await getCampaign(id.toString());
      if (c.exists) {
        campaigns.push(c);
        consecutiveMisses = 0;
      } else {
        consecutiveMisses++;
      }
    } catch (err) {
      consecutiveMisses++;
    }
    id++;
  }
  
  return campaigns;
}
