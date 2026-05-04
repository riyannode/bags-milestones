import Link from "next/link";

/**
 * Bagscrow wordmark. Lock-glyph (escrow vault) + project name +
 * sub-brand pill. Used in the header on every page.
 *
 * Pass `size="lg"` for the hero treatment on the landing page.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const isLarge = size === "lg";
  const glyphSize = isLarge ? "h-14 w-14" : "h-8 w-8";
  const titleSize = isLarge ? "text-2xl" : "text-[15px]";
  const subtitleSize = isLarge ? "text-[12px]" : "text-[10px]";

  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3"
      aria-label="Bags Milestones home"
    >
      <span
        className={`relative inline-flex ${glyphSize} items-center justify-center rounded-md`}
        style={{
          background:
            "linear-gradient(135deg, rgba(157,255,61,0.18) 0%, rgba(71,255,96,0.04) 100%)",
          border: "1px solid rgba(157,255,61,0.35)",
          boxShadow: "0 0 22px rgba(157,255,61,0.25)",
        }}
        aria-hidden
      >
        <LockGlyph className={isLarge ? "h-9 w-9" : "h-5 w-5"} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className={`${titleSize} font-semibold tracking-tight text-fg`}>
          Bags Milestones
        </span>
        <span
          className={`${subtitleSize} uppercase tracking-[0.18em] text-primary/80`}
        >
          aka Bagscrow
        </span>
      </span>
    </Link>
  );
}

function LockGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--primary)" }}
    >
      <rect
        x="6"
        y="14"
        width="20"
        height="14"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path d="M10 14 V10 a6 6 0 0 1 12 0 V14" />
      <circle cx="16" cy="20" r="1.6" fill="currentColor" />
      <path d="M16 21.6 v3" />
    </svg>
  );
}
