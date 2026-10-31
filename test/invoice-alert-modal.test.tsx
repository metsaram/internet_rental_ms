import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import {
  InvoiceAlertModal,
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
});

