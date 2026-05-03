# Bags Milestones

> Turning Bags tokens from pure speculation into accountable creator crowdfunding.

**Live devnet program ID:** [`FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz`](https://explorer.solana.com/address/FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz?cluster=devnet)

Built for [The Bags Hackathon on DoraHacks](https://dorahacks.io/hackathon/the-bags-hackathon).

---

## Problem

Creators on [Bags.fm](https://bags.fm) earn 1% of all trading volume in
their token as royalties. Today those royalties hit the creator wallet
directly with **zero accountability** — the creator can pump and abandon,
and holders have no way to enforce delivery on roadmap promises.

## Solution

**Bags Milestones** is a Solana-native dApp that adds a governance layer
on top of Bags creator royalties. Creators opt into:

1. Locking royalties in an **on-chain escrow PDA** controlled by an Anchor program.
2. Publishing **up to 5 milestones** (title, description, deadline, SOL amount).
3. Submitting **claim evidence** when a milestone is delivered.

When a creator claims a milestone, **token holders vote** with weight
proportional to their balance at a snapshot slot recorded at claim time
(prevents last-minute token buying for vote manipulation). Voting runs
for 72 hours. After the window closes:

- **Majority approve** → escrow releases the milestone amount to the creator.
- **Majority reject** → funds stay locked, creator must re-claim with new evidence.

Holders gain real governance power. Creators gain accountability.

## Architecture

```
+--------------+     +----------------------+     +-------------------+
|  Bags token  | --> |  Royalty webhook     | --> |  Helius enhanced  |
|  trading vol |     |  (Helius monitors    |     |  webhook payload  |
|              |     |   creator wallet)    |     |                   |
+--------------+     +----------+-----------+     +---------+---------+
                                |                           |
                                v                           v
                       +--------+--------+         +--------+--------+
                       |  Next.js 14     |         | /api/webhooks/  |
                       |  dashboard +    | <-----> | royalty (logs   |
                       |  holder view    |         |  events)        |
                       +--------+--------+         +-----------------+
                                |
                                | (Privy wallet → Anchor client)
                                v
+----------------------------------------------------------------+
|  Solana program  bags_milestones                              |
|                                                                |
|  PDAs:                                                         |
|    vault       = ["vault",     mint]                           |
|    escrow      = ["escrow",    mint]      (holds locked SOL)   |
|    milestone   = ["milestone", vault, idx]                     |
|    vote        = ["vote",      milestone, voter]               |
|                                                                |
|  Instructions:                                                 |
|    initialize_vault, set_milestone, deposit_royalty,           |
|    claim_milestone, vote, finalize_milestone                   |
+----------------------------------------------------------------+
```

## Tech stack

| Layer            | Tech                                   |
| ---------------- | -------------------------------------- |
| Smart contract   | Rust + Anchor 0.31                     |
| Frontend         | Next.js 14 (App Router) + TypeScript   |
| Styling          | Tailwind CSS                           |
| Wallet           | [Privy](https://privy.io) (Bags official partner) |
| Token data       | Bags.fm REST API                       |
| Onchain data     | Helius (RPC + enhanced webhooks)       |
| Market data      | Birdeye                                |
| Chain            | Solana (devnet → mainnet-beta)         |

## Repository layout

```
bags-milestones/
├── programs/bags-milestones/   # Anchor program (Rust)
│   └── src/lib.rs              # All accounts + instructions
├── tests/bags-milestones.ts    # Anchor integration tests (12 tests, all green)
├── app/                        # Next.js frontend
│   └── src/
│       ├── app/                # routes (App Router)
│       │   ├── page.tsx        # / — landing + token search
│       │   ├── creator/        # /creator/[tokenId] — dashboard
│       │   ├── token/          # /token/[tokenId] — holder view + voting
│       │   └── api/webhooks/royalty/route.ts
│       ├── components/         # MilestoneCard, VotingPanel, EscrowBalance, …
│       └── lib/                # anchor.ts, bags.ts, helius.ts, birdeye.ts
└── Anchor.toml
```

## Smart contract API

| Instruction         | Caller         | Effect                                                  |
| ------------------- | -------------- | ------------------------------------------------------- |
| `initialize_vault`  | creator        | Creates `MilestoneVault` PDA + escrow PDA               |
| `set_milestone`     | creator        | Adds milestone (idempotent while `Pending`)             |
| `deposit_royalty`   | anyone         | Transfers SOL from depositor into escrow PDA            |
| `claim_milestone`   | creator        | Marks milestone `Claimed`, opens 72h voting window      |
| `vote`              | token holder   | Adds approve/reject weight = SPL balance                |
| `finalize_milestone`| anyone (perm.) | After voting ends, releases or keeps funds based on tally |

Vote weight is the holder's SPL token balance at the snapshot slot recorded
at claim time. Voting is single-shot per holder per milestone (enforced via
a `VoteRecord` PDA seeded by milestone + voter).

## Running locally

### Prerequisites

- Rust 1.85+ (`rustup update stable`)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) 3.0+
- Anchor 0.31.1 (`cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.31.1`)
- Node 20+ and `pnpm`

### Smart contract

```bash
# Build
anchor build

# Run all 12 integration tests against a local validator
anchor test
```

### Frontend

```bash
cd app
cp .env.example .env.local   # fill in keys
pnpm install
pnpm dev
```

### Devnet deployment

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 3                              # fund deploy keypair
anchor deploy --provider.cluster devnet
```

The repo currently uses program ID
`FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz` on devnet.

## Tests

12 integration tests cover:

- `initialize_vault` happy path
- `set_milestone`: creator-only, deadline validation, max-5 enforcement
- `deposit_royalty`: balance accounting, zero-amount rejection
- `claim_milestone`: status transition + voting window setup
- `vote`: weight accumulation, double-vote rejection, non-holder rejection
- `finalize_milestone`: rejects before voting window ends

Run them locally with `anchor test` (uses a local validator — no devnet
funding required).

## Hackathon submission notes

- **Bags integration:** The dashboard pulls token info, holder lists, and
  pending royalty estimates via `https://api.bags.fm`. Helius enhanced
  webhooks watch the creator wallet for incoming SOL so the UI can prompt
  "you have undeposited royalties to lock".
- **Open source:** All code in this repo, MIT-licensed.
- **Live demo:** Devnet deployment + recorded walkthrough video on the
  DoraHacks submission page.

## License

MIT
