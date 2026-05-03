import { formatSol } from "@/lib/format";
import type { MilestoneView } from "@/types";

interface EscrowBalanceProps {
  totalLamports: number;
  milestones: MilestoneView[];
}

/**
 * Visualises locked vs unlocked escrow as a stacked bar.
 *  - Approved milestones contribute to "released".
 *  - Pending / Claimed contribute to "locked".
 *  - Rejected contribute to "remaining" (still in escrow but not earmarked).
 */
export function EscrowBalance({ totalLamports, milestones }: EscrowBalanceProps) {
  const locked = milestones
    .filter((m) => m.status === "pending" || m.status === "claimed")
    .reduce((acc, m) => acc + m.amountLocked, 0);
  const released = milestones
    .filter((m) => m.status === "approved")
    .reduce((acc, m) => acc + m.amountLocked, 0);
  const total = Math.max(totalLamports + released, locked + released, 1);

  const lockedPct = (locked / total) * 100;
  const releasedPct = (released / total) * 100;
  const idlePct = Math.max(0, 100 - lockedPct - releasedPct);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm uppercase tracking-wider text-zinc-400">
          Escrow balance
        </h3>
        <span className="font-mono text-2xl text-zinc-100">
          {formatSol(totalLamports)}
        </span>
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-purple-500" style={{ width: `${lockedPct}%` }} />
        <div className="bg-emerald-500" style={{ width: `${releasedPct}%` }} />
        <div className="bg-zinc-700" style={{ width: `${idlePct}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
        <div>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-500" />
          Locked {formatSol(locked)}
        </div>
        <div>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Released {formatSol(released)}
        </div>
        <div>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-zinc-600" />
          Idle {formatSol(Math.max(0, totalLamports - locked))}
        </div>
      </div>
    </div>
  );
}
