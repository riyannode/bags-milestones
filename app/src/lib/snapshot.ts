/**
 * Composes the on-chain Merkle voting snapshot for a token mint.
 *
 * Two kinds of snapshots are needed by the app:
 *
 *   1. **Build-time** (creator before `claim_milestone`): fetch all token
 *      holders at the current confirmed slot, build a Merkle tree, return
 *      `{root, totalSupply}` to commit on-chain.
 *
 *   2. **Verify-time** (holder before `vote`): rebuild the same tree off the
 *      same data, look up the connected wallet's leaf + proof, and submit
 *      with `vote(claimed_weight, proof)`.
 *
 * Both call sites share `getSnapshotHolders(mint)` so they get a consistent
 * tree (same RPC, same dedup/aggregation rules).
 */

import { getSnapshotHolders } from "./helius";
import { buildSnapshotMerkle, type SnapshotMerkle } from "./merkle";

const cache = new Map<string, { ts: number; tree: SnapshotMerkle }>();
const TTL_MS = 30_000;

/**
 * Returns the current snapshot Merkle tree for `mint`. Cached for 30s to
 * avoid hammering the RPC across creator + holder simultaneous reads.
 */
export async function loadSnapshotMerkle(
  mint: string,
): Promise<SnapshotMerkle> {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.tree;

  const holders = await getSnapshotHolders(mint);
  const tree = buildSnapshotMerkle(holders);
  cache.set(mint, { ts: Date.now(), tree });
  return tree;
}

/** Force-invalidate the cached tree (e.g., after a successful claim). */
export function invalidateSnapshot(mint: string) {
  cache.delete(mint);
}
