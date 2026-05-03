import type { Metadata } from "next";
import "./globals.css";
import { PrivyClientProvider } from "@/components/PrivyClientProvider";

export const metadata: Metadata = {
  title: "Bags Milestones",
  description:
    "Accountability + governance for Bags.fm creator tokens. Lock royalties on-chain, holders vote to release them.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <PrivyClientProvider>{children}</PrivyClientProvider>
      </body>
    </html>
  );
}
