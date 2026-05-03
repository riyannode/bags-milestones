import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { TokenSearch } from "@/components/TokenSearch";
import { Constellation } from "@/components/Constellation";
import { Logo } from "@/components/Logo";

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
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary shadow-glow-soft">
          <span className="h-1.5 w-1.5 animate-twinkle rounded-full bg-primary" />
          On-chain accountability for Bags creator tokens
        </div>

        <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Lock royalties.{" "}
          <span className="text-primary [text-shadow:0_0_30px_rgba(157,255,61,0.45)]">
            Vote milestones.
          </span>
          <br className="hidden sm:block" /> Build trust.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-fg-muted">
          <span className="font-mono text-primary">Bagscrow</span> is the
          accountability layer for Bags.fm creators. Royalties lock in an
          on-chain escrow. Token holders vote to release them as creators ship
          milestones. No more vibes-only tokens.
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
            Set up Milestones
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          <span>Solana · Devnet live</span>
          <span className="text-fg-muted/40">·</span>
          <span>Anchor smart contract</span>
          <span className="text-fg-muted/40">·</span>
          <span>14 / 14 tests passing</span>
        </div>
      </section>

      <section id="how" className="mt-28 grid gap-5 sm:grid-cols-3">
        {[
          {
            n: "01",
            t: "Creators commit",
            d: "Up to 5 milestones with deadlines and SOL amounts. Royalties lock in a program-owned escrow.",
            accent: "primary",
          },
          {
            n: "02",
            t: "Holders vote",
            d: "Vote weight = token balance at the snapshot slot. Last-minute buys can't sway the result.",
            accent: "warning",
          },
          {
            n: "03",
            t: "Funds unlock",
            d: "Majority approve → royalties release to the creator. Reject → funds stay locked until the next claim.",
            accent: "success",
          },
        ].map((s) => (
          <div
            key={s.n}
            className="glass relative overflow-hidden rounded-2xl p-5"
          >
            <div className="bg-dotgrid absolute inset-0 -z-10 opacity-40" />
            <div
              className="font-mono text-xs uppercase tracking-[0.2em]"
              style={{ color: `var(--${s.accent})` }}
            >
              STEP {s.n}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-tight">
              {s.t}
            </div>
            <p className="mt-2 text-sm text-fg-muted">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Escrow scheme", v: "Program-PDA · non-custodial" },
          { k: "Voting window", v: "72h · snapshot at claim" },
          { k: "Replay-safe", v: "Per-claim vote PDA" },
          { k: "Built on", v: "Bags · Helius · Privy" },
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
