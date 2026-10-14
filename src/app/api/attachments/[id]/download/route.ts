import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { getFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

/**
 * Download an attachment. Authenticated + company-scoped. Streams the raw file
 * with a Content-Disposition: attachment header so the browser downloads it
 * rather than rendering it inline (defends against stored XSS in uploaded
 * HTML/SVG files).
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const att = await db.attachment.findUnique({ where: { id } });
    if (!att || att.companyId !== user.companyId) throw new HttpError(404, "Attachment not found");

    const buf = await getFile(att.storageKey);
    if (!buf) throw new HttpError(410, "File no longer exists in storage");

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": att.mimeType,
        "content-disposition": `attachment; filename="${att.fileName.replace(/"/g, "_")}"`,
        "content-length": String(buf.byteLength),
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
