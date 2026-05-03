/**
 * Formatting helpers shared across the UI.
 */

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function formatSol(lamports: number | bigint, digits = 3): string {
  const n = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return `${(n / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} SOL`;
}

export function shortAddr(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatDeadline(unixSecs: number): string {
  if (!unixSecs) return "—";
  return new Date(unixSecs * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function timeRemaining(unixSecs: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = unixSecs - now;
  if (diff <= 0) return "ended";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
