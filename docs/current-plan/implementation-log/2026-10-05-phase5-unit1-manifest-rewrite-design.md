# 2026-10-05 — Phase 5 unit 1: Manifest Rewrite (DESIGN) — downstream of APPROVED B/Ls, multi-party, per-destination numbering

## Task ID

phase5-unit1-manifest-rewrite-design

## Phase

Phase 5 — Manifest Rewrite (unit 1 / P5-U1, design-only; same posture as P4-U1/P3-U5)

## Objective

Survey the shipped Manifest module end-to-end with evidence, design the inversion Phase 5
performs (Manifest = downstream consolidation of B/Ls), append **ADR-047**, map execution
units onto the roadmap's 4 Tests / 4 Acceptance / 3 UI changes, and raise NBDs only where a
genuine employer decision exists. **No code, no schema, no tests, no seed changes.**

## Prompt reference

- **Roadmap §3 Phase 5** (authoritative scope): create-from-issued-B/Ls only;
  ManifestItem→BillOfLadingItem reference; multiple shippers/consignees across items; voyage
  linkage + tug/barge display; per-destination numbering; document output readiness. Data:
  Manifest/ManifestItem redesign, the reference, ManifestDate. Tests 1-4, Acceptance 1-4,
  UI changes 1-3. Risks: (i) traceability loss, (ii) overadding manifest charges.
- **Vocabulary (binding):** the roadmap's word "issued B/Ls" predates ADR-046 — this design
  pins it to **`status === 'APPROVED'`** (ADR-046 ruling 1: issued-equivalent after the U4
  `ISSUED → APPROVED` backfill; `/issue` = composite alias). **No new status invented.**
- Ledger: Phase 4 is **CLOSED-FINAL** (175fa32) — untouched. ADR order verified before
  writing: last was ADR-046 → **ADR-047 appended**.

## Environment

Repo, HEAD **175fa32** (Phase 4 closure-final), porcelain **0**; servers `:3101`/`:3000`
**200 before/after, never restarted**; no fixtures created (design unit).

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       385 passed, 385 total
```

(`scratch/p5u1-base.json` — matches the stated baseline.)

---

# PART A — SURVEY: how the Manifest module works today (evidence)

## A1. Creation path + preconditions

| Step | Evidence |
|---|---|
| `POST /manifests` → `create()` in DRAFT; body = **voyage + single shipper/consignee/agent** | `manifest.service.ts:222-273` (parties at :251-252/:272-273); controller `manifest.controller.ts:57-58` (`manifest:create`) |
| Number: local read-then-write **`MAN-YYMM-#####`** in a bounded-retry loop (the pre-U3 pattern bills already replaced) | `manifest.service.ts:257-262` (race comment), `:728-734` (`generateReference`, prefix `MAN-${yymm}-`) |
| **`POST /:id/items` adds a line from CARGO directly** (DRAFT-only; cargo must be positively loaded on the manifest's voyage via a COMPLETED Actual Loading — ADR-029/028/042 predicate; duplicate `(manifestId, cargoId)` rejected; frozen weight/quantity/packages snapshot; sequence max+1) | `manifest.service.ts:383-440+` (assertEditable :389, loadedOnVoyage :414-427, duplicate :404-410, snapshot select :394-402) |
| Picker: `GET /manifests/eligible-cargo?voyageId=` — positive-quantity AL lines, minus cargo already on this manifest | `manifest.service.ts:523-553+` (`eligibleCargo`, ADR-029/028 comment) |
| Lifecycle `DRAFT → SUBMITTED → APPROVED` (submit requires ≥1 line; approve terminal) + `DRAFT|SUBMITTED → CANCELLED` (reason) | `manifest.service.ts:570-600` (submit, `:578-581`), `:591-607` (approve), `:610-635` (cancel) |
| Permissions: `manifest:read/create/update/delete/submit/approve/cancel` (all seeded, Phase 1) | `manifest.controller.ts:36-121` |
| Party validation (live master or 400) | `manifest.service.ts:645-667` |

**Direction today:** items are built from **cargo** (not B/Ls), and the *B/L* writes back into
the manifest: Phase 4's conditional legacy stamp writes `ManifestItem.blNumber` inside the
B/L approve path (`bill.service.ts:1139-1148`, comment "the stamp direction reverses in
Phase 5"; cleared on cancel at `:1187-1192`) — **exactly the link ADR-045 deferred to this
phase.**

## A2. ManifestItem shape (schema evidence: `prisma/schema.prisma`)

- `manifestId`, **`cargoId` (required — direct Cargo reference)**, `sequence`, **`blNumber
  String?`** (comment: "legacy B/L number; filled by the future B/L module"), frozen
  snapshot `weight/quantity/packages/packageType/notes`, `actualLoadingItemId String?
  @unique` (Phase-8 traceability), `@@unique([manifestId, cargoId])`.
- **No party columns on the item** → one shipper + one consignee per *manifest header*
  (`Manifest.shipperId/consigneeId/agentId`, `schema` Manifest model :19-30 area) = **the
  multi-party defect the roadmap names.**
- Existing relation direction: `BillOfLadingItem.manifestItemId → ManifestItem`
  (`BillOfLadingItemManifestItem`); `ManifestItem.billsOfLadingItems BillOfLadingItem[]`.

## A3. Manifest header (schema evidence)

`manifestNumber @unique // auto MAN-YYMM-#####`, `voyageId` (required), `status`, vessel
snapshot (`vesselName/vesselImo`), `polPortId/podPortId` snapshots, single parties, free-text
`notifyParty/description`, **legacy cost columns** `gasCost/lashingCost/shipperCost/podCost/
polCost/currencyCode` (live example: MAN-2609-00001 carries `gasCost 120.5, lashingCost 80`),
recomputed totals, audit-ish columns, `cancelledAt/deletedAt`. **No ManifestDate field or
model exists** (`grep ManifestDate` → 0 hits) — the roadmap's named data change is new.

## A4. Multi-party representation today (the defect)

- Header-only parties: service create/update write a single `shipperId/consigneeId`
  (`manifest.service.ts:251/320-330`); shared `Manifest` type mirrors single fields
  (`packages/shared/src/manifest.ts:44-47`); the web create form has single shipper/consignee
  dropdowns (`manifest/page.tsx:74-85`, `:190-198`).
- Live manifests confirm the emptiness: all 4 have `shipperId/consigneeId = None`.
- Consequence: **two B/Ls with different shippers cannot be represented** on one manifest —
  the roadmap's Test 3 failure today.

## A5. Numbering today

`MAN-YYMM-#####`, local read-then-write (`manifest.service.ts:728-734`) with bounded retry
(`:257-262`) — same defect class U3 fixed on bills (races + no per-destination scope).
Live numbers immutable: `MAN-2609-00001..4`.

## A6. Live legacy data (must survive without destruction)

| Entity | Representation |
|---|---|
| 3 legacy B/Ls | `BOL-2609-00001` APPROVED / `00002` APPROVED / `00003` DRAFT — **all with `manifestId = MAN-2609-00001`'s id** (voyage VOY-2609-00002), `revision 1` |
| 4 live manifests | `MAN-2609-00001` **APPROVED** (2 items, both **blNumber-stamped**: `'BOL-2609-00001'`, `'BOL-2609-00002'`, AL-links present, snapshots 1250.5/20/20 and 860/14/14), `MAN-2609-00002` SUBMITTED (1), `MAN-2609-00003` DRAFT (1), `MAN-2609-00004` DRAFT (0) — all parties None |

Design treatment: kept as-is; the backfill only *adds* `billOfLadingItemId` where a B/L item
points at the manifest item (idempotent); no renumbering, no row deletion (ADR-047 d3/d8).

## A7. Blast-radius table (every Manifest/ManifestItem consumer)

| # | Site | How it uses Manifest/ManifestItem | Phase-5 impact |
|---|---|---|---|
| 1 | `manifest.service/controller/dto` (746 LOC) | full CRUD + items + lifecycle + numbering | **primary target** (create-from-B/Ls, parties, numbering, ManifestDate) |
| 2 | `bill.service.ts:329-370` legacy `createFromManifest` | reads APPROVED manifest, claims its lines | transitional path stays (contract A); untouched until a later approved cleanup |
| 3 | `bill.service.ts:719-810` legacy `addItem {manifestItemId}` | claims manifest lines | same — stays |
| 4 | `bill.service.ts:889-1020` `eligibleItemsFromManifest` + `blNumber` select | reads manifest lines | stays; new path *reads B/L number via reference* instead of stamping |
| 5 | `bill.service.ts:1139-1192` approveCore stamp / cancel clear | **writes** `ManifestItem.blNumber` | direction reverses (ADR-047 d3): writes stop mattering on the new path; code stays for legacy rows (no drops) |
| 6 | `invoice.service.ts:497-510` | invoice anchors to manifest OR bill, voyage-consistency guard | read-only; additive columns don't affect it |
| 7 | `portal.service.ts:173, 338-362` | agent-scoped manifest counts/list (destination-scoped visibility = portal carry-over) | additive columns don't affect; visibility work stays a portal-unit carry-over (NOT touched) |
| 8 | `cargo.service.ts:48/115/185/255` + `Cargo.manifestNumber String?` (`schema:451`) | legacy free-text column + search/create/update | **untouched** (legacy field; recorded as carry-over) |
| 9 | `manifest/page.tsx` | create (voyage+single parties+costs), list filters, detail | **UI target** (consolidation flow, multi-party rows, tug/barge, ManifestDate) |
| 10 | `bills/page.tsx` route cell + detail subtitle | `manifest.polPort/podPort` summary read | unaffected (voyage fallback already shipped in U7) |
| 11 | `invoices/page.tsx:197/231` | optional manifest anchor dropdown | unaffected |
| 12 | `portal/page.tsx` | manifest list display | unaffected (portal unit owns visibility) |
| 13 | `packages/shared/src/manifest.ts` | `Manifest/ManifestItem/AddManifestItemDto` types | extended (reference, per-item parties, ManifestDate) |
| 14 | discharge module | **zero** manifest references (verified grep; ADR-039 discharge keys off cargo/AL) | none — record so U-units don't re-litigate |
| 15 | jobs/statements/letters/exports | **zero** manifest references (grep; no export/statements module exists — `letters` + `ledger` are the closest) | none |
| 16 | e2e suites: `manifest` (14 its), `bill`, `delivery-release`, `invoice`, `party-cutover`, `portal` | fixtures via legacy cargo path + B/L legacy claims | existing tests keep green (legacy paths stay); new suites added per unit |
| 17 | `documents` | none today | ADR-047 d10 adds `GET /manifests/:id/document` (U7-pattern hook) |

**Verified NON-consumers (recorded to bound the blast radius):** discharge (ADR-039), jobs,
ledger/accounting beyond invoice-anchor, letters, portal-visibility (carry-over), exports
(no module).

---

# PART B — DESIGN (specification: ADR-047, appended this unit)

Full decisions live in **ADR-047** (docs/decisions.md, appended after ADR-046). Summary:

1. **Create-from-B/Ls** — `POST /manifests {voyageId, billIds[]}`; qualifying bills are
   **live, `status === 'APPROVED'`** (ADR-046 vocabulary — NOT a new status), same voyage;
   each `ManifestItem` is built **from a `BillOfLadingItem`** (frozen snapshot), never from
   cargo directly; claim guard = a live B/L's items may sit on at most one live manifest
   (application-level, soft-delete rationale per ADR-030/U2).
2. **One manifest per B/L** (header-level; no line-level splitting) — traceability rationale
   in ADR-047 d2.
3. **Additive migration** (authored in the executing unit, not here): `ManifestItem
   .billOfLadingItemId String?` + FK `ON DELETE SET NULL` + idempotent two-way backfill from
   `bills_of_lading_items.manifestItemId`; legacy columns all stay (this phase proposes
   **NO drops** — Phase 4's "past Phase 5 with approval" deferral re-affirmed); stamp
   direction reverses (manifest reads the B/L number through the reference). Today: migrate
   status **36**; the executing unit will bring 37 with a shadow-clean diff.
4. **Multi-party** — per-item `shipperId/consigneeId` (nullable FKs) copied from the B/L at
   consolidation; manifest header parties remain the primary/default; display = per-row cells
   + a derived distinct-parties summary (grouping is display-time aggregation).
5. **Voyage/tug-barge** — display-time reads of `voyage.tugVessel/bargeVessel` (schema
   `tugVesselId/bargeVesselId`), no snapshots.
6. **ManifestDate** — one nullable `Manifest.manifestDate` column (defaulted from
   `voyage.plannedDepartureAt` at create, editable on DRAFT; technical default, logged).
7. **Per-destination numbering (U3 pattern verbatim)** — `NumberingService`,
   `scopeType DESTINATION` / `scopeValue = voyage.destinationPortId`, `{DEST} = Port
   .abbreviation ?? code`, name `manifest-{destPortId}-{yymm}`, `period YYYYMM`, prefix
   `MAN-{DEST}-{yymm}-`; legacy `MAN-YYMM-#####` immutable + coexist under
   `manifestNumber @unique`.
8. **Legacy paths transitional** — `eligible-cargo` + `items {cargoId}` keep working until
   the UI unit switches the page (contract-A analog; web-side retirement only, no API drops).
9. **Charges OUT OF SCOPE** — legacy cost columns untouched; the new path never populates or
   computes them; no charge/tariff/calculation is designed (roadmap Risk ii answered by
   absence, ADR-047 d9).
10. **Document output readiness** — `GET /manifests/:id/document` mirroring U7's ADR-009
    hook: structured data + `template: 'default'` + stub `render` (Phase 7 renders PDF/A).

---

# NBDs

**Raised: none.** Checked against the rule (ADR-045/046-settled items are citations, not
NBDs):
- "issued" wording → **ADR-046 ruling 1** (= APPROVED); no new status → no question left.
- Source-of-truth inversion → **ADR-045 decision 1** + roadmap scope; traceability risk
  answered by design (bidirectional reference + claim guard), not by asking.
- Manifest charges → **not a question: explicitly out of scope** (ADR-047 d9); if the
  employer ever specifies charges it becomes a fresh NBD *then*.
- ManifestDate default, one-manifest-per-B/L, numbering scope = technical defaults with
  recorded rationale (unspecified → reasonable default + log note, per protocol §2).
- **`docs/current-plan/12-open-business-decisions.md` therefore needs no update** (recorded:
  no new NBDs to add; ADR-044 (d) remains the only open NBD in the plan).
- Phase 4's legacy `manifestId` drop deferral: this phase proposes **NO drops** (ADR-047 d3).

---

# UNIT PLAN — P5-U2..Un mapped to the roadmap (ADR-045 §6 style)

| Unit | Delivers | Roadmap Tests | Roadmap Acceptance | Roadmap UI changes |
|---|---|---|---|---|
| **P5-U2** | additive migration (item FK + backfill + legacy columns stay) + `POST /manifests {voyageId, billIds}` with APPROVED/same-voyage/one-manifest guards, items copied from BillOfLadingItem, transitional marking of the cargo path | **1** creation from issued(=APPROVED) B/Ls · **2** ManifestItem→BillOfLadingItem integrity | 1 (downstream) · 4 (traceability) | — |
| **P5-U3** | per-item shippers/consignees end-to-end (DTO validation, copy-from-B/L, distinct-parties summary in API) | **3** multi-party support | **2** multi-party manifests supported | — |
| **P5-U4** | per-destination numbering swap (U3 pattern; legacy MAN numbers immutable) | **4** numbering | **3** numbering is per destination | — |
| **P5-U5** | UI consolidation flow (B/L picker replacing eligible-cargo), multi-party row display, voyage/tug/barge display, ManifestDate field, document-output hook, closure assessment (incl. legacy-path transitional status review) | — (UI verification) | 1-4 re-verified via the suites | **1** create/consolidate UI · **2** multi-party row display · **3** voyage/tug/barge display (+ doc hook) |

Order = risk-first again (reference/traceability before UI). U3+U4 may compress if trivial;
the Tests→unit mapping stays authoritative.

---

# OPTIONAL SLICE — DECLINED (same posture as P4-U1 / P3-U5)

Declined: every self-contained candidate touches **schema/DTO/service** (ManifestItem FK,
parties, ManifestDate), the **numbering swap** (would pre-empt ADR-047 d7's configurable
scope), or **UI** (consolidation flow is the phase's centerpiece). Nothing is safely
deliverable without pre-empting the configurable parts of this design or changing shared
types/tests — identical reasoning to P4-U1 and P3-U5, recorded not repeated silently.

---

# Verification (verbatim)

1. Baseline first run at 175fa32 → **385/385/0 (22/22)** ✅
2. `npx tsc -p apps/api --noEmit` → **0**; `npx tsc -p apps/web` → **exactly the 3
   pre-existing `[locale]/page.tsx` errors**; `pnpm --filter @shipping/shared build` → **0** ✅
3. `npx prisma migrate status` → **36 migrations … up to date** (design = no migration) ✅
4. `pnpm --filter @shipping/web test` → `CONTRACT GUARD OK — 18 shared status unions ⊆
   Prisma enums; 87 web api.post routes ⊆ 95 controller @Post routes` (exit 0) ✅
5. `curl :3101/api/v1/health → 200`, `curl :3000 → 200`, never restarted ✅
6. Root `pnpm test` self-recursion untouched (used `pnpm --filter …` throughout); no `npx
   pnpm` ✅
7. **Porcelain = docs only:** this log + `docs/decisions.md` (ADR-047) + `docs/current-plan/
   11-implementation-state.md` (Phase 5 OPENED) — zero code/schema/test/seed files ✅
8. Fixtures: **none created** (nothing to delete; U2 explicit-filter rule not exercised) ✅

## TRANSLATION_CHANGES

none

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase5-unit1-manifest-rewrite-design
PHASE: Phase 5 — Manifest Rewrite (unit 1 / P5-U1, DESIGN-ONLY)
DB_MIGRATION_STATUS: none (design-only — migrate status stays 36; the executing unit adds
  one additive migration: ManifestItem.billOfLadingItemId FK SET NULL + idempotent backfill,
  diff-generated with shadow clean, status -> 37 there; legacy columns all stay, NO DROPS)
UI_GATE: NOT APPLICABLE (design-only — no code/schema/tests touched)
SURVEY: Part A — creation path, item/header shapes (single-party defect), numbering, stamp
  direction (bill.service:1139-1192), live legacy data (3 B/Ls + 4 manifests table), and a
  17-row blast-radius table incl. verified NON-consumers (discharge/jobs/ledger/letters/
  exports have zero manifest refs) and the Cargo.manifestNumber legacy free-text field
DESIGN: Part B + ADR-047 (11 decisions): APPROVED-only qualification (ADR-046 vocabulary —
  no new status), one-manifest-per-B/L claim guard, additive item reference + two-way
  backfill, per-item parties w/ header fallback + distinct summary, display-only tug/barge,
  ManifestDate column (plannedDepartureAt default), U3-pattern per-destination numbering
  (legacy MAN numbers immutable + coexist), transitional cargo paths (contract-A analog),
  charges OUT OF SCOPE, ADR-009 document hook, unit plan
UNIT_PLAN: U2 migration+create+integrity (Tests 1-2), U3 multi-party (Test 3, Acceptance 2),
  U4 numbering (Test 4, Acceptance 3), U5 UI + doc hook + closure (UI changes 1-3); table in
  log maps every unit to Tests/Acceptance/UI
NBD_RAISED: none — vocabulary/source-of-truth/charges are ADR-046/045 + explicit out-of-
  scope; 12-open-decisions doc unchanged (recorded); ADR-044 (d) remains the only open NBD
SLICE: declined with reasons (every candidate touches schema/DTO/service/numbering/UI and
  would pre-empt the configurable design)
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = log + decisions.md + state doc; committed at task end so the
  tree ends clean; baseline suite green; servers never restarted
UNRESOLVED_ISSUES: carry-overs unchanged (portal visibility, follow-ups b/f/g/h, Cargo
  .manifestNumber legacy field noted in table row 8)
NEEDS_BUSINESS_DECISION: none new
BLOCKED: none
HANDOFF_TO: decision-maker (unit-1 verification → P5-U2 execution: additive migration +
  create-from-B/Ls + integrity guards)
```
