"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Wishlist</h1>
        <p className="mb-6 text-sm text-gray-500">
          {step === "email"
            ? "Enter your email to receive a one-time code."
            : `We sent a code to ${email}. Enter it below.`}
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {step === "email" ? (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
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
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-2xl font-mono tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="w-full text-sm text-indigo-600 hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
