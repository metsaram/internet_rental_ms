# Shop Management & Notes

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement shop management and shop notes.

## Implementation requirements

Build shop list/create/detail/edit/archive. Fields: branch, code, name,
type, status, contact details. Validate branch ownership server-side.
Shop detail shows branch, related Internet services, notes, and activity
if available. Notes support create/edit/delete under author/role rules
and retain author/timestamps. Keep connection and contract data out of
Shop as the source of truth.

## Acceptance criteria

-   [ ] Shop CRUD works
-   [ ] Branch/company relationship validated
-   [ ] Notes retain author and timestamps
-   [ ] Staff permissions respected
-   [ ] Related Internet services display correctly

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
