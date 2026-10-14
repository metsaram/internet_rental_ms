"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  toolbar?: React.ReactNode;
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  search,
  toolbar,
  pageSize = 10,
  emptyMessage = "No records found.",
  onRowClick,
  loading,
}: DataTableProps<T>) {
  const [page, setPage] = React.useState(1);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  React.useEffect(() => {
    setPage(1);
    setActiveIndex(-1);
  }, [rows.length, search?.value]);

  // Keyboard shortcuts: j/k = down/up, Enter = open, / = focus search, Esc = clear.
  React.useEffect(() => {
    if (!onRowClick) return;
    const handler = (e: KeyboardEvent) => {
      // Don't interfere when typing in an input/textarea/select.
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (isInput && e.key !== "Escape") return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(pageRows.length - 1, prev + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < pageRows.length) {
        e.preventDefault();
        onRowClick(pageRows[activeIndex]);
      } else if (e.key === "/" && search && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      } else if (e.key === "Escape") {
        if (search?.value) {
          search.onChange("");
        }
        setActiveIndex(-1);
        (document.activeElement as HTMLElement)?.blur?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pageRows, activeIndex, onRowClick, search]);

  return (
    <div className="space-y-3">
      {(search || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {search ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Search..."}
                className="pl-9"
              />
            </div>
          ) : (
            <span />
          )}
          {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                      c.hideOnMobile && "hidden md:table-cell",
                      c.className
                    )}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className="py-3">
                        <div className="h-4 w-full max-w-[12rem] animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, idx) => (
                  <TableRow
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/40 data-[state=selected]:bg-muted/60",
                      idx === activeIndex && "bg-primary/10 ring-1 ring-inset ring-primary/20"
                    )}
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "py-3 text-sm",
                          c.hideOnMobile && "hidden md:table-cell",
                          c.className
                        )}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {rows.length > pageSize && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(safePage - 1) * pageSize + 1}
            </span>
            –
            <span className="font-medium text-foreground">
              {Math.min(safePage * pageSize, rows.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{rows.length}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">
              Page {safePage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage === pageCount}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(pageCount)}
              disabled={safePage === pageCount}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple client-side select for table filters. */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: T | "ALL";
  onChange: (v: T | "ALL") => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as T | "ALL")}
    >
      <SelectTrigger className={cn("h-8 w-[10rem] text-xs", className)}>
        <SelectValue placeholder={placeholder ?? "Filter"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL" className="text-xs">
          All
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
