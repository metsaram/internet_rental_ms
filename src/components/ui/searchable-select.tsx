"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SearchableSelectProps = {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  searchThreshold?: number;
  searchable?: boolean;
  emptyMessage?: string;
  id?: string;
  name?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Client-side select dropdown with auto-search capability when options count exceeds searchThreshold (default: 5).
 * Uses the exact same search interaction, sticky input, keyboard navigation, and filtering as DataTable FilterSelect.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
  searchPlaceholder = "Search...",
  searchThreshold = 5,
  searchable = true,
  emptyMessage = "No matching results",
  id,
  name,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: SearchableSelectProps) {
  const isSearchEnabled = Boolean(searchable);
  const shouldShowSearch = isSearchEnabled && options.length > (searchThreshold ?? 5);

  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChangeProp?.(nextOpen);
    if (!nextOpen) {
      setSearchQuery("");
    }
  };

  React.useEffect(() => {
    if (open && shouldShowSearch) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, shouldShowSearch]);

  const filteredOptions = React.useMemo(() => {
    if (!shouldShowSearch || !searchQuery.trim()) {
      return options;
    }
    const q = searchQuery.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, shouldShowSearch, searchQuery]);

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={handleOpenChange}
      name={name}
    >
      <SelectTrigger
        id={id}
        className={cn("w-full text-sm", className)}
        disabled={disabled}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {shouldShowSearch && (
          <div
            className="sticky top-0 z-10 -mt-1 -mx-1 mb-1 border-b border-border/60 bg-popover/95 p-1.5 backdrop-blur-xs"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center">
              <Search className="text-muted-foreground pointer-events-none absolute left-2 size-3.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    handleOpenChange(false);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const contentEl = searchInputRef.current?.closest('[data-slot="select-content"]');
                    const firstItem = contentEl?.querySelector<HTMLElement>(
                      '[data-slot="select-item"]:not([data-disabled])'
                    );
                    firstItem?.focus();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      onValueChange(filteredOptions[0].value);
                      handleOpenChange(false);
                    }
                  }
                }}
                placeholder={searchPlaceholder}
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring h-7 w-full rounded-sm border bg-background/50 pl-7 pr-7 text-xs outline-hidden focus-visible:ring-1"
                aria-label={searchPlaceholder}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground absolute right-1.5 p-0.5 rounded-xs"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}
        {filteredOptions.length === 0 ? (
          <div className="py-3 px-2 text-center text-xs text-muted-foreground select-none">
            {emptyMessage}
          </div>
        ) : (
          filteredOptions.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              disabled={o.disabled}
              className="text-sm"
            >
              {o.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
