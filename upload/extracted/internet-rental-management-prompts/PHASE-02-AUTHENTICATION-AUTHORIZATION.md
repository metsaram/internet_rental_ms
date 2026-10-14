# Authentication & Authorization

Follow `00-GLOBAL-IMPLEMENTATION-RULES.md` in full.

## Objective

Implement secure sign-in, sessions, and server-enforced permissions.

## Implementation requirements

Use Auth.js/NextAuth compatible with installed versions. Implement
login/logout, protected routes, secure password hashing if credentials
auth is used, ADMIN and STAFF roles, reusable server permission helpers,
and a safe initial-admin provisioning process. Enforce company scope in
every query/mutation. UI hiding is not security. Protect user management
and ISP credentials; keep sensitive data out of client session claims.
Add safe error handling and rate limiting where supported.

## Acceptance criteria

-   [ ] Login/logout work
-   [ ] Protected routes reject unauthenticated users
-   [ ] ADMIN/STAFF server permissions work
-   [ ] Cross-company access is blocked
-   [ ] Passwords are hashed
-   [ ] Authorization boundary tests pass

## Stop condition

After this phase, provide the completion report required by the global
rules and wait for approval. Do not start the next phase automatically.
