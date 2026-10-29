import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { ActionMenu, type ActionItem } from "@/components/shared/action-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pencil, Archive, CheckCircle2, Trash2 } from "lucide-react";

describe("Plan action rules: Active/Inactive and Delete guards", () => {
  it("renders 'Deactivate plan' and disables 'Delete plan' when plan is ACTIVE and in use (servicesCount > 0)", () => {
    const plan = {
      id: "plan-1",
      name: "Fiber 500",
      status: "ACTIVE",
      servicesCount: 3,
      provider: { name: "ISP Alpha" },
    };

    const isInUse = (plan.servicesCount ?? 0) > 0;
    const editFn = vi.fn();
    const statusFn = vi.fn();
    const deleteFn = vi.fn();

    const actions: ActionItem[] = [
      {
        id: "edit",
        label: "Edit plan",
        icon: <Pencil className="size-4" />,
        isPrimary: true,
        priority: 1,
        onClick: editFn,
      },
      plan.status === "ACTIVE"
        ? {
            id: "deactivate",
            label: "Deactivate plan",
            icon: <Archive className="size-4" />,
            priority: 2,
            onClick: () => statusFn("INACTIVE"),
          }
        : {
            id: "activate",
            label: "Activate plan",
            icon: <CheckCircle2 className="size-4" />,
            priority: 2,
            onClick: () => statusFn("ACTIVE"),
          },
      {
        id: "delete",
        label: "Delete plan",
        icon: <Trash2 className="size-4" />,
        variant: "destructive" as const,
        priority: 3,
        disabled: isInUse,
        disabledReason: isInUse
          ? `Plan has ${plan.servicesCount} service(s); deactivate instead of delete`
          : undefined,
        onClick: deleteFn,
      },
    ];

    render(<ActionMenu actions={actions} />);

    expect(screen.getByRole("button", { name: /edit plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deactivate plan/i })).toBeInTheDocument();
    const deleteBtn = screen.getByRole("button", { name: /delete plan/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toBeDisabled();
  });

  it("renders 'Activate plan' and enables 'Delete plan' when plan is INACTIVE and not in use (servicesCount === 0)", async () => {
    const user = userEvent.setup();
    const plan = {
      id: "plan-2",
      name: "DSL 50",
      status: "INACTIVE",
      servicesCount: 0,
      provider: { name: "ISP Beta" },
    };

    const isInUse = (plan.servicesCount ?? 0) > 0;
    const statusFn = vi.fn();
    const deleteFn = vi.fn();

    const actions: ActionItem[] = [
      {
        id: "edit",
        label: "Edit plan",
        icon: <Pencil className="size-4" />,
        isPrimary: true,
        priority: 1,
        onClick: vi.fn(),
      },
      plan.status === "ACTIVE"
        ? {
            id: "deactivate",
            label: "Deactivate plan",
            icon: <Archive className="size-4" />,
            priority: 2,
            onClick: () => statusFn("INACTIVE"),
          }
        : {
            id: "activate",
            label: "Activate plan",
            icon: <CheckCircle2 className="size-4" />,
            priority: 2,
            onClick: () => statusFn("ACTIVE"),
          },
      {
        id: "delete",
        label: "Delete plan",
        icon: <Trash2 className="size-4" />,
        variant: "destructive" as const,
        priority: 3,
        disabled: isInUse,
        disabledReason: isInUse
          ? `Plan has ${plan.servicesCount} service(s); deactivate instead of delete`
          : undefined,
        onClick: deleteFn,
      },
    ];

    render(<ActionMenu actions={actions} />);

    const activateBtn = screen.getByRole("button", { name: /activate plan/i });
    expect(activateBtn).toBeInTheDocument();
    await user.click(activateBtn);
    expect(statusFn).toHaveBeenCalledWith("ACTIVE");

    const deleteBtn = screen.getByRole("button", { name: /delete plan/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).not.toBeDisabled();
    await user.click(deleteBtn);
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  it("prevents deletion in ConfirmDialog when plan is in use", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const planInUse = {
      id: "plan-3",
      name: "Fiber Gig",
      servicesCount: 5,
      provider: { name: "ISP Alpha" },
    };

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete plan"
        description={
          (planInUse.servicesCount ?? 0) > 0
            ? `Cannot delete "${planInUse.name}" because it is currently in use by ${planInUse.servicesCount} service(s). Please deactivate it instead.`
            : `Permanently delete plan "${planInUse.name}"? This action cannot be undone.`
        }
        confirmText="Delete"
        destructive
        onConfirm={() => {
          if ((planInUse.servicesCount ?? 0) > 0) return;
          onConfirm();
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Delete plan" })).toBeInTheDocument();
    expect(
      screen.getByText(/Cannot delete "Fiber Gig" because it is currently in use by 5 service\(s\)/i)
    ).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
