// GET|POST|DELETE /api/wishes/[id]/claim
//
// Manages claim state for a single wish — which users have marked that they
// intend to buy it.
//
// Privacy: GET returns 403 when the viewer is the wish owner (surprise
// protection). The library function getClaimsForWish signals this by
// returning null instead of an array.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { claimWish, unclaimWish, getClaimsForWish } from "@/lib/claims";

// GET — returns all claims for this wish (non-owner only).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // params is a Promise in Next.js 15 — must be awaited.
  const { id } = await params;
  const db = getDb();
  const claims = getClaimsForWish(db, Number(id), Number(session.user.id));

  // null means the viewer is the owner — they must not see claims.
  if (claims === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(claims);
}

// POST — current user claims this wish ("I'll get this!").
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getDb();
    const claim = claimWish(db, Number(id), Number(session.user.id));
    return NextResponse.json(claim, { status: 201 });
  } catch (e) {
    // claimWish throws for: owner claiming own wish, duplicate claim.
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}

// DELETE — current user removes their claim on this wish.
// Safe to call even if no claim exists (no-op).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  unclaimWish(db, Number(id), Number(session.user.id));
  return new NextResponse(null, { status: 204 });
}
