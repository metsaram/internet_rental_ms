import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import {
  InvoiceAlertModal,
  parseInvoiceAlertDays,
  InvoiceAlertNotification,
} from "@/components/shared/invoice-alert-modal";

describe("InvoiceAlertModal Component", () => {
  const sampleNotifications: InvoiceAlertNotification[] = [
    {
      id: "notif-1",
      type: "INVOICE_OVERDUE",
      title: "Payment overdue 3d: INV-2026-001",
      message:
        "Invoice INV-2026-001 is 3 days overdue with an outstanding balance of $120.00 (due 2026-10-28). Immediate payment required.",
      entityType: "Invoice",
      entityId: "inv-1",
      readAt: null,
      createdAt: "2026-10-31T08:00:00.000Z",
    },
    {
      id: "notif-2",
      type: "INVOICE_DUE_SOON",
      title: "Payment due in 4d: INV-2026-002",
      message:
        "Invoice INV-2026-002 has an outstanding balance of $85.00 due on 2026-11-04. Please arrange payment.",
      entityType: "Invoice",
      entityId: "inv-2",
      readAt: null,
      createdAt: "2026-10-31T08:00:00.000Z",
    },
  ];

  it("does not render when notifications array is empty", () => {
    const { container } = render(
      <InvoiceAlertModal
        open={true}
        notifications={[]}
        onReviewInvoices={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders modal with overdue header and badges when overdue notifications exist", () => {
    render(
      <InvoiceAlertModal
        open={true}
        notifications={sampleNotifications}
        onReviewInvoices={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Overdue Invoice Payment Alert")).toBeInTheDocument();
    expect(
      screen.getByText(/2 invoice payments require your attention/i)
    ).toBeInTheDocument();

    // Summary badges
    expect(screen.getByText("1 Overdue")).toBeInTheDocument();
    expect(screen.getByText("1 Due Soon")).toBeInTheDocument();

    // Invoices list contents
    expect(screen.getByText("Payment overdue 3d: INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText(/is 3 days overdue with an outstanding balance of \$120.00/i)).toBeInTheDocument();
    expect(screen.getByText("Payment due in 4d: INV-2026-002")).toBeInTheDocument();
    expect(screen.getByText(/outstanding balance of \$85.00 due on 2026-11-04/i)).toBeInTheDocument();

    // Action buttons
    expect(screen.getByRole("button", { name: /Remind me later/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Invoices/i })).toBeInTheDocument();
  });

  it("renders modal with upcoming header when only due soon notifications exist", () => {
    const dueSoonOnly: InvoiceAlertNotification[] = [
      {
        id: "notif-2",
        type: "INVOICE_DUE_SOON",
        title: "Payment due in 2d: INV-2026-005",
        message: "Invoice INV-2026-005 has an outstanding balance of $50.00 due on 2026-11-02.",
      },
    ];

    render(
      <InvoiceAlertModal
        open={true}
        notifications={dueSoonOnly}
        onReviewInvoices={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Upcoming Invoice Payments Due Soon")).toBeInTheDocument();
    expect(
      screen.getByText(/1 invoice payment requires your attention/i)
    ).toBeInTheDocument();
    expect(screen.getByText("1 Due Soon")).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/i)).not.toBeInTheDocument();
  });

  it("calls onDismiss when 'Remind me later' is clicked", async () => {
    const user = userEvent.setup();
    const handleDismiss = vi.fn();

    render(
      <InvoiceAlertModal
        open={true}
        notifications={sampleNotifications}
        onReviewInvoices={vi.fn()}
        onDismiss={handleDismiss}
      />
    );

    const dismissBtn = screen.getByRole("button", { name: /Remind me later/i });
    await user.click(dismissBtn);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onReviewInvoices when 'Review Invoices' is clicked", async () => {
    const user = userEvent.setup();
    const handleReview = vi.fn();

    render(
      <InvoiceAlertModal
        open={true}
        notifications={sampleNotifications}
        onReviewInvoices={handleReview}
        onDismiss={vi.fn()}
      />
    );

    const reviewBtn = screen.getByRole("button", { name: /Review Invoices/i });
    await user.click(reviewBtn);

    expect(handleReview).toHaveBeenCalledTimes(1);
  });

  describe("warningDays threshold filtering", () => {
    it("filters out notifications due beyond warningDays threshold (e.g. 27 days when warningDays=7)", () => {
      const farNotification: InvoiceAlertNotification[] = [
        {
          id: "notif-far",
          type: "INVOICE_DUE_SOON",
          title: "Invoice due in 27d: INV-2026-4170",
          message:
            "Payment reminder: Invoice INV-2026-4170 is due in 27 days (2026-11-27). Outstanding: USD 798.60. Please make payment.",
          entityType: "Invoice",
          entityId: "inv-far",
          readAt: null,
        },
      ];

      // When company setting warningDays is 7, 27-day invoice alert must NOT render
      const { container } = render(
        <InvoiceAlertModal
          open={true}
          notifications={farNotification}
          warningDays={7}
          onReviewInvoices={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText(/INV-2026-4170/i)).not.toBeInTheDocument();
    });

    it("renders valid alert within warningDays and excludes notifications exceeding warningDays", () => {
      const mixedNotifications: InvoiceAlertNotification[] = [
        {
          id: "notif-near",
          type: "INVOICE_DUE_SOON",
          title: "Invoice due in 4d: INV-2026-1001",
          message: "Payment reminder: Invoice INV-2026-1001 is due in 4 days. Outstanding: $150.00.",
          entityType: "Invoice",
          entityId: "inv-near",
          readAt: null,
        },
        {
          id: "notif-far",
          type: "INVOICE_DUE_SOON",
          title: "Invoice due in 30d: INV-2026-9999",
          message: "Payment reminder: Invoice INV-2026-9999 is due in 30 days. Outstanding: $300.00.",
          entityType: "Invoice",
          entityId: "inv-far",
          readAt: null,
        },
      ];

      render(
        <InvoiceAlertModal
          open={true}
          notifications={mixedNotifications}
          warningDays={7}
          onReviewInvoices={vi.fn()}
          onDismiss={vi.fn()}
        />
      );

      // Only the 4-day invoice should appear
      expect(screen.getByText("Invoice due in 4d: INV-2026-1001")).toBeInTheDocument();
      expect(screen.queryByText("Invoice due in 30d: INV-2026-9999")).not.toBeInTheDocument();
      expect(screen.getByText("1 invoice payment requires your attention.")).toBeInTheDocument();
      expect(screen.getByText("1 Due Soon")).toBeInTheDocument();
    });

    it("renders both notifications when warningDays is 30", () => {
      const mixedNotifications: InvoiceAlertNotification[] = [
        {
          id: "notif-near",
          type: "INVOICE_DUE_SOON",
          title: "Invoice due in 4d: INV-2026-1001",
          message: "Payment reminder: Invoice INV-2026-1001 is due in 4 days. Outstanding: $150.00.",
          entityType: "Invoice",
          entityId: "inv-near",
          readAt: null,
        },
        {
          id: "notif-far",
          type: "INVOICE_DUE_SOON",
          title: "Invoice due in 30d: INV-2026-9999",
          message: "Payment reminder: Invoice INV-2026-9999 is due in 30 days. Outstanding: $300.00.",
          entityType: "Invoice",
          entityId: "inv-far",
          readAt: null,
        },
      ];

      render(
        <InvoiceAlertModal
          open={true}
          notifications={mixedNotifications}
          warningDays={30}
          onReviewInvoices={vi.fn()}
          onDismiss={vi.fn()}
        />
      );

      expect(screen.getByText("Invoice due in 4d: INV-2026-1001")).toBeInTheDocument();
      expect(screen.getByText("Invoice due in 30d: INV-2026-9999")).toBeInTheDocument();
      expect(screen.getByText("2 invoice payments require your attention.")).toBeInTheDocument();
      expect(screen.getByText("2 Due Soon")).toBeInTheDocument();
    });
  });

  describe("parseInvoiceAlertDays utility", () => {
    it("extracts days correctly from various invoice notification title and message formats", () => {
      expect(parseInvoiceAlertDays("Invoice due in 27d: INV-4170", "")).toBe(27);
      expect(parseInvoiceAlertDays("Invoice due in 7d: INV-1001", "")).toBe(7);
      expect(parseInvoiceAlertDays("Invoice due tomorrow: INV-1001", "")).toBe(1);
      expect(parseInvoiceAlertDays("Invoice due today: INV-1001", "")).toBe(0);
      expect(parseInvoiceAlertDays("Invoice 1d overdue: INV-1001", "")).toBe(1);
      expect(parseInvoiceAlertDays("Invoice 5d overdue: INV-1001", "")).toBe(5);
      expect(parseInvoiceAlertDays("Payment overdue 3d: INV-1001", "")).toBe(3);
      expect(parseInvoiceAlertDays("", "Invoice is due in 14 days")).toBe(14);
      expect(parseInvoiceAlertDays("", "Invoice is 10 days past due")).toBe(10);
      expect(parseInvoiceAlertDays("General Notice", "Everything is normal")).toBeNull();
    });
  });
});

