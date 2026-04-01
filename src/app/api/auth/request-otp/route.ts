// POST /api/auth/request-otp
//
// Step 1 of the login flow: the user submits their email and this endpoint
// generates an OTP code for them.
//
// Security note: non-whitelisted emails get the same { ok: true } response as
// whitelisted ones. This prevents an attacker from using this endpoint to
// enumerate which email addresses have accounts.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isEmailAllowed, createOTPToken, sendOTPEmail } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Normalise to lowercase so the whitelist check is case-insensitive.
  const email = (body?.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    // Silently succeed — don't reveal that this email is not on the whitelist.
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  // Generate a 6-digit code, store it in otp_tokens with a 15-min expiry.
  const token = createOTPToken(db, email);
  // In development this logs the code to the server console.
  // In production, replace sendOTPEmail with real email delivery.
  sendOTPEmail(email, token);

  return NextResponse.json({ ok: true });
}
