# 2026-10-04 — Phase 4 unit 4: B/L lifecycle — four states, backfill, transition table, D-O/R-O gates

## Task ID

phase4-unit4-bl-lifecycle

## Phase

Phase 4 — B/L Rewrite (unit 4 / P4-U4 per ADR-045 decision 6; decisions 2+3 confirmed by
ADR-046)

## Objective

Deliver roadmap Phase 4 **Test 4 part 1** (lifecycle half of "Lifecycle and revisions") and
**Acceptance 4 part 1** (lifecycle half of "Lifecycle and release separation are correct"):
additive enum extension (`FINAL`, `APPROVED`, `RELEASED`; `ISSUED` retained), the idempotent
`ISSUED → APPROVED` backfill, the ADR-046 four-state transition table + endpoints, the D-O/R-O
gates moved to the issued-equivalent `APPROVED`, and all status-vocabulary consumers updated —
with the shipped web Issue button still working end-to-end (transition contract A).

## Prompt reference

- **ADR-046 rulings 1–3** (binding): four states `DRAFT → FINAL → APPROVED → RELEASED`
  (+ `CANCELLED`), Final distinct from Approved, `ISSUED → APPROVED` backfill, DRAFT/CANCELLED
  untouched; `RELEASED` reached only by `APPROVED → RELEASED` under `bill:release` +
  `AuditLog` (U6); ReleaseOrder eligibility policy (ruling 3) = U6, not this unit.
- **ADR-045 decision 2**: edges `DRAFT → FINAL → APPROVED` replaces `DRAFT → ISSUED`;
  "issue endpoint aliased during transition, then renamed"; `FINAL/DRAFT → CANCELLED` keeps
  the mandatory reason path; enum extended additively; backfill = one recorded UPDATE.
- Roadmap §3 Phase 4 (Tests 4 part 1, Acceptance 4 part 1); workflows §3.1 step 7 (single
  "finalized/approved and issued" moment).

## Environment

Repo, HEAD **2dfc9b4** (ADR-046 commit), porcelain **0**; servers `:3101`/`:3000`
**200 before/after, never restarted**; pnpm 9.15.9; PG 16 in container `erp-postgres`.

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       374 passed, 374 total
```

(`scratch/p4u4-base.json` — matches the stated baseline.)

---

# Part 1 — Migration (split by design: the Postgres pitfall, planned not discovered)

**Schema** (`prisma/schema.prisma`): `enum BlStatus` gains `FINAL`, `APPROVED`, `RELEASED`
with a P4-U4 comment; `ISSUED` and `CANCELLED` retained (**no value removed** — that stays a
later destructive op needing explicit approval, per the prompt).

**TWO migrations → migrate status = 35**, chosen over the single-file option because Prisma
applies each migration file in its own transaction and PostgreSQL forbids **using** a value
added in the same transaction (`ALTER TYPE … ADD VALUE` pitfall):

1. `20261004000000_bl_lifecycle_enum/migration.sql` — generated from
   `prisma migrate diff --from-migrations --to-schema-datamodel --script` against a scratch
   shadow DB (docker `p4u4_shadow`, dropped at task end), then hand-idempotent-ised:
   ```sql
   ALTER TYPE "BlStatus" ADD VALUE IF NOT EXISTS 'FINAL';
   ALTER TYPE "BlStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
   ALTER TYPE "BlStatus" ADD VALUE IF NOT EXISTS 'RELEASED';
   ```
2. `20261004000001_bl_issued_backfill/migration.sql` — the recorded backfill, a separate
   transaction so the new value is committed before it is used (second run = 0 rows):
   ```sql
   UPDATE "bills_of_lading" SET "status" = 'APPROVED' WHERE "status" = 'ISSUED';
   ```

**Applied:** `prisma migrate deploy` → both applied; `migrate status` → **35 migrations … up
to date**; `migrate diff --from-migrations --to-schema-datamodel` vs a fresh shadow DB →
**`-- This is an empty migration.` ("No difference detected.")**; shadow DB dropped.
`npx prisma generate` re-run. **No column drops, no enum values removed.**

**Backfill verified live immediately after deploy:**
`SELECT status, count(*) FROM bills_of_lading` → `DRAFT 1 | APPROVED 2` (zero `ISSUED`).

---

# Part 2 — Recorded decisions (implementation details this unit had to settle)

## Issue-endpoint mapping (prompt: decide and record)

**Chosen: `POST /bills/:id/issue` = composite alias walking the table's own edges —
`DRAFT → FINAL → APPROVED` atomically (single click), or `FINAL → APPROVED` when already
FINAL; any other source state → 409 from the table.** Two explicit edges are also exposed:

- `POST /bills/:id/finalize` — `DRAFT → FINAL` (API/automation; the shipped page never calls
  it — a FINAL bill still shows Issue + Cancel, so **the UI can never strand a bill**);
- `POST /bills/:id/approve` — `FINAL → APPROVED` (identical stamp/freeze semantics via a
  shared `approveCore()`, so alias and explicit edge cannot drift).

Both new routes are guarded by the **existing `bill:issue` permission (no new permission
codes)** and `@HttpCode(200)`. Justification: workflows §3.1 step 7 is ONE moment
("finalized/approved and issued" — ADR-046 quotes this conflation), and the issued-equivalent
`APPROVED` is what unblocks D-O/R-O; a two-click Final→Approve flow would strand the shipped
page (no Approve button exists there). This is exactly ADR-045's "aliased during transition,
then renamed" (rename remains a future U7 item; recorded in code comments).

**RELEASED edge guard (prompt: inert with a recorded minimal guard):** the table contains
`APPROVED: ['RELEASED']`, but **no endpoint dispatches it** — there is deliberately **no
`POST /bills/:id/release` route** (404, proven by test). The strongest possible guard is
absence of a dispatcher; U6 adds the route behind `bill:release` + the `AuditLog` entry.
`RELEASED` is otherwise terminal (all four transitions 409 — proven by a prisma-forced row).

## Other recorded choices

- **Cancel:** exactly ADR-046's set — `DRAFT|FINAL → CANCELLED`, reason mandatory, `CANCELLED`
  terminal. **Consequence recorded:** the shipped surrender edge (`ISSUED → CANCELLED`) is
  *not* carried forward — ADR-046 says "exactly this set", so `APPROVED` bills cannot be
  cancelled. The cancel path's stamp-clearing branch therefore becomes unreachable-by-design
  (nothing is both stamped and cancellable); code kept, comment records why.
- **EDITABLE_STATUSES stays `['DRAFT']`** — FINAL is structurally frozen (nothing in either
  ADR says FINAL accepts edits; freezing at finalize is the conservative reading).
- **Issued columns:** `issuedAt`/`issuedById`/`dateOfIssue` still written at `APPROVED`
  (no renames this unit — column renames are out of scope; recorded).
- **Stamping** still happens only when reaching `APPROVED` (finalize alone stamps nothing).
- **Eligibility pre-check** in `delivery-release.eligibility()` swaps its state token to
  `APPROVED` **only** — ruling 3's policy (APPROVED + fully paid) is U6's job, untouched.

## Vocabulary-consumer checklist (Phase-3-unit-4 discipline)

| # | site | before | after |
| --- | --- | --- | --- |
| 1 | `prisma/schema.prisma` `enum BlStatus` | DRAFT, ISSUED, CANCELLED | + FINAL, APPROVED, RELEASED (ISSUED retained) |
| 2 | `bill.service.ts` `BILL_TRANSITIONS` | DRAFT→[ISSUED,CANCELLED], ISSUED→[CANCELLED] | exact ADR-046 set (incl. inert APPROVED→RELEASED; ISSUED=[] legacy) |
| 3 | `bill.service.ts` `issue()` | DRAFT→ISSUED write | composite alias → `APPROVED` (via `assertTransition` per edge) |
| 4 | `bill.service.ts` cancel docstring | DRAFT\|ISSUED | DRAFT\|FINAL (logic unchanged — table-driven) |
| 5 | `bill.service.ts` `finalize()` / `approve()` / `approveCore()` | — | new (above) |
| 6 | `bill.controller.ts` | — | + `POST :id/finalize`, `POST :id/approve` (bill:issue, HttpCode 200); no release route |
| 7 | `bill/dto/bill.dto.ts` `BillStatusValues` | 3 values | 6 values |
| 8 | `delivery-release.service.ts:37-46` gate | `status !== 'ISSUED'` + message | `!== 'APPROVED'` + "must be APPROVED (current: …)" |
| 9 | `delivery-release.service.ts:88-96` eligibility | `!== 'ISSUED'` | `!== 'APPROVED'` (token only; comment cites U6 for policy) |
| 10 | `delivery-release` `assertNoActive`/`billFinancials`/DO-RO cancel | document/invoice `'ISSUED'` | **untouched** (own enums — verified, not bill status) |
| 11 | `packages/shared/src/bill.ts` `BillStatus` | 3-value union | 6-value union (guard = shared ⊆ Prisma still holds) |
| 12 | `bills/page.tsx` `STATUSES` filter | DRAFT, ISSUED, CANCELLED | DRAFT, FINAL, APPROVED, RELEASED, CANCELLED (ISSUED kept out: retained-but-unreachable) |
| 13 | `bills/page.tsx` `statusVariant` | DRAFT/ISSUED/default | + FINAL→warning, APPROVED/RELEASED→success, ISSUED→success (legacy), default→danger (**?? fallback — no blank badge**) |
| 14 | `bills/page.tsx` Issue button | `DRAFT` only | `DRAFT \|\| FINAL` (alias from FINAL — no stranding) |
| 15 | `bills/page.tsx` Cancel button | `DRAFT \|\| ISSUED` | `DRAFT \|\| FINAL` (edge set) |
| 16 | `bills/page.tsx` issued-on badge | `status === 'ISSUED'` | `status === 'APPROVED'` |
| 17 | `delivery-orders/page.tsx:88` | `/bills?status=ISSUED` | `?status=APPROVED` (its OWN status filters left as ISSUED/CANCELLED — separate enum, verified) |
| 18 | `release-orders/page.tsx:117` | `/bills?status=ISSUED` | `?status=APPROVED` (same) |
| 19 | `messages/{en,ar,fa}.json` `bill.status` | DRAFT/ISSUED/CANCELLED | + FINAL/APPROVED/RELEASED (3 lines each; translations: Final/Approved/Released, نهائية/معتمدة/مُفرَجة, نهایی/تأییدشده/آزادشده) |
| 20 | `prisma/seed.ts` | no bill statuses created | N/A (verified: seed creates no bills) |
| 21 | invoice/proforma/voucher `'ISSUED'` sites | own enums | **untouched** (invoice voyage check status-agnostic — verified, per prompt) |

**Create paths (scope item 6):** both `createFromManifest` and `createFromCargo` still write
`status: 'DRAFT'` — unchanged, verified by the untouched create tests asserting `DRAFT`.

---

# Tests (roadmap Test 4 part 1) — delta **374 → 377**

New:
1. **bill.e2e — backfill:** full list has **zero `ISSUED` rows**; `BOL-2609-00001/2` (the
   two shipped legacy-issued bills) are `APPROVED`; `BOL-2609-00003` still `DRAFT`
   (backfill touches ISSUED only); every observed status ∈ the ADR-046 set.
2. **bill.e2e — edge set:** `finalize` DRAFT→FINAL (200) / FINAL→FINAL (409); **approve on
   DRAFT → 409 (the "DRAFT→APPROVED direct" reject)**; FINAL→APPROVED explicit (200);
   **alias from FINAL** (finalize → issue → 200 APPROVED); APPROVED→FINAL / re-issue /
   cancel → 409; **prisma-forced RELEASED row → issue/finalize/approve/cancel all 409**
   (RELEASED terminal) and `POST …/release` → **404 (inert-edge guard)**.
3. **delivery-release.e2e — gate vocabulary:** FINAL bill → D-O create 409 with
   `"APPROVED"` in the message; `FINAL → CANCELLED` (reason path) → 409 with `"APPROVED"`;
   prisma-forced RELEASED → **both D-O and R-O** create 409 with `"APPROVED"` (DRAFT
   rejection already covered by the existing `409 against DRAFT bill` test).

## Re-pointed assertions — **10 test sites** (each justified; no assertion weakened)

| # | file/site | old → new | justification |
| --- | --- | --- | --- |
| 1 | bill.e2e header `Lifecycle under test` | old edge list → ADR-046 set + alias + inert RELEASED | documents the shipped rule |
| 2 | bill.e2e issue test title | `DRAFT->ISSUED` → `DRAFT->APPROVED (issue alias)` | the shipped edge changed per ADR-046 |
| 3 | bill.e2e `expect(issued.status).toBe('ISSUED')` | `'APPROVED'` | issued-equivalent is the shipped state now (still asserts the exact terminal document state) |
| 4 | bill.e2e cancel test (title + body) | cancelled the issued bill1 → **fresh DRAFT bill claims the freed line, `finalize`, then cancel** | APPROVED cannot cancel under the exact ADR-046 set; keeps every assertion (reason 400, CANCELLED+reason, line released & eligible again, terminal) |
| 5 | bill.e2e cancel-test tail | "cancel again" retargeted to the CANCELLED bill + **new explicit APPROVED-cancel 409** + delete-409 kept | true terminal test + the new edge reject |
| 6 | bill.e2e list filters | `CANCELLED ∋ bill1` → `CANCELLED ∋ cancelledBillId` **+ new `APPROVED ∋ bill1` filter assertion** | bill1 no longer cancels; adds stronger coverage of the new bucket |
| 7 | delivery-release header comment | `B/L must be ISSUED` → `APPROVED (issued-equivalent, P4-U4)` | vocabulary |
| 8 | delivery-release `let billId` comment | `ISSUED B/L` → `APPROVED B/L` | vocabulary |
| 9 | delivery-release chain comment | `→ ISSUED bill` → `→ APPROVED bill (issue alias)` | vocabulary |
| 10 | delivery-release DO test title | `against ISSUED bill` → `against APPROVED bill (issued-equivalent)` | fixture now lands APPROVED via the alias (body assertions on DO status untouched — DO's own enum) |

Not test-affecting (code strings): `requireIssuedBill` error message → "must be APPROVED
(current: …)"; two comments in delivery-release + the issue/cancel docstrings.

Suite support: suite var `cancelledBillId` (consumed by the list-filter test; the fresh
cancel bill is created with `manifestId` so the existing afterAll hard-cleanup clause
catches it — no cleanup changes needed).

---

# UI gate (protocol §3.1) — **PASS**, driven with screenshots

Counts **before**: bills 3 | manifests 4 | cargos 55 | voyages 21 | D-Os 2. Live statuses:
`BOL-2609-00003 Draft`, `BOL-2609-00002/00001 Approved` (the backfill is visible in the
list itself). Fixture: fresh voyage + loaded chain + APPROVED manifest `MAN-2610-00001`
(eligible rows = 1).

- **(a) list badges, ≥2 distinct states, no blank/undefined:** DOM probe → rows
  `Draft | Approved | Approved`, `distinctStates: ["Draft","Approved"]`,
  `blankOrUndefined: []`, `errs: []`. Screenshot `p4u4-gate1-badges.png`
  **vision-verified**: Draft = grey badge, Approved = green ×2, all labelled, no
  "undefined", two distinct states.
- **(b) issue flow → issued-equivalent, API-verified:** shipped page create →
  `POST /bills 201` (title `BOL-ABBR-3C0OU7-2610-00001`, Draft badge), Add-line picker
  `#1 — CRG-2610-00117` → `201`, **Issue → `POST /bills/:id/issue 200`**; detail shows
  subtitle **"Approved — MAN-2610-00001 (KHALIFA → ABBR-3C0OU7)"** + issued-on badge
  (DOM innerText), Issue button correctly gone, Cancel correctly absent (APPROVED not
  cancellable), `non2xx: []`, `errs: []`. **API read-back: `status = APPROVED`,
  `issuedAt` + `dateOfIssue` set, 1 item** — `p4u4-gate2-approved.png` vision-verified
  (title + "Approved" subtitle, no error banners; the header badge row was above the
  screenshot's scroll position, DOM-probed instead).
- **(c) D-O page accepts APPROVED:** `delivery-orders` page fetched
  **`/api/v1/bills?status=APPROVED&pageSize=100 → 200`** (the exact query this unit
  changed) and its picker offered the fixture bill + both backfilled legacy bills;
  "New D/O" → recipient filled → **`POST /delivery-orders → 201`, `DO-2610-00001`**
  created against the APPROVED bill; `non2xx: []`, `errs: []` — with the old
  `status=ISSUED` query this picker would have been empty post-backfill, so this is the
  regression the swap exists to prevent. Screenshot `p4u4-gate4-do-created.png`.
- **(d) collectors:** across all four captured states — **0 console errors, 0 non-2xx
  fetches** (7 fetches on the bills flow, 1+ on the DO flow).
- **Cleanup (explicit ids only):** D-O → bill items → bill → manifest line → manifest →
  AL item → AL → LL item → LL → inspection → cargo → voyage → `NumberingSequence` by
  exact name — every delete scoped to one id/name from `p4u4-gate-fx.json`/the gate bill
  id (U2 incident applied: no undefined filter). Counts after: **bills 3 | manifests 4 |
  cargos 55 | voyages 21 | D-Os 2 — identical to before**; `manifestItems total = 4`
  (no orphan litter); post-cleanup full suite **377/377/0**.

---

# Verification (verbatim)

1. Baseline first run at 2dfc9b4 → **374/374/0 (22/22)** ✅
2. Official triplet after the change → **377/377/0 ×3** (`p4u4-r1/r2/r3.json`); per-suite
   all green; vs baseline the **only** delta is +3 new tests (bill.e2e +2, delivery-release
   +1); a 4th post-cleanup run also **377/377/0** ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `npx prisma migrate status` → **35 migrations … up to date** (2 added: enum + backfill);
   shadow `migrate diff` → **empty ("No difference detected.")**; shadow DB dropped ✅
5. `pnpm --filter @shipping/web test` → `CONTRACT GUARD OK — 18 shared status unions ⊆
   Prisma enums; 84 web api.post routes ⊆ 92 controller @Post routes` (exit 0 — 90→92 from
   the two new endpoints, web still ⊆) ✅
6. Servers → **API 200, WEB 200** before/after, never restarted ✅
7. Porcelain = bill controller/service/dto + delivery-release service + 2 e2e suites +
   `prisma/schema.prisma` + 2 migration dirs + shared/bill.ts + bills/DO/RO pages + 3
   message files + this log ✅ (nothing else)

## TRANSLATION_CHANGES

3 test-fixture/meaning-bearing comments and titles were re-pointed per the vocabulary (see
the 10-site table); i18n additions are keys-only (`bill.status.{FINAL,APPROVED,RELEASED}`
in en/ar/fa, 3 lines each).

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit4-bl-lifecycle
PHASE: Phase 4 — B/L Rewrite (unit 4 / P4-U4)
DB_MIGRATION_STATUS: 35 up to date, shadow clean — two additive files by design
  (20261004000000_bl_lifecycle_enum: ADD VALUE IF NOT EXISTS ×3; 20261004000001_bl_issued_backfill:
  idempotent UPDATE ISSUED->APPROVED, split into its own transaction because PostgreSQL cannot
  USE a value added in the same transaction); live verify: DRAFT 1 / APPROVED 2 / 0 ISSUED;
  no column drops, no enum values removed
UI_GATE: PASS with driven evidence — (a) list shows Draft (grey) + Approved (green) badges,
  distinctStates ["Draft","Approved"], zero blank/undefined badges, 0 console errors
  (vision-verified screenshot); (b) shipped-page create 201 (Draft) → add line 201 → Issue 200
  → subtitle "Approved — MAN-2610-00001" + issued-on badge + API read-back status=APPROVED
  with issuedAt/dateOfIssue (vision-verified; Issue/Cancel buttons correctly absent on
  APPROVED); (c) D-O page fetched /bills?status=APPROVED → 200, picker offered the fixture +
  2 backfilled bills, New D/O → POST /delivery-orders 201 (DO-2610-00001) — proved in UI,
  not just API; (d) 0 console errors, 0 non-2xx across all captured states. Counts restored
  (bills 3 / manifests 4 / cargos 55 / voyages 21 / D-Os 2); fixtures hard-deleted by
  explicit id/name filters only; manifestItems 4 (no litter); post-cleanup suite green.
SCHEMA_CHANGES: additive only — BlStatus + FINAL/APPROVED/RELEASED (ISSUED retained); ISSUED
  -> APPROVED backfill; nothing dropped, no other columns
CODE_CHANGES: bill.service — BILL_TRANSITIONS rewritten to the exact ADR-046 set (inert
  APPROVED->RELEASED entry, ISSUED=[] legacy), issue() = composite alias DRAFT|FINAL->APPROVED
  (assertTransition per edge, no direct DRAFT->APPROVED entry), new finalize()/approve() with
  shared approveCore() (identical stamp/freeze), cancel docstring per new edges; bill.controller
  — +POST :id/finalize and :id/approve (existing bill:issue permission, @HttpCode(200),
  NO /release route = the recorded inert guard); dto BillStatusValues 6 values;
  delivery-release — both bill gates + eligibility token -> APPROVED with new message (invoice/
  own-doc ISSUED sites verified untouched); shared BillStatus union extended; web — bills page
  filter/variants/buttons/badge + DO+RO bill pickers -> APPROVED + i18n bill.status ×3 languages
  (ISSUED kept in enum/union but excluded from the page filter: retained-but-unreachable)
ISSUE_MAPPING: POST /bills/:id/issue = composite alias walking table edges DRAFT -> FINAL ->
  APPROVED atomically (or FINAL -> APPROVED); explicit POST /finalize (DRAFT->FINAL) and
  POST /approve (FINAL->APPROVED) exposed under the existing bill:issue permission; FINAL is
  never a dead end in the UI (Issue/Cancel stay visible on FINAL); shipped Issue button works
  end-to-end (gate b); rename of /issue remains a future U7 item per ADR-045
TEST_CHANGES: baseline 374/374/0 -> triplet 377/377/0 x3 + post-cleanup 4th green (+3:
  backfill correctness, full edge set incl. 409s/RELEASED-terminal/404 release route, D-O+R-O
  gate vocabulary); 10 re-pointed test sites enumerated above, none weakened
REPOINTED_ASSERTIONS: 10
TRANSLATION_CHANGES: test comments/titles only (10 sites); i18n keys added in en/ar/fa
  (bill.status.FINAL/APPROVED/RELEASED)
GIT_VERIFICATION: porcelain = the files listed in Verification #7 (+ this log); committed at
  task end so the tree ends clean; contract guard OK; servers never restarted
UNRESOLVED_ISSUES: (1) carry-overs unchanged: portal destination-scoped B/L visibility,
  manifest.dto stale Swagger text, B/L number column wrap (pre-existing, U3);
  (2) recorded consequences for the decision-maker: the surrender edge (ISSUED/APPROVED ->
  CANCELLED) is gone per ADR-046 "exactly this set" — if surrender is needed later it is an
  ADR amendment; the cancel path's stamp-clear branch is unreachable-by-design; issuedAt/
  issuedById/dateOfIssue column names kept (renames out of scope)
NEEDS_BUSINESS_DECISION: none new — ADR-046 closed §1.1a/§1.1b/§1.2; no new business
  question surfaced during execution
BLOCKED: none
HANDOFF_TO: decision-maker (unit-4 verification → P4-U5 revisions or the next ADR-045
  decision-6 unit; U6 owns bill:release + AuditLog + ReleaseOrder ruling-3 policy; U7 owns
  the /issue rename and any web rework)
```
