/**
 * Bags.fm API client (server- and client-safe).
 *
 * The Bags developer docs (https://bags.fm/developers) are still evolving —
 * we wrap each endpoint in a try/catch + AbortController timeout, then
 * return a safe default so the UI gracefully degrades when the API is
 * down, rate-limited, or has shifted shape.
 *
 * Endpoints used:
 *   GET /tokens/{mint}                — token info (name, symbol, creator, image)
 *   GET /tokens/{mint}/holders        — holder snapshot (fallback for Helius)
 *   GET /tokens/{mint}/royalties      — royalty distribution history per token
 *   GET /creators/{wallet}/royalties  — creator's pending royalty stats
 */

import type {
  BagsHolder,
  BagsRoyaltyEvent,
  BagsTokenInfo,
} from "@/types";

const BAGS_BASE = process.env.NEXT_PUBLIC_BAGS_API ?? "https://api.bags.fm";

/** Request timeout — long enough for Bags' slowest paths, short enough to
 * not block the UI. The Bags REST surface has been observed to hang on
 * unhealthy nodes, so we never wait more than this. */
const BAGS_TIMEOUT_MS = 8_000;

/** Cache window for ISR/`revalidate`. Bags royalty events update on Solana
 * confirmation latency (~1s real-time) so 30s is a reasonable balance. */
const BAGS_REVALIDATE_S = 30;

async function bagsGet<T>(path: string): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), BAGS_TIMEOUT_MS);
  try {
    const res = await fetch(`${BAGS_BASE}${path}`, {
      headers: {
        accept: "application/json",
        ...(process.env.BAGS_API_KEY
          ? { "x-api-key": process.env.BAGS_API_KEY }
          : {}),
      },
      signal: ac.signal,
      next: { revalidate: BAGS_REVALIDATE_S },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function getTokenInfo(mint: string): Promise<BagsTokenInfo | null> {
  // Try a couple of common shapes since the Bags REST surface has shifted.
  const data = await bagsGet<BagsTokenInfo & { data?: BagsTokenInfo }>(
    `/tokens/${mint}`,
  );
  if (!data) return null;
  return (data.data ?? data) as BagsTokenInfo;
}

export async function getHolders(
  mint: string,
  limit = 100,
): Promise<BagsHolder[]> {
  const data = await bagsGet<{ holders?: BagsHolder[] } | BagsHolder[]>(
    `/tokens/${mint}/holders?limit=${limit}`,
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.holders ?? [];
}

export async function getRoyaltyHistory(
  mint: string,
): Promise<BagsRoyaltyEvent[]> {
  const data = await bagsGet<
    { events?: BagsRoyaltyEvent[] } | BagsRoyaltyEvent[]
  >(`/tokens/${mint}/royalties`);
  if (!data) return [];
  const events = Array.isArray(data) ? data : data.events ?? [];
  // Bags has been observed to return events out of order; sort newest-first
  // so the UI can `.slice(0, N)` without re-sorting.
  return [...events].sort((a, b) => b.timestamp - a.timestamp);
}

export interface CreatorRoyaltyStats {
  /** Lamports earned but not yet bridged into any escrow. */
  pendingAmount: number;
  /** Lamports earned across the creator's lifetime on Bags. */
  totalEarned: number;
}

export async function getCreatorRoyalties(
  wallet: string,
): Promise<CreatorRoyaltyStats | null> {
  const data = await bagsGet<{
    pendingAmount?: number;
    totalEarned?: number;
  }>(`/creators/${wallet}/royalties`);
  if (!data) return null;
  return {
    pendingAmount: data.pendingAmount ?? 0,
    totalEarned: data.totalEarned ?? 0,
  };
}
