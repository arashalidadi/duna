# Phase 2 — B/L/Manifest party reference cutover — implementation log

**Task ID:** phase-2-party-cutover (task-unit 1)
**Roadmap:** Phase 2 / B/L–Manifest party cutover
**Authoritative plan:** `docs/current-plan/party-cutover-plan.md` (APPROVED) — its numbered sections govern.
**Evidence base:** `docs/current-plan/party-cutover-evidence-pack.md`.
**Objective:** Repoint Manifest + BillOfLading party FKs Customer → masters (Shipper/Consignee/Agent),
close the Cargo party-FK migration gap, switch Manifest UI selects to master endpoints, update the
6 Customer-pinning tests, verify end to end incl. the mandatory UI gate.

## Pre-flight (recorded before any change)

- `npx prisma migrate status` **BEFORE: 29 migrations found, Database schema is up to date.**
- git baseline: 54 porcelain lines at HEAD `2b89e38` (saved `/tmp/git_before_cutover.txt`).
- **STOP-rule re-check of live party references (before nulling):**
  `manifests {total:4, shipper:4, consignee:3, agent:1}`,
  `bills_of_lading {total:2, shipper:2, consignee:2}`,
  `Cargo {total:33, shipper:0, consignee:0}`,
  `masters {shippers:0, consignees:0, agents:1}`,
  `soft-deleted children {manifests:0, bills:0}` — query output verbatim.
  These are **identical to evidence pack §4.2/§4.4** → no discrepancy → STOP rule not triggered,
  proceeding with the nulling (6 rows / 12 FK values).

## Work log

### Pre-implementation code-reality check (plan vs code) — BLOCKING CONFLICT FOUND

Scope item 2 (plan §3) states: *"Portal agent scoping (JWT → agents table) unchanged."*
Read against the actual code, that premise is factually wrong:

| Fact | Citation |
|---|---|
| Portal scope key is `user.portalCustomerId`, an FK to **Customer** | `prisma/schema.prisma:92-93` (`portalCustomerId String? @unique`, `portalCustomer Customer? @relation("UserPortalCustomer", ...)`) |
| Portal dashboard counts manifests by comparing `manifests.agentId` to that **Customer** id | `apps/api/src/modules/portal/portal.service.ts:142` — `manifest.count({ where: { agentId: customerId, ... } })` |
| Portal shipments list does the same | `apps/api/src/modules/portal/portal.service.ts:288,292` — `customerId = await this.portalCustomerIdOf(actor)` then `agentId: customerId` |
| `portalCustomerIdOf` returns the Customer id only (no Agent-master lookup anywhere in the portal module) | `portal.service.ts:109-118`; grep `agent` in `portal.service.ts` → only comments at :158, :285 |
| There is **no Customer↔Agent linkage** (no shared id/code/taxId) | evidence pack §4.3/§4.4: 0 name matches, 0 taxIds, code-suffix only the unrelated `T3A-001`↔`AGT-001` |
| Portal bookings model agents as Customers too (`booking_requests.customerId → Customer`, relation `BookingAgent`) | evidence pack §1.5 (live FK query) + `prisma/schema.prisma:292` |
| Portal e2e suite is green at baseline | this task: `pnpm --filter api test -- test/portal.e2e-spec.ts` → **Tests: 13 passed, 13 total** |

**Why this blocks the cutover as specified:**

1. The moment `manifests.agentId` is repointed to `agents`, the portal fixtures
   (`apps/api/test/portal.e2e-spec.ts:97,109` — `agentId: custA.id / custB.id`) violate the new FK
   → `beforeAll` throws → the whole portal suite fails (**13 tests green → 13 failing**, not just
   the 2 scoping assertions at `:168` `summary.approvedManifests === 1` and `:240-250`
   "agent A sees only its manifest").
2. Updating only the fixture ids to real `Agent` ids (as prompt scope item 4 asks) makes FK
   creation succeed but the portal service still filters by a **Customer** id → count `0`,
   shipments `[]` → those 2 assertions fail anyway. → violates "No new failures anywhere".
3. Making them pass without code changes would require an `Agent` row whose `id` equals a
   `Customer.id` (id-equality fixture) — a test-only fiction that masks a production regression
   (portal would still show 0 manifests for every real portal user). Not acceptable here.
4. Changing portal code to scope against `agents` is prohibited: plan §7 / prompt §7 put
   **"portal scope" OUT OF SCOPE**, and it would additionally require a business-level
   Customer↔Agent linkage decision (schema/`User.portalCustomerId` is Customer-typed;
   demo data are unrelated: Customer `Meridian Freight Co. (Portal Demo)` vs Agent `Arash alidadi`).
5. Partial alternatives also violate the approved plan: deferring only `agentId` breaks plan §1
   target state (`Manifest.agentId → Agent`) and plan §4 (agent select switches to `/agents`).

Every rule-compliant path therefore requires a decision first. **STOP executed before any
schema/migration/API/UI/test change** (the count-based STOP rule was checked and did NOT trigger —
counts matched the evidence pack exactly, see Pre-flight; this STOP is the binding-decision-vs-
code-reality conflict: plan §3's premise is contradicted by the code it governs).

### Other consequences recorded during this check (needed for the eventual cutover unit)

Not blockers, but discovered facts the future unit must handle (all mechanical, all in-plan):

- `manifest.service.ts:85-87` and `bill.service.ts:85-86` select `shortName` on the three party
  relations; `Shipper/Consignee/Agent` have **no** `shortName` field
  (`schema.prisma:306-370`) → after repoint these selects would throw at runtime. Shared types
  carrying `shortName` on those relations: `packages/shared/src/manifest.ts:71-73`,
  `packages/shared/src/bill.ts:72-73` and `:208-209`. No web usage of party `shortName`
  (grep → empty), no other API consumers (grep → empty). `manifest.service.ts:110` `customer`
  select (Cargo) stays on Customer and keeps `shortName` — unaffected.
- The **master tables themselves exist in no migration file**: `grep 'CREATE TABLE.*shippers'/
  consignees/agents` over `prisma/migrations/` → empty (as does any mention of
  `agent_destinations`). Evidence pack §1.4 recorded only the missing Cargo party FKs; this is a
  wider pre-existing replay gap. Fresh replay would fail at the new party FKs unless the same
  (single) cutover migration also declares `shippers`/`consignees`/`agents` with guarded
  `CREATE TABLE IF NOT EXISTS` (their exact live shape was captured during this check:
  12 columns each, `isActive boolean NOT NULL DEFAULT true`, `createdAt DEFAULT CURRENT_TIMESTAMP`,
  Prisma-named indexes `Shipper_pkey`, `Shipper_code_key`, `Shipper_code_idx`,
  `Shipper_name_idx`, `Shipper_isActive_idx` and the Consignee/Agent equivalents).
- Live Cargo party constraints confirmed already correct and named Prisma-style
  (`Cargo_shipperId_fkey`, `Cargo_consigneeId_fkey`, both `SET NULL`, plus
  `Cargo_shipperId_idx`/`Cargo_consigneeId_idx` exist) → the guarded Cargo column+FK declarations
  are replay-completeness no-ops on this DB, exactly as plan §2.4 frames it.
- 5 old FKs to drop/re-add (Prisma names, so names are reused): `manifests_shipperId_fkey`,
  `manifests_consigneeId_fkey`, `manifests_agentId_fkey`,
  `bills_of_lading_shipperId_fkey`, `bills_of_lading_consigneeId_fkey`.
- Execution-order note for the migration: the new FKs must be added **after** the nulling
  (Postgres validates `ADD CONSTRAINT` immediately; current values are Customer ids that do not
  exist in the master tables — pre-flight proved 0/12 match). So the file must run
  drop → null → add, regardless of the plan's listing order in §2.1-§2.3.

## Resume pre-flight (task-unit 1 execution, after the linkage unit)

- **Prerequisite verified:** `phase-2-portal-agent-linkage.md` status block = `EXECUTION_STATUS: COMPLETE`
  (portalAgentId @unique → Agent exists; `portalManifestScopeIds()` wired into both scoping queries;
  demo user linked to AGT-001; portal 13/13; full suite 0 new failures).
- **Plan + prior log re-read before touching anything:** `party-cutover-plan.md` §2–§6 (+ §8 item 1,
  §9 mechanical notes) and this log's `## Pre-flight` + `## Work log / Other consequences recorded
  during this check` — used as starting facts (shortName fallout list, master-table replay gap,
  5 FK names, drop→null→add order, captured master shapes).
- **`migrate status` BEFORE (this unit): 30 migrations found, up to date** (was 29 at the original
  pre-flight; +1 = `20260929212803_portal_agent_linkage` from the linkage unit).
- git baseline for this unit: **57 porcelain lines** at HEAD `2b89e38`
  (saved `/tmp/git_before_cutover2.txt`; was 54 before the linkage unit, +2 code files +1 migration dir).
- **STOP-rule count re-check (re-run, verbatim same query as the original pre-flight):**
  `manifests {total:4, shipper:4, consignee:3, agent:1}`,
  `bills_of_lading {total:2, shipper:2, consignee:2}`,
  `Cargo {total:33, shipper:0, consignee:0}`,
  `masters {shippers:0, consignees:0, agents:1}`,
  `soft-deleted children {manifests:0, bills:0}` — **IDENTICAL to the recorded pre-flight and to
  evidence pack §4.2/§4.4 → no discrepancy → STOP rule NOT triggered; proceeding with the nulling.**
- Additional facts captured for the migration (verbatim `pg_get_constraintdef`):
  - the 5 old FKs are `ON UPDATE CASCADE ON DELETE SET NULL` to `"Customer"`;
    live Cargo FKs are `ON DELETE SET NULL` (no UPDATE clause) to `shippers`/`consignees`;
    `User_portalAgentId_fkey` → `agents` already live (linkage unit).
  - master table shapes re-captured: **12 columns each** (`id/code/name/taxId/address/phone/email/
    isActive(true default)/notes/createdAt(DEFAULT CURRENT_TIMESTAMP)/updatedAt/deletedAt`),
    indexes `Shipper_pkey/code_key/code_idx/name_idx/isActive_idx` + Consignee/Agent equivalents.
  - Cargo party columns/indexes exist (`Cargo_shipperId_idx`, `Cargo_consigneeId_idx`) → guarded no-ops.
  - `agent_destinations` exists live but in **no** migration (pre-existing gap, NOT declared by plan
    §2.4/§9 → out of scope for this unit; recorded as a remaining replay-gap note).
- **notifyParty pre-state (row-level, for the post-migration comparison):**
  `MAN-2609-00001='Bushehr Cargo Agency'`, `MAN-2609-00002='Khalifa Shipping Co'`,
  `MAN-2609-00003=null`, `MAN-2609-00004=null`; `BOL-2609-00001/00002='Bushehr Cargo Agency'`.
  (Plan §1 wording "rows keep their free-text notifyParty" holds: non-null values must survive;
  rows 00003/00004 were already null — not touched by the cutover.)
- **Test-placement decision (recorded):** `manifest.e2e` + `bill.e2e` `beforeAll` calls
  `createRoleToken(...)` (pre-existing failing root cause: `GET /permissions/all` 404) → every test in
  those files fails at baseline (bill+manifest+inspection chunk: 34 failed / 13 passed = inspection only).
  New cutover tests therefore go in a **new dedicated suite** `apps/api/test/party-cutover.e2e-spec.ts`
  (admin-login based, no `createRoleToken`) so "no new failures anywhere" (75 failed) stays literal;
  the 6 Customer-pinning tests in the existing files are still updated per scope item 4 (they remain
  in their pre-existing failing suites; counts unchanged).

## Status at the stop (historical record — superseded by the decision + final block below)

```
EXECUTION_STATUS: NEEDS_BUSINESS_DECISION
TASK: phase-2-party-cutover (task-unit 1)
PHASE: Phase 2 / B/L–Manifest party cutover
DB_MIGRATION_STATUS: none (no migration written or applied; migrate status BEFORE recorded above: 29 migrations, up to date)
UI_GATE: NOT REACHED (stopped before implementation; gate deferred with the task)
SCHEMA_CHANGES: none
CODE_CHANGES: none (API/UI/shared types untouched)
TEST_CHANGES: none
TRANSLATION_CHANGES: none
GIT_VERIFICATION: porcelain diff vs baseline = empty (no tracked file modified); probe scripts deleted
NEEDS_BUSINESS_DECISION: YES — plan §3 "Portal agent scoping (JWT → agents table) unchanged" is
  contradicted by code reality (portal scopes manifests.agentId by a Customer id,
  portal.service.ts:142,292 + schema.prisma:92-93); after the repoint the portal suite regresses
  13 green -> 13 failing (fixtures FK-violate at portal.e2e-spec.ts:97,109; scoping assertions at
  :168 and :240-250 cannot pass while portal code compares Customer ids to Agent ids), and every
  remedy touches material excluded by plan §7 / prompt §7 ("portal scope"). Options:
  (1) authorize a follow-up portal unit (link portal users to Agent masters — requires a
  Customer<->Agent linkage decision), (2) accept the portal manifest-visibility regression in this
  unit and re-scope the 2 portal assertions, (3) defer only Manifest.agentId -> Agent (partial
  plan §1/§4 execution) and cut over shipper/consignee + Cargo gap + UI now.
  Options 1 and 3 preserve "no new failures"; option 2 does not.
STOP_RULE_COUNT_CHECK: PASS (re-checked before nulling: manifests 4/3/1, bills 2/2, Cargo 0/33,
  masters 0/0/1 — identical to evidence pack §4.2/§4.4; not the trigger for this stop)
BLOCKED: none
HANDOFF_TO: decision-maker (choose option 1, 2 or 3; then task-unit 1 executes as one unit)
```


## Execution (task-unit 1, after the linkage decision)

### Migration (scope item 1)
- `prisma/migrations/20260929231625_party_cutover_party_fks/migration.sql` — single file, file order
  **declare masters → guarded Cargo columns/indexes/FKs → drop 5 old FKs → null 12 values → add 5 new FKs**
  (the validating order; plan §2.1–§2.3 conceptual listing noted in the file header).
  1. `CREATE TABLE IF NOT EXISTS` for `shippers`/`consignees`/`agents` with the exact captured live
     shape (12 columns each; `isActive BOOLEAN NOT NULL DEFAULT true`; `createdAt DEFAULT CURRENT_TIMESTAMP`;
     Prisma-named `Shipper_pkey/code_key/code_idx/name_idx/isActive_idx` + Consignee/Agent equivalents).
     `agents` no-ops (already declared by `20260929212803_portal_agent_linkage`) — closes the
     plan-§9 replay gap for shippers/consignees.
  2. Cargo party columns/indexes/FKs guarded (`IF NOT EXISTS` / `pg_constraint` DO) — replay
     completeness no-ops on this DB (plan §2.4 / evidence §1.4); defs captured verbatim
     (`ON DELETE SET NULL`, no UPDATE clause — matches live).
  3. `DROP CONSTRAINT IF EXISTS` ×5 (names reused).
  4. `UPDATE … SET … NULL WHERE … IS NOT NULL OR …` ×2 tables — idempotent (2nd run matches 0 rows);
     **explicitly does not touch `notifyParty`**.
  5. 5 new FKs guarded: `manifests.shipperId → shippers`, `manifests.consigneeId → consignees`,
     `manifests.agentId → agents`, `bills_of_lading.shipperId → shippers`,
     `bills_of_lading.consigneeId → consignees`, all `ON UPDATE CASCADE ON DELETE SET NULL`
     (Prisma naming; matches captured live defs).
- `prisma validate` → **valid**; **migrate status BEFORE: 30 up to date → AFTER: 31 up to date**;
  no `db push`; `prisma generate` re-run.
- Post-deploy verification (live): all 5 FKs now `REFERENCES shippers/consignees/agents(id)`;
  non-null party FKs `manifests 0/0/0`, `bills 0/0`; notifyParty row-for-row unchanged
  (`MAN-2609-00001 'Bushehr Cargo Agency'`, `MAN-2609-00002 'Khalifa Shipping Co'`,
  `00003/00004 null` (pre-existing nulls), both B/Ls `'Bushehr Cargo Agency'`).

### schema.prisma (scope item 1)
- Manifest relations repointed: `shipper → Shipper? ("ManifestShipper")`,
  `consignee → Consignee? ("ManifestConsignee")`, `agent → Agent? ("ManifestAgent")`;
  Bill: `shipper → Shipper? ("BillShipper")`, `consignee → Consignee? ("BillConsignee")`;
  the 5 corresponding back-relations removed from `Customer` and added on `Shipper`/`Consignee`/`Agent`;
  Manifest party comment updated (cutover + migration name). `prisma validate` valid.

### API (scope item 2)
- `manifest.service.ts`:
  - new private `validatePartyRefs()` — provided (non-empty) party ids must resolve to
    **live, non-soft-deleted** masters; failure → `400 BadRequestException`
    `Unknown shipperId: no live Shipper with id <id>` (same shape for consignee/agent);
    called in `create()` (before write) and `update()` (`''` = clear, not validated).
  - `P2003` FK violations mapped → `400 'Invalid reference: party ids must reference existing master records'`
    in create + update (P2002/P2018 → 409 kept).
  - party relation selects `:85-87`: `shortName` **dropped** (`{id, code, name}`); Cargo `customer`
    select at `:110` keeps `shortName` (Customer, unaffected — as recorded in the pre-flight).
- `bill.service.ts`:
  - party relation selects `:85-86`: `shortName` dropped.
  - new private `assertLiveParty(kind, id, fromManifest)`: explicit dto ids → `400`
    (`Unknown shipperId: no live Shipper…`); ids derived from the manifest → `409 Conflict`
    (`Cannot issue B/L: manifest shipper does not reference a live Shipper`) — document-state problem.
    Applied in `create()` (effective party = dto override ?? manifest derivation, asserted before the
    write — plan §3 "existence asserted at B/L creation") and `update()` (explicit ids, 400);
    `P2003` → 400 with the same clear message.
  - Derivation logic itself (`dto.shipperId ?? manifest.shipperId` etc.) unchanged — now carries master ids.
- **Portal service untouched** (scope item 2 NO): the `portalAgentId ?? portalCustomerId` fallback shim
  stays; demo manifest reseeded instead (below). `portalCustomerId` column untouched.
- No new routes; no permission changes.

### Shared types (scope item 2)
- `packages/shared/src/manifest.ts:71-73` and `bill.ts:72-73/208-209`: `shortName` removed from the
  party refs (masters have no such field). Cargo `customer`/`invoice.customer` refs untouched.
  Repo grep after edits: **no party `shortName` left anywhere** (api/shared/web).
- `pnpm --filter @shipping/shared build` → exit 0.

### UI (scope item 3) + en/fa/ar
- `manifest/page.tsx`: `customers` state/load replaced by `shippers`/`consignees`/`agents`
  (`GET /shippers|/consignees|/agents?pageSize=100`, `api.get` unwrap), imports switched to
  `ShipperListItem`/`ConsigneeListItem`/`AgentListItem`; **all 6** party selects (create dialog ×3,
  DRAFT header editor ×3) now map the master lists with per-field placeholders
  `create.selectShipper` / `create.selectConsignee` / `create.selectAgent`.
- B/L page + Cargo page **unchanged** (per scope).
- `en/fa/ar`: `manifest.create.selectCustomer` replaced by the three new keys
  (en `Select shipper…/consignee…/agent…`; fa `فرستنده/گیرنده/کارگزار را انتخاب کنید…`;
  ar `اختر الشاحن/المرسل إليه/الوكيل…`); all three files re-validated as JSON; field labels
  (`Shipper/Consignee/Agent` etc.) already master-worded — unchanged.

### Seed (scope item 4 reseed)
- `prisma/seed.ts`: idempotent block — when `AGT-001` exists and `MAN-2609-00004.agentId IS NULL`,
  set it to the Agent-master id (logged `Demo manifest MAN-2609-00004 reseeded with Agent AGT-001`).
  Runs: 1st run reseeds, 2nd run silent. Fresh DBs (no demo rows) no-op.

### Tests (scope item 4)
- **6 Customer-pinning tests → master wiring** (evidence §6.1):
  `manifest.e2e:515,522` (PATCH shipperId → fixture `MFSP-<tag>` Shipper via Prisma in beforeAll,
  cleaned in afterAll), `bill.e2e:322,503` (fixture manifest + assertion → `BLSP-<tag>` Shipper),
  `delivery-release.e2e:151-153` (fixture manifest shipperId → `DRSP-<tag>` Shipper),
  `portal.e2e:97,109` (manifest fixtures `agentId` → fixture **Agent** ids `PFA/PFB-<tag>` — now FK-valid —
  with the stale "FK reality" comment rewritten; scoping assertions now pass through the
  `portalAgentId` leg of `portalManifestScopeIds`).
  All three non-portal suites keep their pre-existing `createRoleToken` beforeAll failure — updates
  are for correctness when that helper is fixed; counts unchanged.
- **New dedicated suite** `apps/api/test/party-cutover.e2e-spec.ts` (5 tests, admin-login, no
  `createRoleToken` — placement rationale in Resume pre-flight): master-ref create 201 + detail/list echo;
  DRAFT header update echo; unknown id → 400 (create + update, all 3 fields, message contains
  `no live …`); soft-deleted master → 400 (create + update); B/L derives shipper/consignee from the
  manifest's master refs (201 + detail echo incl. **consignee**, the previously-unasserted field —
  evidence §6.3). B/L prerequisite approval set via direct Prisma (fixture pattern, documented).
- Results: new suite **5/5**; portal **13/13**; chunked full run:
  C1 master-data+vessel+voyage **66/66**, C2 cargo/app/auth/job/portal/party-cutover **85/85**
  (Cargo's 8 master-pinning tests green), C3 invoice/voucher/salary/quotation/proforma/letter **68/68**,
  C4a bill+manifest+inspection **34 failed/13 passed (= baseline)**, C4b actual-loading/discharge/
  delivery-release **41 failed/0 passed (= baseline)** → **307 tests, 232 passed, 75 failed —
  the same 75 pre-existing failures, 0 new** (baseline 302/227/75 + 5 new green).
  A first C4a attempt showed 35/12; inspection alone reproduced **8 failed/13 passed twice**
  (deterministic) and the C4a retry returned **34/13** — the ±1 is inspection's pre-existing
  parallel-load interference, not a regression (bill alone 13/13 fail, manifest alone 13/13 fail,
  arithmetic matches the baseline exactly).
- `apps/api` `tsc --noEmit` → 0 errors; `apps/web` `tsc --noEmit` → only the 3 pre-existing
  `[locale]/page.tsx` errors (0 new).

### In-unit defect fix (found while preparing the mandated gate)
- **`/shippers` rejected every paginated query** with `400 'pageSize must be shorter than or equal
  to 100 characters'` (consignees/agents/voyages were fine): `ListShipperQueryDto.pageSize` carried
  `@MaxLength(100)` — a STRING validator on a number, which fails for any numeric value. Scope item 3
  mandates the UI selects fetch `/shippers?pageSize=100`, so this blocked the gate. Fixed:
  `@MaxLength(100)` → **`@Max(100)`** (numeric bound, intent preserved; `Max` imported). Repo scan
  showed this pattern exists **only** in the shippers DTO. Verified live: `/shippers?pageSize=100`
  → **200** (was 400); API tsc 0. Logged as an in-unit mechanical fix, not a business decision.

### Live API checks (scope item 5) — ALL PASSED
- Post-migration pre-state: `4 manifests + 2 bills: all party FKs null, notifyParty intact`.
- `POST /manifests` with master ids → **201**, echo `shipper=LVSP-001 consignee=LVCS-001 agent=AGT-001`
  (master-sourced objects), `notifyParty='Live Check Notify'`.
- Unknown id → **400** `Unknown consigneeId: no live Consignee with id no-such-master-xyz`.
- `POST /bills` from that (fixture-approved) manifest → **201** `BOL-2609-00003`; derived
  `shipper=Live Check Shipper consignee=Live Check Consignee` (detail read-back confirmed).
- Portal demo user: `shipments=['MAN-2609-00005','MAN-2609-00004'] approvedManifests=1` —
  demo manifest visible through its **reseeded AGT-001 agentId**.
- Live-check fixtures deleted immediately after (counts returned to 4/2/33, masters 0/0/1).

### UI gate §3.1 (scope item 6) — **PASS**
Evidence (screenshots `/home/duna/.config/browser-harness/tmp/shot.png` at each step):
1. **Manifest create via UI, master selects (admin):** dialog lists `Gate Shipper LLC` /
   `Gate Consignee FZE` / `Arash alidadi` (AGT-001) with new en placeholders
   `Select shipper…/Select consignee…/Select agent…`; created `MAN-2609-00005`.
   **Detail (DRAFT header editor)** shows all three master-sourced parties; API read-back:
   `shipperId/consigneeId/agentId` = master ids. 0 console errors on the detail view.
2. **B/L via UI:** fixture-approved manifest selected in the B/L create dialog → `BOL-2609-00003`;
   list row shows derived **CONSIGNEE column = `Gate Consignee FZE`**; API detail read-back shows
   derived `shipper = Gate Shipper LLC`. (The B/L UI has no shipper display field — pre-existing
   design; shipper derivation verified via API instead. Out of scope to add UI fields.)
3. **fa spot-check:** `/fa/manifest` create dialog renders `فرستنده را انتخاب کنید…`,
   `گیرنده را انتخاب کنید…`, `کارگزار را انتخاب کنید…`; title `مانیفست جدید`; master lists load. Screenshot saved.
4. **Portal (demo user):** dashboard **APPROVED MANIFESTS = 1**; Shipments tab **2 rows —
   `MAN-2609-00004` (the reseeded demo manifest, Draft) + `MAN-2609-00005` (Approved)**; company header
   Meridian; **0 console errors**; screenshot saved.
5. **Console errors — pre-existing exceptions (NOT introduced by this unit, documented):**
   `MISSING_MESSAGE nav.shippers / nav.consignees / topbar.switchToArabic` (sidebar/topbar, fires on
   route refresh as admin) and the whole `bill.*` namespace missing on `/en/bills` (page renders raw
   keys, e.g. `bill.actions.create`). Verified pre-existing: the keys are **absent at HEAD too**
   (`git show HEAD:…messages/en.json`), `nav.ts`/`topbar.tsx`/`bills/page.tsx` were NOT modified by
   this unit, and no code path of this unit references them. Fixing them = authoring another module's
   i18n/nav labels → **out of scope** (prompt §3: keys updated only "where labels/placeholders
   change"; §7: B/L page unchanged). No OTHER console errors on any touched page.

### Cleanup + final state (scope item 7)
- Gate/live fixtures removed: `BOL-2609-00003`, `MAN-2609-00005`, `GESP-001`, `GECN-001`,
  `LVSP-001`, `LVCS-001` (hard-deleted own rows); fixture Agent masters in portal.e2e removed by its
  own afterAll; temp probe scripts deleted (`ls scripts/tmp-*` → none).
- **Final DB:** `manifests 4 / bills 2 / cargo 33 / shippers 0 / consignees 0 / agents 1` (baseline);
  `MAN-2609-00004.agentId = AGT-001 id` (**the accepted post-state**), parties null, notifyParty null;
  legacy notifyParty strings intact.
- `prisma migrate status`: **31 migrations, up to date**; user's servers untouched (API 200 / WEB 200).
- git vs this unit's baseline: **+10 entries** — `M bill.service.ts, manifest.service.ts,
  test/{bill,delivery-release,manifest}.e2e-spec.ts, manifest/page.tsx, shared/{manifest,bill}.ts`,
  `?? test/party-cutover.e2e-spec.ts`, `?? prisma/migrations/20260929231625_party_cutover_party_fks/`
  (schema.prisma, seed.ts, messages ×3, shippers DTO, portal.e2e were already-modified in the
  baseline from prior units; their edits here are covered above). 57 → 67 porcelain lines.

## Deviations / notes
1. **Portal fallback shim NOT removed** — explicitly mandated by scope item 2 ("NO — leave that for a
   later cleanup"); the cutover's portal-side job was the demo-manifest reseed only. The linkage
   log/JSDoc line saying "the cutover unit REMOVES the Customer leg" is now historically stale;
   portal.service.ts was left untouched (out of scope) rather than re-commented.
2. **B/L fixture approval via direct Prisma** in the new e2e suite (same pattern portal.e2e uses) —
   the API submit/approve path needs a completed Actual Loading chain (out of scope).
3. **In-unit fix** `@MaxLength→@Max` on `ListShipperQueryDto.pageSize` (blocker for the mandated
   `/shippers?pageSize=100` UI fetch; mechanically forced, no business choice involved).
4. **Pre-existing i18n/nav gaps** (`nav.shippers`, `nav.consignees`, `topbar.switchToArabic`,
   entire `bill.*` namespace) surfaced during the gate: documented, out of scope, untouched.
5. `agent_destinations` still exists in no migration (pre-existing gap wider than plan §2.4/§9;
   not required by this unit's FKs — recorded for a future replay-completeness pass).
6. **Test placement**: new tests live in a dedicated suite because manifest/bill/delivery suites fail
   at `beforeAll` (pre-existing `createRoleToken` root cause) — adding tests there would have raised
   the failed count above 75, violating "no new failures".

## Final status (supersedes the historical NEEDS_BUSINESS_DECISION block above — decision issued: portal-linkage unit authorized, executed COMPLETE, then this unit ran)

```
EXECUTION_STATUS: COMPLETE
TASK: phase-2-party-cutover (task-unit 1, resumed after the linkage decision)
PHASE: Phase 2 / B/L–Manifest party cutover
SUPERSEDES: the NEEDS_BUSINESS_DECISION status above (option 1 chosen: portal agent linkage unit;
  phase-2-portal-agent-linkage.md = COMPLETE, prerequisite satisfied and verified)
STOP_RULE_COUNT_CHECK: PASS (re-run at resume: manifests 4/3/1, bills 2/2, Cargo 0/33, masters 0/0/1,
  soft-deleted children 0/0 — identical to the recorded pre-flight and evidence pack §4.2/§4.4)
DB_MIGRATION_STATUS: applied — 20260929231625_party_cutover_party_fks (declare masters + Cargo FKs,
  drop 5 Customer FKs, null 12 values, add 5 master FKs; file order drop->null->add); migrate status
  BEFORE: 30 up to date -> AFTER: 31 up to date; prisma validate: valid; no db push
SCHEMA_CHANGES: Manifest.shipperId/consigneeId/agentId -> Shipper/Consignee/Agent; BillOfLading
  shipperId/consigneeId -> Shipper/Consignee; Customer party back-relations removed; master
  back-relations added; notifyParty untouched
API_CHANGES: validatePartyRefs (400 unknown/soft-deleted master) on manifest create/update;
  assertLiveParty on bill create (dto->400, manifest-derived->409) + update; P2003->400 clear message;
  shortName dropped from party selects (manifest:85-87, bill:85-86); no new routes; no permission changes
  (portal service untouched — fallback shim kept per scope item 2)
SHARED_TYPES: shortName removed from manifest.ts:71-73 + bill.ts:72-73/208-209 (zero party shortName left)
UI_CHANGES: manifest create dialog + DRAFT header editor party selects now fetch /shippers,
  /consignees, /agents (pageSize=100) with per-field placeholders; B/L + Cargo pages unchanged
TRANSLATION_CHANGES: en/fa/ar manifest.create.selectCustomer -> selectShipper/selectConsignee/
  selectAgent (JSON re-validated); labels unchanged
SEED_CHANGES: idempotent reseed MAN-2609-00004.agentId = AGT-001 (1st run reseeds, 2nd run no-op)
TEST_CHANGES: 6 Customer-pinning tests -> master wiring (manifest:515,522; bill:322,503;
  delivery-release:151; portal:97,109 + comment); new suite party-cutover.e2e-spec.ts (5 tests);
  portal 13/13 green; full chunked run 307 tests / 232 passed / 75 failed = baseline 75 (0 new failures;
  one 35/12 C4a attempt shown to be inspection parallel-load flake — retry 34/13, inspection alone 8/13 twice)
VERIFICATION: API tsc 0; web tsc 3 pre-existing only; shared build 0; live API checks PASSED
  (4/2/33 nulled+notifyParty intact, create 201 + master echo, unknown id 400, B/L derivation read-back,
  portal sees reseeded demo manifest); shippers pageSize defect fixed in-unit (@Max) and verified 200
UI_GATE: PASS — manifest created via UI with master selects (detail shows all 3 master parties);
  B/L created via UI (list shows derived consignee, API read-back shows derived shipper);
  fa placeholders render; portal: APPROVED MANIFESTS=1 + shipments 2 rows incl. reseeded MAN-2609-00004;
  0 console errors from this unit's pages/code (pre-existing MISSING_MESSAGE gaps documented as deviations 4)
FIXTURES_CLEANED: YES — gate+live fixtures (2 manifests, 2 bills, 4 masters) hard-deleted; temp scripts
  removed; final DB manifests 4 / bills 2 / cargo 33 / masters 0/0/1; demo MAN-2609-00004.agentId = AGT-001
  = the accepted post-state
GIT_VERIFICATION: +10 porcelain entries vs this unit's 57-line baseline (8 modified + 2 untracked;
  schema/seed/messages/shippers-DTO/portal-test were baseline-modified); 57 -> 67 lines
DEVIATIONS: 6 recorded above (shim kept per scope; direct-Prisma B/L approval fixture; in-unit @Max fix;
  pre-existing i18n/nav gaps untouched; agent_destinations replay gap noted; new tests placed in a
  dedicated suite to keep "no new failures" literal)
NEEDS_BUSINESS_DECISION: none
BLOCKED: none
HANDOFF_TO: decision-maker (review + state update — plan §8 item 2); B/L page i18n (`bill.*`
  namespace) + nav.shippers/nav.consignees/topbar.switchToArabic keys are pre-existing gaps worth a
  small follow-up task; portal fallback shim removal remains a future cleanup decision
```
