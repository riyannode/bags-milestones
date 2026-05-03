"use client";

import { useEffect, useState } from "react";
import type { MilestoneView } from "@/types";
import { formatSol, timeRemaining } from "@/lib/format";

interface VotingPanelProps {
  milestone: MilestoneView;
  userTokenBalance: number;
  hasVoted: boolean;
  onVote: (approve: boolean) => void | Promise<void>;
  isVoting: boolean;
}

/**
 * Renders for `milestone.status === "claimed"`. Shows live tally, a
 * countdown to `votingEnds`, the user's current weight, and approve /
 * reject buttons (disabled if user already voted or has zero balance).
 */
export function VotingPanel({
  milestone,
  userTokenBalance,
  hasVoted,
  onVote,
  isVoting,
}: VotingPanelProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const totalVotes = milestone.votesApprove + milestone.votesReject;
  const approvePct = totalVotes ? (milestone.votesApprove / totalVotes) * 100 : 50;
  const rejectPct = totalVotes ? (milestone.votesReject / totalVotes) * 100 : 50;
  const ended = now >= milestone.votingEnds;
  const canVote = !hasVoted && userTokenBalance > 0 && !ended;

  return (
    <div className="rounded-2xl border border-purple-700/50 bg-purple-950/20 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-300">
          Voting open
        </h3>
        <span className="font-mono text-sm text-zinc-300">
          {ended ? "ended" : `ends in ${timeRemaining(milestone.votingEnds)}`}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Approve</span>
          <span>
            {formatSol(milestone.votesApprove, 0)} ({approvePct.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${approvePct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Reject</span>
          <span>
            {formatSol(milestone.votesReject, 0)} ({rejectPct.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-rose-500"
            style={{ width: `${rejectPct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-400">
          Your weight:{" "}
          <span className="font-mono text-zinc-200">
            {userTokenBalance.toLocaleString()}
          </span>{" "}
          tokens
        </div>
        <div className="flex gap-2">
          <button
            disabled={!canVote || isVoting}
            onClick={() => onVote(true)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={!canVote || isVoting}
            onClick={() => onVote(false)}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>

      {hasVoted && (
        <p className="mt-3 text-xs text-zinc-500">You&rsquo;ve already voted.</p>
      )}
      {!hasVoted && userTokenBalance === 0 && !ended && (
        <p className="mt-3 text-xs text-zinc-500">
          Hold the token to gain voting weight.
        </p>
      )}
    </div>
  );
}
