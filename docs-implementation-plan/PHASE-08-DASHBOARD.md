# Management Dashboard

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Create a real-data management dashboard.

## Implementation requirements

Show branch/shop/service/current-contract counts, contracts expiring
soon/expired, expected monthly contract cost, effective monthly cost
where calculable, and upcoming renewals. Add branch/provider/status/date
filters where meaningful. Clearly label expected cost versus
invoiced/paid cost. Avoid double counting, scope aggregates by
company/permissions, and use efficient database aggregation. Add
loading/empty/error states.

## Acceptance criteria

-   [ ] Figures come from database
-   [ ] Totals reconcile with detail records
-   [ ] Filters and tenant scope work
-   [ ] Queries avoid loading all records into memory

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
