# 00 Audit State

## Stage progress

| Stage | Name | Status |
|-------|------|--------|
| 0 | Workspace creation | ✅ COMPLETE |
| 1 | Employer requirements analysis | ✅ COMPLETE |
| 2 | Actual business document evidence | ✅ COMPLETE |
| 3 | Current project/source/database/UI analysis | ✅ COMPLETE |
| 4 | Requirement traceability | ✅ COMPLETE |
| 5 | Existing project work / prior plans audit | ✅ COMPLETE |
| 6 | Final gap/conflict analysis | ✅ COMPLETE — REVISED |
| 6.5 | Technical decision lock | ✅ COMPLETE |
| 7 | Final implementation roadmap | ✅ COMPLETE — REBUILT |
| 8 | Master document assembly | ⬜ NOT STARTED |
| Phase 1 | Safety, shared infrastructure & migration foundation | ✅ COMPLETE |
| Phase 2 | Master Data & Party Model | ✅ COMPLETE — VERIFIED |

Phase 1 implemented:
- Migration `20260921012713_phase1_infrastructure` (5 tables: NumberingSequence, AuditLog, FileAttachment, DocumentTemplate, DocumentTemplateVersion)
- Storage abstraction (local + S3-compatible interface)
- NumberingSequence service (global/destination/year/period scoping, prefix, padding, concurrency-safe)
- AuditLog service (append-only, action/entity/actor/metadata)
- FileAttachment service (category-based, soft-delete, storage adapter)
- DocumentTemplate service (versioning, active version selection, 14 document types)
- `STORAGE_ADAPTER_TOKEN` DI token to fix interface injection across global modules
- Phase 1 tests: numbering (9), audit (9), attachment (10)
- API: compiles clean, builds, listens on port 3101, health + login working

Phase 2 implemented and verified:
- Prisma schema: Shipper, Consignee, Agent, AgentDestination, Port.abbreviation, VesselType (TUG/BARGE/LANDING_CRAFT), Voyage.tugVesselId/bargeVesselId, Cargo.shipperId/consigneeId, NumberingSequence (expanded)
- Migration `20260921032600_phase2_master_data_party_model`
- 8 Phase 2 test suites, 66 tests, all passing
- API: compiles clean (0 tsc errors), builds, health + login working, web running
- Pre-existing protected files preserved: `.gitignore`, `apps/web/messages/ar.json/en.json/fa.json`, `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/app/globals.css`

Pre-existing e2e failures (voyage.e2e-spec: 4/13) are unrelated to Phase 2 verification — caused by test data state between runs (VOY/00001 pollution) and format expectation mismatch.

## What is known so far

Stages 0–7 complete. Phase 2 verified. The technical baseline is frozen by `docs/ai-audit/06.5-technical-decision-lock.md`. All work in Stages 6, 6.5, and 7 was audit/planning only. No application code, Prisma schema, migrations, database, API, or UI were modified except as documented in Phase 2 implementation log.

### Stage 6 summary (revised):

Final reconciliation of employer requirements against current dashboard implementation across 16 domain groups, revised to match the technical decision lock.

- **CORRECT (keep):** Port structure, Yard/Port filter, Vessel asset model, Cargo customer link, YardInventory one-per-cargo, Inspection existence + approve/reject, Release Order money principle, Delivery Order core, Auth/RBAC/permissions foundation, Salary self-contained design.
- **PARTIAL (modify/extend):** Customer 360, Port abbreviation, Voyage (vessel code/fixed departure/P&L), Cargo (amount, shipper/consignee refs, job link), Inspection (status set locked, attachments via common system), Loading List (status lifecycle locked, numbering), Actual Loading (status lifecycle locked, return-to-yard locked, rate confirmation/POD), B/L (ordering locked, party model locked, numbering locked, lifecycle locked, release separation locked, revisions locked, PDF/print), Manifest (ordering locked, parties locked, numbering locked, ManifestItem→B/L item locked, PDF/print), Invoice (Job link locked, line VAT locked, numbering default locked, PDF/print), Quotation/Proforma (line VAT locked, numbering default locked, breakdown), Job (cost categories locked, job→cargo/invoice cardinality locked, creation trigger), Voucher (allocation model locked, advance payments preserved), Ledger (General Journal locked, voucher numbering default locked), Agent Portal (destination-scoped B/L/Release/payment/document views locked).
- **INCORRECT (rework):** Party modeling (Shipper/Consignee/Agent as Customer), B/L↔Manifest ordering, Manifest party model, Invoice header VAT, Voucher single-invoice FK, B/L/Manifest destination numbering not implemented where evidence requires it.
- **MISSING (build):** Shipper master, Consignee master, Agent master, General Journal entries, Document Templates, PDF/Excel/Print generation, Reports/KPIs/P&L/VAT, Audit Log, Document Attachments, Customer 360 page/API.
- **BUSINESS DECISION REQUIRED (do not implement yet):** Release partial-payment/credit policy, Delivery Order exact eligibility rule, B/L void/terminated/cancelled handling beyond locked lifecycle, Inspection final approval policy for FAILED, Proforma/Quotation goods-sale fields, Invoice correction flow, party phone/email ownership, Notifications trigger list/channels/recipients/templates, Archive retention/re-opening policy, PDF/Excel template content and formats, agent extra capabilities beyond locked minimum, VAT taxability/rates.
- **TECHNICAL DESIGN DECISION REQUIRED:** Manifest-level charges/fees (not invented), Voyage cost total computed vs stored (implementation choice), reporting implementation approach, storage provider details for attachments, categorization taxonomy for attachments, audit retention/search scope, stamp/signature visual behavior within document-generation layer.

### Stage 6.5 summary:

22 technical decisions locked:

| # | Decision |
|---|----------|
| 1 | Party model: separate Shipper/Consignee/Agent masters |
| 2 | Cargo: Customer as commercial counterparty + shipperId/consigneeId/jobId |
| 3 | Inspection status lifecycle: PENDING→BOOKED→DONE→FAILED→NEEDS_REINSPECTION |
| 4 | Load List lifecycle: DRAFT→IN_PROGRESS→PARTIALLY_LOADED→COMPLETED→FINALIZED |
| 5 | Actual Loading lifecycle: DRAFT→IN_PROGRESS→PARTIALLY_LOADED→COMPLETED→FINALIZED |
| 6 | B/L lifecycle: DRAFT→IN_REVIEW→APPROVED→FINAL + UNRELEASED/RELEASED |
| 7 | Manifest: downstream of B/L, one voyage per manifest |
| 8 | Vessel model: separate Vessel records, type-constrained tug/barge relations |
| 9 | Numbering: configurable NumberingSequence; Voyage destination-scoped |
| 10 | Invoice/Proforma/Quotation: line-level VAT |
| 11 | Job/Invoice/Cargo: nullable links, one Job → many Invoices/Cargo |
| 12 | Voucher: allocation model (VoucherAllocation) |
| 13 | General Journal: double-entry (Account/JournalEntry/JournalLine) |
| 14 | Release/Delivery: configurable eligibility, auditable |
| 15 | Archive: explicit archive metadata, not deletedAt |
| 16 | Attachments: common FileAttachment infrastructure |
| 17 | Audit Log: append-only |
| 18 | Document generation: PDF (Playwright) + Excel (ExcelJS) |
| 19 | Customer 360: aggregate/read model |
| 20 | Agent Portal: destination-scoped B/L visibility |
| 21 | Notifications: event hooks only, no full system |
| 22 | UI: responsive/mobile-first, neutral palette, later-phase redesign |

## Phase 2 verification summary

- **Migration:** `20260921032600_phase2_master_data_party_model` applied, DB schema up to date
- **Tests:** 8 suites, 66 tests, 0 failures
- **TypeScript:** 0 errors
- **Build:** succeeds
- **API health:** ok, DB up
- **Login:** works
- **Web:** running on :3000
- **Protected files:** preserved (no diffs on `.gitignore`, web messages, page.tsx, globals.css)

### Pre-existing failures (not Phase 2 regressions)

- `voyage.e2e-spec.ts`: 4/13 fail — DB pollution (VOY/00001) + format expectation mismatch (`VOY-YYYY-#####` vs locked `VOY/#####`). Cleaned up VOY/00001 pollution; format expectation is a pre-existing test issue.
