# 2026-10-05 — Phase 4 unit 7 (FINAL): B/L UI + document-output hooks — voyage create, revisions, release display, watermark, ADR-009 seam

## Task ID

phase4-unit7-bl-ui-doc-hooks

## Phase

Phase 4 — B/L Rewrite (unit 7 / P4-U7 per ADR-045 decision 6 — the final execution unit)

## Objective

Deliver U7's user-visible scope — B/L create/edit/detail UI (voyage+cargo, ending the web
side of transition contract A), revision-history UI (U5 deferral), release display + action
(U6 deferral), DRAFT watermark, the ADR-009 document-output hook — plus the deferred items
(`/issue` rename decision, the U3 number-column wrap, i18n), then close Phase 4 against
roadmap §3.

## Prompt reference (all read in full)

- **ADR-045 decisions 1, 4, 6**: voyage+cargo source with `manifestId` legacy kept on the API
  until U7 switches the page; revision history list-only; U7 = "B/L create/edit/detail,
  revision history, release display, Draft watermark, template hooks per ADR-009 — full
  PDF/Excel engine stays Phase 7".
- **ADR-046** (rulings 1–3): four states, `bill:release` + audit, APPROVED+fully-paid policy.
- **U2 log's transition-contract-A section**: legacy manifest path accepted "until P4-U7
  switches the shipped web page" — this unit is that switch (web side only).
- **ADR-009**: `DocumentTemplate` registry keyed by document type; domain services produce
  structured data, the template layer owns presentation; business logic never depends on a
  fixed PDF layout.

## Environment

Repo, HEAD **0c550a9** (U6 state-doc commit), porcelain **0**; servers `:3101`/`:3000`
**200 before/after, never restarted**; **billSeqRows BEFORE: 39**.

## Baseline (verification step 1 — ACCEPTED, first run)

```
Test Suites: 22 passed, 22 total
Tests:       384 passed, 384 total
```

(`scratch/p4u7-base.json` — matches the stated baseline.)

---

# Scope 1 — Create rework (contract A's web side ends)

**DECISION (recorded): the legacy manifest picker is REMOVED from the create UI.** The API
legacy path is untouched (drops remain post-Phase-5 with explicit approval); only the shipped
page stops offering it — exactly U2's "until P4-U7 switches the page". Rationale: two create
modes in one dialog doubles the surface for no remaining operational need (the voyage path is
fully proven since U2 and is now what the page mints), and ADR-045 decision 1 demoted
`manifestId` to transitional.

- **Create dialog**: voyage picker (`GET /voyages`, label `voyageNumber — vessel (origin →
  destination)`) → on select, `GET /bills/eligible-items?voyageId=…` → checkbox list of the
  voyage's loaded-but-unclaimed cargo (`cargo.reference`, packages/weight) with a selected
  count → `POST /bills {voyageId, cargoIds?, …header fields}` (parts/destination/vessel/
  per-destination number derive server-side, all verified in gate (a)).
- **Add-line on voyage-mode bills** (shipped U2 paths, first wired into the UI): picker
  branches on `detail.manifestId` → `?voyageId=` (voyage rows: `sequence: null` → option
  label falls back to cargo reference; payload key switches to `cargoId`; marks prefill from
  the row's `marksAndNumbers`); legacy bills keep `?manifestId=` + `manifestItemId`.
- **Shared type truth-ups**: `BillOfLading.manifestId: string | null` (voyage bills are null),
  `BillEligibleManifestItem.manifestId/sequence: … | null` + optional `marksAndNumbers`.
- **Voyage-mode rendering fallbacks**: list ROUTE cell and detail subtitle show the voyage
  number when `manifestId` is null (previously `? → ?`).
- **Legacy bills**: BOL-2609-* open/render/edit/issue unchanged (gate (e) + the untouched 16
  legacy manifest tests).

# Scope 2 — Revision-history UI (U5 deferral)

Detail section **Revision history**: current label (`current: {n}` from `detail.revision`),
list rows (`#n`, note, `createdAt · createdBy.email`), **Freeze revision** button with
optional note (DRAFT + `bill:update`; the API 409 message is surfaced verbatim in
`revError` — never swallowed), per-row **Restore** behind a confirm dialog (POST → refresh
detail + list; result visible; server captures pre-restore state first), a `listOnly` note
("History is read-only — revisions cannot be edited or deleted"). **No edit/delete controls
anywhere** (decision 4 exclusions). Data loads best-effort on every detail open
(`GET /revisions`, `bill:read`).

# Scope 3 — Release display + action (U6 deferral)

- **Release button**: `status === 'APPROVED' && hasPermission('bill:release')` + confirm
  dialog (final outbound step) → `POST /bills/:id/release` → refresh. 409s surface through
  `actionError`.
- **Released badge**: `RELEASED` list badge (U4 meta, verified rendering) + detail badge
  **"Released {date} by {email}"** fed by the new audit read; **there is no `releasedAt`
  column** (U6 recorded: the AuditLog row is the record) — status + audit row are the display,
  per the prompt's fallback clause.
- **New endpoint `GET /bills/:id/audit` (bill:read)** → `AuditService.forEntity('BillOfLading',
  id)` — exists so the record is visible **via API** (gate (d) read-back) and powers the badge.

# Scope 4 — DRAFT watermark (blueprint §5.1)

Cosmetic overlay inside the detail dialog: `status === 'DRAFT'` renders a diagonal, `aria-hidden`,
`pointer-events-none` **DRAFT** stamp over the upper form area (uses `t('status.DRAFT')`,
uppercased by CSS — translated in ar/fa automatically); gone at FINAL/APPROVED/RELEASED
(gate (b)). Zero state logic. **Two iterations recorded**: first draft was centered over the
full scroll height + 15% opacity → vision could not see it; final = top-anchored, 40%
opacity, verified visible by vision.

# Scope 5 — Document-output hook (ADR-009)

**New endpoint `GET /bills/:id/document` (bill:read)** — the smallest honest hook:
`BillService.getDocument()` returns the complete **structured document** (number, revision,
status, parties, route incl. voyage-port lookup, items with snapshots, totals) plus
`template: 'default'` (the ADR-009 registry key), a `watermark` hint for renderers, and a
`render` descriptor that today is a stub: `{engine: null, format: 'json', note: 'Phase 7 plugs
the PDF/A template into this render seam…'}`. **What Phase 7 drops in**: the `DocumentTemplate`
registry entry keyed by `default` + a PDF/A renderer behind `render` — no domain change, no
library in Phase 4, business logic untouched by layout. UI: a **Document data** dialog in the
detail (structured fields + items + the render note).

# Scope 6 — Deferred items

**(a) `/issue` rename — DECISION: no rename; ADR-045's "then renamed" clause formally
superseded by an APPEND-ONLY note** appended to ADR-045 in `docs/decisions.md` (prior text
untouched): `POST /bills/:id/issue` stays canonical permanently — workflows §3.1 step 7 is a
single moment (ADR-046 quotes the conflation), the shipped one-click Issue maps directly onto
U4's composite alias, and renaming would churn clients/tests for zero behavior. The page
therefore keeps its single Issue button (gate (b) used it).

**(b) U3 number-column wrap**: B/L NUMBER cell gained `whitespace-nowrap` — vision confirms
**all numbers single-line, no truncation** for new-format and legacy rows (the still-wrapped
MANIFEST/VESSEL/ROUTE cells are a pre-existing table-density trait, recorded as a carry-over,
out of this unit's named scope).

**(c) i18n**: 25 new keys added to `bill.*` in **en/ar/fa** (voyage create, revisions,
release, document, confirm.release, errors.voyageRequired), nested-key structure verified by
programmatic lookup in all three languages. Two dead keys from the removed picker
(`create.manifest`, `create.selectManifest`, …) were left in place (harmless; removal is
churn without a consumer — recorded).

# Defects found by the mandatory gate and fixed (all recorded, none hidden)

1. **`revisions.restoreConfirmDescription` rendered without `{n}`** → next-intl
   `FORMATTING_ERROR` console spam on every render → fixed by passing `n`.
2. **Freeze response shape crash**: `POST /revisions` returns a single revision; the page set
   array state with it → section crash → always re-`GET` the list after POST.
3. **Pre-existing API defect — "null to clear" on `originals` 400'd**: the inline
   `@Transform` did `Number(null) === 0`, defeating `@IsOptional` so `@Min(1)` rejected every
   clear (the page's shipped save path sends null for empty fields; no prior unit ever
   exercised a header save). Fixed to preserve `null` (documented "null to clear"), matching
   the already-correct `ToDecimal` helper; covered by two new assertions in the existing
   update test (originals/freightAmount clear → 200 + null). **API tsc 0, suite green.**
   (Other bare `Number(value)` transforms exist in the DTO file — 7 sites — but none is
   null-reachable from the shipped header flow; recorded as a follow-up candidate, not
   touched.)
4. **Watermark visibility** (two iterations, above).

---

# UI GATE (protocol §3.1) — **PASS**, driven with screenshots

Console-error + fetch collectors armed per segment; final states `errs: []`, `non2xx: []`.
Live counts **before**: bills 3 | manifests 4 | cargos 55 | voyages 21.

**(a) NEW voyage+cargo create end-to-end** — create dialog → voyage select
`VOY-2610-03440 — All Vessels Barge (KHALIFA → ABBR-3C0OU7)` → `GET …eligible-items?voyageId=
→ 200` → both cargo checkboxes selected ("2 line(s) selected") → **`POST /bills → 201`** →
detail title **`BOL-ABBR-3C0OU7-2610-00001`** (new format), subtitle `Draft — Voyage
VOY-2610-03440`, **DRAFT watermark visible** (screenshot `p4u7-gate1-watermark.png`,
vision-verified: "large, diagonal, translucent DRAFT watermark clearly visible"; an earlier
DOM probe on the create-produced bill also found the watermark node, `watermark: true`).

**(c) revisions (run before (b) — freeze is DRAFT-only by design, recorded)** — Freeze with
note "Before customer review round 1" → history shows `#1 … · admin@shipping.local · Restore`
+ `current: 2`; header edit (`carrierName: 'Edited Between Revisions'`, PATCH **200**); **Restore
confirm → `POST /revisions/1/restore → 200`** → carrier read back to empty, history now
`#1 original` + `#2 Pre-restore capture before restoring revision 1` (edited state preserved);
errs [], non2xx []. DOM probe output quoted verbatim above; screenshot
`p4u7-gate3-revision-restore.png` (dialog top — revision rows evidenced by the DOM probe text
+ API reads, the screenshot frame sits above the scrolled section).

**(b) add-line + Issue** — trash-remove line → `DELETE …/items/:id → 200` (2→1 rows) → Add
line dialog → `GET …eligible-items?voyageId= → 200` (freed cargo offered as
`CRG-2610-00117 (3 Packages)`) → **`POST …/items → 201`** (2 rows) → Issue confirm →
**`POST …/issue → 200`** → subtitle **Approved**, **watermark gone**, Approved + Issued-on
badges, **Release button now visible** (admin holds `bill:release`), errs [], non2xx []
(`p4u7-gate2-approved-no-watermark.png`).

**(d) release + audit read-back** — Release confirm → **`POST …/release → 200`** → Released
badge with record (`releasedBadge: true`), Release/Issue buttons gone, errs [], non2xx []
(`p4u7-gate4-released.png`; vision: subtitle **"Released — Voyage VOY-2610-03440"**, no error
banners; the dated badge sits below the screenshot's fold — DOM-probed). **API read-back via
the new endpoint**: `GET /bills/:id/audit` → exactly 1 row:
`action=bill:release | admin@shipping.local | 2026-10-05T02:03:30Z | {status:APPROVED} →
{status:RELEASED} | {billNumber:…}`. `GET /document` also live-checked (BILL/default,
watermark null on RELEASED, 2 items, route voyage number).

**(e) legacy bill + wrap fix** — number cells for **all four rows** computed
`white-space: nowrap` (new-format + legacy); vision of `p4u7-gate6-number-column.png`: "all
visible numbers render on a single line each… no truncation… no broken layout". Legacy
**BOL-2609-00003** opens (`Draft — MAN-2609-00001 (JEBALI → KHALIFA)`), **watermark visible**
(same screenshot's detail capture), edit round-trip: notes → 'legacy-gate-edit' **PATCH 200**
→ restore → **PATCH 200** (`patchCount:2, all2xx:true`, value gone), errs [], 11 fetches all
2xx; final API read `notes = None` (original restored) (`p4u7-gate6-legacy-detail.png`).

**(f) restricted account** — fixture role/user with only `bill:read`+`bill:update` (created
via API, logged in as **Gate NoRelease**) viewing the APPROVED bill: **no Release button**
(vision-verified: "No Release button visible… UI permission hiding"), no Issue (no
`bill:issue`), Document data still available (`bill:read`), no 403/error banners, non2xx []
(`p4u7-gate5-restricted-no-release.png`).

**Cleanup (explicit id/name filters only — U2 incident discipline):** gate bill (by id via
voyageId select) + its 2 items + its audit row + 2 cargo chains (inspection/yardInventory/AL/LL
by recorded ids) + voyage + `NumberingSequence` by **exact name** + restricted user by email +
role by code. Counts **after: bills 3 | manifests 4 | cargos 55 | voyages 21** (= before);
**billSeqRows 39 → 39 (flat)**; AuditLog back to pre-gate rows.

**Operational note (honest):** the admin JWT TTL is **900 s**, so two mid-gate segments bounced
to /login; each was re-armed with a fresh login and the affected segment re-run clean (final
evidence segments all show `errs: [], non2xx: []`). A transient post-HMR load also dropped one
token — same recovery.

---

# Verification (verbatim)

1. Baseline first run at 0c550a9 → **384/384/0 (22/22)** ✅
2. **Final official triplet → 385/385/0 ×3**, per-suite parsed: **22/22 green each run**
   (bill.e2e 29/29) ✅
3. `npx tsc -p apps/api` → **0**; `npx tsc -p apps/web` → **exactly the 3 pre-existing**
   `[locale]/page.tsx` errors; `pnpm --filter @shipping/shared build` → **0** ✅
4. `npx prisma migrate status` → **36 migrations … up to date, UNCHANGED** (UI unit, no
   migration — as required) ✅
5. `pnpm --filter @shipping/web test` → `CONTRACT GUARD OK — 18 shared status unions ⊆
   Prisma enums; 87 web api.post routes ⊆ 95 controller @Post routes` (84→87: web now calls
   freeze/restore/release, all existing @Posts; the 2 new hook routes are GET) ✅
6. Servers → **API 200, WEB 200** before/after, never restarted ✅
7. **billSeqRows 39 → 39 (flat)**; live counts restored exactly ✅
8. Porcelain = bill controller/service/dto + bill.e2e + i18n ×3 + bills page +
   `docs/decisions.md` (ADR-045 append-only note) + `packages/shared/src/bill.ts` + this log
   + state doc — nothing else ✅

**Test delta: 384 → 385 (+1 hook e2e covering both new GET endpoints: document payload shape/
stub-render/watermark/404 + audit trail shape/404/denied-release-writes-nothing). Existing 384
green throughout; the update test gained 2 clear-value assertions for defect 3 (same `it`).**

## TRANSLATION_CHANGES

25 i18n keys × 3 languages (en/ar/fa), keys-only; one append-only ADR note (prior ADR text
untouched).

---

# PHASE 4 CLOSURE ASSESSMENT (roadmap §3)

**Tests (5/5):**
1. *B/L creation without Manifest dependency* → **P4-U2** (`create WITHOUT a manifest…
   roadmap Tests 1-2`) + **U7** gate (a) shipped-voyage create.
2. *Party master usage* → **P4-U2** (derive-from-cargo + explicit masters beat derivation).
3. *Numbering* → **P4-U3** (format, two-destination independence, strict increase,
   concurrency, legacy coexistence).
4. *Lifecycle and revisions* → **P4-U4** (backfill, exact edge set, RELEASED terminal, gate
   vocabulary) + **P4-U5** (DRAFT-only freeze, 1→2→3, byte-for-byte immutability, restore).
5. *Release separation* → **P4-U6** (`bill:release`, in-txn audit, override audit, policy
   seam) + **U7** (release display/action gates (d)/(f)).

**Acceptance (4/4):**
1. *B/L no longer depends on Manifest* → U2 (+ U7 web cutover).
2. *Parties come from masters* → U2.
3. *Numbering is per destination* → U3.
4. *Lifecycle and release separation are correct* → parts 1+2: U4+U5 (lifecycle/revisions),
   U6+U7 (release + policy seam).

**UI changes (3/3):**
1. *B/L create/edit/detail UI* → **U7** (voyage create flow, header edit proven in gates
   (c)/(e), detail with all sections).
2. *Revision history* → **U7** gate (c).
3. *Release status display* → **U7** gates (d)/(f) + list/detail badges.

Plus U7's decision-6 extras: Draft watermark (gate (a)/(e)) and the ADR-009 document hook
(gate (d) API check + Document data dialog).

**PHASE 4 CLOSED: yes** — all 5 Tests items, all 4 Acceptance criteria and all 3 UI changes
satisfied by the units above, final triplet 385/385/0 ×3, guard green, migrate 36 unchanged.

**Carry-overs recorded (explicitly out, untouched):** portal destination-scoped B/L
visibility (portal unit), manifest.dto stale Swagger text (follow-up b), orphan comment column
(follow-up f), 39 historical seq orphans (follow-up g), proforma-convert allocation
observation (follow-up h), MANIFEST/VESSEL/ROUTE column wrap (pre-existing table density),
remaining `Number(value)` transform sites (defect-3 observation), dead `create.manifest*`
i18n keys (no consumer).

---

## Final status

```
EXECUTION_STATUS: COMPLETE
TASK: phase4-unit7-bl-ui-doc-hooks
PHASE: Phase 4 — B/L Rewrite (unit 7 / P4-U7, FINAL UNIT)
DB_MIGRATION_STATUS: 36 up to date, UNCHANGED (UI unit)
UI_GATE: PASS with driven evidence — (a) voyage+cargo create 201 + BOL-{DEST}-YYMM-##### +
  DRAFT watermark (vision-verified); (b) remove/add line 200/201 via voyage eligible-items,
  Issue 200 → Approved, watermark gone, badges correct; (c) freeze 201 (history shows note
  + actor), edit PATCH 200, restore 200 → values read back + pre-restore capture in history;
  (d) release 200 → Released badge with record + GET /bills/:id/audit read-back shows the
  bill:release row (actor/before/after/metadata); (e) legacy BOL-2609-00003 opens/renders/
  edits (PATCH ×2 200, value round-tripped) + B/L number column single-line/no truncation for
  both formats (vision-verified); (f) bill:read+update-only account sees NO Release button
  (vision-verified, no 403 noise). Zero console errors, zero non-2xx in every final segment;
  counts restored (3/4/55/21); fixtures hard-deleted by explicit id/name filters;
  billSeqRows 39 → 39 flat
SCHEMA_CHANGES: none
CODE_CHANGES: web — bills page create rework (voyage picker + cargo checkboxes, legacy picker
  removed), add-line mode branch, revisions section (freeze/restore/list-only), release
  button+confirm+record badge, DRAFT watermark, Document data dialog, voyage route fallbacks,
  nowrap number cell; api — new GET /bills/:id/audit + GET /bills/:id/document (bill:read,
  ADR-009 stub seam), UpdateBillDto originals null-clear transform fix (pre-existing defect,
  covered by 2 assertions); shared — manifestId/eligible-row truth-ups + revision field;
  docs/decisions.md — append-only ADR-045 note; i18n ×3 (25 keys)
ISSUE_RENAME: no rename — POST /bills/:id/issue stays canonical; ADR-045's "then renamed"
  clause superseded via an APPEND-ONLY ADR note (prior text untouched; rationale: §3.1 step 7
  is one moment, the one-click alias is the shipped UX, renaming = pure churn)
DOC_HOOK: GET /bills/:id/document returns structured document data + template key 'default'
  + a stub render descriptor; PHASE 7 DROPS IN the DocumentTemplate registry entry (PDF/A
  renderer) behind that render seam — no domain change, no engine now (ADR-009)
TEST_CHANGES: 384 → 385 (+1 hook e2e; update test +2 clear-value assertions for the
  originals-null fix). Final triplet 385/385/0 ×3, per-suite 22/22 green, bill 29/29
GATE_DEFECTS_FOUND_AND_FIXED: 4 — intl {n} formatting spam, freeze response-shape crash,
  pre-existing originals "null to clear" 400 (API transform), watermark visibility (2 passes)
TRANSLATION_CHANGES: 25 keys × en/ar/fa (keys-only); ADR note appended (append-only)
PHASE 4 CLOSED: yes — Tests 5/5, Acceptance 4/4, UI changes 3/3 (item-by-item mapping above)
GIT_VERIFICATION: porcelain = the 10 files listed in Verification #8 (+ log + state doc);
  contract guard OK (87 ⊆ 95); servers never restarted; commit at task end
UNRESOLVED_ISSUES: carry-overs listed above (portal, follow-ups b/f/g/h, table density,
  Number(value) observation, dead i18n keys)
NEEDS_BUSINESS_DECISION: none — ADR-046 closed §1.1a/§1.1b/§1.2; ADR-044 (d) remains the
  only open NBD in the whole plan (unrelated to Phase 4, non-blocking)
BLOCKED: none
HANDOFF_TO: decision-maker (unit-7 verification → PHASE 4 CLOSURE; next per roadmap: Phase 5
  Manifest rebuild)
```
