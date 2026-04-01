import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishesByUser } from "@/lib/wishes";

export interface UserWithWishes {
  id: number;
  email: string;
  wishCount: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const users = db
    .prepare("SELECT id, email FROM users ORDER BY email")
    .all() as { id: number; email: string }[];

  const result: UserWithWishes[] = users.map((u) => ({
    ...u,
    wishCount: getWishesByUser(db, u.id).length,
  }));

  return NextResponse.json(result);
}
