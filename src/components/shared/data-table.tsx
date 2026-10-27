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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  /** Explicitly enable or disable sorting for this column */
  sortable?: boolean;
  /** Key path or property name to sort by (supports dot notation like "branch.name") */
  sortKey?: string;
  /** Custom function to extract sortable value for a row */
  sortValue?: (row: T) => unknown;
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
  /** Default sort state on initial render (e.g. { key: "createdAt", direction: "desc" }) */
  defaultSort?: SortState;
  /** Controlled sort state */
  sort?: SortState | null;
  /** Callback fired when sort changes */
  onSortChange?: (sort: SortState | null) => void;
  /** Whether columns are sortable by default (defaults to true) */
  sortable?: boolean;
}

function extractPropertySortValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val !== "object" || val instanceof Date) return val;
  const rec = val as Record<string, unknown>;
  if ("name" in rec && typeof rec.name === "string") return rec.name;
  if ("code" in rec && typeof rec.code === "string") return rec.code;
  if ("title" in rec && typeof rec.title === "string") return rec.title;
  return null;
}

function getSortValue<T>(row: T, col?: DataTableColumn<T>): unknown {
  if (!col || !row) return null;
  if (col.sortValue) {
    try {
      return col.sortValue(row);
    } catch {
      return null;
    }
  }

  const keyToUse = col.sortKey || col.key;
  if (typeof row === "object" && row !== null) {
    const rec = row as Record<string, unknown>;
    if (keyToUse in rec) {
      return extractPropertySortValue(rec[keyToUse]);
    }
    if (keyToUse.includes(".")) {
      const parts = keyToUse.split(".");
      let cur: unknown = row;
      for (const p of parts) {
        if (cur == null || typeof cur !== "object") return null;
        cur = (cur as Record<string, unknown>)[p];
      }
      return extractPropertySortValue(cur);
    }

    // Try common naming conventions
    const candidates = [
      `${keyToUse}Number`,
      `${keyToUse}Code`,
      `${keyToUse}Name`,
      `${keyToUse}Date`,
      `${keyToUse}At`,
    ];
    for (const cand of candidates) {
      if (cand in rec) {
        return extractPropertySortValue(rec[cand]);
      }
    }
  }

  return null;
}

export function compareSortValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1;
  if (b === null || b === undefined || b === "") return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? -1 : 1;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  const aStr = String(a).trim();
  const bStr = String(b).trim();

  // Try numeric comparison if string resembles currency, count, or decimal (e.g. "$1,200.50", "-50", "+12.5")
  const aClean = aStr.replace(/^[^\d.-]+/, "").replace(/,/g, "");
  const bClean = bStr.replace(/^[^\d.-]+/, "").replace(/,/g, "");
  if (aClean !== "" && bClean !== "" && !isNaN(Number(aClean)) && !isNaN(Number(bClean))) {
    const diff = Number(aClean) - Number(bClean);
    if (!isNaN(diff)) return diff;
  }

  // Check date strings (e.g. YYYY-MM-DD or formatted date strings)
  if ((aStr.includes("-") || aStr.includes("/")) && (bStr.includes("-") || bStr.includes("/"))) {
    const aDate = Date.parse(aStr);
    const bDate = Date.parse(bStr);
    if (!isNaN(aDate) && !isNaN(bDate)) {
      return aDate - bDate;
    }
  }

  return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
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
  defaultSort,
  sort: controlledSort,
  onSortChange,
  sortable = true,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = React.useState<SortState | null>(
    defaultSort ?? null
  );
  const activeSort = controlledSort !== undefined ? controlledSort : internalSort;

  const [page, setPage] = React.useState(1);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const prevDefaultSortRef = React.useRef(defaultSort);
  React.useEffect(() => {
    if (defaultSort !== prevDefaultSortRef.current) {
      prevDefaultSortRef.current = defaultSort;
      if (controlledSort === undefined) {
        setInternalSort(defaultSort ?? null);
      }
    }
  }, [defaultSort, controlledSort]);

  const sortedRows = React.useMemo(() => {
    if (!activeSort) return rows;
    const col = columns.find((c) => c.key === activeSort.key);
    if (!col) return rows;

    return [...rows].sort((rowA, rowB) => {
      const valA = getSortValue(rowA, col);
      const valB = getSortValue(rowB, col);

      const aEmpty = valA === null || valA === undefined || valA === "";
      const bEmpty = valB === null || valB === undefined || valB === "";

      // Push nulls/empty values to the end regardless of sort direction
      if (aEmpty && !bEmpty) return 1;
      if (bEmpty && !aEmpty) return -1;
      if (aEmpty && bEmpty) return 0;

      const cmp = compareSortValues(valA, valB);
      return activeSort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, activeSort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  React.useEffect(() => {
    setPage(1);
    setActiveIndex(-1);
  }, [rows.length, search?.value, activeSort?.key, activeSort?.direction]);

  const handleSort = (key: string) => {
    let nextSort: SortState | null = null;
    if (!activeSort || activeSort.key !== key) {
      nextSort = { key, direction: "asc" };
    } else if (activeSort.direction === "asc") {
      nextSort = { key, direction: "desc" };
    } else {
      if (defaultSort && defaultSort.key === key && defaultSort.direction === "desc") {
        nextSort = { key, direction: "asc" };
      } else {
        nextSort = defaultSort ? { ...defaultSort } : null;
      }
    }

    if (controlledSort === undefined) {
      setInternalSort(nextSort);
    }
    onSortChange?.(nextSort);
    setPage(1);
    setActiveIndex(-1);
  };

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
                {columns.map((c) => {
                  const isColSortable =
                    sortable !== false &&
                    (c.sortable === true ||
                      (c.sortable !== false &&
                        (c.sortValue !== undefined ||
                          c.sortKey !== undefined ||
                          defaultSort?.key === c.key ||
                          (c.key !== "select" &&
                            c.key !== "actions" &&
                            (rows.length === 0 ||
                              (rows[0] as Record<string, unknown>)?.[c.key] !== undefined ||
                              (rows[0] as Record<string, unknown>)?.[`${c.key}Number`] !== undefined ||
                              (rows[0] as Record<string, unknown>)?.[`${c.key}Code`] !== undefined ||
                              (rows[0] as Record<string, unknown>)?.[`${c.key}Name`] !== undefined ||
                              (rows[0] as Record<string, unknown>)?.[`${c.key}Date`] !== undefined ||
                              (rows[0] as Record<string, unknown>)?.[`${c.key}At`] !== undefined)))));

                  const isSorted = activeSort?.key === c.key;
                  const isAsc = activeSort?.direction === "asc";

                  return (
                    <TableHead
                      key={c.key}
                      aria-sort={
                        isSorted
                          ? isAsc
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        c.hideOnMobile && "hidden md:table-cell",
                        isColSortable &&
                          "group cursor-pointer select-none hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        c.className
                      )}
                      onClick={isColSortable ? () => handleSort(c.key) : undefined}
                      onKeyDown={
                        isColSortable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSort(c.key);
                              }
                            }
                          : undefined
                      }
                      tabIndex={isColSortable ? 0 : undefined}
                      role={isColSortable ? "columnheader button" : "columnheader"}
                    >
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          c.className?.includes("text-right") && "w-full justify-end",
                          c.className?.includes("text-center") && "w-full justify-center"
                        )}
                      >
                        <span>{c.header}</span>
                        {isColSortable && (
                          <span className="inline-flex shrink-0">
                            {isSorted ? (
                              isAsc ? (
                                <ArrowUp
                                  className="size-3.5 text-primary"
                                  aria-label="Sorted ascending"
                                />
                              ) : (
                                <ArrowDown
                                  className="size-3.5 text-primary"
                                  aria-label="Sorted descending"
                                />
                              )
                            ) : (
                              <ArrowUpDown className="size-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
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

      {sortedRows.length > pageSize && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(safePage - 1) * pageSize + 1}
            </span>
            –
            <span className="font-medium text-foreground">
              {Math.min(safePage * pageSize, sortedRows.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{sortedRows.length}</span>
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
