# 2026-10-03 — Phase 4 unit 1: B/L Rewrite — current-state survey + target design + ADR-045 (DESIGN ONLY)

## Task ID

phase4-unit1-bl-rewrite-design

## Phase

Phase 4 — B/L Rewrite (unit 1, design-first; opens Phase 4)

## Objective

Survey the shipped B/L stack, design the roadmap's Phase 4 rewrite (decoupling, lifecycle,
release separation, revisions, per-destination numbering), record it as ADR-045, and split the
remaining work into independently verifiable execution units. **No code, schema or test changes.**

## Prompt reference

- Roadmap §3 **Phase 4 — B/L Rewrite** (read verbatim): Scope = Remove Manifest dependency ·
  Shipper/Consignee masters on B/L · Per-destination numbering · Draft/Final/Approved/Released
  lifecycle · Revisions for customer review · Number stability through revisions · Document
  output hooks. Dependencies: Phases 2+3 (both CLOSED) + NumberingSequence.
  Data: B/L redesign, release concept, revision model. API: create from cargo/loading, lifecycle
  + revision endpoints, document download hooks. UI: create/edit/detail, revision history,
  release display. **Tests (5):** B/L creation without Manifest dependency · Party master usage ·
  Numbering · Lifecycle and revisions · Release separation. **Acceptance (4):** no Manifest
  dependency · parties from masters · numbering per destination · lifecycle and release
  separation correct. **Risks:** incomplete Manifest decoupling · revision complexity.
- `12-open-business-decisions.md` **§1.1 / §1.2** read verbatim (quoted in ADR-045 Context).
- Employer B/L passages read verbatim: `03-final-workflows.md` §3.1 (67–76, all 10 steps),
  §3.2 (80–84), §3.7 (124–128); `06-final-ui-blueprint.md` §5.1 (132–137), :200;
  `08-requirement-traceability.md` §2.10 (303–360: from cargo/loading not Manifest, field list,
  destination-scoped sequence, Draft watermark, revision model, Final/Approved, release
  separate from finalization, parties from masters — PDF output is Phase 7).
- `docs/decisions.md`: **ADR-029** (manifest = actually-loaded lines, one-per-voyage at app
  level), **ADR-039** (discharge mirror — NOT_LOADED never sailed), **ADR-030** (current
  B/L↔manifest coupling — superseded in part by ADR-045), **ADR-008** (configurable numbering),
  **ADR-010/016** (audit + seeded permission registry), **ADR-033** (ReleaseOrder shape),
  Phase-2 party cutover (executed per the cutover plan/state doc; no dedicated ADR exists —
  `grep -i shipper docs/decisions.md` finds none, recorded here honestly).

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD **87cdae0**, porcelain **0** at start.
- Servers `:3101`/`:3000` **200 before/after**, never restarted; pnpm 9.15.9; root `pnpm test`
  self-recursion pre-existing (untouched — tests via `pnpm --filter <pkg> test`).

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       366 passed, 366 total
```

(`scratch/p4u1-base.json` = 366/366/0, 22 suites — matches the stated baseline exactly.)

---

# Part A — Current-state survey

## A1. Schema (prisma/schema.prisma)

| anchor | finding |
| --- | --- |
| `:1216 BlStatus` | `DRAFT \| ISSUED \| CANCELLED` — roadmap's Draft/Final/Approved/Released **does not exist** |
| `:1232 BillOfLading` | **REQUIRED `manifestId` FK**; `voyageId` commented *"denormalized via manifest for queries"*; `vesselName/vesselImo` *"copied from the manifest at creation"*; parties *"defaulted from the manifest, overridable per document"* — but `shipperId/consigneeId` already point at **Shipper/Consignee masters** (Phase-2 cutover done); `billNumber String @unique // auto BOL-YYMM-#####`; aggregates recomputed server-side; relations to Invoice/DeliveryOrder/ReleaseOrder; app-level *"a manifest line may belong to at most one LIVE bill"* comment |
| `:1306 BillOfLadingItem` | **REQUIRED `manifestItemId` FK** + `cargoId` + frozen snapshot fields (defaults from the manifest item) |
| `:1181 ManifestItem.blNumber` | `String? // legacy B/L number` — stamped by `issue`, cleared by `cancel` (`bill.service.ts:635/:674`) |
| `:1360 / :1784 / :1814` | Invoice.`billOfLadingId` **optional**; DeliveryOrder + ReleaseOrder `billOfLadingId` **required** |
| `:1976 NumberingSequence` | full configurable architecture (scopeType `GLOBAL|DESTINATION|YEAR|YEAR_PERIOD`, scopeValue, prefix/padding/format/period, nextSequence) — ready for B/L use |

## A2. API module (`apps/api/src/modules/bill/`)

- Routes: `GET /`, `GET /eligible-items?manifestId=`, `GET /:id`, `POST /`, `PATCH /:id`,
  `DELETE /:id`, items CRUD, **`POST /:id/issue`** (`bill:issue`), **`POST /:id/cancel`**
  (`bill:cancel`); permissions bill:read/create/update/delete/issue/cancel.
- `create()` (:236-330): loads manifest, **requires `status === 'APPROVED'`**
  (`'Bills of Lading can only be issued against an APPROVED manifest'`), `assertLiveParty`
  liveness for dto-or-manifest parties, **bounded-retry number allocation** (P2002 race note),
  freezes vessel/voyage/parties from the manifest, DRAFT row.
- `eligibleItems(manifestId)` (:546-585): manifest lines not yet claimed by a live bill
  (flat shape).
- Item claim (:414-449): foreign-manifest-line 409 + **one-live-bill-per-manifest-line** claim
  check (ADR-030).
- `issue()` (:620-649): DRAFT→ISSUED, ≥1 item, stamps `ManifestItem.blNumber` in the same tx;
  `cancel()` clears the stamp only where still stamped with this bill's number.
- **Numbering: local `generateReference()` (:740-755)** — `BOL-YYMM-#####` read-then-write over
  the table, **NumberingSequence NOT used**. `NumberingService` is used only by
  `numbering.service.ts` (generic) and `voyages.service.ts` — voyages already implements the
  **per-destination pattern**: `allocateNumber({name: voyage-{dest}-{yy}, documentType:
  VOYAGE, scopeType: 'DESTINATION', scopeValue: destinationPortId, format: '{sequence}/{yy}',
  period: 'YY'})` (`:278-289`), parent `voyageNumber` stays globally unique.

## A3. Tests (bill.e2e-spec.ts, 14)

401/403 basics; create needs bill:create + **unknown manifest 404**; **non-APPROVED manifest
409**; create+get+list asserts `BOL-YYMM-#####`, DRAFT, **snapshot from manifest**;
eligible-items = un-billed manifest lines; addItem 403/foreign-line-409/snapshot values;
updateItem/removeItem totals; header update DRAFT-only; issue 403/empty-400/DRAFT→ISSUED
**stamps blNumber** and locks; cancel 403+reason/ISSUED→CANCELLED **releases line + clears
blNumber**; delete soft-deletes + releases; list filters. (delivery-release.e2e also asserts
`BOL-` format → number-format blast radius = 3 files.)

## A4. Blast radius — every code site reading the B/L or its manifest link

| site | coupling | verdict for the rewrite |
| --- | --- | --- |
| bill module (~15 `manifestId` sites: DTO `:36` required, create, eligible-items, claim, list filter, selects) | core | **rewritten in P4-U2** |
| `ManifestItem.blNumber` stamp (issue `:635` / clear `:674`) | reverse link | made **conditional** on legacy items; direction **reversed by Phase 5** (workflows §3.2: Manifest from issued B/Ls) |
| `invoice.service.ts` (19 refs): optional FK, reads `bill.voyageId` (:496), bill/manifest voyage-consistency `:513` | soft | **survives** (voyageId stays self-owned; check only fires when both docs exist) |
| `delivery-release.service.ts` (36 refs): required FKs; **`requireIssuedBill` :37-46 and `eligibility` :88-94 both assert `status === 'ISSUED'`** | hard on lifecycle | **must move to the issued-equivalent in P4-U4** (sequenced, listed) |
| portal module / portal web | none today (`grep` = zero) | destination-scoped B/L visibility remains the known carry-over (state doc) |
| Discharge | none (`grep` = zero) | unaffected (ADR-039 chain unchanged) |
| web `bills/page.tsx` | manifest-driven list/create dialog | **UI unit (P4-U7)** |
| `BOL-` format | service + `bill.e2e` + `delivery-release.e2e` | updated in **P4-U3 only** |

## A5. Inherited decisions

ADR-029 (eligible cargo = COMPLETED ActualLoading per voyage; app-level one-per-voyage
rationale), ADR-042 (positive recorded quantity), ADR-039 (not-loaded never sailed — excluded
from downstream docs), ADR-008 (configurable numbering), ADR-030 (snapshots/DRAFT-only/
cancel-releases-line semantics **retained**; create-source + manifest-line uniqueness
**superseded** — recorded in ADR-045), Phase-2 party masters (shipperId/consigneeId already
master FKs; assertLiveParty pattern retained).

---

# Part B — Target design (ADR-045 decisions 1–6, summarized; full text in docs/decisions.md)

1. **Decoupling:** source = `voyageId` + cargo lines passing *actually-loaded* eligibility
   (ADR-029/042 `actualQuantity > 0`); `manifestId` → nullable legacy; `voyageId` self-owned;
   vessel snapshot from voyage; new `destinationPortId` column (additive); items keyed on
   `cargoId` (+ optional `actualLoadingItemId`), `manifestItemId` nullable legacy; one live
   bill per **cargo line per voyage** (app level); parties from dto/cargo masters, never a
   manifest. Migration strategy: additive-only per unit; **drops deferred past Phase 5 with
   explicit approval**. Blast radius sequenced (table A4).
2. **Lifecycle:** target `DRAFT | FINAL | APPROVED | RELEASED (+CANCELLED)`; configurable
   default mapping `DRAFT→DRAFT, ISSUED→APPROVED, CANCELLED→CANCELLED`; enum extended
   additively (Postgres ADD VALUE) + recorded backfill in its unit; `DRAFT→FINAL→APPROVED`
   replaces `DRAFT→ISSUED` (issue endpoint aliased then renamed); cancel path unchanged
   (mandatory reason); D-O/R-O gates moved in the same unit.
3. **Release separation:** `RELEASED` = BlStatus value reached only `APPROVED→RELEASED` under a
   **separate `bill:release` permission** (seeded later, ADR-016) + `AuditLog` (ADR-010);
   finalization and release are independent axes; ReleaseOrder document (ADR-033) unchanged;
   its **eligibility becomes policy-configurable** (default: issued-equivalent + fully paid —
   the §1.2 "no money, no cargo" principle) with audited override, **nothing hard-coded**.
4. **Revisions:** additive `BillOfLadingRevision` snapshot table (JSON) + `revision Int`;
   draft-only `POST /:id/revisions`; history list-only; **`billNumber` frozen across
   revisions**; deliberately out: diff/compare UI, per-item version trees, multi-approver
   workflow, revision delete/edit/branch.
5. **Numbering:** swap `generateReference()` → `NumberingService.allocateNumber` with
   `scopeType DESTINATION / scopeValue destinationPortId`; format **`BOL-{DEST}-YYMM-#####`**
   (destination segment keeps the global `@unique` intact — bare per-destination counters
   would collide); existing numbers never renumbered; format blast radius = 3 files, touched
   only in P4-U3.
6. **Phased plan:**

| unit | scope | delivers roadmap |
| --- | --- | --- |
| **P4-U2** decoupling | additive migration (nullable manifestId/manifestItemId, destinationPortId) + create/eligible-items/items rewrite + one-live-bill-per-cargo-line + legacy-path retention | Tests 1, 2 · Acceptance 1, 2 · retires Risk #1 |
| **P4-U3** numbering | NumberingService swap, `BOL-{DEST}-…` format, per-destination sequences, existing-number stability, test-format updates | Test 3 · Acceptance 3 |
| **P4-U4** lifecycle | enum ADD VALUE + backfill + transition table + endpoint mapping + D-O/R-O `ISSUED` gates | Test 4 (part 1) · Acceptance 4 (part 1) |
| **P4-U5** revisions | table + endpoints + revision-number stability tests | Test 4 (part 2) |
| **P4-U6** release separation | `bill:release`, RELEASED transition, configurable ReleaseOrder eligibility + audit | Test 5 · Acceptance 4 (part 2) |
| **P4-U7** UI + doc hooks | B/L create/edit/detail, revision history, release display, Draft watermark, template hooks (ADR-009); full PDF/Excel engine = Phase 7 | UI changes list |

## Optional slice: DECLINED (recorded reasons, as in unit 5)

No unambiguous self-contained code exists: (a) every candidate (create path, numbering swap,
gates) touches schema/DTO/service or rewrites shipped test assertions (`BOL-` format, manifest
409s) — not self-contained; (b) the lifecycle/numbering/format choices are exactly what the
open decisions leave configurable — shipping code before §1.1/§1.2 are ruled would hard-code
the very thing the employer must confirm; (c) all migrations need the additive-only + approval
path in execution units anyway. Default-decline per prompt.

---

# Verification (verbatim)

1. Baseline first run at 87cdae0 → **366/366/0 (22/22)** ✅
2. Full suite not re-run beyond baseline — design-only, zero code/test changes (scratch JSON
   kept: `p4u1-base.json`); decision-maker's stated baseline reproduced on first run ✅
3. `npx prisma migrate status` → **32 … up to date**; **no migration introduced** (design-only;
   `prisma/` untouched) ✅
4. Servers → **API 200, WEB 200**, never restarted ✅
5. Contract guard → `CONTRACT GUARD OK — 18 shared status unions ⊆ Prisma enums; 84 web
   api.post routes ⊆ 90 controller @Post routes …` (exit 0); the design adds **no** union and
   **no** api.post route (ADR-045's future routes are described, not implemented) ✅
6. Porcelain = **`docs/decisions.md` (ADR-045 append, order 044→045) + state doc + this log**
   only; `apps/` and `prisma/` untouched ✅
7. tsc: not applicable to change (nothing compiled changed) — prior state remains api 0 /
   web 3 pre-existing / shared 0 (decision-maker verified at 87cdae0) — cited, not re-run
   beyond guard/migrate above.

## UI GATE

**NOT APPLICABLE — design-only unit** (protocol §3.1): no user-visible component, route, or
type changed; deliverables are docs (survey, ADR-045, unit plan).

## TRANSLATION_CHANGES

none

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit1-bl-rewrite-design
PHASE: Phase 4 — B/L Rewrite (unit 1, design-first; Phase 4 OPENED)
DB_MIGRATION_STATUS: none — no schema/migration (design-only; migrate status 32 up to date)
UI_GATE: NOT APPLICABLE — design-only unit, no user-visible component changed
SCHEMA_CHANGES: none
CODE_CHANGES: none (optional slice declined with recorded reasons — candidates all touch
  schema/DTO/service or number-format test assertions, and would pre-empt the configurable
  parts of open decisions §1.1/§1.2)
TEST_CHANGES: none — baseline 366/366/0 (22/22) accepted on first run; no tests added/changed
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = docs/decisions.md (ADR-045, order 044→045) +
  11-implementation-state.md + this log; apps/ = 0 files; prisma/ = 0 files; contract guard OK
  (no new union / api.post route)
UNRESOLVED_ISSUES: none new. Carry-overs restated in the plan: portal destination-scoped B/L
  visibility, manifest.dto stale Swagger text, BillOfLadingItem snapshot-defaults wording
NEEDS_BUSINESS_DECISION: (1.1a) exact BlStatus names — Final distinct from Approved? (roadmap
  lists 4 states, workflows step 7 conflates final/approved/issued, blueprint shows 3; ADR-045
  decision 2 records the configurable default mapping DRAFT→DRAFT, ISSUED→APPROVED);
  (1.1b) Released modeling — BlStatus value + separate bill:release permission (this design,
  workflows step 9) vs side flag vs ReleaseOrder-only; (1.2) ReleaseOrder eligibility/override
  rules — "no money, no cargo" principle confirmed but partial-payment/credit/approver rules
  are not; design ships configurable policy + audited override, nothing hard-coded;
  (d) carried from ADR-044 — single mutable comment field vs append-only activity log
BLOCKED: none
HANDOFF_TO: decision-maker (unit-1 verification → P4-U2 decoupling; employer ruling needed for
  §1.1a/§1.1b/§1.2 before P4-U4/P4-U6 hard-code names/policy)
```
