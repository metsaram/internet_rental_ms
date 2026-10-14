import { NextResponse } from "next/server";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { readFile } from "fs/promises";
import path from "path";

const DOWNLOAD_DIR = "/home/z/my-project/download";

/**
 * Serve a generated template .xlsx from the server-side download directory.
 * Authenticated users only — templates reference the demo data structure.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    await requireUser();
    const { type } = await params;
    const allowed = ["contract", "service"];
    if (!allowed.includes(type)) {
      throw new HttpError(400, "Unknown template type");
    }
    const filePath = path.join(DOWNLOAD_DIR, `netrent-${type}-import-template.xlsx`);
    const buf = await readFile(filePath);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="netrent-${type}-import-template.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
