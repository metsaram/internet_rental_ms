# NetRent — Developer Guide

## Local Development Workflow

### Prerequisites
- Node.js 18+ or Bun
- Supabase Project or local SQLite database

### Quick Start
```bash
# 1. Install dependencies
bun install

# 2. Environment Configuration
cp .env.example .env
# Configure DATABASE_URL, DIRECT_URL, and NEXTAUTH_SECRET in .env

# 3. Generate Prisma Client & Migrate
bun run db:generate
bun run db:deploy

# 4. Seed database with demo accounts
bun run db:seed

# 5. Launch development server
bun run dev
```

### Key NPM/Bun Scripts
| Script | Command | Purpose |
|---|---|---|
| Dev Server | `bun run dev` | Runs Next.js with Turbopack on port 3000 |
| Lint | `bun run lint` | Runs ESLint checks |
| Test (Interactive) | `bun run test` | Runs Vitest in interactive watch mode |
| Test (Single Run) | `bun run test:run` | Runs all unit/component test suites once |
| Test (Coverage) | `bun run test:coverage` | Runs tests and generates V8 code coverage report |
| E2E Tests | `bun run test:e2e` | Runs all Playwright E2E tests headless |
| E2E UI Mode | `bun run test:e2e:ui` | Interactive Playwright test runner UI |
| E2E Headed | `bun run test:e2e:headed` | Runs tests in a visible browser window |
| E2E Debug | `bun run test:e2e:debug` | Runs tests in Playwright Inspector debug mode |
| E2E Report | `bun run test:e2e:report` | Serves HTML test report with traces & screenshots |
| DB Push | `bun run db:push` | Pushes Prisma schema directly to DB |
| DB Migrate | `bun run db:migrate` | Runs development migrations |
| DB Deploy | `bun run db:deploy` | Applies checked-in production migrations |
| DB Seed | `bun run db:seed` | Populates demo data (idempotent) |
| DB Generate | `bun run db:generate` | Rebuilds Prisma client types |

### Coding Patterns & Conventions

#### 1. Hash-Based Navigation
All views are rendered in `src/app/page.tsx` based on `window.location.hash`.
When navigating programmatically, use:
```typescript
window.location.assign('#' + targetView);
```
Avoid assigning to `window.location.hash` directly to comply with React hook immutability rules.

#### 2. Client-Side Data Fetching
Views use TanStack Query with our typed fetch wrapper `@/lib/api-client`:
```typescript
const { data, isLoading } = useQuery<Service[]>({
  queryKey: ["services"],
  queryFn: () => api<Service[]>("/api/services"),
});
```

#### 3. Forms & Dialogs
Use `FormDialog` and `Field` from `@/components/shared/form-dialog`.
Always supply `value="none"` for optional relations in dropdowns:
```typescript
<Select value={field.value ?? "none"} onValueChange={(val) => field.onChange(val === "none" ? null : val)}>
```

#### 4. Formatting Money & Dates
Always import from `@/lib/format`:
```typescript
import { formatMoney, formatDate } from "@/lib/format";
```
Never import `@prisma/client` inside client component files.

#### 5. Global Input Validator (Code Fields Only)
The centralized Global Validator (`@/lib/global-validator` or `@/lib/validation`) enforces uppercase conversion and special character prevention **specifically on text fields used for codes**:
- **Rule (Code Fields)**:
  1. Converts code inputs to **UPPERCASE**.
  2. Blocks all special characters by default.
  3. Allows only `_` (underscore) and `-` (hyphen) as exceptions.
  4. Enforces a **maximum length of 100 characters**.
- **Non-Code Fields**: General text inputs (`name`, `address`, `city`, `manager`, `phone`, `notes`, `description`, etc.) accept standard casing, spaces, and punctuation without restriction.
- **Code Field Identification**: Recognizes `code`, `serviceCode`, `branchCode`, `shopCode`, `providerCode`, `companyCode`, `contractNumber`, `invoiceNumber`, `reference`, `customerId`, `ispServiceId`, `accountId`, or inputs marked with `isCode`.
- **UI Layer**: `<Input isCode />` in `@/components/ui/input` enforces `maxLength={100}`, converts code inputs to uppercase, blocks disallowed keystrokes on typing, sanitizes on paste/change, and adds uppercase typography. Regular `<Input />` operates as a standard text input.
- **API Layer**: `parseJsonBody()` in `@/lib/session` normalizes and validates code fields in incoming payloads, rejecting code exceeding 100 characters or containing disallowed special characters with 400 `ValidationError`, while preserving non-code fields.
- **Database Layer**: Prisma Client extension in `@/lib/db` intercepts `create`, `update`, `upsert`, `createMany`, and `updateMany` queries to sanitize, truncate to 100 chars, and uppercase code fields prior to persistence.
- **Import Layer**: `coerceValue()` in `@/lib/import-fields` enforces uppercase, 100-character max length, and validation on spreadsheet cells matching code fields.

#### 6. Mandatory Component Test Verification
Every newly added UI, view, or shared component **MUST** be accompanied by a dedicated test file to guarantee correctness and prevent regressions.

- **Test Framework**: Vitest with `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event`.
- **Test File Location**: Either co-located adjacent to the component (`[component-name].test.tsx`) or inside `test/` (`test/[component-name].test.tsx`).
- **Required Verification**:
  1. **Rendering**: Component mounts cleanly into JSDOM without runtime errors or uncaught exceptions.
  2. **Props & States**: Prop variations, loading/empty states, and conditional UI branches render as expected.
  3. **User Events**: Clicks, typing, form submissions, and dialog triggers fire their intended callbacks (use `userEvent.setup()`).
  4. **Accessibility & Assertions**: Use `@testing-library/jest-dom` assertions such as `.toBeInTheDocument()`, `.toHaveAttribute()`, `.toHaveTextContent()`, and accessible queries like `screen.getByRole()`.
- **Example Component Test Template**:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { MyComponent } from '@/components/shared/my-component';

  describe('MyComponent', () => {
    it('renders with default props and handles interaction', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<MyComponent label="Submit" onClick={handleClick} />);

      const button = screen.getByRole('button', { name: /submit/i });
      expect(button).toBeInTheDocument();

      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
  ```
- **Validation**: Run `bun run test:run` locally before submitting any pull request or finishing any task.

#### 7. Playwright E2E Testing Workflow
Production end-to-end tests are located in `tests/` and cover critical paths:
- **Test Suites**:
  - `tests/smoke/`: API health endpoint, 404 page, brand layout, and shell navigation.
  - `tests/auth/`: Login form validation, error states, session persistence, and logout.
  - `tests/dashboard/`: KPI cards, status metrics, charts, and data refreshes.
  - `tests/tenants/`: Branch/Tenant CRUD operations with code validation.
  - `tests/invoices/`: Invoice creation, automated calculations (Subtotal + Tax - Discount), and history inspection.
  - `tests/payments/`: Payment rules validation and recording with balance recalculation.
  - `tests/visual/`: Visual regression screenshot testing (`toHaveScreenshot()`).
- **Best Practices**:
  - **Preferred Selectors**: Use `page.getByRole(...)`, `page.getByLabel(...)`, and `page.getByText(...)`. Avoid fragile CSS classes.
  - **Navigation**: Always specify `{ waitUntil: 'domcontentloaded' }` on `page.goto()`.
  - **Form Accessibility**: Ensure dialog fields have explicit `htmlFor` and matching child input `id` attributes.
  - **Updating Visual Baselines**:
    ```bash
    bun run test:e2e -- --update-snapshots
    ```
  - **Debugging Tests**:
    ```bash
    bun run test:e2e:ui      # Interactive UI mode
    bun run test:e2e:debug   # Step-by-step inspector
    bun run test:e2e:report  # Open HTML test report
    ```

#### 8. Shared DataTable & ReportTable Features (Sorting, Resizing & Styling)
The project provides centralized, high-performance table components (`DataTable` in `@/components/shared/data-table` and `ReportTable` in `@/components/views/reports`):

- **Column Sorting**:
  - Click or press `Enter`/`Space` on any sortable header to cycle: Ascending (`ArrowUp`) → Descending (`ArrowDown`) → Default/Unsorted.
  - Automatically compares numbers, currency (e.g. `$1,200`), dates (ISO/formatted), and strings (with natural ordering, e.g. "Branch 2" before "Branch 10").
  - Set initial sort via `defaultSort={{ key: "dueDate", direction: "desc" }}` (or `columnIndex` for `ReportTable`).
  - Customize sort value extraction with `sortValue: (row) => unknown` or `sortKey: "branch.name"`.
  - Non-sortable columns (e.g. checkboxes or actions) can specify `sortable: false`.

- **Interactive Column Resizing**:
  - Drag the vertical resizer handle on the right edge of any column header to resize.
  - Resize handles do not trigger sorting when clicked or dragged (`stopPropagation`).
  - Double-click the resize handle to reset the column to its original width.
  - Set default or minimum widths using `width={180}`, `minWidth={80}`, and `maxWidth={600}` on `DataTableColumn`.
  - Opt-out individual columns via `resizable: false` (automatically disabled for selection and action columns).
  - Listen to width changes via `onColumnResize={(key, width) => ...}`.

- **Table Styling & Density Options**:
  - `striped={true}`: Alternating zebra-striped rows (`bg-muted/20 dark:bg-muted/10`).
  - `density="compact" | "normal" | "comfortable"`: Adjusts cell and header padding (`compact` uses `py-1.5 px-2.5 text-xs`).
  - `bordered={true}`: Renders vertical cell dividers (`border-r`) for a spreadsheet/grid view.
  - `stickyHeader={true}`: Keeps the table header fixed at the top during vertical scrolling.
  - `rowClassName={(row, index) => ...}`: Applies custom CSS classes to individual rows based on row data.

- **Column Chooser & LocalStorage Cache**:
  - Interactive "Columns" dropdown menu in the toolbar for toggling column visibility (`columnChooser={true}` by default).
  - Persists visibility choices in `localStorage` under `netrent_tbl_cols_${storageKey || autoKey}` so customized views survive page reloads and browser sessions.
  - Persists resized column widths in `localStorage` under `netrent_tbl_widths_${storageKey || autoKey}`.
  - Safe SSR hydration: prevents hydration mismatch by synchronizing state after initial client mount with graceful error handling.
  - Automatic column protection: selection checkboxes (`key: "select"`) and action columns (`key: "actions"`) are never hidden.
  - Column-level controls: `hideable?: boolean` (defaults to true), `defaultHidden?: boolean` (starts hidden by default), and friendly `title?: string`.
  - Built-in toolbar counter badge (`X/Y`), "Show all", and "Reset" (clears local cache and restores original widths and visibility).

- **Responsive Mobile Column Sizing**:
  - Automatically switches column sizes to `minWidth` on mobile viewports (< 768px via `useIsMobile()`) to prevent horizontal compression and text clipping.
  - Standardized proportional `width`, `minWidth`, and `maxWidth` across all table view columns.
  - Deprecated `hideOnMobile` is removed in favor of native Column Chooser control.

```tsx
<DataTable
  storageKey="invoices-table"
  columns={columns}
  rows={data}
  rowKey={(row) => row.id}
  defaultSort={{ key: "invoiceNumber", direction: "desc" }}
  columnChooser={true}
  persistColumnVisibility={true}
  persistColumnWidths={true}
  resizable={true}
  truncate={true}
  striped={true}
  density="compact"
  bordered={true}
/>
```

#### 9. Reusable ActionMenu Component for Data Tables
The `ActionMenu` component (`@/components/shared/action-menu` or re-exported from `@/components/shared/data-table`) standardizes row actions across all data tables:

- **Responsive Breakpoint Behavior**:
  | Action Count | Desktop / Tablet (≥ 768px) | Mobile (< 768px) |
  |---|---|---|
  | **1–2 actions** | All visible buttons | All visible buttons |
  | **3 actions** | All 3 visible buttons | Primary visible; remainder in 3-dot menu |
  | **4–6 actions** | Top 1–3 highest-priority buttons (default: 2); remainder in 3-dot menu | Primary visible; remainder in 3-dot menu |
  | **7+ actions** | 3-dot menu organized into logical sections (`General`, `Management`, `Danger Zone`) | 3-dot menu organized into logical sections |

- **Action Prioritization & Overrides**:
  - `priority?: number`: Lower numbers take precedence for visible button slots (`priority: 1` before `priority: 2`).
  - `isPrimary?: boolean`: Explicitly boosts action priority for visible mobile/desktop display.
  - `display?: "auto" | "visible" | "menu"`: Explicit placement override per action.

- **Theme-Adaptive Reduced Background Colors**:
  - `buttonStyle?: "subtle" | "ghost"` (defaults to `"subtle"`):
    - **`subtle`**: Renders primary actions with `bg-primary/10 text-primary hover:bg-primary/20` and destructive actions with `bg-destructive/10 text-destructive hover:bg-destructive/20`. Avoids heavy 100% solid filled blocks in table rows.
    - **`ghost`**: Renders actions with a transparent background and hover-only theme tint.
  - Native `subtle` and `destructive-subtle` variants in `Button` (`@/components/ui/button`).
  - 100% CSS variable compatibility (`--primary`, `--destructive`, `--accent`, `--muted`) across light, dark, and custom color themes without hardcoded color classes.

- **Destructive Confirmation Interception**:
  - Set `confirmation={true}` or pass custom `ActionConfirmationConfig` (`title`, `description`, `confirmText`, `destructive`).
  - Automatically intercepts execution and renders a `ConfirmDialog` before invoking `onClick`, eliminating parent modal state boilerplate.

- **Row Click Isolation & Tooltips**:
  - Actions automatically call `e.stopPropagation()` (unless `stopPropagation={false}`) to prevent triggering row click handlers like `onRowClick`.
  - Visible icon buttons render accessible tooltips displaying action labels or `disabledReason`.

```tsx
import { ActionMenu } from "@/components/shared/data-table";
import { Eye, Pencil, Trash2 } from "lucide-react";

// In column definition:
{
  key: "actions",
  header: "",
  className: "text-right",
  width: 100,
  minWidth: 80,
  maxWidth: 120,
  resizable: false,
  cell: (record) => (
    <ActionMenu
      actions={[
        {
          id: "view",
          label: "View details",
          icon: <Eye className="size-4" />,
          isPrimary: true,
          priority: 1,
          onClick: () => viewRecord(record),
        },
        {
          id: "edit",
          label: "Edit record",
          icon: <Pencil className="size-4" />,
          priority: 2,
          onClick: () => editRecord(record),
        },
        {
          id: "delete",
          label: "Delete record",
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          priority: 3,
          confirmation: true,
          onClick: () => deleteRecord(record.id),
        },
      ]}
    />
  ),
}
```

#### 10. Master Entity Display Standard (Name First, Code Second)
All views and shared components in NetRent adhere to a unified display hierarchy for master entities (`Branch`, `Shop`, `Provider`):

- **Data Table Cells**:
  The primary line is rendered with `font-medium` using the entity `name`. The secondary line is rendered below with `text-[11px] text-muted-foreground` using the entity `code`.
  ```tsx
  {
    key: "name",
    header: "Branch",
    width: 220,
    minWidth: 160,
    maxWidth: 320,
    cell: (b) => (
      <div>
        <div className="font-medium">{b.name}</div>
        <div className="text-[11px] text-muted-foreground">{b.code}</div>
      </div>
    ),
  }
  ```
- **Sorting Key**:
  Entity columns set `key: "name"` (or `sortKey: "name"`) so that table header clicks sort rows alphabetically by the visible primary name rather than code.
- **Select Dropdowns & Filters**:
  Options are formatted with name first, separated by an em dash:
  ```tsx
  <SelectItem key={b.id} value={b.id}>{b.name} — {b.code}</SelectItem>
  ```
- **Modals, Confirm Dialogs & Sheets**:
  Confirmation messages and headers reference the name first:
  - Archive/Delete description: `Archive "${item.name} — ${item.code}"?`
  - Edit modal title: `title={isEdit ? `Edit ${item.name}` : "New item"}`
  - Sheet title: `${item.name} — ${item.code}`
- **Dashboard Charts & Aggregations**:
  Charts (e.g. Cost by Provider, Cost by Branch) map chart slice names to `item.name || item.code` to prioritize human-readable names in tooltips and legends.



