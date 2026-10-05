# 2026-10-04 — Phase 4 unit 6: release separation — `bill:release` + audited override + policy seam

## Task ID

phase4-unit6-release-separation

## Phase

Phase 4 — B/L Rewrite (unit 6 / P4-U6 per ADR-045 decision 6 — the last execution unit
before U7)

## Objective

Deliver roadmap Phase 4 **Test 5** ("Release separation") and **Acceptance 4 part 2**
("…and release separation are correct") on two deliberately independent axes per
**ADR-045 decision 3** with **ADR-046 rulings 2 and 3 binding**: (1) the B/L release axis —
the edge U4 left inert goes live behind its own `bill:release` permission with an ADR-010
AuditLog row; (2) the ReleaseOrder policy axis — eligibility made a single named policy seam
whose default is exactly ruling 3, with the override path audited.

## Prompt reference

- **ADR-045 decision 3** (read in full): `RELEASED` reached only by `APPROVED → RELEASED`
  under separate permission `bill:release` (ADR-016 seeding pattern) writing an AuditLog row
  (ADR-010); approval and release are independent axes ("approval never releases, release
  never re-opens"); ReleaseOrder document keeps its current shape; eligibility becomes
  policy-driven with default = issued-equivalent + fully paid; overrides only through an
  audited path; no payment/credit/approver rule hard-coded.
- **ADR-046 rulings 2+3** (binding): `bill:release` + AuditLog; default policy = APPROVED AND
  all invoices fully paid; partial-payment/credit/approver numbers stay configurable policy
  inputs.

## Environment

Repo, HEAD **03bf612** (U5 state-doc commit), porcelain **0**; servers `:3101`/`:3000`
**200 before/after, never restarted**; pnpm 9.15.9; **billSeqRows BEFORE: 39**.

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       381 passed, 381 total
```

(`scratch/p4u6-base.json` — matches the stated baseline.)

---

# Axis 1 — B/L release (`POST /bills/:id/release`)

- **Route** (the one U4 deliberately left absent): `@Post(':id/release')`,
  `@HttpCode(200)`, `@RequirePermissions('bill:release')` — U4's `BILL_TRANSITIONS`
  entry `APPROVED: ['RELEASED']` is now dispatched; **no transition-table or enum change**
  (the constraint): the service calls the existing `assertTransition(status, 'RELEASED')`,
  so every non-APPROVED source is **409** with the recorded transition message
  (`B/L transition {status} -> RELEASED is not allowed`), and RELEASED stays terminal.
- **Service `release()`**: row-locked transaction (same `lockBill` helper U5 added, so a
  concurrent issue/edit serializes against the capture), status update, then the audit row —
  all committed together.
- **Audit shape adopted (first business-module precedent for AuditLog — no existing caller
  existed; recorded per the prompt):**
  ```
  action:     'bill:release'        // mirrors the permission code — greppable
  entityType: 'BillOfLading' | 'ReleaseOrder' (override)
  entityId:   row id
  actorId / actorEmail              // from the authenticated principal
  beforeData: { status: 'APPROVED' }   afterData: { status: 'RELEASED' }
  metadata:   { billNumber }           (override: bill id, reason, financials)
  timestamp/createdAt                 // AuditLog defaults
  ```
  Written through a **new additive `AuditService.recordIn(tx, ctx)`** — identical shape to
  `record()`, but it takes the caller's transaction client, because `record()` always uses
  the outer client (i.e. runs post-commit) and decision 3/rule 2 promise an in-transaction
  row. `record()` itself is untouched.
- **Permission seeding:** `prisma/seed.ts` gains
  `{ code: 'bill:release', module: 'bill', action: 'release' }` — the exact ADR-016 pattern
  (idempotent `permission.upsert` by code), **not a migration** (migrate status stays 36).
  Seed re-run live: 160 permissions, row verified `bill/release`.
- **Roles (recorded choice, configuration not employer question):** **Administrator gets
  it** via the seed's existing all-permissions loop (verified live: granted = true);
  **OPERATIONS unchanged** (verified: not granted). Rationale: release is the final
  outbound step (goods + document leave on this state), so the default keeps it with
  full-system admins; any other role can receive it later through the existing Roles UI —
  a config change, no code.

## Re-pointed assertions — **1** (the expected U4 touch)

| # | site | old → new | justification |
| --- | --- | --- | --- |
| 1 | `bill.e2e-spec.ts` (U4 lifecycle test, "inert guard" block) | `POST …/release → 404` ("no route exists") + comment → **`→ 409`** + comment "route now EXISTS, gated by bill:release (admin holds it via seed); RELEASED still terminal" | ADR-046 ruling 2 activates the route by specification — the 404 asserted a state of the world this unit is required to change; 409 preserves the asserted *guarantee* (nothing can release twice / RELEASED is terminal) under the new gated route |

No other existing assertion changed (test count grows only by new `it`s, below).

---

# Axis 2 — ReleaseOrder eligibility policy seam

**Seam (recorded): `apps/api/src/modules/delivery-release/release-order.policy.ts` →
`RELEASE_ORDER_ELIGIBILITY_POLICY`** — the simplest honest form: one named exported object
the service consults, with:

- `name: 'adr-046-ruling-3-default'`,
- `requiredBillStatus: 'APPROVED'` (feeds `eligibility()`'s status gate),
- `paymentRule: 'FULL_SETTLEMENT'` (zero invoices = settled — shipped behavior kept),
- `paymentTolerance: 0.005` (**moved out of `billFinancials()`'s hard-coded literal** —
  ruling 3 explicitly makes partial-payment numbers policy inputs),
- `evaluate({billStatus, fullyPaid}) → {eligible, needsOverride}` — the verdict both
  `eligibility()` and (via `fin.fullyPaid`, computed *through* the tolerance) the RO-create
  money block derive from.

**Default = exactly ruling 3:** APPROVED + fully paid. **Nothing beyond the default is
hard-coded:** no credit limits, no partial-payment tiers, no approver rules exist anywhere.
**Config-change path (documented, not built):** an employer ruling edits this object (or a
successor strategy with the same shape) — the status gate, tolerance and verdict all flow
from it; no config UI is built (per brief), and a test pins the object's exact key set so
accidental extra rules are caught. **Explicit scope note:** the D-O/R-O *creation* gates
(`requireIssuedBill`) keep U4's literal `APPROVED` rule — unchanged per brief; the policy
governs the eligibility axis only.

**Override audit (ruling 3's "audited override path"):** verified the shipped path wrote
**no** AuditLog row (`financialOverride`/`overrideReason` were stored on the RO row only) —
added: when `financialOverride` is true, `createRelease` writes
`action: 'release:override'` in the same transaction (metadata = bill id, overrideReason,
invoicesTotal/Paid/outstanding). `release:override` stays the permission gate (untouched),
and `ACTX` gained `actorEmail` (controller passes `user.email`) — additive.

**Untouched by design:** DO/RO gate statuses, ReleaseOrder shape/fields, money computation
apart from the tolerance source, `force` DTO, override permission.

---

# Tests (roadmap Test 5) — delta **381 → 384**

1. **bill.e2e — release axis (1 new `it`):** issue alias lands APPROVED **with zero
   `bill:release` audit rows** (approval never releases) → `readerToken` (read-only) 403 and
   `writerToken` (update but no release) 403, **still zero rows** → dedicated
   `releaserToken` (`createRoleToken(['bill:read','bill:release'])`) → **200 RELEASED** →
   **the audit row asserted directly** (findFirst: actorEmail = the releaser's exact email,
   actorId truthy, `beforeData.status = APPROVED`, `afterData.status = RELEASED`,
   `metadata.billNumber` = the bill's number, **exactly 1 row**) → fresh DRAFT release →
   **409 containing the recorded `not allowed` message with zero rows** → release never
   re-opens: `approve`/`finalize`/`issue`/`revisions` on the RELEASED bill all **409** and
   the audit count stays 1. Suite support: `releaserToken` + `BLREL_${tag}` role/email
   registered in the beforeAll/cleanup lists (user email, role code), seq name pushed
   (follow-up (g)).
2. **delivery-release.e2e — override audit (new `it`):** the already-shipped successful
   override (`ro1Id`) has its AuditLog row: actorEmail = the `dr-ovr` overrider's email,
   `metadata.overrideReason` contains "wire pending", `invoicesTotal = 800.00`,
   `outstanding = 800.00` (the exact amount bypassed), and **exactly one
   `release:override` row in the whole trail**.
3. **delivery-release.e2e — policy seam (new `it`):** imports the policy object and asserts
   name/status/rule/tolerance, the three default verdicts (APPROVED+paid → eligible;
   APPROVED+unpaid → needsOverride; DRAFT/RELEASED+paid → not eligible), and the exact key
   set (gold-plating guard — no extra hard-coded rules can hide on the object). API-level
   default outcomes remain covered by the existing eligibility/money-rule/settle tests
   (all still green, untouched).

**Cleanup discipline (both precedents):** every new bill-creating test pushes its
NumberingSequence name; audit rows written by tests are deleted in `afterAll` by **explicit
id filters only** (`entityId in [fixture ids]` — append-only binds the application, not test
teardown; leaving them would dangle on hard-deleted ids; recorded).

---

# Verification (verbatim)

1. Baseline first run at 03bf612 → **381/381/0 (22/22)** ✅
2. **Official triplet → 384/384/0 ×3**, per-suite parsed from JSONs: **22/22 suites green
   each run** (bill 28, delivery-release 13) ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `npx prisma migrate status` → **36 migrations … up to date, UNCHANGED** (permission lives
   in seed.ts, not a migration — as required; no schema file touched: `prisma/schema.prisma`
   is absent from porcelain) ✅
5. `pnpm --filter @shipping/web test` → `CONTRACT GUARD OK — 18 shared status unions ⊆
   Prisma enums; 84 web api.post routes ⊆ 95 controller @Post routes` (exit 0; +1 new
   release route) ✅
6. Servers → **API 200, WEB 200** before/after, never restarted ✅
7. **billSeqRows BEFORE 39 → AFTER 39 (flat, zero growth)**; **AuditLog total = 0** after
   the runs (all test-written rows cleaned by explicit ids); live counts unchanged:
   **bills 3 | manifests 4 | cargos 55 | voyages 21 | DOs 2 | ROs 2** ✅
8. Porcelain = audit.service + bill controller/service + delivery-release service/controller
   + new `release-order.policy.ts` + seed.ts + 2 e2e specs + this log — **`apps/web`,
   `packages/shared`, `prisma/schema.prisma`, `prisma/migrations` all untouched** ✅

## TRANSLATION_CHANGES

none

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit6-release-separation
PHASE: Phase 4 — B/L Rewrite (unit 6 / P4-U6)
DB_MIGRATION_STATUS: 36 up to date, UNCHANGED (permission seeded via prisma/seed.ts idempotent
  upsert, not a migration; schema.prisma untouched)
UI_GATE: NOT APPLICABLE — backend-only (bill module, delivery-release module, audit service,
  seed, policy file, 2 e2e specs); apps/web untouched (release button/display is U7 per
  ADR-045 decision 6); contract guard re-run green
SCHEMA_CHANGES: none
CODE_CHANGES: bill — new release() (row-locked tx, assertTransition(APPROVED->RELEASED),
  in-txn audit row) + POST /bills/:id/release (HttpCode 200, RequirePermissions bill:release);
  audit — new additive AuditService.recordIn(tx, ctx) (same shape as record(), caller's tx,
  so mutation + audit commit together per ADR-010; record() untouched); delivery-release —
  eligibility status gate + fully-paid tolerance + verdict now read RELEASE_ORDER_ELIGIBILITY_POLICY
  (new file, the single seam), createRelease writes an in-txn 'release:override' AuditLog row
  when financialOverride, ACTX + actorEmail (RO controller passes user.email); seed —
  +bill:release permission (idempotent upsert pattern)
PERMISSION: bill:release seeded (bill/release row verified live); roles: Administrator granted
  (all-permissions loop, verified live), OPERATIONS unchanged — recorded choice: release is
  the final outbound step, kept with full-system admins as configuration; other roles can be
  granted later via the existing Roles UI (no code)
AUDIT: release + override rows asserted — 'bill:release' row asserted field-by-field (actor
  email/id, before APPROVED / after RELEASED, metadata.billNumber, exactly 1; 403/409 paths
  write 0) and 'release:override' row asserted (overrider email, overrideReason, the
  800.00 outstanding bypassed, exactly 1); shape recorded above (first business precedent)
POLICY SEAM: RELEASE_ORDER_ELIGIBILITY_POLICY in apps/api/src/modules/delivery-release/
  release-order.policy.ts — default = ADR-046 ruling 3 (requiredBillStatus APPROVED,
  FULL_SETTLEMENT, tolerance 0.005 moved out of the service literal, evaluate() verdict);
  config-change path = edit the object (documented + key-set pinned by test); DO/RO creation
  gates left at U4's literal APPROVED per brief
TEST_CHANGES: baseline 381/381/0 -> triplet 384/384/0 x3, per-suite 22/22 green (+3: release
  axis/audit/409s/axes-independence, override audit row, policy seam). Re-pointed assertions: 1
  (U4 release-404 -> permission-gated 409, enumerated above — the expected touch)
FOLLOWUP_G: billSeqRows 39 -> 39 flat (verified); my new test pushes its sequence name;
  historical 39 orphans untouched per brief
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = the 9 files listed in Verification #8 (+ log); contract guard OK;
  servers never restarted; commit at task end so the tree ends clean
UNRESOLVED_ISSUES: (1) carry-overs unchanged: portal destination-scoped B/L visibility,
  manifest.dto stale Swagger text, B/L number column wrap (U3), proforma-convert allocation
  observation (U5), follow-up (g) historical orphans, (e)/(f); (2) recorded note: AuditLog
  rows for TESTS are removed in afterAll by explicit id (append-only binds the application
  path, not test teardown) — production audit rows are never deleted by any code path
NEEDS_BUSINESS_DECISION: none expected — ADR-046 rulings 2+3 fully specify this unit; role
  grants recorded as configuration
BLOCKED: none
HANDOFF_TO: decision-maker (unit-6 verification → P4-U7 final unit: UI + document output,
  /issue rename, revision-history UI, legacy-manifest retirement; then Phase 4 closure)
```
