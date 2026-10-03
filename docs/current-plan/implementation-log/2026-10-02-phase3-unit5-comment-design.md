# 2026-10-02 — Phase 3 unit 5: Comment editing/visibility — DESIGN + ADR-044 (design-first)

## Task ID

phase3-unit5-comment-design

## Phase

Phase 3 — Operational Flow Reconciliation (unit 5)

## Objective

DESIGN-FIRST unit: turn the employer's comment requirements into a recorded design + ADR-044 —
settling the canonical comment column (technical), deciding required/deletable/visibility with
citations, and recording NEEDS_BUSINESS_DECISION wherever the employer evidence is genuinely
ambiguous. Backend/UI work only where evidence is unambiguous and self-contained (none was —
see Part 3).

## Prompt reference

- Roadmap `09-final-implementation-roadmap.md` §3 Phase 3: `Scope: "Comment editing and
  visibility"`; `Tests: "Comment edit/delete visibility"`; `Acceptance: "Comment is editable and
  visible to relevant users."`; `UI changes: "Comment handling."`
- Scope/sequence fully pre-framed in `11-implementation-state.md` ("NEXT — Phase 3 unit 5" block).
- Protocol `10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.

## Environment (including one incident, recorded)

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD **1e54867**, porcelain **0** at start.
- User's servers, never restarted: API `:3101` **200 before/after**, WEB `:3000` **200 before/after**.
- **pnpm incident (environment drift, not a project defect):** the `pnpm` binary was gone from
  PATH at task start (EXIT 127) while `node_modules` was fully intact (886 `.pnpm` entries).
  Diagnosis: `node_modules/.modules.yaml` declares `packageManager: pnpm@9.15.9`,
  `storeDir: …/store/v3`. A first restore attempt (`npm i -g pnpm@11`) was **blocked by pnpm's
  no-TTY purge guard** — it wanted to remove the modules directory and aborted without a TTY;
  the tree was never touched (count re-verified 886 after every step). Installed the tree's own
  version via global npm: **`npm install -g pnpm@9.15.9`** → `pnpm --filter api test` works
  normally. **The forbidden `npx pnpm` path was never used**; no install/reinstall of the repo's
  dependencies was run; servers unaffected.

## Baseline before touching anything (verification step 1 — ACCEPTED)

```
Test Suites: 22 passed, 22 total
Tests:       365 passed, 365 total
```

First run at 1e54867 (tree clean) — matches the stated baseline 365/365/0 (22/22).

## Required reading (verbatim quotes used in the design)

- `01-final-requirements.md:69-73`: "Cargo captures: … Comment." / **"Comment is required,
  editable, and deletable."** / **"Comments capture operational events so that accountants and
  others can see history without relying on informal channels."**
- `03-final-workflows.md:15` (Customer 360): "System shows overview, invoices, payments, ledger,
  balance, jobs, cargo history, B/L history where relevant, **comments/activity**."
  `:25/:28` (cargo intake): "User enters Shipper, … arrival date, documents, **comment**." /
  "Office adds **Comment** for operational notes."
- `06-final-ui-blueprint.md:93` (Customer 360): "Tabs or sections for: overview, jobs, cargo,
  B/Ls, invoices, payments, ledger/balance, **comments/activity**." `:102-103` (cargo):
  "Create/edit with customer-first, then shipper, ports, yard, documents, **comment**. —
  **Comment visible and editable.**"
- `08-requirement-traceability.md:199-203`: heading "**Comment is required, editable, deletable**"
  — employer evidence: transcripts; requirement: "operational notes visible to accountants and
  others"; target behavior: "Comment field editable/deletable; visible where relevant";
  Module: Cargo, UI; **Phase: Phase 3.**
- Roadmap §3 Phase 3 items quoted above; `12-open-business-decisions.md`: **grep found no
  comment entry** — nothing pre-ruled.

## Shipped reality (probed this unit, all cited in ADR-044)

- `schema.prisma:450-451`: `comments String?` **and** `comment String? @map("comment")`.
- DTOs both optional: `cargo.dto.ts:131/136` (create), `:284/289` (update) → "required"
  enforced nowhere.
- Service: selects both (`cargo.service.ts:56-57`), writes both (`:186-187` create, `:256-257`
  update; PATCH semantics verified: `comments: dto.comments` — `''` clears, `undefined` skips).
- Web binds **only** `comments`: form state `cargo/page.tsx:65/:85/:106`, textarea `:772-779`,
  detail `:862-866`, payload **`:927` sends only when non-empty** (clear-from-UI gap).
- `packages/shared/src/cargo.ts:97` types **only** `comments`.
- Repo-wide greps: **zero** consumers of the singular `comment` outside the cargo module (no
  endpoint, no seed row, no web send/read, no portal), **zero** in seed, no comment endpoints.
- **Live DB probe:** 56 cargo rows — `comment` non-null **0**, `comments` non-null 1, both 0 →
  the orphan column holds no data (backfill = no-op; drop would lose nothing).
- **Tests:** `comments` (canonical) mentioned **0 times**; the orphan has 4 assertions
  (`cargo-inventory.e2e-spec.ts:385/:404/:439/:448`, title `:427`).
- No audit/history table; no Customer 360 (roadmap §2.2); seed roles = **Administrator +
  Operations only** (`seed.ts:219-243`) — no accountant role exists; cargo permissions =
  `cargo:read/create/update/transition/delete`.

## Part 1 — canonical comment column (technical ruling; NOT an employer question)

**Ruling: `comments` is canonical.** Convergence is one-directional: the employer-facing Comment
is the web-bound `comments` textarea/detail line; `shared` already types only it; the singular
`comment` is a Phase-3A duplicate consumed by nothing and holding 0/56 rows. Two columns with
the same purpose and divergent writes = latent data-integrity defect.

**Cleanup path (SPECIFIED; execution deferred to a later unit — this unit changed no code,
schema or tests):**
1. *Code unwire (no migration):* remove `comment: true` from the select (`cargo.service.ts:56`),
   the writes (`:187`, `:257`), and the DTO fields (`cargo.dto.ts:136`, `:289`); repoint the 4
   orphan test assertions (+ title) to `comments` citing ADR-044 — this *adds* coverage for the
   canonical field (currently zero test mentions).
2. *Data:* `UPDATE "Cargo" SET comments = COALESCE(comments, comment) WHERE comment IS NOT NULL
   AND comments IS NULL;` — idempotent safety step, a no-op against today's data.
3. *Column drop:* **destructive → not authorized by default** (additive-only migration rule);
   requires explicit decision-maker approval at execution. Order: 1 → 2 → approval → drop.
No migration was introduced by this unit.

## Part 2 — design + ADR-044 (appended to `docs/decisions.md`, order 041→042→043→044 preserved)

**(a) Required — DECIDED:** employer intent unambiguous (§1.5, intake steps 4/7, traceability).
Reconciled with "deletable": required **at creation** (else the two words contradict). Enforced
in the cargo **create FORM** by the Phase 3 UI unit; `CreateCargoDto` stays optional for this
phase because DTO-level `@IsNotEmpty` would invalidate every comment-less creation across all 22
suites + seed (0 fixtures send `comments`) — recorded as follow-up hardening once forms and
fixtures carry comments. Sequencing choice, not employer ambiguity.

**(b) Deletable — DECIDED (conditional on (d)):** **clear-to-empty** — one string with no
versions has no other faithful delete primitive. API already supports `comments: ''` on PATCH;
the gap is web-only (`cargo/page.tsx:927`) → UI unit always-sends. No soft-history/per-entry
delete (both presuppose (d)); if the employer rules append-only, this clause re-opens as
"entries deletable per log policy".

**(c) Visible to relevant users — DECIDED:** existing **`cargo:read`** (view — comment renders
where cargo detail renders) / **`cargo:update`** (edit), **no new permission codes**. "Accountants
and others": no accountant role exists (seed = Administrator + Operations) — a future accounting
role gains visibility by being granted `cargo:read` (pure role configuration, no code). Customer
360 comments/activity tab scoped **out of Phase 3** because Customer 360 doesn't exist
(roadmap §2.2); when built it reads the same canonical column. Acceptance mapping: *editable* =
cargo form + UI-unit required/clear fixes; *visible* = cargo detail now, C360 tab later.

**(d) Single mutable field vs append-only comment/activity log — NEEDS_BUSINESS_DECISION
(employer).** The employer's own texts conflict: field-side "required, editable, and
deletable"/"Comment visible and editable"/"Comment field editable/deletable" vs log-side
"capture operational events … see history"/Customer 360 "comments/activity"/"Office adds
Comment". Shipped model (bare string, no versions/author/timestamps) cannot express history.
Question for the employer: (i) one mutable field (no audit) vs (ii) `CargoComment` append-only
log (entries, author, timestamp; how it reconciles with "deletable"; what happens to existing
`comments` text; where rendered). **Neither implemented**; decisions 1–4 hold under either
answer, so this NBD does not block the UI unit's form/clear/visibility work.

## Part 3 — implementation slice: DECLINED (recorded reasons)

No code/schema/test change. Reasons: (i) Part 1 explicitly defers cleanup *execution* to a
later unit, and shipping the code-half alone would leave a half-state (DTO rejecting `comment`
while the column still exists) plus 4 test-subject rewrites before the decision-maker has even
seen ADR-044; (ii) every employer-facing change (form-required, clear-to-empty send, visibility
surface) is either UI-unit scope or depends on (d); (iii) the orphan write path is provably
dormant (0 senders, 0 rows). Everything ambiguous stays design-only as instructed.

## Part 4 — state doc updated (`11-implementation-state.md`)

- Top summary: unit 5 marked **COMPLETE** with ADR-044, NBD carried, and NEXT = Phase 3 UI unit.
- The former "NEXT — Phase 3 unit 5" task block replaced by the recorded outcome: decisions
  1–4 with citations, the NBD (d), slice status, and the verification numbers.
- Stale pre-design paragraphs (evidence/shipped-reality/"must decide") rewritten to past-tense
  verified statements + UI-unit scope.
- Authorized follow-ups: added **(f) Cargo Comment cleanup unit** (ADR-044 decision 1 order)
  with DTO-required-enforcement attached to it.

## Verification (all mandatory — verbatim)

1. Baseline first run at 1e54867 → **365/365/0 (22/22)** ✅
2. **Triplet, three consecutive full runs, identical:**

   ```
   run 1: Test Suites: 22 passed, 22 total / Tests: 365 passed, 365 total
   run 2: Test Suites: 22 passed, 22 total / Tests: 365 passed, 365 total
   run 3: Test Suites: 22 passed, 22 total / Tests: 365 passed, 365 total
   ```

   Per-suite comparison: **identical across all three AND identical to baseline** (22 suites;
   design-only unit — no count moved, as expected) ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `npx prisma migrate status` → **32 migrations found … Database schema is up to date!** —
   and **no migration was introduced by this unit** (design-only), so the shadow
   `migrate diff` step is not applicable per the prompt's condition ✅
5. Servers before/after → **API 200, WEB 200**, never restarted ✅
6. Contract guard → `CONTRACT GUARD OK — 18 shared status unions ⊆ Prisma enums; 84 web
   api.post routes ⊆ 90 controller @Post routes` via `pnpm --filter @shipping/web test`
   (exit 0). The design adds no status union and no `api.post` route, so nothing to update ✅
7. **UI gate: NOT APPLICABLE** — the unit is design-only (no user-visible component changed);
   recorded with that reason per protocol §3.1 ✅
8. Porcelain: only `docs/decisions.md` (ADR-044 append), `docs/current-plan/11-implementation-
   state.md`, this log; **`prisma/` = 0, `apps/api/src` = 0, `apps/web/src` = 0,
   `packages/shared` = 0** — everything committed at task end so the tree ends clean (commit
   hash reported in the task report).

## TRANSLATION_CHANGES

none

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase3-unit5-comment-design
PHASE: Phase 3 — Operational Flow Reconciliation (unit 5, design-first)
DB_MIGRATION_STATUS: none — no migration introduced (design-only); migrate status still 32 up to date
UI_GATE: NOT APPLICABLE — design-only unit; no user-visible component changed
SCHEMA_CHANGES: none
CODE_CHANGES: none (design-first; the optional slice was declined with recorded reasons).
  Docs only: docs/decisions.md + ADR-044 appended (order 041→042→043→044);
  11-implementation-state.md updated (unit-5 status, decisions, carried NBD, follow-up (f))
TEST_CHANGES: none — baseline 365/365/0 -> triplet 365/365/0 ×3 (per-suite identical to
  baseline); contract guard green (no new status union / api.post route to guard)
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = docs/decisions.md + 11-implementation-state.md + this log only;
  prisma/ = 0; apps/api/src = 0; apps/web/src = 0; packages/shared = 0; committed at task end
  (tree clean post-commit; hash reported in the report)
UNRESOLVED_ISSUES: none new. Canonical-column cleanup + DTO-required-enforcement deferred by
  design (authorized follow-up (f), ADR-044 decision 1 order)
NEEDS_BUSINESS_DECISION: (d) single mutable field vs append-only comment/activity log —
  employer texts conflict internally ("editable and deletable" vs "capture operational
  events … see history"); shipped model cannot express history; neither implemented;
  decisions 1–4 invariant under either answer
BLOCKED: none
HANDOFF_TO: decision-maker (unit-5 verification → Phase 3 UI unit: comment handling per
  ADR-044 + the unit-4 coverage-note items; employer ruling needed for NBD (d))
```
