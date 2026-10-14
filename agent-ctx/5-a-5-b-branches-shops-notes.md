# Task 5-a/5-b — full-stack-developer (branches + shops + notes)

## Scope
Implement Branches CRUD (Phase 03) + Shops & Notes CRUD (Phase 04).

## Files created
- `src/app/api/branches/route.ts` — GET (search, status, min flag, `_count`) + POST (zod, unique `(companyId,code)` 409, writeAudit).
- `src/app/api/branches/[id]/route.ts` — GET one + PATCH (unique code on change, writeAudit) + DELETE (refuses if shops or services reference it → 400, writeAudit).
- `src/app/api/shops/route.ts` — GET (search, status, min flag, branch + `_count.services`) + POST (branch ownership, unique code, writeAudit).
- `src/app/api/shops/[id]/route.ts` — GET one (branch, `_count.services`, notes with author ordered desc) + PATCH (branch ownership + unique code on change, writeAudit) + DELETE (refuses if services reference it → 400, writeAudit).
- `src/app/api/notes/route.ts` — POST create (`{shopId, body}`, shop ownership, authorId = user.id, writeAudit).
- `src/app/api/notes/[id]/route.ts` — DELETE (joins via note→shop→company; STAFF may delete only own; ADMIN any; writeAudit).

## Files overwritten
- `src/components/views/branches.tsx` — full CRUD view: PageHeader + "New branch" + DataTable (search + status FilterSelect) with columns (Code+name, City, Manager, Phone, Shops count, Services count, Status badge, Edit/Archive/Delete). FormDialog with Field wrapper for code/name/address/city/manager/phone/email/status. Archive = PATCH status=INACTIVE with confirm + toast. Delete confirm dialog. Invalidates `["branches"]`, `["branches-min"]`, `["dashboard"]`.
- `src/components/views/shops.tsx` — full CRUD view + Sheet detail (row click). Columns: Code+name, Branch, Type (Badge), Contact, Phone, Services count, Status, Edit/Archive/Delete. Sheet shows branch/type/contact/address/services count + Notes panel (textarea + Add button + list with author + relative time + per-note delete button disabled for non-author/non-admin). FormDialog fields branch (required Select), code, name, type (Select UNIT/KIOSK/OFFICE/RESTAURANT/OTHER), contactPerson, phone, email, address, status. Invalidates `["shops"]`, `["shops-min"]`, `["dashboard"]` on shop mutations; `["shop", shopId]` on note add/delete (detail refetched via useQuery).

## Conformance
- All API handlers call `requireUser()` and scope by `user.companyId`.
- All mutations call `writeAudit()`.
- No Prisma imports in client components (only in API routes).
- `as const` used for STATUS_OPTS / TYPE_OPTS.
- Local TS types `Branch`, `Shop`, `ShopNote`, `ShopDetail` declared at top of view files.
- No `any` introduced beyond `(session?.user as any)` for accessing session claims (matches existing contracts.tsx pattern).
- Archive implemented via PATCH status=INACTIVE — no new ARCHIVE audit action (kept as UPDATE per existing conventions in services API).
- Radix Select uses `value="none"` sentinel in services.tsx pattern; both branches and shops forms only have required selects / explicit status selects, so no "none" sentinel needed here.

## Lint
`bun run lint` exits 0 (clean) for all files in the repo.

## No deviations from spec
- All required endpoints, fields, and UX behaviours are present.
- Did NOT modify the Prisma schema, shared components, or other views.
- Did NOT create new top-level routes.
