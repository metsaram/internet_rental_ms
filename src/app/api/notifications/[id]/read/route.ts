import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/** Mark a single notification as read. */
export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const n = await db.notification.findUnique({ where: { id } });
    if (!n || n.companyId !== user.companyId || n.userId !== user.id) {
      throw new HttpError(404, "Notification not found");
    }
    if (n.readAt) return NextResponse.json({ id, alreadyRead: true });
    const updated = await db.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ id: updated.id, readAt: updated.readAt });
  } catch (err) {
    return errorResponse(err);
  }
}
