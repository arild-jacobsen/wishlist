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
  const { id } = await params;
  const session = await auth();
  const viewerId = Number(session!.user!.id);
  const db = getDb();

  const wish = getWishById(db, Number(id));
  if (!wish) notFound();

  const isOwner = wish.user_id === viewerId;
  const claims = getClaimsForWish(db, wish.id, viewerId);
  const comments = getSecretComments(db, wish.id, viewerId);

  const owner = db
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .get(wish.user_id) as UserRow | undefined;

  const claimerEmails = claims
    ? (db
        .prepare(
          `SELECT email FROM users WHERE id IN (${claims.map(() => "?").join(",") || "NULL"})`
        )
        .all(...claims.map((c) => c.user_id)) as { email: string }[])
    : [];

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

  const myClaimExists = claims?.some((c) => c.user_id === viewerId) ?? false;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 truncate">{wish.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        {/* Wish card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">
                {isOwner ? "Your wish" : `${owner?.email}'s wish`}
              </p>
              <h2 className="text-xl font-semibold text-gray-900">{wish.name}</h2>
            </div>
            <RatingBadge rating={wish.rating} />
          </div>

          {wish.description && (
            <p className="text-sm text-gray-600">{wish.description}</p>
          )}

          {wish.links.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Links</p>
              <ul className="space-y-1">
                {wish.links.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline break-all"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && (
            <div className="flex gap-2 pt-2">
              <Link
                href={`/wishes/${wish.id}/edit`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Edit
              </Link>
            </div>
          )}
        </div>

        {/* Claim section — only shown to non-owners */}
        {!isOwner && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Who&apos;s getting this?</h3>
            {claimerEmails.length > 0 ? (
              <ul className="mb-4 space-y-1">
                {claimerEmails.map((u) => (
                  <li key={u.email} className="text-sm text-gray-600">
                    {u.email}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-gray-400">Nobody has claimed this yet.</p>
            )}
            <WishActions
              wishId={wish.id}
              isClaimed={myClaimExists}
            />
          </div>
        )}

        {/* Secret comments — only shown to non-owners */}
        {!isOwner && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Secret comments
              <span className="ml-2 font-normal text-gray-400 text-xs">(hidden from {owner?.email})</span>
            </h3>

            {comments && comments.length > 0 ? (
              <ul className="mb-4 space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      {commentersMap[comment.user_id] ?? "Unknown"}
                    </p>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-gray-400">No comments yet.</p>
            )}

            <SecretCommentForm wishId={wish.id} />
          </div>
        )}
      </main>
    </div>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const styles: Record<string, string> = {
    "It'd be nice": "bg-gray-100 text-gray-600",
    "Would make me happy": "bg-yellow-100 text-yellow-700",
    "Would love to get this": "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${styles[rating] ?? "bg-gray-100 text-gray-600"}`}>
      {rating}
    </span>
  );
}
