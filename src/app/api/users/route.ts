import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAdmin,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit, redactSensitive } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().min(1).max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

/** List users for the admin's company. */
export async function GET() {
  try {
    const user = await requireAdmin();
    const users = await db.user.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { notes: true, contracts: true, invoices: true, payments: true } },
      },
    });
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        activityCount: u._count.notes + u._count.contracts + u._count.invoices + u._count.payments,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create a new user (admin only). */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = createSchema.parse(await parseJsonBody(req));

    // Enforce unique email globally.
    const existing = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new HttpError(409, "Email already in use");

    const created = await db.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name.trim(),
        passwordHash: hashPassword(body.password),
        role: body.role,
        companyId: user.companyId,
        status: "ACTIVE",
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "User",
      entityId: created.id,
      after: redactSensitive({ ...created }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
