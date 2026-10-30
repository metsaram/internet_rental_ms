import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  errorResponse,
} from "@/lib/session";
import { getFields, coerceValue, type ImportEntityType } from "@/lib/import-fields";
import { z } from "zod";

const validateSchema = z.object({
  entityType: z.enum(["contract", "service"]),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  columnMap: z.record(z.string(), z.string()), // { targetField: headerLabel }
  defaultFreeMonths: z.number().int().min(0).max(120).default(0),
});

export interface ValidationIssue {
  row: number; // 2-based row number matching spreadsheet
  field: string;
  fieldLabel: string;
  value: unknown;
  message: string;
  suggestion?: string;
  severity: "error" | "warning";
}

export interface FieldValidationStat {
  key: string;
  label: string;
  required: boolean;
  mapped: boolean;
  mappedHeader: string | null;
  status: "valid" | "invalid" | "unmapped" | "warning";
  matchedCount: number;
  totalTested: number;
  unmatchedValues: string[];
  message: string;
  availableOptions?: string[];
}

/**
 * Validate mapped spreadsheet columns against real database records before commit.
 * Checks branch codes, shop codes, provider codes, plan names, service codes,
 * and detects existing duplicates.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = validateSchema.parse(await parseJsonBody(req));
    const entityType = body.entityType as ImportEntityType;
    const fields = getFields(entityType);

    // Fetch real master data from database for current company based on entityType
    let branches: Array<{ id: string; code: string; name: string }> = [];
    let providers: Array<{ id: string; code: string; name: string }> = [];
    let services: Array<{ id: string; serviceCode: string; branchId: string }> = [];
    let plans: Array<{ id: string; name: string; providerId: string; provider: { code: string } }> = [];
    let shops: Array<{ id: string; code: string; name: string; branchId: string; branch: { code: string } | null }> = [];
    let existingContracts: Array<{ contractNumber: string }> = [];
    let existingServices: Array<{ serviceCode: string }> = [];

    // Safe DB fetch with retry for Supabase pooler connections
    const fetchMasterData = async () => {
      if (entityType === "service") {
        const [b, p, pl, sh, es] = await Promise.all([
          db.branch.findMany({
            where: { companyId: user.companyId },
            select: { id: true, code: true, name: true },
            orderBy: { code: "asc" },
          }),
          db.internetProvider.findMany({
            where: { companyId: user.companyId },
            select: { id: true, code: true, name: true },
            orderBy: { code: "asc" },
          }),
          db.internetPlan.findMany({
            where: { companyId: user.companyId },
            select: { id: true, name: true, providerId: true, provider: { select: { code: true } } },
            orderBy: { name: "asc" },
          }),
          db.shop.findMany({
            where: { companyId: user.companyId },
            select: { id: true, code: true, name: true, branchId: true, branch: { select: { code: true } } },
            orderBy: { code: "asc" },
          }),
          db.internetService.findMany({
            where: { companyId: user.companyId },
            select: { serviceCode: true },
          }),
        ]);
        branches = b;
        providers = p;
        plans = pl;
        shops = sh;
        existingServices = es;
      } else {
        const [s, c] = await Promise.all([
          db.internetService.findMany({
            where: { companyId: user.companyId },
            select: { id: true, serviceCode: true, branchId: true },
            orderBy: { serviceCode: "asc" },
          }),
          db.internetContract.findMany({
            where: { companyId: user.companyId },
            select: { contractNumber: true },
          }),
        ]);
        services = s;
        existingContracts = c;
      }
    };

    try {
      await fetchMasterData();
    } catch (err: unknown) {
      // Retry once if transient network / pooler glitch
      const isConnError = (err as { code?: string; message?: string })?.code === "P1001" ||
        String((err as Error)?.message || "").includes("Can't reach database server");
      if (isConnError) {
        await new Promise((r) => setTimeout(r, 250));
        await fetchMasterData();
      } else {
        throw err;
      }
    }

    const branchByCode = new Map(branches.map((b) => [b.code.toUpperCase(), b]));
    const providerByCode = new Map(providers.map((p) => [p.code.toUpperCase(), p]));
    const serviceByCode = new Map(services.map((s) => [s.serviceCode.toUpperCase(), s]));
    const shopByCode = new Map(shops.map((s) => [s.code.toUpperCase(), s]));
    const planByKey = new Map(plans.map((p) => [`${p.providerId}:${p.name.toUpperCase()}`, p]));

    const existingContractNums = new Set(existingContracts.map((c) => c.contractNumber.toUpperCase()));
    const existingServiceCodes = new Set(existingServices.map((s) => s.serviceCode.toUpperCase()));

    // In-batch duplicate tracking
    const seenBatchKeys = new Set<string>();

    const issues: ValidationIssue[] = [];
    const missingRequiredFields: Array<{ key: string; label: string }> = [];

    // Check which required fields are not mapped
    for (const f of fields) {
      if (f.required && !body.columnMap[f.key]) {
        // Special case: freeMonths, currency, status, billingCycle, ipType have fallbacks
        if (["freeMonths", "currency", "status", "billingCycle", "ipType"].includes(f.key)) {
          continue;
        }
        missingRequiredFields.push({ key: f.key, label: f.label });
      }
    }

    // Per-field stat accumulators
    const stats: Record<string, FieldValidationStat> = {};
    for (const f of fields) {
      const mappedHeader = body.columnMap[f.key] ?? null;
      let availableOptions: string[] | undefined;
      if (f.key === "branchCode") availableOptions = branches.map((b) => `${b.code} (${b.name})`);
      else if (f.key === "providerCode") availableOptions = providers.map((p) => `${p.code} (${p.name})`);
      else if (f.key === "shopCode") availableOptions = shops.map((s) => `${s.code} (${s.name})`);
      else if (f.key === "serviceCode" && entityType === "contract") availableOptions = services.map((s) => s.serviceCode);

      stats[f.key] = {
        key: f.key,
        label: f.label,
        required: !!f.required,
        mapped: !!mappedHeader,
        mappedHeader,
        status: mappedHeader ? "valid" : f.required ? "unmapped" : "valid",
        matchedCount: 0,
        totalTested: 0,
        unmatchedValues: [],
        message: mappedHeader
          ? f.required
            ? "Required field mapped"
            : "Optional field mapped"
          : f.required
          ? "Required field is not mapped"
          : "Optional field not mapped",
        availableOptions,
      };
    }

    const invalidRowIndices = new Set<number>();

    // Process each spreadsheet row
    body.rows.forEach((rawRow, idx) => {
      const rowIndex = idx + 2; // Row 1 is header, data starts at Row 2
      const rowData: Record<string, unknown> = {};

      for (const [targetField, headerLabel] of Object.entries(body.columnMap)) {
        const colIndex = body.headers.indexOf(headerLabel);
        if (colIndex >= 0) {
          rowData[targetField] = rawRow[colIndex];
        }
      }

      // 1. Validate Service imports
      if (entityType === "service") {
        // Branch Code check
        if (body.columnMap.branchCode) {
          const rawBranch = rowData.branchCode;
          const branchCodeStr = rawBranch ? String(rawBranch).trim().toUpperCase() : "";
          stats.branchCode.totalTested++;
          if (!branchCodeStr) {
            issues.push({
              row: rowIndex,
              field: "branchCode",
              fieldLabel: "Branch code",
              value: rawBranch,
              message: "Branch code is empty",
              suggestion: `Available branches: ${branches.map((b) => b.code).join(", ")}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (!branchByCode.has(branchCodeStr)) {
            if (!stats.branchCode.unmatchedValues.includes(String(rawBranch))) {
              stats.branchCode.unmatchedValues.push(String(rawBranch));
            }
            issues.push({
              row: rowIndex,
              field: "branchCode",
              fieldLabel: "Branch code",
              value: rawBranch,
              message: `Branch "${rawBranch}" does not exist in your database`,
              suggestion: `Available branches: ${branches.map((b) => b.code).join(", ")}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            stats.branchCode.matchedCount++;
          }
        }

        // Provider Code check
        if (body.columnMap.providerCode) {
          const rawProvider = rowData.providerCode;
          const pCodeStr = rawProvider ? String(rawProvider).trim().toUpperCase() : "";
          stats.providerCode.totalTested++;
          if (!pCodeStr) {
            issues.push({
              row: rowIndex,
              field: "providerCode",
              fieldLabel: "Provider code",
              value: rawProvider,
              message: "Provider code is empty",
              suggestion: `Available providers: ${providers.map((p) => p.code).join(", ")}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (!providerByCode.has(pCodeStr)) {
            if (!stats.providerCode.unmatchedValues.includes(String(rawProvider))) {
              stats.providerCode.unmatchedValues.push(String(rawProvider));
            }
            issues.push({
              row: rowIndex,
              field: "providerCode",
              fieldLabel: "Provider code",
              value: rawProvider,
              message: `Provider "${rawProvider}" does not exist in your database`,
              suggestion: `Available providers: ${providers.map((p) => p.code).join(", ")}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            stats.providerCode.matchedCount++;
          }
        }

        // Shop Code check (optional)
        if (body.columnMap.shopCode && rowData.shopCode) {
          const rawShop = String(rowData.shopCode).trim();
          stats.shopCode.totalTested++;
          const shopObj = shopByCode.get(rawShop.toUpperCase());
          if (!shopObj) {
            if (!stats.shopCode.unmatchedValues.includes(rawShop)) {
              stats.shopCode.unmatchedValues.push(rawShop);
            }
            issues.push({
              row: rowIndex,
              field: "shopCode",
              fieldLabel: "Shop code",
              value: rawShop,
              message: `Shop "${rawShop}" does not exist in your database`,
              suggestion: `Available shops: ${shops.map((s) => s.code).join(", ") || "None"}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            // Check if shop belongs to row's branch
            const rawBranch = rowData.branchCode ? String(rowData.branchCode).trim().toUpperCase() : "";
            const branchObj = branchByCode.get(rawBranch);
            if (branchObj && shopObj.branchId !== branchObj.id) {
              issues.push({
                row: rowIndex,
                field: "shopCode",
                fieldLabel: "Shop code",
                value: rawShop,
                message: `Shop "${rawShop}" belongs to branch "${shopObj.branch?.code}", not "${rawBranch}"`,
                suggestion: `Assign to branch "${shopObj.branch?.code}" or update shop assignment`,
                severity: "error",
              });
              invalidRowIndices.add(rowIndex);
            } else {
              stats.shopCode.matchedCount++;
            }
          }
        }

        // Plan Name check (optional)
        if (body.columnMap.planName && rowData.planName && rowData.providerCode) {
          const pCodeStr = String(rowData.providerCode).trim().toUpperCase();
          const pObj = providerByCode.get(pCodeStr);
          const rawPlan = String(rowData.planName).trim();
          stats.planName.totalTested++;
          if (pObj) {
            const planObj = planByKey.get(`${pObj.id}:${rawPlan.toUpperCase()}`);
            if (!planObj) {
              if (!stats.planName.unmatchedValues.includes(rawPlan)) {
                stats.planName.unmatchedValues.push(rawPlan);
              }
              const validProviderPlans = plans
                .filter((p) => p.providerId === pObj.id)
                .map((p) => p.name);
              issues.push({
                row: rowIndex,
                field: "planName",
                fieldLabel: "Plan name",
                value: rawPlan,
                message: `Plan "${rawPlan}" not found for provider "${rowData.providerCode}"`,
                suggestion: validProviderPlans.length > 0
                  ? `Available plans for ${pObj.code}: ${validProviderPlans.join(", ")}`
                  : `No plans defined for provider ${pObj.code}`,
                severity: "error",
              });
              invalidRowIndices.add(rowIndex);
            } else {
              stats.planName.matchedCount++;
            }
          }
        }

        // Service Code check (required presence + unique per batch)
        if (body.columnMap.serviceCode) {
          const rawCode = rowData.serviceCode ? String(rowData.serviceCode).trim() : "";
          const sCodeUpper = rawCode.toUpperCase();
          stats.serviceCode.totalTested++;
          if (!rawCode) {
            issues.push({
              row: rowIndex,
              field: "serviceCode",
              fieldLabel: "Service code",
              value: rawCode,
              message: "Service code is required",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (existingServiceCodes.has(sCodeUpper)) {
            issues.push({
              row: rowIndex,
              field: "serviceCode",
              fieldLabel: "Service code",
              value: rawCode,
              message: `Service code "${rawCode}" already exists in your database`,
              suggestion: "Service codes must be unique per company. Use a new code to avoid duplicates.",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (seenBatchKeys.has(`s:${sCodeUpper}`)) {
            issues.push({
              row: rowIndex,
              field: "serviceCode",
              fieldLabel: "Service code",
              value: rawCode,
              message: `Duplicate service code "${rawCode}" in this import file`,
              suggestion: "Ensure each row has a unique service code",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            seenBatchKeys.add(`s:${sCodeUpper}`);
            stats.serviceCode.matchedCount++;
          }
        }

        // Schedule & Fee checks (optional on service, validated when mapped)
        if (body.columnMap.durationMonths && rowData.durationMonths !== undefined && rowData.durationMonths !== null && rowData.durationMonths !== "") {
          const dur = Number(rowData.durationMonths);
          const free = body.columnMap.freeMonths && rowData.freeMonths !== undefined && rowData.freeMonths !== null && rowData.freeMonths !== ""
            ? Number(rowData.freeMonths)
            : body.defaultFreeMonths;
          if (dur <= 0 || isNaN(dur)) {
            issues.push({
              row: rowIndex,
              field: "durationMonths",
              fieldLabel: "Duration (months)",
              value: rowData.durationMonths,
              message: "Duration must be a positive number",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (free > dur) {
            issues.push({
              row: rowIndex,
              field: "freeMonths",
              fieldLabel: "Free months",
              value: free,
              message: `Free months (${free}) cannot exceed total duration (${dur})`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          }
        }

        if (body.columnMap.monthlyFee && rowData.monthlyFee !== undefined && rowData.monthlyFee !== null && rowData.monthlyFee !== "") {
          const fee = Number(rowData.monthlyFee);
          if (isNaN(fee) || fee < 0) {
            issues.push({
              row: rowIndex,
              field: "monthlyFee",
              fieldLabel: "Monthly fee",
              value: rowData.monthlyFee,
              message: "Monthly fee must be a non-negative number",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          }
        }
      }

      // 2. Validate Contract imports
      if (entityType === "contract") {
        // Service Code check (must exist in database)
        if (body.columnMap.serviceCode) {
          const rawSvc = rowData.serviceCode ? String(rowData.serviceCode).trim() : "";
          const svcUpper = rawSvc.toUpperCase();
          stats.serviceCode.totalTested++;
          if (!rawSvc) {
            issues.push({
              row: rowIndex,
              field: "serviceCode",
              fieldLabel: "Service code",
              value: rawSvc,
              message: "Service code is required for contract import",
              suggestion: `Available services: ${services.map((s) => s.serviceCode).slice(0, 10).join(", ")}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (!serviceByCode.has(svcUpper)) {
            if (!stats.serviceCode.unmatchedValues.includes(rawSvc)) {
              stats.serviceCode.unmatchedValues.push(rawSvc);
            }
            issues.push({
              row: rowIndex,
              field: "serviceCode",
              fieldLabel: "Service code",
              value: rawSvc,
              message: `Service "${rawSvc}" does not exist in your database`,
              suggestion: `Available services: ${services.map((s) => s.serviceCode).slice(0, 10).join(", ") || "None"}`,
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            stats.serviceCode.matchedCount++;
          }
        }

        // Contract Number check
        if (body.columnMap.contractNumber) {
          const rawCNum = rowData.contractNumber ? String(rowData.contractNumber).trim() : "";
          const cNumUpper = rawCNum.toUpperCase();
          stats.contractNumber.totalTested++;
          if (!rawCNum) {
            issues.push({
              row: rowIndex,
              field: "contractNumber",
              fieldLabel: "Contract number",
              value: rawCNum,
              message: "Contract number is required",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (existingContractNums.has(cNumUpper)) {
            issues.push({
              row: rowIndex,
              field: "contractNumber",
              fieldLabel: "Contract number",
              value: rawCNum,
              message: `Contract number "${rawCNum}" already exists in the system`,
              suggestion: "Contract numbers must be unique per company",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (seenBatchKeys.has(`c:${cNumUpper}`)) {
            issues.push({
              row: rowIndex,
              field: "contractNumber",
              fieldLabel: "Contract number",
              value: rawCNum,
              message: `Duplicate contract number "${rawCNum}" in this import file`,
              suggestion: "Ensure each row has a unique contract number",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            seenBatchKeys.add(`c:${cNumUpper}`);
            stats.contractNumber.matchedCount++;
          }
        }

        // Start Date check
        if (body.columnMap.startDate) {
          const rawDate = rowData.startDate;
          const { value: parsedDate, error } = coerceValue(rawDate, "date");
          stats.startDate.totalTested++;
          if (error || !parsedDate) {
            issues.push({
              row: rowIndex,
              field: "startDate",
              fieldLabel: "Start date",
              value: rawDate,
              message: `Invalid date format: "${rawDate}"`,
              suggestion: "Use format YYYY-MM-DD",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            stats.startDate.matchedCount++;
          }
        }

        // Duration & Free months check
        if (body.columnMap.durationMonths) {
          const dur = Number(rowData.durationMonths) || 0;
          const free = Number(rowData.freeMonths ?? body.defaultFreeMonths) || 0;
          stats.durationMonths.totalTested++;
          if (dur <= 0) {
            issues.push({
              row: rowIndex,
              field: "durationMonths",
              fieldLabel: "Duration (months)",
              value: rowData.durationMonths,
              message: "Duration must be greater than 0 months",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else if (free > dur) {
            issues.push({
              row: rowIndex,
              field: "freeMonths",
              fieldLabel: "Free months",
              value: free,
              message: `Free months (${free}) exceed duration (${dur})`,
              suggestion: "Free months must be less than or equal to total duration",
              severity: "error",
            });
            invalidRowIndices.add(rowIndex);
          } else {
            stats.durationMonths.matchedCount++;
          }
        }
      }
    });

    // Update field stats messages based on accumulated results
    for (const [key, s] of Object.entries(stats)) {
      const isDbLookupField =
        ["branchCode", "shopCode", "providerCode", "planName"].includes(key) ||
        (key === "serviceCode" && entityType === "contract");

      if (!s.mapped) {
        s.status = s.required ? "unmapped" : "valid";
        s.message = s.required ? "Required field is not mapped" : "Optional field";
      } else if (s.unmatchedValues.length > 0) {
        s.status = "invalid";
        s.message = `${s.unmatchedValues.length} unmatched value(s): ${s.unmatchedValues.slice(0, 3).join(", ")}${s.unmatchedValues.length > 3 ? "..." : ""}`;
      } else if (isDbLookupField) {
        if (s.totalTested > 0 && s.matchedCount === s.totalTested) {
          s.status = "valid";
          s.message = `All ${s.matchedCount} values verified against database`;
        } else {
          s.status = "valid";
          s.message = `${s.matchedCount} of ${s.totalTested} values verified`;
        }
      } else {
        s.status = "valid";
        s.message = s.required
          ? `All ${s.matchedCount} rows have ${s.label.toLowerCase()}`
          : `Mapped (${s.matchedCount} rows)`;
      }
    }

    const totalRows = body.rows.length;
    const invalidRowsCount = invalidRowIndices.size;
    const validRowsCount = totalRows - invalidRowsCount;
    const isValid = issues.length === 0 && missingRequiredFields.length === 0;

    return NextResponse.json({
      valid: isValid,
      totalRows,
      validRowsCount,
      invalidRowsCount,
      missingRequiredFields,
      fieldStats: stats,
      issues: issues.slice(0, 100),
      realMasterData: {
        branches: branches.map((b) => ({ code: b.code, name: b.name })),
        shops: shops.map((s) => ({ code: s.code, name: s.name, branchCode: s.branch?.code })),
        providers: providers.map((p) => ({ code: p.code, name: p.name })),
        services: services.map((s) => ({ serviceCode: s.serviceCode })),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
