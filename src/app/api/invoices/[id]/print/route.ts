import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/session";
import { computeContractCosts } from "@/lib/contracts";
import { formatMoney, formatDate } from "@/lib/format";

/**
 * Phase 19 polish — Print-friendly invoice template.
 *
 * Returns a standalone HTML page styled for printing (A4, clean typography,
 * no nav/chrome). The browser's print dialog can be triggered via
 * window.print() on the client. Authenticated + company-scoped.
 *
 * The template includes: company header, invoice meta (number/dates/period),
 * bill-to (contract + service info), line items (subtotal/tax/discount/total),
 * payment summary (allocated/outstanding), and a footer.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const inv = await db.invoice.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            service: {
              select: {
                id: true,
                serviceCode: true,
                branch: { select: { name: true, code: true, address: true, city: true } },
                shop: { select: { name: true, code: true } },
                provider: { select: { name: true, code: true } },
              },
            },
          },
        },
        company: { select: { name: true, code: true, address: true, city: true, phone: true, email: true, taxId: true, currency: true } },
        allocations: { include: { payment: { select: { status: true, method: true, reference: true, paymentDate: true } } } },
      },
    });

    if (!inv || inv.companyId !== user.companyId) {
      throw new HttpError(404, "Invoice not found");
    }

    const company = inv.company;
    const currency = inv.currency;
    const allocated = inv.allocations
      .filter((a) => a.payment?.status !== "VOID")
      .reduce((s, a) => s + Number(a.amount), 0);
    const outstanding = Number(inv.total) - allocated;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${inv.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a; background: #f5f5f5; padding: 24px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    max-width: 800px; margin: 0 auto; background: #fff; padding: 48px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; padding: 24px; max-width: 100%; }
    .no-print { display: none !important; }
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #10b981; padding-bottom: 20px; }
  .company-name { font-size: 24px; font-weight: 700; color: #10b981; }
  .company-details { font-size: 12px; color: #666; margin-top: 4px; line-height: 1.5; }
  .invoice-title { font-size: 32px; font-weight: 300; color: #999; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-number { font-size: 14px; color: #333; margin-top: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .meta-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
  .meta-block p { font-size: 13px; line-height: 1.6; }
  .meta-block .label { color: #999; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 10px 12px; border-bottom: 2px solid #e5e5e5; }
  td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
  .totals { margin-left: auto; width: 300px; margin-bottom: 32px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
  .totals .row.total { border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; font-size: 18px; font-weight: 700; }
  .totals .row .label { color: #666; }
  .totals .row.total .label { color: #1a1a1a; }
  .payment-box { background: #f9fafb; border-left: 4px solid #10b981; padding: 16px 20px; margin-bottom: 24px; }
  .payment-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #10b981; margin-bottom: 8px; }
  .payment-box .row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
  .payment-box .outstanding { font-weight: 700; color: ${outstanding > 0 ? "#ef4444" : "#10b981"}; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; line-height: 1.6; }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #10b981; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #059669; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print invoice</button>
  <div class="page">
    <div class="header">
      <div>
        <div class="company-name">${escapeHtml(company.name)}</div>
        <div class="company-details">
          ${company.address ? escapeHtml(company.address) : ""}${company.city ? `, ${escapeHtml(company.city)}` : ""}<br>
          ${company.phone ? `Tel: ${escapeHtml(company.phone)}<br>` : ""}
          ${company.email ? `Email: ${escapeHtml(company.email)}<br>` : ""}
          ${company.taxId ? `Tax ID: ${escapeHtml(company.taxId)}` : ""}
        </div>
      </div>
      <div style="text-align: right;">
        <div class="invoice-title">Invoice</div>
        <div class="invoice-number">${escapeHtml(inv.invoiceNumber)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-block">
        <h3>Bill To</h3>
        <p>
          <strong>${escapeHtml(inv.contract.service.branch?.name ?? "—")}</strong><br>
          ${inv.contract.service.shop ? escapeHtml(inv.contract.service.shop.name) + "<br>" : ""}
          ${inv.contract.service.branch?.address ? escapeHtml(inv.contract.service.branch.address) : ""}
        </p>
      </div>
      <div class="meta-block">
        <h3>Invoice Details</h3>
        <p>
          <span class="label">Invoice date:</span> ${formatDate(inv.invoiceDate)}<br>
          <span class="label">Due date:</span> ${formatDate(inv.dueDate)}<br>
          <span class="label">Period:</span> ${inv.periodStart ? formatDate(inv.periodStart) : "—"} → ${inv.periodEnd ? formatDate(inv.periodEnd) : "—"}<br>
          <span class="label">Status:</span> ${inv.status}<br>
          <span class="label">Contract:</span> ${escapeHtml(inv.contract.contractNumber)}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Internet service — ${escapeHtml(inv.contract.service.provider?.name ?? "—")} (${escapeHtml(inv.contract.service.serviceCode)})</td>
          <td style="text-align: right;">${formatMoney(inv.subtotal, currency)}</td>
        </tr>
        ${Number(inv.discount) > 0 ? `<tr><td>Discount</td><td style="text-align: right; color: #ef4444;">−${formatMoney(inv.discount, currency)}</td></tr>` : ""}
      </tbody>
    </table>

    <div class="totals">
      <div class="row"><span class="label">Subtotal</span><span>${formatMoney(inv.subtotal, currency)}</span></div>
      <div class="row"><span class="label">Tax / VAT</span><span>${formatMoney(inv.tax, currency)}</span></div>
      ${Number(inv.discount) > 0 ? `<div class="row"><span class="label">Discount</span><span>−${formatMoney(inv.discount, currency)}</span></div>` : ""}
      <div class="row total"><span class="label">Total Due</span><span>${formatMoney(inv.total, currency)}</span></div>
    </div>

    <div class="payment-box">
      <h3>Payment Summary</h3>
      <div class="row"><span>Amount paid</span><span>${formatMoney(allocated, currency)}</span></div>
      <div class="row outstanding"><span>Outstanding balance</span><span>${formatMoney(outstanding, currency)}</span></div>
    </div>

    ${inv.notes ? `<div style="font-size: 12px; color: #666; margin-bottom: 24px;"><strong>Notes:</strong> ${escapeHtml(inv.notes)}</div>` : ""}

    <div class="footer">
      ${escapeHtml(company.name)} · ${escapeHtml(company.code)}<br>
      This is a computer-generated invoice and does not require a signature.<br>
      Generated on ${formatDate(new Date())} by NetRent
    </div>
  </div>
  <script>
    // Auto-trigger print after a short delay (can be disabled by removing this).
    // setTimeout(() => window.print(), 500);
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const { errorResponse } = await import("@/lib/session");
    return errorResponse(err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
