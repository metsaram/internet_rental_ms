import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";

// NOTE: do NOT import @prisma/client here — this file is imported by client
// components, and bundling Prisma's runtime pulls in Node-only modules.
// Money values arrive from the API as numbers/strings already.

/** Money formatter per currency. */
const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  SGD: "S$",
  MYR: "RM",
};

export function formatMoney(
  amount: number | string | { toString(): string } | null | undefined,
  currency = "USD"
): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  if (Number.isNaN(n)) return "—";
  const targetCurrency = (!currency || currency === "THB") ? "USD" : currency;
  const sym = currencySymbols[targetCurrency] ?? "$";
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${formatted}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

export function formatDate(date: Date | string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, pattern);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "MMM d, yyyy · h:mm a");
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Mask an ISP username for list display. */
export function maskSensitive(v: string | null | undefined): string {
  if (!v) return "—";
  if (v.length <= 3) return "••••";
  return v.slice(0, 2) + "•".repeat(Math.min(v.length - 2, 8));
}

/** Human-friendly bandwidth (Mbps / Gbps). */
export function formatBandwidth(mbps: number | null | undefined): string {
  if (!mbps) return "—";
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps} Mbps`;
}
