import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "ARCHIVE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "IMPORT"
  | "EXPORT";

interface AuditEntry {
  companyId: string;
  actorId?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  correlationId?: string | null;
}

/**
 * Write an audit log entry. Sensitive fields (passwords, tokens) should be
 * redacted by the caller before passing `before`/`after`.
 */
export async function writeAudit(entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        companyId: entry.companyId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before ? JSON.stringify(entry.before) : null,
        after: entry.after ? JSON.stringify(entry.after) : null,
        correlationId: entry.correlationId ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never break the primary operation.
    console.error("[audit] failed to write audit log:", err);
  }
}

/** Redact sensitive keys from an object before logging. */
export function redactSensitive<T extends Record<string, unknown>>(
  obj: T,
  keys: string[] = ["password", "passwordHash", "token", "secret", "username"]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = keys.includes(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

export type { Prisma };
