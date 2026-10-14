# Excel Export

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement authorized XLSX exports.

## Implementation requirements

Export branches, shops, services, contracts, and available cost reports.
Respect company scope and filters; distinguish filtered results from all
matching results. Format dates, currency, bandwidth, and statuses.
Exclude passwords and sensitive credentials by default. Mitigate
spreadsheet formula injection for untrusted text beginning with `=`,
`+`, `-`, or `@`. Generate small exports dynamically; use staged storage
for large exports. Do not persist files on Vercel local disk.

## Acceptance criteria

-   [ ] Exports open correctly
-   [ ] Filters/company scope respected
-   [ ] Currency/date formats correct
-   [ ] Sensitive fields excluded by default
-   [ ] Formula injection mitigated
-   [ ] Serverless limits considered

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
