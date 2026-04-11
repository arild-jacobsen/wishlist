"use client";

// List creation page.
//
// Client Component — needs state and the router. Follows the same structure
// as src/app/wishes/new/page.tsx. On successful submit, redirects to
// /dashboard so the user can immediately start adding wishes to the new list.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewListPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create list");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">New list</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-800">
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Birthday, Kitchen, Hobbies"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — describe what this list is for"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Create list"}
          </button>
        </form>
      </main>
    </div>
  );
}
