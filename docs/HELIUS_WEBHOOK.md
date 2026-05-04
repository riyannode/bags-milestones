# Helius webhook → Bagscrow Live royalty feed

Bagscrow listens to Solana via a [Helius enhanced webhook](https://docs.helius.dev/data-streaming/enhanced-webhooks)
so creators see "you have N SOL of new royalties" in their dashboard
within seconds of the on-chain transaction.

This document is the runbook for registering the webhook against a fresh
deployment.

## How it works

```
                  ┌─────────────────────┐
 Solana mainnet ─▶│ Helius enhanced     │
   (creator         indexer + webhook   │
    wallet tx)    │ filter on wallet    │
                  └─────────┬───────────┘
                            │ POST JSON, Authorization: <secret>
                            ▼
        ┌──────────────────────────────────────┐
        │ POST /api/webhooks/royalty (Next.js) │
        │  • verify Authorization header       │
        │  • parse HeliusEnhancedTransaction[] │
        │  • for each native transfer:         │
        │     SETNX  royalty:seen:{wlt}:{sig}  │
        │     LPUSH  royalty:events:{wlt}      │
        │     LTRIM  royalty:events:{wlt} 0 99 │
        │     INCRBY royalty:total:{wlt}       │
        │     SET    royalty:last:{wlt} ts     │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Upstash Redis (Vercel KV integration)│
        └──────────────────┬───────────────────┘
                           │ GET /api/royalties/{wallet}
                           ▼
        ┌──────────────────────────────────────┐
        │ Creator Dashboard <LiveRoyaltyFeed/> │
        │  polls every 30s, renders newest 10  │
        └──────────────────────────────────────┘
```

## Required environment variables

These must be set in the Vercel project (Production + Preview):

| Variable | Source | Purpose |
| --- | --- | --- |
| `KV_REST_API_URL` | auto-injected by the Upstash integration | Webhook + read API talk to Redis |
| `KV_REST_API_TOKEN` | auto-injected by the Upstash integration | Auth for write operations |
| `HELIUS_API_KEY` | https://dashboard.helius.dev → API keys | (used elsewhere, also required to list webhooks via the API) |
| `HELIUS_WEBHOOK_SECRET` | self-generated random string | Verifies the `Authorization` header on inbound webhook deliveries |

`KV_REST_API_READ_ONLY_TOKEN` and `KV_URL` are also injected but unused
by Bagscrow today — leave them.

## Step 1 — set the webhook secret

Generate a random secret and set it on the Vercel project:

```bash
openssl rand -hex 32
# e.g. 91f3...c2d0  ← keep this around for step 2

vercel env add HELIUS_WEBHOOK_SECRET production
vercel env add HELIUS_WEBHOOK_SECRET preview
```

## Step 2 — register the webhook with Helius

Either via the dashboard (https://dashboard.helius.dev → Webhooks → Create)
or via the REST API. The dashboard flow:

1. **Network**: `mainnet` (royalties happen on mainnet; devnet has no
   real Bags royalty stream)
2. **Webhook URL**: `https://<your-vercel-domain>/api/webhooks/royalty`
3. **Webhook Type**: `Enhanced`
4. **Transaction Types**: at minimum `TRANSFER`. Add more (`SWAP`,
   `NFT_SALE`, etc) if Bags emits them — the handler treats every
   positive-amount native transfer as a royalty arrival
5. **Authorization Header**: paste the secret from step 1
6. **Account Addresses**: the creator wallets you want to track. For
   the hackathon demo this is just the deploy authority
   `9TL7R3ryFSULpmxn8x1fSGvBR4oKV3NZ6kVHk69ybL4s`. In production you'd
   add a wallet here whenever a creator runs `init_vault`

The equivalent REST call:

```bash
curl -X POST "https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}" \
  -H 'content-type: application/json' \
  -d '{
    "webhookURL": "https://<your-vercel-domain>/api/webhooks/royalty",
    "transactionTypes": ["TRANSFER"],
    "accountAddresses": ["9TL7R3ryFSULpmxn8x1fSGvBR4oKV3NZ6kVHk69ybL4s"],
    "webhookType": "enhanced",
    "authHeader": "<HELIUS_WEBHOOK_SECRET>"
  }'
```

The response includes a `webhookID` — keep it; you need it to update or
delete the webhook later.

## Step 3 — verify

Once registered:

```bash
# Trigger a test send by transferring a small amount to the watched wallet,
# then check the response of the read endpoint:
curl -s "https://<your-vercel-domain>/api/royalties/9TL7R3ryFSULpmxn8x1fSGvBR4oKV3NZ6kVHk69ybL4s" | jq .
```

You should see `enabled: true` and `events: [...]` with the recent
transfer. The Creator Dashboard's `LiveRoyaltyFeed` panel will show the
same data within 30s.

## Failure modes

- **401 from `/api/webhooks/royalty`** — the Authorization header
  Helius sent doesn't match `HELIUS_WEBHOOK_SECRET`. Re-paste it in
  Helius Dashboard.
- **Webhook returns 200 but events don't appear** — KV env vars not
  injected. Confirm `KV_REST_API_URL` and `KV_REST_API_TOKEN` exist
  via `vercel env ls production` (or check the Vercel dashboard).
- **Helius keeps retrying** — the handler always returns 200, even on
  empty payloads, so retry loops only happen if the function itself
  is crashing. Check the function logs in Vercel.
