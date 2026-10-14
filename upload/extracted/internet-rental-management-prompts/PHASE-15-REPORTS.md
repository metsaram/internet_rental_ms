# Management Reports

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Build reconciled management reports.

## Implementation requirements

Reports: Internet cost by branch/provider, contract expiration,
service/bandwidth inventory, invoice summary, payment summary,
outstanding invoices, expected versus actual invoiced/paid cost. Use
server-side aggregation/filtering/pagination. Define totals clearly. Do
not sum different currencies without conversion data; group by currency.
Reuse export functionality and validate report totals against source
records.

## Acceptance criteria

-   [ ] Report totals reconcile
-   [ ] Filters work
-   [ ] Currency handling clear
-   [ ] Export respects filters and authorization
-   [ ] Large queries are bounded

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
