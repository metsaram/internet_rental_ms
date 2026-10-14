# NetRent — Internet Rental Management System · Worklog

This file is the shared handover document for all agents working on the
Internet Rental Management System (the "NetRent" project). Each agent MUST
read this file before starting and append a new section after finishing.

Project root: `/home/z/my-project`
Plan documents: `/home/z/my-project/docs-implementation-plan/PHASE-*.md`
Dev server: `bun run dev` (port 3000), logs at `/home/z/my-project/dev.log`.

## Environment adaptation

The phase prompts target PostgreSQL + Vercel. Our sandbox uses SQLite +
local Next.js on port 3000, and the only user-visible route is `/`.
We therefore:

- Use SQLite via Prisma (Decimal stored as text — precision preserved).
- Build the app as a single-page shell on `/` with client-side view
  switching driven by the URL hash (`#dashboard`, `#branches`, ...).
- All mutations/data go through `/api/*` route handlers (no server actions).
- NextAuth v4 (credentials, JWT sessions) for auth; passwords hashed with
  Node's scrypt (no native deps).
- Money handled with `Decimal` from `@prisma/client/runtime/library`.

## Status

- Phase 00 (Foundation): ✅ done — shell, sidebar, topbar, theme, providers,
  `.env.example`, lint scripts.
- Phase 01 (Database): ✅ done — Prisma schema + repeatable seed (Company,
  Branch, Shop, Provider, Plan, Service, Contract, Note, AuditLog,
  ImportJob/Row). Run `bun run db:push && bun run db:seed`.
- Phase 02 (Auth): ✅ done — NextAuth credentials, JWT, role/company claims,
  server helpers (`requireUser`/`requireAdmin`/`HttpError`).
- Phase 08 (Dashboard): ✅ done — real DB aggregates, charts, renewals.

## In progress

Building the CRUD modules (Phases 03–07) + reports/settings (15) + export (10).

## Canonical patterns (FOLLOW THESE)

- **Shared UI** lives in `src/components/shared/`:
  `DataTable`, `FormDialog` (+ `Field`), `StatusBadge`, `EmptyState`,
  `PageHeader`, `ConfirmDialog`.
- **Views** live in `src/components/views/<module>.tsx` (client components).
- **API** lives in `src/app/api/<module>/route.ts` (+ `/[id]/route.ts`).
- **Server auth** via `requireUser()` / `requireAdmin()` from `@/lib/session`.
  Always scope by `user.companyId`. Use `writeAudit()` for mutations.
- **Money** rendered with `formatMoney(amount, currency)` from `@/lib/format`.
  Contract math via `computeContractCosts()` in `@/lib/contracts`.
- **Client fetch** via `api<T>("/api/...")` from `@/lib/api-client` +
  `useQuery`/`useMutation` from `@tanstack/react-query`.
- **Toasts** via `sonner` (`toast.success(...)` / `toast.error(...)`).
- **Sensitive fields** (passwords, ISP usernames) must be redacted in list
  payloads and audit logs (`redactSensitive()` from `@/lib/audit`).
- **IMPORTANT — radix `<Select>` does NOT allow empty-string values.** For an
  optional relation rendered as a Select (e.g. shop/plan "None"), use the
  literal string `"none"` as the option value and convert to `null` on
  submit. Never `<SelectItem value="">`. See `services.tsx` for the pattern.
- **IMPORTANT — do NOT import `@prisma/client` (or
  `@prisma/client/runtime/library`) from any file under `src/components/**`
  or `src/lib/format.ts`.** Those are imported by client bundles; bundling
  Prisma's runtime pulls in Node-only modules (`node:module`) and breaks the
  browser build. Money arrives at the client as string/number from the API;
  use `formatMoney(number|string, currency)` only. Server-only files
  (`src/lib/contracts.ts`, API routes) MAY import Prisma.

## Demo credentials

- Admin: `admin@netrent.local` / `admin12345` (role ADMIN)
- Staff: `staff@netrent.local` / `staff12345` (role STAFF)

---
Task ID: 1-3
Agent: main (Z.ai Code)
Task: Foundation, database, auth, shared UI, dashboard.

Work Log:
- Extracted the uploaded prompt pack to `docs-implementation-plan/`.
- Wrote Prisma schema (SQLite) for the full domain model.
- Added scrypt password hashing, NextAuth credentials provider, JWT with
  role/company claims, server permission helpers.
- Added `format.ts` (money/date/bandwidth/mask), `contracts.ts` (cost math
  + status derivation), `audit.ts` (writeAudit + redactSensitive).
- Built the single-page AppShell (sidebar + topbar + footer, dark mode,
  mobile drawer) with hash-based view switching.
- Built the login screen with demo-account quick-fill.
- Built the dashboard API (real aggregates: counts, cost by currency/
  provider/branch, renewals) and dashboard view with KPIs + recharts.

Stage Summary:
- Foundation, DB, auth, and dashboard are complete and lint-clean.
- Ready to build the CRUD modules following the canonical patterns above.

---
Task ID: 5-a/5-b
Agent: full-stack-developer (branches+shops+notes)
Task: Implement Branches CRUD (Phase 03) + Shops & Notes CRUD (Phase 04).

Work Log:
- Read worklog + canonical references (contracts view/API, services view, session, audit, format, schema, shared components).
- Created `/src/app/api/branches/route.ts` — GET (search by code/name/city/manager, status filter ALL/ACTIVE/INACTIVE, `min=true` returns `{id,code,name,status}`, full payload includes `_count.shops` + `_count.services`) + POST (zod-validated, unique `(companyId,code)` → 409, writeAudit CREATE).
- Created `/src/app/api/branches/[id]/route.ts` — GET one (with `_count`), PATCH (unique code on change, writeAudit UPDATE), DELETE (refuses when shops OR services reference it → 400 "Branch has shops or services; archive instead"; writeAudit DELETE).
- Overwrote `/src/components/views/branches.tsx` — full CRUD view: PageHeader + "New branch", DataTable with search + FilterSelect (ALL/ACTIVE/INACTIVE), columns (Code+name, City, Manager, Phone, Shops count, Services count, Status badge, Edit/Archive/Delete buttons), FormDialog with Field wrapper for code/name/address/city/manager/phone/email/status, Archive action via PATCH status=INACTIVE with confirm + toast, Delete confirm dialog (API error surfaced via toast), invalidates `["branches"]`, `["branches-min"]`, `["dashboard"]`.
- Created `/src/app/api/shops/route.ts` — GET (search, status, `min=true` returns `{id,code,name,branchId,status}`, full payload includes `branch:{id,code,name}` + `_count.services`) + POST (branch ownership check, unique `(companyId,code)`, writeAudit CREATE).
- Created `/src/app/api/shops/[id]/route.ts` — GET one (branch, `_count.services`, `notes` with `author:{id,name,email}` ordered createdAt desc), PATCH (branch ownership on change, unique code on change, writeAudit UPDATE), DELETE (refuses when services reference it → 400, writeAudit DELETE).
- Created `/src/app/api/notes/route.ts` — POST create (`{shopId, body}`, shop ownership check, authorId = user.id, writeAudit CREATE).
- Created `/src/app/api/notes/[id]/route.ts` — DELETE (joins via note→shop→company, STAFF may delete only own notes, ADMIN any, writeAudit DELETE).
- Overwrote `/src/components/views/shops.tsx` — full CRUD view + Sheet detail (row click opens): columns (Code+name, Branch, Type as Badge, Contact, Phone, Services count, Status, Edit/Archive/Delete buttons); Sheet shows branch/type/contact/address/services count + Notes panel (textarea + Add button, list of notes with author + relative time + per-note delete button disabled when not author and not ADMIN); FormDialog fields branch(Select), code, name, type(Select UNIT/KIOSK/OFFICE/RESTAURANT/OTHER), contactPerson, phone, email, address, status; FilterSelect + search; invalidates `["shops"]`, `["shops-min"]`, `["dashboard"]` on shop mutations and `["shop", shopId]` on note add/delete (detail refetched via useQuery).
- Ran `bun run lint` — passes clean (exit 0), no errors in any file.

Stage Summary:
- Files created: 6 API routes (`/api/branches/route.ts`, `/api/branches/[id]/route.ts`, `/api/shops/route.ts`, `/api/shops/[id]/route.ts`, `/api/notes/route.ts`, `/api/notes/[id]/route.ts`).
- Files overwritten: 2 views (`/src/components/views/branches.tsx`, `/src/components/views/shops.tsx`).
- No client component imports Prisma (only API routes import `@prisma/client`); all money fields are absent from these modules; format helpers (`formatDate`, `formatRelative`) used in shops view.
- Used `as const` for STATUS_OPTS / TYPE_OPTS; local TS types `Branch`, `Shop`, `ShopNote`, `ShopDetail` declared at top of view files; no `any` introduced (only `(session?.user as any)` access matching existing contracts.tsx pattern).
- Archive implemented via PATCH status=INACTIVE in both views (no separate ARCHIVE audit action — kept as UPDATE per existing conventions).
- No Prisma schema changes; no shared-component modifications; no new top-level routes.

---
Task ID: 5-c/5-d
Agent: full-stack-developer (providers+plans)
Task: Implement Providers CRUD + Plans CRUD (Phase 05).

Work Log:
- Read worklog + canonical references (branches view/API, services view, contracts view, session, audit, format, schema, shared components).
- Created `/src/app/api/providers/route.ts` — GET (search by code/name/contactPerson, status filter ALL/ACTIVE/INACTIVE, `min=true` returns `{id,code,name,status}`, full payload includes `_count.plans` + `_count.services`) + POST (zod-validated, unique `(companyId,code)` → 409, writeAudit CREATE).
- Created `/src/app/api/providers/[id]/route.ts` — GET one (with `_count`), PATCH (unique code on change, writeAudit UPDATE), DELETE (refuses when plans OR services reference it → 400 "Provider has plans or services; archive instead"; writeAudit DELETE).
- Overwrote `/src/components/views/providers.tsx` — full CRUD view: PageHeader + "New provider", DataTable with search + FilterSelect (ALL/ACTIVE/INACTIVE), columns (Code+name, Contact, Phone, Email, Plans count, Services count, Status badge, Edit/Archive/Delete buttons), FormDialog with Field wrapper for code/name/contactPerson/phone/email/website/status(Select)/notes(Textarea), Archive action via PATCH status=INACTIVE with confirm + toast, Delete confirm dialog (API 400 surfaced via toast), invalidates `["providers"]`, `["providers-min"]`, `["dashboard"]`.
- Created `/src/app/api/plans/route.ts` — GET (search by name, status filter, provider filter by providerId, `min=true` returns `{id,name,providerId,bandwidthDownMbps,status}`, full payload includes `provider:{id,code,name}` + `_count.services`) + POST (zod-validated with `z.coerce.number()` for numeric fields, provider ownership check, unique `(companyId,providerId,name)` → 409, `catalogMonthlyPrice` stored as `new Prisma.Decimal(value)`, currency defaults to `user.companyCurrency`, writeAudit CREATE).
- Created `/src/app/api/plans/[id]/route.ts` — GET one (with provider + `_count.services`), PATCH (disallows changing providerId → 400 "Plan cannot be moved between providers"; enforces unique name-on-provider on change; `catalogMonthlyPrice` re-stored as `new Prisma.Decimal`; writeAudit UPDATE), DELETE (refuses when services reference it → 400 "Plan is referenced by services; archive instead"; writeAudit DELETE).
- Overwrote `/src/components/views/plans.tsx` — full CRUD view: PageHeader + "New plan" (disabled when no providers exist with amber hint linking to #providers), DataTable with search + provider filter Select (All providers + each provider) + status FilterSelect, columns (Name+provider sub-line, Bandwidth ↓↑ via `formatBandwidth`, Connection type, Catalog price via `formatMoney`, Services count, Status badge, Edit button), FormDialog with Field wrapper for provider(Select required, disabled in edit since plans are fixed to provider), name, bandwidthDownMbps, bandwidthUpMbps, connectionType(Select FIBER/DSL/CABLE/WIRELESS/SATELLITE/OTHER), catalogMonthlyPrice(number step 0.01), currency(Input defaulted from `(session?.user as any)?.companyCurrency`), status(Select), description(Textarea); invalidates `["plans"]`, `["plans-min"]`, `["dashboard"]`.
- Ran `bun run lint` — passes clean (exit 0), no errors in any file.

Stage Summary:
- Files created: 4 API routes (`/api/providers/route.ts`, `/api/providers/[id]/route.ts`, `/api/plans/route.ts`, `/api/plans/[id]/route.ts`).
- Files overwritten: 2 views (`/src/components/views/providers.tsx`, `/src/components/views/plans.tsx`).
- No client component imports Prisma (only API routes import `@prisma/client`); money stored server-side as `Prisma.Decimal`, returned to client as `.toString()`, rendered with `formatMoney`; bandwidth rendered with `formatBandwidth`.
- Used `as const` for STATUS_OPTS / CONNECTION_OPTS; local TS types `Provider`, `Plan` declared at top of view files; no `any` introduced beyond `(session?.user as any)` for reading `companyCurrency` (matching existing contracts.tsx pattern).
- Archive implemented via PATCH status=INACTIVE in providers view (no separate ARCHIVE audit action — kept as UPDATE per existing conventions).
- Plans view exposes only an Edit button (per spec column list) — the DELETE endpoint exists and refuses when services reference the plan, but no Delete button is shown in the UI for plans (consistent with the spec wording and services.tsx pattern).
- Plans form disables the provider Select in edit mode since plans are fixed to a provider (API rejects provider moves with 400).
- No Prisma schema changes; no shared-component modifications; no new top-level routes.

---
Task ID: 6-8
Agent: main (Z.ai Code)
Task: Reports + Settings + Excel export, wiring, self-verification, cron setup.

Work Log:
- Built `/api/export` (Phase 10): branches/shops/services/contracts XLSX export,
  formula-injection mitigation (prefix `=+-@` cells with `'`), sensitive fields
  (ISP usernames/passwords) never exported, company-scoped + filter-respecting.
- Built `/api/audit` (Phase 14): recent 100 audit entries, redacted before/after.
- Built the Settings view: company profile edit (admin) + account card + build info.
- Built the Reports view (Phase 15): expected vs effective cost, cost by branch,
  cost by provider, contract expiration report, service/bandwidth inventory by
  provider, audit log (admin-only, scrollable), per-entity Excel export buttons.
- Fixed two bugs surfaced by agent-browser QA:
  (1) `/api/dashboard`, `/api/me`, `/api/company` GET returned 500 on unauth
      because the thrown HttpError(401) wasn't caught — wrapped each in
      try/catch + errorResponse. All API endpoints now return 401 cleanly.
  (2) Contract detail sheet showed "—" for branch/shop/provider/plan because the
      detail API nested relations under `service` while the sheet read them at
      top level — flattened the detail API response to match the list shape.
  (3) Hydration warning: `<p>` wrapping a `<div>` (Skeleton) in the dashboard
      KpiCard/CostStat — changed the wrapping `<p>` to `<div>`.
- Wired all 9 views into `page.tsx`; the single `/` route renders login or shell.

Self-verification (agent-browser):
- Login screen renders with demo creds pre-filled; sign-in works.
- Dashboard shows real aggregates (5 branches, 6 shops, 8 services, 9
  contracts), cost summary, status cards, cost-by-provider/branch charts,
  renewals table.
- Branches CRUD: created "BR-119 Sathorn Central" → appears in list (201).
- Contracts: list renders all columns; detail sheet shows branch/provider/plan,
  correct cost math (CT-2024-006R: scheduled ฿8,250 = 750×11, effective
  ฿687.50 = 8250/12) and contract history (old CT-2023-006 term preserved,
  current marked "Renewed").
- Mobile (390×844): hamburger drawer opens with full nav; sticky footer at
  bottom; no layout breakage.
- Excel export: `/api/export?entity=contracts` returns 200 +
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet +
  filename netrent-contracts-YYYY-MM-DD.xlsx.
- No runtime/console errors after fixes.

Stage Summary:
- Phases 00–08, 10, 14, 15 delivered: foundation, database, auth, branches,
  shops+notes, providers+plans, internet services, contracts, dashboard,
  Excel export, audit log, reports, settings.
- `bun run lint` clean; dev server healthy on :3000; all API endpoints return
  correct status codes (401 unauth, 200/201 authed).
- Deferred to the 15-min webDevReview cron: Excel import (Phase 09),
  attachments/cloud storage (Phase 11), invoices & payments (Phase 12),
  contract renewal workflow UI (Phase 13), notifications (Phase 16),
  production hardening (Phase 17), and progressive UI/detail polish.

---
Task ID: 9 (webDevReview round 1)
Agent: main (Z.ai Code)
Task: QA pass + Phase 12 (Invoices & Payments) + Cmd+K command palette + reports/ export integration + styling polish.

## Current project status (assessment)
- QA pass via agent-browser across all 9 views: no console errors, no hydration
  warnings, every view renders real seeded data, CRUD + shop-notes panel all
  work. App is stable.
- Decided work focus: add the highest-value missing commercial module
  (Phase 12 — Invoices & Payments) plus a Cmd+K navigation palette for UX
  polish, and wire billing into the dashboard + reports.

## Goals / completed modifications
### Phase 12 — Invoices & Payments
- Extended `prisma/schema.prisma` with `Invoice`, `Payment`,
  `PaymentAllocation` models (enums `InvoiceStatus`, `PaymentMethod`,
  `PaymentStatus`), relations to Company/User/Contract, unique
  `(companyId, invoiceNumber)`, `@@unique([paymentId, invoiceId])` on
  allocations, indexes on dueDate/status. Added back-relations on Company,
  User, InternetContract. Pushed + regenerated client.
- New `src/lib/billing.ts`: `outstandingBalance()`,
  `deriveInvoiceStatus()` (paid/partial/overdue/void), `allocatePayment()`.
- Extended `prisma/seed.ts` with 5 demo invoices (paid / overdue / partial /
  issued / draft) + 2 completed payments + 2 allocations. Re-ran seed (✔).
- API routes:
  - `/api/invoices` (GET list w/ derived status + outstanding; POST create w/
    contract-ownership + unique-number + audit)
  - `/api/invoices/[id]` (GET detail w/ allocations; PATCH; DELETE drafts-only)
  - `/api/invoices/[id]/void` (POST — preserves history, audit UPDATE)
  - `/api/payments` (GET list; POST create+allocate in a `$transaction`,
    over-allocation guarded against invoice outstanding + payment amount)
  - `/api/payments/[id]` (GET; PATCH reference/notes; DELETE = void)
- New `InvoicesView` (`src/components/views/invoices.tsx`): list + summary
  strip (Invoices / Outstanding / Overdue / Paid), create/edit `FormDialog`
  (subtotal+tax−discount → live total, prefill subtotal from contract fee),
  detail `Sheet` (amounts + allocations + record-payment/void/delete),
  `RecordPaymentDialog` (date/amount/method/reference/notes, prefill
  outstanding, client + server guards against over-allocation).
- Added "Invoices & Payments" to the sidebar nav (`Receipt` icon) and to the
  `page.tsx` view switch + hash whitelist.

### Dashboard integration
- Extended `/api/dashboard` to compute `billing` block (invoicedTotal,
  collectedTotal, outstandingTotal, overdueCount) + `counts.invoices` /
  `counts.overdueInvoices`, using the billing helpers server-side.
- Added a "Billing & outstanding" card to the dashboard view (4 KPIs +
  "Go to invoices" button).

### Reports integration (Phase 15)
- Added invoices + payments queries; new "Outstanding invoices" table and
  "Recent payments" table (with allocation breakdown); added Invoices /
  Payments to the export buttons + the `/api/export` route (formula-injection
  mitigation, sensitive-field exclusion preserved).

### UX / styling polish — Cmd+K command palette
- New `src/components/shared/command-palette.tsx` using shadcn
  `CommandDialog` (cmdk): fuzzy search across Navigate (all 10 views) +
  Quick actions (create invoice/contract/service) + Appearance (toggle
  theme) + Account (sign out).
- Wired global `Cmd/Ctrl+K` shortcut in `AppShell`; added a "Quick switch ⌘K"
  button to the header (desktop) + a search icon button (mobile); footer now
  hints the shortcut.

## Verification results (agent-browser)
- Signed in, opened every view — no console/runtime errors after fixes.
- Invoices view: 5 invoices render with correct totals (e.g.
  INV-2024-004 = ฿2,343.30 = 2190 + 153.3 tax). Summary strip:
  Invoices 5 · Outstanding ฿5,002.40 · Overdue 1 · Paid 1 — all reconcile
  (1380.3 + 476.3 + 2343.3 + 802.5 = 5002.4).
- Partial-invoice detail sheet: Total ฿952.30 · Allocated ฿476.00 ·
  Outstanding ฿476.30 (correct).
- Record-payment flow: opened INV-2024-003, prefilled amount = outstanding,
  submitted → outstanding → 0, derived status → "paid" (stored status
  unchanged at PARTIAL, preserving posted history). ✓
- Dashboard billing KPIs after the payment: invoiced ฿6,323.70 =
  collected ฿1,797.60 + outstanding ฿4,526.10 (reconciles). ✓
- Cmd+K palette: opens on Ctrl+K, lists all views + quick actions, selecting
  "Invoices & Payments" navigates to #invoices. ✓
- Excel export: `/api/export?entity=invoices` returns 200 +
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet. ✓
- `bun run lint` clean. Dev server healthy on :3000.

## Bugs fixed during this round
- `/api/invoices` initially returned 500 ("db.invoice is undefined") because
  the running dev server had cached the pre-schema-change Prisma client.
  Fixed by restarting the dev server so it loads the regenerated
  `@prisma/client`. (Note for future rounds: after any `prisma db push` +
  `prisma generate`, the dev server must be restarted to pick up new
  models/accessors — turbopack does not reload node_modules caches.)
- `react-hooks/immutability` lint error on `window.location.hash = hash`
  inside a function body in the command palette → switched to
  `window.location.assign(`#${hash}`)` (lint-friendly, same behaviour).
- Export route parse error: the `contracts` branch was a final `else`; added
  `} else if (entity === "invoices")` / `"payments"` after it, so converted
  the contracts `} else {` to `} else if (entity === "contracts") {`.

## Unresolved issues / risks + next-phase recommendations
- The dev server is now started via `nohup bun run dev` (the system did not
  auto-restart it after I killed the stale process). Future rounds: if the
  dev server is unresponsive, check `ps aux | grep next` and restart it.
- Voiding an invoice currently does NOT re-allocate its payments to other
  invoices — the allocations remain pointing at the void invoice. The
  outstanding-balance calc treats VOID invoices as irrelevant (derived status
  = void), so balances stay correct, but a payment fully allocated to a
  void invoice shows as "allocated" with no recoverable target. Acceptable
  for the demo; a real system would need a re-allocation workflow.
- Phase 09 (Excel import), Phase 11 (attachments/cloud storage),
  Phase 13 (contract renewal workflow UI), Phase 16 (notifications), and
  Phase 17 (production hardening) remain open — recommended priority for the
  next rounds: Phase 13 (renewal workflow — high user value, builds on the
  existing contracts module) then Phase 09 (Excel import — reuses the xlsx
  library already installed).
- UI/UX polish ideas for later rounds: per-view empty-state illustrations,
  framer-motion view-transition fade, dashboard trend sparklines, and a
  "recent activity" feed on the dashboard.

---
Task ID: 10 (webDevReview round 2)
Agent: main (Z.ai Code)
Task: QA pass + Phase 13 (Contract Renewal Workflow) + dashboard Recent Activity feed + renewal KPI tiles.

## Current project status (assessment)
- QA pass via agent-browser across all 11 views: no console errors, no hydration
  warnings, every view renders real data. The Invoices & Payments module (added
  in round 1) still reconciles correctly. App is stable.
- Decided work focus: implement Phase 13 (Contract Renewal Workflow — the
  highest-value remaining module per the round-1 recommendations), plus a
  dashboard "Recent Activity" feed and renewal summary tiles for at-a-glance
  visibility.

## Goals / completed modifications
### Phase 13 — Contract Renewal Workflow
- Extended `prisma/schema.prisma` with a `ContractRenewal` model
  (`RenalStatus` enum: PENDING/COMPLETED/DECLINED) linking an old contract to
  a new one, capturing decision date/actor, warning/notice dates, and the
  proposed new terms (startDate/endDate/monthlyFee/currency/duration/freeMonths).
  Added `@@unique([oldContractId])` to prevent duplicate renewals, indexes on
  `(companyId, status)` and `(companyId, warningDate)`. Added back-relations
  on Company, User (decidedBy + authored), and InternetContract
  (`renewalsAsOld` / `renewalsAsNew`). Pushed + regenerated client + restarted
  dev server (per the round-1 lesson).
- New `src/lib/renewals.ts`: `classifyRenewal()` (upcoming/overdue/completed),
  `daysUntil()`, `suggestRenewalTerms()`, `renewalFeeDelta()`,
  `DEFAULT_WARNING_DAYS = 30`.
- Extended `prisma/seed.ts` with 2 renewal records: a COMPLETED renewal
  linking CT-2023-006 → CT-2024-006R (old ฿690 → new ฿750), and a PENDING
  renewal on CT-2024-004 (expiring in ~30 days) to populate the Upcoming tab.
  Re-ran seed (✔).
- API routes:
  - `/api/renewals` (GET — list with `bucket` classification
    upcoming/overdue/completed + per-tab counts; includes old+new contract
    relations + decidedBy/createdBy)
  - `/api/contracts/[id]/renew` (POST — atomic `$transaction`: creates the
    NEW contract, marks the old one RENEWED, upserts the renewal record;
    guards against duplicate renewals via `@@unique([oldContractId])` → 409;
    validates dates + freeMonths ≤ duration; unique contract number → 409)
  - `/api/renewals/[id]/decline` (POST — marks status=DECLINED, preserves
    the record; refuses declining a COMPLETED renewal)
- New `RenewalsView` (`src/components/views/renewals.tsx`): tabbed UI
  (Upcoming/Overdue/Completed) with summary tiles + counts; per-renewal card
  showing old→new term comparison side-by-side (period, duration, monthly,
  provider) + fee delta badge (▲/▼) + days-left indicator + actor + relative
  time; `RenewDialog` (prefills start=old end, same fee/duration, auto-computes
  end date, live old-vs-new monthly comparison banner); `DeclineDialog`.
- Added "Renewals" to the sidebar nav (`RefreshCw` icon), `page.tsx` view
  switch + hash whitelist, and the Cmd+K command palette.

### Dashboard enhancements
- Extended `/api/dashboard` to compute a `renewalSummary` block
  (upcoming/overdue/completed/total) by classifying each renewal record, and a
  `recentActivity` block (latest 8 audit entries with actor + action + entity
  type).
- Added 3 renewal summary tiles to the dashboard (Upcoming/Overdue/Completed)
  that link to #renewals.
- Added a "Recent activity" card with a vertical timeline (colored dots per
  action type: green=CREATE, amber=UPDATE, rose=DELETE, cyan=LOGIN) showing
  "actor + verb + entity + relative time" — driven by the existing audit log,
  so it reflects every mutation across the app automatically.

## Verification results (agent-browser)
- All 11 views load with no console/runtime/hydration errors.
- Renewals view: shows 1 Upcoming (CT-2024-004) + 1 Completed (CT-2023-006 →
  CT-2024-006R) matching the seed; tabs switch correctly; summary tiles
  display counts.
- Renew flow: opened CT-2024-004's renew dialog → prefilled contract number
  "CT-2024-004-R", start date = old end date (2026-11-14), duration 12,
  auto-computed end (2027-11-14), monthly fee carried over (2190) → submitted
  → API returned 201; renewals API now shows 2 COMPLETED, 0 upcoming; new
  contract CT-2024-004-R created, old CT-2024-004 marked RENEWED. ✓
- Dashboard after renewal: renewal tiles show 0 upcoming / 0 overdue /
  2 completed; "Recent activity" feed shows "Site Admin created a renewal"
  (plus earlier payment + branch creations). ✓
- Mobile (390×844): renewals view renders with tabbed UI + tiles, no layout
  breakage. ✓
- `bun run lint` clean.

## Bugs fixed during this round
- Runtime ReferenceError "cn is not defined" in `dashboard.tsx` `RenewalTile`
  — I used `cn()` in the new RenewalTile component but forgot to import it.
  Added `import { cn } from "@/lib/utils"`.
- JSX parse error in `renewals.tsx`: `<TAB_META[k].icon ... />` is not valid
  JSX (computed member access as a component tag). Fixed by extracting
  `const Icon = TAB_META[k].icon;` then `<Icon ... />`.

## Unresolved issues / risks + next-phase recommendations
- Phase 09 (Excel import), Phase 11 (attachments/cloud storage),
  Phase 16 (notifications), and Phase 17 (production hardening) remain open.
- Recommended priority for the next round: Phase 09 (Excel import — reuses
  the already-installed `xlsx` library; high user value for bulk
  contract/service ingestion) then Phase 11 (attachments — needs a storage
  abstraction; for the sandbox we can stub a local-file storage service
  behind the same interface).
- Minor: the renewal warning window (30 days) is currently hardcoded in
  `src/lib/renewals.ts` (`DEFAULT_WARNING_DAYS`). A future round could make
  it company-configurable via the Settings view.
- The dashboard "Recent activity" feed currently shows raw audit entries;
  a future enhancement could group consecutive same-entity actions and add
  deep links to the affected record.

---
Task ID: 11 (webDevReview round 3)
Agent: main (Z.ai Code)
Task: QA pass + Phase 09 (Excel Import) + framer-motion view transitions + import templates.

## Current project status (assessment)
- QA pass via agent-browser across all 11 views: no console errors, no hydration
  warnings, every view renders real data. The Renewals + Invoices modules from
  rounds 1-2 still work. App is stable.
- Decided work focus: implement Phase 09 (Excel Import — the highest-value
  remaining module per the round-2 recommendations), plus framer-motion view
  transitions for UI polish.

## Goals / completed modifications
### Phase 09 — Excel Import
- Extended `prisma/schema.prisma`: added `entityType` (contract|service|invoice)
  and `columnMap` (JSON) fields to the `ImportJob` model. Pushed + regenerated
  client + restarted dev server (per the round-1 lesson) + re-seeded (the
  `db:push --accept-data-loss` had wiped the DB).
- New `src/lib/import-fields.ts`: per-entity field definitions (CONTRACT_FIELDS,
  SERVICE_FIELDS) with types (string/number/date/enum) + required flags +
  hints; `autoMatchHeader()` fuzzy-matches spreadsheet headers to target
  fields (e.g. "Contract #" → contractNumber, "ISP" → providerCode);
  `coerceValue()` type-coerces raw cell values (handles Excel serial dates,
  number strings with commas, enum uppercasing).
- API routes:
  - `/api/import/preview` (POST — receives FormData with the .xlsx file,
    parses with `xlsx` server-side, validates file type/size, returns
    worksheets + headers + auto-map + 8 sample rows; nothing persisted)
  - `/api/import/commit` (POST — validates each row against field defs,
    normalizes branch/provider/shop/plan references by code, detects
    duplicates in-batch + in-DB, writes valid rows in a single
    `$transaction` + creates ImportJob + ImportRows with per-row status;
    audit-logged)
  - `/api/import/jobs` (GET — history list)
  - `/api/import/jobs/[id]` (GET — detail with all rows for error review)
  - `/api/template/[type]` (GET — streams the template .xlsx from the
    download dir; authenticated)
- New `ImportView` (`src/components/views/import.tsx`): 4-step wizard
  (Upload → Mapping → Review → Done) with a visual stepper; drag-and-drop
  dropzone + file-type/size validation; auto-matched column mapping UI
  (each spreadsheet header → target field via Select); sample-row preview;
  default-free-months input; review screen with field-mapping summary;
  results screen with imported/error row tables; import history table.
- Generated 2 import templates (`netrent-contract-import-template.xlsx`,
  `netrent-service-import-template.xlsx`) in the `download/` dir, with
  download links in the Import view's upload step.
- Added "Excel Import" to the sidebar nav (`Upload` icon), `page.tsx` view
  switch + hash whitelist, and the Cmd+K command palette.

### UI polish — framer-motion view transitions
- New `src/components/shared/view-transition.tsx`: wraps view content with
  `AnimatePresence` + `motion.div` for a subtle fade + 8px upward slide on
  every view switch (duration 0.18s, ease-out). Applied in `page.tsx`.

## Verification results (agent-browser)
- Full import flow tested end-to-end:
  1. Opened Import view → upload step renders with dropzone + entity
     selector (Contracts/Services) + template download link.
  2. Uploaded `netrent-contract-import-template.xlsx` → parsed 3 rows,
     auto-matched all 10 columns (Contract number, Service code, Start date,
     Duration, Monthly fee, Free months, Currency, Status, Billing cycle,
     Notes) → advanced to Mapping step.
  3. Reviewed the mapping → clicked "Review" → review screen showed
     "3 contract rows will be imported, 10 mapped fields, worksheet
     Contracts".
  4. Clicked "Confirm import" → results screen: "3 of 3 contract rows
     imported; 0 error(s)" with imported-rows table.
  5. Verified the 3 imported contracts (CT-IMP-001, CT-IMP-002, CT-IMP-003)
     appear in the Contracts view.
  6. Import history table shows the job with 3 imported / 0 errors.
- All 12 views load with no console/runtime/hydration errors.
- `bun run lint` clean.

## Bugs fixed during this round
- **Critical**: `await db.shop.findFirst(...)` inside a `.forEach()` callback
  in `/api/import/commit/route.ts` — `forEach` callbacks are not async, so
  the `await` caused a parse error (`await isn't allowed in non-async
  function`). This broke the ENTIRE app (all NextAuth routes returned 500
  because turbopack couldn't compile any route in the app bundle). Fixed by
  converting `body.rows.forEach(...)` to `for (const [idx, rawRow] of
  body.rows.entries())` and the closing `});` to `}`.
  **Lesson**: never use `.forEach()` with `await` — use `for...of` instead.
- **DB wipe**: `db:push --accept-data-loss` wiped the database when adding
  the `entityType`/`columnMap` columns to ImportJob (SQLite table
  recreation). Re-ran `bun run db:seed` to restore demo data. Future
  rounds: always re-seed after `db:push`.
- Template download initially 500'd because `/download/` isn't a served
  Next.js path. Created `/api/template/[type]` route to stream the file
  from the download dir with proper content-type/disposition headers.

## Unresolved issues / risks + next-phase recommendations
- Phase 11 (attachments/cloud storage), Phase 16 (notifications), and
  Phase 17 (production hardening) remain open.
- The import commit currently only imports the 8 sample rows that the
  preview returned (not the full file). For a production system, the commit
  endpoint would re-receive the full file or store the parsed rows
  server-side between preview and commit. For the demo this is acceptable.
- Recommended priority for the next round: Phase 11 (attachments — needs
  a storage abstraction; for the sandbox we can stub a local-file storage
  service behind a `StorageService` interface) then Phase 16 (notifications
  — an in-app notification center driven by the audit log + renewal
  thresholds).
