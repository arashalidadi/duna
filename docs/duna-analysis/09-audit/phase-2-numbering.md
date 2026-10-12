# Phase 2 — Numbering configuration

Status: implemented on branch `arena/be9b4e5b-duna`, pending owner review. Phase 3 has not started.
Roadmap: `initial-roadmap.md` lines 104–123. Evidence: `confirmed-decisions.md` DEC-024…DEC-028.

## 1. What changed

### Shared allocator
- `apps/api/src/common/infrastructure/numbering/numbering.service.ts`
  - `allocateNumber(req)` uses `req.tx` when the caller passes one. Otherwise it opens its own transaction.
  - Flow: find the counter row, seed it on first use, `SELECT … FOR UPDATE`, reactivate an inactive row without touching its counter, then increment.
  - The old reset-to-1 branch is removed. The counter is never reset.
  - A new counter row is created with `createMany({ skipDuplicates: true })`.
- `numbering-sequence.types.ts`: optional `seedNextSequence`, optional `tx`, and a `VESSEL_DESTINATION` scope.
- `document-number-formats.ts` (new): the format catalogue (`PERIODIC_DOCUMENT_FORMATS`), `yymmFor`, `periodicSequenceRequest`, and `nextSequenceAfter`.
- `index.ts` (new): re-exports.

### Seeding
- A counter row is seeded only when it is created. The seed is the highest issued suffix plus 1, or 1 if none exists. The lookup matches the old `findFirst` (startsWith, descending, including soft-deleted rows).
- Seeding from existing data means a new counter row cannot re-issue a number that is already in use.

### Callers migrated (11 types)
Each caller allocates inside the same transaction as its record create, passing `tx`. If the insert fails, the counter rolls back, so no gaps are left.

| Type | Family | Prefix code | Clock | Caller |
|---|---|---|---|---|
| Invoice | `invoice` | INV | UTC | `invoice/invoice.service.ts` |
| Proforma | `proforma` | PRF | UTC | `proforma/proforma.service.ts` |
| Quotation | `quotation` | QT | UTC | `quotation/quotation.service.ts` |
| Voucher (receipt) | `voucher-rcp` | RCP | local | `voucher/voucher.service.ts` |
| Voucher (payment) | `voucher-pmt` | PMT | local | `voucher/voucher.service.ts` |
| Cargo | `cargo` | CRG | UTC | `cargo/cargo.service.ts` |
| Inspections | `inspection` | INS | UTC | `inspections/inspection.service.ts` |
| Load planning | `load-list` | LL | UTC | `load-planning/load-planning.service.ts` |
| Actual loading | `actual-loading` | AL | UTC | `actual-loading/actual-loading.service.ts` |
| Discharge | `discharge` | DIS | UTC | `discharge/discharge.service.ts` |
| Portal bookings | `booking-request` | BRK | local | `portal/portal.service.ts` |
| Salary | `salary-record` | SAL | UTC | `salary/salary-record.service.ts` |

Format: `<CODE>-<yymm>-<5-digit sequence>`. Counter scope is per period (`YYYYMM`).

Types already on `NumberingService` before this phase: bill, manifest, and the voyage parent. With the 11 above, that makes 14.

Removed local generators and retry loops:
- `generateReference()`, `generateProformaReference()`, `generateRecordNumber()`, `nextBookingNumber()`, and the `nextNumber(` helpers in the 11 caller modules. A grep of those directories finds none.
- P2002 retry loops (cargo, invoice, load-list, actual-loading, and the voucher candidate loop). Non-number P2002/P2018 mapping is kept. The invoice mapping `ConflictException('Could not create invoice: duplicate reference')` is unchanged.
- The voucher candidate loop (up to 9999 probes) is replaced by the counter.

### Voyage vessel scope (REQ-040)
- `prisma/schema.prisma`: `VoyageDestination.numberingVesselId` (snapshot, NOT NULL, FK to `Vessel`, back-relation). Unique index `VoyageDestination_dest_vessel_number_key` on `[destinationPortId, numberingVesselId, voyageNumber]`.
- Migration `prisma/migrations/20261013000000_voyage_leg_vessel_scope/migration.sql` is additive:
  1. add the column,
  2. backfill it from `Voyage.vesselId`,
  3. set NOT NULL,
  4. add the FK,
  5. swap the unique index.
  Existing legs are not renumbered.
- Sequence key: `voyage-leg-<vesselId>-<destId>-<YY>`. Seeded from the highest `n` among same-snapshot, same-destination, `/YY` legs, including soft-deleted rows.
- The snapshot is immutable. A later vessel change on a DRAFT voyage does not move existing legs into a different scope. A newly added leg uses the current vessel.
- Create and revive both set the snapshot. The preview endpoint takes an optional `vesselId`. Without it, the result is `null`, and the web form shows `…` until a vessel is chosen.
- Files: `voyages/voyages.service.ts`, `voyages/voyages.controller.ts`, `apps/web/src/app/[locale]/(dashboard)/voyages/page.tsx`, `apps/api/test/voyage.e2e-spec.ts`.

## 2. Behaviour differences (report to owner)

- **Format is identical.** Allocation after a hard delete differs. The old generators reused the latest number if its row had been hard-deleted, and the voucher loop reused gaps. The counter does not reuse numbers. This is deliberate under DEC-026, which says issued numbers are never rewritten.
- The leg revive path still overwrites a soft-deleted leg's `voyageNumber` with a fresh allocation. This conflicts with DEC-026. It is **not fixed** in this phase. Owner decision needed (item 6 below).

## 3. Checks actually run

Environment: local disposable database `duna_e2e` (sandbox only, not the server). `TZ=Asia/Tehran`. The Jest config in the repo was not changed. The harness lives in `/tmp`.

| Check | Result | Log (sandbox, not committed) |
|---|---|---|
| `apps/api` `tsc --noEmit` | exit 0 | `/tmp/p2/tsc-final.log` |
| `apps/web` `tsc --noEmit` | exit 0 | — |
| Temporary numbering spec (5 tests): continuity, 10-way first-creation race with seed, 25-way burst, no reset on seed, reactivation, rollback, committed transaction, format and fixed-clock rollover per period, per-vessel leg numbers, 6-way concurrent voyage create, preview, vessel change keeping scope, seed after existing issued numbers | 5/5 pass | `/tmp/p2/verify2.log` |
| `voyage.e2e-spec.ts` | 25/25 pass | `/tmp/p2/voyage3.log` |
| Full API e2e (final code) | 23/23 suites, 407/407 tests, exit 0 | `/tmp/p2/final.log` |
| Migration replay of all 39 migrations on an empty scratch database | succeeds; NOT NULL and index verified | — |
| ESLint on changed API files | 1 error, 10 warnings. Both checked against HEAD and **pre-existing**: `voucher.service.ts` `prefer-const` (HEAD line 333), and `quotation.service.ts` unused `created` (HEAD line 277) | — |

The temporary numbering spec was used only for verification and is not committed. The repo has no new test suite or test infrastructure from this phase.

Not run:
- Prettier. Every changed original file already fails Prettier at HEAD, so no whole-file formatting was applied.
- Server-side tests. None were run on the owner's server.
- Byte-for-byte comparison against the live legacy generators. The format match was checked in the temporary spec against the old generator prefixes and clocks, not against real production numbers.

## 4. Server actions required (owner)

Nothing has been run on the server or against any real database. Required, in order:

1. Pull the branch.
2. `pnpm install` if dependencies changed. Then `prisma generate` from the API package, so the new `numberingVesselId` field exists in the client.
3. `prisma migrate deploy` for `20261013000000_voyage_leg_vessel_scope`. **Do not run this until the owner has reviewed it.**
   - Effects: adds `numberingVesselId`, backfills it from `Voyage.vesselId`, sets NOT NULL, adds the FK, and replaces the unique index on `VoyageDestination`. Additive. No rows are deleted. Existing leg numbers are kept.
   - Before running: confirm that every `VoyageDestination` row can be linked to a `Voyage` with a non-null `vesselId`. The backfill assumes this. The check was not run against production.
   - `migrate deploy` does not reset the database. It does not look for drift.
4. Restart the API.

Not done by this phase, and needs owner input before any server change:
- **Re-seeding live formats** from the verified samples (B/L `KHS/26-110`, manifest `DSMAN/KHO-26-006`, invoice `DSINV/26-172`, proforma `DSPRO/26-001`, quotation `DSQUO/25-017`, voyage `02/26`, voucher `477`). This is not done. See section 5.

## 5. Owner decisions required

1. **Exact live format and padding** for each type, and whether a format change applies to new numbers only. The roadmap samples are not yet confirmed as the exact pattern. No format was invented.
2. **Counter starting values** per destination and year, for B/L, from the last issued number `KHS/26-110`.
3. **Voyage leg padding.** Roadmap sample `02/26` (zero-padded) conflicts with REQ-040 `1/26`. The current code uses the REQ-040 form. Confirm the form, and confirm the vessel scope key semantics (item 8 in the recorded decisions).
4. **Canonical clock** for voucher and portal: server local time or UTC. The current code keeps the old local-time behaviour for these two types.
5. **Manifest conflict** `DSMAN/…` vs `DSKHS-…` is **open**. The manifest keeps its current `MAN-{DEST}-YYMM-#####` format. Owner must confirm which live format is correct. Nothing was changed.
6. **DEC-026 leg revive overwrite.** Fix in Phase 2, or defer?
7. **Live-format re-seeding** (section 4). Needs the exact pattern and padding (item 1), counter starts (item 2), and approval to change live formats for new numbers only.

## 6. Found but not migrated (outside the 14 types)

- **Letters** (~line 306 in the letters service). Local generator not migrated.
- **Jobs** (~line 367). Local generator not migrated.
- **Delivery release** (~line 43, DO/RO). Its own `nextNumber(tx, 'DO' | 'RO')` helper is not migrated.
- **Employee** (~line 188, EMP). Local generator not migrated.

These are outside the Phase 2 list of 14. They are recorded here so they are not forgotten.

## 7. Open items carried forward

- DEC-026: the leg revive path overwrites a soft-deleted leg's `voyageNumber` (section 2, item 6 in section 5).
- Manifest `DSMAN/…` vs `DSKHS-…` (section 5, item 5).
- Pre-existing lint findings in `voucher.service.ts` and `quotation.service.ts` (section 3).
- Repo Prettier failures in the changed files already exist at HEAD.
