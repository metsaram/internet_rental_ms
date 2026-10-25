import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

const DOWNLOAD_DIR = path.join(process.cwd(), "download");

function generateFallbackTemplate(type: "contract" | "service", currency = "USD"): Uint8Array {
  const wb = XLSX.utils.book_new();
  if (type === "contract") {
    const data = [
      {
        "Contract Number": "CT-IMP-001",
        "Service Code": "SVC-0001",
        "Start Date": "2026-01-01",
        "Duration Months": 12,
        "Monthly Fee": 790,
        "Free Months": 1,
        Currency: currency,
        Status: "ACTIVE",
        "Billing Cycle": "MONTHLY",
        Notes: "Imported contract demo",
      },
      {
        "Contract Number": "CT-IMP-002",
        "Service Code": "SVC-0002",
        "Start Date": "2026-02-01",
        "Duration Months": 12,
        "Monthly Fee": 1290,
        "Free Months": 0,
        Currency: currency,
        Status: "ACTIVE",
        "Billing Cycle": "MONTHLY",
        Notes: "Bulk import",
      },
      {
        "Contract Number": "CT-IMP-003",
        "Service Code": "SVC-0003",
        "Start Date": "2026-01-15",
        "Duration Months": 12,
        "Monthly Fee": 890,
        "Free Months": 0,
        Currency: currency,
        Status: "DRAFT",
        "Billing Cycle": "MONTHLY",
        Notes: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Contracts");
  } else {
    const data = [
      {
        "Service Code": "SVC-IMP-001",
        "Branch Code": "BKK-01",
        "Shop Code": "SUK-A1",
        "Provider Code": "AIS-FIBER",
        "Plan Name": "Home 300/100",
        "Customer ID (CID)": "CID-AIS-1001",
        "Service ID (SID)": "SID-880019",
        "Account ID": "AIS-900001",
        "IP Address": "10.0.10.5",
        "IP Type": "STATIC",
        Status: "ACTIVE",
      },
      {
        "Service Code": "SVC-IMP-002",
        "Branch Code": "BKK-02",
        "Shop Code": "",
        "Provider Code": "TRUE",
        "Plan Name": "True 600/150",
        "Customer ID (CID)": "CID-TRUE-2002",
        "Service ID (SID)": "SID-441203",
        "Account ID": "TRUE-900002",
        "IP Address": "",
        "IP Type": "DYNAMIC",
        Status: "ACTIVE",
      },
      {
        "Service Code": "SVC-IMP-003",
        "Branch Code": "CNX-01",
        "Shop Code": "CNX-01",
        "Provider Code": "3BB",
        "Plan Name": "3BB 200/50",
        "Customer ID (CID)": "CID-3BB-3003",
        "Service ID (SID)": "SID-772910",
        "Account ID": "3BB-900003",
        "IP Address": "10.0.30.2",
        "IP Type": "STATIC",
        Status: "PENDING",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Services");
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf);
}

import { supabaseStorage } from "@/lib/supabase-storage";

async function fetchTemplateFromSupabaseStorage(type: string): Promise<Uint8Array | null> {
  const filename = `netrent-${type}-import-template.xlsx`;
  const buf = await supabaseStorage.download(`template/${filename}`);
  return buf ? new Uint8Array(buf) : null;
}

/**
 * Serve an import template .xlsx.
 * 1. Checks Supabase Storage Bucket (`net_rent/template/`)
 * 2. Falls back to local filesystem (`download/`)
 * 3. Falls back to in-memory generation with company currency
 * Authenticated users only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const user = await requireUser();
    const { type } = await params;
    const allowed = ["contract", "service"];
    if (!allowed.includes(type)) {
      throw new HttpError(400, "Unknown template type");
    }

    // 1. Fetch from Supabase Storage bucket
    let fileBytes = await fetchTemplateFromSupabaseStorage(type);

    // 2. Fallback to local filesystem if storage bucket is unreachable
    if (!fileBytes) {
      const filePath = path.join(DOWNLOAD_DIR, `netrent-${type}-import-template.xlsx`);
      try {
        const buf = await readFile(filePath);
        fileBytes = new Uint8Array(buf);
      } catch {
        // 3. Fallback to in-memory generation
        fileBytes = generateFallbackTemplate(type as "contract" | "service", user.companyCurrency ?? "USD");
      }
    }

    return new Response(fileBytes, {
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


