import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { computeContractCosts, deriveContractStatus } from "@/lib/contracts";
import * as XLSX from "xlsx";

/**
 * Export branches | shops | services | contracts to .xlsx.
 * Query: ?entity=contracts (default), &status=, &search=
 * Sensitive fields (ISP usernames/passwords) are NEVER included.
 * Untrusted text beginning with = + - @ is prefixed with a single quote to
 * mitigate spreadsheet formula injection.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const entity = (url.searchParams.get("entity") ?? "contracts") as
      | "branches"
      | "shops"
      | "services"
      | "contracts";
    const status = url.searchParams.get("status") ?? "ALL";
    const search = (url.searchParams.get("search") ?? "").toLowerCase();

    let rows: Record<string, unknown>[] = [];
    let sheetName = "Export";

    if (entity === "branches") {
      sheetName = "Branches";
      const data = await db.branch.findMany({
        where: {
          companyId: user.companyId,
          ...(status !== "ALL" ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { code: { contains: search } },
                  { name: { contains: search } },
                  { city: { contains: search } },
                  { manager: { contains: search } },
                ],
              }
            : {}),
        },
        include: { _count: { select: { shops: true, services: true } } },
        orderBy: { code: "asc" },
      });
      rows = data.map((b) => ({
        Code: b.code,
        Name: b.name,
        City: b.city ?? "",
        Manager: b.manager ?? "",
        Phone: b.phone ?? "",
        Email: b.email ?? "",
        Shops: b._count.shops,
        Services: b._count.services,
        Status: b.status,
        Created: b.createdAt,
      }));
    } else if (entity === "shops") {
      sheetName = "Shops";
      const data = await db.shop.findMany({
        where: {
          companyId: user.companyId,
          ...(status !== "ALL" ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { code: { contains: search } },
                  { name: { contains: search } },
                  { contactPerson: { contains: search } },
                ],
              }
            : {}),
        },
        include: {
          branch: { select: { code: true, name: true } },
          _count: { select: { services: true } },
        },
        orderBy: { code: "asc" },
      });
      rows = data.map((s) => ({
        Code: s.code,
        Name: s.name,
        Type: s.type,
        Branch: s.branch?.code ?? "",
        "Branch name": s.branch?.name ?? "",
        Contact: s.contactPerson ?? "",
        Phone: s.phone ?? "",
        Email: s.email ?? "",
        Address: s.address ?? "",
        Services: s._count.services,
        Status: s.status,
      }));
    } else if (entity === "services") {
      sheetName = "Services";
      const data = await db.internetService.findMany({
        where: {
          companyId: user.companyId,
          ...(status !== "ALL" ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { serviceCode: { contains: search } },
                  { accountId: { contains: search } },
                  { installationAddress: { contains: search } },
                ],
              }
            : {}),
        },
        include: {
          branch: { select: { code: true, name: true } },
          shop: { select: { code: true, name: true } },
          provider: { select: { code: true, name: true } },
          plan: { select: { name: true } },
        },
        orderBy: { serviceCode: "asc" },
      });
      // Sensitive username is deliberately excluded from exports.
      rows = data.map((s) => ({
        "Service code": s.serviceCode,
        "Account ID": s.accountId ?? "",
        Branch: s.branch?.code ?? "",
        Shop: s.shop?.code ?? "",
        Provider: s.provider?.code ?? "",
        Plan: s.plan?.name ?? "",
        Address: s.installationAddress ?? "",
        "IP address": s.ipAddress ?? "",
        "IP type": s.ipType,
        Installed: s.installedAt ? s.installedAt.toISOString().slice(0, 10) : "",
        Status: s.status,
      }));
    } else {
      // contracts
      sheetName = "Contracts";
      const data = await db.internetContract.findMany({
        where: {
          companyId: user.companyId,
          ...(status !== "ALL" ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { contractNumber: { contains: search } },
                  { service: { serviceCode: { contains: search } } },
                ],
              }
            : {}),
        },
        include: {
          service: {
            select: {
              serviceCode: true,
              branch: { select: { code: true, name: true } },
              shop: { select: { code: true, name: true } },
              provider: { select: { code: true, name: true } },
              plan: { select: { name: true } },
            },
          },
        },
        orderBy: { endDate: "asc" },
      });
      const now = new Date();
      rows = data.map((c) => {
        const costs = computeContractCosts(c);
        const derived = deriveContractStatus(c, now, 30);
        return {
          "Contract #": c.contractNumber,
          "Service code": c.service.serviceCode,
          Branch: c.service.branch?.code ?? "",
          Shop: c.service.shop?.code ?? "",
          Provider: c.service.provider?.code ?? "",
          Plan: c.service.plan?.name ?? "",
          Start: c.startDate.toISOString().slice(0, 10),
          End: c.endDate.toISOString().slice(0, 10),
          Duration: c.durationMonths,
          "Free months": c.freeMonths,
          "Paid months": costs.paidMonths,
          "Monthly fee": Number(c.monthlyFee),
          Currency: c.currency,
          "Scheduled total": Number(costs.scheduledTotal),
          "Effective monthly": Number(costs.effectiveMonthly),
          "Billing cycle": c.billingCycle,
          Status: c.status,
          "Derived status": derived,
        };
      });
      if (data.length === 0) {
        throw new HttpError(404, "No contracts match the current filters");
      }
    }

    if (rows.length === 0) {
      throw new HttpError(404, "No records match the current filters");
    }

    // Mitigate CSV/formula injection: prefix cell text starting with = + - @
    const sanitized = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "string" && /^[=+\-@]/.test(v)) {
          out[k] = `'${v}`; // leading single quote forces text in spreadsheets
        } else {
          out[k] = v;
        }
      }
      return out;
    });

    const ws = XLSX.utils.json_to_sheet(sanitized);
    // Reasonable column widths
    const colWidths = Object.keys(sanitized[0] ?? {}).map((k) => ({
      wch: Math.min(40, Math.max(12, k.length + 4)),
    }));
    (ws as any)["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="netrent-${entity}-${stamp}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
