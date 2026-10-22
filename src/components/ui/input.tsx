"use client";

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  GlobalValidator,
  MAX_CODE_LENGTH,
  type GlobalValidatorOptions,
} from "@/lib/global-validator"

export interface InputProps extends React.ComponentProps<"input"> {
  /**
   * Set to true when this input is used for a code (e.g. branch code, shop code, service code, contract number).
   * Enforces UPPERCASE conversion, blocks all special characters except '_' and '-', and enforces max length of 100.
   */
  isCode?: boolean;
  /**
   * Alias for isCode.
   */
  enforceGlobalValidation?: boolean;
  /**
   * If true, bypasses code validation completely.
   */
  skipGlobalValidation?: boolean;
  /**
   * Whether to allow spaces in code input (default: false).
   */
  allowSpaces?: boolean;
  /**
   * Additional exceptions to allow beyond '_' and '-'.
   */
  allowedExceptions?: string[];
}

function shouldEnforceCodeValidation(
  type?: string,
  isCode?: boolean,
  enforceGlobalValidation?: boolean,
  skipGlobalValidation?: boolean,
  name?: string,
  id?: string
): boolean {
  if (skipGlobalValidation) return false;
  if (isCode !== undefined) return isCode;
  if (enforceGlobalValidation !== undefined) return enforceGlobalValidation;

  // Automatically disabled for non-textual input types
  if (type && type !== "text" && type !== "search") {
    return false;
  }

  // Auto-detect if name or id indicates a code field
  const identifier = `${name || ""} ${id || ""}`.trim();
  if (identifier && GlobalValidator.isCodeField(identifier)) {
    return true;
  }

  // Default to false: do not apply to every text input
  return false;
}

function Input({
  className,
  type,
  isCode,
  enforceGlobalValidation,
  skipGlobalValidation,
  allowSpaces = false,
  allowedExceptions,
  maxLength,
  name,
  id,
  onChange,
  onKeyDown,
  onPaste,
  ...props
}: InputProps) {
  const isEnabled = shouldEnforceCodeValidation(
    type,
    isCode,
    enforceGlobalValidation,
    skipGlobalValidation,
    name,
    id
  );

  const effectiveMaxLength = isEnabled
    ? (maxLength ?? MAX_CODE_LENGTH)
    : maxLength;

  const validatorOptions: GlobalValidatorOptions = React.useMemo(
    () => ({
      allowSpaces,
      additionalAllowedChars: allowedExceptions,
      maxLength: effectiveMaxLength,
    }),
    [allowSpaces, allowedExceptions, effectiveMaxLength]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isEnabled && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      // Block further characters if at maximum length (100) and no text is selected
      if (
        start === end &&
        effectiveMaxLength &&
        input.value.length >= effectiveMaxLength
      ) {
        e.preventDefault();
        return;
      }

      // Check if character is allowed when converted to uppercase
      const charUpper = e.key.toUpperCase();
      if (!GlobalValidator.isValid(charUpper, validatorOptions)) {
        e.preventDefault();
        return;
      }
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isEnabled) {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      const sanitized = GlobalValidator.sanitize(pasted, validatorOptions);
      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const currentValue = input.value;
      let nextValue =
        currentValue.slice(0, start) + sanitized + currentValue.slice(end);

      if (effectiveMaxLength && nextValue.length > effectiveMaxLength) {
        nextValue = nextValue.slice(0, effectiveMaxLength);
      }

      input.value = nextValue;
      const newCursor = Math.min(
        start + sanitized.length,
        effectiveMaxLength ?? start + sanitized.length
      );
      input.setSelectionRange(newCursor, newCursor);

      const changeEvent = new Event("input", { bubbles: true });
      input.dispatchEvent(changeEvent);

      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: input,
          currentTarget: input,
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
      return;
    }
    onPaste?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEnabled) {
      let sanitized = GlobalValidator.sanitize(e.target.value, validatorOptions);
      if (effectiveMaxLength && sanitized.length > effectiveMaxLength) {
        sanitized = sanitized.slice(0, effectiveMaxLength);
      }
      e.target.value = sanitized;
    }
    onChange?.(e);
  };

  return (
    <input
      type={type}
      name={name}
      id={id}
      maxLength={effectiveMaxLength}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        isEnabled && "uppercase",
        className
      )}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...props}
    />
  )
}

export { Input }
