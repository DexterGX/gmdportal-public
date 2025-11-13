"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ResetConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const [countdown, setCountdown] = useState<number | null>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setError(null);
    setMessage(null);
    // clean up any running timers when token changes
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current as unknown as number);
        redirectTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current as unknown as number);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Failed to reset password");
      } else {
        const successMsg =
          data?.message || "Password updated. You can now sign in.";
        setMessage(successMsg);

        // Show a 5 second countdown in the UI, but actually redirect after 3 seconds
        setCountdown(5);

        // Start countdown interval (for display only)
        countdownTimerRef.current = window.setInterval(() => {
          setCountdown((c) => (c && c > 0 ? c - 1 : 0));
        }, 1000) as unknown as number;

        // Redirect after 3 seconds
        redirectTimerRef.current = window.setTimeout(() => {
          // clear countdown and timers before navigating
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdown(null);
          router.push("/login");
        }, 3000) as unknown as number;
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
      <div className="flex flex-col items-center text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
          Set a new password
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm password"
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        {countdown !== null && (
          <p className="text-sm text-neutral-600 mt-2">
            You will be redirected in {countdown} second
            {countdown === 1 ? "" : "s"}.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save new password"}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        <a href="/login" className="text-blue-600 hover:underline">
          Back to sign in
        </a>
      </div>
    </div>
  );
}
