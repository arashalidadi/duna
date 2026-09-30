# 11 Implementation State

## Current phase

Phase 2 — Master Data & Party Model Realignment (execution cycle underway).

## Current subphase

Party Masters — COMPLETE. Port abbreviation — COMPLETE. Vessel type & tug/barge — COMPLETE. Voyage per-destination numbering — COMPLETE. Cutover evidence pack — COMPLETE. Portal agent linkage — COMPLETE. B/L/Manifest party reference cutover — COMPLETE (plan → executed → verified). Next: decision-maker review of the cutover unit + i18n/nav follow-up.

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
- Pre-existing repository hygiene (out of scope, noted): root `pnpm test` self-recursive broken script; 3 web tsc errors in unrelated [locale]/page.tsx; 6 pre-existing createRoleToken e2e suites (75-76 failures); Sept-21 ALLVB/ALLVT fixture litter; 113 stale voyage-<portId> numbering rows.

## Active blockers

- Cutover strategy decision: RESOLVED — plan approved (party-cutover-plan.md); execution paused on portal-linkage dependency; portal agent linkage unit added as task-unit 0 (DECISION-MAKER ADDENDUM: User.portalAgentId FK → Agent, scoping switches to Agent id, portalCustomerId retained unused for scoping).
- Employer/business confirmation still pending for: B/L release status + revision model; ManifestItem→BillOfLadingItem reference + Manifest date fields; agent portal scope beyond bookings.
- Pending employer document/voice review (paused earlier pending that review; Party Masters batch executed autonomously after user authorization).

## Next approved task

Phase 2 — cutover task-unit 1 is COMPLETE and verified. Next: decision-maker review of `phase-2-party-cutover.md` (plan §8 item 2 — verdict recorded: PASS). Candidate follow-ups to authorize separately: (a) pre-existing i18n/nav gaps surfaced by the gate (`bill.*` namespace, `nav.shippers`, `nav.consignees`, `topbar.switchToArabic` — absent at HEAD, /en/bills renders raw keys); (b) portal fallback shim removal; (c) `agent_destinations` replay-completeness pass (exists live, in no migration).

## Status confidence

High for completed subphases (all verified against repository, live DB, live API, plus UI gates). Cutover planning confidence: high — evidence pack is complete and cited. Overall project: Medium pending the business confirmations above.
