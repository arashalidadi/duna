# 2026-10-01 — Phase 3 unit 1: Operational Flow Reconciliation baseline

## Task ID

phase3-unit1-operational-baseline

## Phase

Phase 3 — Operational Flow Reconciliation (unit 1)

## Objective

Restore the deterministic E2E baseline by migrating stale fixtures to the shipped Phase 3A
lifecycle (deterministic component 67 → 0), fix the `Cargo.reference` read-then-write
concurrency defect with a proven atomic allocation, and add the first Phase 3 acceptance test
("Inspection Done gates Load List"). Protocol: `10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.

## Prompt reference

- Roadmap: `docs/current-plan/09-final-implementation-roadmap.md` §3 Phase 3 (align Cargo, Inspection,
  LoadList, ActualLoading, Discharge with target gating/lifecycle), §2.3 "Phase 3A is a transitional
  milestone that still needs reconciliation"; tests "Inspection Done gating, LoadList eligibility";
  acceptance "Inspection Done gates Load List".
- Protocol: `docs/current-plan/10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD `c9dd9b8` (Phase 2 closure) with **clean
  porcelain (0 lines)** at task start → this log's file is the only expected addition.
- Servers are the user's, never restarted: API `:3101` **200 before / 200 after** (health),
  WEB `:3000` **200 before / 200 after**.
- Commands: `pnpm --filter api test -- <spec>` from repo root (never `npx pnpm …`);
  `npx tsc --noEmit -p apps/{api,web}/tsconfig.json`; `pnpm --filter @shipping/shared build`.
- No schema, migration, seed, i18n, config or production-behavior changes beyond the named
  concurrency fixes under §4.

## Baseline before touching anything (verification step 1 — ACCEPTED)

Single full run at clean tree, `pnpm --filter api test -- --json …`:

```
Test Suites: 6 failed, 16 passed, 22 total
Tests:       75 failed, 270 passed, 345 total
```

Decomposition (the prompt's accepted criterion; inspection 8–10 load-dependent):

| suite | failed / total | class |
| --- | --- | --- |
| discharge | 21 / 21 | deterministic |
| bill | 13 / 13 | deterministic |
| manifest | 13 / 13 | deterministic |
| actual-loading | 10 / 10 | deterministic |
| delivery-release | 10 / 10 | deterministic |
| inspection | 8 / 21 | load-dependent band (8 ∈ [8,10]) |
| **deterministic sum** | **67** | expected 67 ✅ |
| failing set | exactly the 6 expected suites ✅ |

Observed 345/**270**/75 vs the prompt's stated 345/269/76: same family, ±1 from the inspection
band sampling (inspection 8 vs 9). Deterministic component 67 exact and failing-set exact →
**baseline accepted, not re-litigated** (per the protocol's decomposition criterion).

## Files changed

Production (8) — each is one bounded `P2002`-retry or lifecycle comment-class fix:

- `apps/api/src/modules/cargo/cargo.service.ts` — **the Cargo.reference fix**: bounded retry-on-P2002
  with re-read inside `create()` (Part B).
- `apps/api/src/modules/inspections/inspection.service.ts` — bounded retry on the
  `Inspection_inspectionNumber_key` race inside `create()` (observed blocking full runs).
- `apps/api/src/modules/actual-loading/actual-loading.service.ts` — same retry for
  `actualLoadingNumber` (observed: discharge:366).
- `apps/api/src/modules/load-planning/load-planning.service.ts` — same retry for `loadListNumber`
  (observed: bill:226).
- `apps/api/src/modules/invoice/invoice.service.ts` — same retry for `invoiceNumber`
  (observed: voucher `mkInvoice`, proforma convert).
- `apps/api/src/modules/bill/bill.service.ts` — same retry for `billNumber` (observed: bill:628).
- `apps/api/src/modules/manifest/manifest.service.ts` — same retry for `manifestNumber`
  (preemptive: 4 suites create manifests in parallel; same defect class fired once per run).
- `apps/api/src/modules/voucher/voucher.service.ts` — same retry for `voucherNumber`
  (preemptive: voucher + delivery-release both create vouchers).

Tests (8): `inspection`, `actual-loading`, `bill`, `discharge`, `manifest`, `delivery-release`,
`cargo-inventory`, `auth` `.e2e-spec.ts` (fixture migration + new tests; details below).

## Database changes

none — no schema or migration changes (§4 stop-condition checked and not triggered; all fixture
intermediate states are stamped by the tests themselves via direct Prisma, the repo's existing
portal/party-cutover fixture pattern).

## Migrations

none. Migrate status before/after: unchanged, 31/31 up to date (not re-run — no schema work).

## Part A — stale fixture migration (before → after assertion mapping)

### Endpoint migration

| original call sites (prompt's line refs) | shipped replacement | shipped rule |
| --- | --- | --- |
| 19 × `POST /inspections/:id/approve` — actual-loading:168,518; bill:215,284; delivery-release:147; discharge:201,270,315,680; inspection:246,262,301,412,438,503,507,525,556; manifest:210 | `POST /inspections/:id/book` **then** `POST /inspections/:id/done` | `done()` runs `assertTransition(status,'DONE')`; PENDING cannot go straight to DONE — `PENDING→BOOKED→DONE` (`inspection.service.ts:18-29`; done() `:290-324`). `/done` = `inspection:approve`, `/book` = `inspection:update`. |
| 7 × `POST /inspections/:id/reject` — inspection:250,305,467,473,511,529,545 | `POST /inspections/:id/fail` (+ required `rejectionReason`) | `fail()` sets `FAILED`, rejects without reason (400) — `inspection.service.ts` fail()/`:405` transition table. |

### Status-value migration (Part A2 table)

| assertion (original) | before | after | justification (shipped rule) |
| --- | --- | --- | --- |
| inspection:441 | `status = 'APPROVED'` | `'DONE'` | `done()` is the terminal success state; `TRANSITIONS` has no APPROVED (`inspection.service.ts:18-29`). |
| inspection:448,565 | `cargo.inspectionStatus = 'APPROVED'` | `'DONE'` | `done()` writes `cargo.inspectionStatus='DONE'` (post-edit `:311`; prompt ref `:265-296`) — the authoritative load-list gate. |
| inspection:572 | history `[0].status 'APPROVED'` | `'DONE'` | newest inspection in the chain completed via `/done`. |
| inspection:477 | `status = 'REJECTED'` | `'FAILED'` | `fail()` sets FAILED; no REJECTED state exists. |
| inspection:485 | `cargo.inspectionStatus = 'REJECTED'` | `'FAILED'` | `fail()` writes cargo FAILED. |
| inspection:573 | history `[1].status 'REJECTED'` | `'FAILED'` | first inspection failed via `/fail`. |
| inspection:453 | cargo `PATCH {status:'READY'}` → 200 | `{status:'READY_FOR_LOADING'}` → 200 + response assert | `CargoStatus` has no READY; `AT_YARD→READY_FOR_LOADING` requires `inspectionStatus==='DONE'` (`cargo.service.ts` gate, message `:294`). |
| inspection:491 (+fixture) | `{status:'READY'}` → 409 (cargo REGISTERED, no yard) | yard-inventory first (AT_YARD) then `{status:'READY_FOR_LOADING'}` → 409 **+ message assert `inspection status is DONE`** | strengthened: reaches the inspection gate (`cargo.service.ts:290-294`) instead of an incidental transition rejection; encodes the roadmap's inspection-gating intent. |
| actual-loading:366 | `created.status = 'NOT_STARTED'` | `'DRAFT'` (+ titles/comments at :359,:447,:453,:509,:582,:606,:607) | `ActualLoadingStatus @default(DRAFT)` (`schema.prisma`, ActualLoading model `:941`); NOT_STARTED no longer exists for ActualLoading. |
| load-list finalize fixtures (10 sites: actual-loading×2, discharge×4, bill×2, manifest, delivery-release) | `POST /load-lists/:id/finalize` straight from DRAFT → 200 | `stampLoadListCompleted()` → (AL create) → `finalize` → 200 (9 sites); actual-loading beforeAll: stamp only (see deviations) | `LOAD_LIST_TRANSITIONS` DRAFT→[`IN_PROGRESS`,`CANCELLED`] (`load-planning.service.ts:29-33`, checked at finalize `:758-766`) and `ActualLoading.create` requires a COMPLETED list (`actual-loading.service.ts:240-244`). |
| inspection C2 (new Part C, re-derived on discovery) | — | asserts inspection `BOOKED` **and** cargo readiness `PENDING` | `book()` transitions only the inspection (`inspection.service.ts` book/`:243-267`); only done/fail/needs-re-inspection write cargo readiness. |

Titles/comments using the old vocabulary were reworded where they accompanied a changed
assertion; **no assertion was deleted, loosened, or converted into a comment**. The single
removed fixture call (actual-loading beforeAll finalize-200) is compensated by the new C6 test
which asserts finalize behavior directly (DRAFT→409, COMPLETED→200) — coverage net-increases.

The three prompt-named stale assertions (inspection:448, :485, :565) plus five more discovered by
grep (:441, :477, :572, :573, cargo `READY` ×2, AL `NOT_STARTED` ×1) are all covered in the table.

## Part B — Cargo.reference concurrency defect

Evidence confirmed as stated: `schema.prisma` `Cargo.reference @unique`; old `create()` did
`generateReference()` (read max, `cargo.service.ts:385-403`) then `cargo.create` — read-then-write;
`P2002 → 409` via the shared filter.

**Chosen mechanism: bounded retry-on-P2002 with re-read** (attempts ≤ 10), applied inside
`cargo.create()` around the allocation+insert:

- *Why not `SELECT … FOR UPDATE` on the current max*: in a fresh month there is no row to lock
  (the race is exactly "no row yet"), and range/prefix locking would serialize unrelated work.
- *Why not an advisory-lock sequence*: changes allocation semantics and touches the schema/SQL
  surface the task forbids.
- *Why retry is exact here*: on P2002 the winner's row is committed, so the re-read returns the
  advanced max and the retry allocates max+1 under the same rules; `generateReference()` has no
  `deletedAt` filter (soft-deleted rows keep their numbers — comment inside `:385-403`), and the
  `CRG-YYMM-#####` format and "highest existing + 1" semantics are untouched (format still asserted
  by `cargo-inventory.e2e-spec.ts` `^CRG-\d{4}-\d{5}$`).

**Concurrency proof (new tests in `cargo-inventory.e2e-spec.ts`, green solo and in all 3 full runs):**

1. `allocates strictly distinct references under concurrent creates` — N=8 parallel
   `POST /cargo` → **8×201**, all match `CRG-\d{4}-\d{5}`, `Set(refs).size === 8` (strictly
   distinct). A serial green run does not prove this; the parallel one does.
2. `soft-deleted highest sequence is never reused (monotonic, same month)` — create A
   (`seq=n`) → `DELETE /cargo/:A` (soft) → create B → same `YYMM`, `seq(B) > n`.

**Repo-wide grep for the same pattern (recorded; only blockers fixed):**

| service / number | creators in parallel suites | outcome |
| --- | --- | --- |
| `Cargo.reference` | many | **fixed** (mandated by Part B) |
| `Inspection.inspectionNumber` | 6 suites | **fixed** — observed blocking (bill:213, discharge:291, inspection:567 in full runs) |
| `ActualLoading.actualLoadingNumber` | ~6 suites | **fixed** — observed (discharge:366) |
| `LoadList.loadListNumber` | 6 suites | **fixed** — observed (bill:226) |
| `Invoice.invoiceNumber` | 3 suites (delivery, invoice, voucher) | **fixed** — observed (voucher `mkInvoice`:106, proforma:222) |
| `BillOfLading.billNumber` | 2 suites (bill, delivery) | **fixed** — observed (bill:628) |
| `Manifest.manifestNumber` | 4 suites (bill, delivery, manifest, party-cutover) | **fixed preemptively** under the same prompt clause — this defect class fired ~once per full run and blocks the mandated 3 consecutive clean runs |
| `Voucher.voucherNumber` (find-then-insert in `nextNumber()`) | 2 suites (voucher, delivery) | **fixed preemptively** — same justification |
| Voyage numbers | 8 suites | **no change needed** — allocated via `NumberingService.nextSequence` with `SELECT … FOR UPDATE` (already atomic) |
| discharge / proforma / quotation / salary / letter / job / BRK / D-O numbers | single creator each | **not fixed** — no cross-suite exposure; recorded here |

Every retry discriminates on the Prisma P2002 `meta.target` (only the number key retries), so all
other 409/400 semantics (one-pending-inspection, duplicate-per-manifest, P2003→400, …) are
bit-for-bit unchanged.

## Part C — first Phase 3 acceptance test: Inspection Done gates Load List

**Placement: `inspection.e2e-spec.ts`** (justification: it already owns customer/port/yard/cargo
fixtures and `createCargo()`; a new load-planning suite would duplicate that setup — the prompt
forbids duplicate setup blocks). Only vessel + voyage + 2nd port were added to its `beforeAll`
(voyage requires two distinct port rows — the voyage service counts origin/destination lookups),
plus a `stampLoadListCompleted` helper and `createdVessels/createdVoyages/createdLoadLists`
cleanup. Routes/DTOs were read from `load-planning.controller.ts` (not guessed).

Six tests, all green solo and in all 3 full runs (this is the roadmap acceptance):

- **C1** PENDING cargo: absent from `GET /load-lists/eligible-cargo` (eligible-only default) and
  `POST /load-lists/:id/items` → **409** `has inspection status PENDING` (gate at
  `load-planning.service.ts:553-555`, prompt ref :536).
- **C2** inspection `BOOKED` (asserted via GET): still not eligible; addItem → **409**; also pins
  the shipped split — cargo readiness stays `PENDING` while the inspection is BOOKED.
- **C3** after `/book`+`/done`: `cargo.inspectionStatus === 'DONE'` (the source of truth), cargo
  appears in the eligible list (gate `:378`, prompt ref :361), and addItem → **201**.
- **C4** FAILED cargo: not eligible, addItem → **409** `has inspection status FAILED`.
- **C5** inspection `NEEDS_REINSPECTION` (asserted via GET): not eligible (cargo readiness reset
  to `PENDING` by `needsReInspection()`), addItem → **409**.
- **C6** finalize shipped transitions: DRAFT → finalize → **409** (`:758-766` + map `:29-33`);
  after stamping COMPLETED with one DONE item → finalize → **200** → detail status `FINALIZED`.

## Tests (verification steps 2–5)

Per-suite, before (accepted baseline full run) vs after (solo run, final code):

| suite | before P/F/T | after solo P/F/T |
| --- | --- | --- |
| inspection | 13 / 8 / 21 | **27 / 0 / 27** (+6 Part C) |
| actual-loading | 0 / 10 / 10 | **10 / 0 / 10** |
| bill | 0 / 13 / 13 | **13 / 0 / 13** |
| manifest | 0 / 13 / 13 | **13 / 0 / 13** |
| delivery-release | 0 / 10 / 10 | **10 / 0 / 10** |
| discharge | 0 / 21 / 21 | **21 / 0 / 21** |
| cargo-inventory | 29 / 0 / 29 | **31 / 0 / 31** (+2 Part B) |

All 7 suites green solo (step 2 ✅). The other 15 suites untouched and green in all full runs.

### Three consecutive full runs — byte-identical (step 3, the headline check)

```
run 1: Test Suites: 22 passed, 22 total
       Tests:       353 passed, 353 total
run 2: Test Suites: 22 passed, 22 total
       Tests:       353 passed, 353 total
run 3: Test Suites: 22 passed, 22 total
       Tests:       353 passed, 353 total
```

Per-suite counts across the three runs are also **identical** (verified programmatically from the
three `--json` outputs). Totals reconcile: 345 + 6 (Part C) + 2 (Part B) = 353; every other suite
unchanged (app 5, auth 19, invoice 11, job 14, letter 15, master-data 26, party-cutover 5,
party-masters 37, portal 14, proforma 9, quotation 11, salary 9, vessel 15, voucher 13,
voyage 25).

### Stabilization findings (each fixed before the official triplet)

Full runs initially exposed the number-allocation race class ~once per run (table in Part B) plus
three test-side issues, all fixed without weakening assertions:

1. auth `lists roles with user counts` (×2 runs): parallel suites transiently mint fixture roles,
   pushing `OPERATIONS` past page 1 of `GET /roles?pageSize=100`. Fixed by walking the same
   paginated list until exhausted — the ADMIN/OPERATIONS assertions are unchanged.
2. discharge `discharges partially (7 of 10)` :639: the `.find` for "the other completed loading"
   scanned the **global** ActualLoading list and grabbed a concurrently-created loading from the
   actual-loading suite (quantity 10), which then cascaded to the `mirror test` 404. Fixed by
   scoping the find to this suite's `createdLoadListIds`; the `expectedQuantity 7` assertion is
   unchanged. (Both failures only ever appeared in full runs; solo was always 21/21.)
3. inspection Part C beforeAll 404 on voyage create: same-port origin+destination fails the voyage
   service's port-existence count — fixture now creates a second port.

## Validation steps (6–8)

- `npx tsc --noEmit -p apps/api/tsconfig.json` → **0 errors** (final state).
- `npx tsc --noEmit -p apps/web/tsconfig.json` → **exactly the 3 pre-existing errors** in
  `apps/web/src/app/[locale]/page.tsx` (`home.services` / `home.capabilities` / `home.coverage`).
- `pnpm --filter @shipping/shared build` → **0 errors**.
- Servers after: API `:3101` **200**, WEB `:3000` **200** (both were 200 before; never restarted).
- `git status --porcelain` vs clean baseline (0 lines): **16 modified files** (8 production +
  8 test, exactly the lists above) **+ this log file** — no other changes.

## Unresolved issues

1. **PRODUCT GAP — LoadList has no shipped driver out of DRAFT.** `LOAD_LIST_TRANSITIONS`
   (`apps/api/src/modules/load-planning/load-planning.service.ts:29-33`) maps
   `DRAFT → IN_PROGRESS | CANCELLED` (and on to COMPLETED), but the only writers of LoadList
   status in the entire codebase are `finalize()` (`:758-766` → FINALIZED) and `cancel()`
   (→ CANCELLED) — nothing sets `IN_PROGRESS`/`PARTIALLY_LOADED`/`COMPLETED`. Meanwhile
   `ActualLoading.create` requires the list to be `COMPLETED`
   (`apps/api/src/modules/actual-loading/actual-loading.service.ts:240-244`) and `finalize`
   requires `COMPLETED → FINALIZED`. So via the API a load list can never leave DRAFT, never be
   finalized, and actual loading can never be created. This unit did **not** invent a driver
   (business rule; out of scope). Impact handled: e2e fixtures stamp the intermediate
   `COMPLETED` state directly (direct-Prisma fixture pattern, consistent with portal/party-cutover
   precedents), C6 pins the shipped finalize transitions, and 9 fixture finalize calls still
   exercise the API path from COMPLETED. Fix scope for a later unit: design the advance flow
   (manual start endpoint? ActualLoading-driven? — needs decision against employer evidence).

## Known deviations

1. **Bounded-retry applied to 7 services beyond Cargo** (inspection, actual-loading, load-planning,
   invoice, bill, manifest, voucher) — the prompt allows fixing instances that are themselves
   blocking the baseline; five were observed failing full runs, manifest/voucher were fixed
   preemptively under the same clause because this class fired ~once per run and the mandated
   3-consecutive-clean-runs could not otherwise be reached. Voyage numbers needed no fix (already
   `FOR UPDATE`); single-suite number spaces were left as-is.
2. **Fixture finalize calls reordered/stamped** per shipped rules (table in Part A); one
   finalize-200 call removed from actual-loading's beforeAll, compensated by new C6 coverage.
3. **C2 re-derived on discovery**: `book()` does not propagate BOOKED to cargo readiness — both
   shipped fields asserted instead of the assumed single one.
4. **auth + discharge test maintenance** (pagination walk; fixture-scoped `.find`) — same
   assertions, made deterministic under full parallel load.
5. **Inspection suite gained fixtures** (vessel, voyage, 2nd port) for Part C — cleaned up in
   `afterAll` like the existing ones.
6. Baseline observed **345/270/75** (inspection 8) rather than the prompt's 345/269/76
   (inspection 9) — same accepted family per the decomposition criterion (det 67 exact, set exact).
7. Stale titles left alone where no assertion changed (e.g. discharge test titles saying
   "NOT_STARTED actual loading" — the assertions there concern the discharge entity, whose
   `NOT_STARTED` status still exists and passes).

## UI gate (protocol §3.1)

**NOT APPLICABLE** — backend/test-only unit: no user-visible component, route shape, translation
key, or API contract for the web client changed (only internal allocation retries and test files).

## TRANSLATION_CHANGES

none

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase3-unit1-operational-baseline
PHASE: Phase 3 — Operational Flow Reconciliation (unit 1)
DB_MIGRATION_STATUS: none — no schema or migration changes
UI_GATE: NOT APPLICABLE — backend/test-only unit, no user-visible component changed
SCHEMA_CHANGES: none
CODE_CHANGES:
  - apps/api/src/modules/cargo/cargo.service.ts — Cargo.reference atomic allocation:
    bounded retry-on-P2002 with re-read preserving CRG-YYMM-##### format, highest+1 semantics
    and soft-delete retention (Part B fix)
  - apps/api/src/modules/{inspections,actual-loading,load-planning,invoice,bill,manifest,voucher}/
    *.service.ts — same bounded retry for their auto-numbers (blocking/preemptive, table above)
  - apps/api/test/inspection.e2e-spec.ts — Part A fixture migration + 6 new Part C acceptance tests
  - apps/api/test/cargo-inventory.e2e-spec.ts — 2 new Part B concurrency proofs
  - apps/api/test/{actual-loading,bill,discharge,manifest,delivery-release}.e2e-spec.ts —
    Part A fixture migration (approve/reject chains, status vocabulary, finalize ordering)
  - apps/api/test/auth.e2e-spec.ts — roles list pagination walk (determinism under load)
TEST_CHANGES: baseline 345/270/75 observed (prompt family 345/269/76; deterministic 67) ->
  3 consecutive runs: 353/353/0, 353/353/0, 353/353/0 (22/22 suites each, per-suite identical);
  deterministic component: 67 -> 0; failing set: 6 suites -> EMPTY;
  Part C tests: 6 (C1-C6), all green solo and in all 3 full runs;
  Part B tests: 2, green solo and in all 3 full runs
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain vs baseline (0 lines at HEAD c9dd9b8) = 16 modified files
  (8 production services + 8 test files, all named in Files changed) + this log file
UNRESOLVED_ISSUES: 1 product gap — LoadList has no shipped DRAFT->IN_PROGRESS->COMPLETED driver
  (load-planning.service.ts:29-33 + :758-766 are the only status writers; ActualLoading.create
  requires COMPLETED at actual-loading.service.ts:240-244 => circular, unreachable via API).
  Not fixed here (business rule invention is out of scope); fixtures stamp COMPLETED directly
  and C6 pins the shipped finalize transitions. Needs design vs employer evidence in a later unit.
NEEDS_BUSINESS_DECISION: none required to complete this unit — the LoadList advance-flow design
  question is recorded under UNRESOLVED ISSUES for the Phase 3 decision-maker
BLOCKED: none
HANDOFF_TO: decision-maker (Phase 3 unit 1 verification → Phase 3 unit 2)
```
