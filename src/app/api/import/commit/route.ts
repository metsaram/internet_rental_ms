import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { notifyImport } from "@/lib/notifications";
import { getFields, coerceValue, type ImportEntityType } from "@/lib/import-fields";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const commitSchema = z.object({
  entityType: z.enum(["contract", "service"]),
  fileName: z.string().min(1),
  worksheet: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.unknown())), // each row is an array of cell values aligned to headers
  columnMap: z.record(z.string(), z.string()), // { targetField: headerLabel }
  defaultFreeMonths: z.number().int().min(0).max(120).default(0),
});

type RowResult = {
  rowIndex: number;
  status: "OK" | "ERROR" | "IMPORTED";
  message?: string;
  data: Record<string, unknown>;
};

/**
 * Phase 09 — Commit an import.
 *
 * Validates every row against the entity's field definitions, then writes the
 * valid rows in a single `$transaction` (so a mid-batch failure rolls back
 * all prior inserts). Records an ImportJob + one ImportRow per source row
 * (with OK/ERROR status + message), so the user can review exactly which
 * rows imported and which failed and why.
 *
 * Duplicate detection (contracts): contractNumber must be unique per company.
 * (services): serviceCode must be unique per company.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = commitSchema.parse(await parseJsonBody(req));
    const entityType = body.entityType as ImportEntityType;
    const fields = getFields(entityType);

    // Pre-fetch master data for reference normalization (by code) based on entityType.
    let branches: Array<{ id: string; code: string }> = [];
    let providers: Array<{ id: string; code: string }> = [];
    let services: Array<{ id: string; serviceCode: string }> = [];
    let plans: Array<{ id: string; name: string; providerId: string }> = [];
    let shops: Array<{ id: string; code: string; branchId: string }> = [];
    let existingContracts: Array<{ contractNumber: string }> = [];
    let existingServices: Array<{ serviceCode: string }> = [];

    if (entityType === "service") {
      [branches, providers, plans, shops, existingServices] = await Promise.all([
        db.branch.findMany({ where: { companyId: user.companyId }, select: { id: true, code: true } }),
        db.internetProvider.findMany({ where: { companyId: user.companyId }, select: { id: true, code: true } }),
        db.internetPlan.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true, providerId: true } }),
        db.shop.findMany({ where: { companyId: user.companyId }, select: { id: true, code: true, branchId: true } }),
        db.internetService.findMany({ where: { companyId: user.companyId }, select: { serviceCode: true } }),
      ]);
    } else {
      [services, existingContracts] = await Promise.all([
        db.internetService.findMany({ where: { companyId: user.companyId }, select: { id: true, serviceCode: true } }),
        db.internetContract.findMany({ where: { companyId: user.companyId }, select: { contractNumber: true } }),
      ]);
    }

    const branchByCode = new Map(branches.map((b) => [b.code.toUpperCase(), b.id]));
    const providerByCode = new Map(providers.map((p) => [p.code.toUpperCase(), p.id]));
    const serviceByCode = new Map(services.map((s) => [s.serviceCode.toUpperCase(), s.id]));
    const planByKey = new Map(plans.map((p) => [`${p.providerId}:${p.name.toUpperCase()}`, p.id]));
    const shopByCode = new Map(shops.map((s) => [s.code.toUpperCase(), s]));
    const existingContractNums = new Set(existingContracts.map((c) => c.contractNumber.toUpperCase()));
    const existingServiceCodes = new Set(existingServices.map((s) => s.serviceCode.toUpperCase()));

    // Validate each row.
    const results: RowResult[] = [];
    const validContracts: Prisma.InternetContractCreateManyInput[] = [];
    const validServices: Prisma.InternetServiceCreateManyInput[] = [];
    const seenKeys = new Set<string>(); // in-batch duplicate guard

    for (const [idx, rawRow] of body.rows.entries()) {
      const rowIndex = idx + 1; // 1-based to match spreadsheet rows
      const rowObj: Record<string, unknown> = {};
      // Apply columnMap: target ← header ← cell
      for (const [targetField, headerLabel] of Object.entries(body.columnMap)) {
        const colIndex = body.headers.indexOf(headerLabel);
        if (colIndex < 0) continue;
        rowObj[targetField] = rawRow[colIndex];
      }

      const errors: string[] = [];
      const coerced: Record<string, unknown> = {};

      for (const f of fields) {
        let raw = rowObj[f.key];
        if (raw === undefined || raw === null || raw === "") {
          if (f.required) {
            // Apply defaults for known optional-with-default fields.
            if (f.key === "freeMonths") {
              coerced[f.key] = body.defaultFreeMonths;
              continue;
            }
            if (f.key === "currency") {
              coerced[f.key] = user.companyCurrency;
              continue;
            }
            if (f.key === "status") {
              coerced[f.key] = entityType === "contract" ? "DRAFT" : "PENDING";
              continue;
            }
            if (f.key === "billingCycle") {
              coerced[f.key] = "MONTHLY";
              continue;
            }
            if (f.key === "ipType") {
              coerced[f.key] = "DYNAMIC";
              continue;
            }
            errors.push(`${f.label} is required`);
            continue;
          }
          coerced[f.key] = null;
          continue;
        }
        const { value, error } = coerceValue(raw, f.type, f.key);
        if (error) {
          errors.push(`${f.label}: ${error}`);
          continue;
        }
        if (f.type === "enum" && f.enumValues && value && !f.enumValues.includes(value as string)) {
          errors.push(`${f.label}: must be one of ${f.enumValues.join(", ")}`);
          continue;
        }
        coerced[f.key] = value;
      }

      if (entityType === "contract") {
        // Resolve serviceCode → serviceId
        const svcCode = String(coerced.serviceCode ?? "").toUpperCase();
        const serviceId = serviceByCode.get(svcCode);
        if (!serviceId) errors.push(`Service "${coerced.serviceCode}" not found`);

        // Duplicate contract number (in-batch or in-DB)
        const cNum = String(coerced.contractNumber ?? "").toUpperCase();
        if (existingContractNums.has(cNum)) {
          errors.push(`Contract number "${coerced.contractNumber}" already exists`);
        } else if (seenKeys.has(`c:${cNum}`)) {
          errors.push(`Duplicate contract number in this batch`);
        } else {
          seenKeys.add(`c:${cNum}`);
        }

        // freeMonths ≤ duration
        const dur = Number(coerced.durationMonths) || 0;
        const free = Number(coerced.freeMonths) || 0;
        if (free > dur) errors.push(`Free months (${free}) exceed duration (${dur})`);

        // Compute end date from start + duration.
        const start = coerced.startDate as Date | null;
        let end: Date | null = null;
        if (start) {
          end = new Date(start);
          end.setMonth(end.getMonth() + dur);
        }

        if (errors.length === 0 && serviceId && start && end) {
          validContracts.push({
            companyId: user.companyId,
            serviceId,
            contractNumber: String(coerced.contractNumber),
            startDate: start,
            endDate: end,
            durationMonths: dur,
            freeMonths: free,
            monthlyFee: new Prisma.Decimal(Number(coerced.monthlyFee)),
            currency: String(coerced.currency ?? user.companyCurrency),
            billingCycle: (coerced.billingCycle as any) ?? "MONTHLY",
            status: (coerced.status as any) ?? "DRAFT",
            notes: (coerced.notes as string) ?? null,
            createdById: user.id,
          });
        }
      } else if (entityType === "service") {
        // Resolve branchCode / providerCode / optional shopCode / optional planName
        const bCode = String(coerced.branchCode ?? "").toUpperCase();
        const pCode = String(coerced.providerCode ?? "").toUpperCase();
        const branchId = branchByCode.get(bCode);
        const providerId = providerByCode.get(pCode);
        if (!branchId) errors.push(`Branch "${coerced.branchCode}" not found`);
        if (!providerId) errors.push(`Provider "${coerced.providerCode}" not found`);

        // optional shopCode — resolved to a shop in that branch
        let shopId: string | null = null;
        if (coerced.shopCode) {
          const shopCodeStr = String(coerced.shopCode).trim().toUpperCase();
          const shop = shopByCode.get(shopCodeStr);
          if (!shop) errors.push(`Shop "${coerced.shopCode}" not found`);
          else if (branchId && shop.branchId !== branchId) errors.push(`Shop "${coerced.shopCode}" does not belong to branch "${coerced.branchCode}"`);
          else shopId = shop?.id ?? null;
        }

        // optional planName — must belong to the provider
        let planId: string | null = null;
        if (coerced.planName && providerId) {
          planId = planByKey.get(`${providerId}:${String(coerced.planName).toUpperCase()}`) ?? null;
          if (!planId) errors.push(`Plan "${coerced.planName}" not found for provider "${coerced.providerCode}"`);
        }

        // Duplicate service code
        const sCode = String(coerced.serviceCode ?? "").toUpperCase();
        if (existingServiceCodes.has(sCode)) {
          errors.push(`Service code "${coerced.serviceCode}" already exists`);
        } else if (seenKeys.has(`s:${sCode}`)) {
          errors.push(`Duplicate service code in this batch`);
        } else {
          seenKeys.add(`s:${sCode}`);
        }

        if (errors.length === 0 && branchId && providerId) {
          validServices.push({
            companyId: user.companyId,
            branchId,
            shopId,
            providerId,
            planId,
            serviceCode: String(coerced.serviceCode),
            accountId: (coerced.accountId as string) ?? null,
            customerId: (coerced.customerId as string) ?? null,
            ispServiceId: (coerced.ispServiceId as string) ?? null,
            installationAddress: (coerced.installationAddress as string) ?? null,
            ipAddress: (coerced.ipAddress as string) ?? null,
            ipType: (coerced.ipType as any) ?? "DYNAMIC",
            status: (coerced.status as any) ?? "PENDING",
          });
        }
      }

      results.push({
        rowIndex,
        status: errors.length === 0 ? "OK" : "ERROR",
        message: errors.length === 0 ? undefined : errors.join("; "),
        data: rowObj,
      });
    }

    // Atomic write: create the job + rows + insert valid entities in a tx.
    const job = await db.$transaction(async (tx) => {
      const importJob = await tx.importJob.create({
        data: {
          companyId: user.companyId,
          fileName: body.fileName,
          worksheet: body.worksheet ?? null,
          entityType,
          columnMap: JSON.stringify(body.columnMap),
          status: "COMPLETED",
          totalRows: body.rows.length,
          importedRows: 0,
          errorRows: 0,
          createdById: user.id,
        },
      });

      // Persist every row's status.
      await tx.importRow.createMany({
        data: results.map((r) => ({
          jobId: importJob.id,
          rowIndex: r.rowIndex,
          status: r.status === "OK" ? "IMPORTED" : r.status,
          message: r.message ?? null,
          data: JSON.stringify(r.data),
        })),
      });

      let imported = 0;
      if (entityType === "contract" && validContracts.length > 0) {
        const res = await tx.internetContract.createMany({ data: validContracts });
        imported = res.count;
      } else if (entityType === "service" && validServices.length > 0) {
        // createMany for services: username is null (never import credentials).
        const res = await tx.internetService.createMany({
          data: validServices.map((s) => ({ ...s, username: null, installedAt: null })),
        });
        imported = res.count;
      }

      const errorRows = results.filter((r) => r.status === "ERROR").length;
      const updated = await tx.importJob.update({
        where: { id: importJob.id },
        data: {
          importedRows: imported,
          errorRows,
          summary: `${imported} of ${body.rows.length} ${entityType} rows imported; ${errorRows} error(s).`,
        },
      });
      return updated;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "IMPORT",
      entityType: "ImportJob",
      entityId: job.id,
      after: {
        entityType,
        fileName: body.fileName,
        totalRows: body.rows.length,
        importedRows: job.importedRows,
        errorRows: job.errorRows,
      },
    });

    // Phase 16: notify the importer of completion.
    await notifyImport({
      companyId: user.companyId,
      userId: user.id,
      jobId: job.id,
      fileName: body.fileName,
      imported: job.importedRows,
      errors: job.errorRows,
      total: job.totalRows,
    });

    return NextResponse.json({
      jobId: job.id,
      totalRows: job.totalRows,
      importedRows: job.importedRows,
      errorRows: job.errorRows,
      summary: job.summary,
      rowResults: results,
    }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
