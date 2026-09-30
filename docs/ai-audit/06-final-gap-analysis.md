# 06 Final Gap Analysis

**Stage 6 complete — revised.** Final reconciliation of employer requirements (Stage 1) + business document evidence (Stage 2) against current dashboard implementation (Stages 3–4), with technical decisions locked in `docs/ai-audit/06.5-technical-decision-lock.md` and prior-work findings (Stage 5) used only as background.

This version is fully consistent with the technical decision lock. Numbering is corrected: only B/L and Manifest destination-scoped numbering is confirmed by evidence. Invoice/Proforma/Quotation numbering is NOT confirmed as destination-based. Voyage numbering is destination-scoped per employer discussion; exact display format is a technical choice. Customer code is global sequential. Voucher numbering is configurable/global by default. Tug/Barge are separate Vessel records linked to Voyage — a technical design decision, not an unresolved blocker. Job↔️Invoice and Job↔️Cargo cardinality is frozen as one Job → many Invoices / many Cargo, with nullable links. B/L lifecycle is frozen as DRAFT → IN_REVIEW → APPROVED → FINAL with separate RELEASED/UNRELEASED. Business uncertainty is kept only where it genuinely affects future policy.

## 1. Classification Legend

| Tag | Meaning |
|-----|---------|
| CORRECT | Current implementation satisfies the confirmed employer requirement. Keep as-is. |
| PARTIAL | Implementation exists and is useful, but is incomplete vs the confirmed requirement. Modify/extend. |
| INCORRECT | Implementation exists but conflicts with a confirmed employer requirement. Rework. |
| MISSING | No meaningful implementation exists for a confirmed requirement. Build. |
| BUSINESS DECISION REQUIRED | The business rule is not sufficiently specified to implement safely. Flag and wait. |
| TECHNICAL DESIGN DECISION REQUIRED | The business requirement is clear, but the exact engineering/data-model solution still needs design. |

## 2. Current Dashboard Baseline (from Stages 3–4)

- **Stack:** pnpm monorepo, NestJS `/api/v1`, Next.js 14 App Router, Prisma + PostgreSQL.
- **Implemented modules:** ports, yards, customers, cargo, yard-inventory, inspections, vessels, voyages, load-planning, actual-loading, manifest, bill-of-lading, invoice, proforma, quotation, voucher, ledger, delivery-release, discharge, employee, salary, letter, job, portal.
- **Key structural facts:**
  - Customer is the only "party" master. `Customer.type` carries SHIPPER / CONSIGNEE / AGENT values.
  - B/L and Manifest reference `Customer` for shipper/consignee/agent.
  - Manifest is created from Cargo/LoadList (not from B/Ls).
  - B/L is created against a Manifest.
  - Voucher has a single `invoiceId` FK.
  - Invoice tax is a single header-level `taxRate`/`taxAmount`.
  - Numbering is per-module; current code uses global-style numbering without implemented destination prefix.
  - Agent Portal exposes bookings + shipments + statement + ports (no B/L/document view for the agent).

## 3. Employer Requirement Baseline (from Stages 1–2)

- Customer is the internal commercial counterparty; **Shipper, Consignee, Agent are separate** from Customer.
- B/L is made from finalized cargo/loading; **B/L → Manifest** (Manifest consolidates issued B/Ls), not the reverse.
- Manifest has **one Voyage**, multiple B/Ls, and **multiple shippers/consignees** across items.
- Tug and Barge are separate entities in the manifest evidence.
- Invoice is linked to a Job.
- Payment/voucher can cover **multiple invoices** (Agst Ref).
- Invoice VAT appears per-line in the evidence.
- Release Order requires payment conditions met ("no money, no cargo").
- Agent Portal must show B/L, Release status, payment status, document access for their destination — not just bookings.
- Reports required: Voyage/Vessel P&L, Manifest, cost, VAT (monthly/quarterly/yearly), tax/year.
- Templates required for many document types with PDF/Excel output and uploaded templates.
- General Journal exists for non-invoice transactions.
- Numbering evidence shows per-destination prefixes (`KHS/`, `DSMAN/KHO-`) for B/L and Manifest.

## 4. Domain-by-Domain Classification

### 4.1 Customer and parties

- **Customer (master):** PARTIAL. Core CRUD exists; `Customer.type` is the wrong abstraction for external parties. Customer 360 page/API is missing.
  - Correct: Customer has the right relations for a commercial counterparty.
  - Incomplete: no aggregated 360 view, no customer-facing KPIs (balance, open invoices, payment status), no activity/comment timeline.
  - Missing: dedicated customer 360 page and backend endpoint.
  - Technical decision: how much of 360 is a single API endpoint vs composed views.
- **Shipper:** INCORRECT (current modeling) / MISSING (as separate master). Customer is used as shipper. Manifest sample requires multiple shippers per manifest; current header-only `Manifest.shipperId` cannot represent that.
  - Rework: introduce Shipper master; decouple B/L.shipperId and Manifest items from Customer.
  - Decision: header-level shipper on Manifest vs item-level only — keep both only if evidence supports it.
- **Consignee:** INCORRECT / MISSING — same pattern as Shipper.
- **Agent:** INCORRECT / MISSING — Customer.type=AGENT is not the employer's Agent concept. Destination scoping is confirmed; exact relations now locked as multiple destination associations through a relation such as AgentPort/AgentDestination.
- **Party phone/email ownership:** BUSINESS DECISION REQUIRED — whose phone/email fields belong on Shipper/Consignee/Agent vs shared contact model is not fully specified.

### 4.2 Ports and yards

- **Port:** CORRECT in structure (code/name/country/city); PARTIAL on `abbreviation` (employer wants short codes like HAM on load lists).
- **Yard:** CORRECT (belongs to Port; selecting Port filters Yards). Fine as-is.
- **Port→Yard filter:** CORRECT and implemented.

### 4.3 Vessels and voyages

- **Vessel:** CORRECT (asset model exists).
- **Voyage:** PARTIAL. Voyage model exists and the B/L→Voyage link is right, but:
  - Missing: per-voyage vessel code/identifier as shown on documents.
  - Missing: fixed departure date semantics (current schedule model is more house-schedule-oriented).
  - Missing: voyage cost/revenue tracking for P&L.
  - Technical decision: Voyage.costTotal computed vs stored — now resolved by lock as implementation choice.
  - Business decision: voyage numbering exact display format remains a technical implementation choice; destination-scoped numbering is locked.
- **Tug/Barge/Vessel:** TECHNICAL DESIGN DECISION now LOCKED. Separate Vessel records with type-constrained tug/barge relations to Voyage. Not separate master tables. Not an unresolved business blocker.

### 4.4 Cargo and yard flow

- **Cargo:** CORRECT core (customer-linked, full audit trail), PARTIAL on details.
  - Missing: explicit cargo amount/value field now locked as optional `cargoValue`/`cargoValueCurrency`.
  - Incomplete: cargo→shipper/consignee references for B/L generation (currently uses Customer) — now locked as nullable shipperId/consigneeId.
  - Job link: now locked as nullable `jobId`.
  - YardInventory: CORRECT (one record per cargo). Fine.
- **Yard flow (in→inventory→out):** CORRECT foundation; specifics of return-to-yard and yard exit gating depend on Actual Loading behavior (see 4.6).

### 4.5 Inspection

- PARTIAL.
  - Correct: Inspection exists, linked to cargo, with approve/reject and ledger-style history.
  - Incomplete: status model now locked as PENDING → BOOKED → DONE → FAILED → NEEDS_REINSPECTION.
  - Missing: photo/document attachments on inspection results — now covered by locked attachment system.
  - Business rule confirmed: Inspection DONE is prerequisite for Loading List.
  - Business decision: final approval policy for FAILED and whether NEEDS_REINSPECTION is a distinct workflow state vs derived status.

### 4.6 Loading List and Actual Loading

- **Loading List:** PARTIAL.
  - Correct: collection-of-cargo concept exists; per-item selection exists; draft→finalize flow exists.
  - Lifecycle now locked: DRAFT → IN_PROGRESS → PARTIALLY_LOADED → COMPLETED → FINALIZED.
  - Selection belongs to individual LoadListItems.
  - Numbering not destination-aware.
  - Technical decision: how Loading List finalizes into B/L preparation.
- **Actual Loading:** PARTIAL.
  - Correct: list/rate view and cargo loading recorded.
  - Lifecycle now locked: DRAFT → IN_PROGRESS → PARTIALLY_LOADED → COMPLETED → FINALIZED.
  - Not-loaded cargo must remain/re-enter Yard Inventory according to existing operational behavior — locked.
  - Incomplete: rate confirmation flow, POD document upload.
  - Business decision: exact rate-confirmation workflow and POD requirements.

### 4.7 B/L

- INCORRECT in several ways; PARTIAL in others.
  - Incorrect: B/L is currently created against Manifest. Employer requires B/L prepared from finalized cargo/loading, then Manifest consolidates issued B/Ls. Rework the ordering — now locked.
  - Incorrect: shipper/consignee on B/L are Customer FKs — must become Shipper/Consignee masters — now locked.
  - Incorrect: numbering is not per-destination (evidence shows `KHS/...`) — now locked as destination-scoped default.
  - Incorrect: B/L PDF/print and formal document output are not implemented.
  - Incomplete: inspection-done gating into B/L preparation needs wiring.
  - Lifecycle now locked: DRAFT → IN_REVIEW → APPROVED → FINAL, with separate UNRELEASED/RELEASED.
  - Release and document production are locked as separate concepts.
  - Number assigned at first draft and stable through revisions — locked.
  - Revisions/versioning now required so customer-review corrections do not overwrite finalized versions — locked.
  - Business decision: B/L status values for Void/Terminated/Cancelled scenarios beyond the locked lifecycle.
  - Technical decision: how B/L items relate to Cargo — now resolved as item relation to Cargo with optional ManifestItem provenance.

### 4.8 Manifest

- INCORRECT in ordering and parties; PARTIAL in structure.
  - Incorrect: Manifest is currently created from Cargo/LoadList. Employer requires Manifest assembled from issued B/Ls — now locked.
  - Incorrect: Manifest header shipper/consignee/agent are Customer FKs; manifest items also reference Customer. Evidence: one manifest has 12+ shippers/consignees. Must move to Shipper/Consignee/Agent masters on items — now locked.
  - Incorrect: numbering not per-destination (evidence: `DSMAN/KHO-...`) — now locked as destination-scoped default.
  - Missing: manifest PDF/print output.
  - Missing: manifest-level port/fee fields if employer wants manifest-specific charges (not confirmed).
  - Technical decision now locked: ManifestItem directly references source BillOfLadingItem, with optional cargo and ActualLoading provenance.
  - Business decision: manifest numbering scheme and whether manifest has its own destination/port beyond voyage.
  - Do not claim multiple Agents per Manifest unless evidence proves that. Shippers/Consignees can be multiple across a Manifest.

### 4.9 Quotation / Proforma / Invoice

- **Quotation:** PARTIAL / TECHNICAL DECISION.
  - Correct: quote lifecycle and convert-to-proforma exist.
  - Incomplete: header VAT vs line VAT — now locked as line-level VAT infrastructure with VAT defaulting to zero unless configured.
  - Numbering: NOT confirmed as destination-based. Locked as global company/year sequence by default.
  - Goods/services breakdown structure not fully aligned to document evidence.
  - Business decision: Proforma/Quotation goods-sale fields and which line attributes are required.
- **Proforma:** PARTIAL / TECHNICAL DECISION. Same VAT/numbering/structure concerns as Quotation. Convert-to-Invoice exists. Line-level VAT locked. Numbering locked as global company/year default.
- **Invoice:** INCORRECT / PARTIAL.
  - Incorrect: header-level VAT (evidence shows per-line VAT) — now locked as line-level.
  - Incorrect/missing: no Job link — now locked as nullable `jobId`.
  - Numbering: NOT confirmed as destination-based. Locked as global company/year sequence by default.
  - Missing: PDF/print output.
  - Business decision: invoice correction flow (Credit Note vs Cancel+New).
  - Technical decision: invoice→job cardinality now locked as one Job → many Invoices, with Invoice.jobId nullable.

### 4.10 Job / Accounting / Ledger / Payments

- **Job:** PARTIAL.
  - Correct: Job + JobCostItem exist; lifecycle exists.
  - Incomplete: no cost tracking fully tied to voyage/revenue; no actual vessel/voyage serving field confirmed; no auto/manual job creation trigger finalized; multi-party/job-sharing not modeled.
  - Job cost categories now locked to support at least: repair, customs, crane, lowbed, transport, port, vessel, miscellaneous.
  - Business decision: what event creates a Job; full cost-category list and direct/indirect classification.
  - Technical decision: job→cargo cardinality now locked as one Job → many Cargo, with Cargo.jobId nullable.
- **Voucher/Payment:** INCORRECT (single invoice FK) / PARTIAL.
  - Incorrect: Voucher.invoiceId is a single FK; ledger evidence shows one receipt covering multiple invoices — now locked for replacement with VoucherAllocation.
  - Allocation model: voucherId, invoiceId, allocatedAmount; supports one invoice, multiple invoices, and unallocated/advance remainder — locked.
  - Invoice paid amount must be derived from allocations — locked.
  - Missing: General Journal entries for non-invoice transactions — now locked as Account/JournalEntry/JournalLine.
  - Missing: payment-side PDF/print and attachments (ID docs, signature, scan).
  - Business decision: advance payment handling and multi-invoice allocation rules.
- **Ledger:** PARTIAL.
  - Correct: derived ledger statement per customer exists.
  - Incomplete: General Journal missing, so non-invoice entries cannot be posted — now locked.
  - Voucher numbering scheme: now locked as configurable/global by default.
  - Business decision: whether ledger needs stored entries vs only derived.

### 4.11 Release / Delivery

- **Release Order:** CORRECT core (money-before-release principle implemented).
  - Locked: technical implementation must support paid/partial/unpaid/override-credit scenarios without hard-coding final employer policy.
  - Release eligibility must be configurable — locked.
  - Release must remain auditable: who, when, reason, override if applicable — locked.
  - Incomplete: exact release conditions, overrides, and approver rules not fully specified.
  - Business decision: release conditions beyond "payment met", and whether credit/overrides exist.
- **Delivery Order:** CORRECT core.
  - Locked: DO must have its own eligibility rule and must not automatically inherit an invented credit rule.
  - Incomplete: exact DO trigger rule.
  - Business decision: precise DO eligibility rule.

### 4.12 Agent Portal

- INCORRECT in scope; PARTIAL in foundation.
  - Incorrect: currently bookings-focused. Employer requires B/L view, Release status, payment status, document access for the agent's destination.
  - Correct: destination scoping concept exists; BookingRequest model exists.
  - Locked minimum agent visibility: B/L list, B/L detail, payment status, Release status, allowed documents, document download.
  - Locked: enforce destination scope in backend authorization, not only frontend filtering.
  - Missing: agent B/L list (filtered by destination), B/L detail view, Release status per B/L, payment status per B/L, document download/print.
  - Business decision: exact agent capabilities and whether agents also see Manifest/cargo.
  - Technical decision: how agent destination scope is enforced across modules — now locked as backend authorization.

### 4.13 Reports / P&L / VAT

- MISSING (as implemented reports).
  - Confirmed required: Vessel/Voyage P&L, Manifest reports, Cost reports, VAT reports (monthly/quarterly/yearly), tax/year reporting.
  - Missing: P&L requires voyage cost/revenue data which is not fully modeled yet.
  - Business decision: VAT report scope, taxable services, rate, line vs summary reporting.
  - Technical decision: reporting implementation approach (API aggregation, dedicated report service, export formats).

### 4.14 Documents / Templates / Archive

- **Templates:** MISSING in implementation. ADR-designed but not built. Employer wants: Loading List, B/L, Manifest, Invoice, Proforma, Quotation, Receipt, Payment, Ledger, Release Order, Delivery Order, Salary Slip, Letters — PDF/Excel, uploaded templates, digital stamp/signature, physical print behavior.
  - Locked: PDF via HTML/CSS + Playwright; Excel via XLSX + ExcelJS; DocumentTemplate model with versioning and active-template selection; uploaded company templates versioned and identifiable by document type; digital stamp/signature through document-generation layer.
  - Business decision: which documents have company templates and their formats.
  - Business decision: exact template content/wording not in evidence — do not invent.
- **Archive:** PARTIAL / BUSINESS DECISION.
  - Correct: Archive concept acknowledged in workflows.
  - Locked: do not treat deletedAt as archive; use explicit archive metadata (archivedAt, archivedBy); final documents become immutable; archived records remain searchable/viewable by permissions; do not invent retention periods.
  - Business decision: what gets archived, when, retention, and re-opening rules.

### 4.15 Users / Roles / Permissions / Audit

- **Auth/RBAC:** CORRECT foundation (JWT+refresh, permissions guard, seeded registry).
- **Permissions:** CORRECT and extensive (147 seeded). Fine.
- **Audit log:** MISSING in implementation (ADR-designed only).
  - Locked: append-only AuditLog; audit at least create, update, delete, status transitions, approval, finalization, release/unrelease, payment allocation, document generation, archive actions, permission/security-sensitive events; not editable through normal CRUD.

### 4.16 Notifications

- BUSINESS DECISION REQUIRED / PARTIAL.
  - Locked: do not implement full notification system yet; only create architectural event hooks where useful.
  - Unclear: trigger list, channels (in-app/email/SMS), templates, recipients.
  - Not enough evidence to mark as fully specified.

## 5. Numbering — sensitive re-check

- Evidence shows per-destination prefixes (`KHS/`, `DSMAN/KHO-`), not a single global sequence.
- Current implementation uses global-style numbering per module.
- Classification:
  - B/L numbering: INCORRECT vs evidence (needs destination prefix) — locked as destination-scoped default.
  - Manifest numbering: INCORRECT vs evidence — locked as destination-scoped default.
  - Voyage numbering: destination-scoped per employer discussion; exact display format is a technical implementation choice — locked.
  - Invoice/Proforma/Quotation numbering: NOT confirmed as destination-based. Locked as global company/year sequence by default. Evidence shows prefix-style formats but does not prove destination-scoped numbering for these documents.
  - Customer code: global sequential — locked.
  - Voucher numbering: configurable/global by default — locked.
- Do not assume global numbering is acceptable anywhere it conflicts with evidence.

## 6. Release — sensitive re-check

- Confirmed principle: Release requires payment conditions met ("no money, no cargo").
- Current R/O eligibility logic aligns with this principle.
- Locked: release must support paid/partial/unpaid/override-credit scenarios; eligibility configurable; auditable who/when/reason/override.
- Unresolved:
  - Exact release conditions beyond payment status.
  - Whether credit/overrides exist and who approves them.
  - Whether R/O credit factoring affects Delivery Order.
- Classification: CORRECT principle, PARTIAL exact rules, BUSINESS DECISION on overrides.

## 7. Manifest — sensitive re-check

- Confirmed: B/L-first; Manifest consolidates issued B/Ls; multiple B/Ls per manifest; multiple shippers/consignees per manifest.
- Current implementation: Manifest-first from cargo; parties as Customer FKs. This is the reverse of employer flow.
- Classification: INCORRECT ordering and parties.
- Locked: ManifestItem directly references BillOfLadingItem; optional cargo/ActualLoading provenance; one Voyage per Manifest.
- Do not invent the technical relation between Manifest and B/L — it is now locked as direct BillOfLadingItem reference.

## 8. Agent — sensitive re-check

- Confirmed: destination scoping; agent sees B/L, Release, payment, documents for their destination.
- Current: bookings-focused.
- Classification: INCORRECT scope; destination scoping foundation is CORRECT.
- Locked: backend enforcement of destination scope; minimum visibility defined; extra capabilities remain business decision.

## 9. Job / Invoice — sensitive re-check

- Confirmed: Invoice linked to Job; Job collects costs.
- Current: no invoice→job link; Job exists separately.
- Locked: one Job → many Invoices; one Job → many Cargo; Invoice.jobId nullable; Cargo.jobId nullable.
- Classification: MISSING linkage; PARTIAL Job model; cardinality now locked.

## 10. B/L lifecycle — sensitive re-check

- Confirmed distinction: document production status vs release status are different concepts.
- Locked lifecycle: DRAFT → IN_REVIEW → APPROVED → FINAL; separate RELEASED/UNRELEASED.
- Number assigned at first draft and stable through revisions — locked.
- Revisions/versioning required — locked.
- Current: B/L lifecycle exists but is built against Manifest, not against the employer flow.
- Classification: lifecycle concept PARTIAL/correct in spirit; ordering INCORRECT; lifecycle names no longer a blocking business decision (locked).

## 11. Notifications — sensitive re-check

- Not enough evidence to treat as fully specified.
- Locked: no full notification system; event hooks only.
- Classification: BUSINESS DECISION REQUIRED.

## 12. Archive — sensitive re-check

- Concept confirmed in document/workflow evidence.
- Policy/implementation not specified.
- Locked: explicit archive metadata, immutability for final documents, searchable by permissions, no invented retention periods.
- Classification: concept CORRECT; implementation MISSING; exact policy BUSINESS DECISION REQUIRED.

## 13. Summary by classification

- **CORRECT (keep):** Port structure, Yard/Port filter, Vessel asset model, Cargo customer link, YardInventory one-per-cargo, Inspection existence + approve/reject, Release Order money principle, Delivery Order core, Auth/RBAC/permissions foundation, Salary self-contained design.
- **PARTIAL (modify/extend):** Customer 360, Port abbreviation, Voyage (vessel code/fixed departure/P&L), Cargo (amount, shipper/consignee refs, job link), Inspection (status set locked, attachments via common system), Loading List (status lifecycle locked, numbering), Actual Loading (status lifecycle locked, return-to-yard locked, rate confirmation/POD), B/L (ordering locked, party model locked, numbering locked, lifecycle locked, release separation locked, revisions locked, PDF/print), Manifest (ordering locked, parties locked, numbering locked, ManifestItem→B/L item locked, PDF/print), Invoice (Job link locked, line VAT locked, numbering default locked, PDF/print), Quotation/Proforma (line VAT locked, numbering default locked, breakdown), Job (cost categories locked, job→cargo/invoice cardinality locked, creation trigger), Voucher (allocation model locked, advance payments preserved), Ledger (General Journal locked, voucher numbering default locked), Agent Portal (destination-scoped B/L/Release/payment/document views locked).
- **INCORRECT (rework):** Party modeling (Shipper/Consignee/Agent as Customer), B/L↔Manifest ordering, Manifest party model, Invoice header VAT, Voucher single-invoice FK, B/L/Manifest destination numbering not implemented where evidence requires it.
- **MISSING (build):** Shipper master, Consignee master, Agent master, General Journal entries, Document Templates, PDF/Excel/Print generation, Reports/KPIs/P&L/VAT, Audit Log, Document Attachments, Customer 360 page/API.
- **BUSINESS DECISION REQUIRED (do not implement yet):** Release partial-payment/credit policy, Delivery Order exact eligibility rule, B/L void/terminated/cancelled handling beyond locked lifecycle, Inspection final approval policy for FAILED, Proforma/Quotation goods-sale fields, Invoice correction flow, party phone/email ownership, Notifications trigger list/channels/recipients, Archive retention/re-opening policy, PDF/Excel template content and formats, agent extra capabilities beyond locked minimum, VAT taxability/rates.
- **TECHNICAL DESIGN DECISION REQUIRED:** Manifest-level charges/fees (not invented), Voyage cost total computed vs stored (implementation choice), reporting implementation approach, storage provider details for attachments, categorization taxonomy for attachments, audit retention/search scope, stamp/signature visual behavior within document-generation layer.

## 14. Top implementation-critical conflicts (must resolve before roadmap)

1. Party model: introduce Shipper/Consignee/Agent as separate masters; break Customer FKs on B/L, Manifest, ManifestItem — locked.
2. Document ordering: B/L from finalized cargo/loading; Manifest from issued B/Ls — locked.
3. Numbering: implement destination-scoped numbering for B/L and Manifest; Invoice/Proforma/Quotation are global company/year defaults, not confirmed destination-scoped — locked.
4. Invoice tax: move to per-line VAT — locked.
5. Voucher: replace single invoice FK with VoucherAllocation — locked.
6. Invoice→Job linkage: nullable jobId on Invoice; one Job → many Invoices — locked.
7. Agent Portal scope: expand from bookings to destination-scoped B/L/Release/payment/document access with backend enforcement — locked.
8. Missing reporting + templates + PDF/Excel + audit + attachments + General Journal — locked.

## 15. Technical decisions now locked

The following are no longer open technical decisions; they are frozen in `docs/ai-audit/06.5-technical-decision-lock.md`:

- Party model (Shipper, Consignee, Agent separate; Agent destination relations; no NotifyParty master yet)
- Cargo (nullable shipperId/consigneeId/jobId; optional cargoValue/cargoValueCurrency; no forced SELECTED status)
- Inspection status baseline (PENDING → BOOKED → DONE → FAILED → NEEDS_REINSPECTION) and loading-list gating
- Load List lifecycle (DRAFT → IN_PROGRESS → PARTIALLY_LOADED → COMPLETED → FINALIZED; item-level selection)
- Actual Loading lifecycle (same shape; not-loaded return-to-yard behavior)
- B/L (no Manifest dependency; DRAFT → IN_REVIEW → APPROVED → FINAL; separate RELEASED/UNRELEASED; revisions/versioning; number stable from first draft)
- Manifest (downstream of B/L; ManifestItem → BillOfLadingItem; optional cargo/ActualLoading provenance; one Voyage per Manifest)
- Tug/Barge/Vessel (separate Vessel records; type-constrained relations; no separate master tables)
- Numbering defaults (B/L, Manifest, Voyage destination-scoped; Customer code global sequential; Invoice/Proforma/Quotation global company/year; Voucher global; configurable infrastructure)
- VAT (line-level on Invoice/Proforma/Quotation; default zero unless configured)
- Job/Cargo/Invoice cardinality (one Job → many Invoices/Cargo; nullable links)
- Voucher (VoucherAllocation; multi-invoice; advance remainder; paid amount derived)
- General Journal (Account/JournalEntry/JournalLine; no salary mixing unless required)
- Release/Delivery (paid/partial/unpaid/override support; configurable eligibility; auditable; DO independent eligibility)
- Archive (explicit metadata; immutability for final documents; no deletedAt-as-archive; no invented retention)
- Attachments (common FileAttachment; local/S3 storage abstraction)
- Audit Log (append-only; defined event catalog)
- Document Generation (HTML/CSS+Playwright PDF; XLSX+ExcelJS Excel; DocumentTemplate versioning; digital stamp/signature via generation layer; no invented wording)
- Customer 360 (aggregate/read model; no duplication)
- Agent Portal (destination-scoped minimum visibility; backend enforcement; no extra capabilities without evidence)
- Notifications (event hooks only; no full system yet)
- UI (direction locked; redesign late; no redesign during audit)

## 16. What remains genuinely open (business decisions only)

- Release partial-payment/credit policy and approver rules.
- Delivery Order exact eligibility rule.
- B/L void/terminated/cancelled handling beyond locked lifecycle.
- Inspection final approval policy for FAILED/NEEDS_REINSPECTION.
- Proforma/Quotation goods-sale fields and required line attributes.
- Invoice correction flow (Credit Note vs Cancel+New).
- Party phone/email ownership model.
- Notifications triggers/channels/recipients/templates.
- Archive retention/re-opening policy.
- PDF/Excel template content and formats.
- Agent extra capabilities beyond locked minimum.
- VAT taxability, rates, and report scope.

## 17. What is NOT in scope of this stage

This document does not order implementation phases. That is Stage 7.

## 18. Files referenced

- `docs/ai-audit/01-employer-requirements-analysis.md`
- `docs/ai-audit/02-business-document-evidence.md`
- `docs/ai-audit/03-current-project-analysis.md`
- `docs/ai-audit/04-requirement-traceability.md`
- `docs/ai-audit/05-existing-project-work-and-prior-plans-audit.md`
- `docs/ai-audit/06.5-technical-decision-lock.md`
- `docs/ai-audit/00-audit-state.md`

## 19. Completion record

- Stage 6 document: `docs/ai-audit/06-final-gap-analysis.md`
- Status: ✅ COMPLETE — REVISED
- Written: 2026-09-21
- No application code changed.
- No database changed.
- No migrations run.
- No UI changed.
- Inconsistencies from prior version corrected to match technical decision lock.
