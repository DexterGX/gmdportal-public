// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: THIRTY_DAYS, // cookie/JWT valid for 30 days
    updateAge: 24 * 60 * 60, // refresh token age every 24h (optional)
  },
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
      return session;
    },
  },
};

export default authOptions;
