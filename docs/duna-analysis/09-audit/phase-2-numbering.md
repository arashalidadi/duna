# Phase 2 — Numbering configuration

Status: implementation complete on branch `arena/be9b4e5b-duna`. Phase 3 has not started and is waiting for owner approval.
Roadmap: `initial-roadmap.md` lines 104–123. Evidence: `confirmed-decisions.md` DEC-024…DEC-028 and DEC-115.

## 1. What changed

### Shared allocator (`apps/api/src/common/infrastructure/numbering/`)
- `numbering.service.ts`: `allocateNumber(req)` joins the caller's transaction when `req.tx` is passed. Otherwise it opens its own.
  - Flow: find the counter row, seed it on first use, lock it with `SELECT … FOR UPDATE`, reactivate an inactive row without touching its counter, then increment.
  - The old reset-to-1 branch is removed. A counter is never reset.
  - A new counter row is created with `createMany({ skipDuplicates: true })`, so two first-time callers cannot both insert.
- The rendered number comes from the database row (`prefix`, `format`, `padding`). The row is therefore the live, administrator-visible configuration.
- `document-number-formats.ts` (new): the catalogue of the 12 periodic families (`PERIODIC_DOCUMENT_FORMATS`), plus `yymmFor`, `periodicSequenceRequest` and `nextSequenceAfter`. The catalogue only seeds a row when its period first needs one. It never overwrites an existing row.
- `numbering-sequence.types.ts`: optional `seedNextSequence` and `tx`, plus the `VESSEL_DESTINATION` scope.

### Seeding
- No counter rows are pre-created and no migration writes counter state. A row is created on first use, seeded from the highest issued number (including soft-deleted rows), so it never re-issues an existing number. This meets the roadmap's seeding requirement without writing counter state to a live database.
- Bill and manifest create their counters lazily. Their prefixes include the destination and the month, and no older number uses those prefixes, so no seed is needed. This is my analysis, not an owner decision.

### The 11 migrated types
Each caller allocates inside the same transaction as its record create, so a failed insert rolls the counter back and leaves no gap.

| Type | Family | Code | Clock | Caller |
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

The codes and clocks were checked against the HEAD generators before migration. Format: `<CODE>-<yymm>-<5-digit sequence>`, with one counter per period.

The 14 types on `NumberingService` are these 11, plus bill, manifest, and the voyage parent, which were already on the service. Local generators and retry loops are removed. A grep of the caller modules finds no `generateReference`, `generateProformaReference`, `generateRecordNumber`, or `nextBookingNumber`. The manifest comment that named the old generator was reworded.

### Voyage vessel scope (REQ-040) and DEC-026
- `VoyageDestination.numberingVesselId` is an immutable snapshot of the vessel whose counter issued the leg number. It is backfilled from `Voyage.vesselId`, NOT NULL, with an FK. The unique key is `[destinationPortId, numberingVesselId, voyageNumber]`. Existing legs are not renumbered.
- Migration `20261013000000_voyage_leg_vessel_scope` is additive: add the column, backfill, set NOT NULL, add the FK, swap the unique index.
- Leg sequence key: `voyage-leg-<vesselId>-<destId>-<YY>`. Seeded from the highest `n` among legs with the same snapshot, destination and year, including soft-deleted legs.
- **DEC-026 revive fix (this review).** Before, re-adding a soft-deleted destination allocated a fresh number and overwrote the leg's `voyageNumber` and vessel. That rewrote an issued number. Now a revived leg is reactivated with its existing `voyageNumber` and `numberingVesselId`. A fresh number is allocated only for a destination that has no leg row at all. The regression assertion in `voyage.e2e-spec.ts` checks that the revived number is the original one.
  - Edge case, by design: a leg revived after the voyage's vessel changed keeps the vessel it was issued under. Its number stays unique and unchanged. The new vessel is used only for legs created after the change.
- **Transactions (this review).** Voyage create (parent number, every leg number, and the row) and route updates (leg sync and voyage update) each run in one interactive transaction. Counters are locked in sorted destination order so concurrent route edits cannot deadlock. A failed create no longer leaves issued-but-unused numbers.
- The preview endpoint takes an optional `vesselId`. Without it, the result is `null`, because the vessel-scoped number cannot be known. This is the one response change, and it follows REQ-040. The web form shows `…` until a vessel is chosen.
- Files: `voyages/voyages.service.ts`, `voyages/voyages.controller.ts`, `apps/web/src/app/[locale]/(dashboard)/voyages/page.tsx`, `apps/api/test/voyage.e2e-spec.ts`.

### Tests added
- `apps/api/test/numbering.e2e-spec.ts` (new). For each of the 12 periodic families it checks:
  - format match (prefix, period, padding, rendered number),
  - month rollover with a fixed clock (UTC and local clocks, built so the test does not depend on the time zone),
  - sequence continuity, and 10-way concurrent allocation with distinct, contiguous numbers,
  - independent counters per period.
  - It also checks seeding from existing numbers, no reset on reactivation, and rollback on a failed transaction.
  - Test data: it writes only `NumberingSequence` rows named `test-<random>-…` and removes them in `afterAll`. Real document counters are never touched.
- `voyage.e2e-spec.ts`: revive keeps the original number (DEC-026), and six concurrent creates for one vessel and destination give distinct leg and parent numbers with no 409.

### Lint and typing
- `voucher.service.ts`: `let entries` changed to `const`. This was the one ESLint error in `src/`, pre-existing at HEAD (ledger code unchanged).
- The `apps/api` lint script covers `src/` only. It now has no errors. Remaining warnings in `src/` are pre-existing `any` usages in the voucher module and the unused `created` in `quotation.service.ts`. Both are at HEAD and not changed here.
- `apps/api` `tsc --noEmit`: exit 0.

## 2. Behaviour differences (backward compatibility)

- **Formats are identical.** The codes, clocks, padding and layout match the HEAD generators.
- **Allocation after a hard delete differs.** The old generators could reuse the latest number if its row had been hard-deleted, and the voucher loop reused gaps. The counter never reuses a number. This follows DEC-026.
- **Voyage leg numbers are now per vessel** (REQ-040). The old counter was per destination and year. Existing numbers are kept, and a new vessel starts its own sequence, seeded from its own legs.
- **Voyage preview without `vesselId`** returns `null` instead of a number (see above).
- **Voyage leg counter names changed.** The old `voyage-<destId>-<yy>` rows are no longer used. They remain in the table and are harmless.

## 3. Checks run

Environment: a local PostgreSQL 16 server with all 39 repo migrations applied from their SQL files, and a seeded administrator (default seed, no demo data). This is a disposable sandbox database, not the owner's server. `TZ=Asia/Tehran`.

Sandbox limitation: the native Prisma engine could not be downloaded in this sandbox, so the tests used Prisma's WASM engine with the PostgreSQL driver adapter. Schema, client version (5.22.0) and query behaviour match the repo, but the native engine was not exercised. The repo's Jest configuration was not changed. The harness lives in `/tmp` and is not committed.

| Check | Result |
|---|---|
| `apps/api` `tsc --noEmit` | exit 0 |
| `apps/api` ESLint on `src/` | 0 errors; warnings are pre-existing |
| `voyage.e2e-spec.ts` (after the revive fix and the transactions) | 26/26 pass |
| `numbering.e2e-spec.ts` (new) | 77/77 pass; no leftover test rows |
| Full API e2e suite (23 suites) | 23/23 suites, 481/481 tests, exit 0 |

Not run:
- Prettier. Every changed original already fails Prettier at HEAD, so whole files were not reformatted.
- The native Prisma engine (see the sandbox limitation above).
- The migration on the owner's server, and any comparison against real production numbers.

## 4. Server actions (owner)

Nothing has been run on the server or against any real database. In order:

1. Pull `arena/be9b4e5b-duna`. Run `pnpm install` if dependencies changed.
2. Run `prisma generate` for the API. The schema has a new field, `numberingVesselId`.
3. **Review, then run `prisma migrate deploy` for `20261013000000_voyage_leg_vessel_scope`.**
   - Effects: adds `numberingVesselId`, backfills it from `Voyage.vesselId`, sets NOT NULL, adds the FK, and swaps the unique index on `VoyageDestination`. Additive. No rows are deleted, and existing leg numbers are kept.
   - The migration depends on `Voyage.vesselId` being non-null for every voyage that has legs. Check this on the server before deploying.
   - `migrate deploy` does not reset the database and does not look for drift.
4. Restart the API.

The revive fix and the transaction changes need no database change. They take effect on the restart.

## 5. Decisions only the owner can make

These cannot be inferred safely from the code or documents. None of them blocks the implementation, which keeps every live format as it is today.

1. **Live document formats.** Real documents show formats that differ from the live `CODE-YYMM-#####` pattern. Examples: B/L `KHS/26-110`, manifest `DSMAN/KHO-26-006`, invoice `DSINV/26-172`, proforma `DSPRO/26-001`, quotation `DSQUO/25-017`, receipt voucher `477`. Which pattern and padding should each live type use, and should a change apply only to new numbers? Changing live formats has no effect until this is decided.
2. **B/L counter.** The live B/L format is `BOL-{DEST}-YYMM-#####`, while the last real B/L is `KHS/26-110`. Which format should the B/L use, and which starting value per destination and year?
3. **Manifest conflict.** `DSMAN/…` and `DSKHS-…` are both in the documents, and the live manifest is `MAN-{DEST}-YYMM-#####`. Which one is correct?
4. **Voyage leg padding.** The live code produces `1/26`, as it did before this phase. The roadmap sample is `02/26`. Keep `n/yy`, or change to two digits?
5. **Clock for vouchers and portal bookings.** They use server-local time, as before. Should they move to UTC like the other types?

## 6. Scope answers

- **Letters, Jobs, Delivery Release and Employee are not in Phase 2.**
  - AUD-013 lists exactly the 11 generators that Phase 2 migrates, and the roadmap's 14-type list does not include these four.
  - **Jobs** (`jobs`, ~line 367): the Job model is scheduled for P3 (roadmap line 331).
  - **Delivery release** (DO/RO, `delivery-release.service.ts` ~line 43): the release-order and delivery-order work is in P5. The local `nextNumber(tx, 'DO' | 'RO')` helper is not migrated.
  - **Letters** (`letters/letter.service.ts`, `generateLetterNumber`) and **Employee** (`EMP`, ~line 188): no roadmap phase assigns numbering to these. They are found but not migrated.
  - Owner decision, not blocking: which phase should own Letters and Employee numbering?

## 7. Open items carried forward

- Manifest `DSMAN/…` vs `DSKHS-…` (section 5, item 3).
- Live-format re-seeding from verified samples (section 5, items 1–2).
- `quotation.service.ts` unused `created` (pre-existing warning, HEAD line 277).
- Voucher module `any` warnings (pre-existing, HEAD).
- The Prettier failures in changed files already exist at HEAD.
