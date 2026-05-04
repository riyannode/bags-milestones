"use client";

import { useEffect, useState } from "react";
import { explorerUrl } from "@/lib/anchor";
import { formatSol, shortAddr } from "@/lib/format";

interface ApiResponse {
  enabled: boolean;
  events: Array<{
    signature: string;
    timestamp: number;
    lamports: number;
    type: string;
    fromWallet?: string;
  }>;
  totalLamports: number;
  lastSeenAt: number;
}

interface LiveRoyaltyFeedProps {
  /** Creator wallet address. */
  wallet: string;
  /** Polling interval in ms. Default 30s. */
  refreshMs?: number;
}

/**
 * Shows the most recent royalty arrivals for a creator wallet, sourced
 * from the Helius webhook → Vercel KV pipeline. The panel deliberately
 * opts into client-side polling rather than `revalidate`, because the
 * value of this view is "did SOL just arrive in the last few seconds?"
 * — stale ISR would defeat the purpose.
 */
export function LiveRoyaltyFeed({
  wallet,
  refreshMs = 30_000,
}: LiveRoyaltyFeedProps) {
  const [state, setState] = useState<ApiResponse | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `/api/royalties/${wallet}?limit=10`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as ApiResponse;
        if (!cancelled) setState(data);
      } catch {
        // network blip — next interval will retry
      }
    };
    void fetchOnce();
    const id = setInterval(fetchOnce, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [wallet, refreshMs]);

  // KV not configured → don't render anything (don't bother the user
  // with infrastructure status).
  if (state && state.enabled === false) return null;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />

      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            <span
              className="h-1.5 w-1.5 rounded-full bg-success shadow-glow-soft pulse-active"
              aria-hidden
            />
            Live royalty feed
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tracking-tight text-fg">
            {state === null
              ? "…"
              : formatSol(state.totalLamports)}
          </div>
          <div className="mt-0.5 text-[11px] text-fg-muted">
            Lifetime royalty arrivals · via Helius webhook → Redis
          </div>
        </div>
        {state?.lastSeenAt ? (
          <div className="text-right text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            Last seen
            <div className="mt-0.5 font-mono text-fg/80 normal-case tracking-normal">
              {formatRelative(state.lastSeenAt)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {state === null ? (
          <RowSkeleton count={3} />
        ) : state.events.length === 0 ? (
          <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-xs text-fg-muted">
            No royalty deposits captured yet. Once Helius forwards a
            transaction for this creator wallet, it appears here within
            seconds.
          </div>
        ) : (
          <ol className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-white/[0.015]">
            {state.events.map((e) => (
              <li
                key={`${e.signature}-${e.timestamp}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-glow-soft"
                    aria-hidden
                  />
                  <span className="truncate font-mono text-fg-muted">
                    {formatRelative(e.timestamp)}
                  </span>
                  {e.fromWallet ? (
                    <span className="truncate font-mono text-fg-muted/70">
                      from {shortAddr(e.fromWallet, 4, 4)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-fg">
                    +{formatSol(e.lamports, 3)}
                  </span>
                  <a
                    href={explorerUrl(e.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-fg-muted hover:text-primary"
                    title={e.signature}
                  >
                    {shortAddr(e.signature, 4, 4)} ↗
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
          <span className="h-3 w-32 rounded bg-white/[0.04]" />
          <span className="h-3 w-20 rounded bg-white/[0.04]" />
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
