# Internet Providers & Plans

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement provider and Internet plan master data.

## Implementation requirements

Provider fields: code, name, contact, phone, email, website, status,
notes. Plan fields: provider, name, bandwidth, connection type, optional
catalog price, currency, status, description. Add CRUD/search/filtering,
scope validation, unique codes, and safe deactivation for referenced
records. Existing contract prices must not change when catalog prices
change. Normalize bandwidth units.

## Acceptance criteria

-   [ ] Provider CRUD works
-   [ ] Plan CRUD and provider relation work
-   [ ] Existing contract terms do not change with catalog pricing
-   [ ] Referenced master data cannot be destructively removed
-   [ ] Validation and permissions tested

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
