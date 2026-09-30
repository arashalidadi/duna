# 01 Employer Requirements Analysis

**Stage 1 complete.** Analysis of employer requirements from dunaData sources.

---

## 1. Company Profile

**Duna Shipping** — UAE-based international shipping/maritime logistics company.
- Handles heavy cargo, machinery, equipment.
- Ports: Dubai (Hamriya) → Iran (Khorramshahr, Bandar Abbas, Bushehr, etc.)
- Email domains: dunashipping.com, yahoo.com
- Phone: +971 (UAE), +98 (Iran)

---

## 2. Four Business Flows

1. **Operational Flow:** Cargo → Yard → Inspection → Loading List → Vessel/Voyage → B/L → Manifest → Destination
2. **Commercial Flow:** Customer → Shipment/Job → Invoice → Receivable → Payment/Balance
3. **Document Flow:** Source Documents → B/L / Manifest / Invoice / Release / Delivery / Vouchers → Archive
4. **Control Flow:** Roles → Approvals → Agent access → Statuses → Audit/History → Reports

---

## 3. Core Domain Concepts (CRITICAL)

| Concept | Meaning |
|----------|---------|
| **Customer** | Internal commercial counterparty. Invoice issued TO them. NOT same as Shipper/Consignee/Agent. |
| **Shipper** | Party sending cargo in transport document. Can be different from Customer. |
| **Consignee** | Receiving party at destination in transport document. Can be different from Customer. |
| **Agent** | Destination representative or port agent. |
| **Cargo** | Operational unit. Full audit trail from receipt to delivery. |
| **Shipment/Job** | Operational/commercial case. Collects multi-stage costs over time. Parent to multiple Cargo, costs, documents. |
| **B/L** | Transport document for a cargo/shipment. |
| **Manifest** | Consolidation of B/Ls for a Vessel/Voyage. |
| **Invoice** | Financial claim against Customer. |
| **Ledger** | Financial history + balance per customer. |
| **Release Order** | Permission to release documents/cargo after payment conditions met. |
| **Delivery Order** | Physical cargo handover document. |

**Critical distinction:** Customer is NOT Shipper/Consignee/Agent. This is the single most important modeling rule from the employer.

---

## 4. Reference Document Evidence

From `shipping_documents_detailed_reference.md` (ilovepdf_merged.pdf, 9 pages):

### 4.1 Bill of Lading (page 1)
- Number: `KHS/26-110`
- Shipper: RAS AL KHAIMAH MACHINERIES LLC (Dubai, UAE)
- Consignee: JOINT MECHANIC CO (national ID: 10100670462)
- Notify: SAME AS CONSIGNEE
- Destination Agent: BADBAN ARVAND ROOD SHIPPING CO (Khorramshahr, Iran)
- Vessel: MEHDI 11
- Voyage: 02/26
- POL: HAMRIYA PORT, DUBAI, UAE
- POD: KHORRAM SHAHR, PERSIAN GULF, IRAN
- Cargo: 1 used Komatsu D155A bulldozer, CH.NO: KMT0D105EMC088308, (ON DECK)
- Gross weight: 42,000 KG
- Freight: PREPAID
- Issue place: DUBAI, date: 29-AUG-26
- Originals: 1
- Stamp & signature: AS AGENT (placeholder)

### 4.2 Manifest (pages 2-4, one manifest)
- Number: `DSMAN/KHO-26-006`
- Date: 05-Sep-26
- Voyage: 02/26
- Barge: MEHDI 11
- Tug: LAYAN GULF  ← KEY: Tug and Barge are separate entities
- POL: HAMRIYA, DUBAI, UAE
- POD: KHORRAM SHAHR, PERSIAN GULF, IRAN
- Table columns: # | BL | DESCRIPTION | CONSIGNEE | SHIPPER | UNIT/PKGS | GROSS WEIGHT
- Multiple rows, each linked to a B/L number
- Sample data shows 14+ rows with different consignees/shippers (12+ different parties in one manifest)
- Forwarder B/L numbers appear (e.g. NES260900266)

### 4.3 Tax Invoice (page 5)
- Number: `DSINV/26-172`
- Customer, voyage reference, shipment references
- Charge lines, VAT, totals

### 4.4 Proforma Invoice (page 6)
- Number: `DSPRO/26-001`
- Seller, buyer, PI number/date, origin, delivery/payment terms
- Cargo lines, weights, prices, total

### 4.5 Quotation (page 7)
- Number: `DSQUO/25-017`
- Customer, cargo description, service/charge lines
- Subtotal, other charges, grand total

### 4.6 Ledger Account (page 8)
- Date, particulars, voucher type/number, debit, credit, running balance, closing balance

### 4.7 Receipt Voucher (page 9)
- Voucher number: 477
- Account, references, amount, payment method, description
- Amount in words, signature

---

## 5. Numbering Schemes (from evidence)

| Document | Format Example |
|----------|---------------|
| B/L | `KHS/26-110` (per-destination code `KHS` + year + sequence) |
| Manifest | `DSMAN/KHO-26-006` |
| Invoice | `DSINV/26-172` |
| Proforma | `DSPRO/26-001` |
| Quotation | `DSQUO/25-017` |
| Ledger Voucher | `1380`, `2026/446`, `1517` |
| Receipt Voucher | `477` |

**Critical:** Numbering is per-destination (KHS for Khorramshahr), NOT global sequence. The system currently uses global BOL-YYMM-##### numbering.

---

## 6. Employer-Stated Requirements (from transcripts + analysis)

### 6.1 Customer 360
- Customer is internal commercial entity
- Must see: jobs, invoices, payments, receipts, ledger, balance, cargo/shipment history, B/L history, comments, activity history
- This is one of the most important management pages

### 6.2 Cargo Intake
Fields: Customer, Shipper, Consignee, Description, Chassis/Serial, Units/Packages, Weight, POL, Destination, Yard, Arrival Date, Documents, Comment
- **Rule:** Selecting Port shows only related Yards

### 6.3 Inspection
- Inspection Booked → Status Pending → Done
- **Rule:** Inspection = DONE is prerequisite for Loading List
- Result: Done or Failed/Recheck? Who approves? Report exists?

### 6.4 Loading List
- Collection of cargo for a Vessel/Voyage
- Must: create, edit, add/remove cargo, print/PDF, finalize, record loading status per item
- Lifecycle: Draft → In Progress → Partially Loaded → Completed → Finalized
- Per-cargo: Selected → Loaded / Not Loaded → Returned to Yard
- Statuses need employer confirmation

### 6.5 B/L
- Made from finalized Loading/Cargo
- Process: Prepare → Draft → Send to Customer → Revision → Approved → Final → Released/Unreleased
- Draft and Released are different concepts
- **Rule:** Draft/Final = document production status; Released = delivery permission

### 6.6 Manifest
- From finalized B/Ls (employer says Manifest is built from issued B/Ls — opposite of current implementation)
- Multiple B/Ls per manifest

### 6.7 Accounting
- Invoice from B/L, linked to Job
- Job collects costs: repair, customs, crane, lowbed, transport, port, vessel, miscellaneous
- Payment/Receipt with: payer/payee, invoice ref, B/L ref, debit/credit, ID docs, signature, attachments
- Advance payments, multi-invoice allocation (Agst Ref)
- General Journal for non-invoice transactions

### 6.8 Agent Portal
- Agent sees B/L, Release status, payment status, document access for their destination
- Not just bookings

### 6.9 Reports
- Vessel/Voyage P&L
- Manifest reports
- Cost reports
- VAT reports (monthly/quarterly/yearly)
- Tax/year reporting

### 6.10 Documents
- Templates for: Loading List, B/L, Manifest, Invoice, Proforma, Quotation, Receipt, Payment, Ledger, Release Order, Delivery Order, Salary Slip, Letters
- PDF and/or Excel output
- Uploaded templates
- Digital stamp/signature
- Physical print behavior

---

## 7. Key Business Rules Confirmed

1. **Customer ≠ Shipper ≠ Consignee ≠ Agent** — confirmed by employer, shown in B/L sample
2. **Inspection = DONE → eligible for Loading List** — confirmed
3. **Port → Yards relationship** — Yards belong to Port; selecting Port filters Yards
4. **Vessel ≠ Voyage** — Vessel is asset, Voyage is sailing event
5. **Manifest = consolidation of B/Ls** — employer says B/L first, then Manifest (current code does opposite)
6. **Tug and Barge separate** — shown in manifest sample
7. **Per-destination numbering** — B/L `KHS/26-110` has destination code prefix
8. **Multiple parties in one manifest** — 12+ different shippers/consignees
9. **Job collects costs** — multi-stage, multi-document
10. **Release requires payment** — "no money, no cargo" principle

---

## 8. Open Business Decisions (cannot be determined from evidence)

See gap-analysis-and-final-questions.md for full list of 35+ questions.

Key unresolved:
- Tug/Barge: one record or two linked records?
- Voyage numbering: per-destination or global?
- Destination port codes: KHS vs KHO for same destination?
- Customer code format and credit terms
- Agent per-destination: one or many?
- Inspection result: only Done or Failed/Recheck?
- Job creation trigger: what event creates a Job?
- Cost categories: full list + direct/indirect classification
- VAT: which services taxable, rate, line vs summary
- Invoice correction: Credit Note or Cancel+New?
- Payment signature: photo of paper or digital?
- Release conditions: exact rules and approver
- Delivery Order trigger: exact business rule
- Final document: never reopened?
- Template existence: which documents have company templates?
- Salary: who sets/approves/pays, components, period

---

## 9. What Employer Does NOT Want

- Generic ERP behavior invented by developer
- Shipper/Consignee merged into Customer
- Global numbering when per-destination is needed
- Manifest-before-B/L order (employer wants B/L → Manifest)
- Invoice without Job link
- Agent portal limited to bookings only
- Missing reports (P&L, VAT, etc.)
- Missing templates

---

*Stage 1 of 8 — completed and persisted.*
