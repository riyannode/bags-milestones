/**
 * Bags.fm API client (server- and client-safe).
 *
 * The Bags developer docs (https://bags.fm/developers) are still evolving —
 * we wrap each endpoint in a try/catch and return `null` so the UI can
 * gracefully degrade instead of crashing when a response shape changes.
 *
 * Endpoints used:
 *   GET /tokens/{mint}                — token info
 *   GET /tokens/{mint}/holders        — holder snapshot
 *   GET /tokens/{mint}/royalties      — royalty distribution history
 *   GET /creators/{wallet}/royalties  — creator's pending royalty stats
 */

import type {
  BagsHolder,
  BagsRoyaltyEvent,
  BagsTokenInfo,
} from "@/types";

const BAGS_BASE = process.env.NEXT_PUBLIC_BAGS_API ?? "https://api.bags.fm";

async function bagsGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BAGS_BASE}${path}`, {
      headers: {
        accept: "application/json",
        ...(process.env.BAGS_API_KEY
          ? { "x-api-key": process.env.BAGS_API_KEY }
          : {}),
      },
      // Bags responses can be cached aggressively; we revalidate every 30s.
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
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
  const data = await bagsGet<{ events?: BagsRoyaltyEvent[] } | BagsRoyaltyEvent[]>(
    `/tokens/${mint}/royalties`,
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.events ?? [];
}

export async function getCreatorRoyalties(
  wallet: string,
): Promise<{ pendingAmount: number; totalEarned: number } | null> {
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
