# NetRent — Internet Rental Management System

A production-ready Next.js 16 + TypeScript + Prisma application for managing
internet rental operations across branches, shops, providers, plans, services,
contracts, invoices, and renewals.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict)
- **Database**: Prisma ORM (SQLite in dev; PostgreSQL-ready for production)
- **Auth**: NextAuth.js v4 (credentials provider, JWT sessions, scrypt-hashed passwords)
- **UI**: Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons + Framer Motion
- **State**: TanStack Query (server) + React state (client)
- **Charts**: Recharts
- **Excel**: SheetJS (xlsx) for import/export

## Features

- **Dashboard** with real-time KPIs, cost-trend chart, billing summary, renewal
  tiles, recent-activity feed, and quick-status pills
- **Branches & Shops** CRUD with search/filter/pagination + shop notes
- **Providers & Plans** master-data management with referential integrity guards
- **Internet Services** inventory with sensitive-credential redaction
- **Contracts** with Decimal-precise cost math (free-month normalization), bulk
  status updates, and contract history
- **Invoices & Payments** with allocations, outstanding-balance derivation,
  void/preserve-history flows, and a print-friendly invoice template
- **Contract Renewals** workflow (upcoming/overdue/completed tabs, old→new
  term comparison, atomic renewal in a transaction)
- **Excel Import** wizard (upload → preview → map columns → validate → commit
  in a transaction, with import history + templates)
- **Excel Export** for branches/shops/services/contracts/invoices/payments with
  formula-injection mitigation
- **Attachments** with a StorageService abstraction (local-fs in dev, S3-ready)
- **Notifications** center driven by renewal + billing thresholds
- **Audit Log** of all mutations with sensitive-field redaction
- **Reports**: cost by branch/provider, contract expiration, outstanding
  invoices, payment summary, and a scheduled-vs-invoiced variance report
- **User Management** (admin-only): create/disable accounts, reset passwords,
  role management with lockout protections
- **Production Hardening**: security headers (CSP/HSTS/X-Frame-Options/etc.),
  rate limiting on auth, error boundary, 404 page, health endpoint
- **UX Polish**: Cmd+K command palette with recently-viewed, keyboard shortcuts
  (j/k/Enter/?/Esc), mobile bottom navigation, dark mode, animated KPIs,
  lazy-loaded views for code-splitting

## Getting Started

### Prerequisites

- Node.js 18+ / Bun
- A PostgreSQL database (or SQLite for local dev)

### Installation

```bash
# Install dependencies
bun install

# Copy env and set values
cp .env.example .env
# Edit .env: set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

# Push schema + seed demo data
bun run db:push
bun run db:seed

# Start dev server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with:

| Role  | Email                  | Password    |
|-------|------------------------|-------------|
| Admin | admin@netrent.local    | admin12345  |
| Staff | staff@netrent.local    | staff12345  |

### Available Scripts

| Script              | Description                          |
|---------------------|--------------------------------------|
| `bun run dev`       | Start dev server (port 3000)        |
| `bun run lint`      | Run ESLint                           |
| `bun run db:push`   | Push Prisma schema to database       |
| `bun run db:seed`   | Seed demo data (idempotent)          |
| `bun run db:generate`| Regenerate Prisma Client            |

## Architecture

The app runs as a single-page shell on `/` with client-side view switching
driven by the URL hash (`#dashboard`, `#contracts`, ...). All data/mutations go
through `/api/*` route handlers (no server actions). Business rules live in
`src/lib/` domain modules, not in UI components.

```
src/
├── app/
│   ├── api/           # Route handlers (auth, CRUD, export, import, etc.)
│   ├── error.tsx      # Global error boundary
│   ├── loading.tsx    # Root loading state
│   ├── not-found.tsx  # 404 page
│   ├── layout.tsx     # Root layout (providers, fonts)
│   └── page.tsx       # Single-page shell (lazy-loaded views)
├── components/
│   ├── ui/            # shadcn/ui primitives
│   ├── shared/        # DataTable, FormDialog, StatusBadge, etc.
│   ├── views/         # 13 view components
│   └── app-shell.tsx  # Sidebar + topbar + footer + bottom nav
├── lib/
│   ├── auth.ts        # NextAuth config
│   ├── session.ts     # requireUser/requireAdmin/HttpError
│   ├── db.ts          # Prisma Client
│   ├── contracts.ts   # Cost math
│   ├── billing.ts     # Invoice/payment math
│   ├── renewals.ts    # Renewal classification
│   ├── notifications.ts # Notification generation
│   ├── storage.ts     # File storage abstraction
│   ├── rate-limit.ts  # In-memory rate limiter
│   ├── audit.ts       # Audit logging + redaction
│   └── format.ts      # Money/date/bandwidth formatters
└── prisma/
    ├── schema.prisma  # Full domain model
    └── seed.ts        # Repeatable demo seed
```

## Security

- Company-scoped queries on every API route (multi-tenant isolation)
- Passwords hashed with Node's scrypt (no native deps)
- ISP credentials stored server-side only; redacted in lists/exports/audit
- Rate limiting on auth (10 attempts/min per email)
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
- Input validation via Zod on all API routes
- Excel export mitigates CSV formula injection

## License

This is a demo project. See the implementation-plan documents in
`docs-implementation-plan/` for the full phase-by-phase specification.
