import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  debug: true, // 👈 logs everything to your server console
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: THIRTY_DAYS,
    updateAge: 24 * 60 * 60,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) return null;

        // Look up user by email OR username
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier },
              { username: credentials.identifier },
            ],
          },
        });

        if (!user?.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name ?? user.username,
          email: user.email ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const allowed = process.env.ALLOWED_GOOGLE_DOMAIN;
        if (
          allowed &&
          profile?.email &&
          !profile.email.endsWith(`@${allowed}`)
        ) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.uid) (session as any).uid = token.uid;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export default authOptions;
