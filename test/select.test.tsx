import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/shared/form-dialog";

describe("Select component width and layout", () => {
  it("renders SelectTrigger with w-full by default to fit the column width", () => {
    render(
      <Select defaultValue="branch-1">
        <SelectTrigger data-testid="default-trigger">
          <SelectValue placeholder="Select branch..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="branch-1">Branch 1</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByTestId("default-trigger");
    expect(trigger.className).toContain("w-full");
    expect(trigger.className).not.toContain("w-fit");
  });

  it("allows overriding width when custom width class is provided", () => {
    render(
      <Select defaultValue="STAFF">
        <SelectTrigger className="h-7 w-24 text-xs" data-testid="custom-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="STAFF">Staff</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByTestId("custom-trigger");
    expect(trigger.className).toContain("w-24");
    expect(trigger.className).not.toContain("w-full");
  });

  it("renders SelectTrigger with w-full inside Field / form dialog grid columns", () => {
    render(
      <div className="grid grid-cols-2 gap-4">
        <Field label="Branch" required>
          <Select>
            <SelectTrigger data-testid="form-field-trigger">
              <SelectValue placeholder="Select branch..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="b1">Branch 1</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    );

    const trigger = screen.getByTestId("form-field-trigger");
    expect(trigger.className).toContain("w-full");
    expect(trigger.className).not.toContain("w-fit");
  });
});
