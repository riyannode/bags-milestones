import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PrivyClientProvider } from "@/components/PrivyClientProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
});

// Geometric sans for display copy (headline, section titles, large numerals).
// Body text stays Inter for readability.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bags-milestones.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Bags Milestones — Building real trust between Bags creators and holders",
  description:
    "Bagscrow gives Bags creator tokens an on-chain accountability layer. Creators commit milestones, holders vote on royalty releases, escrow keeps both sides honest.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Bags Milestones — Building real trust between Bags creators and holders",
    description:
      "Creators commit milestones. Holders vote on royalty releases. On-chain escrow with Merkle-snapshot voting keeps both sides honest.",
    images: ["/logo.svg"],
  },
  twitter: {
    card: "summary",
    title: "Bags Milestones",
    description:
      "Creators commit milestones. Holders vote on royalty releases. Snapshot-locked, on-chain.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <PrivyClientProvider>{children}</PrivyClientProvider>
      </body>
    </html>
  );
}
