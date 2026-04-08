"use client";

// Floating dev panel for seeding/clearing dummy data.
//
// Only rendered in development (the layout conditionally includes this
// component based on NODE_ENV). It is never shipped in production builds.
//
// The panel mimics the style of the Next.js dev overlay (bottom-right corner,
// dark background) so it feels at home alongside the built-in tooling.

import { useState } from "react";

type Status = "idle" | "loading" | "ok" | "error";

export function DevSeedPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function call(method: "POST" | "DELETE") {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/dev/seed", { method });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");

      if (method === "POST") {
        const c = (json.created as { email: string }[]).map((u) => u.email);
        const s = json.skipped as string[];
        const parts = [];
        if (c.length) parts.push(`Created: ${c.join(", ")}`);
        if (s.length) parts.push(`Skipped: ${s.join(", ")}`);
        setMessage(parts.join(" · ") || "Nothing to create");
      } else {
        setMessage(`Deleted ${json.deletedUsers} user(s)`);
      }
      setStatus("ok");
    } catch (e) {
      setMessage((e as Error).message);
      setStatus("error");
    }
  }

  const msgColor =
    status === "ok" ? "text-green-400" : status === "error" ? "text-red-400" : "text-gray-400";

  return (
    // Fixed to the bottom-right, above the Next.js dev indicator (z-index 9999)
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 rounded-xl bg-gray-900 px-4 py-3 shadow-lg text-xs font-mono text-gray-100 min-w-[220px]">
      <p className="font-semibold text-gray-300 tracking-wide uppercase text-[10px]">Dev tools</p>

      <div className="flex gap-2">
        <button
          onClick={() => call("POST")}
          disabled={status === "loading"}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          Seed users
        </button>
        <button
          onClick={() => call("DELETE")}
          disabled={status === "loading"}
          className="flex-1 rounded-md bg-gray-700 px-3 py-1.5 text-gray-200 hover:bg-gray-600 disabled:opacity-50 transition"
        >
          Clear seed
        </button>
      </div>

      {message && (
        <p className={`leading-snug break-words ${msgColor}`}>{message}</p>
      )}
    </div>
  );
}
