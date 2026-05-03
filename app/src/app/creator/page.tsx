import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { TokenSearchToCreator } from "@/components/TokenSearchToCreator";
import { Logo } from "@/components/Logo";

export default function CreatorRootPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-fg-muted hover:text-fg"
          >
            ← Back
          </Link>
          <WalletConnect />
        </div>
      </header>

      <section className="mt-20 text-center sm:mt-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary shadow-glow-soft">
          For Bags creators
        </div>
        <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Set up your{" "}
          <span className="text-primary [text-shadow:0_0_30px_rgba(157,255,61,0.45)]">
            Milestones
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-fg-muted">
          Enter your Bags creator-token mint to open your dashboard. You stay
          fully non-custodial — Bagscrow only holds royalties you explicitly
          deposit.
        </p>
        <div className="mt-10">
          <TokenSearchToCreator />
        </div>
      </section>
    </main>
  );
}
