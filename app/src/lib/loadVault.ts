/**
 * Helper that pulls a vault + all its milestones from the program in one
 * shot. Used by both the creator dashboard and the holder view. Returns
 * `null` if the vault doesn't exist yet.
 */

import { PublicKey } from "@solana/web3.js";
import {
  findMilestonePda,
  findVaultPda,
  getConnection,
  getProgram,
} from "./anchor";
import type { MilestoneStatus, MilestoneView, VaultView } from "@/types";

function toUint8Array32(buf: number[] | Uint8Array | Buffer): Uint8Array {
  const arr = Array.isArray(buf) ? Uint8Array.from(buf) : new Uint8Array(buf);
  if (arr.length !== 32) throw new Error(`expected 32 bytes, got ${arr.length}`);
  return arr;
}

interface LoadResult {
  vault: VaultView;
  milestones: MilestoneView[];
}

interface OnChainStatus {
  pending?: Record<string, never>;
  claimed?: Record<string, never>;
  approved?: Record<string, never>;
  rejected?: Record<string, never>;
}

function decodeStatus(s: OnChainStatus): MilestoneStatus {
  if (s.claimed) return "claimed";
  if (s.approved) return "approved";
  if (s.rejected) return "rejected";
  return "pending";
}

export async function loadVault(mint: string): Promise<LoadResult | null> {
  const connection = getConnection();
  const program = getProgram(connection, undefined);
  const tokenMint = new PublicKey(mint);
  const vaultPda = findVaultPda(tokenMint);

  let vaultAcc: Awaited<
    ReturnType<typeof program.account.milestoneVault.fetchNullable>
  >;
  try {
    vaultAcc = await program.account.milestoneVault.fetchNullable(vaultPda);
  } catch {
    return null;
  }
  if (!vaultAcc) return null;

  const vault: VaultView = {
    vault: vaultPda.toBase58(),
    creator: vaultAcc.creator.toBase58(),
    tokenMint: vaultAcc.tokenMint.toBase58(),
    escrowBalance: vaultAcc.escrowBalance.toNumber(),
    milestoneCount: vaultAcc.milestoneCount,
    quorumBps: vaultAcc.quorumBps,
  };

  const milestonePdas = Array.from(
    { length: Math.max(vaultAcc.milestoneCount, 0) },
    (_, i) => findMilestonePda(vaultPda, i),
  );

  const accs = await program.account.milestone.fetchMultiple(milestonePdas);
  const milestones: MilestoneView[] = [];
  for (let i = 0; i < accs.length; i++) {
    const m = accs[i];
    if (!m) continue;
    milestones.push({
      index: m.index,
      title: m.title,
      description: m.description,
      deadline: m.deadline.toNumber(),
      amountLocked: m.amountLocked.toNumber(),
      status: decodeStatus(m.status as unknown as OnChainStatus),
      votesApprove: BigInt(m.votesApprove.toString()),
      votesReject: BigInt(m.votesReject.toString()),
      votingEnds: m.votingEnds.toNumber(),
      evidenceUrl: m.evidenceUrl,
      snapshotSlot: m.snapshotSlot.toNumber(),
      snapshotRoot: toUint8Array32(
        m.snapshotRoot as unknown as number[] | Uint8Array | Buffer,
      ),
      snapshotTotalSupply: BigInt(m.snapshotTotalSupply.toString()),
      claimTimestamp: m.claimTimestamp.toNumber(),
    });
  }

  return { vault, milestones };
}
