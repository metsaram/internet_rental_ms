-- Migration: 2026-10-30 - Add useContract column to companies table
-- Description:
--   Adds a boolean flag use_contract (default TRUE) to the companies table.
--   When set to FALSE, invoices for that company do not require a linked contract.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS use_contract BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN companies.use_contract IS
  'When TRUE (default), every invoice must reference a contract. When FALSE, invoices can be created without a contract.';
