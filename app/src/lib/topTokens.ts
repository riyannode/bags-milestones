/**
 * Server-side helper that produces the "Top tokens by royalty volume"
 * leaderboard rendered on the landing page.
 *
 * Strategy:
 *   1. List every `MilestoneVault` PDA that has been initialised on-chain
 *      via `getProgramAccounts(PROGRAM_ID)` — these are the only tokens
 *      that have actually committed milestones.
 *   2. For each unique token mint, fetch the Birdeye token overview
 *      (market cap + 24h volume + price + symbol).
 *   3. Sum the on-chain locked + released royalty (sum of milestone
 *      `amount_locked` weighted by status) so the table can show
 *      `Locked` and `Released` columns next to market data.
 *   4. Sort by 24h USD volume descending.
 */

import type { PublicKey } from "@solana/web3.js";
import { findMilestonePda, getConnection, getProgram } from "./anchor";
import { getTokenOverview } from "./birdeye";
import type { BirdeyeTokenOverview } from "@/types";

export interface TopTokenRow {
  mint: string;
  symbol: string | null;
  name: string | null;
  /** USD price (Birdeye). */
  price: number | null;
  /** Market cap in USD (Birdeye). */
  marketCap: number | null;
  /** Rolling 24h trading volume in USD (Birdeye). */
  volume24h: number | null;
  /** Lamports locked across all not-yet-approved milestones for this token. */
  lockedLamports: number;
  /** Lamports released across all approved milestones for this token. */
  releasedLamports: number;
  /** Total milestones committed (regardless of status). */
  milestoneCount: number;
  /** Number of holders (count of token accounts \u2014 best-effort). */
  // (left out for now to keep the call cheap)
}

const REVALIDATE_S = 60;

/**
 * Fetch all on-chain `MilestoneVault` PDAs by deriving their seeds.
 *
 * Anchor's `program.account.milestoneVault.all()` issues a single
 * `getProgramAccounts` filtered by the account discriminator, which is
 * exactly what we want.
 */
async function listVaults() {
  const connection = getConnection();
  const program = getProgram(connection, undefined);
  type VaultRow = Awaited<
    ReturnType<typeof program.account.milestoneVault.all>
  >[number];
  let vaults: VaultRow[];
  try {
    vaults = await program.account.milestoneVault.all();
  } catch {
    return [];
  }
  return vaults;
}

async function listMilestonesForVault(vault: PublicKey, count: number) {
  if (count <= 0) return [];
  const connection = getConnection();
  const program = getProgram(connection, undefined);
  const pdas = Array.from({ length: count }, (_, i) => findMilestonePda(vault, i));
  return program.account.milestone.fetchMultiple(pdas);
}

export async function loadTopTokens(): Promise<TopTokenRow[]> {
  const vaults = await listVaults();
  if (vaults.length === 0) return [];

  // For each vault, fetch on-chain milestones to compute locked/released sums.
  const enriched = await Promise.all(
    vaults.map(async (v) => {
      const ms = await listMilestonesForVault(
        v.publicKey,
        v.account.milestoneCount,
      );
      let lockedLamports = 0;
      let releasedLamports = 0;
      for (const m of ms) {
        if (!m) continue;
        const amount = m.amountLocked.toNumber();
        const status = m.status as unknown as {
          pending?: unknown;
          claimed?: unknown;
          approved?: unknown;
          rejected?: unknown;
        };
        if (status.approved) releasedLamports += amount;
        else if (status.pending || status.claimed) lockedLamports += amount;
      }
      return {
        mint: v.account.tokenMint.toBase58(),
        milestoneCount: v.account.milestoneCount,
        lockedLamports,
        releasedLamports,
      };
    }),
  );

  // Birdeye lookups in parallel (free tier rate-limits to ~30 rps; a few
  // tokens at a time is well below that).
  const overviews = await Promise.all(
    enriched.map((row) => getTokenOverview(row.mint)),
  );

  const rows: TopTokenRow[] = enriched.map((row, i) => {
    const o = overviews[i] as Partial<BirdeyeTokenOverview> | null;
    return {
      mint: row.mint,
      symbol: o?.symbol ?? null,
      name: o?.name ?? null,
      price: o?.price ?? null,
      marketCap: o?.mc ?? null,
      volume24h: o?.v24hUSD ?? null,
      lockedLamports: row.lockedLamports,
      releasedLamports: row.releasedLamports,
      milestoneCount: row.milestoneCount,
    };
  });

  rows.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  return rows;
}

export const TOP_TOKENS_REVALIDATE_S = REVALIDATE_S;
