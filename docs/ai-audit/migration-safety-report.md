# PHASE 3A MIGRATION SAFETY INVESTIGATION REPORT

**Date:** 2026-09-23
**Repository:** /home/duna/shipping-dashboard/new-erp
**HEAD:** 2b89e38 (feat: Phase 20 - Agent Portal, ADR-040)
**Branch:** main (only branch, no remote refs)
**Prisma version:** 5.22.0

---

## 1. MIGRATION DIRECTORIES ON DISK (26 total)

All 26 directories exist in `prisma/migrations/` with valid `migration.sql` files:

```
20260901162722_init                          (Phase 1: initial schema + infra)
20260902210635_phase2_auth_rbac              (Phase 2: auth/RBAC tables)
20260902225307_phase3_master_data_indexes    (Phase 3: master data indexes)
20260903004915_phase2_refresh_lookup         (Phase 2: refresh token lookup key)
20260903032523_phase4_cargo_yard_inventory   (Phase 4: Cargo + YardInventory creation)
20260903032525_phase5_inspection_management  (Phase 5: Inspection table + partial unique index)
20260903043000_phase6_vessel_voyage          (Phase 6: Vessel + Voyage)
20260904120000_phase7_load_planning          (Phase 7: LoadList + LoadListItem)
20260909030420_phase8_actual_loading         (Phase 8: ActualLoading)
20260911224819_phase9_manifest               (Phase 9: Manifest)
20260912002614_manifest_voyage_unique_softdelete (Phase 9 fix)
20260912130959_phase10_bills_of_lading       (Phase 10: B/L)
20260912175229_phase11_invoices              (Phase 11: Invoices)
20260912175522_phase11_invoice_totals        (Phase 11: invoice totals)
20260912175813_phase11_invoice_voyage        (Phase 11: invoice-voyage FK)
20260912180341_phase11_invoice_title_nullable (Phase 11: title nullable)
20260912190203_phase12_vouchers              (Phase 12: vouchers)
20260912194439_phase13_delivery_release_orders (Phase 13: D/O + R/O)
20260912233657_phase14_proforma              (Phase 14: proforma)
20260913005121_phase15_quotations            (Phase 15: quotations)
20260913020735_phase16_salary                (Phase 16: salary)
20260913040329_phase17_letters               (Phase 17: letters)
20260913184816_phase18_jobs                  (Phase 18: jobs)
20260913191119_phase18_jobs_jobtype          (Phase 18: jobType column)
20260913200811_phase19_discharge             (Phase 19: discharge)
20260913210526_phase20_agent_portal          (Phase 20: agent portal)
```

**Note:** No Phase 3 (inspection/loading lifecycle) or Phase 3A (cargo pol/pod) migration directories exist on disk.

---

## 2. _prisma_migrations ROWS (30 total)

### Matched to disk (26 rows — applied_steps_count=1 for all)

These 26 rows exactly match the 26 directories on disk. All have `applied_steps_count=1`, meaning they executed successfully.

| # | migration_name | applied_steps_count |
|---|---|---|
| 1 | 20260901162722_init | 1 |
| 2 | 20260902210635_phase2_auth_rbac | 1 |
| 3 | 20260902225307_phase3_master_data_indexes | 1 |
| 4 | 20260903004915_phase2_refresh_lookup | 1 |
| 5 | 20260903032523_phase4_cargo_yard_inventory | 1 |
| 6 | 20260903032525_phase5_inspection_management | 1 |
| 7 | 20260903043000_phase6_vessel_voyage | 1 |
| 8 | 20260904120000_phase7_load_planning | 1 |
| 9 | 20260909030420_phase8_actual_loading | 1 |
| 10 | 20260911224819_phase9_manifest | 1 |
| 11 | 20260912002614_manifest_voyage_unique_softdelete | 1 |
| 12 | 20260912130959_phase10_bills_of_lading | 1 |
| 13 | 20260912175229_phase11_invoices | 1 |
| 14 | 20260912175522_phase11_invoice_totals | 1 |
| 15 | 20260912175813_phase11_invoice_voyage | 1 |
| 16 | 20260912180341_phase11_invoice_title_nullable | 1 |
| 17 | 20260912190203_phase12_vouchers | 1 |
| 18 | 20260912194439_phase13_delivery_release_orders | 1 |
| 19 | 20260912233657_phase14_proforma | 1 |
| 20 | 20260913005121_phase15_quotations | 1 |
| 21 | 20260913020735_phase16_salary | 1 |
| 22 | 20260913040329_phase17_letters | 1 |
| 23 | 20260913184816_phase18_jobs | 1 |
| 24 | 20260913191119_phase18_jobs_jobtype | 1 |
| 25 | 20260913200811_phase19_discharge | 1 |
| 26 | 20260913210526_phase20_agent_portal | 1 |

### MISSING from disk (4 rows)

| # | ID (UUID) | migration_name | applied_steps_count | started_at | finished_at |
|---|---|---|---|---|---|
| 27 | e9645e68-e272-43ea-8962-e7d34bdec9e3 | 20260921012713_phase1_infrastructure | **1** | 2026-09-21 01:27:13 | 2026-09-21 01:27:13 |
| 28 | ba38b104-ed74-470e-9922-fbdfb6f9af1f | 20260921032600_phase2_master_data_party_model | **0** | 2026-09-21 03:58:52 | 2026-09-21 03:58:52 |
| 29 | 62f45b1a-efb4-4d2a-a350-3bae13567382 | 20260921120000_phase3_cargo_inspection_loading_lifecycle | **0** | 2026-09-21 23:40:37 | 2026-09-21 23:40:37 |
| 30 | b7107ab2-d0c4-45e0-87c0-a80a79554a86 | 20260921130000_phase3a_cargo_pol_pod | **0** | 2026-09-22 01:31:37 | 2026-09-22 01:31:37 |

---

## 3. MISSING MIGRATIONS — DETAILED ANALYSIS

### 3a. 20260921012713_phase1_infrastructure

- **Status:** `applied_steps_count=1` — Prisma believes it executed successfully
- **On disk:** NO directory, NO `migration.sql`
- **Git history:** NEVER existed in any commit (verified across ALL commits in the repository, including reflog)
- **Repository branches:** Only `main` branch exists. No orphaned branches, no stashed changes containing these directories.
- **Purpose (inferred from schema.prisma):**
  - Creates Phase 1 infrastructure tables: `NumberingSequence`, `AuditLog`, `FileAttachment`, `DocumentTemplate`, `DocumentTemplateVersion`
  - All 5 tables are declared in schema.prisma (lines 1933-2001+) and presumably exist in the live DB
  - The migration name suggests it's a Phase 1 additive migration (infrastructure), not a destructive one
- **Recovery:** The exact SQL CANNOT be recovered from git because the directory never existed in any commit. The SQL would need to be reconstructed by reading the table definitions from schema.prisma and writing equivalent `CREATE TABLE` / `CREATE INDEX` statements.

### 3b. 20260921032600_phase2_master_data_party_model

- **Status:** `applied_steps_count=0` — Prisma believes it did NOT execute
- **On disk:** NO directory, NO `migration.sql`
- **Git history:** NEVER existed in any commit
- **Purpose (inferred):**
  - The name "master_data_party_model" suggests it adds party-model tables (Shipper, Consignee, Agent) or extends Cargo with shipperId/consigneeId
  - Cargo already has shipperId, consigneeId in both schema and live DB
  - The `Shipper`, `Consignee`, `Agent` models exist in schema.prisma
- **Recovery:** Cannot be recovered from git. Must be reconstructed from schema.prisma.

### 3c. 20260921120000_phase3_cargo_inspection_loading_lifecycle

- **Status:** `applied_steps_count=0` — Prisma believes it did NOT execute
- **On disk:** NO directory, NO `migration.sql`
- **Git history:** NEVER existed in any commit
- **Purpose (high confidence — see live DB evidence below):**
  1. Rename `CargoStatus` enum: `READY` → `READY_FOR_LOADING`
  2. Rename `InspectionStatus` enum: `APPROVED` → `DONE`, `REJECTED` → `FAILED`, add `NEEDS_REINSPECTION`
  3. Possibly: drop and re-add Cargo.status column with new enum type (or skip it)
- **Live DB confirms:**
  - `CargoStatus` has `READY_FOR_LOADING` (NOT `READY`)
  - `InspectionStatus` has `DONE`, `FAILED`, `NEEDS_REINSPECTION` (NOT `APPROVED`, `REJECTED`)
- **Critical observation:** The original Phase 4 migration created Cargo WITH a `status` column using `CargoStatus` enum. If this migration renamed the enum type (DROP + CREATE in Postgres), the `status` column would be dropped automatically ( CASCADE). The migration would then need to re-add the column. The fact that `status` is missing from the live DB suggests either:
  - The enum was renamed via DROP+CREATE and the column re-creation was NOT done or NOT executed
  - OR the column was intentionally dropped (treating `loadingStatus` as the only status field)
- **Recovery:** SQL is PARTIALLY INFERABLE from the live DB state but CANNOT be confirmed from git.

### 3d. 20260921130000_phase3a_cargo_pol_pod

- **Status:** `applied_steps_count=0` — Prisma believes it did NOT execute
- **On disk:** NO directory, NO `migration.sql`
- **Git history:** NEVER existed in any commit
- **Purpose (high confidence):**
  - ADD COLUMN `pol TEXT` to Cargo
  - ADD COLUMN `pod TEXT` to Cargo
  - Possibly also: `description`, `chassis`, `serial`, `units`, `comment` (all present in live DB)
- **Live DB confirms:** pol, pod, description, chassis, serial, units, comment ALL exist in Cargo table
- **Recovery:** SQL is INFERABLE from the columns present in the live DB but CANNOT be confirmed from git.

---

## 4. LIVE CARGO SCHEMA (38 columns)

From `information_schema.columns` on `public.Cargo`:

```
Column             | Type                      | Nullable | Default
-------------------|---------------------------|----------|------------------
id                 | text                      | NO       |
reference          | text                      | NO       |
customerId         | text                      | NO       |
portId             | text                      | NO       |
yardId             | text                      | YES      |
destinationPortId  | text                      | YES      |
cargoType          | CargoType (enum)         | NO       |
specification      | text                      | YES      |
serialNumber       | text                      | YES      |
chassisNumber      | text                      | YES      |
vin                | text                      | YES      |
weight             | numeric(18,2)            | YES      |
weightUnit         | WeightUnit (enum)        | YES      |
quantity           | integer                   | YES      |
packages           | integer                   | YES      |
packageType        | text                      | YES      |
arrivalDate        | timestamp                | YES      |
arrivalReference   | text                      | YES      |
loadingStatus      | LoadingStatus (enum)     | NO       | NOT_LOADED
manifestNumber     | text                      | YES      |
comments           | text                      | YES      |
createdById        | text                      | YES      |
createdAt          | timestamp                | NO       | CURRENT_TIMESTAMP
updatedAt          | timestamp                | NO       |
deletedAt          | timestamp                | YES      |
shipperId          | text                      | YES      | ← Phase 2/party model
consigneeId        | text                      | YES      | ← Phase 2/party model
cargoValue         | numeric(18,2)            | YES      | ← Phase 3A
cargoValueCurrency | text                      | YES      | ← Phase 3A
jobId              | text                      | YES      | ← Phase 3A
inspectionStatus   | InspectionStatus (enum)  | NO       | PENDING
pol                | text                      | YES      | ← Phase 3A
pod                | text                      | YES      | ← Phase 3A
description        | text                      | YES      | ← Phase 3A
chassis            | text                      | YES      | ← Phase 3A
serial             | text                      | YES      | ← Phase 3A
units              | integer                   | YES      | ← Phase 3A
comment            | text                      | YES      | ← Phase 3A
```

**TOTAL: 38 columns**

**NOT present:** `status` column (despite schema.prisma declaring `status CargoStatus @default(REGISTERED)`)

---

## 5. LIVE ENUM VALUES (all confirmed via pg_catalog)

### CargoStatus (6 values)
```
REGISTERED
AT_YARD
READY_FOR_LOADING     ← NOT 'READY' (renamed)
LOADED
DELIVERED
CANCELLED
```

### CargoType (6 values)
```
GENERAL
VEHICLE
HEAVY_LIFT
CONTAINER
BULK
PROJECT
```

### InspectionStatus (5 values)
```
PENDING
BOOKED
DONE                   ← was 'APPROVED' (renamed)
FAILED                 ← was 'REJECTED' (renamed)
NEEDS_REINSPECTION     ← new value
```

### LoadingStatus (2 values)
```
NOT_LOADED
LOADED
```

### WeightUnit (2 values)
```
KG
MT
```

### InventoryStatus (2 values)
```
IN_YARD
RESERVED
```

All enum values match schema.prisma exactly. The enum renames (READY→READY_FOR_LOADING, APPROVED→DONE, REJECTED→FAILED, +NEEDS_REINSPECTION) were definitely applied to the live database.

---

## 6. CARGO.STATUS COLUMN — ROOT CAUSE ANALYSIS

### Chain of evidence:

1. **Original creation:** Migration `20260903032523_phase4_cargo_yard_inventory` (on disk, applied) created:
   ```sql
   CREATE TYPE "CargoStatus" AS ENUM ('REGISTERED', 'AT_YARD', 'READY', 'LOADED', 'DELIVERED', 'CANCELLED');
   CREATE TABLE "Cargo" (
       ...
       "status" "CargoStatus" NOT NULL DEFAULT 'REGISTERED',
       ...
   );
   ```
   At this point, Cargo HAD a `status` column with value `READY` (not `READY_FOR_LOADING`).

2. **Missing migration (likely):** Migration `20260921120000_phase3_cargo_inspection_loading_lifecycle` (NOT on disk, steps=0) was supposed to:
   - Rename `CargoStatus` enum: `READY` → `READY_FOR_LOADING`
   - Rename `InspectionStatus`: `APPROVED`→`DONE`, `REJECTED`→`FAILED`, add `NEEDS_REINSPECTION`
   
3. **What actually happened in the DB:**
   - The enum WAS renamed (live DB has `READY_FOR_LOADING`, not `READY`)
   - The `status` column is GONE from the live DB
   
4. **How the enum rename could have removed the column:**
   In PostgreSQL, the standard way to rename an enum value is the two-step process:
   ```sql
   -- Step 1: Create new enum type with updated values
   CREATE TYPE "CargoStatus_new" AS ENUM ('REGISTERED', 'AT_YARD', 'READY_FOR_LOADING', 'LOADED', 'DELIVERED', 'CANCELLED');
   
   -- Step 2: Alter all columns using old type to use new type
   ALTER TABLE "Cargo" ALTER COLUMN "status" TYPE "CargoStatus_new" USING "status"::text::"CargoStatus_new";
   
   -- Step 3: Drop old enum
   DROP TYPE "CargoStatus";
   
   -- Step 4: Rename new enum
   ALTER TYPE "CargoStatus_new" RENAME TO "CargoStatus";
   ```
   
   If the migration did steps 1-3 but missed step 2 (alter column) and step 4, OR if it used `DROP TYPE ... CASCADE` which automatically drops all columns using that type, the `status` column would be lost.
   
   **The most likely scenario:** The migration used `DROP TYPE "CargoStatus" CASCADE` (or equivalent) to remove the old enum, which automatically dropped the `status` column. Then the migration either:
   - Failed to re-add the column with the new enum type, OR
   - Was never fully executed (applied_steps_count=0 suggests it wasn't marked as complete)

5. **Alternative scenario:** The migration intentionally dropped the `status` column because the design changed to rely on `loadingStatus` only. But there's no evidence for this in any commit or documentation.

### Conclusion:
The `status` column was likely lost as a side effect of the enum rename in the missing Phase 3 migration. The migration's `applied_steps_count=0` suggests it may not have been fully executed or properly recorded. The column was NOT dropped by any migration currently on disk.

---

## 7. MIGRATION HISTORY INTEGRITY SUMMARY

### Confirmed facts:
1. ✅ 26 migration directories on disk, all with valid SQL, all tracked in git
2. ✅ 26 matching rows in `_prisma_migrations` with `applied_steps_count=1`
3. ❌ 4 rows in `_prisma_migrations` have NO corresponding directories on disk
4. ❌ Those 4 directories NEVER existed in git history (no commits, no branches, no reflog entries)
5. ❌ 2 of those 4 (Phase 3 + Phase 3A) have `applied_steps_count=0`
6. ✅ Despite steps=0, the live DB HAS the schema changes those migrations were supposed to deliver
7. ❌ The `status` column (created by an on-disk migration) is missing from the live DB
8. ❌ No migration on disk explains the removal of `status`

### What this means:
- The 4 missing migrations were applied (or their effects were applied) to the database OUTSIDE the normal Prisma migrate workflow
- The migration SQL files were never committed to git
- The `applied_steps_count=0` for Phase 3 and Phase 3A suggests their migration records were inserted into `_prisma_migrations` without actually running the migration (or the record was inserted manually)
- The Phase 1 infrastructure migration (steps=1) WAS executed but its SQL file was never committed

### How could this happen:
- Someone ran `psql` directly or used a script to apply SQL changes to the database
- They manually inserted rows into `_prisma_migrations` to record the changes
- For Phase 3 and Phase 3A, they inserted the records with `applied_steps_count=0` (perhaps by mistake, or perhaps the migration tool they used didn't update the count)
- They never committed the migration directories to git

---

## 8. RECOVERY POSSIBILITY ASSESSMENT

### Can the missing migration files be recovered from git?
**NO.** None of the 4 missing migration directories exist in any git commit, branch, reflog entry, or stash. They were never committed to version control.

### Can the SQL be reconstructed?
**PARTIALLY, with uncertainty.**

| Migration | Reconstructability | Confidence |
|---|---|---|
| phase1_infrastructure | Can write CREATE TABLE statements from schema.prisma | Medium — exact SQL unknown |
| phase2_master_data_party_model | Can infer from schema.prisma (Shipper, Consignee, Agent tables + Cargo relations) | Low-Medium — may not match exact original |
| phase3_cargo_inspection_loading_lifecycle | Can infer enum renames from live DB state; column drop/re-add uncertain | Low — the status column issue makes this uncertain |
| phase3a_cargo_pol_pod | Can infer from live DB columns (pol, pod, description, chassis, serial, units, comment) | Medium — columns are clearly present |

### Can we determine the exact original SQL?
**NO.** There is no record of it anywhere in the repository.

---

## 9. SAFEST REPAIR STRATEGY

### The fundamental question:
Do we need to repair the migration history before proceeding with Phase 3A implementation?

### Answer: DEPENDS ON WHAT WE'RE TRYING TO ACHIEVE.

**If the goal is to implement Phase 3A application code** (DTOs, service, tests, UI):
- Migration history repair is NOT required
- The application code doesn't depend on migration files being on disk
- The Prisma client is already generated and works with the current schema
- Phase 3A backend changes can be implemented, built, and unit-tested

**If the goal is to have a clean, trustworthy migration history:**
- The 4 missing directories need to be recreated on disk
- The 2 with steps=0 need their `applied_steps_count` addressed
- The `status` column needs to be restored

**If the goal is to run e2e tests that require the database:**
- The `status` column MUST be restored first (otherwise tests will fail)
- Migration history repair may be needed depending on the restore approach

### Recommended approach (safest):

**Step 1 (now):** Implement Phase 3A application code. The code is independent of migration files. Build and typecheck.

**Step 2 (separate decision):** Address the migration history. Options:

**Option A — Reconstruct and restore missing migration directories:**
- Write reconstruction SQL for each missing migration based on schema.prisma and live DB state
- Place them on disk in `prisma/migrations/`
- For Phase 3 and Phase 3A (steps=0): either update `_prisma_migrations` to set steps=1 (if the changes are confirmed in DB) OR create a fresh migration that adds any missing pieces
- Risk: reconstructed SQL may not match original; could introduce inconsistencies

**Option B — Ignore migration history, just fix the status column:**
- Add `ALTER TABLE "Cargo" ADD COLUMN "status" "CargoStatus" NOT NULL DEFAULT 'REGISTERED'` to the database
- Either create a new migration for this, or apply directly
- Leave the 4 missing migration directories missing
- Risk: migration history remains inconsistent; future `prisma migrate dev` may be confused

**Option C — Full migration regeneration:**
- Take a snapshot of the current schema
- Use `prisma migrate diff` to generate a single migration from the last known-good state to current
- This creates a NEW migration that captures all differences
- The 4 missing entries remain in `_prisma_migrations` but are superseded
- Risk: creates a migration that may be large and hard to understand; doesn't fix the historical inconsistency

### My assessment:
**Option B** is the safest for now. The `status` column needs to be restored for the application to work. A new migration can be created for just that change. The 4 missing migration directories can be addressed later as a separate cleanup task.

**However, before ANY database change, we must decide:**
1. Do we create a new Prisma migration for the `status` column restoration?
2. Or do we apply the ALTER TABLE directly (bypassing Prisma migrate)?

Both are valid. The first keeps migration history cleaner. The second is faster but leaves the history inconsistent.

---

## 10. CAN PHASE 3A IMPLEMENTATION PROCEED?

### YES — with clear boundaries.

**Phase 3A application code (DTOs, service, tests) can be implemented NOW:**
- These changes are pure TypeScript/JavaScript
- They don't require migration files on disk
- They don't require database changes
- They can be built, typechecked, and unit-tested

**Phase 3A e2e tests CANNOT run successfully until the `status` column is restored:**
- The tests check `d.status`, `cargo.status`, etc.
- Without the `status` column, the database queries will fail
- The tests would need the column restored first

**UI changes can be implemented NOW:**
- UI changes are independent of the database state
- They can be built and reviewed

### The key dependency:
The `status` column restoration is a PRE-RECQUISITE for end-to-end testing and production use, but NOT for implementing the Phase 3A application code.

---

## 11. DECISIONS REQUIRED

Before proceeding, the following decisions must be made explicitly:

### Decision 1: Migration history repair
Do we attempt to reconstruct and restore the 4 missing migration directories now, or defer this to a separate cleanup task?

**Recommendation:** Defer. The reconstruction cannot be verified against the original SQL. Focus on Phase 3A implementation first.

### Decision 2: Status column restoration
Do we:
- (a) Create a new Prisma migration that adds the `status` column?
- (b) Apply `ALTER TABLE` directly without a migration?
- (c) Wait until after Phase 3A code implementation to address this?

**Recommendation:** Decide after Phase 3A code implementation. The code can be written correctly regardless of the DB state. The column can be restored before e2e testing.

### Decision 3: What to do about the 2 migrations with applied_steps_count=0
- Update `_prisma_migrations` to set `applied_steps_count=1` for Phase 3 and Phase 3A (since their changes ARE in the DB)?
- Or leave them as-is and create a new migration that "completes" them?
- Or ignore them?

**Recommendation:** This is a migration-history cleanup task, separate from Phase 3A implementation. Defer.

---

## 12. SUMMARY

| Issue | Severity | Can Phase 3A proceed? |
|---|---|---|
| 4 missing migration directories (never in git) | HIGH (history integrity) | Yes (code-only) |
| 2 migrations with steps=0 but changes in DB | HIGH (history integrity) | Yes (code-only) |
| Cargo.status column missing from live DB | CRITICAL (blocks API) | NO (blocks e2e tests) |
| Migration SQL unrecoverable from git | HIGH (can't verify) | N/A |
| Enum renames confirmed in live DB | INFO | Yes (code uses new names) |
| Phase 3A columns confirmed in live DB | INFO | Yes (code uses them) |

**Bottom line:** The migration history is in a fragile, unverifiable state. The 4 missing migrations were applied to the database outside the normal Prisma workflow and never committed to git. The `status` column was lost (likely as a side effect of the enum rename in the missing Phase 3 migration). Phase 3A application code can be implemented safely, but the database must be repaired before e2e tests can run.

---

*End of investigation report.*
