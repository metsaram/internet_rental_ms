"use client";

import * as React from "react"
import { cn } from "@/lib/utils"
import { GlobalValidator, type GlobalValidatorOptions } from "@/lib/global-validator"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /**
   * Whether to enforce the global validator (converts to UPPERCASE, blocks special chars except '_' and '-').
   * Defaults to false for multiline textareas unless explicitly enabled.
   */
  enforceGlobalValidation?: boolean;
  /**
   * Whether to allow spaces (default: true for textareas when validation is enabled).
   */
  allowSpaces?: boolean;
  /**
   * Additional exceptions to allow beyond '_' and '-'.
   */
  allowedExceptions?: string[];
}

function Textarea({
  className,
  enforceGlobalValidation = false,
  allowSpaces = true,
  allowedExceptions,
  onChange,
  onKeyDown,
  ...props
}: TextareaProps) {
  const validatorOptions: GlobalValidatorOptions = React.useMemo(
    () => ({
      allowSpaces,
      additionalAllowedChars: [
        "\n",
        "\r",
        ...(allowedExceptions ?? []),
      ],
    }),
    [allowSpaces, allowedExceptions]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      enforceGlobalValidation &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      const charUpper = e.key.toUpperCase();
      if (!GlobalValidator.isValid(charUpper, validatorOptions)) {
        e.preventDefault();
        return;
      }
    }
    onKeyDown?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (enforceGlobalValidation) {
      e.target.value = GlobalValidator.sanitize(e.target.value, validatorOptions);
    }
    onChange?.(e);
  };

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        enforceGlobalValidation && "uppercase",
        className
      )}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

export { Textarea }
