# 07 Final Implementation Roadmap

**Stage 7 complete — rebuilt.** Implementation roadmap derived from `docs/ai-audit/06-final-gap-analysis.md` and frozen by `docs/ai-audit/06.5-technical-decision-lock.md`. There are exactly 9 phases. The roadmap does not invent business rules; where employer decisions remain open, it states the decision dependency explicitly and designs the architecture to be configurable.

## Status legend

- **objective:** why the phase exists
- **scope:** what is included
- **dependencies:** what must exist before this phase
- **affected database models:** schema impact
- **affected API/modules:** backend surface
- **affected UI areas:** frontend surface
- **migration considerations:** data/migration risk
- **tests:** verification approach
- **acceptance criteria:** done means
- **not in scope:** explicit exclusions
- **risks:** what could go wrong

---

## Phase 1 — Safety, Shared Infrastructure & Migration Foundation

**objective:** establish the technical bedrock so later phases can change data models, numbering, audit, attachments, and document generation safely and verifiably.

**scope:**

- database backup strategy and restore verification for local development and migration rehearsal
- migration safety approach: expand/contract pattern where applicable, nullable-first additions, no destructive renames of historical document numbers
- `NumberingSequence` infrastructure: configurable sequences, scope types, prefix/format support, per-module integration points
- `AuditLog` model and append-only writing path
- `FileAttachment` model and storage abstraction: local filesystem adapter for development, S3-compatible adapter interface for production
- `DocumentTemplate` foundation: model shape, versioning concept, active-template selection concept
- shared error/validation conventions across API modules
- test baseline: establish/reinforce e2e and unit patterns that later phases will extend
- data migration strategy document for the whole roadmap
- compatibility strategy for existing Customer party usage during transition

**dependencies:** none beyond the current codebase and database.

**affected database models:** `NumberingSequence`, `AuditLog`, `FileAttachment`, `DocumentTemplate`, plus any shared lookup/config tables needed by these.

**affected API/modules:** numbering service, audit service, attachment service, document-template service, shared validation/error utilities.

**affected UI areas:** none substantive yet; possibly minimal admin views for templates/attachments if needed for later phases.

**migration considerations:** this phase introduces new infrastructure tables only. No historical document numbers are renamed or regenerated. Customer.type deprecation strategy is planned here but executed later.

**tests:**

- numbering sequence creation, scoping, format generation, and uniqueness behavior
- audit log append-only behavior and immutability
- attachment upload/store/retrieve with local adapter
- document template version create/select
- backup/restore rehearsal in a local copy of the database
- migration apply/rollback safety checks for new tables

**acceptance criteria:**

- new infrastructure systems are usable by later phases via service APIs
- audit entries are append-only and not editable through normal CRUD
- attachment storage abstraction supports switching adapters
- numbering defaults match the technical decision lock
- migration plan for the full roadmap is documented and reviewed

**not in scope:**

- business-party model changes
- B/L/Manifest rewrite
- accounting rewrite
- document output for business documents
- UI redesign

**risks:**

- premature coupling of infrastructure to a specific module usage
- under-specifying migration safety for later destructive changes
- building attachment storage without clear access-control hooks

---

## Phase 2 — Master Data & Party Model

**objective:** replace the incorrect Customer-as-party model with correct separate masters and prepare vessel/voyage relations and numbering for operational use.

**scope:**

- `Shipper` master
- `Consignee` master
- `Agent` master
- agent destination relations / `AgentDestination` or equivalent
- Customer cleanup: deprecation of `Customer.type` as the business representation of Shipper/Consignee/Agent
- `Port.abbreviation` and any missing port short-code support
- Yard consistency review and fixes if needed
- Vessel types and type validity
- Voyage primary/tug/barge vessel relations with type constraints
- destination-aware Voyage numbering integration with the locked numbering defaults

**dependencies:** Phase 1 infrastructure, especially `NumberingSequence`.

**affected database models:** `Shipper`, `Consignee`, `Agent`, `AgentDestination`, `Port`, `Yard`, `Vessel`, `Voyage`, and the transition state of `Customer.type`.

**affected API/modules:** shipper, consignee, agent, agent-destination, vessel, voyage, port, yard; Customer transition endpoints if needed.

**affected UI areas:** master-data management pages for Shipper, Consignee, Agent, Vessel, Voyage; Port abbreviation usage in relevant lists/forms.

**migration considerations:**

- adding new party tables is additive and low-risk
- migrating existing B/L/Manifest party FKs away from Customer is the high-risk part and must be planned with compatibility strategy
- Customer.type deprecation must not break existing references until consumers are migrated
- Voyage numbering changes must preserve existing numbers where applicable

**tests:**

- shipper/consignee/agent CRUD and validation
- agent destination association behavior
- vessel type compatibility enforcement for tug/barge relations
- voyage primary/tug/barge relation constraints
- port abbreviation display in relevant UI contexts
- numbering integration for Voyage destination-scoped defaults
- compatibility checks for existing customer references during transition

**acceptance criteria:**

- Shipper, Consignee, Agent exist as separate masters
- Agent supports multiple destination associations
- Customer.type is no longer the business representation of external parties
- Voyage supports primary/tug/barge with type constraints
- Voyage numbering uses destination-scoped defaults
- Port abbreviation is available where load-list/document displays need it

**not in scope:**

- B/L/Manifest party usage (deferred to Phases 4 and 5)
- invoice/accounting changes
- document output
- agent portal visibility (deferred to Phase 8)

**risks:**

- incomplete migration of existing B/L/Manifest party references
- leaving Customer.type half-deprecated and confusing future code
- vessel type enum ambiguity for tug/barge/Landing Craft

---

## Phase 3 — Cargo, Yard, Inspection & Loading Flow

**objective:** make cargo, inspection, load planning, and actual loading consistent with the locked lifecycles and gating rules, and prepare the operational flow for B/L creation.

**scope:**

- Cargo party fields: nullable `shipperId`, `consigneeId`, `jobId`
- Cargo optional `cargoValue`, `cargoValueCurrency`
- cargo status cleanup: remove any forced SELECTED-status assumption; keep selection in LoadListItem
- Inspection lifecycle: `PENDING → BOOKED → DONE → FAILED → NEEDS_REINSPECTION`
- inspection attachments via common attachment system
- inspection DONE as backend prerequisite for loading-list eligibility
- Load List lifecycle: `DRAFT → IN_PROGRESS → PARTIALLY_LOADED → COMPLETED → FINALIZED`
- LoadListItem selection/state ownership
- Actual Loading lifecycle: `DRAFT → IN_PROGRESS → PARTIALLY_LOADED → COMPLETED → FINALIZED`
- NOT_LOADED return-to-yard behavior consistent with existing operational rules
- backend gating between inspection, loading list, and actual loading where required

**dependencies:** Phase 2 party masters (for cargo shipper/consignee), Phase 1 attachment infrastructure.

**affected database models:** `Cargo`, `Inspection`, `LoadList`, `LoadListItem`, `ActualLoading`, `ActualLoadingItem`, `YardInventory`.

**affected API/modules:** cargo, inspection, load-planning, actual-loading, yard-inventory.

**affected UI areas:** cargo intake/form updates for shipper/consignee/job/value; inspection status UI; load-list and actual-loading status UI; yard inventory behavior for return-to-yard.

**migration considerations:**

- adding nullable fields to Cargo is low-risk
- lifecycle status changes may affect existing status values and UI; plan compatibility
- inspection status set changes must not break existing inspections silently
- return-to-yard behavior must be verified against current operational expectations

**tests:**

- cargo shipper/consignee/job/value create/update
- inspection status transitions and DONE gating for load-list eligibility
- inspection attachment upload/association
- load-list lifecycle transitions and item selection behavior
- actual loading lifecycle and not-loaded return-to-yard behavior
- yard inventory consistency after loading activity
- cross-module gating: inspection DONE before load list eligibility

**acceptance criteria:**

- cargo carries shipper/consignee/job/value optionally
- inspection uses locked lifecycle and supports attachments
- load list uses locked lifecycle with item-level selection
- actual loading uses locked lifecycle
- not-loaded cargo returns/re-enters yard inventory as required
- inspection DONE is enforced before loading-list eligibility

**not in scope:**

- B/L creation (Phase 4)
- Manifest (Phase 5)
- invoice/accounting (Phase 6)
- document output (Phase 7)

**risks:**

- status-list incompatibility with existing data or UI
- gating logic that is too tight or too loose relative to real operations
- return-to-yard behavior that conflicts with yard inventory integrity

---

## Phase 4 — B/L Rewrite

**objective:** rebuild Bill of Lading as a standalone document created from finalized/eligible cargo/loading data, with correct party model, destination-aware numbering, locked lifecycle, separated release, and revision/versioning.

**scope:**

- remove Manifest dependency from B/L
- B/L creation from finalized/eligible cargo/loading data
- B/L party model: shipper/consignee from Shipper/Consignee masters; notify party as string/snapshot for now
- destination-aware B/L numbering via locked numbering defaults
- B/L lifecycle: `DRAFT → IN_REVIEW → APPROVED → FINAL`
- release separation: `UNRELEASED / RELEASED` as independent concept
- B/L revisions/versioning so customer-review corrections do not overwrite historical finalized versions
- B/L number assigned at first draft and stable through revisions
- item relation to Cargo with optional provenance references
- document generation hooks for B/L output (template/rendering integration deferred to Phase 7, but hooks and data readiness included here)
- B/L permissions alignment

**dependencies:** Phases 1–3, especially party masters, cargo party fields, inspection gating, loading flow, numbering infrastructure.

**affected database models:** `BillOfLading`, `BillOfLadingItem`, `BillOfLadingRevision` or equivalent versioning model, related release logic.

**affected API/modules:** bill-of-lading module rewrite; release eligibility interaction; numbering integration; attachment/document hooks.

**affected UI areas:** B/L create/edit/workflow UI, B/L list/detail, revision history, release status display, party selection from masters.

**migration considerations:**

- this is a major controlled rewrite
- existing B/L behavior and data must be mapped to new model carefully
- remove Manifest dependency without losing necessary traceability
- preserve historical document numbers; do not rename/regenerate
- release state must be separated cleanly from document production state
- revision model must not break existing references unintentionally

**tests:**

- B/L creation from eligible cargo/loading without Manifest dependency
- party selection from Shipper/Consignee masters
- destination-aware numbering assignment at first draft
- lifecycle transitions through DRAFT → IN_REVIEW → APPROVED → FINAL
- release as independent state
- revision creation and historical preservation
- number stability through revisions
- item relation to Cargo
- eligibility gating from inspection/loading where applicable
- permissions for B/L operations
- migration compatibility for existing B/L data

**acceptance criteria:**

- B/L no longer depends on Manifest
- B/L uses Shipper/Consignee masters
- B/L numbering is destination-scoped by default
- B/L lifecycle matches lock
- release is independent
- revisions preserve historical finalized versions
- B/L number is stable from first draft
- B/L data is ready for document generation hooks

**not in scope:**

- Manifest (Phase 5)
- invoice/accounting (Phase 6)
- full document PDF/Excel output (Phase 7)
- agent portal (Phase 8)

**risks:**

- incomplete removal of Manifest dependency
- revision model complexity causing data integrity issues
- numbering integration bugs during transition
- release-state confusion with document-production state

---

## Phase 5 — Manifest & Voyage Operational Flow

**objective:** make Manifest a downstream consolidation of finalized/issued B/Ls with correct multi-party rows, voyage linkage, tug/barge display, destination-aware numbering, and actual-loading traceability.

**scope:**

- Manifest creation from finalized/issued B/Ls only
- `ManifestItem` directly references source `BillOfLadingItem`
- optional cargo provenance/reference
- optional ActualLoading provenance/reference for traceability
- multiple shipper/consignee rows across manifest items
- voyage linkage: one Manifest per Voyage where current constraint is still valid
- tug/barge display via Voyage vessel relations
- destination-aware Manifest numbering via locked defaults
- actual-loading traceability where useful
- Manifest document output readiness (hooks/data), full rendering deferred to Phase 7
- Manifest permissions alignment

**dependencies:** Phase 4 (B/L and B/L items), Phase 2 (vessel/voyage relations), Phase 1 (numbering).

**affected database models:** `Manifest`, `ManifestItem`, relationships to `BillOfLadingItem`, `Voyage`, and optional provenance references.

**affected API/modules:** manifest module rewrite; B/L eligibility/issuance integration; voyage display integration.

**affected UI areas:** manifest create/consolidate UI from B/Ls, manifest list/detail, multi-party row display, voyage/tug/barge display, numbering display.

**migration considerations:**

- switch Manifest creation from Cargo/LoadList to B/L-based consolidation
- migrate/adapt existing manifest data model to new source-of-truth without losing necessary history
- preserve historical manifest numbers
- ensure one-manifest-per-voyage constraint is intentionally preserved or revised with evidence, not assumed

**tests:**

- manifest created from finalized/issued B/Ls
- ManifestItem → BillOfLadingItem reference integrity
- multiple shippers/consignees across items
- voyage linkage and one-per-voyage behavior where applicable
- tug/barge display from voyage vessel relations
- destination-aware manifest numbering
- actual-loading provenance traceability where used
- permissions for manifest operations
- migration compatibility for existing manifest data

**acceptance criteria:**

- Manifest is downstream of B/L
- ManifestItem references BillOfLadingItem
- manifest supports multiple shippers/consignees across items
- voyage linkage works with tug/barge display
- manifest numbering is destination-scoped by default
- actual-loading traceability is available where needed

**not in scope:**

- invoice/accounting (Phase 6)
- full document output rendering (Phase 7)
- agent portal (Phase 8)
- inventing manifest charges/fees

**risks:**

- B/L-first consolidation logic being incomplete or incorrect
- losing traceability when switching source-of-truth
- over-adding manifest charges/fees without evidence
- one-manifest-per-voyage constraint being kept or changed without explicit decision

---

## Phase 6 — Commercial, Job & Accounting

**objective:** connect commercial documents to jobs, fix VAT and numbering defaults, implement voucher allocation and General Journal, and make ledger/accounting report-ready.

**scope:**

- Job enhancements: cost categories supporting at least repair, customs, crane, lowbed, transport, port, vessel, miscellaneous
- `Invoice.jobId` nullable; one Job → many Invoices
- `Cargo.jobId` nullable; one Job → many Cargo
- per-line VAT on Invoice: `vatRate`, `vatAmount` on lines
- same line-level VAT infrastructure for Proforma and Quotation; default VAT to zero unless configured
- invoice numbering baseline: global company/year sequence by default
- proforma numbering baseline: global company/year sequence by default
- quotation numbering baseline: global company/year sequence by default
- `VoucherAllocation`: `voucherId`, `invoiceId`, `allocatedAmount`
- voucher may pay one invoice, multiple invoices, or carry unallocated/advance remainder
- invoice paid amount derived from allocations
- General Journal: `Account`, `JournalEntry`, `JournalLine`
- ledger recalculation/alignment with allocation and journal model
- release/delivery payment rules aligned with locked configurability and auditability
- payment audit trail via AuditLog
- accounting reports groundwork (data readiness, not necessarily full UI)

**dependencies:** Phases 1–5, especially party masters, B/L, Manifest, Cargo, Job, numbering, attachments.

**affected database models:** `Job`, `JobCostItem`, `Invoice`, `InvoiceItem`, `Proforma`, `ProformaItem`, `Quotation`, `QuotationItem`, `Voucher`, `VoucherAllocation`, `Account`, `JournalEntry`, `JournalLine`, `Ledger`/ledger derivation logic.

**affected API/modules:** job, invoice, proforma, quotation, voucher, ledger, general-journal, release, delivery, accounting reports groundwork.

**affected UI areas:** invoice/proforma/quotation create/edit with line VAT, job linking, voucher allocation UI, journal entry UI, ledger view updates, release/delivery payment status display.

**migration considerations:**

- line-level VAT migration must preserve monetary correctness
- voucher single-FK to allocation migration is high-risk and must preserve payment history
- invoice/cargo job linking is additive and nullable; low-risk
- numbering defaults must be implemented without renaming historical numbers
- ledger derivation must be revalidated after voucher and journal changes

**tests:**

- invoice line VAT calculation and totals
- proforma/quotation line VAT infrastructure consistency
- invoice→job linking and one-job-many-invoices behavior
- cargo→job linking and one-job-many-cargo behavior
- voucher allocation create/edit/derived paid amount
- advance payment / unallocated remainder handling
- journal entry debit/credit balance rules
- ledger alignment with allocations and journal entries
- numbering defaults for invoice/proforma/quotation/voucher
- release/delivery payment audit trail
- accounting report data readiness

**acceptance criteria:**

- invoice VAT is line-level
- proforma/quotation use same line-level VAT infrastructure with default zero
- invoice and cargo can link to job optionally
- one job can have many invoices and many cargo
- voucher allocation supports one/multiple/unallocated-advance cases
- invoice paid amount is derived from allocations
- General Journal double-entry infrastructure exists
- ledger is consistent with new allocation/journal model
- numbering defaults match lock
- release/delivery payments are auditable

**not in scope:**

- full PDF/Excel document output (Phase 7)
- VAT taxability/rates business rules (business decision)
- invoice correction flow (business decision)
- agent portal (Phase 8)
- Customer 360 (Phase 8)

**risks:**

- VAT migration corrupting financial totals
- voucher allocation migration losing payment traceability
- ledger derivation inconsistencies after refactoring
- premature business rule assumptions about taxable services or correction flows

---

## Phase 7 — Document Engine, Archive & Business Documents

**objective:** deliver the document generation, template management, archive metadata, and attachment UX needed to output and manage business documents correctly.

**scope:**

- template management: `DocumentTemplate` versioning and active-template selection
- uploaded company templates versioned and identifiable by document type
- PDF rendering via HTML/CSS templates + Playwright
- Excel rendering via XLSX templates + ExcelJS
- digital stamp/signature support through document-generation layer
- document outputs for: B/L, Manifest, Invoice, Proforma, Quotation, Voucher/Payment, Ledger, Release Order, Delivery Order, Salary, Letter
- archive metadata: `archivedAt`, `archivedBy` on relevant document/business records
- final documents become immutable
- archived records searchable/viewable by permissions
- attachment UX and access controls for inspection photos, payment ID documents, signatures, source documents, B/L attachments, other business documents
- local filesystem adapter for development; S3-compatible adapter for production

**dependencies:** Phases 1–6, especially document-template foundation, attachment infrastructure, B/L/Manifest/Invoice/Proforma/Quotation/Voucher/Ledger/Release/Delivery/Salary/Letter data readiness.

**affected database models:** `DocumentTemplate`, `DocumentTemplateVersion` or equivalent, archive metadata fields on relevant entities, `FileAttachment` usage across modules.

**affected API/modules:** document generation service, template service, archive service/actions, attachment access control, per-document output endpoints.

**affected UI areas:** template management UI, document preview/download/print UI, archive view/actions, attachment upload/view UI for relevant modules.

**migration considerations:**

- archive metadata addition is additive
- immutability rules must be applied carefully to finalized documents
- template migration/import strategy for existing company templates if any
- storage adapter selection must be configurable per environment

**tests:**

- template create/version/select by document type
- PDF render from HTML/CSS template
- Excel render from XLSX template
- digital stamp/signature placement through generation layer
- document output for each supported document type
- archive action records metadata and enforces immutability for final documents
- archived records remain searchable/viewable by permissions
- attachment upload/retrieve with access control
- storage adapter swap in test/CI where applicable

**acceptance criteria:**

- templates are versioned and selectable by document type
- PDF and Excel outputs render for the required document types
- digital stamp/signature is supported in the generation layer
- archive metadata is recorded and final documents are immutable
- archived records remain viewable/searchable by permissions
- attachments support the listed business uses with access control

**not in scope:**

- business-specific template wording not in evidence
- retention policy invention
- full report UI (Phase 8)

**risks:**

- template rendering becoming a bottleneck or brittle
- stamp/signature behavior being specified too narrowly
- archive immutability conflicting with legitimate correction workflows
- attachment access control being under-specified

---

## Phase 8 — Customer 360, Agent Portal & Reporting

**objective:** deliver the aggregate customer view, destination-scoped agent portal visibility, and the required business reports.

**scope:**

- Customer 360 aggregate/read model: customer overview, jobs, cargo, B/Ls, invoices, payments/vouchers, ledger, balance, comments/activity
- dashboard KPIs for customers and relevant operations
- Agent Portal destination-scoped B/L visibility: B/L list, B/L detail, payment status, release status, allowed documents, document download
- backend enforcement of agent destination scope
- Voyage/Vessel P&L report
- Manifest report
- Cost report
- VAT report
- tax/year report
- report export formats as applicable

**dependencies:** Phases 1–7, especially customer relations, job/invoice/cargo linkage, voucher allocation, ledger, B/L/Manifest, document output, audit/attachment.

**affected database models:** Customer 360 read model/endpoint across customer, job, cargo, B/L, invoice, voucher, ledger; report data sources; agent portal visibility filters.

**affected API/modules:** customer 360 endpoint, customer KPIs, agent portal B/L/visibility API, release/payment status exposure, document download API, report services.

**affected UI areas:** customer 360 profile page, dashboard KPI widgets, agent portal B/L list/detail/release/payment/document views, report pages/exports.

**migration considerations:**

- Customer 360 is a read model; no new transactional table duplication
- agent portal visibility must be enforced in backend authorization; frontend filtering alone is insufficient
- report data sources must be stable before UI investment

**tests:**

- customer 360 aggregates customer overview, jobs, cargo, B/Ls, invoices, payments/vouchers, ledger, balance, comments/activity
- customer KPIs reflect balance, open invoices, payment status as applicable
- agent B/L list scoped to agent destination
- agent B/L detail, payment status, release status, allowed documents, document download
- backend authorization rejects out-of-scope agent access
- Voyage/Vessel P&L report data correctness
- Manifest report, cost report, VAT report, tax/year report data correctness
- report export formats where applicable

**acceptance criteria:**

- Customer 360 shows the required aggregate data without duplicating transactional tables
- dashboard KPIs are live and useful
- agent portal shows destination-scoped B/L visibility and document access with backend enforcement
- required reports exist with correct data sources
- VAT/tax/year reporting is available as data/report output

**not in scope:**

- agent extra capabilities beyond locked minimum
- full notification system
- UI redesign (Phase 9)
- business decisions on VAT taxability/rates

**risks:**

- customer 360 performance if aggregation is unoptimized
- agent scoping bugs allowing cross-destination access
- report data sources being incomplete because earlier phases deferred accounting details
- report phrasing/content being treated as finalized when it is not

---

## Phase 9 — UX Redesign, Integration, E2E & UAT

**objective:** stabilize the visual system, harden cross-module workflows, and prepare the system for production use through comprehensive testing and UAT readiness.

**scope:**

- responsive/mobile-first UX
- collapsible sidebar
- neutral/grey visual system
- restrained gradients
- polished cards, tables, forms
- clear status indicators
- accessibility improvements
- comprehensive E2E coverage across modules
- cross-module workflow tests: cargo → inspection → load list → actual loading → B/L → manifest → invoice → voucher → release/delivery
- document-output tests: PDF/Excel rendering and template selection
- permission/security tests: role/permission coverage, agent destination scoping, audit immutability
- migration verification: apply/rollback safety, historical number preservation, data integrity
- UAT checklist
- production readiness checklist

**dependencies:** Phases 1–8 functionally complete enough to stabilize and test end-to-end.

**affected database models:** no new business models required; verification focuses on existing and newly built models.

**affected API/modules:** all modules; emphasis on workflow APIs, document output APIs, auth/permission/audit paths.

**affected UI areas:** global layout, sidebar, design tokens, component polish, status indicators, responsive behavior, accessibility.

**migration considerations:**

- verify that historical document numbers are preserved
- verify migration safety for all schema changes made in Phases 1–8
- verify backward compatibility where Customer.type transition or other deprecations were involved

**tests:**

- cross-module workflow E2E tests
- document output rendering tests
- permission/security tests including agent scoping
- audit log immutability tests
- migration apply/rollback and data-integrity checks
- responsive and accessibility checks
- UAT checklist walkthrough
- production readiness checklist walkthrough

**acceptance criteria:**

- UI direction from the technical decision lock is implemented
- core cross-module workflows are covered by E2E tests
- document outputs are tested
- permission/security behavior is verified
- migration safety and historical data integrity are verified
- UAT and production readiness checklists are complete

**not in scope:**

- adding new business modules not already in Phases 1–8
- inventing new business rules
- changing locked technical decisions without an explicit decision record

**risks:**

- UI polish scope creeping into ongoing feature work
- E2E coverage gaps leaving workflow bugs undetected
- migration verification being incomplete because earlier phases were not repaid

---

## Roadmap principles

1. **No invented business rules.** Where employer decisions are open, the architecture is made configurable and the decision dependency is stated.
2. **Locked technical decisions prevail.** The technical decision lock is the baseline; deviations require an explicit decision record attached to the phase.
3. **Historical document numbers are preserved.** No renaming/regeneration of existing numbers during migration.
4. **Security is backend-enforced.** Especially agent destination scoping and audit immutability.
5. **Document output is separate from document data.** Data readiness can be phased before rendering polish.
6. **UI redesign is late.** Visual stabilization happens after domain models and workflows are stable.

---

## Completion record

- Roadmap document: `docs/ai-audit/07-final-implementation-roadmap.md`
- Status: ✅ COMPLETE — REBUILT
- Phases: 9
- Written: 2026-09-21
- No application code changed.
- No database changed.
- No migrations run.
- No UI changed.
