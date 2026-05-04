import Link from "next/link";
import { loadTopTokens, type TopTokenRow } from "@/lib/topTokens";
import { formatSol, shortAddr } from "@/lib/format";

const NUMBER_FMT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${NUMBER_FMT.format(n)}`;
}

function StatusDot({ row }: { row: TopTokenRow }) {
  // Visual state: green = funds released, lime + pulse = locked & active,
  // gray = empty/idle. Pulse only on the "active" state so it reads as
  // a live indicator without the rest of the table feeling jittery.
  if (row.releasedLamports > 0) {
    return (
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: "var(--success)",
          boxShadow: "0 0 8px rgba(71,255,96,0.6)",
        }}
        aria-label="released"
      />
    );
  }
  if (row.lockedLamports > 0) {
    return (
      <span
        className="pulse-active inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: "var(--primary)",
          boxShadow: "0 0 8px rgba(157,255,61,0.6)",
        }}
        aria-label="locked"
      />
    );
  }
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-fg-muted/40"
      aria-label="idle"
    />
  );
}

/** Server Component: pre-renders the top-tokens table at request time. */
export async function TopTokensTable() {
  const rows = await loadTopTokens();
  const top = rows.slice(0, 10);

  return (
    <section className="mt-24" id="top-tokens">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            Live leaderboard
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Top tokens by royalty volume
          </h2>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">
            Sorted by 24h trading volume (Birdeye). Only tokens with a live
            Bagscrow vault are listed — every row below has on-chain milestones
            you can audit.
          </p>
        </div>
      </div>

      {top.length === 0 ? (
        <div className="glass mt-6 rounded-2xl p-6 text-fg-muted">
          No vaults have been initialised yet on this cluster. Be the first —{" "}
          <Link href="/creator" className="text-primary hover:underline">
            commit a milestone
          </Link>
          .
        </div>
      ) : (
        <div className="glass mt-6 overflow-hidden rounded-2xl">
          <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-fg-muted">
                  <th className="px-5 py-3 font-normal">#</th>
                  <th className="px-3 py-3 font-normal">Token</th>
                  <th className="px-3 py-3 text-right font-normal">Price</th>
                  <th className="px-3 py-3 text-right font-normal">
                    24h volume
                  </th>
                  <th className="px-3 py-3 text-right font-normal">
                    Market cap
                  </th>
                  <th className="px-3 py-3 text-right font-normal">Locked</th>
                  <th className="px-3 py-3 text-right font-normal">Released</th>
                  <th className="px-3 py-3 text-right font-normal">
                    Milestones
                  </th>
                  <th className="px-5 py-3 font-normal" />
                </tr>
              </thead>
              <tbody>
                {top.map((row, i) => (
                  <tr
                    key={row.mint}
                    className="group border-b border-border/60 transition-colors last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4 font-mono text-fg-muted">
                      {(i + 1).toString().padStart(2, "0")}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <StatusDot row={row} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">
                            {row.symbol ?? row.name ?? "Unknown"}
                          </div>
                          <div className="truncate font-mono text-[11px] text-fg-muted">
                            {shortAddr(row.mint, 4, 4)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-fg">
                      {formatUsd(row.price)}
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-fg">
                      {formatUsd(row.volume24h)}
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-fg-muted">
                      {formatUsd(row.marketCap)}
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-fg">
                      {formatSol(row.lockedLamports, 2)}
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-fg-muted">
                      {formatSol(row.releasedLamports, 2)}
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-fg-muted">
                      {row.milestoneCount}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/token/${row.mint}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-fg-muted transition-colors group-hover:border-primary/40 group-hover:text-primary"
                      >
                        View
                        <span aria-hidden>→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
