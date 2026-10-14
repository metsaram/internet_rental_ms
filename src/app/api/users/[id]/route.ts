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

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  password: z.string().min(8).optional(), // optional reset
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await parseJsonBody(req));

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing || existing.companyId !== admin.companyId) {
      throw new HttpError(404, "User not found");
    }

    // Prevent an admin from disabling themselves (lockout protection).
    if (body.status === "DISABLED" && id === admin.id) {
      throw new HttpError(400, "You cannot disable your own account");
    }
    // Prevent demoting yourself if you're the only admin.
    if (body.role === "STAFF" && id === admin.id && existing.role === "ADMIN") {
      const adminCount = await db.user.count({
        where: { companyId: admin.companyId, role: "ADMIN", status: "ACTIVE" },
      });
      if (adminCount <= 1) {
        throw new HttpError(400, "Cannot demote the last admin");
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name) data.name = body.name.trim();
    if (body.role) data.role = body.role;
    if (body.status) data.status = body.status;
    if (body.password) data.passwordHash = hashPassword(body.password);

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      before: redactSensitive({ name: existing.name, role: existing.role, status: existing.status }),
      after: redactSensitive({ ...updated }),
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return errorResponse(err);
  }
}
