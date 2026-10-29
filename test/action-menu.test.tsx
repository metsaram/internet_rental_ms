import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { ActionMenu, type ActionItem } from "@/components/shared/action-menu";

describe("ActionMenu Component", () => {
  beforeEach(() => {
    window.innerWidth = 1024; // Desktop by default
  });

  it("renders 1-3 actions as visible buttons on desktop/tablet without a 3-dot menu", () => {
    const editFn = vi.fn();
    const deleteFn = vi.fn();
    const viewFn = vi.fn();

    const actions: ActionItem[] = [
      { id: "view", label: "View", onClick: viewFn },
      { id: "edit", label: "Edit", onClick: editFn },
      { id: "delete", label: "Delete", onClick: deleteFn },
    ];

    const { container } = render(<ActionMenu actions={actions} />);

    // All 3 actions are visible buttons
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    // No 3-dot more button
    expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
  });

  it("renders 1-2 actions as visible buttons on mobile (< 768px)", () => {
    window.innerWidth = 500; // Mobile screen size

    const actions: ActionItem[] = [
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ];

    render(<ActionMenu actions={actions} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
  });

  it("renders primary action as button and remaining in 3-dot menu on mobile when > 2 actions", async () => {
    window.innerWidth = 500; // Mobile screen size

    const actions: ActionItem[] = [
      { id: "view", label: "View", isPrimary: true },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ];

    render(<ActionMenu actions={actions} />);

    // Primary action 'View' is visible as button
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();

    // The other 2 actions are not visible as buttons
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    // 3-dot More menu is visible
    const moreBtn = screen.getByRole("button", { name: /more actions/i });
    expect(moreBtn).toBeInTheDocument();

    // Open dropdown menu
    fireEvent.pointerDown(moreBtn, { button: 0 });

    // Edit and Delete are present in the dropdown menu
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
    });
  });

  it("renders 1-3 highest priority actions as visible buttons and remaining in 3-dot menu for 4-6 actions", async () => {
    window.innerWidth = 1024; // Desktop

    const actions: ActionItem[] = [
      { id: "action1", label: "Action 1", priority: 1, isPrimary: true },
      { id: "action2", label: "Action 2", priority: 2 },
      { id: "action3", label: "Action 3", priority: 3 },
      { id: "action4", label: "Action 4", priority: 4 },
      { id: "action5", label: "Action 5", priority: 5 },
    ];

    render(<ActionMenu actions={actions} />);

    // Top priority actions (Action 1 & Action 2) are visible buttons
    expect(screen.getByRole("button", { name: "Action 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action 2" })).toBeInTheDocument();

    // Lower priority actions (Action 3, 4, 5) are in 3-dot menu
    expect(screen.queryByRole("button", { name: "Action 3" })).not.toBeInTheDocument();

    const moreBtn = screen.getByRole("button", { name: /more actions/i });
    expect(moreBtn).toBeInTheDocument();

    fireEvent.pointerDown(moreBtn, { button: 0 });

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /action 3/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /action 4/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /action 5/i })).toBeInTheDocument();
    });
  });

  it("renders 7+ actions in a 3-dot menu organized into logical groups/sections", async () => {
    window.innerWidth = 1024; // Desktop

    const actions: ActionItem[] = [
      { id: "view", label: "View Details", group: "General" },
      { id: "copy", label: "Duplicate", group: "General" },
      { id: "export", label: "Export PDF", group: "General" },
      { id: "edit", label: "Edit Record", group: "Management" },
      { id: "assign", label: "Assign Staff", group: "Management" },
      { id: "archive", label: "Archive Item", group: "Danger Zone", variant: "destructive" },
      { id: "delete", label: "Delete Permanently", group: "Danger Zone", variant: "destructive" },
    ];

    render(<ActionMenu actions={actions} />);

    // For 7+ actions, no buttons are shown directly on the row
    expect(screen.queryByRole("button", { name: "View Details" })).not.toBeInTheDocument();

    // Only 3-dot More button is shown
    const moreBtn = screen.getByRole("button", { name: /more actions/i });
    expect(moreBtn).toBeInTheDocument();

    fireEvent.pointerDown(moreBtn, { button: 0 });

    await waitFor(() => {
      // Group headers
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Management")).toBeInTheDocument();
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();

      // All 7 items are in the menu
      expect(screen.getByRole("menuitem", { name: /view details/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /delete permanently/i })).toBeInTheDocument();
    });
  });

  it("handles disabled states and explains disabled reason", () => {
    const actions: ActionItem[] = [
      {
        id: "edit",
        label: "Edit",
        disabled: true,
        disabledReason: "You do not have permission to edit this record",
      },
    ];

    render(<ActionMenu actions={actions} />);

    const btn = screen.getByRole("button", { name: "Edit" });
    expect(btn).toBeDisabled();
  });

  it("handles confirmation dialog for destructive actions before executing onClick", async () => {
    const deleteFn = vi.fn();

    const actions: ActionItem[] = [
      {
        id: "delete",
        label: "Delete Branch",
        variant: "destructive",
        confirmation: {
          title: "Delete Branch Record",
          description: "Are you sure you want to permanently delete this branch?",
          confirmText: "Yes, Delete",
          destructive: true,
        },
        onClick: deleteFn,
      },
    ];

    render(<ActionMenu actions={actions} />);

    const deleteBtn = screen.getByRole("button", { name: "Delete Branch" });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    // Confirmation dialog appears, onClick has NOT been called yet
    expect(deleteFn).not.toHaveBeenCalled();
    expect(screen.getByText("Delete Branch Record")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to permanently delete this branch?")).toBeInTheDocument();

    // Click confirm in dialog
    const confirmBtn = screen.getByRole("button", { name: "Yes, Delete" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Now deleteFn is called
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  it("stops click propagation so table row click events are not triggered", () => {
    const rowClickFn = vi.fn();
    const actionFn = vi.fn();

    const actions: ActionItem[] = [
      { id: "edit", label: "Edit", onClick: actionFn },
    ];

    render(
      <div onClick={rowClickFn}>
        <ActionMenu actions={actions} stopPropagation={true} />
      </div>
    );

    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editBtn);

    expect(actionFn).toHaveBeenCalledTimes(1);
    expect(rowClickFn).not.toHaveBeenCalled();
  });

  it("applies reduced color background classes using theme tokens (not hardcoded colors)", () => {
    const actions: ActionItem[] = [
      { id: "edit", label: "Edit Item", isPrimary: true },
      { id: "delete", label: "Delete Item", variant: "destructive" },
      { id: "archive", label: "Archive Item" },
    ];

    render(<ActionMenu actions={actions} buttonStyle="subtle" />);

    const editBtn = screen.getByRole("button", { name: "Edit Item" });
    const deleteBtn = screen.getByRole("button", { name: "Delete Item" });
    const archiveBtn = screen.getByRole("button", { name: "Archive Item" });

    // Primary action has reduced background tint (bg-primary/10) and theme token text
    expect(editBtn.className).toContain("bg-primary/10");
    expect(editBtn.className).toContain("text-primary");
    // Destructive action has reduced background tint (bg-destructive/10) and theme token text
    expect(deleteBtn.className).toContain("bg-destructive/10");
    expect(deleteBtn.className).toContain("text-destructive");
    // Neutral action has muted text and transparent/ghost background
    expect(archiveBtn.className).toContain("text-muted-foreground");
  });

  it("supports buttonStyle='ghost' for transparent buttons with hover-only theme colors", () => {
    const actions: ActionItem[] = [
      { id: "edit", label: "Edit Item", isPrimary: true },
      { id: "delete", label: "Delete Item", variant: "destructive" },
    ];

    render(<ActionMenu actions={actions} buttonStyle="ghost" />);

    const editBtn = screen.getByRole("button", { name: "Edit Item" });
    const deleteBtn = screen.getByRole("button", { name: "Delete Item" });

    // In ghost mode, buttons do not have static bg-primary/10 or bg-destructive/10
    expect(editBtn.className).not.toMatch(/(^|\s)bg-primary\/10(\s|$)/);
    expect(editBtn.className).toContain("text-primary");
    expect(editBtn.className).toContain("hover:bg-primary/10");

    expect(deleteBtn.className).not.toMatch(/(^|\s)bg-destructive\/10(\s|$)/);
    expect(deleteBtn.className).toContain("text-destructive");
    expect(deleteBtn.className).toContain("hover:bg-destructive/10");
  });
});
