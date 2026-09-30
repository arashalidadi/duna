# Phase 2 — B/L/Manifest Party Reference Cutover Plan

Status: APPROVED (decision-maker) — **EXECUTED**: task-unit 0 (portal agent linkage) and task-unit 1 (cutover) both COMPLETE; logs `implementation-log/phase-2-portal-agent-linkage.md` and `implementation-log/phase-2-party-cutover.md` (ends `EXECUTION_STATUS: COMPLETE`, `UI_GATE: PASS`). Independently re-verified 2026-09-30: migration 31 up to date, live FKs → masters, suite 307/232/75 = baseline, UI gate re-checked. §8 item 2 (decision-maker review + state update) — state recorded in `11-implementation-state.md`.
Followed by: one Hermes implementation task per task-unit below, in order.
Post-completion follow-ups (decision-maker approved 2026-09-30): i18n gaps, portal fallback-shim
removal, migration-replay completeness — all executed and verified; see
`implementation-log/phase-2-followups.md`.

## 0. Decision basis (from evidence pack)

- Manifest + B/L party FKs → `Customer` (all nullable, SET NULL) [§1, §4.2].
- Cargo party FKs → masters already, but exist in **no migration file** [§1.4, §4.5].
- Live party data: manifests 4/3/1, bills 2/2, Cargo 0/33 [§4.2]. **0 of 12 Customer party refs
  match any master** under any stated heuristic; no Customer carries a taxId [§4.3].
- Masters: 0 shippers, 0 consignees, 1 unreferenced Agent [§4.4]. Zero soft-deleted parents referenced [§4.4].
- B/L parties are **derived from the Manifest** in code [§2]; B/L UI has no party selects [§5].
- All party selects in UI read `/customers` [§5].
- 6 tests pin Customer wiring; 8 already pin Cargo→masters [§6].

## 1. Target state (from 04-final-data-model + locked decisions)

- `Manifest.shipperId → Shipper`, `consigneeId → Consignee`, `agentId → Agent` (nullable, SET NULL).
- `BillOfLading.shipperId → Shipper`, `consigneeId → Consignee` (nullable, SET NULL) — **still derived
  from the Manifest at creation; direct FK kept for query/display**.
- `Cargo` unchanged (already on masters). `Cargo.customerId` (required) remains the commercial
  counterparty per schema comment [schema.prisma:417].
- `notifyParty` stays free text (manifests + B/L) for this phase; structured notify ref is deferred.
- `Customer` model and its commercial role are NOT removed or reduced in this phase.
- Existing numbers/rows: no voyage/manifest/B-L numbers change. Party values on existing live rows
  (4 manifests / 2 B-Ls referencing 3 Customers) **cannot be remapped** (0 matches) → those FKs are
  nulled by the migration; rows keep their free-text notifyParty and remain valid. This is the
  documented, accepted data consequence of greenfield cutover.

## 2. Migration (single migration, additive + repoint, non-destructive)

1. Drop old Manifest/B-L party FK constraints (SET NULL to Customer); keep columns.
2. Add new FKs to `shippers`/`consignees`/`agents` (ON DELETE SET NULL ON UPDATE CASCADE), Prisma naming.
3. `UPDATE manifests SET "shipperId"=NULL, "consigneeId"=NULL, "agentId"=NULL;` and same for
   `bills_of_lading` (safe: 6 rows, soft-delete-none). Explicit, commented, idempotent-safe.
4. **Declare the missing Cargo party FKs/columns in a migration file** (closes evidence §1.4 gap):
   `CREATE COLUMN IF NOT EXISTS`-style guarded statements matching schema.prisma:457-458 so a fresh
   replay produces a complete schema.
5. Schema.prisma updated to match. `migrate status` before/after in the log. No `db push`.

## 3. API changes

- `manifests` DTO + service: `shipperId` must reference a live Shipper (existence check like Cargo's
  customerId check [§2]); same for consignee/agent. P2002/foreign-key violations → 400/409 with
  clear messages.
- `bills` service: creation derives shipper/consignee from the Manifest (unchanged logic), now
  reading master IDs from the manifest; existence of manifest parties is asserted at B/L creation.
- **Portal agent scoping — decision-maker addendum (2026-09-29):** portal currently scopes
  manifests by `User.portalCustomerId` (a Customer id) compared to `manifests.agentId`
  (portal.service.ts:142,292) — contradicted by code reality during pre-flight. DECISION: add
  `User.portalAgentId` (nullable, unique) FK → Agent master; portal scoping switches to the Agent
  id; `portalCustomerId` column RETAINED (no destructive change) but no longer used for manifest
  scoping. Executed as a SEPARATE task-unit BEFORE this cutover unit; this unit then proceeds as
  specified. Portal seed/fixtures update in that unit.
- No new routes; no permission changes (reuse existing manifest:*/bill:* codes).

## 4. UI changes

- Manifest create dialog + DRAFT header editor: shipper/consignee/agent selects switch from
  `/customers` to `/shippers`, `/consignees`, `/agents` (pageSize=100, live-only), localized
  placeholders (drop `selectCustomer` wording for these three fields).
- B/L page: unchanged (no party selects; derived display stays).
- Cargo page: unchanged.
- en/fa/ar keys updated where labels/placeholder text change.

## 5. Tests

- Update the 6 Customer-pinning tests [§6] to the master-based wiring.
- Add: manifest create with master refs (201 + echo); unknown master id → 400; B/L create derives
  parties from manifest's master refs; soft-deleted master → rejected/SET NULL behavior test.
- Cargo master-pinning tests (8) must stay green. No new failures elsewhere.

## 6. Verification + gates

- `prisma validate`, `migrate status` (before/after), API+web tsc, chunked per-package tests,
  live API checks (manifest create with masters, B/L derivation, unknown-id rejection).
- **UI gate §3.1 (mandatory):** manifest create via UI using master selects (create a fixture
  shipper+consignee first), verify persisted values, verify B/L created from that manifest shows
  the derived parties; fa spot-check; 0 console errors. PASS/FAIL + evidence in log.
- Fixtures deleted after checks.

## 7. Out of scope

- B/L release status/revision model; ManifestItem→B/LItem; Manifest date fields; document/print
  templates; structured notifyParty; Customer deprecation; Cargo logic changes; portal scope;
  invoice/voucher/ledger; numbering.

## 8. Task split (sequential Hermes tasks)

0. **Portal agent linkage (DECISION-MAKER ADDENDUM 2026-09-29, executes FIRST):** add
   `User.portalAgentId` FK → Agent; portal manifest scoping (dashboard count + shipments list)
   switches to the Agent id; seed idempotently links the demo portal user to the demo Agent
   master; portal fixtures updated to Agent-master ids. **FK reality (verified):**
   `manifests.agentId` HAS a FK constraint to Customer today (schema.prisma:1145), so the linkage
   unit CANNOT write an Agent-master id into a manifest.agentId. Therefore: linkage unit sets
   `User.portalAgentId` = demo Agent-master id and switches the two scoping queries to it; the
   demo seeded manifest temporarily keeps agentId = Customer id and the portal's pre-cutover
   scoping tests that assert via the OLD path are updated in the CUTOVER unit (which nulls
   manifest agentIds and re-seeds the demo manifest with the Agent-master id). Interim acceptance
   for the linkage unit: portal suite green under the updated wiring (no Customer-agent FK
   violation), dashboard/shipments queries use portalAgentId, demo user sees their shipment list
   in the UI (gate §3.1 applies — portal has a UI).
1. **Cutover implementation** — sections 2–6 above, one task, one log:
   `implementation-log/phase-2-party-cutover.md` (resumed; pre-flight evidence already recorded —
   do not redo the survey; STOP-rule count re-check still required).
2. Review + state update by decision-maker; UI gate verdict recorded.

## 9. Mechanical notes for the cutover unit (recorded by Hermes at stop)

- On repoint, drop the shortName selects/types: manifest.service.ts:85-87, bill.service.ts:85-86,
  shared manifest.ts:71-73, bill.ts:72-73/208-209.
- Migration must ALSO declare `shippers`/`consignees`/`agents` tables guarded (they exist in no
  migration file — wider replay gap than evidence §1.4) for fresh-replay completeness.
