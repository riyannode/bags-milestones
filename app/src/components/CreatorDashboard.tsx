"use client";

import { useCallback, useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useBagsMilestones } from "@/lib/useBagsMilestones";
import { loadVault } from "@/lib/loadVault";
import { explorerUrl } from "@/lib/anchor";
import { formatSol, shortAddr } from "@/lib/format";
import { EscrowBalance } from "./EscrowBalance";
import { MilestoneCard } from "./MilestoneCard";
import type { MilestoneView, VaultView } from "@/types";
import { getCreatorRoyalties } from "@/lib/bags";

interface CreatorDashboardProps {
  tokenId: string;
}

export function CreatorDashboard({ tokenId }: CreatorDashboardProps) {
  const {
    walletAddress,
    initializeVault,
    setMilestone,
    depositRoyalty,
    claimMilestone,
    finalizeMilestone,
  } = useBagsMilestones();

  const [vault, setVault] = useState<VaultView | null>(null);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [pendingRoyalties, setPendingRoyalties] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await loadVault(tokenId);
      if (cancelled) return;
      setVault(data?.vault ?? null);
      setMilestones(data?.milestones ?? []);
      if (data?.vault.creator) {
        const r = await getCreatorRoyalties(data.vault.creator);
        if (!cancelled) setPendingRoyalties(r?.pendingAmount ?? 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, refreshKey]);

  const isCreator =
    walletAddress && vault && walletAddress === vault.creator;

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

  if (!walletAddress) {
    return (
      <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-zinc-400">
        Connect your wallet to manage milestones for this token.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Creator dashboard
          </h1>
          <p className="text-sm text-zinc-500 font-mono">
            {shortAddr(tokenId, 6, 6)}
          </p>
        </div>
        {!vault ? (
          <button
            disabled={busy !== null}
            onClick={() => wrap("init", () => initializeVault(tokenId))}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {busy === "init" ? "Initializing…" : "Initialize vault"}
          </button>
        ) : null}
      </div>

      {!vault ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
          No vault exists for this token yet. Initialize one to start
          committing milestones.
        </div>
      ) : (
        <>
          {!isCreator && (
            <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
              Connected wallet ({shortAddr(walletAddress)}) is not the creator
              of this vault ({shortAddr(vault.creator)}). Read-only.
            </div>
          )}

          <EscrowBalance
            totalLamports={vault.escrowBalance}
            milestones={milestones}
          />

          {isCreator && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h3 className="text-sm uppercase tracking-wider text-zinc-400">
                Royalties
              </h3>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-zinc-300">
                  Pending royalties on Bags:{" "}
                  <span className="font-mono">
                    {formatSol(pendingRoyalties)}
                  </span>
                </div>
                <DepositForm
                  busy={busy === "deposit"}
                  onDeposit={(sol) =>
                    wrap("deposit", () =>
                      depositRoyalty(tokenId, Math.floor(sol * LAMPORTS_PER_SOL)),
                    )
                  }
                />
              </div>
            </div>
          )}

          {isCreator && (
            <NewMilestoneForm
              existingCount={milestones.length}
              busy={busy === "milestone"}
              onSubmit={(idx, t, d, deadline, amountSol) =>
                wrap("milestone", () =>
                  setMilestone(
                    tokenId,
                    idx,
                    t,
                    d,
                    deadline,
                    Math.floor(amountSol * LAMPORTS_PER_SOL),
                  ),
                )
              }
            />
          )}

          <div className="space-y-4">
            {milestones.map((m) => (
              <MilestoneCard
                key={m.index}
                milestone={m}
                userTokenBalance={0}
                hasVoted={false}
                isCreator={Boolean(isCreator)}
                isVoting={false}
                isClaiming={busy === `claim-${m.index}`}
                isFinalizing={busy === `finalize-${m.index}`}
                onVote={() => Promise.resolve()}
                onClaim={(url) =>
                  wrap(`claim-${m.index}`, () =>
                    claimMilestone(tokenId, m.index, url),
                  )
                }
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

function DepositForm({
  onDeposit,
  busy,
}: {
  onDeposit: (sol: number) => void;
  busy: boolean;
}) {
  const [v, setV] = useState("0.5");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(v);
        if (n > 0) onDeposit(n);
      }}
      className="flex gap-2"
    >
      <input
        type="number"
        step="0.01"
        min="0"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-28 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
      >
        {busy ? "Depositing…" : "Deposit SOL"}
      </button>
    </form>
  );
}

function NewMilestoneForm({
  existingCount,
  busy,
  onSubmit,
}: {
  existingCount: number;
  busy: boolean;
  onSubmit: (
    index: number,
    title: string,
    description: string,
    deadline: number,
    amountSol: number,
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [amount, setAmount] = useState("");

  const nextIndex = existingCount;
  const disabled = nextIndex >= 5;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title || !deadline || !amount) return;
        const ts = Math.floor(new Date(deadline).getTime() / 1000);
        onSubmit(nextIndex, title, description, ts, Number(amount));
        setTitle("");
        setDescription("");
        setDeadline("");
        setAmount("");
      }}
      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
    >
      <h3 className="text-sm uppercase tracking-wider text-zinc-400">
        New milestone {nextIndex + 1}/5
      </h3>
      {disabled ? (
        <p className="mt-3 text-sm text-zinc-500">
          Maximum of 5 milestones reached.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={64}
            placeholder="Title"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={256}
            placeholder="Description"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none sm:col-span-2"
            rows={2}
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="SOL to lock"
              className="w-40 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Add milestone"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
