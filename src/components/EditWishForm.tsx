"use client";

// Edit wish form.
//
// Fetches the user's lists on mount so the list picker is populated.
// Pre-selects the wish's current list. Submits list_id as part of the
// PATCH body so wishes can be moved between lists.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WISH_RATINGS, type WishRating, type Wish } from "@/lib/wishes";
import { ListSelect } from "@/components/ListSelect";
import type { List } from "@/lib/lists";

export function EditWishForm({ wish }: { wish: Wish }) {
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState<number | "">(wish.list_id);
  const [name, setName] = useState(wish.name);
  const [description, setDescription] = useState(wish.description ?? "");
  const [linksText, setLinksText] = useState(wish.links.join("\n"));
  const [rating, setRating] = useState<WishRating>(wish.rating);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/lists")
      .then((r) => r.json())
      .then((data: List[]) => setLists(data));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const links = linksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/wishes/${wish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: listId, name, description, links, rating }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update wish");
        return;
      }
      router.push(`/wishes/${wish.id}`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this wish?")) return;
    const res = await fetch(`/api/wishes/${wish.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      router.push("/dashboard");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href={`/wishes/${wish.id}`} className="text-sm text-indigo-600 hover:underline">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Edit wish</h1>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      {lists.length > 0 && (
        <ListSelect lists={lists} value={listId} onChange={setListId} />
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
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
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
          className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">How much do you want this?</label>
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

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
