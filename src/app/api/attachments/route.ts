import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { putFile, isAllowedMime, MAX_FILE_BYTES, formatBytes } from "@/lib/storage";
import { z } from "zod";

const createSchema = z.object({
  entityType: z.enum(["contract", "invoice", "payment", "provider", "shop", "branch"]),
  entityId: z.string().min(1),
  category: z.enum(["CONTRACT", "QUOTATION", "INVOICE", "RECEIPT", "PROVIDER_DOC", "OTHER"]).default("OTHER"),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
});

/** List attachments for an entity (or all for the company). */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");

    const where: Record<string, unknown> = { companyId: user.companyId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const rows = await db.attachment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { uploadedBy: { select: { name: true, email: true } } },
    });
    return NextResponse.json(
      rows.map((a) => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        category: a.category,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        sizeLabel: formatBytes(a.sizeBytes),
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** Upload a file (multipart). Stores via StorageService + records metadata. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const file = formData.get("file");
    const entityType = formData.get("entityType");
    const entityId = formData.get("entityId");
    const category = (formData.get("category") as string) || "OTHER";

    if (!(file instanceof File)) throw new HttpError(400, "No file provided");
    if (!entityType || !entityId) throw new HttpError(400, "entityType + entityId required");
    if (file.size > MAX_FILE_BYTES) {
      throw new HttpError(400, `File too large (max ${formatBytes(MAX_FILE_BYTES)})`);
    }
    if (!isAllowedMime(file.type)) {
      throw new HttpError(400, `File type "${file.type}" not allowed`);
    }

    // Validate the entity belongs to the company (basic ownership check).
    await assertEntityOwnership(entityType as string, entityId as string, user.companyId);

    const ext = file.name.includes(".") ? file.name.split(".").pop() : undefined;
    const { key, size } = await putFile(await file.arrayBuffer(), ext);

    const att = await db.attachment.create({
      data: {
        companyId: user.companyId,
        entityType: entityType as string,
        entityId: entityId as string,
        category: category as any,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: size,
        storageKey: key,
        uploadedById: user.id,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: att.id,
      after: { fileName: att.fileName, entityType: att.entityType, entityId: att.entityId },
    });

    return NextResponse.json({ id: att.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

async function assertEntityOwnership(entityType: string, entityId: string, companyId: string) {
  switch (entityType) {
    case "contract": {
      const c = await db.internetContract.findUnique({ where: { id: entityId }, select: { companyId: true } });
      if (!c || c.companyId !== companyId) throw new HttpError(404, "Contract not found");
      break;
    }
    case "invoice": {
      const i = await db.invoice.findUnique({ where: { id: entityId }, select: { companyId: true } });
      if (!i || i.companyId !== companyId) throw new HttpError(404, "Invoice not found");
      break;
    }
    case "provider": {
      const p = await db.internetProvider.findUnique({ where: { id: entityId }, select: { companyId: true } });
      if (!p || p.companyId !== companyId) throw new HttpError(404, "Provider not found");
      break;
    }
    case "branch": {
      const b = await db.branch.findUnique({ where: { id: entityId }, select: { companyId: true } });
      if (!b || b.companyId !== companyId) throw new HttpError(404, "Branch not found");
      break;
    }
    case "payment": {
      const p = await db.payment.findUnique({ where: { id: entityId }, select: { companyId: true } });
      if (!p || p.companyId !== companyId) throw new HttpError(404, "Payment not found");
      break;
    }
    default:
      // For other entity types, skip strict check (the attachment is still
      // company-scoped by companyId).
      break;
  }
}
