"use client";

/**
 * Privy provider — official Bags partner. Configures Solana embedded wallets
 * + external connectors for the entire app.
 *
 * Wallet UX is Solana-first: Phantom / Backpack / Solflare are pinned to the
 * top of the connect modal, then any other Wallet Standard adapter Privy
 * detects locally, then WalletConnect (QR) for mobile wallets. Email login
 * is kept as a fallback so non-crypto-native users can still onboard via
 * Privy embedded wallet.
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
          accentColor: "#9dff3d",
          logo: undefined,
          walletChainType: "solana-only",
          showWalletLoginFirst: true,
          walletList: [
            "phantom",
            "backpack",
            "solflare",
            "detected_solana_wallets",
            "wallet_connect_qr_solana",
          ],
        },
        loginMethods: ["wallet", "email"],
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
