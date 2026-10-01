# Phase 2 — Party master tests (Party CRUD + Agent destination scoping) — implementation log

**Task ID:** phase-2-party-master-tests
**Phase:** Phase 2 — Master Data & Party Model Realignment (test completion)
**Objective:** One new self-contained e2e suite covering roadmap §3 tests "Party CRUD" and
"Agent destination scoping", with no production behavior change.
**Prompt reference:** task prompt `phase-2-party-master-tests` (scope items 1–2, required coverage
A1–A10/B1–B8/C, verification steps 1–6, stop rule); protocol
`docs/current-plan/10-phase-execution-protocol.md` §2 (log structure), §3 (completion rules),
§3.1 (UI gate), §4 (safety), §5 (conflict stop); roadmap
`docs/current-plan/09-final-implementation-roadmap.md` §3.

## Original attempt — BLOCKED at step 1 (baseline); superseded by the re-issue (record kept as history; final outcome at the bottom)

## Files changed
- **None** (no suite, no source, no test, no config). Only this log file was added.
- `apps/api/test/party-masters.e2e-spec.ts` was **NOT created** — the stop rule fired first.

## Database changes
None.

## Migrations
None. (No `prisma` command run in this task; live migrate status untouched by this task.)

## Tests
**None executed/added** — stop occurred before writing. Planned enumeration (for the re-issue,
designed but not written; bootstrap = `party-cutover.e2e-spec.ts` pattern, portal-suite
`createRoleToken` helper for role minting):

Per master M ∈ {shippers, consignees, agents} (A1–A10):
A1 list without token → 401. A2 `<M>:read`-only role → GET 200, POST 403.
A3 POST valid body → 201 full echo. A4 duplicate code → 409; empty code → 400; empty name → 400;
code > 20 → 400. A5 list envelope `{data, meta:{page,pageSize,totalItems,totalPages}}`;
search matches code and name case-insensitive; `isActive=true|false` filter; `page=0` → 400.
A6 GET /:id → 200; unknown id → 404; soft-deleted id → 404. A7 PATCH → 200 + echo; duplicate
code → 409-or-actual per Update DTO inspection (record deviation if `code` accepted — note:
`UpdateShipperDto` as read during design accepts name/taxId/address/phone/email/notes/isActive,
no `code` — `shippers.dto.ts:61-79`). A8 PATCH /:id/active {isActive:false} → 200; visible under
`isActive=false`, absent under `isActive=true`; restore. A9 DELETE → success; GET → 404; absent
from list. A10 Prisma cross-check of one persisted value.

Agent destinations B1–B8: fixture (1 agent + 2 ports) → B1 POST {portId} → 201 echo + GET
paginated envelope; B2 duplicate (agentId, portId) → 409; B3 nonexistent portId → record actual
status/body (no existence check — `agents.service.ts:199`; if not clean 4xx → UNRESOLVED ISSUES,
do not fix); B4 PATCH {isActive:false} → 200, DELETE → gone, GET/PATCH/DELETE deleted → 404;
B5 IDOR: dest of agent A under agent B → 404; B6 unknown agentId → 404 on all four verbs;
B7 RBAC: GET needs `agent:read`, POST/PATCH/DELETE need `agent:update` → read-only role gets
GET 200 / mutations 403. C isolation: unique tags, afterAll hard-delete (masters, ports,
destinations, roles, users) + count assertions.

## Validation steps (verbatim outputs)

**Step 0 — servers before + git baseline (before anything):**
```
API:200
WEB:200
porcelain lines: 0
--- spec files ---
21
```
(git HEAD `d203444 fix: Phase 2 follow-ups — i18n gaps, portal shim removal, replay completeness` —
working tree clean; that commit added +1 portal regression test (portal now 14/14), which is the
307 → 308 total change, and its own recorded verification was "full e2e 308 tests / 233 passed /
75 failed = the recorded baseline failure set".)

**Step 1 — MANDATED baseline, `pnpm --filter api test` run #1 (verbatim):**
```
FAIL test/discharge.e2e-spec.ts (20.347 s)
FAIL test/actual-loading.e2e-spec.ts (20.627 s)
FAIL test/bill.e2e-spec.ts (21.424 s)
FAIL test/manifest.e2e-spec.ts (21.898 s)
FAIL test/delivery-release.e2e-spec.ts (22.035 s)
FAIL test/inspection.e2e-spec.ts (22.335 s)
PASS test/auth.e2e-spec.ts (27.603 s)
PASS test/invoice.e2e-spec.ts (9.138 s)
PASS test/salary.e2e-spec.ts (10.136 s)
PASS test/portal.e2e-spec.ts (8.823 s)
PASS test/quotation.e2e-spec.ts (9.078 s)
PASS test/proforma.e2e-spec.ts (8.918 s)
PASS test/voyage.e2e-spec.ts (11.749 s)
PASS test/party-cutover.e2e-spec.ts
PASS test/master-data.e2e-spec.ts
PASS test/voucher.e2e-spec.ts (8.45 s)
PASS test/app.e2e-spec.ts
PASS test/cargo-inventory.e2e-spec.ts (6.271 s)
PASS test/job.e2e-spec.ts (6.204 s)
PASS test/vessel.e2e-spec.ts (7.505 s)
PASS test/letter.e2e-spec.ts (8.119 s)
Test Suites: 6 failed, 15 passed, 21 total
Tests:       77 failed, 231 passed, 308 total
```
→ **total 308 ✓, failing-suite SET identical to expected {actual-loading, bill, delivery-release,
discharge, inspection, manifest} ✓, but failed = 77 (expected 75), passed = 231 (expected 233) ✗**
→ stop rule "the baseline is not 308/233/75" triggered. Per prompt item 3, per-suite counts were
diffed and classified BEFORE reporting (below). Nothing was written.

**Classification — per-suite/chunk re-runs (verbatim):**
```
=== C4a (bill+manifest+inspection) ===
Tests:       35 failed, 12 passed, 47 total
=== C4b (actual-loading+discharge+delivery-release) ===
Tests:       41 failed, 41 total
=== inspection solo ===
Tests:       8 failed, 13 passed, 21 total
```
Comparisons against the recorded historical per-suite counts:

| Unit | Historical count | This task | Verdict |
|---|---|---|---|
| bill solo | 13 failed / 13 total | (part of C4a: 13 failed — unchanged) | identical |
| manifest solo | 13 failed / 13 total | (part of C4a: 13 failed — unchanged) | identical |
| inspection solo | 8 failed / 13 passed (×2 previously) | **8 failed / 13 passed** | identical, stable ×3 |
| C4b trio | 41 failed / 41 total | **41 failed / 41 total** | identical |
| inspection inside 3-suite chunk | 8–9 failed (documented flake 34F↔35F) | **9 failed** (C4a = 35F/12P) | known flake, in range |
| inspection inside full 21-suite run | 8–10 failed (load-dependent) | 10 failed in run #1 (77−41−26) | known flake, in range |

Arithmetic: 77 = 41 (C4b, deterministic) + 26 (bill+manifest, deterministic) + 10 (inspection under
full-suite load). Every **deterministic** count matches the recorded baseline; only inspection's
load-dependent assertions (state machine / history / filters — timing-sensitive under worker
contention) moved: 8F solo → 9F in 3-suite chunk → 10F in the busy run #1. This is the same
inspection flake already documented in `phase-2-party-cutover.md` ("inspection's pre-existing
parallel-load interference, not a regression").

**Step 1b — MANDATED baseline, run #2 of the same command (verbatim):**
```
Test Suites: 6 failed, 15 passed, 21 total
Tests:       75 failed, 233 passed, 308 total
```
→ **exactly 308 / 233 / 75 with the identical failing-suite set** — i.e. the expected baseline is
reproducible; the command's count fluctuates run-to-run under machine load (77 then 75) solely via
inspection's flake. No existing test result moves deterministically.

**Step 5 — servers after:**
```
API:200
WEB:200
porcelain now: 0 lines
party-masters.e2e-spec.ts: NOT created (correct)
```

**Not executed due to the stop:** suite write, suite-alone run, post-change full run (308+N/233+N/75),
`tsc -p` typechecks, shared build — all step 2/3/4/6 verification is conditional on writing the
suite, which the stop rule forbids. With zero source changes these would be no-ops.

## UNRESOLVED ISSUES
1. **Baseline run-to-run variance (stop-rule trigger, classified):** `pnpm --filter api test` returned
   `308/231/77` (run #1, the mandated single baseline) then `308/233/75` (run #2). Root cause:
   `apps/api/test/inspection.e2e-spec.ts` load-dependent flake — deterministic at `8 failed/13 passed`
   solo (stable ×3), +1 failure in 3-suite parallel, +2 in a busy full-suite run. The failing-suite
   set is identical in every run. NOT fixed, NOT touched (inspection is out of scope / assigned to
   Phase 3 unit 1). Candidate for Phase 3 unit 1 stabilization so the baseline stops fluctuating.
2. Design-time observations recorded for the re-issue (not defects, no action taken):
   - `UpdateShipperDto` (`shippers.dto.ts:61-79`) has no `code` property → the A7 duplicate-code-via-PATCH
     branch must be characterized against the actual test-app ValidationPipe (`whitelist: true` without
     `forbidNonWhitelisted` in the mandated bootstrap strips unknown properties → likely 200 with
     `code` unchanged, not 400) and recorded as a deviation if so.
   - Global fixture-count assertions race other parallel suites (cargo-inventory and the six failing
     suites create master rows in their hooks); the isolation check should assert **tag-scoped**
     fixture counts return to zero, with global pre-suite counts recorded as context.

## KNOWN DEVIATIONS
- None in executed work (no files changed beyond this log).
- The single mandated baseline run did not match 308/233/75; run #2 matched exactly. Both are
  recorded verbatim rather than choosing the flattering run.

## Status at the stop (BLOCKED record — kept as history per re-issue instructions)
```
EXECUTION_STATUS: BLOCKED
TASK: phase-2-party-master-tests
PHASE: Phase 2 — Master Data & Party Model Realignment (test completion)
DB_MIGRATION_STATUS: none — no schema or migration changes
UI_GATE: NOT APPLICABLE — pure backend/e2e test addition; no user-visible component changed (not reached: suite not written)
SCHEMA_CHANGES: none
CODE_CHANGES: none — stop rule triggered before any write; only this log file added
TEST_CHANGES: none — suite not written; baseline comparison: run1 308/231/77 vs expected 308/233/75
  (failing-suite set identical), run2 308/233/75 = expected; per-suite classification shows every
  deterministic count unchanged — variance is the pre-existing inspection load-flake
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain diff vs baseline (0 lines) = +1 untracked log file only; suite file absent
UNRESOLVED_ISSUES: 1 — baseline command fluctuates 75<->77 failed via apps/api/test/inspection.e2e-spec.ts
  load-dependent flake (solo 8F/13P stable x3; 3-suite 9F; busy full run 10F); deterministic counts of
  all 6 failing suites identical to baseline. Not fixed (out of scope). + 2 design observations for re-issue
NEEDS_BUSINESS_DECISION: none — stop executed per the prompt's explicit stop rule
  ("the baseline is not 308/233/75"); no design choice was improvised
BLOCKED: first mandated baseline run returned 308/231/77 (failed=77, expected 75) with an identical
  failing-suite set; classified per item 3 as inspection's known load-flake (second run of the same
  command reproduced 308/233/75 exactly; all deterministic per-suite counts unchanged) — recorded and
  stopped per protocol §5 before creating any file; per prompt "Do not ask the user to choose"
HANDOFF_TO: decision-maker (verification + Phase 2 closure; re-issue the task if the fluctuating
  baseline is acceptable — suite design above is ready to execute, or stabilize inspection flake
  first as part of Phase 3 unit 1)
```


## Resumed execution (re-issue 2026-09-30)

The decision-maker resolved the stop: the original "failed exactly 75" was a badly-specified metric
(a sum containing inspection's known load-flake), re-issued with the decomposition-based criterion
of §1. Execution below follows the re-issue prompt verbatim; the BLOCKED record above is kept as
history.

### 1. Baseline (§1) — ACCEPTED (observed: 308 / 232 / 76, inspection 9)

Servers before: `API:200`, `WEB:200`. HEAD `d203444`. Baseline porcelain: 1 line (this log file).
Single mandated run `pnpm --filter api test -- --json --outputFile=<scratch>/jest-baseline.json`:

```
Test Suites: 6 failed, 15 passed, 21 total
Tests:       76 failed, 232 passed, 308 total
```

Per-suite failed counts (from the run's own JSON, verbatim):

| suite | failed/total |
|---|---|
| discharge.e2e-spec.ts | 21/21 |
| bill.e2e-spec.ts | 13/13 |
| manifest.e2e-spec.ts | 13/13 |
| actual-loading.e2e-spec.ts | 10/10 |
| delivery-release.e2e-spec.ts | 10/10 |
| inspection.e2e-spec.ts | 9/21 |
| (15 green suites) | 0 failed |

§1 checks: total 308 ✓; failing set exactly {actual-loading, bill, delivery-release, discharge,
inspection, manifest} ✓; **deterministic component = 21+13+13+10+10 = 67 exact** ✓;
**inspection = 9 ∈ [8,10]** ✓ ⇒ failed 76 ∈ [75,77], passed 232 ∈ [231,233] ⇒ **ACCEPTED**
(observed baseline recorded as 308/232/76 with inspection 9; criterion (2) did not deviate, no
re-run needed).

### 2. Suite (§2) — apps/api/test/party-masters.e2e-spec.ts (new file only)

- Bootstrap from party-cutover.e2e-spec.ts (admin login, AppModule, HttpExceptionFilter,
  TransformInterceptor, PrismaClient fixtures/cleanup) with the **ValidationPipe copied verbatim
  from apps/api/src/main.ts:42-47** (`whitelist + forbidNonWhitelisted + transform +
  enableImplicitConversion`) so validation matches production.
- Fixtures: unique random tag everywhere (codes `PMS/PMC/PMA/PMD/PMO/PMPA/PMPB<PREFIX>+<TAG>`,
  role codes `PMSREAD_/PMCREAD_/PMAREAD_<TAG>`, emails `pm-*-<randomTag>@shipping.local`);
  RBAC minted with the portal-suite createRoleToken chain
  (GET /permissions/all → POST /roles → PATCH /roles/:id/permissions → POST /users → login).
- Structure: A1–A10 run for each of {shippers, consignees, agents} (parametrized MasterDef with
  typed Prisma delegate closures) + B1–B7 destinations + C isolation in afterAll → **37 tests**.
- **Run alone: `Test Suites: 1 passed, 1 total` / `Tests: 37 passed, 37 total`** (first run;
  a second solo re-run to capture the A7/B3 bodies also returned `Tests: 37 passed, 37 total`).

Verbatim captured from the suite run (design-relevant responses):

```
[shippers] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/shippers/cmuovq6po000iy12q0rogp9iq", ...}}
[consignees] A7 PATCH {code} response: 400 {"message":["property code should not exist"], ...}
[agents] A7 PATCH {code} response: 400 {"message":["property code should not exist"], ...}
[B3] nonexistent portId response: 400 {"success":false,"error":{"statusCode":400,"message":"Database operation failed: P2003","error":"Database Error","path":"/api/v1/agents/<id>/destinations","details":{"modelName":"AgentDestination","field_name":"agent_destinations_portId_fkey (index)"}}, ...}
[party-masters] global counts pre-suite: {"shippers":0,"consignees":0,"agents":1,"ports":248,"destinations":0,"roles":94,"users":93}
[party-masters] global counts post-cleanup (context only): {"shippers":0,"consignees":0,"agents":1,"ports":248,"destinations":0,"roles":94,"users":93}
```

- A7 per design resolution: `Update*Dto` has no `code` property → with `forbidNonWhitelisted` the
  PATCH (value deliberately the duplicate sdCode) is **400 `["property code should not exist"]`** on
  all three masters — asserted, exactly as the re-issue prescribed; uniqueness via PATCH is
  therefore unreachable (recorded under deviations).
- B3: the FK-only destination create surfaces as a **clean 400** (HttpExceptionFilter maps Prisma
  P2003 → 400, http-exception.filter.ts:76-85) — NOT a 500, so **no UNRESOLVED ISSUE**;
  body recorded verbatim above.
- C: tag-scoped fixture counts asserted back to 0 in afterAll (survivors: destinations 0,
  shippers/consignees/agents 0, ports 0, users 0, roles 0 — assertions passed); global counts
  logged as context only and identical pre/post in this run.

### 3. Verification (§3) — verbatim

**3.3 Full suite after the change** (`pnpm --filter api test -- --json --outputFile=<scratch>/jest-after.json`):

```
Test Suites: 6 failed, 16 passed, 22 total
Tests:       76 failed, 269 passed, 345 total
```

Per-suite comparison vs the recorded baseline (failed/total):

| suite | baseline | after |
|---|---|---|
| actual-loading | 10/10 | 10/10 |
| bill | 13/13 | 13/13 |
| delivery-release | 10/10 | 10/10 |
| discharge | 21/21 | 21/21 |
| manifest | 13/13 | 13/13 |
| inspection | 9/21 | 9/21 |
| **party-masters (new)** | — | **0/37** |
| all 15 other green suites | 0 failed | 0 failed (unchanged) |

Checks: total 345 = 308+37 ✓; passed 269 = baseline 232 + 37 ✓; failed 76 ∈ [75,77] ✓;
**deterministic sum = 67 in both runs** ✓; failing-suite set identical ✓; **new suite 37/37 green
in the full parallel run** ✓; non-inspection suites with moved counts: **NONE** ✓;
inspection 9 → 9 (same value as baseline run) ✓. No deterministic movement of any existing test.

**3.4 Typechecks / build:**
```
npx tsc --noEmit -p apps/api/tsconfig.json  -> API_TSC=0 (0 errors)
npx tsc --noEmit -p apps/web/tsconfig.json  -> exactly the 3 pre-existing
  src/app/[locale]/page.tsx(368,15) TS7053 'services' | (403,15) 'capabilities' | (437,15) 'coverage'
pnpm --filter @shipping/shared build        -> exit 0
```

**3.5 Servers:** before `API:200 WEB:200`; after all runs `API:200 WEB:200` — never restarted.

**3.6 Git:** final `git status --porcelain` = exactly two untracked entries, no tracked file modified:
```
?? apps/api/test/party-masters.e2e-spec.ts
?? docs/current-plan/implementation-log/2026-09-30-phase2-party-master-tests.md
```
(baseline at task start was this log file alone; delta vs baseline = the suite file only).

**UI gate: NOT APPLICABLE** — pure backend/e2e test addition; no user-visible component changed.

## Unresolved issues (re-issue)
- **None.** All 37 assertions passed without any production change; B3's FK-only path surfaced as a
  clean 400 (no defect realized); no assertion was stopped.

## Known deviations (re-issue)
1. **ValidationPipe**: this suite uses main.ts's options verbatim (`forbidNonWhitelisted: true`)
   instead of inheriting party-cutover.e2e-spec.ts's pipe (which omits it) — mandated by the
   re-issue so the test app matches production validation.
2. **A7 "duplicate code → 409" is unreachable via PATCH**: `Update*Dto` has no `code` property on
   all three masters (shippers.dto.ts:61-79 and equivalents), so the request is rejected with 400
   `["property code should not exist"]` before uniqueness could ever be checked. Asserted 400 per
   the re-issue's design resolution.
3. **Isolation assertions are tag-scoped** (C): global fixture counts race parallel suites and were
   recorded as context only, never used for pass/fail (as instructed). In this run they were
   identical pre/post.
4. **Candidate-defect observations — recorded, NOT fixed, NOT blocking any assertion:**
   - `PATCH /:id` clobbers omitted text fields to null: `shippers.service.ts:99-109`
     (`taxId/address/phone/email/notes: dto.x?.trim() ?? null`) — a partial PATCH nulls the omitted
     ones. Same shape in consignees/agents services. A7 therefore sends the full mutable payload.
   - Destination duplicate-conflict message says "with this code" although the unique key is
     (agentId, portId): `agents.service.ts:197-199` (cosmetic).
   - No GET-one destination route exists (`agents.controller.ts:56-90`), so B4's direct GET on a
     deleted destination 404s at route level, not service level (assertion holds either way).

## Status (final — re-issue outcome)
```
EXECUTION_STATUS: COMPLETE
TASK: phase-2-party-master-tests (re-issue 2026-09-30)
PHASE: Phase 2 — Master Data & Party Model Realignment (test completion)
DB_MIGRATION_STATUS: none — no schema or migration changes
UI_GATE: NOT APPLICABLE — pure backend/e2e test addition; no user-visible component changed
SCHEMA_CHANGES: none
CODE_CHANGES: one new test file only — apps/api/test/party-masters.e2e-spec.ts (ValidationPipe copied
  verbatim from apps/api/src/main.ts:42-47 per the re-issue; no production file touched)
TEST_CHANGES: new suite apps/api/test/party-masters.e2e-spec.ts (37 tests, all green);
  baseline 308/232/76 (inspection 9) -> 345/269/76; deterministic sum 67 in both: yes;
  failing-suite set identical: yes
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain diff vs baseline = log + suite only (2 untracked entries, no tracked file modified)
UNRESOLVED_ISSUES: none — all 37 assertions passed with no production change; candidate-defect
  observations (PATCH clobbers omitted text fields, destination duplicate message wording, no
  GET-one destination route) recorded under KNOWN DEVIATIONS, none fixed per scope
NEEDS_BUSINESS_DECISION: none
BLOCKED: none — §1 corrected criterion accepted on the first mandated run (308/232/76,
  deterministic 67 exact, inspection 9 in band); no stop condition hit
HANDOFF_TO: decision-maker (Phase 2 closure)
```
