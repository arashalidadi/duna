# 09 Final Implementation Roadmap

## 1. Roadmap principles

- Follow the locked technical decisions unless a later explicit decision record overrides them.
- Do not invent business rules.
- Preserve historical document numbers.
- Enforce sensitive scope server-side.
- Separate document data readiness from rendering polish.
- Redesign UI late.

## 2. Current state baseline

### 2.1 What is already implemented

- Auth/RBAC foundation.
- Master data: Customer, Port, Yard, Vessel, Voyage, plus Phase 1 infrastructure.
- Operations: Cargo, YardInventory, Inspection, LoadList, LoadListItem, ActualLoading, ActualLoadingItem, Discharge.
- Documents: Manifest, ManifestItem, BillOfLading, BillOfLadingItem.
- Commercial: Invoice, InvoiceItem, Proforma, ProformaItem, Quotation, QuotationItem.
- Accounting: Voucher, Ledger derived.
- Release/Delivery: DeliveryOrder, ReleaseOrder.
- HR/Correspondence: Employee, SalaryRecord, Letter.
- Job: Job, JobCostItem.
- Agent portal: BookingRequest, portal scoping.

### 2.2 What is currently wrong or incomplete vs target

- B/L and Manifest still depend on Manifest-first ordering and Customer FK parties in current code.
- Invoice has header VAT and no Job link in current schema.
- Voucher has single invoice FK in current schema.
- No GeneralJournal/JournalLine.
- No VoucherAllocation.
- No B/L release status as a distinct concept.
- No B/L revision model.
- No ManifestItem→BillOfLadingItem reference yet.
- Agent portal is bookings-focused.
- No Customer 360 page/endpoint.
- No complete document output pipeline with uploaded templates and stamp behavior.
- No full reporting implementation.

### 2.3 Phase 3A status

Phase 3A is partially complete and not fully aligned with target.
Implemented pieces include Cargo shipper/consignee/job/value fields and inspection gating concepts.
What is not complete:
- Inspection status lifecycle and gating must match target.
- LoadList and ActualLoading lifecycle and not-loaded return behavior must match target.
- B/L/Manifest ordering must be corrected in later phases; Phase 3A cannot be declared complete until the operational flow is reconciled with the target B/L-first model or explicitly scoped as a transitional state.
- Shipper/Consignee/Agent masters are present in schema but must be switched on as the active party model and detached from Customer FK usage in B/L/Manifest code.

Therefore Phase 3A is not complete in the target sense. It is a transitional milestone that still needs reconciliation.

## 3. Phase list

### Phase 2 — Master Data & Party Model Realignment

Objective: make Shipper, Consignee, Agent the active masters and align Port/Yard/Vessel/Voyage numbering and type modeling with target.

Scope:
- Shipper, Consignee, Agent as active masters.
- AgentDestination.
- Port abbreviation usage.
- Vessel type and tug/barge modeling.
- Voyage per-destination numbering.
- Cutover plan for B/L/Manifest party references away from Customer FKs.

Dependencies:
- Phase 1 infrastructure.

Data changes:
- Activate and use Shipper/Consignee/Agent.
- Migrate B/L/Manifest party references with compatibility strategy.
- Voyage numbering configuration.

API changes:
- Shipper/Consignee/Agent CRUD.
- Agent destination management.
- Voyage numbering integration.

UI changes:
- Master data pages for Shipper/Consignee/Agent/Vessel.
- Port abbreviation in lists/forms.

Tests:
- Party CRUD.
- Agent destination scoping.
- Vessel type constraints.
- Voyage numbering.

Acceptance criteria:
- Shipper/Consignee/Agent are the active masters.
- Agent supports destination scoping.
- Voyage numbering is per destination.
- B/L/Manifest party references move away from Customer FKs.

Risks:
- Migration of existing party references.
- Half-deprecated Customer.type confusion.

### Phase 3 — Operational Flow Reconciliation

Objective: align Cargo, Inspection, LoadList, ActualLoading, Discharge with target gating and lifecycle behavior.

Scope:
- Inspection status and Done gating.
- LoadList eligibility and not-loaded return to yard.
- ActualLoading result handling and yard inventory effects.
- Discharge mirror behavior.
- Comment editing and visibility.

Dependencies:
- Phase 2.

Data changes:
- Status lifecycle alignment.
- Inspection gating enforcement.
- Yard inventory return behavior.

API changes:
- Inspection status actions.
- LoadList eligibility enforcement.
- ActualLoading result behavior.

UI changes:
- Inspection status UI.
- LoadList and ActualLoading status UI.
- Comment handling.

Tests:
- Inspection Done gating.
- Not-loaded return to yard.
- LoadList eligibility.
- Comment edit/delete visibility.

Acceptance criteria:
- Inspection Done gates Load List.
- Not-loaded cargo returns to yard.
- Comment is editable and visible to relevant users.

Risks:
- Status incompatibility with existing data.
- Gating too tight or too loose.

### Phase 4 — B/L Rewrite

Objective: rebuild B/L as a standalone document from finalized/eligible cargo/loading, with correct parties, per-destination numbering, lifecycle, release concept, and revisions.

Scope:
- Remove Manifest dependency.
- Shipper/Consignee masters on B/L.
- Per-destination numbering.
- Draft/Final/Approved/Released lifecycle.
- Revisions for customer review corrections.
- Number stability through revisions.
- Document output hooks.

Dependencies:
- Phases 2 and 3.
- NumberingSequence.

Data changes:
- BillOfLading/Item redesign.
- Release status field/concept.
- Revision model.

API changes:
- B/L create from cargo/loading.
- Lifecycle and revision endpoints.
- Document download hooks.

UI changes:
- B/L create/edit/detail UI.
- Revision history.
- Release status display.

Tests:
- B/L creation without Manifest dependency.
- Party master usage.
- Numbering.
- Lifecycle and revisions.
- Release separation.

Acceptance criteria:
- B/L no longer depends on Manifest.
- Parties come from masters.
- Numbering is per destination.
- Lifecycle and release separation are correct.

Risks:
- Incomplete Manifest decoupling.
- Revision complexity.

### Phase 5 — Manifest Rewrite

Objective: make Manifest a downstream consolidation of issued B/Ls with correct multi-party rows, voyage linkage, tug/barge display, per-destination numbering, and B/L item references.

Scope:
- Manifest creation from issued B/Ls only.
- ManifestItem references BillOfLadingItem.
- Multiple shippers/consignees across items.
- Voyage linkage and tug/barge display.
- Per-destination numbering.
- Document output readiness.

Dependencies:
- Phase 4.

Data changes:
- Manifest/ManifestItem redesign.
- ManifestItem→BillOfLadingItem reference.
- ManifestDate.

API changes:
- Manifest create from B/Ls.
- B/L item reference integrity.

UI changes:
- Manifest create/consolidate UI.
- Multi-party row display.
- Voyage/tug/barge display.

Tests:
- Manifest creation from issued B/Ls.
- ManifestItem→BillOfLadingItem integrity.
- Multi-party support.
- Numbering.

Acceptance criteria:
- Manifest is downstream of B/L.
- Multi-party manifests supported.
- Numbering is per destination.
- B/L item traceability present.

Risks:
- Loss of traceability in source-of-truth switch.
- Overadding manifest charges without evidence.

### Phase 6 — Commercial, Job & Accounting

Objective: link Jobs/Invoices/Cargo, fix VAT and numbering defaults, implement VoucherAllocation and GeneralJournal, and make ledger/accounting report-ready.

Scope:
- Job↔Invoice and Job↔Cargo cardinality.
- Invoice.line VAT.
- Proforma/Quotation line VAT consistency.
- VoucherAllocation.
- GeneralJournal/Entry/Line.
- Ledger alignment.
- Numbering defaults.
- Release/Delivery payment audit trail.

Dependencies:
- Phases 2–5.

Data changes:
- Invoice jobId.
- InvoiceItem VAT fields.
- VoucherAllocation.
- GeneralJournal/Entry/Line.
- Ledger derivation updates.

API changes:
- Invoice/Proforma/Quotation VAT and job linking.
- Voucher allocation endpoints.
- GeneralJournal endpoints.
- Ledger statement updates.

UI changes:
- Line VAT UI.
- Job linking UI.
- Voucher allocation UI.
- Journal entry UI.
- Ledger view updates.

Tests:
- Line VAT math.
- Job linking cardinality.
- Voucher allocation and paid amount derivation.
- Journal double-entry balance.
- Ledger consistency.

Acceptance criteria:
- Invoice VAT is per line.
- Job links work.
- Voucher allocation supports multi-invoice and advance remainder.
- GeneralJournal exists.
- Ledger is consistent.

Risks:
- VAT migration corrupting totals.
- Voucher allocation migration losing traceability.
- Premature VAT rate/taxability assumptions.

### Phase 7 — Document Engine, Templates, Attachments & Archive

Objective: deliver document generation, template management, attachment UX, and archive metadata.

Scope:
- DocumentTemplate versioning and active selection.
- PDF/Excel output for business documents.
- Auto stamp and live stamp removal behavior.
- Digital stamp/signature support in generation layer.
- Attachments for inspections, payments, B/Ls, source documents.
- Archive metadata and immutability.

Dependencies:
- Phases 1–6 data readiness.

Data changes:
- Template usage integration.
- Archive metadata on relevant entities.
- FileAttachment usage across modules.

API changes:
- Template management.
- Document download/generation endpoints.
- Attachment endpoints.
- Archive actions.

UI changes:
- Template management UI.
- Document preview/download/print UI.
- Attachment upload/view UI.
- Archive view/actions.

Tests:
- Template versioning and selection.
- PDF/Excel output for key document types.
- Stamp behavior.
- Attachment access control.
- Archive immutability.

Acceptance criteria:
- Templates versioned and selectable.
- PDF/Excel output for required document types.
- Stamp behavior supported.
- Attachments supported with access control.
- Archive metadata recorded.

Risks:
- Template rendering brittleness.
- Stamp behavior over-specified.
- Immutability conflicting with correction workflows.

### Phase 8 — Customer 360, Agent Portal & Reporting

Objective: deliver aggregate customer view, destination-scoped agent portal visibility, and required reports.

Scope:
- Customer 360 page/API.
- Dashboard KPIs.
- Agent portal destination-scoped B/L and Release visibility.
- Document download for agents.
- Voyage/Vessel/Manifest P&L.
- Manifest/cost reports.
- VAT report.
- Tax/year reporting.

Dependencies:
- Phases 1–7.

Data changes:
- Read-model/endpoint aggregation.
- Agent visibility filters.

API changes:
- Customer 360 endpoint.
- Agent portal B/L/Release/document endpoints.
- Report services.

UI changes:
- Customer 360 profile.
- KPI widgets.
- Agent portal B/L/Release/document views.
- Report pages/exports.

Tests:
- Customer 360 aggregation.
- Agent scoping enforcement.
- P&L data correctness.
- VAT report correctness.
- Document download scope.

Acceptance criteria:
- Customer 360 shows required aggregate data.
- Agent portal is destination-scoped and server-enforced.
- Required reports exist with correct data sources.

Risks:
- Customer 360 performance.
- Agent scoping bugs.
- Report data incompleteness from earlier deferrals.

### Phase 9 — UX Stabilization, E2E Hardening & UAT Readiness

Objective: stabilize the UI direction, harden cross-module workflows, and prepare for production use.

Scope:
- Responsive/mobile-first UI direction.
- Collapsible sidebar and status presentation.
- Cross-module workflow E2E.
- Document output tests.
- Permission/security tests.
- Migration verification.
- UAT and production readiness checklists.

Dependencies:
- Phases 1–8 functionally complete enough to stabilize.

Data changes:
- Verification-focused, not new business models.

API changes:
- Verification-focused.

UI changes:
- Global layout and status presentation.
- Component polish.

Tests:
- Cross-module workflow E2E.
- Document output tests.
- Security/permission tests.
- Migration verification.

Acceptance criteria:
- UI direction implemented.
- Core workflows covered by E2E.
- Document outputs tested.
- Security behavior verified.
- Migration safety verified.
- UAT/readiness checklists complete.

Risks:
- UI scope creep.
- E2E gaps.
- Incomplete migration verification.

## 4. Rewrite-vs-refactor decision

The current system is not a rewrite candidate in the whole-app sense. The domain model, auth/RBAC, modular architecture, and large portion of operational modules are already in place and largely reusable.

What must be refactored or replaced:
- B/L and Manifest ordering and party model must be reworked.
- Invoice VAT and Job linking must be changed.
- Voucher allocation and GeneralJournal must be added.
- B/L release status, revisions, Manifest B/L item references, and document output must be added.
- Agent portal scope and Customer 360 must be expanded.

What can be preserved:
- Auth/RBAC, permissions, user/role architecture.
- Cargo, YardInventory, Inspection, LoadList, ActualLoading, Discharge operational foundations.
- Proforma/Quotation conversion chain.
- Release/Delivery money principle.
- Salary self-contained design.
- Letters design.
- Phase 1 infrastructure.

Conclusion: extend and refactor the existing system, with targeted rewrites in B/L, Manifest, Invoice/Voucher/Ledger accounting, and document engine. No full rewrite is justified at this time.

## 5. Immediate next phase

The immediate next executable phase is Phase 2 alignment work: activate Shipper/Consignee/Agent as the active party model, finalize Port abbreviation and Vessel/Voyage destination numbering approach, and draft the B/L/Manifest party reference cutover plan.

Before Phase 2 work is marked complete, the following must be true:
- Shipper/Consignee/Agent are usable as masters.
- B/L/Manifest party reference migration plan is documented.
- Voyage numbering and vessel type approach are decided and implemented or explicitly deferred with a decision record.

### 6. Phase numbering note

The phases in this roadmap are the authoritative planning phases for future implementation work. They are not the same as earlier historical phase numbers used in previous progress documents. If any future execution log or status document needs to relate a task to an older phase label, the mapping must be written explicitly in that log; it must not be assumed.
