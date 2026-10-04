# 2026-10-04 — Phase 4 unit 5: B/L revisions — immutable snapshots, frozen numbers, read-back restore

## Task ID

phase4-unit5-bl-revisions

## Phase

Phase 4 — B/L Rewrite (unit 5 / P4-U5 per ADR-045 decision 6)

## Objective

Deliver roadmap Phase 4 **Test 4 part 2** (revisions half of "Lifecycle and revisions") per
**ADR-045 decision 4**: one additive migration (revision table + `revision` counter), the
DRAFT-only freeze/list/restore endpoints, proof that `billNumber` is never re-allocated across
revisions — while honoring decision 4's **binding exclusions** (no diffs, no version trees,
no workflow engine, no revision edit/delete, no branching).

## Prompt reference

- **ADR-045 decision 4** (read in full first): `BillOfLadingRevision { billId, revisionNumber,
  note?, snapshot (JSON), createdById, createdAt }` + `revision Int @default(1)`; flow mirrors
  workflows §3.1 steps 4–7; DRAFT-only freeze; FINAL/APPROVED/RELEASED freeze revisions;
  list-only history; number stability; restore = "read-back into the draft, not a new data
  path"; exclusions list binding.
- State-doc precedents read as required: **U2 cleanup incident** (explicit id/name filters
  only) and **follow-up (g)** (bill-creating tests leak NumberingSequence rows — my tests must
  push the sequence names they allocate).

## Environment

Repo, HEAD **7f76f0e** (U4 state-doc commit), porcelain **0**; servers `:3101`/`:3000`
**200 before/after, never restarted**; pnpm 9.15.9.

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       377 passed, 377 total
```

(`scratch/p4u5-base.json` — matches the stated baseline.)

---

# Part 1 — Migration (additive, 36)

**Schema** (`prisma/schema.prisma`):

- `BillOfLading.revision Int @default(1) @map("revision")` — recorded semantics: **the label
  the NEXT freeze receives** (snapshots come out 1, 2, 3, …; counter starts at 1, so the very
  first freeze stores `revisionNumber = 1`);
- new model `BillOfLadingRevision` exactly per decision 4, plus `@@unique([billId,
  revisionNumber])` (the DB backstop behind the row lock) and `@@index([billId])`;
- both FKs `ON DELETE CASCADE` (bill or user removal drops its revision rows — keeps every
  existing test cleanup working, and made the suite's hard-deletes pass untouched);
- back-relation on `User.billRevisions` (additive).

**Migration** `prisma/migrations/20261004120000_bl_revisions/migration.sql` — generated from
`prisma migrate diff --from-migrations --to-schema-datamodel --script` against a scratch
shadow DB (docker `p4u5_shadow`), used verbatim with a header comment (no hand logic needed:
it is a pure CREATE TABLE + index + 2 FKs + one ADD COLUMN DEFAULT 1).

**Applied:** `migrate deploy` → **36 migrations … up to date**; shadow re-diff → **`-- This is
an empty migration.` ("No difference detected.")**; `prisma generate` re-run. **No column
drops, no enum changes, nothing removed.**

---

# Part 2 — Recorded decisions (the details decision 4 left to execution)

## Snapshot shape

**The verbatim `detailSelect` row** (header scalars + manifest/voyage/party summaries + all
item snapshots via `billItemSelect`), serialized with `JSON.parse(JSON.stringify(row))`
(Prisma `Decimal` → string, `Date` → ISO string). Justification: `detailSelect` already *is*
the document state `GET /bills/:id` returns — the thing the customer reviews in workflow step
5 — so freezing it needs **no parallel serializer** that could drift from what the API shows,
and every field decision 4 cares about is present. `revision` itself was added to
`listSelect` so the live label is API-visible. Snapshot round-trips exactly (proven byte-for-
byte in tests).

## Permission

**`bill:update`** for writes (`POST /revisions`, `POST …/restore`), **`bill:read`** for the
history GET. Justification: freezing is bookkeeping *inside the draft-editing loop*
(customer-review corrections = edit → next revision), so it is gated where editing is gated;
`bill:issue` remains exclusively the forward-transition gate (a frozen revision is not a
lifecycle move). **No new permission codes** — tested both ways: a `bill:read`-only role gets
403 on POST and 200 on GET; a `bill:create+update` writer can freeze.

## Restore — **IMPLEMENTED** (not deferred)

`POST /bills/:id/revisions/:n/restore` (`bill:update`, DRAFT target only), exactly the
read-back shape decision 4 prescribes:

1. under the row lock: bill must exist, be **DRAFT** (409 with recorded message otherwise),
   and revision `n` must exist (**404 — checked BEFORE any capture**, so a failed restore
   never consumes a revision number; non-integer `n` → 400);
2. **the current state is captured as the NEXT revision first**
   (`note: "Pre-restore capture before restoring revision N"`) — nothing is ever lost;
3. read-back applies only **document-owned fields** (the `UpdateBillDto` set: billType,
   parties, notify, freight terms, carrier, place/date of issue, originals, freight, currency,
   goods description, marks, notes). **Never restored (recorded):** `billNumber`, `status`,
   `revision`, voyage/manifest/destination linkage, audit stamps (`issued*`/`cancelled*`),
   totals — totals are **recomputed** from the restored items by the existing
   `recomputeTotals()` (server rule, not snapshot copying);
4. items: current rows deleted and the snapshot's rows recreated (ids intentionally NOT
   restored — same document identity, new row ids), sequence preserved;
5. everything in ONE interactive transaction; `P2003` maps to the same 400 message `update()`
   uses (a party master deleted since the freeze aborts the whole restore — capture included —
   leaving the draft exactly as it was).

Deferred-to-U7 would have left a recorded gap for no benefit; the bounded implementation above
is fully test-covered.

## Concurrency

**Row lock:** `SELECT "id" FROM "bills_of_lading" WHERE id = … FOR UPDATE` inside one
interactive transaction, with the **snapshot read performed after the lock** (so a concurrent
edit/issue either lands before the capture or waits — never interleaved), plus the
`@@unique(billId, revisionNumber)` DB backstop for any future lock-less writer. Read-in-tx
alone was rejected: under READ COMMITTED a plain read does not block a concurrent PATCH from
committing between the read and the insert. **Tested outcome (the one actually testable):**
two parallel freeze requests both return 201 with **distinct consecutive revision numbers**
([4,5]); *which* request wins the race is nondeterministic by nature and is asserted as a set.

## Interplay (unchanged by design)

- `EDITABLE_STATUSES = ['DRAFT']` stays authoritative — finalize alone never revises,
  and revisions only ever run on DRAFTs;
- U4's `BILL_TRANSITIONS` table and every edge endpoint (`finalize`/`approve`/`issue`/
  `cancel`) are **untouched** (0 lines changed there);
- create paths still write `DRAFT` + `revision 1` (verified: both creates unchanged, tests
  assert DRAFT);
- transition contract A intact; zero web/shared/messages changes.

## Deliberately NOT built (decision 4's binding exclusions — gold-plating guard)

field-level diffs/compare UI · per-item version trees · multi-approver/workflow engine ·
revision deletion or editing (no PUT/DELETE route exists — 404-proven) · revision branching ·
separate revision list DTO with paging · restoring `billNumber`/status/audit.

---

# Tests (roadmap Test 4 part 2) — delta **377 → 381**

New in `bill.e2e-spec.ts` (suite 23 → 27):

1. **Freeze flow:** `bill:read` → 403 on POST (recorded permission), writer freezes 1→2→3
   (notes `round 1`, `round 2`, `null` for omitted), `createdById` + `createdBy.email` equal
   the acting writer on every row, live label advances to 4, **billNumber identical before/
   after/during**; two **parallel** freezes → 201 + distinct `[4,5]` (row-lock regression);
   GET history ascending `[1..5]` with exact notes (parallel pair asserted as a set — see
   assertion note below) and actor on every row.
2. **Snapshot immutability + list-only history:** freeze with distinctive header values →
   live-edit header → stored rev-1 snapshot **byte-for-byte identical** (`JSON.stringify`
   equality) while still carrying the original values and the live doc differs; `PUT` and
   `DELETE` on `/revisions/1` → **404** (no routes by construction); unknown-bill history GET
   → 404.
3. **Every non-DRAFT status frozen:** control freeze on DRAFT 201 → `finalize` → FINAL 409
   (message contains the state) → `cancel` → CANCELLED 409 → **restore on CANCELLED 409** →
   prisma-forced **APPROVED 409 / RELEASED 409 / legacy ISSUED 409** (each message names the
   state).
4. **Restore read-back:** 2-cargo voyage-mode bill (loaded-chain helper) frozen as rev 1 →
   header edit + one line removed → restore → live `carrierName`/`notes`/`items` (2 rows, the
   same cargo ids) back to rev-1 values, **billNumber unchanged**, totals recomputed
   (= original total, 2+2 packages from cargo facts); history = `[1, 2]` where rev 2 is the
   automatic pre-restore capture carrying the **edited** state (edited carrier + 1 item) —
   proof nothing was lost; unknown revision → 404 **with no capture consumed**; non-integer
   revision param → 400.

**Assertion change (test-only, justified):** during this unit my first draft asserted the two
*parallel* freezes' notes in a fixed order (`parallel A` on rev 4). The product guarantees
**distinct consecutive numbers and both notes recorded**, never which request wins the lock
race — the observed R3 failure was my order-dependent expectation, not a defect. The final
assertion pins `[1,2,3]` sequential notes in order, the parallel pair as a sorted set, all
five numbers `[1..5]` in order, both actors, and the frozen billNumber. **No shipped rule was
weakened.**

## Follow-up (g) — first + second bite (cleanup discipline)

- **My 4 new tests push `createdSeqNames`** with the exact name they allocate (suite dest),
  per the prompt; `bill.e2e` now pushes at **6 sites total**;
- then measured: full runs still grew BILL `NumberingSequence` rows ~1/run. Traced to the
  **other two bill-creating suites** (`delivery-release`, `party-cutover` — grep-verified the
  complete set of 3) which never cleaned their per-destination sequences. Added an identical
  **exact-scope-id sweep** (`documentType: 'BILL', scopeValue: { in: createdPorts.map(id) }`)
  to both suites' `afterAll` — `in: []` on an empty list matches nothing, so it can never
  collapse into a wildcard (the U2 incident pattern; no undefined filters anywhere);
- **verified:** each of the 3 suites solo → BILL-seq count delta **0/0/0**, and the count
  stayed **39 → 39 across 3 full suite runs** (zero growth). The 39 *historical* orphans
  (deleted-port scope keys, unreachable) remain for follow-up (g)'s own cleanup unit — not
  silently swept here (their owning fixtures are long gone; deleting by observed id pattern
  would exceed this unit's explicit filters-only discipline).

---

# Stability & verification (verbatim)

1. Baseline first run at 7f76f0e → **377/377/0 (22/22)** ✅
2. **Official triplet (final tree) → 381/381/0 ×3**, per-suite parsed from the JSONs: **22/22
   suites green each run, bill suite 27/27** ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `npx prisma migrate status` → **36 migrations … up to date** (1 additive added);
   shadow `migrate diff` → **empty ("No difference detected.")**; shadow DB dropped at the end ✅
5. `pnpm --filter @shipping/web test` → `CONTRACT GUARD OK — 18 shared status unions ⊆
   Prisma enums; 84 web api.post routes ⊆ 94 controller @Post routes` (exit 0; +2 new
   controller POSTs, web unchanged) ✅
6. Servers → **API 200, WEB 200** before/after, never restarted ✅
7. Porcelain = prisma schema + 1 migration dir + bill controller/service/dto + bill.e2e +
   delivery-release.e2e + party-cutover.e2e + this log (web/shared/messages untouched) ✅

## Flake record (honest — nothing hidden, nothing worked around)

Three separate one-shot failures occurred during verification, all diagnosed, none a shipped
defect from this unit's product code:

1. **My T1 parallel-note ordering** (2 occurrences incl. one in an early triplet): test
   expectation assumed lock-race order → fixed as recorded above (set assertion); the
   distinct-numbers guarantee remained asserted throughout.
2. **Jobs suite (`POST /jobs → 400`, 9 cascading failures, 1 occurrence)** — the documented
   **follow-up (e)** load flake (state doc: seen since Phase-3 unit 3, green in every later
   full run); jobs/DTO untouched by this unit; green in every subsequent run.
3. **Proforma convert `409` (2 cascading failures, 1 occurrence)** — suite green **×2 solo**
   immediately after; proforma untouched by this unit. Observed cause-hint for the
   decision-maker: `convert` allocates the invoice number with a local
   `generateInvoiceReference()` (read-then-write, per its own code comment) inside the convert
   transaction — the same defect class as the race U3 replaced on bills and follow-up (e);
   flagged, **not fixed here** (out of unit scope).

After fixes/re-runs: **3 consecutive full-suite runs green (381/381/0)** + 2 green runs in the
batch before, i.e. the final tree has never failed a run.

## UI gate

**NOT APPLICABLE** — this unit is backend-only by construction: the changed files are
`prisma/schema.prisma`, one migration, the bill controller/service/DTO and three e2e specs;
`apps/web`, `packages/shared` and the i18n messages are untouched (zero user-visible surface
changed — no detail panel, no new rendered field). The revision-history UI belongs to **P4-U7**
per ADR-045 decision 6. `CONTRACT GUARD OK` re-run after all edits confirms the web contract
is unaffected. If a future unit renders `revision`/history, the full driven gate applies there.

## TRANSLATION_CHANGES

none

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit5-bl-revisions
PHASE: Phase 4 — B/L Rewrite (unit 5 / P4-U5)
DB_MIGRATION_STATUS: 36 up to date, shadow clean — one additive migration
  (20261004120000_bl_revisions: bills_of_lading.revision INT NOT NULL DEFAULT 1 +
  bills_of_lading_revisions table with @@unique(billId, revisionNumber), both FKs CASCADE;
  no drops, no enum changes)
UI_GATE: NOT APPLICABLE — backend-only (prisma + bill module + 3 e2e specs); apps/web,
  shared and i18n untouched (guard re-run green); revision-history UI is P4-U7 per ADR-045
  decision 6
SCHEMA_CHANGES: additive only (see migration)
CODE_CHANGES: bill.service — listRevisions (ascending, list-only), createRevision (row-lock
  tx, DRAFT-only, 409 with recorded message, freeze = verbatim detailSelect snapshot +
  bill.revision label advance), restoreRevision (DRAFT-only, 404-before-capture, pre-restore
  capture, document-fields-only read-back, items replace + recomputeTotals, P2003->400);
  bill.controller — +POST :id/revisions (201), +GET :id/revisions, +POST :id/revisions/:n/restore
  (200), writes on bill:update, read on bill:read (NO new permission codes); dto — CreateRevisionDto
  {note?}; listSelect + revision; NO PUT/DELETE route (404 by construction); U4 transition
  machinery and create paths untouched
RESTORE: implemented — read-back into the DRAFT per ADR-045 ("not a new data path"): current
  state captured as the next revision FIRST (nothing lost, 404 fires before any capture),
  then document-owned fields + items restored atomically; billNumber/status/stamps/totals
  never restored (totals recomputed)
TEST_CHANGES: baseline 377/377/0 -> final triplet 381/381/0 x3 (per-suite: 22/22 green,
  bill 27/27) (+4: freeze flow/permissions/parallel-distinct/actor, byte-for-byte immutability
  + 404 list-only, all-five-non-DRAFT 409s + restore 409, full restore read-back incl.
  pre-restore capture + 404/400 edges). One test-only assertion correction recorded with
  justification (parallel note order is nondeterministic; distinctness/set/actors/number
  stability all still asserted — no shipped rule weakened)
FOLLOWUP_G: closed-in-part by this unit — my tests push every sequence name they allocate
  (5 new push sites), and exact-scope-id sweeps added to ALL THREE bill-creating suites
  (bill, delivery-release, party-cutover — grep-verified complete); verified BILL-seq delta
  0/0/0 solo + 39->39 across 3 full runs (zero growth); 39 historical orphans remain for
  (g)'s own cleanup unit
FLAKE_RECORD: 3 one-shot verification failures, all diagnosed (my order-dependent assertion —
  fixed; follow-up (e) jobs 400 — documented, green after; proforma convert 409 — solo x2
  green, suspected read-then-write generateInvoiceReference under load, OUT OF SCOPE, flagged);
  final tree green in its last 5 full runs including 3 consecutive
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain = the 7 files + migration + log listed in Verification #7;
  contract guard OK; servers never restarted; commit at task end so the tree ends clean
UNRESOLVED_ISSUES: (1) carry-overs unchanged: portal destination-scoped B/L visibility,
  manifest.dto stale Swagger text, B/L number column wrap (U3), proforma-convert allocation
  observation (new, flagged above), follow-up (g) historical orphans + (e)/(f)
NEEDS_BUSINESS_DECISION: none expected — no new business question surfaced; ADR-045 decision 4
  answered every flow question it defined (restore implemented within its stated shape)
BLOCKED: none
HANDOFF_TO: decision-maker (unit-5 verification → P4-U6 release separation: bill:release,
  RELEASED edge activation, AuditLog, ReleaseOrder ruling-3 policy; revision history UI in U7)
```
