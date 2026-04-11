// Login page — /login
//
// Client Component: the two-step OTP login flow requires local state.
//
// Two login methods are offered:
//
// Google SSO: signIn("google") → Google OAuth → signIn callback checks whitelist
//   → getOrCreateUser → JWT session → /dashboard
//
// OTP (email code):
//   Step 1 ("email"): user enters their email → POST /api/auth/request-otp
//     The server generates a code and (in dev) logs it to the console.
//     We always advance to step 2 regardless of whether the email is allowed,
//     to avoid leaking the whitelist.
//   Step 2 ("otp"): user enters the 6-digit code → signIn("otp", { email, token })
//     NextAuth's Credentials provider verifies the code and creates a JWT session.
//     On success, the user is redirected to /dashboard.
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  // Controls which form step is shown: "email" input or "otp" input.
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStep("otp");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("otp", {
        email,
        token: otp,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid or expired code. Please try again.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md dark:bg-gray-800">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Wishlist</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {step === "email"
            ? "Sign in to access your wish lists."
            : `We sent a code to ${email}. Enter it below.`}
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        {step === "email" ? (
          <div className="space-y-4">
            {/* Google SSO — simplest path for whitelisted Google accounts */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400 dark:bg-gray-800 dark:text-gray-500">or use a one-time code</span>
              </div>
            </div>

            {/* OTP email form */}
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-2xl font-mono tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(""); }}
              className="w-full text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
