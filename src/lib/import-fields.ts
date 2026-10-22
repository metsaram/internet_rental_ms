/**
 * Phase 09 — Excel import field definitions + validation.
 *
 * Each entity type defines the set of importable target fields, which are
 * required, and a row validator. The import API uses these to map arbitrary
 * spreadsheet headers → target fields and validate each row before writing.
 */

import { GlobalValidator } from "@/lib/global-validator";

export type ImportEntityType = "contract" | "service";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type: "string" | "number" | "date" | "enum";
  enumValues?: string[];
  hint?: string;
}

export const CONTRACT_FIELDS: ImportField[] = [
  { key: "contractNumber", label: "Contract number", required: true, type: "string" },
  { key: "serviceCode", label: "Service code", required: true, type: "string", hint: "Must match an existing service code" },
  { key: "startDate", label: "Start date", required: true, type: "date" },
  { key: "durationMonths", label: "Duration (months)", required: true, type: "number" },
  { key: "monthlyFee", label: "Monthly fee", required: true, type: "number" },
  { key: "freeMonths", label: "Free months", type: "number", hint: "Default 0" },
  { key: "currency", label: "Currency", type: "string", hint: "Default USD" },
  { key: "status", label: "Status", type: "enum", enumValues: ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"], hint: "Default DRAFT" },
  { key: "billingCycle", label: "Billing cycle", type: "enum", enumValues: ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"], hint: "Default MONTHLY" },
  { key: "notes", label: "Notes", type: "string" },
];

export const SERVICE_FIELDS: ImportField[] = [
  { key: "serviceCode", label: "Service code", required: true, type: "string" },
  { key: "branchCode", label: "Branch code", required: true, type: "string", hint: "Must match an existing branch code" },
  { key: "shopCode", label: "Shop code", type: "string", hint: "Optional; must match an existing shop" },
  { key: "providerCode", label: "Provider code", required: true, type: "string", hint: "Must match an existing provider" },
  { key: "planName", label: "Plan name", type: "string", hint: "Optional; must belong to the provider" },
  { key: "customerId", label: "Customer ID (CID)", type: "string", hint: "Customer ID with ISP (for billing/payments)" },
  { key: "ispServiceId", label: "Service ID (SID)", type: "string", hint: "Service ID with ISP (for technical troubleshooting)" },
  { key: "accountId", label: "Account ID", type: "string", hint: "Optional ISP account ID" },
  { key: "installationAddress", label: "Installation address", type: "string", hint: "Physical site address" },
  { key: "ipAddress", label: "IP address", type: "string" },
  { key: "ipType", label: "IP type", type: "enum", enumValues: ["STATIC", "DYNAMIC", "CGNAT"], hint: "Default DYNAMIC" },
  { key: "status", label: "Status", type: "enum", enumValues: ["ACTIVE", "PENDING", "SUSPENDED", "TERMINATED"], hint: "Default PENDING" },
];

export function getFields(entityType: ImportEntityType): ImportField[] {
  return entityType === "contract" ? CONTRACT_FIELDS : SERVICE_FIELDS;
}

export function getDefaultFreeMonths(entityType: ImportEntityType): number {
  return entityType === "contract" ? 0 : 0;
}

/** Attempt to auto-match a spreadsheet header to a target field by fuzzy
 *  label/code matching. Returns the target field key or null. */
export function autoMatchHeader(header: string): string | null {
  const h = header.toLowerCase().trim().replace(/[\s_-]+/g, "");
  const all = [...CONTRACT_FIELDS, ...SERVICE_FIELDS];
  for (const f of all) {
    const key = f.key.toLowerCase();
    const label = f.label.toLowerCase().replace(/[\s_-]+/g, "");
    if (h === key || h === label || h.includes(key) || key.includes(h)) {
      return f.key;
    }
  }
  // Common aliases
  const aliases: Record<string, string> = {
    contractno: "contractNumber",
    contractnum: "contractNumber",
    servicecode: "serviceCode",
    serviceno: "serviceCode",
    cid: "customerId",
    customerid: "customerId",
    customeridcid: "customerId",
    customer: "customerId",
    custid: "customerId",
    customerno: "customerId",
    sid: "ispServiceId",
    serviceid: "ispServiceId",
    serviceidsid: "ispServiceId",
    ispserviceid: "ispServiceId",
    ispsid: "ispServiceId",
    circuitid: "ispServiceId",
    circuitno: "ispServiceId",
    start: "startDate",
    begin: "startDate",
    months: "durationMonths",
    duration: "durationMonths",
    fee: "monthlyFee",
    price: "monthlyFee",
    amount: "monthlyFee",
    free: "freeMonths",
    cur: "currency",
    branch: "branchCode",
    shop: "shopCode",
    provider: "providerCode",
    isp: "providerCode",
    plan: "planName",
    ip: "ipAddress",
    acct: "accountId",
    account: "accountId",
    address: "installationAddress",
    installationaddress: "installationAddress",
    installaddress: "installationAddress",
    siteaddress: "installationAddress",
  };
  if (aliases[h]) return aliases[h];
  return null;
}

export interface ValidatedRow {
  ok: boolean;
  errors: string[];
  data: Record<string, unknown>;
}

/** Coerce a raw cell value to the target type, returning null if invalid. */
export function coerceValue(
  raw: unknown,
  type: ImportField["type"],
  fieldKey?: string
): { value: unknown; error?: string } {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  switch (type) {
    case "string": {
      const s = String(raw).trim();
      // Apply UPPERCASE and symbol blocking only where text field is used for code!
      if (fieldKey && GlobalValidator.isCodeField(fieldKey)) {
        const validation = GlobalValidator.validate(s);
        if (!validation.isValid) {
          return { value: null, error: validation.error };
        }
        return { value: validation.value };
      }
      return { value: s };
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[, ]/g, ""));
      if (Number.isNaN(n)) return { value: null, error: `not a number: ${raw}` };
      return { value: n };
    }
    case "date": {
      // xlsx may return a Date object or a serial number or a string.
      if (raw instanceof Date) return { value: raw };
      if (typeof raw === "number") {
        // Excel serial date (days since 1899-12-30)
        const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
        return { value: d };
      }
      const s = String(raw).trim();
      const parsed = new Date(s);
      if (Number.isNaN(parsed.getTime())) return { value: null, error: `invalid date: ${raw}` };
      return { value: parsed };
    }
    case "enum": {
      const s = GlobalValidator.sanitize(raw);
      return { value: s };
    }
  }
}
