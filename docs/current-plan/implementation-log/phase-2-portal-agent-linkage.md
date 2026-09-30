# Phase 2 — Portal agent linkage — implementation log

**Task ID:** phase-2-portal-agent-linkage (task-unit 0 / pre-cutover dependency)
**Roadmap:** Phase 2 / B/L–Manifest party cutover dependency
**Authoritative plan:** `docs/current-plan/party-cutover-plan.md` **§3 addendum (decision-maker,
2026-09-29)** + **§8 item 0** — read first; this task executes them.
**Objective:** Portal users link to Agent masters (`User.portalAgentId`), portal manifest scoping
switches from Customer id to Agent id, so the cutover unit can repoint `manifests.agentId → agents`
without breaking the portal.

## Pre-flight (recorded before any change)

- `npx prisma migrate status` **BEFORE: 29 migrations found, Database schema is up to date.**
- git baseline: 54 porcelain lines at HEAD `2b89e38` (saved `/tmp/git_before_portal.txt`).
- **Live data verified (this task's inputs):**
  - portal users: exactly 1 — `agent@portal.local` (`cmu0hi88i000cwhvtf1nle5ta`),
    `portalCustomerId = cmu0hfma30008whvtngrcs5yz` (Meridian Freight Co. (Portal Demo),
    code `AGT-P20DEMO`); **`portalAgentId` column does not exist yet** (information_schema).
  - agents: exactly 1 — `AGT-001` `cmum6v3m6000k7pwkymejprk1` "Arash alidadi", live.
  - manifests with agentId: exactly 1 — **`MAN-2609-00004`, status DRAFT, 0 cargo lines**,
    agentId = the Meridian Customer id (evidence pack §4.2 row detail).
- **Code anchors for the scoping switch:** `portal.service.ts:142` (dashboard
  `manifest.count({ agentId: customerId … status APPROVED })` inside `me()`) and
  `portal.service.ts:288/292` (`shipments()` builds `where.agentId = customerId`).
  Unlink semantics to mirror: `portalCustomerIdOf` throws
  `ForbiddenException('This account is not linked to a portal company')`
  (`portal.service.ts:109-119`); user-not-found → `NotFoundException('User not found')` (`:114`).
- **Gate feasibility facts:** portal UI = single page `apps/web/src/app/[locale]/(dashboard)/portal/page.tsx`
  (summary card `approvedManifests` at `:290`, shipments tab loads `/portal/shipments` at `:148-149`,
  no status filter). Manifest lifecycle: `DRAFT → [SUBMITTED, CANCELLED]`,
  `SUBMITTED → [APPROVED, CANCELLED]` (`manifest.service.ts:26-31`) and `submit()` rejects 0-item
  manifests (`:527-529`) → **the DRAFT/0-item demo manifest cannot reach APPROVED** without
  attaching real cargo. Therefore the gate's "dashboard shows the expected manifest (not zero)"
  (i.e. the `approvedManifests` card) requires a **temporary APPROVED gate fixture**
  (cargo + manifest + item + submit + approve, all created by this task and deleted afterwards);
  no pre-existing manifest/cargo row is mutated.

## Work log

### 1. Schema (scope item 1)
- `prisma/schema.prisma` User model: added `portalAgentId String? @unique @map("portalAgentId")`
  + `portalAgent Agent? @relation("UserPortalAgent", fields: [portalAgentId], references: [id])`
  (nullable; `portalCustomerId` retained untouched). `Agent` model gained the back-relation
  `portalUsers User[] @relation("UserPortalAgent")`.
- `npx prisma validate` → **The schema at prisma/schema.prisma is valid** (exit 0).

### 2. Migration (scope item 1, CLAUDE.md non-interactive flow: authored dir → migrate deploy)
- `prisma/migrations/20260929212803_portal_agent_linkage/migration.sql` — additive, guarded:
  1. `CREATE TABLE IF NOT EXISTS "agents"` + Prisma-named indexes (`Agent_pkey`, `Agent_code_key`,
     `Agent_code_idx`, `Agent_name_idx`, `Agent_isActive_idx`) — the Agent master exists in **no**
     migration file (pre-existing replay gap, plan §9 records it for the cutover unit; declared here
     because this unit's own FK depends on it for fresh replay — the cutover's guarded declaration
     then no-ops).
  2. `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "portalAgentId" TEXT` +
     `CREATE UNIQUE INDEX IF NOT EXISTS "User_portalAgentId_key"`.
  3. FK `User_portalAgentId_fkey` → `agents("id")` `ON DELETE SET NULL ON UPDATE CASCADE`
     (Prisma default for an optional relation), guarded via `pg_constraint` DO block.
- `npx prisma migrate deploy` → applied; **migrate status AFTER: 30 migrations found,
  Database schema is up to date** (BEFORE: 29, recorded in Pre-flight).
- No `db push`. Live check: `User.portalAgentId` present in `information_schema`.
- `npx prisma generate` re-run (client exposes `portalAgentId`).

### 3. Portal service (scope item 2)
- New private `portalManifestScopeIds(actor)` (`portal.service.ts:134-…`): resolves
  `User.portalAgentId` **+** `User.portalCustomerId` (deduped, falsy filtered); user missing →
  `NotFoundException('User not found')`; linked to neither → `ForbiddenException('This account is
  not linked to a portal company')` — byte-identical to `portalCustomerIdOf`'s existing messages
  (`portal.service.ts:109-119`), i.e. the same forbidden semantics as today.
- **Deviation (mandated by scope item 4, recorded):** the resolver returns BOTH ids
  (`portalAgentId ?? portalCustomerId` fallback) because `manifests.agentId` still FKs `Customer`
  until the cutover unit — the Customer leg keeps pre-cutover visibility, the Agent leg serves
  post-cutover. **The cutover unit REMOVES the Customer leg** and re-seeds demo manifests with
  Agent ids (plan §8 item 0). JSDoc on the resolver states this in-code.
- Switch 1 — `me()` dashboard count: `agentId: customerId` → `agentId: { in: manifestScopeIds }`
  (`portal.service.ts:173`). Bookings/voucher/customer lines stay Customer-scoped (unchanged).
- Switch 2 — `shipments()`: `portalCustomerIdOf` → `portalManifestScopeIds`;
  `agentId: customerId` → `agentId: { in: manifestScopeIds }` (`:321-325`).
- Grep confirms **zero** remaining `agentId: customerId` in the portal module. No new routes;
  no permission changes (`portal:access`/`booking:*` untouched); `assertStaff` and bookings scope
  unchanged.

### 4. Seed (scope item 3, idempotent)
- `prisma/seed.ts` (before `Seeding complete.`): link block sets `portalAgentId` on
  `agent@portal.local` → `Agent` `code = 'AGT-001'` **only when both rows exist** and only when the
  value differs (re-run = no write). Both demo rows are out-of-band data; DBs without them are
  skipped without error.
- Verified by running `pnpm db:seed` **twice**: run 1 printed
  `Portal user agent@portal.local linked to Agent AGT-001`; run 2 printed nothing (no-op).
  Live DB: `agent@portal.local.portalAgentId = cmum6v3m6000k7pwkymejprk1` (= AGT-001),
  `portalCustomerId` still set.

### 5. Portal fixtures/tests (scope item 4)
- `apps/api/test/portal.e2e-spec.ts`:
  - beforeAll: creates fixture Agent masters `PFA-<tag>`/`PFB-<tag>`, sets `portalAgentId` on
    fixture users A and B, asserts the link (`expect(linked?.portalAgentId).toBe(fixtureAgentA.id)`).
  - Fixture manifests keep `agentId = fixture Customer id` (FK reality) with a comment explaining
    the shim path; shim comments added above the two scoped assertions
    (`approvedManifests` `:168`, shipments scoping `:240-250`).
  - afterAll: `prisma.agent.deleteMany({ id in [agentAId, agentBId] })` (no dependents).
  - Test count unchanged: **13 tests** (no assertions added or removed beyond the fixture link check).
- Result: `pnpm --filter api test -- test/portal.e2e-spec.ts` → **Test Suites 1 passed,
  Tests: 13 passed, 13 total** (= required 13/13).

### 6. Typechecks (scope item 6)
- API `tsc --noEmit` → **0 errors**.
- Web `tsc --noEmit` → only the **3 pre-existing** `[locale]/page.tsx` errors
  (`home.services/capabilities/coverage`); **0 new**.

### 7. Chunked test runs (scope item 6 — no new failures)
| Chunk | Suites | Result |
|---|---|---|
| 1 | master-data + vessel + voyage | **66/66 passed** |
| 2 | cargo-inventory + app + auth + job + portal | **80/80 passed** |
| 3 | invoice + voucher + salary + quotation + proforma + letter | **68/68 passed** |
| 4a | bill + manifest + inspection (pre-existing failing) | 13 passed / **34 failed** |
| 4b | actual-loading + discharge + delivery-release (pre-existing failing) | 0 passed / **41 failed** |
| **Total** | | **302 tests, 227 passed, 75 failed — byte-identical to baseline** (same 6 `createRoleToken` suites; 0 new failures) |

### 8. Live API checks (scope item 6)
- **Pre-fixture (shim alone):** `GET /portal/me` → `approvedManifests=0`;
  `GET /portal/shipments` → `shipments=1 numbers=['MAN-2609-00004']` — the DRAFT demo manifest is
  already visible through the fallback (shipments list never zero) while the APPROVED card is 0
  because that manifest is DRAFT (Pre-flight feasibility note).
- **Gate fixture** (see Deviation 3): `MAN-2609-00005` created (agentId = demo Customer) and set
  APPROVED directly via Prisma — same pattern as `portal.e2e-spec.ts:90-101` fixtures; the API
  path was tried first and rejected with `409 'Cargo was not actually loaded on this voyage; only
  cargo from a completed Actual Loading may be manifested'` (verbatim), so the full loading chain
  would have been required — disproportionate for a display fixture. The intermediate fixture
  cargo `CRG-2609-00095` (created before that rejection) was deleted → cargo count back to 33.
- **Post-fixture:** `approvedManifests=1`, `shipments=2 numbers=['MAN-2609-00005','MAN-2609-00004']`,
  `company=Meridian Freight Co. (Portal Demo) bookingsTotal=4` (bookings scope untouched);
  negative: unlinked admin → **403** on both `/portal/shipments` and `/portal/me`
  (mirror semantics preserved). Script asserted all of the above → PASSED.

### 9. UI gate §3.1 (scope item 5) — **PASS**
- Logged into the running app as the demo portal user (token via API; no password typed),
  `/en/portal`:
  - Dashboard: **APPROVED MANIFESTS = 1** (not zero), TOTAL BOOKINGS 4, BALANCE DUE 861.00 USD,
    company header `Meridian Freight Co. (Portal Demo) · AGT-P20DEMO`.
  - Shipments tab: **2 rows** — `MAN-2609-00005` (Approved) and `MAN-2609-00004` (Draft),
    `Page 1 of 1 • 2 items`.
  - Statement tab exercised as well (page switches, data renders).
  - **Console: 0 errors** (collector on `console.error` + `error` + `unhandledrejection`,
    installed before interaction; read after dashboard → shipments → statement);
    Next.js error overlay: none.
- Evidence: screenshot `/home/duna/.config/browser-harness/tmp/shot.png` reviewed — Agent Portal,
  Shipments tab active, APPROVED MANIFESTS=1, both manifest rows visible, no error overlay.

### 10. Cleanup + post-state (scope item 7 / final verification)
- Gate fixture manifest `MAN-2609-00005` deleted (had no items); fixture cargo already removed;
  e2e afterAll removed the 2 fixture Agent masters (`agents` total = 1 again).
- Live DB post-state: **manifests 4 / bills 2 / cargo 33** (baseline restored);
  `portalAgentId` linkage on `agent@portal.local → AGT-001` **persists** (intended seed effect);
  `portalCustomerId` retained.
- Temp probe scripts deleted (`no tmp scripts`).
- `git status --porcelain` vs baseline: +3 entries only —
  `M apps/api/src/modules/portal/portal.service.ts`, `M apps/api/test/portal.e2e-spec.ts`,
  `?? prisma/migrations/20260929212803_portal_agent_linkage/`
  (`prisma/schema.prisma` and `prisma/seed.ts` were already modified in the baseline from earlier
  Phase 2 tasks; their edits here are part of this unit and both are covered by validate/seed runs).

## Deviations (all recorded, none blocking)
1. **Temporary scoping fallback** — `portalAgentId ?? portalCustomerId` (both ids in one `IN`),
   mandated by scope item 4; to be removed by the cutover unit. Reason FK reality: `manifests.agentId`
   → Customer until cutover (plan §8 item 0).
2. **`agents` table declared in this unit's migration** — required for fresh-replay completeness of
   this unit's FK (table existed in no migration); overlaps plan §9 harmlessly (guarded no-op).
3. **Gate fixture APPROVED via direct Prisma** (not the submit/approve API) — the API path is
   gated by the completed-Actual-Loading rule (409 verbatim above); identical pattern to existing
   portal e2e fixtures; fixture deleted afterwards, no pre-existing manifest/cargo row mutated.

## Status

```
EXECUTION_STATUS: COMPLETE
TASK: phase-2-portal-agent-linkage (task-unit 0)
PHASE: Phase 2 / party cutover dependency — portal agent linkage
DB_MIGRATION_STATUS: applied — 20260929212803_portal_agent_linkage (additive, guarded); migrate status BEFORE: 29 up to date -> AFTER: 30 up to date; prisma validate: valid; no db push
UI_GATE: PASS — /en/portal as demo user: APPROVED MANIFESTS=1, Shipments tab 2 rows (MAN-2609-00005 Approved + MAN-2609-00004 Draft), Statement tab exercised, 0 console errors, no overlay; screenshot reviewed
SCHEMA_CHANGES: User.portalAgentId (nullable unique) + User.portalAgent relation + Agent back-relation; portalCustomerId retained
API_CHANGES: portalManifestScopeIds resolver (portalAgentId + legacy Customer fallback, same 403/404 semantics) wired into me() dashboard count and shipments(); no new routes; no permission changes
SEED_CHANGES: idempotent demo linkage agent@portal.local -> AGT-001 (ran twice: link then no-op); live linkage verified
TEST_CHANGES: portal.e2e fixtures gain Agent masters + portalAgentId (asserted); manifest fixtures keep Customer agentId (FK reality) with shim comments; 13/13 green; test count unchanged
VERIFICATION: API tsc 0 errors; web tsc 3 pre-existing only (0 new); chunked full suite 302 tests / 227 passed / 75 failed = byte-identical baseline (0 new failures); live API checks PASSED (pre 0/1, post 1/2, unlinked 403)
FIXTURES_CLEANED: YES — MAN-2609-00005 deleted, fixture cargo deleted, fixture agents removed; DB baseline manifests 4 / bills 2 / cargo 33; intended post-state = portalAgentId linkage only
GIT_VERIFICATION: +2 modified (portal.service.ts, portal.e2e-spec.ts) + 1 untracked migration dir vs baseline (schema.prisma/seed.ts already-modified in baseline); temp scripts removed
DEVIATIONS: 3 recorded above (fallback shim per scope item 4; agents table declared for replay; gate fixture APPROVED via direct Prisma after API 409 loading-chain rule)
NEEDS_BUSINESS_DECISION: none (fallback shim proved clean — scope-item STOP rule not triggered)
BLOCKED: none
HANDOFF_TO: decision-maker (review) -> next: party-cutover task-unit 1 (plan §8 item 1; it removes the Customer fallback leg and reseeds demo manifests with Agent ids)
```
