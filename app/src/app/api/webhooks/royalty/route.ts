/**
 * Helius webhook endpoint — fires whenever a registered creator wallet
 * receives SOL. We don't custodial-forward anything; we just log the event
 * (and surface it in the Creator Dashboard via Bags pendingRoyalties) so
 * the creator gets a "you have undeposited royalties" prompt.
 *
 * Webhook auth: Helius supports an `Authorization` header you set when
 * registering the webhook. We verify it against `HELIUS_WEBHOOK_SECRET`.
 */

import { NextResponse } from "next/server";
import type { HeliusEnhancedTransaction } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== secret) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      );
    }
  }

  let payload: HeliusEnhancedTransaction[] = [];
  try {
    payload = (await req.json()) as HeliusEnhancedTransaction[];
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400 },
    );
  }

  const events = (Array.isArray(payload) ? payload : []).map((tx) => ({
    signature: tx.signature,
    timestamp: tx.timestamp,
    type: tx.type,
    incomingSol:
      tx.nativeTransfers?.reduce(
        (sum, t) => sum + (t.amount > 0 ? t.amount : 0),
        0,
      ) ?? 0,
  }));

  // Surface in server logs; downstream consumers can wire this to Postgres,
  // a queue, or a websocket fanout for live UI updates.
  console.log("[helius/royalty]", JSON.stringify(events));

  return NextResponse.json({ received: events.length });
}
