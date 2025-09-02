// app/page.tsx
"use client";
import { signIn } from "next-auth/react";


export default function LoginPage() {
return (
<main className="min-h-screen grid place-items-center p-4">
<div className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 shadow-xl ring-1 ring-neutral-800">
<div className="flex flex-col items-center gap-4 mb-6 text-center">
<img src="/logo.svg" alt="GM Design" className="h-12" />
<h1 className="text-2xl font-semibold">GM Design Portal</h1>
<p className="text-neutral-400 text-sm">Sign in with your company Google account to continue.</p>
</div>
<button
onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
className="w-full rounded-xl bg-white/95 text-neutral-900 font-medium py-3 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
>
Continue with Google
</button>
<p className="mt-6 text-xs text-neutral-500">
By continuing, you agree to the acceptable use of this system. Unauthorized access is prohibited.
</p>
</div>
</main>
);
}