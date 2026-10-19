# NetRent (`internet_rental_ms`)
## Revised Module Audit & Improvement Plan

**Document type:** Implementation roadmap  
**Status:** Proposed — verify against the current repository before implementation  
**Scope:** Existing module gaps, production-readiness controls, and ISP operations enhancements

---

## 1. Purpose

This plan organizes the NetRent improvement work into a dependency-aware roadmap. It aims to:

1. Complete UI workflows for capabilities already implemented in the repository.
2. Protect business, financial, and company-scoped data.
3. Make bulk operations and imports predictable and auditable.
4. Add ISP operations insights after the core workflows are reliable.
5. Define testable acceptance criteria for each delivery phase.

### Evidence and assumptions

The original audit describes the following repository areas: `prisma/schema.prisma`, `src/app/api/*`, `src/components/views/*`, and specifications from `PHASE-00` through `PHASE-19`, compared with `App.jsx`.

This plan is based on that audit document. The repository has **not** been independently re-inspected as part of writing this revision. Therefore, confirm each claimed existing endpoint, component, permission, constraint, and test before changing code. Prefer wiring existing capabilities over rebuilding them.

---

## 2. Guiding principles

- **Verify before implementing:** map each requirement to its existing API route, UI component, schema model, and tests.
- **Server-side enforcement:** frontend visibility is not an authorization boundary.
- **Company isolation:** apply company scoping consistently to reads and mutations where records are company-owned.
- **Financial integrity:** derive balances from valid ledger entries and use database transactions for related changes.
- **Auditability:** record sensitive administrative, financial, bulk, and import actions.
- **Safe changes:** prefer deactivation, archival, voiding, or reversal when hard deletion would damage history or relationships.
- **Consistent UX:** use shared forms, dialogs, validation patterns, table behavior, and error states where practical.
- **Incremental delivery:** ship small, testable phases with clear acceptance criteria.

---

## 3. Initial verification phase — repository and requirements baseline

Before implementation, create a short gap matrix for every item in this plan.

For each feature, record:

- Existing API route(s) and HTTP methods.
- Existing Prisma models, relations, indexes, unique constraints, and company scoping.
- Existing UI components and shared components.
- Current authorization checks.
- Existing tests and missing tests.
- Whether the work is **missing**, **partially implemented**, **implemented but not wired**, or **requires a business decision**.

### Acceptance criteria

- Every roadmap item has a verified current-state status.
- No existing API or UI behavior is duplicated without a reason.
- Open business-rule questions are documented before implementation.
- The baseline includes a list of affected files and a proposed test for each change.

---

## 4. Prioritized implementation roadmap

Priority definitions:

- **P0 — Correctness and security:** must be addressed before production use of the affected workflow.
- **P1 — Core operational usability:** important workflow completion and daily usability improvements.
- **P2 — Domain enhancements:** additional operational intelligence after core workflows are stable.

### Phase 1 — Authorization, company isolation, and safe record lifecycle

**Priority:** P0

#### Scope

1. **User management and RBAC**
   - Add the Users & Roles interface in Settings, based on the existing `/api/users` and settings implementation described in the original audit.
   - Support creating users, changing roles (`ADMIN`, `MANAGER`, `VIEWER`), resetting passwords, and enabling/disabling accounts where supported by the existing API.
   - Enforce permissions on the server for each protected operation.
   - Define which roles may manage users and company settings; do not infer permissions solely from frontend navigation.

2. **Editable company profile**
   - Add an editable Company Profile experience using the existing `/api/company` capability described in the audit.
   - Validate submitted fields on the server and show clear success/error feedback.

3. **CRUD completion and record lifecycle**
   - Add Edit and Delete/Deactivate actions for branches, shops, providers, plans, services, and contracts where supported by existing endpoints.
   - Reuse the existing confirmation dialog where appropriate.
   - Pre-fill edit forms and validate both client-side and server-side.
   - Check foreign-key and business dependencies before deletion.
   - Prefer deactivation/archive or a domain-specific void/reversal workflow when deleting would erase operational or financial history.

4. **Audit trail**
   - Verify audit coverage for user/role changes, company profile changes, deletes/deactivations, contract changes, payment actions, imports, and bulk operations.
   - Store the actor, timestamp, action, target record, and appropriate before/after details without logging passwords, tokens, or other secrets.

5. **Company-level data isolation**
   - Verify that company-owned records are scoped by the authenticated user's company on every applicable read and mutation.
   - Check relationships and nested lookups for cross-company access.
   - Add database constraints or indexes only where required by the verified schema and data model.

#### Acceptance criteria

- Unauthorized direct API requests are rejected, even if a user bypasses the UI.
- Users cannot access or mutate another company's records through IDs, filters, nested relationships, or bulk requests.
- Editing a record updates the correct record and displays validation errors clearly.
- Unsafe deletion is rejected with a useful explanation or handled through an approved lifecycle action.
- Sensitive changes produce the required audit event.
- Passwords, bot tokens, and other secrets never appear in audit details or application errors.

---

### Phase 2 — Shared table experience and mobile/system health UX

**Priority:** P1

#### Scope

1. **Search, filtering, sorting, and pagination**
   - Reuse the existing shared data-table component where suitable.
   - Add relevant filters to each module rather than applying every filter everywhere.
   - Examples from the original audit include filtering Services by provider, shop, and status, and Shops by branch.
   - Define stable sorting behavior and pagination reset behavior when filters change.
   - Ensure the displayed count and page count match the active filter.

2. **Consistent UI states**
   - Standardize loading, empty, validation-error, permission-denied, API-failure, and success states.
   - Disable duplicate submissions while an operation is in progress.
   - Confirm destructive or high-impact actions before submission.

3. **Mobile navigation**
   - Review the existing mobile bottom navigation component and integrate it if it fits the current application layout.
   - Ensure it does not obscure page content, forms, or fixed action bars.
   - Check keyboard, focus, and small-screen behavior.

4. **System health**
   - Review the existing `/api/health` endpoint described in the audit.
   - Show an appropriate service/database/storage health indicator if supported.
   - Avoid exposing credentials, internal connection strings, sensitive infrastructure details, or verbose diagnostics to unauthorized users.

#### Acceptance criteria

- Search, filters, sorting, and pagination work together consistently.
- Changing a filter resets pagination when necessary.
- Empty and failed requests are distinguishable from a legitimate empty result.
- Core workflows remain usable at supported mobile widths.
- Health status is accurate, access-controlled where needed, and does not expose secrets.

---

### Phase 3 — Billing, partial payments, and payment ledger

**Priority:** P0 for financial correctness

#### Scope

1. **Record Payment modal**
   - Replace the current one-click full-payment behavior described in the audit with an explicit payment form.
   - Support partial and full payments, payment method, reference number, payment date if applicable, and notes if supported by the domain.
   - Display the invoice total, already-paid amount, and outstanding balance before submission.
   - Validate positive amounts and define whether overpayments are permitted.

2. **Payment ledger**
   - Display payment history using the existing payments API and data model described in the audit.
   - Include payment date, amount, method, reference, status, and relevant actor/audit information where available.
   - Provide controlled void/reversal handling for erroneous entries rather than silently erasing financial history.

3. **Balance and status consistency**
   - Establish valid payments as the source of truth for paid amount and outstanding balance, or document the verified alternative if the existing design uses a different ledger model.
   - Keep invoice/payment mutations atomic.
   - Prevent duplicate submissions through idempotency or an equivalent reliable mechanism.
   - Protect concurrent payment attempts against overpayment or inconsistent invoice status.

4. **Permissions and audit**
   - Define which roles can record, void, or reverse payments.
   - Require a reason for void/reversal where appropriate.
   - Audit all financial mutations.

#### Acceptance criteria

- A partial payment updates the outstanding balance correctly.
- A full payment marks an invoice paid only when the business rules say the balance is settled.
- Invalid amounts and unauthorized operations are rejected by the API.
- Concurrent requests cannot produce inconsistent balances.
- Voiding/reversing a payment restores the correct balance and preserves history.
- The ledger reconciles with invoice balances and payment statuses.

---

### Phase 4 — Spreadsheet import and bulk contract operations

**Priority:** P1

#### A. Two-step spreadsheet import

Implement the preview-and-commit workflow described in the original audit.

1. Upload or parse the spreadsheet and validate file type, size, and expected columns.
2. Run server-side preview validation and return row-level errors.
3. Show valid, invalid, duplicate, and skipped rows in a review table.
4. Allow users to correct supported fields or exclude rows.
5. Revalidate on commit; do not trust the preview payload alone.
6. Define whether commits are all-or-nothing or allow partial success.
7. Return a clear result summary: inserted, updated if supported, skipped, and failed.
8. Prevent repeated submission from silently importing the same records twice.

#### B. Bulk contract status updates

1. Add row selection and a bulk-action bar to the Contracts view.
2. Show selected-record count and proposed status before confirmation.
3. Define a contract status transition matrix for `ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, and `TERMINATED`.
4. Validate each transition server-side against current state and permissions.
5. Use transactions where the operation's consistency requirements call for them.
6. Return per-record success/failure details and audit the batch action.

#### Acceptance criteria

- Invalid import rows are identified before commit and cannot bypass server validation.
- Duplicate imports are handled according to a documented policy.
- The commit response accurately reports what happened.
- Bulk updates reject invalid transitions and unauthorized requests.
- Partial failures are clearly reported; successful records are not misrepresented as failed or vice versa.
- Import and bulk actions are auditable.

---

### Phase 5 — Connectivity redundancy matrix

**Priority:** P2

#### Scope

- Represent primary and backup internet circuits for each shop.
- Show provider, circuit type, service status, and other verified circuit attributes.
- Flag shops with a single active circuit.
- Flag apparent redundancy when two or more eligible circuits exist.
- Distinguish **logical redundancy** from **verified physical/provider diversity**. Multiple circuits may still share a provider, fiber route, power source, or other common failure point.
- Define the rules used by Dashboard and Shops views.
- Avoid claiming a shop is fully redundant unless the available data supports that conclusion.

#### Acceptance criteria

- Every shop's redundancy classification is reproducible from stored circuit data and documented rules.
- Inactive, terminated, or otherwise ineligible circuits do not count as active redundancy.
- Missing data is shown as unknown or unverified rather than assumed redundant.
- Dashboard counts match the underlying shop/circuit records.

---

### Phase 6 — Outage tracking and SLA credit support

**Priority:** P2

#### Scope

1. Create or verify a circuit-level incident model with start/end timestamps, affected circuit, status, and supporting notes/evidence.
2. Define how ongoing incidents, overlapping incidents, planned maintenance, exclusions, and partial-month service are treated.
3. Calculate monthly availability using the agreed SLA measurement policy.
4. Compare measured availability with the applicable provider contract.
5. Estimate potential SLA credits only when the required contract terms are available.
6. Clearly label estimates and require review before applying credits to an invoice.

A starting availability formula is:

`Availability % = (1 - eligible downtime minutes / eligible service minutes) × 100`

The terms “eligible downtime” and “eligible service minutes” must be defined by the applicable SLA. The formula alone does not establish credit eligibility.

#### Acceptance criteria

- Monthly availability can be reproduced from stored incident data and the documented policy.
- Time-zone handling and month boundaries are consistent.
- Planned maintenance and contractual exclusions follow the configured policy.
- SLA breaches and estimated credits can be traced to incidents and contract terms.
- Estimated credits are not silently posted as financial transactions.

---

### Phase 7 — Cost-per-Mbps reporting

**Priority:** P2

#### Scope

- Calculate monthly recurring cost divided by download bandwidth in Mbps.
- Normalize bandwidth units before calculation.
- Define how taxes, one-time setup fees, discounts, currency, and non-recurring charges are handled.
- Exclude or flag missing, zero, or invalid bandwidth values.
- Compare like-for-like services and display provider, plan, bandwidth, recurring cost, and effective cost per Mbps.
- Use the metric as a procurement signal, not as a standalone judgment of service quality or value.

Formula:

`Cost per Mbps = comparable monthly recurring cost / download bandwidth in Mbps`

#### Acceptance criteria

- All reports use consistent bandwidth units and cost definitions.
- Zero or missing bandwidth never produces misleading output.
- Calculations can be traced to source plan/provider data.
- Filters and totals remain consistent for the selected reporting period.
- Comparisons identify material differences in service terms where data is available.

---

## 5. Cross-cutting technical requirements

Apply these requirements to all phases as appropriate.

### API and validation

- Validate request bodies, query parameters, IDs, and state transitions on the server.
- Use consistent error shapes and appropriate HTTP status codes.
- Avoid exposing stack traces, secrets, or internal database details.
- Apply authorization and company scoping to every applicable endpoint.

### Database and consistency

- Use transactions for related writes that must succeed or fail together.
- Review foreign keys, unique constraints, and indexes against verified business rules.
- Use safe concurrency handling for payments and bulk operations.
- Add migrations only after confirming the existing schema and deployment state.
- Preserve financial and operational history according to retention requirements.

### Frontend

- Reuse shared components where they reduce inconsistency without forcing unrelated workflows into one abstraction.
- Provide loading, empty, error, validation, and success states.
- Prevent accidental duplicate submissions.
- Make forms keyboard-accessible and usable on supported mobile screens.

### Audit, logging, and monitoring

- Audit sensitive mutations and high-impact batch operations.
- Do not log passwords, access tokens, bot tokens, or other secrets.
- Ensure operational logs are useful without exposing unnecessary personal or business data.
- Add or verify health checks, error monitoring, and backup/restore procedures.

---

## 6. Testing and release strategy

For each phase, complete the following before marking it done:

1. **Unit tests:** validation, calculations, permissions, and state-transition rules.
2. **API integration tests:** authorization, company isolation, database constraints, and error handling.
3. **Workflow tests:** complete user flows such as editing a record, recording a partial payment, previewing an import, and bulk-updating contracts.
4. **Regression tests:** verify existing behavior is not broken.
5. **Responsive/accessibility checks:** verify supported screen sizes, keyboard navigation, and clear validation feedback.
6. **Release checks:** review migrations, backup availability, configuration, and rollback steps.

Use realistic test data that includes multiple companies, different roles, invalid references, duplicate submissions, concurrent requests, and failed operations.

Do not treat a feature as complete merely because the UI renders or a mocked action succeeds.

---

## 7. Suggested delivery order

| Order | Phase | Priority | Main deliverable |
|---:|---|---|---|
| 0 | Repository and requirements baseline | Required first | Verified gap matrix |
| 1 | Authorization, company isolation, record lifecycle | P0 | Safe administrative and CRUD workflows |
| 2 | Shared tables, mobile navigation, system health | P1 | Consistent operational UI |
| 3 | Billing and payment ledger | P0 | Correct, auditable payment workflows |
| 4 | Import preview and bulk contract updates | P1 | Safe batch operations |
| 5 | Connectivity redundancy matrix | P2 | Shop resilience visibility |
| 6 | Outage tracking and SLA support | P2 | Traceable availability and credit estimates |
| 7 | Cost-per-Mbps reporting | P2 | Comparable bandwidth economics |

The exact sequencing can be adjusted after the initial verification phase reveals dependencies. Security fixes or financial correctness issues discovered in any phase should be addressed before releasing the affected workflow.

---

## 8. Definition of done

A roadmap item is complete only when:

- The implementation matches a documented business rule.
- Existing repository capabilities have been reused where appropriate.
- Authorization and company isolation are enforced server-side.
- Validation and failure states are implemented.
- Required audit events are recorded without secrets.
- Unit, integration, and workflow tests pass.
- Regression checks pass.
- The feature is usable on supported screen sizes.
- Any migration and release/rollback steps are documented.
- Acceptance criteria are demonstrated against the actual implementation.

---

## 9. Final recommendation

Use this document as the revised implementation roadmap, not as proof that the repository already meets every requirement. Start with the repository and requirements baseline, then close security and financial-integrity gaps before expanding the feature set.

The objective is to make NetRent reliable, auditable, and maintainable—not simply to add more screens. Every phase should leave behind a tested workflow that is safe to operate and straightforward to support.
