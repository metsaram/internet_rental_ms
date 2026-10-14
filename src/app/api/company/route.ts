import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, parseJsonBody, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

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
    }>(req);

    const before = await db.company.findUnique({ where: { id: user.companyId } });
    if (!before) throw new HttpError(404, "Company not found");

    const data = {
      name: body.name?.trim() || before.name,
      taxId: body.taxId ?? before.taxId,
      address: body.address ?? before.address,
      city: body.city ?? before.city,
      phone: body.phone ?? before.phone,
      email: body.email ?? before.email,
      currency: body.currency?.trim() || before.currency,
    };

    const after = await db.company.update({ where: { id: user.companyId }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Company",
      entityId: after.id,
      before: { name: before.name, currency: before.currency },
      after: { name: after.name, currency: after.currency },
    });

    return NextResponse.json(after);
  } catch (err) {
    return errorResponse(err);
  }
}
