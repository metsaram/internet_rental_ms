import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const n = await db.notification.findUnique({ where: { id } });
    if (!n || n.companyId !== user.companyId || n.userId !== user.id) {
      throw new HttpError(404, "Notification not found");
    }
    await db.notification.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
