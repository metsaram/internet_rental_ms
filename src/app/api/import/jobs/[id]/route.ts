import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/** Get a single import job with its rows (for the error-review screen). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const job = await db.importJob.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        rows: { orderBy: { rowIndex: "asc" } },
      },
    });
    if (!job || job.companyId !== user.companyId) {
      throw new HttpError(404, "Import job not found");
    }
    return NextResponse.json({
      id: job.id,
      fileName: job.fileName,
      worksheet: job.worksheet,
      entityType: job.entityType,
      columnMap: job.columnMap ? JSON.parse(job.columnMap) : null,
      status: job.status,
      totalRows: job.totalRows,
      importedRows: job.importedRows,
      errorRows: job.errorRows,
      summary: job.summary,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      rows: job.rows.map((r) => ({
        id: r.id,
        rowIndex: r.rowIndex,
        status: r.status,
        message: r.message,
        data: r.data ? JSON.parse(r.data) : null,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
