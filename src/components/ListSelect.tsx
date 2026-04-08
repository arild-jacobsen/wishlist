"use client";

// Reusable list picker used in both the new-wish and edit-wish forms.
//
// Renders a <select> pre-populated with the user's lists. Includes a
// "Create new list →" link beneath the dropdown so the user can create one
// without leaving the form (opens /lists/new in the same tab; returning
// to the form re-fetches lists via the parent's useEffect).

import Link from "next/link";
import type { List } from "@/lib/lists";

interface Props {
  lists: List[];
  value: number | "";
  onChange: (id: number) => void;
}

export function ListSelect({ lists, value, onChange }: Props) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        List <span className="text-red-500">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        required
        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="" disabled>
          Select a list…
        </option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <Link
        href="/lists/new"
        className="mt-1 inline-block text-xs text-indigo-600 hover:underline"
      >
        + Create new list
      </Link>
    </div>
  );
}
