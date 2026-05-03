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
      <div className="glass rounded-2xl p-5 text-sm text-fg-muted">
        <h3 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          Top holders
        </h3>
        No holder data available yet.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-fg-muted">
        Top holders
      </h3>
      <ul className="mt-3 space-y-1 text-sm">
        {top.map((h, i) => {
          const isMe = highlightWallet && h.wallet === highlightWallet;
          return (
            <li
              key={h.wallet}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition ${
                isMe
                  ? "border border-primary/30 bg-primary/5 text-primary"
                  : "text-fg/85 hover:bg-white/[0.02]"
              }`}
            >
              <span className="font-mono text-xs">
                <span className="text-fg-muted">#{(i + 1).toString().padStart(2, "0")}</span>{" "}
                {shortAddr(h.wallet)}
                {isMe && (
                  <span className="ml-1 text-[10px] uppercase tracking-[0.2em]">
                    you
                  </span>
                )}
              </span>
              <span className="font-mono text-xs">
                {h.percentage
                  ? `${h.percentage.toFixed(2)}%`
                  : h.balance.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
