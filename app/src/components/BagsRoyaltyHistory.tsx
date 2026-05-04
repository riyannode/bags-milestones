"use client";

import { useEffect, useState } from "react";
import { explorerUrl } from "@/lib/anchor";
import { getRoyaltyHistory } from "@/lib/bags";
import { formatSol, shortAddr } from "@/lib/format";
import type { BagsRoyaltyEvent } from "@/types";

interface BagsRoyaltyHistoryProps {
  mint: string;
  /** How many recent events to render. Default 5. */
  limit?: number;
}

/**
 * Recent royalty distributions for a Bags token.
 *
 * Pulled from the Bags `/tokens/{mint}/royalties` endpoint. Falls back to a
 * "no events" state when Bags returns nothing — this is the expected shape
 * for tokens too new to have distributed any royalty yet.
 */
export function BagsRoyaltyHistory({ mint, limit = 5 }: BagsRoyaltyHistoryProps) {
  const [events, setEvents] = useState<BagsRoyaltyEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await getRoyaltyHistory(mint);
      if (!cancelled) setEvents(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const total =
    events?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />

      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            Bags royalties · history
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tracking-tight text-fg">
            {events === null
              ? "…"
              : events.length > 0
                ? formatSol(total)
                : "0 SOL"}
          </div>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          Distributed lifetime
          <div className="mt-0.5 font-mono text-fg/80 normal-case tracking-normal">
            via /tokens/{shortAddr(mint, 4, 4)}/royalties
          </div>
        </div>
      </div>

      <div className="mt-4">
        {events === null ? (
          <RowSkeleton count={limit} />
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-xs text-fg-muted">
            No Bags royalty events yet — this is normal for new tokens.
            Distributions will appear here once Bags emits them.
          </div>
        ) : (
          <ol className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-white/[0.015]">
            {events.slice(0, limit).map((e) => (
              <li
                key={e.txSignature}
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-glow-soft"
                    aria-hidden
                  />
                  <span className="truncate font-mono text-fg-muted">
                    {formatRelative(e.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-fg">
                    +{formatSol(e.amount, 3)}
                  </span>
                  <a
                    href={explorerUrl(e.txSignature)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-fg-muted hover:text-primary"
                    title={e.txSignature}
                  >
                    {shortAddr(e.txSignature, 4, 4)} ↗
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function RowSkeleton({ count }: { count: number }) {
  return (
    <ol className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-white/[0.015]">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
        >
          <span className="h-3 w-24 rounded bg-white/[0.04]" />
          <span className="h-3 w-16 rounded bg-white/[0.04]" />
        </li>
      ))}
    </ol>
  );
}

const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelative(unixSecs: number): string {
  const diff = unixSecs - Math.floor(Date.now() / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return RTF.format(Math.round(diff), "second");
  if (abs < 3600) return RTF.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diff / 3600), "hour");
  return RTF.format(Math.round(diff / 86400), "day");
}
