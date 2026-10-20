# Task 5-c/5-d — full-stack-developer (providers + plans)

## Scope
Implement Providers CRUD (Phase 05) + Plans CRUD (Phase 05).

## Files created
- `src/app/api/providers/route.ts` — GET (search by code/name/contactPerson, status ALL/ACTIVE/INACTIVE, `min=true` returns `{id,code,name,status}`, full payload includes `_count.plans` + `_count.services`) + POST (zod-validated, unique `(companyId,code)` → 409, writeAudit CREATE).
- `src/app/api/providers/[id]/route.ts` — GET one (with `_count`) + PATCH (unique code on change, writeAudit UPDATE) + DELETE (refuses if plans OR services reference it → 400 "Provider has plans or services; archive instead"; writeAudit DELETE).
- `src/app/api/plans/route.ts` — GET (search by name, status filter, `provider` filter by providerId, `min=true` returns `{id,name,providerId,bandwidthDownMbps,status}`, full payload includes `provider:{id,code,name}` + `_count.services`) + POST (zod-validated with `z.coerce.number()` for numerics, provider ownership check, unique `(companyId,providerId,name)` → 409, `catalogMonthlyPrice` stored as `new Prisma.Decimal(value)`, currency defaults to `user.companyCurrency`, writeAudit CREATE).
- `src/app/api/plans/[id]/route.ts` — GET one (with provider + `_count.services`) + PATCH (disallows changing providerId → 400 "Plan cannot be moved between providers"; enforces unique name-on-provider on change; `catalogMonthlyPrice` re-stored as `new Prisma.Decimal`; writeAudit UPDATE) + DELETE (refuses if services reference it → 400 "Plan is referenced by services; archive instead"; writeAudit DELETE).

## Files overwritten
- `src/components/views/providers.tsx` — full CRUD view: PageHeader + "New provider" + DataTable (search + status FilterSelect) with columns (Code+name, Contact, Phone, Email, Plans count, Services count, Status badge, Edit/Archive/Delete). FormDialog with Field wrapper for code/name/contactPerson/phone/email/website/status(Select)/notes(Textarea). Archive = PATCH status=INACTIVE with confirm + toast. Delete confirm dialog. Invalidates `["providers"]`, `["providers-min"]`, `["dashboard"]`.
- `src/components/views/plans.tsx` — full CRUD view: PageHeader + "New plan" (disabled when no providers exist; amber hint linking to #providers). DataTable with search + provider filter Select (All providers + each provider) + status FilterSelect. Columns: Name+provider sub-line, Bandwidth ↓↑ via `formatBandwidth`, Connection type, Catalog price via `formatMoney`, Services count, Status badge, Edit button. FormDialog fields: provider (required Select, disabled in edit), name, bandwidthDownMbps, bandwidthUpMbps, connectionType (Select FIBER/DSL/CABLE/WIRELESS/SATELLITE/OTHER), catalogMonthlyPrice (number step 0.01), currency (Input defaulted from `(session?.user as any)?.companyCurrency`), status (Select), description (Textarea). Invalidates `["plans"]`, `["plans-min"]`, `["dashboard"]`.

## Conformance
- All API handlers call `requireUser()` and scope by `user.companyId`.
- All mutations call `writeAudit()`; `redactSensitive()` applied to payload summaries (defensive — no truly sensitive fields here, but matches the canonical pattern).
- No Prisma imports in client components (only in API routes). `Prisma.Decimal` used server-side for money; client renders via `formatMoney` / `formatBandwidth` only.
- `as const` used for STATUS_OPTS / CONNECTION_OPTS in both views.
- Local TS types `Provider` (in both views — different shapes) and `Plan` declared at top of view files.
- No `any` introduced beyond `(session?.user as any)` for reading `companyCurrency` (matches existing contracts.tsx pattern).
- Archive implemented via PATCH status=INACTIVE — no new ARCHIVE audit action (kept as UPDATE per existing conventions).
- Plans form disables the provider Select in edit mode (plans are fixed to a provider; API rejects provider moves with 400).
- Plans view exposes only an Edit button per spec column list — DELETE endpoint exists for completeness/future use but no Delete button is shown.

## Lint
`bun run lint` exits 0 (clean) for all files in the repo.

## No deviations from spec
- All required endpoints, fields, and UX behaviours are present.
- Did NOT modify the Prisma schema, shared components, or other views.
- Did NOT create new top-level routes.
- Existing contract prices are not touched when catalog plan prices change (contracts store their own `monthlyFee` — structurally guaranteed; no changes to contracts on plan update).
