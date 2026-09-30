# 04 Requirement Traceability Matrix

**Stage 4 complete.** Maps each employer requirement to current implementation status across business evidence, project docs, database, backend/API, and frontend/UI.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| CONFIRMED + IMPLEMENTED | Employer requirement is confirmed AND correctly implemented |
| CONFIRMED + PARTIAL | Confirmed requirement is partially implemented; critical gaps remain |
| CONFIRMED + MISSING | Confirmed requirement is not implemented at all |
| IMPLEMENTED BUT INCORRECT | Something exists but behaves contrary to employer requirements |
| CONFLICTING | Employer requirement directly contradicts current implementation |
| UNCLEAR | Requirement mentioned but not sufficiently specified to evaluate |
| INFERRED | Requirement inferred from document evidence, not explicitly stated |
| LEGACY ONLY | Exists in legacy docs only, not yet in current implementation |
| OPEN BUSINESS DECISION | Employer has not decided; cannot be implemented until resolved |

---

## 1. Customer / Customer 360

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Customer is the internal commercial counterparty. Must see jobs, invoices, payments, receipts, ledger, balance, cargo/shipment history, B/L history, comments, activity history. This is one of the most important management pages. |
| **Evidence/source** | Stage 1 §6.1; Stage 2 §9.8; duna_source_pack.md Part 1 ("Customer برای ما رکن اصلی است") |
| **Current implementation** | Customer model exists with relations to Cargo, Manifest, B/L, Invoice, Proforma, Quotation, Letter, Job, DeliveryOrder, Voucher. No unified 360 profile page exists. |
| **Relevant source location** | `prisma/schema.prisma` Customer model (lines 257-295); `apps/web/src/app/` — no customer 360 page; `apps/api/src/modules/customers/` — CRUD only |
| **Database support** | ✅ Customer table with all needed FK relations (7 relations covering Cargo, Manifest, B/L, Invoice, Proforma, Quotation, Letter, Job, DeliveryOrder, Voucher, Bookings, portalUsers) |
| **API/backend support** | ⚠️ Customer CRUD endpoints exist (`list, get, create, update, activate`). No aggregated 360 endpoint (no combined query for ledger + invoices + payments + cargo history + B/L history). |
| **UI support** | ❌ No Customer 360 profile page. Customer list page exists but shows basic list, no profile/dashboard. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Database has all relations. API lacks aggregated 360 query. UI lacks profile page entirely. No dashboard KPIs for customer (balance, last invoice, paid/unpaid/partial status). |
| **Required change** | 1) Add GET /customers/:id/360 endpoint aggregating ledger entries, invoices, vouchers, cargo, B/Ls, jobs. 2) Build Customer 360 profile UI page with tabs: Overview, Cargo, Documents (B/L, Manifest, Invoice), Financial (Ledger, Payments, Balance), Jobs, Activity. 3) Add KPIs: customer balance, last invoice date, payment status. |
| **Dependencies** | Ledger statement API (existing GET /ledger/customers can be scoped per customer); Invoice paidAmount aggregation; Voucher customer linking (exists). |
| **Acceptance criteria** | Customer 360 page shows: basic info, open/closed invoices list with paid amounts, voucher/payment history, ledger statement (debit/credit/balance), cargo list with status, B/L list, job list, running balance. All data from live API, no static mock. |

---

## 2. Shipper (separate master data)

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Shipper is a separate master data entity. Sends cargo in transport documents. Name, National ID/TRN (optional), Address, Contact, Email. Used in B/L and Manifest. NOT the same as Customer. |
| **Evidence/source** | Stage 1 §3, §6.2; Stage 2 §9.5; duna_source_pack.md Part 4 ("Customer با Shipper و Consignee یکی نیست") |
| **Current implementation** | ❌ No Shipper model. Customer.type field has SHIPPER value but this is INCORRECT per employer. B/L.shipperId is a Customer FK. Manifest.shipperId is a Customer FK. ManifestItem has NO shipper reference (relies on manifest header or cargo). |
| **Relevant source location** | `prisma/schema.prisma` Customer model.type field (line 262); `BillOfLading.shipperId` (line 1059) is Customer FK; `Manifest.shipperId` (line 926) is Customer FK |
| **Database support** | ❌ No Shipper table. B/L and Manifest reference Customer as shipper (incorrect). |
| **API/backend support** | ❌ No Shipper CRUD API. |
| **UI support** | ❌ No Shipper management page. |
| **Current status** | **CONFLICTING** |
| **Gap** | Core model conflict: Customer is used as Shipper everywhere. B/L sample shows shipper = "RAS AL KHAIMAH MACHINERIES LLC" which is not necessarily a Customer. Manifest has 12+ shippers — impossible with single Customer FK per manifest. |
| **Required change** | 1) Create Shipper model (id, code, name, nationalId, trn, address, contactName, phone, email, country, isActive, timestamps). 2) Migrate B/L.shipperId and Manifest.shipperId from Customer FK to Shipper FK. 3) Add Shipper CRUD endpoints. 4) Build Shipper management UI. 5) Update Cargo intake form to select Shipper separately from Customer. |
| **Dependencies** | B/L module rewrite (shipper FK change); Manifest module rewrite (shipper FK change); Cargo intake form update; B/L generation logic update. |
| **Acceptance criteria** | Shipper CRUD works. B/L can reference Shipper independently of Customer. Manifest can reference Shipper independently. One manifest can have multiple shippers (items reference shipper directly). B/L sample data (KHS/26-110) can be represented: Shipper = RAS AL KHAIMAH MACHINERIES LLC, Customer = different entity. |

---

## 3. Consignee (separate master data)

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Consignee is a separate master data entity. Receiving party at destination in transport document. Same structure as Shipper. NOT the same as Customer. |
| **Evidence/source** | Stage 1 §3, §6.2; Stage 2 §9.6; duna_source_pack.md Part 4 |
| **Current implementation** | ❌ No Consignee model. Customer.type = CONSIGNEE exists but INCORRECT. B/L.consigneeId is Customer FK. Manifest.consigneeId is Customer FK. |
| **Relevant source location** | `prisma/schema.prisma` Customer.model.type (line 262); `BillOfLading.consigneeId` (line 1060); `Manifest.consigneeId` (line 927) |
| **Database support** | ❌ No Consignee table. |
| **API/backend support** | ❌ No Consignee CRUD API. |
| **UI support** | ❌ No Consignee management page. |
| **Current status** | **CONFLICTING** |
| **Gap** | Same as Shipper — Customer used as Consignee everywhere. Manifest has 12+ different consignees in one document — impossible with single Customer FK per manifest header. |
| **Required change** | 1) Create Consignee model (same structure as Shipper: id, code, name, nationalId, trn, address, contactName, phone, email, country, isActive, timestamps). 2) Migrate B/L.consigneeId and Manifest.consigneeId to Consignee FK. 3) Add Consignee CRUD endpoints. 4) Build Consignee management UI. 5) Update B/L generation to select Consignee separately. |
| **Dependencies** | Same as Shipper — B/L and Manifest FK migrations. |
| **Acceptance criteria** | Consignee CRUD works. B/L can reference Consignee independently. Manifest sample (KHS/26-110): Consignee = JOINT MECHANIC CO (national ID 10100670462) represented correctly. One manifest can have multiple consignees via items. |

---

## 4. Agent (separate master data)

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Agent is a destination representative/port agent. Separate master data. Per-destination: Agent Bandar Abbas for B/Ls to Bandar Abbas, Agent Bushehr for B/Ls to Bushehr. NOT a regular User. Scoped to destination. Name, Address, Contact, Email. |
| **Evidence/source** | Stage 1 §3, §6.8; Stage 2 §9.7; Stage 2 §12; duna_source_pack.md Part 4; B/L sample: Destination Agent = BADBAN ARVAND ROOD SHIPPING CO, Khorramshahr |
| **Current implementation** | ❌ No Agent model. Customer.type = AGENT exists but INCORRECT. Current Agent Portal uses Customer as the agent company (BookingRequest.customerId = Customer FK). Agent Portal only supports bookings — NOT B/L/document access. |
| **Relevant source location** | `prisma/schema.prisma` Customer.type field (line 262); `BookingRequest.customerId` (line 865) uses Customer FK for agent; Agent Portal: `apps/api/src/modules/portal/`, `apps/web/src/app/portal/` |
| **Database support** | ❌ No Agent table. BookingRequest uses Customer as agent (acceptable as separate Agent model is still needed). Manifest.agentId is Customer FK (incorrect). |
| **API/backend support** | ❌ No Agent CRUD API. Agent Portal API only has: GET/POST /portal/bookings, GET /portal/shipments, GET /portal/statement, GET /portal/ports, GET /portal/me |
| **UI support** | ❌ No Agent management page. Agent Portal UI: bookings list, shipments list, statement, ports. No B/L view, no Release view, no document download. |
| **Current status** | **CONFLICTING** |
| **Gap** | Agent model missing entirely. Agent Portal scope is bookings only — employer explicitly says agent needs B/L, Release status, payment status, document access for their destination. |
| **Required change** | 1) Create Agent model (id, code, name, address, contactName, phone, email, destinationPortId, country, isActive, timestamps). 2) Migrate Manifest.agentId from Customer FK to Agent FK. 3) Add Agent CRUD endpoints (scoped by destination). 4) Build Agent management UI. 5) **Major**: Extend Agent Portal to include: B/L list (filtered by agent's destination port), Release Order status, Manifest list (if needed), individual B/L detail view, document download/print, payment status per B/L, cargo visibility (if needed). 6) Add permissions: agent:bill-read, agent:release-read, agent:manifest-read, agent:document-download, agent:bill-download. |
| **Dependencies** | Agent model creation; B/L/Manifest FK migration; Agent Portal API extension; Agent Portal UI extension; new permissions. |
| **Acceptance criteria** | Agent Khorramshahr logs into portal → sees only B/Ls for POD = Khorramshahr. Can view B/L detail (shipper, consignee, cargo, vessel, voyage, freight). Can see Release Order status per B/L. Can see payment status. Can download/print B/L document. Cannot see non-destination documents. Agent is NOT a regular User — separate model, no dashboard access. |

---

## 5. Port

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Port master data: Name, City, Country, **Abbreviation** (e.g. HAM for Hamriyah). Abbreviation used in Load Lists to save space. Ports filter Yards. |
| **Evidence/source** | Stage 1 §7.4; Stage 2 §9.1, §10.1; duna_source_pack.md Part 2; B/L sample: POL = HAMRIYA PORT, DUBAI, UAE |
| **Current implementation** | ✅ Port model exists: id, code, name, country, city, isActive, timestamps. ✅ Port→Yards relationship exists. ❌ Port.abbreviation field MISSING. |
| **Relevant source location** | `prisma/schema.prisma` Port model (lines 208-232) |
| **Database support** | ✅ Port model with code/name/country/city. ✅ Yard.portId FK. ✅ Port→Yards relation. ❌ No abbreviation field. |
| **API/backend support** | ✅ Port CRUD endpoints (list, get, create, update, activate). Port list returns all fields except abbreviation. |
| **UI support** | ✅ Port management page exists. ❌ Abbreviation field not shown (doesn't exist). |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Port.abbreviation field missing. Employer wants HAM, JEA, etc. for compact display in Load Lists. |
| **Required change** | 1) Add `abbreviation` field to Port model (String, nullable, indexed). 2) Run migration. 3) Seed existing ports with abbreviations (HAM for Hamriyah, JEA for Jebel Ali, etc.). 4) Update Port management UI to show/edit abbreviation. 5) Update Load List UI to display port abbreviation. |
| **Dependencies** | Migration; seed update. |
| **Acceptance criteria** | Port Hamriyah has abbreviation "HAM". Load List displays port as "HAM" not "Hamriyah Port". Port creation/edit includes abbreviation field. |

---

## 6. Yard

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Yard belongs to Port. Selecting Port shows only related Yards. Yard code (e.g. F15 for Hamriyah). Name, address. |
| **Evidence/source** | Stage 1 §7.4; Stage 2 §9.2; duna_source_pack.md Part 5; Stage 3 §3.1 |
| **Current implementation** | ✅ Yard model: id, portId, code, name, address, isActive, timestamps. ✅ Yard→Port relation. ✅ Port filters Yards (in UI via API). |
| **Relevant source location** | `prisma/schema.prisma` Yard model (lines 234-251); Cargo model.portId/yardId; YardInventory model |
| **Database support** | ✅ Yard.portId FK. ✅ Yard.code unique. |
| **API/backend support** | ✅ Yard CRUD endpoints (list, get, create, update, activate). List filtered by port. |
| **UI support** | ✅ Yard management page. ✅ Cargo intake form filters yards by selected port. |
| **Current status** | **CONFIRMED + IMPLEMENTED** |
| **Gap** | None significant. Yard→Port relationship and filtering work correctly. |
| **Required change** | None — already correct. Minor: ensure yard code is displayed prominently in operational views. |
| **Dependencies** | None. |
| **Acceptance criteria** | Creating a cargo shows only yards belonging to selected port. Yard code (e.g. F15) is visible in cargo list and yard inventory views. |

---

## 7. Vessel

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Vessel is an asset/master record. Vessel Name, Types include Tug, Barge, Landing Craft, Vessel. IMO Number (optional). Used in Loading List, B/L, Manifest. Vessel ≠ Voyage (Vessel is asset, Voyage is sailing event). |
| **Evidence/source** | Stage 1 §7.5; Stage 2 §9.3; Stage 2 §3.1 (Manifest shows Barge: MEHDI 11, Tug: LAYAN GULF); duna_source_pack.md Part 2 |
| **Current implementation** | ✅ Vessel model: id, code, name, imo, flag, vesselType (enum: CONTAINER/BULK/TANKER/RORO/GENERAL/PROJECT/OTHER), capacityTeu, isActive, notes, timestamps. ✅ Vessel→Voyage relation. ⚠️ VesselType enum does NOT include TUG, BARGE, LANDING_CRAFT. Vessel is a single entity — no separate Tug/Barge models. |
| **Relevant source location** | `prisma/schema.prisma` Vessel model (lines 480-501); VesselType enum (lines 622-630) |
| **Database support** | ✅ Vessel model. ⚠️ VesselType enum missing TUG, BARGE, LANDING_CRAFT. No separate Tug/Barge entities — employer evidence shows Tug and Barge as separate named entities (LAYAN GULF = tug, MEHDI 11 = barge). |
| **API/backend support** | ✅ Vessel CRUD endpoints (list, get, create, update, activate). |
| **UI support** | ✅ Vessel management page. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | 1) VesselType enum missing TUG, BARGE, LANDING_CRAFT. 2) No separate Tug/Barge entities — manifest evidence clearly shows Tug: LAYAN GULF and Barge: MEHDI 11 as separate entities. Employer wants Tug & Barge as vessel types (possibly separate records). 3) Voyage references single Vessel — but manifest shows Barge + Tug pair. If Tug/Barge are separate vessels, Voyage needs to reference both (or the composition needs modeling). |
| **Required change** | 1) Add TUG, BARGE, LANDING_CRAFT to VesselType enum. 2) **OPEN BUSINESS DECISION**: Determine if Tug/Barge are: (a) two separate Vessel records linked to one Voyage, (b) one Vessel record with a "tug" reference, or (c) Voyage has tugVesselId + bargeVesselId fields. 3) Update Voyage model if needed for tug/barge pairing. 4) Update Manifest to show tug/barge names. 5) Update B/L to show vessel composition. |
| **Dependencies** | **OPEN BUSINESS DECISION** on tug/barge modeling. Voyage model may need changes. Manifest/B/L display updates. |
| **Acceptance criteria** | Vessel types include TUG, BARGE, LANDING_CRAFT. Manifest DSMAN/KHO-26-006 can be represented: Barge = MEHDI 11 (Vessel record), Tug = LAYAN GULF (Vessel record). Voyage references correct vessel composition. B/L shows vessel name(s). |

---

## 8. Voyage

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Voyage is an operational sailing event. Auto-generated per destination (Voyage 1/26, 2/26 per destination). Format: Voyage number + destination-based. Vessel + 2 active ports. States: DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED, CANCELLED from DRAFT/SCHEDULED. |
| **Evidence/source** | Stage 1 §7.5; Stage 2 §9.4; duna_source_pack.md Part 2; B/L sample: Voyage 02/26 |
| **Current implementation** | ✅ Voyage model: id, voyageNumber (VOY-YYMM-#####), vesselId, status (DRAFT/SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED), originPortId, destinationPortId, plannedDepartureAt, plannedArrivalAt, cancelReason, notes, timestamps. ✅ State machine enforced. ✅ Overlap guard. ⚠️ Voyage numbering is global (VOY-YYMM-#####), NOT per-destination. Employer wants Voyage 1/26, 2/26 per destination. |
| **Relevant source location** | `prisma/schema.prisma` Voyage model (lines 529-562); VoyageStatus enum (lines 635-641) |
| **Database support** | ✅ Voyage model complete. ⚠️ voyageNumber format is global, not per-destination. |
| **API/backend support** | ✅ Voyage CRUD + state operations (list, get, create, update, schedule, start, complete, cancel). |
| **UI support** | ✅ Voyage management page. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Voyage numbering is global (VOY-YYMM-#####). Employer wants per-destination numbering (1/26, 2/26 for Khorramshahr; separate sequence for Bandar Abbas, etc.). Also: Voyage auto-generation per destination — employer wants system to auto-create Voyage 1/26 when first voyage for that destination in that year is created. |
| **Required change** | 1) **OPEN BUSINESS DECISION**: Confirm per-destination voyage numbering format. 2) Add destinationPortId-based numbering sequence. 3) Add auto-increment per destination per year. 4) Update Voyage creation to use destination-based numbering. |
| **Dependencies** | Numbering sequence infrastructure (ADR-008 design, not implemented). |
| **Acceptance criteria** | First voyage for Khorramshahr in 2026 = "1/26" or "KHO-1/26". Second = "2/26". Bandar Abbas voyages have separate sequence. Voyage number is visible in B/L, Manifest, Invoice references. |

---

## 9. Cargo

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Cargo is operational unit. Full audit trail from receipt to delivery. Fields: Customer, Shipper, Consignee, Description, Chassis/Serial, Units/Packages, Weight, POL, Destination, Yard, Arrival Date, Documents, Comment. Cargo belongs to Customer. Port→Yards filtering. |
| **Evidence/source** | Stage 1 §6.2; Stage 2 §10.1; duna_source_pack.md Part 1 & 5 |
| **Current implementation** | ✅ Cargo model: id, reference (CRG-XXXXXXXX), customerId FK, portId, yardId, destinationPortId, cargoType (enum), specification, serialNumber, chassisNumber, vin, weight (Decimal), weightUnit (KG/MT), quantity, packages, packageType, arrivalDate, arrivalReference, inspectionStatus (PENDING/APPROVED/REJECTED), loadingStatus (NOT_LOADED/LOADED), manifestNumber, status (REGISTERED/AT_YARD/READY/LOADED/DELIVERED/CANCELLED), comments, timestamps. ✅ State machine enforced (ADR-019). ✅ READY requires inspectionStatus=APPROVED. ⚠️ Cargo has customerId but NO shipperId/consigneeId — employer wants Shipper and Consignee on cargo intake form. |
| **Relevant source location** | `prisma/schema.prisma` Cargo model (lines 313-367); CargoStatus enum (lines 569-576); InspectionStatus enum (lines 590-594) |
| **Database support** | ✅ Cargo model comprehensive. ⚠️ Missing shipperId and consigneeId FK fields. Cargo.customerId is correct (Cargo belongs to Customer). |
| **API/backend support** | ✅ Cargo CRUD + transition endpoint (PATCH /:id/status). ✅ Eligible cargo for load list. ⚠️ Cargo creation form doesn't include Shipper/Consignee selection (those models don't exist). |
| **UI support** | ✅ Cargo list page. ✅ Cargo create/edit dialog. ✅ Transition UI. ⚠️ Shipper/Consignee fields not in form. ✅ Port→Yard filtering works. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Cargo lacks shipperId and consigneeId. Cargo intake form doesn't capture Shipper/Consignee. This is needed for B/L generation. Cargo's customerId is correct. |
| **Required change** | 1) Add shipperId and consigneeId to Cargo model (both nullable, FK to Shipper/Consignee after those models exist). 2) Update Cargo intake form to include Shipper and Consignee dropdowns. 3) Ensure Cargo→Shipper/Consignee relations exist for B/L auto-population. |
| **Dependencies** | Shipper and Consignee models must be created first. |
| **Acceptance criteria** | Cargo intake form: Customer (required), Shipper (dropdown), Consignee (dropdown), Description, Chassis/Serial, Units/Packages, Weight, Weight Unit, POL (Port), POD (Destination Port), Yard (filtered by POL), Arrival Date, Documents, Comment. Shipper/Consignee pre-populated from B/L when generated. |

---

## 10. Inspection

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Inspection: Booked → Pending → Done. Inspection = DONE is prerequisite for Loading List. Result: Done or Failed/Recheck? Who approves? Report exists? |
| **Evidence/source** | Stage 1 §6.3; Stage 2 §10.2; duna_source_pack.md Additional (Cargo registration, Inspection) |
| **Current implementation** | ✅ Inspection model: id, inspectionNumber (INS-YYMM-#####), cargoId FK, status (PENDING/APPROVED/REJECTED), inspectionDate, inspectorId, inspectorName, findings, condition, verificationNotes, remarks, rejectionReason, approvedById/At, rejectedById/At, timestamps. ✅ State machine: PENDING → APPROVED | REJECTED (both terminal). ✅ Single pending per cargo (service check + partial unique index). ✅ Cargo.inspectionStatus updated in same transaction. ✅ History preserved (reinspection = new record). |
| **Relevant source location** | `prisma/schema.prisma` Inspection model (lines 427-460); InspectionStatus enum (lines 590-594); ADR-024, ADR-025 |
| **Database support** | ✅ Full Inspection model with history ledger pattern. ✅ Partial unique index for pending exclusivity. |
| **API/backend support** | ✅ Inspection endpoints: list, get, historyByCargo, create, update, approve, reject. ✅ isCargoInspectionApproved() readiness check. |
| **UI support** | ✅ Inspection list page. ✅ Create/edit dialog. ✅ Approve/reject actions. ⚠️ Inspection status values differ from employer preference: current = PENDING/APPROVED/REJECTED; employer wants Pending → Booked → Done → Failed/Need Reinspection. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | 1) Status values differ: employer wants "Booked" as a separate status before "Done", and "Failed/Need Reinspection" as a result. Current: PENDING/APPROVED/REJECTED. 2) Employer: "Who approves? Report exists?" — unclear if approval needs a report attachment or just inspector name. 3) Inspection=Done is prerequisite for Loading List — current implementation uses APPROVED, which maps to Done. This is functionally correct but terminology differs. |
| **Required change** | 1) **OPEN BUSINESS DECISION**: Confirm inspection status values and whether "Failed/Recheck" is a separate status or just REJECTED with a reason. 2) Confirm if inspection requires a report attachment. 3) If employer confirms "Booked" as distinct status, add it to InspectionStatus enum and state machine. 4) Update UI terminology to match employer language if confirmed. |
| **Dependencies** | **OPEN BUSINESS DECISION** on inspection flow details. |
| **Acceptance criteria** | Only cargo with inspection status = DONE/APPROVED can be added to Loading List. Inspection history preserved. Rejected cargo can be reinspected (new inspection record). Inspector name recorded. |

---

## 11. Loading List / Load Planning

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Collection of cargo for a Vessel/Voyage. Create, edit, add/remove cargo, print/PDF, finalize, record loading status per item. Lifecycle: Draft → In Progress → Partially Loaded → Completed → Finalized. Per-cargo: Selected → Loaded / Not Loaded → Returned to Yard. |
| **Evidence/source** | Stage 1 §6.4; Stage 2 §10.3; duna_source_pack.md Additional |
| **Current implementation** | ✅ LoadList model: id, loadListNumber (LL-YYMM-#####), voyageId FK, status (DRAFT/FINALIZED/CANCELLED), notes, timestamps. ✅ LoadListItem: id, loadListId, cargoId, sequence, status (SELECTED/LOADED/NOT_LOADED/RETURNED), quantity, actualWeight, actualPackages, notes. ⚠️ LoadListStatus enum = DRAFT/FINALIZED/CANCELLED — employer wants Draft → In Progress → Partially Loaded → Completed → Finalized. ⚠️ LoadListItem status values differ from employer. ⚠️ ActualLoading exists separately (Phase 8) but LoadList finalization doesn't clearly bridge to ActualLoading. |
| **Relevant source location** | `prisma/schema.prisma` LoadList model (lines 661-681); LoadListItem model (lines 690-711); LoadListStatus enum (lines 652-656); ActualLoading model (lines 756-781) |
| **Database support** | ✅ LoadList + LoadListItem models. ✅ ActualLoading + ActualLoadingItem models. ⚠️ Status enums don't match employer lifecycle. |
| **API/backend support** | ✅ LoadList endpoints: list, get, eligible-cargo, create, update, addItems, finalize, cancel. ✅ ActualLoading endpoints: list, get, create, update, remove, updateItem, updateItemsBulk, removeItem, start, complete, cancel. ⚠️ No "In Progress" or "Partially Loaded" intermediate states. |
| **UI support** | ✅ Load List page. ✅ Actual Loading page. ⚠️ Lifecycle UI doesn't show In Progress/Partially Loaded states. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | 1) LoadList status lifecycle: current = DRAFT/FINALIZED/CANCELLED. Employer wants Draft → In Progress → Partially Loaded → Completed → Finalized. 2) LoadListItem statuses don't match employer's Selected → Loaded / Not Loaded → Returned to Yard. 3) Print/PDF for Load List not implemented. 4) ActualLoading exists but relationship to LoadList finalization flow needs verification — is ActualLoading created automatically from finalized LoadList, or manually? |
| **Required change** | 1) **OPEN BUSINESS DECISION**: Confirm LoadList lifecycle statuses. 2) Add missing statuses to LoadListStatus and LoadListItem status enums. 3) Implement Load List print/PDF (template-driven). 4) Clarify ActualLoading creation flow from finalized LoadList. 5) Update UI to show full lifecycle. |
| **Dependencies** | **OPEN BUSINESS DECISION** on lifecycle statuses. Document template system for PDF. |
| **Acceptance criteria** | Load List lifecycle: Draft (editable) → In Progress (loading started) → Partially Loaded (some cargo loaded, some not) → Completed (all loaded) → Finalized (locked). Each cargo: Selected → Loaded / Not Loaded → Returned to Yard. Load List printable as PDF. ActualLoading created from finalized Load List. |

---

## 12. Actual Loading

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Record what was actually loaded vs planned. Per-cargo loading result. Unloaded cargo removed and returned to Yard Inventory automatically. |
| **Evidence/source** | Stage 1 §6.4; Stage 2 §10.3; duna_source_pack.md Additional |
| **Current implementation** | ✅ ActualLoading model: id, actualLoadingNumber (AL-YYMM-#####), loadListId FK (unique), status (NOT_STARTED/IN_PROGRESS/COMPLETED/CANCELLED), notes, timestamps. ✅ ActualLoadingItem: id, actualLoadingId, loadListItemId (unique), cargoId, loadedQuantity, loadingResult (FULL/PARTIAL/NOT_LOADED), notes, timestamps. ✅ Discharge model mirrors loading for POD. |
| **Relevant source location** | `prisma/schema.prisma` ActualLoading model (lines 756-781); ActualLoadingItem (lines 789-808); Discharge model (lines 812-837) |
| **Database support** | ✅ Full ActualLoading + Item models. ✅ Discharge mirror. ✅ Unique loadListId on ActualLoading. |
| **API/backend support** | ✅ ActualLoading endpoints: list, get, create, update, remove, updateItem, updateItemsBulk, removeItem, start, complete, cancel. ✅ Discharge endpoints. |
| **UI support** | ✅ Actual Loading page. ✅ Discharge page. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | 1) "Unloaded cargo returned to Yard Inventory automatically" — needs verification: does ActualLoadingItem.NOT_LOADED trigger YardInventory re-creation? 2) Loading result enum has FULL/PARTIAL/NOT_LOADED — employer wants "Loaded / Not Loaded → Returned to Yard". Functionally similar but terminology differs. 3) Print/PDF not implemented. |
| **Required change** | 1) Verify/fix automatic Yard Inventory return for NOT_LOADED items. 2) Add Load List print/PDF. 3) Align terminology with employer if confirmed. |
| **Dependencies** | YardInventory service logic verification. Document template system. |
| **Acceptance criteria** | When ActualLoadingItem marked NOT_LOADED, cargo is automatically returned to YardInventory (cargo status → AT_YARD, inventory record created). Load List and Actual Loading printable. |

---

## 13. Bill of Lading (B/L)

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Transport document for a cargo/shipment. Made from finalized Loading/Cargo. Process: Prepare → Draft → Send to Customer → Revision → Approved → Final → Released/Unreleased. Draft and Released are different concepts. Draft/Final = document production status; Released = delivery permission. Numbering per destination format (KHS/26-110). Fields: Shipper, Consignee, Notify Party, Vessel, Voyage, POL, POD, B/L Number, Description, Quantity, Marks & Numbers, Net/Gross Weight, CBM, Place of Issue, Date of Issue, Freight (Collect/Prepaid), Stamp/Signature. |
| **Evidence/source** | Stage 1 §6.5; Stage 2 §2 (full B/L analysis); Stage 2 §10.4; duna_source_pack.md Additional; B/L sample KHS/26-110 |
| **Current implementation** | ✅ BillOfLading model: id, billOfLadingNumber (BL-YYMM-#####), manifestId FK, voyageId FK, status (DRAFT/ISSUED/CANCELLED), billType (HOUSE/MASTER), vesselName, vesselImo, shipperId (Customer FK — INCORRECT), consigneeId (Customer FK — INCORRECT), notifyParty, freightTerms, carrierName, placeOfIssue, dateOfIssue, originals, freightAmount, currencyCode, goodsDescription, shipmentMarks, totalPackages, totalGrossWeight, totalVolume, cancelReason, notes, timestamps. ✅ B/LItem: id, billOfLadingId, manifestItemId, cargoId, sequence, frozen snapshots. ⚠️ Status = DRAFT/ISSUED/CANCELLED — employer wants Draft → Review → Approved → Final + Released/Unreleased as separate concept. ❌ B/L requires Manifest (created against manifest) — employer wants B/L first, then Manifest from B/Ls. ❌ Numbering is global (BL-YYMM-#####) not per-destination (KHS/26-110). ❌ shipperId/consigneeId are Customer FKs, not Shipper/Consignee FKs. ❌ No notifyParty separate model (it's a string). |
| **Relevant source location** | `prisma/schema.prisma` BillOfLading model (lines 1041-1118); BillOfLadingItem (lines 1120-1149); BlStatus enum (lines 1031-1034); BlType enum |
| **Database support** | ⚠️ B/L model structurally OK but: (1) FKs point to Customer not Shipper/Consignee, (2) no per-destination numbering, (3) no Released/Unreleased status, (4) requires Manifest FK (wrong order), (5) no digital stamp/signature field. |
| **API/backend support** | ✅ B/L endpoints: list, get, create, update, remove, addItem, updateItem, removeItem, eligible-items, issue, cancel. ❌ No "release" endpoint (Released/Unreleased is separate from issue). ❌ No B/L versioning (revision after send to customer). ❌ No per-destination numbering endpoint. |
| **UI support** | ✅ B/L list page. ✅ B/L create/edit dialog. ✅ Add/update/remove items. ⚠️ No Draft→Review→Approved→Final workflow UI. ❌ No Released/Unreleased toggle. ❌ No print/PDF with digital stamp. ❌ No B/L revision workflow (send to customer → revise). |
| **Current status** | **CONFLICTING** |
| **Gap** | Multiple critical conflicts: (1) B/L before Manifest ordering reversed, (2) global numbering vs per-destination, (3) Customer FKs instead of Shipper/Consignee FKs, (4) Missing Released/Unreleased status separate from issue, (5) Missing Review step between Draft and Approved, (6) No revision workflow, (7) No print/PDF with stamp, (8) No digital signature field, (9) B/L number format wrong (BL-YYMM-##### vs KHS/26-110). |
| **Required change** | 1) **CONFLICT RESOLUTION**: Reverse B/L→Manifest order. B/L created first (from cargo/loading), then Manifest built from issued B/Ls. This requires: (a) Remove ManifestId requirement from B/L creation, (b) Add B/Ls to Manifest during manifest creation (instead of B/L referencing manifest), (c) Update ManifestItem to reference B/L items. 2) Add per-destination numbering (KHS/26-110 format). 3) Migrate shipperId/consigneeId to Shipper/Consignee FKs. 4) Add B/L status lifecycle: DRAFT → REVIEW → APPROVED → FINAL. Add separate released/unreleased flag (boolean or status). 5) Add B/L revision workflow (create new revision after send to customer). 6) Add digital stamp/signature fields. 7) Add print/PDF with template. 8) Add notifyParty as separate entity or keep as string (needs decision). |
| **Dependencies** | Shipper/Consignee models. Manifest model restructure (B/L→Manifest order reversal). Per-destination numbering. Document templates. |
| **Acceptance criteria** | B/L KHS/26-110 representable: Shipper = RAS AL KHAIMAH MACHINERIES LLC (Shipper record), Consignee = JOINT MECHANIC CO (Consignee record, national ID 10100670462), Vessel = MEHDI 11, Voyage = 02/26, POL = HAMRIYA, POD = KHORRAM SHAHR, Freight = PREPAID, Date = 29-AUG-26, Place = DUBAI, Originals = 1. B/L goes through Draft → Review → Approved → Final → Released. Released is separate from document status. B/L number format: KHS/26-110 (per-destination code + year + sequence). |

---

## 14. Manifest

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Consolidation of B/Ls for a Vessel/Voyage. Built from finalized/issued B/Ls (employer says B/L first, then Manifest — opposite of current). Multiple B/Ls per manifest. Header: Vessel, Voyage, POL, POD, Manifest Number, Date. Rows from B/Ls: B/L Number, Description, Shipper, Consignee, Units/Packages, Gross Weight. Totals computed. Manifest number per voyage. |
| **Evidence/source** | Stage 1 §6.6; Stage 2 §3 (full manifest analysis); Stage 2 §10.5; duna_source_pack.md Additional; Manifest sample DSMAN/KHO-26-006 |
| **Current implementation** | ✅ Manifest model: id, manifestNumber (MAN-YYMM-#####), voyageId FK, status (DRAFT/SUBMITTED/APPROVED/CANCELLED), vesselName, vesselImo, polPortId, podPortId, shipperId (Customer FK — INCORRECT), consigneeId (Customer FK — INCORRECT), agentId (Customer FK — INCORRECT), notifyParty, costBreakdown (JSON), totals (JSON), timestamps. ✅ ManifestItem: id, manifestId, cargoId, sequence, blNumber (nullable), weight, quantity, packages, packageType, notes, actualLoadingItemId (unique). ⚠️ Manifest requires B/Ls via relation but B/L is created against manifest (wrong order). ⚠️ Shipper/Consignee/Agent are Customer FKs (incorrect). ⚠️ Manifest header has single shipper/consignee/agent — but manifest evidence shows 12+ parties. ManifestItem doesn't have shipper/consignee/agent references — items rely on header or cargo. |
| **Relevant source location** | `prisma/schema.prisma` Manifest model (lines 913-988); ManifestItem (lines 990-1018); ManifestStatus enum (lines 906-911) |
| **Database support** | ⚠️ Manifest structurally OK but: (1) B/L→Manifest order reversed, (2) Customer FKs for parties, (3) single shipper/consignee/agent per manifest header — conflicts with 12+ parties evidence, (4) ManifestItem missing per-item shipper/consignee/agent, (5) blNumber is nullable string on item (correct concept but B/L linkage direction is wrong), (6) vesselName stored as string (should reference Vessel). |
| **API/backend support** | ✅ Manifest endpoints: list, get, eligible-cargo, create, update, delete, submit, approve, cancel. ❌ No "build from B/Ls" endpoint (current flow: create manifest → add cargo → B/L against manifest). |
| **UI support** | ✅ Manifest list page. ✅ Manifest create/edit. ⚠️ No B/L-row display in manifest (items reference cargo, not B/Ls). ❌ No multi-party support UI. |
| **Current status** | **CONFLICTING** |
| **Gap** | (1) B/L→Manifest order reversed (CONFLICT). (2) Manifest parties are Customer FKs (CONFLICT). (3) Single shipper/consignee per manifest header (CONFLICT with 12+ parties evidence). (4) ManifestItem doesn't reference B/L items directly. (5) Forwarder B/Ls (NES260900266) not supported. (6) Manifest number is global (MAN-YYMM-#####), evidence shows DSMAN/KHO-26-006 (per-destination). |
| **Required change** | 1) Reverse to B/L→Manifest flow: Manifest created from issued B/Ls. ManifestItem references BillOfLadingItem (not cargo directly). 2) Migrate shipperId/consigneeId/agentId to Shipper/Consignee/Agent FKs. 3) Add per-item shipper/consignee/agent on ManifestItem (each item can have different parties). 4) Support forwarder B/Ls (blNumber can be external — already nullable, just needs UI support). 5) Per-destination manifest numbering (DSMAN/KHO-26-006 format). 6) Vessel reference instead of vesselName string. |
| **Dependencies** | B/L model restructure (order reversal). Shipper/Consignee/Agent models. Per-destination numbering. |
| **Acceptance criteria** | Manifest DSMAN/KHO-26-006 representable: Voyage 02/26, Barge MEHDI 11, Tug LAYAN GULF, POL HAMRIYA, POD KHORRAM SHAHR, 45 items from 12+ shippers/consignees, B/L numbers referenced per item, forwarder B/Ls (NES260900266) included, totals computed server-side. Manifest built from issued B/Ls, not the other way around. |

---

## 15. Job / Cost Tracking

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Job/Case collects multi-stage costs over time. Parent to multiple Cargo, costs, documents. Cost categories: repair, customs, crane, lowbed, transport, port, vessel, miscellaneous. Job numbers referenced in invoices. Invoice should be matchable to Job Numbers. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §7.4 (ledger entries reference operational charges); duna_source_pack.md Part 1 & Additional |
| **Current implementation** | ✅ Job model: id, jobNumber (JOB-YYMM-#####), title, description, customerId (nullable), voyageId (nullable), jobType, status (DRAFT/OPEN/COMPLETED/CANCELLED), currencyCode, openingDate, completedAt/By, cancelledAt/By, cancelReason, notes, timestamps. ✅ JobCostItem: id, jobId, kind (COST/INCOME), category, description, amount, itemDate, notes. ✅ Job→Voyage relation. ✅ Job→Customer relation. ❌ No link from Invoice to Job (employer wants invoice matchable to Job). ❌ No link from Cargo to Job (employer says Job is parent to multiple Cargo). |
| **Relevant source location** | `prisma/schema.prisma` Job model (lines 1723-1757); JobCostItem (lines 1759-1775); JobStatus enum (lines 1708-1713) |
| **Database support** | ✅ Job + JobCostItem models. ⚠️ Invoice has no jobId FK. Cargo has no jobId FK. Job.voyageId exists but Job.cargo relation missing. |
| **API/backend support** | ✅ Job endpoints: list, get, create, update, remove, addItem, updateItem, removeItem, start, complete, cancel. ❌ No endpoint to link invoice to job. ❌ No endpoint to link cargo to job. |
| **UI support** | ✅ Job list page. ✅ Job create/edit. ✅ Job cost items UI. ❌ No UI to link invoice to job. ❌ No UI to link cargo to job. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | (1) Invoice has no Job link — employer wants invoice matchable to Job Numbers. (2) Cargo has no Job link — employer says Job is parent to multiple Cargo. (3) Job type/category classification may need expansion (employer lists: repair, customs, crane, lowbed, transport, port, vessel, miscellaneous). |
| **Required change** | 1) Add jobId FK to Invoice model. 2) Add jobId FK to Cargo model. 3) Add API endpoints to link/unlink invoice→job and cargo→job. 4) Expand JobCostItem categories if needed (current: free-text category field — flexible). 5) Update Invoice UI to show/select Job Number when creating invoice. 6) Update Cargo intake to optionally link to Job. |
| **Dependencies** | Job model already exists — just needs FK additions. |
| **Acceptance criteria** | Creating an invoice shows Job Number selector. Invoice display shows linked Job Number. Cargo can be linked to Job. Job shows list of linked invoices and cargo. Ledger entry particulars can reference Job Number (e.g. "JOB-2609-00001 Lowbed charges"). |

---

## 16. Invoice

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Financial claim against Customer. Two types: (1) Linked to B/L/Manifest/Job, (2) Independent. Linked invoice: after B/L issued, draft invoice created, accountant matches with Job Numbers. Fields: Invoice Number, Date, Customer, B/L/Manifest Reference, Description, Rate, Quantity, Amount, VAT, Subtotal, Total. Per-line VAT (each line has VAT % and VAT Amount). Some invoices have VAT, some don't. Invoice → Customer Ledger as Debit. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §4 (full Tax Invoice analysis); Stage 2 §10.6; duna_source_pack.md Additional; Invoice sample DSINV/26-172 |
| **Current implementation** | ✅ Invoice model: id, invoiceNumber (INV-YYMM-#####), customerId FK, status (DRAFT/ISSUED/CANCELLED), manifestId (nullable), billOfLadingId (nullable), voyageId (nullable), title, description, currencyCode, issueDate, dueDate, subtotal, taxRate (header-level!), taxAmount, discountAmount, totalAmount, paidAmount, cancelReason, notes, timestamps. ✅ InvoiceItem: id, invoiceId, description, quantity, unitPrice, amount. ⚠️ **taxRate is header-level** — employer evidence shows per-line VAT (each line has VAT % and VAT Amount). ❌ No jobId FK. ❌ Numbering is global (INV-YYMM-#####), evidence shows DSINV/26-172 (company prefix + year + sequence). ⚠️ InvoiceItem missing per-line VAT fields. |
| **Relevant source location** | `prisma/schema.prisma` Invoice model (lines 1166-1229); InvoiceItem (lines 1239-1260); InvoiceStatus enum (lines 1160-1164) |
| **Database support** | ⚠️ Invoice model mostly OK but: (1) taxRate is header-level (should be per-line or removed from header), (2) no per-line VAT % and VAT Amount on InvoiceItem, (3) no jobId FK, (4) numbering is global not company-prefixed, (5) InvoiceItem.amount is pre-computed (should be qty × unitPrice with VAT computed per line). |
| **API/backend support** | ✅ Invoice endpoints: list, get, create, update, remove, addItem, updateItem, removeItem, issue, cancel. ❌ No per-line VAT handling. ❌ No job linking. |
| **UI support** | ✅ Invoice list page. ✅ Invoice create/edit. ✅ Add/update/remove items. ⚠️ No per-line VAT UI. ❌ No Job Number field. ❌ No B/L/Manifest reference display/edit on invoice form (exists in model but UI may not expose). |
| **Current status** | **IMPLEMENTED BUT INCORRECT** |
| **Gap** | (1) VAT is header-level — WRONG per evidence. Invoice DSINV/26-172 shows per-line VAT % and VAT Amount (all 0% in sample, but structure is per-line). (2) No Job link. (3) Numbering format wrong (INV-YYMM-##### vs DSINV/26-172). (4) InvoiceItem lacks per-line VAT fields. (5) Invoice model has taxRate on header — needs to be removed or made derivable from lines. |
| **Required change** | 1) Add vatRate and vatAmount fields to InvoiceItem (per-line VAT). 2) Remove taxRate from Invoice header (or compute from lines). 3) Add jobId FK to Invoice. 4) Change numbering to company-prefixed format (DSINV/26-172). 5) Update InvoiceItem amount calculation: amount = qty × unitPrice; vatAmount = amount × vatRate / 100; line total = amount + vatAmount. 6) Update subtotal/total computation to include per-line VAT. 7) Add UI for per-line VAT % and VAT Amount. 8) Add Job Number field to invoice form. |
| **Dependencies** | Job model (exists). Per-destination/company numbering. |
| **Acceptance criteria** | Invoice DSINV/26-172 representable: Customer = MR. SHAHOKH SHAHVARAEI, B/L ref = KHS/26-108, Manifest ref = DSKHS-26-005, Voyage = 02/26, POL = HAMRIYA, POD = KHORRAM SHAHR, Currency = AED. Charge lines each have: Description, Qty, Unit Price, VAT %, VAT Amount, Amount. Subtotal = sum of amounts. VAT = sum of VAT amounts. Total = subtotal + VAT. Invoice linked to Job Number. |

---

## 17. Receipt / Payment

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Payment/Receipt: payer/payee, invoice ref, B/L ref, debit/credit, ID docs, signature, attachments. Multi-step payment: each installment separate. Advance payments + allocation to multiple invoices. ID document photo (back of ID) + recipient signature. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §8 (full Receipt Voucher analysis); Stage 2 §10.7; duna_source_pack.md Additional; Receipt Voucher sample 477; Ledger entry 2026/477 covers INV 1517 AND 1526 |
| **Current implementation** | ✅ Voucher model: id, voucherNumber (RCP-YYMM-##### / PMT-YYMM-#####), type (RECEIPT/PAYMENT), status (POSTED/CANCELLED), customerId FK, invoiceId (single FK — INCORRECT for multi-invoice), voyageId, amount, currencyCode, exchangeRate, method (CASH/BANK_TRANSFER/CHEQUE/OTHER), reference, description, note, voucherDate, cancelReason, timestamps. ⚠️ **invoiceId is single FK** — cannot represent receipt 2026/477 covering INV 1517 AND 1526. ❌ No multi-invoice allocation. ❌ No ID document photo attachment. ❌ No signature field. ❌ No B/L reference on voucher. |
| **Relevant source location** | `prisma/schema.prisma` Voucher model (lines 1541-1583); VoucherType enum (lines 1524-1527); VoucherMethod enum (lines 1529-1534) |
| **Database support** | ❌ Voucher.invoiceId is single FK — cannot represent multi-invoice payment. ❌ No attachment/file storage. ❌ No signature field. ❌ No ID document reference. |
| **API/backend support** | ✅ Voucher CRUD: list, get, create, update, remove, cancel. ❌ No multi-invoice allocation endpoint. ❌ No file attachment upload. |
| **UI support** | ✅ Voucher list page. ✅ Voucher create/edit. ❌ No multi-invoice allocation UI. ❌ No file upload for ID doc. ❌ No signature capture. |
| **Current status** | **IMPLEMENTED BUT INCORRECT** |
| **Gap** | (1) Single invoiceId FK can't represent multi-invoice payment (receipt 2026/477: INV 1517 + 1526). (2) No ID document photo attachment. (3) No signature field. (4) No B/L reference on voucher. (5) Voucher numbering: current auto-generated RCP-/PMT- prefix — evidence shows mixed formats: sequential (1380, 1517, 1526 for Sales) and date-based (2026/446, 2026/477 for Receipts). |
| **Required change** | 1) Replace Voucher.invoiceId (single FK) with a VoucherAllocation model (voucherId, invoiceId, allocatedAmount) — one voucher can allocate to multiple invoices. 2) Add fileAttachment model or field for ID document photo. 3) Add signature field (text or file reference). 4) Add blReference field to Voucher. 5) Update voucher creation UI to support multi-invoice allocation (select multiple invoices, allocate amounts). 6) **OPEN BUSINESS DECISION**: Confirm voucher number format rules (sequential vs date-based, which types use which). |
| **Dependencies** | Voucher model restructure. File attachment infrastructure. **OPEN BUSINESS DECISION** on voucher numbering. |
| **Acceptance criteria** | Receipt 2026/477 representable: Voucher type = RECEIPT, amount = 1,600.00, references INV 1517 + INV 1526 (two allocations), payment method = CASH, description = "CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526", date = 6-Aug-26. Voucher shows allocated amounts per invoice. ID document photo uploadable. Signature recorded. |

---

## 18. Ledger

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Financial history + balance per customer. Running balance with Dr/Cr. Voucher types: Sales (debit), Receipt (credit). Customer Profile: full ledger with invoices, payments, debit/credit, balance, last invoice date, paid/unpaid/partial status. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §7 (full Ledger Account analysis); Stage 2 §10.8; duna_source_pack.md Additional; Ledger sample (period 1-Jul-26 to 7-Sep-26) |
| **Current implementation** | ✅ Voucher model stores debit/credit entries (via type: RECEIPT=credit, PAYMENT=debit). ✅ Ledger derived: GET /ledger/customers returns statement. ✅ Invoice.paidAmount maintained by voucher posts. ⚠️ Ledger is derived (no separate LedgerEntry table) — this is a design choice. ⚠️ No General Journal entries (separate from vouchers). ⚠️ Ledger entries show voucher type but not invoice reference detail per entry. ⚠️ Running balance computed at read time — may not match employer's stored balance expectation. |
| **Relevant source location** | `prisma/schema.prisma` Voucher model (lines 1541-1583); Ledger API: `apps/api/src/modules/ledger/` |
| **Database support** | ✅ Voucher + Invoice provide ledger data. ⚠️ No GeneralJournalEntry model. ⚠️ No separate LedgerEntry table (derived only). |
| **API/backend support** | ✅ GET /ledger/customers — derived statement. ⚠️ No per-customer ledger with invoice detail inline. ❌ No General Journal API. |
| **UI support** | ✅ Ledger page exists (shows voucher list). ❌ No Customer 360 ledger integration. ❌ No General Journal UI. ❌ No running balance visualization per customer. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | (1) No General Journal — employer requires it for non-invoice transactions. (2) Ledger is derived, not stored — needs verification that this meets employer expectations. (3) No per-customer ledger page in Customer 360. (4) Ledger entries don't show invoice references inline (e.g. "INV 1517, 1526"). (5) Voucher type mapping: current RECEIPT/PAYMENT — employer ledger shows "Sales" (debit) and "Receipt" (credit) as voucher types. Sales vouchers in ledger are for operational charges (trailer, lowbed) — these are NOT linked to invoices in the current model. |
| **Required change** | 1) Create GeneralJournalEntry model for non-invoice transactions. 2) Add GJ API endpoints. 3) Build Customer 360 ledger view (integrates invoices + vouchers + GJ entries). 4) Enhance ledger display to show invoice references. 5) **OPEN BUSINESS DECISION**: Confirm if "Sales" voucher type for operational charges should be a separate voucher type or handled via General Journal. 6) Verify running balance computation matches employer expectation. |
| **Dependencies** | GeneralJournalEntry model. Customer 360 page. **OPEN BUSINESS DECISION** on Sales voucher type handling. |
| **Acceptance criteria** | Customer ledger shows: date, particulars, voucher type, voucher number, debit, credit, running balance. Entries include: Sales vouchers (operational charges), Receipt vouchers (payments with invoice refs), General Journal entries (non-invoice transactions). Running balance flips between Dr and Cr correctly. Receipt 2026/477 shows credit of 1,600.00 with reference "INV 1517, 1526". |

---

## 19. General Journal

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | General Journal for transactions outside invoice cycle. Company expenses registered for year-end P&L. Non-invoice transactions. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §10.8; duna_source_pack.md Additional (Accounting / Voucher / Salary Slip / General Journal); employer explicitly requires GJ |
| **Current implementation** | ❌ No GeneralJournal or GeneralJournalEntry model. ❌ No GJ API. ❌ No GJ UI. |
| **Relevant source location** | Not present in schema.prisma. Not present in any module. |
| **Database support** | ❌ Completely missing. |
| **API/backend support** | ❌ Completely missing. |
| **UI support** | ❌ Completely missing. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | General Journal is entirely absent from the system. Employer requires it for: company expenses, non-invoice transactions, year-end P&L. |
| **Required change** | 1) Create GeneralJournalEntry model: id, entryNumber, date, description, debitAccount (or counterparty), creditAccount, debitAmount, creditAmount, reference, notes, createdById, timestamps. 2) Add GJ CRUD API endpoints. 3) Build GJ UI page. 4) Integrate GJ entries into Customer ledger view (for customer-related GJ entries). 5) Integrate GJ into Voyage P&L (expenses). |
| **Dependencies** | Account/category master data (needs decision: chart of accounts or free-text accounts?). |
| **Acceptance criteria** | General Journal entries can be created for non-invoice transactions. Entries appear in customer ledger when customer-related. Voyage P&L includes GJ expenses. Year-end P&L can be generated from GJ + invoices + vouchers. |

---

## 20. VAT

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | VAT on invoices (some have VAT, some don't). VAT reports by time period/quarter/month. Which services taxable, which not. Rate TBD. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §4.2 (Tax Invoice shows 0% VAT on all lines but structure is per-line); Stage 2 §10.6; duna_source_pack.md Additional (Manifest structure, Accounting, Invoice, VAT) |
| **Current implementation** | ⚠️ Invoice.taxRate is header-level (incorrect). ⚠️ InvoiceItem has NO VAT fields. ⚠️ No VAT report. ⚠️ No VAT rules (which services taxable). |
| **Relevant source location** | `prisma/schema.prisma` Invoice model.taxRate (line 1189); InvoiceItem model (no VAT fields) |
| **Database support** | ❌ No per-line VAT on InvoiceItem. ❌ No VAT report data structure. |
| **API/backend support** | ❌ No VAT calculation logic per line. ❌ No VAT report endpoint. |
| **UI support** | ❌ No per-line VAT UI. ❌ No VAT report page. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | VAT implementation is fundamentally wrong (header-level instead of per-line). No VAT reports. No VAT rules configured. |
| **Required change** | 1) Add vatRate and vatAmount to InvoiceItem. 2) Compute invoice totals from per-line VAT. 3) **OPEN BUSINESS DECISION**: Determine VAT rules — which services are taxable, VAT rate(s), 0% cases. 4) Build VAT report (monthly/quarterly/yearly) showing taxable sales, VAT collected, by period. 5) Update invoice UI to show per-line VAT. |
| **Dependencies** | InvoiceItem model update. **OPEN BUSINESS DECISION** on VAT rules. |
| **Acceptance criteria** | Invoice shows per-line VAT % and VAT Amount. VAT report shows total VAT by period. Some invoices can have 0% VAT (all lines 0%). Some invoices have VAT on some/all lines. VAT report matches UAE VAT requirements (when rules confirmed). |

---

## 21. Proforma Invoice

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Commercial offer document. Structurally different from Tax Invoice. Has seller/buyer, trade terms, origin/destination, validity. Can be for goods sales (excavator sale) not just shipping services. Numbering: DSPRO/YY-NNN. Can be converted to Invoice. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §5 (full Proforma analysis); duna_source_pack.md Additional; Proforma sample DSPRO/26-001 |
| **Current implementation** | ✅ Proforma model: id, proformaNumber (PRF-YYMM-#####), customerId FK, status (DRAFT/ISSUED/CANCELLED), title, description, currencyCode, issueDate, validUntil, subtotal, taxRate, taxAmount, discountAmount, totalAmount, linkedInvoiceId (unique), notes, timestamps. ✅ ProformaItem: id, proformaId, description, quantity, unitPrice, amount. ✅ Convert to invoice endpoint. ⚠️ Numbering is PRF-YYMM-#####, evidence shows DSPRO/26-001. ⚠️ taxRate is header-level (same issue as Invoice). ⚠️ ProformaItem missing per-line VAT. ⚠️ Proforma is structured as shipping document — evidence shows it can be for goods sales (excavator sale with year, net/gross weight columns). |
| **Relevant source location** | `prisma/schema.prisma` Proforma model (lines 1263-1310); ProformaItem (lines 1319-1331); ProformaStatus enum (lines 1257-1261) |
| **Database support** | ⚠️ Proforma model structurally OK but: (1) numbering format wrong, (2) header-level taxRate, (3) no per-line VAT, (4) item structure may not support goods-sale columns (year, net/gross weight). |
| **API/backend support** | ✅ Proforma CRUD + convert endpoint. ❌ No per-line VAT. ❌ No goods-sale item structure. |
| **UI support** | ✅ Proforma list page. ✅ Proforma create/edit. ✅ Convert to invoice. ⚠️ No per-line VAT UI. ❌ No goods-sale columns. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | (1) Numbering format wrong (PRF-YYMM-##### vs DSPRO/26-001). (2) Header-level taxRate (same as Invoice). (3) No per-line VAT. (4) ProformaItem structure: evidence shows proforma for goods sale has columns: Description, Year, Qty, Net Wt (KG), G.Wt (KG), T.G Wt (KG), Unit Price, Amount. Current model: description, quantity, unitPrice, amount — missing year, weights. |
| **Required change** | 1) Change numbering to DSPRO/YY-NNN format. 2) Add per-line VAT to ProformaItem. 3) **OPEN BUSINESS DECISION**: Confirm if proforma item structure needs year/weight fields (for goods sales) or if current structure suffices for shipping services. 4) Add optional weight fields to ProformaItem if needed. |
| **Dependencies** | **OPEN BUSINESS DECISION** on proforma item structure for goods sales. Numbering format. |
| **Acceptance criteria** | Proforma DSPRO/26-001 representable: Seller = DUNA SHIPPING LLC, Buyer = MR. RAMIN AHMADABADI, PI number = DSPRO/26-001, Date = 22-AUG-26, Validity = 1 MONTH, Origin = INDIA, Delivery = FOB, Payment = 100% ADVANCE, Currency = AED. Cargo lines with description, year, qty, weights, unit price, amount. Convertible to Invoice once. |

---

## 22. Quotation

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Price offer document. Has introduction text (editable template content). Charge lines are service descriptions (free text). Has subtotal + other charges + grand total. Numbering: DSQUO/YY-NNN. Can be converted to Proforma → Invoice. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §6 (full Quotation analysis); duna_source_pack.md Additional; Quotation sample DSQUO/25-017 |
| **Current implementation** | ✅ Quotation model: id, quotationNumber (QT-YYMM-#####), customerId FK, status (DRAFT/ISSUED/CANCELLED), title, description, currencyCode, issueDate, validUntil, subtotal, taxRate, taxAmount, discountAmount, totalAmount, linkedProformaId (unique), rejectReason, cancelReason, notes, timestamps. ✅ QuotationItem: id, quotationId, description, quantity, unitPrice, amount. ✅ Convert to proforma endpoint. ⚠️ Numbering is QT-YYMM-##### (wrong — should be DSQUO/YY-NNN). ⚠️ Header-level taxRate. ⚠️ Has "other charges" concept — current model uses discountAmount, not otherCharges. |
| **Relevant source location** | `prisma/schema.prisma` Quotation model (lines 1347-1406); QuotationItem (lines 1408-1430); QuotationStatus enum (lines 1342-1345) |
| **Database support** | ⚠️ Quotation model mostly OK but: (1) numbering wrong, (2) header-level taxRate, (3) no "other charges" field (has discountAmount instead), (4) no per-line VAT. |
| **API/backend support** | ✅ Quotation CRUD + send/accept/reject/convert endpoints. ❌ No other charges field. ❌ No per-line VAT. |
| **UI support** | ✅ Quotation list page. ✅ Quotation create/edit. ✅ Send/accept/reject/convert. ❌ No other charges UI. ❌ No per-line VAT UI. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | (1) Numbering format wrong (QT-YYMM-##### vs DSQUO/25-017). (2) Header-level taxRate. (3) No "other charges" concept — employer wants subtotal + other charges + grand total. (4) No per-line VAT. (5) QuotationItem has no year field (evidence shows year column). |
| **Required change** | 1) Change numbering to DSQUO/YY-NNN. 2) Add per-line VAT to QuotationItem. 3) Add otherCharges field to Quotation model (separate from discountAmount). 4) Update grand total computation: subtotal + otherCharges + taxAmount. 5) Add year field to QuotationItem if needed. |
| **Dependencies** | Numbering format. |
| **Acceptance criteria** | Quotation DSQUO/25-017 representable: Customer = MR. SHADMAN MEABADI, Date = 20-NOV-25, introduction text present, charge lines with description/year/qty/unit price/amount, subtotal = 7,700.00, other charges = 0.00, grand total = 7,700.00. Convertible to Proforma. |

---

## 23. Salary

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Salary records for employees. Who sets/approves/pays, components, period. Salary slip. Self-contained (no voucher/ledger contamination). |
| **Evidence/source** | Stage 1 §6.7; duna_source_pack.md Additional (Accounting / Voucher / Salary Slip / General Journal); ADR-036 |
| **Current implementation** | ✅ SalaryRecord model: id, salaryId (SAL-YYMM-#####), employeeId FK, year, month, status (DRAFT/APPROVED/PAID/CANCELLED), base, additions, deductions, net, currencyCode, paymentMethod, paymentRef, approvedById/At, paidById/At, cancelledById/At, cancelReason, notes, timestamps. ✅ Employee model: id, employeeNumber, fullName, email, phone, jobTitle, department, isActive, timestamps. ✅ Salary self-contained (ADR-036). ✅ Unique [employeeId, year, month]. |
| **Relevant source location** | `prisma/schema.prisma` SalaryRecord model (lines 1460-1516); Employee model (lines 1423-1451) |
| **Database support** | ✅ Full Salary + Employee models. ✅ Self-contained (no voucher contamination). |
| **API/backend support** | ✅ Salary endpoints: list, get, create, approve, pay, cancel. ✅ Employee CRUD. |
| **UI support** | ✅ Salary records page. ✅ Employee page. ✅ Salary slip view. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | 1) **OPEN BUSINESS DECISION**: Who sets/approves/pays salary — roles and workflow not fully specified. 2) Salary components: current model has base/additions/deductions — needs confirmation that this matches employer's component structure. 3) Salary slip template/PDF not implemented. 4) Salary slip print not implemented. |
| **Required change** | 1) Confirm salary workflow (who creates, who approves, who pays). 2) Confirm salary components. 3) Add salary slip PDF/print. 4) **OPEN BUSINESS DECISION**: Confirm if salary slip needs template upload. |
| **Dependencies** | **OPEN BUSINESS DECISION** on salary workflow and components. Document templates for salary slip. |
| **Acceptance criteria** | Salary records can be created per employee per month. Workflow: created → approved → paid. Salary slip viewable. Net = base + additions - deductions. |

---

## 24. Release Order

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Permission to release documents/cargo after payment conditions met. "No money, no cargo" principle. Release requires all invoices paid unless override with reason. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §7.4 (ledger entries relate to payment/release); duna_source_pack.md Part 1; ADR-033 |
| **Current implementation** | ✅ ReleaseOrder model: id, releaseNumber (RO-YYMM-#####), billOfLadingId FK, status (ISSUED/CANCELLED), releaseDate, financialOverride (boolean), overrideReason, notes, cancelReason, cancelledById/At, createdById, timestamps. ✅ Money rule enforced: R/O requires linked invoices fully paid unless override. ✅ ReleaseOrder→B/L relation. ✅ CreatedBy required. |
| **Relevant source location** | `prisma/schema.prisma` ReleaseOrder model (lines 1617-1651); ADR-033 |
| **Database support** | ✅ ReleaseOrder model with financial override tracking. ✅ B/L link. |
| **API/backend support** | ✅ ReleaseOrder endpoints: list, get, create, cancel, eligibility (GET /release-orders/eligibility?billOfLadingId=). ✅ Money rule check before creation. |
| **UI support** | ✅ Release Order list page. ✅ Create release order. ✅ Eligibility check. |
| **Current status** | **CONFIRMED + IMPLEMENTED** |
| **Gap** | None significant. Release order money rule is correctly implemented. Override with reason tracked. |
| **Required change** | None — already correct. Minor: Add release order to Agent Portal visibility (agent should see release status). |
| **Dependencies** | Agent Portal extension (agent needs to see release status). |
| **Acceptance criteria** | Release Order cannot be created for B/L with unpaid invoices (unless override with reason). Release Order status visible in B/L detail. Agent portal shows release status per B/L. |

---

## 25. Delivery Order

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Physical cargo handover document. Against a B/L (recipient pickup). Recipient name/ID. Vehicle plate. |
| **Evidence/source** | Stage 1 §6.7; duna_source_pack.md Part 1; ADR-032 |
| **Current implementation** | ✅ DeliveryOrder model: id, docNumber (DO-YYMM-#####), billOfLadingId FK, status (ISSUED/CANCELLED), issueDate, recipient (name/ID), recipientId (nullable Customer FK), vehiclePlate, notes, cancelReason, cancelledById/At, createdById, timestamps. ✅ D/O→B/L relation. |
| **Relevant source location** | `prisma/schema.prisma` DeliveryOrder model (lines 1595-1630); ADR-032 |
| **Database support** | ✅ DeliveryOrder model. ✅ B/L link. ✅ Recipient fields. |
| **API/backend support** | ✅ DeliveryOrder endpoints: list, get, create, cancel. |
| **UI support** | ✅ Delivery Order list page. ✅ Create delivery order. |
| **Current status** | **CONFIRMED + IMPLEMENTED** |
| **Gap** | None significant. Delivery Order model is correct. Minor: Add to Agent Portal visibility. |
| **Required change** | None — already correct. Minor: Add delivery order to Agent Portal. |
| **Dependencies** | Agent Portal extension. |
| **Acceptance criteria** | Delivery Order created against B/L. Recipient name/ID recorded. Vehicle plate recorded. D/O number format: DO-YYMM-#####. |

---

## 26. Agent Portal

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Agent is NOT a regular user. Agent scoped to one Destination/Port. Agent sees: B/L status, Release Order status, payment status, document access for their destination. Not just bookings. Agent submits bookings. Office desk reviews/responds. |
| **Evidence/source** | Stage 1 §6.8; Stage 2 §12; Stage 3 §9; ADR-040; duna_source_pack.md Part 1 & Additional |
| **Current implementation** | ✅ BookingRequest model (BRK-YYMM-#####). ✅ Portal me: company + summary. ✅ Agent sees: bookings, shipments (manifests), statement, ports. ✅ Office desk: GET/POST /bookings, GET /bookings/:id, POST /bookings/:id/respond. ✅ PortalUser → Customer relation (one portal login per company). ❌ Agent CANNOT see B/L documents. ❌ Agent CANNOT see Release Orders. ❌ Agent CANNOT download/print documents. ❌ Agent CANNOT upload documents. ❌ Agent CANNOT see invoice details. ❌ Agent CANNOT see payment status per B/L. ❌ Agent sees shipments as manifests — but employer wants B/L-level visibility. |
| **Relevant source location** | `prisma/schema.prisma` BookingRequest model (lines 862-894); User.portalCustomerId; Portal API: `apps/api/src/modules/portal/`; Agent Portal UI: `apps/web/src/app/portal/` |
| **Database support** | ✅ BookingRequest for bookings. ✅ User→Customer portal relation. ❌ No B/L access control for agents. ❌ No document download tracking. |
| **API/backend support** | ✅ Portal endpoints: GET/POST /portal/bookings, POST /portal/bookings/:id/cancel, GET /portal/shipments, GET /portal/statement, GET /portal/ports, GET /portal/me. ❌ No /portal/bills endpoint. ❌ No /portal/release-orders endpoint. ❌ No /portal/documents download. ❌ No B/L detail for agents. |
| **UI support** | ✅ Bookings list. ✅ Shipments list. ✅ Statement. ✅ Ports. ❌ No B/L list/view. ❌ No Release Order view. ❌ No document download/print. ❌ No payment status per B/L. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | Agent Portal is bookings-only. Employer explicitly requires: B/L status, Release Order status, payment status, document access. This is a MAJOR gap — the entire Agent Portal scope needs expansion. |
| **Required change** | 1) Add /portal/bills endpoint (filtered by agent's destination port). 2) Add /portal/release-orders endpoint. 3) Add /portal/bills/:id detail endpoint. 4) Add document download endpoint for agents (with access logging). 5) Add payment status to B/L detail (derived from invoice paidAmount). 6) Extend Agent Portal UI: B/L list page (filtered by destination), B/L detail page, Release Order status, download/print buttons, payment status indicator. 7) Add permissions: agent:bill-read, agent:release-read, agent:document-download. 8) **OPEN BUSINESS DECISION**: Does agent see Manifest? Delivery Order? Can agent upload documents or add comments? |
| **Dependencies** | B/L model fixes (shipper/consignee FKs, numbering). Release Order model (exists). **OPEN BUSINESS DECISION** on agent capabilities (upload, comment, manifest access, D/O access). |
| **Acceptance criteria** | Agent Khorramshahr logs in → sees B/L list for POD = Khorramshahr only. Each B/L shows: number, status, vessel, voyage, shipper, consignee, cargo description, freight, payment status (paid/partial/unpaid). Agent can view B/L detail. Agent can download/print B/L. Agent can see Release Order status per B/L. Agent CANNOT see B/Ls for other destinations. Agent booking submission works. |

---

## 27. Archive

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Source Documents → B/L / Manifest / Invoice / Release / Delivery / Vouchers → Archive. Final document: never reopened. Archived documents accessible for reference. |
| **Evidence/source** | Stage 1 §4 (Document Flow); duna_source_pack.md Part 1 |
| **Current implementation** | ⚠️ Soft delete (deletedAt) on most models — this is a form of archiving but not explicit "Archive" status. ⚠️ Letters have ARCHIVED status. ✅ Most documents have terminal states (ISSUED/CANCELLED for B/L, APPROVED/CANCELLED for Manifest, etc.). ❌ No explicit Archive workflow for documents. ❌ No archive search/view page. |
| **Relevant source location** | Soft delete on models via deletedAt. Letter.LetterStatus.ARCHIVED (line 1662). |
| **Database support** | ⚠️ Soft delete on most models. ❌ No dedicated Archive model or status. |
| **API/backend support** | ⚠️ Soft-deleted records filtered out by default. ❌ No archive query endpoint. |
| **UI support** | ❌ No archive page. ❌ No archive search. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | No explicit archive workflow. Soft delete exists but isn't an "Archive" concept with view/search capability. Employer wants archive accessible for reference. |
| **Required change** | 1) **OPEN BUSINESS DECISION**: Confirm archive rules — which documents get archived, when, who can access. 2) Add Archive status or use soft-delete + dedicated archive view. 3) Build archive search/view page. 4) Add archive permissions. |
| **Dependencies** | **OPEN BUSINESS DECISION** on archive rules. |
| **Acceptance criteria** | Archived documents accessible via archive search. Archive view shows document type, number, date, status. Archived documents cannot be edited (terminal). |

---

## 28. Reports

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Vessel/Voyage P&L. Manifest reports. Cost reports. VAT reports (monthly/quarterly/yearly). Tax/year reporting. Dashboard KPIs: cargo in yard, ready for loading, pending inspection, active voyages, draft B/Ls, unpaid invoices, partial payments, released but unpaid, customer receivables, voyage profitability. |
| **Evidence/source** | Stage 1 §6.9; Stage 2 §14; duna_source_pack.md Part 1 & Additional |
| **Current implementation** | ❌ No Voyage P&L report. ❌ No Manifest report. ❌ No Cost report. ❌ No VAT report. ❌ No Tax/Year report. ❌ Dashboard KPIs not implemented (dashboard shows app health, not business KPIs). |
| **Relevant source location** | Not present. Dashboard page: `apps/web/src/app/(dashboard)/dashboard/` — shows operational status, not business KPIs. |
| **Database support** | ⚠️ Data exists to compute reports (Voyage, Job, Invoice, Voucher, Cargo, B/L, Manifest) but no report-specific models or views. |
| **API/backend support** | ❌ No report endpoints. ❌ No KPI aggregation endpoints. |
| **UI support** | ❌ No report pages. ❌ No KPI dashboard widgets. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | All reports missing. Dashboard KPIs missing. This is a significant gap — employer considers reports essential. |
| **Required change** | 1) Build Voyage P&L report (revenue from invoices linked to voyage - costs from Job cost items + GJ entries linked to voyage). 2) Build Manifest report (list manifests with totals, by voyage/period). 3) Build Cost report (by category, by voyage, by period). 4) Build VAT report (monthly/quarterly/yearly, taxable sales, VAT collected). 5) Build Dashboard KPIs page with widgets: cargo in yard count, ready for loading, pending inspection, active voyages, draft B/Ls, unpaid invoices, partial payments, released but unpaid, customer receivables, voyage profitability. 6) Build Customer receivables aging report. |
| **Dependencies** | Data models exist (Voyage, Job, Invoice, Voucher, Cargo, B/L, Manifest) — reports are read-only aggregations. VAT rules needed for VAT report. |
| **Acceptance criteria** | Voyage P&L shows: voyage number, vessel, dates, revenue (sum of linked invoices), costs (sum of job costs + GJ entries), profit. VAT report shows: period, taxable sales, VAT amount, by invoice line. Dashboard KPIs update live from API. |

---

## 29. Document Templates

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Templates for: Loading List, B/L, Manifest, Invoice, Proforma, Quotation, Receipt, Payment, Ledger, Release Order, Delivery Order, Salary Slip, Letters. Uploadable templates per company format. PDF and/or Excel output. PDF: digital stamp/signature embedded. Print: digital stamp MAY be removed for physical stamp. Print version ≠ PDF version for some documents. |
| **Evidence/source** | Stage 1 §6.10; Stage 2 §11; duna_source_pack.md Additional (Template Upload) |
| **Current implementation** | ❌ No DocumentTemplate model. ❌ No template upload. ❌ No template-driven PDF generation. ❌ No template-driven Excel output. ❌ Print is per-page browser print, not template-driven. ❌ No digital stamp/signature on documents. |
| **Relevant source location** | Not present. ADR-009 designs DocumentTemplate but it's not in schema. |
| **Database support** | ❌ No DocumentTemplate model. ❌ No file storage for templates. |
| **API/backend support** | ❌ No template upload API. ❌ No template-driven PDF generation API. ❌ No Excel export API. |
| **UI support** | ❌ No template management UI. ❌ No PDF preview/download per document. ❌ No Excel export. ❌ No digital stamp UI. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | Document templates are entirely absent. All document output is currently either browser print or no output. Employer wants uploadable templates, PDF/Excel output, digital stamps. |
| **Required change** | 1) Create DocumentTemplate model: id, documentType, name, fileUrl (uploaded template file), isActive, createdAt. 2) Create file attachment storage (templates + document attachments). 3) Build template upload UI. 4) Implement PDF generation per document type using templates (PDF-lib / html-to-pdf / server-side rendering). 5) Implement Excel export for applicable documents. 6) Add digital stamp/signature field to documents (B/L, invoices, etc.). 7) **OPEN BUSINESS DECISION**: Confirm which documents have company templates, what format (HTML-based PDF, Word-based, etc.). |
| **Dependencies** | File storage infrastructure. PDF generation library. **OPEN BUSINESS DECISION** on template formats and which documents have templates. |
| **Acceptance criteria** | Templates uploadable per document type. B/L can be downloaded as PDF with company template + digital stamp. Invoice downloadable as PDF. Load List printable/PDF. Salary slip printable/PDF. Print version can differ from PDF version (stamp removal option). |

---

## 30. PDF / Excel / Print

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | PDF and/or Excel output per document. PDF: digital stamp/signature embedded. Print: physical stamp option. Print behavior per document. |
| **Evidence/source** | Stage 1 §6.10; Stage 2 §11; duna_source_pack.md Additional |
| **Current implementation** | ❌ No PDF generation. ❌ No Excel export. ❌ Print = browser window print (not document-specific). ❌ No digital stamp. |
| **Relevant source location** | Not present. |
| **Database support** | ❌ No file storage for generated documents. |
| **API/backend support** | ❌ No PDF generation endpoint. ❌ No Excel export endpoint. |
| **UI support** | ❌ No download/print buttons per document (except browser print). |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | All document output missing. Employer wants PDF/Excel per document type with digital stamps. |
| **Required change** | See Document Templates (§29) — this is the implementation mechanism. Additionally: 1) Add download PDF button per document page. 2) Add Excel export where applicable (manifest, ledger, load list). 3) Add print button with print-specific styling (hide UI chrome, show stamp option). |
| **Dependencies** | Document templates. PDF generation library. |
| **Acceptance criteria** | Each document page has: Download PDF, Print, (Excel where applicable) buttons. PDF includes company template layout + digital stamp. Print layout is clean (no sidebar/UI chrome). |

---

## 31. Permissions / Security

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Roles → Approvals → Agent access → Statuses → Audit/History → Reports. RBAC with module:action permissions. Agent scoped to destination. System roles cannot be deactivated. |
| **Evidence/source** | Stage 1 §4 (Control Flow); duna_source_pack.md Part 3 (Workflows / status machines / RBAC / business rules); ADR-014, ADR-015, ADR-016 |
| **Current implementation** | ✅ Permission model: id, code, module, action. ✅ Role model: id, code, name, description, isSystem, soft-delete. ✅ RolePermission junction. ✅ UserRole junction. ✅ User model with roles. ✅ JWT + refresh token rotation. ✅ Permission re-resolution per request. ✅ 147 permissions seeded across all modules. ✅ Roles soft-deleted (inactive = deletedAt set). ✅ System roles cannot be deactivated. |
| **Relevant source location** | `prisma/schema.prisma` Permission (lines 132-142), Role (lines 119-130), RolePermission (lines 144-150), UserRole (lines 155-170), User (lines 29-99) |
| **Database support** | ✅ Full RBAC model. ✅ Permission registry. ✅ Role-Permission binding. ✅ User-Role binding. |
| **API/backend support** | ✅ Auth endpoints (login, refresh, logout, me). ✅ PermissionsGuard + JwtAuthGuard. ✅ Roles admin API. ✅ Permissions read API. |
| **UI support** | ✅ Users page with role assignment. ✅ Roles page with permission assignment. ✅ Permissions list page. ✅ Permission-gated rendering in UI. |
| **Current status** | **CONFIRMED + IMPLEMENTED** |
| **Gap** | 1) Missing permissions for new models: shipper, consignee, agent, tug, barge, general-journal, document-template, numbering-sequence, audit-log, voyage-cost, document-attachment, agent:bill-read, agent:release-read, agent:manifest-read, agent:document-download. 2) Agent access control not implemented (no destination scoping in API). |
| **Required change** | 1) Add missing permissions to seed. 2) Implement agent destination scoping in API (agent can only access B/Ls/releases for their destination port). 3) Add agent-specific guards. |
| **Dependencies** | New model permissions need corresponding models to exist. |
| **Acceptance criteria** | RBAC works for all existing modules. New permissions seed correctly. Agent API endpoints filter by destination port. Unauthorized agent access to non-destination documents returns 403. |

---

## 32. Notifications / Alerts

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Status-based alerts. Approval notifications. Payment reminders. |
| **Evidence/source** | duna_source_pack.md Part 1 (Control Flow mentions status → alerts implicitly) |
| **Current implementation** | ❌ No notification system. ❌ No alerts. ❌ No in-app notifications. ❌ No email notifications. |
| **Relevant source location** | Not present in schema or modules. |
| **Database support** | ❌ No notification model. |
| **API/backend support** | ❌ No notification API. |
| **UI support** | ❌ No notification UI. |
| **Current status** | **UNCLEAR** |
| **Gap** | No notification system exists. Employer hasn't explicitly detailed notification requirements beyond the general "Control Flow" mention. |
| **Required change** | 1) **OPEN BUSINESS DECISION**: Determine notification requirements — in-app only, email, both? Which events trigger notifications? Who receives them? 2) If confirmed, implement notification model + API + UI. |
| **Dependencies** | **OPEN BUSINESS DECISION** on notification requirements. |
| **Acceptance criteria** | To be determined after business decision. |

---

## 33. UI/UX

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Mobile-responsive, collapsible sidebar, grey/neutral palette, tasteful gradients, elegant cards, polished tables, strong forms, status indicators, responsive navigation. Professional shipping/logistics look. |
| **Evidence/source** | duna_source_pack.md Part 4 (UI Pages Inventory from legacy); Stage 3 §5, §7 |
| **Current implementation** | ⚠️ Next.js 14 App Router. ⚠️ Sidebar navigation with module groups. ⚠️ Basic tables (custom per page, no shared component). ⚠️ Basic forms (custom per page). ⚠️ Design system: semantic HSL tokens, tracking-blue primary, Inter font, lucide icons. ⚠️ RTL support for fa, ar. ⚠️ 3 locales. ❌ NOT mobile-responsive (desktop-first). ❌ NOT grey/neutral palette (blue primary). ❌ NOT polished/elegant (basic operational UI). ❌ No collapsible sidebar. ❌ No status indicators (beyond basic badges). |
| **Relevant source location** | `apps/web/src/app/globals.css` — HSL tokens. `apps/web/tailwind.config.ts` — Tailwind config. `apps/web/src/components/ui/` — primitive components. `apps/web/src/components/layout/` — Sidebar, Topbar, AppShell. `design-system/MASTER.md` — design system spec. |
| **Database support** | N/A (UI only). |
| **API/backend support** | N/A (UI only). |
| **UI support** | ⚠️ Functional but not matching employer's future UI vision. Current: desktop-first, blue, basic. Employer wants: mobile-responsive, grey/neutral, gradients, elegant cards, polished tables, strong forms, status indicators, responsive nav. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Current UI is functional but doesn't match employer's vision. Major UI overhaul needed: responsive design, color palette shift, component polish, status indicators, collapsible sidebar, elegant cards. |
| **Required change** | 1) Implement responsive design (mobile-first grid, collapsible sidebar). 2) Shift palette toward grey/neutral with tasteful accent. 3) Add status indicator components (pills, dots, progress bars). 4) Polish tables (shared table component with sorting, filtering, pagination). 5) Polish forms (shared form component with validation display). 6) Add elegant card components for dashboards/KPIs. 7) Add tasteful gradients where appropriate. 8) **NOTE**: This is a large UI effort that should be planned as a dedicated phase AFTER functional gaps are resolved. |
| **Dependencies** | Functional modules complete first. Design system update. |
| **Acceptance criteria** | UI is mobile-responsive. Sidebar collapses on mobile. Palette is grey/neutral with tasteful accent. Tables are polished with shared component. Forms are strong with validation. Status indicators visible. Cards elegant for dashboard KPIs. Professional shipping/logistics look. |

---

## 34. Customer Code Format

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Customer code auto-generated (sequential like 332334). |
| **Evidence/source** | Stage 2 §9.8; duna_source_pack.md Part 1 ("سیستم باید Code اختصاصی Customer را اتوماتیک ایجاد کند") |
| **Current implementation** | ✅ Customer.code exists (String, unique). ✅ Configurable numbering (ADR-008 design says configurable, but implementation uses CUS-001 style). ⚠️ Actual numbering format not verified — is it sequential numeric (332334) or CUS-XXXX? |
| **Relevant source location** | `prisma/schema.prisma` Customer.model.code (line 259); Customer service numbering logic |
| **Database support** | ✅ Customer.code field exists. |
| **API/backend support** | ✅ Customer creation auto-generates code. |
| **UI support** | ✅ Customer code displayed in list/detail. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Numbering format not confirmed — employer says "sequential like 332334" but current implementation may use CUS-XXXX format. |
| **Required change** | 1) Verify current customer code format. 2) If not matching employer expectation (sequential numeric), update to match. |
| **Dependencies** | Customer service numbering logic. |
| **Acceptance criteria** | New customer gets auto-generated code in expected format (sequential numeric or CUS-XXXX as confirmed). |

---

## 35. Voyage P&L / Cost Tracking

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | Voyage P&L: revenue - costs. Costs tracked per voyage. Job collects costs. |
| **Evidence/source** | Stage 1 §6.9; Stage 2 §14; duna_source_pack.md Part 1 |
| **Current implementation** | ✅ Job model with JobCostItem (COST/INCOME). ✅ Job→voyage link. ✅ Voyage→jobs link. ❌ No direct voyage cost aggregation. ❌ No Voyage P&L report. ❌ Costs not automatically linked to voyage (Job must be manually linked to voyage). |
| **Relevant source location** | `prisma/schema.prisma` Job model.voyageId (line 1729); JobCostItem (lines 1759-1775) |
| **Database support** | ✅ Job→Voyage relation exists. ✅ JobCostItem has amount and kind. ⚠️ Costs must be manually linked to voyage via Job. |
| **API/backend support** | ✅ Job CRUD with cost items. ❌ No voyage cost aggregation endpoint. ❌ No P&L endpoint. |
| **UI support** | ❌ No Voyage P&L page. ❌ No cost tracking UI per voyage. |
| **Current status** | **CONFIRMED + PARTIAL** |
| **Gap** | Job→Voyage link exists but no aggregation. No P&L report. Costs not automatically traced to voyage. |
| **Required change** | 1) Add API endpoint to aggregate voyage costs (from jobs linked to voyage + GJ entries linked to voyage). 2) Add API endpoint for voyage revenue (from invoices linked to voyage). 3) Build Voyage P&L page. 4) **OPEN BUSINESS DECISION**: Confirm if all costs must be linked to voyage via Job, or if direct voyage cost entries are needed. |
| **Dependencies** | Job model (exists). General Journal (for non-job costs). **OPEN BUSINESS DECISION** on cost-voyage linking. |
| **Acceptance criteria** | Voyage P&L page shows: voyage number, vessel, dates, revenue (AED), costs (AED), profit (AED). Costs broken down by category. Revenue from linked invoices. |

---

## 36. Document Attachments / File Storage

| Dimension | Detail |
|-----------|--------|
| **Business requirement** | File storage per document. ID document photo (back of ID) for payments. Document attachments. |
| **Evidence/source** | Stage 1 §6.7; Stage 2 §8; Stage 2 §10.7; duna_source_pack.md Additional |
| **Current implementation** | ❌ No file attachment model. ❌ No file storage. ❌ No attachment UI. |
| **Relevant source location** | Not present in schema. |
| **Database support** | ❌ No attachment model. |
| **API/backend support** | ❌ No file upload API. ❌ No file download API. |
| **UI support** | ❌ No file upload UI. ❌ No attachment display. |
| **Current status** | **CONFIRMED + MISSING** |
| **Gap** | File storage entirely absent. Employer wants ID doc photos for payments, document attachments. |
| **Required change** | 1) Create FileAttachment model: id, fileName, fileUrl, fileType, fileSize, uploadedById, entityType, entityId, createdAt. 2) Add file upload API (multipart). 3) Add file download API. 4) Build attachment UI (upload, list, download). 5) Integrate into Voucher (ID doc photo), B/L (supporting docs), Invoice (supporting docs), etc. |
| **Dependencies** | File storage infrastructure (local or cloud). |
| **Acceptance criteria** | Voucher creation allows ID document photo upload. B/L shows attached documents. Files downloadable. |

---

## Summary Counts

| Status | Count | Key Areas |
|--------|-------|-----------|
| CONFIRMED + IMPLEMENTED | 5 | Yard, Release Order, Delivery Order, Permissions/Security, Customer (partial — DB OK) |
| CONFIRMED + PARTIAL | 14 | Customer 360, Port, Vessel, Voyage, Cargo, Inspection, Loading List, Actual Loading, Proforma, Quotation, Salary, Ledger, UI/UX, Customer Code |
| CONFIRMED + MISSING | 9 | General Journal, VAT, Reports, Document Templates, PDF/Excel/Print, Archive, Notifications (unclear), Agent Portal (missing capabilities), File Attachments |
| IMPLEMENTED BUT INCORRECT | 4 | Invoice (VAT header-level, no job link), Voucher (single invoice, no multi-allocate), Manifest (wrong order, Customer FKs), B/L (wrong order, Customer FKs, global numbering) |
| CONFLICTING | 4 | Shipper, Consignee, Agent, Manifest (party model) |
| UNCLEAR / OPEN BUSINESS DECISION | 8+ | Tug/Barge modeling, Voyage numbering, Inspection flow details, Load List lifecycle, Voucher numbering, Proforma item structure, Notification requirements, Archive rules, Salary workflow, Agent portal capabilities, VAT rules, Template formats |

---

## Key Conflicts Requiring Immediate Resolution

These are the highest-priority conflicts that block correct implementation:

1. **Shipper/Consignee/Agent are Customers** — CONFLICTING. Core data model is wrong. Must create separate models and migrate B/L/Manifest FKs.

2. **B/L → Manifest order reversed** — CONFLICTING. Current: Manifest first, then B/L. Employer: B/L first, then Manifest from B/Ls. Requires manifest model restructure.

3. **Global numbering everywhere** — CONFLICTING. Employer wants per-destination (KHS/26-110). Current: BL-YYMM-#####, MAN-YYMM-#####, INV-YYMM-#####, etc.

4. **Invoice VAT header-level** — IMPLEMENTED BUT INCORRECT. Evidence shows per-line VAT.

5. **Voucher single invoice** — IMPLEMENTED BUT INCORRECT. Evidence shows multi-invoice payments.

---

*Stage 4 of 8 — completed and persisted.*
