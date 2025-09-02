"use client";
import { signIn } from "next-auth/react";
// ...
<button onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
  Continue with Google
</button>
