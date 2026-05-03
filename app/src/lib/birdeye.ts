/**
 * Birdeye client — token price, market cap, and 24h volume for the UI.
 *
 * Free tier API key goes in `BIRDEYE_API_KEY` (server-side). Read-only.
 */

import type { BirdeyeTokenOverview } from "@/types";

const BIRDEYE_BASE = "https://public-api.birdeye.so";

async function birdeyeGet<T>(path: string): Promise<T | null> {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BIRDEYE_BASE}${path}`, {
      headers: {
        accept: "application/json",
        "x-chain": "solana",
        "X-API-KEY": key,
      },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function getTokenOverview(
  mint: string,
): Promise<BirdeyeTokenOverview | null> {
  return birdeyeGet<BirdeyeTokenOverview>(
    `/defi/token_overview?address=${mint}`,
  );
}

export async function getPriceHistory(
  mint: string,
  type: "1H" | "1D" | "1W" = "1D",
): Promise<Array<{ unixTime: number; value: number }>> {
  type Resp = { items?: Array<{ unixTime: number; value: number }> };
  const data = await birdeyeGet<Resp>(
    `/defi/history_price?address=${mint}&type=${type}`,
  );
  return data?.items ?? [];
}
