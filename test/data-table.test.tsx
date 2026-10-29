import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { DataTable, FilterSelect, type DataTableColumn } from "@/components/shared/data-table";
import { ReportTable } from "@/components/views/reports";

interface TestRow {
  id: string;
  name: string;
  description: string;
  actions?: string;
}

const testRows: TestRow[] = [
  {
    id: "1",
    name: "Alpha Broadband Connection With Very Long Name",
    description: "Fiber optic high speed internet line terminating at Building 4, Floor 2",
  },
  {
    id: "2",
    name: "Beta Backup Link",
    description: "4G LTE redundant failover connection",
  },
];

describe("DataTable text ellipsis overflow behavior", () => {
  it("applies truncation classes and title tooltips to standard cells by default", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "name",
        header: "Service Name",
        cell: (r) => r.name,
      },
      {
        key: "description",
        header: "Description",
        cell: (r) => r.description,
      },
    ];

    const { container } = render(
      <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
    );

    // Header has truncate and title
    const headerEl = screen.getByText("Service Name");
    expect(headerEl.className).toContain("truncate");
    expect(headerEl.getAttribute("title")).toBe("Service Name");

    // TableCell has max-w-0 and overflow-hidden
    const cellTds = container.querySelectorAll("tbody tr td");
    expect(cellTds.length).toBeGreaterThan(0);
    expect(cellTds[0].className).toContain("max-w-0");
    expect(cellTds[0].className).toContain("overflow-hidden");

    // Inner wrapper has truncate and title matching content
    const cellWrapper = cellTds[0].querySelector("div.truncate");
    expect(cellWrapper).not.toBeNull();
    expect(cellWrapper?.getAttribute("title")).toBe(
      "Alpha Broadband Connection With Very Long Name"
    );
  });

it("excludes action and selection columns from truncation", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "select",
        header: <input type="checkbox" aria-label="Select All" />,
        cell: () => <input type="checkbox" aria-label="Select Row" />,
      },
      {
        key: "name",
        header: "Name",
        cell: (r) => r.name,
      },
      {
        key: "actions",
        header: "Actions",
        cell: () => <button type="button">Edit</button>,
      },
    ];

    const { container } = render(
      <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
    );

    const firstRowTds = container.querySelectorAll("tbody tr:first-child td");
    expect(firstRowTds.length).toBe(3);

    // Select column (index 0) - NOT truncated
    expect(firstRowTds[0].className).not.toContain("max-w-0");
    expect(firstRowTds[0].querySelector("div.truncate")).toBeNull();

    // Name column (index 1) - truncated
    expect(firstRowTds[1].className).toContain("max-w-0");
    expect(firstRowTds[1].querySelector("div.truncate")).not.toBeNull();

    // Actions column (index 2) - NOT truncated
    expect(firstRowTds[2].className).not.toContain("max-w-0");
    expect(firstRowTds[2].querySelector("div.truncate")).toBeNull();
  });

  it("allows individual columns to opt-out of truncation with truncate: false", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "name",
        header: "Name",
        cell: (r) => r.name,
        truncate: false,
      },
      {
        key: "description",
        header: "Description",
        cell: (r) => r.description,
      },
    ];

    const { container } = render(
      <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
    );

    const firstRowTds = container.querySelectorAll("tbody tr:first-child td");
    // Name column opted out
    expect(firstRowTds[0].className).not.toContain("max-w-0");
    expect(firstRowTds[0].querySelector("div.truncate")).toBeNull();

    // Description column truncated
    expect(firstRowTds[1].className).toContain("max-w-0");
    expect(firstRowTds[1].querySelector("div.truncate")).not.toBeNull();
  });

  it("allows table-level opt-out with truncate={false}", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "name",
        header: "Name",
        cell: (r) => r.name,
      },
      {
        key: "description",
        header: "Description",
        cell: (r) => r.description,
      },
    ];

    const { container } = render(
      <DataTable
        columns={columns}
        rows={testRows}
        rowKey={(r) => r.id}
        truncate={false}
      />
    );

    const allTds = container.querySelectorAll("tbody tr td");
    for (const td of Array.from(allTds)) {
      expect(td.className).not.toContain("max-w-0");
      expect(td.querySelector("div.truncate")).toBeNull();
    }
  });

  it("extracts text recursively from nested React elements for hover tooltips", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "name",
        header: "Complex",
        cell: (r) => (
          <div>
            <span className="font-semibold">{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.description}</span>
          </div>
        ),
      },
    ];

    const { container } = render(
      <DataTable columns={columns} rows={[testRows[0]]} rowKey={(r) => r.id} />
    );

    const cellWrapper = container.querySelector("tbody tr:first-child td div.truncate");
    expect(cellWrapper).not.toBeNull();
    expect(cellWrapper?.getAttribute("title")).toBe(
      "Alpha Broadband Connection With Very Long Name Fiber optic high speed internet line terminating at Building 4, Floor 2"
    );
  });
});

describe("DataTable Column Chooser & LocalStorage Cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the Columns button in the toolbar by default", () => {
    const columns: DataTableColumn<TestRow>[] = [
      { key: "name", header: "Service Name", cell: (r) => r.name },
      { key: "description", header: "Description", cell: (r) => r.description },
    ];

    render(<DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />);

    const columnsBtn = screen.getByRole("button", { name: /customize visible columns/i });
    expect(columnsBtn).toBeInTheDocument();
    expect(columnsBtn.textContent).toContain("Columns");
  });

  it("omits the Columns button when columnChooser={false}", () => {
    const columns: DataTableColumn<TestRow>[] = [
      { key: "name", header: "Service Name", cell: (r) => r.name },
      { key: "description", header: "Description", cell: (r) => r.description },
    ];

    render(
      <DataTable
        columns={columns}
        rows={testRows}
        rowKey={(r) => r.id}
        columnChooser={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: /customize visible columns/i })
    ).not.toBeInTheDocument();
  });

  it("hydrates column visibility choices from localStorage cache", async () => {
    const storageKey = "test_services_table";
    // Pre-cache 'description' column as hidden in localStorage
    localStorage.setItem(
      `netrent_tbl_cols_${storageKey}`,
      JSON.stringify(["description"])
    );

    const columns: DataTableColumn<TestRow>[] = [
      { key: "name", header: "Service Name", cell: (r) => r.name },
      { key: "description", header: "Description", cell: (r) => r.description },
    ];

    const { rerender } = render(
      <DataTable
        storageKey={storageKey}
        columns={columns}
        rows={testRows}
        rowKey={(r) => r.id}
      />
    );

    // Wait for effect hydration
    expect(screen.getByText("Service Name")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("hydrates column widths from localStorage cache", () => {
    const storageKey = "test_widths_table";
    // Pre-cache width of 'name' column as 320px
    localStorage.setItem(
      `netrent_tbl_widths_${storageKey}`,
      JSON.stringify({ name: 320 })
    );

    const columns: DataTableColumn<TestRow>[] = [
      { key: "name", header: "Service Name", cell: (r) => r.name },
      { key: "description", header: "Description", cell: (r) => r.description },
    ];

    const { container } = render(
      <DataTable
        storageKey={storageKey}
        columns={columns}
        rows={testRows}
        rowKey={(r) => r.id}
      />
    );

    const nameCol = container.querySelector("colgroup col:first-child");
    expect(nameCol?.getAttribute("style")).toContain("320px");
  });

  it("respects defaultHidden: true on column definitions", () => {
    const columns: DataTableColumn<TestRow>[] = [
      { key: "name", header: "Service Name", cell: (r) => r.name },
      {
        key: "description",
        header: "Description",
        cell: (r) => r.description,
        defaultHidden: true,
      },
    ];

    render(<DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />);

    expect(screen.getByText("Service Name")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("never allows hiding select or actions columns", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "select",
        header: <input type="checkbox" aria-label="Select All" />,
        cell: () => <input type="checkbox" aria-label="Select Row" />,
      },
      { key: "name", header: "Service Name", cell: (r) => r.name },
      { key: "actions", header: "Actions", cell: () => <button type="button">Edit</button> },
    ];

    // Try to inject hidden state for 'select' and 'actions' in localStorage
    localStorage.setItem(
      `netrent_tbl_cols_test_mand`,
      JSON.stringify(["select", "actions", "name"])
    );

    const { container } = render(
      <DataTable
        storageKey="test_mand"
        columns={columns}
        rows={testRows}
        rowKey={(r) => r.id}
      />
    );

    // select and actions must ALWAYS be visible regardless of cache
    const checkEl = screen.getByRole("checkbox", { name: "Select All" });
    expect(checkEl).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});

describe("DataTable Min/Max Column Sizing", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("applies minWidth and maxWidth correctly to col, th, and td", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "name",
        header: "Name",
        cell: (r) => r.name,
        width: 200,
        minWidth: 150,
        maxWidth: 300,
      },
      {
        key: "description",
        header: "Description",
        cell: (r) => r.description,
        minWidth: 120,
        maxWidth: 400,
      },
    ];

    const { container } = render(
      <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
    );

    const cols = container.querySelectorAll("colgroup col");
    expect(cols[0].getAttribute("style")).toContain("min-width: 150px");
    expect(cols[0].getAttribute("style")).toContain("max-width: 300px");
    expect(cols[0].getAttribute("style")).toContain("width: 200px");

    expect(cols[1].getAttribute("style")).toContain("min-width: 120px");
    expect(cols[1].getAttribute("style")).toContain("max-width: 400px");

    const ths = container.querySelectorAll("thead th");
    expect(ths[0].getAttribute("style")).toContain("min-width: 150px");
    expect(ths[0].getAttribute("style")).toContain("max-width: 300px");
    expect(ths[0].getAttribute("style")).toContain("width: 200px");

    const firstRowTds = container.querySelectorAll("tbody tr:first-child td");
    expect(firstRowTds[0].getAttribute("style")).toContain("min-width: 150px");
    expect(firstRowTds[0].getAttribute("style")).toContain("max-width: 300px");
    expect(firstRowTds[0].getAttribute("style")).toContain("width: 200px");
  });

  it("applies default minWidth and maxWidth fallbacks when not specified", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "select",
        header: "Select",
        cell: () => null,
      },
      {
        key: "name",
        header: "Name",
        cell: (r) => r.name,
      },
      {
        key: "actions",
        header: "Actions",
        cell: () => null,
      },
    ];

    const { container } = render(
      <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
    );

    const cols = container.querySelectorAll("colgroup col");
    // select column
    expect(cols[0].getAttribute("style")).toContain("min-width: 40px");
    expect(cols[0].getAttribute("style")).toContain("max-width: 60px");

    // standard name column
    expect(cols[1].getAttribute("style")).toContain("min-width: 60px");
    expect(cols[1].getAttribute("style")).toContain("max-width: 1000px");

    // actions column
    expect(cols[2].getAttribute("style")).toContain("min-width: 70px");
    expect(cols[2].getAttribute("style")).toContain("max-width: 130px");
  });

  it("respects custom defaultMinWidth and defaultMaxWidth props", () => {
    const columns: DataTableColumn<TestRow>[] = [
      {
        key: "name",
        header: "Name",
        cell: (r) => r.name,
      },
    ];

    const { container } = render(
      <DataTable
        columns={columns}
        rows={testRows}
        rowKey={(r) => r.id}
        defaultMinWidth={95}
        defaultMaxWidth={550}
      />
    );

    const col = container.querySelector("colgroup col");
    expect(col?.getAttribute("style")).toContain("min-width: 95px");
    expect(col?.getAttribute("style")).toContain("max-width: 550px");

    const th = container.querySelector("thead th");
    expect(th?.getAttribute("style")).toContain("min-width: 95px");
    expect(th?.getAttribute("style")).toContain("max-width: 550px");

    const td = container.querySelector("tbody tr:first-child td");
    expect(td?.getAttribute("style")).toContain("min-width: 95px");
    expect(td?.getAttribute("style")).toContain("max-width: 550px");
  });

  it("sets column width to minWidth on mobile screen size (< 768px)", () => {
    const originalWidth = window.innerWidth;
    try {
      window.innerWidth = 500;

      const columns: DataTableColumn<TestRow>[] = [
        {
          key: "name",
          header: "Name",
          cell: (r) => r.name,
          width: 300,
          minWidth: 140,
          maxWidth: 450,
        },
      ];

      const { container } = render(
        <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
      );

      const col = container.querySelector("colgroup col");
      // On mobile screen size, width is set to minWidth (140px) instead of normal width (300px)
      expect(col?.getAttribute("style")).toContain("width: 140px");

      const th = container.querySelector("thead th");
      expect(th?.getAttribute("style")).toContain("width: 140px");

      const td = container.querySelector("tbody tr:first-child td");
      expect(td?.getAttribute("style")).toContain("width: 140px");
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it("can opt out of mobile minWidth with useMinWidthOnMobile={false}", () => {
    const originalWidth = window.innerWidth;
    try {
      window.innerWidth = 500;

      const columns: DataTableColumn<TestRow>[] = [
        {
          key: "name",
          header: "Name",
          cell: (r) => r.name,
          width: 300,
          minWidth: 140,
          maxWidth: 450,
        },
      ];

      const { container } = render(
        <DataTable
          columns={columns}
          rows={testRows}
          rowKey={(r) => r.id}
          useMinWidthOnMobile={false}
        />
      );

      const col = container.querySelector("colgroup col");
      expect(col?.getAttribute("style")).toContain("width: 300px");
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it("renders resize separators on mobile screens", () => {
    const originalWidth = window.innerWidth;
    try {
      window.innerWidth = 480;
      const columns: DataTableColumn<TestRow>[] = [
        { key: "name", header: "Name", cell: (r) => r.name, minWidth: 100 },
        { key: "description", header: "Description", cell: (r) => r.description, minWidth: 120 },
      ];
      render(<DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />);

      const resizers = screen.getAllByRole("separator");
      expect(resizers.length).toBe(2);
      expect(resizers[0]).toHaveAttribute("aria-label", "Resize Name column");
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it("resizes columns on mobile using touch events", () => {
    const originalWidth = window.innerWidth;
    const onResize = vi.fn();
    try {
      window.innerWidth = 480;
      const columns: DataTableColumn<TestRow>[] = [
        { key: "name", header: "Name", cell: (r) => r.name, width: 200, minWidth: 100, maxWidth: 500 },
      ];
      const { container } = render(
        <DataTable
          columns={columns}
          rows={testRows}
          rowKey={(r) => r.id}
          onColumnResize={onResize}
        />
      );

      const resizer = screen.getByRole("separator");
      const th = resizer.closest("th");
      if (th) {
        vi.spyOn(th, "getBoundingClientRect").mockReturnValue({
          width: 100,
          left: 0,
          right: 100,
          top: 0,
          bottom: 40,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => {},
        });
      }

      // Initial rendered width is minWidth (100px) on mobile
      const col = container.querySelector("colgroup col");
      expect(col?.getAttribute("style")).toContain("width: 100px");

      // Touch start at clientX = 100
      fireEvent.touchStart(resizer, {
        touches: [{ clientX: 100 }],
      });

      // Drag to clientX = 160 (+60px)
      fireEvent.touchMove(window, {
        touches: [{ clientX: 160 }],
      });

      // Col width should now be 160px
      expect(col?.getAttribute("style")).toContain("width: 160px");
      expect(onResize).toHaveBeenCalledWith("name", 160);

      // Touch end
      fireEvent.touchEnd(window);
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it("resizes columns using pointer events on touch-enabled devices", () => {
    const originalWidth = window.innerWidth;
    const onResize = vi.fn();
    try {
      window.innerWidth = 500;
      const columns: DataTableColumn<TestRow>[] = [
        { key: "name", header: "Name", cell: (r) => r.name, width: 220, minWidth: 120, maxWidth: 600 },
      ];
      const { container } = render(
        <DataTable
          columns={columns}
          rows={testRows}
          rowKey={(r) => r.id}
          onColumnResize={onResize}
        />
      );

      const resizer = screen.getByRole("separator");
      const th = resizer.closest("th");
      if (th) {
        vi.spyOn(th, "getBoundingClientRect").mockReturnValue({
          width: 120,
          left: 0,
          right: 120,
          top: 0,
          bottom: 40,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => {},
        });
      }

      // Initial rendered width
      const col = container.querySelector("colgroup col");
      expect(col?.getAttribute("style")).toContain("width: 120px");

      // Pointer down at clientX = 120
      fireEvent.pointerDown(resizer, { clientX: 120 });

      // Pointer move to clientX = 200 (+80px)
      fireEvent.pointerMove(window, { clientX: 200 });

      expect(col?.getAttribute("style")).toContain("width: 200px");
      expect(onResize).toHaveBeenCalledWith("name", 200);

      fireEvent.pointerUp(window);
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it("resets resized column on mobile via double-tap / double-click", () => {
    const originalWidth = window.innerWidth;
    try {
      window.innerWidth = 480;
      const columns: DataTableColumn<TestRow>[] = [
        { key: "name", header: "Name", cell: (r) => r.name, width: 220, minWidth: 100, maxWidth: 500 },
      ];
      const { container } = render(
        <DataTable columns={columns} rows={testRows} rowKey={(r) => r.id} />
      );

      const resizer = screen.getByRole("separator");
      const th = resizer.closest("th");
      if (th) {
        vi.spyOn(th, "getBoundingClientRect").mockReturnValue({
          width: 100,
          left: 0,
          right: 100,
          top: 0,
          bottom: 40,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => {},
        });
      }

      const col = container.querySelector("colgroup col");
      // Initial is minWidth 100px
      expect(col?.getAttribute("style")).toContain("width: 100px");

      // Resize column to 180px
      fireEvent.touchStart(resizer, { touches: [{ clientX: 100 }] });
      fireEvent.touchMove(window, { touches: [{ clientX: 180 }] });
      fireEvent.touchEnd(window);
      expect(col?.getAttribute("style")).toContain("width: 180px");

      // Double-click/double-tap to reset
      fireEvent.doubleClick(resizer);

      // On mobile without user resize, it returns to minWidth
      expect(col?.getAttribute("style")).toContain("width: 100px");
    } finally {
      window.innerWidth = originalWidth;
    }
  });
});

describe("ReportTable component & Column Chooser", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders ReportTable with columns button and rows without syntax or runtime error", () => {
    render(
      <ReportTable
        headers={["Provider", "Plan", "Bandwidth", "Monthly Fee"]}
        rows={[
          ["Indosat Ooredoo", "Business Fiber 100", "100 Mbps", "$250.00"],
          ["Telkomsel", "Orbit Pro", "50 Mbps", "$120.00"],
        ]}
        empty="No report data"
      />
    );

    expect(screen.getByText("Provider")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Indosat Ooredoo")).toBeInTheDocument();
    expect(screen.getByText("Orbit Pro")).toBeInTheDocument();

    const colBtn = screen.getByRole("button", { name: /customize visible columns/i });
    expect(colBtn).toBeInTheDocument();
  });

    it("sorts rows accurately using data-sort-value for numbers and dates", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { container } = render(
      <ReportTable
        headers={["Contract", "Days Left", "End Date"]}
        rows={[
          [
            "CTR-002",
            <span key="1" data-sort-value={14}>14d</span>,
            <span key="1d" data-sort-value="2026-11-20">Nov 20, 2026</span>,
          ],
          [
            "CTR-001",
            <span key="2" data-sort-value={-3}>-3d</span>,
            <span key="2d" data-sort-value="2026-10-15">Oct 15, 2026</span>,
          ],
          [
            "CTR-003",
            <span key="3" data-sort-value={5}>5d</span>,
            <span key="3d" data-sort-value="2026-11-01">Nov 1, 2026</span>,
          ],
        ]}
        empty="No data"
      />
    );

    // Initial order: CTR-002, CTR-001, CTR-003
    let rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("CTR-002");
    expect(rows[1].textContent).toContain("CTR-001");
    expect(rows[2].textContent).toContain("CTR-003");

    // Click "Days Left" column header (index 1) to sort ascending
    const daysLeftHeader = screen.getByText("Days Left");
    fireEvent.click(daysLeftHeader);

    // Ascending numerical sort: -3d (CTR-001), 5d (CTR-003), 14d (CTR-002)
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("CTR-001");
    expect(rows[1].textContent).toContain("CTR-003");
    expect(rows[2].textContent).toContain("CTR-002");

    // Click "End Date" column header (index 2) to sort ascending
    const endDateHeader = screen.getByText("End Date");
    fireEvent.click(endDateHeader);

    // Ascending date sort: Oct 15, 2026 (CTR-001), Nov 1, 2026 (CTR-003), Nov 20, 2026 (CTR-002)
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("CTR-001");
    expect(rows[1].textContent).toContain("CTR-003");
    expect(rows[2].textContent).toContain("CTR-002");
  });

  it("calls onRowClick when a row is clicked and adds cursor-pointer class", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const handleRowClick = vi.fn();
    const { container } = render(
      <ReportTable
        headers={["Contract", "Branch"]}
        rows={[
          ["CTR-001", "HQ"],
          ["CTR-002", "Branch A"],
        ]}
        empty="No data"
        onRowClick={handleRowClick}
      />
    );

    const firstRow = container.querySelector("tbody tr:first-child");
    expect(firstRow?.className).toContain("cursor-pointer");
    fireEvent.click(firstRow);
    expect(handleRowClick).toHaveBeenCalledTimes(1);
  });

  it("supports dashboard_renewals storageKey and exports from data-table and report-table", async () => {
    const { ReportTable: ReportTableFromDataTable } = await import("@/components/shared/data-table");
    expect(ReportTableFromDataTable).toBeDefined();

    localStorage.setItem(
      "netrent_reptbl_cols_dashboard_renewals",
      JSON.stringify([1]) // hide index 1 (Branch)
    );

    render(
      <ReportTable
        storageKey="dashboard_renewals"
        headers={["Contract", "Branch", "End date", "Days left", "Monthly", "Status"]}
        rows={[
          ["CTR-101", "Downtown Branch", "Nov 1, 2026", "10d", "$500", "ACTIVE"],
        ]}
        empty="No data"
      />
    );

    expect(screen.getByText("Contract")).toBeInTheDocument();
    expect(screen.queryByText("Downtown Branch")).not.toBeInTheDocument();
    expect(screen.getByText("End date")).toBeInTheDocument();
  });
});

describe("FilterSelect placeholder and value transitions", () => {
  it("renders placeholder when value is ALL, updates to active value, and returns to ALL without React 19 createPortal error", () => {
    function TestFilterWrapper() {
      const [status, setStatus] = React.useState<string>("ALL");
      return (
        <div>
          <button type="button" onClick={() => setStatus("ACTIVE")}>
            Set Active
          </button>
          <button type="button" onClick={() => setStatus("ALL")}>
            Set All
          </button>
          <FilterSelect
            value={status as any}
            onChange={(v) => setStatus(v as string)}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            placeholder="Select Status"
            showPlaceholderOnAll
            allLabel="All statuses"
          />
        </div>
      );
    }

    render(<TestFilterWrapper />);

    // Initially displays placeholder
    expect(screen.getByText("Select Status")).toBeInTheDocument();

    // Select Active
    fireEvent.click(screen.getByText("Set Active"));
    expect(screen.getByText("Active")).toBeInTheDocument();

    // Select All again - must not throw console error or crash
    fireEvent.click(screen.getByText("Set All"));
    expect(screen.getByText("Select Status")).toBeInTheDocument();
  });

  it("disables select trigger when disabled is true", () => {
    render(
      <FilterSelect
        value="ALL"
        onChange={() => {}}
        options={[{ value: "ACTIVE", label: "Active" }]}
        placeholder="Select Status"
        disabled={true}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
  });
});


