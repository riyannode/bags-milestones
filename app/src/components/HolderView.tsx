"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useBagsMilestones } from "@/lib/useBagsMilestones";
import { loadVault } from "@/lib/loadVault";
import {
  explorerUrl,
  findMilestonePda,
  findVaultPda,
  findVotePda,
  getConnection,
  getProgram,
} from "@/lib/anchor";
import { shortAddr } from "@/lib/format";
import { EscrowBalance } from "./EscrowBalance";
import { MilestoneCard } from "./MilestoneCard";
import { HolderSnapshot } from "./HolderSnapshot";
import { BagsRoyaltyHistory } from "./BagsRoyaltyHistory";
import type {
  BagsHolder,
  BagsTokenInfo,
  MilestoneView,
  VaultView,
} from "@/types";
import { getHolders, getTokenInfo } from "@/lib/bags";
import { getTokenOverview } from "@/lib/birdeye";
import { getHolderBalance } from "@/lib/helius";
import { loadSnapshotMerkle } from "@/lib/snapshot";
import type { SnapshotMerkle } from "@/lib/merkle";
import { BN } from "@coral-xyz/anchor";

interface HolderViewProps {
  tokenId: string;
}

export function HolderView({ tokenId }: HolderViewProps) {
  const { walletAddress, vote, finalizeMilestone } = useBagsMilestones();

  const [vault, setVault] = useState<VaultView | null>(null);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [holders, setHolders] = useState<BagsHolder[]>([]);
  const [tokenInfo, setTokenInfo] = useState<BagsTokenInfo | null>(null);
  const [marketCap, setMarketCap] = useState<number | null>(null);
  const [vol24h, setVol24h] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [snapshotTree, setSnapshotTree] = useState<SnapshotMerkle | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
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
      setTokenInfo(info);
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

  // Build the snapshot Merkle tree whenever there's at least one claimed
  // milestone the user might want to vote on. Cached at the lib layer for
  // 30s so simultaneous renders don't fan out to multiple RPC calls.
  const hasClaimedMilestone = useMemo(
    () => milestones.some((m) => m.status === "claimed"),
    [milestones],
  );
  useEffect(() => {
    if (!hasClaimedMilestone) {
      setSnapshotTree(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    void (async () => {
      try {
        const tree = await loadSnapshotMerkle(tokenId);
        if (!cancelled) setSnapshotTree(tree);
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, hasClaimedMilestone, refreshKey]);

  const userSnapshotWeight = useMemo<bigint>(() => {
    if (!walletAddress || !snapshotTree) return 0n;
    const entry = snapshotTree.entries.find((e) => e.wallet === walletAddress);
    return entry?.balance ?? 0n;
  }, [walletAddress, snapshotTree]);

  // Detect which (if any) of the currently-claimed milestones the connected
  // wallet has already voted on. We index by milestone index because the
  // VoteRecord PDA seed is keyed by (milestone PDA, voter, claim_timestamp).
  const [votedIndexes, setVotedIndexes] = useState<Set<number>>(new Set());
  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setVotedIndexes(new Set());
      return;
    }
    const claimed = milestones.filter((m) => m.status === "claimed");
    if (claimed.length === 0) {
      setVotedIndexes(new Set());
      return;
    }
    void (async () => {
      try {
        const connection = getConnection();
        const program = getProgram(connection, undefined);
        const voter = new PublicKey(walletAddress);
        const vaultPda = findVaultPda(new PublicKey(tokenId));
        const voteRecordPdas = claimed.map((m) =>
          findVotePda(
            findMilestonePda(vaultPda, m.index),
            voter,
            new BN(m.claimTimestamp),
          ),
        );
        const accounts = await program.account.voteRecord.fetchMultiple(
          voteRecordPdas,
        );
        if (cancelled) return;
        const next = new Set<number>();
        accounts.forEach((acc, i) => {
          if (acc) next.add(claimed[i].index);
        });
        setVotedIndexes(next);
      } catch {
        if (!cancelled) setVotedIndexes(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tokenId, milestones, refreshKey]);

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
      {/* Token header */}
      <div className="glass relative overflow-hidden rounded-2xl p-6">
        <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Bags token image, when available. Falls back silently. */}
            {tokenInfo?.imageUrl && (
              <span
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-white/[0.02]"
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tokenInfo.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow-soft" />
                Holder view
              </div>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
                {tokenInfo?.name ?? tokenInfo?.symbol ?? "Bags token"}
              </h1>
              <p className="font-mono text-xs text-fg-muted">
                {shortAddr(tokenId, 6, 6)}
              </p>
              {(tokenInfo?.creator || tokenInfo?.royaltyPercent != null) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
                  {tokenInfo?.creator && (
                    <span className="inline-flex items-center gap-1">
                      Creator
                      <a
                        href={`https://explorer.solana.com/address/${tokenInfo.creator}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-fg/85 hover:text-primary"
                      >
                        {shortAddr(tokenInfo.creator, 4, 4)} ↗
                      </a>
                    </span>
                  )}
                  {tokenInfo?.royaltyPercent != null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
                      {tokenInfo.royaltyPercent}% royalty
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {(marketCap !== null || vol24h !== null) && (
            <div className="flex flex-wrap gap-3">
              {marketCap !== null && (
                <Stat
                  label="Market cap"
                  value={`$${(marketCap / 1_000).toFixed(1)}k`}
                />
              )}
              {vol24h !== null && (
                <Stat
                  label="24h volume"
                  value={`$${(vol24h / 1_000).toFixed(1)}k`}
                />
              )}
              {walletAddress && (
                <Stat
                  label="Your balance"
                  value={userBalance.toLocaleString()}
                  accent
                />
              )}
            </div>
          )}
        </div>
      </div>

      {!vault ? (
        <div className="glass rounded-2xl p-6 text-fg-muted">
          This token has not opted into Bags Milestones yet.
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <EscrowBalance
                totalLamports={vault.escrowBalance}
                milestones={milestones}
              />
            </div>
            <HolderSnapshot
              holders={holders}
              highlightWallet={walletAddress}
            />
          </div>

          <BagsRoyaltyHistory mint={tokenId} limit={5} />

          <div className="space-y-4">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-fg-muted">
              Milestones · {milestones.length}
            </h2>
            {milestones.length === 0 ? (
              <div className="glass rounded-2xl p-5 text-sm text-fg-muted">
                No milestones committed yet.
              </div>
            ) : (
              milestones.map((m) => (
                <MilestoneCard
                  key={m.index}
                  milestone={m}
                  userSnapshotWeight={userSnapshotWeight}
                  proofLoading={snapshotLoading}
                  quorumBps={vault.quorumBps}
                  hasVoted={votedIndexes.has(m.index)}
                  isCreator={false}
                  isVoting={busy === `vote-${m.index}`}
                  isClaiming={false}
                  isFinalizing={busy === `finalize-${m.index}`}
                  onVote={(approve) =>
                    wrap(`vote-${m.index}`, async () => {
                      if (!walletAddress)
                        throw new Error("Connect wallet to vote");
                      if (!snapshotTree)
                        throw new Error(
                          "Snapshot still loading. Try again in a moment.",
                        );
                      const proof = snapshotTree.proof(walletAddress);
                      if (!proof)
                        throw new Error(
                          "You held no tokens at the snapshot slot. Cannot vote.",
                        );
                      return vote(
                        tokenId,
                        m.index,
                        approve,
                        userSnapshotWeight,
                        proof,
                      );
                    })
                  }
                  onClaim={() => Promise.resolve()}
                  onFinalize={() =>
                    wrap(`finalize-${m.index}`, () =>
                      finalizeMilestone(tokenId, m.index, vault.creator),
                    )
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {lastTx && <TxBanner sig={lastTx} />}
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2 ${
        accent ? "border border-primary/30 bg-primary/5" : "border border-border bg-white/[0.02]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono text-sm ${accent ? "text-primary" : "text-fg"}`}
      >
        {value}
      </div>
    </div>
  );
}

function TxBanner({ sig }: { sig: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3 text-xs"
      style={{
        background: "rgba(71,255,96,0.08)",
        border: "1px solid rgba(71,255,96,0.3)",
        boxShadow: "0 0 18px rgba(71,255,96,0.15)",
      }}
    >
      <span className="font-mono uppercase tracking-[0.2em] text-success">
        Tx submitted
      </span>
      <a
        className="font-mono text-success hover:underline"
        href={explorerUrl(sig)}
        target="_blank"
        rel="noreferrer"
      >
        {shortAddr(sig, 8, 8)} ↗
      </a>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs"
      style={{
        background: "rgba(255,77,77,0.08)",
        border: "1px solid rgba(255,77,77,0.3)",
      }}
    >
      <div className="mb-1 font-mono uppercase tracking-[0.2em] text-destructive">
        Error
      </div>
      <div className="break-all text-fg/85">{message}</div>
    </div>
  );
}
