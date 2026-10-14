# Database Architecture

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement the initial normalized Prisma/PostgreSQL schema and migration,
without building the full CRUD UI.

## Implementation requirements

Model Company, Branch, Shop, InternetProvider, InternetPlan,
InternetService, InternetContract, User, Note, Attachment metadata,
AuditLog, ImportJob, and ImportRow. Plan for later Invoice, Payment, and
ContractRenewal without speculative overbuilding. Define company scope
and whether provider/plan master data is company-owned or shared. Add
relations, indexes, unique constraints, statuses, deliberate delete
behavior, timestamps, Decimal money, and repeatable fake seed data.
Avoid polymorphic foreign keys that undermine referential integrity
where practical. Never store plaintext ISP passwords; document a safe
secret-storage design.

## Acceptance criteria

-   [ ] Prisma validation/generation pass
-   [ ] Migration applies to clean DB
-   [ ] Seed is repeatable
-   [ ] Relations/indexes/uniqueness are documented
-   [ ] Company scope is clear
-   [ ] No real data/secrets in seed

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
