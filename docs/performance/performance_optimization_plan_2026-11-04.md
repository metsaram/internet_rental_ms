# NetRent — Performance Optimization Process Plan

**Date**: 2026-11-04  
**Version**: 1.0 (Post-Assessment Revision)  
**Status**: Approved — Proceed with Phase 1  
**Context**: Follow-up to [Database Latency Investigation (2026-11-03)](./database_latency_analysis_2026-11-03.md)  
**Infrastructure Constraint**: Supabase region migration (Sydney → Singapore) is **deferred**. All optimizations in Phases 1–3 must work within the existing Sydney region.

---

## Assessment Summary

> The initial investigation correctly identified the right areas of concern. However, several technical conclusions required revision before treating the report as a final optimization plan. This document incorporates those revisions and defines an actionable roadmap.

### Revised Root Cause Statement

The initial report concluded:

> *"The latency is 100% caused by Supabase network round-trips and PostgreSQL connection pooling."*

**Revised statement**:

> *Current benchmark results indicate that database connectivity, network round-trips, and Prisma relation loading are the dominant measured contributors to API latency. Further instrumentation is required to isolate their individual contributions and confirm the underlying causes before infrastructure decisions are made.*

### Assessment Table

| Area | Assessment | Action |
| :--- | :--- | :--- |
| Frontend performance | ✅ Good finding. Rendering is not the bottleneck. | Keep measuring with broader scope |
| Network latency | ✅ Plausible. Physical distance is real. | Confirm with consistent methodology |
| PgBouncer overhead | ⚠️ Needs verification. Assumed 4 round-trips not proven. | Capture actual SQL + connection trace |
| Prisma nested relations | ✅ Important. High-priority optimization target. | Investigate `JOIN` strategy |
| `Promise.all` | ✅ Correct. Parallelizes independent operations. | Implement with connection-pool awareness |
| Port 5432 | ⚠️ Conditional. Session vs. direct vs. pooler distinction needed. | Test and document connection modes |
| TanStack Query caching | ✅ Good. Frontend cache reduces repeat API calls. | Improve configuration |
| Singapore migration | ✅ Good future option. | Defer until Phases 1–3 are measured |

---

## Revised Recommended Strategy

Execute in order. Do not skip to infrastructure changes before completing application-level optimizations.

1. **Optimize Prisma queries** — reduce relation loading overhead
2. **Reduce unnecessary database round-trips** — eliminate sequential independent queries
3. **Parallelize independent API operations** — `Promise.all` for concurrent reads
4. **Improve connection management** — instrument and tune pooling behavior
5. **Implement frontend caching** — TanStack Query `staleTime` and `gcTime`
6. **Re-measure results** — repeatable benchmarks, not one-off timings
7. **Consider Singapore migration** — only after measuring Phase 1–3 improvements

---

## Phase 1 — Immediate Application Optimization

> **Goal**: Reduce API response time without infrastructure changes.  
> **Target**: Bring `GET /api/contracts` from ~5,000 ms toward the 500–800 ms range.

### 1.1 Investigate Prisma `relationLoadStrategy: "join"` (Highest Priority)

Prisma supports two relation-loading strategies for PostgreSQL:

| Strategy | Behavior | Default |
| :--- | :--- | :--- |
| `query` | Multiple SQL `SELECT` queries, resolved sequentially | Yes (current) |
| `join` | Single SQL query using database-level `JOIN` | No |

**Current behavior** (`query` strategy): Fetching 3 contracts with nested `service → branch, shop, provider, plan, createdBy` triggers 6+ sequential `SELECT` statements. Each statement incurs a full network round-trip.

**Investigation steps**:

1. Check whether `relationLoadStrategy` is available in Prisma 6.19.2 without preview flags:
   ```bash
   bun run prisma --version
   # Also check: does prisma/schema.prisma need "previewFeatures = ["relationJoins"]"?
   ```

2. Test the `join` strategy in isolation before applying to production:
   ```typescript
   // Test file: scripts/test-join-strategy.ts
   const rows = await db.internetContract.findMany({
     relationLoadStrategy: "join",   // <-- add this
     where: { companyId },
     include: {
       service: {
         select: {
           id: true,
           serviceCode: true,
           branch: { select: { id: true, name: true, code: true } },
           shop:   { select: { id: true, name: true, code: true } },
           provider: { select: { id: true, name: true, code: true } },
           plan:   { select: { id: true, name: true } },
         },
       },
       createdBy: { select: { id: true, name: true, email: true } },
     },
     orderBy: { endDate: "asc" },
   });
   ```

3. Before deploying, verify all of the following:
   - **Generated SQL**: Confirm it uses `JOIN` not multiple `SELECT IN (...)`.
   - **Response shape**: Data structure returned must match the existing contract.
   - **Execution time**: Compare wall-clock time against the baseline.
   - **Edge cases**: Test with 0 results, 1 result, and 100+ results.

> ⚠️ **Do not deploy blindly.** Compare generated SQL, execution plan, response shape, and performance before merging.

### 1.2 Remove Unnecessary Sequential Queries — `Promise.all`

**Current code** in [`/api/contracts/route.ts`](file:///d:/Projects/internet_rental_ms/src/app/api/contracts/route.ts#L48-L72):

```typescript
// Sequential: total time = findMany + findUnique
const rows = await db.internetContract.findMany({ where, include: {...} });

const company = await db.company.findUnique({
  where: { id: user.companyId },
  select: { warningDays: true },
});
```

**Optimized pattern**:

```typescript
// Parallel: total time ≈ max(findMany, findUnique)
const [rows, company] = await Promise.all([
  db.internetContract.findMany({ where, include: {...} }),
  db.company.findUnique({
    where: { id: user.companyId },
    select: { warningDays: true },
  }),
]);
const warningDays = company?.warningDays ?? 30;
```

**Saving estimate**: ~1,100 ms (the sequential `findUnique` cost) is eliminated when both queries run simultaneously.

> ⚠️ **Connection-pool awareness**: `Promise.all` parallelizes at the Node.js level, but both queries still consume separate connection-pool slots. For small groups of 2–4 independent queries this is safe. Do not create unlimited parallel database operations — this increases connection contention under concurrent requests.

**Apply `Promise.all` to these route handlers** (audit each one):

| Route | Independent queries to parallelize |
| :--- | :--- |
| `GET /api/contracts` | `findMany(contracts)` + `findUnique(company.warningDays)` |
| `GET /api/invoices` | `findMany(invoices)` + `findUnique(company)` |
| `GET /api/dashboard` | `count(contracts)` + `count(invoices)` + `count(renewals)` |
| `GET /api/services` | `findMany(services)` + (any supplementary queries) |

### 1.3 Audit `select` Fields — Fetch Only What Is Needed

Review each `include` / `select` block and remove fields that are fetched but never used in the API response or computed output. Unused fields increase payload size and may add join overhead.

**Checklist per route**:
- [ ] Does the response JSON include every selected field?
- [ ] Are any `include` relations only used for counting? Use `_count` instead.
- [ ] Are full relation objects returned when only an `id` is needed?

### 1.4 Enable Structured Query Logging for Instrumentation

Before measuring Phase 1 improvements, enable controlled query logging to capture SQL statements with timestamps:

```typescript
// scripts/measure-with-logs.ts
const prisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});

prisma.$on("query", (e) => {
  console.log({
    query:    e.query.slice(0, 120),
    duration: e.duration,          // ms, Prisma engine time
    timestamp: performance.now(),
  });
});
```

**What to record**:
- SQL statement text
- Execution start timestamp
- Execution duration (Prisma engine-reported)
- Whether statements overlap with another query (transaction grouping)
- Connection acquisition delay (time between `await` and first query)

This makes root-cause analysis defensible. Do not rely solely on wall-clock `performance.now()` around the entire `findMany` call.

---

## Phase 2 — Connection Optimization

> **Goal**: Understand and tune PgBouncer/pooler behavior. No infrastructure migration.

### 2.1 Verify PgBouncer Overhead — Actual SQL Trace Required

The initial investigation observed:

| Connection type | Measured warm `SELECT 1` |
| :--- | :--- |
| Transaction pooler (port 6543, `?pgbouncer=true`) | **1,098 ms avg** |
| Session mode (port 5432, direct) | **233.7 ms avg** |

**However, the initial report assumed** that the 4-step sequence `BEGIN → DEALLOCATE ALL → SELECT → COMMIT` is the cause. **This requires verification.**

**Steps to verify**:

1. Enable `log: [{ emit: "event", level: "query" }]` and capture the full sequence.
2. Record timestamps for each statement within one `findMany` call.
3. Determine which statements are per-query and which are connection-initialization overhead.
4. Run the same query on:
   - Port 6543 (transaction pooler, `?pgbouncer=true`)
   - Port 5432 (session pooler)
   - Port 5432 (direct connection)
5. Repeat with warm connections only (exclude the first cold-start request from averages).

**Do not** switch production connections based solely on one `SELECT 1` benchmark.

### 2.2 Distinguish Supabase Connection Modes

Supabase provides three connection methods — do not conflate them:

| Mode | Port | Use Case | Notes |
| :--- | :--- | :--- | :--- |
| **Transaction pooler** | 6543 | Stateless / serverless | Cannot use prepared statements. `?pgbouncer=true` required. |
| **Session pooler** | 5432 | Persistent servers (Node.js) | Prepared statements allowed. Per-connection state maintained. |
| **Direct connection** | 5432 | Migrations, DDL, `DIRECT_URL` | Bypasses pooler. IPv6 may be required on free-tier. |

**Current NetRent setup**:
- `DATABASE_URL` → Port 6543 (transaction pooler, PgBouncer)
- `DIRECT_URL` → Port 5432 (used for migrations)

**Recommendation**: Test session pooler (port 5432) as the primary `DATABASE_URL` for the Next.js standalone server. This is a persistent process, not a serverless function — session pooling is appropriate.

> ⚠️ Verify IPv4/IPv6 compatibility before switching. Supabase free-tier direct connections may require IPv6, which may not be available in all hosting environments.

### 2.3 Measure Cold-Start vs. Warm-Request Latency

The first request after server start includes TLS handshake and connection authentication. Subsequent warm requests should be significantly faster. Always separate these in benchmarks to avoid distorted averages.

**Benchmark structure**:
```
Request #1  → Discard (cold: TLS + auth + query)
Request #2  → Record (warm)
Request #3  → Record (warm)
...
Request #N  → Record (warm)

Report: P50, P95, P99, min, max of requests #2–N
```

### 2.4 Review Prisma Connection Pool Configuration

Current `getCappedDatabaseUrl()` in [`src/lib/db.ts`](file:///d:/Projects/internet_rental_ms/src/lib/db.ts) injects:
- `connection_limit=10`
- `pool_timeout=30`

**Monitor under concurrent load**:
- Are connections ever exhausted? (Watch for pool timeout errors in logs.)
- Is `connection_limit=10` appropriate for the expected concurrency?
- Does `pool_timeout=30` cause visible request failures under burst traffic?

Adjust based on measured connection utilization, not assumptions.

---

## Phase 3 — Frontend Caching Optimization

> **Goal**: Eliminate repeat API round-trips for unchanged data using TanStack Query.

### 3.1 Review Current TanStack Query Configuration

Current defaults in [`src/components/providers.tsx`](file:///d:/Projects/internet_rental_ms/src/components/providers.tsx):

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

**Recommended improved configuration**:

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60_000,   // 60 s — data is "fresh" for 1 minute
      gcTime:          5 * 60_000,    // 5 min — keep inactive cache in memory
      refetchOnWindowFocus:  false,   // Don't refetch on Alt+Tab return
      refetchOnReconnect:    true,    // Refresh after network reconnects
      retry:                 1,       // Retry once on transient failure
    },
  },
})
```

> **Important correction from initial report**: `staleTime` does not guarantee zero-millisecond navigation. It prevents automatic stale-data refetching while cached data is fresh. Actual instant navigation depends on whether the query has cached data for that key already. The first visit to a view always triggers a fetch.

### 3.2 Per-Query Optimization

For views that are visited frequently (Contracts, Dashboard, Invoices), consider a longer `staleTime` overridden per query:

```typescript
// High-frequency, low-change data: longer cache
const { data: services = [] } = useQuery<ServiceMin[]>({
  queryKey: ["services", "min"],
  queryFn: () => api.get("/api/services?min=true"),
  staleTime: 5 * 60_000,   // 5 minutes
  gcTime:   10 * 60_000,   // Keep in cache for 10 minutes
});

// Business-critical, frequently mutated data: shorter cache
const { data: contracts = [] } = useQuery<Contract[]>({
  queryKey: ["contracts", filters],
  queryFn: () => api.get(`/api/contracts?status=${filters.status}`),
  staleTime: 60_000,        // 1 minute
});
```

### 3.3 Invalidation After Mutations

After creating, updating, or deleting records, invalidate the relevant query keys so users do not see stale data:

```typescript
// After creating a contract
await qc.invalidateQueries({ queryKey: ["contracts"] });

// After updating company settings
await qc.invalidateQueries({ queryKey: ["company"] });
await qc.invalidateQueries({ queryKey: ["notifications"] });
await qc.invalidateQueries({ queryKey: ["contracts"] });  // warningDays affects derived status
```

Ensure every mutation handler in the views that call `useMutation` has the appropriate `onSuccess` or `onSettled` invalidations.

### 3.4 Pagination for Large Datasets

Routes with `take: 500` (contracts, invoices, services) assume the full list fits in one request. If record counts grow:

- Implement cursor-based or offset pagination in the API route.
- Fetch only the visible page on initial load.
- Prefetch the next page in the background using `queryClient.prefetchQuery`.

---

## Phase 4 — Infrastructure: Supabase Region Migration

> **Status**: Deferred. Proceed only after measuring Phases 1–3.

### Pre-Migration Checklist (for future reference)

Before migrating from Sydney (`ap-southeast-2`) to Singapore (`ap-southeast-1`):

- [ ] Verify Singapore region is available for the existing Supabase plan tier.
- [ ] Run the full Phase 1–3 benchmark suite against the optimized application.
- [ ] Document baseline response times post-optimization.
- [ ] Create a full database backup before migration.
- [ ] Plan for downtime or controlled cutover strategy.
- [ ] Update `DATABASE_URL` and `DIRECT_URL` in all environments (`.env`, CI/CD, production).
- [ ] Validate database connectivity and data integrity post-migration.
- [ ] Re-run the Phase 1–3 benchmark suite on Singapore region to measure the improvement.

**Expected latency improvement** (estimate only — verify after migration):
- Raw TCP round-trip: Sydney ~220 ms → Singapore ~20–30 ms (~7–10x reduction)
- Per-query time on port 6543: ~1,100 ms → ~100–150 ms (estimate)

---

## Benchmark Methodology

> Use this method for every phase to ensure results are comparable.

### Measurement Stages per Request

| Stage | What It Measures |
| :--- | :--- |
| DNS + TCP + TLS | Network connection overhead (cold start) |
| Connection acquisition | Time waiting for an available pool slot |
| Database execution | PostgreSQL query time (Prisma engine-reported) |
| Prisma processing | ORM mapping, relation hydration |
| API processing | Business logic and JSON serialization |
| HTTP transfer | Response payload size and transfer time |
| Frontend rendering | JSON parsing and UI rendering (measured separately) |

### Statistical Requirements

For each test phase, capture at minimum **30 requests**, warm connections only (discard request #1):

| Metric | Record |
| :--- | :--- |
| Average | ✅ |
| Median (P50) | ✅ |
| P95 | ✅ |
| P99 | ✅ |
| Min / Max | ✅ |
| Error rate | ✅ |

### Benchmark Endpoints to Track

| Endpoint | Why |
| :--- | :--- |
| `GET /api/contracts` | Primary complaint endpoint (3–10 records) |
| `GET /api/dashboard` | High-query-count aggregation |
| `GET /api/invoices` | Decimal computation + relation loading |
| `GET /api/notifications` | Background polling endpoint |

---

## Engineering Targets

These are **engineering targets** — not guaranteed results — to be validated by measurement after each phase.

| Optimization | Target |
| :--- | :--- |
| `Promise.all` for independent queries | Eliminate sequential wait time for independent DB calls |
| Prisma `JOIN` strategy | Reduce 6+ SELECT statements to 1 SQL query per relation group |
| Session pooler (port 5432) | Reduce per-query overhead from ~1,100 ms toward ~230 ms on warm connections |
| TanStack Query `staleTime` 60s | Eliminate repeat API calls within the cache window |
| Phase 1–3 combined | Target: `GET /api/contracts` from ~5,000 ms toward 500–800 ms |
| Phase 4 (Singapore) | Re-assess after measuring Phase 1–3 results |

> Do not declare a 10x improvement or 80–90% reduction before running the benchmark against the optimized implementation. Measure first, conclude after.

---

## Decision Log

| Date | Decision | Rationale |
| :--- | :--- | :--- |
| 2026-11-03 | Identified database latency as primary bottleneck | Frontend rendering measured at 1.05 ms |
| 2026-11-04 | Deferred Singapore region migration | Optimize application first; infrastructure last |
| 2026-11-04 | Prioritized `JOIN` strategy over `Promise.all` | Relation loading has the highest single-change potential |
| 2026-11-04 | Added requirement to verify PgBouncer assumption | Initial report made assumption without SQL-level proof |
| 2026-11-04 | Revised root cause statement | Removed certainty claim; replaced with instrumentation-based framing |

---

## References

- [Database Latency Investigation Report — 2026-11-03](./database_latency_analysis_2026-11-03.md)
- [Prisma Relation Loading Strategies — Prisma Docs](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#relation-load-strategies)
- [Supabase Connection Pooling — Supabase Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [TanStack Query `staleTime` / `gcTime`](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [`src/lib/db.ts`](file:///d:/Projects/internet_rental_ms/src/lib/db.ts)
- [`src/app/api/contracts/route.ts`](file:///d:/Projects/internet_rental_ms/src/app/api/contracts/route.ts)
- [`src/components/providers.tsx`](file:///d:/Projects/internet_rental_ms/src/components/providers.tsx)

