import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { createWish, getWishesByUser, type WishRating } from "@/lib/wishes";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const wishes = getWishesByUser(db, Number(session.user.id));
  return NextResponse.json(wishes);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { list_id, name, description, links, rating } = body;

  if (!list_id || typeof list_id !== "number") {
    return NextResponse.json({ error: "list_id is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const wish = createWish(db, Number(session.user.id), {
      list_id,
      name,
      description,
      links,
      rating: rating as WishRating,
    });
    return NextResponse.json(wish, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
