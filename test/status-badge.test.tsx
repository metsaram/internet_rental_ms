import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { StatusBadge } from "@/components/shared/status-badge";

describe("StatusBadge Component", () => {
  it("renders DRAFT status with orange styling", () => {
    render(<StatusBadge status="DRAFT" />);
    const badge = screen.getByText("draft");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-orange-700");
  });

  it("renders VOID status with red (rose) styling", () => {
    render(<StatusBadge status="VOID" />);
    const badge = screen.getByText("void");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-rose-700");
  });

  it("renders PAID status with green (emerald) styling by default", () => {
    render(<StatusBadge status="PAID" />);
    const badge = screen.getByText("paid");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-emerald-700");
  });

  it("renders PARTIAL status with amber styling by default", () => {
    render(<StatusBadge status="PARTIAL" />);
    const badge = screen.getByText("partial");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-amber-700");
  });

  it("allows tone prop override", () => {
    render(<StatusBadge status="CUSTOM" tone="green" />);
    const badge = screen.getByText("custom");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-emerald-700");
  });
});
