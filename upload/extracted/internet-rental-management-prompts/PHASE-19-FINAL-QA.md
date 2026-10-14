# Final QA & Acceptance

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Run end-to-end acceptance checks; avoid adding major features unless
fixing confirmed defects.

## Implementation requirements

Test auth/permissions/company isolation; branch/shop CRUD;
provider/plan/service relations; contract calculations/free
months/expiry/renewal; dashboard totals; import
mapping/errors/duplicate/retry safety; export
filters/formats/formula-injection and sensitive-field exclusion;
attachment privacy; invoices/partial payments/balances/voids/audit;
notification scheduler/idempotency; responsive/accessibility basics; and
Vercel assumptions. Run actual lint/type-check/tests/Prisma/build
commands and report exact outcomes. Deliver defects fixed, unresolved
risks with severity, deployment smoke results if available, operational
checklist, and README review.

## Acceptance criteria

-   [ ] Automated checks pass where feasible
-   [ ] Core workflows pass end-to-end
-   [ ] Authorization/company isolation tested
-   [ ] No known critical defect remains
-   [ ] Remaining limitations documented

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
