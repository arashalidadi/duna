# 2026-10-03 — Phase 3 unit 6: Comment UI (final Phase 3 unit) — roadmap "UI changes: Comment handling"

## Task ID

phase3-unit6-comment-ui (RESUMED at the reporting step — see Incident)

## Phase

Phase 3 — Operational Flow Reconciliation (unit 6, final unit)

## Objective

Ship the roadmap's remaining UI item — *Comment handling* — per ADR-044 decisions **2–4 only**
(decision 5 / field-vs-log stays an open NEEDS_BUSINESS_DECISION: single-field model, no
CargoComment table, no history UI), close the two remaining unit-3 §4.2 coverage-note items,
add the Comment edit/delete e2e coverage, and settle whether Phase 3 can be declared CLOSED.

## Prompt reference

- Roadmap `09-final-implementation-roadmap.md` §3 Phase 3: `UI changes: Comment handling`,
  `Tests: Comment edit/delete visibility`, `Acceptance: "Comment is editable and visible to
  relevant users."` (third of three criteria).
- `ADR-044` (`docs/decisions.md`, appended by unit 5) — decisions 1–5; this unit implements
  2 (required at create), 3 (clear-to-empty), 4 (visibility via existing permissions);
  defers the orphan-column cleanup to authorized follow-up (f).
- `11-implementation-state.md` → "Phase 3 UI unit scope for comments" block; unit-3 §4.2
  coverage-note table; unit-4 log UNRESOLVED (two items assigned here).

## Incident — context loss at the reporting step (recorded honestly)

The prior run of this task completed **all four parts of the work** — code edits, the +1 test,
the baseline + triplet runs, and the driven UI gate (a)–(d) with screenshots — but then **lost
its context before writing the log/report and emitted an unrelated response instead**. The
repository kept everything (4 files modified, uncommitted at `0712a8e`), and the decision-maker
independently re-verified the state before re-issuing the task as RESUME: suite
**366/366/0 (22/22)**, tsc **0 / exactly 3 pre-existing / 0**, migrate status **32, no new
migration**, contract guard **OK**, fixtures cleaned (cargo 55, no U6 rows), porcelain =
exactly the 4 files. This log is **reconstructed from the surviving scratch evidence**
(`scratch/p3u6-base.json` = 365/365/0; `p3u6-r1/r2/r3.json` = 366/366/0 ×3) plus the
decision-maker's verification, with two evidence gaps closed by this resumed run (below).

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD **0712a8e** (unit-5 commit), tree clean
  at start of both runs; pnpm **9.15.9** (restored in unit 5, still in PATH).
- User's servers, never restarted: API `:3101` **200**, WEB `:3000` **200** (before/after).
- Tests via `pnpm --filter <pkg> test` (root `pnpm test` self-recurses — pre-existing, untouched).

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       365 passed, 365 total
```

(`scratch/p3u6-base.json`, 365/365/0/22 — matches the stated baseline exactly.)

## Part 1 — Comment handling per ADR-044 (all in `apps/web/.../cargo/page.tsx`)

- **(a) Required at create (decision 2):** `submit()` gained a create-only guard after the
  existing customer/port/type check — empty/whitespace Comment on **create** blocks with
  `Comment is required — add the operational notes for this cargo.`; **edit stays optional**
  (label shows `Comments *` only when `!editing`; textarea `required`/`aria-required` only when
  `!editing`). Guidance line added under the textarea per `01-final-requirements.md:70-73`:
  *"Operational notes for this cargo — visible to accountants and others with cargo access.
  Required at creation; editable and clearable later."* (`editing ? … : …` variant).
  **`CreateCargoDto` untouched** — still optional (DTO enforcement = deferred follow-up (f)).
- **(b) Clear-to-empty (decision 3):** `buildPayload()` line `if (f.comments.trim())
  payload.comments = …` → **always** `payload.comments = f.comments.trim()` — one shared
  builder, so **create AND update** paths always send the field; an emptied textarea reaches
  the API as `''` and `PATCH … comments: ''` clears the column (docstring updated to name
  `comments` as the documented exception to the omit-empty rule).
- **(c) Visibility (decision 4):** comment renders on the cargo detail panel (now always — see
  gap-closure below), gated by existing `cargo:read` (view) / `cargo:update` (edit). No new
  permission codes, no Customer 360, no accountant role (none exists).
- **(d) Orphan column: untouched** — payload sends only `comments`; `comment` DTO/service/column
  left exactly as-is (cleanup = authorized follow-up (f)).
- **Evidence-gap closure this run:** the prior gate3 screenshot showed the detail scrolled with
  **no Comments area at all** (the panel previously rendered only when `comments` was
  truthy, so a cleared comment made the whole section disappear — the empty field was not
  *visible*). The detail panel now always renders `Comments` with the value or **`—`**
  (`detail.comments || '—'`, muted when empty), making clear-to-empty visibly provable
  and arguably matching "Comment is visible" even after deletion. Same authorized file; no
  type/permission/route change.

## Part 2 — Coverage-note cleanup (cosmetic + text only)

- **(a) `actual-loading/page.tsx`:** `STATUS_META.DRAFT` label `'Not started'` → **`'Draft'`**
  (aligns with the shipped 3-state model, ADR-041/042). Badge/filter logic untouched (one
  string). Driven proof: 4 seed DRAFT rows render "Draft", zero "Not started" anywhere,
  filter options now `All statuses / Draft / In progress / Completed / Cancelled`.
- **(b) `packages/shared/src/inspection.ts` header comment:** rewritten from the pre-Phase-3A
  description (`PENDING -> APPROVED | REJECTED`, `approve`/`reject` actions) to the shipped
  lifecycle (`PENDING --book--> BOOKED --done--> DONE`; `PENDING|BOOKED --fail--> FAILED`;
  `FAILED --needs-re-inspection--> NEEDS_REINSPECTION`; note that the status union lives in
  `cargo.ts`). **Comment-only — no type moved; test count moved only by the new test (+1).**
- **Unit-3 §4.2 table re-check:** *Inspection status UI* (stale `PENDING/APPROVED/REJECTED`
  STATUSES/STATUS_META + shared type) → **already shipped by unit 4** (not re-done);
  *LoadList status UI* → already 3-state correct (nothing to do); *AL status UI* → this unit's
  label fix; *Comment handling* → this unit; *cargo/yard filter parity + `??` fallbacks* →
  already shipped by unit 4.

## Part 3 — Tests (roadmap "Comment edit/delete visibility")

New single e2e test in `cargo-inventory.e2e-spec.ts` (green suite, fixtures cleaned by the
suite's `createdCargos` afterAll):
**`canonical comments round-trip: create shows it, PATCH without the field leaves it, PATCH "" clears (ADR-044)`**
— POST cargo with `comments` → `201` + field round-trips; GET → field present; PATCH **without**
`comments` → field unchanged (`undefined` = skip semantics); PATCH `comments: ''` → **clears**
(`''` on read-back); final GET → `''`. Five assertions covering create-visibility, omit-safety
and delete — the canonical field previously had **zero** test coverage (unit 5 evidence).

**Web-level coverage statement (explicit, per prompt):** `apps/web` has **no test harness**
beyond the static contract guard (`echo 'No web unit tests yet'` was replaced in unit 4 by the
guard only) — browser-behaviour coverage for this unit exists **only as the driven UI gate
below**, not as an automated suite test. Adding a browser test framework is out of scope for
Phase 3 (protocol: no browser test framework); recorded rather than silently skipped.

**Test delta: 365 → 366** (+1, `cargo-inventory.e2e-spec.ts` 32 → 33; every other suite
byte-identical).

## Part 4 — Implementation state doc updated

`11-implementation-state.md`: unit-6 status (COMPLETE, evidence paths, test delta 365→366),
the **Phase 3 CLOSED assessment** (see below), NBD (d) still carried to the employer,
authorized follow-up (f) unchanged (orphan-column cleanup + DTO-required later).

## Verification (verbatim)

1. Baseline first run at 0712a8e → **365/365/0 (22/22)** ✅ (`p3u6-base.json`)
2. Triplet after the change → **366/366/0 ×3** (`p3u6-r1/r2/r3.json`), per-suite comparison:
   only `cargo-inventory.e2e-spec.ts` moved **32 → 33**; all 22 suites green ✅ —
   independently re-run and reproduced by the decision-maker (366/366/0, 22/22).
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors (re-confirmed after the gap-closure edit); `pnpm --filter
   @shipping/shared build` → **0** ✅ (decision-maker re-ran all three as well).
4. `npx prisma migrate status` → **32 … up to date**; **no migration introduced** (schema
   untouched — `prisma/` = 0 files) ✅ (decision-maker verified).
5. Servers → **API 200, WEB 200**, never restarted ✅
6. Contract guard → `CONTRACT GUARD OK — 18 shared status unions ⊆ Prisma enums; 84 web
   api.post routes ⊆ 90 controller @Post routes (1 computed-tail … skipped)` (exit 0); the
   unit adds **no** api.post route and **no** shared status union (label/comment text only) ✅
7. Porcelain → exactly the intended set: **4 code files + this log + state doc**;
   `prisma/` = 0, no permission/route/DTO changes ✅ (decision-maker confirmed the 4 code
   files pre-resume; log + state doc added here).
8. **UI GATE: PASS** (driven on live data; all four screenshots vision-verified):

   | gate | evidence |
   | --- | --- |
   | (a) required blocks/accepts | Create dialog: `Comments *` + guidance line; empty submit → **dialog stays open, red error "Comment is required — add the operational notes for this cargo.", ZERO `POST /cargo` fired** (`cargoPosts: []`); with text → `POST /cargo → 201`. Screenshot `p3u6-gate1-required-blocked.png` (vision: star + guidance + red error + empty textarea + Cancel/Create). |
   | (b) comment visible after save | detail for the created cargo shows the Comments block with the text (DOM `commentVisible:true`, screenshot `p3u6-gate2-comment-on-detail.png` vision-verified: header "Comments" + quoted text). |
   | (c) clear-to-empty | **this run's re-capture:** Edit → textarea cleared → `Save changes` → **`PATCH /cargo/:id → 200`** → detail scrolled: Comments header present, value **`—`**, comment text absent → API row read-back **`comments=''`** (prior run) and the transition re-proven end-to-end this run. Screenshot `p3u6-gate3-comment-cleared.png` vision-verified (Comments = em-dash, old text NOT present, no errors). |
   | (d) AL DRAFT label | `/en/actual-loading`: **4 rows badge "Draft"**, "Not started" appears nowhere, filter options corrected. Screenshot `p3u6-gate4-al-draft-label.png` vision-verified. |
   | (e) console errors | cargo-page flow with collectors (list load, detail open/close, create-dialog open/cancel, status filter on/off, edit/save): **`consoleErrs: []`, fetchCount 7, non2xxFetches `[]`** (recorded above); AL page collectors `errs: []` as well. |

   **Counts:** before **cargo 55, non-empty comments 1** → transient fixture (CRG-2610-00116,
   gate3 run; earlier CRG-2610-00114/00115 from the prior run) → after cleanup **cargo 55,
   non-empty comments 1** — live counts unchanged; no pre-existing row was edited (the single
   pre-existing commented cargo was never touched); fixtures deleted (200) and confirmed absent.

## TRANSLATION_CHANGES

none (all changed surfaces use hardcoded English labels like their pages already did)

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase3-unit6-comment-ui
PHASE: Phase 3 — Operational Flow Reconciliation (unit 6, final unit)
DB_MIGRATION_STATUS: none — no schema/migration (migrate status 32 up to date; prisma/ = 0 files)
UI_GATE: PASS with driven evidence — (a) create blocked with empty Comment (error + zero POST) and accepted with text (201); (b) comment visible on detail after save; (c) clear via UI -> PATCH 200 -> detail shows Comments '—' + API row comments='' (gap re-captured this run, vision-verified); (d) AL DRAFT rows show 'Draft', 'Not started' gone; (e) console errors 0 across the cargo-page flow (7 fetches, 0 non-2xx). 4 screenshots vision-verified; counts 55/1 before = 55/1 after (fixtures cleaned).
SCHEMA_CHANGES: none
CODE_CHANGES: apps/web/.../cargo/page.tsx (required-at-create guard + Comments*/guidance + always-send comments + detail shows Comments '—' when empty); apps/web/.../actual-loading/page.tsx (DRAFT label 'Not started' -> 'Draft'); packages/shared/src/inspection.ts (header comment only — no type moved); apps/api/test/cargo-inventory.e2e-spec.ts (+1 comments round-trip/clear test). No orphan-column/DTO/permission/route changes (follow-up (f) unchanged).
TEST_CHANGES: baseline 365/365/0 -> triplet 366/366/0 ×3 (per-suite: only cargo-inventory 32->33; 22/22 green; decision-maker re-ran 366/366/0)
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = 4 code files + this log + 11-implementation-state.md; prisma/ = 0; new api.post routes = 0; new shared status unions = 0 (guard OK)
UNRESOLVED_ISSUES: none new. Web-level automated coverage of form behaviour remains impossible without a browser harness (stated explicitly in Part 3); orphan-column cleanup remains authorized follow-up (f)
NEEDS_BUSINESS_DECISION: (d) carried from ADR-044 — single mutable field vs append-only comment/activity log (employer); none new
BLOCKED: none
Phase 3 CLOSED: YES — all 3 roadmap acceptance criteria met (Inspection Done gates Load List [unit 1]; Not-loaded cargo returns to yard [unit 3]; Comment is editable and visible to relevant users [this unit, driven]); all 4 Tests items covered (Inspection Done gating; Not-loaded return to yard; LoadList eligibility; Comment edit/delete visibility [this unit]); all 3 UI changes shipped (Inspection status UI [unit 4]; LoadList and ActualLoading status UI [units 2/2b/4 + this unit's AL label]; Comment handling [this unit]). NBD (d) is carried as a non-blocking employer question (decisions 1-4 invariant; no history feature required by the acceptance), and follow-up (f) is housekeeping outside the roadmap acceptance.
HANDOFF_TO: decision-maker (unit-6 verification -> Phase 4 per roadmap; employer ruling still needed for NBD (d); authorized follow-up (f) = comment-column cleanup unit)
```

## Incident appendix (evidence provenance)

- Code/tests/triplet/gate-a-d: written by the prior run before context loss; repo state
  verified intact at resume (4 modified files, `git diff --stat` 80+/9-, scratch JSONs and
  screenshots present); decision-maker independently re-verified suite/tsc/migrate/guard/counts.
- This resumed run: (1) closed the two gate-evidence gaps — gate3 re-captured with the empty
  Comments field visible (enabled by the detail-panel `—` render change) and the console-error
  flow capture; (2) wrote this log; (3) updated the state doc; (4) re-confirmed tsc/guard/migrate
  and committed everything so the tree ends clean.
