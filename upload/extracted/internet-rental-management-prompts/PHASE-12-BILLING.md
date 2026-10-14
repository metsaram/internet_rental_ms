# Invoices & Payments

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement invoice and payment tracking, not a full accounting system
unless separately specified.

## Implementation requirements

Invoice: contract, invoice number/date, billing period, subtotal, tax,
discount, total, currency, status, due date. Payment: date, amount,
currency, method, reference, status, notes. Model PaymentAllocation if
partial or combined payments are supported; do not assume one payment
always equals one invoice. Derive outstanding balance from valid
allocations. Prevent over-allocation unless allowed. Preserve posted
financial history through void/cancel flows, use Decimal and explicit
rounding, and link attachments securely. Distinguish scheduled contract
cost from invoiced and paid amounts.

## Acceptance criteria

-   [ ] Invoice workflows work
-   [ ] Payment/allocation workflows work
-   [ ] Outstanding balances correct
-   [ ] Financial history preserved
-   [ ] Partial payment/currency/void cases tested

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
