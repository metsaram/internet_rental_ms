import { db } from "@/lib/db";
import {
  requireUser,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const note = await db.note.findUnique({
      where: { id },
      include: { shop: { select: { companyId: true } } },
    });
    if (!note || note.shop.companyId !== user.companyId) {
      throw new HttpError(404, "Note not found");
    }

    // STAFF may only delete their own notes; ADMIN may delete any.
    if (user.role !== "ADMIN" && note.authorId !== user.id) {
      throw new HttpError(403, "You can only delete your own notes");
    }

    await db.note.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "Note",
      entityId: id,
      before: { shopId: note.shopId, body: note.body },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
