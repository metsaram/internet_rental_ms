import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12, // 12h
  },
  pages: {
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Phase 17 — rate-limit credential attempts per email to mitigate
        // brute-force / credential-stuffing attacks. 10 attempts per minute.
        const emailKey = credentials?.email?.toLowerCase() ?? "anon";
        const allowed = rateLimit(`auth:${emailKey}`, {
          max: 10,
          windowMs: 60_000,
        });
        if (!allowed) {
          // Returning null shows the generic "Invalid email or password" —
          // we don't reveal that the rate limit was hit.
          return null;
        }

        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { company: true },
        });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;
        if (user.company?.status !== "ACTIVE") return null;
        const ok = verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          companyCode: user.company.code,
          companyCurrency: user.company.currency,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.companyName = (user as any).companyName;
        token.companyCode = (user as any).companyCode;
        token.companyCurrency = (user as any).companyCurrency;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).companyName = token.companyName;
        (session.user as any).companyCode = token.companyCode;
        (session.user as any).companyCurrency = token.companyCurrency;
      }
      return session;
    },
  },
};

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: "ADMIN" | "STAFF";
    companyId: string;
    companyName: string;
    companyCode: string;
    companyCurrency: string;
  };
  expires: string;
};
