"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

function AuthStatusContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "inactive"; // default
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    const callbackUrl =
      reason === "unassigned"
        ? "/login?reason=unassigned"
        : "/login?reason=inactive";

    await signOut({ callbackUrl });
  };

  let title = "";
  let description = "";

  if (reason === "unassigned") {
    title = "Account pending approval";
    description =
      "Your account has been created but has not been assigned a role yet. Please contact an administrator to activate your access.";
  } else {
    title = "Account deactivated";
    description =
      "Your account is currently deactivated and cannot access the portal. Please contact an administrator if you believe this is a mistake.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {description}
        </p>
        <p className="text-xs text-gray-400">
          Please sign out and contact an administrator if you need assistance.
        </p>
        <button
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="w-full rounded-lg bg-blue-600 text-white py-2 px-4 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}

export default function AuthStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-gray-600 dark:text-gray-300">Loading...</div>
        </div>
      }
    >
      <AuthStatusContent />
    </Suspense>
  );
}

//Test 5
