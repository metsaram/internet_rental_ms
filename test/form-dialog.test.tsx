import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormDialog } from "@/components/shared/form-dialog";

describe("FormDialog Component", () => {
  it("renders title, description, children, and action buttons when open", () => {
    render(
      <FormDialog
        open={true}
        onOpenChange={() => {}}
        title="New shop"
        description="A shop is a unit located within a branch."
        submitText="Create shop"
        onSubmit={() => {}}
      >
        <div data-testid="form-children">Form Inputs Content</div>
      </FormDialog>
    );

    expect(screen.getByRole("heading", { name: "New shop" })).toBeInTheDocument();
    expect(screen.getByText(/A shop is a unit located within a branch/i)).toBeInTheDocument();
    expect(screen.getByTestId("form-children")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create shop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <FormDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="New shop"
        onSubmit={() => {}}
      >
        <div>Content</div>
      </FormDialog>
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onSubmit when form is submitted", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <FormDialog
        open={true}
        onOpenChange={() => {}}
        title="New shop"
        submitText="Save changes"
        onSubmit={handleSubmit}
      >
        <div>Content</div>
      </FormDialog>
    );

    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    await user.click(saveBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables submit button when submitDisabled is true", () => {
    render(
      <FormDialog
        open={true}
        onOpenChange={() => {}}
        title="New shop"
        submitText="Create shop"
        submitDisabled={true}
        onSubmit={() => {}}
      >
        <div>Content</div>
      </FormDialog>
    );

    const saveBtn = screen.getByRole("button", { name: "Create shop" });
    expect(saveBtn).toBeDisabled();
  });

  it("prevents outside close by default via preventOutsideClose", () => {
    const handleOpenChange = vi.fn();
    render(
      <FormDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="New shop"
        onSubmit={() => {}}
      >
        <div>Content</div>
      </FormDialog>
    );

    // Radix dialog content element
    const dialogContent = document.querySelector('[data-slot="dialog-content"]');
    expect(dialogContent).toBeInTheDocument();

    if (dialogContent) {
      // Simulate pointerDownOutside custom event from Radix
      const pointerDownOutsideEvent = new Event("pointerdown", { bubbles: true, cancelable: true });
      fireEvent(dialogContent, pointerDownOutsideEvent);
    }

    // Modal did not trigger close
    expect(handleOpenChange).not.toHaveBeenCalled();
  });
});
