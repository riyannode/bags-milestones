"use client";

import type { MilestoneView } from "@/types";
import { formatDeadline, formatSol } from "@/lib/format";
import { VotingPanel } from "./VotingPanel";

interface MilestoneCardProps {
  milestone: MilestoneView;
  /** Token balance the connected user holds (0 if not connected / not a holder). */
  userTokenBalance: number;
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
  userTokenBalance,
  hasVoted,
  isCreator,
  isVoting,
  isClaiming,
  isFinalizing,
  onVote,
  onClaim,
  onFinalize,
}: MilestoneCardProps) {
  const statusStyles: Record<MilestoneView["status"], string> = {
    pending: "bg-zinc-800 text-zinc-300",
    claimed: "bg-purple-700 text-purple-50",
    approved: "bg-emerald-700 text-emerald-50",
    rejected: "bg-rose-800 text-rose-50",
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Milestone #{milestone.index + 1}</span>
            <span>·</span>
            <span>Deadline {formatDeadline(milestone.deadline)}</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            {milestone.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{milestone.description}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[milestone.status]}`}
        >
          {milestone.status}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Locked
        </span>
        <span className="font-mono text-lg text-zinc-100">
          {formatSol(milestone.amountLocked)}
        </span>
      </div>

      {milestone.evidenceUrl && (
        <div className="mt-3 text-xs">
          <a
            href={milestone.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:text-purple-300 break-all"
          >
            evidence ↗
          </a>
        </div>
      )}

      {milestone.status === "claimed" && (
        <div className="mt-4">
          <VotingPanel
            milestone={milestone}
            userTokenBalance={userTokenBalance}
            hasVoted={hasVoted}
            onVote={onVote}
            isVoting={isVoting}
          />
          {Math.floor(Date.now() / 1000) >= milestone.votingEnds && (
            <button
              onClick={onFinalize}
              disabled={isFinalizing}
              className="mt-3 w-full rounded-lg bg-zinc-800 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
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
        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isClaiming}
        className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
      >
        {isClaiming ? "Claiming…" : "Claim done"}
      </button>
    </form>
  );
}
