# Company & Branch Management

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement company profile and branch CRUD.

## Implementation requirements

Build company profile view/edit and branch
list/create/detail/edit/archive. Branch fields: code, name,
location/address, manager/contact as modeled, status. Add search,
sorting, pagination, validation, loading/empty/error states. Enforce
company-scoped unique codes. Prefer archive/deactivate when records
reference a branch. Branch detail can show counts/costs only where
supporting modules exist.

## Acceptance criteria

-   [ ] Company/branch operations work
-   [ ] Company scope enforced
-   [ ] Duplicate codes handled
-   [ ] Referenced branches cannot be destructively deleted
-   [ ] Search/pagination and responsive UI work

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
