# 2026-10-02 — Phase 3 unit 3: not-loaded cargo returns to yard (acceptance + eligibility + §2.3 evidence)

## Task ID

phase3-unit3-not-loaded-to-yard

## Phase

Phase 3 — Operational Flow Reconciliation (unit 3)

## Objective

Deliver the last operational acceptance criterion of Phase 3 — "Not-loaded cargo returns to yard"
— as API-level tests across all four result states, assert ADR-028 re-planning eligibility,
perform the §2.3 step-7 evidence pass (no removal implemented), and close two housekeeping items
(ADR order, UI coverage note).

## Prompt reference

- Roadmap: `docs/current-plan/09-final-implementation-roadmap.md` §3 Phase 3 — Scope "LoadList
  eligibility and not-loaded return to yard"; Data change "Yard inventory return behavior"; Tests
  "Not-loaded return to yard"; Acceptance "Not-loaded cargo returns to yard".
- Protocol: `docs/current-plan/10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.
- Employer evidence: `docs/current-plan/03-final-workflows.md` §2.3/§2.4; ADR-020/028/039/041.

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD `eaf6dbd`, **clean porcelain (0 lines)** at start.
- Servers are the user's, never restarted: API `:3101` **200 before / 200 after**, WEB `:3000`
  **200 before / 200 after**.
- Tests: `pnpm --filter api test -- <spec>` from repo root (never `npx pnpm …`).

## Baseline before touching anything (verification step 1 — ACCEPTED)

First run at eaf6dbd, `pnpm --filter api test -- --json …`:

```
Test Suites: 22 passed, 22 total
Tests:       362 passed, 362 total
```

Matches the stated baseline exactly (362/362/0, 22/22, tree clean).

## Part 1 — four result states after complete() (acceptance tests)

**Placement:** `actual-loading.e2e-spec.ts`, inside the existing
`describe('LoadList lifecycle gates (ADR-041 / ADR-028)')` — the suite already owns the cargo →
inspection DONE → LoadList → finalize → ActualLoading fixtures and the `createDoneCargo` /
`createLoadList` helpers; the new test builds ONE chain with four lines (no duplicated setup
blocks), per the prompt. Inventory presence is asserted **through the public API only**
(`GET /yard-inventory?search=<cargo reference>` + `GET /cargo/:id`), never Prisma, and no
`cargoId` query param is used (ListInventoryQueryDto declares none).

One test: `ADR-028 four result states after complete: only FULL leaves the yard (public-API
inventory checks)` — 4 DONE cargos, each with a live yard-inventory row, one 4-line Load List
(planned 10 each), finalize → create AL → record [10 | 3 | 0 | untouched] → start → complete.

### Four-state result table (observed through the API; all assertions green)

| line | recorded q (planned 10) | AL line result after complete | cargo `loadingStatus` after complete | yard-inventory row after complete (API) |
| --- | --- | --- | --- | --- |
| FULL | 10 (≥ planned) | `FULL` | **`LOADED`** | **absent** — `GET …/yard-inventory?search=<ref>` → 0 rows (row deleted by `complete()`, actual-loading.service.ts:737-741) |
| PARTIAL | 3 (0 < q < planned) | `PARTIAL` | `NOT_LOADED` (unchanged) | **present** — 1 row, `cargo.id` matches |
| NOT_LOADED (explicit 0) | 0 | `NOT_LOADED` | `NOT_LOADED` (unchanged) | **present** — 1 row |
| never recorded (null) | — (materialized `actualQuantity: null`) | `NOT_LOADED` | `NOT_LOADED` (unchanged) | **present** — 1 row |

This is the roadmap acceptance: **only FULL cargo leaves the yard; not-loaded (any non-FULL
state) stays in Yard Inventory** — ADR-028 "cargo leaves the yard only on FULL completion".

**Observed API response that shaped the test (and is recorded here):**
`GET /yard-inventory/:id` returns **500** for *every* id — including present, valid rows:
`Invalid this.prisma.yardInventory.findUnique() invocation …`. Root cause:
`yard-inventory.service.ts` `findById()` passes the module-level `select` const
(`satisfies Prisma.YardInventorySelect`, service:12-30) as **`include:`** to `findUnique` — a
Select payload is not a valid Include. Nothing covers this route (no test, no web caller).
Per the prompt's explicit alternative the tests use `?search=`; the defect is recorded under
UNRESOLVED ISSUES and **not fixed** (outside this unit's authorized changes).

## Part 2 — re-planning eligibility (ADR-028)

ADR-028: "PARTIAL/NOT_LOADED cargo stays in the yard and **remains eligible for later
planning**".

**Shipped code path (cited):**
- `load-planning.service.ts` `getEligibleCargo()` — builds the planning list as: cargo not
  deleted, not cancelled, `inspectionStatus: DONE`, **minus cargo already assigned to THIS
  voyage's active load lists** (`assignedCargoIds` → `where.id = { notIn: … }`, comment
  "Exclude already-assigned cargo from eligible list").
- `checkCargoEligibility()` / `addItem` — same duplicate-assignment rule per voyage
  ("cancelled load lists don't block").

**Test added (asserted, green):** `ADR-028: a NOT_LOADED line's cargo remains eligible for a
later voyage's Load List` — full chain on the suite voyage with the line recorded `0`
(result `NOT_LOADED`, asserted from the completed AL), then `GET
/load-lists/eligible-cargo?voyageId=<a NEW voyage>&search=<cargo ref>` → cargo **present**.
(scoped by `search` because many other DONE cargos exist live and the default page would push
this one past page 1.)

**Live probe evidence (verbatim, temp fixture cleaned up afterwards):**

```
complete -> 200 | line result: NOT_LOADED | cargo loadingStatus: NOT_LOADED
SAME voyage eligible-cargo contains not-loaded cargo: False (rows=0)
OTHER voyage eligible-cargo contains not-loaded cargo: True (rows=1)
```

**Finding / classification:** different-voyage re-planning (the operationally meaningful
"later planning" — cargo stayed in yard for a future voyage) **works and is asserted**.
SAME-voyage re-planning is **excluded** by the assigned-cargo filter / duplicate rule, which
ignores `result`. That reads as an **intentional-looking double-booking guard** (one active
list per cargo per voyage; consistent with ADR-029's one-per-voyage philosophy), while ADR-028's
"eligible for later planning" does not spell out same-voyage re-planning — ambiguous wrt locked
evidence. Per the prompt's decision tree: **NEEDS_BUSINESS_DECISION recorded for that assertion
only; it is left UNASSERTED** (the test performs the same-voyage request with a comment and no
expectation — stated explicitly here: *unasserted*, not failing). No planning rule invented.

## Part 3 — evidence pass: §2.3 step 7 ("removed from Load List and returns to Yard Inventory")

**Evidence read (verbatim):**
- `03-final-workflows.md` **§2.3 Load List, step 7** (line 46): "Not-loaded cargo is removed
  from Load List and returns to Yard Inventory." (step 5: "Load List can be edited and extended
  over time"; step 4: "Load List is printed for operators".)
- `03-final-workflows.md` **§2.4 Actual loading, step 4** (line 54): "Not-loaded cargo returns
  to Yard Inventory." — the same event from the Actual Loading view, with **no removal language**.
- **ADR-020**: current-inventory yard model (remove/revert transactional rules).
- **ADR-028**: "`COMPLETED`/`CANCELLED` are terminal and **immutable** (`update`/`updateItem` →
  409)"; "`0 → NOT_LOADED`, `≥ planned → FULL`, else `PARTIAL`"; "`PARTIAL`/`NOT_LOADED` cargo
  stays in the yard and remains eligible for later planning".
- **ADR-039**: "NOT_LOADED lines are excluded because they never sailed" — lines are kept as
  records, excluded from discharge expectations.
- **ADR-041**: LoadList lifecycle `DRAFT → FINALIZED → (CANCELLED)`; finalize is the terminal
  state; items editable only in DRAFT (shipped `EDITABLE_STATUSES`), i.e. finalized lists
  immutable.

**Assessment:**
1. **"…returns to Yard Inventory" half — SATISFIED and now pinned by Part 1's tests.**
   `complete()` touches only FULL lines (actual-loading.service.ts:737-741); every non-FULL
   line's cargo keeps its inventory row and `loadingStatus` stays `NOT_LOADED`.
2. **"removed from Load List" half — LITERAL CONFLICT with locked design; not implemented.**
   Shipped behavior keeps the line: the `ActualLoadingItem` row persists with
   `result: NOT_LOADED`, the `LoadListItem` persists, and ADR-041 (plus shipped
   `EDITABLE_STATUSES = DRAFT`) makes the finalized list immutable, so post-completion row
   removal is impossible without breaking the locked decision. Shipped code instead achieves
   the *functional* removal: the cargo is excluded from manifest eligibility
   (`actualQuantity > 0`, ADR-042), from discharge (ADR-039), from same-voyage re-planning
   (duplicate guard), and it physically remains in the yard. Whether the employer's "is
   removed from Load List" means row deletion (literal wording) or removal from the effective
   load plan (functionally true, and the §2.4 wording for the same event omits removal) cannot
   be settled from evidence without contradicting either the employer text or ADR-041.

**Per §5: recorded for decision-maker review, the removal item is STOPPED here — no removal
was implemented** (it is also listed as out-of-scope in the prompt). See NEEDS_BUSINESS_DECISION.

## Part 4 — housekeeping

**4.1 ADR order fixed.** `docs/decisions.md` ran `040 → 042 (line 560) → 041 (603)` (unit-2b's
append anchored on ADR-040's Consequences paragraph, which at the time sat before 041). Reorder
applied — content unchanged:

```
before: 544 ADR-040 | 560 ADR-042 | 603 ADR-041
after:  544 ADR-040 | 560 ADR-041 | 602 ADR-042
```

Integrity check: non-empty line multiset HEAD-vs-new **473 = 473, equal** (only 3 blank
separator lines normalized at the seams); unique phrases of both ADRs and ADR-040 all present.

**4.2 Phase 3 UI coverage note (read-only; no UI changes):**

| surface | state in apps/web/src (+ shared) |
| --- | --- |
| **LoadList status UI** | **Present and 3-state aligned**: `load-lists/page.tsx` `STATUSES = ['DRAFT','FINALIZED','CANCELLED']`, status filter, badge meta for all three, Finalize/Cancel row actions, `load_list:finalize` permission gate. |
| **ActualLoading status UI** | **Present**: `actual-loading/page.tsx` status filter + badge meta (labels "Not started / In progress / Completed…" — "Not started" is the stale ADR-028 `NOT_STARTED` wording already flagged in ADR-041 for backend; label-level only). Create dialog, item quantity editor, start/complete/cancel flows all live (proven in unit 2b's gate). |
| **Inspection status UI** | **Exists but STALE — the Phase 3 UI item**: `inspections/page.tsx:41` ships `STATUSES: InspectionStatus = ['PENDING','APPROVED','REJECTED']` with matching `STATUS_META` — the pre-Phase-3A vocabulary. `STATUS_META[row.status]` has no entry for shipped `BOOKED/DONE/FAILED/NEEDS_REINSPECTION`, so status badges/filter mis-handle real rows. Root: `packages/shared/src/cargo.ts:27` exports `InspectionStatus = 'PENDING' \| 'APPROVED' \| 'REJECTED'` (also cited by `inspection.ts`) — shared itself is stale vs the shipped Prisma enum (`schema.prisma:754`). **Both belong to the later Phase 3 UI unit; forbidden in this unit** (no web/shared changes) — recorded to scope it. |
| **Comment handling** | No comment/visibility feature anywhere (matches "unbuilt"). Only `cargo/page.tsx` has a plain `Comments` textarea bound to the existing `cargo.comments` field on the cargo edit form — field-level display/edit of an existing string, not the employer comment feature. |

## Files changed

- `apps/api/test/actual-loading.e2e-spec.ts` — the 2 new acceptance tests (Part 1 four-state
  chain + Part 2 eligibility; same-voyage probe deliberately unasserted with comment).
- `docs/decisions.md` — Part 4.1 reorder only (content unchanged).

## Database changes

none — no schema or migration changes (§4 stop-check: tests are API-level; no production code
changed in this unit at all).

## Migrations

none. `npx prisma migrate status` → **32 migrations found … Database schema is up to date!**

`migrate diff --from-migrations --to-schema-datamodel` vs a scratch shadow DB
(`scratch/p3u3-shadow-diff.sh`, created/dropped around the run):

```
diff exit code: 0
No difference detected.
```

## Tests

- **New: 2** (both in `actual-loading.e2e-spec.ts`, gates describe):
  1. four-state result table (Part 1) — 15+ assertions over line results, cargo loadingStatus,
     and inventory presence via `?search=`; **green**
  2. ADR-028 later-voyage eligibility — line `NOT_LOADED` asserted, eligible-cargo contains the
     cargo; same-voyage probe unasserted (NBD); **green**
- Per-suite: **actual-loading 17 → 19** (0 failed); every other suite byte-identical to
  baseline (verified: only `actual-loading` differs).
- Solo: actual-loading **19/19** (after the `?search=`/scoping fixes), repeatedly green.

### Three consecutive full runs — byte-identical (step 3, headline)

```
run A1: Test Suites: 22 passed, 22 total
        Tests:       364 passed, 364 total
run A2: Test Suites: 22 passed, 22 total
        Tests:       364 passed, 364 total
run A3: Test Suites: 22 passed, 22 total
        Tests:       364 passed, 364 total
```

Per-suite counts identical across A1/A2/A3 (verified programmatically).
Reconciliation: 362 + 2 new = 364; 0 failed.

**Honest record of the first attempt:** runs r1/r2 were 364/364/0, but **r3 failed 9/14 in
`job.e2e-spec.ts`** (untouched by this unit): `POST /jobs → 400` at job.e2e:123 (create test,
cascading). The job suite runs **14/14 solo green** immediately after and stayed green across
all three A-runs; no body was captured (supertest status-only) and nothing in this unit's files
touches jobs. Classification: **rare load-dependent flake in a pre-existing suite outside this
unit's scope** — recorded, not chased (out of scope), triplet restarted and met.

## Validation steps (1–7, verbatim)

1. Baseline first run at eaf6dbd → **362/362/0 (22/22)** ✅
2. Touched suites solo green → actual-loading **19/19** ✅
3. Full suite 3 consecutive runs byte-identical → **364/364/0 ×3 (A1/A2/A3), per-suite
   identical** ✅ (first attempt interrupted by the recorded job flake)
4. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
5. `prisma migrate status` → **32, up to date**; `migrate diff` vs scratch DB →
   **"No difference detected."** (scratch dropped) ✅
6. Servers before/after → **API 200, WEB 200** (never restarted) ✅
7. `git status --porcelain` vs eaf6dbd = **2 files + this log** (`apps/api/test/
   actual-loading.e2e-spec.ts`, `docs/decisions.md`); **zero files under `apps/web/src`;
   zero files under `prisma/`** (asserted) ✅

## UI gate (protocol §3.1)

**NOT APPLICABLE — backend/test-only unit, no user-visible component changed.** (Part 4.2 is a
read-only survey; no UI file was modified — asserted under GIT_VERIFICATION.)

## Data-state anomaly observed during this unit (recorded, not restored)

After the unit-3 runs, the **seed row `AL-2609-00001` ("demo loading") is `IN_PROGRESS`**
(`updatedAt 2026-10-02T03:22:04.707Z`) where the stated baseline is 4 DRAFT (unit 2b verified
4 DRAFT live at ~01:50 UTC today). Forensics:
- All 18 `POST /actual-loading/:id/start` call sites across the suites trace to their own
  create-responses; no test references `AL-2609…`; no list-position starts; no production
  writer other than `start()` sets `IN_PROGRESS`; the eligibility probe started only its own AL.
- The mutation falls in a 03:19–03:22 window (AL-suite message-reruns after the baseline run);
  it did **not** recur: an AL-suite solo immediately re-run left `updatedAt` unchanged, and all
  subsequent full runs (r1–r3, A1–A3) are green with `updatedAt` frozen at 03:22:04.
- The window overlaps the decision-maker's own independent-verification activity (their
  delegation message), so a manual/UI action outside this unit's scope is plausible but
  **unattributable from available evidence** (no request logging).
- **Not restored by me**: there is no API path back from `IN_PROGRESS` to `DRAFT` (start is
  one-way, cancel is terminal), and silently rewriting demo data would mask an unexplained
  event. Flagged here for the decision-maker — one direct `UPDATE` restores it if desired.

## Unresolved issues

1. **`GET /yard-inventory/:id` → 500 for every id** — `yard-inventory.service.ts` `findById()`
   passes the `Prisma.YardInventorySelect` const (service:12-30) as `include:` to
   `findUnique`; a Select payload is not a valid Include, so Prisma rejects the call
   (verified live: 500 on a present row AND on an absent row). No test or web caller covers the
   route. Out of this unit's authorized scope → not fixed; tests use the prompt's sanctioned
   `?search=` alternative. One-line fix (`include: select` → `select`, or rename the const to an
   Include shape) — hand to the decision-maker.
2. **Seed `AL-2609-00001` left `IN_PROGRESS`** — see Data-state anomaly above (attributable to
   no test/script in this unit; non-reproducing; not restored by design).

## Known deviations

1. **Same-voyage eligibility left UNASSERTED** (not failing) + NEEDS_BUSINESS_DECISION — stated
   in Part 2 and in the test comment.
2. **§2.3 step-7 removal not implemented** — stopped per Part 3 / §5, recorded for review.
3. First triplet attempt interrupted by the pre-existing job-suite load flake (recorded);
   official triplet = A1/A2/A3.
4. `docs/decisions.md` reorder normalized 3 blank separator lines (content multiset identical,
   473 = 473).
5. Eligibility assertions are `search`-scoped (live DB has many foreign DONE cargos; the
   default page could otherwise push this cargo past page 1).

## TRANSLATION_CHANGES

none

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase3-unit3-not-loaded-to-yard
PHASE: Phase 3 — Operational Flow Reconciliation (unit 3)
DB_MIGRATION_STATUS: none — no schema or migration changes (migrate status: 32 up to date;
  migrate diff vs scratch shadow DB: "No difference detected")
UI_GATE: NOT APPLICABLE — backend/test-only unit, no user-visible component changed
SCHEMA_CHANGES: none
CODE_CHANGES: no production code changed —
  apps/api/test/actual-loading.e2e-spec.ts (+2 tests: four-state result table asserted via
  public API; ADR-028 later-voyage eligibility) + docs/decisions.md (ADR-041/042 reorder only);
  ADR-028 ELIGIBILITY FIX WAS NOT NEEDED for the required assertion (different-voyage
  re-planning is eligible and asserted; same-voyage exclusion = unasserted NBD, Part 2)
TEST_CHANGES: baseline 362/362/0 (22/22) -> 3 consecutive runs: 364/364/0, 364/364/0,
  364/364/0 (per-suite identical); new tests: 2 (4 result states + eligibility), all green
  solo and in all 3 full runs
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain diff vs eaf6dbd = apps/api/test/actual-loading.e2e-spec.ts +
  docs/decisions.md + this log; apps/web/src = none; prisma/ = none
UNRESOLVED_ISSUES: 2 — (1) GET /yard-inventory/:id 500 for every id
  (yard-inventory.service.ts findById passes a Select const as `include:`; live-verified;
  out of scope, tests use ?search=); (2) seed AL-2609-00001 left IN_PROGRESS (unattributed
  one-shot during this unit's window, non-reproducing, not restored by design — see log)
NEEDS_BUSINESS_DECISION: 2 (Part 2/3 only) — (a) same-voyage re-planning of not-loaded cargo
  is excluded by the duplicate-assignment guard: intentional-looking vs ADR-028 "eligible for
  later planning" (assertion left UNASSERTED); (b) §2.3 step 7 "removed from Load List" vs
  ADR-041 finalized-list immutability — literal conflict recorded, removal NOT implemented,
  shipped satisfies the returns-to-yard half (tested) and the functional-removal half
BLOCKED: none — Part 3's item was stopped on its own per the prompt ("record … and stop only
  that item"); every deliverable of Parts 1/2/4 and all verification steps are complete; the
  conflict is routed to NEEDS_BUSINESS_DECISION, whose template field is reserved for exactly
  part 2/3 findings
HANDOFF_TO: decision-maker (unit 3 verification → Phase 3 unit 4: Comment editing/visibility
  design, then the Phase 3 UI unit scoped by Part 4.2)
```

## Decision-maker verification addendum (2026-10-02)

Verified independently of this log; all claims re-executed rather than read:

- Full suite re-run at `eaf6dbd` + log → **364/364/0 (22/22)** (matches the reported triplet);
  touched suite solo **19/19**.
- `npx tsc -p apps/api` **0**; `-p apps/web` **exactly the 3 pre-existing `[locale]/page.tsx`
  errors**; `pnpm --filter @shipping/shared build` **0**.
- `prisma migrate status` → **32 migrations, up to date**.
- Porcelain = exactly the 2 reported files + this log; `apps/web/src` **0**; `prisma/` **0**.
- ADR order now **040 → 041 → 042**; non-empty-line multiset of `docs/decisions.md` vs HEAD is
  **md5-identical** (473 = 473) — stronger than the reported line count.
- §2.3 line 46 and §2.4 line 54 re-read verbatim (removal wording present / absent as reported);
  `getEligibleCargo()`'s assigned-cargo `notIn` filter re-read at
  `load-planning.service.ts:440-475`; both NEEDS_BUSINESS_DECISION items confirmed as reported
  and left as the log left them (unasserted / not implemented).
- `GET /yard-inventory/:id` **live-reproduced 500** on a present row and an absent row, root cause
  confirmed at `yard-inventory.service.ts:82` (`include: select` on a Select payload).
- Servers: API **200**, WEB **200** (root → `/fa` redirect), never restarted.

**Actions taken by the decision-maker after verification (beyond this log's scope):**

1. **Fixed UNRESOLVED #1** — `yard-inventory.service.ts:82` now passes `select` (one word), plus a
   regression test in `cargo-inventory.e2e-spec.ts` (200 with nested cargo/yard/port; 404 unknown
   id). Live re-probe: present → 200, absent → 404. cargo-inventory 31 → 32 green; full suite
   **365/365/0 (22/22)**; tsc API 0. The `?search=` comments inside this log's tests are now
   historical (they stay — they were correct when written).
2. **Restored seed `AL-2609-00001` to `DRAFT`** (UNRESOLVED #2) by direct `UPDATE`, as the log
   offered; all 4 seed Actual Loadings are DRAFT again. Full suite green afterwards (365/365/0),
   confirming no suite depended on the stray state.
3. `docs/current-plan/11-implementation-state.md` updated: unit 3 recorded COMPLETE +
   independently verified, both follow-ups closed, unit 4 (Comment design) scoped with the two
   NEEDS_BUSINESS_DECISION items carried forward.

UI verification: **NOT APPLICABLE** (backend/test-only unit; no file under `apps/web/src`
changed by the unit or by the follow-ups).
