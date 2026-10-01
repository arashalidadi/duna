# 11 Implementation State

## Current phase

Phase 2 — Master Data & Party Model Realignment (execution cycle underway).

## Current subphase

Party Masters — COMPLETE. Port abbreviation — COMPLETE. Vessel type & tug/barge — COMPLETE. Voyage per-destination numbering — COMPLETE. Cutover evidence pack — COMPLETE. Portal agent linkage — COMPLETE. B/L/Manifest party reference cutover — COMPLETE (plan → executed → verified). Follow-ups (i18n / portal shim / replay completeness) — COMPLETE. Party master + Agent destination e2e coverage — COMPLETE. **Phase 2 CLOSED** (roadmap §3 Phase 2: 4/4 acceptance criteria and 4/4 `Tests:` items verified). Next: Phase 3 — Operational Flow Reconciliation, unit 1.

## Completed work

- Phase 1 infrastructure implemented and migrated.
- Auth/RBAC implemented.
- Master data and operational modules implemented for Customer, Port, Yard, Vessel, Voyage, Cargo, YardInventory, Inspection, LoadList, LoadListItem, ActualLoading, ActualLoadingItem, Discharge.
- Manifest, BillOfLading, Invoice, Proforma, Quotation, Voucher, Ledger, DeliveryOrder, ReleaseOrder, Employee, SalaryRecord, Letter, Job, JobCostItem, Agent portal implemented to varying degrees.
- Phase 2 — Party Masters: COMPLETE (implementation-log/phase-2-party-masters.md). Shipper/Consignee/Agent/AgentDestination schema + API + UI + RBAC (12 permission codes). B/L/Manifest party refs untouched as required.
- Phase 2 — Port abbreviation: COMPLETE (implementation-log/phase-2-port-abbreviation.md). Migration 20260929132053 (27 migrations), unique index live, duplicates nulled, UI + en/fa/ar, 5 new e2e tests. UI gate PASS.
- Phase 2 — Vessel type & tug/barge: COMPLETE (implementation-log/phase-2-vessel-tug-barge.md). Migration 20260929142911 (28 migrations). VesselType 10 values; voyage-level pairing, type-validated; vessels/voyages UI + en/fa/ar; 9 new e2e tests. UI gate PASS. Incidental fix: vessels-page editInput immutable-`code` 400.
- Phase 2 — Voyage per-destination numbering: COMPLETE (implementation-log/phase-2-voyage-numbering.md). Migration 20260929164932 (29 migrations). VoyageDestination legs; destination-scoped `{seq}/{YY}` per docs' 1/26 evidence; idempotent backfill 21/21 (leg1 = parent); API legs + preview endpoint; voyages UI + en/fa/ar; 7 new e2e tests. UI gate PASS. Deviations pre-approved: fallback leg model; docs format over illustrative example.
- Phase 2 — Cutover evidence pack (READ-ONLY): COMPLETE (party-cutover-evidence-pack.md, 412 lines; log implementation-log/phase-2-cutover-evidence.md). Zero code changes; UI gate NOT APPLICABLE. Key facts: Manifest/B-L party FKs → Customer (all nullable); Cargo party FKs → masters (in schema + live DB but in NO migration file); live data: Cargo 0/33 party refs, manifests 4/3/1, bills 2/2, 0 of 12 Customer party refs match any master; masters nearly empty; B/L parties derived from Manifest in code; all three UI pages select parties from /customers only; 6 tests pin Customer wiring, 8 already pin Cargo→masters.
- Phase 2 — Portal agent linkage (cutover task-unit 0): COMPLETE (implementation-log/phase-2-portal-agent-linkage.md). Migration 20260929212803 (30 migrations, up to date; also declares agents table for replay). User.portalAgentId unique FK → Agent; portal manifest scoping via portalManifestScopeIds() = portalAgentId + temporary legacy portalCustomerId fallback (fallback to be removed by cutover unit); seed idempotently links demo portal user → AGT-001 (live-verified); portal fixtures/assertions updated, portal 13/13; full suite 227/75 byte-identical baseline. UI gate PASS (demo user sees approved manifests + shipments, 0 console errors). Deviations: mandated shim; agents-table declaration; fixture APPROVED via direct Prisma (same pattern as existing portal fixtures).
- Phase 2 — B/L/Manifest party cutover (task-unit 1): COMPLETE + INDEPENDENTLY VERIFIED (implementation-log/phase-2-party-cutover.md, ends EXECUTION_STATUS: COMPLETE / UI_GATE: PASS). Migration 20260929231625 (31 migrations, up to date; declares shippers/consignees/agents + Cargo party FKs for replay, drops 5 Customer FKs, nulls 12 values, adds 5 master FKs). Manifest/B-L party FKs → masters live (pg_constraint verified: SET NULL/CASCADE, references shippers/consignees/agents); 4 manifests / 2 B-Ls nulled with notifyParty intact; MAN-2609-00004.agentId = AGT-001 (accepted post-state). API validatePartyRefs + assertLiveParty (400/409), P2003→400, party shortName dropped. Manifest UI (create dialog + DRAFT editor) reads /shippers|/consignees|/agents?pageSize=100; en/fa/ar placeholders; in-unit @MaxLength→@Max fix on shippers pageSize. New suite party-cutover.e2e-spec.ts 5/5; portal 13/13; full run 307/232/75 = exact baseline (re-run confirmed; the +2 delta seen once is inspection's pre-existing parallel-load flake). UI gate re-verified in-session: master selects + en/fa placeholders render, master endpoints 200, only pre-existing MISSING_MESSAGE console errors.
- Phase 2 — follow-ups (i18n gaps, portal shim removal, migration-replay completeness): COMPLETE (implementation-log/phase-2-followups.md). +87 keys/locale in en/fa/ar (`bill.*`, `nav.shippers`, `nav.consignees`, `topbar.switchToArabic`), 125 added lines/locale, 0 deleted, bill/topbar key parity — `/en|/fa|/ar/bills` now render real copy with 0 MISSING_MESSAGE. Portal `portalManifestScopeIds()` drops the legacy Customer leg (403 kept for "linked to neither"; customer-only users get an empty manifest scope, not a 403) + 1 new regression test → portal 14/14. Migration 20260930180000_replay_completeness closes the FULL replay gap (6 undeclared tables incl. agent_destinations, 4 enums, 10 columns, model-vs-mapped constraint/index naming): fresh replay of all 32 migrations reproduces schema.prisma with ZERO diff; live drift 99→15 lines (remaining = 5 pre-existing live-only indexes). Full run 308/233/75 = baseline failure set, 0 new failures. UI gate PASS in all 3 locales.
- Phase 2 — party master + Agent destination e2e coverage (roadmap §3 Phase 2 `Tests:` items "Party CRUD" + "Agent destination scoping"): COMPLETE (implementation-log/2026-09-30-phase2-party-master-tests.md, ends EXECUTION_STATUS: COMPLETE). One new suite `apps/api/test/party-masters.e2e-spec.ts`, **37 tests, all green** (A1–A10 × {shippers, consignees, agents} + B1–B7 destinations + tag-scoped isolation), ValidationPipe copied verbatim from `main.ts:42-47` incl. `forbidNonWhitelisted` so the test app matches production validation. Baseline corrected-criterion run 308/232/76 (deterministic 67 exact, inspection 9 ∈ [8,10]) → 345/269/76 with deterministic 67 unchanged, failing-suite set identical, 0 non-inspection suites moved. Decision-maker independently re-ran the suite (37/37) and the full run (345/269/76, deterministic 67, inspection 9). tsc API 0 / web 3 pre-existing; shared build 0; servers untouched. No production file touched.

## Incomplete or transitional work

- B/L/Manifest party references now point at Shipper/Consignee/Agent masters (cutover executed); remaining transitional item: portal fallback shim (`portalManifestScopeIds` still ORs the legacy `portalCustomerId`) awaits a cleanup decision.
- B/L/Manifest ordering and party model still reflect the old Manifest-first approach in code.
- ~~Cargo.shipperId/consigneeId migration gap~~ — CLOSED by migration 20260929231625 (guarded column+FK declarations; replay now complete for Cargo parties).
- Invoice header VAT and missing Job link still present.
- Voucher single-invoice FK still present.
- GeneralJournal and VoucherAllocation not present.
- B/L release status and revision model not present.
- ManifestItem→BillOfLadingItem reference not present.
- Agent portal not yet destination-scoped B/L/Release visibility.
- Customer 360 not yet delivered.
- Document output pipeline not yet complete (no print/PDF templates exist).
- Reports not yet delivered.
- Pre-existing repository hygiene (out of scope, noted): root `pnpm test` self-recursive broken script; 3 web tsc errors in unrelated [locale]/page.tsx; **6 red operational e2e suites (67 deterministic failures)** — stale `POST /inspections/:id/approve` fixtures against the shipped Phase 3A lifecycle, plus a load-dependent `Cargo.reference` unique-collision race → assigned to Phase 3 unit 1 (the earlier "createRoleToken → 404 on /permissions/all" attribution was disproven: the route exists at `permissions.controller.ts:13` and returns 200); Sept-21 ALLVB/ALLVT fixture litter; 113 stale voyage-<portId> numbering rows; 5 live-only indexes declared in no schema (live drift, not a replay gap); 19 ar-only i18n keys present at HEAD; 4 orphaned `_prisma_migrations` rows (Sept 21, no directory — `migrate status` unaffected).

## Active blockers

- Cutover strategy decision: RESOLVED — plan approved (party-cutover-plan.md); execution paused on portal-linkage dependency; portal agent linkage unit added as task-unit 0 (DECISION-MAKER ADDENDUM: User.portalAgentId FK → Agent, scoping switches to Agent id, portalCustomerId retained unused for scoping).
- Employer/business confirmation still pending for: B/L release status + revision model; ManifestItem→BillOfLadingItem reference + Manifest date fields; agent portal scope beyond bookings.
- Pending employer document/voice review (paused earlier pending that review; Party Masters batch executed autonomously after user authorization).

## Next approved task

**Phase 2 CLOSED** (decision-maker verification 2026-10-01). Roadmap §3 Phase 2 — 4/4 acceptance criteria met, 4/4 `Tests:` items covered: Voyage numbering (`voyage.e2e-spec.ts`, 26), Vessel type constraints (`vessel.e2e-spec.ts`), **Party CRUD** and **Agent destination scoping** (`party-masters.e2e-spec.ts`, 37/37 green, independently re-run by the decision-maker). Phase 2 commits: `4a39653` (tree), `d203444` (follow-ups), plus the party-master-tests commit.

**Next: Phase 3 — Operational Flow Reconciliation, unit 1** (roadmap §3 Phase 3). Rationale: Phase 3's own 6 suites are the entire remaining e2e baseline, and they are red for two diagnosed reasons — (a) **stale fixtures**: all 6 call `POST /api/v1/inspections/:id/approve`, a route removed by the already-shipped Phase 3A lifecycle (`book/done/fail/needs-re-inspection`, `inspection.controller.ts:53-90`); solo runs confirm `beforeAll` fails at that call (manifest:212, bill:217, discharge:203), (b) **load-dependent 409s** in the full run at `POST /cargo` — `Cargo.reference` is `@unique` while `generateReference()` is read-then-write, so parallel workers collide and `http-exception.filter.ts:78-79` maps P2002 → 409. A green deterministic baseline is a prerequisite for verifying any Phase 3 acceptance criterion ("no new failures" is meaningless while 67 deterministic failures stand).

Authorized follow-ups, none blocking: (a) 5 live-only indexes declared in no schema; (b) `manifest.dto.ts:35` stale Swagger text; (c) candidate defects recorded in `2026-09-30-phase2-party-master-tests.md` (PATCH clobbers omitted text fields `shippers.service.ts:99-109`; destination duplicate message says "code" `agents.service.ts:197-199`; no GET-one destination route); (d) previously-noted business confirmations below.

## Status confidence

High for completed subphases (all verified against repository, live DB, live API, plus UI gates). Cutover planning confidence: high — evidence pack is complete and cited. Overall project: Medium pending the business confirmations above.
