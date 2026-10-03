# 2026-10-03 — Phase 4 unit 2: B/L decoupling — voyage+cargo create, additive migration, transition contract A

## Task ID

phase4-unit2-bl-decoupling (first EXECUTION unit of Phase 4)

## Phase

Phase 4 — B/L Rewrite (unit 2 / P4-U2 per ADR-045 decision 6)

## Objective

Deliver roadmap Phase 4 **Tests 1–2** ("B/L creation without Manifest dependency", "Party
master usage") and **Acceptance 1–2** ("B/L no longer depends on Manifest", "Parties come from
masters"): one additive migration, the voyage+cargo create path, the new eligibility predicate,
conditional legacy stamping — while the shipped web page keeps working (transition contract).

## Prompt reference

- **ADR-045 decision 1** (this unit's specification) + decision 6 (P4-U2 scope).
- Roadmap §3 Phase 4 (Scope: Remove Manifest dependency; Shipper/Consignee masters on B/L;
  Tests 1–2; Acceptance 1–2; Risk #1 incomplete Manifest decoupling).
- Forced decision: web `bills/page.tsx:211` requires `manifestId` and `:308` calls
  `/bills/eligible-items?manifestId=` while `main.ts:43-44` runs whitelist +
  forbidNonWhitelisted.

## Environment

- Repo, HEAD **b91b9b0** (unit-1 design commit), porcelain **0** at start; servers
  `:3101`/`:3000` **200 before/after**, never restarted; pnpm 9.15.9; tests via
  `pnpm --filter <pkg> test` (root `pnpm test` self-recursion pre-existing, untouched).

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       366 passed, 366 total
```

(`scratch/p4u2-base.json` — matches the stated baseline; bill suite = **13** tests — the
prompt's "14 tests" was off by one; verified count recorded here.)

## FORCED DECISION — transition contract: **(A)**

**Chosen: (A)** — keep `manifestId` (and the legacy per-manifest `eligible-items` path)
accepted as an **alternate input alongside** the new voyage+cargo path until P4-U7 switches the
page; the legacy path is clearly marked transitional in code (DTO descriptions, service doc
comments, dispatcher comment) and in this log. Reason: dropping `manifestId` from
`CreateBillDto` would make the **shipped** page's create request fail instantly under
`forbidNonWhitelisted` (page is U7's job — editing it here is out of scope), while (A) keeps
every shipped flow working with **zero web changes** and lets both paths be proven by the gate.
No new `api.post` route was added (create stays `POST /bills`; `eligible-items` gained an
optional **GET** `voyageId` query param — primitive `@Query` params bypass the DTO whitelist,
noted in the controller comment). No NBD surfaced from the choice (the prompt pre-recommends A;
recorded as decided, not invented).

---

# Part 1 — Additive migration (one, no drops, no enum changes)

**Schema edits** (`prisma/schema.prisma`, additive):
- `BillOfLading.manifestId String → String?` (legacy linkage) + relation field
  `manifest Manifest → Manifest?` (Prisma requires the optional-relation mirror);
- `BillOfLadingItem.manifestItemId String → String?` + `manifestItem → manifestItem?`;
- **new** `BillOfLading.destinationPortId String?` (P4-U3 numbering scope key; plain column,
  no FK — a scope key must outlive port lifecycle, same reasoning as `billNumber`) +
  `@@index([destinationPortId])`;
- `voyageId` **stays required** (self-owned; explicitly corrected mid-edit).

**Migration** `prisma/migrations/20261003120000_bl_decoupling_additive/migration.sql`,
generated with `prisma migrate diff --from-migrations --to-schema-datamodel --script` against a
scratch shadow DB (the generated SQL drops/re-adds the two FKs because Postgres requires it to
relax nullability — the new FKs are `ON DELETE SET NULL`, matching optional legacy linkage; **no
column drops, no data loss**), then extended with the mandated idempotent backfills:

```sql
-- Data backfills (idempotent UPDATEs; no schema)
UPDATE "bills_of_lading_items" bli
SET "cargoId" = mi."cargoId"
FROM "manifest_items" mi
WHERE bli."manifestItemId" = mi.id AND bli."cargoId" IS NULL;

UPDATE "bills_of_lading" bl
SET "destinationPortId" = v."destinationPortId"
FROM "Voyage" v
WHERE bl."voyageId" = v.id AND bl."destinationPortId" IS NULL;
```

(The first is a no-op safety net — `ManifestItem.cargoId` is REQUIRED and every legacy item
already carries its cargo; the second backfills the numbering scope key for pre-existing bills
from their voyage.)

**Applied:** `npx prisma migrate deploy` → all applied; `prisma migrate status` →
**33 migrations found … up to date**; `migrate diff --from-migrations --to-schema-datamodel`
vs the scratch shadow DB → **`-- This is an empty migration.` = No difference detected**;
shadow DB dropped. `npx prisma generate` re-run for the nullable client types.

---

# Part 2 — Create rewrite (voyage + cargo path)

`bill.service.ts` `create()` is now a **source-mode dispatcher** (validation: `manifestId`
**xor** `voyageId`, `cargoIds` requires `voyageId`, neither → 400):

- **`createFromManifest()`** — the previous create body, byte-for-byte behaviour preserved
  (APPROVED-manifest gate, `assertLiveParty`, bounded-retry number allocation, snapshots) plus
  one addition: it now also stores `destinationPortId` from the manifest's voyage.
- **`createFromCargo()` (new)** — ADR-045 decision 1:
  - input `voyageId` + optional `cargoIds[]`; `manifestId: null`;
  - **eligibility predicate** (shared private helper `loadEligibleCargoLine`, used by create,
    addItem and eligible-items): cargo live + in a **COMPLETED Actual Loading of this voyage
    with `actualQuantity > 0`** (ADR-029/042; ADR-039 keeps not-loaded out) + **not already on
    a live (non-cancelled, non-deleted) B/L of the same voyage** — *one live bill per cargo
    per voyage*, application-level with the same soft-delete rationale as ADR-030; failures are
    409s with the shipped-message style (`not eligible … COMPLETED Actual Loading …`;
    `already on live B/L …`);
  - **vessel snapshot from the voyage** (`voyage.vessel.name/imo`), `voyageId` self-owned,
    `destinationPortId` stored;
  - **parties**: explicit DTO ids first, else **derived from the selected cargo lines**
    (first non-null per field, in given order) — never a manifest; every chosen id passes
    `assertLiveParty` (Phase-2 masters, live only);
  - items created in the same transaction as the bill (`items: { create: … }`), keyed by
    `cargoId`, `manifestItemId: null`, snapshots defaulted from cargo facts
    (specification → goodsDescription, serialNumber/vin → marks, packages/packageType/weight);
    totals computed from the lines; same bounded-retry number loop (numbering swap = U3).

**addItem** — two exclusive modes: `{ cargoId }` on a voyage-mode bill (same predicate,
`excludeBillId` so a bill can grow itself, max-sequence+1 as legacy) and
`{ manifestItemId }` on a manifest bill (legacy body untouched). Cross-mode → 409, both → 400,
neither → 400. **eligible-items** — dispatcher: `?manifestId=` = legacy method (renamed
`eligibleItemsFromManifest`, body untouched); `?voyageId=` = `eligibleCargoForVoyage()` rows
(loaded-positive cargo minus cargo claimed by live bills of the voyage; row shape mirrors the
legacy flat shape with `cargoId`-keyed `id`, `manifestId: null`); both/neither → 400.
**listSelect** gained `destinationPortId` (response completeness for U3).

## manifestId-site checklist (every site touched, verified against the code)

| site | before | after |
| --- | --- | --- |
| service `:52` listSelect `manifestId` | required column | kept (now nullable — legacy rows still returned) |
| service `:53` listSelect **new `destinationPortId`** | — | added |
| service `:105/:117` billItemSelect `manifestItemId`/`manifestItem` | required | kept, nullable (relation include returns null for voyage items) |
| service `:149` list filter `query.manifestId` | works | **unchanged** (filtering a nullable column is valid; page keeps using it) |
| service `:240` create manifest load | only path | dispatcher branch condition (`if (dto.manifestId)`) |
| service `:286` create data `manifestId` | required | legacy branch keeps it; new branch writes `null` + `destinationPortId` |
| service addItem head `:414-438` | manifest-only | mode dispatch + `voyageId` added to select; legacy body preserved below the dispatch |
| service claim `:440` (`manifestItemId` where) | — | `dto.manifestItemId!` narrowed (legacy branch) |
| service item create data | — | `manifestItemId!` (legacy branch) |
| service `:546` eligibleItems | manifest-only | dispatcher; legacy renamed `eligibleItemsFromManifest` |
| service issue `:630-636` stamp | stamps all lines | **conditional**: `.filter(x => x !== null)` — only legacy manifest-linked lines stamped |
| service cancel `:671-677` clear | maps possibly-null ids | same null filter (voyage lines never stamped) |
| controller `:44` eligibleItems | `@Query('manifestId')` | `manifestId?` + `voyageId?` primitives (whitelist note) |
| DTO `:36` `manifestId` | `@IsNotEmpty` required | `@IsOptional` + transitional description; **+ `voyageId?` + `cargoIds?: string[]`** |
| DTO `:211` `manifestItemId` | required | `@IsOptional` + **+ `cargoId?`** |
| schema `manifestId`/`manifestItemId` + relations | NOT NULL | nullable + optional relations |
| **untouched by design** | — | `ManifestItem.blNumber` write logic itself (only made conditional); DO/RO `status==='ISSUED'` gates (U4); `generateReference`/BOL format (U3); `BlStatus` (U4); web page (U7) |

**blNumber conditional rule:** `issue()` stamps `ManifestItem.blNumber` **only for lines whose
`manifestItemId` is non-null** (legacy bills — proven live in the gate); voyage-mode bills have
all-null line links → zero stamping (`itemIds.length === 0` guard), and `cancel()` clears only
stampable ids. Direction NOT reversed (Phase 5 does that).

---

# Tests (roadmap Tests 1–2) — delta **366 → 369**

New in `bill.e2e-spec.ts` (suite 13 → 16; all 13 legacy tests **kept green unchanged** under
transition contract A — stated per prompt):

1. **`create WITHOUT a manifest: voyage + cargo lines; parties from masters/derived cargo,
   never a manifest`** — full in-suite chain helper `mkLoadedCargoOn()` (cargo → inspection
   DONE → load list → finalize → Actual Loading → record → complete, mirroring the suite's own
   cargo3 fixture); POST `/bills {voyageId, cargoIds}` asserts `manifestId: null`,
   self-owned `voyageId`, stored `destinationPortId`, **vessel snapshot from the voyage**,
   **shipper/consignee derived from the cargo lines' masters**, DRAFT, `BOL-YYMM-#####`,
   2 items with `manifestItemId: null` + cargo-default snapshots + recomputed totals; a second
   bill asserts **explicit DTO master ids beat derivation**. (Tests 1 + 2; Acceptance 1 + 2.)
2. **`voyage-mode eligibility: not-in-loading and zero-quantity rejected, one live bill per
   cargo, eligible-items = unclaimed positive cargo only`** — never-loaded cargo → 409
   `COMPLETED Actual Loading`; recorded-`0` line → 409 (ADR-042 positive-quantity); duplicate
   cargo → 409 `already on live B/L`; `eligible-items?voyageId=` returns **exactly** the one
   unclaimed positive cargo (W/Y/Z excluded); plus transition-contract validation: manifestId+
   voyageId → 400, `{}` → 400, cargoIds-without-voyage → 400, eligible-items both/neither → 400.
3. **`addItem source modes are exclusive`** — `cargoId` on a manifest bill → 409 `legacy`;
   `manifestItemId` on a voyage bill → 409 `no manifest` (checked before id load); both/neither
   → 400.

Suite support: `createdStandaloneBills` array + afterAll hard-delete clause (voyage-mode bills
have `manifestId: null`, so the existing `manifestId IN (…)` cleanup would miss them) +
`consignee.deleteMany` for the new Consignee master + `voyageModeBillId` suite var.

---

# UI gate (protocol §3.1) — **PASS**, driven on live data

Counts before (after fixtures): **bills 3 | issued 2 | manifests 5 | cargos 57 | voyages 22**
(pre-fixture: manifests 4, cargos 55, voyages 21). Fixture: fresh voyage VOY-2610-02051, chain
cargo **CRG-2610-00118** loaded, manifest **MAN-2610-00001** built draft → line → submit →
**approve** (the approved demo manifest is frozen — first attempt to add a line to it returned
409 "only DRAFT manifests can be modified", recorded), eligible rows = 1.

- **(a) create through the shipped page (contract A):** "New bill of Lading" → select
  `MAN-2610-00001` → create → **`POST /bills → 201`**, detail auto-opens titled
  **BOL-2610-00001** (Draft). Screenshot `p4u2-gate1-create.png` vision-verified (title,
  Draft + manifest subtitle, no error banners).
- **(c) picker renders real rows:** detail → "Add line" → `GET /bills/eligible-items?manifestId=
  … → 200` (fetched twice, both 2xx) → dropdown option **`#1 — CRG-2610-00118 (3 pkg)`**
  selected (packages 3 / gross 3.5 auto-filled) → confirm → **`POST /bills/:id/items → 201`**,
  line visible in the detail. Screenshot `p4u2-gate2-picker-row.png` vision-verified.
- **(b) issue + conditional stamp:** "Issue" → confirm → **`POST /bills/:id/issue → 200`**,
  subtitle becomes **"Issued — MAN-2610-00001"** (vision-verified `p4u2-gate3-issued.png`);
  API read-back: bill `ISSUED`, item carries its `manifestItemId`, and **the manifest line's
  `blNumber === 'BOL-2610-00001'` → the legacy-conditional stamp applied exactly as designed**
  (voyage-mode bills provably never stamp — test-covered); `eligible-items` dropped to 0 (line
  claimed).
- **(d) collectors:** total **8 fetches, zero non-2xx, `consoleErrs: []`** over the whole
  create/add/issue flow.
- **Cleanup:** gate bill+items, fixture manifest line+manifest, both fixture chains (incl. the
  aborted first attempt's demo-voyage chain), and the fixture voyage all **hard-deleted**
  (soft rows would be litter); counts after: **bills 3 | issued 2 | manifests 4 (= pre-fixture)
  | cargos 55 | voyages 21** — every fixture gone.

## Incident during cleanup — recorded honestly

The first cleanup script deleted `LoadListItem` rows with an **undefined id filter**
(`old.llItemId` was never saved in the first fixture JSON), so Prisma collapsed the filter and
**deleted all 8 LoadListItem rows in the database**, cascading (`onDelete: Cascade` on
`ActualLoadingItem.loadListItemId`) into zero AL items. Impact:
- **Seed-owned row restored verbatim** (the only repo-sourced one): `LL-2401-00001` ×
  `CRG-2401-APPROVED`, plannedQuantity 20, sequence 1, notes "Approved electronics containers"
  — recreated with the exact `seed.ts` values via `upsert`; `LoadListItem` total back to **1**.
- **7 demo-fixture rows lost** (items of the `demo M1/M1/M2/M3` load lists) — **no source
  exists in the repo** (grep: nothing defines them; `seed.ts` creates no demo-LL items), they
  were never part of any recorded baseline (units tracked LL/AL *row counts*, never demo item
  counts), and I did not invent replacements.
- **No AL-item loss**: unit 2's record establishes the 4 demo ALs were **0-item** already
  ("backfilling seed 0-item Actual Loadings" was an explicit out-of-scope note), so the cascade
  hit nothing there; `ActualLoadingItem` total 0 before and after.
- **Suite re-run after cleanup: 369/369/0 (22/22) green.**
- The corrected cleanup script then ran with an id list and removed only its own rows
  (counts above). Flagged for the decision-maker: the 7 demo-LL items are unrecoverable from
  the repo; if they matter, restore from a DB backup outside this repo.

---

# Verification (verbatim)

1. Baseline first run at b91b9b0 → **366/366/0 (22/22)** ✅
2. Official triplet after the change → **369/369/0 ×3** (`p4u2-r1/r2/r3.json`), per-suite
   identical; vs baseline the **only** delta is `bill.e2e-spec.ts 13 → 16` ✅; a 4th
   post-cleanup full run also **369/369/0** ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `prisma migrate status` → **33 … up to date**; shadow `migrate diff` → **empty ("No
   difference detected.")**, scratch shadow DB dropped ✅
5. Servers → **API 200, WEB 200**, never restarted ✅
6. Contract guard → `CONTRACT GUARD OK — 18 shared status unions ⊆ Prisma enums; 84 web api.post
   routes ⊆ 90 controller @Post routes` (exit 0) — no new `api.post` route, no new union ✅
7. Porcelain = bill controller/service/DTO + bill e2e + `prisma/schema.prisma` +
   `prisma/migrations/20261003120000_bl_decoupling_additive/` + this log; **`apps/web` = 0
   files** (contract A needs no web edit), `packages/shared` = 0 ✅

## TRANSLATION_CHANGES

none

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit2-bl-decoupling
PHASE: Phase 4 — B/L Rewrite (unit 2 / P4-U2)
DB_MIGRATION_STATUS: one additive migration applied — 20261003120000_bl_decoupling_additive
  (nullable manifestId/manifestItemId + destinationPortId + index + idempotent backfills;
  FK relax via drop/re-add to SET NULL, no column drops); migrate status 33 up to date;
  shadow diff "No difference detected."
UI_GATE: PASS with driven evidence — (a) shipped page create → POST /bills 201, BOL-2610-00001
  Draft (screenshot vision-verified); (b) issue → 200, subtitle "Issued", API read-back shows
  manifest line blNumber === billNumber = the conditional legacy stamp applied (voyage-mode
  never stamps, test-covered); (c) eligible-items picker rendered the real row "#1 —
  CRG-2610-00118 (3 pkg)" → add 201 (screenshot vision-verified); (d) 8 fetches, 0 non-2xx,
  0 console errors. Counts restored (bills 3/2 issued, manifests 4, cargos 55, voyages 21);
  all fixture rows hard-deleted.
SCHEMA_CHANGES: additive only (see migration); no drops, no enum changes
CODE_CHANGES: apps/api bill module — create() dispatcher (legacy createFromManifest preserved
  byte-for-byte + destinationPortId storage; new createFromCargo with shared
  loadEligibleCargoLine predicate), addItem/eligibleItems two-mode dispatch, conditional
  null-filtered blNumber stamps, controller voyageId query, DTOs optional legacy fields +
  voyageId/cargoIds (+cargoId on AddBillItemDto); voyageId STAYS required (corrected);
  ADR-045 eligibility fix N/A (new path enforces it natively); transition contract: A
  (manifestId + per-manifest eligible-items kept as transitional alternate — shipped page
  untouched and proven working)
TEST_CHANGES: baseline 366/366/0 -> triplet 369/369/0 ×3 (per-suite identical; only
  bill.e2e 13 -> 16; all 13 legacy tests green unchanged); +1 suite support (standalone-bill
  hard-cleanup in afterAll); 4th post-cleanup run also green
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = bill.controller.ts + bill.service.ts + dto/bill.dto.ts +
  test/bill.e2e-spec.ts + prisma/schema.prisma + prisma/migrations/20261003120000_…/ + log;
  apps/web = 0; packages/shared = 0; contract guard OK (no new route/union); committed at task
  end so the tree ends clean
UNRESOLVED_ISSUES: (1) 7 demo-fixture LoadListItems lost to a cleanup id-filter bug and
  unrestorable from the repo (seed's 1 row restored verbatim; demo ALs were 0-item already;
  suite green; flagged for backup restore if they matter) — incident fully documented above;
  (2) carry-overs unchanged: portal destination-scoped B/L visibility, manifest.dto stale
  Swagger text
NEEDS_BUSINESS_DECISION: none new (transition choice A was pre-recommended by the prompt and
  recorded as decided; §1.1a/§1.1b/§1.2 from ADR-045 remain with the employer for U4/U6)
BLOCKED: none
HANDOFF_TO: decision-maker (unit-2 verification → P4-U3 per-destination numbering; U7 will
  retire the legacy path marked here)
```
