import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input component", () => {
  describe("Double click selection", () => {
    it("calls select() on double click for text input", async () => {
      render(<Input defaultValue="CT-2026-9999" data-testid="test-input" />);
      const input = screen.getByTestId("test-input") as HTMLInputElement;

      const selectSpy = vi.spyOn(input, "select");
      fireEvent.doubleClick(input);

      expect(selectSpy).toHaveBeenCalled();
    });

    it("calls select() on double click for number input", async () => {
      render(<Input type="number" defaultValue={120} data-testid="num-input" />);
      const input = screen.getByTestId("num-input") as HTMLInputElement;

      const selectSpy = vi.spyOn(input, "select");
      fireEvent.doubleClick(input);

      expect(selectSpy).toHaveBeenCalled();
    });

    it("invokes onDoubleClick prop when provided", () => {
      const onDoubleClick = vi.fn();
      render(<Input onDoubleClick={onDoubleClick} data-testid="custom-input" />);
      const input = screen.getByTestId("custom-input");

      fireEvent.doubleClick(input);
      expect(onDoubleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Number input handling (clear, no leading zeros, blur reset to 0)", () => {
    function ControlledNumberInput({ initial = 0 }: { initial?: number }) {
      const [val, setVal] = React.useState<number>(initial);
      return (
        <div>
          <span data-testid="state-value">{val}</span>
          <Input
            type="number"
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            data-testid="controlled-input"
          />
        </div>
      );
    }

    it("allows user to clear the input while focused without bouncing back to 0", () => {
      render(<ControlledNumberInput initial={0} />);
      const input = screen.getByTestId("controlled-input") as HTMLInputElement;

      // Focus the input
      fireEvent.focus(input);
      expect(input.value).toBe("0");

      // User clears the input
      fireEvent.change(input, { target: { value: "" } });
      // Input must remain empty while focused
      expect(input.value).toBe("");
    });

    it("strips leading zeros when user enters a number after clearing", () => {
      render(<ControlledNumberInput initial={0} />);
      const input = screen.getByTestId("controlled-input") as HTMLInputElement;
      const state = screen.getByTestId("state-value");

      fireEvent.focus(input);
      // Clear
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");

      // Type 5
      fireEvent.change(input, { target: { value: "5" } });
      expect(input.value).toBe("5");
      expect(state.textContent).toBe("5");
    });

    it("strips leading zeros when user types without clearing (e.g. typing 5 when value was 0 -> '05' -> '5')", () => {
      render(<ControlledNumberInput initial={0} />);
      const input = screen.getByTestId("controlled-input") as HTMLInputElement;
      const state = screen.getByTestId("state-value");

      fireEvent.focus(input);
      // Typing 5 when 0 is in the field produces 05 in the DOM
      fireEvent.change(input, { target: { value: "05" } });
      expect(input.value).toBe("5");
      expect(state.textContent).toBe("5");
    });

    it("preserves valid decimals like 0.5 and 0.05", () => {
      render(<ControlledNumberInput initial={0} />);
      const input = screen.getByTestId("controlled-input") as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "0.5" } });
      expect(input.value).toBe("0.5");

      fireEvent.change(input, { target: { value: "0.05" } });
      expect(input.value).toBe("0.05");
    });

    it("resets to 0 only when user blurs (leaves the input) and no number was inputted", () => {
      render(<ControlledNumberInput initial={50} />);
      const input = screen.getByTestId("controlled-input") as HTMLInputElement;
      const state = screen.getByTestId("state-value");

      fireEvent.focus(input);
      expect(input.value).toBe("50");

      // User clears the field completely
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");

      // While still focused, it does not reset to 0
      expect(input.value).toBe("");

      // User blurs the field (clicks outside / tabs away)
      fireEvent.blur(input);

      // Now it resets to 0
      expect(input.value).toBe("0");
      expect(state.textContent).toBe("0");
    });

    it("does not reset to 0 on blur if a number was inputted", () => {
      render(<ControlledNumberInput initial={0} />);
      const input = screen.getByTestId("controlled-input") as HTMLInputElement;
      const state = screen.getByTestId("state-value");

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "24" } });
      expect(input.value).toBe("24");

      fireEvent.blur(input);
      expect(input.value).toBe("24");
      expect(state.textContent).toBe("24");
    });

    it("does not affect text inputs (empty text input stays empty on blur)", () => {
      const onChange = vi.fn();
      render(<Input type="text" defaultValue="hello" onChange={onChange} data-testid="txt-input" />);
      const input = screen.getByTestId("txt-input") as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");

      fireEvent.blur(input);
      expect(input.value).toBe("");
    });
  });
});
