// GET|POST /api/wishes/[id]/comments
//
// Manages secret comments on a wish. Secret comments are visible to all
// users EXCEPT the wish owner, so they can coordinate about gifts privately.
//
// Privacy: GET returns 403 when the viewer is the wish owner. The library
// function getSecretComments signals this by returning null.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { addSecretComment, getSecretComments } from "@/lib/comments";

// GET — returns all secret comments for this wish (non-owner only).
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
  const comments = getSecretComments(db, Number(id), Number(session.user.id));

  // null means the viewer is the wish owner — they must not see comments.
  if (comments === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(comments);
}

// POST — adds a secret comment to this wish (non-owner only).
// Body: { content: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { content } = body;

  try {
    const db = getDb();
    const comment = addSecretComment(
      db,
      Number(id),
      Number(session.user.id),
      content
    );
    return NextResponse.json(comment, { status: 201 });
  } catch (e) {
    // addSecretComment throws for: owner commenting on own wish, empty content.
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
