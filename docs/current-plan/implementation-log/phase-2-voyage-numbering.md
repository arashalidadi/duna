# Phase 2 — Voyage per-destination numbering — implementation log

**Task ID:** phase-2-voyage-numbering
**Roadmap:** Phase 2 — Master Data & Party Model Realignment / Voyage numbering subphase
**Objective:** Per-destination voyage numbers usable in documents (D/O, B/L, manifests), with
multi-destination voyages representable as legs, existing voyages/numbers untouched, and
downstream voyage FK references (Cargo/LoadList/ActualLoading/Discharge) unchanged.

---

## Authoritative doc consultation (BEFORE coding, as required)

| Doc | Finding |
|---|---|
| `01-final-requirements.md:58-64` | "**Voyage** is a sailing of a vessel to a destination." / "Voyage numbering is **per destination**." / "first 2026 sailing to Khorramshahr is `1/26`, the second is `2/26`." / "If the same vessel later sails to Bandar Abbas, that destination has its own sequence." / "derived automatically from vessel + destination + sailing count." |
| `01-final-requirements.md:249` | "Voyage numbering should be per destination and derived from vessel + destination + sailing sequence." |
| `04-final-data-model.md:44` | Voyage: `id, vesselId, destinationPortId, voyageNumber per destination, planned dates, status` — **singular destination**, one Voyage → many LoadLists/B/L/Manifest/Invoices/Jobs. **No VoyageLeg/VoyageDestination child table anywhere in the data model.** |
| `02-target-system-blueprint.md:139` / `05-final-api-blueprint.md:145,152` / `07-document-blueprint.md:36` | Voyage numbering: per destination / destination sequence. |
| `06.5-technical-decision-lock.md:193-226` | **Locked:** one `NumberingSequence` infrastructure; **Voyage = destination-scoped**; "exact display format is a technical implementation choice"; "Do not rename or regenerate historical existing document numbers." |
| `07-final-implementation-roadmap.md` (ai-audit, Phase 2) | "destination-aware Voyage numbering integration with the locked defaults"; "**Voyage numbering changes must preserve existing numbers where applicable**"; acceptance "Voyage numbering uses destination-scoped defaults". |
| `08-requirement-traceability.md:157-162` | Employer evidence `1/26`, `2/26` per destination; module: Voyage, NumberingSequence. |
| `11-implementation-state.md:34` | "Voyage per-destination numbering not started." (this task) |
| `12-open-business-decisions.md:104` | "Voyage numbering approach can be finalized as per-destination with a technical format decision." → no NEEDS_BUSINESS_DECISION stop required. |

**Multi-destination grep (whole docs tree):** zero hits for VoyageLeg / VoyageDestination child
table / leg numbering / multi-destination voyage structure. The docs model ONE voyage = ONE
destination; "per destination" modifies the **numbering sequence scope**, not the voyage shape.

### Modeling decisions (recorded per prompt rules)

1. **Structure — deviation, fallback model used.** Docs are silent on multi-destination voyages
   (they define only `Voyage.destinationPortId`), while the task objective requires one expedition
   with N destination legs. Per the prompt's explicit fallback: implement a **`VoyageDestination`
   child model** `(voyageId, destinationPortId, legNumber, voyageNumber)` — one alternative only.
   Recorded as deviation: docs contain no leg structure to copy.
2. **Numbering semantics follow the docs/lock**, not the task's illustrative example:
   destination-scoped sequence via the locked `NumberingSequence` infrastructure, rendered in the
   evidence format **`{sequence}/{YY}` → `1/26`, `2/26`** (scoped per destination per year).
   The task's `VOY-2609-00242-BANDAR-ABBAS` was marked "e.g."; docs' exact semantics win
   (prompt: "verify … for the exact numbering semantics … confirm before coding").
3. **Parent `Voyage.voyageNumber` format stays `VOY-YYMM-#####`** (global YEAR_PERIOD sequence,
   unchanged): roadmap mandates preserving existing numbers, existing e2e asserts that format,
   and "single-destination create unchanged" / "existing voyage regression unchanged" are
   acceptance items. The parent number remains the system/reference identifier (all existing FK
   consumers touch `voyageId`, not the number); **legs carry the per-destination document numbers**.
4. **Backfill (task-mandated):** every existing voyage gets exactly one leg
   `legNumber=1, voyageNumber = Voyage.voyageNumber` — legacy numbers grandfathered, no voyage
   row rewritten. New voyages' legs always get freshly allocated destination-scoped numbers.
5. **Format/scope technicalities:** per-destination uniqueness enforced by
   `@@unique([destinationPortId, voyageNumber])` (format `1/26` legitimately repeats across
   destinations — docs say each destination has its own sequence). Sequence key =
   `voyage-<portId>-<YY>` (year-rotating, distinct from the stale `voyage-<portId>` rows left by
   a reverted 2026-09-21 execution — those are untouched).

---

## Current state found at resume (verified in FS + live DB)

- `Voyage` field is **`voyageNumber`** (`@unique`), NOT code/voyageNo; columns include
  tugVesselId/bargeVesselId (just-completed task). 21 voyages exist.
- `NumberingSequence` model + `NumberingService` (row-locked, `FOR UPDATE`) exist from Phase 1;
  live DB has 113 rows incl. live `voyage-2609` (YEAR_PERIOD, `VOY-2609-`, nextSequence 243).
- `voyages.service.ts` `create()` already allocates the parent number via
  `numbering.allocateNumber({name: voyage-${yymm}, scopeType: YEAR_PERIOD, prefix: VOY-${yymm}-})`.
- No `VoyageDestination`/leg model anywhere (schema, API, UI, tests).
- No `*.spec.ts` unit tests in `apps/api` (the ai-audit phase-2 log references specs that do not
  exist in this tree); tests live in `test/*.e2e-spec.ts` → tests go into `voyage.e2e-spec.ts`.
- `prisma migrate status` BEFORE: **28 migrations, up to date.**

---

## Work completed

### 1. Schema + migration
- Added `VoyageDestination` to `prisma/schema.prisma` with `voyageId`/`destinationPortId` FKs,
  `legNumber`, `voyageNumber`, `deletedAt` (soft-delete convention), back-relation `Voyage.legs`,
  `Port.voyageLegs`, `@@unique([destinationPortId, voyageNumber])`,
  `@@unique([voyageId, destinationPortId])`, `@@index([voyageId])` (+ destinationPortId/createdAt).
  `prisma validate` → **valid**.
- Migration via CLAUDE.md non-interactive flow: `migrate diff --from-url --to-schema-datamodel
  --script` → extracted only the VoyageDestination DDL (diff also lists unrelated pre-existing
  agent-index drift, untouched) → authored
  `prisma/migrations/20260929164932_voyage_destination_legs/migration.sql`
  (CREATE TABLE + indexes + FKs guarded with IF NOT EXISTS/DO blocks, **idempotent**
  `INSERT ... SELECT` backfill: one leg per voyage, `legNumber=1`,
  `voyageNumber = Voyage.voyageNumber`, skipped when the voyage already has a leg) →
  `prisma migrate deploy` → applied.
- **migrate status BEFORE: 28 migrations, up to date. AFTER: 29 migrations, up to date.**
- Backfill verified on live DB: **21 legs / 21 voyages, 0 voyages without a leg,
  0 legs where leg1 != parent number.**
- `prisma generate` re-run (client gains `voyageDestination`).
- `prisma/seed.ts`: added an idempotent leg-ensure after the seeded voyage upsert (on a fresh DB
  the migration backfill runs before seed, so a seed-created voyage would otherwise have no leg).
  `pnpm db:seed` re-run → clean, idempotent.

### 2. API (`apps/api/src/modules/voyages/`)
- `CreateVoyageDto.destinations?: string[]` (optional, max 20) and
  `UpdateVoyageDto.destinations?: string[]`; DTO import block extended (IsArray/ArrayMaxSize).
- `voyages.service.ts`:
  - `assertDestinationLegs()` — duplicate destination within one voyage → **400**;
    unknown → **404**; inactive → **409**.
  - `allocateLegNumber()` — destination-scoped allocation via the locked `NumberingService`:
    sequence name `voyage-<portId>-<YY>`, `scopeType DESTINATION`, format `{sequence}/<YY>`,
    padding 1, period `YY` → renders `1/26`, `2/26`. Touches neither the 113 stale
    `voyage-<portId>` rows nor the live `voyage-2609` YEAR_PERIOD parent sequence.
  - `previewDestinationNumbers()` — read-only next-number preview (mirrors allocation rules,
    no sequence mutation) for the create-dialog preview.
  - `create()` — parent allocation **unchanged** (`voyage-<yymm>` → `VOY-YYMM-#####`), then one
    destination-scoped allocation per leg, legs created nested (`legs.create`, legNumber 1..N).
  - `update()` — DRAFT-only leg reconciliation: kept legs keep their number and are renumbered
    by position, added legs get a fresh allocation (soft-deleted rows are **revived** so the
    `voyageId+destinationPortId` unique holds), dropped legs are soft-deleted
    (`deletedAt`). Re-targeting `destinationPortId` alone also re-syncs leg 1. All writes in one
    `$transaction` with the voyage update. A PATCH without `destinations` and without a primary
    change leaves legs untouched.
  - `listSelect`/`detailSelect` now embed `legs` (ordered by legNumber, `deletedAt: null`) with
    full port refs.
  - SCHEDULED freeze guard extended: `destinations` rejected on a SCHEDULED route (**409**);
    notes-only edits still allowed.
- `voyages.controller.ts`: `GET /voyages/number-preview` declared **before** `:id`
  (voyage:read, comma-separated `destinationPortIds`).
- `apps/api` `tsc --noEmit` (src + test) → **0 errors**.

### 3. Shared types (`packages/shared/src`)
- `VoyageDestination` + `VoyageLegPortRef` interfaces in `voyage.ts`;
  `VoyageListItem.legs: VoyageDestination[]` (detail spreads list → inherits);
  both exported from `index.ts`. `pnpm --filter @shipping/shared build` → **0 errors**.

### 4. UI (`apps/web/.../voyages/page.tsx`)
- Create dialog: optional destination rows (add/remove, port selects de-duplicated against
  primary + other rows), per-row `nextVoyageNumber` preview + primary-destination preview line
  fetched from `/voyages/number-preview` (advisory, never blocks the form).
- Client-side validation mirrors API: empty row / duplicate destination → form error before POST;
  payload only includes `destinations` when non-empty (**single-destination payload unchanged**).
- Detail dialog: legs table (leg number, destination, voyage number).
- List Route column: chains all leg codes for multi-destination; **identical to before for
  single-destination voyages**.
- en/fa/ar `voyages.legs.*` (14 keys each): «مقصدها» / «الوجهات», «افزودن مقصد» /
  «إضافة وجهة», hint text — ICU `{seq}` brace hazard removed from hint strings (only `{n}`
  interpolation remains).
- `apps/web` `tsc --noEmit` → only the **3 pre-existing** `[locale]/page.tsx` errors
  (`home.services/capabilities/coverage`), zero new.

### 5. Tests (`apps/api/test/voyage.e2e-spec.ts`) — 7 new
single-destination → exactly 1 leg `{seq}/{YY}` + parent `VOY-\d{4}-\d{5}` unchanged;
multi-destination → N legs, sequential legNumbers `[1,2]`, unique (destination,number) pairs,
list row carries legs; duplicate destination → 400 (also unknown → 404);
number-preview → `1/<YY>` then `2/<YY>` after allocation, no pre-allocation;
DRAFT add/remove/re-add(revive) legs + duplicate PATCH → 400 + SCHEDULED destinations → 409
while notes stay editable; PATCH without destinations preserves legs (regression);
backfill regression → pre-existing voyages have exactly 1 leg mirroring the parent number.

**Voyage suite: 25/25 passed** (18 pre-existing + 7 new).

### 6. Verification
| Check | Result |
|---|---|
| `prisma validate` | valid |
| `prisma migrate status` | 29 migrations, up to date (was 28) |
| `tsc --noEmit` API (src+test) | 0 errors |
| `tsc --noEmit` web | 3 pre-existing only, 0 new |
| shared build | 0 errors |
| chunked full e2e (root script broken) | 302 tests: **227 passed / 75 failed** — baseline was 295/220/75; identical 6-suite `createRoleToken` failure set, **+7 new passing, 0 new failures** |
| live API | single create → 1 leg `1/26`; multi create → `2/26`+`1/26` (sequence advanced correctly); detail echoes legs; list includes legs; PATCH w/o destinations preserves legs; duplicate → 400 "Duplicate destination in a voyage"; preview `2/26`; DRAFT add/remove legs — **all passed** |
| fixtures cleaned | live voyages/vessel/ports deleted via Prisma (no DELETE route on voyages); DB back to **21 voyages / 21 legs** |

### 7. UI/runtime acceptance gate (§3.1) — **PASS**
- `/en/voyages` list: single-destination row renders `ABBR-5IK1NC → ABBR-8Y2KPB`
  (unchanged), multi-destination row chains `ABBR-5IK1NC → ABBR-8Y2KPB → ABBR-3C0OU7`.
- Created single-destination voyage **VOY-2609-00264** via the UI form → detail
  **Destinations** table: `1 | Abbreviation Test Port (ABBR-8Y2KPB) | 1/26`.
- Created 2-destination voyage **VOY-2609-00265** via add-destination row → detail table:
  `1 … ABBR-8Y2KPB | 2/26` and `2 … ABBR-3C0OU7 | 1/26` — **distinct {seq}/{YY}**;
  create-dialog preview showed `2/26` (primary) + `1/26` (row) before submit.
- fa spot-check: dialog labels «مقصدها», «افزودن مقصد», row label «مقصد 2»,
  remove «حذف مقصد 2», hint «هر مقصد شمارهٔ خودش را دارد (مثلاً 1/26). مقصد اول، مرحلهٔ ۱ است.» —
  fa/ar/en JSON keys verified present (0 lost vs HEAD).
- **Console: 0 errors** (`window.__errs` collector + `error`/`unhandledrejection` listeners
  across list → create dialog → preview → submit → detail render); no Next.js error overlay.
- Gate voyages + live fixtures deleted after evidence capture; DB restored to 21/21.

## Notes / deviations
- Deviation (recorded, per task rules): docs define no leg structure → the fallback
  `VoyageDestination` child model was implemented (binding decision 1); numbering follows the
  docs' per-destination semantics with format `{seq}/{YY}` (binding decision 2), not the task's
  illustrative `VOY-…-BANDAR-ABBAS` example.
- New read-only route `GET /voyages/number-preview` added to satisfy the "auto per-destination
  number preview" UI requirement (voyage:read, no allocation side effects).
- No commit made (not requested by this task).

---

```
EXECUTION_STATUS: COMPLETE
TASK: phase-2-voyage-numbering
PHASE: Phase 2 / Voyage numbering subphase
SCHEMA_MIGRATION: COMPLETE (20260929164932_voyage_destination_legs, deploy 28→29 up to date)
BACKFILL: COMPLETE (21/21 voyages, leg1 == parent, 0 orphans)
API: COMPLETE (create/update/detail/list/preview + validation; tsc 0 errors)
SHARED_TYPES: COMPLETE (VoyageDestination, legs on list+detail; build 0 errors)
UI: COMPLETE (create rows + preview, detail legs table, list chain, en/fa/ar)
TESTS: COMPLETE (voyage 25/25; full suite 227/302, 0 new failures vs baseline)
LIVE_API_CHECKS: PASS
UI_GATE_3_1: PASS (VOY-2609-00264 single 1/26; VOY-2609-00265 2 legs 2/26+1/26; fa keys; 0 console errors)
FIXTURES_CLEANED: YES (DB 21 voyages / 21 legs)
OUT_OF_SCOPE_UNTOUCHED: Cargo/LoadList/ActualLoading/Discharge rewiring, document leg-number consumption, parent format, tug/barge, permissions
NEEDS_BUSINESS_DECISION: NONE
BLOCKED: NONE
HANDOFF_TO: NONE
```
