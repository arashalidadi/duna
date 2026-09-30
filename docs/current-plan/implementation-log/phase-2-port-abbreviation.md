# Phase 2 — Port Abbreviation Implementation Log

**Task ID:** phase-2-port-abbreviation
**Roadmap:** Phase 2 — Master Data & Party Model Realignment / Port abbreviation sub-phase
**Objective:** Make Port.abbreviation usable end-to-end: stored via migration, validated in API, exposed in shared types, visible/editable in UI.

---

## Planned scope

1. Database: proper Prisma migration for Port.abbreviation (nullable + unique)
2. Backend: DTO validation, service select/map, conflict handling
3. Shared types: abbreviation on PortListItem/PortDetail
4. Frontend: abbreviation input in create/edit form, column in list, field in detail
5. Translations: en/fa/ar keys
6. Tests: create with/without abbreviation, duplicate rejection, update, list/detail inclusion

---

## Pre-existing state (inherited)

- `Port.abbreviation String? @unique` already in `prisma/schema.prisma`.
- Backend DTO already has `abbreviation?: string` (@MaxLength(10)) on CreatePortDto/UpdatePortDto.
- Backend service already includes `abbreviation: true` in select and handles trim/null in create/update.
- Backend controller already exposes existing CRUD routes (no new routes needed).
- Live DB: column exists (nullable text), but only a **non-unique** index `Port_abbreviation_idx` — the unique constraint from `@unique` is NOT yet enforced.

---

## Milestones — EXECUTED

### M1: Data cleanup + migration — DONE

**Blocker found at resume:** the live DB had duplicate abbreviation values from test fixtures
(`ABP` x9, `OLD` x7, `' XYZ'` x7 with a leading space, `NAB` x7), which would violate the unique
constraint. Decision (Option 3, binding): null out every row participating in a duplicated
(TRIM-compared) abbreviation value in one transaction; do not invent replacements.

Executed as two Prisma `$transaction` calls (scripts `scripts/tmp-cleanup-dup-abbr.cjs` and
`scripts/tmp-cleanup-dup-abbr2.cjs`, one-shot, removed after use):

- Pass 1: 4 duplicated trimmed values found (OLD/ABP/XYZ/NAB) -> 23 rows set to NULL.
  The `' XYZ'` group (leading space) was not matched by the `in` filter, so 7 rows remained.
- Pass 2: TRIM-aware `UPDATE ... WHERE TRIM(abbreviation) IN (SELECT ... HAVING COUNT(*) > 1)`
  -> 7 more rows set to NULL.
- Final scan: `[]` duplicates. 248 ports total, all `abbreviation = NULL`. No rows deleted,
  no other column touched.

Migration created via the CLAUDE.md non-interactive flow (SQL authored, placed in
`prisma/migrations/`, applied with `prisma migrate deploy` — `prisma migrate diff` output was
also consulted; its Port-specific delta is exactly `DROP INDEX Port_abbreviation_idx` +
`CREATE UNIQUE INDEX Port_abbreviation_key`):

- Path: `prisma/migrations/20260929132053_add_port_abbreviation_unique/migration.sql`
- Summary: `ALTER TABLE "Port" ADD COLUMN IF NOT EXISTS "abbreviation" TEXT` (column already
  present on live DB — IF NOT EXISTS keeps it safe on both live DB and fresh replay), then
  `DROP INDEX IF EXISTS "Port_abbreviation_idx"` (stray non-unique index created outside Prisma,
  not declared in schema, redundant once the unique index exists), then
  `CREATE UNIQUE INDEX IF NOT EXISTS "Port_abbreviation_key" ON "Port"("abbreviation")`.
  Additive and non-destructive: no existing port data dropped or rewritten; Postgres treats
  NULLs as distinct, so ports without an abbreviation are unaffected.

`migrate status` BEFORE deploy: reported 26 local migrations and warned that 4 migrations
recorded in the DB are not present locally (`20260921012713_phase1_infrastructure`,
`20260921032600_phase2_master_data_party_model`,
`20260921120000_phase3_cargo_inspection_loading_lifecycle`,
`20260921130000_phase3a_cargo_pol_pod`) — pre-existing discrepancy, untouched by this task.
`migrate deploy`: applied `20260929132053_add_port_abbreviation_unique` (27 local migrations now).
`migrate status` AFTER deploy: `27 migrations found ... Database schema is up to date!`.

Live DB verified post-deploy: index `Port_abbreviation_key` present and UNIQUE; column
`abbreviation` is `text NULL`; 248 rows, 0 with an abbreviation.

### M2: Shared types — DONE

`PortListItem.abbreviation: string | null` added in `packages/shared/src/master-data.ts`;
`PortDetail extends PortListItem` so it inherits it; already re-exported from `index.ts`.

### M3: Backend service — DONE (extends original scope minimally)

- `create()` / `update()` now map through a `mapUniqueViolation` helper (same pattern as the
  shippers/agents modules): Prisma P2002 on target `abbreviation` -> 409
  `A port with abbreviation "X" already exists`; on target `code` -> 409
  `A port with this code already exists`. (The global `HttpExceptionFilter` already mapped
  P2002 -> 409 generically; this makes the message field-specific and clear.)
- **Bug fixed:** `abbreviation: dto.abbreviation?.trim() || null` on *update* coerced
  `undefined` -> `null`, meaning any PATCH omitting the field would have wiped an existing
  abbreviation. Update now only writes the column when the key is present
  (`...(dto.abbreviation !== undefined ? {...} : {})`).
- `create`/`update` responses now use the module `select` (explicitly includes abbreviation).

### M4: Frontend — DONE

`apps/web/src/app/[locale]/(dashboard)/ports/page.tsx`:
- `FormValues`/`EMPTY_FORM`/`toForm` carry `abbreviation`.
- Create/edit form: optional `port-abbreviation` input (uppercase transform, `maxLength={10}`,
  hint text) below City.
- List: compact `Abbr` column after Port — monospace chip when set, em-dash (localized) when null.
- Detail dialog: Abbreviation row added to the info grid.
- Client-side validation: abbreviation > 10 chars blocks submit with the localized message.
- `savePayload()` always includes `abbreviation` (even empty) so clearing the field on edit
  actually clears it server-side instead of being dropped by `formInput`'s empty-string filter.

### M5: Translations — DONE

New top-level `ports` namespace (alphabetically before `proforma`) in
`apps/web/messages/{en,fa,ar}.json`: `abbreviation.{label,placeholder,hint,column,detail,empty,validation}`.
fa: «اختصار», ar: «الاختصار». All three files re-parsed as valid JSON.
(The ports page previously had no i18n at all; only the new abbreviation strings are wired
through `useTranslations('ports')` — translating the whole page is out of scope.)

### M6: Tests — DONE (pending run)

5 new cases in the Ports block of `apps/api/test/master-data.e2e-spec.ts`:
create-with-abbreviation (201 + echo), duplicate-abbreviation (409 + message contains
"abbreviation"), update-abbreviation (200 + echo), list+detail include abbreviation,
create-without-abbreviation (201 + null). Tag-based unique codes; new ports pushed into
`createdPorts` so the existing `afterAll` hard-delete cleanup covers them.

---

## Files changed

**New:**
- `prisma/migrations/20260929132053_add_port_abbreviation_unique/migration.sql`

**Modified:**
- `packages/shared/src/master-data.ts` — `PortListItem.abbreviation`
- `apps/api/src/modules/ports/ports.service.ts` — P2002 -> 409 mapping, update-write guard, select
- `apps/web/src/app/[locale]/(dashboard)/ports/page.tsx` — form + list + detail + validation
- `apps/web/messages/en.json`, `fa.json`, `ar.json` — `ports.abbreviation.*`
- `apps/api/test/master-data.e2e-spec.ts` — 5 abbreviation tests

---

## Verification performed

### Typecheck
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` -> **exit 0** (clean).
- `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` -> 3 errors, all in
  `apps/web/src/app/[locale]/page.tsx` (`home.services` / `home.capabilities` /
  `home.coverage` index types). Pre-existing: that file and the `home` namespace were not
  touched by this task (edits were `ports` namespace + `ports/page.tsx`, which typecheck clean).

### Prisma
- `npx prisma validate` -> `The schema at prisma/schema.prisma is valid`.
- `npx prisma migrate status` BEFORE deploy: 26 local migrations; warning that 4 DB-recorded
  migrations are missing locally (`20260921012713_phase1_infrastructure`,
  `20260921032600_phase2_master_data_party_model`,
  `20260921120000_phase3_cargo_inspection_loading_lifecycle`,
  `20260921130000_phase3a_cargo_pol_pod`) — pre-existing, untouched.
- `npx prisma migrate deploy` -> applied `20260929132053_add_port_abbreviation_unique`.
- `npx prisma migrate status` AFTER -> `27 migrations found in prisma/migrations` /
  `Database schema is up to date!`.
- Live DB column check: `Port.abbreviation` = `text` `NULL`-able; unique index
  `Port_abbreviation_key` present; `Port_abbreviation_idx` (stray) gone.

### Tests
- `pnpm --filter @shipping/config test` -> **1 suite, 6/6 passed**.
- `pnpm --filter api test` (20 e2e suites, run in chunks because the root `pnpm test` script
  is a broken self-referential `pnpm run test -r` that recurses — pre-existing script bug):
  - master-data: **1 suite, 26/26 passed** (includes the 5 new abbreviation tests:
    create-with-abbreviation, duplicate-abbreviation 409, update-abbreviation,
    list+detail include abbreviation, create-without-abbreviation -> null)
  - auth/app/cargo-inventory/vessel/voyage/portal: **6 suites, 90/90 passed**
  - invoice/job/letter/proforma/quotation/salary/voucher: **7 suites, 82/82 passed**
  - bill/manifest/inspection/actual-loading/discharge/delivery-release: **6 suites FAILED,
    76 failed / 12 passed** — identical to the pre-existing baseline (the
    `createRoleToken` -> `GET /api/v1/permissions/all` 404 cascade). **No new failures.**
  - Totals: **20 suites — 14 passed, 6 failed; 286 tests — 210 passed, 76 failed**
    (baseline before this task: 281 tests / 205 passed / 76 failed; +5 new tests, all passing).

### Live API checks (http://127.0.0.1:3101/api/v1, admin token)
- `GET /ports?pageSize=1` -> 200, item includes `"abbreviation": null` (shape correct).
- `POST /ports` with `abbreviation: "LIVEAB8929"` -> **201**, response echoes
  `"abbreviation": "LIVEAB8929"`.
- `POST /ports` with the same abbreviation -> **409**
  `A port with abbreviation "LIVEAB8929" already exists`.
- `GET /ports/:id` -> 200, `abbreviation` present.
- `PATCH /ports/:id` `{abbreviation}` -> 200, echoed new value.
- Regression: `PATCH` omitting `abbreviation` -> 200, existing value **preserved**
  (verifies the `undefined`-wipe bug fix).
- Regression: `PATCH` with `abbreviation: ""` -> 200, value cleared to `null`.
- `GET /ports?search=...` -> list row includes the field.
- Test ports created for these checks were deleted afterwards (DB back to 248 ports,
  0 with abbreviation, 0 duplicates).

---

## UI / runtime acceptance gate (protocol §3.1) — PASS

Real running app at http://127.0.0.1:3000 (user's own dev servers; neither restarted):
- **Navigation**: `/en/ports` reachable from the sidebar; page renders with admin session.
- **List**: table header shows `PORT | ABBR | COUNTRY | CITY | STATUS | ACTIONS`;
  existing ports show the localized em-dash (—) in ABBR; new record showed its chip.
- **Create via UI form**: New port dialog -> filled code/name/country/city
  + `port-abbreviation` input (hint "Optional. Short unique port code, max 10 characters.")
  -> `POST /api/v1/ports` **201**, list reloaded 200, dialog closed, row appeared with `UGT`.
- **Edit via UI**: Edit prefilled (`abbreviation: UGT`) -> changed to `UGT2` -> Save
  -> list row and `GET /ports/:id` both show `UGT2` (confirmed server-side via API too).
- **Detail view**: dialog shows `Abbreviation / UGT2` in the info grid.
- **Client-side validation**: abbreviation of 13 chars blocked submit with the localized
  message `Abbreviation must be 10 characters or fewer.` (no request sent).
- **Console/network**: `window.__errs` empty throughout (0 JS errors); all observed calls
  201/200; no validation or feature-affecting errors.
- Evidence: screenshot `/home/duna/.config/browser-harness/tmp/shot.png`.
- The UI fixture (`UIGATE1`) was hard-deleted after verification.

Auth note: no vault login exists for this origin and the vault cannot prompt in this
(headless) session, so no password was typed anywhere; the browser session was established
by injecting the access token already obtained from the API for the required live checks.

---

## Notes / decisions taken without stopping (per prompt)

- Max length 10 chars (DTO already `@MaxLength(10)`); client mirrors it. Reasonable default.
- No backfill of abbreviations (explicitly out of scope); column stays nullable.
- Index name follows Prisma convention `Port_abbreviation_key` (matches `Port_code_key`).
- The leading-space `' XYZ'` values were treated as duplicated against `XYZ` by TRIM comparison
  and nulled together with the other duplicates — no replacement values invented.
- Stray non-unique `Port_abbreviation_idx` dropped by the migration (not in schema; redundant
  once the unique index exists).

---

## Failures and blockers

- **Duplicate-abbreviation blocker (resolved per binding decision Option 3):** live DB had
  `ABP` x9, `OLD` x7, `' XYZ'` x7, `NAB` x7. Nullified (not deleted, no invented values) in
  2 transactions; 30 rows total; verified 0 duplicates before migrating.
- **6 pre-existing e2e suite failures** (bill/manifest/inspection/actual-loading/discharge/
  delivery-release, 76 tests) — unchanged baseline `createRoleToken` issue; expected, noted.
- **Root `pnpm test` script is broken** (`"test": "pnpm run test -r"` self-recurses with `-r`
  accumulating; produces ELIFECYCLE noise and never yields a usable summary). Pre-existing.
  Worked around by running `pnpm --filter <pkg> test` per package and chunking the API e2e
  suites. Not fixed here (out of scope).
- **Two background e2e runs were SIGTERM'd externally (exit 143)** before chunked foreground
  runs succeeded; no code impact — all 20 suites were eventually executed via chunks.
- No new blocker requiring a stop.

## Deviations from this prompt

1. Service change went slightly beyond "include abbreviation in mapping": fixed a real
   wipe-on-omit bug (`dto.abbreviation?.trim() || null` coerced `undefined` -> `null` on
   update) and added field-specific P2002 -> 409 messages, as the prompt's "handle duplicate
   conflict / clear error" requirement implies.
2. Frontend clearing semantics: `abbreviation` is always sent (even empty) via
   `savePayload()` so a user can clear an existing abbreviation; other optional fields keep
   the legacy strip-empty behavior.
3. The migration additionally drops the stray `Port_abbreviation_idx` (undeclared in schema,
   redundant) alongside creating the unique index — same additive spirit, no data touched.
4. `pnpm test` (root) not usable as-is due to the pre-existing recursive script; chunked
   `pnpm --filter api test` used instead.
5. Web typecheck has 3 pre-existing errors in `[locale]/page.tsx` (unrelated `home`
   namespace); not fixed (out of scope). Zero errors in files this task touches.

---

## Final status

TASK STATUS: **COMPLETE** — all 9 acceptance criteria met, including the mandatory
UI/runtime gate (PASS).

EXECUTION_STATUS: COMPLETE
HANDOFF_TO: NONE
IMPLEMENTATION_LOG: docs/current-plan/implementation-log/phase-2-port-abbreviation.md
TASK: Phase 2 — Port abbreviation end to end (duplicate resolution + migration + shared types + UI + translations + tests + UI gate)
COMPLETED: Duplicate cleanup (30 rows nulled, verified 0 remaining); migration 20260929132053_add_port_abbreviation_unique applied (27 migrations, up to date); unique index Port_abbreviation_key live; PortListItem.abbreviation shared type; ports service select/create/update + P2002->409 + wipe-on-omit fix; ports page form/list/detail/validation; en/fa/ar ports.abbreviation.* keys; 5 new e2e tests; full verification incl. live API checks and UI gate PASS
REMAINING: none for this task (optional follow-ups: fix root `pnpm test` recursive script; 3 pre-existing web typecheck errors in [locale]/page.tsx; 6 pre-existing createRoleToken e2e suites)
TEST_STATUS: config 6/6 passed; api e2e 20 suites: 14 passed / 6 failed (pre-existing), 286 tests: 210 passed / 76 failed (pre-existing) — NO NEW FAILURES; master-data 26/26 incl. 5 new abbreviation tests
DB_MIGRATION_STATUS: applied — 27 migrations, `npx prisma migrate status` = up to date; column text NULL; unique index Port_abbreviation_key present; 248 ports, 0 with abbreviation, 0 duplicates; `npx prisma validate` valid
BLOCKERS: none
DEVIATIONS: (1) service wipe-on-omit bug fix + field-specific 409 messages; (2) abbreviation always sent on save so clearing works; (3) migration also drops stray non-unique Port_abbreviation_idx; (4) root `pnpm test` unusable (pre-existing recursion) — chunked per-package runs used; (5) 3 pre-existing web tsc errors in unrelated [locale]/page.tsx left untouched
NEXT_CHECKPOINT: none — task complete; UI verified in running app at /en/ports (create/edit/detail/validation, 0 console errors)
