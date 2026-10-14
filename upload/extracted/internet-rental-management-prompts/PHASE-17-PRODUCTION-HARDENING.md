# Production Hardening

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Review security, performance, reliability, and maintainability across
the system.

## Implementation requirements

Review authentication/session, server permissions, company isolation,
credential handling, input validation, file access, rate limiting,
headers, dependency vulnerabilities, error/log redaction, N+1 queries,
indexes, pagination, large import/export limits, transaction/race
conditions, retry/idempotency, and UI error states. Run lint,
type-check, tests, Prisma validation/generation, and production build.
Fix high-risk findings and document residual risks. Avoid speculative
abstractions during cleanup.

## Acceptance criteria

-   [ ] Critical/high risks fixed or mitigated
-   [ ] Checks/build pass or failures documented
-   [ ] No secrets in repository
-   [ ] Performance/Vercel limits documented
-   [ ] Backup/restore guidance exists

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
