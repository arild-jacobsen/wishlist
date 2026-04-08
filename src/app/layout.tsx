import type { Metadata } from "next";
import "./globals.css";
import { DevSeedPanel } from "@/components/DevSeedPanel";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Share your wishes with friends and family",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NODE_ENV is inlined at build time. In production the panel is never
  // included in the bundle — the conditional branch is tree-shaken away.
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
        {isDev && <DevSeedPanel />}
      </body>
    </html>
  );
}
