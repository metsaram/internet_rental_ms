import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { ActionMenu, type ActionItem } from "@/components/shared/action-menu";
import { Trash2 } from "lucide-react";

describe("Service deletion rules & ActionMenu guards", () => {
  it("disables delete action when service has active or existing contracts", () => {
    const serviceWithContracts = {
      id: "svc-1",
      serviceCode: "SVC-001",
      contractsCount: 2,
    };

    const deleteFn = vi.fn();

    const actions: ActionItem[] = [
      {
        id: "edit",
        label: "Edit",
        onClick: vi.fn(),
      },
      {
        id: "delete",
        label: "Delete service",
        icon: <Trash2 className="size-4" />,
        variant: "destructive" as const,
        priority: 2,
        disabled: (serviceWithContracts.contractsCount ?? 0) > 0,
        disabledReason:
          (serviceWithContracts.contractsCount ?? 0) > 0
            ? `Service has ${serviceWithContracts.contractsCount} contract(s); archive instead of delete`
            : undefined,
        onClick: deleteFn,
      },
    ];

    render(<ActionMenu actions={actions} />);

    const deleteBtn = screen.getByRole("button", { name: /delete service/i });
    expect(deleteBtn).toBeDisabled();
  });

  it("enables delete action when service has 0 contracts", async () => {
    const user = userEvent.setup();
    const serviceWithoutContracts = {
      id: "svc-2",
      serviceCode: "SVC-002",
      contractsCount: 0,
    };

    const deleteFn = vi.fn();

    const actions: ActionItem[] = [
      {
        id: "edit",
        label: "Edit",
        onClick: vi.fn(),
      },
      {
        id: "delete",
        label: "Delete service",
        icon: <Trash2 className="size-4" />,
        variant: "destructive" as const,
        priority: 2,
        disabled: (serviceWithoutContracts.contractsCount ?? 0) > 0,
        disabledReason:
          (serviceWithoutContracts.contractsCount ?? 0) > 0
            ? `Service has ${serviceWithoutContracts.contractsCount} contract(s); archive instead of delete`
            : undefined,
        onClick: deleteFn,
      },
    ];

    render(<ActionMenu actions={actions} />);

    const deleteBtn = screen.getByRole("button", { name: /delete service/i });
    expect(deleteBtn).not.toBeDisabled();

    await user.click(deleteBtn);
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });
});
