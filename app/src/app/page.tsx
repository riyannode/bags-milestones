import { Suspense } from "react";
import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { TokenSearch } from "@/components/TokenSearch";
import { Constellation } from "@/components/Constellation";
import { Logo } from "@/components/Logo";
import { TopTokensTable } from "@/components/TopTokensTable";
import { TOP_TOKENS_REVALIDATE_S } from "@/lib/topTokens";

// The leaderboard depends on on-chain data + Birdeye; revalidate every minute.
export const revalidate = TOP_TOKENS_REVALIDATE_S;

function TopTokensFallback() {
  return (
    <section className="mt-24">
      <div className="glass mt-6 rounded-2xl p-6 text-fg-muted">
        Loading on-chain leaderboard…
      </div>
    </section>
  );
}

/** Inline SVG icons sized for the step-card glyph slot. Currentcolor keeps
 * them tinted by the per-step accent without an extra prop. */
const ICON = {
  lock: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  check: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  unlock: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </svg>
  ),
};

const STEPS = [
  {
    n: "01",
    accent: "primary",
    icon: ICON.lock,
    t: "Lock royalties",
    d: "Creator launches a vault for their Bags token and commits up to 5 milestones with SOL amounts and deadlines. Royalties auto-deposit into a program-owned escrow.",
  },
  {
    n: "02",
    accent: "warning",
    icon: ICON.check,
    t: "Claim with proof",
    d: "On the deadline, the creator submits delivery evidence. Holder list is snapshotted into a Merkle root — voting weight is locked, late buyers get zero say.",
  },
  {
    n: "03",
    accent: "success",
    icon: ICON.unlock,
    t: "Holders vote → release",
    d: "72-hour window. Majority approve + 5% supply quorum → SOL releases to the creator. Reject → funds stay locked, creator re-claims within 7 days.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="relative mx-auto max-w-6xl px-6 py-8">
      {/* Hero constellation backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden">
        <Constellation className="absolute inset-0 h-full w-full opacity-90" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 320px at 50% 10%, rgba(157,255,61,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,15,0) 0%, var(--bg) 100%)",
          }}
        />
      </div>

      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href="/creator"
            className="hidden rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg sm:inline-flex"
          >
            For creators
          </Link>
          <WalletConnect />
        </div>
      </header>

      <section className="mt-20 text-center sm:mt-28">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="mx-auto mt-10 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary shadow-glow-soft">
          <span className="h-1.5 w-1.5 animate-twinkle rounded-full bg-primary" />
          On-chain accountability for Bags creator tokens
        </div>

        <h1 className="mt-6 font-display text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Building{" "}
          <span className="text-glow-primary text-primary">real trust</span>
          <br className="hidden sm:block" /> between Bags creators and holders.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-fg-muted">
          Creators commit milestones. Holders vote on royalty releases. An
          on-chain escrow with{" "}
          <span className="font-mono text-primary">Merkle-snapshot voting</span>{" "}
          keeps both sides honest — no last-minute whales, no off-chain
          promises.
        </p>

        <div className="mt-10">
          <TokenSearch />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="#how"
            className="btn-ghost rounded-lg px-4 py-2"
          >
            How it works
          </Link>
          <Link
            href="/creator"
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium"
          >
            Launch a vault
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-10 flex flex-col items-center gap-y-2 text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span>Snapshot voting</span>
            <span className="text-fg-muted/40">·</span>
            <span>5% quorum</span>
            <span className="text-fg-muted/40">·</span>
            <span>72h windows</span>
            <span className="text-fg-muted/40">·</span>
            <span>Devnet</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span>Anchor</span>
            <span className="text-fg-muted/40">·</span>
            <span>Helius</span>
            <span className="text-fg-muted/40">·</span>
            <span>Birdeye</span>
            <span className="text-fg-muted/40">·</span>
            <span>Privy</span>
            <span className="text-fg-muted/40">·</span>
            <span>Open source</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-fg-muted/70">
            <span>Built for The Bags Hackathon</span>
            <span className="text-fg-muted/40">·</span>
            <span>Solana devnet</span>
          </div>
        </div>
      </section>

      <section id="how" className="mt-28">
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            How it works
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Three steps from royalty to release.
          </h2>
        </div>

        <ol className="relative mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="glass group relative overflow-hidden rounded-2xl p-5 transition-colors hover:border-primary/30"
            >
              <div className="bg-dotgrid absolute inset-0 -z-10 opacity-40" />

              {/* Connector arrow between cards on desktop */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-fg-muted/30 sm:block"
                >
                  →
                </span>
              )}

              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-xs uppercase tracking-[0.2em]"
                  style={{ color: `var(--${s.accent})` }}
                >
                  STEP {s.n}
                </span>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: `var(--${s.accent})`,
                    background: `color-mix(in srgb, var(--${s.accent}) 12%, transparent)`,
                    color: `var(--${s.accent})`,
                  }}
                  aria-hidden
                >
                  {s.icon}
                </span>
              </div>

              <div className="mt-4 font-display text-lg font-semibold tracking-tight">
                {s.t}
              </div>
              <p className="mt-2 text-sm text-fg-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <Suspense fallback={<TopTokensFallback />}>
        <TopTokensTable />
      </Suspense>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Escrow scheme", v: "Program-PDA · non-custodial" },
          { k: "Voting weight", v: "Merkle snapshot at claim" },
          { k: "Voting window", v: "72h · 5% supply quorum" },
          { k: "Built on", v: "Bags · Helius · Birdeye · Privy" },
        ].map((m) => (
          <div key={m.k} className="glass rounded-xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-fg-muted">
              {m.k}
            </div>
            <div className="mt-1 font-mono text-sm text-fg">{m.v}</div>
          </div>
        ))}
      </section>

      <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-fg-muted">
        <span className="font-mono uppercase tracking-[0.2em]">
          Bagscrow · v0.2 · devnet
        </span>
        <span>
          Built for{" "}
          <a
            className="text-primary hover:underline"
            href="https://dorahacks.io/hackathon/the-bags-hackathon"
            target="_blank"
            rel="noreferrer"
          >
            The Bags Hackathon
          </a>
        </span>
      </footer>
    </main>
  );
}
