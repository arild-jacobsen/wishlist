import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishesByUser } from "@/lib/wishes";
import { getClaimsForWish } from "@/lib/claims";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const wishes = getWishesByUser(db, Number(id));
  const viewerId = Number(session.user.id);

  // Attach claim info (null if viewer is the owner)
  const wishesWithClaims = wishes.map((wish) => ({
    ...wish,
    claims: getClaimsForWish(db, wish.id, viewerId),
  }));

  return NextResponse.json(wishesWithClaims);
}
