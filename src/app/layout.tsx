import type { Metadata } from "next";
import "./globals.css";
import { DevSeedPanel } from "@/components/DevSeedPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      {/*
        FOUC-prevention script: runs synchronously before the browser paints,
        so the correct theme class is already on <html> when React hydrates.
        Without this, users with a stored dark preference would briefly see a
        white flash before the ThemeToggle component mounts and applies "dark".
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
        {children}
        {/*
          ThemeToggle is fixed in the upper-right corner so it's reachable on
          every page whether the user is logged in or not.
        */}
        <ThemeToggle />
        {isDev && <DevSeedPanel />}
      </body>
    </html>
  );
}
