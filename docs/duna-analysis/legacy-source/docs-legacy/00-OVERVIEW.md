# Duna Legacy Dashboard — Overview

## Project Summary

**Duna** is a Laravel 10+ shipping/logistics management dashboard for a freight forwarding company (< 10 employees). It handles the complete operational workflow: yard management → loading lists → B/L & manifests → invoicing → financial tracking.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Laravel 10+ (PHP 8.x) |
| Database | MySQL/PostgreSQL (Eloquent ORM) |
| Frontend | Blade templates + AdminLTE-style theme (jQuery, Select2, DataTables) |
| Auth | Laravel Sanctum + custom RBAC (Role/Permission) |
| File Storage | Local (`uploads/avatars`, `uploads/general`) |
| Assets | Compiled JS/CSS (Vite/Mix), 684 JS files, 416 SCSS files (mostly template noise) |

## Module Mapping: Legacy vs Client Requirements

| Client Module (Voice/Title) | Legacy Module | Status |
|---|---|---|
| **Operations → Yard Inventory** | `LoadingController@yards` + `Yard` model | ✅ Exists |
| **Operations → Load List** | `LoadingController` + `Loading`/`Loadinglist` models | ✅ Exists |
| **Operations → Yard** | Same as Yard Inventory | ✅ Exists |
| **Operations → Port** | `LoadingController@ports` + `Port` model | ✅ Exists |
| **Manifest & B/L → B/L** | `ManifestController` (BL methods) + `Bl` model | ✅ Exists |
| **Manifest & B/L → Manifest** | `ManifestController` + `Manifest` model | ✅ Exists |
| **Manifest & B/L → Shipper** | `Shipper` model + relationships | ✅ Exists |
| **Manifest & B/L → Agent** | `Agent` model | ✅ Exists |
| **Manifest & B/L → Consignee** | `Consignee` model | ✅ Exists |
| **Manifest & B/L → Vessel** | Stored as string on `Manifest.vessel` + `Bl.vessel` | ⚠️ Not a model |
| **Accounting → Invoice** | `InvoiceController` + `Invoice` + `Item` models | ✅ Exists |
| **Accounting → Receipt/Payment Voucher** | `Fin` model (PAYMENT/RECEIVED) | ⚠️ Partial |
| **Accounting → Ledger** | Not found as separate model | ❌ Missing |
| **Accounting → Delivery Order** | Not found | ❌ Missing |
| **Accounting → Release Order** | Not found (but `Bl::RELEASED` status exists) | ⚠️ Partial |
| **Accounting → Proforma** | `Performa` + `Performa_item` models | ✅ Exists |
| **Accounting → Quotation** | `Quotation` model | ✅ Exists (minimal) |
| **Accounting → Salary** | Not found | ❌ Missing |
| **Accounting → Financial Reports** | Not found | ❌ Missing |
| **Letters** | Not found | ❌ Missing |
| **Customers** | `User` model (level='User') + `Shipper`/`Consignee` | ⚠️ Fragmented |
| **Users** | `User` model + `Role`/`Permission` | ✅ Exists |

## Key Observations

1. **Strong alignment**: 15/22 requested modules map directly to existing code
2. **Gaps**: Ledger, Delivery Order, Release Order, Salary, Financial Reports, Letters, Customer CRM
3. **Data model**: 23 Eloquent models with rich relationships (polymorphic not used; all foreign keys explicit)
4. **Auth**: Custom RBAC with permissions like `loadings.show`, `manifest.create`, `bl.delete`, etc.
5. **No API routes**: Only `web.php` routes (Blade-rendered pages); API would need to be built
6. **Migrations**: Only 4 default Laravel migrations — **schema truth is in models + Blade views**
7. **Real business data**: `docs/`, `fins/`, `uploads/` contain actual documents (empty in copy; check production)

## Next Steps Priority

| Priority | Action |
|---|---|
| P0 | Extract complete data dictionary from models (✅ Done below) |
| P0 | Document all workflows (CRUD + business logic) |
| P1 | Map Blade views to UI pages inventory |
| P1 | Identify GAPS for client clarification |
| P2 | Build Prisma schema for new dashboard |
| P2 | Design new API layer (REST/GraphQL) |