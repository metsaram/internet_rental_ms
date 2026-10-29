# NetRent — API Guide

## Overview
NetRent utilizes Next.js 16 App Router Route Handlers (`src/app/api/**`). All handlers are stateless, company-isolated, and require valid session credentials.

## Authentication & Authorization
Handlers use session helpers from `@/lib/session`:
- `requireUser(req)`: Validates that the request has an active session. Throws 401 if unauthenticated.
- `requireAdmin(req)`: Validates that the active session user has the `ADMIN` role. Throws 403 if unauthorized.
- `assertBranchInCompany(branchId, companyId)`: Ensures entities cannot be modified across tenant boundaries.

```typescript
import { requireUser, errorResponse } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const data = await db.service.findMany({
      where: { companyId: user.companyId },
    });
    return Response.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
```

## Standard API Endpoints

### 1. Identity & Company
- `GET /api/me`: Returns current user info, role, and active company details.
- `GET /api/company`: Returns company profile.
- `PATCH /api/company`: Updates company profile (Admin only).
- `GET /api/users`: Lists users within the caller's company.
- `POST /api/users`: Creates a new user (Admin only, scrypt hashed).

### 2. Infrastructure & Operations
- `GET /api/branches`: Lists branches (`?min=true` for compact selector format).
- `POST /api/branches`: Creates a branch with unique code validation.
- `GET/PATCH/DELETE /api/branches/[id]`: Manages branch lifecycle.
- `GET /api/shops`: Lists shops with relation counts and assigned branches.
- `POST /api/shops`: Creates a new shop.
- `GET/PATCH/DELETE /api/shops/[id]`: Manages shop details and notes.
- `POST /api/notes`: Creates a note for a shop.
- `DELETE /api/notes/[id]`: Deletes a note (Author or Admin).

### 3. Providers & Plans
- `GET/POST /api/providers`: Provider registry.
- `GET/PATCH/DELETE /api/providers/[id]`: Provider CRUD with referential integrity protection.
- `GET/POST /api/plans`: Internet service plans.
- `GET/PATCH/DELETE /api/plans/[id]`: Plan CRUD.

### 4. Services & Contracts
- `GET/POST /api/services`: Service inventory (credentials automatically masked in listings).
- `GET/PATCH/DELETE /api/services/[id]`: Service management.
- `GET/POST /api/contracts`: Contracts with calculated duration, free months, and effective costs.
- `GET/PATCH/DELETE /api/contracts/[id]`: Contract detail, audit history, and timeline.
- `POST /api/contracts/bulk-status`: Transactional bulk status update.
- `POST /api/contracts/[id]/renew`: Atomic contract renewal execution.

### 5. Invoicing & Billing
- `GET/POST /api/invoices`: Invoices with auto-derived outstanding balances.
- `GET/PATCH/DELETE /api/invoices/[id]`: Invoice management (voided records immutable; deletable if no recorded payments).
- `POST /api/invoices/[id]/void`: Voids an invoice while preserving historical allocations.
- `GET /api/invoices/[id]/print`: HTML printout template.
- `GET/POST /api/payments`: Records and allocates payments across outstanding invoices.

### 6. Attachments & Storage
- `GET/POST /api/attachments`: List and upload files with MIME and size verification.
- `GET/DELETE /api/attachments/[id]`: Metadata view and file deletion.
- `GET /api/attachments/[id]/download`: Secure file streaming.
