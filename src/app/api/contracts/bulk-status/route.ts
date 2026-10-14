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

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one contract"),
  status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"]),
});

/**
 * Bulk-update the status of multiple contracts in a single transaction.
 * Company-scoped: only contracts belonging to the caller's company are
 * affected (the WHERE clause enforces this). Audit-logged with a summary.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = bulkSchema.parse(await parseJsonBody(req));

    const result = await db.$transaction(async (tx) => {
      // Only update contracts in the caller's company that match the given IDs.
      const update = await tx.internetContract.updateMany({
        where: {
          id: { in: body.ids },
          companyId: user.companyId,
        },
        data: { status: body.status },
      });
      return update;
    });

    if (result.count === 0) {
      throw new HttpError(404, "No matching contracts found in your company");
    }

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "InternetContract",
      entityId: null,
      after: { bulkStatus: body.status, count: result.count, ids: body.ids },
    });

    return NextResponse.json({
      updated: result.count,
      status: body.status,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
