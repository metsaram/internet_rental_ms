# NetRent — AI Agent Project Guide

> **Purpose of this document**: Give any AI coding agent enough context to be
> immediately productive on this codebase. Read this first before making any
> changes.

---

## 1. Project Overview

**NetRent** is an Internet Rental Management System — a single-tenant (demo)
B2B SaaS app for tracking ISP contracts, services, invoices, and renewals
across branches and shops.

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict)
- **Database**: Prisma ORM with SQLite (PostgreSQL-ready for production)
- **Auth**: NextAuth.js v4 (credentials provider, JWT sessions)
- **UI**: Tailwind CSS 4 + shadcn/ui (New York) + Framer Motion + Recharts
- **Server state**: TanStack Query
- **Excel**: SheetJS (`xlsx`)

### Single-page architecture

The only user-visible route is `/` (`src/app/page.tsx`). The app is a
client-side SPA shell with hash-based view switching (`#dashboard`, `#contracts`,
etc.). There are no nested App Router pages. All data/mutations go through
`/api/*` route handlers (no server actions).

### Demo credentials

| Role  | Email               | Password    |
|-------|---------------------|-------------|
| Admin | admin@netrent.local | admin12345  |
| Staff | staff@netrent.local | staff12345  |

---

## 2. Critical Rules (READ BEFORE CODING)

### Rule 1: Never import Prisma in client components

**NEVER** import `@prisma/client` or `@prisma/client/runtime/library` from any
file under `src/components/**` or `src/lib/format.ts`. Those files are bundled
into the browser; Prisma's runtime pulls in Node-only modules (`node:module`)
and breaks the build.

- **Client-safe libs**: `format.ts`, `api-client.ts`, `utils.ts`
- **Server-only libs** (may import Prisma): `db.ts`, `contracts.ts`, `billing.ts`,
  `renewals.ts`, `notifications.ts`, `storage.ts`, `audit.ts`, `session.ts`,
  `auth.ts`, `rate-limit.ts`, `import-fields.ts`
- Money arrives at the client as `string`/`number` from the API. Render with
  `formatMoney(amount, currency)` only.

### Rule 2: radix `<Select>` does not allow empty-string values

For an optional relation rendered as a Select (e.g. "None"), use the literal
string `"none"` as the `<SelectItem value="none">` and convert to `null` on
submit. **Never** `<SelectItem value="">` — radix will throw at runtime.

### Rule 3: Never use `.forEach()` with `await`

`.forEach()` callbacks are not async. Use `for (const x of arr)` instead.
A `forEach` + `await` caused a parse error that broke the **entire app**
(all routes returned 500) in round 3.

### Rule 4: After `prisma db push`, restart the dev server

`prisma generate` regenerates the Prisma client, but the running dev server
caches the old client in Node's `require` cache. After any schema change:
1. `bun run db:push` (regenerates client)
2. Kill + restart the dev server (`pkill -f "next dev"` then `bun run dev`)
3. Re-seed if `--accept-data-loss` wiped data (`bun run db:seed`)

### Rule 5: Every API route must enforce company scope

Every query/mutation must filter by `user.companyId`. Use `requireUser()` or
`requireAdmin()` from `@/lib/session` at the top of every handler. Wrap the
body in `try/catch` + `return errorResponse(err)` so auth errors return 401
(not 500).

### Rule 6: Use `writeAudit()` for all mutations

Every create/update/delete must call `writeAudit()` with actor/company/action/
entityType/entityId + redacted before/after. Use `redactSensitive()` to strip
passwords, tokens, ISP usernames from audit payloads.

### Rule 7: Database Migration Files & Changelogs

When a task involves schema changes:
- Always generate a migration file in:
  `db/yyyy-mm-dd/table_name/`
- The migration file must include:
  - SQL or Prisma migration script
  - Clear description of changes (columns, constraints, indexes)
- Ensure naming convention matches `table_name` and the `yyyy-mm-dd` timestamp format.

---

## 3. Directory Structure

```
/home/z/my-project/
├── src/
│   ├── app/
│   │   ├── api/                    # 45+ route handlers (see §5)
│   │   ├── error.tsx               # Global error boundary (Try again / Go to dashboard)
│   │   ├── loading.tsx             # Root loading spinner
│   │   ├── not-found.tsx           # Branded 404 page
│   │   ├── layout.tsx              # Root layout (AppProviders, fonts, Toaster)
│   │   ├── page.tsx                # Single-page shell (lazy-loads views by hash)
│   │   └── globals.css             # Tailwind 4 + theme (emerald/slate, dark mode)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── shared/                 # Reusable app components (see §6)
│   │   ├── views/                  # 14 view components (see §7)
│   │   ├── app-shell.tsx           # Sidebar + topbar + footer + mobile bottom nav
│   │   └── providers.tsx           # SessionProvider + ThemeProvider + QueryClientProvider
│   ├── lib/                        # Server + client domain modules (see §4)
│   └── hooks/
│       ├── use-toast.ts            # Toast hook (shadcn)
│       └── use-mobile.ts           # Mobile detection hook (shadcn)
├── prisma/
│   ├── schema.prisma               # Full domain model (29 models + enums)
│   └── seed.ts                     # Repeatable demo seed (company, users, branches, …)
├── docs-implementation-plan/       # Original 20-phase prompt pack (reference)
├── download/                       # Generated files (templates, attachment storage)
├── public/                         # Static assets (logo.svg, robots.txt)
├── .env / .env.example             # Environment variables
├── next.config.ts                  # Security headers (CSP, HSTS, X-Frame-Options, …)
├── package.json                    # Scripts: dev, lint, db:push, db:seed, db:generate
├── tailwind.config.ts              # Tailwind config (content paths)
├── tsconfig.json                   # TS strict config
├── Caddyfile                       # Gateway config (port 81 → 3000, XTransformPort)
└── README.md                       # User-facing README
```

---

## 4. Library Modules (`src/lib/`)

### `db.ts` — Prisma Client singleton
- Exports `db` (a global-cached `PrismaClient`).
- Log level: `['query']` in dev.
- Import in API routes only.

### `auth.ts` — NextAuth configuration
- Exports `authOptions: NextAuthOptions`.
- **Provider**: Credentials (email + password).
- **Session**: JWT strategy, 12h maxAge.
- **Rate limiting**: 10 auth attempts/min per email (via `rate-limit.ts`).
  Returns `null` after the limit — DB is never hit, and the generic "Invalid
  email or password" error doesn't reveal the lockout.
- **Callbacks**: `jwt` + `session` enrich the token with `role`, `companyId`,
  `companyName`, `companyCode`, `companyCurrency`.
- Exports `AppSession` type.

### `session.ts` — Server-side auth helpers
- `getSession()` → `SessionUser | null` (typed).
- `requireUser()` → `SessionUser` or throws `HttpError(401)`.
- `requireAdmin()` → `SessionUser` (ADMIN) or throws `HttpError(403)`.
- `HttpError` class with `status` + `message`.
- `errorResponse(err)` → standard JSON error `Response` (401/403/404/400/500).
- `parseJsonBody<T>(req)` → parsed JSON or throws `HttpError(400)`.
- `assertBranchInCompany(branchId, companyId)` → validates tenant scope.

### `password.ts` — Password hashing
- `hashPassword(password)` → `"scrypt:<saltHex>:<hashHex>"` (Node's `scryptSync`).
- `verifyPassword(password, stored)` → boolean (`timingSafeEqual`).
- No external deps.

### `contracts.ts` — Contract cost math (server-only, imports Decimal)
- `computeContractCosts({durationMonths, freeMonths, monthlyFee})` →
  `{contractMonths, freeMonths, paidMonths, monthlyFee, scheduledTotal,
  effectiveMonthly}` where:
  - `paidMonths = contractMonths - freeMonths`
  - `scheduledTotal = monthlyFee × paidMonths`
  - `effectiveMonthly = scheduledTotal / contractMonths`
- `deriveContractStatus(contract, now, warningDays=30)` →
  `"upcoming" | "active" | "expiring" | "expired" | "terminated"`.
- `daysUntilEnd(endDate, now)` → integer days.

### `billing.ts` — Invoice/payment math (server-only)
- `outstandingBalance(invoice, allocations)` → Decimal (total − Σ completed allocations).
- `deriveInvoiceStatus(invoice, allocations, now)` →
  `"draft" | "issued" | "partial" | "paid" | "overdue" | "void"`.
- `allocatePayment(amount, invoices)` → `{invoiceId: amount}` (greedy fill,
  never over-allocates).

### `renewals.ts` — Renewal classification (server-only)
- `classifyRenewal(candidate, now, warningDays=30)` →
  `"upcoming" | "overdue" | "completed" | "none"`.
- `suggestRenewalTerms(oldContract)` → suggested new start/end/fee/duration.
- `renewalFeeDelta(oldFee, newFee)` → Decimal delta.
- `DEFAULT_WARNING_DAYS = 30`.

### `notifications.ts` — Notification generation (server-only)
- `generateNotifications({companyId, userId})` → scans pending renewals +
  outstanding invoices, creates `Notification` records idempotently (24h dedup
  window per type+entity+user — prevents re-creation after dismissal).
  Types: `RENEWAL_UPCOMING`, `RENEWAL_OVERDUE`, `INVOICE_OVERDUE`,
  `INVOICE_DUE_SOON`.
- `notifyImport({companyId, userId, jobId, fileName, ...})` → one-off
  `IMPORT_COMPLETED`/`IMPORT_FAILED` notification.

### `storage.ts` — File storage abstraction (server-only)
- `putFile(data, ext)` → `{key, size}` (opaque random-hex key, path-traversal-guarded).
- `getFile(key)` → `Buffer | null`.
- `deleteFile(key)` → void.
- `ALLOWED_MIME` + `MAX_FILE_BYTES` (5MB) + `formatBytes()`.
- Backend: local filesystem under `download/storage/`. Interface is stable for
  S3/Vercel Blob swap.

### `audit.ts` — Audit logging (server-only)
- `writeAudit({companyId, actorId, action, entityType, entityId, before, after})` →
  creates an `AuditLog` row. Never throws (wrap-and-log on failure).
- `redactSensitive(obj, keys?)` → redacts `password`, `token`, `secret`,
  `username` keys.

### `rate-limit.ts` — In-memory token-bucket rate limiter (server-only)
- `rateLimit(key, {max, windowMs})` → boolean.
- `getClientIp(req)` → IP from `x-forwarded-for` / `x-real-ip`.
- `cleanupBuckets(maxAgeMs)` → periodic stale-bucket cleanup (auto-runs every 5min).
- Swap to Redis/Upstash for multi-instance.

### `import-fields.ts` — Excel import field definitions (server-only)
- `CONTRACT_FIELDS` + `SERVICE_FIELDS` — array of `{key, label, required, type, enumValues, hint}`.
- `getFields(entityType)` → field array for the entity.
- `autoMatchHeader(header)` → fuzzy-matches spreadsheet headers to target
  fields (e.g. "Contract #" → `contractNumber`, "ISP" → `providerCode`).
- `coerceValue(raw, type)` → type-coerces cell values (handles Excel serial
  dates, number strings with commas, enum uppercasing).

### `format.ts` — Client-safe formatters (NO Prisma imports)
- `formatMoney(amount, currency)` → `"$1,234.50"` (currency symbols per ISO).
- `formatNumber(n)` → `"1,234"`.
- `formatDate(date, pattern?)` → `"Oct 14, 2026"`.
- `formatDateTime(date)` → `"Oct 14, 2026 · 3:45 PM"`.
- `formatRelative(date)` → `"2 minutes ago"`.
- `formatBandwidth(mbps)` → `"300 Mbps"` / `"1.00 Gbps"`.
- `maskSensitive(v)` → `"ab••••••"`.

### `api-client.ts` — Client fetch wrapper
- `api<T>(input, init?)` → typed fetch that throws on non-2xx. Used by all
  client views with TanStack Query.

### `utils.ts` — Tailwind `cn()` class merge.

---

## 5. API Route Inventory (`src/app/api/`)

All routes enforce `requireUser()` / `requireAdmin()` + company scope.

### Auth
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler (login, session, csrf). |

### Company / Account
| Route | Method | Description |
|-------|--------|-------------|
| `/api/me` | GET | Current user + company info. |
| `/api/company` | GET | Company profile. |
| `/api/company` | PATCH | Update company profile (admin). |
| `/api/users` | GET | List users (admin). |
| `/api/users` | POST | Create user (admin, Zod-validated, scrypt-hashed). |
| `/api/users/[id]` | PATCH | Update user (admin, lockout guards). |

### Branches / Shops / Notes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/branches` | GET | List (search/status/`min=true` compact). |
| `/api/branches` | POST | Create (unique code). |
| `/api/branches/[id]` | GET/PATCH/DELETE | CRUD (delete refuses if referenced). |
| `/api/shops` | GET/POST | List (with branch + `_count.services`) / Create. |
| `/api/shops/[id]` | GET/PATCH/DELETE | CRUD + includes notes on GET. |
| `/api/notes` | POST | Create note (shop-scoped, authorId). |
| `/api/notes/[id]` | DELETE | Delete (STAFF=own only, ADMIN=any). |

### Providers / Plans
| Route | Method | Description |
|-------|--------|-------------|
| `/api/providers` | GET/POST | List (with `_count`) / Create (unique code). |
| `/api/providers/[id]` | GET/PATCH/DELETE | CRUD (delete refuses if referenced). |
| `/api/plans` | GET/POST | List (filter by provider) / Create (unique name per provider). |
| `/api/plans/[id]` | GET/PATCH/DELETE | CRUD (can't move between providers). |

### Services / Contracts
| Route | Method | Description |
|-------|--------|-------------|
| `/api/services` | GET/POST | List (username redacted → `hasCredentials`) / Create. |
| `/api/services/[id]` | GET/PATCH/DELETE | CRUD (delete refuses if has contracts). |
| `/api/contracts` | GET/POST | List (with derived status + costs) / Create. |
| `/api/contracts/[id]` | GET/PATCH/DELETE | CRUD (detail includes history + costs). |
| `/api/contracts/bulk-status` | POST | Bulk update status (company-scoped, tx). |
| `/api/contracts/[id]/renew` | POST | Atomic renewal (new contract + renewal record + mark old RENEWED). |

### Invoices / Payments
| Route | Method | Description |
|-------|--------|-------------|
| `/api/invoices` | GET/POST | List (with derived status + outstanding) / Create. |
| `/api/invoices/[id]` | GET/PATCH/DELETE | CRUD (void immutable, drafts only deletable). |
| `/api/invoices/[id]/void` | POST | Void invoice (preserves history). |
| `/api/invoices/[id]/print` | GET | Print-friendly HTML invoice template. |
| `/api/payments` | GET/POST | List / Create+allocate in a tx (over-allocation guarded). |
| `/api/payments/[id]` | GET/PATCH/DELETE | CRUD (delete = void). |

### Renewals
| Route | Method | Description |
|-------|--------|-------------|
| `/api/renewals` | GET | List with `bucket` (upcoming/overdue/completed) + counts. |
| `/api/renewals/[id]/decline` | POST | Mark DECLINED (refuses COMPLETED). |

### Attachments
| Route | Method | Description |
|-------|--------|-------------|
| `/api/attachments` | GET/POST | List (by entityType/entityId) / Upload (FormData, MIME/size validated). |
| `/api/attachments/[id]` | GET/DELETE | Metadata / Delete (file + metadata). |
| `/api/attachments/[id]/download` | GET | Stream file (`Content-Disposition: attachment`, company-scoped). |

### Import / Export / Templates
| Route | Method | Description |
|-------|--------|-------------|
| `/api/import/preview` | POST | Parse .xlsx (FormData), return worksheets + headers + auto-map + sample rows. |
| `/api/import/commit` | POST | Validate + write rows in a tx + create ImportJob/Rows + notify. |
| `/api/import/jobs` | GET | Import history. |
| `/api/import/jobs/[id]` | GET | Job detail with all rows (error review). |
| `/api/export` | GET | XLSX export (branches/shops/services/contracts/invoices/payments). |
| `/api/template/[type]` | GET | Stream template .xlsx (authenticated). |

### Notifications
| Route | Method | Description |
|-------|--------|-------------|
| `/api/notifications` | GET | List for user (refreshes via `generateNotifications()` on each call). |
| `/api/notifications` | POST | Mark all read. |
| `/api/notifications/[id]` | DELETE | Dismiss. |
| `/api/notifications/[id]/read` | POST | Mark single read. |

### Dashboard / Reports / Audit / Health
| Route | Method | Description |
|-------|--------|-------------|
| `/api/dashboard` | GET | All aggregates (counts, cost by currency/provider/branch, billing, renewals, activity, 6-month cost trend). |
| `/api/reports/variance` | GET | Per-contract scheduled vs invoiced vs paid variance. |
| `/api/audit` | GET | Recent 100 audit entries (redacted). |
| `/api/health` | GET | Smoke test (`{"status":"ok","db":"connected"}`). |

---

## 6. Shared Components (`src/components/shared/`)

### `data-table.tsx` — `DataTable<T>`
Generic table with: search input, `FilterSelect`, pagination, loading skeletons,
empty state, row click, **keyboard shortcuts** (j/k navigate, Enter opens,
/ focuses search, Esc clears). Active row highlighted with `bg-primary/10`.

### `form-dialog.tsx` — `FormDialog` + `Field`
Controlled dialog with a form `<form onSubmit>`, loading state on the submit
button, scrollable body, sticky header/footer. `Field` = label + required
marker + hint + error.

### `status-badge.tsx` — `StatusBadge`
Color-coded badge for statuses (ACTIVE=green, OVERDUE=red, DRAFT=slate, etc.).
Auto-maps status strings to tones.

### `empty-state.tsx` — `EmptyState`
Centered dashed-border empty card. Optional `illustration` prop renders a
decorative SVG line-art "empty box" scene.

### `confirm-dialog.tsx` — `ConfirmDialog`
Wrapper around shadcn `AlertDialog` with loading state + destructive styling.

### `page-header.tsx` — `PageHeader`
Title + description + actions row, used at the top of every view.

### `command-palette.tsx` — `CommandPalette`
Cmd+K dialog (cmdk) with: **Recently viewed** (localStorage-tracked, 5 items),
Navigate (13 views), Quick actions (create invoice/contract/service),
Appearance (toggle theme), Account (sign out).

### `shortcuts-help.tsx` — `ShortcutsHelp` + `useShortcutsHelp()`
Dialog showing all keyboard shortcuts (Global + Tables groups). `?` key toggles.

### `attachments-panel.tsx` — `AttachmentsPanel`
Reusable upload/download/delete panel for any entity. Drag-and-drop dropzone,
category Select, file list with MIME icon / size / uploader / time / download
link / delete. Used in contract + invoice detail sheets.

### `animated-number.tsx` — `AnimatedNumber`
`requestAnimationFrame` counter with ease-out cubic curve (600ms). Used in
dashboard KPI cards + status pills.

### `view-transition.tsx` — `ViewTransition`
Framer Motion `AnimatePresence` wrapper — fade + 8px slide on view switch.

### `mobile-bottom-nav.tsx` — `MobileBottomNav`
Fixed bottom bar (lg:hidden) with 5 primary views + "More" button. Respects
iOS safe-area inset.

---

## 7. View Components (`src/components/views/`)

All views are client components (`"use client"`), lazy-loaded in `page.tsx`.

| View | Hash | Description |
|------|------|-------------|
| `login.tsx` | (pre-auth) | Login screen with demo-account quick-fill. |
| `dashboard.tsx` | `#dashboard` | KPIs (animated), status pills, cost-trend area chart, cost summary, contract status, billing, cost-by-provider/branch bar charts, renewals table + tiles, recent-activity timeline. |
| `branches.tsx` | `#branches` | CRUD table with search/filter, archive (status=INACTIVE), delete (refuses if referenced). |
| `shops.tsx` | `#shops` | CRUD table + Sheet detail (branch/contact/notes panel with add/delete notes). |
| `providers.tsx` | `#providers` | CRUD table with plan/service counts. |
| `plans.tsx` | `#plans` | CRUD table with provider filter, bandwidth formatting. |
| `services.tsx` | `#services` | CRUD table with IP/credential redaction (`hasCredentials` boolean only). |
| `contracts.tsx` | `#contracts` | CRUD table with bulk-select checkboxes + bulk-status toolbar, cost math preview, detail Sheet with cost breakdown + contract history + attachments panel. |
| `invoices.tsx` | `#invoices` | CRUD table with outstanding-balance summary strip, detail Sheet with allocations + record-payment dialog + void/delete + print button + attachments. |
| `renewals.tsx` | `#renewals` | Tabbed (Upcoming/Overdue/Completed) renewal cards with old→new comparison + fee delta + Renew dialog + Decline. |
| `import.tsx` | `#import` | 4-step wizard (Upload→Mapping→Review→Done) with auto-matched columns, row-error table, import history. |
| `notifications.tsx` | `#notifications` | List with summary tiles, All/Unread tabs, mark-read/dismiss. |
| `reports.tsx` | `#reports` | Cost summary, cost by branch/provider, contract expiration, service inventory, outstanding invoices, recent payments, **cost variance** report, audit log (admin), per-entity Excel export. |
| `settings.tsx` | `#settings` | Company profile edit (admin), account card, security card, **user management** (admin: list/create/disable/reset-password). |

---

## 8. Data Model (Prisma)

### Core entities
- **Company** → root tenant. Has many: users, branches, providers, contracts,
  invoices, payments, attachments, notifications, auditLogs, importJobs.
- **User** → email (unique), passwordHash, role (ADMIN/STAFF), companyId.
- **Branch** → companyId, code (unique per company), name, address, city,
  manager, phone, email, status.
- **Shop** → companyId, branchId, code (unique per company), name, type
  (UNIT/KIOSK/OFFICE/RESTAURANT/OTHER), contact, status. Has many Notes.
- **Note** → shopId, authorId, body, timestamps.
- **InternetProvider** → companyId, code, name, contact, phone, email, website,
  status. Has many Plans + Services.
- **InternetPlan** → companyId, providerId, name (unique per provider),
  bandwidthDown/Up, connectionType, catalogMonthlyPrice, currency, status.
- **InternetService** → companyId, branchId, shopId?, providerId, planId?,
  serviceCode (unique), accountId, address, ipAddress, ipType, username
  (sensitive), status, installedAt.
- **InternetContract** → companyId, serviceId, contractNumber (unique),
  startDate, endDate, durationMonths, freeMonths, monthlyFee, currency,
  billingCycle, status, createdById. Has many Invoices + RenewalsAsOld/New.

### Billing entities
- **Invoice** → companyId, contractId, invoiceNumber (unique), invoiceDate,
  period, subtotal/tax/discount/total, currency, status (DRAFT/ISSUED/
  PARTIAL/PAID/OVERDUE/VOID), dueDate. Has many PaymentAllocations.
- **Payment** → companyId, paymentDate, amount, currency, method, reference,
  status (COMPLETED/VOID). Has many PaymentAllocations.
- **PaymentAllocation** → paymentId, invoiceId (unique pair), amount.

### Workflow entities
- **ContractRenewal** → companyId, oldContractId (unique), newContractId?,
  serviceId, status (PENDING/COMPLETED/DECLINED), decisionDate, decidedById,
  warningDate, noticeDate, new terms snapshot.
- **Attachment** → companyId, entityType, entityId (polymorphic), category,
  fileName, mimeType, sizeBytes, storageKey, uploadedById.
- **Notification** → companyId, userId, type, title, message, entityType?,
  entityId?, readAt.
- **AuditLog** → companyId, actorId?, action, entityType, entityId?, before
  (JSON), after (JSON), correlationId.
- **ImportJob** → companyId, fileName, worksheet, entityType, columnMap (JSON),
  status, totalRows, importedRows, errorRows, summary. Has many ImportRows.
- **ImportRow** → jobId, rowIndex, status, message, data (JSON).

### Delete behavior
- Company → Cascade (wipes all tenant data).
- Branch → Cascade on company; Restrict on shops/services (can't delete if
  referenced — archive instead).
- Shop → Cascade on company; Restrict on services.
- Provider → Cascade on company; Restrict on plans/services.
- Plan → Cascade on company; SetNull on services (optional).
- Service → Cascade on company; Restrict on contracts.
- Contract → Cascade on company; Restrict on invoices/renewals.
- Invoice → Cascade on company; Restrict on allocations.
- Payment → Cascade on company; Cascade on allocations.
- PaymentAllocation → Cascade on payment; Restrict on invoice.
- Attachment → Cascade on company/user.

---

## 9. Development Workflow

### Commands

```bash
bun run dev          # Start dev server (port 3000, logs to dev.log)
bun run lint         # ESLint
bun run db:push      # Push schema + regenerate client
bun run db:seed      # Seed demo data (idempotent)
bun run db:generate  # Regenerate Prisma Client only
```

### After schema changes

1. Edit `prisma/schema.prisma`.
2. `bun run db:push` (regenerates client).
3. **Restart the dev server** (kill + `bun run dev`) — turbopack doesn't reload
   node_modules caches.
4. `bun run db:seed` if `--accept-data-loss` wiped data.

### Dev server management

The dev server may crash or be killed by the sandbox. To restart:
```bash
pkill -f "next dev"; pkill -f "bun run dev"; sleep 4
nohup bun run dev > /tmp/dev.log 2>&1 &
```

### QA with agent-browser

```bash
agent-browser open "http://localhost:3000/"
agent-browser snapshot -i           # Interactive elements with refs
agent-browser click @e8              # Click by ref
agent-browser fill @e6 "text"       # Fill input
agent-browser errors                # Page errors
agent-browser console              # Console log
```

---

## 10. Key Patterns

### API route pattern

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, parseJsonBody, HttpError, errorResponse } from "@/lib/session";
import { writeAudit, redactSensitive } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ /* ... */ });

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    // Query scoped by user.companyId
    const rows = await db.entity.findMany({ where: { companyId: user.companyId } });
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await parseJsonBody(req));
    // Validate ownership, uniqueness, etc.
    const created = await db.entity.create({ data: { companyId: user.companyId, ...body } });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "CREATE", entityType: "Entity", entityId: created.id, after: redactSensitive({ ...body }) });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
```

### View pattern

```typescript
"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { toast } from "sonner";

type Row = { /* ... */ };

export function MyView() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["my-entity"],
    queryFn: () => api<Row[]>("/api/my-entity"),
  });
  // ... render
}
```

### Nullable Select pattern

```typescript
const [value, setValue] = React.useState("none"); // "none" = null
// ...
<Select value={value} onValueChange={setValue}>
  <SelectItem value="none">None</SelectItem>
  {options.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
</Select>
// On submit:
{ relationId: value === "none" ? null : value }
```

---

## 11. Known Gotchas

1. **`db:push --accept-data-loss`** may wipe the SQLite database when adding
   columns. Always re-seed after.
2. **Turbopack caches the Prisma client** — restart the dev server after
   `prisma generate`.
3. **`window.location.hash = x`** triggers the `react-hooks/immutability` lint
   rule when used as a statement. Use `window.location.assign('#' + x)` instead.
4. **`<p>` wrapping `<div>`** (e.g. `<Skeleton>`) causes a hydration warning.
   Use `<div>` instead of `<p>` for containers that may hold block elements.
5. **radix Select** doesn't allow empty-string values — use `"none"` sentinel.
6. **`forEach` + `await`** is a parse error — use `for...of`.
7. **The notification generator runs inline on each GET** to
   `/api/notifications` — fine for the demo's small dataset, but should move
   to a scheduled job at scale.
8. **Attachment storage is local-filesystem** (`download/storage/`) —
   production needs S3/Vercel Blob. The `StorageService` interface is stable
   for the swap.

---

## 12. Production Deployment Notes

- Set `NEXTAUTH_SECRET` to a strong random string.
- Set `DATABASE_URL` to a PostgreSQL connection string.
- Run `prisma migrate deploy` (not `migrate dev`) for production migrations.
- Swap `storage.ts` to S3/Vercel Blob.
- Swap `rate-limit.ts` to Redis/Upstash for multi-instance.
- Move the notification generator to a scheduled cron endpoint.
- Configure a real email provider for email notifications (currently in-app
  only).

## 13. AI Agent Workflow & Task Log

### Workflow Protocol (5-Step RAG + Updates)

All AI agents working on NetRent must follow the strict 5-step Retrieval-Augmented Generation (RAG) workflow:

1. **Retrieval**
   - Always search and retrieve the most relevant context from project documents (`README.md`, `AGENTS.md`, `AI_AGENT_GUIDE.md`, and `docs/`).
   - Use vector/keyword search to pull chunks that match the query and assemble into a working knowledge base before generating output.

2. **Generation**
   - Produce requested output (code, config, documentation, explanation) using retrieved context.
   - Ensure correctness by applying validation (linting, schema checks, test cases).
   - Never hallucinate APIs or structures — rely on retrieved docs.

3. **Database Migration**
   - When a task involves schema changes, always generate a migration file in:
     `db/yyyy-mm-dd/table_name/`
   - File must include:
     - SQL or Prisma migration script
     - Clear description of changes (columns, constraints, indexes)
   - Ensure naming convention matches `table_name` and the `yyyy-mm-dd` timestamp format.

4. **Documentation Update**
   - Always update the `docs/` folder after completing a task:
     - `docs/overview/` → Update `project.md`, `architecture.md`, or `tech_stack.md` if scope/stack changes.
     - `docs/guides/` → Update `ai_agent_guide.md`, `developer_guide.md`, or `api_guide.md` if workflows or APIs change.
     - `docs/migrations/yyyy-mm-dd/` → Add a migration doc explaining schema changes alongside the SQL/Prisma file.
     - `docs/changelog/yyyy-mm.md` → Append a monthly summary of changes.
     - `docs/task_logs/yyyy-mm-dd.md` → Append detailed task log entries.
   - Summarize the change in 2–3 sentences for quick reference.

5. **Feedback Loop**
   - Present the result and updated doc summary to the user.
   - Store embeddings of new content so future retrieval includes updated knowledge.
   - If validation fails, retry generation with adjusted parameters.

**Golden Rule**: Every task must leave the documentation and database migrations more complete than before. No task is considered finished until both the `db/` and `docs/` folders are updated.

---

### Task Log

#### [2026-10-20T21:57:30+07:00] Legacy Documentation Audit
- **Task description**: Audit repository for legacy documentation, historical prompt packs, monolithic logs, and obsolete environment notes.
- **Context used**: `docs-implementation-plan/`, `worklog.md`, `agents/`, `AI_AGENT_GUIDE.md`, `git status`.
- **Output generated**: Comprehensive assessment of legacy docs identifying `docs-implementation-plan/` (23 phase prompt files), monolithic `worklog.md` (1,060 lines), and ephemeral subagent prompt files in `agents/`.
- **Timestamp**: 2026-10-20T21:57:30+07:00
- **Status**: Completed

#### [2026-10-20T21:54:40+07:00] Establish Standardized docs/ Documentation Architecture & 5-Step RAG Protocol
- **Task description**: Formally establish the comprehensive `docs/` hierarchy (`overview/`, `guides/`, `changelog/`, `task_logs/`, `migrations/`), update AI agent workflow to 5 steps including Database Migrations and Documentation Updates, and implement the Golden Rule.
- **Context used**: `AI_AGENT_GUIDE.md`, `README.md`, `worklog.md`, user prompt requirements.
- **Output generated**: Created structured documents under `docs/` (`overview/project.md`, `overview/architecture.md`, `overview/tech_stack.md`, `guides/ai_agent_guide.md`, `guides/developer_guide.md`, `guides/api_guide.md`, `changelog/2026-10.md`, `task_logs/2026-10-20.md`) and updated Section 13 in `AI_AGENT_GUIDE.md`.
- **Timestamp**: 2026-10-20T21:54:40+07:00
- **Status**: Completed

#### [2026-10-20T21:50:30+07:00] Add Database Migration Protocol & File Conventions
- **Task description**: Integrate database migration policy into agent guidelines requiring migration files in `db/yyyy-mm-dd/table_name/` with scripts and change descriptions.
- **Context used**: `AI_AGENT_GUIDE.md`, `README.md`, user prompt.
- **Output generated**: Added Rule 7 to Section 2, updated Section 13 workflow specifications, and added developer workflow notes in `README.md`.
- **Timestamp**: 2026-10-20T21:50:30+07:00
- **Status**: Completed

#### [2026-10-20T21:48:30+07:00] Protocol Initialization & Workspace Verification
- **Task description**: Initialize and verify RAG operational workflow, check documentation status across `README.md`, `AGENTS.md`, and `AI_AGENT_GUIDE.md`, and establish the standardized Task Log.
- **Context used**: `README.md`, `AGENTS.md`, `AI_AGENT_GUIDE.md`, `worklog.md`.
- **Output generated**: Section 13 added to `AI_AGENT_GUIDE.md` defining the agent workflow and logging structure.
- **Timestamp**: 2026-10-20T21:48:30+07:00
- **Status**: Completed

---

*This document is the single source of truth for AI agents working on NetRent.
Keep it updated when adding new modules, API routes, or patterns.*

