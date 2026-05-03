import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        muted: "var(--muted)",
        border: "var(--border)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        primary: "var(--primary)",
        "primary-fg": "var(--primary-fg)",
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",
        background: "var(--bg)",
        foreground: "var(--fg)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: [
          "var(--font-jetbrains)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      boxShadow: {
        "glow-primary":
          "0 0 0 1px rgba(157,255,61,0.4), 0 0 24px rgba(157,255,61,0.35)",
        "glow-success":
          "0 0 0 1px rgba(71,255,96,0.4), 0 0 18px rgba(71,255,96,0.3)",
        "glow-destructive":
          "0 0 0 1px rgba(255,77,77,0.45), 0 0 18px rgba(255,77,77,0.3)",
        "glow-soft": "0 0 24px rgba(157,255,61,0.18)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": {
            boxShadow:
              "0 0 0 1px rgba(157,255,61,0.4), 0 0 22px rgba(157,255,61,0.3)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px rgba(157,255,61,0.6), 0 0 36px rgba(157,255,61,0.55)",
          },
        },
      },
      animation: {
        twinkle: "twinkle 3.6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
