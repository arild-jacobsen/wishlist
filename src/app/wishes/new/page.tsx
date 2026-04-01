"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WISH_RATINGS, type WishRating } from "@/lib/wishes";

export default function NewWishPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [linksText, setLinksText] = useState("");
  const [rating, setRating] = useState<WishRating>("It'd be nice");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const links = linksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, links, rating }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create wish");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900">New wish</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. New bicycle"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Links <span className="text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              rows={3}
              placeholder="https://example.com/product"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              How much do you want this? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {WISH_RATINGS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="rating"
                    value={r}
                    checked={rating === r}
                    onChange={() => setRating(r)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Add wish"}
          </button>
        </form>
      </main>
    </div>
  );
}
