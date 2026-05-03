import type { BagsHolder } from "@/types";
import { shortAddr } from "@/lib/format";

interface HolderSnapshotProps {
  holders: BagsHolder[];
  highlightWallet?: string;
}

export function HolderSnapshot({ holders, highlightWallet }: HolderSnapshotProps) {
  const top = holders.slice(0, 10);
  if (top.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm text-zinc-500">
        No holder data available yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <h3 className="text-sm uppercase tracking-wider text-zinc-400">
        Top holders
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        {top.map((h, i) => {
          const isMe = highlightWallet && h.wallet === highlightWallet;
          return (
            <li
              key={h.wallet}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${
                isMe ? "bg-purple-900/30 text-purple-100" : "text-zinc-300"
              }`}
            >
              <span className="font-mono text-xs">
                #{i + 1} {shortAddr(h.wallet)}
                {isMe && " (you)"}
              </span>
              <span className="text-xs">
                {h.percentage ? `${h.percentage.toFixed(2)}%` : h.balance.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
