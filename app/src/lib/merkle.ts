/**
 * Off-chain Merkle tree builder for the snapshot voting system.
 *
 * Mirrors `verify_merkle` in `programs/bags-milestones/src/lib.rs`:
 *   - Leaf  = `keccak256(voter_pubkey || balance_le8)`
 *   - Inner = `keccak256(min(a,b) || max(a,b))`  (sorted-pair / OZ convention)
 *
 * The smart contract verifies proofs on-chain via `solana_program::keccak`,
 * so the digest function used here MUST be keccak-256 (NOT SHA-3-256).
 */

import { PublicKey } from "@solana/web3.js";
import { keccak256 } from "js-sha3";

export interface SnapshotEntry {
  /** Owner wallet (base-58 pubkey). */
  wallet: string;
  /** Raw balance in token base units (NOT UI decimals). */
  balance: bigint;
}

export interface SnapshotMerkle {
  /** 32-byte Merkle root (matches `snapshot_root` on-chain). */
  root: Uint8Array;
  /** Sum of leaf balances (matches `snapshot_total_supply` on-chain). */
  totalSupply: bigint;
  /** Sorted, deduplicated entries (one entry per holder). */
  entries: SnapshotEntry[];
  /** Builds the Merkle proof for a wallet (returns `null` if not present). */
  proof: (wallet: string) => Uint8Array[] | null;
  /** The leaf hash for a wallet (returns `null` if not present). */
  leaf: (wallet: string) => Uint8Array | null;
}

const EMPTY_ROOT = new Uint8Array(32);

function keccakBytes(input: Uint8Array): Uint8Array {
  // `keccak256` returns a hex string; we want raw bytes.
  return new Uint8Array(keccak256.arrayBuffer(input));
}

function leafHash(wallet: PublicKey, balance: bigint): Uint8Array {
  const buf = new Uint8Array(32 + 8);
  buf.set(wallet.toBytes(), 0);
  // Little-endian u64, matches Rust's `u64::to_le_bytes`.
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigUint64(32, balance, /* little-endian */ true);
  return keccakBytes(buf);
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function hashPair(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [lo, hi] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];
  const buf = new Uint8Array(64);
  buf.set(lo, 0);
  buf.set(hi, 32);
  return keccakBytes(buf);
}

/**
 * Build the Merkle tree for a holder snapshot.
 *
 * - Drops zero-balance entries (they cannot vote anyway).
 * - Aggregates duplicate wallets (sum of balances) — a single owner may
 *   hold the mint across multiple token accounts.
 * - Sorts entries by leaf hash for deterministic ordering across runs.
 */
export function buildSnapshotMerkle(
  rawEntries: SnapshotEntry[],
): SnapshotMerkle {
  const aggregated = new Map<string, bigint>();
  for (const e of rawEntries) {
    if (e.balance <= 0n) continue;
    aggregated.set(e.wallet, (aggregated.get(e.wallet) ?? 0n) + e.balance);
  }

  const entries: SnapshotEntry[] = Array.from(aggregated, ([wallet, balance]) => ({
    wallet,
    balance,
  }));

  if (entries.length === 0) {
    return {
      root: EMPTY_ROOT,
      totalSupply: 0n,
      entries: [],
      proof: () => null,
      leaf: () => null,
    };
  }

  // Compute leaf hashes first so we can sort deterministically.
  const leafByWallet = new Map<string, Uint8Array>();
  for (const e of entries) {
    leafByWallet.set(e.wallet, leafHash(new PublicKey(e.wallet), e.balance));
  }
  entries.sort((a, b) =>
    compareBytes(leafByWallet.get(a.wallet)!, leafByWallet.get(b.wallet)!),
  );

  const leaves: Uint8Array[] = entries.map((e) => leafByWallet.get(e.wallet)!);

  // Build the layered tree. Last odd node carries up unchanged.
  const layers: Uint8Array[][] = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const cur = layers[layers.length - 1];
    const next: Uint8Array[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(i + 1 < cur.length ? hashPair(cur[i], cur[i + 1]) : cur[i]);
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1][0];
  const totalSupply = entries.reduce((sum, e) => sum + e.balance, 0n);

  const indexByWallet = new Map<string, number>(
    entries.map((e, i) => [e.wallet, i]),
  );

  const proof = (wallet: string): Uint8Array[] | null => {
    const idx = indexByWallet.get(wallet);
    if (idx === undefined) return null;
    const out: Uint8Array[] = [];
    let i = idx;
    for (let layer = 0; layer < layers.length - 1; layer++) {
      const cur = layers[layer];
      const sib = i % 2 === 0 ? i + 1 : i - 1;
      if (sib < cur.length) out.push(cur[sib]);
      i = Math.floor(i / 2);
    }
    return out;
  };

  return {
    root,
    totalSupply,
    entries,
    proof,
    leaf: (wallet) => leafByWallet.get(wallet) ?? null,
  };
}

/** Convert a 32-byte digest into the `[u8; 32]` shape Anchor expects. */
export function bytesToFixedArray(bytes: Uint8Array): number[] {
  if (bytes.length !== 32) throw new Error(`expected 32 bytes, got ${bytes.length}`);
  return Array.from(bytes);
}
