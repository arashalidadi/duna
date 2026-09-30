# 05 Existing Project Work and Prior Plans Audit

**Stage 5 complete.** Audits the previous project work (Phases 1-20, ADRs 001-040, workflows, business requirements) and classifies their relevance to the new implementation effort based on reconciled employer requirements from Stages 1-4.

---

## 1. Purpose

This document examines what was previously built, why it was built that way, and whether it can be preserved, modified, or must be replaced in light of the actual employer requirements reconciled in Stages 1-4. It is NOT the final roadmap — it is a classification of existing work to inform future planning.

The previous documentation was created during the earlier development of the CURRENT dashboard. These documents describe previous implementation work, architecture decisions, workflows, assumptions, and development history. They are NOT the final employer specification.

---

## 2. Previous Project Development Summary

### 2.1 What Was Built (from docs/progress.md)

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| 1 | Architecture & Bootstrap | ✅ Complete | Monorepo, Next.js 14, NestJS, Prisma, design system components, dashboard shell, security foundation, testing foundation |
| 1.5 | API Connectivity | ✅ Complete | CORS fix, same-origin API proxy, public deployment connectivity |
| 1.75 | UI/UX Redesign | ✅ Complete | Tracking-blue primary, redesigned sidebar/topbar/dashboard, design system tokens |
| 2 | Auth & RBAC | ✅ Complete | JWT + refresh token rotation, PermissionsGuard, Users/Roles/Permissions modules, 24 permissions |
| 3 | Master Data Productionization | ✅ Complete | Customers, Ports, Yards with lifecycle endpoints, boolean filter fix, 45 total permissions |
| 4 | Cargo & Yard Inventory | ✅ Complete | Cargo state machine (ADR-019), YardInventory (ADR-020), 33 permissions, 24 e2e tests |
| 5 | Inspections | ✅ Complete | Inspection ledger (ADR-024), duplicate-pending guard (ADR-025), 38 permissions, 21 e2e tests |
| 6 | Vessels & Voyages | ✅ Complete | Vessel/Voyage models, state machines (ADR-026/027), 49 permissions, 24 e2e tests |
| 7 | Load Planning / Load Lists | ✅ Complete | LoadList/LoadListItem, DRAFT→FINALIZED, eligible-cargo, 55 permissions |
| 8 | Actual Loading | ✅ Complete | ActualLoading/ActualLoadingItem, lifecycle (ADR-028), cargo LOADED + yard exit, 61 permissions, 10 e2e tests |
| 9 | Manifest | ✅ Complete | Manifest/ManifestItem, lifecycle (ADR-029), one-per-voyage, 68 permissions, 13 e2e tests |
| 10 | Bill of Lading | ✅ Complete | BillOfLading/BillOfLadingItem, lifecycle (ADR-030), one-live-bill-per-line, 74 permissions, 13 e2e tests |
| 11 | Invoice | ✅ Complete | Invoice/InvoiceItem, DRAFT→ISSUED→CANCELLED, 80 permissions, 11 e2e tests |
| 12 | Vouchers & Ledger | ✅ Complete | Voucher (RECEIPT/PMT), derived ledger (ADR-032), 86 permissions, 13 e2e tests |
| 13 | Delivery & Release Orders | ✅ Complete | D/O + R/O, money rule (ADR-033), 98 permissions, 10 e2e tests |
| 14 | Proforma Invoices | ✅ Complete | Proforma/ProformaItem, convert to invoice (ADR-034), 93 permissions, 9 e2e tests |
| 15 | Quotations | ✅ Complete | Quotation/QuotationItem, DRAFT→SENT→ACCEPTED/REJECTED/CANCELLED, convert to proforma (ADR-035), 102 permissions, 11 e2e tests |
| 16 | Employees & Salary | ✅ Complete | Employee/SalaryRecord, self-contained pay (ADR-036), 113 permissions, 9 e2e tests |
| 17 | Letters | ✅ Complete | Letter register, direction-driven lifecycle (ADR-037), 109 permissions, 15 e2e tests |
| 18 | Jobs & Job Costing | ✅ Complete | Job/JobCostItem, lifecycle (ADR-038), 116 permissions, 14 e2e tests |
| 19 | Discharge | ✅ Complete | Discharge/DischargeItem, mirror of Actual Loading (ADR-039), 122 permissions, 21 e2e tests |
| 20 | Agent Portal | ✅ Complete | BookingRequest, portal scoping (ADR-040), 147 permissions, 13 e2e tests |

**Total: 147 permissions seeded across 28 database tables.**

### 2.2 Previous Architectural Decisions (from docs/decisions.md)

**Technical decisions (still valid regardless of business requirements):**
- ADR-001: pnpm workspaces monorepo
- ADR-002: NestJS backend
- ADR-003: Next.js + React + TS + Tailwind
- ADR-004: Prisma + PostgreSQL
- ADR-005: cuid() string IDs
- ADR-006: Centralized validated configuration
- ADR-007: Consistent API envelope and versioning
- ADR-011: Shared packages as CommonJS
- ADR-012: pnpm build approvals
- ADR-013: Development PostgreSQL
- ADR-014: JWT + refresh token rotation
- ADR-015: Role soft-delete
- ADR-016: Permissions read-only seeded registry
- ADR-017: Boolean query filters as string
- ADR-018: Master-data lifecycle PATCH /:id/active → :update
- ADR-023: Decimal serialized as string

**Business decisions affected by employer requirements:**
- ADR-008: Numbering architecture — designed but not fully implemented
- ADR-009: Document templates — designed but not implemented
- ADR-010: Audit architecture — designed but not implemented
- ADR-019: Cargo lifecycle state machine
- ADR-020: One yard inventory per cargo
- ADR-021: Cargo deletion guard
- ADR-022: CargoType enum
- ADR-024: Inspection ledger
- ADR-025: Duplicate-pending guard
- ADR-026: Voyage state machine
- ADR-027: Single-vessel no-overlap
- ADR-028: Actual Loading lifecycle
- ADR-029: Manifest lifecycle — CONFLICT with employer
- ADR-030: B/L against Manifest — CONFLICT with employer
- ADR-031: Invoice line model — NEEDS MODIFICATION
- ADR-032: Vouchers/ledger — CONFLICT with employer
- ADR-033: D/O + R/O — STILL VALID
- ADR-034: Proforma — NEEDS MODIFICATION
- ADR-035: Quotation — NEEDS MODIFICATION
- ADR-036: Salary self-contained — STILL VALID
- ADR-037: Letters — STILL VALID
- ADR-038: Job costing — NEEDS MODIFICATION
- ADR-039: Discharge — STILL VALID
- ADR-040: Agent Portal scoping — CONFLICT with employer

### 2.3 Previous Workflows (from docs/workflows.md)

The previous workflows.md describes DESIGN INTENT, not employer requirements:
- Cargo lifecycle: REGISTERED → AT_YARD → READY → LOADED → DELIVERED
- Yard Inventory: place/move/remove
- Inspection: PENDING → APPROVED | REJECTED
- Vessel & Voyage: DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED
- Load Planning: Voyage → Load Planning → Load List → Actual Loading → Manifest
- B/L: issued per consignment from manifest
- Jobs: cost centre with expenses + revenue → P&L
- Invoicing: raise invoice → finalize → payment → ledger
- Release/Delivery/Discharge chain
- Agent portal: bookings + status tracking

### 2.4 Previous Business Requirements (from docs/business-requirements.md)

High-level domain requirements from early development:
- Customer master data with types (shipper, consignee, agent, freight forwarder) — NOTE: this treats types as Customer subtypes, which CONFLICTS with employer's separate-entity requirement
- Cargo status lifecycle
- Yard inventory
- Inspections
- Vessels/Voyages
- Load Planning/Load Lists/Actual Loading
- Manifest/B/L
- Jobs & costing
- Invoicing & accounting
- Release/Delivery/Discharge
- Agent portal
- Reporting
- Documents & templates
- Numbering
- Auditability & RBAC

---

## 3. Previous Architectural Decisions — Classification

### 3.1 TECHNICAL ONLY — No business impact

These are implementation choices that remain valid regardless of employer requirements:

| ADR | Decision | Classification |
|-----|----------|---------------|
| ADR-001 | pnpm workspaces | TECHNICAL ONLY — keep |
| ADR-002 | NestJS | TECHNICAL ONLY — keep |
| ADR-003 | Next.js + React + TS + Tailwind | TECHNICAL ONLY — keep |
| ADR-004 | Prisma + PostgreSQL | TECHNICAL ONLY — keep |
| ADR-005 | cuid() IDs | TECHNICAL ONLY — keep |
| ADR-006 | Centralized config | TECHNICAL ONLY — keep |
| ADR-007 | API envelope + versioning | TECHNICAL ONLY — keep |
| ADR-011 | Shared packages CommonJS | TECHNICAL ONLY — keep |
| ADR-012 | pnpm build approvals | TECHNICAL ONLY — keep |
| ADR-013 | Dev PostgreSQL | TECHNICAL ONLY — keep |
| ADR-014 | JWT + refresh rotation | TECHNICAL ONLY — keep |
| ADR-015 | Role soft-delete | TECHNICAL ONLY — keep |
| ADR-016 | Permissions read-only registry | TECHNICAL ONLY — keep |
| ADR-017 | Boolean filters as string | TECHNICAL ONLY — keep |
| ADR-018 | PATCH /:id/active → :update | TECHNICAL ONLY — keep |
| ADR-023 | Decimal → string over API | TECHNICAL ONLY — keep |

### 3.2 STILL VALID — Business decisions that hold

| ADR | Decision | Why Still Valid |
|-----|----------|----------------|
| ADR-019 | Cargo lifecycle state machine | The state machine concept (REGISTERED → AT_YARD → READY → LOADED → DELIVERED) is sound. Employer wants similar flow (Received → In Yard → Ready for Loading → Selected → Loaded → Delivered). The specific statuses need alignment but the pattern is valid. |
| ADR-020 | One yard inventory per cargo | Employer confirms yard inventory concept. One current record per cargo is correct. |
| ADR-021 | Cargo deletion guard | Soft-delete + active inventory guard is sound practice. |
| ADR-022 | CargoType enum | Employer's cargo types (GENERAL, VEHICLE, HEAVY_LIFT, CONTAINER, BULK, PROJECT) match. |
| ADR-024 | Inspection ledger pattern | The ledger + current-state pattern is excellent. Employer wants similar audit trail. Status values need alignment. |
| ADR-025 | Duplicate-pending guard | Sound concurrency control. Employer's inspection flow would benefit from this. |
| ADR-026 | Voyage state machine | DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED is sound. Employer's voyage concept is similar. |
| ADR-027 | Single-vessel no-overlap | Sound operational rule. |
| ADR-028 | Actual Loading lifecycle | NOT_STARTED → IN_PROGRESS → COMPLETED is sound. Employer wants similar (Draft → In Progress → Partially Loaded → Completed → Finalized). Status names need alignment. |
| ADR-033 | D/O + R/O issued directly, money rule | "No money, no cargo" is CONFIRMED by employer. Release requires payment. The specific rule ("all invoices fully paid") may need modification for partial payments, but the principle is valid. |
| ADR-036 | Salary self-contained | Sound decision. Employer hasn't specified otherwise. |
| ADR-037 | Letters direction-driven lifecycle | Sound correspondence register. |
| ADR-039 | Discharge as mirror of Actual Loading | Sound operational pattern. |

### 3.3 NEEDS MODIFICATION — Existing but must change

| ADR | Decision | Required Change |
|-----|----------|----------------|
| ADR-008 | Configurable numbering | Designed but never implemented. Employer requires per-destination numbering for B/L (KHS/26-110), Manifest (DSMAN/KHO-26-006), and possibly Voyage (1/26 per destination). The architecture design is sound but must be implemented and configured for destination-based sequences. |
| ADR-009 | Document templates | Designed but never implemented. Employer requires uploadable templates for Loading List, B/L, Manifest, Invoice, Proforma, Quotation, Receipt, Payment, Ledger, Release Order, Delivery Order, Salary Slip, Letters. Must be implemented. |
| ADR-010 | Audit architecture | Designed but never implemented. Employer requires audit trail. The append-only design is sound but must be implemented. |
| ADR-019 | Cargo lifecycle | Status values need alignment with employer: REGISTERED→RECEIVED, AT_YARD→IN_YARD, READY→READY_FOR_LOADING, LOADED→LOADED, DELIVERED→DELIVERED, CANCELLED→CANCELLED. READY requires inspectionStatus=APPROVED — employer confirms inspection=done prerequisite for loading. |
| ADR-024 | Inspection status values | Current: PENDING/APPROVED/REJECTED. Employer wants: Pending → Booked → Done → Failed/Need Reinspection. Status values and state machine need modification. |
| ADR-026 | Voyage numbering | Current: global VOY-YYMM-#####. Employer wants per-destination (1/26, 2/26 for Khorramshahr). Numbering must change. |
| ADR-028 | Actual Loading statuses | Current: NOT_STARTED/IN_PROGRESS/COMPLETED/CANCELLED. Employer wants: Draft → In Progress → Partially Loaded → Completed → Finalized. Statuses need modification. Also: verify auto yard return for NOT_LOADED items. |
| ADR-031 | Invoice line model | Current: description + quantity + unitPrice + amount (header-level taxRate). Needs: per-line VAT rate + VAT amount, Job link, company-prefixed numbering. |
| ADR-034 | Proforma conversion | Current: mirrors Invoice math (header-level tax). Needs: per-line VAT, DSPRO/YY-NNN numbering, optional goods-sale fields (year, weights). |
| ADR-035 | Quotation lifecycle | Current: DRAFT→SENT→ACCEPTED/REJECTED/CANCELLED. Employer's concept is similar. Needs: DSQUO/YY-NNN numbering, per-line VAT, other charges field, year field on items. |
| ADR-038 | Job costing | Current: self-contained, no Invoice/Cargo link. Needs: Invoice.jobId FK, Cargo.jobId FK, so invoices and cargo can be matched to jobs. |

### 3.4 CONFLICTS WITH EMPLOYER REQUIREMENTS

| ADR | Decision | Conflict | Employer Requirement |
|-----|----------|----------|---------------------|
| ADR-029 | Manifest built from COMPLETED Actual Loading, one-per-voyage | CONFLICT | Employer: Manifest built from ISSUED B/Ls (B/L first, then Manifest). Current: Manifest first, then B/L against manifest. |
| ADR-030 | B/L issued against APPROVED Manifest, one-live-bill-per-manifest-line | CONFLICT | Employer: B/L created first from finalized cargo/loading, then Manifest from B/Ls. Current: Manifest → B/L. |
| ADR-029+ADR-030 | Manifest.shipperId/ConsigneeId/AgentId = Customer FKs | CONFLICT | Employer: Shipper, Consignee, Agent are separate master data entities. Current: all point to Customer. Manifest has 12+ parties — impossible with single Customer FK per manifest. |
| ADR-030 | B/L.shipperId/ConsigneeId = Customer FKs | CONFLICT | Employer: B/L references independent Shipper/Consignee, not Customer. B/L sample: Shipper = RAS AL KHAIMAH MACHINERIES LLC (may not be a Customer). |
| ADR-032 | Voucher.invoiceId = single FK, one invoice per voucher | CONFLICT | Employer: Multi-invoice payment allocation. Receipt 2026/477 covers INV 1517 AND 1526. Current model cannot represent this. |
| ADR-040 | Agent Portal = bookings + shipments + statement only | CONFLICT | Employer: Agent sees B/L, Release status, payment status, document access for their destination. Not just bookings. Current Agent Portal is bookings-only. |
| ADR-019 | Cargo has no shipperId/consigneeId | CONFLICT | Employer: Cargo intake form includes Shipper and Consignee (separate from Customer). Current Cargo model only has customerId. |
| N/A | Global numbering everywhere (BOL-YYMM-#####, MAN-YYMM-#####, INV-YYMM-#####, etc.) | CONFLICT | Employer: Per-destination numbering (KHS/26-110 for B/L, DSMAN/KHO-26-006 for Manifest). Current: global sequence per type. |

### 3.5 OBSOLETE / NO LONGER AUTHORITATIVE

| Previous Decision/Assumption | Why Obsolete |
|------------------------------|--------------|
| Customer.type = SHIPPER/CONSIGNEE/AGENT | Employer explicitly says Customer ≠ Shipper ≠ Consignee ≠ Agent. This assumption is WRONG and must be replaced with separate models. |
| Cargo belongs only to Customer | Partially correct (Cargo.customerId is valid) but incomplete — Cargo also needs Shipper and Consignee references for B/L generation. |
| B/L → Manifest chain (legacy duna order "modernized" to Manifest → B/L) | The "modernization" reversed the employer's required order. Employer confirms B/L first, then Manifest. The ADR-030 rationale ("manifest lines are authoritative record of what was actually loaded") is a technical design choice, not an employer requirement. |
| Manifest header has single shipper/consignee/agent | Employer's manifest evidence shows 12+ parties. Single header FK is incorrect. |
| Invoice header-level taxRate | Employer's invoice evidence shows per-line VAT (% and amount per line). Header-level is incorrect. |
| Voucher links single invoice | Employer's receipt evidence shows multi-invoice allocation. Single FK is incorrect. |
| Agent Portal is bookings + status tracking only | Employer explicitly says agent needs B/L, Release, document access. Bookings-only is insufficient. |
| "Phase 9 = Manifest/B/L" as next phase | The previous phase ordering (Manifest before B/L) is wrong per employer. New roadmap must reorder. |

### 3.6 REQUIRES BUSINESS CONFIRMATION

| Previous Assumption | Business Question |
|--------------------|-------------------|
| LoadListStatus = DRAFT/FINALIZED/CANCELLED | Employer wants: Draft → In Progress → Partially Loaded → Completed → Finalized. Are these employer statuses confirmed? |
| ActualLoading lifecycle NOT_STARTED/IN_PROGRESS/COMPLETED | Same as above — employer's loading lifecycle not yet confirmed. |
| InspectionStatus = PENDING/APPROVED/REJECTED | Employer wants: Pending → Booked → Done → Failed/Need Reinspection. Is "Booked" a distinct status? Is "Failed" separate from "Rejected"? |
| R/O money rule: ALL invoices fully paid | Employer confirms "no money, no cargo" but what about partial payments? Can release happen with partial payment + guarantee? |
| B/L status: DRAFT/ISSUED/CANCELLED | Employer wants: Draft → Review → Approved → Final + Released/Unreleased as separate concept. Is REVIEW a distinct step? Is Released a boolean or status? |
| Manifest built from B/Ls | Employer says B/L first, then Manifest. But what about the actual loading data? Does Manifest still reference what was loaded, or only what's on B/Ls? |
| Tug/Barge as separate vessel records | Employer mentions Tug and Barge as vessel types. Are they separate Vessel records linked to one Voyage, or one vessel with tug reference? |
| Voyage numbering per destination | Employer wants Voyage 1/26, 2/26 per destination. Confirm format: "1/26" or "KHO-1/26"? |
| VAT rules | Which services are taxable? What rate? 0% on some lines confirmed, but which services? |
| Invoice correction | Credit Note or Cancel+New? |
| Archive policy | Which documents get archived? When? Who can access? |

---

## 4. Previous Workflows — Classification

### 4.1 Cargo Lifecycle (workflows.md §1)

**Previous:** REGISTERED → AT_YARD → READY → LOADED → DELIVERED (+ CANCELLED terminal)

**Employer:** Received → In Yard → Ready for Loading → Selected → Loaded → Delivered

**Classification:** NEEDS MODIFICATION — The flow is conceptually similar but status names differ. "Selected" is a new status not in current model. READY requires inspection=APPROVED — employer confirms this. LOADED→DELIVERED edge exists in current model (via Discharge, Phase 19).

### 4.2 Yard Inventory (workflows.md §1b)

**Previous:** Place/move/remove, one current record per cargo

**Employer:** Yard belongs to Port, selecting Port shows only related Yards

**Classification:** STILL VALID — The place/move/remove pattern is sound. Port→Yard filtering is implemented. Employer confirms this.

### 4.3 Inspection (workflows.md §1c)

**Previous:** PENDING → APPROVED | REJECTED, ledger + current state pattern

**Employer:** Pending → Booked → Done → Failed/Need Reinspection. Inspection=Done prerequisite for Loading List.

**Classification:** NEEDS MODIFICATION — Status values and flow differ. The ledger pattern is valid. Employer confirms inspection is prerequisite for loading.

### 4.4 Vessel & Voyage (workflows.md §1d)

**Previous:** DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED, overlap guard

**Employer:** Voyage auto-generated per destination (1/26, 2/26). Vessel types include Tug, Barge, Landing Craft.

**Classification:** NEEDS MODIFICATION — State machine valid. Voyage numbering must change to per-destination. Vessel types must expand to include TUG, BARGE, LANDING_CRAFT.

### 4.5 Load Planning / Load Lists (workflows.md §2)

**Previous:** Voyage → Load Planning → Load List (DRAFT→FINALIZED) → Actual Loading → Manifest

**Employer:** Collection of cargo for Vessel/Voyage. Lifecycle: Draft → In Progress → Partially Loaded → Completed → Finalized. Per-cargo: Selected → Loaded/Not Loaded → Returned to Yard.

**Classification:** NEEDS MODIFICATION — The flow is re-ordered per employer (B/L before Manifest). Load List statuses need modification. The connection between Load List and Actual Loading is sound.

### 4.6 B/L (workflows.md §3)

**Previous:** B/L issued per consignment from manifest/shipped cargo set. Configurable numbering and template.

**Employer:** Made from finalized Loading/Cargo. Process: Prepare → Draft → Send to Customer → Revision → Approved → Final → Released/Unreleased. Draft/Final = document production status; Released = delivery permission. Per-destination numbering.

**Classification:** CONFLICTS — Current B/L is issued against Manifest (wrong order). Current lifecycle is DRAFT/ISSUED/CANCELLED (missing Review, Approved, Final, Released/Unreleased). Current numbering is global (wrong). Current parties are Customer FKs (wrong).

### 4.7 Manifest (workflows.md §2, implicit)

**Previous:** Manifest derives from final cargo loading. One per voyage. Immutable after finalization.

**Employer:** Built from ISSUED B/Ls (B/L first, then Manifest). Multiple B/Ls per manifest. Multiple shippers/consignees per manifest. Per-destination numbering.

**Classification:** CONFLICTS — Current Manifest is built from Actual Loading (wrong source). Current Manifest has single shipper/consignee/agent (wrong for 12+ parties). Current numbering is global (wrong).

### 4.8 Jobs, Costing & P&L (workflows.md §4)

**Previous:** Job as cost centre with expense + revenue lines → P&L. Invoicing references revenue lines.

**Employer:** Job collects costs (repair, customs, crane, lowbed, transport, port, vessel, miscellaneous). Invoice matchable to Job Numbers. Job is parent to multiple Cargo.

**Classification:** NEEDS MODIFICATION — Job model exists but needs Invoice.jobId and Cargo.jobId links. Cost categories may need expansion. Job as parent to Cargo not yet implemented.

### 4.9 Invoicing, Payments & Ledger (workflows.md §5)

**Previous:** Raise Invoice → finalize → document generated → ledger posting → payment → allocate to invoices → customer ledger.

**Employer:** Invoice linked to B/L/Manifest/Job or independent. Per-line VAT. Multi-invoice payment allocation. General Journal for non-invoice transactions. Advance payments. ID docs + signature on payments.

**Classification:** CONFLICTS — Current invoice has header-level VAT (wrong), no Job link (wrong), global numbering (wrong). Current voucher has single invoice link (wrong). No General Journal (missing). No ID doc/signature (missing).

### 4.10 Release/Delivery/Discharge (workflows.md §6)

**Previous:** Release Order approved (RBAC + audit) → Delivery Order issued (template-based) → Cargo discharged.

**Employer:** Release requires payment. Delivery Order = physical cargo handover. Discharge at POD.

**Classification:** STILL VALID — The money rule is confirmed. D/O and R/O models are correct. Discharge (Phase 19) is implemented and valid.

### 4.11 Agent Portal (workflows.md §8)

**Previous:** Agents submit bookings / track status with restricted role. Read-mostly with scoped write.

**Employer:** Agent scoped to destination. Agent sees B/L status, Release Order status, payment status, document access. Not just bookings.

**Classification:** CONFLICTS — Current Agent Portal is bookings + shipments + statement only. Missing B/L view, Release view, document download, payment status per B/L.

---

## 5. Previous Implementation Phases — Assessment

### 5.1 Phases That Are Largely CORRECT (preserve with minor modifications)

| Phase | Name | Assessment |
|-------|------|------------|
| 1 | Architecture & Bootstrap | PRESERVE — Technical foundation is sound. |
| 1.5 | API Connectivity | PRESERVE — CORS and connectivity fixes are valid. |
| 1.75 | UI/UX Redesign | PRESERVE WITH MODIFICATION — Design system tokens are good, but palette and responsive design need update per employer's vision. |
| 2 | Auth & RBAC | PRESERVE — JWT + refresh rotation + permission re-resolution is excellent and employer-compatible. |
| 3 | Master Data (Customers/Ports/Yards) | PRESERVE WITH MODIFICATION — Port/Yard are correct. Customer model needs Shipper/Consignee/Agent separation. Customer type field must be deprecated. |
| 4 | Cargo & Yard Inventory | PRESERVE WITH MODIFICATION — Cargo state machine is sound. Add shipperId/consigneeId. Align status names. YardInventory is correct. |
| 5 | Inspections | PRESERVE WITH MODIFICATION — Ledger pattern is excellent. Align status values with employer (Pending → Booked → Done → Failed). |
| 6 | Vessels & Voyages | PRESERVE WITH MODIFICATION — State machines valid. Add TUG/BARGE/LANDING_CRAFT to VesselType. Change voyage numbering to per-destination. |
| 13 | Delivery & Release Orders | PRESERVE — Money rule is correct. D/O and R/O models are correct. |
| 16 | Employees & Salary | PRESERVE — Self-contained salary is sound. Confirm workflow and components with employer. |
| 17 | Letters | PRESERVE — Correspondence register is sound. |
| 19 | Discharge | PRESERVE — Mirror of Actual Loading is sound. |

### 5.2 Phases That Need SIGNIFICANT MODIFICATION

| Phase | Name | Required Changes |
|-------|------|-----------------|
| 7 | Load Planning / Load Lists | Change statuses to employer flow (Draft → In Progress → Partially Loaded → Completed → Finalized). Add "Selected" status for cargo. Verify auto yard return for NOT_LOADED. Add print/PDF. |
| 8 | Actual Loading | Align lifecycle statuses with employer. Verify auto yard return for NOT_LOADED items. |
| 9 | Manifest | **MAJOR REWRITE:** Change source from Actual Loading to ISSUED B/Ls. Add per-item shipper/consignee/agent (separate models). Add per-destination numbering. Support forwarder B/Ls. Change vessel reference from string to Vessel FK. |
| 10 | Bill of Lading | **MAJOR REWRITE:** Remove Manifest dependency (B/L created first). Add per-destination numbering. Migrate shipperId/consigneeId to Shipper/Consignee FKs. Add lifecycle: DRAFT → REVIEW → APPROVED → FINAL. Add Released/Unreleased as separate concept. Add revision workflow. Add digital stamp/signature. Add print/PDF. |
| 11 | Invoice | Add per-line VAT (vatRate, vatAmount on InvoiceItem). Remove header taxRate or compute from lines. Add Job link (jobId FK). Change numbering to company-prefixed (DSINV/26-172). |
| 12 | Vouchers & Ledger | Replace single invoiceId with VoucherAllocation model (multi-invoice). Add ID doc attachment. Add signature field. Add B/L reference. Add General Journal model. |
| 14 | Proforma | Change numbering to DSPRO/YY-NNN. Add per-line VAT. Consider optional goods-sale fields (year, weights). |
| 15 | Quotation | Change numbering to DSQUO/YY-NNN. Add per-line VAT. Add other charges field. Add year field on items. |
| 18 | Jobs & Job Costing | Add Invoice.jobId FK. Add Cargo.jobId FK. Expand cost categories if needed. |

### 5.3 Phases That Must Be REPLACED or RADICALLY REBUILT

| Phase | Name | Required Changes |
|-------|------|-----------------|
| 20 | Agent Portal | **RADICALLY EXPAND:** Add B/L list (filtered by destination), B/L detail view, Release Order status, payment status per B/L, document download/print, cargo visibility (if needed). Add permissions: agent:bill-read, agent:release-read, agent:document-download. May need per-agent (not per-company) accounts. |
| 9+10 | Manifest + B/L (combined) | **ORDER REVERSAL:** The entire B/L→Manifest flow must be reversed. B/L created first from cargo/loading, then Manifest built from issued B/Ls. This affects both modules and their shared types. |

### 5.4 Phases Not Yet Started (from progress.md "Pending Requirements")

| Requirement | Status |
|------------|--------|
| Reports, Voyage P&L | NOT STARTED — Missing entirely |
| Configurable numbering service | NOT STARTED — ADR-008 designed but not implemented |
| Document templates | NOT STARTED — ADR-009 designed but not implemented |
| Audit log implementation | NOT STARTED — ADR-010 designed but not implemented |
| Playwright browser E2E | NOT STARTED — Mentioned as future item |
| Dedicated test database | NOT STARTED — Mentioned as future item |

---

## 6. What Remains Valid

The following previous work is fundamentally sound and can be preserved:

1. **Technology stack** — pnpm monorepo, NestJS, Next.js 14, Prisma + PostgreSQL, Tailwind CSS. All appropriate for this ERP.

2. **Auth & RBAC** — JWT access + refresh token rotation, permission re-resolution per request, seeded permission registry. Employer-compatible and secure.

3. **API design** — Versioned `/api/v1`, consistent envelope, DTO validation, pagination pattern. Sound.

4. **Cargo state machine concept** — The REGISTERED → AT_YARD → READY → LOADED → DELIVERED pattern matches employer's flow. Status names need alignment but the concept is valid.

5. **Inspection ledger pattern** — Separate history ledger + current state field, updated in one transaction. Employer would benefit from this pattern for B/L lifecycle too.

6. **Yard Inventory model** — One current record per cargo, place/move/remove. Correct.

7. **Voyage state machine** — DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED. Sound.

8. **Actual Loading model** — Records what was actually loaded vs planned. Sound concept.

9. **D/O + R/O money rule** — "No money, no cargo" with override. Employer-confirmed.

10. **Salary self-contained** — No voucher/ledger contamination. Sound.

11. **Letters register** — Direction-driven lifecycle, threaded replies. Sound.

12. **Discharge as mirror of Actual Loading** — Sound operational pattern.

13. **Job costing concept** — Self-contained cost sheet with income/cost lines. Sound, but needs Invoice/Cargo links.

14. **Migration approach** — Diff-generated + deploy. Sound for this project.

15. **E2E testing pattern** — Supertest-based API tests with cleanup. Sound.

---

## 7. What Must Change

### 7.1 Data Model Changes (Prisma Schema)

| Change | Affected ADR/Phase | Reason |
|--------|-------------------|--------|
| Create Shipper model | ADR-019, Phase 4 | Employer: Shipper is separate from Customer |
| Create Consignee model | ADR-019, Phase 4 | Employer: Consignee is separate from Customer |
| Create Agent model | ADR-040, Phase 20 | Employer: Agent is separate, destination-scoped |
| Add Port.abbreviation | Phase 3 | Employer: HAM, JEA, etc. for Load Lists |
| Add VesselType.TUG, BARGE, LANDING_CRAFT | ADR-022, Phase 6 | Employer: Tug and Barge as vessel types |
| Add Voyage destination-based numbering | ADR-026, Phase 6 | Employer: Voyage 1/26 per destination |
| Add Cargo.shipperId, Cargo.consigneeId | ADR-019, Phase 4 | Employer: Cargo intake includes Shipper/Consignee |
| Migrate Manifest.shipperId/ConsigneeId/AgentId to Shipper/Consignee/Agent FKs | ADR-029, Phase 9 | Employer: Separate party models |
| Add ManifestItem.shipperId/ConsigneeId/agentId | ADR-029, Phase 9 | Employer: 12+ parties per manifest |
| Reverse B/L→Manifest dependency | ADR-030, Phase 10 | Employer: B/L first, then Manifest |
| Add B/L lifecycle: DRAFT→REVIEW→APPROVED→FINAL + Released/Unreleased | ADR-030, Phase 10 | Employer: Draft→Review→Approved→Final, Released separate |
| Add per-destination B/L numbering | ADR-030, Phase 10 | Employer: KHS/26-110 format |
| Add InvoiceItem.vatRate, InvoiceItem.vatAmount | ADR-031, Phase 11 | Employer: Per-line VAT |
| Add Invoice.jobId | ADR-031, Phase 11 | Employer: Invoice matchable to Job |
| Change Invoice numbering to DSINV/YY-NNN | ADR-031, Phase 11 | Employer: Company-prefixed format |
| Replace Voucher.invoiceId with VoucherAllocation model | ADR-032, Phase 12 | Employer: Multi-invoice payment allocation |
| Add GeneralJournalEntry model | N/A | Employer: GJ for non-invoice transactions |
| Add Voucher.idDocAttachment, Voucher.signature, Voucher.blReference | ADR-032, Phase 12 | Employer: ID docs, signature, B/L ref on payments |
| Add DocumentTemplate model | ADR-009 | Employer: Uploadable templates |
| Add NumberingSequence model (implement ADR-008) | ADR-008 | Employer: Per-destination numbering |
| Add AuditLog model (implement ADR-010) | ADR-010 | Employer: Audit trail |
| Add FileAttachment model | N/A | Employer: ID doc photos, document attachments |
| Add Voyage cost tracking (or link Job costs to Voyage) | ADR-038, Phase 18 | Employer: Voyage P&L |

### 7.2 API Changes

| Change | Reason |
|--------|--------|
| Add Shipper/Consignee/Agent CRUD endpoints | New models |
| Add Port.abbreviation to API response | New field |
| Add B/L create without Manifest (B/L first) | Order reversal |
| Add B/L release/unrelease endpoint | New lifecycle concept |
| Add B/L revision endpoint | New workflow |
| Add B/L document download/print endpoint | Template-driven output |
| Add Manifest create from B/Ls (not from cargo) | Order reversal |
| Add per-line VAT to invoice CRUD | VAT model fix |
| Add Job link to invoice CRUD | Job-Invoice link |
| Add multi-invoice allocation to voucher CRUD | Voucher fix |
| Add General Journal CRUD endpoints | New model |
| Add document template upload/manage endpoints | New model |
| Add file attachment upload/download endpoints | New model |
| Add agent B/L list/detail endpoints (destination-scoped) | Agent Portal expansion |
| Add agent Release Order endpoints (destination-scoped) | Agent Portal expansion |
| Add agent document download endpoints | Agent Portal expansion |
| Add Voyage P&L aggregation endpoint | Reports |
| Add VAT report endpoint | Reports |
| Add dashboard KPI aggregation endpoints | Dashboard |
| Add Customer 360 aggregated endpoint | Customer 360 page |

### 7.3 UI Changes

| Change | Reason |
|--------|--------|
| Build Customer 360 profile page | Employer: Most important management page |
| Build Shipper management page | New model |
| Build Consignee management page | New model |
| Build Agent management page | New model |
| Add Port.abbreviation field to Port UI | New field |
| Add Tug/Barge/Landing Craft to Vessel UI | New vessel types |
| Update Load List UI with employer lifecycle statuses | Status alignment |
| Update Actual Loading UI with employer lifecycle statuses | Status alignment |
| Rebuild B/L UI with new lifecycle (Draft→Review→Approved→Final, Released/Unreleased) | Lifecycle change |
| Add B/L revision workflow UI | New workflow |
| Add B/L document download/print UI | Template output |
| Rebuild Manifest UI to show B/L rows (not cargo rows) | Order reversal |
| Add multi-party support to Manifest UI | 12+ parties |
| Add per-line VAT to Invoice UI | VAT model fix |
| Add Job Number field to Invoice UI | Job-Invoice link |
| Add multi-invoice allocation UI to Voucher | Voucher fix |
| Build General Journal UI | New model |
| Build Document Template management UI | New model |
| Build file attachment UI for documents | New model |
| Expand Agent Portal: B/L list, B/L detail, Release status, payment status, download/print | Agent Portal expansion |
| Build Voyage P&L report page | Reports |
| Build VAT report page | Reports |
| Build Manifest report page | Reports |
| Build Cost report page | Reports |
| Build Dashboard KPIs page | Dashboard |
| Add print/PDF buttons per document page | Template output |
| Redesign UI: responsive, grey/neutral palette, collapsible sidebar, status indicators, elegant cards | Employer UI vision |

---

## 8. What Conflicts with Employer Requirements

### 8.1 Critical Conflicts (must be resolved before correct implementation)

1. **Customer = Shipper/Consignee/Agent** — The previous project treats these as Customer subtypes via Customer.type field. Employer explicitly says they are separate entities. This is the single biggest conflict.

2. **B/L → Manifest order reversed** — Previous phases built Manifest first (Phase 9), then B/L against Manifest (Phase 10). Employer says B/L first, then Manifest from B/Ls. ADR-029 and ADR-030 directly conflict with employer requirements.

3. **Global numbering** — Previous phases use global sequence numbering (BOL-YYMM-#####, MAN-YYMM-#####, INV-YYMM-#####, etc.). Employer wants per-destination numbering (KHS/26-110, DSMAN/KHO-26-006).

4. **Invoice VAT header-level** — ADR-031 established header-level taxRate. Employer's invoice evidence shows per-line VAT.

5. **Voucher single invoice** — ADR-032 established single invoiceId FK. Employer's receipt evidence shows multi-invoice allocation.

6. **Manifest single shipper/consignee** — Previous Manifest model has single shipperId/consigneeId/agentId (Customer FKs) on the header. Employer's manifest evidence shows 12+ parties.

7. **Agent Portal bookings-only** — ADR-040 established bookings + shipments + statement. Employer wants B/L, Release, document access.

### 8.2 Status Conflicts

| Domain | Previous Status | Employer Status | Conflict |
|--------|----------------|----------------|----------|
| Cargo | REGISTERED/AT_YARD/READY/LOADED/DELIVERED/CANCELLED | Received/In Yard/Ready for Loading/Selected/Loaded/Delivered | Status names differ; "Selected" missing |
| Inspection | PENDING/APPROVED/REJECTED | Pending/Booked/Done/Failed-Need Reinspection | Status values differ; "Booked" missing |
| Load List | DRAFT/FINALIZED/CANCELLED | Draft/In Progress/Partially Loaded/Completed/Finalized | Status values differ; intermediate states missing |
| Actual Loading | NOT_STARTED/IN_PROGRESS/COMPLETED/CANCELLED | Draft/In Progress/Partially Loaded/Completed/Finalized | Status values differ |
| B/L | DRAFT/ISSUED/CANCELLED | Draft/Review/Approved/Final + Released/Unreleased | Missing Review, Approved, Final, Released; Released is separate concept |
| Manifest | DRAFT/SUBMITTED/APPROVED/CANCELLED | (from B/Ls, not yet fully specified) | Source is wrong (Actual Loading vs B/Ls) |
| Voyage | DRAFT/SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED | (per-destination numbering) | Numbering is wrong; state machine is OK |

---

## 9. Obsolete / Non-authoritative Previous Decisions

The following previous decisions or assumptions are NO LONGER AUTHORITATIVE for the new implementation:

1. **Customer.type field as SHIPPER/CONSIGNEE/AGENT** — Obsolete. Must be replaced with separate Shipper, Consignee, Agent models.

2. **Legacy duna order "modernized" to Manifest→B/L** — Obsolete. ADR-030's rationale ("manifest lines are authoritative record of what was actually loaded") is a technical design choice, not an employer requirement. Employer confirms B/L→Manifest order.

3. **Manifest header parties as Customer FKs** — Obsolete. Must use Shipper/Consignee/Agent FKs, with per-item party references for multi-party manifests.

4. **B/L.shipperId/ConsigneeId as Customer FKs** — Obsolete. Must use Shipper/Consignee FKs.

5. **Global document numbering** — Obsolete. Must implement per-destination numbering.

6. **Invoice header-level taxRate** — Obsolete. Must use per-line VAT.

7. **Voucher single invoiceId FK** — Obsolete. Must support multi-invoice allocation.

8. **"Phase 9 = Manifest/B/L" as sequential phases** — Obsolete as phase ordering. New roadmap must reorder to B/L before Manifest.

9. **Agent Portal scope = bookings + shipments + statement** — Obsolete. Must expand to include B/L, Release, documents.

10. **workflows.md as authoritative business workflow** — Obsolete as final specification. It was design intent from early development, not employer requirements.

11. **business-requirements.md Customer types (shipper, consignee, agent, freight forwarder) as Customer subtypes** — Obsolete. Employer says these are separate entities.

---

## 10. Business vs Technical Decision Separation

### 10.1 Numbering

**Classification:** TECHNICAL DESIGN CHOICE, not a confirmed business requirement for all documents.

**What is confirmed:**
- B/L numbering: per-destination format KHS/26-110 (confirmed by document evidence)
- Manifest numbering: per-destination format DSMAN/KHO-26-006 (confirmed by document evidence)

**What is NOT confirmed:**
- Invoice numbering: employer mentions DSINV/26-172 format but hasn't explicitly stated it must be per-destination vs global
- Proforma numbering: DSPRO/26-001 — format observed but per-destination rule not stated
- Quotation numbering: DSQUO/25-017 — format observed but rule not stated
- Voucher numbering: mixed formats observed (sequential 1380 vs date-based 2026/446) — rule not stated
- Customer code: employer says "sequential like 332334" — this suggests global sequential, not per-destination
- Voyage numbering: employer says "auto-generated per destination" and gives example "1/26, 2/26" — per-destination confirmed for voyages

**Previous decision (ADR-008):** Designed configurable numbering for all document types with prefix, year/period mask, zero-padding, next-sequential value.

**Assessment:** ADR-008's architecture is sound. The implementation must support both global sequential (Customer code, possibly invoices) and per-destination (B/L, Manifest, Voyage) numbering. Do NOT assume every document uses destination-based numbering.

### 10.2 Release

**Classification:** BUSINESS RULE CONFIRMED for principle, TECHNICAL DETAIL uncertain.

**What is confirmed:**
- "No money, no cargo" principle — employer confirmed
- Release requires payment — employer confirmed

**What is NOT confirmed:**
- Exact rule: "all invoices fully paid" — current implementation. Employer hasn't confirmed this handles partial payments correctly
- Override conditions: current implementation allows override with reason + permission. Employer hasn't confirmed this is sufficient
- Credit/partial-payment behavior: unclear

**Previous decision (ADR-033):** R/O requires all ISSUED invoices on B/L fully paid; override with reason + release:override permission.

**Assessment:** The principle is correct. The specific "all invoices fully paid" rule may need modification for partial payments. Do NOT automatically treat current implementation as final business rule.

### 10.3 Manifest

**Classification:** BUSINESS FACT confirmed, TECHNICAL DESIGN decisions not confirmed.

**What is confirmed (business fact):**
- Manifest contains multiple B/L/cargo rows
- Manifest contains multiple shippers/consignees (12+ in evidence)
- Manifest built from ISSUED B/Ls (employer says B/L first, then Manifest)

**What is NOT confirmed (technical design):**
- ManifestItem → BillOfLadingItem relationship: this is a technical design choice in the current implementation. Employer hasn't specified the exact database relationship.
- Whether Manifest references Actual Loading data: employer says built from B/Ls, but doesn't say whether loaded quantities are still referenced

**Previous decision (ADR-029):** Manifest built from COMPLETED Actual Loading, one-per-voyage, item quantity = actual loaded quantity.

**Assessment:** The source (B/Ls not Actual Loading) is a business requirement conflict. The ManifestItem→BillOfLadingItem relationship is a technical design decision that should be evaluated, not blindly accepted.

### 10.4 Agent

**Classification:** BUSINESS FACT confirmed (destination-related), TECHNICAL DETAILS uncertain.

**What is confirmed:**
- Agent is destination-related (Agent Bandar Abbas for B/Ls to Bandar Abbas)
- Agent is NOT a regular User
- Agent sees B/L, Release, documents for their destination

**What is NOT confirmed:**
- Whether Agent must exist on every ManifestItem: employer mentions agent on B/L and manifest, but not necessarily on every item
- Whether one agent per destination or multiple: employer example suggests one per destination but not confirmed
- Whether agent can upload documents or add comments: employer says "TBD"

**Previous decision (ADR-040):** Agent company = Customer, one portal login per company, bookings + shipments + statement only.

**Assessment:** The destination-scoping principle is correct. The bookings-only scope is wrong. The Customer-as-agent-company model may be acceptable (agent company is a Customer), but agent master data is still needed for B/L/manifest references. Agent capabilities (upload, comment) are OPEN BUSINESS DECISION.

### 10.5 Job / Invoice

**Classification:** BUSINESS REQUIREMENT confirmed, TECHNICAL RELATIONSHIP uncertain.

**What is confirmed:**
- Invoice must be related/matchable to Jobs
- Job collects costs (repair, customs, crane, lowbed, transport, port, vessel, miscellaneous)
- Employer wants invoice matchable to Job Numbers

**What is NOT confirmed:**
- Exact cardinality: one Invoice to one Job, or one Invoice to multiple Jobs?
- Whether Cargo belongs to Job: employer says "Job is parent to multiple Cargo" but this may mean operational grouping, not database FK
- Whether Job is created automatically or manually: unclear

**Previous decision (ADR-038):** Job is self-contained cost sheet, no link to invoices or cargo.

**Assessment:** The need for Invoice-Job linkage is confirmed. The exact relationship (Invoice.jobId as FK) is a technical design decision. Do NOT automatically decide Invoice.jobId is the final correct relationship without considering cardinality.

### 10.6 B/L Lifecycle

**Classification:** BUSINESS FLOW confirmed, TECHNICAL STATUS VALUES uncertain.

**What is confirmed (business flow):**
- Draft → customer review/correction → approval/finalization
- Draft/Final = document production status
- Released = delivery permission (separate concept)

**What is NOT confirmed (technical status values):**
- Exact status names: DRAFT → REVIEW → APPROVED → FINAL is a technical choice
- Whether REVIEW is a distinct status or just a transition
- Whether Released is a boolean flag or a status
- Whether "Approved" and "Final" are separate statuses or the same

**Previous decision (ADR-030):** DRAFT → ISSUED → CANCELLED. ISSUED is frozen.

**Assessment:** The business flow (draft → review → approved → final, plus separate released concept) is confirmed. The exact database status values are a technical design decision. Do NOT automatically use DRAFT→REVIEW→APPROVED→FINAL without confirming with employer.

### 10.7 Notifications

**Classification:** OPEN BUSINESS DECISION — do not declare as fully specified requirement.

**What is confirmed:**
- General need for alerts/notifications mentioned in previous workflows.md (Control Flow: Statuses → Alerts)
- No specific notification requirements documented by employer

**Assessment:** Keep as OPEN BUSINESS DECISION. Do not declare a complete missing notification system as a fully specified requirement. Determine with employer: in-app only, email, both? Which events trigger? Who receives?

### 10.8 Archive

**Classification:** BUSINESS CONCEPT confirmed, POLICY uncertain.

**What is confirmed:**
- Document finalization/locking (final documents not reopened)
- Historical access needed (archive accessible for reference)

**What is NOT confirmed:**
- Actual archive policy: which documents, when, who can access
- Whether archive is a separate module or just soft-delete + view

**Previous assumption:** Soft-delete (deletedAt) serves as archiving.

**Assessment:** Soft-delete provides technical archiving but employer may want explicit Archive status with view/search. Keep archive policy as requiring business confirmation.

---

## 11. High-Risk Areas

### 11.1 Party Modeling (Shipper/Consignee/Agent)

**Risk:** HIGH. The current Customer-based party model is used by Cargo, Manifest, B/L, and Agent Portal. Changing this affects:
- Prisma schema (new models, FK migrations)
- All modules referencing parties (Cargo, Manifest, B/L, Agent Portal)
- Frontend forms (cargo intake, B/L creation, manifest creation)
- Shared types
- Existing data (if any Customer records are used as shippers/consignees/agents)

**Recommended action:** Create Shipper, Consignee, Agent models first. Migrate FK references incrementally. Deprecate Customer.type field. This is the foundational change that enables correct B/L, Manifest, and Agent Portal implementation.

### 11.2 B/L → Manifest Order Reversal

**Risk:** HIGH. Phases 9 and 10 are built with Manifest→B/L dependency. Reversing this affects:
- Manifest model (source of items changes from Actual Loading to B/Ls)
- B/L model (no longer requires Manifest)
- ManifestItem model (references BillOfLadingItem instead of cargo)
- B/L issuance flow (no longer stamps ManifestItem.blNumber)
- All shared types for Manifest and B/L
- Frontend for both modules
- Existing e2e tests

**Recommended action:** Plan this as a coordinated rewrite of Phases 9 and 10. Consider whether to modify existing tables or create new ones and migrate.

### 11.3 Numbering Strategy

**Risk:** MEDIUM-HIGH. Current numbering is hard-coded per module (generateReference pattern). Implementing per-destination numbering requires:
- NumberingSequence infrastructure (ADR-008 design, not implemented)
- Per-destination sequence management
- Migration of existing numbering formats
- Potential conflicts with existing data

**Recommended action:** Implement ADR-008 numbering service before changing individual document numbering. Design for both global sequential and per-destination sequences.

### 11.4 Invoice VAT Model

**Risk:** MEDIUM. Changing from header-level to per-line VAT affects:
- InvoiceItem model (add vatRate, vatAmount)
- Invoice totals computation (subtotal, taxAmount, totalAmount recalculation)
- Invoice create/update DTOs
- Frontend invoice line editor
- Existing e2e tests
- Proforma and Quotation (same math model)

**Recommended action:** Change InvoiceItem first, then update totals computation, then update Proforma and Quotation to match.

### 11.5 Voucher Multi-Allocation

**Risk:** MEDIUM. Changing from single invoiceId to multi-allocation affects:
- Voucher model (remove invoiceId, add VoucherAllocation)
- Invoice.paidAmount computation (sum allocations instead of linked vouchers)
- Voucher create UI (select multiple invoices)
- Ledger derivation
- Existing e2e tests

**Recommended action:** Create VoucherAllocation model. Update Invoice.paidAmount to sum allocations. Update ledger derivation.

### 11.6 Agent Portal Expansion

**Risk:** MEDIUM. Expanding from bookings-only to B/L/Release/documents affects:
- Agent Portal API (new endpoints)
- Agent Portal UI (new pages)
- Permissions (new agent:* permissions)
- B/L model (agent access control)
- Release Order model (agent visibility)
- Document download infrastructure

**Recommended action:** Implement B/L and Release visibility first. Add document download after template infrastructure is ready.

### 11.7 Vessel Type Expansion + Tug/Barge Modeling

**Risk:** LOW-MEDIUM. Adding TUG/BARGE/LANDING_CRAFT to VesselType is straightforward. The harder question is whether Tug and Barge are separate Vessel records or one vessel with tug reference. This affects:
- Voyage model (single vesselId or tugVesselId + bargeVesselId?)
- Manifest display (show tug and barge names)
- B/L display (show vessel composition)

**Recommended action:** First expand VesselType enum. Then resolve tug/barge modeling with employer before changing Voyage.

---

## 12. Recommended Treatment of Previous Work

### 12.1 Preserve As-Is (no changes needed)
- Technology stack (pnpm, NestJS, Next.js, Prisma, PostgreSQL, Tailwind)
- Auth & RBAC (JWT, refresh rotation, permission re-resolution)
- API design (versioning, envelope, DTO validation, pagination)
- Cargo state machine concept (status names need alignment)
- Yard Inventory model
- Voyage state machine concept
- Actual Loading model concept
- D/O + R/O models and money rule
- Salary self-contained design
- Letters register design
- Discharge mirror design
- Migration approach (diff + deploy)
- E2E testing pattern

### 12.2 Preserve With Modifications
- Customer model (add Shipper/Consignee/Agent separation, deprecate type field)
- Port model (add abbreviation)
- Vessel model (add TUG/BARGE/LANDING_CRAFT to enum)
- Voyage model (per-destination numbering)
- Cargo model (add shipperId/consigneeId, align status names)
- Inspection model (align status values with employer)
- Load List model (align statuses with employer)
- Actual Loading model (align statuses, verify yard return)
- Invoice model (per-line VAT, Job link, numbering)
- Voucher model (multi-allocation, ID doc, signature, B/L ref)
- Proforma model (per-line VAT, numbering)
- Quotation model (per-line VAT, other charges, numbering)
- Job model (Invoice/Cargo links)

### 12.3 Replace or Radically Rebuild
- Manifest module (source change from Actual Loading to B/Ls, party model, numbering)
- B/L module (remove Manifest dependency, add lifecycle, parties, numbering, stamp, PDF)
- Agent Portal (expand from bookings to B/L/Release/documents)
- Invoice tax computation (header-level to per-line)
- Voucher allocation (single FK to multi-allocation)

### 12.4 Implement From Scratch (not previously built)
- Shipper model + CRUD + UI
- Consignee model + CRUD + UI
- Agent model + CRUD + UI
- General Journal model + CRUD + UI
- Document Template model + upload + UI
- Numbering Service (implement ADR-008)
- Audit Log (implement ADR-010)
- File Attachment infrastructure
- Customer 360 profile page
- Dashboard KPIs page
- Voyage P&L report
- VAT report
- Manifest report
- Cost report
- Document PDF/Excel generation
- Agent Portal B/L/Release/document views
- UI redesign (responsive, grey/neutral, status indicators, elegant cards)

### 12.5 Defer Until Business Decisions Resolved
- Notification system (OPEN BUSINESS DECISION)
- Archive policy/module (require business confirmation)
- B/L exact status values (DRAFT→REVIEW→APPROVED→FINAL vs alternatives)
- Load List exact lifecycle statuses
- Inspection exact status values (Booked? Failed vs Rejected?)
- R/O partial payment behavior
- Tug/Barge modeling (separate records or combined)
- Proforma goods-sale fields (year, weights)
- Agent capabilities (upload, comment, per-agent vs per-company)
- VAT rules (which services taxable, rate)
- Invoice correction method (Credit Note vs Cancel+New)

---

## 13. Summary Assessment Table

| Area | Preserve | Modify | Replace | Needs Business Decision |
|------|----------|--------|---------|------------------------|
| Technology Stack | ✅ | | | |
| Auth & RBAC | ✅ | | | |
| API Design | ✅ | | | |
| Customer Model | | ✅ (separate parties) | | |
| Customer 360 | | ✅ (build profile page) | | |
| Shipper | | | ✅ (new model) | |
| Consignee | | | ✅ (new model) | |
| Agent | | | ✅ (new model + portal expansion) | Agent capabilities |
| Port | | ✅ (add abbreviation) | | |
| Yard | ✅ | | | |
| Vessel | | ✅ (add TUG/BARGE/LANDING_CRAFT) | | Tug/Barge modeling |
| Voyage | | ✅ (per-destination numbering) | | Voyage numbering format |
| Cargo | | ✅ (add shipper/consignee, align status) | | |
| Inspection | | ✅ (align status values) | | Inspection flow details |
| Load List | | ✅ (align statuses) | | Lifecycle statuses |
| Actual Loading | | ✅ (align statuses, verify yard return) | | Lifecycle statuses |
| B/L | | ✅ (lifecycle, parties, numbering, stamp, PDF) | ✅ (order reversal) | B/L status values, Released concept |
| Manifest | | ✅ (source, parties, numbering) | ✅ (order reversal) | Manifest source details |
| Job | | ✅ (Invoice/Cargo links) | | Job-Cargo cardinality |
| Invoice | | ✅ (per-line VAT, Job link, numbering) | | Invoice-Job cardinality, correction method |
| Receipt/Payment | | ✅ (multi-allocation, ID doc, signature, B/L ref) | | Partial payment behavior |
| Ledger | | ✅ (add GJ entries) | | |
| General Journal | | | ✅ (new model) | Chart of accounts |
| VAT | | | ✅ (per-line model, reports) | VAT rules (taxable services, rate) |
| Proforma | | ✅ (per-line VAT, numbering, optional goods fields) | | Goods-sale fields needed? |
| Quotation | | ✅ (per-line VAT, other charges, numbering) | | |
| Salary | ✅ | | | Salary workflow, components |
| Release Order | ✅ | | | Partial payment release |
| Delivery Order | ✅ | | | |
| Agent Portal | | ✅ (expand to B/L/Release/docs) | ✅ (bookings-only obsolete) | Agent capabilities, per-agent vs per-company |
| Archive | | | | Archive policy |
| Reports | | | ✅ (build from scratch) | |
| Templates | | | ✅ (build from scratch) | Template formats |
| PDF/Excel/Print | | | ✅ (build from scratch) | |
| Permissions | | ✅ (add missing permissions) | | |
| Notifications | | | | Notification requirements |
| UI/UX | | ✅ (responsive, palette, status indicators, cards) | | |

---

*Stage 5 of 8 — completed and persisted.*
