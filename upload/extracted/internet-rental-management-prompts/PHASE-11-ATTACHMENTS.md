# Attachments & Cloud Storage

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement secure attachment storage.

## Implementation requirements

Choose Supabase Storage, Vercel Blob, or S3-compatible private storage
and wrap it behind a small service. Support contract, quotation,
invoice, receipt, and provider documents as applicable. Store metadata
in PostgreSQL and files in private object storage. Implement
upload/download/delete, file size/type validation, opaque storage keys,
ownership/tenant checks, authorized downloads or short-lived signed
URLs, and cleanup for failed/orphaned uploads. Do not use Vercel local
filesystem.

## Acceptance criteria

-   [ ] Upload/download/delete work
-   [ ] Files private by default
-   [ ] Metadata and storage objects stay consistent
-   [ ] Permissions tested
-   [ ] Failure cleanup addressed

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
