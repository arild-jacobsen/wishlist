import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isEmailAllowed, createOTPToken, sendOTPEmail } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = (body?.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    // Return success to avoid leaking which emails are allowed
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  const token = createOTPToken(db, email);
  sendOTPEmail(email, token);

  return NextResponse.json({ ok: true });
}
