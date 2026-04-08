import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getListById, updateList, deleteList } from "@/lib/lists";

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
  const list = getListById(db, Number(id));
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(list);
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
    const list = updateList(db, Number(id), Number(session.user.id), {
      name: body.name,
      description: body.description,
    });
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
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
    deleteList(db, Number(id), Number(session.user.id));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    // SQLite's FK RESTRICT error when wishes still exist in the list
    const msg = (e as Error).message;
    const isFkViolation = msg.includes("FOREIGN KEY constraint failed");
    return NextResponse.json(
      { error: isFkViolation ? "Cannot delete a list that still has wishes" : msg },
      { status: isFkViolation ? 409 : 400 }
    );
  }
}
