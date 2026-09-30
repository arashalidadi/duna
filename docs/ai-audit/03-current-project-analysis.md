# 03 Current Project Analysis

**Stage 3 complete.** Analysis of current project source, database, API, frontend, permissions, and UI.

---

## 1. Technology Stack (CONFIRMED from source)

| Layer | Choice | Evidence |
|-------|--------|----------|
| Monorepo | pnpm workspaces | package.json workspaces: ['apps/*', 'packages/*'] |
| Frontend | Next.js 14 (App Router) | architecture.md, package.json |
| UI Framework | React 18 + TypeScript | architecture.md |
| Styling | Tailwind CSS + CSS vars | design-system.md, globals.css |
| Backend | NestJS 10 | architecture.md, package.json |
| Database | PostgreSQL 16 | prisma schema, docker-compose |
| ORM | Prisma 5 | prisma/schema.prisma |
| Validation | class-validator / DTOs | architecture.md |
| Config | @shipping/config | ADR-006, packages/config |
| Shared | @shipping/shared (CommonJS) | ADR-011, packages/shared |
| Testing | Jest + ts-jest + supertest | CLAUDE.md, progress.md |
| Auth | JWT access (15m) + refresh token rotation | ADR-014, auth module |
| RBAC | Permission-based (module:action) | permissions.md, ADR-016 |

---

## 2. Repository Structure (CONFIRMED)

```
apps/
  api/        NestJS — REST /api/v1, modular (controller→service→prisma)
  web/        Next.js — App Router, dashboard shell, module pages
packages/
  config/     Validated env configuration
  shared/     Types, constants, formatters (CommonJS)
prisma/       Schema, migrations, seed
docs/         Documentation
design-system/ Visual language (MASTER.md + page overrides)
```

**Backend modules (apps/api/src/modules/):**
health, auth, users, roles, permissions, ports, yards, customers, currencies, cargo, yard-inventory, inspections, vessels, voyages, load-planning, actual-loading, manifest, bill (B/L), invoice, proforma, quotation, voucher, ledger, delivery-release, discharge, employee, salary, letter, job, portal

**Frontend pages (apps/web/src/app/):**
login, (dashboard)/layout, dashboard, users, roles, permissions, cargo, yard-inventory, inspections, vessels, voyages, load-lists, actual-loading, manifest, bills, invoices, proformas, quotations, vouchers, ledger, delivery-orders, release-orders, discharges, employees, salary-records, letters, jobs, portal, bookings

---

## 3. Database Schema Analysis (FULLY READ — prisma/schema.prisma)

### 3.1 Implemented Entities (28 tables)

**Identity & Access (6):** User, RefreshToken, Role, Permission, RolePermission, UserRole

**Company (2):** CompanySettings, Currency

**Geography (2):** Port, Yard — Port has code/name/country/city, Yard has code/name/address/portId

**Operations (5):** Cargo, YardInventory, Inspection, Vessel, Voyage

**Loading (2):** LoadList, LoadListItem

**Actual Loading (2):** ActualLoading, ActualLoadingItem

**Documents (6):** Manifest, ManifestItem, BillOfLading, BillOfLadingItem, Invoice, InvoiceItem

**Commercial (3):** Proforma, ProformaItem, Quotation, QuotationItem

**HR (2):** Employee, SalaryRecord

**Finance (1):** Voucher

**Release (2):** DeliveryOrder, ReleaseOrder

**Correspondence (1):** Letter

**Job Costing (2):** Job, JobCostItem

**Agent Portal (1):** BookingRequest

### 3.2 Critical Schema Gaps vs Employer Requirements

| Gap | Evidence | Impact |
|-----|----------|--------|
| No separate Shipper table | Customer.type = SHIPPER exists but no `Shipper` model | CONFLICT: employer says Customer ≠ Shipper |
| No separate Consignee table | Customer.type = CONSIGNEE exists but no `Consignee` model | CONFLICT: employer says Customer ≠ Consignee |
| No separate Agent table | Customer.type = AGENT exists but no `Agent` model | CONFLICT: employer says Agent is not User, scoped to destination |
| No Tug entity | Manifest sample shows "Tug: LAYAN GULF" separate from Barge | GAP: vessel composition not modeled |
| No Barge entity | Manifest sample shows "Barge: MEHDI 11" | GAP: vessel composition not modeled |
| No Landing Craft entity | Employer mentions Landing Craft as vessel type | GAP |
| No Port.abbreviation | Employer wants HAM for Hamriyah in load lists | GAP: abbreviation field missing |
| No GeneralJournal/Entry | Employer requires GJ for non-invoice transactions | GAP: no GJ model at all |
| No DocumentTemplate | ADR-009 designs it but not in schema | GAP: templates are design-only |
| No NumberingSequence | ADR-008 designs it but not in schema | GAP: numbering is hard-coded per module |
| No AuditLog | ADR-010 designs it but not in schema | GAP: audit is design-only |
| No CurrencyRate | ADR mentions multi-currency but no rate table | GAP: exchange rates not modeled |
| No Voyage cost tracking | Employer wants Voyage P&L (revenue - costs) | GAP: costs not linked to Voyage |
| No DocumentAttachment | Employer wants file storage per document | GAP |

### 3.3 Schema Issues (Implemented Incorrectly)

1. **Manifest.shipperId/ConsigneeId/AgentId are Customer FKs** — but one manifest has 12+ different shippers/consignees. The current model forces single shipper/consignee per manifest. INCORRECT.

2. **ManifestItem has shipperId/consigneeId/agentId as Customer FKs** — same problem. Each item should reference independent Shipper/Consignee/Agent, not Customer.

3. **BillOfLading.shipperId/ConsigneeId are Customer FKs** — same issue. B/L sample shows shipper = "RAS AL KHAIMAH MACHINERIES LLC" which may not be the Customer.

4. **Voucher.invoiceId is single FK** — ledger sample shows receipt 2026/477 covering INV 1517 AND 1526 (multi-invoice payment). Current model can't represent this. INCORRECT.

5. **Invoice has no Job link** — employer says invoice should be matchable to Job Numbers. GAP.

6. **Invoice tax model: single taxRate on header** — evidence shows per-line VAT (each line has VAT % and VAT Amount). INCORRECT: should be per-line.

7. **Manifest.VoyageId unique index (application-level)** — employer says manifest is per voyage. This matches. CORRECT.

8. **B/L requires Manifest** — current code: B/L created against Manifest. Employer: B/L first, then Manifest from B/Ls. CONFLICT in ordering.

9. **Cargo has customerId** — this is correct per employer (Cargo belongs to Customer). But Cargo also needs shipper/consignee references for B/L generation.

10. **BookingRequest for Agent Portal** — Agent submits bookings, not B/L/document access. GAP vs employer: agent needs to see B/L, Release, documents.

---

## 4. API Analysis (from architecture.md + progress.md)

### 4.1 API Structure
- Base: `/api/v1`
- Auth: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Public: `/health`, `/api/v1` (metadata)
- All other endpoints require JWT + PermissionsGuard

### 4.2 Module Endpoints (implemented)

**Cargo:** list, get, create, update, transition (PATCH /:id/status), remove (DELETE)
**YardInventory:** list, get, place (POST), update (PATCH), remove (DELETE)
**Inspection:** list, get, historyByCargo, create, update, approve (POST), reject (POST)
**Vessel:** list, get, create, update, activate (PATCH /:id/active)
**Voyage:** list, get, create, update, schedule (POST), start (POST), complete (POST), cancel (POST)
**LoadList:** list, get, eligible-cargo, create, update, addItems, finalize (POST), cancel (POST)
**ActualLoading:** list, get, create, update, remove, updateItem, updateItemsBulk, removeItem, start (POST), complete (POST), cancel (POST)
**Manifest:** list, get, eligible-cargo, create, update, delete, submit (POST), approve (POST), cancel (POST)
**BillOfLading:** list, get, create, update, remove, addItem, updateItem, removeItem, eligible-items, issue (POST), cancel (POST)
**Invoice:** list, get, create, update, remove, addItem, updateItem, removeItem, issue (POST), cancel (POST)
**Proforma:** list, get, create, update, remove, addItem, updateItem, removeItem, issue (POST), cancel (POST), convert (POST)
**Quotation:** list, get, create, update, remove, addItem, updateItem, removeItem, send (POST), accept (POST), reject (POST), cancel (POST), convert (POST)
**Voucher:** list, get, create, update, remove, cancel (POST)
**Ledger:** GET /ledger/customers (derived statement)
**DeliveryOrder:** list, get, create, cancel (POST)
**ReleaseOrder:** list, get, create, cancel (POST), eligibility (GET /release-orders/eligibility?billOfLadingId=)
**Discharge:** list, get, create, start (POST), complete (POST), cancel (POST), updateItem (PUT)
**Employee:** list, get, create, update, remove
**SalaryRecord:** list, get, create, approve (POST), pay (POST), cancel (POST)
**Letter:** list, get, create, update, send (POST), reply (POST), archive (POST)
**Job:** list, get, create, update, remove, addItem, updateItem, removeItem, start (POST), complete (POST), cancel (POST)
**Portal:** GET /portal/me, GET/POST /portal/bookings, POST /portal/bookings/:id/cancel, GET /portal/shipments, GET /portal/statement, GET /portal/ports
**Office Desk:** GET/POST /bookings, GET /bookings/:id, POST /bookings/:id/respond

### 4.3 Missing API Endpoints (vs Employer Requirements)

- No Shipper CRUD
- No Consignee CRUD
- No Agent CRUD
- No Port.abbreviation field
- No Tug/Barge CRUD
- No General Journal CRUD
- No DocumentTemplate CRUD
- No NumberingSequence management
- No AuditLog query
- No Voyage cost tracking API
- No multi-invoice voucher allocation
- No per-destination B/L numbering
- No B/L document versioning
- No file attachment API for documents
- No agent B/L/document download API

---

## 5. Frontend/UI Analysis

### 5.1 Current UI State
- Next.js 14 App Router with (dashboard) route group
- Sidebar navigation with module groups (Operations, Finance, Commercial, HR, Correspondence, Portal)
- Each module has list page + create/edit dialogs + detail dialogs
- Permission-gated rendering (hasPermission)
- RTL support for fa, ar locales
- 3 locales: fa, en, ar (next-intl)
- Design system: semantic HSL tokens, Tailwind utilities
- Components: Button, Badge, Card, Alert, Dialog, ConfirmDialog, Sheet, Breadcrumbs, Loading, EmptyState, ErrorState
- Tables: custom implementations per page (no shared table component)
- Forms: custom per page (no shared form component)
- Icons: lucide-react
- Font: Inter (Google Fonts)

### 5.2 UI Gaps vs Employer Requirements

1. **No Customer 360 profile page** — Customer exists but no unified profile showing jobs, cargo, B/L, invoices, payments, ledger, balance
2. **No dashboard KPIs** — dashboard page exists but shows app health, not business KPIs (cargo in yard, ready for loading, pending inspection, etc.)
3. **No Shipper/Consignee/Agent management pages** — these are embedded in Customer with type field
4. **No Port abbreviation display** — field doesn't exist
5. **No Tug/Barge management**
6. **No General Journal UI**
7. **No document template upload/management UI**
8. **No file attachment UI for documents**
9. **No Voyage P&L / report pages**
10. **No VAT report page**
11. **No agent B/L/document view UI** — agent portal only has bookings/shipments/statement
12. **No multi-invoice payment allocation UI** — voucher creation links single invoice
13. **No B/L draft/review/approved/final workflow UI** — B/L has DRAFT/ISSUED/CANCELLED, missing REVIEW step and Released/Unreleased distinction
14. **No manifest B/L-row UI** — manifest items reference cargo directly, not B/Ls
15. **No printing/PDF UI per document** — print is per-page, not template-driven

---

## 6. Permissions Analysis

**Current permissions: 147 total (from memory/CLAUDE.md)**

Seeded modules with permissions:
- dashboard:read
- user:read/create/update/activate/roles
- role:read/create/update/activate/permissions
- permission:read
- port:read/create/update
- yard:read/create/update
- customer:read/create/update
- currency:read
- cargo:read/create/update/transition/delete
- yard-inventory:read/create/update/remove
- inspection:read/create/update/approve/reject
- vessel:read/create/update/activate
- voyage:read/create/update/schedule/start/complete/cancel
- load_list:read/create/update/delete/finalize/cancel
- actual_loading:read/create/update/delete/complete/cancel
- manifest:read/create/update/delete/submit/approve/cancel
- bill:read/create/update/delete/issue/cancel
- invoice:read/create/update/delete/issue/cancel
- proforma:read/create/update/delete/issue/cancel/convert
- quotation:read/create/update/delete/send/accept/reject/cancel/convert
- voucher:read/create/update/delete/cancel
- ledger:read
- delivery:read/create/update/delete/cancel
- release:read/create/update/delete/cancel/release:override
- discharge:read/create/update/delete/complete/cancel
- employee:read/create/update/delete
- salary:read/create/approve/pay/cancel
- letter:read/create/update/delete/send/archive
- job:read/create/update/delete/start/complete/cancel
- portal:access, booking:create, booking:read, booking:respond

### 6.1 Missing Permissions

- shipper:read/create/update
- consignee:read/create/update
- agent:read/create/update (scoped to destination)
- port:read-abbreviation (or just add field)
- tug:read/create/update
- barge:read/create/update
- general-journal:read/create
- document-template:read/create/update
- numbering-sequence:read/manage
- audit-log:read
- voyage-cost:read/create
- document-attachment:upload/download
- agent:bill-read, agent:release-read, agent:manifest-read, agent:document-download

---

## 7. Design System Assessment

**Current state:**
- Semantic color tokens implemented (HSL variables in globals.css)
- Primary = tracking-blue (#2563EB)
- Status colors: success/warning/info/destructive (semantic only)
- Typography: Inter via next/font/google
- Spacing: Tailwind scale
- Border radius: design system tokens
- Financial UX: tabular-nums, right-align, mono for reference numbers

**Current UI does NOT yet match employer's future UI vision:**
- Employer wants: mobile-responsive, collapsible sidebar, grey/neutral palette, tasteful gradients, elegant cards, polished tables, strong forms, status indicators, responsive navigation
- Current: desktop-first operational UI, blue primary, basic tables/forms

---

## 8. Business Logic Assessment

### 8.1 What's CORRECT in current implementation

1. **Cargo lifecycle state machine** (ADR-019): REGISTERED → AT_YARD → READY → LOADED → DELIVERED, with CANCELLED terminal. READY requires inspectionStatus=APPROVED. CORRECT.
2. **Inspection lifecycle** (ADR-024/025): PENDING → APPROVED/REJECTED, single pending per cargo, history preserved. CORRECT.
3. **Voyage state machine** (ADR-026): DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED, overlap guard. CORRECT.
4. **One yard inventory record per cargo** (ADR-020): @@unique cargoId. CORRECT.
5. **Manifest one-per-voyage** (ADR-029): application-level guard. CORRECT.
6. **B/L one-live-bill-per-manifest-line** (ADR-030): application-level. CORRECT.
7. **Quotation → Proforma → Invoice chain** (ADR-034/035): full conversion flow. CORRECT.
8. **Release money rule** (ADR-033): all invoices paid before release, override with reason. CORRECT.
9. **Salary self-contained** (ADR-036): no voucher/ledger contamination. CORRECT.
10. **JWT + refresh token rotation** (ADR-014): secure auth. CORRECT.
11. **Permission re-resolution per request** (ADR-014): immediate revocation. CORRECT.

### 8.2 What's INCORRECT or MISSING

1. **Customer = Shipper/Consignee/Agent** — WRONG. Employer explicitly says they're separate.
2. **B/L before Manifest ordering** — WRONG. Code does Manifest→B/L, employer wants B/L→Manifest.
3. **Global numbering** — WRONG. Employer wants per-destination (KHS/26-110).
4. **Invoice per-line VAT** — WRONG. Current: header-level taxRate. Evidence: per-line VAT % and amount.
5. **Single invoice per voucher** — WRONG. Evidence: receipt 2026/477 covers INV 1517 AND 1526.
6. **Manifest single shipper/consignee** — WRONG. Evidence: 12+ parties in one manifest.
7. **No Tug/Barge** — MISSING. Evidence: manifest has Tug LAYAN GULF + Barge MEHDI 11.
8. **No Port abbreviation** — MISSING. Employer wants HAM, etc.
9. **No General Journal** — MISSING. Employer requires it.
10. **No Job-Invoice link** — MISSING. Employer wants invoice matched to Job.
11. **Agent portal limited to bookings** — MISSING. Employer wants agent to see B/L, Release, documents.
12. **No document templates** — MISSING. Employer wants uploadable templates.
13. **No multi-currency exchange rates** — MISSING.
14. **No Voyage cost tracking** — MISSING. Employer wants Voyage P&L.
15. **No document attachments** — MISSING.

---

## 9. Phase 20 Agent Portal — Detailed Analysis

### 9.1 What's implemented
- BookingRequest model (BRK-YYMM-#####)
- Agent submits booking requests
- Office desk reviews/responds (ACCEPTED/DECLINED)
- Agent sees: bookings, shipments (manifests), statement, ports
- Portal me: company + summary (bookingsTotal, pending, approvedManifests, balanceDue)

### 9.2 What's MISSING from Agent Portal
- Agent CANNOT see B/L documents
- Agent CANNOT see Release Orders
- Agent CANNOT see individual cargo
- Agent CANNOT download/print documents
- Agent CANNOT upload documents
- Agent CANNOT add comments to documents
- Agent CANNOT see invoice details
- Agent CANNOT see payment status per B/L

This is a MAJOR gap. Employer explicitly says agent should see B/L, Release, and possibly Manifest and Delivery Order for their destination.

---

## 10. Codebase Memory / Graphify

- Graphify output: graphify-out/GRAPH_REPORT.md, graph.json (6.3MB), manifest.json (86KB)
- Codebase Memory: .codebase-memory/graph.db (SQLite, 34MB)
- Both available for entity/relationship exploration
- Not re-indexed for this audit — existing index used for module discovery

---

*Stage 3 of 8 — completed and persisted.*
