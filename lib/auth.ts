// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowed = process.env.ALLOWED_GOOGLE_DOMAIN;
      if (!allowed) return true;
      const email = (profile as any)?.email || "";
      return email.endsWith(`@${allowed}`);
    },
    async session({ session }) {
      // place to attach roles later if you want
      return session;
    },
  },
};

export default authOptions;
