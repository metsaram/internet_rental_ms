# Contract Renewals

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement renewal workflow and preserve old commercial terms.

## Implementation requirements

Show upcoming, overdue, and completed renewals. Authorized users can
renew by creating a new contract period or explicit renewal record
according to the schema. Preserve previous dates, fees, plan, free-month
terms, and reference. Capture new terms, actor, decision date, and
notes. Prevent duplicate submissions and unintended overlapping periods.
Make warning intervals configurable.

## Acceptance criteria

-   [ ] Upcoming/overdue renewals visible
-   [ ] Renewal preserves history
-   [ ] Old/new terms can be compared
-   [ ] Duplicate renewal actions prevented

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
