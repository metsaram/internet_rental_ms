import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";

/** List import jobs (history) for the caller's company, newest first. */
export async function GET() {
  try {
    const user = await requireUser();
    const jobs = await db.importJob.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    });
    return NextResponse.json(
      jobs.map((j) => ({
        id: j.id,
        fileName: j.fileName,
        worksheet: j.worksheet,
        entityType: j.entityType,
        status: j.status,
        totalRows: j.totalRows,
        importedRows: j.importedRows,
        errorRows: j.errorRows,
        summary: j.summary,
        createdBy: j.createdBy,
        createdAt: j.createdAt,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
