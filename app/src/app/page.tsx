import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { TokenSearch } from "@/components/TokenSearch";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
            Bags Milestones
          </span>
        </Link>
        <WalletConnect />
      </header>

      <section className="mt-16 text-center">
        <h1 className="bg-gradient-to-br from-zinc-50 via-purple-200 to-fuchsia-300 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
          Accountable royalties for Bags creators.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-zinc-400">
          Lock creator royalties in an on-chain escrow. Token holders vote to
          unlock funds when milestones are delivered. Built natively on Bags
          SDK + Helius.
        </p>

        <div className="mt-10">
          <TokenSearch />
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href="#how"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            How it works
          </Link>
          <Link
            href="/creator"
            className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500"
          >
            Are you a creator? Set up Milestones →
          </Link>
        </div>
      </section>

      <section id="how" className="mt-24 grid gap-5 sm:grid-cols-3">
        {[
          {
            n: "1",
            t: "Creator commits",
            d: "Up to 5 milestones with deadlines and SOL amounts. Royalties lock in escrow.",
          },
          {
            n: "2",
            t: "Holders vote",
            d: "Vote weight = token balance at the snapshot slot. No last-minute manipulation.",
          },
          {
            n: "3",
            t: "Funds unlock",
            d: "Majority approve → royalties release to creator. Reject → funds stay locked.",
          },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
          >
            <div className="text-xs font-mono text-purple-400">{`STEP ${s.n}`}</div>
            <div className="mt-2 text-base font-semibold">{s.t}</div>
            <p className="mt-1 text-sm text-zinc-400">{s.d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 border-t border-zinc-900 pt-6 text-xs text-zinc-500">
        Solana · Anchor · Bags SDK · Helius · Birdeye · Privy ·
        Built for{" "}
        <a
          className="text-purple-400 hover:text-purple-300"
          href="https://dorahacks.io/hackathon/the-bags-hackathon"
          target="_blank"
          rel="noreferrer"
        >
          The Bags Hackathon
        </a>
      </footer>
    </main>
  );
}
