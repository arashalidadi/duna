# 2026-10-02 — Phase 3 unit 2b: chain ungate (load-lists URLs, copy-on-create, manifest quantity gate)

## Task ID

phase3-unit2b-chain-ungate

## Phase

Phase 3 — Operational Flow Reconciliation (unit 2b)

## Objective

Close the unit-2 UI gate and the two gaps it exposed: restore the six dead LoadList page actions
(part 1, one authorized file), materialize Actual Loading lines at create (part 2, copy-on-create
per ADR-042), and keep manifest eligibility "actually loaded" by requiring a positive recorded
quantity at both manifest sites (part 3).

## Prompt reference

- Roadmap: `docs/current-plan/09-final-implementation-roadmap.md` §3 Phase 3 — "align … LoadList,
  ActualLoading … with target gating and lifecycle behavior".
- Protocol: `docs/current-plan/10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.
- Locked decisions: ADR-028 (ActualLoading), ADR-041 (3-state LoadList), ADR-042 (this unit).

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD `d74f2a3`, **clean porcelain (0 lines)** at start.
- Servers are the user's, never restarted: API `:3101` **200 before / 200 after**, WEB `:3000`
  **200 before / 200 after**.
- Tests: `pnpm --filter api test -- <spec>` from repo root (never `npx pnpm …`).

## Baseline before touching anything (verification step 1 — ACCEPTED)

First run at d74f2a3, `pnpm --filter api test -- --json …`:

```
Test Suites: 22 passed, 22 total
Tests:       357 passed, 357 total
```

Matches the stated baseline exactly (357/357/0, 22/22, tree clean).

## Part 1 — restore the 6 dead LoadList actions (defect fix)

The ENTIRE change: single-quoted `'/load-lists/${…}'` → backtick template literals on exactly six
lines of `apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx`. Nothing else, no other file.

**Grep BEFORE (the grep that found them — single-quoted strings containing `${` in `api.` calls,
across all of `apps/web/src`):**

```
apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:291:      await api.post('/load-lists/${addItemLoadListId}/items', {
apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:318:      await api.post('/load-lists/${addItemLoadListId}/items/bulk', {
apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:342:      await api.del('/load-lists/${viewing.id}/items/${confirmingDeleteItem.id}');
apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:344:      const d = await api.get('/load-lists/${viewing.id}');
apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:357:      const updated = await api.post('/load-lists/${confirmingFinalize.id}/finalize');
apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:383:      const updated = await api.post('/load-lists/${confirmingCancel.id}/cancel', { cancelReason: cancelReason.trim() });
```

**Grep AFTER (same command, same scope):**

```
(none)
```

**The six lines as fixed:**

```
291:      await api.post(`/load-lists/${addItemLoadListId}/items`, {
318:      await api.post(`/load-lists/${addItemLoadListId}/items/bulk`, {
342:      await api.del(`/load-lists/${viewing.id}/items/${confirmingDeleteItem.id}`);
344:      const d = await api.get(`/load-lists/${viewing.id}`);
357:      const updated = await api.post(`/load-lists/${confirmingFinalize.id}/finalize`);
383:      const updated = await api.post(`/load-lists/${confirmingCancel.id}/cancel`, { cancelReason: cancelReason.trim() });
```

`npx tsc -p apps/web/tsconfig.json` after the fix: still exactly the 3 pre-existing
`[locale]/page.tsx` errors.

## Part 2 — copy-on-create (implementation shape + retry-atomicity)

`apps/api/src/modules/actual-loading/actual-loading.service.ts` `create()`:

- Load List select extended: `items: { select: { id: true, cargoId: true } }` (line id +
  cargoId are what an `ActualLoadingItem` needs).
- Inside the existing number-allocation retry loop, the single `prisma.actualLoading.create` now
  carries the nested materialization (mirrors `Discharge.create()`'s `items: { create: [...] }`):

```ts
items: {
  create: loadList.items.map((line) => ({
    loadListItemId: line.id,
    cargoId: line.cargoId,
    actualQuantity: null,
    result: 'NOT_LOADED' as const,
  })),
},
```

**Retry-atomicity reasoning.** The nested create rides the SAME `actualLoading.create` call inside
the `try`, so one attempt is one transaction: if anything inside rolls back, everything rolls
back with it and the loop re-allocates a fresh `actualLoadingNumber`. The retry discriminates on
`e.meta.target` containing `actualLoadingNumber`, so a **`loadListItemId` unique collision**
(`ActualLoadingItem.loadListItemId @unique`, schema.prisma:976) can never enter the
number-retry branch — it falls through to the existing `P2002/P2018 → ConflictException` 409 path,
unchanged. Validation order untouched: exists → status ≠ FINALIZED (409) → empty-list (400) →
number retry → nested create. Number semantics unchanged (`AL-YYMM-#####`, highest+1 with
bounded retry). `complete()`, `updateItem(sBulk)` and their guards are untouched; `complete()`'s
shipped empty-items 400 stays as a backstop. `selectionStatus` has zero references — all lines
are copied, no selection filter.

## Part 3 — manifest eligibility stays "actually loaded" (both sites, before → after)

`apps/api/src/modules/manifest/manifest.service.ts`:

**Site 1 — add guard (`loadedOnVoyage`, ~:417):**

```before
    const loadedOnVoyage = await this.prisma.actualLoadingItem.findFirst({
      where: {
        cargoId: dto.cargoId,
        actualLoading: { status: 'COMPLETED', deletedAt: null, loadList: { voyageId: … } },
      },
```

```after
    const loadedOnVoyage = await this.prisma.actualLoadingItem.findFirst({
      where: {
        cargoId: dto.cargoId,
        actualQuantity: { gt: 0 },                    // NEW — actually loaded
        actualLoading: { status: 'COMPLETED', deletedAt: null, loadList: { voyageId: … } },
      },
```

**Site 2 — `eligibleCargo` (`loaded` findMany, ~:540):**

```before
    const loaded = await this.prisma.actualLoadingItem.findMany({
      where: {
        actualLoading: { status: 'COMPLETED', deletedAt: null, loadList: { voyageId, deletedAt: null } },
      },
```

```after
    const loaded = await this.prisma.actualLoadingItem.findMany({
      where: {
        actualQuantity: { gt: 0 },                    // NEW — NULL/0 lines are not on board
        actualLoading: { status: 'COMPLETED', deletedAt: null, loadList: { voyageId, deletedAt: null } },
      },
```

Rationale cited at both sites: **ADR-029 "the manifest reflects what was actually loaded"** and
**ADR-028 — NOT_LOADED cargo stays in the yard and remains eligible for later planning**. In
PostgreSQL `actualQuantity > 0` never matches NULL, so both null and zero lines are excluded by
one clause. The snapshot line is untouched:
`quantity: loadedOnVoyage.actualQuantity ?? cargo.quantity` (manifest.service.ts:451).

## ADR-042 (text as appended to docs/decisions.md)

```markdown
## ADR-042: ActualLoading materializes its Load List lines at create; manifest eligibility = positive recorded quantity

**Date:** 2026-10-02
**Status:** Accepted
**Context:** Phase 3 unit 2b (chain ungate). Unit 2's UI gate exposed that an Actual Loading
created through the shipped UI had **zero items**: `create()` validated the Load List but never
copied its lines, the UI's quantity editor renders `detail.items` with **no add-row path**, and
`complete()` then 400s with "Cannot complete an Actual Loading with no items" — every seed
Actual Loading is 0-item too. The schema already models the 1:1 shape: `ActualLoadingItem` has
`loadListItemId String @unique`, i.e. exactly one Actual Loading line per Load List line, and
ADR-028 defines the per-line semantics (`actualQuantity` per line, derived `result`
FULL/PARTIAL/NOT_LOADED, cargo leaves the yard only on FULL completion).
`Discharge.create()` already materializes its lines with the nested
`items: { create: [...] }` pattern — ActualLoading was the outlier.

**Decision.**
1. **Copy-on-create**: `ActualLoading.create()` materializes **every** Load List line inside the
   same create/transaction — one `ActualLoadingItem` per line with `loadListItemId`, `cargoId`,
   `actualQuantity: null` and `result: 'NOT_LOADED'` (the enum default). All lines are copied;
   there is no selection filter (`selectionStatus` on `LoadListItem` is **vestigial** — zero
   references, gates nothing). The nested create rides the existing number-allocation retry, so
   allocation stays atomic: a `loadListItemId` unique collision rolls back the attempt, never
   matches the `actualLoadingNumber` retry discriminator, and keeps falling through to the
   existing 409 path.
2. **No empty-complete escape**: `complete()`'s shipped 400 for an Actual Loading with no items
   stays as a backstop; `complete()`/`updateItem(sBulk)` guards are unchanged. Recording stays
   optional per ADR-028 — an untouched (all-NOT_LOADED) Actual Loading completes and its cargo
   stays in the yard.

**Consequences.** The UI works end-to-end with no UI change: rows render immediately after
create, quantities can be recorded, saved and completed. Because unrecorded lines now exist by
default, **manifest eligibility is tightened to a positive recorded quantity at both sites** —
the add guard and `eligibleCargo` in `manifest.service.ts` now require
`actualQuantity > 0` (NULL and 0 excluded). Rationale: **ADR-029 — "the manifest reflects what
was actually loaded"**, and **ADR-028 — NOT_LOADED cargo stays in the yard and remains eligible
for later planning** (it is not on board, so it must not be manifested). Discharge is unchanged
— its own on-board filter (`actualQuantity > 0`, "Nothing was actually loaded" 400) already did
this. The manifest item quantity keeps snapshotting `loadedOnVoyage.actualQuantity ??
cargo.quantity`, which now always carries the recorded value for eligible lines. Pre-existing
0-item seed Actual Loadings are **not backfilled** (their state is recorded; cleanup deferred).
```

## Files changed

- `apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx` — **the 6 lines** (part 1): add-item,
  bulk-add, delete-item, detail-refresh, finalize, cancel now interpolate.
- `apps/api/src/modules/actual-loading/actual-loading.service.ts` — **`create()` copy-on-create**
  (part 2): nested `items: { create: … }` + select extended to `{ id, cargoId }`.
- `apps/api/src/modules/manifest/manifest.service.ts` — **two where-clauses** (part 3):
  `actualQuantity: { gt: 0 }` on the add guard and `eligibleCargo`.
- Tests: `actual-loading.e2e-spec.ts` (+3 tests, 1 assertion rewritten), `manifest.e2e-spec.ts`
  (+1 test), `discharge.e2e-spec.ts` (+1 test).
- `docs/decisions.md` — ADR-042 appended.

## Database changes

none — no schema or migration changes (§4 stop-check: copy-on-create uses the existing
`ActualLoadingItem` relation; no new columns/indices needed).

## Migrations

none. `npx prisma migrate status` → **32 migrations found … Database schema is up to date!**

`migrate diff --from-migrations --to-schema-datamodel` against a scratch shadow DB
(`scratch/p3u2b-shadow-diff.sh`, created/dropped around the run):

```
diff exit code: 0
No difference detected.
```

## Tests (required items 1–6 and their placement)

| # | required test | where | result |
| --- | --- | --- | --- |
| 1 | N lines → N ActualLoadingItems (NOT_LOADED, null, one per loadListItemId) | actual-loading suite `ADR-042 copy-on-create: N load list lines → N ActualLoadingItems…` (2-line list; asserts create response AND detail) | green |
| 2 | untouched AL completes; cargo stays in yard | actual-loading suite `ADR-042: an untouched Actual Loading … completes 200 and cargo stays in the yard` — asserts COMPLETED, line NOT_LOADED, `loadingStatus` still `NOT_LOADED`, yard inventory row still present | green |
| 3 | FULL record → complete → LOADED + yard inventory deleted | actual-loading suite `ADR-042/028: recording ≥ planned → FULL → complete marks cargo LOADED and deletes its yard inventory` (asserts result FULL at save-time, then LOADED, then 0 inventory rows) | green |
| 4 | manifest: null/0 → 409 shipped message + absent from eligibleCargo; positive → eligible, quantity = recorded actualQuantity | manifest suite `manifest eligibility requires a POSITIVE recorded quantity (ADR-029/ADR-042)…` — one chain per case (null, 0, +10 of quantity 30); exact 409 message asserted; snapshot asserts `10` (≠ cargo quantity 30) | green |
| 5 | discharge unchanged: all-unrecorded → 400 "Nothing was actually loaded"; positive still discharge | discharge suite `ADR-042: an all-unrecorded Actual Loading cannot discharge (400 …)` — exact message asserted; positive-path discharge covered by the suite's existing 21 tests, all still green | green |
| 6 | unit 2's tests retained | actual-loading gates describe: the 4 unit-2 tests unchanged and green; inspection C6 unchanged and green (27/27) | green |

**One existing assertion rewritten (authorized by part 2, cited to ADR-042):**
`actual-loading.e2e-spec.ts` former `expect(created.items).toEqual([])` in
`create + get + list as admin…` → now asserts the materialized line
(`toHaveLength(1)`, `loadListItemId === loadListItemId`, `result 'NOT_LOADED'`,
`actualQuantity null`) with the comment "ADR-042 copy-on-create … (was `toEqual([])` before
ADR-042 — superseded, cited in decisions.md)". This was the only assertion in the repo that
pinned zero-item Actual Loadings (the two other `toEqual([])` hits are `Manifest` creates, which
are unaffected).

Placement justification: all three touched suites already own the fixtures each test needs
(actual-loading has `createDoneCargo`/`createLoadList` helpers from unit 2; manifest and
discharge have their own chain helpers) — no fixture blocks were duplicated. The manifest test
reuses the suite's live `manifest3Id` DRAFT manifest (voyage3's one-per-voyage slot) because
fixture `manifest1Id` is APPROVED by earlier tests and a fresh per-voyage manifest is 409.

### Per-suite before → after

| suite | before (P/F/T) | after (P/F/T) |
| --- | --- | --- |
| actual-loading | 14 / 0 / 14 | **17 / 0 / 17** |
| manifest | 13 / 0 / 13 | **14 / 0 / 14** |
| discharge | 21 / 0 / 21 | **22 / 0 / 22** |
| all 19 other suites | 309 / 0 / 309 | 309 / 0 / 309 |

Solo runs after the final edits: actual-loading 17/17, manifest 14/14, discharge 22/22,
bill 13/13, delivery-release 10/10.

### Three consecutive full runs — byte-identical (step 3, headline)

```
run 1: Test Suites: 22 passed, 22 total
       Tests:       362 passed, 362 total
run 2: Test Suites: 22 passed, 22 total
       Tests:       362 passed, 362 total
run 3: Test Suites: 22 passed, 22 total
       Tests:       362 passed, 362 total
```

Per-suite counts identical across all three (verified programmatically from the `--json`
outputs). Reconciliation: 357 + 5 new = 362; 0 failed.

## Validation steps (4–7)

- `npx tsc --noEmit -p apps/api/tsconfig.json` → **0 errors** (final state).
- `npx tsc --noEmit -p apps/web/tsconfig.json` → **exactly the 3 pre-existing**
  `apps/web/src/app/[locale]/page.tsx` errors.
- `pnpm --filter @shipping/shared build` → **0 errors**.
- `npx prisma migrate status` → **32 … up to date**; shadow-DB diff → **No difference detected**.
- Servers after: API **200**, WEB **200** (both 200 before; never restarted).
- `git status --porcelain` vs d74f2a3 (0 lines): 7 files + this log = 8. **Exactly one file under
  `apps/web/src`** — `load-lists/page.tsx` — and **zero files under `packages/shared`** (asserted).

## UI gate (protocol §3.1) — **PASS** (driven end-to-end, evidence below)

Live counts: **before = 5 LoadLists all DRAFT, 4 ActualLoading all DRAFT** (captured by the setup
script; matches the stated baseline). Gate fixture (fresh voyage `VOY-2610-00881`, vessel, two
DONE chains, DRAFT manifest `MAN-2610-00001`): after setup = 7 lists (5D + LL2 finalized as
negative-chain setup) / 5 ALs (4D + AL2 completed unrecorded).

1. **`/en/load-lists` — finalize a DRAFT list (part 1 proof):** row `LL-2610-00001` → Finalize
   button → confirm dialog → the fetch log captured the REAL request
   **`POST /api/v1/load-lists/cmuqd2tws000gt1bzpp9pvt7w/finalize → 200`** (properly interpolated —
   the unit-2 bug is gone) and the row flipped to **`Finalized`**. No body errors, **0 console
   errors**. Screenshot (vision-verified): `…/workspace/20260901_053356_09ccd927/p3u2b-gate1-finalize-200.png`
   — Load Lists page, LL-2610-00001 green "Finalized" badge, no error banners.
2. **`/en/actual-loading` — full chain through the unchanged UI:**
   - create dialog offered `LL-2610-00001 — …`; **`POST /api/v1/actual-loading → 201`**; list row
     `AL-2610-00002` with **Items = 1**.
   - detail opened **with the line rendered immediately — no "No items yet"** (copy-on-create):
     `CRG-2610-00113 | planned 5 | actual — | Not loaded`, input
     `Actual quantity for CRG-2610-00113`.
   - recorded **5** → **`PATCH …/items/<loadListItemId> → 200`**; server-side truth:
     `actualQuantity 5, result FULL`.
   - **start → 200** ("In progress"), **complete → 200**, row → **`Completed`**. 0 console errors
     throughout. Screenshot (vision-verified):
     `…/p3u2b-gate2-completed.png` — AL-2610-00002 green "Completed", Items 1, no errors.
3. **Negative observed once:** the never-recorded line's cargo (`CRG-2610-00114`, completed AL
   with all-NOT_LOADED lines) stays **out of the manifest eligible list**: the manifest detail's
   "Add cargo to manifest" picker (driven via the UI) contained exactly
   `["Select cargo…", "CRG-2610-00113 · CONTAINER · — kg"]` — `CRG-2610-00114` absent from the
   options, the dialog, and the whole page text. 0 console errors. Screenshot (vision-verified):
   `…/p3u2b-gate3-eligible-list.png` — MAN-2610-00001 detail with the Select cargo picker open,
   no CRG-2610-00114 anywhere, no errors.
4. **Counts after gate:** 7 LoadLists (5 DRAFT seed + 2 FINALIZED mine) / 6 ActualLoading
   (4 DRAFT seed + 2 COMPLETED mine). **My rows were then CLEANED UP** — AL items ×2, ALs ×2,
   manifest ×1 (0 items — the picker was observed, not submitted), LL items ×2, LLs ×2,
   inspections ×2, cargos ×2, voyage ×1, vessel ×1 — **restored to exactly 5 LoadLists all DRAFT
   / 4 ActualLoading all DRAFT**, seed numbers `LL-2401/2609-00001…4` and
   `AL-2609-00001…4` intact. **Statement: all rows I created were cleaned up; demo rows untouched.**
5. Console-error collectors installed on every page before acting: **0 console errors / 0
   unhandled rejections / 0 error banners** across the whole gate.

**Recorded state (not mutated, per scope):** the 4 pre-existing seed Actual Loadings
`AL-2609-00001…00004` remain **0-item** (copy-on-create does not backfill).

## Unresolved issues

1. **Non-blocking observation — `cargoId` query param ignored:** `ListInventoryQueryDto` declares
   `cargoId` (yard-inventory dto:15) but `yard-inventory.service.ts` `list()` never applies it
   (where clause covers yardId/portId/status/cargoStatus/customerId/destinationPortId/search only).
   The new yard-inventory assertions therefore filter client-side on `cargo.id` (noted in the
   test). No fix attempted — pre-existing, out of this unit's scope, nothing blocked by it.
2. No roadmap-blocking gaps: the unit-2 gaps are closed (part 1 + ADR-042).

## Known deviations

1. **One assertion rewritten** (`actual-loading.e2e-spec.ts`, `items: []` → materialized-line
   assertions) — authorized by part 2 and cited to ADR-042 in-code (mapping above).
2. **Yard-inventory assertions filter client-side** because of observation #1 (in-test note).
3. **Gate negative chain** (LL2 finalize → AL2 create/start/complete with no recording) was built
   as API-level setup; the steps the gate mandates to be UI-driven (finalize, create, record,
   save, start, complete, eligible-list observation) were all driven through the UI as evidenced.
4. The gate's manifest picker was **observed, not submitted** (no manifest item was created).
5. Pre-existing leaked `VOY-TEST-…` voyages are visible in a dropdown (other suites' historical
   fixtures) — untouched, out of scope.

## TRANSLATION_CHANGES

none

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase3-unit2b-chain-ungate
PHASE: Phase 3 — Operational Flow Reconciliation (unit 2b)
DB_MIGRATION_STATUS: none — no schema or migration changes (migrate status: 32 up to date;
  migrate diff vs scratch shadow DB: "No difference detected")
UI_GATE: PASS — evidence: workspace/p3u2b-gate1-finalize-200.png (LL-2610-00001 Finalized;
  fetch log POST /api/v1/load-lists/<id>/finalize -> 200), p3u2b-gate2-completed.png
  (AL-2610-00002 Completed, Items 1; PATCH item -> 200, start -> 200, complete -> 200),
  p3u2b-gate3-eligible-list.png + picker options dump (CRG-2610-00113 present, CRG-2610-00114
  absent); 0 console errors throughout; counts before 5 DRAFT lists / 4 DRAFT ALs ->
  after gate 7 lists / 6 ALs -> all my rows cleaned up -> restored to 5 DRAFT / 4 DRAFT,
  demo rows intact
SCHEMA_CHANGES: none
CODE_CHANGES:
  - apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx — THE 6 LINES (291, 318, 342,
    344, 357, 383): single-quoted '/load-lists/${…}' -> backtick templates (add-item, bulk,
    delete, refresh, finalize, cancel); before/after greps above, class absent afterwards
  - apps/api/src/modules/actual-loading/actual-loading.service.ts — create() copy-on-create:
    nested items { create: [...] } (loadListItemId, cargoId, actualQuantity null,
    NOT_LOADED) inside the existing number-retry transaction (atomicity reasoning above)
  - apps/api/src/modules/manifest/manifest.service.ts — x2: actualQuantity { gt: 0 } on the
    add guard (loadedOnVoyage) and on eligibleCargo (loaded); snapshot line untouched
  - docs/decisions.md — ADR-042 appended (text above)
TEST_CHANGES: baseline 357/357/0 (22/22) -> 3 consecutive runs: 362/362/0, 362/362/0,
  362/362/0 (per-suite identical); new tests: 5 (AL +3, manifest +1, discharge +1), all green
  solo and in all 3 full runs; 1 pre-existing assertion rewritten (items: [] -> materialized
  line, cited ADR-042); unit 2's 4 tests + C6 retained and green
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain diff vs d74f2a3 (0 lines) = 7 files + this log; apps/web/src changed
  = load-lists/page.tsx ONLY (exactly one file); packages/shared = none
UNRESOLVED_ISSUES: 1 non-blocking observation — yard-inventory list() ignores its declared
  cargoId query param (yard-inventory.service.ts list(), dto cargoId:15); tests filter
  client-side; out of scope, nothing blocked. No roadmap-blocking gaps.
NEEDS_BUSINESS_DECISION: none — gap 2 is resolved by ADR-042 (employer UAT confirmation of
  ADR-041 remains non-blocking per that ADR)
BLOCKED: none
HANDOFF_TO: decision-maker (unit 2b verification → Phase 3 unit 3)
```
