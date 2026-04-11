// Wish detail page — /wishes/[id]
//
// Server Component: reads wish, claims, and comments directly from the database.
// Renders differently depending on whether the viewer is the wish owner:
//
//   Owner sees:   wish details, edit button
//   Non-owner sees: wish details, who claimed it, secret comments, claim toggle
//
// The `isOwner` flag computed here is the primary gate for all owner/non-owner
// UI differences. The library functions (getClaimsForWish, getSecretComments)
// also enforce this on the data side by returning null for the owner.

import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishById } from "@/lib/wishes";
import { getClaimsForWish } from "@/lib/claims";
import { getSecretComments } from "@/lib/comments";
import { notFound } from "next/navigation";
import Link from "next/link";
import { WishActions } from "@/components/WishActions";
import { SecretCommentForm } from "@/components/SecretCommentForm";

interface UserRow {
  id: number;
  email: string;
}

export default async function WishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // params is a Promise in Next.js 15 — must be awaited.
  const { id } = await params;
  const session = await auth();
  const viewerId = Number(session!.user!.id);
  const db = getDb();

  const wish = getWishById(db, Number(id));
  // Next.js notFound() renders the nearest not-found.tsx (or a default 404 page).
  if (!wish) notFound();

  const isOwner = wish.user_id === viewerId;

  // Both of these return null when the viewer is the wish owner (privacy rule).
  // null values mean the sections below are simply not rendered.
  const claims = getClaimsForWish(db, wish.id, viewerId);
  const comments = getSecretComments(db, wish.id, viewerId);

  // Look up the wish owner's email to display "X's wish" in the header.
  const owner = db
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .get(wish.user_id) as UserRow | undefined;

  // Resolve claimer IDs to email addresses for display.
  // If claims is null (viewer is owner) we skip this entirely.
  const claimerEmails = claims
    ? (db
        .prepare(
          // Build parameterised IN clause from the claimer IDs.
          // Fall back to "NULL" (matches nothing) if there are no claims.
          `SELECT email FROM users WHERE id IN (${claims.map(() => "?").join(",") || "NULL"})`
        )
        .all(...claims.map((c) => c.user_id)) as { email: string }[])
    : [];

  // Build a { userId → email } map so each comment can show its author.
  // We deduplicate user IDs with a Set to avoid fetching the same user twice.
  const commentersMap = comments
    ? Object.fromEntries(
        (
          db
            .prepare(
              `SELECT id, email FROM users WHERE id IN (${
                [...new Set(comments.map((c) => c.user_id))].map(() => "?").join(",") || "NULL"
              })`
            )
            .all(
              ...[...new Set(comments.map((c) => c.user_id))]
            ) as UserRow[]
        ).map((u) => [u.id, u.email])
      )
    : {};

  // Does the current viewer already have a claim on this wish?
  // Passed to WishActions so it can show "Remove my claim" vs "I'll get this!".
  const myClaimExists = claims?.some((c) => c.user_id === viewerId) ?? false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 truncate dark:text-white">{wish.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        {/* Wish card — visible to everyone */}
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4 dark:bg-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {isOwner ? "Your wish" : `${owner?.email}'s wish`}
              </p>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{wish.name}</h2>
            </div>
            <RatingBadge rating={wish.rating} />
          </div>

          {wish.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{wish.description}</p>
          )}

          {wish.links.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400">Links</p>
              <ul className="space-y-1">
                {wish.links.map((link) => (
                  <li key={link}>
                    {/* rel="noopener noreferrer" prevents the new tab from accessing window.opener */}
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline break-all dark:text-indigo-400"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Edit button — owner only */}
          {isOwner && (
            <div className="flex gap-2 pt-2">
              <Link
                href={`/wishes/${wish.id}/edit`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Edit
              </Link>
            </div>
          )}
        </div>

        {/* Claim section — non-owner only (owner must not see who claimed their wish) */}
        {!isOwner && (
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Who&apos;s getting this?</h3>
            {claimerEmails.length > 0 ? (
              <ul className="mb-4 space-y-1">
                {claimerEmails.map((u) => (
                  <li key={u.email} className="text-sm text-gray-600 dark:text-gray-300">
                    {u.email}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">Nobody has claimed this yet.</p>
            )}
            {/*
              WishActions is a Client Component (needs onClick).
              It calls POST/DELETE /api/wishes/[id]/claim and refreshes the page.
            */}
            <WishActions
              wishId={wish.id}
              isClaimed={myClaimExists}
            />
          </div>
        )}

        {/* Secret comments section — non-owner only */}
        {!isOwner && (
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Secret comments
              <span className="ml-2 font-normal text-gray-400 text-xs dark:text-gray-500">(hidden from {owner?.email})</span>
            </h3>

            {comments && comments.length > 0 ? (
              <ul className="mb-4 space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                    {/* Look up commenter email from the map we built above */}
                    <p className="text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
                      {commentersMap[comment.user_id] ?? "Unknown"}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">No comments yet.</p>
            )}

            {/* SecretCommentForm is a Client Component (needs form submission) */}
            <SecretCommentForm wishId={wish.id} />
          </div>
        )}
      </main>
    </div>
  );
}

// Renders a coloured pill badge for a wish rating.
function RatingBadge({ rating }: { rating: string }) {
  const styles: Record<string, string> = {
    "It'd be nice": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    "Would make me happy": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    "Would love to get this": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${styles[rating] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
      {rating}
    </span>
  );
}
