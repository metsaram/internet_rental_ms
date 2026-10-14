# Vercel Production Deployment

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Deploy to Vercel with production PostgreSQL and private storage.

## Implementation requirements

Document GitHub-to-Vercel setup, separate production/preview environment
variables, PostgreSQL pooled/direct connection choices for the actual
provider, Prisma generation, controlled `prisma migrate deploy`, Auth.js
configuration, storage privacy/access, domain/HTTPS, and scheduler
configuration if used. Verify runtime compatibility. Document rollback
risks; do not assume destructive migrations are reversible. Include
smoke tests. Do not claim actual deployment succeeded without access to
and verification of the deployment.

## Acceptance criteria

-   [ ] Production variables documented
-   [ ] Build/deployment succeeds if access is available
-   [ ] DB and migrations work
-   [ ] Authentication/storage work
-   [ ] Smoke tests pass
-   [ ] No secrets exposed

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
