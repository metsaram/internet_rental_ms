# Database Migrations Documentation

When schema changes are made to `prisma/schema.prisma`:
1. Generate the migration script under `db/yyyy-mm-dd/table_name/`.
2. Add a corresponding explanation document in `docs/migrations/yyyy-mm-dd/table_name.md` detailing:
   - Reasons for schema change
   - Impacted entities and fields
   - Migration and rollback strategy
   - Data integrity and tenant scoping considerations
