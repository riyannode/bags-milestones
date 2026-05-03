---
name: bags-milestones-dev
description: Setup, build, test, and deploy notes for the Bags Milestones Anchor + Next.js dApp. Use when working in this repo.
---

# Bags Milestones — dev cheatsheet

## Toolchain

- Rust **1.85+** (`rustup update stable`)
- Solana CLI **3.0+** (`sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`) — installs to `~/.local/share/solana/install/active_release/bin`. Add to PATH.
- Anchor **0.31.1** (`cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.31.1 --force`).
- Node **20+** + `pnpm`.

## Smart contract

- Sources: `programs/bags-milestones/src/lib.rs`.
- Program ID (devnet): `FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz` (also baked into `declare_id!` and `Anchor.toml`).
- Build: `anchor build` (root). Outputs `target/deploy/bags_milestones.so` and `target/idl/bags_milestones.json`.
- IDL is copied into the frontend at `app/src/idl/bags_milestones.json` + `bags_milestones.ts`. **If you change the program, rebuild and copy both files.**
- Anchor.toml has `cluster = "localnet"` so `anchor test` uses a local validator — fast and SOL-free. Override with `--provider.cluster devnet` for deploy.
- `Cargo.toml` enables `init-if-needed` (`anchor-lang/init-if-needed`) and `anchor-spl/idl-build` — don't drop these or the build / IDL gen breaks.

## Tests (12 integration tests, all green)

```bash
anchor test                       # local validator, no devnet SOL needed
```

Tests live in `tests/bags-milestones.ts`. The test wallet is auto-funded by the local validator. Each `beforeEach` mints a fresh SPL token + funds 4 keypairs.

## Devnet deployment

The deploy keypair (`~/.config/solana/id.json`) needs ~3 SOL devnet (program rent-exempt = 2.22 SOL + tx fees). The Helius free-tier RPC airdrop is rate-limited to **1 SOL/day**. If blocked:

- Send devnet SOL from a funded wallet (Phantom / Backpack on devnet) to the keypair address.
- Or use `https://faucet.solana.com` (browser captcha; gives 5 SOL).

Deploy:

```bash
solana config set --url "https://devnet.helius-rpc.com/?api-key=$HELIUS_API_KEY"
anchor deploy --provider.cluster "https://devnet.helius-rpc.com/?api-key=$HELIUS_API_KEY"
```

## Frontend

```
cd app
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm lint
```

- TypeScript-strict; `pnpm exec tsc --noEmit` should be clean before pushing.
- `.env.local` (gitignored) has all keys. `.env.example` is the template.
- Privy uses `useSignTransaction` for tx signing — **don't** try to use Anchor's `provider.wallet.signTransaction` directly with Privy's wallet objects, the type signatures don't line up.
- `useBagsMilestones` hook (`app/src/lib/useBagsMilestones.ts`) wraps every program instruction. Call sites just `await initializeVault(mint)` etc.

## Frontend / wallet gotchas

- Privy peer deps `@farcaster/mini-app-solana@^1.0.0` and `@solana-program/memo` must be installed explicitly (`pnpm add` them) — they're optional peers but Webpack resolves them at build time.
- `helius-sdk` declares `react-native` as a peer; ignore — we never import it.
- `next lint` is strict about React entity escaping (`'`, `"`). Use `&apos;` / `&rsquo;` etc.

## Test accounts / secrets

Stored in **org / user secrets** (never commit):

- `HELIUS_API_KEY` — Helius enhanced API + RPC.
- `BIRDEYE_API_KEY` — Birdeye public-api key.
- `NEXT_PUBLIC_PRIVY_APP_ID` — Privy app ID for client SDK.

Devnet deploy keypair (`~/.config/solana/id.json`) is **session-local** by default — back it up before snapshotting if you want it persisted.

## Useful one-liners

- Compile + IDL: `anchor build`
- Local tests: `anchor test`
- Devnet deploy: `anchor deploy --provider.cluster devnet`
- Frontend prod build: `cd app && pnpm build`
- Typecheck only: `cd app && pnpm exec tsc --noEmit`
