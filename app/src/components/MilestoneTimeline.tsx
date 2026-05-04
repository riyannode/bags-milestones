import type { MilestoneView } from "@/types";

const MAX_MILESTONES = 5;

interface MilestoneTimelineProps {
  milestones: MilestoneView[];
}

const STATUS_STYLES: Record<
  MilestoneView["status"],
  { bg: string; ring: string; label: string }
> = {
  pending: {
    bg: "var(--primary)",
    ring: "rgba(157,255,61,0.5)",
    label: "Pending",
  },
  claimed: {
    bg: "var(--warning)",
    ring: "rgba(245,158,11,0.45)",
    label: "Voting",
  },
  approved: {
    bg: "var(--success)",
    ring: "rgba(71,255,96,0.45)",
    label: "Approved",
  },
  rejected: {
    bg: "var(--destructive)",
    ring: "rgba(255,77,77,0.4)",
    label: "Rejected",
  },
};

/**
 * Compact horizontal timeline showing each of the (up-to) 5 milestone
 * slots, colour-coded by status. Empty slots render as outlined ghosts so
 * the creator can see how many they have left at a glance.
 */
export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  const slots = Array.from({ length: MAX_MILESTONES }, (_, i) => milestones[i]);
  const used = milestones.length;

  return (
    <div className="glass relative overflow-hidden rounded-2xl px-5 py-4">
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            Milestone slots
          </div>
          <div className="mt-0.5 font-mono text-sm text-fg">
            {used} <span className="text-fg-muted">/ {MAX_MILESTONES}</span>{" "}
            committed
          </div>
        </div>
        <div className="flex items-center gap-2">
          {slots.map((m, i) => {
            if (!m) {
              return (
                <div
                  key={i}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border font-mono text-[9px] text-fg-muted/60"
                  title={`Slot ${i + 1} · empty`}
                >
                  {i + 1}
                </div>
              );
            }
            const s = STATUS_STYLES[m.status];
            return (
              <div
                key={i}
                title={`M-${(i + 1).toString().padStart(2, "0")} · ${s.label} · ${m.title}`}
                className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[9px] font-semibold text-bg"
                style={{
                  background: s.bg,
                  boxShadow: `0 0 12px ${s.ring}`,
                  color: "var(--bg)",
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
