-- Migration: 2026-10-31 - Add warningDays column to companies table
-- Description:
--   Adds an integer column warningDays (default 30) to the companies table.
--   Configures the advance threshold in days for contract expiration notices,
--   renewal alerts, and invoice due warnings.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS "warningDays" INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN companies."warningDays" IS
  'Advance threshold in days before expiration or due date to trigger alerts and warnings (default: 30 days).';

