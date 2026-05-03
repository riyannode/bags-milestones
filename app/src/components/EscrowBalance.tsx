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
    <div className="glass relative overflow-hidden rounded-2xl p-6">
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-40" />
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          Escrow balance
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tracking-tight text-fg">
            {formatSol(totalLamports)}
          </span>
        </div>
      </div>

      <div
        className="mt-5 flex h-3 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="transition-all"
          style={{
            width: `${lockedPct}%`,
            background: "var(--primary)",
            boxShadow: "0 0 14px rgba(157,255,61,0.55)",
          }}
        />
        <div
          className="transition-all"
          style={{
            width: `${releasedPct}%`,
            background: "var(--success)",
          }}
        />
        <div
          className="transition-all"
          style={{
            width: `${idlePct}%`,
            background: "rgba(255,255,255,0.08)",
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--primary)" }}
            />
            Locked
          </div>
          <div className="mt-0.5 font-mono text-fg">{formatSol(locked)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--success)" }}
            />
            Released
          </div>
          <div className="mt-0.5 font-mono text-fg">{formatSol(released)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "rgba(255,255,255,0.2)" }}
            />
            Idle
          </div>
          <div className="mt-0.5 font-mono text-fg">
            {formatSol(Math.max(0, totalLamports - locked))}
          </div>
        </div>
      </div>
    </div>
  );
}
