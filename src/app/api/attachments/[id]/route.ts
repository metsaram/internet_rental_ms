import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { deleteFile, getSupabasePublicUrl, storageConfig } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const att = await db.attachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: { name: true, email: true } } },
    });
    if (!att || att.companyId !== user.companyId) throw new HttpError(404, "Attachment not found");
    const folder = storageConfig.resolveFolder(att.entityType, att.category);

    return NextResponse.json({
      id: att.id,
      entityType: att.entityType,
      entityId: att.entityId,
      category: att.category,
      fileName: att.fileName,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      uploadedBy: att.uploadedBy,
      createdAt: att.createdAt,
      supabaseUrl: getSupabasePublicUrl(att.storageKey, folder),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const att = await db.attachment.findUnique({ where: { id } });
    if (!att || att.companyId !== user.companyId) throw new HttpError(404, "Attachment not found");

    const folder = storageConfig.resolveFolder(att.entityType, att.category);

    // Delete the file from storage first, then the metadata.
    await deleteFile(att.storageKey, folder);
    await db.attachment.delete({ where: { id } });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "Attachment",
      entityId: id,
      before: { fileName: att.fileName, entityType: att.entityType },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
