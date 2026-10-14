# Global Implementation Rules

Read this file before every phase. Implement one phase at a time and
stop for approval after completing it.

## Workflow

1.  Inspect the existing repository, package scripts, dependencies,
    routes, Prisma schema, tests, and documentation before editing.
2.  Summarize the current state and make a short plan.
3.  Preserve working functionality from previous phases. Do not recreate
    the app or rewrite files wholesale without a clear reason.
4.  Implement only the assigned phase plus essential integration
    changes.
5.  Add/update tests and documentation.
6.  Run the relevant lint, type-check, tests, Prisma
    validation/generation, and production build commands that exist.
7.  Fix regressions introduced by the changes. Never claim a command
    passed unless it was run.
8.  Report files changed, schema/migration impact, commands/results,
    environment/manual steps, acceptance checklist, known issues, and
    next phase.
9.  Stop and wait for approval. Do not automatically start the next
    phase.

## Stack

Next.js App Router, TypeScript strict mode, PostgreSQL, Prisma,
Auth.js/NextAuth-compatible authentication, Tailwind CSS, Zod, React
Hook Form where useful, TanStack Table for data-heavy tables, XLSX
support, cloud object storage, Vercel deployment. Inspect installed
versions before changing dependencies.

## Architecture

Prefer Server Components. Use Client Components only for necessary
interactivity. Use Server Actions or Route Handlers for mutations. Keep
business rules in domain/service modules rather than UI components.
Validate untrusted input on the server. Enforce permissions on every
protected server operation. Avoid N+1 queries and use server-side
pagination for large datasets. Use transactions for atomic multi-record
operations.

## Data rules

Use Decimal for persisted money, timezone-aware timestamps
(`timestamptz` semantics), foreign keys, indexes, and appropriate unique
constraints. Preserve financial/audit history. Scope all company-owned
reads and writes by company to prevent cross-company data leakage. Apply
the project convention where appropriate: `company_id bigint not null`
on company-scoped business tables; `int` for ordinary entity IDs and
`bigint` for high-volume transactional IDs. Keep related key types
consistent and document deviations. Do not assume a value is globally
unique unless the business rules establish it.

## Domain model

Keep these concepts separate: - Provider: Internet company/vendor. -
Plan: reusable package/catalog definition. - Service: actual installed
Internet connection. - Contract: commercial agreement and agreed price
terms. - Invoice: bill for a billing period. - Payment: money paid and
allocated to invoice(s).

A service may have contract history. Do not silently overwrite
historical contract terms. Define deletion behavior deliberately;
financial/audit records should not be cascade-deleted.

## Security and Vercel

Never commit secrets or real credentials. Include `.env.example`
placeholders only. Hash passwords securely. Protect ISP credentials and
redact them from logs, exports, and audit payloads. Use private object
storage and authorized downloads/short-lived signed URLs. Validate
uploads. Do not rely on local filesystem persistence, long-lived
in-process timers, or unsupported Edge Runtime dependencies. Generate
Prisma Client in the appropriate build flow. Use `prisma migrate deploy`
for production migrations, not `migrate dev`. Design large import/export
work within serverless limits or use staged/asynchronous jobs.

## Completion report

1.  Summary
2.  Files changed
3.  Database/schema changes
4.  Commands/tests run with actual outcomes
5.  Environment variables/manual setup
6.  Acceptance checklist
7.  Known issues/deferred work
8.  Recommended next phase
