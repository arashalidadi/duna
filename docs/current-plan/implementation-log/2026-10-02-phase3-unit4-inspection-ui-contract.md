# 2026-10-02 — Phase 3 unit 4: Inspections/Cargo UI contract repair (defect fix, user-visible)

## Task ID

phase3-unit4-inspection-ui-contract

## Phase

Phase 3 — Operational Flow Reconciliation (unit 4)

## Objective

Repair the shipped Inspections/Cargo web contract against the correct, fully-tested API: drive
the real inspection lifecycle from the UI (dead `/approve`//`reject` routes), align the shared
status vocabulary with the Prisma enums (the two crash/400 defects), verify filter parity live,
and add the root-cause guard that would have caught both defects.

## Prompt reference

- `docs/current-plan/11-implementation-state.md` § "Open defect (found 2026-10-02…)" read first —
  full terminal evidence, exact line numbers, verified scope boundary (other status maps safe:
  `bills`/`manifest`/`invoices` switches have `default:`, `discharges` trailing `return`,
  `voyages`/`bookings`/`portal` already `??`-fallback — none touched).
- Protocol `10-phase-execution-protocol.md` §2, §3, §3.1, §4, §5.

## Environment

- Repo `/home/duna/shipping-dashboard/new-erp`, HEAD **d43c39b**, porcelain **0 lines** at start.
- User's servers, never restarted: API `:3101` **200 before/after**, WEB `:3000` **200 before/after**.
- Tests: `pnpm --filter api test` from repo root (never `npx pnpm …`).

## Baseline before touching anything (verification step 1 — ACCEPTED)

```
Test Suites: 22 passed, 22 total
Tests:       365 passed, 365 total
```

Stated baseline matched exactly (365/365/0, 22/22, tree clean), plus stated tsc api 0 /
web 3 pre-existing / shared 0 / migrate 32 — re-confirmed below after the change.

## Part 1 — inspection actions (the dead endpoints)

**Contracts (read from source, cited in code comments):** `inspection.controller.ts`
`/book` `:53` (`inspection:update`), `/done` `:64` (`inspection:approve`), `/fail` `:75`
(`inspection:reject`, body `{rejectionReason}` required), `/needs-re-inspection` `:90`
(`inspection:update`); `inspection.service.ts` `TRANSITIONS`:
`PENDING → BOOKED|FAILED`, `BOOKED → DONE|FAILED`, `FAILED → NEEDS_REINSPECTION`,
`NEEDS_REINSPECTION → BOOKED|FAILED`, `DONE []` (terminal).

**Edits, all in `inspections/page.tsx`:**
- `submitApprove` `POST /inspections/:id/approve` → **`/done`**; `submitReject`
  `POST …/reject` → **`/fail`** (body unchanged — DTO field name already matched).
- **Two new actions:** `submitBook` → `/book`, `submitReInspect` → `/needs-re-inspection`,
  each with its own ConfirmDialog (permissions unchanged: book/re-inspect = `inspection:update`,
  approve = `inspection:approve`, reject = `inspection:reject`).
- **Re-gating** (row buttons and detail footer both) via shipped-transition helpers:
  `bookable` = PENDING|NEEDS_REINSPECTION, `donable` = **BOOKED only** (POST /done on PENDING is
  the documented live 409), `failable` = PENDING|BOOKED, `reinspectable` = FAILED; DONE shows
  **no action buttons** (verified in the gate). Previously buttons rendered only on `PENDING`,
  so a BOOKED row could never be completed — now it can.
- **Errors surface, no silent no-op:** every submit clears `setFormError(null)` first and keeps
  the `ApiError` message in `formError`; the two pre-existing confirm dialogs had **no error
  slot**, so `ConfirmDialog` gained an optional `error?: string | null` prop rendering a
  `role="alert"` line (additive — existing call sites unaffected) and it is passed to all three
  confirm dialogs; the reject dialog already had one; open/close handlers clear stale errors.
- Icons added: `CalendarCheck`, `RotateCcw`.

## Part 2 — status vocabulary (source of truth first, then compiler-driven consumers)

**`packages/shared/src/cargo.ts`:**
- `CargoStatus` `:11-17` — `'READY'` → **`'READY_FOR_LOADING'`** (mirrors `schema.prisma:733`).
- `InspectionStatus` `:27` — 3-value pre-Phase-3A union → **`PENDING|BOOKED|DONE|FAILED|NEEDS_REINSPECTION`**
  (mirrors `schema.prisma:754`); lifecycle comment added.
- **API-impact claim verified by grep and recorded:** `apps/api/src` imports exactly **5** things
  from `@shipping/shared` (`CurrentUser`, delivery-release types, `Voucher` types,
  `ActualLoadingStatus`, `APP_NAME`/`APP_VERSION`) — **neither changed type is among them**; the
  only `CargoStatus`/`InspectionStatus` hits in API source are `@prisma/client` imports and
  comments. The type change cannot break the API.

**Consumers — exactly what `tsc -p apps/web` flagged (11 errors → all fixed):**
- `inspections/page.tsx` `:41` STATUSES → 5 values; `:43-50` STATUS_META → 5 keys with
  deliberate variants: PENDING `neutral`, BOOKED `info`, DONE `success`, **FAILED `danger`**,
  NEEDS_REINSPECTION `warning` (variant type widened accordingly; design-system §2.2 — label
  always present, colour never the only signal).
- `cargo/page.tsx` `:45` STATUSES, `:113` STATUS_META key `READY`→`READY_FOR_LOADING`
  (label "Ready for loading", variant `success`), `:119-123` INSPECTION_META → 5 keys.
- `yard-inventory/page.tsx` `:41` CARGO_STATUSES (options render via raw `.replace`, no meta map).

**`??` fallback on every STATUS_META/INSPECTION_META index in the three files** (bookings/portal
pattern): single helpers `statusMeta()` / `inspectionLabel()` (inspections + cargo) applied at
**every former raw index** — inspections `:309, :404-405, :530-531, :653-654, :794`
(5 sites, 8 index operations); cargo `:349, :442, :795-796, :805` (4 sites, 6 operations).
An unknown/future enum value now renders a readable label instead of `undefined.variant`
TypeError (the live white-screen class). yard-inventory has no meta indexes (raw `.replace`).

**No i18n:** none of the three pages uses `useTranslations` — hardcoded labels kept, no keys
added (per instruction).

## Part 3 — filter parity + detail literals

- After the type fix every **offered** option matches a Prisma enum value, so the DTO can accept
  it. Verified live in the UI gate (Part "UI gate" below): `inspections status=` all five →
  **200 + rows**; `cargo status=READY_FOR_LOADING` → **200 + rows**;
  `yard-inventory cargoStatus=READY_FOR_LOADING` → **200 + rows**. (Before the fix the state doc
  recorded `APPROVED`/`REJECTED` → 400 and `READY` → 400 on both cargo endpoints.)
- Detail literals re-pointed: `:703-707` readiness `'APPROVED'`→`'DONE'` ("Eligible for load
  planning") and `'REJECTED'`→`'FAILED'` ("Ineligible — failed inspection" — observed rendering
  in the gate screenshot); **`:758` `detail.status === 'REJECTED'` → `'FAILED'`** so the
  rejection-reason block is reachable — driven + screenshot with the reason visible.
- Untouched as instructed: bills/manifest/invoices/discharges/voyages/actual-loading/load-lists
  status maps (grep-confirmed no changes — see GIT_VERIFICATION).

## Part 4 — root-cause guard (the lightest check that catches both defects)

**New `apps/web/scripts/check-contract.mjs`** (zero-dependency Node), wired as
`apps/web` `"test": "node scripts/check-contract.mjs"` (replaces the `echo 'No web unit tests
yet'` placeholder) — so the repo's test command (`root: pnpm run test -r`) now runs it per
workspace; proven green via `pnpm --filter @shipping/web test` (exit 0).

**Check 1 — shared status unions ⊆ Prisma enums.** Parses every `export type XStatus = …` and
`XStatusValues` array in `packages/shared/src` and every `enum` in `prisma/schema.prisma`
(like-named lookup) and asserts subset. *This is the direction of both demonstrated defects:
shared shipped `'READY'` and `'APPROVED'/'REJECTED'` — values absent from the DB enums (400
filters + dead vocabulary).* Web maps are `Record<SharedType>`, so `tsc` then forces exhaustive
key coverage (observed live: the fix produced TS2353/TS2322 on every stale map).

**Check 2 — every literal `api.post('…')` route in `apps/web/src` exists as a controller
`@Post`.** Normalises `${…}`/`:param` to `:p`, strips query/duplicates, compares against
`@Controller(prefix)+@Post(path)` over `apps/api/src/**/*.controller.ts`. 84 literal posts
matched ⊆ 90 controller routes on the green run.

**Wiring:** `apps/web/package.json` test script only — no root change (root `test` already runs
`pnpm run test -r`).

**Proven to fail on BOTH reintroduced defects (then reverted, guard green again):**
```
PROOF A — shared InspectionStatus reverted to 'PENDING'|'APPROVED'|'REJECTED':
  CONTRACT GUARD FAILED (2):
  x STATUS PARITY: shared InspectionStatus contains 'APPROVED' which is NOT in prisma enum
    InspectionStatus (PENDING | BOOKED | DONE | FAILED | NEEDS_REINSPECTION) — source: packages/shared/src/cargo.ts
  x STATUS PARITY: shared InspectionStatus contains 'REJECTED' …   [exit 1]
PROOF B — page reverted to POST …/approve:
  CONTRACT GUARD FAILED (1):
  x POST ROUTE MISSING: apps/web posts to '/inspections/${confirmingApprove.id}/approve'
    (normalised 'inspections/:p/approve') but no @Controller + @Post combination in apps/api/src
    declares it — file: apps/web/src/app/[locale]/(dashboard)/inspections/page.tsx   [exit 1]
After reverts: CONTRACT GUARD OK …   [exit 0]
```

**What it does NOT catch (recorded):**
- the opposite direction — an API-only enum value missing from a shared union (runtime;
  mitigated by the mandated `??` fallbacks, not by this script);
- GET/PATCH/DELETE routes, request bodies, query DTOs, permissions, response shapes;
- computed paths (non-literal first argument → 0 found; paths whose *final* segment is a bare
  `${action}` variable → 1 found, prefix-verified then skipped — so a *renamed action inside a
  variable* would slip through; the literal `/approve` class is enforced strictly);
- two status declarations have no like-named Prisma enum (`BillStatus`, `DeliveryReleaseStatus`)
  and are skipped with a printed notice (their DB counterparts use different names);
- non-status types, i18n, rendering/runtime behaviour.

## Files changed (complete)

- `packages/shared/src/cargo.ts` — the two type fixes (source of truth).
- `apps/web/src/app/[locale]/(dashboard)/inspections/page.tsx` — lifecycle routes, gating,
  5-value vocabulary, ?? fallbacks, new dialogs, literal re-points, error surfacing.
- `apps/web/src/app/[locale]/(dashboard)/cargo/page.tsx` — STATUSES/STATUS_META/INSPECTION_META
  + ?? fallbacks.
- `apps/web/src/app/[locale]/(dashboard)/yard-inventory/page.tsx` — CARGO_STATUSES.
- `apps/web/src/components/ui/dialog.tsx` — optional `error` prop on ConfirmDialog (additive).
- `apps/web/scripts/check-contract.mjs` (new) + `apps/web/package.json` (test wiring).

**No `apps/api/src` change, no `prisma/` change, no status map outside the listed files, no
i18n keys.**

## Database changes / migrations

none — no schema or migration work (§4). `npx prisma migrate status` → **32 migrations found …
Database schema is up to date!**; `migrate diff --from-migrations --to-schema-datamodel` vs a
scratch shadow DB (script inside `scratch/`, database created + dropped inside the run):

```
diff exit: 0
diff output: No difference detected.
drop: ok
```

## Tests

- **No suite count moved.** Baseline 365/365/0 → after the change **365/365/0 (22/22)**, and a
  programmatic per-suite comparison baseline-vs-after is **identical** (no suite count changed —
  web/shared-only changes cannot affect the API suite; the API-import grep explains why).
- New guard: `pnpm --filter @shipping/web test` → green (exit 0), plus the two failure proofs
  above.

## UI gate (protocol §3.1 — MANDATORY, driven on live data) — **PASS**

Auth via `localStorage.shipping_access_token` (token from a terminal-side API login, memory/tmp
only; no password ever entered into a form). Console-error + fetch collectors installed per
page. Fixtures (all created by me, none transitioned seed rows): **F0** CRG-2610-00114 (yard
placed, inspection API-driven to DONE, status → READY_FOR_LOADING, serves gate (e) on both
pages), **F1** CRG-2610-00115/INS-2610-00098 (full chain), **F2** …00116/…00099 (book stop),
**F3** …00117/…00100 (fail+reason), **F4** …00118/…00101 (fail → re-open).

- **(a) List renders the actual rows, no console error/TypeError.** `/en/inspections` → 25 rows,
  h1 "Inspections", page-1 badges **21 Done + 4 Pending** (live DONE rows render — pre-fix this
  was `undefined.variant` TypeError on 22 of 25 rows), body shows no TypeError, collector
  `errs: []`. Screenshot `p3u4-gate1-inspections-list.png` (vision-verified: rows incl.
  **Failed** + **Needs re-inspection** badges, no error banner).
- **(b) PENDING → (book) → BOOKED → (done) → DONE end-to-end from the page; readiness flips.**
  F1: Book button → confirm → fetch `POST /inspections/…/book → 200` → badge **Booked**; then
  Approve → confirm → `POST …/done → 200` → badge **Done**. Detail dialog: readiness
  **"Eligible for load planning"**, Done badge, **footer = [Close] only** (DONE terminal —
  Book/Approve/Reject/Re-inspection all correctly absent). API read-back:
  `CRG-2610-00115 inspectionStatus=DONE` ✓. F2 taken to **Booked** and stopped (its BOOKED row
  feeds (d)). Errors: none.
- **(c) Fail path with a reason renders the reason.** F3: Reject → typed reason → confirm →
  `POST …/fail → 200` → badge **Failed** → detail: **REJECTION REASON** block with the exact
  text, readiness "Ineligible — failed inspection", footer **[Re-inspection, Close]** only
  (FAILED gating correct). Screenshot `p3u4-gate2b-fail-reason-scrolled.png` vision-verified.
  F4: Reject → `fail 200` → **Re-inspection** → confirm → `POST …/needs-re-inspection → 200` →
  badge **Needs re-inspection**.
- **(d) All five status filters → 200 + rows** (search box cleared between runs):

  | filter | fetch | rows | badges |
  | --- | --- | --- | --- |
  | PENDING | 200 `status=PENDING` | 25 (of 30) | Pending |
  | BOOKED | 200 | 1 (F2) | Booked |
  | DONE | 200 | 24 (of 24) | Done |
  | FAILED | 200 | 2 (1 live + F3) | Failed |
  | NEEDS_REINSPECTION | 200 | 1 (F4) | Needs re-inspection |

  (First pass recorded rows 0 for four filters because the search box still held F4's ref —
  cleared and re-run; noted so the transcript isn't misread. All fetches were 200 both passes;
  `errs: []` throughout.)
- **(e) Cargo + yard-inventory show the READY_FOR_LOADING row, filters 200.** `/en/cargo`
  status filter (options now `…READY_FOR_LOADING…`) → `GET /cargo?status=READY_FOR_LOADING →
  200`, rows include **CRG-2610-00114 with badge "Ready for loading"** (plus the pre-existing
  CRG-2401-APPROVED) — screenshot `p3u4-gate3-cargo-ready-filter.png` vision-verified;
  `/en/yard-inventory` `cargoStatus=READY_FOR_LOADING → 200`, row CRG-2610-00114 (KHALIFA, In
  yard) visible. `errs: []`.

**Screenshots (workspace):** `p3u4-gate1-inspections-list.png`,
`p3u4-gate2-fail-reason-detail.png`, `p3u4-gate2b-fail-reason-scrolled.png`,
`p3u4-gate3-cargo-ready-filter.png`.

**Counts before / during / after (all restored; zero seed row transitioned):**

| metric | before | during gate | after cleanup |
| --- | --- | --- | --- |
| inspections total | 53 | 58 (+5 fixtures) | **53** |
| PENDING / BOOKED / DONE / FAILED / NEEDS | 30/0/22/1/0 | 30/1/24/2/1 | **30/0/22/1/0** |
| cargo READY_FOR_LOADING | 1 | 2 (+F0) | **1** |
| yard-inventory cargoStatus=READY_FOR_LOADING | 0 | 1 (+F0) | **0** |

Cleanup: Prisma hard-delete of the 5 fixture inspections, 1 inventory row, 5 fixture cargos
(reverse-dependency order, script deleted after). No seed inspection/cargo was mutated — all
gate transitions ran on my own fixture rows.

## Validation steps (verbatim, 1–7)

1. Baseline first run at d43c39b → **365/365/0 (22/22)** ✅
2. Full suite after the change → **365/365/0 (22/22)**; per-suite comparison baseline-vs-after
   **identical — no suite count moved** ✅
3. `npx tsc -p apps/web` → **exactly the 3 pre-existing** `[locale]/page.tsx` errors (0 new);
   `npx tsc -p apps/api` → **0**; `pnpm --filter @shipping/shared build` → **0**;
   guard green (`pnpm --filter @shipping/web test` exit 0) **and proven to fail** on both
   deliberately reintroduced defects (outputs above), reverts confirmed ✅
4. `prisma migrate status` → **32, up to date**; `migrate diff` vs scratch DB →
   **"No difference detected."** (scratch DB created + dropped inside the run) ✅
5. Servers before/after → **API 200, WEB 200**, never restarted, `.next` untouched ✅
6. `git status --porcelain` → **7 intended entries** (6 modified + `apps/web/scripts/`);
   **`prisma/` = 0** ✅
7. **UI gate → PASS** with driven evidence (a)–(e) above ✅

## TRANSLATION_CHANGES

none (the three pages use no i18n — hardcoded labels are the correct pattern there; no keys added)

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase3-unit4-inspection-ui-contract
PHASE: Phase 3 — Operational Flow Reconciliation (unit 4)
DB_MIGRATION_STATUS: none — no schema/migration changes (migrate status 32 up to date;
  migrate diff vs scratch shadow DB: "No difference detected.")
UI_GATE: PASS — driven on live data: (a) list renders real DONE/FAILED rows, 0 console errors;
  (b) PENDING -> book -> BOOKED -> done -> DONE end-to-end from the page (book 200, done 200,
  readiness "Eligible for load planning", cargo inspectionStatus=DONE, DONE terminal);
  (c) fail with reason -> FAILED -> REJECTION REASON renders on detail (vision-verified) +
  fail -> needs-re-inspection -> NEEDS_REINSPECTION (200); (d) all 5 status filters 200 + rows;
  (e) cargo + yard-inventory READY_FOR_LOADING rows visible, both filters 200. Screenshots
  4x in workspace; counts before/during/after restored to 53 (30/0/22/1/0); no seed row
  transitioned; fixtures cleaned.
SCHEMA_CHANGES: none
CODE_CHANGES: apps/web only + packages/shared —
  packages/shared/src/cargo.ts (CargoStatus READY->READY_FOR_LOADING; InspectionStatus -> 5
  shipped values, mirrors schema 733/754; API-impact grep recorded: 5 shared imports in
  apps/api, neither type among them);
  inspections/page.tsx (routes /approve|/reject -> /done|/fail + new /book + /needs-re-inspection
  actions, transition-based gating incl. done=BOOKED-only, ?? fallbacks at all 5 meta sites,
  readiness literals :703/:705 -> DONE/FAILED, rejection block :758 -> FAILED, error surfacing);
  cargo/page.tsx (STATUSES/STATUS_META/INSPECTION_META + ?? fallbacks);
  yard-inventory/page.tsx (CARGO_STATUSES);
  components/ui/dialog.tsx (optional ConfirmDialog error prop, additive);
  apps/web/scripts/check-contract.mjs + apps/web/package.json test wiring (root-cause guard)
TEST_CHANGES: API baseline 365/365/0 (22/22) -> after: 365/365/0 (22/22), per-suite identical
  (no count moved); new: contract guard (apps/web test) green, proven red on both reintroduced
  defects
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain vs d43c39b = 6 modified files (shared/cargo.ts, inspections,
  cargo, yard-inventory pages, ui/dialog.tsx, web/package.json) + apps/web/scripts/check-contract.mjs
  + this log; prisma/ = 0; apps/api/src = 0; no status map outside the listed files touched
  (bills/manifest/invoices/discharges/voyages/actual-loading/load-lists unchanged)
UNRESOLVED_ISSUES: none new. Pre-existing out of scope remain: 3 web tsc errors in
  [locale]/page.tsx; AL 'Not started' stale label (cosmetic, flagged for the Phase 3 UI unit);
  shared/inspection.ts header comment still describes the old APPROVED/REJECTED lifecycle
  (comment only, not a type — types live in cargo.ts and are fixed)
NEEDS_BUSINESS_DECISION: none — contract alignment only, no business question found
BLOCKED: none
HANDOFF_TO: decision-maker (unit 4 verification -> Phase 3 unit 5: Comment editing/visibility
  design, already scoped in 11-implementation-state.md)
```
