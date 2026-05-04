"use client";

import { useEffect, useState } from "react";
import type { MilestoneView } from "@/types";
import { timeRemaining } from "@/lib/format";

interface VotingPanelProps {
  milestone: MilestoneView;
  /** User's weight at the snapshot slot (token base units). */
  userSnapshotWeight: bigint;
  /** True while the snapshot+proof is still being fetched. */
  proofLoading: boolean;
  hasVoted: boolean;
  onVote: (approve: boolean) => void | Promise<void>;
  isVoting: boolean;
}

/**
 * Renders for `milestone.status === "claimed"`. Shows live tally, a
 * countdown to `votingEnds`, the user's current weight, and approve /
 * reject buttons (disabled if user already voted or has zero balance).
 */
function bigintToNumber(b: bigint): number {
  // Snapshot supply fits in u64; converting to Number is fine for display
  // (loses precision above 2^53, but that's larger than any practical mint).
  return Number(b);
}

export function VotingPanel({
  milestone,
  userSnapshotWeight,
  proofLoading,
  hasVoted,
  onVote,
  isVoting,
}: VotingPanelProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const approveNum = bigintToNumber(milestone.votesApprove);
  const rejectNum = bigintToNumber(milestone.votesReject);
  const totalVotes = approveNum + rejectNum;
  const approvePct = totalVotes ? (approveNum / totalVotes) * 100 : 50;
  const rejectPct = totalVotes ? (rejectNum / totalVotes) * 100 : 50;
  const supplyNum = bigintToNumber(milestone.snapshotTotalSupply);
  const turnoutPct = supplyNum > 0 ? (totalVotes / supplyNum) * 100 : 0;
  const ended = now >= milestone.votingEnds;
  const canVote =
    !hasVoted && userSnapshotWeight > 0n && !ended && !proofLoading;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(180deg, rgba(157,255,61,0.06) 0%, rgba(255,255,255,0) 60%), rgba(255,255,255,0.02)",
        border: "1px solid rgba(157,255,61,0.22)",
        boxShadow: "0 0 22px rgba(157,255,61,0.1)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          <span className="h-1.5 w-1.5 animate-twinkle rounded-full bg-primary" />
          Voting open
        </h3>
        <span className="font-mono text-xs text-fg-muted">
          {ended ? "ended" : `ends in ${timeRemaining(milestone.votingEnds)}`}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-fg-muted">
            <span>Approve</span>
            <span className="font-mono normal-case tracking-normal text-fg">
              {approveNum.toLocaleString()} ({approvePct.toFixed(1)}%)
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${approvePct}%`,
                background: "var(--success)",
                boxShadow: "0 0 14px rgba(71,255,96,0.4)",
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-fg-muted">
            <span>Reject</span>
            <span className="font-mono normal-case tracking-normal text-fg">
              {rejectNum.toLocaleString()} ({rejectPct.toFixed(1)}%)
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${rejectPct}%`,
                background: "var(--destructive)",
                boxShadow: "0 0 14px rgba(255,77,77,0.4)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-fg-muted">
        <span>Turnout</span>
        <span className="font-mono normal-case tracking-normal text-fg">
          {turnoutPct.toFixed(1)}% of snapshot
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">
          Your snapshot weight ·{" "}
          <span className="font-mono normal-case tracking-normal text-fg">
            {bigintToNumber(userSnapshotWeight).toLocaleString()}
          </span>
          {proofLoading && (
            <span className="ml-2 normal-case text-fg-muted/70">· building proof…</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            disabled={!canVote || isVoting}
            onClick={() => onVote(true)}
            className="rounded-lg px-3 py-2 text-xs font-medium text-bg shadow-glow-success transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--success)" }}
          >
            Approve
          </button>
          <button
            disabled={!canVote || isVoting}
            onClick={() => onVote(false)}
            className="rounded-lg px-3 py-2 text-xs font-medium text-white shadow-glow-destructive transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--destructive)" }}
          >
            Reject
          </button>
        </div>
      </div>

      {hasVoted && (
        <p className="mt-3 text-xs text-fg-muted">You&rsquo;ve already voted.</p>
      )}
      {!hasVoted && !proofLoading && userSnapshotWeight === 0n && !ended && (
        <p className="mt-3 text-xs text-fg-muted">
          You held no tokens at the snapshot slot, so you can&rsquo;t vote on this
          milestone.
        </p>
      )}
    </div>
  );
}
