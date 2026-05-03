import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { TokenSearchToCreator } from "@/components/TokenSearchToCreator";

export default function CreatorRootPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back
        </Link>
        <WalletConnect />
      </header>

      <section className="mt-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Set up Milestones for your token
        </h1>
        <p className="mt-3 text-zinc-400">
          Enter your Bags creator-token mint address to open the dashboard.
        </p>
        <div className="mt-8">
          <TokenSearchToCreator />
        </div>
      </section>
    </main>
  );
}
