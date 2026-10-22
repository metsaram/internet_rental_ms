# NetRent — Technology Stack

## Core Technologies
- **Runtime**: Bun / Node.js 18+
- **Framework**: Next.js 16 (App Router with Turbopack)
- **Language**: TypeScript 5 (Strict Mode enabled)
- **Database & ORM**: 
  - Prisma ORM 5.x
  - Target: Supabase PostgreSQL (with direct connection & transaction pooler support)
  - Local/Dev: SQLite (`db/custom.db`)
- **Authentication**: NextAuth.js v4 (Credentials provider, JWT session strategy, Node.js native `scrypt` password hashing)

## Frontend & UI System
- **Styling**: Tailwind CSS 4
- **Component Library**: shadcn/ui (New York style) + Radix UI primitives
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Data Visualization**: Recharts
- **Toast Notifications**: Sonner
- **Client State & Caching**: TanStack Query (React Query) v5

## Backend & Utilities
- **Validation**: Zod
- **Spreadsheet Processing**: SheetJS (`xlsx`) for tabular import and export
- **Reverse Proxy / Local Gateway**: Caddyfile (Port 81 → 3000 mapping)
- **Rate Limiting**: Token-bucket in-memory rate limiter with auto-cleanup

## Testing & Quality Assurance
- **Test Framework & Runner**: Vitest (v5+)
- **DOM Environment**: JSDOM
- **Component Testing**: `@testing-library/react` (React 19 support)
- **Custom DOM Matchers**: `@testing-library/jest-dom`
- **Simulated Interactions**: `@testing-library/user-event`
- **Coverage Engine**: `@vitest/coverage-v8` (V8 code coverage provider)
- **Component Verification Policy**: Mandatory automated test verification for all newly added UI, view, and shared components

