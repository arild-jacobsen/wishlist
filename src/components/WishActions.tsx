"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WishActions({
  wishId,
  isClaimed,
}: {
  wishId: number;
  isClaimed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function toggleClaim() {
    setError("");
    const method = isClaimed ? "DELETE" : "POST";
    const res = await fetch(`/api/wishes/${wishId}/claim`, { method });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
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
