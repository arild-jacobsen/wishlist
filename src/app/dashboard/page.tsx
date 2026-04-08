// Dashboard — the main page after login.
//
// This is a Server Component: it runs on the server, reads directly from the
// database, and sends fully-rendered HTML to the browser. No loading states
// or client-side data fetching.
//
// The page lists all registered users and their wishes, grouped by list.
// For each wish, it attaches claim information — but because getClaimsForWish
// returns null when the viewer is the wish owner, the "Claimed" badge is
// automatically hidden for the viewer's own wishes.

import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishesByUser, type Wish } from "@/lib/wishes";
import { getListsByUser, type List } from "@/lib/lists";
import { getClaimsForWish } from "@/lib/claims";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

interface UserRow {
  id: number;
  email: string;
}

type WishWithClaims = Wish & { claims: ReturnType<typeof getClaimsForWish> };

export default async function DashboardPage() {
  // auth() reads the JWT cookie and returns the current user's session.
  // The ! assertion is safe here because the middleware redirects to /login
  // if there is no valid session.
  const session = await auth();
  const viewerId = Number(session!.user!.id);
  const db = getDb();

  // Fetch all users so we can show everyone's wishlists on one page.
  const users = db
    .prepare("SELECT id, email FROM users ORDER BY email")
    .all() as UserRow[];

  // For each user, load their lists and wishes, then group wishes by list.
  // getClaimsForWish returns null when viewerId === wish.user_id, so
  // `claims !== null` in the template is what guards the "Claimed" badge.
  const usersWithLists = users.map((user) => {
    const lists = getListsByUser(db, user.id);
    const wishes = getWishesByUser(db, user.id);

    // Build a map of list id → wishes so the template can iterate lists in order.
    const wishesByList = new Map<number, WishWithClaims[]>();
    for (const list of lists) wishesByList.set(list.id, []);
    for (const wish of wishes) {
      wishesByList.get(wish.list_id)?.push({
        ...wish,
        claims: getClaimsForWish(db, wish.id, viewerId),
      });
    }

    return { ...user, lists, wishesByList };
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
              href="/lists/new"
              className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              + New list
            </Link>
            <Link
              href="/wishes/new"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add wish
            </Link>
            {/* SignOutButton is a Client Component because it needs an onClick handler */}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {usersWithLists.map((user) => (
          <section key={user.id}>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {user.id === viewerId ? "My wish lists" : `${user.email}'s wish lists`}
            </h2>

            {user.lists.length === 0 ? (
              <p className="text-sm text-gray-400">No lists yet.</p>
            ) : (
              <div className="space-y-6">
                {user.lists.map((list) => (
                  <ListSection
                    key={list.id}
                    list={list}
                    wishes={user.wishesByList.get(list.id) ?? []}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

// Renders a single list with its wishes.
function ListSection({ list, wishes }: { list: List; wishes: WishWithClaims[] }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="font-medium text-gray-700">{list.name}</h3>
        {list.description && (
          <p className="text-xs text-gray-400">{list.description}</p>
        )}
      </div>

      {wishes.length === 0 ? (
        <p className="text-sm text-gray-400 pl-0.5">No wishes in this list yet.</p>
      ) : (
        <ul className="space-y-3">
          {wishes.map((wish) => (
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
                    {/*
                      wish.claims is null when the viewer is the owner
                      (returned by getClaimsForWish), so this badge is
                      automatically hidden for the owner's own wishes.
                    */}
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
    </div>
  );
}

// Renders a coloured pill badge for a wish rating.
// Colours are consistent throughout the app: gray / yellow / rose.
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
