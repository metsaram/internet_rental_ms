import { NextResponse } from "next/server";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { autoMatchHeader } from "@/lib/import-fields";
import * as XLSX from "xlsx";

/**
 * Phase 09 — Preview an uploaded XLSX workbook.
 *
 * Receives the raw file as FormData, parses it server-side with the `xlsx`
 * library, and returns the list of worksheets + the headers + up to 8 sample
 * rows from the first (or selected) worksheet. Nothing is persisted at this
 * stage — the client shows the mapping UI and the user confirms before
 * /api/import/commit writes anything.
 *
 * File-type + size validation: only .xlsx/.xls, max 2 MB.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "No file uploaded");
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw new HttpError(400, "Only .xlsx or .xls files are supported");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new HttpError(400, "File too large (max 2 MB)");
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
    const worksheets = wb.SheetNames;
    if (worksheets.length === 0) {
      throw new HttpError(400, "Workbook has no worksheets");
    }

    const sheetName = (formData.get("worksheet") as string) || worksheets[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) throw new HttpError(400, `Worksheet "${sheetName}" not found`);

    // Convert to array-of-arrays to preserve header row position.
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
    });
    if (aoa.length === 0) {
      throw new HttpError(400, "Worksheet is empty");
    }

    const headerRow = (aoa[0] as unknown[]).map((h) =>
      h === null || h === undefined ? "" : String(h).trim()
    );
    const dataRows = aoa.slice(1).filter((r) =>
      Array.isArray(r) && r.some((c) => c !== null && c !== undefined && c !== "")
    );

    // Auto-match headers to target fields.
    const autoMap: Record<string, { header: string; target: string | null }> = {};
    headerRow.forEach((h, i) => {
      if (!h) return;
      autoMap[`col${i}`] = { header: h, target: autoMatchHeader(h) };
    });

    const sampleRows = dataRows.slice(0, 8).map((r) =>
      headerRow.map((h, i) => ({ header: h, value: (r as unknown[])[i] ?? null }))
    );

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      worksheets,
      worksheet: sheetName,
      totalRows: dataRows.length,
      headers: headerRow.map((h, i) => ({ index: i, label: h })),
      autoMap,
      sampleRows,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
