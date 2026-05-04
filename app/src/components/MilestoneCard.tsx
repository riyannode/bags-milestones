"use client";

import type { MilestoneView } from "@/types";
import { formatDeadline, formatSol } from "@/lib/format";
import { VotingPanel } from "./VotingPanel";

interface MilestoneCardProps {
  milestone: MilestoneView;
  /** User's weight at the snapshot slot for this milestone (token base units). */
  userSnapshotWeight: bigint;
  /** True while the snapshot+proof is still being fetched for the holder. */
  proofLoading: boolean;
  /** Quorum threshold in basis points (passed through to VotingPanel). */
  quorumBps: number;
  hasVoted: boolean;
  isCreator: boolean;
  isVoting: boolean;
  isClaiming: boolean;
  isFinalizing: boolean;
  onVote: (approve: boolean) => void | Promise<void>;
  onClaim: (evidenceUrl: string) => void | Promise<void>;
  onFinalize: () => void | Promise<void>;
}

export function MilestoneCard({
  milestone,
  userSnapshotWeight,
  proofLoading,
  quorumBps,
  hasVoted,
  isCreator,
  isVoting,
  isClaiming,
  isFinalizing,
  onVote,
  onClaim,
  onFinalize,
}: MilestoneCardProps) {
  const pillClass: Record<MilestoneView["status"], string> = {
    pending: "pill-pending",
    claimed: "pill-claimed",
    approved: "pill-approved",
    rejected: "pill-rejected",
  };

  const wrapperClass =
    milestone.status === "claimed" ? "glass-strong" : "glass";

  return (
    <div className={`${wrapperClass} relative overflow-hidden rounded-2xl p-5`}>
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            <span>M-{(milestone.index + 1).toString().padStart(2, "0")}</span>
            <span>·</span>
            <span>{formatDeadline(milestone.deadline)}</span>
          </div>
          <h2 className="mt-1.5 truncate text-lg font-semibold tracking-tight text-fg">
            {milestone.title}
          </h2>
          {milestone.description && (
            <p className="mt-1 text-sm text-fg-muted">
              {milestone.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${pillClass[milestone.status]}`}
        >
          {milestone.status}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          Locked
        </span>
        <span className="font-mono text-xl text-fg">
          {formatSol(milestone.amountLocked)}
        </span>
      </div>

      {milestone.evidenceUrl && (
        <div className="mt-3 text-xs">
          <a
            href={milestone.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary hover:underline"
          >
            evidence ↗
          </a>
        </div>
      )}

      {milestone.status === "claimed" && (
        <div className="mt-4">
          <VotingPanel
            milestone={milestone}
            userSnapshotWeight={userSnapshotWeight}
            proofLoading={proofLoading}
            quorumBps={quorumBps}
            hasVoted={hasVoted}
            onVote={onVote}
            isVoting={isVoting}
          />
          {Math.floor(Date.now() / 1000) >= milestone.votingEnds && (
            <button
              onClick={onFinalize}
              disabled={isFinalizing}
              className="btn-ghost mt-3 w-full rounded-lg py-2 text-sm"
            >
              {isFinalizing ? "Finalizing…" : "Finalize milestone"}
            </button>
          )}
        </div>
      )}

      {isCreator &&
        (milestone.status === "pending" || milestone.status === "rejected") && (
          <ClaimForm onClaim={onClaim} isClaiming={isClaiming} />
        )}
    </div>
  );
}

function ClaimForm({
  onClaim,
  isClaiming,
}: {
  onClaim: (evidenceUrl: string) => void | Promise<void>;
  isClaiming: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const url = String(fd.get("evidence") ?? "");
        if (url) void onClaim(url);
      }}
      className="mt-4 flex gap-2"
    >
      <input
        name="evidence"
        type="url"
        required
        placeholder="Evidence URL (Twitter, GitHub, demo video…)"
        className="flex-1 rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus:border-primary/40 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isClaiming}
        className="btn-primary rounded-lg px-3 py-2 text-sm font-medium"
      >
        {isClaiming ? "Claiming…" : "Claim done"}
      </button>
    </form>
  );
}
