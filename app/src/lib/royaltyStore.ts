/**
 * Per-creator royalty event log, backed by Upstash Redis (via @vercel/kv).
 *
 * The Helius webhook handler records every incoming SOL transfer for any
 * creator wallet that's been registered as a Bags royalty recipient. The
 * Creator Dashboard reads this log to surface "you have N SOL of new
 * royalties on Bags that haven't been bridged into escrow yet".
 *
 * Schema:
 *   royalty:events:{wallet}    LIST   JSON-encoded RoyaltyEvent, newest at HEAD, capped at 100
 *   royalty:total:{wallet}     STRING running sum of incoming lamports (creator lifetime)
 *   royalty:last:{wallet}      STRING unix seconds of the most recent recorded event
 *   royalty:seen:{wallet}:{sig} STRING idempotency marker, TTL 30d
 *
 * If KV env vars aren't set (e.g. local dev without Upstash provisioned),
 * every function returns a safe default and the UI silently degrades.
 */

import { kv } from "@vercel/kv";

export interface RoyaltyEvent {
  /** Solana tx signature. */
  signature: string;
  /** Unix seconds. */
  timestamp: number;
  /** Lamports transferred IN to the creator wallet. */
  lamports: number;
  /** Helius-classified event type (TRANSFER, etc). */
  type: string;
  /** Other party on the SOL transfer, when known. */
  fromWallet?: string;
}

const MAX_EVENTS = 100;
const SEEN_TTL_SECS = 60 * 60 * 24 * 30; // 30 days

function eventsKey(wallet: string) {
  return `royalty:events:${wallet}`;
}
function totalKey(wallet: string) {
  return `royalty:total:${wallet}`;
}
function lastKey(wallet: string) {
  return `royalty:last:${wallet}`;
}
function seenKey(wallet: string, sig: string) {
  return `royalty:seen:${wallet}:${sig}`;
}

/** True iff the runtime has KV credentials provisioned. */
export function isRoyaltyStoreEnabled(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

/**
 * Record a royalty arrival for a given wallet. Idempotent: subsequent calls
 * with the same `signature` are no-ops, so it's safe for Helius to retry
 * the webhook (which it does on non-2xx responses).
 *
 * Returns `true` when the event was recorded for the first time, `false`
 * when it was already known.
 */
export async function recordRoyaltyEvent(
  wallet: string,
  event: RoyaltyEvent,
): Promise<boolean> {
  if (!isRoyaltyStoreEnabled()) return false;

  // Idempotency guard. `setnx`-style: only set if missing, return whether
  // we set it. @vercel/kv's `set(k, v, { nx: true })` returns 'OK' on
  // success and null on collision.
  const claim = await kv.set(seenKey(wallet, event.signature), 1, {
    nx: true,
    ex: SEEN_TTL_SECS,
  });
  if (claim !== "OK") return false;

  // Pipeline the writes; if any one fails the rest still succeed (the
  // worst-case is a missing list entry but valid total, which is fine —
  // the UI re-derives from the list).
  await Promise.all([
    kv.lpush(eventsKey(wallet), JSON.stringify(event)),
    kv.ltrim(eventsKey(wallet), 0, MAX_EVENTS - 1),
    kv.incrby(totalKey(wallet), event.lamports),
    kv.set(lastKey(wallet), event.timestamp),
  ]);

  return true;
}

export interface RoyaltyStoreSummary {
  events: RoyaltyEvent[];
  totalLamports: number;
  lastSeenAt: number;
}

export async function getRoyaltyStoreSummary(
  wallet: string,
  limit = 20,
): Promise<RoyaltyStoreSummary> {
  if (!isRoyaltyStoreEnabled()) {
    return { events: [], totalLamports: 0, lastSeenAt: 0 };
  }

  const [rawEvents, totalRaw, lastRaw] = await Promise.all([
    kv.lrange<string | RoyaltyEvent>(eventsKey(wallet), 0, limit - 1),
    kv.get<number | string>(totalKey(wallet)),
    kv.get<number | string>(lastKey(wallet)),
  ]);

  const events: RoyaltyEvent[] = (rawEvents ?? [])
    .map((raw) => {
      // @vercel/kv auto-deserializes some payloads (it stores JSON-ish
      // values as strings but returns objects when they round-trip). Be
      // defensive here so a corrupt entry doesn't take down the panel.
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as RoyaltyEvent;
        } catch {
          return null;
        }
      }
      return raw as RoyaltyEvent;
    })
    .filter((e): e is RoyaltyEvent => e !== null);

  return {
    events,
    totalLamports: Number(totalRaw ?? 0),
    lastSeenAt: Number(lastRaw ?? 0),
  };
}
