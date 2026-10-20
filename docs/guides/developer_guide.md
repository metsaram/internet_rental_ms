# NetRent — Developer Guide

## Local Development Workflow

### Prerequisites
- Node.js 18+ or Bun
- Supabase Project or local SQLite database

### Quick Start
```bash
# 1. Install dependencies
bun install

# 2. Environment Configuration
cp .env.example .env
# Configure DATABASE_URL, DIRECT_URL, and NEXTAUTH_SECRET in .env

# 3. Generate Prisma Client & Migrate
bun run db:generate
bun run db:deploy

# 4. Seed database with demo accounts
bun run db:seed

# 5. Launch development server
bun run dev
```

### Key NPM/Bun Scripts
| Script | Command | Purpose |
|---|---|---|
| Dev Server | `bun run dev` | Runs Next.js with Turbopack on port 3000 |
| Lint | `bun run lint` | Runs ESLint checks |
| DB Push | `bun run db:push` | Pushes Prisma schema directly to DB |
| DB Migrate | `bun run db:migrate` | Runs development migrations |
| DB Deploy | `bun run db:deploy` | Applies checked-in production migrations |
| DB Seed | `bun run db:seed` | Populates demo data (idempotent) |
| DB Generate | `bun run db:generate` | Rebuilds Prisma client types |

### Coding Patterns & Conventions

#### 1. Hash-Based Navigation
All views are rendered in `src/app/page.tsx` based on `window.location.hash`.
When navigating programmatically, use:
```typescript
window.location.assign('#' + targetView);
```
Avoid assigning to `window.location.hash` directly to comply with React hook immutability rules.

#### 2. Client-Side Data Fetching
Views use TanStack Query with our typed fetch wrapper `@/lib/api-client`:
```typescript
const { data, isLoading } = useQuery<Service[]>({
  queryKey: ["services"],
  queryFn: () => api<Service[]>("/api/services"),
});
```

#### 3. Forms & Dialogs
Use `FormDialog` and `Field` from `@/components/shared/form-dialog`.
Always supply `value="none"` for optional relations in dropdowns:
```typescript
<Select value={field.value ?? "none"} onValueChange={(val) => field.onChange(val === "none" ? null : val)}>
```

#### 4. Formatting Money & Dates
Always import from `@/lib/format`:
```typescript
import { formatMoney, formatDate } from "@/lib/format";
```
Never import `@prisma/client` inside client component files.
