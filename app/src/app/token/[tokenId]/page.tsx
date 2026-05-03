import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { HolderView } from "@/components/HolderView";

interface PageProps {
  params: { tokenId: string };
}

export default function TokenHolderPage({ params }: PageProps) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back
        </Link>
        <WalletConnect />
      </header>
      <HolderView tokenId={params.tokenId} />
    </main>
  );
}
