import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  shopId: z.string().min(1, "Shop is required"),
  body: z.string().min(1, "Note body is required").max(2000),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await parseJsonBody(req));

    // Shop must belong to caller's company.
    const shop = await db.shop.findUnique({ where: { id: body.shopId } });
    if (!shop || shop.companyId !== user.companyId) {
      throw new HttpError(404, "Shop not found");
    }

    const created = await db.note.create({
      data: {
        companyId: user.companyId,
        shopId: body.shopId,
        authorId: user.id,
        body: body.body,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Note",
      entityId: created.id,
      after: { shopId: body.shopId, body: body.body },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
