// SecretCommentForm — inline form for posting a secret comment on a wish.
//
// Client Component: needs form state and submit handler.
// Rendered only for non-owners (the parent server component checks isOwner).
// After posting, clears the input and refreshes server component data.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SecretCommentForm({ wishId }: { wishId: number }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/wishes/${wishId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setContent("");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Leave a secret comment…"
        required
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "…" : "Send"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
