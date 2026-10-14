# Excel Import

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement robust XLSX import with preview, dynamic mapping, validation,
and safe persistence.

## Implementation requirements

Workflow: upload, inspect workbook, choose worksheet, preview, map
columns, validate, review row errors, confirm, import, summarize.
Validate file type/content where practical, size, rows, columns, and
workbook structure. Allow arbitrary headers to map to supported fields
and save reusable templates. Support a default free-month value.
Normalize branch/provider/shop references without silently creating
master data. Define duplicate detection explicitly. Store job/row
statuses and errors without leaking credentials. Use atomic transactions
where feasible; use staged/asynchronous jobs for files exceeding
serverless limits. Make retries safe and prevent accidental duplicate
imports.

## Acceptance criteria

-   [ ] Upload/worksheet/preview/mapping work
-   [ ] Row-level validation errors displayed
-   [ ] User confirms before write
-   [ ] Import is transactional or safely staged
-   [ ] Import history and limits work

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
