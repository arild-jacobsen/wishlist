import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishById, deleteWish, updateWish, type WishRating } from "@/lib/wishes";

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
  const wish = getWishById(db, Number(id));
  if (!wish) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wish);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const db = getDb();
    const wish = updateWish(db, Number(id), Number(session.user.id), {
      name: body.name,
      description: body.description,
      links: body.links,
      rating: body.rating as WishRating | undefined,
    });
    return NextResponse.json(wish);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
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
    deleteWish(db, Number(id), Number(session.user.id));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
