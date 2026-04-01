// WishActions — claim toggle button shown on the wish detail page.
//
// Client Component: needs onClick to call the claim API.
// Rendered only for non-owners (the parent server component checks isOwner).
//
// After a successful claim/unclaim, router.refresh() re-fetches the server
// component data so the page shows the updated claim state without a full reload.
// useTransition wraps the refresh so `pending` stays true until it completes.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WishActions({
  wishId,
  isClaimed, // true if the current user has already claimed this wish
}: {
  wishId: number;
  isClaimed: boolean;
}) {
  const router = useRouter();
  // useTransition tracks whether the router.refresh() is in flight.
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function toggleClaim() {
    setError("");
    // POST to claim, DELETE to unclaim — same endpoint, different method.
    const method = isClaimed ? "DELETE" : "POST";
    const res = await fetch(`/api/wishes/${wishId}/claim`, { method });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    // Re-render the server components to reflect the new claim state.
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      )}
      <button
        onClick={toggleClaim}
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          isClaimed
            ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
      >
        {pending
          ? "…"
          : isClaimed
          ? "Remove my claim"
          : "I'll get this!"}
      </button>
    </div>
  );
}
