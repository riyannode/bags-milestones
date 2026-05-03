"use client";

import { useCallback, useEffect, useState } from "react";
import { useBagsMilestones } from "@/lib/useBagsMilestones";
import { loadVault } from "@/lib/loadVault";
import { explorerUrl } from "@/lib/anchor";
import { shortAddr } from "@/lib/format";
import { EscrowBalance } from "./EscrowBalance";
import { MilestoneCard } from "./MilestoneCard";
import { HolderSnapshot } from "./HolderSnapshot";
import type { BagsHolder, MilestoneView, VaultView } from "@/types";
import { getHolders, getTokenInfo } from "@/lib/bags";
import { getTokenOverview } from "@/lib/birdeye";
import { getHolderBalance } from "@/lib/helius";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

interface HolderViewProps {
  tokenId: string;
}

export function HolderView({ tokenId }: HolderViewProps) {
  const { walletAddress, vote, finalizeMilestone } = useBagsMilestones();

  const [vault, setVault] = useState<VaultView | null>(null);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [holders, setHolders] = useState<BagsHolder[]>([]);
  const [tokenName, setTokenName] = useState<string | null>(null);
  const [marketCap, setMarketCap] = useState<number | null>(null);
  const [vol24h, setVol24h] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [v, h, info, overview] = await Promise.all([
        loadVault(tokenId),
        getHolders(tokenId, 50),
        getTokenInfo(tokenId),
        getTokenOverview(tokenId),
      ]);
      if (cancelled) return;
      setVault(v?.vault ?? null);
      setMilestones(v?.milestones ?? []);
      setHolders(h);
      setTokenName(info?.name ?? info?.symbol ?? null);
      setMarketCap(overview?.mc ?? null);
      setVol24h(overview?.v24hUSD ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!walletAddress) return setUserBalance(0);
      const bal = await getHolderBalance(walletAddress, tokenId);
      if (!cancelled) setUserBalance(bal);
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tokenId, refreshKey]);

  const wrap = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setError(null);
    try {
      const sig = await fn();
      setLastTx(sig);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tokenName ?? "Bags token"}
        </h1>
        <p className="text-sm text-zinc-500 font-mono">
          {shortAddr(tokenId, 6, 6)}
        </p>
        {(marketCap !== null || vol24h !== null) && (
          <div className="mt-2 flex gap-4 text-xs text-zinc-400">
            {marketCap !== null && (
              <span>
                MC ${(marketCap / 1_000).toFixed(1)}k
              </span>
            )}
            {vol24h !== null && (
              <span>
                24h vol ${(vol24h / 1_000).toFixed(1)}k
              </span>
            )}
          </div>
        )}
      </div>

      {!vault ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
          This token has not opted into Bags Milestones yet.
        </div>
      ) : (
        <>
          <EscrowBalance
            totalLamports={vault.escrowBalance}
            milestones={milestones}
          />

          <HolderSnapshot
            holders={holders}
            highlightWallet={walletAddress}
          />

          <div className="space-y-4">
            {milestones.map((m) => (
              <MilestoneCard
                key={m.index}
                milestone={m}
                userTokenBalance={userBalance}
                hasVoted={false}
                isCreator={false}
                isVoting={busy === `vote-${m.index}`}
                isClaiming={false}
                isFinalizing={busy === `finalize-${m.index}`}
                onVote={(approve) =>
                  wrap(`vote-${m.index}`, async () => {
                    if (!walletAddress) throw new Error("Connect wallet to vote");
                    const ata = getAssociatedTokenAddressSync(
                      new PublicKey(tokenId),
                      new PublicKey(walletAddress),
                    );
                    return vote(tokenId, m.index, approve, ata.toBase58());
                  })
                }
                onClaim={() => Promise.resolve()}
                onFinalize={() =>
                  wrap(`finalize-${m.index}`, () =>
                    finalizeMilestone(tokenId, m.index, vault.creator),
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {lastTx && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
          tx{" "}
          <a
            className="underline hover:text-emerald-100"
            href={explorerUrl(lastTx)}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddr(lastTx, 8, 8)}
          </a>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-3 text-xs text-rose-200 break-all">
          {error}
        </div>
      )}
    </div>
  );
}
