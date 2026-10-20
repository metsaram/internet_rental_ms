# NetRent — Project Overview

## Mission & Purpose
**NetRent** is an enterprise-grade Internet Rental Management System designed as a multi-module SaaS application for businesses tracking ISP contracts, services, branch infrastructure, billing, and renewals across distributed branches and shops.

## Key Capabilities
- **Single-Page Application Shell**: Fast, responsive client-side view switching based on URL hash routing (`#dashboard`, `#contracts`, `#billing`, etc.).
- **Branch & Shop Hierarchy**: Hierarchical management of physical branches, shop locations, notes, and service allocations.
- **Provider & Plan Catalog**: Master registry of Internet Service Providers (ISPs), service tiers, bandwidth tiers, and contract pricing models.
- **Internet Services & Contracts**: Complete inventory of active/pending/decommissioned lines with sensitive credential masking, contract duration tracking, and free-month cost normalization.
- **Invoices, Allocations & Payments**: Full lifecycle invoicing with partial payments, automated balance calculation, void transaction auditing, and printable receipts.
- **Automated Renewals & Notifications**: Early expiration warning system, renewal term suggestion, and deduplicated in-app notifications.
- **Excel Data Operations**: Import wizard with column auto-mapping, validation checks, transactional execution, and formula-injection-safe export.
- **Audit Logging**: Comprehensive mutation tracking with automatic redaction of secrets, tokens, and ISP credentials.

## Access Control & Roles
- **ADMIN**: Full system access, company settings, user management, and audit inspection.
- **STAFF**: Day-to-day operations (viewing inventory, logging notes, entering invoices and payments).
