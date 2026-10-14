# Notifications

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement extensible renewal and overdue-payment notifications.

## Implementation requirements

Events: upcoming/expired contracts, invoices approaching/overdue, and
import job completion/failure if async import exists. Define a
provider-independent notification interface and store
attempts/status/idempotency keys. Start with one configured channel;
keep others extensible. Do not rely on in-process timers in Vercel; use
a supported scheduler/cron trigger or external job with a secured
endpoint. Configure warning intervals/recipients, retry transient
failures safely, and never include secrets in messages.

## Acceptance criteria

-   [ ] Scheduled trigger documented and secured
-   [ ] Duplicate notifications prevented
-   [ ] Failures visible and retryable
-   [ ] Recipients/templates configurable

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
