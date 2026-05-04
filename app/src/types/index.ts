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
  /** Sum of `claimed_weight` from approve voters — token base units. */
  votesApprove: bigint;
  /** Sum of `claimed_weight` from reject voters — token base units. */
  votesReject: bigint;
  /** Unix-timestamp seconds; 0 if not yet claimed. */
  votingEnds: number;
  evidenceUrl: string;
  /** Slot at which the holder snapshot was taken. */
  snapshotSlot: number;
  /** keccak Merkle root of `keccak(voter_pubkey || balance_le8)` leaves. */
  snapshotRoot: Uint8Array;
  /** Sum of all leaf balances in the snapshot — token base units. */
  snapshotTotalSupply: bigint;
  /** Unix-timestamp seconds when the current claim was made (0 = never). */
  claimTimestamp: number;
}

export interface VaultView {
  vault: string;
  creator: string;
  tokenMint: string;
  /** Lamports. */
  escrowBalance: number;
  milestoneCount: number;
  /** Quorum threshold in basis points (e.g. `500` = 5%). */
  quorumBps: number;
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
