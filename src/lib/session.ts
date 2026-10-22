import { getServerSession } from "next-auth";
import { authOptions, type AppSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { GlobalValidator, ValidationError } from "@/lib/global-validator";

export type Role = "ADMIN" | "STAFF";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  companyId: string;
  companyName: string;
  companyCode: string;
  companyCurrency: string;
}

/** Get the current server-side session, typed. Returns null if unauthenticated. */
export async function getSession(): Promise<SessionUser | null> {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user) return null;
  const u = session.user as any;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    companyId: u.companyId,
    companyName: u.companyName,
    companyCode: u.companyCode,
    companyCurrency: u.companyCurrency,
  };
}

/** Require an authenticated session or throw a 401-shaped error. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSession();
  if (!u) throw new HttpError(401, "Unauthorized");
  return u;
}

/** Require an ADMIN role. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new HttpError(403, "Forbidden: admin only");
  return u;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Standard JSON error response. */
export function errorResponse(err: unknown) {
  if (
    err instanceof HttpError ||
    err instanceof ValidationError ||
    (err && typeof err === "object" && "status" in err && typeof (err as any).status === "number")
  ) {
    return new Response(JSON.stringify({ error: (err as any).message }), {
      status: (err as any).status,
      headers: { "content-type": "application/json" },
    });
  }
  if (err && typeof err === "object" && "name" in err && (err as any).name === "ZodError") {
    const issues = (err as any).issues || [];
    const msg =
      issues.map((i: any) => `${i.path?.join(".") || "field"}: ${i.message}`).join(", ") ||
      "Validation failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  console.error("[api] unhandled error:", err);
  return new Response(
    JSON.stringify({ error: "Internal server error" }),
    { status: 500, headers: { "content-type": "application/json" } }
  );
}

/** Parse JSON body from a Request, enforcing the global validator. */
export async function parseJsonBody<T = unknown>(
  req: Request,
  options?: {
    skipValidation?: boolean;
    allowSpaces?: boolean;
    strict?: boolean;
  }
): Promise<T> {
  let raw: T;
  try {
    raw = (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (options?.skipValidation || !raw || typeof raw !== "object") {
    return raw;
  }

  return GlobalValidator.processApiPayload(raw, options) as T;
}

/**
 * Resolve a branch to the caller's company, returning the branch or throwing
 * if it doesn't belong to the same company. Used to enforce tenant scope.
 */
export async function assertBranchInCompany(branchId: string, companyId: string) {
  const branch = await db.branch.findUnique({ where: { id: branchId } });
  if (!branch || branch.companyId !== companyId) {
    throw new HttpError(404, "Branch not found");
  }
  return branch;
}
