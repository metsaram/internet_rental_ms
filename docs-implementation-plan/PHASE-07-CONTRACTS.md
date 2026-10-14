# Internet Contract Management

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement the core commercial contract module.

## Implementation requirements

Fields: service, contract number, start/end dates, renewal/notice dates
as needed, agreed monthly fee, currency, duration, free months, billing
cycle, status, notes. Preserve historical terms. Validate dates,
nonnegative fee, positive duration, freeMonths between zero and
duration, and company scope. Avoid overlapping active periods unless
explicitly supported. Define simple fixed-term calculations: paidMonths
= contractMonths - freeMonths; scheduledTotal = monthlyFee × paidMonths;
effectiveMonthlyCost = scheduledTotal / contractMonths. Use Decimal and
explicit display rounding. Distinguish expected costs from actual
invoices/payments. Compute date-derived status consistently and test
boundaries.

## Acceptance criteria

-   [ ] Contract CRUD works
-   [ ] Historical terms preserved
-   [ ] Cost calculation and edge cases tested
-   [ ] Expiry/warning boundaries work
-   [ ] Overlap/duplicate handling defined

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
