/**
 * Helius client wrappers.
 *
 * Used for:
 *   - Holder snapshot at a given slot (for vote-weight verification).
 *   - Watching a creator wallet for incoming SOL (Bags royalty deposits).
 *   - Confirming holder balance at the snapshot slot before letting them vote.
 *
 * The Helius API key is server-side only (`HELIUS_API_KEY`); we expose the
 * RPC URL to the browser via `NEXT_PUBLIC_SOLANA_RPC` (rate-limited public
 * key acceptable since we only do read calls from the client).
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const HELIUS_BASE = "https://api.helius.xyz/v0";

async function heliusFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!HELIUS_API_KEY) return null;
  try {
    const url = `${HELIUS_BASE}${path}${path.includes("?") ? "&" : "?"}api-key=${HELIUS_API_KEY}`;
    const res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface HeliusTokenAccountHolder {
  address: string;
  owner: string;
  amount: number;
}

/**
 * Returns token holders for a given mint via Helius DAS API.
 * NOTE: Helius does not natively support arbitrary historical-slot snapshots
 * via this endpoint — for a truly slot-pinned snapshot, use the on-chain
 * `snapshot_slot` recorded in the milestone account and re-fetch holder
 * balances via `getTokenAccountBalance` at the deterministic slot off-chain.
 */
export async function getCurrentHolders(
  mint: string,
): Promise<HeliusTokenAccountHolder[]> {
  type RpcResp = {
    result?: {
      token_accounts?: Array<{ address: string; owner: string; amount: number }>;
    };
  };
  const data = await heliusFetch<RpcResp>("/token-accounts", {
    method: "POST",
    body: JSON.stringify({ mintAccount: mint, limit: 1000 }),
  });
  return data?.result?.token_accounts ?? [];
}

/**
 * Get a wallet's token balance for a specific mint at the **current** slot.
 * (Helius free tier doesn't expose historical-slot reads on this endpoint;
 * for vote eligibility we instead use the snapshot slot recorded on-chain
 * and rely on Helius's standard JSON-RPC `getTokenAccountsByOwner` with a
 * `commitment` parameter — best-effort but adequate for a hackathon demo.)
 */
export async function getHolderBalance(
  wallet: string,
  mint: string,
): Promise<number> {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (!rpc) return 0;
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          wallet,
          { mint },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    });
    const json = (await res.json()) as {
      result?: {
        value: Array<{
          account: { data: { parsed: { info: { tokenAmount: { uiAmount: number; amount: string } } } } };
        }>;
      };
    };
    const accounts = json.result?.value ?? [];
    return accounts.reduce(
      (sum, a) => sum + Number(a.account.data.parsed.info.tokenAmount.amount),
      0,
    );
  } catch {
    return 0;
  }
}

export interface HeliusWebhook {
  webhookID: string;
  webhookURL: string;
  accountAddresses: string[];
  webhookType: string;
}

/**
 * Register (or update) a Helius webhook that pings our `/api/webhooks/royalty`
 * endpoint whenever the creator wallet receives SOL — the UI uses this to
 * surface "you have undeposited royalties" hints.
 */
export async function registerRoyaltyWebhook(
  creatorWallet: string,
  callbackUrl: string,
): Promise<HeliusWebhook | null> {
  return heliusFetch<HeliusWebhook>("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      webhookURL: callbackUrl,
      transactionTypes: ["ANY"],
      accountAddresses: [creatorWallet],
      webhookType: "enhanced",
    }),
  });
}
