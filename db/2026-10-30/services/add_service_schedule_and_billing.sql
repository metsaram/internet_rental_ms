-- Migration: Add schedule & billing columns to internet_services, link invoices to services
ALTER TABLE "internet_services" 
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "freeMonths" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "monthlyFee" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle" DEFAULT 'ANNUAL';

-- Allow invoices without contracts and support direct service linkage
ALTER TABLE "invoices" ALTER COLUMN "contractId" DROP NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "serviceId" TEXT REFERENCES "internet_services"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "invoices_companyId_serviceId_idx" ON "invoices"("companyId", "serviceId");
