-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ShopType" AS ENUM ('UNIT', 'KIOSK', 'OFFICE', 'RESTAURANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('FIBER', 'DSL', 'CABLE', 'WIRELESS', 'SATELLITE', 'OTHER');

-- CreateEnum
CREATE TYPE "IPType" AS ENUM ('STATIC', 'DYNAMIC', 'CGNAT');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING');

-- CreateEnum
CREATE TYPE "CircuitRole" AS ENUM ('PRIMARY', 'BACKUP', 'STANDALONE');

-- CreateEnum
CREATE TYPE "OutageType" AS ENUM ('OUTAGE', 'DEGRADED', 'MAINTENANCE', 'EQUIPMENT_FAILURE', 'PROVIDER_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "OutageStatus" AS ENUM ('ONGOING', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('PENDING', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('CONTRACT', 'QUOTATION', 'INVOICE', 'RECEIPT', 'PROVIDER_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RENEWAL_UPCOMING', 'RENEWAL_OVERDUE', 'INVOICE_OVERDUE', 'INVOICE_DUE_SOON', 'IMPORT_COMPLETED', 'IMPORT_FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "manager" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShopType" NOT NULL DEFAULT 'UNIT',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internet_providers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internet_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internet_plans" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bandwidthDownMbps" INTEGER NOT NULL,
    "bandwidthUpMbps" INTEGER NOT NULL,
    "connectionType" "ConnectionType" NOT NULL DEFAULT 'FIBER',
    "catalogMonthlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internet_services" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "shopId" TEXT,
    "providerId" TEXT NOT NULL,
    "planId" TEXT,
    "serviceCode" TEXT NOT NULL,
    "accountId" TEXT,
    "installationAddress" TEXT,
    "ipAddress" TEXT,
    "ipType" "IPType" NOT NULL DEFAULT 'DYNAMIC',
    "username" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'PENDING',
    "circuitRole" "CircuitRole" NOT NULL DEFAULT 'STANDALONE',
    "installedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internet_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outage_incidents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "OutageType" NOT NULL DEFAULT 'OUTAGE',
    "status" "OutageStatus" NOT NULL DEFAULT 'ONGOING',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "downtimeMinutes" INTEGER,
    "notes" TEXT,
    "reportedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outage_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internet_contracts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "freeMonths" INTEGER NOT NULL DEFAULT 0,
    "monthlyFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internet_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_renewals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "oldContractId" TEXT NOT NULL,
    "newContractId" TEXT,
    "serviceId" TEXT NOT NULL,
    "decisionDate" TIMESTAMP(3),
    "decidedById" TEXT,
    "status" "RenewalStatus" NOT NULL DEFAULT 'PENDING',
    "warningDate" TIMESTAMP(3),
    "noticeDate" TIMESTAMP(3),
    "newStartDate" TIMESTAMP(3),
    "newEndDate" TIMESTAMP(3),
    "newMonthlyFee" DECIMAL(65,30),
    "newCurrency" TEXT,
    "newDurationMonths" INTEGER,
    "newFreeMonths" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" "AttachmentCategory" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "worksheet" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'contract',
    "columnMap" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "data" TEXT NOT NULL,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "branches_companyId_idx" ON "branches"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_companyId_code_key" ON "branches"("companyId", "code");

-- CreateIndex
CREATE INDEX "shops_companyId_branchId_idx" ON "shops"("companyId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "shops_companyId_code_key" ON "shops"("companyId", "code");

-- CreateIndex
CREATE INDEX "notes_shopId_idx" ON "notes"("shopId");

-- CreateIndex
CREATE INDEX "internet_providers_companyId_idx" ON "internet_providers"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "internet_providers_companyId_code_key" ON "internet_providers"("companyId", "code");

-- CreateIndex
CREATE INDEX "internet_plans_companyId_providerId_idx" ON "internet_plans"("companyId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "internet_plans_companyId_providerId_name_key" ON "internet_plans"("companyId", "providerId", "name");

-- CreateIndex
CREATE INDEX "internet_services_companyId_branchId_idx" ON "internet_services"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "internet_services_companyId_shopId_idx" ON "internet_services"("companyId", "shopId");

-- CreateIndex
CREATE INDEX "internet_services_companyId_providerId_idx" ON "internet_services"("companyId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "internet_services_companyId_serviceCode_key" ON "internet_services"("companyId", "serviceCode");

-- CreateIndex
CREATE INDEX "outage_incidents_companyId_serviceId_idx" ON "outage_incidents"("companyId", "serviceId");

-- CreateIndex
CREATE INDEX "outage_incidents_companyId_status_idx" ON "outage_incidents"("companyId", "status");

-- CreateIndex
CREATE INDEX "outage_incidents_companyId_startTime_idx" ON "outage_incidents"("companyId", "startTime");

-- CreateIndex
CREATE INDEX "internet_contracts_companyId_serviceId_idx" ON "internet_contracts"("companyId", "serviceId");

-- CreateIndex
CREATE INDEX "internet_contracts_companyId_status_idx" ON "internet_contracts"("companyId", "status");

-- CreateIndex
CREATE INDEX "internet_contracts_endDate_idx" ON "internet_contracts"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "internet_contracts_companyId_contractNumber_key" ON "internet_contracts"("companyId", "contractNumber");

-- CreateIndex
CREATE INDEX "contract_renewals_companyId_status_idx" ON "contract_renewals"("companyId", "status");

-- CreateIndex
CREATE INDEX "contract_renewals_companyId_warningDate_idx" ON "contract_renewals"("companyId", "warningDate");

-- CreateIndex
CREATE UNIQUE INDEX "contract_renewals_oldContractId_key" ON "contract_renewals"("oldContractId");

-- CreateIndex
CREATE INDEX "invoices_companyId_contractId_idx" ON "invoices"("companyId", "contractId");

-- CreateIndex
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_invoiceNumber_key" ON "invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "payments_companyId_paymentDate_idx" ON "payments"("companyId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_companyId_status_idx" ON "payments"("companyId", "status");

-- CreateIndex
CREATE INDEX "payment_allocations_invoiceId_idx" ON "payment_allocations"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_invoiceId_key" ON "payment_allocations"("paymentId", "invoiceId");

-- CreateIndex
CREATE INDEX "attachments_companyId_entityType_entityId_idx" ON "attachments"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "attachments_companyId_createdAt_idx" ON "attachments"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_companyId_userId_readAt_idx" ON "notifications"("companyId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_companyId_createdAt_idx" ON "notifications"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_entityType_idx" ON "audit_logs"("companyId", "entityType");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_companyId_idx" ON "import_jobs"("companyId");

-- CreateIndex
CREATE INDEX "import_rows_jobId_idx" ON "import_rows"("jobId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_providers" ADD CONSTRAINT "internet_providers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_plans" ADD CONSTRAINT "internet_plans_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_plans" ADD CONSTRAINT "internet_plans_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "internet_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_services" ADD CONSTRAINT "internet_services_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_services" ADD CONSTRAINT "internet_services_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_services" ADD CONSTRAINT "internet_services_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_services" ADD CONSTRAINT "internet_services_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "internet_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_services" ADD CONSTRAINT "internet_services_planId_fkey" FOREIGN KEY ("planId") REFERENCES "internet_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_incidents" ADD CONSTRAINT "outage_incidents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_incidents" ADD CONSTRAINT "outage_incidents_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "internet_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_incidents" ADD CONSTRAINT "outage_incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_incidents" ADD CONSTRAINT "outage_incidents_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_contracts" ADD CONSTRAINT "internet_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_contracts" ADD CONSTRAINT "internet_contracts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "internet_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_contracts" ADD CONSTRAINT "internet_contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_oldContractId_fkey" FOREIGN KEY ("oldContractId") REFERENCES "internet_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_newContractId_fkey" FOREIGN KEY ("newContractId") REFERENCES "internet_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "internet_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

