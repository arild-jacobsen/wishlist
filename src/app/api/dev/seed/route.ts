// Dev-only endpoint for seeding dummy users with wishes.
//
// Only available when NODE_ENV !== 'production'. Calling it in production
// returns 404 immediately so there is no risk of accidental data insertion.
//
// POST /api/dev/seed
//   Creates a fixed set of dummy users (idempotent: skips users that already
//   exist based on email). Each new user gets a handful of wishes across the
//   three rating levels so the UI has something to browse during development.
//
// DELETE /api/dev/seed
//   Removes all dummy users (identified by the @example.com domain) and their
//   associated wishes, claims, and comments (cascade handled by the schema).

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createWish, type WishRating } from "@/lib/wishes";

// The dummy users to create. All use @example.com so the DELETE handler can
// identify and remove them without touching real users.
const DUMMY_USERS: { email: string; wishes: { name: string; description?: string; links?: string[]; rating: WishRating }[] }[] = [
  {
    email: "alice@example.com",
    wishes: [
      {
        name: "Stand mixer",
        description: "KitchenAid Artisan, any colour",
        links: ["https://www.kitchenaid.com"],
        rating: "Would love to get this",
      },
      {
        name: "Cookbook: Salt Fat Acid Heat",
        rating: "Would make me happy",
      },
      {
        name: "Nice tea towels",
        description: "Something linen, not synthetic",
        rating: "It'd be nice",
      },
    ],
  },
  {
    email: "bob@example.com",
    wishes: [
      {
        name: "Mechanical keyboard",
        description: "TKL layout, tactile switches preferred",
        links: ["https://www.keychron.com"],
        rating: "Would love to get this",
      },
      {
        name: "USB-C hub",
        description: "At least 4 ports, power delivery",
        rating: "Would make me happy",
      },
      {
        name: "Cable organiser",
        rating: "It'd be nice",
      },
    ],
  },
  {
    email: "carol@example.com",
    wishes: [
      {
        name: "Trail running shoes",
        description: "Size EU 39, any trail-specific model",
        rating: "Would love to get this",
      },
      {
        name: "Foam roller",
        rating: "Would make me happy",
      },
      {
        name: "Running socks (3-pack)",
        rating: "It'd be nice",
      },
    ],
  },
];

// Guards every handler. Returns a 404 response in production so the route
// is effectively invisible outside of development.
function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

export async function POST() {
  const guard = devOnly();
  if (guard) return guard;

  const db = getDb();

  const created: { email: string; userId: number; wishesCreated: number }[] = [];
  const skipped: string[] = [];

  for (const dummy of DUMMY_USERS) {
    // Check whether the user already exists to keep this idempotent.
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(dummy.email) as { id: number } | undefined;

    if (existing) {
      skipped.push(dummy.email);
      continue;
    }

    // Insert the user. No OTP is created — dummy users cannot log in, they
    // exist purely so other users can browse their wish lists.
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (email) VALUES (?)")
      .run(dummy.email);

    const userId = Number(lastInsertRowid);

    for (const wish of dummy.wishes) {
      createWish(db, userId, wish);
    }

    created.push({ email: dummy.email, userId, wishesCreated: dummy.wishes.length });
  }

  return NextResponse.json({ created, skipped }, { status: 201 });
}

export async function DELETE() {
  const guard = devOnly();
  if (guard) return guard;

  const db = getDb();

  // Delete all dummy users. The schema's ON DELETE CASCADE removes their
  // wishes, claims, and comments automatically.
  const { changes } = db
    .prepare("DELETE FROM users WHERE email LIKE '%@example.com'")
    .run();

  return NextResponse.json({ deletedUsers: changes });
}
