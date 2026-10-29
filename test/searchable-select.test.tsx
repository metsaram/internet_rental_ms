import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";

describe("SearchableSelect component", () => {
  const threeItems = [
    { value: "b1", label: "Central Branch" },
    { value: "b2", label: "North Branch" },
    { value: "b3", label: "South Branch" },
  ];

  const sixItems = [
    { value: "p1", label: "Fiber Pro" },
    { value: "p2", label: "DSL Basic" },
    { value: "p3", label: "Cable Ultra" },
    { value: "p4", label: "Wireless 5G" },
    { value: "p5", label: "Satellite Extreme" },
    { value: "p6", label: "Dedicated Lease" },
  ];

  it("renders trigger and does not show search input when items <= 5", () => {
    render(
      <SearchableSelect
        open={true}
        value=""
        onValueChange={() => {}}
        options={threeItems}
        placeholder="Select branch..."
      />
    );

    expect(screen.getByText("Central Branch")).toBeInTheDocument();
    expect(screen.getByText("North Branch")).toBeInTheDocument();
    expect(screen.getByText("South Branch")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("shows search input when items > 5", () => {
    render(
      <SearchableSelect
        open={true}
        value=""
        onValueChange={() => {}}
        options={sixItems}
        placeholder="Select plan..."
      />
    );

    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(screen.getByText("Fiber Pro")).toBeInTheDocument();
    expect(screen.getByText("Dedicated Lease")).toBeInTheDocument();
  });

  it("filters options dynamically when user types in search input", () => {
    render(
      <SearchableSelect
        open={true}
        value=""
        onValueChange={() => {}}
        options={sixItems}
        placeholder="Select plan..."
      />
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "wireless" } });

    expect(screen.getByText("Wireless 5G")).toBeInTheDocument();
    expect(screen.queryByText("Fiber Pro")).not.toBeInTheDocument();
    expect(screen.queryByText("Cable Ultra")).not.toBeInTheDocument();
  });

  it("shows empty message when no options match", () => {
    render(
      <SearchableSelect
        open={true}
        value=""
        onValueChange={() => {}}
        options={sixItems}
        placeholder="Select plan..."
      />
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "nonexistent query" } });

    expect(screen.getByText("No matching results")).toBeInTheDocument();
  });

  it("clears search input when clear button (X) is clicked", async () => {
    const user = userEvent.setup();

    render(
      <SearchableSelect
        open={true}
        value=""
        onValueChange={() => {}}
        options={sixItems}
        placeholder="Select plan..."
      />
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "fiber" } });
    expect(screen.getByText("Fiber Pro")).toBeInTheDocument();
    expect(screen.queryByText("Cable Ultra")).not.toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearBtn);

    expect(input).toHaveValue("");
    expect(screen.getByText("Cable Ultra")).toBeInTheDocument();
  });

  it("selects first matching option when Enter is pressed in search input", () => {
    const onValueChange = vi.fn();

    render(
      <SearchableSelect
        open={true}
        value=""
        onValueChange={onValueChange}
        options={sixItems}
        placeholder="Select plan..."
      />
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "sat" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("p5");
  });
});
