# NetRent — Architecture & Design

## Architectural Pattern
NetRent follows a clean client-server architecture built on Next.js 16 with the App Router:
- **Client Frontend**: React 19 client components structured as lazy-loaded views driven by URL hash state (`#dashboard`, `#branches`, `#contracts`, etc.). Server actions are intentionally avoided in favor of typed REST-like API route handlers.
- **API Layer**: Next.js App Router Route Handlers located under `src/app/api/`. Every endpoint enforces session authentication (`requireUser()` or `requireAdmin()`) and multi-tenant scoping (`user.companyId`).
- **Domain & Business Logic**: Server-only helper modules in `src/lib/` encapsulate business rules:
  - `contracts.ts`: Decimal-precision math for free months, scheduled totals, and effective monthly costs.
  - `billing.ts`: Invoice outstanding calculations, status derivations, and payment allocation algorithms.
  - `renewals.ts`: Renewal term suggestions, delta math, and threshold tracking.
  - `notifications.ts`: Idempotent notification generation.
  - `audit.ts`: Mutation logging with secret redaction.
- **Data Persistence**: Prisma ORM with connection pooling to PostgreSQL (hosted on Supabase) or local SQLite for development.

## Data Flow Diagram
```
Client Browser (Hash-based SPA)
       │  ▲
       │  │ JSON (Fetch via src/lib/api-client.ts + TanStack Query)
       ▼  │
Next.js Route Handlers (`src/app/api/*`)
       │
       ├─► Session & Scope Verification (`src/lib/session.ts`)
       ├─► Rate Limiting (`src/lib/rate-limit.ts`)
       ├─► Business Logic & Math (`src/lib/contracts.ts`, `billing.ts`, etc.)
       ├─► Audit Logging (`src/lib/audit.ts`)
       ▼
Prisma ORM (`src/lib/db.ts`)
       ▼
Database (Supabase PostgreSQL / SQLite)
```

## Security & Isolation
1. **Multi-Tenancy**: All database queries MUST explicitly include `where: { companyId: user.companyId }` or enforce relation constraints.
2. **Credential Redaction**: Passwords, tokens, and ISP login credentials are automatically redacted before responding to clients or writing to audit logs.
3. **HTTP Hardening**: Strict headers configured in `next.config.ts` (Content Security Policy, HSTS, X-Frame-Options, X-Content-Type-Options).
