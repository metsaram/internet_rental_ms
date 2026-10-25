import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { getFile, storageConfig } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

/**
 * Download an attachment. Authenticated + company-scoped. Streams the raw file
 * with a Content-Disposition: attachment header so the browser downloads it
 * rather than rendering it inline (defends against stored XSS in uploaded
 * HTML/SVG files).
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const att = await db.attachment.findUnique({ where: { id } });
    if (!att || att.companyId !== user.companyId) throw new HttpError(404, "Attachment not found");

    const folder = storageConfig.resolveFolder(att.entityType, att.category);
    const buf = await getFile(att.storageKey, folder);
    if (!buf) throw new HttpError(410, "File no longer exists in storage");

    const url = new URL(req.url);
    const isInline = url.searchParams.get("inline") === "true" || url.searchParams.get("view") === "true";
    const isSafeViewable = att.mimeType.startsWith("image/") || att.mimeType === "application/pdf";
    const disposition = isInline && isSafeViewable ? "inline" : "attachment";

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": att.mimeType,
        "content-disposition": `${disposition}; filename="${att.fileName.replace(/"/g, "_")}"`,
        "content-length": String(buf.byteLength),
        "cache-control": isInline ? "private, max-age=3600" : "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
