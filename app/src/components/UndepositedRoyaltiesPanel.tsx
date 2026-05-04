"use client";

import { useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { formatSol } from "@/lib/format";

interface UndepositedRoyaltiesPanelProps {
  /** Lamports the creator has earned on Bags but not yet pulled into escrow. */
  pendingLamports: number;
  /** Lamports currently sitting in the on-chain escrow PDA. */
  escrowedLamports: number;
  /** True while a deposit tx is in-flight. */
  busy: boolean;
  /** Submitted amount, lamports. Caller is responsible for the actual tx. */
  onDeposit: (lamports: number) => void;
}

/**
 * "Undeposited royalties → Escrow" panel for the creator dashboard.
 *
 * Shows the unbridged amount prominently, exposes a one-click "Deposit all"
 * CTA that auto-fills with the pending amount, and falls back to a manual
 * amount input for partial deposits.
 */
export function UndepositedRoyaltiesPanel({
  pendingLamports,
  escrowedLamports,
  busy,
  onDeposit,
}: UndepositedRoyaltiesPanelProps) {
  const [custom, setCustom] = useState("");

  const totalKnown = pendingLamports + escrowedLamports;
  const escrowedPct =
    totalKnown > 0 ? (escrowedLamports / totalKnown) * 100 : 0;
  const pendingPct = Math.max(0, 100 - escrowedPct);

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const sol = Number(custom);
    if (!Number.isFinite(sol) || sol <= 0) return;
    onDeposit(Math.floor(sol * LAMPORTS_PER_SOL));
    setCustom("");
  };

  const depositAll = () => {
    if (pendingLamports <= 0) return;
    onDeposit(pendingLamports);
  };

  const hasPending = pendingLamports > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: hasPending
          ? "linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(255,255,255,0.02) 65%)"
          : "rgba(255,255,255,0.02)",
        border: hasPending
          ? "1px solid rgba(245,158,11,0.32)"
          : "1px solid var(--border)",
        boxShadow: hasPending ? "0 0 22px rgba(245,158,11,0.10)" : "none",
      }}
    >
      <div className="bg-dotgrid absolute inset-0 -z-10 opacity-30" />

      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-warning">
            {hasPending ? (
              <span className="h-1.5 w-1.5 animate-twinkle rounded-full bg-warning" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-fg-muted/40" />
            )}
            Undeposited royalties
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold tracking-tight text-fg">
            {formatSol(pendingLamports)}
          </div>
          <div className="mt-0.5 text-[11px] text-fg-muted">
            sitting on Bags · not yet in escrow
          </div>
        </div>
      </div>

      {/* Bridged-vs-unbridged ratio bar. */}
      <div
        className="mt-5 flex h-2 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="transition-all"
          style={{
            width: `${escrowedPct}%`,
            background: "var(--primary)",
            boxShadow: "0 0 12px rgba(157,255,61,0.45)",
          }}
        />
        <div
          className="transition-all"
          style={{
            width: `${pendingPct}%`,
            background: "var(--warning)",
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        <span>
          In escrow · {formatSol(escrowedLamports, 2)} · {escrowedPct.toFixed(0)}%
        </span>
        <span>
          Pending · {formatSol(pendingLamports, 2)} · {pendingPct.toFixed(0)}%
        </span>
      </div>

      <button
        type="button"
        onClick={depositAll}
        disabled={busy || !hasPending}
        className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Depositing…"
          : hasPending
            ? `Deposit ${formatSol(pendingLamports)} to escrow`
            : "Nothing to deposit"}
        {hasPending && !busy && <span aria-hidden>→</span>}
      </button>

      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] uppercase tracking-[0.2em] text-fg-muted hover:text-fg">
          Deposit a custom amount
        </summary>
        <form onSubmit={submitCustom} className="mt-2 flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="SOL"
            className="w-full rounded-lg border border-border bg-white/[0.02] px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-muted/60 focus:border-primary/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !custom}
            className="btn-ghost shrink-0 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Deposit
          </button>
        </form>
      </details>
    </div>
  );
}
