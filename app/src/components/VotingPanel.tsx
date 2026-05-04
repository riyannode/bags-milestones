"use client";

import { useEffect, useMemo, useState } from "react";
import type { MilestoneView } from "@/types";

interface VotingPanelProps {
  milestone: MilestoneView;
  /** User's weight at the snapshot slot (token base units). */
  userSnapshotWeight: bigint;
  /** True while the snapshot+proof is still being fetched. */
  proofLoading: boolean;
  /** Quorum threshold in basis points (e.g. 500 = 5%). */
  quorumBps: number;
  hasVoted: boolean;
  onVote: (approve: boolean) => void | Promise<void>;
  isVoting: boolean;
}

/**
 * Renders for `milestone.status === "claimed"`. Shows live tally, a
 * circular countdown to `votingEnds`, the user's snapshot weight, the
 * quorum progress, and approve / reject buttons (disabled if the user
 * already voted, has zero balance, or the window has closed).
 */

const VOTING_DURATION_S = 72 * 60 * 60;

function bigintToNumber(b: bigint): number {
  // Snapshot supply fits in u64; converting to Number is fine for display
  // (loses precision above 2^53, but that's larger than any practical mint).
  return Number(b);
}

function formatHMS(secs: number): { h: string; m: string; s: string } {
  const h = Math.max(0, Math.floor(secs / 3600));
  const m = Math.max(0, Math.floor((secs % 3600) / 60));
  const s = Math.max(0, secs % 60);
  return {
    h: h.toString().padStart(2, "0"),
    m: m.toString().padStart(2, "0"),
    s: s.toString().padStart(2, "0"),
  };
}

function CountdownRing({
  remainingSecs,
  durationSecs,
  ended,
}: {
  remainingSecs: number;
  durationSecs: number;
  ended: boolean;
}) {
  // Tickets the user how much of the 72h window is left as a circular
  // progress ring. Animated through CSS via stroke-dashoffset.
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const elapsedRatio = Math.min(
    1,
    Math.max(0, 1 - remainingSecs / durationSecs),
  );
  const dashOffset = circumference * elapsedRatio;
  const { h, m, s } = formatHMS(remainingSecs);

  // Color shifts amber as window closes. When < 1h, deep amber. When ended, muted.
  const stroke = ended
    ? "var(--fg-muted)"
    : remainingSecs < 3600
      ? "var(--warning)"
      : "var(--primary)";
  const glow = ended
    ? "none"
    : remainingSecs < 3600
      ? "drop-shadow(0 0 6px rgba(245,158,11,0.6))"
      : "drop-shadow(0 0 6px rgba(157,255,61,0.55))";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16">
        <svg
          viewBox="0 0 64 64"
          className="h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: glow, transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
            {ended ? "Closed" : "Ends"}
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          Voting window
        </div>
        {ended ? (
          <div className="mt-0.5 font-mono text-base font-semibold text-fg-muted">
            window closed
          </div>
        ) : (
          <div className="mt-0.5 flex items-baseline gap-1 font-mono text-base font-semibold tabular-nums text-fg">
            <span>{h}</span>
            <span className="text-fg-muted/60">:</span>
            <span>{m}</span>
            <span className="text-fg-muted/60">:</span>
            <span className={remainingSecs < 3600 ? "text-warning" : "text-fg"}>
              {s}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function VoteBar({
  label,
  weight,
  totalWeight,
  color,
  glow,
}: {
  label: string;
  weight: number;
  totalWeight: number;
  color: string;
  glow: string;
}) {
  const pct = totalWeight ? (weight / totalWeight) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-fg-muted">
        <span>{label}</span>
        <span className="font-mono normal-case tracking-normal text-fg">
          {weight.toLocaleString()} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: glow,
          }}
        />
      </div>
    </div>
  );
}

export function VotingPanel({
  milestone,
  userSnapshotWeight,
  proofLoading,
  quorumBps,
  hasVoted,
  onVote,
  isVoting,
}: VotingPanelProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSecs = milestone.votingEnds - now;
  const ended = remainingSecs <= 0;

  const approveNum = bigintToNumber(milestone.votesApprove);
  const rejectNum = bigintToNumber(milestone.votesReject);
  const totalVotes = approveNum + rejectNum;
  const supplyNum = bigintToNumber(milestone.snapshotTotalSupply);
  const userWeightNum = bigintToNumber(userSnapshotWeight);

  // Quorum threshold in raw token units.
  const quorumThreshold = useMemo(
    () => Math.floor((supplyNum * quorumBps) / 10_000),
    [supplyNum, quorumBps],
  );
  const quorumPct =
    quorumThreshold > 0
      ? Math.min(100, (totalVotes / quorumThreshold) * 100)
      : 0;
  const quorumMet = totalVotes >= quorumThreshold && quorumThreshold > 0;
  const turnoutPct = supplyNum > 0 ? (totalVotes / supplyNum) * 100 : 0;

  // What % the approve / reject bar would jump to if the user clicked now.
  const previewApprove =
    totalVotes + userWeightNum > 0
      ? ((approveNum + userWeightNum) / (totalVotes + userWeightNum)) * 100
      : 0;
  const previewReject =
    totalVotes + userWeightNum > 0
      ? ((rejectNum + userWeightNum) / (totalVotes + userWeightNum)) * 100
      : 0;

  const canVote =
    !hasVoted &&
    userSnapshotWeight > 0n &&
    !ended &&
    !proofLoading &&
    !isVoting;

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
      {/* Header: countdown ring + status pill */}
      <div className="flex items-start justify-between gap-3">
        <CountdownRing
          remainingSecs={remainingSecs}
          durationSecs={VOTING_DURATION_S}
          ended={ended}
        />
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: ended
              ? "rgba(255,255,255,0.04)"
              : "rgba(157,255,61,0.1)",
            color: ended ? "var(--fg-muted)" : "var(--primary)",
            border: `1px solid ${ended ? "var(--border)" : "rgba(157,255,61,0.3)"}`,
          }}
        >
          {!ended && (
            <span className="h-1.5 w-1.5 animate-twinkle rounded-full bg-primary" />
          )}
          {ended ? "Voting closed" : "Voting open"}
        </span>
      </div>

      {/* Tallies */}
      <div className="mt-4 space-y-3">
        <VoteBar
          label="Approve"
          weight={approveNum}
          totalWeight={totalVotes}
          color="var(--success)"
          glow="0 0 14px rgba(71,255,96,0.4)"
        />
        <VoteBar
          label="Reject"
          weight={rejectNum}
          totalWeight={totalVotes}
          color="var(--destructive)"
          glow="0 0 14px rgba(255,77,77,0.4)"
        />
      </div>

      {/* Quorum + turnout */}
      <div className="mt-4 rounded-xl border border-border bg-white/[0.02] p-3">
        <div className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.18em] text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: quorumMet ? "var(--success)" : "var(--warning)",
              }}
            />
            Quorum · {(quorumBps / 100).toFixed(2)}% of supply
          </span>
          <span className="font-mono normal-case tracking-normal text-fg">
            {quorumMet ? "met" : `${quorumPct.toFixed(1)}% reached`}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${quorumPct}%`,
              background: quorumMet ? "var(--success)" : "var(--warning)",
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-fg-muted">
          <span>Total turnout</span>
          <span className="font-mono normal-case tracking-normal text-fg-muted">
            {turnoutPct.toFixed(2)}% · {totalVotes.toLocaleString()} /{" "}
            {supplyNum.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Voter context: snapshot weight + impact preview */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">
            Your snapshot weight
          </div>
          <div className="font-mono text-sm text-fg">
            {userWeightNum.toLocaleString()}
            {proofLoading && (
              <span className="ml-2 text-xs text-fg-muted/70">
                · building proof…
              </span>
            )}
          </div>
        </div>
        {canVote && userWeightNum > 0 && (
          <div className="mt-2 grid gap-1 rounded-lg border border-border/70 bg-white/[0.015] px-3 py-2 font-mono text-[10px] text-fg-muted sm:grid-cols-2">
            <div>
              Approve →{" "}
              <span className="text-success">
                {previewApprove.toFixed(1)}%
              </span>
            </div>
            <div>
              Reject →{" "}
              <span className="text-destructive">
                {previewReject.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={!canVote}
            onClick={() => onVote(true)}
            className="group inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-bg shadow-glow-success transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--success)" }}
          >
            <span aria-hidden className="text-base leading-none">
              ▲
            </span>
            {isVoting ? "Voting…" : "Approve"}
          </button>
          <button
            disabled={!canVote}
            onClick={() => onVote(false)}
            className="group inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white shadow-glow-destructive transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--destructive)" }}
          >
            <span aria-hidden className="text-base leading-none">
              ▼
            </span>
            {isVoting ? "Voting…" : "Reject"}
          </button>
        </div>
      </div>

      {/* Footer status messages */}
      {hasVoted && (
        <p className="mt-3 text-xs text-fg-muted">
          You&rsquo;ve already voted on this milestone.
        </p>
      )}
      {!hasVoted && !proofLoading && userSnapshotWeight === 0n && !ended && (
        <p className="mt-3 text-xs text-fg-muted">
          You held no tokens at the snapshot slot, so you can&rsquo;t vote on
          this milestone.
        </p>
      )}
      {ended && !quorumMet && (
        <p className="mt-3 text-xs text-warning">
          Quorum was not reached — this milestone will resolve as{" "}
          <span className="font-semibold">rejected</span> when finalised.
        </p>
      )}
    </div>
  );
}
