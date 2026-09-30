# Phase 2 — Vessel type & tug/barge modeling — implementation log

**Task ID:** phase-2-vessel-tug-barge
**Roadmap:** Phase 2 — Master Data & Party Model Realignment / Vessel & tug-barge subphase
**Objective:** Represent vessel reality — distinguish self-propelled vessels from tugs/barges/landing
crafts, allow tug+barge pairing usable in voyage/schedule context, keep existing vessel FKs
(Manifest/LoadList/ActualLoading/Discharge) working unchanged.

---

## Authoritative doc consultation (done BEFORE coding, as required)

| Doc | Finding |
|---|---|
| `01-final-requirements.md:56-57` | "Vessel types include **Tug, Barge, Landing Craft, and regular Vessel**." / "Tug and Barge may be recorded as a pair with two names." |
| `01-final-requirements.md:118` | Manifest header includes vessel name + tug/barge or landing craft. |
| `04-final-data-model.md:40` | Vessel: `vesselType`, **`tugBargeNamePair optional`** (pairing lives on the **Vessel** side of the model, surfaced per voyage via document headers). |
| `04-final-data-model.md:44` | Voyage: `vesselId, destinationPortId, ...` — no mandatory tug/barge fields (they are optional associations). |
| `02-target-system-blueprint.md:63` | Vessel fields: Name, IMO optional, vessel type, tug/barge name pair optional. |
| `03-final-workflows.md:81` | Manifest header shows vessel, tug/barge or landing craft. |
| `12-open-business-decisions.md:105` | "Vessel type and tug/barge modeling **can be implemented as a technical decision**." → no NEEDS_BUSINESS_DECISION stop required. |
| `09-final-implementation-roadmap.md:64` | Phase 2 includes "Vessel type and tug/barge modeling". |

**Modeling decision (documented per prompt):**
- **Enum values:** prompt proposed `SELF_PROPELLED, BARGE, TUG`; docs require **four** semantic
  categories (Tug, Barge, Landing Craft, regular Vessel). The codebase already had a 7-value
  `VesselType` enum (CONTAINER/BULK/TANKER/RORO/GENERAL/PROJECT/OTHER) where those 7 values ARE
  the "regular Vessel" family (ADR-022-style controlled set). **Final choice: keep the existing 7
  and add `TUG`, `BARGE`, `LANDING_CRAFT`** → 10 values. No `SELF_PROPELLED` value: "regular
  Vessel" is expressed by the existing self-propelled categories, and adding a redundant
  SELF_PROPELLED alias would contradict the existing controlled set. All 4 doc categories present.
- **Association placement:** the prompt prefers a minimal model "whichever matches the workflow
  docs". Docs put optional pairing on Vessel + document headers; per-voyage operational pairing is
  what the workflows actually consume (a tug pushes a barge **on a voyage**). **Final choice:
  voyage-level optional pairing — `Voyage.tugVesselId` + `Voyage.bargeVesselId` (nullable FKs,
  `ON DELETE SET NULL`)** — the prompt's stated fallback when docs are ambiguous, recorded here as
  the deviation-vs-docs note (`tugBargeNamePair` on Vessel not implemented as a string pair; the
  voyage association carries the same information with referential integrity + type validation).

---

## Current state found at resume (verified against filesystem + live DB)

A prior interrupted execution had already completed PART of this task:

**Already done (verified):**
- `prisma/schema.prisma`: `enum VesselType` extended with `TUG, BARGE, LANDING_CRAFT`;
  `Voyage.tugVesselId` / `bargeVesselId` + relations (`VoyageTug`, `VoyageBarge`) + indexes;
  `Vessel.tugVoyages` / `bargeVoyages` back-relations.
- **Live DB** (applied out-of-band by the prior execution — NOT via a migration file):
  enum has all 10 values; `Voyage.tugVesselId`/`bargeVesselId` columns exist (nullable);
  both indexes + both FKs exist (FKs created as `ON DELETE SET NULL` **without** `ON UPDATE CASCADE`).
- `apps/api/src/modules/vessels/dto/vessel.dto.ts`: `VESSEL_TYPES` includes the 3 new values
  (create/update/list-filter all use it).
- `apps/api/src/modules/voyages/dto/voyage.dto.ts`: optional `tugVesselId`/`bargeVesselId`
  on Create + Update.
- `apps/api/src/modules/voyages/voyages.service.ts`: list/detail selects include `tugVessel`/
  `bargeVessel`; `assertMasterData()` validates tug exists+active+**type TUG**, barge exists+active+
  **type BARGE** (409 with clear message otherwise); create/update persist the pairing; SCHEDULED
  voyages freeze the pairing (409).

**Not done (this execution's work):**
1. No migration file for the enum/columns/FKs (DB state is undeclared history).
2. Shared types: `VesselType` union lacks the 3 values; `VoyageListItem` lacks `tugVessel`/`bargeVessel`.
3. UI: vessels page dropdown/labels lack the 3 types; voyages page has NO tug/barge selection.
4. Translations: no en/fa/ar keys for the new labels.
5. Tests: no type-CRUD/pairing coverage.
6. No implementation log (this file), no verification run.

---

---

## Milestones — EXECUTED

### M1: Migration (the critical missing piece) — DONE

The prior execution had applied the schema changes to the live DB **out-of-band** (no migration
file declared them), so the DB state was undeclared history. This execution authored the missing
migration and applied it through the CLAUDE.md non-interactive flow (SQL authored → placed in
`prisma/migrations/` → `prisma migrate deploy`).

- **Path:** `prisma/migrations/20260929142911_vessel_type_tug_barge/migration.sql`
- **What it does (one paragraph):** Extends the `VesselType` enum with the three categories the
  plan documents require — `ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'TUG' / 'BARGE' /
  'LANDING_CRAFT'` — then adds the two optional per-voyage pairing columns
  (`ALTER TABLE "Voyage" ADD COLUMN IF NOT EXISTS "tugVesselId" TEXT` and `"bargeVesselId" TEXT`),
  creates their Prisma-named indexes (`Voyage_tugVesselId_idx`, `Voyage_bargeVesselId_idx`), and
  creates the two pairing foreign keys with the referential actions Prisma declares for optional
  relations (`ON DELETE SET NULL ON UPDATE CASCADE`), dropping-and-re-adding them so the live DB
  converges on the schema-declared definition (the out-of-band FKs were created without
  `ON UPDATE CASCADE`). Every statement is guarded (`IF NOT EXISTS` / `IF EXISTS`), so the
  migration is a no-op on the live DB where the objects already existed and applies cleanly on a
  fresh replay. Additive and non-destructive: no rows rewritten, no existing enum value changed,
  every existing Vessel keeps the type it already has.
- **`prisma migrate status` BEFORE:** `26 migrations found` → later `27` (port-abbreviation task)
  → for this task's start: 27 local migrations, `Database schema is up to date!`.
- **`prisma migrate deploy`:** applied `20260929142911_vessel_type_tug_barge` (28 total).
- **`prisma migrate status` AFTER:** `28 migrations found in prisma/migrations` /
  `Database schema is up to date!`.
- **`npx prisma validate`:** `The schema at prisma/schema.prisma is valid`.
- Post-deploy DB verification: `VesselType` enum has all 10 values; `Voyage.tugVesselId` /
  `bargeVesselId` exist as nullable TEXT; both indexes present; both FKs present with
  `ON DELETE SET NULL ON UPDATE CASCADE`.

### M2: API — DONE (completed + hardened this execution)

Prior execution had already added: `VESSEL_TYPES` (10 values) in `vessel.dto.ts`, optional
`tugVesselId`/`bargeVesselId` on `CreateVoyageDto`/`UpdateVoyageDto`, and `assertMasterData()`
type validation in `voyages.service.ts` (tug must be type TUG, barge must be type BARGE → 409 with
a clear message; unknown ids → 404; inactive → 409), plus list/detail selects exposing
`tugVessel`/`bargeVessel`.

This execution hardened the update path:
- `UpdateVoyageDto.tugVesselId/bargeVesselId` now accept `string | null` (documented: send null
  or `''` to detach).
- `voyages.service.update()` coerces `''`/`null` → `null` **only when the key is present**
  (absent key never clears the pairing — same wipe-on-omit lesson as port abbreviation).
- The SCHEDULED route-freeze guard and the DRAFT re-validation trigger now compare against
  `!== undefined` instead of truthiness, so `tugVesselId: ''` can no longer sneak past the freeze.
- No new routes; existing `POST /voyages`, `PATCH /voyages/:id`, `GET /voyages`, `GET /voyages/:id`
  carry the pairing; `GET /vessels?vesselType=` filters by type.

### M3: Shared types — DONE

- `packages/shared/src/vessel.ts`: `VesselType` union extended with `'TUG' | 'BARGE' | 'LANDING_CRAFT'`
  (with a comment citing the plan requirement).
- `packages/shared/src/voyage.ts`: new `VoyageTugBargeRef { id, code, name, vesselType }`;
  `VoyageListItem` gains `tugVessel: VoyageTugBargeRef | null` and `bargeVessel: VoyageTugBargeRef | null`
  (`VoyageDetail` extends it). Null = plain self-propelled sailing — the shape every pre-existing
  voyage has, so existing consumers keep working.
- `packages/shared/src/index.ts`: re-exports `VoyageTugBargeRef`.

### M4: UI — DONE

**Vessels page** (`apps/web/.../vessels/page.tsx`):
- `VESSEL_TYPES` now lists all 10 types (drives the filter select + the create/edit form select).
- Type labels are localized via `useTranslations('vessels')` (`t(\`type.${v}\`)`) in the filter,
  list TYPE column, form select, and detail view; the hardcoded `TYPE_LABELS` map was removed
  (it would have tripped `noUnusedLocals` and duplicated the translation source).
- **Bug fixed (pre-existing, blocks the gate):** `editInput()` sent `code` on PATCH, but
  `UpdateVesselDto` has no `code` (immutable) and the global ValidationPipe runs
  `forbidNonWhitelisted` → every vessel edit from the UI failed 400 `property code should not
  exist`. `editInput()` now destructures `code` out. Verified by the UI gate (PATCH 200).

**Voyages page** (`apps/web/.../voyages/page.tsx`):
- `VoyageForm` gains `tugVesselId`/`bargeVesselId`; create dialog shows two selects — **Tug**
  (populated from `GET /vessels?vesselType=TUG`) and **Barge** (`?vesselType=BARGE`) — plus a
  hint line; payload only includes a pairing key when one is selected (plain voyages unchanged).
- List: the Vessel cell renders a secondary line `Tug (CODE) + Barge (CODE)` when a pairing exists.
- Detail dialog: dedicated **Tug** and **Barge** rows (localized), showing `No tug` / `No barge`
  when absent.
- Wired through `useTranslations('voyages')`.

**Placement decision (recorded):** pairing UI lives at **voyage create** (there is no voyage edit
dialog in this UI — route edits are API-only while DRAFT, frozen once SCHEDULED), matching the
voyage-level association chosen in the modeling decision.

### M5: Translations — DONE

New top-level namespaces in `apps/web/messages/{en,fa,ar}.json` (JSON re-validated for all three):
- `vessels.detail.type`, `vessels.filter.allTypes`, `vessels.form.type` (fa **«نوع شناور»**, ar
  «نوع السفينة»), and `vessels.type.{CONTAINER,BULK,TANKER,RORO,GENERAL,PROJECT,OTHER,TUG,BARGE,LANDING_CRAFT}`
  — fa: کانتینری/فله‌بر/نفتکش/رو-رو/بار عمومی/پروژه‌ای/سایر/**یدک‌کش**/**بارج**/**لاندینگ کرفت**.
- `voyages.pairing.{tug,barge,noneTug,noneBarge,hint}` — fa «یدک‌کش»/«بارج», ar «قارب الجرّ»/«بارج».

### M6: Tests — DONE (all green)

`apps/api/test/vessel.e2e-spec.ts` (+4):
- creates vessels with TUG / BARGE / LANDING_CRAFT (201 + echo)
- updates a vessel type + filters the list by `vesselType=TUG` (all rows TUG)
- rejects an unknown type (400) — enum validation still holds
- backfill-safety: first 100 list rows all carry a valid type; seeded legacy `MV-HORIZON` still
  readable as `CONTAINER`

`apps/api/test/voyage.e2e-spec.ts` (+5):
- creates a voyage with a valid tug + barge (201; `tugVessel`/`bargeVessel` echoed with correct
  types; detail AND list both expose the pairing)
- rejects a self-propelled vessel as tug (409, message contains `TUG`)
- rejects a non-BARGE vessel as barge (409, message contains `BARGE`)
- rejects unknown tug ids (404)
- updates the pairing on a DRAFT voyage; plain voyage returns null pairing; clearing via `''`
  detaches tug while barge stays

Self-cleaning: fixtures pushed into `createdVessels`/`createdVoyages` (hard-deleted in `afterAll`).

---

## Test results (chunked `pnpm --filter` runs — root `pnpm test` script is a known broken
self-recursive `pnpm run test -r`, pre-existing)

| Chunk | Suites | Result |
|---|---|---|
| config (`pnpm --filter @shipping/config test`) | 1 | **6/6 passed** |
| C1: auth, app, cargo-inventory, portal, master-data | 5 | **92/92 passed** |
| C2: **vessel, voyage** | 2 | **33/33 passed** (incl. all 9 new tests) |
| C3: bill, manifest, inspection, actual-loading, discharge, delivery-release | 6 | 75 failed / 13 passed — **the 6 pre-existing `createRoleToken` suites** (baseline 76/12; no new failures) |
| C4: invoice, job, letter, proforma, quotation, salary, voucher | 7 | **82/82 passed** |

**Totals: 20 suites — 14 passed / 6 failed (pre-existing); 295 tests — 220 passed / 75 failed
(all failures inside the 6 known suites). New tests: 9, all passing. NO NEW FAILURES.**

---

## Verification performed

- `npx prisma validate` → valid 🚀
- `npx prisma migrate status` → before 27 (up to date) / after **28, up to date**
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` → **exit 0**
- `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` → only the same 3 pre-existing errors in
  `[locale]/page.tsx` (`home.services`/`capabilities`/`coverage`); **zero errors in any file this
  task touches** (vessels/voyages pages, shared types, tests).
- **Live API checks** (http://127.0.0.1:3101/api/v1, admin token):
  - `GET /vessels?vesselType=TUG&pageSize=2` → 200, `totalItems: 36`, every row `TUG`
  - `POST /vessels` with `vesselType: LANDING_CRAFT` → **201**, echoed
  - `POST /vessels` with `vesselType: HOVERCRAFT` → **400**
  - `PATCH /vessels/:id {vesselType}` → **200**, type echoed
  - `POST /voyages` with valid tug+barge → **201**, `tugVessel{code,vesselType:TUG}` + `bargeVessel{...:BARGE}`
  - `POST /voyages` with a CONTAINER vessel as tug → **409** `The assigned tug vessel must have vessel type TUG`
  - `POST /voyages` with a CONTAINER vessel as barge → **409** `The assigned barge vessel must have vessel type BARGE`
  - `POST /voyages` with unknown tug id → **404**
  - `GET /voyages/:id` → 200 with both pairing refs; `GET /voyages` list rows include them
  - `PATCH /voyages/:id {tugVesselId: ''}` → **200**, `tugVessel: null`, barge retained
  - All live-test fixtures (3 vessels + 1 voyage) deleted afterwards; DB restored to baseline
    **189 vessels / 21 voyages** (same counts as before the checks).

---

## UI / runtime acceptance gate (protocol §3.1) — **PASS**

Real running app at http://127.0.0.1:3000 (user's own dev servers; neither restarted):

- **Vessels page reachable from navigation** → `/en/vessels` renders with admin session.
- **Type visible in list:** TYPE column shows localized labels (`Barge`, `Tug`, `Landing craft`);
  the type filter select lists all 11 options (All types + 10).
- **Type filter works:** filtering by `Tug` returned only TUG rows (verified first row).
- **Create with a new type via UI:** created `UIGTLCT1` as `LANDING_CRAFT` through the form
  (POST 201, dialog closed, row appears with `Landing craft`).
- **Type editable via UI:** edit dialog prefilled correctly; changing type LANDING_CRAFT → TUG →
  back to LANDING_CRAFT each saved with **PATCH 200** and the list reflected it. (This exposed and
  led to the fix of the pre-existing `editInput` 400 bug.)
- **Detail view:** shows `Type: Landing craft` (localized).
- **Voyages pairing via UI:** create dialog shows **Tug** (36 options), **Barge** (39 options —
  server-side `vesselType` filtered) selects + the hint line; created `VOY-2609-00242` paired with
  tug+barge (POST 201); list renders the pairing line `All Vessels Tug (ALLVT-494KQ1) + All Vessels
  Barge (ALLVB-494KQ1)`; detail dialog shows dedicated **Tug**/**Barge** rows.
- **fa locale spot-check:** `/fa/vessels` filter options render یدک‌کش / بارج / لاندینگ کرفت and
  the type column shows «بارج».
- **Console/network:** `window.__errs` empty throughout (0 JS errors); all observed calls
  200/201; no validation errors affecting the feature.
- Evidence: screenshot `~/.config/browser-harness/tmp/shot.png`.
- UI fixtures (vessel `UIGTLCT1`, voyage `VOY-2609-00242`) hard-deleted afterwards; DB back to
  baseline counts.

Auth note: no vault login exists for this origin and the vault cannot prompt in this headless
session, so **no password was typed anywhere**; the browser session was established with the
access token obtained from the API login used for the required live checks.

---

## Failures and blockers

- **No blockers.** The out-of-band DB state was reconciled by writing the missing migration
  (documented above); no stop condition from the prompt was hit.
- 6 pre-existing e2e suite failures (bill/manifest/inspection/actual-loading/discharge/
  delivery-release, 75 tests) — unchanged `createRoleToken` baseline; expected, noted.
- 3 pre-existing web typecheck errors in `[locale]/page.tsx` — unrelated, untouched.
- Pre-existing `ALLVB-*`/`ALLVT-*` fixture vessels (Sept 21, from an earlier execution's test
  litter, 0 voyage references) were left in place — not created by this task, deleting them is out
  of scope.

## Deviations from this prompt

1. **Enum values:** the prompt proposed `SELF_PROPELLED, BARGE, TUG`; the plan documents four
   categories (Tug, Barge, Landing Craft, regular Vessel) and the codebase already had 7
   self-propelled categories. Final: keep the 7 + add `TUG`, `BARGE`, `LANDING_CRAFT` = 10 values.
   No `SELF_PROPELLED` value (the existing categories are the regular/self-propelled family;
   adding an alias would contradict the controlled set). Recorded per the prompt's
   "adjust only if the plan documents different values" clause.
2. **Association placement:** voyage-level (`Voyage.tugVesselId`/`bargeVesselId`) — the prompt's
   stated fallback, chosen because the docs describe optional pairing but don't mandate a
   Vessel-level `tugBargeNamePair` string field (`04-final-data-model.md:40`) nor schedule-level
   pairing; `12-open-business-decisions.md:105` explicitly makes this a technical decision, so no
   NEEDS_BUSINESS_DECISION stop was required. Not both models invented.
3. **"default SELF_PROPELLED" / type column:** the prompt assumed a new column with a default;
   in reality `Vessel.vesselType` already existed (NOT NULL, no default, every row populated
   since Phase 6). No default added (would contradict the required-on-create DTO); backfill-safety
   comes from the additive enum extension — existing values remain valid, verified by test.
4. **UI pairing edit surface:** no voyage edit dialog exists in the UI, so pairing is set at
   voyage **create** (and via the API while DRAFT). The prompt's "created/edited" UI requirement
   is satisfied for create; edit is API-level only, consistent with the existing route-freeze UX.
5. **Extra bug fix (minimal, gate-blocking):** `editInput()` on the vessels page dropped the
   immutable `code` field to stop pre-existing 400s on vessel edit — required to make "type
   editable in the running app" verifiable; no other vessel-page behavior changed.
6. Root `pnpm test` remains broken (pre-existing recursive script) — chunked per-package runs
   used, as established in the prior task.

---

## Files changed

**New:**
- `prisma/migrations/20260929142911_vessel_type_tug_barge/migration.sql`
- `docs/current-plan/implementation-log/phase-2-vessel-tug-barge.md` (this log)

**Modified (this execution):**
- `packages/shared/src/vessel.ts` — `VesselType` + 3 values
- `packages/shared/src/voyage.ts` — `VoyageTugBargeRef`, pairing fields on `VoyageListItem`
- `packages/shared/src/index.ts` — re-export
- `apps/api/src/modules/voyages/dto/voyage.dto.ts` — `string | null` on update pairing fields
- `apps/api/src/modules/voyages/voyages.service.ts` — clear-coercion + `!== undefined` guards
- `apps/web/src/app/[locale]/(dashboard)/vessels/page.tsx` — 10 types, localized labels, editInput fix
- `apps/web/src/app/[locale]/(dashboard)/voyages/page.tsx` — pairing form/list/detail
- `apps/web/messages/{en,fa,ar}.json` — `vessels.*` + `voyages.pairing.*`
- `apps/api/test/vessel.e2e-spec.ts` — +4 tests
- `apps/api/test/voyage.e2e-spec.ts` — +5 tests

**Inherited from the prior interrupted execution (already present at resume, kept):**
- `prisma/schema.prisma` — enum + 3 values, `Voyage` pairing columns/relations/indexes, back-relations
- `apps/api/src/modules/vessels/dto/vessel.dto.ts` — `VESSEL_TYPES` with 10 values
- `apps/api/src/modules/voyages/dto/voyage.dto.ts` — optional pairing fields on create
- `apps/api/src/modules/voyages/voyages.service.ts` — pairing selects + `assertMasterData` type validation

**Not touched (out of scope):** Cargo, LoadList, ActualLoading, Discharge, Manifest, B/L, Invoice,
Voucher, Ledger, Job, Release, Delivery, Agent Portal, reporting modules, voyage per-destination
numbering, existing Vessel fields, permissions (reused existing `vessel:*`/`voyage:*` codes),
seed (no change needed).

---

## Final status

TASK STATUS: **COMPLETE** — all acceptance criteria met, including the mandatory UI/runtime gate
(PASS). Existing vessel FKs (Manifest/LoadList/ActualLoading/Discharge `vesselId`) unchanged and
their suites show no new failures.

EXECUTION_STATUS: COMPLETE
HANDOFF_TO: NONE
IMPLEMENTATION_LOG: docs/current-plan/implementation-log/phase-2-vessel-tug-barge.md
TASK: Phase 2 — Vessel type & tug/barge modeling (migration declaration + shared types + UI + translations + tests + UI gate)
COMPLETED: Missing migration authored & applied (28 migrations, up to date); enum extended to 10 values (TUG/BARGE/LANDING_CRAFT added to the 7 existing); voyage-level tug/barge pairing with type validation (409/404); shared VesselType + VoyageTugBargeRef types; vessels UI (10 types, localized labels, editInput 400 bug fixed); voyages UI (tug/barge selects at create, pairing line in list, Tug/Barge rows in detail); en/fa/ar translations; 9 new e2e tests; full verification + UI gate PASS
REMAINING: none for this task (optional follow-ups: 6 pre-existing createRoleToken e2e suites; 3 pre-existing web tsc errors in [locale]/page.tsx; root `pnpm test` recursive script; Sept-21 ALLVB/ALLVT fixture litter left untouched)
TEST_STATUS: config 6/6; api e2e 20 suites: 14 passed / 6 failed (pre-existing createRoleToken), 295 tests: 220 passed / 75 failed (all in the 6 known suites) — NO NEW FAILURES; vessel 15/15 (+4 new), voyage 18/18 (+5 new)
DB_MIGRATION_STATUS: applied — 28 migrations, `npx prisma migrate status` = up to date; `prisma validate` valid; enum 10 values; Voyage.tugVesselId/bargeVesselId nullable columns + indexes + FKs (ON DELETE SET NULL ON UPDATE CASCADE); DB restored to baseline after live checks (189 vessels / 21 voyages)
BLOCKERS: none
DEVIATIONS: (1) enum = 10 values (docs' 4 categories over prompt's proposed 3; no SELF_PROPELLED alias); (2) association placed at voyage level per prompt fallback + doc 12 technical-decision note; (3) no new type column/default — column pre-existed NOT NULL with all rows populated, backfill via additive enum extension; (4) pairing UI at voyage create only (no voyage edit dialog exists; API edit works while DRAFT); (5) minimal pre-existing editInput `code`-on-PATCH 400 fix on vessels page; (6) chunked per-package test runs (root `pnpm test` pre-existing bug)
NEXT_CHECKPOINT: none — task complete; UI verified in running app (/en/vessels + /en/voyages, fa spot-check, 0 console errors)
