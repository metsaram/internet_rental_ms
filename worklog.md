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
