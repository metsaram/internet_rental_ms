"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

/**
 * Safely parses a Date, ISO string, or YYYY-MM-DD string into a local Date object.
 * Prevents timezone off-by-one errors when parsing "YYYY-MM-DD".
 */
export function parseDateString(
  value: string | Date | null | undefined
): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return isValid(value) && !isNaN(value.getTime()) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Match YYYY-MM-DD exactly
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? undefined : d;
    }

    // Match ISO strings starting with YYYY-MM-DD
    const isoPrefixMatch = /^(\d{4})-(\d{2})-(\d{2})T/.exec(trimmed);
    if (isoPrefixMatch) {
      const year = parseInt(isoPrefixMatch[1], 10);
      const month = parseInt(isoPrefixMatch[2], 10) - 1;
      const day = parseInt(isoPrefixMatch[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? undefined : d;
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export interface DatePickerProps {
  /**
   * The current value as a "YYYY-MM-DD" string, ISO string, or Date.
   */
  value?: string | Date | null;
  /**
   * Callback fired when a date is selected or cleared.
   * Provides the formatted "YYYY-MM-DD" string and the Date object.
   */
  onChange?: (dateString: string, date?: Date) => void;
  /**
   * Alias for onChange, receiving the formatted "YYYY-MM-DD" string.
   */
  onValueChange?: (dateString: string) => void;
  /**
   * Callback receiving the raw Date object (or undefined when cleared).
   */
  onSelect?: (date: Date | undefined) => void;
  /**
   * Placeholder when no date is selected. Defaults to "Pick a date".
   */
  placeholder?: string;
  /**
   * Format used to display the selected date on the trigger button.
   * Defaults to "MMM d, yyyy" (e.g. "Oct 24, 2026").
   */
  displayFormat?: string;
  /**
   * Format used when emitting date strings via onChange / onValueChange.
   * Defaults to "yyyy-MM-dd".
   */
  outputFormat?: string;
  /**
   * Whether the input is disabled.
   */
  disabled?: boolean;
  /**
   * Whether the date picker is read-only.
   */
  readOnly?: boolean;
  /**
   * Whether to show a clear button when a date is selected.
   * Defaults to true unless disabled or required.
   */
  clearable?: boolean;
  /**
   * Optional HTML id attribute (for label association).
   */
  id?: string;
  /**
   * Optional name attribute (renders a hidden input for form submissions).
   */
  name?: string;
  /**
   * Minimum allowable date (either Date or "YYYY-MM-DD" string).
   */
  min?: string | Date;
  /**
   * Maximum allowable date (either Date or "YYYY-MM-DD" string).
   */
  max?: string | Date;
  /**
   * Additional custom disabled day matcher for the calendar.
   */
  disabledDays?: ((date: Date) => boolean) | Array<(date: Date) => boolean>;
  /**
   * Alignment of the popover content relative to the trigger.
   */
  align?: "start" | "center" | "end";
  /**
   * Preferred side for popover content.
   */
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Custom CSS class name for the trigger button.
   */
  className?: string;
  /**
   * Custom CSS class name for the popover content.
   */
  popoverClassName?: string;
  /**
   * Whether this field is required.
   */
  required?: boolean;
  /**
   * Aria label for the picker.
   */
  "aria-label"?: string;
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  function DatePicker(
    {
      value,
      onChange,
      onValueChange,
      onSelect,
      placeholder = "Pick a date",
      displayFormat = "MMM d, yyyy",
      outputFormat = "yyyy-MM-dd",
      disabled = false,
      readOnly = false,
      clearable = true,
      id,
      name,
      min,
      max,
      disabledDays,
      align = "start",
      side = "bottom",
      className,
      popoverClassName,
      required,
      "aria-label": ariaLabel,
    },
    ref
  ) {
    const [open, setOpen] = React.useState(false);

    const parsedDate = React.useMemo(() => parseDateString(value), [value]);

    const triggerChange = React.useCallback(
      (nextStr: string, nextDate?: Date) => {
        if (onChange) {
          try {
            (onChange as unknown as (str: string, d?: Date) => void)(
              nextStr,
              nextDate
            );
          } catch (err) {
            // Support legacy onChange={(e) => setVal(e.target.value)} pattern
            if (err instanceof TypeError) {
              (
                onChange as unknown as (e: {
                  target: { value: string; id?: string; name?: string };
                  currentTarget: { value: string; id?: string; name?: string };
                }) => void
              )({
                target: { value: nextStr, id, name },
                currentTarget: { value: nextStr, id, name },
              });
            } else {
              throw err;
            }
          }
        }
        onValueChange?.(nextStr);
        onSelect?.(nextDate);
      },
      [onChange, onValueChange, onSelect, id, name]
    );

    const handleDaySelect = React.useCallback(
      (day: Date | undefined) => {
        if (readOnly || disabled) return;
        if (day) {
          const str = format(day, outputFormat);
          triggerChange(str, day);
          setOpen(false);
        } else if (clearable) {
          triggerChange("", undefined);
          setOpen(false);
        }
      },
      [readOnly, disabled, outputFormat, clearable, triggerChange]
    );

    const handleClear = React.useCallback(
      (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (disabled || readOnly) return;
        triggerChange("", undefined);
      },
      [disabled, readOnly, triggerChange]
    );

    // Compute calendar disabled days based on min and max
    const disabledMatcher = React.useMemo(() => {
      const matchers: Array<(date: Date) => boolean> = [];

      if (min) {
        const minD = parseDateString(min);
        if (minD) {
          minD.setHours(0, 0, 0, 0);
          matchers.push((d: Date) => {
            const check = new Date(d);
            check.setHours(0, 0, 0, 0);
            return check < minD;
          });
        }
      }

      if (max) {
        const maxD = parseDateString(max);
        if (maxD) {
          maxD.setHours(23, 59, 59, 999);
          matchers.push((d: Date) => {
            const check = new Date(d);
            check.setHours(0, 0, 0, 0);
            return check > maxD;
          });
        }
      }

      if (disabledDays) {
        if (Array.isArray(disabledDays)) {
          matchers.push(...disabledDays);
        } else if (typeof disabledDays === "function") {
          matchers.push(disabledDays);
        }
      }

      if (matchers.length === 0) return undefined;
      return (date: Date) => matchers.some((m) => m(date));
    }, [min, max, disabledDays]);

    const formattedDisplay = React.useMemo(() => {
      if (!parsedDate) return null;
      try {
        return format(parsedDate, displayFormat);
      } catch {
        return null;
      }
    }, [parsedDate, displayFormat]);

    const hiddenInputValue = React.useMemo(() => {
      if (!parsedDate) return "";
      try {
        return format(parsedDate, outputFormat);
      } catch {
        return "";
      }
    }, [parsedDate, outputFormat]);

    const isInteractive = !disabled && !readOnly;

    return (
      <div className="relative inline-flex w-full items-center">
        {name && (
          <input
            type="hidden"
            name={name}
            value={hiddenInputValue}
            required={required}
          />
        )}
        <Popover open={isInteractive ? open : false} onOpenChange={isInteractive ? setOpen : undefined}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={ariaLabel || (parsedDate ? `Selected date: ${formattedDisplay}` : placeholder)}
              aria-required={required}
              className={cn(
                "h-9 w-full justify-start text-left font-normal border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow]",
                "hover:bg-accent/40 hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !parsedDate && "text-muted-foreground",
                className
              )}
            >
              <CalendarIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">
                {formattedDisplay ?? placeholder}
              </span>

              {clearable && isInteractive && parsedDate && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear date"
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleClear(e);
                    }
                  }}
                  className="ml-auto -mr-1.5 flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 focus:bg-muted focus:outline-none transition-colors"
                >
                  <X className="size-3.5" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn("w-auto p-0 z-50", popoverClassName)}
            align={align}
            side={side}
          >
            <Calendar
              mode="single"
              selected={parsedDate}
              onSelect={handleDaySelect}
              defaultMonth={parsedDate}
              disabled={disabledMatcher}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  displayFormat?: string;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  className?: string;
  popoverClassName?: string;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  displayFormat = "MMM d, yyyy",
  disabled = false,
  clearable = true,
  id,
  className,
  popoverClassName,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const displayText = React.useMemo(() => {
    if (!value?.from) return null;
    if (value.to) {
      return `${format(value.from, displayFormat)} - ${format(value.to, displayFormat)}`;
    }
    return format(value.from, displayFormat);
  }, [value, displayFormat]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange?.(undefined);
  };

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start text-left font-normal border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow]",
            "hover:bg-accent/40 hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1">{displayText ?? placeholder}</span>
          {clearable && !disabled && value?.from && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              onClick={handleClear}
              className="ml-auto -mr-1.5 flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 focus:bg-muted focus:outline-none transition-colors"
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0 z-50", popoverClassName)} align={align}>
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          defaultMonth={value?.from}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
