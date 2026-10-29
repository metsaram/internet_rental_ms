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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  RotateCcw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export {
  ActionMenu,
  type ActionItem,
  type ActionConfirmationConfig,
  type ActionMenuProps,
} from "./action-menu";
export {
  ReportTable,
  type ColumnConfig,
  type ReportTableProps,
  type ReportTableSort,
} from "@/components/views/reports";

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
  headerClassName?: string;
  /** Explicitly enable or disable sorting for this column */
  sortable?: boolean;
  /** Key path or property name to sort by (supports dot notation like "branch.name") */
  sortKey?: string;
  /** Custom function to extract sortable value for a row */
  sortValue?: (row: T) => unknown;

  /** Whether this column is resizable. Defaults to true unless false or key is 'select'/'actions' */
  resizable?: boolean;
  /** Initial or fixed column width in px or CSS string (e.g. 160 or '20%') */
  width?: number | string;
  /** Minimum width allowed during column resizing (defaults to 60px) */
  minWidth?: number;
  /** Maximum width allowed during column resizing (defaults to 1000px) */
  maxWidth?: number;
  /** Custom inline style for cells in this column */
  style?: React.CSSProperties;
  /** Whether cell text should truncate with an ellipsis if it overflows (defaults to true) */
  truncate?: boolean;
  /** Whether this column can be hidden in the column chooser (defaults to true; false for 'select' and 'actions') */
  hideable?: boolean;
  /** Whether this column is hidden by default on initial render (defaults to false) */
  defaultHidden?: boolean;
  /** Human-readable title for the column chooser (defaults to header string or extracted text) */
  title?: string;
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

  /** Enable column resizing by dragging column borders (defaults to true) */
  resizable?: boolean;
  /** Default minimum width for columns that do not specify minWidth (defaults to 60) */
  defaultMinWidth?: number;
  /** Default maximum width for columns that do not specify maxWidth (defaults to 1000) */
  defaultMaxWidth?: number;
  /** Whether to set column sizes to their minWidth on mobile screens (< 768px). Defaults to true */
  useMinWidthOnMobile?: boolean;
  /** Callback fired when a column is resized */
  onColumnResize?: (columnKey: string, width: number) => void;
  /** Striped alternating row backgrounds (zebra striping) */
  striped?: boolean;
  /** Density variant for padding: 'compact', 'normal', or 'comfortable' */
  density?: "compact" | "normal" | "comfortable";
  /** Add vertical borders between cells for a grid / spreadsheet look */
  bordered?: boolean;
  /** Sticky header when scrolling vertically */
  stickyHeader?: boolean;
  /** Custom class for the table container */
  containerClassName?: string;
  /** Custom function to apply styling classes to individual rows based on row data */
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Whether cell text should truncate with an ellipsis when overflowing (defaults to true) */
  truncate?: boolean;
  /** Enable the Column Chooser dropdown in the toolbar (defaults to true) */
  columnChooser?: boolean;
  /** Custom key used to persist column visibility and widths in localStorage cache */
  storageKey?: string;
  /** Whether to persist column visibility in localStorage cache (defaults to true) */
  persistColumnVisibility?: boolean;
  /** Whether to persist resized column widths in localStorage cache (defaults to true) */
  persistColumnWidths?: boolean;
  /** Callback fired when visible column keys change */
  onVisibleColumnsChange?: (visibleKeys: string[]) => void;
}

function extractNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).filter(Boolean).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    if (typeof props.status === "string") return props.status;
    if (typeof props.label === "string") return props.label;
    if (props.children) return extractNodeText(props.children as React.ReactNode);
  }
  return "";
}

const STORAGE_PREFIX = "netrent_tbl";

function getColumnStorageKey(storageKey?: string, columns?: { key: string }[]): string {
  if (storageKey && storageKey.trim()) {
    return `${STORAGE_PREFIX}_cols_${storageKey.trim()}`;
  }
  const colSig = columns?.map((c) => c.key).join("_") || "default";
  return `${STORAGE_PREFIX}_cols_${colSig}`;
}

function getWidthsStorageKey(storageKey?: string, columns?: { key: string }[]): string {
  if (storageKey && storageKey.trim()) {
    return `${STORAGE_PREFIX}_widths_${storageKey.trim()}`;
  }
  const colSig = columns?.map((c) => c.key).join("_") || "default";
  return `${STORAGE_PREFIX}_widths_${colSig}`;
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

export function getColumnConstraints<T>(
  col: DataTableColumn<T>,
  defaultMin: number = 60,
  defaultMax: number = 1000
): { minWidth: number; maxWidth: number } {
  if (col.key === "select") {
    return {
      minWidth: col.minWidth ?? 40,
      maxWidth: col.maxWidth ?? 60,
    };
  }
  if (col.key === "actions") {
    return {
      minWidth: col.minWidth ?? 70,
      maxWidth: col.maxWidth ?? 130,
    };
  }
  return {
    minWidth: col.minWidth ?? defaultMin,
    maxWidth: col.maxWidth ?? defaultMax,
  };
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
  resizable = true,
  defaultMinWidth = 60,
  defaultMaxWidth = 1000,
  useMinWidthOnMobile = true,
  onColumnResize,
  striped = false,
  density = "normal",
  bordered = false,
  stickyHeader = false,
  containerClassName,
  rowClassName,
  truncate = true,
  columnChooser = true,
  storageKey,
  persistColumnVisibility = true,
  persistColumnWidths = true,
  onVisibleColumnsChange,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = React.useState<SortState | null>(
    defaultSort ?? null
  );
  const activeSort = controlledSort !== undefined ? controlledSort : internalSort;

  const [page, setPage] = React.useState(1);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const colStorageKey = React.useMemo(
    () => getColumnStorageKey(storageKey, columns),
    [storageKey, columns]
  );
  const widthStorageKey = React.useMemo(
    () => getWidthsStorageKey(storageKey, columns),
    [storageKey, columns]
  );

  const defaultHiddenKeys = React.useMemo(() => {
    return columns.filter((c) => c.defaultHidden).map((c) => c.key);
  }, [columns]);

  const [hiddenKeys, setHiddenKeys] = React.useState<string[]>(defaultHiddenKeys);

  // Column resizing state
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const col of columns) {
      if (typeof col.width === "number") {
        initial[col.key] = col.width;
      }
    }
    return initial;
  });
  const [userResizedKeys, setUserResizedKeys] = React.useState<Set<string>>(() => new Set());

  // Safely hydrate column visibility choices from localStorage cache
  React.useEffect(() => {
    if (persistColumnVisibility === false || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(colStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (k) => typeof k === "string" && columns.some((c) => c.key === k)
          );
          setHiddenKeys(valid);
        }
      }
    } catch {
      // Gracefully ignore sandbox/private mode localStorage errors
    }
  }, [colStorageKey, persistColumnVisibility, columns]);

  // Safely hydrate column widths from localStorage cache
  React.useEffect(() => {
    if (persistColumnWidths === false || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(widthStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setColumnWidths((prev) => ({ ...prev, ...parsed }));
          setUserResizedKeys((prev) => new Set([...prev, ...Object.keys(parsed)]));
        }
      }
    } catch {
      // Gracefully ignore
    }
  }, [widthStorageKey, persistColumnWidths]);

  const toggleableColumns = React.useMemo(() => {
    return columns.filter(
      (c) => c.hideable !== false && c.key !== "select" && c.key !== "actions"
    );
  }, [columns]);

  const visibleColumns = React.useMemo(() => {
    const hiddenSet = new Set(hiddenKeys);
    return columns.filter((c) => {
      if (c.hideable === false || c.key === "select" || c.key === "actions") {
        return true;
      }
      return !hiddenSet.has(c.key);
    });
  }, [columns, hiddenKeys]);

  React.useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns.map((c) => c.key));
  }, [visibleColumns, onVisibleColumnsChange]);

  const toggleColumn = React.useCallback(
    (key: string) => {
      setHiddenKeys((prev) => {
        const isHidden = prev.includes(key);
        let next: string[];
        if (isHidden) {
          next = prev.filter((k) => k !== key);
        } else {
          const currentVisible = toggleableColumns.filter((c) => !prev.includes(c.key)).length;
          if (currentVisible <= 1) {
            return prev;
          }
          next = [...prev, key];
        }

        if (persistColumnVisibility !== false && typeof window !== "undefined") {
          try {
            localStorage.setItem(colStorageKey, JSON.stringify(next));
          } catch {
            // Gracefully ignore
          }
        }
        return next;
      });
    },
    [toggleableColumns, persistColumnVisibility, colStorageKey]
  );

  const showAllColumns = React.useCallback(() => {
    setHiddenKeys([]);
    if (persistColumnVisibility !== false && typeof window !== "undefined") {
      try {
        localStorage.setItem(colStorageKey, JSON.stringify([]));
      } catch {
        // Gracefully ignore
      }
    }
  }, [persistColumnVisibility, colStorageKey]);

  const resetColumns = React.useCallback(() => {
    setHiddenKeys(defaultHiddenKeys);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(colStorageKey);
        localStorage.removeItem(widthStorageKey);
      } catch {
        // Gracefully ignore
      }
    }
    const initialWidths: Record<string, number> = {};
    for (const col of columns) {
      if (typeof col.width === "number") {
        initialWidths[col.key] = col.width;
      }
    }
    setColumnWidths(initialWidths);
    setUserResizedKeys(new Set());
  }, [defaultHiddenKeys, colStorageKey, widthStorageKey, columns]);

  const [resizingKey, setResizingKey] = React.useState<string | null>(null);
  const resizeStateRef = React.useRef<{
    key: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);
  const lastTapRef = React.useRef<{ key: string; time: number } | null>(null);

  // Window listeners for smooth column resizing drag across mouse, pointer, and touch
  React.useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!resizeStateRef.current) return;
      const { key, startX, startWidth, minWidth, maxWidth } = resizeStateRef.current;
      const diff = clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(startWidth + diff)));

      setColumnWidths((prev) => {
        if (prev[key] === newWidth) return prev;
        return { ...prev, [key]: newWidth };
      });
      setUserResizedKeys((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      onColumnResize?.(key, newWidth);
    };

    const handleEnd = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      setResizingKey(null);

      if (persistColumnWidths !== false && typeof window !== "undefined") {
        setColumnWidths((current) => {
          try {
            localStorage.setItem(widthStorageKey, JSON.stringify(current));
          } catch {
            // Gracefully ignore
          }
          return current;
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };
    const onMouseUp = () => {
      handleEnd();
    };

    const onPointerMove = (e: PointerEvent) => {
      handleMove(e.clientX);
    };
    const onPointerUp = () => {
      handleEnd();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!resizeStateRef.current) return;
      if (e.cancelable) {
        e.preventDefault();
      }
      if (e.touches && e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      handleEnd();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onColumnResize, persistColumnWidths, widthStorageKey]);

  React.useEffect(() => {
    if (resizingKey === null) return;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [resizingKey]);

  const handleResizeStart = (
    clientX: number,
    key: string,
    col: DataTableColumn<T>,
    th: HTMLElement | null
  ) => {
    const { minWidth, maxWidth } = getColumnConstraints(col, defaultMinWidth, defaultMaxWidth);

    const startWidth =
      userResizedKeys.has(key) && columnWidths[key] !== undefined
        ? columnWidths[key]
        : shouldApplyMobileMin
        ? (th ? Math.round(th.getBoundingClientRect().width) : minWidth)
        : columnWidths[key] ??
          (typeof col.width === "number"
            ? col.width
            : th
            ? Math.round(th.getBoundingClientRect().width)
            : 150);

    resizeStateRef.current = {
      key,
      startX: clientX,
      startWidth,
      minWidth,
      maxWidth,
    };
    setResizingKey(key);
  };

  const handleResizeReset = (
    e: React.SyntheticEvent,
    key: string,
    col: DataTableColumn<T>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setUserResizedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setColumnWidths((prev) => {
      const next = { ...prev };
      if (typeof col.width === "number") {
        next[key] = col.width;
      } else {
        delete next[key];
      }
      if (persistColumnWidths !== false && typeof window !== "undefined") {
        try {
          localStorage.setItem(widthStorageKey, JSON.stringify(next));
        } catch {
          // Gracefully ignore
        }
      }
      return next;
    });
  };

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

  const isMobile = useIsMobile();
  const shouldApplyMobileMin = useMinWidthOnMobile && isMobile;

  const getColWidth = (c: DataTableColumn<T>, colMin: number) => {
    const isCustomized = userResizedKeys.has(c.key);
    if (isCustomized && columnWidths[c.key] !== undefined) {
      return `${columnWidths[c.key]}px`;
    }
    if (shouldApplyMobileMin) {
      return `${colMin}px`;
    }
    const w = columnWidths[c.key] ?? (typeof c.width === "number" ? c.width : undefined);
    if (w !== undefined) return `${w}px`;
    if (typeof c.width === "string") return c.width;
    return undefined;
  };

  const hasCustomWidths =
    shouldApplyMobileMin ||
    Object.keys(columnWidths).length > 0 ||
    visibleColumns.some(
      (c) =>
        c.width !== undefined ||
        c.minWidth !== undefined ||
        c.maxWidth !== undefined
    );

  return (
    <div className="space-y-3">
      {(search || toolbar || (columnChooser !== false && toggleableColumns.length > 0)) && (
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
          <div className="flex flex-wrap items-center gap-2">
            {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
            {columnChooser !== false && toggleableColumns.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs font-medium"
                    aria-label="Customize visible columns"
                  >
                    <Columns3 className="size-3.5 text-muted-foreground" />
                    <span>Columns</span>
                    {hiddenKeys.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                        {toggleableColumns.length - hiddenKeys.length}/{toggleableColumns.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    <span>Toggle columns</span>
                    <span className="text-[10px] font-normal">
                      {toggleableColumns.length - hiddenKeys.length} of {toggleableColumns.length}
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="max-h-60 overflow-y-auto py-0.5">
                    {toggleableColumns.map((col) => {
                      const isVisible = !hiddenKeys.includes(col.key);
                      const currentVisibleCount = toggleableColumns.length - hiddenKeys.length;
                      const isLastVisible = isVisible && currentVisibleCount <= 1;
                      const colLabel =
                        col.title ||
                        (typeof col.header === "string"
                          ? col.header
                          : extractNodeText(col.header) || col.key);

                      return (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={isVisible}
                          onCheckedChange={() => toggleColumn(col.key)}
                          disabled={isLastVisible}
                          className="text-xs capitalize"
                        >
                          <span className="truncate">{colLabel}</span>
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between gap-1 p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={showAllColumns}
                      disabled={hiddenKeys.length === 0}
                      className="h-7 text-[11px] font-normal px-2"
                    >
                      Show all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetColumns}
                      className="h-7 text-[11px] font-normal px-2 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <div className={cn("rounded-lg border bg-card overflow-hidden", containerClassName)}>
        <div className={cn("overflow-x-auto", stickyHeader && "max-h-[600px] overflow-y-auto")}>
          <Table className={cn("w-full", hasCustomWidths && "table-fixed")}>
            <colgroup>
              {visibleColumns.map((c) => {
                const { minWidth: colMin, maxWidth: colMax } = getColumnConstraints(c, defaultMinWidth, defaultMaxWidth);
                const colW = getColWidth(c, colMin);
                return (
                  <col
                    key={c.key}
                    style={{
                      width: colW,
                      minWidth: colMin !== undefined ? `${colMin}px` : undefined,
                      maxWidth: colMax !== undefined ? `${colMax}px` : undefined,
                    }}
                  />
                );
              })}
            </colgroup>
            <TableHeader className={cn(stickyHeader && "sticky top-0 z-10")}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {visibleColumns.map((c) => {
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

                  const isColResizable =
                    resizable !== false &&
                    c.resizable !== false &&
                    c.key !== "select" &&
                    c.key !== "actions";

                  const isSorted = activeSort?.key === c.key;
                  const isAsc = activeSort?.direction === "asc";
                  const { minWidth: colMin, maxWidth: colMax } = getColumnConstraints(c, defaultMinWidth, defaultMaxWidth);
                  const colW = getColWidth(c, colMin);
                  const isResizingThis = resizingKey === c.key;

                  return (
                    <TableHead
                      key={c.key}
                      style={{
                        width: colW,
                        minWidth: colMin !== undefined ? `${colMin}px` : undefined,
                        maxWidth: colMax !== undefined ? `${colMax}px` : undefined,
                        ...c.style,
                      }}
                      aria-sort={
                        isSorted
                          ? isAsc
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "relative text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        density === "compact"
                          ? "h-8 px-2.5 py-1.5"
                          : density === "comfortable"
                          ? "h-12 px-4 py-3"
                          : "h-10 px-3 py-2",
                        isColSortable &&
                          "group cursor-pointer select-none hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        bordered && "border-r border-border/40 last:border-r-0",
                        stickyHeader && "bg-muted/90 backdrop-blur-sm",
                        c.headerClassName,
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
                          "inline-flex items-center gap-1.5 min-w-0 max-w-full",
                          c.className?.includes("text-right") && "w-full justify-end",
                          c.className?.includes("text-center") && "w-full justify-center"
                        )}
                      >
                        {c.key === "select" ? (
                          c.header
                        ) : (
                          <span
                            className="truncate min-w-0"
                            title={typeof c.header === "string" ? c.header : undefined}
                          >
                            {c.header}
                          </span>
                        )}
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

                      {isColResizable && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${typeof c.header === "string" ? c.header : c.key} column`}
                          className={cn(
                            "absolute -right-2 top-0 bottom-0 w-5 sm:right-0 sm:w-3 cursor-col-resize select-none touch-none z-10",
                            "flex items-center justify-center",
                            "group/resizer hover:after:bg-primary after:transition-colors",
                            "after:h-4 after:w-[2px] after:rounded-full after:bg-border/60",
                            isResizingThis && "after:bg-primary after:h-full after:w-[2px] bg-primary/10"
                          )}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const th = e.currentTarget.closest("th");
                            handleResizeStart(e.clientX, c.key, c, th);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            const now = Date.now();
                            if (
                              lastTapRef.current &&
                              lastTapRef.current.key === c.key &&
                              now - lastTapRef.current.time < 300
                            ) {
                              handleResizeReset(e, c.key, c);
                              lastTapRef.current = null;
                              return;
                            }
                            lastTapRef.current = { key: c.key, time: now };
                            if (e.touches && e.touches.length > 0) {
                              const th = e.currentTarget.closest("th");
                              handleResizeStart(e.touches[0].clientX, c.key, c, th);
                            }
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const th = e.currentTarget.closest("th");
                            handleResizeStart(e.clientX, c.key, c, th);
                          }}
                          onDoubleClick={(e) => handleResizeReset(e, c.key, c)}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {visibleColumns.map((c) => {
                      const { minWidth: colMin, maxWidth: colMax } = getColumnConstraints(c, defaultMinWidth, defaultMaxWidth);
                      const colW = getColWidth(c, colMin);
                      return (
                        <TableCell
                          key={c.key}
                          style={{
                            width: colW,
                            minWidth: colMin !== undefined ? `${colMin}px` : undefined,
                            maxWidth: colMax !== undefined ? `${colMax}px` : undefined,
                            ...c.style,
                          }}
                          className={cn(
                            density === "compact" ? "py-2 px-2.5" : density === "comfortable" ? "py-4 px-4" : "py-3 px-3",
                            bordered && "border-r border-border/40 last:border-r-0"
                          )}
                        >
                          <div className="h-4 w-full max-w-[12rem] animate-pulse rounded bg-muted" />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length}
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
                      striped && idx % 2 === 1 && "bg-muted/20 dark:bg-muted/10",
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/40 data-[state=selected]:bg-muted/60",
                      idx === activeIndex && "bg-primary/10 ring-1 ring-inset ring-primary/20",
                      rowClassName?.(row, idx)
                    )}
                  >
                    {visibleColumns.map((c) => {
                      const cellContent = c.cell(row);
                      const { minWidth: colMin, maxWidth: colMax } = getColumnConstraints(c, defaultMinWidth, defaultMaxWidth);
                      const colW = getColWidth(c, colMin);
                      const shouldTruncate =
                        truncate !== false &&
                        c.truncate !== false &&
                        c.key !== "select" &&
                        c.key !== "actions";
                      const cellTooltip = shouldTruncate ? extractNodeText(cellContent) : undefined;

                      return (
                        <TableCell
                          key={c.key}
                          style={{
                            width: colW,
                            minWidth: colMin !== undefined ? `${colMin}px` : undefined,
                            maxWidth: colMax !== undefined ? `${colMax}px` : undefined,
                            ...c.style,
                          }}
                          className={cn(
                            density === "compact"
                              ? "py-1.5 px-2.5 text-xs"
                              : density === "comfortable"
                              ? "py-4 px-4 text-sm"
                              : "py-3 px-3 text-sm",
                            bordered && "border-r border-border/40 last:border-r-0",
                            shouldTruncate && "max-w-0 overflow-hidden",
                            c.className
                          )}
                        >
                          {shouldTruncate ? (
                            <div
                              className={cn(
                                "truncate max-w-full [&_div]:truncate [&_span]:truncate [&_p]:truncate [&_a]:truncate",
                                c.className?.includes("text-right") && "text-right",
                                c.className?.includes("text-center") && "text-center"
                              )}
                              title={cellTooltip || undefined}
                            >
                              {cellContent}
                            </div>
                          ) : (
                            cellContent
                          )}
                        </TableCell>
                      );
                    })}
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
  allLabel = "All",
  showPlaceholderOnAll = false,
  disabled = false,
  className,
}: {
  value: T | "ALL";
  onChange: (v: T | "ALL") => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  allLabel?: string;
  showPlaceholderOnAll?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const isPlaceholder =
    value === "ALL" &&
    (showPlaceholderOnAll || !!(placeholder && placeholder.toLowerCase().startsWith("select")));

  return (
    <Select
      value={isPlaceholder ? "" : value}
      onValueChange={(v) => onChange((v || "ALL") as T | "ALL")}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn("h-8 w-[10rem] text-xs", className)}
        disabled={disabled}
      >
        <SelectValue placeholder={placeholder ?? "Filter"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL" className="text-xs">
          {allLabel}
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
