-- =============================================================================
-- Database Stored Procedure: clear_unrelated_branch_data
-- Timestamp: 2026-10-29
-- Purpose:
--   Cleans all dummy/test data and records unrelated to active branches.
--   Preserves companies, users, active branches, and their active services/contracts.
--
-- How to run in SQL:
--   CALL clear_unrelated_branch_data();
--   -- or to also clear all shops across all branches:
--   CALL clear_unrelated_branch_data(true);
--
-- How to remove stored procedure:
--   DROP PROCEDURE IF EXISTS clear_unrelated_branch_data(BOOLEAN);
-- =============================================================================

CREATE OR REPLACE PROCEDURE clear_unrelated_branch_data(
    p_clear_all_shops BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_allocations INT := 0;
    v_deleted_invoices INT := 0;
    v_deleted_renewals INT := 0;
    v_deleted_contracts INT := 0;
    v_deleted_outages INT := 0;
    v_deleted_services INT := 0;
    v_deleted_notes INT := 0;
    v_deleted_shops INT := 0;
    v_deleted_branches INT := 0;
    v_deleted_test_providers INT := 0;
    v_deleted_payments INT := 0;
BEGIN
    RAISE NOTICE '---------------------------------------------------------';
    RAISE NOTICE 'Starting database cleanup (unrelated to active branches)...';
    RAISE NOTICE '---------------------------------------------------------';

    -- 1. Payment Allocations linked to inactive branches
    DELETE FROM payment_allocations
    WHERE "invoiceId" IN (
        SELECT i.id
        FROM invoices i
        JOIN internet_contracts c ON i."contractId" = c.id
        JOIN internet_services s ON c."serviceId" = s.id
        JOIN branches b ON s."branchId" = b.id
        WHERE b.status != 'ACTIVE'
    );
    GET DIAGNOSTICS v_deleted_allocations = ROW_COUNT;

    -- 2. Invoices linked to inactive branches
    DELETE FROM invoices
    WHERE "contractId" IN (
        SELECT c.id
        FROM internet_contracts c
        JOIN internet_services s ON c."serviceId" = s.id
        JOIN branches b ON s."branchId" = b.id
        WHERE b.status != 'ACTIVE'
    );
    GET DIAGNOSTICS v_deleted_invoices = ROW_COUNT;

    -- 3. Contract Renewals linked to inactive branches
    DELETE FROM contract_renewals
    WHERE "oldContractId" IN (
        SELECT c.id
        FROM internet_contracts c
        JOIN internet_services s ON c."serviceId" = s.id
        JOIN branches b ON s."branchId" = b.id
        WHERE b.status != 'ACTIVE'
    )
    OR "newContractId" IN (
        SELECT c.id
        FROM internet_contracts c
        JOIN internet_services s ON c."serviceId" = s.id
        JOIN branches b ON s."branchId" = b.id
        WHERE b.status != 'ACTIVE'
    );
    GET DIAGNOSTICS v_deleted_renewals = ROW_COUNT;

    -- 4. Contracts linked to inactive branches
    DELETE FROM internet_contracts
    WHERE "serviceId" IN (
        SELECT s.id
        FROM internet_services s
        JOIN branches b ON s."branchId" = b.id
        WHERE b.status != 'ACTIVE'
    );
    GET DIAGNOSTICS v_deleted_contracts = ROW_COUNT;

    -- 5. Outages linked to inactive branches
    DELETE FROM outage_incidents
    WHERE "serviceId" IN (
        SELECT s.id
        FROM internet_services s
        JOIN branches b ON s."branchId" = b.id
        WHERE b.status != 'ACTIVE'
    );
    GET DIAGNOSTICS v_deleted_outages = ROW_COUNT;

    -- 6. Services on inactive branches
    DELETE FROM internet_services
    WHERE "branchId" IN (
        SELECT id FROM branches WHERE status != 'ACTIVE'
    );
    GET DIAGNOSTICS v_deleted_services = ROW_COUNT;

    -- 7. Notes and Shops cleanup
    IF p_clear_all_shops THEN
        DELETE FROM notes;
        GET DIAGNOSTICS v_deleted_notes = ROW_COUNT;

        DELETE FROM shops;
        GET DIAGNOSTICS v_deleted_shops = ROW_COUNT;
    ELSE
        DELETE FROM notes
        WHERE "shopId" IN (
            SELECT s.id
            FROM shops s
            JOIN branches b ON s."branchId" = b.id
            WHERE b.status != 'ACTIVE'
        );
        GET DIAGNOSTICS v_deleted_notes = ROW_COUNT;

        DELETE FROM shops
        WHERE "branchId" IN (
            SELECT id FROM branches WHERE status != 'ACTIVE'
        );
        GET DIAGNOSTICS v_deleted_shops = ROW_COUNT;
    END IF;

    -- 8. Clean orphan notes
    DELETE FROM notes WHERE "shopId" NOT IN (SELECT id FROM shops);

    -- 9. Delete test providers (codes matching 'PR-T%') and their catalog plans
    DELETE FROM internet_plans
    WHERE "providerId" IN (
        SELECT id FROM internet_providers WHERE code LIKE 'PR-T%'
    );
    DELETE FROM internet_providers
    WHERE code LIKE 'PR-T%';
    GET DIAGNOSTICS v_deleted_test_providers = ROW_COUNT;

    -- 10. Clean orphan payments without any allocations
    DELETE FROM payments
    WHERE id NOT IN (SELECT DISTINCT "paymentId" FROM payment_allocations);
    GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;

    -- 11. Inactive Branches
    DELETE FROM branches WHERE status != 'ACTIVE';
    GET DIAGNOSTICS v_deleted_branches = ROW_COUNT;

    RAISE NOTICE 'Cleanup summary:';
    RAISE NOTICE '  - Inactive branches deleted: %', v_deleted_branches;
    RAISE NOTICE '  - Shops deleted: %', v_deleted_shops;
    RAISE NOTICE '  - Notes deleted: %', v_deleted_notes;
    RAISE NOTICE '  - Services deleted: %', v_deleted_services;
    RAISE NOTICE '  - Contracts deleted: %', v_deleted_contracts;
    RAISE NOTICE '  - Renewals deleted: %', v_deleted_renewals;
    RAISE NOTICE '  - Invoices deleted: %', v_deleted_invoices;
    RAISE NOTICE '  - Payment allocations deleted: %', v_deleted_allocations;
    RAISE NOTICE '  - Orphan payments deleted: %', v_deleted_payments;
    RAISE NOTICE '  - Test providers deleted: %', v_deleted_test_providers;
    RAISE NOTICE 'Database cleanup completed successfully.';
END;
$$;
