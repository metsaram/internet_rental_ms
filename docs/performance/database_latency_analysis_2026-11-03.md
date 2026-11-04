# Database Performance & Latency Investigation Report

**Date**: 2026-11-03  
**Target Environment**: NetRent API (`/api/contracts`, `/api/services`, `/api/company`)  
**Database**: Supabase PostgreSQL (`aws-0-ap-southeast-2.pooler.supabase.com`)  
**ORM**: Prisma 6.19.2 on Node.js / Bun  

---

## 1. Executive Summary

### Problem Statement
When fetching small datasets (e.g., retrieving only 3 `InternetContract` records), the API response takes over 1 second (averaging 4.8 to 5.4 seconds on end-to-end requests).

**Question Investigated**:
> *"Why get record only 3 records, but spend more than a second? Slow response from Supabase or slow on frontend display data?"*

### Findings
- **Frontend vs. Backend**: The latency is **100% caused by Supabase network round-trips and PostgreSQL connection pooling**.
- **Frontend Performance**: Frontend rendering and in-memory JSON data transformation take only **~1.05 ms** (0.001 seconds), representing **less than 0.05%** of total request time.
- **Root Cause**: The latency is compounded by:
  1. **Geographic Network Latency**: Physical distance from Southeast Asia (+07:00) to Sydney, Australia (`ap-southeast-2`) introduces ~220 ms per network packet.
  2. **PgBouncer Transaction Mode (Port 6543)**: Adds ~700 ms overhead per query due to sequential `BEGIN`, `DEALLOCATE ALL`, and `COMMIT` round-trips.
  3. **Prisma Nested Relation Fetching**: A single `findMany` call with relations fires **9 sequential queries** across the ocean, multiplying round-trip latency.

---

## 2. Live Benchmark Measurements

Benchmarks were captured directly against the active Supabase PostgreSQL database instance using isolated Node.js/Bun performance probes.

### End-to-End Latency Breakdown (`GET /api/contracts` returning 3 records)

| Pipeline Stage | Measured Duration | % of Total Time | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Mapping & Serialization** | **1.05 ms** | 0.02% | Transforming 3 contracts, calculating costs, and JSON serialization. |
| **Query 1 (`findMany` with relations)** | **3,792.6 ms – 4,190.1 ms** | 77.0% | Prisma fetching 3 contracts + services + branches + shops + plans. |
| **Query 2 (`company.findUnique`)** | **1,103.1 ms – 1,243.5 ms** | 22.8% | Fetching company `warningDays` configuration. |
| **Total API Response Time** | **4,896.8 ms – 5,438.0 ms** | 100.0% | Total wall-clock time perceived by the browser. |

### Network & Single Query Latencies

| Test Case | Measured Latency | Notes |
| :--- | :--- | :--- |
| **Raw TCP Handshake (SYN-ACK)** | `212.0 ms – 227.8 ms` (avg: **220 ms**) | Physical speed-of-light network limit to Sydney, AU. |
| **Cold Connection + TLS + Handshake** | `2,537 ms – 3,252 ms` | Initial TLS handshake + Postgres authentication. |
| **Warm Query on Port 6543 (`?pgbouncer=true`)** | `1,060 ms – 1,215 ms` (avg: **1,098 ms**) | PgBouncer transaction mode: `BEGIN` + `DEALLOCATE` + query + `COMMIT`. |
| **Warm Query on Port 5432 (Session Mode)** | `219.3 ms – 244.2 ms` (avg: **233.7 ms**) | Direct session without transaction wrapper (**4.7x faster**). |

---

## 3. Deep-Dive Root Cause Analysis

### Cause 1: Physical Geographic Distance (Southeast Asia ⇄ Sydney, Australia)
The project's database host is located in `aws-0-ap-southeast-2` (Sydney, Australia):
```
DATABASE_URL="postgresql://postgres.xxx:xxx@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true..."
```
- Physical distance: **~7,000+ km** (trans-oceanic fiber cables).
- Every network packet requires **~100 ms to 110 ms one-way**, totaling **~220 ms per round-trip**.
- No software optimization can make a single round-trip faster than the physical fiber latency.

### Cause 2: PgBouncer Transaction Mode Overhead on Port 6543
Port 6543 connects to Supabase's PgBouncer in **Transaction mode**:
- To support connection pooling without state bleeding, Prisma must clean up prepared statements.
- When `?pgbouncer=true` is enabled, Prisma wraps every `SELECT` query in an explicit transaction:
  ```sql
  BEGIN            -- Round-trip 1: ~231 ms
  DEALLOCATE ALL   -- Round-trip 2: ~229 ms
  SELECT ...       -- Round-trip 3: ~250 ms
  COMMIT           -- Round-trip 4: ~240 ms
  ```
- **Result**: Even a trivial query like `SELECT 1` requires 4 sequential network round-trips, taking **~1,060 ms to 1,215 ms**.

### Cause 3: Prisma Nested `include` Triggers 9 Sequential Queries
When fetching contracts in [`src/app/api/contracts/route.ts`](file:///d:/Projects/internet_rental_ms/src/app/api/contracts/route.ts):
```typescript
const rows = await db.internetContract.findMany({
  where,
  include: {
    service: {
      select: {
        id: true,
        serviceCode: true,
        branch: { select: { id: true, name: true, code: true } },
        shop: { select: { id: true, name: true, code: true } },
        provider: { select: { id: true, name: true, code: true } },
        plan: { select: { id: true, name: true } },
      },
    },
    createdBy: { select: { id: true, name: true, email: true } },
  },
  orderBy: { endDate: "asc" },
});
```

By default, Prisma does **not** generate a single SQL query with `JOIN` statements. Hooking into the Prisma Query Engine event log revealed that **9 sequential queries** are dispatched over the network:

1. `BEGIN` (231 ms)
2. `DEALLOCATE ALL` (229 ms)
3. `SELECT FROM internet_contracts WHERE companyId = ...` (655 ms)
4. `SELECT FROM internet_services WHERE id IN (...)` (530 ms)
5. `SELECT FROM branches WHERE id IN (...)` (498 ms)
6. `SELECT FROM internet_providers WHERE id IN (...)` (473 ms)
7. `SELECT FROM internet_plans WHERE id IN (...)` (669 ms)
8. `SELECT FROM users WHERE id IN (...)` (450 ms)
9. `COMMIT` (240 ms)

Because each sub-query depends on the IDs returned by the previous one, Prisma cannot run them all at once. They execute sequentially across the Pacific Ocean, adding up to **~3.98 seconds**.

---

## 4. Remediation & Optimization Roadmap

### Priority 1: Migrate Supabase Database to Singapore (`ap-southeast-1`) — Highest Impact
- **Current (Sydney - `ap-southeast-2`)**: ~220 ms round-trip latency.
- **Singapore (`ap-southeast-1`)**: ~20 ms to 30 ms round-trip latency from Southeast Asia.
- **Expected Improvement**: 
  - Single queries drop from **1,100 ms → ~100 ms**.
  - Contract list with 9 sub-queries drops from **4,000 ms → ~300 ms – 400 ms** (**10x speedup**).

### Priority 2: Parallelize Independent Route Handler Queries
In route handlers that execute multiple queries, run them concurrently with `Promise.all` instead of sequentially:
```typescript
// Before: ~5,200 ms total
const rows = await db.internetContract.findMany(...); // ~4,000 ms
const company = await db.company.findUnique(...);     // ~1,200 ms

// After: ~4,000 ms total (saves ~1,200 ms)
const [rows, company] = await Promise.all([
  db.internetContract.findMany(...),
  db.company.findUnique({ where: { id: user.companyId }, select: { warningDays: true } }),
]);
```

### Priority 3: Use Port 5432 (Session Mode) in Long-Running / Local Environments
- For persistent server instances (local development, VPS, Docker, Bun), use `DIRECT_URL` (Port 5432) instead of Port 6543.
- Benchmarked improvement: `SELECT 1` drops from **1,098 ms → 233 ms** (**4.7x speedup**) by removing the PgBouncer transaction wrapper.

### Priority 4: TanStack Query Client Caching (Zero-Second UI Navigation)
- Ensure client views configure TanStack Query `staleTime` (e.g., 30–60 seconds):
  ```typescript
  useQuery({
    queryKey: ["contracts"],
    queryFn: () => api.get("/api/contracts"),
    staleTime: 60 * 1000, // Serve instantly from memory cache on re-render / tab switch
  });
  ```
- Once loaded, navigating between views (e.g. Dashboard ↔ Contracts) is **0 ms (instant)**.

---

## 5. Conclusion

The slow response when retrieving 3 records is **not a frontend issue**. The frontend renders the data in approximately 1 millisecond. The entire delay occurs in the network and database layer:
1. 7,000 km distance to Sydney, Australia (~220 ms baseline latency).
2. PgBouncer transaction mode overhead on port 6543 (~700 ms per query).
3. Prisma executing 9 sequential sub-queries across the ocean (~4,000 ms).

Migrating the Supabase project to the **Singapore (`ap-southeast-1`)** region and using `Promise.all` in the route handlers will reduce response times by **~80% to 90%**.

