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

```tsx
<DataTable
  columns={columns}
  rows={data}
  rowKey={(row) => row.id}
  defaultSort={{ key: "invoiceNumber", direction: "desc" }}
  resizable={true}
  striped={true}
  density="compact"
  bordered={true}
/>
```
