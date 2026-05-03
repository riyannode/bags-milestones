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
        className="btn-ghost rounded-lg px-4 py-2 text-sm"
      >
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
      >
        Connect wallet
      </button>
    );
  }

  const sol = user?.linkedAccounts.find(
    (a) =>
      a.type === "wallet" &&
      (a as { chainType?: string }).chainType === "solana",
  ) as { address: string } | undefined;

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-lg px-3 py-2 font-mono text-xs text-primary"
        style={{
          background: "rgba(157,255,61,0.06)",
          border: "1px solid rgba(157,255,61,0.25)",
          boxShadow: "0 0 14px rgba(157,255,61,0.15)",
        }}
      >
        {sol ? shortAddr(sol.address) : "no Solana wallet"}
      </span>
      <button
        onClick={logout}
        className="btn-ghost rounded-lg px-3 py-2 text-xs"
      >
        Disconnect
      </button>
    </div>
  );
}
