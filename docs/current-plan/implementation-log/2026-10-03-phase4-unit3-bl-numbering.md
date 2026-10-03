# 2026-10-03 — Phase 4 unit 3: per-destination B/L numbering — `BOL-{DEST}-YYMM-#####`

## Task ID

phase4-unit3-bl-numbering

## Phase

Phase 4 — B/L Rewrite (unit 3 / P4-U3 per ADR-045 decision 6)

## Objective

Deliver roadmap Phase 4 **Test 3** ("Numbering") and **Acceptance 3** ("Numbering is per
destination"): replace the legacy local read-then-write `generateReference()` with the
transactional `NumberingService.allocateNumber` under `scopeType DESTINATION` /
`scopeValue = destinationPortId`, decide and record the implementation details ADR-045 left
open, keep existing numbers immutable, and prove format + independence + concurrency safety
with tests and a UI gate.

## Prompt reference

- **ADR-045 decision 5** (this unit's specification): per-destination numbering, proposed
  rendered format `BOL-{DEST}-YYMM-#####`, destination segment keeps the global
  `billNumber @unique` intact (to be proven by collision test, not assertion), existing
  numbers immutable, one coherent unit, **no schema change expected**.
- Roadmap §3 Phase 4 (Tests 3, Acceptance 3; workflows :74 "B/L number is per destination").
- Blast radius enumerated by ADR-045: `bill.service.ts`, `bill.e2e-spec.ts`,
  `delivery-release.e2e-spec.ts`.

## Environment

Repo, HEAD **b75aedf** (unit 2), porcelain **0**; servers `:3101`/`:3000` **200 before/after,
never restarted**; pnpm 9.15.9; `pnpm --filter <pkg> test`.

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       374 passed, 374 total
```

(`scratch/p4u3-base.json` — matches the stated baseline.)

---

# Implementation

## Replacement (bill.service.ts)

- `generateReference()` (local read-max-then-write, `BOL-YYMM-#####`) → **deleted**, replaced
  by `allocateBillNumber(destinationPortId)` which calls the already-used
  `NumberingService.allocateNumber` (same `@Global()`-provided service `voyages.service.ts`
  uses — injection only, **no module change**).
- **`p.numbering` injected** into `BillService`'s constructor (auto-provided by
  `@Global() NumberingModule`).

```ts
const destinationSegment = port.abbreviation || port.code;          // decision (b)
const allocated = await this.numbering.allocateNumber({
  name: `bill-${destinationPortId}-${yymm}`,                        // decision (a): name embeds the period
  documentType: 'BILL',
  scopeType: 'DESTINATION', scopeValue: destinationPortId,
  prefix: `BOL-${destinationSegment}-${yymm}-`,
  padding: 5, format: '{prefix}{sequence}', period: 'YYYYMM',       // decision (a)
});
return allocated.sequence;
```

- Both create paths call it: **voyage path** with `voyage.destinationPortId`, **legacy
  manifest path** with `manifest.voyage.destinationPortId` (stored at create). Both now have
  a defensive `destinationPortId` check **before** the allocation loop (decision (c)).
- The bounded-retry create loop (P2002/P2018/P2003 mapping) is **retained unchanged**, with
  its comment updated honestly: the billNumber read-then-write race is gone (allocation is
  transactional under `SELECT … FOR UPDATE`), the loop now guards other constraint conflicts,
  and a sequence number consumed by a failed attempt leaves a harmless gap.
- **`renderNumber` constraint:** `NumberingService.renderNumber` only renders
  `{prefix}` and `{sequence}` tokens, so `{DEST}` and `{YYMM}` live in the computed **prefix**
  (per-call, from the destination port + current UTC month) — exactly how `voyages` handles
  its `{yy}` (via name/prefix rather than format tokens).

## Recorded decisions (ADR-045 left these open — this unit's record)

### (a) Counter scoping: **per destination PER MONTH**

- `NumberingSequence.name = bill-{destinationPortId}-{YYYYMM}` embeds the period (the exact
  pattern voyages uses: `voyage-{destPortId}-{yy}`) with `period: 'YYYYMM'` on the row, so
  each (destination, month) bucket gets its **own** sequence row and restarts at `00001`.
- Justification: (1) the legacy number was monthly-bucketed (read-max by the `BOL-YYMM-`
  prefix), so monthly preserves the shipped cadence and makes the `YYMM` segment in ADR-045's
  proposed format meaningful — under evergreen counting the `YYMM` would be decoration while
  the suffix keeps climbing across months; (2) `NumberingSequence` already models periods
  (`period` field: `YYYY | YY | YYYYMM | QUARTER`) and `computeScopeValue('YYYYMM')` exists,
  so the monthly decision costs nothing in schema/semantics; (3) the employer text
  ("B/L number is per destination", workflows :74) speaks to **destination** scoping only —
  monthly bucketing is orthogonal and keeps this unit's continuity with existing numbers.

### (b) Destination segment: **Port `abbreviation ?? code`**

- `Port` has both fields (`abbreviation String? @unique` — "short code e.g. HAM, JEA" — and
  `code String @unique`). Per the prompt's preference for the human-meaningful code, the
  segment = **`abbreviation` when present, else `code`**.
- Residual risk recorded (not asserted away): abbreviation and code are unique **within
  their own columns**, so two *different* ports could in theory render the same segment
  (abbrev of X == code of Y); a collision would then hit the global `billNumber @unique` and
  surface as a loud 409 (the create loop's existing P2002 mapping), never a silent overwrite.
  Port segments may themselves contain `-` (e.g. `ABBR-3C0OU7`), so the number has extra
  dashes — parsing is positional from the tail (`-YYMM-#####`), which all format regexes use.

### (c) `destinationPortId`-null edge: **reject create with a clear 400**

- `allocateBillNumber` throws `400 destinationPortId is required to number a B/L per
  destination (ADR-045 decision 5)` when the scope key is missing (plus `400 Unknown
  destination port` for an id no longer resolvable).
- Rejected alternative: legacy-format fallback — it would silently split numbering into two
  scopes and undermine Acceptance 3.
- **Honest reachability note:** both source columns are `NOT NULL` today
  (`voyage.destinationPortId` is required; the legacy path derives it from the manifest's
  voyage), so the branch is **defensive and unreachable through legal API data** — it cannot
  be exercised end-to-end by design. The test evidence for this decision is therefore the
  paired assertions that **every** created bill (both paths) carries a non-null
  `destinationPortId` (format test + coexist test sweep over the full list), not a fabricated
  400.

### (d) `NumberingSequence` rows for existing destinations: **lazy creation, no seed, no migration**

- `allocateNumber` already **upserts the sequence row on first use** (create branch with
  `nextSequence: 1`; the row is keyed by `name`, so the upsert is idempotent) — verified in
  `numbering.service.ts`. New destinations therefore need no seeding: the first bill's
  allocation creates the `(destination, month)` row. No schema change (migrate status stays
  **33**) and no data migration.
- Test-created sequence rows are removed in the suite's `afterAll` by **exact `name` filters**
  (id = name), and the gate's row was deleted by exact name — no bulk filters anywhere
  (unit-2 cleanup incident).

## Immutability + coexistence (requirement 3)

The 3 shipped `BOL-2609-#####` bills are **never renumbered**: nothing in this unit deletes,
edits, or re-derives existing `billNumber`s — only the allocation of *new* numbers changed.
Coexistence under the global `@unique` index is **proven by test** (a list containing both
legacy-format and new-format rows in the same table + an additional create alongside them),
not by assertion text. New numbers for a fresh (destination, month) **start at 00001** even
when legacy-format bills exist for that destination (no counter seeding from legacy —
consistent with ADR-045 "sequences start at 1 per destination for new numbers"; the gate
confirmed `BOL-ABBR-3C0OU7-2610-00001`).

## Blast-radius updates (ADR-045 enumeration)

- `bill.service.ts` — the replacement itself + stale `BOL-YYMM` comments in the dispatcher
  updated to the new format (race/number-allocation comments rewritten per above).
- `bill.e2e-spec.ts` — the format assertions **and test title** updated:
  `/^BOL-\d{4}-\d{5}$/` → `/^BOL-.+-\d{4}-\d{5}$/` (two sites; the looser middle is required
  because destination segments may contain `-`), title now `BOL-{DEST}-YYMM-##### per-
  destination number`. Justification: the assertions encode the OLD format; ADR-045 decision 5
  (this unit's specification) changes the shipped format, so updating them is the required
  translation, not an assertion weakening — both still require the full four-part shape.
- `delivery-release.e2e-spec.ts` — assertions are `/^BOL-/` **prefix-only**, which the new
  format satisfies unchanged; verified and **deliberately left untouched** (no edit needed).
- `apps/web` — **zero changes** (contract A + natural rendering; list/detail/truncation
  measured in the gate instead).

## Transition contract A (requirement 4)

Intact: the legacy `manifestId` path and the shipped page are untouched, and the page's
create flow now mints a **new-format** number through the same legacy path (proven in gate
(a)) — intended per the prompt.

---

# Tests (roadmap Test 3 coverage) — delta **369 → 374**

New in `bill.e2e-spec.ts` (suite 16 → 21; **all 16 existing tests green unchanged**):

1. **Format matches the recorded decision** — legacy-path create on the suite voyage →
   `^BOL-.+-\d{4}-\d{5}$`, segment equals `abbreviation ?? code` of the voyage's destination
   (fetched live via `GET /ports/:id`), current `YYMM` present, and
   `destinationPortId === destPortId` (decision (c) evidence: scope key always stored).
2. **Two destinations number independently** — fresh port + voyage → first number is exactly
   `BOL-{seg}-{yymm}-00001` (**fresh destination+month starts at 1**), and a bill on a
   different destination neither equals nor shares the other's segment.
3. **Same destination + period strictly increasing** — two sequential creates share the full
   prefix (`dest+YYMM`) with a strictly greater 5-digit suffix and distinct values.
4. **Concurrency-safe allocation (regression)** — `Promise.all` of **4 parallel creates** on
   the same destination → 4 distinct well-formed numbers (this is the race
   `generateReference()` was replaced for; `FOR UPDATE` allocation must never collide).
5. **Legacy + new formats coexist under the unique index** — full list contains ≥1
   legacy-format row (`BOL-2609-*`) **and** ≥1 new-format row, a further create succeeds
   alongside both, and **every** row carries a non-null `destinationPortId` (decision (c)
   list-wide sweep).

Support: `createdSeqNames` array + `afterAll` deletion by exact `name in [...]`.
Test delta **369 → 374 (+5)**; bill suite **16 → 21**.

---

# UI gate (protocol §3.1) — **PASS**, driven with screenshots

Counts **before**: bills 3 | manifests 4 | cargos 55 | voyages 21. Fixture: fresh voyage
`VOY-2610-02247` (destination port with `ABBR-3C0OU7`), chain cargo `CRG-2610-00117` loaded,
manifest `MAN-2610-00001` draft → line → submit → **approve** (eligible rows = 1).

- **(a) create through the shipped page → new-format title:** `POST /api/v1/bills → 201`,
  detail title **`BOL-ABBR-3C0OU7-2610-00001`** (regex-verified `newFormat: true`), subtitle
  `Draft — MAN-2610-00001 (KHALIFA → ABBR-3C0OU7)`, **0 console errors**. Screenshot
  `p4u3-gate1-new-format.png` vision-verified (title, Draft, no error banners; fresh
  destination+month → `00001`, matching decision (a)+(d)).
- **(b) list renders both formats:** after create the refreshed list shows **4 rows** —
  `BOL-ABBR-3C0OU7-2610-00001` + the three legacy `BOL-2609-0000{1,2,3}` — zero
  truncated/mis-extracted cells (`truncated: []` in DOM probe), status filter/tab intact
  ("Bills of Lading (4 bills)"), **0 console errors**. Screenshot
  `p4u3-gate2-both-formats.png` vision-verified: both formats visible side by side, **no
  ellipsis/truncation, no error banners**; the B/L NUMBER column **wraps** long values onto
  multiple lines — recorded honestly: this wrapping equally affects the **legacy** rows
  (three lines for `BOL-2609-*` even before this unit) so it is a pre-existing column-width
  trait, not introduced by the longer new format, and the constraint puts the page outside
  this unit's scope (no page code changed).
- **(c) issue end-to-end:** Add-line picker offered `#1 — CRG-2610-00117 (3 pkg)` →
  `POST …/items → 201`; Issue → confirm → `POST …/issue → 200`, `issued: true`.
- **(d) collectors:** **7 fetches, zero non-2xx, `consoleErrs: []`** across create → add →
  issue; final page state also error-free. (One intermediate probe accidentally clicked a
  detail footer `Cancel` button — the **cancel-confirm dialog only opened, nothing was
  confirmed, no `/cancel` request was ever issued**; dialogs were dismissed with Escape and
  the fetch log confirms no side effect.)
- **Cleanup (explicit ids only):** gate bill items → bill → manifest line → manifest → AL
  item → AL → LL item → LL → inspection → cargo → voyage → `NumberingSequence` by **exact
  name** — every delete scoped to one id/name from `p4u3-gate-fx.json`/the gate bill id
  (unit-2 incident applied: no undefined filter). One tool-side correction recorded: the
  first attempt used the wrong relation key (`billId` — actual field is `billOfLadingId`),
  the script failed fast before touching anything, and was rerun correctly.
- Counts **after**: **bills 3 | manifests 4 | cargos 55 | voyages 21** — identical to
  before; post-cleanup full suite **374/374/0** green.

---

# Verification (verbatim)

1. Baseline first run at b75aedf → **369/369/0 (22/22)** ✅
2. Official triplet after the change → **374/374/0 ×3** (`p4u3-r1/r2/r3.json`); per-suite
   all green; vs baseline the **only** delta is `bill.e2e-spec.ts 16 → 21 (+5 numbering)`;
   a 4th post-cleanup run also **374/374/0** ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `npx prisma migrate status` → **33 migrations … up to date — no schema change** (as
   expected for this unit) ✅
5. `pnpm --filter @shipping/web test` → `CONTRACT GUARD OK — 18 shared status unions ⊆
   Prisma enums; 84 web api.post routes ⊆ 90 controller @Post routes` (exit 0) — no new
   route, no shared-union change (web untouched) ✅
6. Servers → **API 200, WEB 200** before/after, never restarted ✅
7. Porcelain = `apps/api/src/modules/bill/bill.service.ts` + `apps/api/test/bill.e2e-spec.ts`
   (+ this log) — **apps/web = 0, prisma = 0** ✅

## TRANSLATION_CHANGES

test file only: two `BOL-YYMM` format assertions + one test title re-translated to the
ADR-045 decision-5 format (`bill.e2e-spec.ts`); `delivery-release.e2e-spec.ts` prefix
assertions verified compatible, unchanged.

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit3-bl-numbering
PHASE: Phase 4 — B/L Rewrite (unit 3 / P4-U3)
DB_MIGRATION_STATUS: none — migrate status stays 33 up to date (schema change not required;
  NumberingSequence rows are created lazily by allocateNumber, idempotent by name)
UI_GATE: PASS with driven evidence — (a) shipped page create → POST /bills 201, detail title
  BOL-ABBR-3C0OU7-2610-00001 (new format, fresh dest+month starts 00001; screenshot
  vision-verified); (b) refreshed list renders new-format row + 3 legacy BOL-2609-* rows
  together, zero truncated cells, no error banners (number-column wrap recorded as
  pre-existing: legacy rows wrap too; page code untouched per scope); (c) add-line 201 +
  issue 200 end-to-end; (d) 7 fetches, 0 non-2xx, 0 console errors. Counts restored
  (bills 3 / manifests 4 / cargos 55 / voyages 21); fixtures hard-deleted by explicit
  id/name filters only.
SCHEMA_CHANGES: none
CODE_CHANGES: bill.service.ts only — generateReference() (local read-then-write, BOL-YYMM-#####)
  replaced by allocateBillNumber() → NumberingService.allocateNumber with scopeType
  DESTINATION / scopeValue destinationPortId / period YYYYMM / prefix BOL-{abbrev??code}-
  YYMM-; NumberingService injected (@Global, no module change); defensive 400 on null/unknown
  destination; both create paths allocate; legacy comments updated; bounded-retry loop kept
  (race rationale updated); web untouched (transition contract A intact — page's create now
  mints new-format numbers by design)
TEST_CHANGES: baseline 374/374/0 -> triplet 374/374/0 ×3 + post-cleanup 4th green (bill
  suite 16 -> 21; +5: format, two-destination independence (fresh = 00001), strict increase,
  4-way concurrent collision regression, legacy+new coexist + destination sweep); 2 old-format
  assertions + 1 title re-translated; createdSeqNames cleanup by exact name in afterAll
DECISIONS_RECORDED: (a) counter = per destination PER MONTH (name embeds dest+YYYYMM, period
  YYYYMM — legacy monthly cadence + NumberingSequence period semantics; employer text scopes
  to destination); (b) segment = Port.abbreviation ?? code (residual cross-column segment
  collision would surface loudly as unique violation, recorded); (c) null edge = clear 400
  (defensive; unreachable with legal data because both source columns are NOT NULL — tested
  via always-stored scope key instead of a fabricated 400); (d) sequence rows lazy-created,
  no seed/migration
TRANSLATION_CHANGES: bill.e2e-spec.ts format regexes (2 sites, looser middle for '-' in port
  codes) + 1 test title; delivery-release prefix assertions verified compatible (unchanged)
GIT_VERIFICATION: porcelain = bill.service.ts + bill.e2e-spec.ts + log; apps/web = 0;
  prisma = 0; contract guard OK; committed at task end so the tree ends clean
UNRESOLVED_ISSUES: (1) B/L NUMBER column wraps long numbers (pre-existing width trait,
  affects legacy rows equally — page out of scope this unit, recorded for decision-maker);
  (2) carry-overs unchanged: portal destination-scoped B/L visibility, manifest.dto stale
  Swagger text
NEEDS_BUSINESS_DECISION: none new — §1.1a/§1.1b/§1.2 from ADR-045 stay with the employer
  for U4/U6 (timing, presented originals, roles)
BLOCKED: none
HANDOFF_TO: decision-maker (unit-3 verification → next ADR-045 decision-6 unit; U4 lifecycle
  / U7 legacy retirement remain future units)
```
