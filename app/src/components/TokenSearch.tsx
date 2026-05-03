"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TokenSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        router.push(`/token/${v}`);
      }}
      className="glass mx-auto flex max-w-xl items-center gap-2 rounded-2xl p-2"
    >
      <span className="hidden select-none px-3 font-mono text-xs uppercase tracking-[0.2em] text-fg-muted sm:inline">
        ▍ mint
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter Bags token mint address"
        className="flex-1 rounded-xl bg-transparent px-3 py-3 font-mono text-sm text-fg placeholder:text-fg-muted/60 focus:outline-none"
      />
      <button
        type="submit"
        className="btn-primary rounded-xl px-4 py-3 text-sm font-medium"
      >
        View token →
      </button>
    </form>
  );
}
