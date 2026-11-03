import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requireAdmin, parseJsonBody, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { generateNotifications } from "@/lib/notifications";
import { clearNotificationThrottle } from "@/app/api/notifications/route";

export async function GET() {
  try {
    const user = await requireUser();
    const company = await db.company.findUnique({
      where: { id: user.companyId },
    });
    if (!company) return new Response(null, { status: 404 });
    return NextResponse.json(company);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await parseJsonBody<{
      name?: string;
      taxId?: string | null;
      address?: string | null;
      city?: string | null;
      phone?: string | null;
      email?: string | null;
      currency?: string;
      useContract?: boolean;
      warningDays?: number;
      daysBeforeWarning?: number;
    }>(req);

    const before = await db.company.findUnique({ where: { id: user.companyId } });
    if (!before) throw new HttpError(404, "Company not found");

    const warningDaysInput = body.warningDays ?? body.daysBeforeWarning;
    let warningDays = before.warningDays ?? 30;
    if (warningDaysInput !== undefined && warningDaysInput !== null) {
      const parsed = Number(warningDaysInput);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
        throw new HttpError(400, "Days before warning must be an integer between 1 and 365");
      }
      warningDays = parsed;
    }

    const data = {
      name: body.name?.trim() || before.name,
      taxId: body.taxId ?? before.taxId,
      address: body.address ?? before.address,
      city: body.city ?? before.city,
      phone: body.phone ?? before.phone,
      email: body.email ?? before.email,
      currency: body.currency?.trim() || before.currency,
      useContract: body.useContract ?? before.useContract,
      warningDays,
    };

    const after = await db.company.update({ where: { id: user.companyId }, data });

    if (before.warningDays !== after.warningDays) {
      clearNotificationThrottle(user.companyId);
      try {
        await generateNotifications({ companyId: user.companyId, userId: user.id });
      } catch (genErr) {
        console.warn("[company] Notification regeneration failed on warningDays update:", genErr);
      }
    }
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Company",
      entityId: after.id,
      before: { name: before.name, currency: before.currency, warningDays: before.warningDays },
      after: { name: after.name, currency: after.currency, warningDays: after.warningDays },
    });

    return NextResponse.json(after);
  } catch (err) {
    return errorResponse(err);
  }
}
