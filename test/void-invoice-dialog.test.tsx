import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { VoidInvoiceDialog } from "@/components/shared/void-invoice-dialog";

describe("VoidInvoiceDialog Component", () => {
  const dummyInvoice = {
    id: "inv-123",
    invoiceNumber: "INV-2026-999",
  };

  it("does not render when invoice is null", () => {
    const { container } = render(
      <VoidInvoiceDialog invoice={null} onClose={vi.fn()} onVoid={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title, description, and disables submit when reason is empty", () => {
    render(
      <VoidInvoiceDialog
        invoice={dummyInvoice}
        onClose={vi.fn()}
        onVoid={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /void invoice INV-2026-999/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/reason for voiding/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /void invoice/i });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit when reason is typed and calls onVoid with clean reason", async () => {
    const user = userEvent.setup();
    const handleVoid = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <VoidInvoiceDialog
        invoice={dummyInvoice}
        onClose={handleClose}
        onVoid={handleVoid}
      />
    );

    const textarea = screen.getByLabelText(/reason for voiding/i);
    await user.type(textarea, "Duplicate charge created in error");

    const submitBtn = screen.getByRole("button", { name: /void invoice/i });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleVoid).toHaveBeenCalledWith(
      "inv-123",
      "Duplicate charge created in error"
    );
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("displays error message if onVoid rejects", async () => {
    const user = userEvent.setup();
    const handleVoid = vi.fn().mockRejectedValue(new Error("Database write failed"));

    render(
      <VoidInvoiceDialog
        invoice={dummyInvoice}
        onClose={vi.fn()}
        onVoid={handleVoid}
      />
    );

    const textarea = screen.getByLabelText(/reason for voiding/i);
    await user.type(textarea, "Invalid charge");

    const submitBtn = screen.getByRole("button", { name: /void invoice/i });
    await user.click(submitBtn);

    expect(await screen.findByRole("alert")).toHaveTextContent("Database write failed");
  });

  it("invokes onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <VoidInvoiceDialog
        invoice={dummyInvoice}
        onClose={handleClose}
        onVoid={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalled();
  });
});
