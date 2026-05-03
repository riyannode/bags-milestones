"use client";

import { usePrivy } from "@privy-io/react-auth";
import { shortAddr } from "@/lib/format";

/**
 * Connect / disconnect button that surfaces the user's primary Solana
 * address. Falls back to a disabled placeholder when Privy isn't
 * configured (e.g. local dev without an app ID).
 */
export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return (
      <button
        disabled
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-400"
      >
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
      >
        Connect wallet
      </button>
    );
  }

  const sol = user?.linkedAccounts.find((a) => a.type === "wallet" && (a as { chainType?: string }).chainType === "solana") as
    | { address: string }
    | undefined;

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-200">
        {sol ? shortAddr(sol.address) : "no Solana wallet"}
      </span>
      <button
        onClick={logout}
        className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
      >
        Disconnect
      </button>
    </div>
  );
}
