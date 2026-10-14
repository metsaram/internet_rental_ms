# Project Foundation

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Establish a working Next.js foundation; do not implement business
modules yet.

## Implementation requirements

Configure App Router, strict TypeScript, lint/format, Tailwind, package
scripts, Prisma Client setup, responsive sidebar/topbar shell,
loading/error/not-found patterns, and placeholder routes for dashboard,
branches, shops, Internet, contracts, reports, imports, and settings.
Preserve an existing repository rather than recreating it. Add
`.env.example` and README local/Vercel setup instructions.

## Acceptance criteria

-   [ ] Dev server starts
-   [ ] Type-check and lint pass
-   [ ] Prisma Client generates
-   [ ] Production build succeeds
-   [ ] Responsive shell and placeholder routes work
-   [ ] README and `.env.example` exist; no secrets committed

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
