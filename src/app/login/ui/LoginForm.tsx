"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function LoginForm({ reason }: { reason?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      identifier,
      password,
      callbackUrl: "/dashboard",
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email/username or password.");
    } else if (res?.ok) {
      window.location.href = res.url || "/dashboard";
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
      <div className="flex flex-col items-center text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
          GM Design Portal
        </h2>
      </div>

      {/* Status alerts based on reason */}
      {reason === "inactive" && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200 font-medium">
            Account Deactivated
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            Your account is currently deactivated. Please contact an
            administrator.
          </p>
        </div>
      )}

      {reason === "unassigned" && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            Account Pending Approval
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Your account has not been assigned a role yet. Please contact an
            administrator.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Email or Username"
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="my-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
        or
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="w-full flex items-center justify-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-2 text-neutral-700 dark:text-white font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 shadow-sm"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <g>
            <path
              d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.77h5.42a4.63 4.63 0 0 1-2 3.04v2.52h3.22c1.89-1.74 2.96-4.3 2.96-7.33z"
              fill="#4285F4"
            />
            <path
              d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.22-2.52c-.89.6-2.03.96-3.41.96-2.62 0-4.84-1.77-5.63-4.15H1.05v2.6A10 10 0 0 0 10 20z"
              fill="#34A853"
            />
            <path
              d="M4.37 11.85A5.99 5.99 0 0 1 4 10c0-.64.11-1.26.18-1.85V5.55H1.05A10 10 0 0 0 0 10c0 1.64.39 3.19 1.05 4.45l3.32-2.6z"
              fill="#FBBC05"
            />
            <path
              d="M10 4.04c1.47 0 2.78.51 3.81 1.5l2.86-2.86C14.97 1.13 12.7 0 10 0A10 10 0 0 0 1.05 5.55l3.32 2.6C5.16 5.81 7.38 4.04 10 4.04z"
              fill="#EA4335"
            />
          </g>
        </svg>
        Sign in with Google
      </button>

      <div className="mt-4 flex justify-center gap-6 text-sm">
        <a href="/register" className="text-blue-600 hover:underline">
          Create account
        </a>
        <a href="/reset" className="text-blue-600 hover:underline">
          Forgot password?
        </a>
      </div>
    </div>
  );
}
