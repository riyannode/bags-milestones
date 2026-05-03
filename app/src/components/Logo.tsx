import Link from "next/link";

/**
 * Bagscrow wordmark. Combines a small neon glyph with the project
 * full name + sub-brand pill. Used in the header on every page.
 */
export function Logo() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3"
      aria-label="Bags Milestones home"
    >
      <span
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-bold tracking-tight"
        style={{
          background:
            "linear-gradient(135deg, rgba(157,255,61,0.18) 0%, rgba(71,255,96,0.04) 100%)",
          border: "1px solid rgba(157,255,61,0.35)",
          color: "var(--primary)",
          boxShadow: "0 0 22px rgba(157,255,61,0.25)",
        }}
      >
        BG
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          Bags Milestones
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-primary/80">
          aka Bagscrow
        </span>
      </span>
    </Link>
  );
}
