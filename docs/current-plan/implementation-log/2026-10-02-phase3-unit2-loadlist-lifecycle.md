# 2026-10-02 — Phase 3 unit 2: LoadList lifecycle (ADR-041) & ADR-028 alignment

## Task ID

phase3-unit2-loadlist-lifecycle

## Phase

Phase 3 — Operational Flow Reconciliation (unit 2)

## Objective

Make the LoadList → ActualLoading chain reachable and compliant with locked ADR-028 by moving the
backend to the 3-state LoadList model the other four layers already ship (shared type, both pages,
ADR-028): add the `DRAFT → FINALIZED` edge, realign the ActualLoading creation gate to FINALIZED,
revalue the fixture stamps, rewrite unit 1's C6 under ADR-041, prove it with new tests, and drive
the previously-dead behavior through the existing UI (gate).

## Prompt reference

- Roadmap: `docs/current-plan/09-final-implementation-roadmap.md` §3 Phase 3 — "Status lifecycle
  alignment"; §2.3 (Phase 3A transitional milestone).
- Protocol: `docs/current-plan/10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.
- Locked decisions: ADR-028 (ActualLoading), ADR-041 (this unit).

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD `fc38291`, **clean porcelain (0 lines)** at start.
- Servers are the user's, never restarted: API `:3101` **200 before / 200 after**, WEB `:3000`
  **200 before / 200 after**.
- Tests: `pnpm --filter api test -- <spec>` from repo root (never `npx pnpm …`).

## Baseline before touching anything (verification step 1 — ACCEPTED)

First run at fc38291, `pnpm --filter api test -- --json …`:

```
Test Suites: 22 passed, 22 total
Tests:       353 passed, 353 total
```

Matches the confirmed baseline exactly (353/353/0, 22/22).

## Layer-alignment evidence (the decision's premise, verified before coding)

| layer | what it ships | evidence |
| --- | --- | --- |
| `packages/shared` | `export type LoadListStatus = 'DRAFT' \| 'FINALIZED' \| 'CANCELLED'` | `packages/shared/src/load-planning.ts:6` |
| `/en/load-lists` page | 3-state filters `['DRAFT','FINALIZED','CANCELLED']`, Finalize button gated on `row.status === 'DRAFT'`, Cancel on DRAFT/FINALIZED, Badge meta for all three | `load-lists/page.tsx:40,47,260,436,545,556` |
| `/en/actual-loading` page | create dialog fetches `/load-lists?status=FINALIZED&pageSize=100`, empty-state "Finalize a load list first." | `actual-loading/page.tsx:162,544,553` |
| ADR-028 (locked) | "Creation additionally requires the Load List to be **FINALIZED** (409 otherwise)" | `docs/decisions.md` ADR-028 |
| **backend (the outlier)** | `DRAFT → IN_PROGRESS → … → COMPLETED → FINALIZED`, AL creation required `COMPLETED`, nothing ever wrote the intermediate states | `load-planning.service.ts:29-33`, `actual-loading.service.ts:240-244` (before this unit) |

No evidence anywhere specifies intermediate statuses (employer workflow §2.3 specifies no statuses
at all) — hence: backend moves, other four layers untouched.

## Files changed

Production (2):

- `apps/api/src/modules/load-planning/load-planning.service.ts` — **the transition-map edge**:
  `DRAFT: ['IN_PROGRESS', 'FINALIZED', 'CANCELLED']` (ADR-041 comment in place; existing
  intermediate entries retained per instruction).
- `apps/api/src/modules/actual-loading/actual-loading.service.ts` — **the AL creation gate**:
  `loadList.status !== 'FINALIZED'` with message
  `` `Actual Loading can only be created for FINALIZED Load Lists. Current status: ${loadList.status}` ``
  (shape preserved).

Tests (6):

- `inspection.e2e-spec.ts` — **C6 rewritten** (DRAFT empty → 400; DRAFT+items → 200 FINALIZED, cited
  to ADR-041); helper renamed/revalued `stampLoadListFinalized` (FINALIZED).
- `actual-loading.e2e-spec.ts` — **4 new gate/chain tests**; helper renamed/revalued; beforeAll
  stamp now FINALIZED; the superseded trailing `finalize` call removed; afterAll cargo cleanup
  generalized to `createdCargos`.
- `bill / delivery-release / discharge / manifest .e2e-spec.ts` — helpers renamed/revalued; the 8
  superseded trailing `finalize` calls removed (see mapping below).

Docs (1): `docs/decisions.md` — **ADR-041 appended** (text reproduced below).

## Database changes

none — no schema or migration changes (§4 stop-check: no schema work was needed; the DB
`LoadListStatus` enum keeps its superseded values deliberately, recorded in ADR-041).

## Migrations

none. `npx prisma migrate status` → **32 migrations found … Database schema is up to date!**
(before AND after — unchanged by this unit).

Migrate diff against a scratch shadow DB (created/dropped by
`scratch/p3u2-shadow-diff.sh`):

```
diff exit code: 0
No difference detected.
```

## Decision implementation (exactly as specified — no redesign)

1. **Edge added**, existing rows kept: `DRAFT: ['IN_PROGRESS', 'FINALIZED', 'CANCELLED']` with a
   comment naming ADR-041 and marking the intermediates superseded (they stay for ADR-041's
   documentation, unreachable either way).
2. **No** start/complete endpoints, **no** permission codes, **no** `packages/shared` or
   `apps/web/src` changes in this unit's code (asserted again under GIT_VERIFICATION).
3. **AL gate realigned** `COMPLETED` → `FINALIZED`, message names FINALIZED, keeps the
   `Current status: <status>` suffix (the new tests assert the exact message text).
4. **Six helpers renamed + revalued** (`stampLoadListCompleted` → `stampLoadListFinalized`,
   `status: 'FINALIZED'`): actual-loading:273, bill:439, delivery-release:66, discharge:69,
   inspection:738, manifest:338 (post-edit line refs; helper comment blocks updated to cite ADR-041).
   Grep found **no other loadList status stamp** anywhere in tests or production.
5. **Trailing `finalize` calls after a stamp removed (9 sites)** — mapping/justification:

   | site (pre-edit line) | before | after | why (not weakening) |
   | --- | --- | --- | --- |
   | actual-loading:567, bill:240, bill:322, delivery-release:176, discharge:250, :318, :368, :744, manifest:238 | `stamp(COMPLETED) → AL create → finalize → 200` | `stamp(FINALIZED) → AL create → 201` | finalize from an already-FINALIZED list is 409 by ADR-041 (`FINALIZED: []`); the call encoded the superseded COMPLETED-era ordering, not roadmap behavior. Its intent ("list is finalized") is asserted by the stamp itself, and finalize-200 coverage moved to the rewritten C6 + new test #1 (DRAFT path — stronger). |
   | inspection C6 (:901/:922) | DRAFT→409, stamp+finalize→200 | empty DRAFT→**400**; DRAFT+items→**200** | **C6 before/after below, cited to ADR-041** (explicitly authorized). |

6. **C6 before/after (ADR-041 citation):**

   | | before (unit 1) | after (unit 2) |
   | --- | --- | --- |
   | empty DRAFT finalize | **409** ("DRAFT → FINALIZED is not a shipped transition") | **400** — transition now legal, so the unchanged emptiness rule fires (`Cannot finalize an empty Load List`) |
   | finalize DRAFT + 1 eligible item | **409** (had to stamp COMPLETED first, then finalize 200) | **200** + detail `status === 'FINALIZED'`, **no stamping** |
   | stamp helper call inside C6 | `stampLoadListCompleted` used | **removed** (C6 comment: "ADR-041: DRAFT → FINALIZED is the shipped edge … REWRITTEN here under the decision-maker's explicit authorization — supersession recorded in ADR-041") |

   No other assertion in the repo encodes `LoadList.COMPLETED` as a precondition (grep: the only
   COMPLETED mentions left are the transition map's retained entries and AL's own `COMPLETED`
   status, which ADR-028 keeps).

## ADR-041 (text as appended to docs/decisions.md)

```markdown
## ADR-041: LoadList lifecycle is 3-state — DRAFT → FINALIZED (→ CANCELLED); backend aligned to the shipped model

**Date:** 2026-10-02
**Status:** Accepted
**Context:** Phase 3 unit 2 (Operational Flow Reconciliation). The backend `LOAD_LIST_TRANSITIONS` map
still carried the original six-value lifecycle (`DRAFT → IN_PROGRESS → PARTIALLY_LOADED → COMPLETED →
FINALIZED`) and gated ActualLoading creation on `COMPLETED`, but no code anywhere could write
`IN_PROGRESS`/`PARTIALLY_LOADED`/`COMPLETED` — a load list could never leave `DRAFT` via the API, so
`finalize()` and ActualLoading creation were unreachable (the unit-1 log recorded this as a product gap).
Four other layers already agreed on the 3-state model: `packages/shared` types
(`LoadListStatus = 'DRAFT' | 'FINALIZED' | 'CANCELLED'`), the `/en/load-lists` page (its 3-state filters,
finalize button and cancel actions), the `/en/actual-loading` create dialog (it fetches
`/load-lists?status=FINALIZED`), and ADR-028 itself, which already says ActualLoading creation requires a
**FINALIZED** Load List. The backend was the single outlier; inventing start/complete endpoints and
intermediate statuses would have been unevidenced business rules (employer workflow §2.3 specifies no
statuses at all).

**Decision.**
1. LoadList lifecycle is **`DRAFT → FINALIZED → (CANCELLED)`**: `finalize()` from `DRAFT` is the one
   production path (with the existing empty-list 400 and per-item eligibility 409 checks intact), and
   `cancel()` with a reason is reachable from `DRAFT`/`FINALIZED`. The `DRAFT → FINALIZED` edge was added
   to `LOAD_LIST_TRANSITIONS`; the existing intermediate entries were left in place (no row can reach
   them) and are hereby **superseded**.
2. The `LoadListStatus` DB enum values `IN_PROGRESS`, `PARTIALLY_LOADED` and `COMPLETED` are
   **unreachable and superseded**. The DB enum is **retained deliberately** so no migration is required;
   physical cleanup is **deferred and recorded here** as future low-priority work.
3. **ActualLoading creation requires the Load List to be `FINALIZED`** (409 otherwise, message keeps the
   `Current status: <status>` shape) — this re-states ADR-028 as the current rule and aligns the backend
   with the actual-loading dialog's `status=FINALIZED` filter.
4. ADR-028's `NOT_STARTED` wording is **stale**: the shipped lifecycle uses `ActualLoadingStatus.DRAFT`
   (`DRAFT → IN_PROGRESS → COMPLETED`, cancel requires a reason). ADR-028 is otherwise current.
5. Unit 1's test pinning `finalize` from `DRAFT` → **409** (and the fixture workaround stamping
   `COMPLETED`) is **superseded**: `finalize` from `DRAFT` now returns **200 / `FINALIZED`**, and the
   rewritten assertion cites this ADR.

**Consequences.** Previously-dead behavior becomes reachable through the existing, unchanged UI: the
load-lists page's finalize button works end-to-end and the actual-loading dialog can offer the list it
was always designed to offer. No schema change, no new endpoints, no new permission codes, no changes to
`packages/shared` or `apps/web/src`. These lifecycle semantics must be **confirmed with the employer at
UAT** — this confirmation is **non-blocking**, because the employer workflow (§2.3) specifies no statuses
at all and the decision follows the four already-shipped layers.
```

## New tests (placement justified)

Placement: **`actual-loading.e2e-spec.ts`** owns the chain (per prompt) — it already has
customer/port/yard/voyage/cargo fixtures and the load-list helpers; **C6 lives in
`inspection.e2e-spec.ts`** where it was written (its voyage + fixture reuse). No fixture blocks were
duplicated: the new tests share one `createDoneCargo()`/`createLoadList()` helper inside the new
describe.

| # | required test | where | result |
| --- | --- | --- | --- |
| 1 | finalize from DRAFT with eligible items → 200, FINALIZED (exact UI path) | AL suite `finalize: empty DRAFT → 400; DRAFT with eligible items → 200 and FINALIZED` (+ same rule in rewritten C6) | green |
| 2 | AL creation gate FINALIZED → 201; DRAFT → 409 **with shipped message**; CANCELLED → 409 | AL suite `ActualLoading create gate: …` (message asserts `only be created for FINALIZED Load Lists` + `Current status: DRAFT` / `Current status: CANCELLED`) | green |
| 3 | **full chain via API, NO status stamping**: create LL → item → finalize → create AL → start → complete | AL suite `full chain via the API with NO status stamping: …` (also asserts LL stays FINALIZED, AL COMPLETED, cargo `loadingStatus === 'LOADED'` per ADR-028) | green |
| 4 | preserved negatives: finalize empty → 400; finalize ineligible item → 409; finalize from CANCELLED → 409; illegal AL transitions → 409 | first three: AL suite `preserved negatives: …` (empty-400 also in C6/it1); AL transitions → **existing** `lifecycle`/`complete from DRAFT`/cancel tests, unchanged and green (no duplication) | green |

## Tests (verification steps 2–3)

Solo (final code): **actual-loading 14/14** (10 + 4 new), **inspection 27/27** (C6 green under its
new rule), bill 13/13, discharge 21/21, manifest 13/13, delivery-release 10/10.

Per-suite, baseline vs run 1 (others unchanged):

| suite | before (P/F/T) | after (P/F/T) |
| --- | --- | --- |
| actual-loading | 10 / 0 / 10 | **14 / 0 / 14** |
| inspection | 27 / 0 / 27 (C6 old rule) | **27 / 0 / 27** (C6 rewritten, same count) |
| all 20 other suites | 316 / 0 / 316 | 316 / 0 / 316 |

### Three consecutive full runs — byte-identical (step 3, headline)

```
run 1: Test Suites: 22 passed, 22 total
       Tests:       357 passed, 357 total
run 2: Test Suites: 22 passed, 22 total
       Tests:       357 passed, 357 total
run 3: Test Suites: 22 passed, 22 total
       Tests:       357 passed, 357 total
```

Per-suite counts identical across all three (verified programmatically). Reconciliation:
353 + 4 new tests = 357; 0 failed.

## Validation steps (4–7)

- `npx tsc --noEmit -p apps/api/tsconfig.json` → **0 errors** (after every change; final state 0).
- `npx tsc --noEmit -p apps/web/tsconfig.json` → **exactly the 3 pre-existing** errors in
  `apps/web/src/app/[locale]/page.tsx` (home.services/capabilities/coverage).
- `pnpm --filter @shipping/shared build` → **0 errors**.
- `npx prisma migrate status` → **32 migrations found, Database schema is up to date!**
- `prisma migrate diff --from-migrations … --to-schema-datamodel …` vs scratch shadow DB →
  exit 0, **"No difference detected."** (scratch DB dropped afterwards).
- Servers after: API **200**, WEB **200** (both 200 before; never restarted).
- `git status --porcelain` vs fc38291 (0 lines): 2 production services + 6 test files +
  `docs/decisions.md` + **this log file**. **No file under `apps/web/src` or `packages/shared` is in
  the list** (asserted — this unit changed neither layer).

## UI gate (protocol §3.1) — **FAIL** (driven and observed; evidence below)

Live-data counts (Prisma): **before = 5 LoadLists all DRAFT, 4 ActualLoading all DRAFT** (matches the
stated baseline; each seed list has 1–2 items). Fixture created for the gate: cargo
`CRG-2610-00113` (inspection → DONE), list `LL-2610-00001` (DRAFT, 1 item) on `VOY-2609-00001`.

**What was driven and what happened:**

1. **`/en/load-lists` — finalize a DRAFT list → FAILED (shipped bug).** The row's Finalize button
   opened the correct confirm dialog ("Finalize LL-2610-00001? This will re-validate all cargo
   eligibility…"), and clicking it issued
   `POST /api/v1/load-lists/${confirmingFinalize.id}/finalize` — the **literal, uninterpolated
   template** (fetch log captured verbatim) → **404 `Load List not found`**
   (`path: "/api/v1/load-lists/$%7BconfirmingFinalize.id%7D/finalize"`). Root cause: single-quoted
   "template" strings — `load-lists/page.tsx:357` (also dead: **:291** add-item, **:318** bulk-add,
   **:342** delete-item, **:344** detail refresh, **:383** cancel). The row stayed `Draft`; no
   console errors (the failure is a caught form error). **Fixing this requires editing
   `apps/web/src`, which this unit's rules forbid → recorded, not done (BLOCKED trigger).**
2. Fixture finalized via **API** (documented setup step) → row then showed **`Finalized`** (green
   badge), screenshot `…/workspace/20260901_053356_09ccd927/p3u2-gate-loadlists-finalized.png`
   (vision-verified: Load Lists page, LL-2610-00001 first row, "Finalized", no error banners).
3. **`/en/actual-loading` — dialog offered the FINALIZED list → create → start → COMPLETE:**
   - create dialog `<select>` listed exactly `LL-2610-00001 — VOY-2609-00001 — MV Horizon` (the
     `status=FINALIZED` filter now finds it) → **Create actual loading → 201**, row
     `AL-2610-00001` (state "Not started" = the UI's label for `DRAFT`).
   - **Start** confirm → **"In progress"**, zero console errors.
   - **Complete** initially → **400 `Cannot complete an Actual Loading with no items`** — the
     shipped `create()` does **not** copy Load List items into the Actual Loading (all 4 seed ALs
     also have 0 items), and the UI's quantity editor only renders `detail.items`, so no UI path
     exists to create the first item (**product gap #2**). After upserting the item via the same
     `PATCH /actual-loading/:id/items/:loadListItemId` endpoint the UI's Save uses (API-level,
     documented), **Complete via the UI → row "Completed"** with quantity recorded,
     zero console errors: screenshot
     `…/workspace/20260901_053356_09ccd927/p3u2-gate-al-completed.png` (vision-verified:
     AL-2610-00001 "Completed" green badge, no error banners).
4. **Counts after gate: 6 LoadLists (5 DRAFT + my 1 FINALIZED), 5 ActualLoading (4 DRAFT + my 1
   COMPLETED). My rows were then CLEANED UP** (AL item, AL, LL item, LL, inspection, yard
   inventory, cargo — all by id): **restored to exactly 5 LoadLists all DRAFT / 4 ActualLoading all
   DRAFT**; all 5 seed rows intact. **Statement: the rows I created were cleaned up; demo data
   left at baseline.**
5. Console-error collectors were installed on every page before acting: **0 console errors /
   0 unhandled rejections / 0 error banners** across the whole gate run.

**Verdict: `UI_GATE: FAIL`** — the required load-lists finalize action cannot be driven (dead
single-quoted template URLs in `apps/web/src`, forbidden layer), and the required complete action
cannot be driven from a fresh Actual Loading (no items ever exist for the UI editor). Everything
else the gate asked to observe WAS observed and evidenced.

## Unresolved issues

1. **`apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:291, :318, :342, :344, :357, :383` —
   single-quoted strings containing `${…}` never interpolate.** The page's add-item, bulk-add,
   delete-item, detail-refresh, **finalize** and cancel actions all call literal URLs
   (`/load-lists/${…}/…`) → 404 every time. **Product gap** (pre-existing; the finalize path is
   exactly the gate's path). Not fixed here: the unit forbids touching `apps/web/src` and mandates
   STOP when a web change turns out to be required. One-char-class fix per line (quote → backtick),
   awaiting authorization.
2. **ActualLoading creation never copies Load List items, and the UI cannot create the first
   item** — `actual-loading.service.ts` `create()` only reads `items` for the empty-check;
   `complete()` then 400s with `Cannot complete an Actual Loading with no items`
   (`actual-loading.service.ts`, complete()'s emptiness guard); the UI's detail editor maps only
   `detail.items` (`actual-loading/page.tsx:210,683`) and nothing produces the first row (seed ALs
   are all 0-item too). The API-level upsert `PATCH …/items/:loadListItemId` works (used by the
   passing E2E chain test). **Product gap** — needs a decision: copy items on create? expose an
   add-row action? allow empty completes? Not improvised here (§5).

## Known deviations

1. **9 trailing fixture `finalize` calls removed** (mapping table above) — superseded by ADR-041;
   finalize-200 coverage relocated to rewritten C6 + new it1 (DRAFT path, stronger). One
   afterAll cleanup line in the AL suite generalized from `cargoApprovedId` to `createdCargos`
   (also stops the pre-existing `cargo2` leak).
2. **C6 restructured beyond the finalize call**: its old first assertion (DRAFT → 409) became
   DRAFT+empty → **400**, because with the new edge the unchanged emptiness rule is what now fires
   first — keeping a 409 there would have asserted a behavior ADR-041 removed. Cited to ADR-041 in
   the test comment (per instruction) and above.
3. **`inspection.e2e-spec.ts`'s `stampLoadListFinalized` helper is now unused** (C6 no longer
   stamps) — renamed and kept per the instruction to rename, not delete the six helpers.
4. Gate fixture setup used API calls (cargo/inspection/list/item) and, for steps 2–3 above, API
   workarounds — each documented inline in the gate section; all fixture rows removed afterwards.
5. Login tokens for the gate are ~15-minute JWTs; one mid-gate refresh was needed (observed as
   401 `Invalid or expired token` on an API probe — not a defect).

## UI gate — recorded verdict field

`UI_GATE: FAIL — evidence: p3u2-gate-loadlists-finalized.png + p3u2-gate-al-completed.png (workspace), fetch log (literal ${…} URL → 404 body), Unresolved issues #1–#2`

## TRANSLATION_CHANGES

none

## Final status

```
EXECUTION_STATUS: BLOCKED
TASK: phase3-unit2-loadlist-lifecycle
PHASE: Phase 3 — Operational Flow Reconciliation (unit 2)
DB_MIGRATION_STATUS: none — no schema or migration changes (migrate status: 32 up to date;
  migrate diff --from-migrations --to-schema-datamodel vs scratch shadow DB: "No difference detected")
UI_GATE: FAIL — load-lists finalize button dead (literal ${...} URLs, load-lists/page.tsx:291/318/342/344/357/383 → 404)
  and fresh ActualLoading cannot reach complete via UI (0 items; product gap). Evidence:
  workspace/p3u2-gate-loadlists-finalized.png, workspace/p3u2-gate-al-completed.png (both vision-verified),
  fetch-log + 404/400 bodies verbatim in this log. AL dialog offer/create/start/complete-were-observed
  (complete after documented API item upsert), 0 console errors. Counts restored to baseline
  (5 LoadLists DRAFT / 4 ActualLoading DRAFT); gate rows cleaned up; demo rows intact.
SCHEMA_CHANGES: none
CODE_CHANGES:
  - load-planning.service.ts — LOAD_LIST_TRANSITIONS: added the missing DRAFT -> FINALIZED edge
    (ADR-041; intermediate entries retained + marked superseded)
  - actual-loading.service.ts — AL creation gate: loadList.status !== 'FINALIZED'
    (message names FINALIZED, keeps `Current status: ${status}` shape)
  - 6 test files — helpers renamed stampLoadListFinalized and stamp FINALIZED
    (actual-loading, bill, delivery-release, discharge, inspection, manifest);
    9 superseded trailing finalize calls removed; C6 rewritten (DRAFT empty 400 / DRAFT+items 200,
    cited to ADR-041); 4 new gate/chain tests in actual-loading.e2e-spec.ts
  - docs/decisions.md — ADR-041 appended (text above)
TEST_CHANGES: baseline 353/353/0 (22/22) -> 3 consecutive runs: 357/357/0, 357/357/0, 357/357/0
  (per-suite identical across the three); new/changed tests: 4 new + C6 rewritten, all green solo
  and in all 3 full runs; C6 before/after: finalize DRAFT 409 -> 400 (empty, unchanged rule) and
  DRAFT+items 409 -> 200, cited to ADR-041
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain diff vs fc38291 (0 lines) = 2 production services + 6 test files +
  docs/decisions.md + this log; apps/web/src + packages/shared = none (asserted)
UNRESOLVED_ISSUES: 2 product gaps — (1) apps/web/src .../load-lists/page.tsx:291,318,342,344,357,383
  single-quoted ${} template strings make add-item/bulk/delete/refresh/finalize/cancel call literal
  URLs (404), blocking the UI gate (web layer forbidden to touch -> BLOCKED trigger); (2) ActualLoading
  create never copies Load List items and the UI has no first-item path, so complete() 400s
  "Cannot complete an Actual Loading with no items" (seed ALs are 0-item too; API PATCH upsert works)
NEEDS_BUSINESS_DECISION: how to close gap 2 (copy items on create vs UI add-row vs allow empty
  completes) — not improvised (§5); ADR-041 employer UAT confirmation is non-blocking
BLOCKED: the UI gate requires a fix in apps/web/src (forbidden by this unit's rules: "do NOT touch
  packages/shared or apps/web/src ... If you conclude packages/shared or apps/web/src must change
  for this to work -> STOP and record") — all other deliverables (edge, gate, helpers, C6, ADR-041,
  4 new tests, 3 identical full runs, typechecks, migrate status/diff, servers, git) are complete
  and verified; recorded and stopped per §5 without asking the user to choose
HANDOFF_TO: decision-maker (Phase 3 unit 2 verification -> authorize the load-lists page URL fix
  and decide gap 2, then Phase 3 unit 3)
```
