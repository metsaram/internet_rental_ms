# Audit & Activity Logging

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Record security-relevant and business-critical changes.

## Implementation requirements

Audit create/update/archive/delete where relevant, contract price/date
changes, invoice/payment changes, imports, attachment changes, user/role
changes, and sensitive credential access where policy requires. Store
actor, company, action, entity, timestamp, correlation ID if available,
and minimal before/after values. Redact passwords, tokens, credentials,
and signed URLs. Write audit events in the same transaction as mutations
when atomicity matters. Restrict viewing; ordinary users cannot
edit/delete logs.

## Acceptance criteria

-   [ ] Important changes logged
-   [ ] Sensitive values redacted
-   [ ] Logs protected from ordinary modification
-   [ ] Authorized filters available
-   [ ] Audit writes reliable

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
