/**
 * Helius webhook endpoint — fires whenever a registered creator wallet
 * receives SOL on Solana. Each native transfer is normalised to a
 * RoyaltyEvent and persisted to per-wallet Redis lists via
 * `lib/royaltyStore.ts`. The Creator Dashboard reads from the same store
 * to surface "you have undeposited royalties" prompts in real time.
 *
 * Webhook auth: Helius signs deliveries with an `Authorization` header
 * whose value is whatever you configured when registering the webhook.
 * We compare it against `HELIUS_WEBHOOK_SECRET`. If the secret isn't
 * set, the route is unauthenticated (acceptable for local dev only —
 * production should always have it).
 *
 * Idempotency: Helius retries on non-2xx responses, so we always 200
 * even when there's nothing new to record. `recordRoyaltyEvent` itself
 * is idempotent on signature.
 */

import { NextResponse } from "next/server";
import type { HeliusEnhancedTransaction } from "@/types";
import {
  isRoyaltyStoreEnabled,
  recordRoyaltyEvent,
  type RoyaltyEvent,
} from "@/lib/royaltyStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: HeliusEnhancedTransaction[] = [];
  try {
    payload = (await req.json()) as HeliusEnhancedTransaction[];
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return NextResponse.json({ recorded: 0, skipped: 0 });
  }

  // For each enhanced transaction, walk every native transfer and emit
  // one RoyaltyEvent per (signature, recipient) pair. We trust Helius'
  // wallet filter to only forward transactions involving creator wallets,
  // so every positive-amount transfer is treated as an inbound royalty.
  const writes: Promise<boolean>[] = [];
  let attempted = 0;
  for (const tx of payload) {
    if (!tx?.signature || !tx?.nativeTransfers) continue;
    for (const transfer of tx.nativeTransfers) {
      if (!transfer || transfer.amount <= 0) continue;
      attempted += 1;
      const event: RoyaltyEvent = {
        signature: tx.signature,
        timestamp: tx.timestamp ?? Math.floor(Date.now() / 1000),
        lamports: transfer.amount,
        type: tx.type ?? "TRANSFER",
        fromWallet: transfer.fromUserAccount,
      };
      writes.push(recordRoyaltyEvent(transfer.toUserAccount, event));
    }
  }

  // KV not provisioned → silently skip persistence but return 200 so
  // Helius doesn't retry indefinitely against an under-configured env.
  if (!isRoyaltyStoreEnabled()) {
    console.warn(
      "[helius/royalty] KV not configured, skipping persistence",
      { attempted },
    );
    return NextResponse.json({ recorded: 0, skipped: attempted });
  }

  const results = await Promise.allSettled(writes);
  const recorded = results.filter(
    (r) => r.status === "fulfilled" && r.value === true,
  ).length;
  const dedup = attempted - recorded;

  return NextResponse.json({ recorded, skipped: dedup });
}
