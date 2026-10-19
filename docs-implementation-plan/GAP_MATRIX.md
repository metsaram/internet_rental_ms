# NetRent — Revised Module Audit Gap Matrix

> Generated from `netrent_revised_module_audit_improvement_plan.md`
> Verification date: 2026-10-19

## Summary

| Phase | Priority | Status | Action |
|-------|----------|--------|--------|
| 0 — Baseline | Required | ✅ Done | This document |
| 1 — Auth/Isolation/Lifecycle | P0 | ✅ Implemented | No action needed |
| 2 — Tables/Mobile/Health | P1 | ✅ Implemented | No action needed |
| 3 — Billing/Payments | P0 | ✅ Implemented | No action needed |
| 4 — Import/Bulk | P1 | ✅ Implemented | No action needed |
| 5 — Redundancy matrix | P2 | ❌ Missing | **Implementing this round** |
| 6 — Outage/SLA | P2 | ❌ Missing | **Implementing this round** |
| 7 — Cost-per-Mbps | P2 | ❌ Missing | **Implementing this round** |

## Phase 1 — Authorization, company isolation, record lifecycle

| Requirement | Existing implementation | Status |
|-------------|--------------------------|--------|
| User management UI | `src/components/views/settings.tsx` → `UsersSection` | ✅ |
| User API (create/disable/reset) | `/api/users` (GET/POST), `/api/users/[id]` (PATCH) | ✅ |
| Role-based access | `requireUser()` / `requireAdmin()` in `src/lib/session.ts` | ✅ (ADMIN/STAFF only; plan mentions MANAGER/VIEWER — business decision) |
| Editable company profile | `/api/company` (GET/PATCH), Settings view | ✅ |
| CRUD for all entities | 46 API routes covering all 29 models | ✅ |
| Delete safety (FK guards) | All DELETE handlers refuse when referenced | ✅ |
| Audit trail | `writeAudit()` on all mutations; 28 routes call it | ✅ |
| Company isolation | Every query scopes by `user.companyId` | ✅ |
| Password redaction | `redactSensitive()` strips passwords from audit | ✅ |

## Phase 2 — Shared table experience, mobile, health

| Requirement | Existing implementation | Status |
|-------------|--------------------------|--------|
| Search/filter/pagination | `DataTable` component with search, `FilterSelect`, pagination | ✅ |
| Keyboard navigation | j/k/Enter/?/Esc in `DataTable` | ✅ |
| Loading/empty/error states | `Skeleton`, `EmptyState` (with illustration), `toast` errors | ✅ |
| Mobile bottom nav | `MobileBottomNav` component (5 primary + More) | ✅ |
| Health endpoint | `/api/health` (GET, unauthenticated, no secrets) | ✅ |

## Phase 3 — Billing, partial payments, payment ledger

| Requirement | Existing implementation | Status |
|-------------|--------------------------|--------|
| Record Payment modal | `RecordPaymentDialog` in `invoices.tsx` | ✅ (partial+full, method, reference, date, notes) |
| Outstanding balance display | Shows total/allocated/outstanding before submission | ✅ |
| Payment ledger | `/api/payments` (GET), Reports view "Recent payments" table | ✅ |
| Void/reversal | DELETE on `/api/payments/[id]` = marks VOID (preserves history) | ✅ |
| Balance derivation | `outstandingBalance()` + `deriveInvoiceStatus()` in `billing.ts` | ✅ |
| Atomic mutations | `$transaction` on payment+allocation creation | ✅ |
| Over-allocation guard | Server validates amount ≤ outstanding | ✅ |
| Audit on financial mutations | `writeAudit()` on all invoice/payment routes | ✅ |

## Phase 4 — Import and bulk operations

| Requirement | Existing implementation | Status |
|-------------|--------------------------|--------|
| Two-step import (preview→commit) | `/api/import/preview` + `/api/import/commit` | ✅ |
| Row-level validation errors | Commit returns per-row status + message | ✅ |
| Duplicate detection | In-batch + in-DB unique constraint checks | ✅ |
| Import history | `/api/import/jobs` + Import view history table | ✅ |
| Bulk contract status | `/api/contracts/bulk-status` (POST, tx, company-scoped) | ✅ |
| Bulk selection UI | Checkboxes + toolbar in Contracts view | ✅ |
| Audit on batch operations | `writeAudit()` with count + IDs on bulk | ✅ |

## Phase 5 — Connectivity redundancy matrix

| Requirement | Existing | Status |
|-------------|----------|--------|
| Primary/backup circuit designation | ❌ No `circuitRole` field on `InternetService` | **Missing** |
| Redundancy classification | ❌ No API or logic | **Missing** |
| Dashboard shop resilience count | ❌ | **Missing** |
| Reports redundancy card | ❌ | **Missing** |

**Implementation plan:** Add `circuitRole` enum (PRIMARY/BACKUP) to `InternetService`.
Add `/api/reports/redundancy` endpoint. Add a redundancy card to the Reports view.

## Phase 6 — Outage tracking and SLA credit support

| Requirement | Existing | Status |
|-------------|----------|--------|
| Incident model | ❌ No `OutageIncident` model | **Missing** |
| Availability calculation | ❌ | **Missing** |
| SLA credit estimation | ❌ | **Missing** |
| Outages view | ❌ | **Missing** |

**Implementation plan:** Add `OutageIncident` model (circuitId, start/end, type, notes).
Add `/api/outages` CRUD. Add `/api/reports/availability` endpoint. Add an Outages view.

## Phase 7 — Cost-per-Mbps reporting

| Requirement | Existing | Status |
|-------------|----------|--------|
| Cost-per-Mbps calculation | ❌ | **Missing** |
| Bandwidth normalization | ✅ `formatBandwidth()` exists, but no per-Mbps calc | Partial |
| Reports card | ❌ | **Missing** |

**Implementation plan:** Add `/api/reports/cost-per-mbps` endpoint. Add a card to the Reports view.
