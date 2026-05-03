"use client";

/**
 * Privy provider — official Bags partner. Configures Solana embedded wallets
 * + external connectors (Phantom, Backpack, etc.) for the entire app.
 */

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { ReactNode } from "react";

export function PrivyClientProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <div className="p-4 text-sm text-amber-400 bg-amber-950/30 rounded">
        Missing <code>NEXT_PUBLIC_PRIVY_APP_ID</code>. Wallet features disabled.
        {children}
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#a855f7",
          logo: undefined,
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
