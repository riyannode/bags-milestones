/**
 * Shared types for the Bags Milestones frontend.
 *
 * The Anchor-generated `BagsMilestones` IDL types live in
 * `src/idl/bags_milestones.ts`; everything else (Bags API responses, Helius
 * webhook payloads, Birdeye responses) is declared here.
 */

export type MilestoneStatus = "pending" | "claimed" | "approved" | "rejected";

export interface MilestoneView {
  index: number;
  title: string;
  description: string;
  /** Unix-timestamp seconds. */
  deadline: number;
  /** Lamports. */
  amountLocked: number;
  status: MilestoneStatus;
  votesApprove: number;
  votesReject: number;
  /** Unix-timestamp seconds; 0 if not yet claimed. */
  votingEnds: number;
  evidenceUrl: string;
  snapshotSlot: number;
}

export interface VaultView {
  vault: string;
  creator: string;
  tokenMint: string;
  /** Lamports. */
  escrowBalance: number;
  milestoneCount: number;
}

// -----------------------------------------------------------------
// Bags API — minimal shapes (what we use in the UI)
// -----------------------------------------------------------------

export interface BagsTokenInfo {
  mint: string;
  creator: string;
  name?: string;
  symbol?: string;
  totalSupply?: number;
  royaltyPercent?: number;
  imageUrl?: string;
}

export interface BagsHolder {
  wallet: string;
  balance: number;
  percentage?: number;
}

export interface BagsRoyaltyEvent {
  amount: number;
  timestamp: number;
  txSignature: string;
}

// -----------------------------------------------------------------
// Birdeye
// -----------------------------------------------------------------

export interface BirdeyeTokenOverview {
  mc?: number;
  liquidity?: number;
  v24hUSD?: number;
  v24hChangePercent?: number;
  price?: number;
}

// -----------------------------------------------------------------
// Helius webhook payload (subset)
// -----------------------------------------------------------------

export interface HeliusEnhancedTransaction {
  signature: string;
  type: string;
  source?: string;
  timestamp: number;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}
