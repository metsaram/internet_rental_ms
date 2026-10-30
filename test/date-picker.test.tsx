import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker, DateRangePicker, parseDateString } from "@/components/ui/date-picker";

describe("parseDateString", () => {
  it("returns undefined for null or empty string", () => {
    expect(parseDateString(null)).toBeUndefined();
    expect(parseDateString("")).toBeUndefined();
    expect(parseDateString("   ")).toBeUndefined();
  });

  it("correctly parses YYYY-MM-DD as local date without off-by-one shifts", () => {
    const d = parseDateString("2026-10-24");
    expect(d).toBeDefined();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9); // 0-indexed October
    expect(d?.getDate()).toBe(24);
  });

  it("correctly parses ISO strings", () => {
    const d = parseDateString("2026-05-15T12:00:00.000Z");
    expect(d).toBeDefined();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(4); // 0-indexed May
    expect(d?.getDate()).toBe(15);
  });

  it("returns the date if already a valid Date object", () => {
    const original = new Date(2026, 3, 10);
    const result = parseDateString(original);
    expect(result).toBe(original);
  });
});

describe("DatePicker Component", () => {
  it("renders with placeholder when no value is provided", () => {
    render(<DatePicker placeholder="Select invoice date" />);
    expect(screen.getByText("Select invoice date")).toBeInTheDocument();
  });

  it("renders formatted date when value is provided", () => {
    render(<DatePicker value="2026-10-24" />);
    expect(screen.getByText("Oct 24, 2026")).toBeInTheDocument();
  });

  it("respects custom displayFormat", () => {
    render(<DatePicker value="2026-10-24" displayFormat="yyyy-MM-dd" />);
    expect(screen.getByText("2026-10-24")).toBeInTheDocument();
  });

  it("renders disabled state correctly", () => {
    render(<DatePicker value="2026-10-24" disabled />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("supports clear button and invokes onChange with empty string", async () => {
    const handleChange = vi.fn();
    render(<DatePicker value="2026-10-24" onChange={handleChange} clearable />);

    const clearBtn = screen.getByLabelText("Clear date");
    expect(clearBtn).toBeInTheDocument();

    await userEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith("", undefined);
  });

  it("associates with id for label binding", () => {
    render(
      <div>
        <label htmlFor="test-date-picker">Date label</label>
        <DatePicker id="test-date-picker" />
      </div>
    );
    const trigger = screen.getByRole("button", { name: /pick a date/i });
    expect(trigger).toHaveAttribute("id", "test-date-picker");
  });

  it("renders hidden input for native form submission when name is provided", () => {
    const { container } = render(
      <DatePicker name="contractStartDate" value="2026-10-24" />
    );
    const hidden = container.querySelector('input[type="hidden"][name="contractStartDate"]');
    expect(hidden).toBeInTheDocument();
    expect(hidden).toHaveValue("2026-10-24");
  });

  it("calls onValueChange when cleared", async () => {
    const handleValueChange = vi.fn();
    render(
      <DatePicker
        value="2026-10-24"
        onValueChange={handleValueChange}
        clearable
      />
    );

    const clearBtn = screen.getByLabelText("Clear date");
    await userEvent.click(clearBtn);
    expect(handleValueChange).toHaveBeenCalledWith("");
  });

  it("supports legacy event-based onChange handler gracefully", async () => {
    let capturedValue = "";
    const legacyHandler = (e: any) => {
      capturedValue = e.target.value;
    };

    render(
      <DatePicker
        value="2026-10-24"
        onChange={legacyHandler as any}
        clearable
      />
    );

    const clearBtn = screen.getByLabelText("Clear date");
    await userEvent.click(clearBtn);
    expect(capturedValue).toBe("");
  });

  it("renders month and year dropdown selectors with 5-year default range when opened", async () => {
    const currentYear = new Date().getFullYear();
    render(<DatePicker value={`${currentYear}-10-24`} />);

    // Open the popover
    const trigger = screen.getByRole("button", { name: /oct 24/i });
    await userEvent.click(trigger);

    // Assert that month and year dropdowns are rendered
    const monthSelect = screen.getByLabelText("Choose the Month") as HTMLSelectElement;
    const yearSelect = screen.getByLabelText("Choose the Year") as HTMLSelectElement;
    expect(monthSelect).toBeInTheDocument();
    expect(yearSelect).toBeInTheDocument();

    // Verify month options (formatted with formatMonthDropdown as short names)
    const monthOptions = Array.from(monthSelect.options).map((o) => o.text);
    expect(monthOptions).toContain("Jan");
    expect(monthOptions).toContain("Oct");
    expect(monthOptions).toContain("Dec");

    // Verify year options span 5 years in the past to 5 years in the future
    const yearOptions = Array.from(yearSelect.options).map((o) => parseInt(o.value, 10));
    expect(yearOptions).toContain(currentYear - 5);
    expect(yearOptions).toContain(currentYear);
    expect(yearOptions).toContain(currentYear + 5);
    expect(yearOptions[0]).toBeLessThanOrEqual(currentYear - 5);
    expect(yearOptions[yearOptions.length - 1]).toBeGreaterThanOrEqual(currentYear + 5);
  });

  it("automatically expands year range to include selected date beyond 5 years", async () => {
    render(<DatePicker value="2012-05-15" />);

    const trigger = screen.getByRole("button", { name: /may 15, 2012/i });
    await userEvent.click(trigger);

    const yearSelect = screen.getByLabelText("Choose the Year") as HTMLSelectElement;
    const yearOptions = Array.from(yearSelect.options).map((o) => parseInt(o.value, 10));
    expect(yearOptions).toContain(2012);
  });

  it("supports captionLayout='label' when dropdown selector is not needed", async () => {
    render(<DatePicker value="2026-10-24" captionLayout="label" />);

    const trigger = screen.getByRole("button", { name: /oct 24, 2026/i });
    await userEvent.click(trigger);

    expect(screen.queryByLabelText("Choose the Month")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choose the Year")).not.toBeInTheDocument();
  });
});

describe("DateRangePicker Component", () => {
  it("renders range placeholder when empty", () => {
    render(<DateRangePicker placeholder="Filter by date range" />);
    expect(screen.getByText("Filter by date range")).toBeInTheDocument();
  });

  it("renders formatted date range", () => {
    render(
      <DateRangePicker
        value={{
          from: new Date(2026, 0, 1),
          to: new Date(2026, 0, 31),
        }}
      />
    );
    expect(screen.getByText("Jan 1, 2026 - Jan 31, 2026")).toBeInTheDocument();
  });
});
