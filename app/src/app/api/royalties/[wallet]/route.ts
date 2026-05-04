/**
 * GET /api/royalties/{wallet}
 *
 * Read-only view over the KV store populated by the Helius royalty
 * webhook. Returns:
 *
 *   {
 *     events:        RoyaltyEvent[],   // up to ?limit (default 20)
 *     totalLamports: number,           // creator lifetime, lamports
 *     lastSeenAt:    number,           // unix seconds, 0 if never
 *     enabled:       boolean,          // false ↔ KV not provisioned
 *   }
 *
 * The endpoint is intentionally unauthenticated: per-wallet royalty
 * arrivals are already public on chain (the webhook is just a faster
 * indexed view). Locking it down would add config without security gain.
 */

import { NextResponse } from "next/server";
import {
  getRoyaltyStoreSummary,
  isRoyaltyStoreEnabled,
} from "@/lib/royaltyStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await ctx.params;
  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));

  if (!isRoyaltyStoreEnabled()) {
    return NextResponse.json({
      enabled: false,
      events: [],
      totalLamports: 0,
      lastSeenAt: 0,
    });
  }

  const summary = await getRoyaltyStoreSummary(wallet, limit);
  return NextResponse.json({ enabled: true, ...summary });
}

function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(Math.floor(n), 100);
}
