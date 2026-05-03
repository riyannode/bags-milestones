import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { CreatorDashboard } from "@/components/CreatorDashboard";
import { Logo } from "@/components/Logo";

interface PageProps {
  params: { tokenId: string };
}

export default function CreatorDashboardPage({ params }: PageProps) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
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
      <CreatorDashboard tokenId={params.tokenId} />
    </main>
  );
}
