"use client";

import { useCallback, useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useBagsMilestones } from "@/lib/useBagsMilestones";
import { loadVault } from "@/lib/loadVault";
import { explorerUrl } from "@/lib/anchor";
import { shortAddr } from "@/lib/format";
import { EscrowBalance } from "./EscrowBalance";
import { MilestoneCard } from "./MilestoneCard";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { UndepositedRoyaltiesPanel } from "./UndepositedRoyaltiesPanel";
import type { MilestoneView, VaultView } from "@/types";
import { getCreatorRoyalties } from "@/lib/bags";
import { invalidateSnapshot, loadSnapshotMerkle } from "@/lib/snapshot";

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
      <div className="glass mt-12 rounded-2xl p-6 text-center text-fg-muted">
        Connect your wallet to manage milestones for this token.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Header card */}
      <div className="glass relative overflow-hidden rounded-2xl p-6">
        <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow-soft" />
              Creator dashboard
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Manage milestones
            </h1>
            <p className="font-mono text-xs text-fg-muted">
              {shortAddr(tokenId, 6, 6)}
            </p>
          </div>
          {!vault && (
            <button
              disabled={busy !== null}
              onClick={() => wrap("init", () => initializeVault(tokenId))}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
            >
              {busy === "init" ? "Initializing…" : "Initialize vault"}
            </button>
          )}
        </div>
      </div>

      {!vault ? (
        <div className="glass rounded-2xl p-6 text-fg-muted">
          No vault exists for this token yet. Initialize one to start
          committing milestones.
        </div>
      ) : (
        <>
          {!isCreator && (
            <div
              className="rounded-2xl p-4 text-sm"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "#fde68a",
              }}
            >
              Connected wallet ({shortAddr(walletAddress)}) is not the creator
              of this vault ({shortAddr(vault.creator)}). Read-only.
            </div>
          )}

          {/* Bento: escrow balance + undeposited royalties */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <EscrowBalance
                totalLamports={vault.escrowBalance}
                milestones={milestones}
              />
            </div>
            {isCreator && (
              <div className="lg:col-span-2">
                <UndepositedRoyaltiesPanel
                  pendingLamports={pendingRoyalties}
                  escrowedLamports={vault.escrowBalance}
                  busy={busy === "deposit"}
                  onDeposit={(lamports) =>
                    wrap("deposit", () =>
                      depositRoyalty(tokenId, lamports),
                    )
                  }
                />
              </div>
            )}
          </div>

          {/* Milestone slot overview — always visible, even for non-creators. */}
          <MilestoneTimeline milestones={milestones} />

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
                  userSnapshotWeight={0n}
                  proofLoading={false}
                  hasVoted={false}
                  isCreator={Boolean(isCreator)}
                  isVoting={false}
                  isClaiming={busy === `claim-${m.index}`}
                  isFinalizing={busy === `finalize-${m.index}`}
                  onVote={() => Promise.resolve()}
                  onClaim={(url) =>
                    wrap(`claim-${m.index}`, async () => {
                      // Build the holder snapshot Merkle tree at claim time.
                      // The root + total supply commit on-chain so holders
                      // later can verify their voting weight.
                      const tree = await loadSnapshotMerkle(tokenId);
                      if (tree.totalSupply <= 0n) {
                        throw new Error(
                          "No holders found in snapshot. Cannot claim.",
                        );
                      }
                      const sig = await claimMilestone(
                        tokenId,
                        m.index,
                        url,
                        tree.root,
                        tree.totalSupply,
                      );
                      invalidateSnapshot(tokenId);
                      return sig;
                    })
                  }
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

      {lastTx && (
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
            href={explorerUrl(lastTx)}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddr(lastTx, 8, 8)} ↗
          </a>
        </div>
      )}
      {error && (
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
          <div className="break-all text-fg/85">{error}</div>
        </div>
      )}
    </div>
  );
}

const TITLE_MAX = 64;
const DESC_MAX = 256;
const MAX_MILESTONES = 5;

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
  const disabled = nextIndex >= MAX_MILESTONES;

  const deadlineTs = deadline
    ? Math.floor(new Date(deadline).getTime() / 1000)
    : 0;
  const nowTs = Math.floor(Date.now() / 1000);
  const deadlineInPast = deadlineTs > 0 && deadlineTs <= nowTs;

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const canSubmit =
    !disabled &&
    !busy &&
    title.trim().length > 0 &&
    deadlineTs > 0 &&
    !deadlineInPast &&
    amountValid;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(nextIndex, title.trim(), description.trim(), deadlineTs, amountNum);
        setTitle("");
        setDescription("");
        setDeadline("");
        setAmount("");
      }}
      className="glass relative overflow-hidden rounded-2xl p-6"
    >
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-fg-muted">
            New milestone · M-{(nextIndex + 1).toString().padStart(2, "0")} / {MAX_MILESTONES.toString().padStart(2, "0")}
          </div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            {disabled
              ? "All slots committed"
              : `Slot ${nextIndex + 1} of ${MAX_MILESTONES}`}
          </h3>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: disabled ? "var(--fg-muted)" : "var(--primary)" }}
        >
          {disabled ? "max reached" : canSubmit ? "ready" : "draft"}
        </span>
      </div>
      {disabled ? (
        <p className="mt-3 text-sm text-fg-muted">
          Maximum of {MAX_MILESTONES} milestones reached. To add more, finish
          the existing roadmap.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-fg-muted">
              <span>Title</span>
              <span className="font-mono">
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="e.g. Ship v1.0 release"
              className="w-full rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus:border-primary/40 focus:outline-none"
            />
          </label>
          <label>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-fg-muted">
              <span>Deadline</span>
              {deadlineInPast && (
                <span className="font-mono text-destructive">in past</span>
              )}
            </div>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-border bg-white/[0.02] px-3 py-2 font-mono text-sm text-fg focus:border-primary/40 focus:outline-none"
              style={{
                borderColor: deadlineInPast
                  ? "rgba(255,77,77,0.45)"
                  : undefined,
              }}
            />
          </label>
          <label>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-fg-muted">
              <span>Amount</span>
              <span className="font-mono">SOL</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.50"
              className="w-full rounded-lg border border-border bg-white/[0.02] px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-muted/60 focus:border-primary/40 focus:outline-none"
            />
          </label>
          <label className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-fg-muted">
              <span>Description</span>
              <span className="font-mono">
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESC_MAX}
              placeholder="Acceptance criteria, evidence URL hint, anything holders need to evaluate."
              rows={3}
              className="w-full rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus:border-primary/40 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary rounded-lg px-3 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Creating…" : `Commit M-${(nextIndex + 1).toString().padStart(2, "0")} →`}
          </button>
        </div>
      )}
    </form>
  );
}
