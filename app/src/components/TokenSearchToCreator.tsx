"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TokenSearchToCreator() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        router.push(`/creator/${v}`);
      }}
      className="mx-auto flex max-w-xl items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Bags token mint address"
        className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-500"
      >
        Open dashboard
      </button>
    </form>
  );
}
