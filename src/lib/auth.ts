import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "netrent-production-jwt-secret-key-32charslong!",
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
        try {
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
            companyUseContract: user.company.useContract,
            companyWarningDays: user.company.warningDays ?? 30,
          } as any;
        } catch (error) {
          console.error("[auth] Authorize database error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.companyName = (user as any).companyName;
        token.companyCode = (user as any).companyCode;
        token.companyCurrency = (user as any).companyCurrency;
        token.companyUseContract = (user as any).companyUseContract;
        token.companyWarningDays = (user as any).companyWarningDays;
      }
      if (trigger === "update" && session) {
        if (session.companyName) token.companyName = session.companyName;
        if (session.companyCurrency) token.companyCurrency = session.companyCurrency;
        if (session.companyUseContract !== undefined) token.companyUseContract = session.companyUseContract;
        if (session.companyWarningDays !== undefined) token.companyWarningDays = session.companyWarningDays;
      }
      if (token.companyId && token.companyUseContract === undefined) {
        try {
          const comp = await db.company.findUnique({
            where: { id: token.companyId as string },
            select: { useContract: true, warningDays: true },
          });
          if (comp) {
            token.companyUseContract = comp.useContract;
            token.companyWarningDays = comp.warningDays;
          }
        } catch {
          // Ignore
        }
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
        (session.user as any).companyUseContract = token.companyUseContract;
        (session.user as any).companyWarningDays = token.companyWarningDays;
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
    companyUseContract?: boolean;
    companyWarningDays?: number;
  };
  expires: string;
};
