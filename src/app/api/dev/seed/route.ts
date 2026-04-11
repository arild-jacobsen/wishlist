// Dev-only endpoint for seeding dummy users with lists, wishes, claims, and comments.
//
// Only available when NODE_ENV !== 'production'. Calling it in production
// returns 404 immediately so there is no risk of accidental data insertion.
//
// POST /api/dev/seed
//   Creates a fixed set of dummy users (idempotent: skips users that already
//   exist based on email). Each user gets multiple named lists pre-populated
//   with wishes. After all users exist, cross-user claims and secret comments
//   are inserted (INSERT OR IGNORE, so re-seeding won't duplicate them).
//
// DELETE /api/dev/seed
//   Removes all dummy users (identified by the @example.com domain) and their
//   associated lists, wishes, claims, and comments (cascade handled by schema).

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createList } from "@/lib/lists";
import { createWish, type WishRating } from "@/lib/wishes";

interface SeedWish {
  name: string;
  description?: string;
  links?: string[];
  rating: WishRating;
}

interface SeedList {
  name: string;
  description?: string;
  wishes: SeedWish[];
}

interface SeedUser {
  email: string;
  lists: SeedList[];
}

// Dummy users with lists and wishes. All emails use @example.com so the
// DELETE handler can identify and remove them without touching real users.
const DUMMY_USERS: SeedUser[] = [
  {
    email: "alice@example.com",
    lists: [
      {
        name: "Kitchen",
        description: "Things I need for cooking",
        wishes: [
          {
            name: "Stand mixer",
            description: "KitchenAid Artisan, any colour",
            links: ["https://www.kitchenaid.com"],
            rating: "Would love to get this",
          },
          { name: "Cookbook: Salt Fat Acid Heat", rating: "Would make me happy" },
          {
            name: "Nice tea towels",
            description: "Something linen, not synthetic",
            rating: "It'd be nice",
          },
        ],
      },
      {
        name: "Books",
        description: "Reading list wishlist",
        wishes: [
          {
            name: "The Pragmatic Programmer",
            description: "20th anniversary edition",
            links: ["https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/"],
            rating: "Would love to get this",
          },
          { name: "Atomic Habits", rating: "Would make me happy" },
          { name: "Shoe Dog", description: "Phil Knight's memoir", rating: "It'd be nice" },
        ],
      },
    ],
  },
  {
    email: "bob@example.com",
    lists: [
      {
        name: "Desk setup",
        wishes: [
          {
            name: "Mechanical keyboard",
            description: "TKL layout, tactile switches preferred",
            links: ["https://www.keychron.com"],
            rating: "Would love to get this",
          },
          { name: "USB-C hub", description: "At least 4 ports, power delivery", rating: "Would make me happy" },
          { name: "Cable organiser", rating: "It'd be nice" },
        ],
      },
      {
        name: "Cycling",
        description: "For the weekend rides",
        wishes: [
          {
            name: "Road bike helmet",
            description: "Something well-ventilated, MIPS preferred",
            rating: "Would love to get this",
          },
          {
            name: "Cycling gloves",
            description: "Padded, size L",
            rating: "Would make me happy",
          },
          { name: "Water bottle cage", rating: "It'd be nice" },
        ],
      },
    ],
  },
  {
    email: "carol@example.com",
    lists: [
      {
        name: "Running gear",
        wishes: [
          {
            name: "Trail running shoes",
            description: "Size EU 39, any trail-specific model",
            rating: "Would love to get this",
          },
          { name: "Foam roller", rating: "Would make me happy" },
          { name: "Running socks (3-pack)", rating: "It'd be nice" },
        ],
      },
      {
        name: "Travel",
        description: "Making trips easier",
        wishes: [
          {
            name: "Kindle Paperwhite",
            description: "With cover, ideally the 16GB model",
            links: ["https://www.amazon.com/kindle-paperwhite"],
            rating: "Would love to get this",
          },
          {
            name: "Packing cubes",
            description: "A full set in a neutral colour",
            rating: "Would make me happy",
          },
          { name: "Universal travel adapter", rating: "It'd be nice" },
        ],
      },
    ],
  },
];

// Cross-user claims: [claimerEmail, ownerEmail, wishName]
// These are inserted with INSERT OR IGNORE so re-seeding won't duplicate them.
const SEED_CLAIMS: [string, string, string][] = [
  ["bob@example.com", "alice@example.com", "Stand mixer"],
  ["carol@example.com", "alice@example.com", "Stand mixer"],
  ["bob@example.com", "alice@example.com", "Cookbook: Salt Fat Acid Heat"],
  ["alice@example.com", "bob@example.com", "Mechanical keyboard"],
  ["carol@example.com", "bob@example.com", "USB-C hub"],
  ["alice@example.com", "carol@example.com", "Trail running shoes"],
  ["bob@example.com", "carol@example.com", "Kindle Paperwhite"],
];

// Cross-user secret comments: [commenterEmail, ownerEmail, wishName, content]
// Ordered so they read as a realistic conversation thread.
const SEED_COMMENTS: [string, string, string, string][] = [
  ["bob@example.com", "alice@example.com", "Stand mixer",
    "I found a great deal on the 5-litre model — planning to order this week!"],
  ["carol@example.com", "alice@example.com", "Stand mixer",
    "Oh I was thinking the same thing. Should we split it?"],
  ["bob@example.com", "alice@example.com", "Stand mixer",
    "Great idea. Carol, you take the lead and I'll chip in half?"],
  ["alice@example.com", "bob@example.com", "Mechanical keyboard",
    "Saw this on sale last week — already ordered it 🎉"],
  ["carol@example.com", "bob@example.com", "USB-C hub",
    "Getting the Anker 7-in-1 — should tick all the boxes"],
  ["alice@example.com", "carol@example.com", "Trail running shoes",
    "Size EU 39, right? Just double-checking before I order"],
  ["bob@example.com", "carol@example.com", "Kindle Paperwhite",
    "Grabbing the 16GB with the fabric cover — hope that's OK!"],
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

  const created: { email: string; userId: number; listsCreated: number; wishesCreated: number }[] = [];
  const skipped: string[] = [];

  // ── 1. Create users, lists, and wishes ───────────────────────────────────

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
    let wishesCreated = 0;

    for (const seedList of dummy.lists) {
      const list = createList(db, userId, {
        name: seedList.name,
        description: seedList.description,
      });

      for (const wish of seedList.wishes) {
        createWish(db, userId, { ...wish, list_id: list.id });
        wishesCreated++;
      }
    }

    created.push({
      email: dummy.email,
      userId,
      listsCreated: dummy.lists.length,
      wishesCreated,
    });
  }

  // ── 2. Wire up cross-user claims and comments ────────────────────────────
  //
  // These helpers look up IDs from the DB so they work regardless of whether
  // the users above were freshly created or already existed (skipped).

  const getUserId = (email: string): number | undefined =>
    (db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined)?.id;

  // Look up a wish by the owner's email and the wish's name. Joins through
  // lists because wishes don't store user_id directly — they belong to a list.
  const getWishId = (ownerEmail: string, wishName: string): number | undefined => {
    const ownerId = getUserId(ownerEmail);
    if (!ownerId) return undefined;
    return (
      db
        .prepare(
          `SELECT w.id FROM wishes w
           JOIN lists l ON w.list_id = l.id
           WHERE l.user_id = ? AND w.name = ?`
        )
        .get(ownerId, wishName) as { id: number } | undefined
    )?.id;
  };

  let claimsCreated = 0;
  for (const [claimerEmail, ownerEmail, wishName] of SEED_CLAIMS) {
    const claimerId = getUserId(claimerEmail);
    const wishId = getWishId(ownerEmail, wishName);
    if (!claimerId || !wishId) continue;
    // INSERT OR IGNORE respects the UNIQUE(wish_id, user_id) constraint
    // without throwing — safe to run on an already-seeded database.
    const { changes } = db
      .prepare("INSERT OR IGNORE INTO claims (wish_id, user_id) VALUES (?, ?)")
      .run(wishId, claimerId);
    claimsCreated += changes;
  }

  let commentsCreated = 0;
  for (const [commenterEmail, ownerEmail, wishName, content] of SEED_COMMENTS) {
    const commenterId = getUserId(commenterEmail);
    const wishId = getWishId(ownerEmail, wishName);
    if (!commenterId || !wishId) continue;
    // Only insert if this exact comment doesn't already exist (idempotent).
    const exists = db
      .prepare(
        "SELECT id FROM secret_comments WHERE wish_id = ? AND user_id = ? AND content = ?"
      )
      .get(wishId, commenterId, content);
    if (exists) continue;
    db.prepare(
      "INSERT INTO secret_comments (wish_id, user_id, content) VALUES (?, ?, ?)"
    ).run(wishId, commenterId, content);
    commentsCreated++;
  }

  return NextResponse.json({ created, skipped, claimsCreated, commentsCreated }, { status: 201 });
}

export async function DELETE() {
  const guard = devOnly();
  if (guard) return guard;

  const db = getDb();

  // Delete all dummy users. The schema's ON DELETE CASCADE removes their
  // lists, wishes, claims, and comments automatically.
  const { changes } = db
    .prepare("DELETE FROM users WHERE email LIKE '%@example.com'")
    .run();

  return NextResponse.json({ deletedUsers: changes });
}
