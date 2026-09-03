/**
 * PledgeLayerPlatform contract configuration.
 *
 * The address defaults to the one supplied for this project and can be
 * overridden at build time with NEXT_PUBLIC_CONTRACT_ADDRESS (useful if you
 * redeploy the contract, e.g. after adding the extra view methods suggested
 * in README.md).
 */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  '0x5380808A1e42dA82F6Aeadcc3035EF8e64dbb797') as `0x${string}`;

// Human-readable label for the network this dApp targets.
export const NETWORK_LABEL = 'GenLayer Bradbury Testnet';

// bps (basis points) denominator used throughout the contract (10000 = 100%).
export const BPS_DENOMINATOR = 10_000;

// Token amounts in the contract are stored at 18-decimal precision
// (funding_goal_whole_tokens * 10**18), matching native GEN.
export const TOKEN_DECIMALS = 18;

export const NATIVE_SYMBOL = 'GEN';

/**
 * Campaign / milestone status strings, exactly as emitted by the contract.
 * Keeping them as a const union (rather than re-deriving from an enum) keeps
 * the frontend in lockstep with the Python contract's plain string statuses.
 */
export const CAMPAIGN_STATUSES = [
  'FUNDING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const MILESTONE_STATUSES = [
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
