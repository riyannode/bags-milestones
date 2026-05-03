import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { CreatorDashboard } from "@/components/CreatorDashboard";

interface PageProps {
  params: { tokenId: string };
}

export default function CreatorDashboardPage({ params }: PageProps) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back
        </Link>
        <WalletConnect />
      </header>
      <CreatorDashboard tokenId={params.tokenId} />
    </main>
  );
}
