/**
 * Anchor client setup for Bags Milestones.
 *
 * Provides:
 *   - `getProgram(connection, wallet)` — Anchor `Program<BagsMilestones>`
 *     instance for a given connection + wallet.
 *   - `findVaultPda(mint)` / `findMilestonePda(vault, idx)` /
 *     `findVotePda(milestone, voter)` / `findEscrowPda(mint)` PDA helpers.
 *   - `RPC_URL`, `PROGRAM_ID`, `EXPLORER_BASE`.
 */

import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  type ConfirmOptions,
  type Signer,
} from "@solana/web3.js";
import idl from "@/idl/bags_milestones.json";
import type { BagsMilestones } from "@/idl/bags_milestones";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz",
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "devnet";

export const EXPLORER_BASE = `https://explorer.solana.com`;

/** Build a Solana explorer URL for a tx/account that respects the network. */
export function explorerUrl(signatureOrAddress: string, kind: "tx" | "address" = "tx") {
  const cluster = NETWORK === "mainnet-beta" ? "" : `?cluster=${NETWORK}`;
  return `${EXPLORER_BASE}/${kind}/${signatureOrAddress}${cluster}`;
}

export interface MinimalWallet {
  publicKey: PublicKey;
  signTransaction: <T extends object>(tx: T) => Promise<T>;
  signAllTransactions: <T extends object>(txs: T[]) => Promise<T[]>;
}

export function getConnection(commitment: ConfirmOptions["commitment"] = "confirmed") {
  return new Connection(RPC_URL, commitment);
}

export function getProgram(
  connection: Connection,
  wallet: MinimalWallet | undefined,
): Program<BagsMilestones> {
  // Anchor needs a wallet for a provider, but we only use it for read methods
  // when none is connected. Fall back to a no-op wallet bound to a dummy key.
  const provider = new AnchorProvider(
    connection,
    wallet ?? readOnlyWallet(),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  return new Program<BagsMilestones>(idl as unknown as Idl, provider) as unknown as Program<BagsMilestones>;
}

function readOnlyWallet(): MinimalWallet {
  return {
    publicKey: new PublicKey("11111111111111111111111111111111"),
    signTransaction: async (t) => t,
    signAllTransactions: async (t) => t,
  };
}

// -----------------------------------------------------------------
// PDA helpers
// -----------------------------------------------------------------

const VAULT_SEED = Buffer.from("vault");
const MILESTONE_SEED = Buffer.from("milestone");
const VOTE_SEED = Buffer.from("vote");
const ESCROW_SEED = Buffer.from("escrow");

export function findVaultPda(tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, tokenMint.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function findEscrowPda(tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, tokenMint.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function findMilestonePda(vault: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MILESTONE_SEED, vault.toBuffer(), Buffer.from([index])],
    PROGRAM_ID,
  )[0];
}

export function findVotePda(milestone: PublicKey, voter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, milestone.toBuffer(), voter.toBuffer()],
    PROGRAM_ID,
  )[0];
}

// `Signer` re-exported so call sites don't need a separate import.
export type { Signer };
