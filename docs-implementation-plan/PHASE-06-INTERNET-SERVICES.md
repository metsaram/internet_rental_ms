# Internet Services

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement inventory for actual installed Internet connections.

## Implementation requirements

Build service CRUD/search/filter/detail. Fields: service code, branch,
optional shop, provider, optional plan, account ID, installation
address, IP address/IP type, status. Support multiple services per
branch/shop and services assigned only to a branch. Show contract
history. Validate all relations and company scope. Protect
usernames/passwords with server-only encryption and strict permissions
if credentials are required; redact them from list results/logs.

## Acceptance criteria

-   [ ] Service CRUD works
-   [ ] Multiple connections per branch/shop supported
-   [ ] Provider/plan relations validated
-   [ ] Credentials protected and redacted
-   [ ] Contract history visible

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
