import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishesByUser } from "@/lib/wishes";
import { getClaimsForWish } from "@/lib/claims";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

interface UserRow {
  id: number;
  email: string;
}

export default async function DashboardPage() {
  const session = await auth();
  const viewerId = Number(session!.user!.id);
  const db = getDb();

  const users = db
    .prepare("SELECT id, email FROM users ORDER BY email")
    .all() as UserRow[];

  const usersWithWishes = users.map((user) => {
    const wishes = getWishesByUser(db, user.id);
    const wishesWithClaims = wishes.map((wish) => ({
      ...wish,
      claims: getClaimsForWish(db, wish.id, viewerId),
    }));
    return { ...user, wishes: wishesWithClaims };
  });

  const currentUser = users.find((u) => u.id === viewerId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Wishlist</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{currentUser?.email}</span>
            <Link
              href="/wishes/new"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add wish
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {usersWithWishes.map((user) => (
          <section key={user.id}>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {user.id === viewerId ? "My wishes" : `${user.email}'s wishes`}
            </h2>

            {user.wishes.length === 0 ? (
              <p className="text-sm text-gray-400">No wishes yet.</p>
            ) : (
              <ul className="space-y-3">
                {user.wishes.map((wish) => (
                  <li key={wish.id}>
                    <Link
                      href={`/wishes/${wish.id}`}
                      className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{wish.name}</p>
                          {wish.description && (
                            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                              {wish.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <RatingBadge rating={wish.rating} />
                          {/* Show claim status only to non-owners */}
                          {wish.claims !== null && wish.claims.length > 0 && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              Claimed
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
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
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[rating] ?? "bg-gray-100 text-gray-600"}`}
    >
      {rating}
    </span>
  );
}
