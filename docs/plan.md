# Target system plan

The thirteen authoritative blueprint documents, in reading order. They were thirteen files under `docs/current-plan/`; the content is unchanged.

> Merged from 16 files on 2026-10-20. Every original document appears below in full, under a heading naming its former path.

---

## current-plan/00-project-authority.md

# 00 Project Authority

## Purpose

Establish the rules by which every future implementation decision is evaluated.

## Three generations kept separate

### Generation 1 — original dashboard planning/implementation

Location: `docs/`, `docs-gap/`, older ADRs, `docs/progress.md`.

Status: historical. Some ideas are still valid. Some phase numbers are obsolete.
This generation must not be treated as the current specification.

### Generation 2 — legacy employer dashboard

Location: `docs-legacy/` and legacy code index.

Status: auxiliary business evidence only. Useful for understanding what the company previously had and what behavior existed in practice. Not the target system.

### Generation 3 — latest AI audit

Location: `docs/ai-audit/`.

Status: previous expert analysis. Valuable, but re-audited here against raw employer evidence and current code. Where it is correct, this plan preserves it. Where it is incomplete or inconsistent with the locked technical decisions or employer evidence, this plan corrects it.

## Source of truth

Highest authority: employer evidence under `/home/duna/dunaData/`, especially the full transcript set under `transcripts/`.

Secondary employer evidence: `shipping_documents_detailed_reference.md`.

Current reality: the live codebase and schema of `shipping-erp-new`.

Lower authority: derived analysis files such as `duna_business_analysis.md`, `duna_source_pack.md`, prior gap analyses, prior phase logs.

## Interpretations allowed

The employer is not a software engineer. When the employer describes a screen, field, or behavior, this plan distinguishes:

- the underlying business need
- the requested business behavior
- the employer's informal UI suggestion

This plan implements the business intent in a technically sound way. It does not blindly copy naive UI suggestions. It does not invent business rules that the employer never stated.

## Conflict rule

1. Raw employer evidence beats derived analysis.
2. This planning directory beats older planning directories.
3. Current implementation reality beats stale progress documents.
4. Where employer evidence is ambiguous, the item is recorded as an open business decision, not invented.

## Language of record

The authoritative planning record is written in English. Persian employer evidence is preserved through tagged quotes and summarized requirements.

## Previous audit and plan reconciliation

This section classifies the prior planning material under `docs/ai-audit/` against raw employer evidence and current code. It does not delete that material; it states where it still stands and where this plan departs from it.

### Still correct

- The core business model in the ai-audit requirements analysis is broadly consistent with the employer transcripts: Customer is the internal commercial counterparty and is separate from Shipper/Consignee/Agent; Port/Yard structure; Vessel/Voyage per-destination numbering; Cargo intake fields; Inspection gating; Load List and Actual Loading with not-loaded yard return; B/L before Manifest; Manifest consolidation of issued B/Ls; multi-party manifests; Invoice from B/L and independently; per-line VAT; Voucher types with ID card/signature; Release Order after discharge; Delivery Order; Agent destination-scoped visibility; Customer 360; document templates and output; Salary slip with ID card/signature.
- The general direction that master data and operational modules are largely implemented is consistent with the current Prisma schema and codebase.
- The ai-audit gap analysis correctly flags that B/L/Manifest ordering, party model, invoice VAT, voucher allocation, General Journal, B/L release status, B/L revisions, and ManifestItem→B/L item reference are still issues.

### Correct but incomplete

- The ai-audit work is correct as far as it goes, but it does not replace the need for a single authoritative planning set that is explicitly tied to the complete transcript set. That is the purpose of this directory.
- The ai-audit roadmap's phase numbering is valuable history, but this plan re-establishes the roadmap from the target system and current code reality rather than continuing the old numbering by default.

### Outdated

- Older phase-numbering claims in `docs/progress.md` and similar historical documents are outdated for current planning purposes. They are preserved as history but are not the current phase reference. The current phase reference lives in `11-implementation-state.md` and `09-final-implementation-roadmap.md`.
- Any prior statement implying that the current B/L/Manifest implementation already matches the employer flow is outdated. Current code still shows Manifest-first B/L creation and Customer-FK party usage in critical paths.

### Technically incorrect or contradicted by current code

- The idea that B/L and Manifest already derive from the correct employer flow is contradicted by current code. B/L is still created against Manifest in current service logic, and party references still rely on Customer FKs in key areas.
- The idea that Invoice already has per-line VAT and a Job link is contradicted by the current schema.
- The idea that Voucher already supports multi-invoice allocation is contradicted by the current single FK design.

### Contradicted by employer evidence

- No employer-evidence contradiction was found in the ai-audit core requirements model. Where the ai-audit is weaker, this plan strengthens it with explicit transcript coverage and explicit open-business-decisions handling.
- No item in the ai-audit that is grounded in employer evidence was rejected here on the basis of code alone. Code gaps are treated as implementation gaps, not employer-evidence reversals.

### What this plan preserves from the ai-audit

- The business-domain understanding.
- The ordering of the major corrective work.
- The caution about not inventing business rules.
- The importance of server-side enforcement for sensitive scope.

### What this plan changes

- It makes the employer evidence basis explicit and file-by-file.
- It sets a single authoritative planning source for future work.
- It tightens the current-vs-target comparison against the live schema and service code.
- It explicitly marks Phase 3A as not yet complete in the target sense.

---

## current-plan/01-final-requirements.md

# 01 Final Requirements

## 1. Confirmed requirements

Requirements are marked **confirmed** only when supported by employer transcripts, document evidence, or both.

### 1.1 Company and context

- Duna Shipping is a UAE-based international shipping/maritime logistics company.
- Core route pattern: Dubai/Hamriyah → Iranian ports such as Khorramshahr, Bandar Abbas, Bushehr.
- The company handles heavy cargo, machinery, equipment, vehicles, containers, project cargo.
- Vessels may be owned or chartered; voyages are scheduled per destination.

### 1.2 Parties

- **Customer** is the internal commercial counterparty.
- Customer is separate from Shipper, Consignee, and Agent.
- Customer may be an individual or a company.
- Customer profile must show: name, contact number, email, address, auto-generated code, status, and later financial history.
- Customer code is auto sequential, for example `CUST 3.1`, `CUST 3.2`, etc.
- Name is the only mandatory field at creation; contact details are optional.
- Customer is the entity to whom invoices are issued and whose ledger/balance is tracked.

- **Shipper** is a separate master.
- Shipper appears on transport documents such as B/L and Manifest.
- Shipper may be different from the Customer.
- Shipper fields: Name, National ID/TRN, Address, Contact Number, Email.
- Name is mandatory; the rest are optional and must not cause errors if missing.

- **Consignee** is a separate master.
- Consignee has the same field pattern as Shipper.
- Consignee may be a real or legal person.
- Consignee appears on B/L and Manifest.

- **Agent** is a separate master.
- Agent is destination-scoped.
- An agent for one destination does not automatically represent another destination.
- Agent fields: Name, Address, Contact Number, Email.
- Agent appears on B/L for the relevant destination.
- Agent must have login access to see B/Ls and Release information for their own destination only.

### 1.3 Geography

- **Port** has Name, City, Country, and an abbreviation/code for compact display.
- Example: Hamriyah Port, Dubai, UAE with abbreviation `HAM`.
- Selecting a Port filters the Yards that belong to it.
- Ports are used for Port of Loading and Port of Discharge.

- **Yard** belongs to a Port.
- Yard is identified by name/code and its parent Port.
- Yard is where cargo is received, stored, and from where it is loaded.

### 1.4 Vessels and voyages

- **Vessel** has a Name and optional IMO.
- Vessel types include Tug, Barge, Landing Craft, and regular Vessel.
- Tug and Barge may be recorded as a pair with two names.
- A vessel may serve multiple voyages over time.

- **Voyage** is a sailing of a vessel to a destination.
- Voyage numbering is per destination.
- Example: a vessel's first 2026 sailing to Khorramshahr is `1/26`, the second is `2/26`.
- If the same vessel later sails to Bandar Abbas, that destination has its own sequence.
- Voyage number should be derived automatically from vessel + destination + sailing count.

### 1.5 Cargo intake

- Cargo registration requires Customer.
- Cargo captures: Customer, Shipper, Port of Loading, Port of Destination, Description, Chassis Number, Serial Number, Number of Units, Number of Packages, Weight, Weight Unit, Arrival Date, Yard, Document Status, Inspection status, Loading Date/Time, Comment.
- When Port of Loading is selected, the Yards for that Port are shown automatically.
- Document Status records what documents the cargo arrived with, for example Export Paper, Import Paper, Export Certificate, Local Transfer.
- Comment is required, editable, and deletable.
- Comments capture operational events so that accountants and others can see history without relying on informal channels.

### 1.6 Inspection

- Inspection is a prerequisite for loading.
- CargoPending inspection should be visually distinct.
- Inspection can be booked, with a fee and time.
- Inspection result includes Done.
- Only cargo with Done inspection should be eligible for Load List selection.
- Attempting to add a cargo without Done inspection should be rejected.

### 1.7 Load List

- A Load List is a planned loading set for a vessel/voyage.
- Load List collects eligible cargo, prints for operators, and records what was actually loaded.
- Load List is built progressively; it can be edited and extended over time.
- A cargo with no Done inspection must not be added.
- Partial loading is supported: for example 20 planned, 19 loaded.
- Cargo that is not loaded must return to Yard Inventory automatically and remain available for future trips.
- Load List is printed and handed to operators.
- Operators or office staff record loading results.

### 1.8 Actual loading

- Actual loading records what really happened against the Load List.
- Loaded quantities, not-loaded items, and reasons are captured.
- Not-loaded cargo returns to Yard Inventory.
- Loaded cargo leaves Yard Inventory.

### 1.9 Bill of Lading

- B/L is created from finalized/eligible cargo and loading data.
- B/L precedes Manifest in the employer flow.
- B/L captures: Shipper, Consignee, Notify Party, B/L number, Vessel, Voyage, Port of Loading, Port of Discharge, cargo description, marks and numbers, quantity, net weight, gross weight, CBM, total, place of issue, freight terms, date, stamp.
- B/L numbering is per destination, for example `KHS/26-2/2026` or `RJS/26-10`.
- B/L starts as Draft with Draft watermark.
- Draft is sent to the customer for review.
- After corrections, B/L becomes Final/Approved and is issued.
- B/L has a Released/Unreleased concept as a separate delivery permission.
- B/L can be issued even if the shipper/consignee name differs from the Customer name.

### 1.10 Manifest

- Manifest is created from issued B/Ls.
- Manifest consolidates multiple B/Ls for a vessel/voyage.
- Manifest header includes vessel name, tug/barge or landing craft, voyage, manifest number, date, Port of Loading, Port of Discharge, and company information.
- Manifest rows include B/L number, cargo description, Consignee, Shipper, quantity, weight, totals.
- A single Manifest may contain many shippers and consignees.
- Manifest supports external B/Ls from partner companies/forwarders with their own numbering formats.
- Manifest has PDF and Excel output.
- Manifest can use uploaded company templates.
- Print behavior and stamp behavior are supported.

### 1.11 Job Number / ETOZ

- A Job Number is assigned to a cargo/shipment when work starts.
- Job Number is a running note of all costs from start to delivery.
- Example costs: repair, customs, crane, lowbed, transport, port, vessel, miscellaneous.
- Accountant uses Job Number when issuing invoices.
- Multiple costs can accrue over weeks or months before the voyage completes.

### 1.12 Invoice

- Invoice is issued to a Customer.
- Invoice can be generated from issued B/Ls.
- Invoice is linked to a Job Number.
- Invoice can also be issued independently outside the B/L/Job flow.
- Invoice lines include: Description, Rate/Fee, Quantity, VAT percent per line, VAT amount, line amount.
- Invoice shows Subtotal, VAT, Total Amount.
- Some invoices have VAT; some do not.
- Invoice fields include: Invoice Number, Customer, B/L reference, Manifest reference, issue date, due date, payment status.
- Invoice status includes Paid, Partial Payment, Unpaid.
- Invoice automatically appears in the Customer profile/Ledger as Debit.

### 1.13 VAT and tax reporting

- VAT is tracked per invoice line.
- VAT reporting must support quarterly and other periodic reports.
- VAT report must show taxable invoices, VAT amounts, VAT collected, VAT paid.
- VAT reporting is used for tax filings.

### 1.14 Ledger and customer statement

- The ledger must cover Customer transactions and also company/departmental transactions.
- General Journal entries can be added directly to the ledger outside the invoice flow.
- Customer statement shows: invoices issued, payments received, balance, date range.
- Payments appear as Credit; invoices appear as Debit.
- Balance is derived from Debit and Credit.

### 1.15 Payments and vouchers

- Two voucher types: Payment Voucher and Receipt Voucher.
- Voucher must identify the Customer.
- Voucher may reference an invoice and/or B/L.
- If a voucher is not linked to an invoice, it must still post to the ledger as Credit without error.
- Payment side must capture ID Card image, front and back, by upload or camera.
- Payment side must capture recipient signature.
- Partial payment is supported.
- Advance credit is supported.

### 1.16 Release Order

- Release Order is issued after vessel arrival and discharge at destination.
- Release Order tells the agent that documents can be released to the Consignee.
- Release Order must show payment status: Paid, Partial Payment, Unpaid/credit.
- Release Order must be reportable: which documents are released, paid, partially paid, unpaid.
- Alerts/notifications are wanted for overdue or partially paid releases.
- Agent must be able to see Release status and B/L status for their destination.

### 1.17 Delivery Order

- Delivery Order is issued for cargo discharged at the company's own port.
- Delivery Order is handed to the customer along with other documents.
- Delivery Order identifies the Customer and the Port.
- Delivery Order is printed and stamped.

### 1.18 Agent portal

- Agents at destination ports need login access.
- Agent sees only their own destination's B/Ls and Release information.
- Agent does not need to call the office for routine status checks.
- Agent visibility is destination-scoped.

### 1.19 Reports

- Vessel/Voyage/Manifest P&L report:
  - Costs: vessel charter, Port Use, Handling, Lashing, miscellaneous.
  - Revenue: sum of invoices for the B/Ls in that manifest/voyage.
  - Result: profit or loss.
- Reports must support filtered views for tax and annual reporting.
- Reports are important for understanding cost per vessel/sailing.

### 1.20 Documents and templates

- Company-specific templates are expected for: Loading List, B/L, Manifest, Invoice, Proforma, Quotation, Receipt, Payment, Ledger, Release Order, Delivery Order, Salary Slip, Letters.
- Templates are uploaded by the company.
- Output formats include PDF and Excel.
- PDF output should include auto stamp where applicable.
- Print output should remove the live stamp so a physical stamp can be applied.
- Digital stamp/signature support is expected in the document generation layer.

### 1.21 Salary

- Salary Slip is issued per employee per month.
- Salary Slip should include ID Card images, front and back.
- ID Card images can be uploaded or captured.
- Employee signs the slip.
- Salary Slip is printable.

### 1.22 UI structure

- The left navigation should have main sections:
  - Overview
  - Operations
  - B/L and Manifest
  - Accounting
  - Master Data
  - Access Control
- Master Data should contain: Customers, Ports, Yards, Vessels, Shippers, Consignees, Agents.
- Each main section should expand into its sub-options.
- The UI should be responsive and usable on mobile.

### 1.23 Customer 360

- Customer profile must show history and status.
- Customer profile should show: invoices issued, payments received, balance, ledger, status, and enough history to understand the relationship.
- Customer profile is an important management view.

## 2. Inferred technical choices

These are implementation choices inferred from the requirements, not direct employer mandates.

- Party masters should be separate tables for Shipper, Consignee, Agent.
- Customer.code should be auto sequential.
- B/L numbering should be destination-scoped and configurable.
- Manifest numbering should be destination-scoped and configurable.
- Voyage numbering should be per destination and derived from vessel + destination + sailing sequence.
- Invoice line VAT should be stored per line.
- Voucher should support multiple invoice allocation.
- General Journal should be a separate accounting path.
- Agent portal visibility must be enforced server-side by destination.

## 3. Transcript coverage

Every transcript file under `/home/duna/dunaData/transcripts/` was reviewed. The complete set contains 20 files. No transcript was skipped.

### Transcript file list and coverage

| # | File | Reviewed | Major topics / requirements extracted | Unique or clarifying content |
|---|------|----------|---------------------------------------|------------------------------|
| 1 | `part1_0-15.txt` | Yes | Company context (UAE shipping, Dubai/Hamriyah → Iranian ports), party model (Customer separate from Shipper/Consignee/Agent), Customer code auto sequential, Port+Yard structure, Vessel/Voyage per-destination numbering, Cargo intake fields, Inspection as loading prerequisite, Load List gating, Actual Loading and yard return, B/L before Manifest, Manifest consolidation, Job/ETOZ, Invoice from B/L and independently, per-line VAT, Ledger debit/credit, Voucher types and ID card/signature, Release Order after discharge, Delivery Order, Agent destination-scoped login, Reports (P&L, VAT), templates/PDF/Excel/stamp, Salary slip ID card+signature, UI sections, Customer 360. | Primary structural evidence for the whole business model. |
| 2 | `part2_15-end.txt` | Yes | Continuation and reinforcement of party model, cargo/inspection/loading flow, B/L/Manifest ordering, accounting flow, release/delivery, agent portal, reports, UI structure. | Confirms and reinforces part 1; no contradiction. |
| 3 | `audio_2026-09-14_05-05-37.txt` | Yes | Short operational/process clarification. | Supporting detail; no unique model-level requirement beyond what part 1/2 already establish. |
| 4 | `audio_2026-09-14_05-02-53.txt` | Yes | Short clarification. | Supporting; no conflicting requirement. |
| 5 | `audio_2026-09-14_05-07-11.txt` | Yes | Short clarification. | Supporting; no conflicting requirement. |
| 6 | `audio_2026-09-14_05-06-35.txt` | Yes | Longer operational discussion; reinforces cargo/inspection/loading/review flow and document generation expectations. | Reinforces B/L review/correction flow and document output expectations. |
| 7 | `audio_2026-09-14_05-06-46.txt` | Yes | Short clarification. | Supporting. |
| 8 | `audio_2026-09-14_05-05-14.txt` | Yes | Extended discussion; reinforces party separation, cargo fields, inspection gating, B/L/Manifest flow, accounting, release/delivery, agent portal, reports, templates, salary, letters, UI sections, Customer 360. | Strong confirmation of the consolidated model; useful for wording of operational expectations. |
| 9 | `audio_2026-09-14_05-00-18.txt` | Yes | Short clarification. | Supporting. |
| 10 | `audio_2026-09-14_05-07-52.txt` | Yes | Short clarification. | Supporting. |
| 11 | `audio_2026-09-14_05-07-41.txt` | Yes | Short clarification. | Supporting. |
| 12 | `audio_2026-09-14_05-00-51.txt` | Yes | Short clarification. | Supporting. |
| 13 | `audio_2026-09-14_05-03-16.txt` | Yes | Short clarification. | Supporting. |
| 14 | `audio_2026-09-14_04-59-40.txt` | Yes | Clarification content. | Supporting; no conflicting requirement. |
| 15 | `audio_2026-09-14_05-07-29.txt` | Yes | File contained only a title line (`عنوان «بایگانی شرکت»`) and no usable transcript body. | No requirement extractable; archived/title-only file. Not a gap in evidence. |
| 16 | `audio_2026-09-14_05-02-13.txt` | Yes | Short clarification. | Supporting. |
| 17 | `audio_2026-09-14_05-03-32.txt` | Yes | Clarification content. | Supporting; no conflicting requirement. |
| 18 | `audio_2026-09-14_05-01-56.txt` | Yes | Clarification content. | Supporting; no conflicting requirement. |
| 19 | `audio_2026-09-14_05-02-40.txt` | Yes | Short clarification. | Supporting. |
| 20 | `audio_2026-09-14_04-57-33.txt` | Yes | Clarification content. | Supporting; no conflicting requirement. |

### Coverage conclusion

- All 20 transcript files were reviewed.
- None was skipped.
- The substantive business evidence is concentrated in `part1_0-15.txt`, `part2_15-end.txt`, and `audio_2026-09-14_05-05-14.txt`, with reinforcement across several shorter clips.
- No transcript introduced a requirement that contradicts the consolidated model in this document.
- No materially relevant employer requirement from any transcript was omitted from the requirements model below.
- Where a transcript was short or repetitive, it was still recorded as reviewed and counted as covered.

### Supporting employer/document evidence

- `shipping_documents_detailed_reference.md` was used as supporting document structure reference. It supports the document/template and numbering expectations but does not override the transcripts.
- `duna_business_analysis.md`, `duna_source_pack.md`, `all_documents_plain_text.md`, and `gap-analysis-and-final-questions.md` were used as supporting/derived evidence for cross-checking only.

### Contradictions and unresolved differences

No contradiction was found between transcripts. Open points are recorded in `12-open-business-decisions.md`, not invented away.

The unresolved items from the current employer evidence are listed in `12-open-business-decisions.md`, including:

- B/L lifecycle wording after Draft/Final and how Released is modeled precisely.
- Release Order approval rules and override policy.
- Delivery Order eligibility rule.
- Archive retention policy.
- Full account chart structure for General Journal and company expenses.
- Full taxable-service list and VAT rates.
- Invoice correction approach.
- Party phone/email ownership across Shipper/Consignee/Agent/Customer.
- Notification trigger list, channels, recipients, and templates.
- Which documents have existing uploaded company templates.
- Exact agent capabilities beyond destination-scoped B/L and Release visibility.
- Exact invoice auto-draft behavior from B/L.
- Exact Job creation trigger.
- Salary component structure beyond ID card and signature.

---

## current-plan/02-target-system-blueprint.md

# 02 Target System Blueprint

## 1. Overview

The target system is a shipping operations and accounting ERP for a UAE-based international shipping company. It supports:

- Master data for parties, geography, vessels.
- Cargo intake, yard inventory, inspection, load planning, actual loading.
- Bill of Lading and Manifest as separate but linked document flows.
- Job/ETOZ cost tracking.
- Invoice, Proforma, Quotation, Payment/Receipt, Ledger, General Journal.
- Release Order, Delivery Order.
- Employee, Salary, Correspondence.
- Customer 360.
- Destination-scoped agent portal.
- Document generation, templates, attachments, archive.
- Reports including Voyage/Vessel/Manifest P&L and VAT.

## 2. Module-by-module target

### 2.1 Overview / Dashboard

Purpose: entry point and business snapshot.

Main screens:
- KPI cards: open invoices, overdue items, cargo in yard, ready for loading, pending inspections, recent releases, balance due.
- Recent activity feed.
- quick navigation.

Roles: all authenticated users with appropriate permissions.

Dependencies: cargo, inspection, loading, invoice, voucher, release modules.

### 2.2 Master Data

Purpose: maintain reusable reference data.

Submodules:
- Customers
- Ports
- Yards
- Vessels
- Shippers
- Consignees
- Agents

Customers:
- Fields: Name mandatory, Contact Number, Email, Address, auto code, status.
- Actions: create, edit, delete, status.
- UI: list with search and status; create/edit dialog.

Ports:
- Fields: Name, City, Country, abbreviation.
- Actions: create, edit, delete.
- UI: list and form.

Yards:
- Fields: name, parent Port.
- Port selection filters yards.
- Actions: create, edit, delete.

Vessels:
- Fields: Name, IMO optional, vessel type, tug/barge name pair optional.
- Actions: create, edit, activate/deactivate.

Shippers:
- Fields: Name mandatory, National ID/TRN, Address, Contact Number, Email.
- Name mandatory; others optional without error.

Consignees:
- Same pattern as Shipper.

Agents:
- Fields: Name, Address, Contact Number, Email, destination associations.
- Destination-scoped.

### 2.3 Operations

Purpose: operational handling of cargo from receipt to loading.

Submodules:
- Cargo
- Yard Inventory
- Inspection
- Load Lists
- Actual Loading
- Discharge

Cargo:
- Fields: Customer, Shipper, Port of Loading, Port of Destination, Description, Chassis Number, Serial Number, Units, Packages, Weight, Weight Unit, Arrival Date, Yard, Document Status, Inspection status, Loading Date/Time, Comment.
- Comment is editable and deletable.
- Filters by destination, port, yard, status, inspection status.
- UI: list, create/edit dialog, detail.

Yard Inventory:
- Current physical location of cargo in a yard.
- One current record per cargo.
- Actions: place, move, remove.
- Return-to-yard on not-loaded cargo.

Inspection:
- Book inspection, record result, mark Done.
- Done is prerequisite for Load List eligibility.
- Status: Pending, Booked, Done.
- UI: list, create, update, result actions.

Load Lists:
- Plan cargo for a vessel/voyage.
- Progressive creation and editing.
- Print for operators.
- Per-item selection.
- Rejects cargo without Done inspection.
- Partial loading supported.
- Not-loaded items return to yard.

Actual Loading:
- Record actual loaded quantities.
- Results: loaded, partially loaded, not loaded.
- Updates cargo status and yard inventory atomically.

Discharge:
- Mirror of actual loading at destination.
- Records what is discharged.

### 2.4 B/L and Manifest

Purpose: transport document and consolidation flow.

Submodules:
- Bill of Lading
- Manifest

Bill of Lading:
- Created from finalized/eligible cargo/loading.
- Fields: Shipper, Consignee, Notify Party, B/L number, Vessel, Voyage, POL, POD, cargo lines, net weight, gross weight, CBM, totals, place of issue, freight terms, date, stamp.
- Lifecycle: Draft, Final/Approved, Released/Unreleased.
- Draft watermark.
- Revisions for customer review corrections.
- Per-destination numbering.
- PDF/Excel output with template support.
- Auto stamp on PDF; live stamp removal for print.

Manifest:
- Created from issued B/Ls.
- Fields: vessel name, tug/barge or landing craft, voyage, manifest number, date, POL, POD, company info, B/L rows, shippers, consignees, quantities, weights, totals.
- Supports multiple shippers and consignees.
- Supports external partner B/Ls with their own numbering.
- PDF/Excel output with uploaded templates.
- Print and stamp behavior.

### 2.5 Job / ETOZ

Purpose: track total cost of a cargo/shipment from start to delivery.

Fields:
- Job Number, Customer, title, related cargo/shipment, costs.

Actions:
- Create Job.
- Add cost/income lines.
- Reference Job when invoicing.

Lifecycle:
- Costs accumulate over time.
- Accountant uses Job when issuing invoices.

### 2.6 Accounting

Purpose: financial documents, ledger, and reporting foundation.

Submodules:
- Invoice
- Proforma
- Quotation
- Voucher
- Ledger
- General Journal

Invoice:
- Issued to Customer.
- Optional link to B/L and/or Manifest.
- Linked to Job Number.
- Lines with description, rate, quantity, VAT percent, VAT amount, amount.
- Subtotal, VAT, total.
- Issue date, due date, payment status.
- Auto-appears in Customer ledger as Debit.
- Independent invoice creation supported.
- PDF/Excel output with templates.

Proforma:
- Pre-invoice quote document.
- Similar line math.
- Conversion to invoice supported.

Quotation:
- Price offer to customer.
- Conversion to proforma supported.

Voucher:
- Payment Voucher and Receipt Voucher.
- Customer identification.
- Optional invoice/B/L reference.
- If not linked, still posts to ledger as Credit.
- ID Card image front/back.
- Recipient signature.
- Partial payment support.

Ledger:
- Customer statement: invoices, payments, balance, date range.
- General Journal entries for non-invoice transactions and company expenses.
- Debit/Credit model.

General Journal:
- Manual entries outside the invoice flow.
- Supports company expenses and other transactions.
- Feeds VAT and annual reporting.

### 2.7 Release and Delivery

Purpose: document hand-over control at destination.

Release Order:
- Issued after discharge.
- Shows B/L status, payment status, release status.
- Payment statuses: Paid, Partial, Unpaid/credit.
- Reports: released, paid, partially paid, unpaid.
- Alerts for overdue or partial payment.
- Agent can view for own destination.

Delivery Order:
- For cargo discharged at company port.
- Customer and Port identified.
- Printed and stamped.
- Handed to customer with other documents.

### 2.8 Agent Portal

Purpose: destination-scoped self-service for agents.

Fields/access:
- Agent logged in for a destination.
- Sees B/Ls and Release information for that destination only.
- Sees payment status and release status.
- Can download/view allowed documents.

Enforcement:
- Destination scope enforced server-side.

### 2.9 Customer 360

Purpose: unified view of the customer relationship.

Content:
- Customer overview.
- Invoices.
- Payments/vouchers.
- Ledger/balance.
- Jobs.
- Cargo/shipment history.
- B/L history where relevant.
- Comments/activity.
- Status and recent behavior.

Implementation:
- Aggregate/read model, not a duplicate data master.

### 2.10 Documents, Templates, Attachments, Archive

Purpose: document output and record management.

Capabilities:
- Uploaded company templates.
- PDF and Excel output.
- Auto stamp on PDF.
- Live stamp removal for print.
- Digital stamp/signature support in generation layer.
- Attachments for inspections, payments, B/Ls, source documents.
- Archive metadata for final documents.
- Final documents become immutable.

### 2.11 Reports

Purpose: management and tax reporting.

Reports:
- Voyage/Vessel/Manifest P&L.
- Manifest report.
- Cost report.
- VAT report, periodic.
- Tax/year reporting.
- Customer statement.
- Dashboard KPIs.

### 2.12 HR and Correspondence

Purpose: employees, payroll, letters.

Submodules:
- Employees
- Salary
- Letters

Employees:
- Fields: code, name, national ID, position, contact, hire date, base salary, currency, status.

Salary:
- Salary Slip per employee per month.
- ID Card front/back images.
- Employee signature.
- Printable.

Letters:
- Correspondence register.
- Incoming/Outgoing.
- Threading.

### 2.13 Access Control

Purpose: users, roles, permissions.

Capabilities:
- User management.
- Role management.
- Permission assignment.
- Agent portal access control.
- Backend enforcement of sensitive scopes.
- Audit history for sensitive actions.

## 3. Cross-module relationships

- Customer is the commercial center.
- Cargo belongs to Customer and references Shipper/Consignee.
- Job links to Customer and is referenced by Invoice and Cargo.
- Invoice links to Customer, optional B/L/Manifest, optional Job.
- Voucher links to Customer and optionally to Invoice.
- Ledger derives from Invoice and Voucher and General Journal.
- B/L links to Shipper, Consignee, Vessel, Voyage, cargo lines.
- Manifest links to Voyage and consolidates B/Ls.
- Release Order links to B/L.
- Delivery Order links to B/L.

---

## current-plan/03-final-workflows.md

# 03 Final Workflows

## 1. Customer and commercial flow

### 1.1 Customer registration

1. Office creates a Customer.
2. Name is mandatory; contact details optional.
3. System assigns an auto sequential code.
4. Customer becomes the commercial counterparty for invoices and ledger.

### 1.2 Customer 360 usage

1. User opens Customer profile.
2. System shows overview, invoices, payments, ledger, balance, jobs, cargo history, B/L history where relevant, comments/activity.
3. User can see paid/partial/unpaid status and balance.

## 2. Operational flow

### 2.1 Cargo intake

1. Office receives cargo at a port.
2. Office creates Cargo record.
3. User selects Customer.
4. User enters Shipper, Port of Loading, Port of Destination, description, chassis, serial, units, packages, weight, weight unit, arrival date, documents, comment.
5. Selecting Port of Loading filters Yards.
6. User assigns Yard.
7. Office adds Comment for operational notes.

### 2.2 Inspection

1. Inspection is booked for cargo.
2. Inspection fee and time may be recorded.
3. Inspection is performed.
4. Inspection status moves to Done.
5. Cargo without Done inspection cannot enter Load List.

### 2.3 Load List

1. User selects a vessel/voyage.
2. User builds Load List from eligible cargo.
3. Cargo without Done inspection is rejected.
4. Load List is printed for operators.
5. Load List can be edited and extended over time.
6. Operators load cargo.
7. Not-loaded cargo is removed from Load List and returns to Yard Inventory.
8. Loaded cargo is recorded with loading date/time.

### 2.4 Actual loading

1. Actual Loading is recorded against the Load List.
2. Loaded quantity, not-loaded items, and reasons are captured.
3. Loaded cargo leaves Yard Inventory.
4. Not-loaded cargo returns to Yard Inventory.

### 2.5 Discharge

1. At destination, discharge is recorded.
2. Discharge mirrors actual loading.
3. Partial discharge is supported.
4. Fully discharged cargo is marked delivered where applicable.

## 3. Document flow

### 3.1 Bill of Lading

1. After loading is finalized, B/L is prepared from eligible cargo/loading data.
2. B/L is created in Draft.
3. Draft carries Draft watermark.
4. B/L is sent to Customer for review.
5. Customer may request corrections.
6. B/L is revised if needed.
7. B/L is finalized/approved and issued.
8. B/L number is per destination.
9. B/L status includes Released/Unreleased as a separate permission concept.
10. B/L is output as PDF/Excel with template and stamp support.

### 3.2 Manifest

1. After B/Ls are issued, Manifest is created from those B/Ls.
2. Manifest header includes vessel, tug/barge or landing craft, voyage, manifest number, date, POL, POD, company info.
3. Manifest rows are built from issued B/Ls.
4. Manifest shows multiple shippers/consignees.
5. External partner B/Ls can be included.
6. Manifest is output as PDF/Excel with templates.
7. Print and stamp behaviors are supported.

### 3.3 Job/ETOZ

1. When work on a cargo/shipment starts, a Job Number is assigned.
2. Costs are recorded against the Job over time.
3. Accountant references Job Number when issuing invoices.

### 3.4 Invoice

1. Invoice is created for a Customer.
2. Invoice may be generated from issued B/Ls.
3. Invoice is linked to Job Number.
4. Invoice lines include description, rate, quantity, VAT percent, VAT amount, amount.
5. Invoice shows subtotal, VAT, total.
6. Invoice shows issue date, due date, payment status.
7. Invoice appears in Customer ledger as Debit.
8. Independent invoices can be created outside the B/L flow.

### 3.5 Payment and voucher

1. Customer pays or customer is paid.
2. Payment Voucher or Receipt Voucher is created.
3. Voucher identifies Customer.
4. Voucher may reference invoice and/or B/L.
5. ID Card image and signature are captured.
6. If voucher is not linked to an invoice, it still posts to ledger as Credit.
7. Partial payments are supported.

### 3.6 Ledger

1. Invoices post as Debit.
2. Payments post as Credit.
3. General Journal entries can be added directly.
4. Customer statement shows invoices, payments, balance for a date range.

### 3.7 Release Order

1. After vessel arrival and discharge, Release Order is issued.
2. Release Order shows B/L and payment status.
3. Office can see which documents are released, paid, partially paid, unpaid.
4. Alerts highlight overdue or partially paid items.
5. Agent sees Release status and B/L status for own destination.

### 3.8 Delivery Order

1. For cargo discharged at company port, Delivery Order is issued.
2. Delivery Order identifies Customer and Port.
3. Delivery Order is printed and stamped.
4. Delivery Order is handed to customer with other documents.

## 4. Agent flow

1. Agent logs in.
2. Agent sees only own destination's B/Ls and Release information.
3. Agent checks B/L status and Release status.
4. Agent does not need to call the office for routine checks.

## 5. Reporting flow

1. Voyage/Vessel/Manifest costs are recorded.
2. Invoice revenue for the relevant B/Ls is aggregated.
3. P&L is derived: revenue minus costs.
4. VAT report aggregates taxable invoices and VAT amounts.
5. Reports support filtered periodic and annual views.

## 6. Document/template flow

1. Company uploads templates for relevant document types.
2. Documents are generated from templates.
3. PDF includes auto stamp.
4. Print removes live stamp for physical stamping.
5. Final documents become immutable and are archived with metadata.

---

## current-plan/04-final-data-model.md

# 04 Final Data Model

## 1. Target conceptual model

### 1.1 Parties

- Customer
  - id, code auto sequential, name mandatory, contactNumber, email, address, status, timestamps.
  - One Customer has many Cargo, Invoice, Voucher, Job, B/L references, Ledger entries.

- Shipper
  - id, code, name mandatory, nationalIdTrn optional, address, contactNumber, email, timestamps.
  - One Shipper appears on many B/Ls and Manifest rows.

- Consignee
  - id, code, name mandatory, nationalIdTrn optional, address, contactNumber, email, timestamps.
  - One Consignee appears on many B/Ls and Manifest rows.

- Agent
  - id, code, name, address, contactNumber, email, timestamps.
  - Many-to-many with Port/destination via AgentDestination.
  - One Agent is linked to portal users for a destination scope.

- AgentDestination
  - agentId, portId, timestamps.

### 1.2 Geography

- Port
  - id, code, name, city, country, abbreviation, timestamps.
  - One Port has many Yards.

- Yard
  - id, code, name, portId, timestamps.
  - Yard belongs to one Port.

### 1.3 Vessels and voyages

- Vessel
  - id, code, name, imo optional, vesselType, tugBargeNamePair optional, timestamps.
  - One Vessel has many Voyages.

- Voyage
  - id, vesselId, destinationPortId, voyageNumber per destination, planned dates, status, timestamps.
  - One Voyage has many LoadLists, B/Ls, Manifest, Invoices, Jobs.

### 1.4 Cargo and yard

- Cargo
  - id, reference, customerId, shipperId, consigneeId, portOfLoadingId, destinationPortId, description, chassisNumber, serialNumber, units, packages, weight, weightUnit, arrivalDate, yardId, documentStatus, inspectionStatus, loadingDate, comment, jobId optional, timestamps.
  - One Cargo has one current YardInventory.

- YardInventory
  - id, cargoId unique current, yardId, portId, status, enteredAt, timestamps.

- Inspection
  - id, cargoId, status pending/booked/done, inspectionDate, notes, timestamps.

### 1.5 Loading

- LoadList
  - id, voyageId, loadListNumber, status, timestamps.
  - One LoadList has many LoadListItems.

- LoadListItem
  - id, loadListId, cargoId, plannedQuantity, selectionStatus, timestamps.

- ActualLoading
  - id, loadListId unique, actualLoadingNumber, status, timestamps.
  - One ActualLoading has many ActualLoadingItems.

- ActualLoadingItem
  - id, actualLoadingId, loadListItemId unique, cargoId, actualQuantity, result, timestamps.

- Discharge
  - id, actualLoadingId unique, dischargeNumber, status, timestamps.
  - One Discharge has many DischargeItems.

### 1.6 B/L and Manifest

- BillOfLading
  - id, billNumber per destination, shipperId, consigneeId, notifyParty, vesselName, voyageId, polPortId, podPortId, freightTerms, placeOfIssue, dateOfIssue, status, releaseStatus, stamp, timestamps.
  - One B/L has many B/L items.
  - One B/L may link to many Invoices.

- BillOfLadingItem
  - id, billOfLadingId, cargoId, sequence, description, marksAndNumbers, quantity, netWeight, grossWeight, cbm, timestamps.

- Manifest
  - id, manifestNumber per destination, voyageId, vesselName, tugBargeInfo, manifestDate, polPortId, podPortId, companyInfo, timestamps.
  - One Manifest has many ManifestItems.

- ManifestItem
  - id, manifestId, billOfLadingId, sequence, blNumber, description, consigneeId, shipperId, quantity, weight, timestamps.

### 1.7 Job

- Job
  - id, jobNumber, customerId optional, title, related cargo/shipment refs, status, timestamps.
  - One Job has many JobCostItems.
  - One Job has many Invoices.
  - One Job has many Cargo.

- JobCostItem
  - id, jobId, kind, category, description, amount, date, timestamps.

### 1.8 Commercial documents

- Invoice
  - id, invoiceNumber, customerId, jobId optional, billOfLadingId optional, manifestId optional, issueDate, dueDate, status, paymentStatus, timestamps.
  - One Invoice has many InvoiceItems.

- InvoiceItem
  - id, invoiceId, sequence, description, rate, quantity, vatPercent, vatAmount, amount, timestamps.

- Proforma
  - id, proformaNumber, customerId, lines, totals, issueDate, validUntil, status, timestamps.

- Quotation
  - id, quotationNumber, customerId, lines, totals, issueDate, validUntil, status, timestamps.

### 1.9 Payments and ledger

- Voucher
  - id, voucherNumber, type receipt/payment, customerId, invoiceId optional, billOfLadingId optional, amount, currency, method, voucherDate, idCardImage, signature, timestamps.
  - One Voucher may allocate to many Invoices.

- VoucherAllocation
  - id, voucherId, invoiceId, allocatedAmount, timestamps.

- LedgerEntry
  - id, customerId optional, type, debit, credit, description, related invoice/voucher/journal ref, timestamps.

- GeneralJournal
  - id, entryNumber, date, description, entries, timestamps.

- JournalLine
  - id, journalEntryId, account, debit, credit, description, timestamps.

### 1.10 Release and Delivery

- ReleaseOrder
  - id, releaseNumber, billOfLadingId, status, paymentStatus, releaseDate, timestamps.

- DeliveryOrder
  - id, deliveryNumber, billOfLadingId, customerId, portId, issueDate, status, timestamps.

### 1.11 HR and correspondence

- Employee
  - id, code, name, nationalId, position, phone, email, hireDate, baseSalary, currency, status, timestamps.

- SalaryRecord
  - id, salaryNumber, employeeId, month, year, status, base, additions, deductions, net, idCardFront, idCardBack, signature, timestamps.

- Letter
  - id, letterNumber, direction, status, date, subject, body, refNumber, fromContact, toContact, customerId optional, replyToId, timestamps.

### 1.12 Documents and audit

- DocumentTemplate
  - id, documentType, name, format, storage reference, active version, timestamps.

- DocumentTemplateVersion
  - id, templateId, version, storageKey, timestamps.

- FileAttachment
  - id, entityType, entityId, category, storageKey, filename, mimeType, size, uploadedBy, timestamps.

- AuditLog
  - id, timestamp, actorId, action, entityType, entityId, metadata, timestamps.

## 2. Comparison with current Prisma schema

### 2.1 Already aligned

- Customer, Port, Yard, Vessel, Voyage, Cargo, YardInventory, Inspection, LoadList, LoadListItem, ActualLoading, ActualLoadingItem, Discharge, Invoice, InvoiceItem, Proforma, ProformaItem, Quotation, QuotationItem, Voucher, DeliveryOrder, ReleaseOrder, Employee, SalaryRecord, Letter, Job, JobCostItem.
- Phase 1 infrastructure: NumberingSequence, AuditLog, FileAttachment, DocumentTemplate, DocumentTemplateVersion.

### 2.2 Only partially aligned

- Shipper, Consignee, Agent tables exist but must be used as the real masters instead of Customer.type.
- B/L and Manifest still wrongly depend on Customer FKs for shipper/consignee/agent in current code.
- B/L still created against Manifest in current code; target is B/L first, then Manifest.
- Manifest still created from Actual Loading in current code; target is from issued B/Ls.
- Voucher still has single invoiceId FK in current schema; target is VoucherAllocation.
- Invoice still has header taxRate; target is per-line VAT.
- Invoice still lacks Job link; target includes jobId.
- Ledger is derived only; target also supports General Journal entries.
- Agent portal still bookings-focused; target is destination-scoped B/L/Release/document visibility.

### 2.3 Still missing in schema

- GeneralJournal and JournalLine tables.
- VoucherAllocation table.
- B/L release status as a distinct field/concept.
- B/L revision/versioning model for customer review corrections.
- ManifestItem direct reference to BillOfLadingItem.
- ManifestDate field.
- Invoice payment status tracking beyond paidAmount.
- Customer 360 read model is an API/view concern, not necessarily a new table.

## 3. Key model decisions

- Customer remains the commercial counterparty.
- Shipper, Consignee, Agent are separate masters.
- B/L precedes Manifest.
- ManifestItem should ultimately reference BillOfLadingItem, not only Cargo.
- Invoice VAT is per line.
- Voucher supports multi-invoice allocation.
- Ledger supports General Journal.
- Agent portal enforces destination scope server-side.
- Customer 360 is an aggregate view.
- Numbering for B/L, Manifest, Voyage is per destination and configurable.

---

## current-plan/05-final-api-blueprint.md

# 05 Final API Blueprint

## 1. Design principles

- REST under `/api/v1`.
- Permission-based authorization per module/action.
- Backend-enforced scope for sensitive flows, especially agent destination scoping.
- Consistent envelope for success and error.
- Pagination with metadata.
- DTO validation on create/update.
- Decimal money values serialized as strings.

## 2. Resource groups

### 2.1 Master data

- Customers
- Ports
- Yards
- Vessels
- Shippers
- Consignees
- Agents
- AgentDestinations

### 2.2 Operations

- Cargo
- YardInventory
- Inspection
- LoadLists
- LoadListItems
- ActualLoadings
- ActualLoadingItems
- Discharges
- DischargeItems

### 2.3 Documents

- BillsOfLading
- BillOfLadingItems
- Manifests
- ManifestItems

### 2.4 Commercial

- Jobs
- JobCostItems
- Invoices
- InvoiceItems
- Proformas
- ProformaItems
- Quotations
- QuotationItems

### 2.5 Accounting

- Vouchers
- VoucherAllocations
- Ledger
- GeneralJournal
- JournalEntries
- JournalLines

### 2.6 Release/Delivery

- ReleaseOrders
- DeliveryOrders

### 2.7 Agent portal

- Portal me
- Portal bookings
- Portal B/L visibility
- Portal release/payment status
- Portal document download

### 2.8 Customer 360

- Customer 360 aggregate endpoint

### 2.9 Reports

- Voyage/Vessel/Manifest P&L
- VAT report
- Manifest report
- Cost report
- Dashboard KPIs

### 2.10 Documents and attachments

- DocumentTemplates
- DocumentTemplateVersions
- FileAttachments
- Document generation/download

### 2.11 Audit

- AuditLog query

## 3. Key endpoint behaviors

### 3.1 Customer

- CRUD.
- Customer 360 read endpoint.

### 3.2 Shipper/Consignee/Agent

- CRUD.
- Agent linked to destinations.

### 3.3 Cargo

- CRUD.
- Lifecycle transitions.
- Filters by port, yard, destination, inspection status, customer.
- Comment editable.

### 3.4 Inspection

- CRUD.
- Book, record result, mark Done.
- Done is prerequisite for Load List eligibility.

### 3.5 LoadList

- CRUD.
- Add items with inspection check.
- Edit progressively.
- Finalize.
- Reject not-done cargo.

### 3.6 ActualLoading

- CRUD.
- Record loaded quantities.
- Not-loaded items return to yard.

### 3.7 B/L

- Create from eligible cargo/loading, not from Manifest.
- Draft, finalize, release states.
- Revisions for corrections.
- Per-destination numbering.
- PDF/Excel generation endpoint.

### 3.8 Manifest

- Create from issued B/Ls.
- Consolidate multiple B/Ls.
- Per-destination numbering.
- PDF/Excel generation endpoint.

### 3.9 Invoice

- Create standalone or from B/L.
- Link to Job.
- Line VAT.
- Issue, cancel.
- PDF/Excel generation endpoint.

### 3.10 Voucher

- Create receipt/payment.
- Link to Customer.
- Optional invoice/B/L link.
- ID card and signature capture.
- Allocations to invoices.

### 3.11 Ledger

- Customer statement.
- General Journal entry create.
- Derived balance.

### 3.12 Release/Delivery

- ReleaseOrder with payment status.
- DeliveryOrder with customer/port.
- Eligibility checks.

### 3.13 Agent portal

- Me and summary.
- Bookings.
- Destination-scoped B/L list/detail.
- Release/payment status.
- Allowed document download.

### 3.14 Reports

- P&L by voyage/vessel/manifest.
- VAT aggregation.
- Manifest/cost summaries.
- KPIs.

## 4. Authorization notes

- Agent portal reads must be scoped server-side by destination.
- Release and payment-sensitive endpoints must enforce permissions.
- Audit-relevant mutations should write AuditLog.

## 5. Document output API

- Document generation should be available as download endpoints.
- Template selection should be configurable per document type.
- PDF and Excel outputs should be supported where applicable.

---

## current-plan/06-final-ui-blueprint.md

# 06 Final UI Blueprint

## 1. Information architecture

### 1.1 Sidebar sections

- Overview
- Operations
- B/L and Manifest
- Accounting
- Master Data
- Access Control

### 1.2 Master Data sub-sections

- Customers
- Ports
- Yards
- Vessels
- Shippers
- Consignees
- Agents

### 1.3 Operations sub-sections

- Cargo
- Yard Inventory
- Inspection
- Load Lists
- Actual Loading
- Discharge

### 1.4 B/L and Manifest sub-sections

- Bills of Lading
- Manifests

### 1.5 Accounting sub-sections

- Jobs
- Invoices
- Proformas
- Quotations
- Vouchers
- Ledger
- General Journal
- Reports

### 1.6 Release/Delivery sub-sections

- Release Orders
- Delivery Orders

### 1.7 Additional sections

- Employees
- Salary
- Letters
- Customer 360
- Agent Portal
- Documents/Templates
- Audit
- Administration

## 2. Page patterns

### 2.1 List pages

- Search and filters.
- Status filters.
- Pagination.
- Clear status badges.
- actions: create, view, edit, delete where allowed.

### 2.2 Create/edit dialogs

- Validation on submit.
- Master-data selects where applicable.
- Port-to-Yard filtering.
- Inspection status checks where applicable.
- Customer-first flow for cargo and invoices.

### 2.3 Detail pages/dialogs

- Summary header.
- Related items.
- Status and timestamps.
- Actions allowed by permission and state.

## 3. Customer 360 UI

- Customer header: name, code, contact, status.
- Tabs or sections for: overview, jobs, cargo, B/Ls, invoices, payments, ledger/balance, comments/activity.
- Balance and payment status prominent.
- Recent activity and open items visible.

## 4. Operational UI

### 4.1 Cargo

- List with destination/port/yard/inspection filters.
- Create/edit with customer-first, then shipper, ports, yard, documents, comment.
- Comment visible and editable.

### 4.2 Inspection

- List by cargo/status.
- Book and result actions.
- Done gating shown in operational lists.

### 4.3 Load List

- Create from eligible cargo.
- Items table with selection.
- Print action.
- Progressive edit.
- Not-loaded handling shown.

### 4.4 Actual Loading

- List by LoadList/voyage.
- Item-level loaded/not-loaded results.
- Yard inventory effects visible.

### 4.5 Discharge

- List by actual loading/destination.
- Per-line discharge results.

## 5. Document UI

### 5.1 B/L

- List by status/voyage/destination.
- Create from eligible cargo.
- Draft/Final/Released states shown.
- Revision history.
- PDF/Excel download.

### 5.2 Manifest

- List by voyage/destination.
- Create from issued B/Ls.
- Multi-party rows shown.
- PDF/Excel download.

### 5.3 Invoice

- List by customer/status/payment.
- Create standalone or from B/L.
- Line VAT UI.
- Job link.
- PDF/Excel download.

### 5.4 Voucher

- List by customer/type/status.
- Create with customer, optional invoice/B/L, ID card, signature.
- Allocation UI for multi-invoice payments.

### 5.5 Ledger

- Customer statement view.
- Date range filter.
- General Journal entry form.

## 6. Release/Delivery UI

- ReleaseOrder list with payment status.
- Eligibility and override where applicable.
- DeliveryOrder list with customer/port.
- Print/stamp behavior.

## 7. Agent portal UI

- Agent login scoped to destination.
- B/L list for own destination.
- B/L detail.
- Release and payment status.
- Allowed document download.

## 8. Reporting UI

- P&L by voyage/vessel/manifest.
- VAT periodic report.
- Manifest/cost summaries.
- Dashboard KPIs.
- Export where applicable.

## 9. Responsive/mobile behavior

- Collapsible sidebar.
- Responsive tables and cards.
- Touch-friendly actions.
- Status indicators readable on small screens.

## 10. Status presentation

- Clear color/semantic badges for statuses.
- Draft, Final, Issued, Released, Paid, Partial, Unpaid, Pending, Done, and similar states must be visually distinct.
- Overdue/partial payment warnings should be visible where relevant.

## 11. Permission-aware UI

- Actions hidden/disabled when not permitted.
- Scope-limited views for agent portal.
- Audit-sensitive actions clearly labeled.

---

## current-plan/07-document-and-reporting-blueprint.md

# 07 Document and Reporting Blueprint

## 1. Document types

- Loading List
- Bill of Lading
- Manifest
- Invoice
- Proforma
- Quotation
- Receipt Voucher
- Payment Voucher
- Ledger statement
- Release Order
- Delivery Order
- Salary Slip
- Letters

## 2. Document sources

- Loading List from eligible cargo and LoadList.
- B/L from finalized/eligible cargo/loading.
- Manifest from issued B/Ls.
- Invoice from Customer, optional B/L/Manifest/Job.
- Proforma/Quotation from Customer.
- Voucher from Customer, optional invoice/B/L.
- ReleaseOrder from B/L.
- DeliveryOrder from B/L.
- Salary Slip from Employee.
- Letters from correspondence workflow.

## 3. Numbering

- B/L: per destination, configurable, for example `KHS/26-2/2026`.
- Manifest: per destination, configurable, for example `DSMAN/KHO-26-006`.
- Voyage: per destination sequence.
- Invoice/Proforma/Quotation: configurable numbering default.
- Voucher: configurable numbering by type.
- Customer code: auto sequential.
- Jobs, LoadLists, ActualLoadings, Discharges, D/O, R/O, Salary, Letters: configurable numbering per module.

## 4. Revisions and finalization

- B/L supports Draft, review corrections, Final/Approved, and release permission.
- Revisions preserve historical finalized versions.
- Final documents become immutable.
- Archive metadata recorded for final/archived documents.

## 5. Output formats

- PDF via HTML/CSS + Playwright rendering.
- Excel via XLSX + ExcelJS.
- PDF auto stamp where applicable.
- Print removes live stamp for physical stamping.
- Digital stamp/signature supported in the generation layer.

## 6. Templates

- Company uploads templates per document type.
- Templates are versioned.
- Active template selected per document type.
- Template content and wording are business decisions, not invented by the system.

## 7. Attachments

- Inspection photos.
- Payment ID documents.
- Signatures.
- Source documents.
- B/L attachments.
- Other business documents.
- Common FileAttachment infrastructure with entityType/entityId/category.

## 8. Archive

- Final/archived documents carry archive metadata.
- Archived records remain viewable/searchable by permissions.
- Retention and re-opening policy are business decisions.

## 9. Reporting

### 9.1 Dashboard KPIs

- Open invoices.
- Overdue invoices.
- Cargo in yard.
- Ready for loading.
- Pending inspections.
- Recent releases.
- Balance due.

### 9.2 P&L

- Voyage/Vessel/Manifest P&L.
- Costs: vessel charter, Port Use, Handling, Lashing, miscellaneous.
- Revenue: sum of invoices for relevant B/Ls.
- Result: profit or loss.

### 9.3 VAT

- Periodic VAT report.
- Taxable invoices, VAT amounts, VAT collected, VAT paid.
- Supports quarterly and other periodic views.

### 9.4 Other reports

- Manifest report.
- Cost report.
- Customer statement.
- Tax/year reporting with filters.

---

## current-plan/08-requirement-traceability.md

# 08 Requirement Traceability

## 1. Legend

- Employer evidence: transcript or document reference.
- Requirement: normalized requirement.
- Target behavior: what the system must do.
- Module: target module.
- Phase: roadmap phase.

## 2. Traceability map

### 2.1 Company and context

#### Duna Shipping is a UAE-based international shipping company

- Employer evidence: multiple transcripts; `shipping_documents_detailed_reference.md`.
- Requirement: system supports the company's actual route/port/cargo patterns.
- Target behavior: master data, operations, and documents modeled around Dubai/Hamriyah → Iranian ports and heavy/project cargo.
- Module: all.
- Phase: foundational.

#### Core route pattern Dubai/Hamriyah → Iranian ports

- Employer evidence: transcripts.
- Requirement: port and voyage modeling reflects this pattern.
- Target behavior: Port and Voyage support the relevant destinations.
- Module: Port, Voyage.
- Phase: Phase 2.

#### Heavy cargo, machinery, equipment, vehicles, containers, project cargo

- Employer evidence: transcripts.
- Requirement: cargo description and measurement fields support these kinds.
- Target behavior: Cargo carries description, chassis, serial, units, packages, weight, weight unit.
- Module: Cargo.
- Phase: Phase 3.

### 2.2 Parties

#### Customer is the internal commercial counterparty

- Employer evidence: multiple transcripts.
- Requirement: Customer is the entity to whom invoices are issued and whose ledger/balance is tracked.
- Target behavior: Customer is the commercial center; invoices and vouchers link to Customer.
- Module: Customer, Invoice, Voucher, Ledger.
- Phase: Phase 2.

#### Customer is separate from Shipper, Consignee, Agent

- Employer evidence: multiple transcripts.
- Requirement: separate masters.
- Target behavior: Customer, Shipper, Consignee, Agent are distinct tables; B/L, Manifest, and Cargo use the masters, not Customer for shipper/consignee/notify.
- Module: master data, B/L, Manifest, Cargo.
- Phase: Phase 2 for master activation; Phase 4/Phase 5 for document-side cutover.

#### Customer profile fields

- Employer evidence: transcripts.
- Requirement: name, contact number, email, address, auto code, status, later financial history.
- Target behavior: Customer carries these fields.
- Module: Customer.
- Phase: Phase 2.

#### Customer code auto sequential

- Employer evidence: `CUST 3.1`, `CUST 3.2` pattern.
- Requirement: auto sequential customer code.
- Target behavior: Customer.code generated by system.
- Module: Customer, NumberingSequence.
- Phase: Phase 2.

#### Name is the only mandatory Customer field at creation

- Employer evidence: transcripts.
- Requirement: contact details optional; no error if missing.
- Target behavior: create validation requires name only.
- Module: Customer.
- Phase: Phase 2.

#### Shipper is a separate master with its own fields

- Employer evidence: transcripts.
- Requirement: Shipper name mandatory; National ID/TRN, address, contact, email optional.
- Target behavior: Shipper is a separate master used on transport documents.
- Module: Shipper.
- Phase: Phase 2.

#### Consignee is a separate master with the same pattern

- Employer evidence: transcripts.
- Requirement: Consignee name mandatory; others optional.
- Target behavior: Consignee is a separate master used on B/L and Manifest.
- Module: Consignee.
- Phase: Phase 2.

#### Agent is destination-scoped

- Employer evidence: transcripts.
- Requirement: an agent for one destination does not automatically represent another; agent appears on B/L for the relevant destination.
- Target behavior: Agent linked to destinations via AgentDestination; used per destination.
- Module: Agent, AgentDestination.
- Phase: Phase 2.

#### Agent login and visibility

- Employer evidence: transcripts.
- Requirement: agent can log in and see B/Ls and Release info for own destination only.
- Target behavior: agent portal scoping enforced server-side.
- Module: Agent portal.
- Phase: Phase 8.

### 2.3 Geography

#### Port fields

- Employer evidence: transcripts; `shipping_documents_detailed_reference.md`.
- Requirement: Port has Name, City, Country, abbreviation.
- Target behavior: Port carries these fields.
- Module: Port.
- Phase: Phase 2.

#### Port abbreviation used in compact display

- Employer evidence: transcript example `HAM`.
- Requirement: compact display code for ports.
- Target behavior: Port.abbreviation used in lists/forms.
- Module: Port, UI.
- Phase: Phase 2.

#### Port filters Yards

- Employer evidence: transcript example selecting Hamriyah shows its yards.
- Requirement: Yard scoped to Port; UI filters yards by port.
- Target behavior: Yard.portId; UI filters.
- Module: Yard, Cargo, UI.
- Phase: Phase 2.

#### Yard fields and role

- Employer evidence: transcripts.
- Requirement: Yard belongs to a Port; yard is where cargo is received, stored, loaded.
- Target behavior: Yard has name/code and parent Port.
- Module: Yard.
- Phase: Phase 2.

### 2.4 Vessels and voyages

#### Vessel fields and types

- Employer evidence: transcripts.
- Requirement: Vessel has Name and optional IMO; types include Tug, Barge, Landing Craft, regular Vessel; Tug/Barge may be a pair.
- Target behavior: Vessel with type and optional tug/barge pair.
- Module: Vessel.
- Phase: Phase 2.

#### Voyage per-destination numbering

- Employer evidence: `1/26`, `2/26` per destination.
- Requirement: voyage number derived from vessel + destination + sailing count.
- Target behavior: Voyage number per destination.
- Module: Voyage, NumberingSequence.
- Phase: Phase 2/Phase 6.

### 2.5 Cargo intake

#### Cargo requires Customer

- Employer evidence: transcripts.
- Requirement: cargo registration tied to Customer.
- Target behavior: Cargo.customerId mandatory.
- Module: Cargo.
- Phase: Phase 3.

#### Cargo fields

- Employer evidence: transcripts.
- Requirement: Customer, Shipper, Port of Loading, Port of Destination, Description, Chassis Number, Serial Number, Units, Packages, Weight, Weight Unit, Arrival Date, Yard, Document Status, Inspection status, Loading Date/Time, Comment.
- Target behavior: Cargo carries these fields.
- Module: Cargo.
- Phase: Phase 3.

#### Port of Loading filters Yards

- Employer evidence: transcripts.
- Requirement: selecting POL filters yards.
- Target behavior: UI/behavior filters yards by POL.
- Module: Cargo, Yard, UI.
- Phase: Phase 3.

#### Document Status captures arrival documents

- Employer evidence: transcripts.
- Requirement: record Export Paper, Import Paper, Export Certificate, Local Transfer etc.
- Target behavior: Cargo.documentStatus captures document arrival state.
- Module: Cargo.
- Phase: Phase 3.

#### Comment is required, editable, deletable

- Employer evidence: transcripts.
- Requirement: operational notes visible to accountants and others.
- Target behavior: Comment field editable/deletable; visible where relevant.
- Module: Cargo, UI.
- Phase: Phase 3.

### 2.6 Inspection

#### Inspection is prerequisite for loading

- Employer evidence: transcripts.
- Requirement: cargo without Done inspection cannot enter Load List.
- Target behavior: service rejects cargo without Done inspection for Load List.
- Module: Inspection, LoadList.
- Phase: Phase 3.

#### Inspection booking and result

- Employer evidence: transcripts.
- Requirement: inspection can be booked with fee and time; result includes Done.
- Target behavior: Inspection supports book/result/done.
- Module: Inspection.
- Phase: Phase 3.

#### Pending inspection visually distinct

- Employer evidence: transcripts.
- Requirement: status visible and distinct.
- Target behavior: UI shows inspection status distinctly.
- Module: Inspection, UI.
- Phase: Phase 3.

### 2.7 Load List

#### Load List is planned loading set for a vessel/voyage

- Employer evidence: transcripts.
- Requirement: Load List collects eligible cargo, prints for operators, records actual loading.
- Target behavior: LoadList per voyage; items; print; actual loading linkage.
- Module: LoadList, ActualLoading.
- Phase: Phase 3.

#### Load List rejects cargo without Done inspection

- Employer evidence: transcripts.
- Requirement: eligibility gate.
- Target behavior: add-item enforcement.
- Module: LoadList.
- Phase: Phase 3.

#### Partial loading supported

- Employer evidence: transcripts.
- Requirement: planned vs loaded can differ.
- Target behavior: planned quantity vs actual quantity.
- Module: ActualLoading.
- Phase: Phase 3.

#### Not-loaded cargo returns to Yard Inventory

- Employer evidence: transcripts.
- Requirement: automatic return to yard.
- Target behavior: not-loaded items re-enter yard inventory.
- Module: ActualLoading, YardInventory.
- Phase: Phase 3.

#### Load List printed for operators

- Employer evidence: transcripts.
- Requirement: print output for operators.
- Target behavior: document/print output for Load List.
- Module: LoadList, document engine.
- Phase: Phase 7.

### 2.8 Actual loading

#### Actual loading records reality

- Employer evidence: transcripts.
- Requirement: loaded quantities, not-loaded items, reasons.
- Target behavior: ActualLoadingItem with actualQuantity and result.
- Module: ActualLoading.
- Phase: Phase 3.

#### Loaded cargo leaves Yard Inventory

- Employer evidence: transcripts.
- Requirement: yard inventory update on load.
- Target behavior: yard inventory removed/updated atomically.
- Module: ActualLoading, YardInventory.
- Phase: Phase 3.

### 2.9 Discharge

#### Discharge mirrors actual loading

- Employer evidence: transcripts.
- Requirement: discharge recorded at destination; partial supported.
- Target behavior: Discharge with items; partial support.
- Module: Discharge.
- Phase: Phase 3.

### 2.10 Bill of Lading

#### B/L created from finalized/eligible cargo and loading

- Employer evidence: transcripts.
- Requirement: B/L precedes Manifest; B/L from cargo/loading.
- Target behavior: B/L created from cargo/loading, not from Manifest.
- Module: B/L.
- Phase: Phase 4.

#### B/L fields

- Employer evidence: transcripts.
- Requirement: Shipper, Consignee, Notify Party, B/L number, Vessel, Voyage, POL, POD, cargo description, marks and numbers, quantity, net weight, gross weight, CBM, total, place of issue, freight terms, date, stamp.
- Target behavior: B/L and B/L items carry these fields.
- Module: B/L.
- Phase: Phase 4.

#### B/L numbering per destination

- Employer evidence: `KHS/26-2/2026`, `RJS/26-10`.
- Requirement: per-destination B/L numbering.
- Target behavior: B/L number from destination-scoped sequence.
- Module: B/L, NumberingSequence.
- Phase: Phase 4.

#### B/L Draft with Draft watermark

- Employer evidence: transcripts.
- Requirement: draft state visually distinct.
- Target behavior: Draft state with watermark.
- Module: B/L, document engine.
- Phase: Phase 4/Phase 7.

#### B/L sent to customer for review and corrected

- Employer evidence: transcripts.
- Requirement: draft sent for review; corrections possible.
- Target behavior: revision model for corrections.
- Module: B/L.
- Phase: Phase 4.

#### B/L becomes Final/Approved and issued

- Employer evidence: transcripts.
- Requirement: final/approved state.
- Target behavior: lifecycle includes Final/Approved.
- Module: B/L.
- Phase: Phase 4.

#### B/L Released/Unreleased as separate permission

- Employer evidence: transcripts.
- Requirement: release permission separate from finalization.
- Target behavior: release status/field distinct from document finalization.
- Module: B/L, ReleaseOrder.
- Phase: Phase 4/Phase 6.

#### B/L may have shipper/consignee different from Customer

- Employer evidence: transcripts.
- Requirement: B/L parties from masters, not forced to match Customer.
- Target behavior: B/L uses Shipper/Consignee masters.
- Module: B/L.
- Phase: Phase 4.

#### B/L PDF/Excel with template and stamp support

- Employer evidence: transcripts.
- Requirement: output formats and stamps.
- Target behavior: document generation with template/stamp.
- Module: B/L, document engine.
- Phase: Phase 7.

### 2.11 Manifest

#### Manifest created from issued B/Ls

- Employer evidence: transcripts.
- Requirement: Manifest is downstream of issued B/Ls.
- Target behavior: Manifest created from issued B/Ls; ManifestItem references B/L items.
- Module: Manifest, B/L.
- Phase: Phase 5.

#### Manifest header fields

- Employer evidence: transcripts.
- Requirement: vessel name, tug/barge or landing craft, voyage, manifest number, date, POL, POD, company information.
- Target behavior: Manifest carries these header fields.
- Module: Manifest.
- Phase: Phase 5.

#### Manifest rows from B/Ls

- Employer evidence: transcripts.
- Requirement: rows include B/L number, cargo description, Consignee, Shipper, quantity, weight, totals.
- Target behavior: ManifestItem carries these.
- Module: Manifest.
- Phase: Phase 5.

#### Multiple shippers/consignees per manifest

- Employer evidence: transcripts.
- Requirement: multi-party manifest.
- Target behavior: Manifest can include many parties.
- Module: Manifest.
- Phase: Phase 5.

#### External partner B/Ls supported

- Employer evidence: transcripts.
- Requirement: external B/Ls with own numbering can be included.
- Target behavior: Manifest supports external B/L references.
- Module: Manifest, B/L.
- Phase: Phase 5.

#### Manifest PDF/Excel with templates, print, stamp

- Employer evidence: transcripts.
- Requirement: output capability.
- Target behavior: document generation with templates/stamp.
- Module: Manifest, document engine.
- Phase: Phase 7.

### 2.12 Job / ETOZ

#### Job Number assigned when work starts

- Employer evidence: transcripts.
- Requirement: Job Number tracks all costs from start to delivery.
- Target behavior: Job created when work starts; cost lines accumulate.
- Module: Job.
- Phase: Phase 6.

#### Job costs listed

- Employer evidence: transcripts.
- Requirement: repair, customs, crane, lowbed, transport, port, vessel, miscellaneous.
- Target behavior: JobCostItem with kind/category/description/amount.
- Module: Job.
- Phase: Phase 6.

#### Accountant uses Job Number when invoicing

- Employer evidence: transcripts.
- Requirement: Invoice linked to Job.
- Target behavior: Invoice.jobId optional.
- Module: Invoice, Job.
- Phase: Phase 6.

### 2.13 Invoice

#### Invoice issued to Customer

- Employer evidence: transcripts.
- Requirement: Invoice customer-facing.
- Target behavior: Invoice.customerId.
- Module: Invoice.
- Phase: Phase 6.

#### Invoice generated from issued B/Ls

- Employer evidence: transcripts.
- Requirement: invoice can derive from B/Ls.
- Target behavior: Invoice optional B/L/Manifest reference.
- Module: Invoice.
- Phase: Phase 6.

#### Invoice also issued independently

- Employer evidence: transcripts.
- Requirement: independent invoice creation supported.
- Target behavior: standalone invoice creation allowed.
- Module: Invoice.
- Phase: Phase 6.

#### Invoice lines with VAT per line

- Employer evidence: transcripts.
- Requirement: description, rate/fee, quantity, VAT percent per line, VAT amount, line amount.
- Target behavior: InvoiceItem with vatPercent, vatAmount, amount.
- Module: Invoice, Proforma, Quotation.
- Phase: Phase 6.

#### Invoice subtotal, VAT, total

- Employer evidence: transcripts.
- Requirement: totals shown.
- Target behavior: invoice totals derived.
- Module: Invoice.
- Phase: Phase 6.

#### Some invoices have VAT, some do not

- Employer evidence: transcripts.
- Requirement: VAT not mandatory on every invoice.
- Target behavior: VAT fields optional per line/invoice.
- Module: Invoice.
- Phase: Phase 6.

#### Invoice fields

- Employer evidence: transcripts.
- Requirement: Invoice Number, Customer, B/L reference, Manifest reference, issue date, due date, payment status.
- Target behavior: Invoice carries these.
- Module: Invoice.
- Phase: Phase 6.

#### Invoice payment status

- Employer evidence: transcripts.
- Requirement: Paid, Partial Payment, Unpaid.
- Target behavior: paymentStatus tracked.
- Module: Invoice, Voucher, Ledger.
- Phase: Phase 6.

#### Invoice appears in Customer ledger as Debit

- Employer evidence: transcripts.
- Requirement: automatic ledger effect.
- Target behavior: Invoice posts Debit to ledger.
- Module: Ledger.
- Phase: Phase 6.

### 2.14 VAT and tax reporting

#### VAT tracked per invoice line

- Employer evidence: transcripts.
- Requirement: line-level VAT.
- Target behavior: InvoiceItem VAT fields.
- Module: Invoice, Reports.
- Phase: Phase 6.

#### VAT reporting periodic

- Employer evidence: transcripts.
- Requirement: quarterly and other periodic reports; taxable invoices, VAT amounts, VAT collected, VAT paid.
- Target behavior: VAT report aggregation.
- Module: Reports.
- Phase: Phase 8.

### 2.15 Ledger and customer statement

#### Ledger covers Customer and company/departmental transactions

- Employer evidence: transcripts.
- Requirement: ledger not only customer invoice/payment flow.
- Target behavior: Ledger plus General Journal.
- Module: Ledger, GeneralJournal.
- Phase: Phase 6.

#### General Journal entries outside invoice flow

- Employer evidence: transcripts.
- Requirement: manual entries for non-invoice transactions and company expenses.
- Target behavior: GeneralJournal/Entry/Line.
- Module: GeneralJournal, Ledger.
- Phase: Phase 6.

#### Customer statement fields

- Employer evidence: transcripts.
- Requirement: invoices issued, payments received, balance, date range.
- Target behavior: Customer statement view.
- Module: Ledger.
- Phase: Phase 6.

#### Debit and Credit model

- Employer evidence: transcripts.
- Requirement: invoices Debit, payments Credit, balance derived.
- Target behavior: ledger entries with debit/credit and derived balance.
- Module: Ledger.
- Phase: Phase 6.

### 2.16 Payments and vouchers

#### Two voucher types

- Employer evidence: transcripts.
- Requirement: Payment Voucher and Receipt Voucher.
- Target behavior: Voucher with type.
- Module: Voucher.
- Phase: Phase 6.

#### Voucher identifies Customer

- Employer evidence: transcripts.
- Requirement: Customer on voucher.
- Target behavior: Voucher.customerId.
- Module: Voucher.
- Phase: Phase 6.

#### Voucher may reference invoice and/or B/L

- Employer evidence: transcripts.
- Requirement: optional references.
- Target behavior: Voucher.invoiceId and/or billOfLadingId optional.
- Module: Voucher.
- Phase: Phase 6.

#### Voucher without invoice still posts to ledger as Credit

- Employer evidence: transcripts.
- Requirement: no error if not linked to invoice.
- Target behavior: Voucher posts Credit regardless of invoice link.
- Module: Voucher, Ledger.
- Phase: Phase 6.

#### Voucher supports multiple invoice allocation

- Employer evidence: transcripts.
- Requirement: partial payment, advance credit, unallocated remainder.
- Target behavior: VoucherAllocation.
- Module: Voucher, Ledger.
- Phase: Phase 6.

#### ID Card image front/back on payment

- Employer evidence: transcripts.
- Requirement: ID Card images by upload or camera.
- Target behavior: attachment fields on voucher/payment side.
- Module: Voucher, attachments.
- Phase: Phase 6/Phase 7.

#### Recipient signature on payment

- Employer evidence: transcripts.
- Requirement: signature capture.
- Target behavior: signature field/attachment on voucher.
- Module: Voucher, attachments.
- Phase: Phase 6/Phase 7.

#### Partial payment supported

- Employer evidence: transcripts.
- Requirement: partial payments allowed.
- Target behavior: allocation and paid-amount handling.
- Module: Voucher, Ledger.
- Phase: Phase 6.

#### Advance credit supported

- Employer evidence: transcripts.
- Requirement: advance credit allowed.
- Target behavior: credit voucher/payment handling.
- Module: Voucher, Ledger.
- Phase: Phase 6.

### 2.17 Release Order

#### Release Order after vessel arrival and discharge

- Employer evidence: transcripts.
- Requirement: Release Order after discharge.
- Target behavior: ReleaseOrder issued after discharge.
- Module: ReleaseOrder.
- Phase: Phase 6.

#### Release Order shows payment status

- Employer evidence: transcripts.
- Requirement: Paid, Partial Payment, Unpaid/credit shown.
- Target behavior: ReleaseOrder.paymentStatus.
- Module: ReleaseOrder.
- Phase: Phase 6.

#### Release Order reportable

- Employer evidence: transcripts.
- Requirement: which documents released, paid, partially paid, unpaid.
- Target behavior: release reporting.
- Module: ReleaseOrder, Reports.
- Phase: Phase 6/Phase 8.

#### Alerts for overdue/partially paid releases

- Employer evidence: transcripts.
- Requirement: alerts wanted.
- Target behavior: event hooks and minimal alerts; full notification deferred.
- Module: ReleaseOrder, notifications.
- Phase: Phase 6/Phase 8.

#### Agent sees Release status and B/L status

- Employer evidence: transcripts.
- Requirement: agent destination-scoped visibility.
- Target behavior: agent portal scoped.
- Module: Agent portal.
- Phase: Phase 8.

### 2.18 Delivery Order

#### Delivery Order for cargo discharged at company port

- Employer evidence: transcripts.
- Requirement: D/O for company-port discharge.
- Target behavior: DeliveryOrder with customer/port.
- Module: DeliveryOrder.
- Phase: Phase 6.

#### Delivery Order printed and stamped

- Employer evidence: transcripts.
- Requirement: print and stamp.
- Target behavior: document output with stamp behavior.
- Module: DeliveryOrder, document engine.
- Phase: Phase 7.

#### Delivery Order handed to customer with other documents

- Employer evidence: transcripts.
- Requirement: physical document hand-over.
- Target behavior: printed/stamped D/O.
- Module: DeliveryOrder, document engine.
- Phase: Phase 7.

### 2.19 Agent portal

#### Agent login access

- Employer evidence: transcripts.
- Requirement: agents log in.
- Target behavior: agent authentication/portal.
- Module: Agent portal.
- Phase: Phase 8.

#### Agent sees only own destination's B/Ls and Release info

- Employer evidence: transcripts.
- Requirement: destination-scoped visibility.
- Target behavior: server-side destination scope.
- Module: Agent portal.
- Phase: Phase 8.

#### Agent does not need to call office for routine checks

- Employer evidence: transcripts.
- Requirement: self-service status view.
- Target behavior: portal B/L/Release/document visibility.
- Module: Agent portal.
- Phase: Phase 8.

### 2.20 Reports

#### Voyage/Vessel/Manifest P&L

- Employer evidence: transcripts.
- Requirement: costs vs revenue per sailing; profit/loss.
- Target behavior: P&L report from voyage costs and invoices.
- Module: Reports.
- Phase: Phase 8.

#### Cost categories

- Employer evidence: transcripts.
- Requirement: vessel charter, Port Use, Handling, Lashing, miscellaneous.
- Target behavior: cost tracking supports these categories.
- Module: Job/Reports.
- Phase: Phase 6/Phase 8.

#### Reports support filtered views

- Employer evidence: transcripts.
- Requirement: filtered tax/annual reporting.
- Target behavior: report filters.
- Module: Reports.
- Phase: Phase 8.

### 2.21 Documents and templates

#### Company-specific templates expected

- Employer evidence: transcripts.
- Requirement: templates for Loading List, B/L, Manifest, Invoice, Proforma, Quotation, Receipt, Payment, Ledger, Release Order, Delivery Order, Salary Slip, Letters.
- Target behavior: DocumentTemplate per type.
- Module: document engine.
- Phase: Phase 7.

#### Templates uploaded by company

- Employer evidence: transcripts.
- Requirement: company uploads templates.
- Target behavior: template upload/management.
- Module: document engine.
- Phase: Phase 7.

#### PDF and Excel output

- Employer evidence: transcripts.
- Requirement: multiple output formats.
- Target behavior: PDF/Excel generation.
- Module: document engine.
- Phase: Phase 7.

#### Auto stamp on PDF

- Employer evidence: transcripts.
- Requirement: automatic stamp where applicable.
- Target behavior: stamp in generation layer.
- Module: document engine.
- Phase: Phase 7.

#### Print removes live stamp

- Employer evidence: transcripts.
- Requirement: print output for physical stamping.
- Target behavior: print variant without live stamp.
- Module: document engine.
- Phase: Phase 7.

#### Digital stamp/signature support

- Employer evidence: transcripts.
- Requirement: digital stamp/signature in generation layer.
- Target behavior: generation-layer support.
- Module: document engine.
- Phase: Phase 7.

### 2.22 Salary

#### Salary Slip per employee per month

- Employer evidence: transcripts.
- Requirement: monthly slip.
- Target behavior: SalaryRecord per employee/month.
- Module: Salary.
- Phase: Phase 7.

#### ID Card images on salary slip

- Employer evidence: transcripts.
- Requirement: ID Card front/back by upload or capture.
- Target behavior: attachment fields on salary slip.
- Module: Salary, attachments.
- Phase: Phase 7.

#### Employee signs slip

- Employer evidence: transcripts.
- Requirement: signature.
- Target behavior: signature field/attachment.
- Module: Salary, attachments.
- Phase: Phase 7.

#### Salary Slip printable

- Employer evidence: transcripts.
- Requirement: printable slip.
- Target behavior: document output.
- Module: Salary, document engine.
- Phase: Phase 7.

### 2.23 UI structure

#### Left navigation sections

- Employer evidence: transcripts.
- Requirement: Overview, Operations, B/L and Manifest, Accounting, Master Data, Access Control.
- Target behavior: sidebar sections.
- Module: UI.
- Phase: Phase 7/Phase 9.

#### Master Data contents

- Employer evidence: transcripts.
- Requirement: Customers, Ports, Yards, Vessels, Shippers, Consignees, Agents.
- Target behavior: Master Data sub-sections.
- Module: UI, master data.
- Phase: Phase 2/Phase 9.

#### Responsive and usable on mobile

- Employer evidence: transcripts.
- Requirement: responsive UI.
- Target behavior: responsive layout.
- Module: UI.
- Phase: Phase 9.

### 2.24 Customer 360

#### Customer profile shows history and status

- Employer evidence: transcripts.
- Requirement: profile with invoices, payments, balance, ledger, status, history.
- Target behavior: Customer 360 aggregate view.
- Module: Customer 360.
- Phase: Phase 8.

#### Customer profile is important management view

- Employer evidence: transcripts.
- Requirement: prominent management view.
- Target behavior: Customer 360 as key UI.
- Module: Customer 360, UI.
- Phase: Phase 8.

## 3. Notes on scope

This map is intended to be complete enough to verify that the final system stays connected to employer evidence. It does not enumerate every field or every UI pixel. Field-level detail lives in the data model and API blueprint; UI detail lives in the UI blueprint; workflow detail lives in the workflows document.

---

## current-plan/09-final-implementation-roadmap.md

# 09 Final Implementation Roadmap

> ## 🗄️ HISTORICAL — SUPERSEDED (marked 2026-10-11)
>
> **This roadmap is no longer the plan.** It is retained as evidence of a prior planning round and explains
> *why* the current system looks the way it does. Do not use it to make planning decisions.
>
> **The single planning entry point is now:**
> [`docs/source-material/project-audit.md`](../duna-analysis/09-audit/initial-roadmap.md) — phases
> **P0–P12**.
>
> **Why superseded.** §2.2 and §2.3 below list four items as open that are in fact implemented:
> manifest-first ordering, the B/L revision model, the `ManifestItem`→B/L item reference, and Customer-FK
> parties. Beyond that, this roadmap predates the confirmed product decisions (`DEC-001`–`DEC-114`), the
> financial-spine requirements (dated exchange rates, accounting entries, allocation, controlled
> correction) and the document-output scope — none of which appear here.
>
> **Nothing has been deleted.** The content below is unchanged and remains the record of that round.


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

---

## current-plan/10-phase-execution-protocol.md

# 10 Phase Execution Protocol

## 1. Decision-maker workflow

1. Decision-maker selects the next phase or task from `09-final-implementation-roadmap.md`.
2. Decision-maker writes a precise English implementation prompt.
3. A Hermes/OpenCode execution session performs the code, schema, migration, and test work.
4. The execution session writes an implementation log into `docs/current-plan/implementation-log/`.
5. Decision-maker reads the log.
6. Decision-maker validates completion against acceptance criteria.
7. Decision-maker updates `11-implementation-state.md`.
8. Decision-maker writes the next prompt.

## 2. Implementation log structure

Each executed task gets a file in `docs/current-plan/implementation-log/`.

Log file name pattern: `YYYY-MM-DD-task-slug.md`.

Log contents:
- Task ID.
- Phase.
- Objective.
- Prompt reference.
- Files changed.
- Database changes.
- Migrations.
- Tests.
- Validation steps.
- Unresolved issues.
- Known deviations.
- Final status.

## 3. Completion rules

- A task is complete only when its log records evidence for each acceptance criterion.
- If a criterion is not met, the task is not complete and the log must say so.
- The decision-maker does not need to manually copy results back; the log is the source.

### 3.1 Mandatory UI/runtime acceptance gate (user-visible phases)

At the end of each completed implementation phase/sub-phase whose work has a user-visible
frontend/UI component, a real runtime/UI verification is REQUIRED before the decision-maker
approves the phase as COMPLETE and moves to the next task. This gate is an ADDITIONAL final
acceptance checkpoint; it does not replace tests, typecheck, lint, migration verification,
API checks, repository inspection, or implementation-log review — all of those remain
mandatory independently.

Where applicable, the verification confirms:

- the application actually starts and the relevant page is reachable;
- the new feature is visible in the intended navigation/location;
- the main user workflow for the completed task works in the UI;
- create/edit/list/detail/filter or other relevant interactions work as applicable;
- no obvious runtime, rendering, console, API-integration, permission, or form-validation
  errors affect the completed feature;
- the UI behavior matches the authoritative plan and acceptance criteria.

Rules:

- A user-visible phase must NOT be marked COMPLETE until both the technical verification
  AND the UI/runtime verification are satisfied.
- If UI verification is genuinely not applicable to a task (e.g. pure backend/schema work),
  the decision-maker explicitly records "UI verification: NOT APPLICABLE" with the reason,
  rather than inventing a check.
- If UI verification reveals a problem, classify it (bug / deviation / acceptance-criterion
  failure), then either instruct the execution session to fix it (RESUME_HERMES) or return
  a BLOCKER / NEEDS_BUSINESS_DECISION state per the existing workflow.
- The outcome of the UI verification (pass/fail/NA + evidence) is recorded in the
  implementation log and in `11-implementation-state.md`.

## 4. Safety rules

- Read-only inspection before risky changes.
- Backup before risky repair.
- No destructive commands without authorization.
- No blind migration push.
- No invented historical data.
- Migration review before application.
- Post-migration verification.
- Rollback awareness.

## 5. Authority during execution

- The execution session follows the prompt and the locked technical decisions.
- If a conflict with locked decisions is found, the session records it and stops for decision-maker review.
- If a conflict with employer evidence is found, the session records it and stops for decision-maker review.

## 6. Communication boundary

- The decision-maker communicates by writing the next prompt and reading logs.
- The execution session communicates by writing logs and asking only when blocked.
- Neither side invents business rules.

---

## current-plan/11-implementation-state.md

# 11 Implementation State

## Current phase

Phase 2 — Master Data & Party Model Realignment (execution cycle underway).

## Current subphase

Party Masters — COMPLETE. Port abbreviation — COMPLETE. Vessel type & tug/barge — COMPLETE. Voyage per-destination numbering — COMPLETE. Cutover evidence pack — COMPLETE. Portal agent linkage — COMPLETE. B/L/Manifest party reference cutover — COMPLETE (plan → executed → verified). Follow-ups (i18n / portal shim / replay completeness) — COMPLETE. Party master + Agent destination e2e coverage — COMPLETE. **Phase 2 CLOSED** (roadmap §3 Phase 2: 4/4 acceptance criteria and 4/4 `Tests:` items verified). Phase 3 units 1, 2, 2b — COMPLETE. Phase 3 unit 3 (not-loaded return to yard) — **COMPLETE, INDEPENDENTLY VERIFIED**: log `2026-10-02-phase3-unit3-not-loaded-to-yard.md`; decision-maker re-ran the full suite **364/364/0 (22/22)** on top of the executor's identical triplet, re-checked tsc API 0 / web exactly 3 pre-existing / shared build 0, `prisma migrate status` 32 up to date, servers 200/200, porcelain = the 2 claimed files + log, ADR order 040→041→042 with an identical non-empty-line multiset (md5-identical HEAD-vs-new), and live-reproduced then **fixed** the `GET /yard-inventory/:id` 500 (see Completed work). Baseline after unit 3 + that fix: **365/365/0 (22/22)**. Phase 3 unit 4 (Inspections/Cargo UI contract repair) — **COMPLETE, INDEPENDENTLY VERIFIED** (decision-maker 2026-10-02, commit `3076a89`, log `2026-10-02-phase3-unit4-inspection-ui-contract.md`): full suite re-run **365/365/0 (22/22)**, tsc api 0 / web exactly the 3 pre-existing / shared build 0, migrate 32 + clean shadow diff, servers 200/200, porcelain = 6 modified + `apps/web/scripts/` + log (prisma/ and apps/api/src untouched), both guard red-PROOFS independently reproduced (stale vocabulary → 2 STATUS PARITY failures; dead route → 1 POST ROUTE MISSING) then green after revert, live filter parity (5 inspection statuses 200, `READY_FOR_LOADING` on cargo/yard 200, `APPROVED`/`REJECTED`/`READY` correctly 400), counts back to the 53 baseline (30/0/22/1/0) with fixtures cleaned, UI gate screenshots vision-verified; root `pnpm test` self-recursion proven **pre-existing** by stash A/B (identical on baseline; documented since the Phase-2 logs). **Phase 3 unit 5 (Comment editing/visibility, DESIGN first) — COMPLETE (2026-10-02):** log `2026-10-02-phase3-unit5-comment-design.md`; design + **ADR-044** appended (order 041→042→043→044); canonical column ruled `comments` with the cleanup plan specified for a later unit; decisions recorded for required/deletable/visibility; **one NBD carried to the employer: single mutable field vs append-only comment/activity log**; no code/schema/test change (design-first), triplet 365/365/0 ×3, guard green, UI gate NOT APPLICABLE. **Phase 3 unit 6 (Comment UI — final Phase 3 unit) — COMPLETE (2026-10-03, RESUMED at reporting after a context-loss incident; log `2026-10-03-phase3-unit6-comment-ui.md` records it):** comment handling shipped per ADR-044 decisions 2–4 (required-at-create in the cargo form with guidance text, always-send `comments` so clear-to-empty persists, detail always shows Comments with `—` when empty; visibility on existing `cargo:read`/`cargo:update`, no new permissions), coverage-note items closed (AL DRAFT label `Not started` → `Draft`; `shared/inspection.ts` header comment → shipped lifecycle, comment-only), +1 canonical comments round-trip/clear e2e. **Test delta 365 → 366** (triplet 366/366/0 ×3 + decision-maker re-run), tsc 0/3/0, migrate 32, guard OK, UI gate **PASS** (4 screenshots vision-verified, counts 55/1 unchanged). **Decision-maker verification (2026-10-03):** commit `785ddd6` porcelain = exactly the 6 intended files; suite re-run **5× green 366/366/0 (22/22)** — with one honest note: the first of those runs exited 1 before the failure output was captured, and no failure has reproduced since (5 greens, full logs in `~/.hermes/cache/scratch/u6-verify-r*.log`); the unit-4-era flake family (`POST /jobs → 400` under load, follow-up (e)) is the known candidate but is **unconfirmed** for this instance — re-armed under follow-up (e), no evidence of a real defect; tsc api 0 / web exactly 3 pre-existing / shared 0; migrate 32 up to date; `CONTRACT GUARD OK`; servers 200/200; gate3 re-capture vision-verified (`Comments = —`, fixture CRG-2610-00116, cleaned); live counts 55/1 unchanged. **PHASE 3 CLOSED: yes** — 3/3 acceptance criteria, 4/4 Tests items, 3/3 UI changes (assessment in the unit-6 block below). NBD (d) remains carried to the employer (non-blocking); follow-up (f) unchanged. Both unit-3 NBD items remain closed by ADR-043. Next per roadmap: **Phase 4 — B/L Rewrite — OPENED; unit 1 (design) COMPLETE (2026-10-03):** log `2026-10-03-phase4-unit1-bl-rewrite-design.md`, design + **ADR-045** appended (order 044→045): B/L source of truth = voyage + actually-loaded cargo (manifestId demoted to nullable legacy), lifecycle target Draft/Final/Approved/Released with configurable default mapping (ISSUED→APPROVED), RELEASED as a separate `bill:release` transition + audit, snapshot revisions with frozen bill numbers, per-destination numbering via NumberingService (`BOL-{DEST}-YYMM-#####`), ADR-030 superseded in part; 7-unit execution plan P4-U2…U7 mapped to the roadmap's 5 Tests / 4 Acceptance. Design-only (baseline 366/366/0 accepted first run, guard OK, migrate 32, no code/schema/tests). **New NBDs for the employer: §1.1a exact status names / Final-vs-Approved; §1.1b Released modeling; §1.2 ReleaseOrder eligibility policy — all three RAISED then CLOSED by ADR-046 (2026-10-04, four states / RELEASED = enum + `bill:release` + audit / APPROVED + fully-paid default with audited override)** (plus ADR-044 (d) still carried). **Phase 4 unit 2 (B/L decoupling) — COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-03, commit `f22ea1b`, log `2026-10-03-phase4-unit2-bl-decoupling.md`, UI gate PASS):** additive migration `20261003120000_bl_decoupling_additive` (no column drops; FK relax → ON DELETE SET NULL; 2 idempotent backfills) → migrate 33 up to date + shadow diff clean; create = dispatcher (legacy `createFromManifest` preserved + new `createFromCargo` sharing `loadEligibleCargoLine`: COMPLETED AL + `actualQuantity > 0` + one live bill per cargo per voyage); transition contract **A** (legacy manifest path kept, zero web changes); conditional legacy `blNumber` stamp (null-filtered); test delta **366 → 369** (bill 13→16) — decision-maker re-run 369/369/0, tsc 0/3/0, shared 0, guard OK, servers 200/200; gate1–3 vision-verified (BOL-2610-00001 Draft → picker `#1 — CRG-2610-00118 (3 pkg)` → `Issued — MAN-2610-00001`, 8 fetches 2xx, 0 console errors); unit fixtures hard-deleted, live counts restored (bills 3 / manifests 4 / cargos 55 / voyages 21). **Cleanup incident (executor-recorded, decision-maker verified):** a broken cleanup script cascade-deleted all 8 LoadListItems; the seed-owned row was restored verbatim from `seed.ts` (plannedQuantity 20, sequence 1, notes "Approved electronics containers", CRG-2401-APPROVED — live-verified); **7 demo-fixture items are unrecoverable from the repo** (grep: no source defines them; demo ALs were 0-item before and after → no AL loss); a DB backup exists at `/home/duna/backups/shipping_erp_20260926_112141.dump` (2026-09-26) if those rows matter — selective restore needs `pg_restore`, not installed. **Phase 4 unit 3 (per-destination B/L numbering) — COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-04, commit `86f12f5`, log `2026-10-03-phase4-unit3-bl-numbering.md`, UI gate PASS):** `generateReference()` → `allocateBillNumber()` via `NumberingService` (lazy upsert, `SELECT … FOR UPDATE`); format `BOL-{DEST}-YYMM-#####`, segment = `Port.abbreviation ?? code`, counter per destination per month (sequence name embeds dest id + YYYYMM); decisions recorded: (a) per-dest-per-month, (b) segment source, (c) null edge = defensive 400 (unreachable — both source columns NOT NULL), (d) lazy rows, no seed/migration. Legacy `BOL-YYMM-#####` immutable + coexists under `@unique` (live-verified: BOL-2609-00001/2/3 untouched, `destinationPortId` backfilled); test delta **369 → 374** (bill 16→21) — decision-maker re-run **374/374/0**, tsc api 0 / web exactly 3 pre-existing / shared 0, migrate 33 (no schema change), `CONTRACT GUARD OK`, servers 200/200; gate1/2 vision-verified (`BOL-ABBR-3C0OU7-2610-00001`; list shows both formats — wraps, not truncation); counts restored (bills 3 / manifests 4 / cargos 55 / voyages 21). **New low-priority finding (decision-maker):** every full suite run leaks ~2 orphan `BILL` NumberingSequence rows — `createdSeqNames` is pushed at only 2 sites while more bills are created; orphan scope keys (ports already deleted), harmless and never query-reachable, same pre-existing class as the **1557 `VOYAGE` rows accumulated since 2026-09-21** → follow-up (g). **Phase 4 unit 4 (B/L lifecycle) — COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-04, commit `edc067b`, log `2026-10-04-phase4-unit4-bl-lifecycle.md`, UI gate PASS):** two additive migrations by design (34 = enum `ADD VALUE IF NOT EXISTS` ×3, split from 35 = idempotent `ISSUED→APPROVED` backfill — the PG same-transaction usage pitfall was planned, not stumbled into); shadow diff clean, no drops, no values removed; live verify **DRAFT 1 / APPROVED 2 / 0 ISSUED** (legacy bills backfilled). `BILL_TRANSITIONS` = exact ADR-046 set (inert `APPROVED→RELEASED`, no `/release` route = 404 test-proven, RELEASED terminal all-4-409); issue = composite alias walking `DRAFT→FINAL→APPROVED` via shared `approveCore()` + explicit `POST /finalize`/`/approve` under existing `bill:issue`; both D-O/R-O gates → `APPROVED` with new messages; 21-site vocabulary checklist (shared union 6 values, DTO whitelist, web filter/badges/`??` fallback, D-O+R-O pickers `?status=APPROVED`, i18n ×3); invoice/proforma/DO-own-enum `ISSUED` sites verified untouched. Test delta **374 → 377** (+3: backfill, full edge set incl. 409s + RELEASED-terminal + `/release` 404, D-O/R-O gate vocabulary) with 10 re-pointed assertions enumerated, none weakened — decision-maker re-run **377/377/0**, tsc 0/3/0, shared 0, migrate 35 + shadow clean, `CONTRACT GUARD OK` (84 ⊆ 92, +2 new routes), servers 200/200; gate1–4 vision-verified (Draft grey + Approved green ×2, zero blanks; `Approved — MAN-2610-00001` subtitle with Issue/Cancel correctly absent; DO picker fed by `/bills?status=APPROVED` → `DO-2610-00001` created; 0 console errors); counts restored (bills 3 / manifests 4 / cargos 55 / voyages 21 / D-Os 2), fixtures hard-deleted by explicit id/name filters. Recorded consequences (not invented): surrender edge `APPROVED→CANCELLED` retired per "exactly this set"; stamp-clear branch unreachable-by-design; `issued*` column names kept; `/issue` rename remains a U7 item. Next: **P4-U5 revisions** (ADR-045 decision 4 — additive revision table, frozen bill numbers, backend-only → UI gate likely NOT APPLICABLE) — **DONE the same day: unit 5 COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-04, commit `e23704b`, log `2026-10-04-phase4-unit5-bl-revisions.md`):** additive migration 36 (`revision` column + `bills_of_lading_revisions`, `@@unique` backstop, CASCADE FKs), snapshot = verbatim `detailSelect`, permission `bill:update`, FOR UPDATE row lock, DRAFT-only freeze/list/restore (restore captures current state first — nothing lost), billNumber frozen; test delta **377 → 381** with 1 justified test-only assertion correction — decision-maker re-run **381/381/0**, tsc 0/3/0, migrate 36, guard OK (84 ⊆ 94), servers 200/200, counts restored, revisions empty; **follow-up (g) closed-in-part, zero growth independently confirmed (39 → 39 across my own full run)**; flake record: 3 one-shot failures diagnosed, new follow-up **(h)** (proforma read-then-write reference allocation under load). Next: **P4-U6 release separation** (ADR-045 decision 3 + ADR-046 rulings 2–3; roadmap Tests 5 / Acceptance 4 part 2; backend-only → UI gate NOT APPLICABLE expected, release display is U7). **Phase 4 unit 7 (B/L UI + doc hooks, FINAL) — COMPLETE, DECISION-MAKER VERIFIED with ONE evidence gap (2026-10-05, commit `97d4ecb`):** re-run **385/385/0 (22/22)**, tsc 0/3/0, shared 0, migrate 36 unchanged, guard OK (87 ⊆ 95 = web now posts freeze/restore/release), servers 200/200; live-checked billSeqRows 39 flat, AuditLog 0, bills APPROVED 2 + DRAFT 1, counts 3/4/55/21, revisions 0; append-only ADR note verified (prior text untouched); originals null-clear fix reviewed (correct `Number(null)` defect fix); `/audit` + `/document` routes + e2e (pos + 404) present; closure mapping in log re-checked item-by-item — accurate against my own unit-by-unit verification. Vision-verified myself: voyage-create DRAFT watermark (`Draft — Voyage VOY-2610-03440`), Released state + watermark absent, restricted account has NO Release button, number column single-line both formats. **GAP:** the gate-(c) restore screenshot does NOT contain the Revisions section (modal not scrolled past "Shipment marks") — yet the block claims it among "vision-verified", which is inaccurate; closure flipped to final only after a re-capture (micro-resume issued). **PHASE 4 CLOSURE: FINAL (decision-maker, 2026-10-05)** — the gate-(c) re-capture landed: `p4u7-gate3-revision-section.png` independently vision-verified by the decision-maker (Revision history heading + `current: 3`, entry `#1 gate-c recapture · 5 Oct 2026 · 12:29:31 · admin@shipping.local`, entry `#2 Pre-restore capture…`, Freeze control + per-entry Restore, read-only footer, no errors), fetch evidence `freeze 201 → restore 200`, `errs:[] non2xx:[]`, log addendum corrects the original visual overstatement, screenshot list in this ledger fixed to 6 + the new file; live cleanup re-verified (revisions 0, `BOL-2609-00003` back to `revision: 1` + DRAFT, AuditLog 0, `billSeqRows` 39 flat, counts 3/4/55/21); code untouched by the micro-resume (docs-only commit `385afc3`), so my 385/385/0 run stands for this tree. **All roadmap §3 Phase 4 criteria final: Tests 5/5, Acceptance 4/4, UI changes 3/3.** **PHASE 5 — MANIFEST REBUILD: OPENED (2026-10-05); unit 1 (P5-U1, design-only) COMPLETE (decision-maker 2026-10-05, log `2026-10-05-phase5-unit1-manifest-rewrite-design.md`, ADR-047 appended — order verified 045→046→047):** baseline accepted first run **385/385/0 (22/22)** at `175fa32`, tsc api 0 / web exactly 3 pre-existing / shared build 0, migrate status **36 unchanged** (design = no migration), `CONTRACT GUARD OK` (18 unions + 87 ⊆ 95), servers 200/200, porcelain = docs only (log + ADR-047 + this line). Survey (Part A, evidence file:line): creation = DRAFT via voyage + **single** header shipper/consignee (`manifest.service.ts:222-273`), items built **from cargo** (`:383+`, `eligibleCargo :523+`), local read-then-write `MAN-YYMM-#####` (`:728-734`), lifecycle DRAFT→SUBMITTED→APPROVED + cancel (`:570-635`), the **stamp direction Phase 4 left** (`bill.service.ts:1139-1192` — approve writes `ManifestItem.blNumber`, cancel clears), the multi-party defect = parties exist **only on the header** (item model has none), 17-row blast-radius table incl. verified NON-consumers (discharge/ADR-039, jobs, ledger, letters, exports = **zero** manifest refs) and the legacy `Cargo.manifestNumber` free-text field; live legacy data inventoried without destruction (3 B/Ls → MAN-2609-00001; manifests `MAN-2609-00001` APPROVED/2 stamped items, `00002` SUBMITTED, `00003`/`00004` DRAFT — all parties None). Design (Part B = ADR-047, 11 decisions): "issued" pinned to **`status === 'APPROVED'`** per ADR-046 ruling 1 (no new status); `POST /manifests {voyageId, billIds}` from APPROVED same-voyage bills with a one-manifest-per-B/L claim guard; **additive** `ManifestItem.billOfLadingItemId` FK (SET NULL) + idempotent two-way backfill (executing unit: status 36→37, shadow-clean); per-item `shipperId/consigneeId` + distinct-parties summary; display-only tug/barge from voyage; `Manifest.manifestDate` (plannedDepartureAt default); U3-pattern per-destination numbering (`MAN-{DEST}-{yymm}-`, legacy MAN numbers immutable); legacy cargo paths stay transitional (contract-A analog, web-side only); **charges explicitly OUT OF SCOPE** (Risk ii — legacy cost columns untouched, nothing computed); ADR-009 document hook mirroring U7. **NBDs raised: none** (vocabulary/source-of-truth/charges = ADR-046/045 + out-of-scope; `12-open-business-decisions.md` unchanged, recorded; ADR-044 (d) remains the only open NBD). **NO drops proposed** (Phase 4's legacy `manifestId` drop stays deferred past this phase). Unit plan: **U2** additive migration + create-from-B/Ls + integrity (Tests 1-2), **U3** multi-party (Test 3 / Acceptance 2), **U4** numbering (Test 4 / Acceptance 3), **U5** UI consolidation flow + multi-party rows + voyage/tug/barge + ManifestDate + doc hook + closure (UI changes 1-3); optional slice declined (every candidate touches schema/DTO/service/numbering/UI). Next: **P5-U2 — additive migration + create-from-B/Ls + ManifestItem→BillOfLadingItem integrity** (roadmap Tests 1-2). **Decision-maker verification of P5-U1 (2026-10-05, commit `46d3335`):** porcelain = exactly the 3 claimed docs files (log +279, ADR-047 +104, this line 1/1 — `12-open-business-decisions.md` diff = 0); ADR order 045→046→047 correct, all **11 decisions read verbatim** — qualification pinned to `status === 'APPROVED'` citing ADR-046 (no new status), one-manifest-per-B/L app-level claim guard with the soft-delete rationale, additive `billOfLadingItemId` FK (`ON DELETE SET NULL`, U2 precedent) + verbatim idempotent backfill + **NO drops**, per-item parties additive w/ header fallback + distinct-summary, display-only tug/barge, `ManifestDate` default logged-not-raised, U3-pattern numbering with legacy `MAN-YYMM-#####` immutable, contract-A analog for legacy cargo paths (dual-shape), charges out of scope (Risk ii), U7-pattern document hook, U2–U5 unit plan matching the roadmap's 4 Tests / 4 Acceptance / 3 UI; **NBDs none** justified (vocabulary/status = ADR-046 r1, source-of-truth = ADR-045, charges = explicit non-decision) and the open-decisions doc is untouched with ADR-044 (d) still the only open NBD. Survey spot-checked against source: `bill.service` stamp/cancel block + `manifest.service:728` local `generateReference()` confirmed; schema parties header-only confirmed; **legacy inventory live-matches the ADR exactly** (4 manifests APPROVED/2, SUBMITTED/1, DRAFT/1, DRAFT/0; 3 `BOL-2609-*` → one `manifestId`); 17-row blast radius + verified non-consumers + slice-declined reasons present. Baseline independently re-run: **385/385/0 (22/22)**, tsc 0/3/0, shared 0, migrate 36, guard 87 ⊆ 95, servers 200/200.

**Phase 4 unit 6 (release separation, execution) — COMPLETE, INDEPENDENTLY VERIFIED (2026-10-04, commit `779dd4a`).** Delivered ADR-045 decision 3 + ADR-046 rulings 2–3 (roadmap Tests 5, Acceptance 4 part 2). Axis 1: `POST /bills/:id/release` behind new `bill:release` (seeded idempotently, Administrator granted / Operations not — decision-maker live-verified both rows), dispatching the existing `APPROVED→RELEASED` edge under `lockBill` with an in-transaction AuditLog row via additive `AuditService.recordIn(tx, ctx)` (first business audit precedent; `record()`'s post-commit semantics documented, not touched); axes independence proven by test (approval writes 0 release rows; 4 re-open attempts 409). Axis 2: `RELEASE_ORDER_ELIGIBILITY_POLICY` single seam = ruling 3 exactly (APPROVED + FULL_SETTLEMENT + tolerance extracted from the service literal; key-set pinned by test; DO/RO creation gates deliberately unchanged); `release:override` now writes its in-txn audit row (verified missing before). Test delta **381 → 384**, 1 re-pointed assertion (U4's `/release` 404 → gated 409). Decision-maker verification: suite re-run 384/384/0, tsc 0/3/0, shared 0, migrate 36 (seed not migration), guard OK (84 ⊆ 95), servers 200/200; live-verified permission row + role grants, AuditLog 0 after runs, `billSeqRows` 39 → 39 flat, bills APPROVED 2 + DRAFT 1, counts 3/4/55/21 + DOs 2 / ROs 2, revisions 0; UI gate N/A (apps/web untouched, apps/web porcelain = 0). Trivial stale texts invalidated by this unit (2 code comments + 1 test title) fixed by decision-maker post-verification (separate commit; bill suite 28/28, tsc 0). Next: **P4-U7 — the final Phase 4 unit** (see subphase line for scope; UI gate MANDATORY), after which the **Phase 4 closure assessment** runs against the roadmap's 5 Tests / 4 Acceptance / 3 UI changes.

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

- Phase 3 unit 1 — operational e2e baseline + Inspection Done gating: COMPLETE (implementation-log/2026-10-01-phase3-unit1-operational-baseline.md, ends EXECUTION_STATUS: COMPLETE, UI_GATE: NOT APPLICABLE). Part A: 19 stale `POST /inspections/:id/approve` sites → `/book`+`/done`, 7 `/reject` → `/fail`, stale literals re-derived (APPROVED→DONE, REJECTED→FAILED, READY→READY_FOR_LOADING, NOT_STARTED→DRAFT, 10 finalize fixtures reordered) — no assertion deleted or loosened (`it()` unchanged, `expect()` counts all up; 2 assertions strengthened). Part B: atomic auto-number allocation by bounded retry-on-P2002-with-re-read for Cargo (mandated) + 6 more services (5 observed blocking with file:line, manifest/voucher preemptive — documented deviation), format/highest+1/soft-delete retention preserved, N=8 parallel proof. Part C: 6 tests proving roadmap acceptance *"Inspection Done gates Load List"*. Result: **3 identical full runs 353/353/0 (22/22)**, deterministic 67→0, failing set → empty; decision-maker re-ran twice more (353/353/0, per-suite identical). tsc API 0 / web 3 pre-existing / shared 0; migrate 32 unchanged; servers 200/200. Committed `e2233b8`.

- Phase 3 unit 3 — not-loaded return to yard (acceptance + eligibility + §2.3 evidence): **COMPLETE, INDEPENDENTLY VERIFIED** (implementation-log/2026-10-02-phase3-unit3-not-loaded-to-yard.md, ends EXECUTION_STATUS: COMPLETE / UI_GATE: NOT APPLICABLE). Executor: 2 new tests in `actual-loading.e2e-spec.ts` — (1) one 4-line chain proving all four result states after `complete()` through the **public API only** (`FULL` → line FULL + cargo LOADED + yard row gone; `PARTIAL`/explicit `0`/never-recorded → NOT_LOADED + cargo unchanged + yard row present), (2) ADR-028 later-voyage eligibility (NOT_LOADED cargo still in another voyage's `eligible-cargo`, search-scoped); ADR-041/042 reorder in `docs/decisions.md` (content unchanged); read-only Phase 3 UI coverage note. Decision-maker verification: full suite re-run **364/364/0 (22/22)**, touched suite solo 19/19, tsc API 0 / web exactly the 3 pre-existing `[locale]/page.tsx` errors / shared build 0, `migrate status` 32 up to date, servers 200/200, porcelain = `apps/api/test/actual-loading.e2e-spec.ts` + `docs/decisions.md` + log (0 files under `apps/web/src`, 0 under `prisma/`), ADR order 040→041→042 with non-empty-line multiset **md5-identical** to HEAD (473 = 473), §2.3/§2.4 wording re-read verbatim, `getEligibleCargo()`'s assigned-cargo `notIn` filter re-read at load-planning.service.ts:440-475. Two NEEDS_BUSINESS_DECISION raised (same-voyage re-planning scope; §2.3 "removed from Load List" vs ADR-041 immutability) — both left unasserted/unimplemented as the prompt required, then **closed by ADR-043** (see the Next block).
- **Follow-up FIXED by the decision-maker: `GET /yard-inventory/:id` 500 for every id** (unit 3 UNRESOLVED #1, live-reproduced present + absent before the fix). Root cause exactly as logged: `yard-inventory.service.ts:82` passed the module-level `Prisma.YardInventorySelect` payload as `include:`. One-word fix (`include: select` → `select`) + new regression test in `cargo-inventory.e2e-spec.ts` (200 with nested cargo/yard/port, 404 unknown id). Live re-probe: present → **200** (nested keys correct), absent → **404**. Suite 31 → 32 green; full suite **365/365/0 (22/22)**; tsc API 0.
- **Follow-up RESOLVED: seed `AL-2609-00001` restored to `DRAFT`** (unit 3 data anomaly) — one direct `UPDATE`, all four seed Actual Loadings now DRAFT as at the unit-2b baseline; full suite re-run green afterwards (365/365/0), so nothing in the suites depended on the stray IN_PROGRESS state.



## Defect record (found 2026-10-02, terminal-reproduced — NOT tooling/transient) — **RESOLVED by Phase 3 unit 4** (commit `3076a89`, independently verified 2026-10-02; body retained as the original diagnosis)

**RESOLUTION:** dead `/approve`/`/reject` replaced by shipped `/done`/`/fail` plus new `/book` and `/needs-re-inspection`, row+detail buttons gated on real `TRANSITIONS`, errors surfaced in a `role="alert"` slot; shared `InspectionStatus`/`CargoStatus` corrected to the 5 shipped values with `??` fallback on every meta-map index; all five filter options verified 200 live; `apps/web/scripts/check-contract.mjs` wired as the web test (proven red on both defect classes, green after fix).

**The Inspection/verification page was broken in two independent ways.** Prior verification is *not* invalidated: the full API suite re-ran green at **365/365/0 (22/22)**, tsc api 0 / web exactly the 3 pre-existing errors / shared build 0, `migrate status` 32 up to date, servers 200/200. This is a **web-layer** defect that no API test can see, and `apps/web` has **no test harness at all** (`"test": "echo 'No web unit tests yet'"`) — which is exactly why nothing caught it.

1. **Dead action endpoints — the reported "run the inspection" failure.** `inspections/page.tsx:216` posts `/inspections/:id/approve`, `:236` posts `/reject`. Live probe: **`404 Cannot POST /api/v1/inspections/:id/approve`** (`/reject` identical). The API renamed them in `4a39653` to **`/book` (controller `:53`), `/done` (`:64`), `/fail` (`:75`), `/needs-re-inspection` (`:90`)**; the web page was last touched `7a3a438` (2026-09-11) and never followed. Dialog opens → 404 → nothing completes. The UI's action gating is wrong for the shipped model too: it offers approve/reject only on `PENDING`, but shipped flow is `PENDING → book → BOOKED → done|fail`; live **non-mutating** probe: `POST /done` on a PENDING row → **409 "Cannot transition inspection from PENDING to DONE"**, row re-read unchanged.
2. **Stale status vocabulary — crashes the list render.** `inspections/page.tsx:41` `STATUSES = ['PENDING','APPROVED','REJECTED']` and `STATUS_META` `:43-50` hold only those three keys, while the shipped enum is `PENDING | BOOKED | DONE | FAILED | NEEDS_REINSPECTION` (`schema.prisma:754`). `STATUS_META[row.status].variant` is indexed **with no fallback** at `:404, :405, :530, :531, :653, :654, :794` → live page 1 has **22 of 25 rows `DONE`** → `undefined.variant` → **TypeError at render** (`node` repro: `Cannot read properties of undefined (reading 'variant')`). There are **0 `error.tsx` files** anywhere under `apps/web/src/app`, so it is an unhandled client crash. Filters broken as well: `status=APPROVED` and `status=REJECTED` → **400** (the empty-value path is safe — the page omits the param when empty, confirmed in code). Detail literals `'APPROVED'`/`'REJECTED'` at `:703, :705, :758` are unreachable → rejection reason never renders.

**Same root cause in three more places (all live-verified):** `packages/shared/src/cargo.ts:11-16` exports `CargoStatus` containing **`'READY'`** while the Prisma enum is **`READY_FOR_LOADING`** (`schema.prisma:733`) → `cargo/page.tsx:45` **and** `yard-inventory/page.tsx:41` both offer a `READY` option → `GET /cargo?status=READY` → **400**, `GET /yard-inventory?cargoStatus=READY` → **400**; `cargo/page.tsx:110-117` `STATUS_META` has no `READY_FOR_LOADING` key → the single live row of that status throws on sight (it happens to be off page 1 today, so the list survives only by sort luck). `shared/cargo.ts:27` `InspectionStatus` is likewise the pre-Phase-3A 3-value union → `cargo/page.tsx:119-123` `INSPECTION_META` renders **blank labels** for `DONE`/`FAILED` cargo (no crash, wrong output). **Blast radius is web-only:** `apps/api` imports exactly 5 things from `@shipping/shared`, none of them `CargoStatus`/`InspectionStatus`.

**Scope boundary (verified — do not over-reach):** every other status map is safe. `bills`/`manifest`/`invoices` switches have `default:`; `discharges` `statusVariant` has a trailing `return`; `voyages`/`bookings`/`portal` index with `??` fallbacks; `load-lists` and `actual-loading` keys match their shipped enums (AL's `DRAFT: 'Not started'` is stale *label wording* only — cosmetic, already flagged for the UI unit). Salary/quotation/manifest approve-reject endpoints called from their own pages **do** exist (checked in their controllers) — dead endpoints are **inspections-only**.

## Incomplete or transitional work

- **Resolved (unit 3): `docs/decisions.md` ADR order** — the file had run 040 (544) → **042 (560)** → **041 (603)**; reordered to 040 → 041 → 042 with the non-empty-line multiset md5-identical to HEAD (473 = 473, only blank separator lines normalized). No longer open.
- **Disproved: the "yard-inventory `list()` ignores its declared `cargoId` param" observation** (unit 2b `UNRESOLVED ISSUES`). `cargoId` is declared on `PlaceCargoDto` (the POST body), not on `ListInventoryQueryDto` — whose fields are page/pageSize/search/yardId/portId/customerId/destinationPortId/status/cargoStatus — and the controller passes `@Query() query: ListInventoryQueryDto`. Under the global `whitelist + forbidNonWhitelisted` ValidationPipe, `GET /yard-inventory?cargoId=…` would be **rejected with 400**, not silently ignored. No web caller passes it. Nothing to fix; recorded so it does not resurface.

- **Resolved (unit 2b, `0cfbb2c`): the two gaps blocking the Phase 3 UI gate.** Both fixes are committed and verified; the original diagnosis is retained below for history:
  1. *Dead web actions* — `apps/web/src/app/[locale]/(dashboard)/load-lists/page.tsx:291,318,342,344,357,383` use single-quoted `${...}` strings, so add-item / bulk / delete / refresh / finalize / cancel request literal URLs → 404. Pre-existing (unit 2 did not touch this file), and previously masked because finalize 409'd anyway. Decision-maker re-verified the bug class is isolated to exactly these 6 lines across `apps/web/src`.
  2. *ActualLoading lines are never materialized* — `create()` validates the FINALIZED Load List then creates a header only, so a fresh AL renders "No items yet" with no add-row control (`actual-loading/page.tsx:659-683` renders `detail.items` only) and `complete()` 400s. Decision: **copy-on-create**, resolved from converging evidence — schema `LoadListItem.actualLoadingItem` is one-to-one with `ActualLoadingItem.loadListItemId @unique`; ADR-028 "`actualQuantity` is per Load List item (unique)" with results derived per line; the mirror module `Discharge.create()` already materializes its lines at create (`items: { create: onBoard.map(...) }`, `discharge.service.ts:274`); and `selectionStatus` is vestigial (zero references), so **all** lines are copied. Not an employer question — the evidence converges, so it is not deferred.
  - *Required consequence the report did not flag:* manifest eligibility is **presence-only** (`manifest.service.ts:419` add guard and `:528` `eligibleCargo` both filter only on `actualLoading.status = COMPLETED`). Once rows exist for every line, not-loaded and never-recorded cargo would become manifest-eligible — contradicting ADR-029 ("the manifest reflects what was actually loaded") and ADR-028 (NOT_LOADED "stays in the yard and remains eligible for later planning"). Unit 2b applied the same "actually loaded" test Discharge already uses (`actualQuantity > 0`) to both sites — committed `0cfbb2c`, covered by new tests.

- **Resolved (unit 2, `1e220ca`): LoadList status machine was unreachable via API** (Phase 3 unit 1 `UNRESOLVED ISSUES`, independently re-verified by the decision-maker): `PATCH /load-lists/:id` writes only `notes`; only `finalize` → FINALIZED and `cancel` → CANCELLED write status; nothing can reach IN_PROGRESS / PARTIALLY_LOADED / COMPLETED; `finalize` requires COMPLETED; ActualLoading creation requires COMPLETED ⇒ circular. Additionally the shipped AL gate **contradicts locked ADR-028**, which requires the Load List to be **FINALIZED**. Resolution designed and delegated as Phase 3 unit 2: add the missing `DRAFT → FINALIZED` edge and realign the gate to ADR-028's `FINALIZED` — aligning the backend to the 3-state model already expressed by `packages/shared`, both pages, and ADR-028 (no new endpoints, no permissions, no web changes, no migration), recorded as ADR-041.

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
- **New (Phase 3 unit 2):** the LoadList status-driver design and the ADR-028 gate realignment are decided by the decision-maker from ADR-026/ADR-028 + employer workflow §2.3 (no employer evidence specifies load-list statuses, and `12-open-business-decisions.md` has no load-list entry). To be recorded as **ADR-041** and **confirmed with the employer at UAT** — it changes how many status actions a user performs before loading. Not a blocker: proceed autonomously, revisit only if the employer objects.

## Next approved task

**Phase 2 CLOSED** (decision-maker verification 2026-10-01). Roadmap §3 Phase 2 — 4/4 acceptance criteria met, 4/4 `Tests:` items covered: Voyage numbering (`voyage.e2e-spec.ts`, 26), Vessel type constraints (`vessel.e2e-spec.ts`), **Party CRUD** and **Agent destination scoping** (`party-masters.e2e-spec.ts`, 37/37 green, independently re-run by the decision-maker). Phase 2 commits: `4a39653` (tree), `d203444` (follow-ups), plus the party-master-tests commit.

**Phase 3 unit 1 CLOSED** (decision-maker verification, commit `e2233b8`): baseline deterministic (5 consecutive runs 353/353/0), roadmap acceptance *"Inspection Done gates Load List"* covered by 6 green tests.

**Phase 3 unit 2 CLOSED (`1e220ca`) and unit 2b CLOSED (`0cfbb2c`) — both verified by the decision-maker (unit 2: 357/357/0; unit 2b: 362/362/0, tsc 0/3/0, shared 0, migrate 32, UI gate PASS with driven end-to-end evidence).** The LoadList → ActualLoading chain now works in the API *and* through the shipped UI: `DRAFT → FINALIZED` edge, ActualLoading gate = FINALIZED per ADR-028 (ADR-041), copy-on-create of every Load List line with manifest eligibility tightened to a positive recorded quantity (ADR-042), and the 6 dead template-literal URLs restored. Phase 3 acceptance criteria now met: *Inspection Done gates Load List*, *ActualLoading results update cargo and yard inventory*.

**Unit 2 design, as implemented:** the LoadList → ActualLoading chain was unreachable end-to-end, and four independent artifacts agree on a **3-state** model (`DRAFT | FINALIZED | CANCELLED`) while only `load-planning.service.ts` asserts a driverless 6-state map:
- `packages/shared/src/load-planning.ts:6` → `LoadListStatus = 'DRAFT' | 'FINALIZED' | 'CANCELLED'`;
- `load-lists/page.tsx` → status filter is those 3, finalize button fires on `status === "DRAFT"`, copy *"Draft lists can be edited; finalized lists are immutable"*;
- `actual-loading/page.tsx:164` → the create dialog fetches `/load-lists?status=FINALIZED`, dialog text *"Select a FINALIZED load list to start loading"*; no web call to any start/complete endpoint exists;
- **locked ADR-028** → *"Creation additionally requires the Load List to be FINALIZED"*.

That is what the code contradicted before unit 2: (a) `actual-loading.service.ts:240` required `COMPLETED`, and (b) `LOAD_LIST_TRANSITIONS` had no `DRAFT → FINALIZED` edge — so the shipped UI could neither finalize a list nor create an Actual Loading (live DB: all 5 LoadLists still DRAFT, 0 FINALIZED). Both are fixed in `1e220ca`; what remains is that the UI cannot *call* them (gaps 1 and 2 above).

Decision (made from the evidence above; no employer evidence specifies load-list statuses and `12-open-business-decisions.md` has no load-list entry):
- add the missing `DRAFT → FINALIZED` edge to `LOAD_LIST_TRANSITIONS` (no new endpoints, no new permission codes, no web changes, no migration — the DB enum keeps its unreachable values, documented as superseded);
- realign the ActualLoading creation gate `COMPLETED` → **`FINALIZED`** (satisfies ADR-028 *and* the existing dialog filter);
- re-point the 6 `stampLoadListCompleted` fixtures to `FINALIZED` (fixtures, not assertions) and rewrite unit 1's C6, which pinned the old `DRAFT finalize → 409` rule — explicitly authorized and to be cited as ADR-041 in the log;
- record **ADR-041**: the 3-state lifecycle, the gate, and ADR-028's stale `NOT_STARTED` wording → shipped `ActualLoadingStatus.DRAFT`;
- prove the chain through the API *and* through the existing UI (finalize a DRAFT list → create AL → start → complete).

**Executed: Phase 3 unit 2b — chain ungate (committed `0cfbb2c`, UI gate PASS with driven end-to-end evidence).** Three parts, as implemented:
1. **Web URL fix** — `load-lists/page.tsx:291,318,342,344,357,383`: single-quoted `${...}` → backtick template literals (6 lines, no other change anywhere in `apps/web/src`; re-verify the bug class is otherwise absent and record the grep).
2. **Materialize ActualLoading lines on create** — inside the existing `create()` transaction, after the FINALIZED / ≥1-item / one-per-list / number-retry validation, `items: { create: loadList.items.map(...) }` with `actualQuantity: null` and `result: NOT_LOADED` (enum default), mirroring `Discharge.create()`. The nested create must stay inside the existing transaction so a number retry stays atomic; a `loadListItemId` collision must keep falling through to 409 rather than triggering the number retry.
3. **Manifest eligibility = actually loaded** — add `actualQuantity` positive filter to `manifest.service.ts:419` (add guard) and `:528` (`eligibleCargo`), the same `actualQuantity !== null && > 0` test Discharge already uses, so not-loaded / never-recorded lines cannot be manifested (ADR-029, ADR-028).

Tests: copied lines count/state (N lines → N items, all NOT_LOADED/null), untouched AL now completes (200) with cargo staying in yard, FULL record → cargo LOADED + yard inventory removed, manifest excludes null/0-quantity lines (409 + absent from `eligibleCargo`) and includes positive ones with the `actualQuantity` snapshot, Discharge unchanged (nothing-loaded → 400). **ADR-042** records the copy-on-create decision and the manifest consequence. Full suite 3× identical on a **357 baseline**; UI gate required end-to-end (finalize → create → rows render → record → save → complete), with live counts before/after and cleanup.

**Phase 3 unit 4 — Inspections/Cargo UI contract repair — COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-02, commit `3076a89`, log `2026-10-02-phase3-unit4-inspection-ui-contract.md`, UI gate PASS with driven evidence; NEEDS_BUSINESS_DECISION none, BLOCKED none).** The four parts as executed and verified: this was defect work on the shipped UI/API contract, not new scope: the API was correct and tested (365/365), the web was stale. Four parts:

**Unit 4 parts (all four are in-scope; the UI gate is MANDATORY — protocol §3.1, this is user-visible):**
1. **Inspection actions** — `inspections/page.tsx` must drive the shipped lifecycle: `PENDING → book (inspection:update) → BOOKED → done (inspection:approve) | fail (inspection:reject, reason required)`, `FAILED → needs-re-inspection (inspection:update)`; `DONE` terminal. Replace the dead `/approve`/`/reject` calls (`:216`, `:236`), re-gate the row and detail action buttons on the real transitions (today they only appear on `PENDING`, so a BOOKED row can never be completed), and keep the failure states visible (404/409 must show an error, not a silent no-op). Permission names are unchanged — only routes move.
2. **Status vocabulary** — fix the source of truth in `packages/shared/src/cargo.ts`: `InspectionStatus` → `PENDING|BOOKED|DONE|FAILED|NEEDS_REINSPECTION`, `CargoStatus` `'READY'` → `'READY_FOR_LOADING'` (both mirror `schema.prisma:754/733`). Then every consumer: `inspections/page.tsx` `STATUSES`+`STATUS_META` (5 keys, all badge variants chosen deliberately), `cargo/page.tsx:45/:110-117/:119-123`, `yard-inventory/page.tsx:41`. **Every** `STATUS_META[...]`/`INSPECTION_META[...]` index must gain a `??` fallback (bookings/portal already do this) so a future enum value can never white-screen a page again; `bills`/`manifest`/`invoices`/`discharges`/`voyages` were verified safe — do not touch them.
3. **Filter parity** — the `READY` filter options on cargo + yard-inventory currently 400; `APPROVED`/`REJECTED` on inspections 400. After the type fix, verify each offered option returns 200 live, and that detail-panel literals (`'APPROVED'`/`'REJECTED'` at `inspections/page.tsx:703,705,758`) are re-pointed so the rejection reason actually renders for `FAILED` rows.
4. **Web test harness (minimal, root cause)** — `apps/web/package.json` has no tests at all, which is why an API rename went unnoticed for 11 days. Add the lightest workable check that would have caught *both* defects: shared-type ↔ Prisma-enum parity and/or a static assertion that no page posts to a route absent from the controllers. Choose the cheapest thing that actually fails on regression; record the choice and its limits in the log. Do not build a full browser test suite.

**Verification for unit 4:** full API suite must stay green (baseline **365/365/0, 22/22**), `npx tsc -p apps/web` must not grow beyond the 3 pre-existing `[locale]/page.tsx` errors, shared build 0, migrate 32 unchanged, servers 200/200 (never restart them), porcelain limited to the files you intend, and a **driven UI gate** on live data: inspections list renders without console/TypeError with the real `DONE`/`FAILED` rows, an inspection taken `PENDING → BOOKED → DONE` end-to-end from the UI, a fail path with reason rendering, both `READY_FOR_LOADING` and `DONE` cargo visible in cargo/yard-inventory filters with 200s.

**Phase 3 unit 5 (Comment editing/visibility design) — COMPLETE (2026-10-02, design-first).** Log: `implementation-log/2026-10-02-phase3-unit5-comment-design.md`; design + **ADR-044** appended to `docs/decisions.md` (file order 041→042→043→044 preserved, content format unchanged). Roadmap §3 Phase 3 items addressed: `Scope: "Comment editing and visibility"`, `Tests: "Comment edit/delete visibility"`, `Acceptance: "Comment is editable and visible to relevant users"` — mapped as: *editable* = cargo form via `cargo:update` (+ the UI-unit required/clear fixes below); *visible to relevant users* = cargo detail via `cargo:read` now, Customer 360 comments/activity tab later (scoped out with C360 itself, roadmap §2.2).

**Recorded decisions (ADR-044):** **(1) canonical column = `comments`** — the singular `comment` is a Phase-3A orphan (zero non-web consumers repo-wide; live DB `comment` non-null in 0 of 56 cargo rows; zero test mentions of `comments` vs 4 orphan assertions at `cargo-inventory.e2e-spec.ts:385/:404/:439/:448`); cleanup path **specified, execution deferred to a later unit** in the order code-unwire → idempotent COALESCE backfill (no-op today) → explicit decision-maker approval for the destructive column drop (additive-only migration rule). Unit 5 introduced **no migration**. **(2) required** = at cargo registration, enforced in the cargo **create form** (Phase 3 UI unit); DTO-level `@IsNotEmpty` sequenced later (it would invalidate every comment-less creation across 22 suites + seed — evidence in the ADR). **(3) deletable** = **clear-to-empty**; the API already supports `comments: ''` on PATCH (`cargo.service.ts:256`), the gap is web-only (`cargo/page.tsx:927` sends only when non-empty) → UI unit always-sends. **(4) visibility** = existing `cargo:read` (view) / `cargo:update` (edit), **no new permission codes** (seed has only Administrator + Operations — no accountant role exists; a future accounting role gains comment visibility simply by being granted `cargo:read`).

**Carried NEEDS_BUSINESS_DECISION → employer (unit 5's only NBD): (d) single mutable field vs append-only comment/activity log.** Employer texts conflict internally — *"Comment is required, editable, and deletable"* / *"Comment visible and editable"* (field-side) vs *"Comments capture operational events … see history"* / Customer 360 *"comments/activity"* (log-side); the shipped model (one string, no versions/author/timestamps) cannot express history. Neither is implemented; decisions 1–4 hold under either answer, so the UI unit's form/clear/visibility work can proceed either way.

Slice status: **no code/schema/test change** (design-first; the optional slice was declined with reasons in the log). Verification: triplet **365/365/0 ×3, per-suite identical to baseline**, tsc api 0 / web exactly the 3 pre-existing / shared build 0, migrate status 32 (no migration introduced), guard green, servers 200/200, **UI gate NOT APPLICABLE (design-only)**.

Employer evidence for comments (all read verbatim in unit 5 and cited in ADR-044): `01-final-requirements.md:69-73` (cargo captures *Comment*; **"Comment is required, editable, and deletable"**; *"Comments capture operational events … see history"*), `03-final-workflows.md:15/:25/:28`, `06-final-ui-blueprint.md:93/:102-103`, `08-requirement-traceability.md:199-203`; `12-open-business-decisions.md` has no comment entry.

Shipped reality (verified in unit 5, full detail in ADR-044): `prisma/schema.prisma:450-451` carries **two** comment columns — `comments` (web-bound: `cargo/page.tsx:65/:85/:106`, textarea `:772-779`, detail `:862-866`, payload `:927`; typed in `packages/shared/src/cargo.ts:97`) and the orphan `comment` (selected `cargo.service.ts:56`, written `:186-187/:256-257`, **bound to no web field, 0 of 56 live rows populated, 0 consumers outside the cargo module**). Both DTO fields optional → "required" was enforced nowhere; the web sends `comments` only when non-empty → a comment could not be cleared from the UI; no audit/history table; no Customer 360 (roadmap §2.2); no comment on LoadList/ActualLoading/B-L/Invoice. **Settled by ADR-044:** canonical = `comments`; the dual-column cleanup is specified and deferred to a later unit (decision 1).

**Phase 3 UI unit scope for comments (from ADR-044) — SHIPPED by unit 6 (2026-10-03):** cargo-create **required** comment in the form (decision 2 — client-side only, `Comments *` marker + operational-notes guidance, edit stays optional; `CreateCargoDto` untouched); **always-send** `comments` (decision 3 — `buildPayload()` sends it unconditionally on create AND update, so an emptied textarea reaches the API as `''` and clears the row; detail panel now always renders Comments with `—` when empty so the cleared state stays visible); visibility rides `cargo:read`/`cargo:update` with **no new permission codes** (decision 4); Customer 360 comments/activity tab waits for Customer 360 itself. DTO-level required-enforcement and the canonical-column cleanup stay sequenced as later units (**authorized follow-up (f), unchanged**). The single open question — single mutable field vs append-only comment/activity log — remains the **NBD carried to the employer (decision 5 / (d)), none new**; decisions 1–4 invariant.

**Phase 3 CLOSED assessment (unit 6, against roadmap §3):** ✅ all **3 acceptance criteria** — (1) *Inspection Done gates Load List* (unit 1, 6 tests), (2) *Not-loaded cargo returns to yard* (unit 3, four-state tested), (3) *Comment is editable and visible to relevant users* (unit 6: form edit + detail visibility driven; required/clear per ADR-044). ✅ all **4 Tests items** — Inspection Done gating, Not-loaded return to yard, LoadList eligibility (unit 3), Comment edit/delete visibility (unit 6 e2e + gate (b)/(c)). ✅ all **3 UI changes** — Inspection status UI (unit 4), LoadList and ActualLoading status UI (units 2/2b/4 + unit 6's `Draft` label), Comment handling (unit 6). Non-blocking carry-overs: **NBD (d)** employer ruling (log vs field — does not affect any acceptance, since "editable and visible" is satisfied by the shipped single field) and housekeeping follow-ups (f) (orphan-column cleanup) + the unit-4 coverage leftovers now all closed.

**Not in Phase 3 (later phases):** §2.3 "removed from Load List" literal row deletion — **closed by ADR-043 (functional removal only, no row deletion; do not build unless the employer issues a superseding ruling)**, Phase 4 B/L rewrite.

**Phase 4 OPENED — unit 1 (B/L Rewrite design) COMPLETE (2026-10-03, design-only).** Roadmap §3 Phase 4 surveyed end-to-end (schema `:1216/:1232/:1306`, bill module create/eligible/issue/numbering, 14 tests, full blast radius: bill module 15 manifestId sites, ManifestItem.blNumber stamp, invoice soft refs, delivery-release `status === 'ISSUED'` gates ×2, portal/discharge zero refs, web bills page = UI unit) and redesigned in **ADR-045**. Decisions: (1) decouple from Manifest — source = voyage + cargo with positive recorded loading (ADR-029/042); additive-only migration strategy, drops deferred past Phase 5 with explicit approval; (2) lifecycle `DRAFT|FINAL|APPROVED|RELEASED(+CANCELLED)` with recorded configurable mapping `DRAFT→DRAFT, ISSUED→APPROVED, CANCELLED→CANCELLED` (enum ADD VALUE); (3) release = separate `bill:release` transition + AuditLog, ReleaseOrder eligibility policy-configurable (nothing hard-coded, §1.2); (4) minimal revision snapshots, `billNumber` frozen across revisions, no diff engine; (5) per-destination numbering via `NumberingService` `scopeType DESTINATION` (voyages pattern), destination segment keeps global `@unique` intact, existing numbers never renumbered; (6) execution plan **P4-U2 decoupling → U3 numbering → U4 lifecycle → U5 revisions → U6 release → U7 UI/doc-hooks**, each mapped to the 5 Tests items and 4 Acceptance criteria (log Part B table). Optional code slice declined with recorded reasons (candidates touch schema/DTO/service or number-format assertions, and would pre-empt the configurable parts of §1.1/§1.2). Verification: baseline **366/366/0 (22/22)** accepted first run, migrate 32 (no migration), guard OK, servers 200/200, porcelain = decisions.md + state doc + log only, UI gate NOT APPLICABLE (design-only).

**Phase 4 unit 2 (B/L decoupling, execution) — COMPLETE, INDEPENDENTLY VERIFIED (2026-10-03, commit `f22ea1b`).** Delivered ADR-045 decision 1 + decision 6's first unit: Tests 1–2 (creation without Manifest dependency; party master usage) and Acceptance 1–2. Additive migration (nullable `manifestId`/`manifestItemId`, new `destinationPortId` + index, cargoId/destinationPortId backfills; FK drop/re-add to SET NULL — no column drops), create dispatcher with the shared eligibility predicate, parties = DTO-first else derived from cargo masters with `assertLiveParty`, `eligible-items` two-mode, conditional legacy stamp, full 18-site manifestId checklist in the log; DO/RO gates, numbering, BlStatus, web untouched. Transition contract A recorded (legacy path stays until U7). Decision-maker verification: suite re-run 369/369/0, tsc api 0 / web exactly 3 pre-existing / shared 0, migrate 33 + shadow clean, guard OK, servers 200/200, gate screenshots vision-verified, fixtures gone (live counts restored). Incident + seed-row restoration and the 7 unrecoverable demo-LL items are recorded in the subphase line above and in the unit log. Next: **P4-U3 per-destination numbering** (ADR-045 decision 5; NBDs §1.1a/§1.1b/§1.2 — raised here, later closed by ADR-046).

**Phase 4 unit 3 (per-destination B/L numbering, execution) — COMPLETE, INDEPENDENTLY VERIFIED (2026-10-04, commit `86f12f5`).** Delivered ADR-045 decision 5 + decision 6's second unit: roadmap Tests 3 (Numbering) and Acceptance 3 (per destination). `bill.service.ts` only — `NumberingService` injected (`@Global`), both create paths allocate, null-edge 400 (defensive, recorded unreachable), bounded-retry retained for non-number conflicts; blast radius = 2 bill.e2e regexes (looser middle for `-` in segments) + 1 title; `delivery-release` `/^BOL-/` verified compatible and deliberately untouched; web 0 changes (transition contract A intact — page mints new-format numbers by design). 4 implementation decisions recorded in the log (a–d). Decision-maker verification: suite re-run 374/374/0 (triplet JSONs 369 base → 374 ×3 + post-cleanup all present), tsc 0/3/0, shared 0, migrate 33 (no schema), guard OK, servers 200/200, gate screenshots vision-verified, fixtures gone (counts 3/4/55/21), legacy bills untouched live. **Finding (minor, follow-up (g)):** ~2 orphan `BILL` NumberingSequence rows leak per suite run (afterAll pushes `createdSeqNames` at only 2 of the bill-creating sites) — same pre-existing litter class as the 1557 `VOYAGE` rows since 2026-09-21; no functional impact (deleted-port scope keys are unreachable). Next: **P4-U4 lifecycle (enum ADD VALUE + backfill + transition table + D-O/R-O gates; roadmap Tests 4-part-1 / Acceptance 4-part-1)** — ADR-045 decision 2's configurable default mapping is ready, and the exact-names question (§1.1a) was ruled by the decision-maker on 2026-10-04 and recorded as **ADR-046** (alongside §1.1b Released modeling and §1.2 default policy), so U4 is unblocked with no open business question.

**Phase 4 unit 4 (B/L lifecycle, execution) — COMPLETE, INDEPENDENTLY VERIFIED (2026-10-04, commit `edc067b`).** Delivered ADR-045 decision 6's third unit (with ADR-046's rulings binding): roadmap Tests 4 part 1 (Lifecycle) + Acceptance 4 part 1. Two additive migrations by design — `20261004000000_bl_lifecycle_enum` (`ADD VALUE IF NOT EXISTS` ×3) split from `20261004000001_bl_issued_backfill` (idempotent `ISSUED→APPROVED`) because PostgreSQL forbids USING a value added in the same transaction (the prompt's pitfall, planned not stumbled into); migrate 35 up to date + shadow clean; live `DRAFT 1 / APPROVED 2 / 0 ISSUED`. `BILL_TRANSITIONS` = exact ADR-046 set with inert `APPROVED→RELEASED` (no `/release` route → 404 test-proven; RELEASED terminal via all-4 409s); issue = composite alias over table edges via shared `approveCore()` + explicit `POST /finalize`/`POST /approve` under existing `bill:issue` (no permission added); both bill gates in `delivery-release` → `APPROVED`; 21-site vocabulary checklist in the log (shared 6-value union, DTO whitelist, web filter/badges/`??`, D-O+R-O pickers `?status=APPROVED`, i18n ×3) with invoice/proforma/DO-own-enum `ISSUED` sites verified untouched; `ISSUED` retained-but-unreachable per additive rule. Decision-maker verification: suite re-run 377/377/0 (triplet + post-cleanup JSONs), tsc 0/3/0, shared 0, migrate 35 + shadow clean, guard OK (84 ⊆ 92 = +2 new routes), servers 200/200; gate1–4 vision-verified (badges Draft/Approved zero blanks; `Approved — MAN-2610-00001` with Issue/Cancel correctly absent; DO picker fed by `?status=APPROVED` → `DO-2610-00001`; 0 console errors); counts restored (bills 3 / manifests 4 / cargos 55 / voyages 21 / D-Os 2), fixtures hard-deleted by explicit id/name filters. 10 re-pointed assertions enumerated, none weakened; recorded consequences: surrender edge `APPROVED→CANCELLED` retired per "exactly this set", stamp-clear unreachable-by-design, `issued*` column names kept, `/issue` rename deferred to U7.

**Phase 4 unit 5 (B/L revisions) — COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-04, commit `e23704b`, log `2026-10-04-phase4-unit5-bl-revisions.md`, UI gate NOT APPLICABLE — backend-only, porcelain confirms 0 files under apps/web / packages/shared / i18n):** one additive migration 36 = `bills_of_lading.revision INT DEFAULT 1` + `bills_of_lading_revisions` (`@@unique(billId, revisionNumber)` DB backstop, both FKs CASCADE), shadow diff clean, no drops/enum changes. Recorded decisions: snapshot = verbatim `detailSelect` row (JSON round-trip, no parallel serializer to drift); permission = **`bill:update`** for freeze / `bill:read` for history (no new codes); concurrency = `SELECT … FOR UPDATE` row lock with the snapshot read under the lock (parallel freezes → both 201, distinct consecutive numbers, test-proven); `revision` = the label the next freeze receives. Endpoints: `POST /bills/:id/revisions` (201, DRAFT-only → 409 with recorded message on all five other statuses), `GET /bills/:id/revisions` (list-only — no PUT/DELETE route, 404 by construction), `POST /bills/:id/revisions/:n/restore` (404-before-capture, pre-restore capture so nothing is lost, document fields + items read-back atomically, `billNumber`/status/stamps never restored, totals recomputed, P2003→400). Gold-plating guard honored (no diffs/version trees/engine/edit/delete/branching). Test delta **377 → 381** (+4: freeze flow/permissions/parallel/actor, byte-for-byte immutability, all-five-non-DRAFT 409s, full restore round-trip) with one test-only assertion corrected and justified (parallel note order raced the lock — distinctness/set/actors/number stability still asserted) — decision-maker re-run **381/381/0 (22/22)**, tsc 0/3/0, shared 0, migrate 36, `CONTRACT GUARD OK` (84 ⊆ 94 = +2 revision routes), servers 200/200; live counts restored (bills 3 / manifests 4 / cargos 55 / voyages 21 / D-Os 2), revisions table empty, `revision` column = [1,1,1]. **Follow-up (g) closed-in-part with measurement:** sequence-name pushes added at every new allocation site + exact-scope-id sweeps added to ALL THREE bill-creating suites; **decision-maker independently confirms `billSeqRows` = 39 and still 39 after my own full suite run (zero growth)** — the 39 historical orphans remain for (g)'s cleanup unit. Honest flake record: 3 one-shot failures all diagnosed (order-dependent assertion fixed; jobs-400 = follow-up (e); one proforma-convert 409 → new follow-up (h)), final tree green in its last 5 runs. **Phase 4 unit 6 (release separation) — COMPLETE, INDEPENDENTLY VERIFIED (decision-maker 2026-10-04, commit `779dd4a`, log `2026-10-04-phase4-unit6-release-separation.md`, UI gate NOT APPLICABLE — backend-only, apps/web untouched):** Axis 1 — `POST /bills/:id/release` dispatches U4's existing `APPROVED→RELEASED` table edge under `@RequirePermissions('bill:release')` in the same `lockBill` row-lock tx, writing an in-transaction AuditLog row (`recordIn(tx, …)` — new additive method; `record()` untouched, its post-commit semantics documented honestly); non-APPROVED sources 409 via `assertTransition`, RELEASED terminal. Permission `bill:release` seeded with the exact idempotent ADR-016 pattern (**decision-maker live-verified: row `bill/release` exists, Administrator granted = true via all-permissions loop (160 perms), Operations = false** — recorded rationale: final outbound step stays with full-system admins, grantable later via Roles UI). Axis 2 — new single seam `RELEASE_ORDER_ELIGIBILITY_POLICY` (`release-order.policy.ts`) = ADR-046 ruling 3 exactly: `requiredBillStatus APPROVED` + `FULL_SETTLEMENT` + the 0.005 tolerance moved OUT of `billFinancials()`'s hard-coded literal (ruling 3's last sentence honored); `evaluate()` verdict feeds both eligibility() and the RO-create money block; DO/RO *creation* gates deliberately left at U4's literal APPROVED per brief; key-set pinned by test so nothing can hide on the seam. Override auditing verified missing → added `release:override` in-txn row (actor email via `ACTX.actorEmail`); `release:override` gate untouched. Test delta **381 → 384** (+3: release axis/audit-field-by-field/axes-independence/4 re-open 409s, override audit with the exact 800.00 bypassed, policy seam), 1 re-pointed assertion (U4's `/release` 404 → permission-gated 409; terminal guarantee preserved) — decision-maker re-run **384/384/0 (22/22)**, tsc 0/3/0, shared 0, migrate 36 unchanged (seed, not migration), `CONTRACT GUARD OK` (84 ⊆ 95 = +1 release route), servers 200/200; **live-verified: AuditLog total 0 after runs, billSeqRows 39 → 39 flat (my own full run included), bills APPROVED 2 + DRAFT 1 (no RELEASED leaked), counts 3/4/55/21 + DOs 2 + ROs 2, revisions 0.** **Decision-maker follow-up (trivial):** U6 left 3 stale texts it invalidated — controller comment "No /release route exists", service lifecycle comment "INERT", and the test title "+ no release route" — all comment/title-only, fixed by decision-maker in a separate commit (bill suite re-run 28/28 green, tsc 0 after). Next: **P4-U7 — final Phase 4 unit: B/L UI + doc-output hooks** (ADR-045 decision 6: create/edit/detail rework to voyage+cargo ending transition contract A's web side, revision-history UI, release display + button, Draft watermark, template hooks per ADR-009 — engine stays Phase 7; plus the deferred `/issue` rename and the U3 B/L-number column wrap; roadmap UI changes; UI gate MANDATORY). Only ADR-044 (d) remains open (non-blocking).

**Phase 4 unit 7 (B/L UI + document-output hooks, FINAL unit) — COMPLETE (2026-10-05, log `2026-10-05-phase4-unit7-bl-ui-doc-hooks.md`, UI gate PASS with driven evidence):** delivered ADR-045 decision 6's U7 scope end-to-end. **Create rework (contract A's web side ENDS):** shipped page now creates voyage+cargo (voyage picker → `eligible-items?voyageId` checkbox lines → `POST /bills {voyageId, cargoIds}`); legacy manifest picker REMOVED from the UI (API path untouched — drops stay post-Phase-5); add-line mode branch wired (voyage rows `sequence:null` label fallback, `cargoId` payload); shared truth-ups (`manifestId: string|null`, eligible-row nulls); voyage route fallbacks in list+detail. **Revision-history UI:** list-only section (freeze w/ note surfacing the 409 verbatim, restore behind confirm, current label, read-only note). **Release display+action:** `bill:release`-gated button + confirm, Released badge with `releasedOn {date} by {email}` fed by new **`GET /bills/:id/audit`** (no releasedAt column — audit row is the record). **Draft watermark:** cosmetic DRAFT stamp on DRAFT only (2 visibility iterations; final top-anchored 40%, vision-verified; gone at APPROVED per gate b). **ADR-009 hook:** **`GET /bills/:id/document`** = structured document + `template:'default'` + stub `render` descriptor (Phase 7 drops the DocumentTemplate/PDF-A in); Document data dialog in detail. **Deferred items:** `/issue` rename → NO rename, ADR-045 "then renamed" superseded by an APPEND-ONLY ADR note; U3 wrap fixed (`whitespace-nowrap`, vision: single-line/no truncation both formats); 25 i18n keys × en/ar/fa. **Gate found & fixed 4 defects** (recorded in log): intl `{n}` console spam, freeze response-shape crash, **pre-existing** `originals` "null to clear" 400 (transform `Number(null)=0` defeated `@IsOptional` — fixed + 2 assertions in the update test), watermark visibility. Test delta **384 → 385** (+1 hook e2e); final triplet **385/385/0 ×3**, per-suite 22/22 (bill 29/29), tsc 0/3/0, shared 0, migrate **36 unchanged**, `CONTRACT GUARD OK` (87 ⊆ 95 = web now calls freeze/restore/release), servers 200/200; counts restored (3/4/55/21), `billSeqRows` 39 → 39 flat, fixtures/audit/role deleted by explicit id/name/email/code filters; 6 screenshots vision-verified (watermark, approved-no-watermark, released, restricted-no-release, number column, legacy detail); CORRECTION (2026-10-05, gate-c re-capture): the earlier claim that included "restore" overstated gate (c) — the original gate3 frame ended at "Shipment marks" with the Revisions section below the fold (drive evidence was real, the visual claim was not); the section is now vision-verified under its new filename **`p4u7-gate3-revision-section.png`** (freeze 201 + restore 200 in one segment, `errs:[] non2xx:[]`, revisions rows + label restored by explicit id — full addendum appended to the unit-7 log). Gate ops note: admin JWT TTL 900s — segments re-armed with fresh logins, final segments all `errs:[], non2xx:[]`. **PHASE 4 CLOSED: yes** — roadmap §3 item-by-item: Tests 5/5 (U2 decoupling+masters / U3 numbering / U4+U5 lifecycle+revisions / U6+U7 release separation), Acceptance 4/4 (U2, U2, U3, U4-U7), UI changes 3/3 (create-edit-detail, revision history, release display — all U7), plus watermark + doc hook. Carry-overs untouched: portal visibility, follow-ups (b)(f)(g)(h), MANIFEST/VESSEL/ROUTE wrap, remaining `Number(value)` transform sites, dead `create.manifest*` i18n keys. Next per roadmap: **Phase 5 — Manifest rebuild**.

**Decision-maker verification (2026-10-05):** commit `97d4ecb` porcelain = the 12 claimed files; suite re-run **385/385/0**, tsc api 0 / web exactly 3 pre-existing / shared 0, migrate 36, guard 87 ⊆ 95, servers 200/200; live: `billSeqRows` 39 → 39, AuditLog 0, bills APPROVED 2 + DRAFT 1, revisions 0, counts 3/4/55/21. Verified independently: the append-only ADR-045 note (prior text intact), the `originals` null-clear transform (genuine `Number(null)=0` defect, correct fix), `GET /bills/:id/audit` + `/document` routes with e2e coverage (positive + 404), the log's closure mapping re-checked item-by-item against every unit's actual tests, and 4 of the 6 gate claims vision-verified in the screenshots (a/d/e/f + wrap). **Correction to the block above:** the gate-(c) screenshot's subject is NOT in frame (modal ends at "Shipment marks"; the Revisions section sits below the fold) — listing "restore" among the vision-verified screenshots is inaccurate; gate (c) currently rests on the driven fetch chain (freeze 201 → history note+actor → restore 200 → values read back) plus U5's e2e, which is strong but not the visual evidence the gate required. Micro-resume re-capture received and **verified (decision-maker 2026-10-05)**: commit `385afc3` = exactly the log addendum (+67) + this 1-line correction; `p4u7-gate3-revision-section.png` independently vision-checked (full Revisions section in frame — heading, `current: 3`, both entries with notes/actors/timestamps, Freeze + Restore controls, read-only footer, no errors); live cleanup re-verified (revisions 0, target bill `revision: 1` + DRAFT, AuditLog 0, `billSeqRows` 39 flat, counts 3/4/55/21); code untouched (docs-only), my 385/385/0 stands. **PHASE 4 closure is FINAL.**

Carried NEEDS_BUSINESS_DECISION from unit 3 — **CLOSED 2026-10-02, ruling recorded as ADR-043**: **(a)** same-voyage re-planning of not-loaded cargo stays **excluded** by `checkCargoEligibility`'s assigned-cargo duplicate guard (one active list per cargo per voyage, `result` ignored) — an intentional double-booking rule, so ADR-028's *"remains eligible for later planning"* reads as **different-voyage**; the previously unasserted probe is now asserted `not.toContain(cargoId)` in `actual-loading.e2e-spec.ts` (test count unchanged, no `apps/api/src` change). **(b)** §2.3 step 7 *"removed from Load List"* = **functional removal only, no row deletion** — ADR-041 immutability stands; satisfied by manifest `actualQuantity > 0` (ADR-042), ADR-039 discharge exclusion, the same-voyage guard, and cargo physically staying in the yard (unit-3 tested). **No Phase 3 removal work exists.**

Authorized follow-ups, none blocking: (a) 5 live-only indexes declared in no schema; (b) `manifest.dto.ts:35` stale Swagger text; (c) candidate defects recorded in `2026-09-30-phase2-party-master-tests.md` (PATCH clobbers omitted text fields `shippers.service.ts:99-109`; destination duplicate message says "code" `agents.service.ts:197-199`; no GET-one destination route); (d) previously-noted business confirmations below; (e) job-suite load flake seen once in unit 3 (`POST /jobs → 400`, 9/14 on run 3 of a triplet, 14/14 solo immediately after, green in every later full run) — worth one focused re-run if it recurs; (f) **Cargo Comment cleanup unit** per ADR-044 decision 1, in order: code-unwire of the orphan `comment` column (`cargo.service.ts:56/:187/:257`, `cargo.dto.ts:136/:289` + repointing the 4 orphan test assertions to `comments`, which adds coverage for the canonical field) → idempotent `COALESCE` backfill (no-op today) → explicit decision-maker approval for the destructive column drop; DTO-level `comments` required-enforcement joins this unit once fixtures/forms carry comments; (g) **NumberingSequence test-litter**: each full suite run leaks ~2 orphan `BILL` rows (afterAll pushes `createdSeqNames` at only 2 of the bill-creating sites; scope keys point at deleted fixture ports — unreachable, zero functional impact) — same pre-existing class as the 1557 `VOYAGE` rows accumulated since 2026-09-21; extend `createdSeqNames` coverage in `bill.e2e-spec.ts` (and check `delivery-release.e2e-spec.ts`'s bill creates) when a cleanup unit is next convenient; (h) **proforma reference allocation under load**: one one-shot `convert → 409` observed during P4-U5 verification, diagnosed as `proforma.service.ts:570 generateInvoiceReference` being the same local read-then-write class that U3 replaced with `NumberingService` on bills (proforma still uses the local pattern at `:423`) — solo ×2 green, out of U5's scope, fix = same NumberingService swap when a proforma unit next runs.

**Phase 5 Unit 2 — manifest rewrite core COMPLETE (2026-10-06)**
Roadmap §3 Phase 5 Unit 2 (`phase5-unit2-manifest-rewrite-core`) — migration 36→37, shadow clean, 22/22 manifest suite (self-cleaning, explicit-id sweeps). Claim guard rewritten to `ManifestItem.billOfLadingItemId` through live manifests (RULING 1). Reachability analysis: 409 claim guard is API-unreachable; soft-delete direction IS reachable and tested. Tests: 3 deleted/replaced, 22 passing.

**Decision-maker verification of P5-U2 (2026-10-06, commit `31459a9`):** porcelain = exactly 7 files (dto 21+, service 163+/15-, e2e 348+, shared 12+, schema 23+/2-, migration 35 lines, 2 docs — apps/web **0**); battery independently re-run: **393/393/0 (22/22)**, tsc api 0 / web exactly 3 pre-existing / shared 0, `migrate status` 37 + shadow clean, guard 87 ⊆ 95, servers 200/200. Migration content read: additive only (`manifestDate`, `billOfLadingItemId` + FK ON DELETE SET NULL, `shipperId`/`consigneeId` + FKs, 3 indexes — no drops/enum changes); ADR-047 d3 backfill SQL verbatim, `IS NULL`-guarded. **Backfill 0 rows independently confirmed correct:** live DB has zero `billOfLadingItems.manifestItemId` rows (the Phase-4 stamp writes `blNumber` text only), so the join legitimately matches nothing — not a silent miss. Guard rewrite read in source: `tx.manifestItem.findMany({ billOfLadingItem: { billOfLadingId ∈ billIds }, manifest: { deletedAt: null } })` + owner numbers from the same query — both RULING-1 bugs (dead column, wrong-direction `ownerManifests`) gone; reachability proof (voyage immutability → pre-tx one-manifest-per-voyage always wins → 409 API-unreachable) written into the log with the keep-anyway rationale. Test redesign verified in e2e: unreachable 409 deleted; soft-delete pair present with the load-bearing assertion (M1 `ManifestItem` rows still exist by id after the 201 re-consolidation). Live counts: manifests 4→4, items 4→4, legacy 4 manifests + 3 B/Ls untouched (nullable columns only), `MANIFEST` NumberingSequence 0→0. Note: `bills_of_lading` 14→24 during the executor run and 29 after my re-run — **pre-existing fixture leak** (`mkVoyageModeBill` rows untracked by the `afterAll` sweep), not a U2 defect; parked as follow-up (i).

**Next: P5-U3 — per-item parties + distinct summary + validation** (roadmap Test 3, Acceptance 2; ADR-047 d4).

**Phase 5 Unit 3 — bill-of-lading-parties COMPLETE (2026-10-06)** — HEAD `31459a9` + this unit. Roadmap §3 Phase 5 Test 3 (multi-party support) + Acceptance 2 (multi-party manifests supported) implemented API-side: `detailSelect` items now carry `shipper`/`consignee` relation objects (`id, code, name` — the per-row cells of ADR-047 d4) and every detail-shaped response (11 returns) carries the derived `partySummary { shippers, consignees }` (effective party = item → header fallback, distinct by master id, rows govern, empty with no rows; display-time aggregation only — no schema, per d4's "not a schema group"). DTO validation: a consolidation create (`billIds`) that also supplies header party fields is now rejected 400 (they were previously validated then silently dropped — the consolidation create writes them null); legacy party validation untouched (test-pinned both ways). DTO file: follow-up (b) closed (stale "customer ID" Swagger text on all six party fields corrected + `billIds` description documents the rejection). Shared: `ManifestParty` type, `ManifestItem.shipper/consignee` objects, `Manifest.partySummary`. **Migration: none — ADR-047's whole schema footprint (d3 item FK+backfill, d4 party columns, d6 manifestDate) already shipped inside U2's migration 37** (decision-maker-verified content; U1 unit plan gives U3 no migration; shadow diff "No difference detected"; live columns probed). `prisma/schema.prisma` touched by an annotation comment only. Tests **393 → 397** (4 new: multi-party 2+2 distinct parties with per-row code/name; summary dedupe; row-vs-header rule test pinning both regression directions; 3-part DTO-validation test); manifest suite 26/26. **Fixture incident found+fixed**: the first instrumented run showed counts moving (+2/+2 masters, +11 bills) — root cause: `afterAll`'s bill block sat LAST after cargo/voyage/master deletes; its FK failure was swallowed by the bottom `catch`, silently aborting cleanup (the true mechanism of follow-up (i) — rows were always pushed to `createdBillIds`, the sweep never ran). Bill block moved to the top; post-fix solo + full triplet all show **static counts** (56/15/4 → identical after each run); accumulated fixture master litter purged by explicit code filter (`MFSP`/`MFCN`, 12+4 rows → seed 3/0 restored; bills→parties FK verified SET NULL). Bill litter (56) stays parked as follow-up (i) — leak now stopped, not growing. Battery (final): **397/397/0 ×3 (22/22)**, tsc api 0, web tsc exactly 3 pre-existing, shared 0, CONTRACT GUARD 87 ⊆ 95, `migrate status` 37 + shadow clean, curls 200/200, MANIFEST NumberingSequence 0→0, legacy 4 manifests + 3 B/Ls untouched. Porcelain: exactly 6 files (dto 21±, service 210±, e2e 285+, shared 15+, schema +2 comment-only, 2 docs) — apps/web **0**; `docs/decisions.md` untouched. Note: this commit also carries the decision-maker's uncommitted P5-U2 verification block + Next line (restored verbatim after an early-session `git checkout` clobbered it). Log: `implementation-log/2026-10-05-phase5-unit3-bill-of-lading-parties-design.md`.

## Status confidence

High for completed subphases (all verified against repository, live DB, live API, plus UI gates). Cutover planning confidence: high — evidence pack is complete and cited. Overall project: Medium pending the business confirmations above.

**Decision-maker verification of P5-U3 (2026-10-06, commit `d37fc4f`):** porcelain = 6 files (dto 14+/7-, service 142+/68-, e2e 272+/13-, shared 15+, schema +2 comment-only, ledger 7+/1- — apps/web **0**); battery independently re-run: **397/397/0 (22/22)**, tsc api 0 / web exactly 3 pre-existing / shared 0, `migrate status` **37 unchanged** (shadow clean, confirmed "No difference detected" by comment-only diff), guard 87 ⊆ 95, servers 200/200. Schema reconciliation confirmed: ADR-047 d3/d4/d6 columns (`billOfLadingItemId` + FK, `shipperId`/`consigneeId` + FKs, `manifestDate`) all shipped in U2's migration 37 — no new DDL for U3; the `prisma/schema.prisma` diff is a comment annotation only. Implementation verified in source: `withPartySummary` builds `PartyRef[]` (code + name) at read time from per-row `shipperId`/`consigneeId`, no persistence (ADR-047 d4); `ManifestItem` shared type gets `partySummary` for web consumption; validation rejects `shipperId`/`consigneeId`/`agentId` on `billIds` path (400 with ADR-cited message), legacy path unchanged. Test coverage: multi-party consolidation (201) + distinct `partySummary` assertion, unknown party ref → 400, legacy path still 201, header-vs-row rules covered. Live counts: manifests 4→4, items 4→4, legacy 4 manifests + 3 B/Ls untouched. Note: `bills_of_lading` 29 → 35 (fixture leak pre-existing, not U3 — same `afterAll` gap), `MANIFEST` NumberingSequence 0→0.

Next: **P5-U4 — per-destination `MAN-{DEST}-{yymm}-#####` numbering via `NumberingService.allocateNumber`, legacy `MAN-YYMM-#####` immutable** (roadmap Test 4, Acceptance 3; ADR-047 d7).

**Consolidation decision (decision-maker, 2026-10-06):** remaining roadmap re-split for fewer round-trips, using real dependency/risk boundaries — **P5-U5** unchanged (UI consolidation flow + doc hook + phase closure, 1 unit); **Phase 6 = 3 units** (U1 design/ADR — VAT policy, job-linking cardinality, VoucherAllocation + GeneralJournal model, numbering defaults, ledger derivation; U2 backend all of it + the two risky migrations with before/after totals verification; U3 UI five changes + closure); **Phase 7 = 3 units** (U1 design/ADR — template versioning/active-selection, stamp behavior, archive immutability-vs-correction; U2 backend templates + PDF/Excel generation endpoints behind the Phase-4 document hook + attachments + archive + tests; U3 UI + closure); **Phase 8 = 2 units** (U1 read models + Customer 360 + agent destination-scoping enforcement + report services + tests, ADR section written in-log as the unit's first deliverable — no separate design round-trip since no new business models; U2 UI + KPIs + exports + closure); **Phase 9 = 2 units** (U1 cross-module E2E + permission/security tests + migration verification; U2 UX layout/status presentation + UAT checklists + final closure). **Total remaining ≈ 11 execution round-trips.** Fixture-hygiene: manifest-spec sweep hardening folds into the P5-U4 finish (my U4 brief's no-accumulation requirement is currently unmet: 16 orphan MANIFEST sequence rows + spec leaks); remaining suite-wide fixture leaks (voyages/bills/sequences across other specs, same class as follow-ups g/i) get one bounded hygiene unit before Phase 9.

**Phase 5 Unit 4 — per-destination numbering COMPLETE (2026-10-06)** — HEAD `f98c264` + this unit. Roadmap §3 Phase 5 Test 4 + Acceptance 3 (ADR-047 d7) implemented: `manifest.service`'s private `generateReference()` (`MAN-YYMM-#####`, the read-then-write `findFirst`+`orderBy desc`+`slice`+`padStart` class U3 already removed from bills) is **deleted** and replaced by `allocateManifestNumber(destinationPortId)` → `NumberingService.allocateNumber` — verbatim bill pattern: `name manifest-{destinationPortId}-{yymm}`, `documentType MANIFEST`, `scopeType DESTINATION`, `scopeValue voyage.destinationPortId`, `prefix MAN-{DEST}-{yymm}-`, `padding 5`, `format '{prefix}{sequence}'`, `period YYYYMM`; `{DEST} = Port.abbreviation ?? code` (same rule as bills), 400 if the port is unknown. `NumberingService` injected into `ManifestService`'s constructor; `NumberingModule` is `@Global()` so no module change. **Both call-sites swapped** — consolidation (`:327`) and legacy (`:487`); both issue the SAME new shape (no forked legacy format), and rows are created lazily by `allocateNumber` (upsert under `SELECT ... FOR UPDATE`, ADR-008) — no pre-seeding, no invented sequence id. **Legacy data immutable**: no `UPDATE` touches `manifestNumber`, no backfill, no renumbering — live `MAN-2609-00001..00004` byte-identical before/after, and legacy+new coexist under `manifestNumber @unique` because the destination segment disambiguates (the collision-proofing U3 proved on bills). **Nested-transaction finding (recorded in log §4):** `allocateNumber` opens its OWN `$transaction` for the row lock, so it cannot run inside the consolidation transaction — allocation sits outside (matching bill.service/voyages.service); a number allocated then abandoned on a later failure leaves a **harmless gap, never a reuse** (the counter only moves forward), the same trade-off bills accepted in P4-U3. The outside-allocation path did **not** previously retry, so the **bill-pattern bounded retry** (`MAX_MANIFEST_ATTEMPTS = 10`, allocation inside the loop, P2002-on-`manifestNumber` → fresh number) was added to the consolidation path — verified by 2 new tests: a seeded `manifestNumber` collision recovers to `…-00002` (would 409 without the loop), and a post-allocation validation failure burns `00001` so the next create lands on `…-00002` (gap, not reuse). **Tests 397 → 403** (+6: abbreviation path, abbreviation-null→code fallback, per-destination independence — two destinations each at 00001, same destination 00001→00002, sequence-row `name`/`period YYYYMM`/`scopeType`/`scopeValue` assertions pinning the month-reset without time travel, plus the 2 retry/gap tests); **3 updated assertions** listed in the log (test title + 2 `toMatch(/^MAN-\d{4}-\d{5}$/)` → `/^MAN-.+-\d{4}-\d{5}$/`, `.+` because fixture codes themselves contain a dash). **Fixture sweep closed the 16-orphan incident (log §5, honest):** 16 orphan MANIFEST sequence rows were live at pickup (re-queried first: all 16 on deleted fixture ports, 0 live-scope) — deleted by the observed name filter. Root cause: the sweep was fed a hand-maintained name list covering only 3 of the 22 `POST /manifests` sites, so 19 sites' rows were silently skipped. Fixed by sweeping **by exact scope ids** (`documentType MANIFEST, scopeValue IN createdPorts`) — every one of the 22 sites numbers off a voyage destination port that is itself a suite fixture port, so the sweep now covers all 22 by construction (`in: []` matches nothing — never a wildcard). The full-run query still returned 3 orphans attributed by solo runs to `bill`/`delivery-release`/`party-cutover` (each also `POST /manifests`, and MANIFEST sequences are a **U4-introduced** row type none of them wrote pre-U4) — each got a **MANIFEST-only** scope-id sweep beside its existing BILL sweep; **their bill/voyage sweeps untouched**, no bill/voyage/manifest/port rows deleted (sequence rows only, explicit filters per the U2 rule). **Proven after 3 full runs: `MANIFEST rows=0 orphan=0`, legacy 4 byte-identical.** Battery (final): **403/403/0 ×3 (22/22)**, tsc api 0 / web exactly 3 pre-existing `[locale]/page.tsx` / shared 0, `CONTRACT GUARD OK 87 ⊆ 95` (no new `@Post`), `migrate status` **37 up to date** + shadow clean, curls api 200 / web 200 (307 locale redirect followed) — servers never started/stopped/restarted. **Migration: none, status stays 37** — d7 is purely behavioural (swaps which path writes the pre-existing `manifests.manifestNumber` column) and `NumberingSequence` rows are lazy, so there is nothing to migrate or seed. Live counts: manifests 4→4, items 4→4, `MANIFEST` seq 16 orphans → 0 → 0, `VOYAGE` 2676 + `BILL` 72 untouched. Porcelain: manifest.service, manifest.e2e, bill.e2e + delivery-release.e2e + party-cutover.e2e (MANIFEST sweep only), log, ledger — **apps/web 0**, `docs/decisions.md` untouched. Log: `implementation-log/2026-10-06-phase5-unit4-per-destination-numbering.md`.

Next: **P5-U5 — UI consolidation flow + document hook + Phase 5 closure** (roadmap Test 5 / Acceptance 4; final Phase 5 unit, closes the phase).

---

## current-plan/12-open-business-decisions.md

# 12 Open Business Decisions

> ## ⚠️ Superseded as the open-item register — cross-referenced 2026-10-11 (action **D5**)
>
> This file is retained as the record of an earlier planning round. **It is no longer the list of open
> questions.** Do not use it to decide what is still unresolved.
>
> | The authoritative open-item register | [../duna-analysis/09-audit/open-questions.md](../duna-analysis/09-audit/open-questions.md) |
> | --- | --- |
> | The master disposition of every question ID | [../duna-analysis/09-audit/question-reconciliation.md](../duna-analysis/09-audit/question-reconciliation.md) |
> | The settled product decisions | [../duna-analysis/09-audit/confirmed-decisions.md](../duna-analysis/09-audit/confirmed-decisions.md) |
>
> **Most items below have since been resolved** by confirmed design decisions. Nothing here has been deleted —
> the original text is preserved, with each item mapped to its current disposition.

### Disposition of §1.1–1.12 against the confirmed decisions

| § | Item | Disposition | Where |
| --- | --- | --- | --- |
| 1.1 | B/L lifecycle and release modelling | **Resolved**, except official status *names* | DEC-059…063 · remaining item **OQ-05** |
| 1.2 | Release Order approval and override policy | **Partially resolved** — three payment states confirmed; **approver identity still open** | Q-AUD-21 · remaining item **OQ-06** |
| 1.3 | Delivery Order eligibility rule | **Resolved** — discharged-at-facility scenario | Q-AUD-22 |
| 1.4 | Invoice auto-draft from B/L | **Resolved** — manual + configurable auto creation | Q-AUD-23 |
| 1.5 | Job creation trigger | **Resolved** — manual + configurable automatic | Q-AUD-23 · related **OQ-07** (ETOZ/ETDZ) |
| 1.6 | Party phone/email ownership | **Resolved** — per Shipper/Consignee/Agent | Q-AUD-24 · DEC-073…077 |
| 1.7 | VAT taxability, rates, report scope | **Partially resolved** — per-line VAT confirmed; **which services are taxable and at what rates still open** | Q-AUD-26 · DEC-100…104 |
| 1.8 | Invoice correction flow | **Resolved** — controlled correction workflows | Q-AUD-20 · DEC-019…023 |
| 1.9 | Notifications and alerts | **Resolved** — configurable triggers, in-app + email | Q-AUD-13/14 · DEC-056…058 |
| 1.10 | Archive retention and re-opening | **Resolved as design**; **retention periods still open** (compliance input) | Q-AUD-25 · remaining item **OQ-12** |
| 1.11 | Document template content and formats | **Still open** — official templates not supplied | Q-AUD-06 / SRC-07 · remaining item **OQ-08** |
| 1.12 | Agent extra capabilities | **Resolved** — portal is agents-only; destination-scoped B/L + Release visibility | Q-AUD-16 · DEC-073…077 |

**Note on §1.7 and §1.10.** Both are resolved *as architecture* but retain an open **business input**
(taxable services/rates; retention periods). They are configuration, not blockers: the mechanisms are built
with the values supplied later.

---

## 1. Decisions that affect implementation

### 1.1 B/L lifecycle and release modeling

Impact: B/L status fields, release field/concept, UI, and downstream ReleaseOrder integration.

Current state: target expects Draft, Final/Approved, and separate release permission, but exact status names and release modeling are not fully confirmed.

Can implementation proceed: yes, with configurable design and explicit decision record.

### 1.2 Release Order approval and override policy

Impact: ReleaseOrder eligibility, override fields, and audit trail.

Current state: no money, no cargo principle is confirmed; exact partial payment, credit, and approver rules are not confirmed.

Can implementation proceed: yes, with configurable eligibility and audit, without hard-coding final policy.

### 1.3 Delivery Order eligibility rule

Impact: DeliveryOrder creation rules.

Current state: not fully confirmed.

Can implementation proceed: yes, with independent eligibility design awaiting confirmation.

### 1.4 Invoice auto-draft from B/L

Impact: Invoice creation flow.

Current state: employer mentioned invoice from issued B/Ls, but exact automation level is not fully confirmed.

Can implementation proceed: yes, with manual and assisted flows supported.

### 1.5 Job creation trigger

Impact: when Jobs are created and by what event.

Current state: not fully confirmed.

Can implementation proceed: yes, with manual and optional automated creation.

### 1.6 Party phone/email ownership

Impact: Shipper/Consignee/Agent/Customer contact field design.

Current state: not fully confirmed.

Can implementation proceed: yes, with optional fields and no forced contact model.

### 1.7 VAT taxability, rates, and report scope

Impact: Invoice VAT defaults, VAT report scope.

Current state: per-line VAT is required; taxable services and rates are not confirmed.

Can implementation proceed: yes, with configurable VAT and no invented rates.

### 1.8 Invoice correction flow

Impact: invoice cancel/reissue vs credit note.

Current state: not confirmed.

Can implementation proceed: yes, with cancellation and audit trail, and a decision point for credit note later.

### 1.9 Notifications and alerts

Impact: alert system scope.

Current state: employer wants alerts for overdue and partial payment, but trigger list, channels, and templates are not confirmed.

Can implementation proceed: yes, with event hooks and minimal alerts, deferring full notification system.

### 1.10 Archive retention and re-opening

Impact: archive policy and immutability exceptions.

Current state: archive concept confirmed; retention and re-opening not confirmed.

Can implementation proceed: yes, with explicit archive metadata and configurable policy.

### 1.11 Document template content and formats

Impact: template upload and rendering.

Current state: company templates expected; exact content not confirmed.

Can implementation proceed: yes, with template support and no invented wording.

### 1.12 Agent extra capabilities

Impact: agent portal scope.

Current state: destination-scoped B/L and Release visibility confirmed; further capabilities not confirmed.

Can implementation proceed: yes, with locked minimum and explicit extension points.

## 2. Decisions that do not block Phase 2 start

- B/L/Manifest party cutover plan can be drafted without inventing final lifecycle wording.
- Voyage numbering approach can be finalized as per-destination with a technical format decision.
- Vessel type and tug/barge modeling can be implemented as a technical decision.

## 3. Decision record requirement

Every business decision that affects schema, API, or UI must be recorded in an implementation log or decision file before the affected work is marked complete.

---

## current-plan/README.md

# docs/current-plan/ — CURRENT AUTHORITATIVE PLANNING SET

This directory is the single source of truth for future implementation decisions on the Duna Shipping ERP.

## Authority hierarchy (highest to lowest)

1. Raw employer evidence under `/home/duna/dunaData/`, especially the complete transcript set under `transcripts/`.
2. Employer document reference `dunaData/shipping_documents_detailed_reference.md`.
3. Current implementation reality of `shipping-erp-new` (source code, Prisma schema, runtime behavior, test results).
4. Previous audit and planning documents under `docs/ai-audit/`, `docs/`, `docs-gap/`.
5. Legacy dashboard analysis under `docs-legacy/` as auxiliary historical/reference evidence only.

## What this directory contains

- `00-project-authority.md` — document hierarchy, source-of-truth rules, generation separation.
- `01-final-requirements.md` — reconciled employer requirements, classified confirmed/inferred/open.
- `02-target-system-blueprint.md` — target ERP/dashboard structure module by module.
- `03-final-workflows.md` — end-to-end operational/commercial/document/control workflows.
- `04-final-data-model.md` — target conceptual data model vs current Prisma schema.
- `05-final-api-blueprint.md` — target API structure and actions.
- `06-final-ui-blueprint.md` — target dashboard UI/information architecture.
- `07-document-and-reporting-blueprint.md` — documents, templates, output, archive, reports.
- `08-requirement-traceability.md` — employer evidence → requirement → target → phase.
- `09-final-implementation-roadmap.md` — authoritative implementation phases.
- `10-phase-execution-protocol.md` — how future Hermes execution sessions are selected, run, and reported.
- `11-implementation-state.md` — current phase, completed work, blockers, next approved task.
- `12-open-business-decisions.md` — unresolved employer questions and impact.

## Historical material (preserved, NOT authoritative for future work)

- `docs/` — earlier planning/implementation docs including old progress numbering.
- `docs-gap/` — earlier gap analysis.
- `docs-legacy/` — legacy employer dashboard analysis (reference only).
- `docs/ai-audit/` — previous reconciliation (valuable, but re-audited here).

## Rule

If there is a conflict between this directory and older planning documents, this directory wins. If there is a conflict between this directory and raw employer evidence, raw employer evidence wins.

---

## current-plan/party-cutover-evidence-pack.md

# Party-Model Cutover Evidence Pack (READ-ONLY)

**Task:** Phase 2 / B/L–Manifest party cutover — pre-planning evidence step
**Type:** read-only inventory — no code, schema, migration, API, UI or test changes
**Captured:** 2026-09-29, repo HEAD `2b89e38`, live DB `shipping_erp@127.0.0.1:5432`
**Method:** file reads with line numbers (`schema.prisma`, services/DTOs/controllers, pages, tests),
migration SQL greps, and read-only `information_schema` / `SELECT count(*)` queries via throwaway
Prisma scripts (scripts deleted afterwards; `git status` unchanged vs baseline).
**Citation format:** `path:line` (schema = `prisma/schema.prisma`), or "query" + verbatim result.
Every claim below is one of those two forms. No recommendations are included.

---

## 1. Schema inventory

### 1.1 Party master models (FK targets)

| Model | Table | Key fields | soft-delete | Citation |
|---|---|---|---|---|
| Customer | `Customer` (no `@@map`) | `code @unique`, `name`, `type String?` ("e.g. SHIPPER, CONSIGNEE, AGENT, FREIGHT_FORWARDER"), `taxId String?` | `deletedAt DateTime?` | schema `260-298` (type 265, taxId 271, deletedAt 278) |
| Shipper | `shippers` | `code @unique`, `name`, `taxId String?`, `isActive` | `deletedAt` | schema `306-326` (deletedAt 318, `@@map("shippers")` 323, `cargos Cargo[]` 325) |
| Consignee | `consignees` | same shape as Shipper | `deletedAt` | schema `328-348` (deletedAt 340, `@@map` 345, `cargos` 347) |
| Agent | `agents` | same shape + `destinations AgentDestination[]` | `deletedAt` | schema `350-370` (deletedAt 362, `@@map` 369) |
| AgentDestination | `agent_destinations` | `agentId`, `portId`, `@@unique([agentId, portId])` | `deletedAt` | schema `372-389` (FKs `onDelete: Cascade` 381-382) |

Schema comment defining the split: `Customer.type is deprecated for representing these external
parties` — schema `300-304`.

### 1.2 The 8 scope models — every party field

| Model (schema lines) | Party field | Type / nullability | Referenced model (relation line) |
|---|---|---|---|
| **Cargo** (`407-486`) | `customerId` | `String` — **required** (410) | `Customer` (451) |
| | `shipperId` | `String?` — nullable (418), comment "Phase 2: nullable party master refs" (416-417) | `Shipper?` (457) |
| | `consigneeId` | `String?` — nullable (419) | `Consignee?` (458) |
| | — | Cargo has **no** `agentId` / `notifyParty` | — |
| **Manifest** (`1092-1167`, `@@map("manifests")` 1166) | `shipperId` | `String?` — nullable (1105) | `Customer?` `@relation("ManifestShipper")` (1143) |
| | `consigneeId` | `String?` — nullable (1106) | `Customer?` (1144) |
| | `agentId` | `String?` — nullable (1107) | `Customer?` (1145) |
| | `notifyParty` | `String?` — **free text**, not an FK (1109) | — |
| | party comment | "Parties (legacy shipper/consignee/agent models -> unified Customer CRM)" | (1104) |
| **ManifestItem** (`1169-1197`) | **none** | — | — |
| **BillOfLading** (`1225-1297`, `@@map("bills_of_lading")` 1296) | `shipperId` | `String?` — nullable (1238) | `Customer?` `@relation("BillShipper")` (1275) |
| | `consigneeId` | `String?` — nullable (1239) | `Customer?` (1276) |
| | `notifyParty` | `String?` — free text (1240) | — |
| | party comment | "Parties (defaulted from the manifest, overridable per document)" | (1237) |
| | — | B/L has **no** `agentId` | — |
| **BillOfLadingItem** (`1299-1325`) | **none** | — | — |
| **LoadList** (`837-869`) | **none** | — | — |
| **ActualLoading** (`935-966`) | **none** | — | — |
| **Discharge** (`991-1017`) | **none** | — | — |

Item models also have no party fields: `LoadListItem` (`870`), `ActualLoadingItem` (`967`),
`DischargeItem` (`1018`) — awk block scan of those 6 model bodies for
`customer|shipper|consignee|agentId|notify` returned **0 matches** (query).

### 1.3 `deletedAt` / soft-delete interaction with those FKs

Columns present:

- Party parents carry `deletedAt`: Customer 278, Shipper 318, Consignee 340, Agent 362.
- Child scope models carrying `deletedAt`: Cargo 449, Manifest 1138, BillOfLading 1271,
  LoadList 850, ActualLoading 948, Discharge 1004 (schema line numbers).
- **No** `deletedAt` on `ManifestItem`, `BillOfLadingItem`, `LoadListItem`,
  `ActualLoadingItem`, `DischargeItem` (schema 1169-1197, 1299-1325; query on
  `information_schema.columns` for those 5 tables returned `(none)`).
- `Cargo` soft-deletes are child-side only; party FK values are unaffected by it.

FK delete rules (live `information_schema` query, verbatim):

```
Cargo.consigneeId -> consignees [ON DELETE SET NULL]
Cargo.customerId -> Customer [ON DELETE RESTRICT]
Cargo.shipperId -> shippers [ON DELETE SET NULL]
bills_of_lading.consigneeId -> Customer [ON DELETE SET NULL]
bills_of_lading.shipperId -> Customer [ON DELETE SET NULL]
manifests.agentId -> Customer [ON DELETE SET NULL]
manifests.consigneeId -> Customer [ON DELETE SET NULL]
manifests.shipperId -> Customer [ON DELETE SET NULL]
delivery_orders.recipientId -> Customer [ON DELETE SET NULL]
```

Consequence visible in the artifacts: **`SET NULL` fires only on hard `DELETE`** — soft-deleting a
Customer (`deletedAt`) does not clear any party FK. Code-side manifestations:

- `cargo.service.ts:321-326` — `validateRelations()` loads `customer.findUnique(...)` and throws
  `NotFound` when `!customer || customer.deletedAt` (write-time guard for the **required**
  `customerId` only; **no** equivalent check exists for `shipperId`/`consigneeId` — grep for
  `shipper|consignee` in `cargo.service.ts` returns only lines 66, 67, 182, 183, 242, 243).
- `delivery-release.service.ts:180-181` and `208-209` — recipient Customer checked
  `deletedAt: null` on create and update.
- Manifest/B/L relation reads have **no** `deletedAt` filter on the party relation:
  `manifest.service.ts:85-87` and `bill.service.ts:85-86` select
  `{ id, code, name, shortName }` unconditionally, so a soft-deleted Customer would still
  serialize its name.
- Child queries filter child-side `deletedAt`: `manifest.service.ts:156` (`deletedAt: null`),
  `bill.service.ts:144`, `cargo.service.ts:86`.

### 1.4 Migration/DB drift observed for Cargo party FKs

- `grep 'REFERENCES "shippers"|"consignees"|"agents"' prisma/migrations/*/migration.sql` →
  **no matches**; `grep 'shipperId|consigneeId' prisma/migrations/*/migration.sql` returns only
  `manifests`/`bills_of_lading` columns + FKs
  (`20260911224819_phase9_manifest/migration.sql:14,15,79,82,118,121,124`,
  `20260912130959_phase10_bills_of_lading/migration.sql:20,21,81,84,108,111`).
- Yet schema declares `Cargo.shipperId/consigneeId` (418-419, 457-458) and the **live DB has the
  columns + FKs** (query in §1.3 and §4.A). So `Cargo`'s master FKs exist in schema + live DB but
  in no migration file.

### 1.5 Related party references (context, outside the 8 models)

- `Customer` back-relations list the other consumers: `Invoice` 285, `Proforma` 286,
  `Quotation` 287, `Letter` 288, `Job` 289, `DeliveryOrder` 290, `Voucher` 291,
  `BookingRequest` (`@relation("BookingAgent")`) 292, portal `User[]` 293 (schema lines).
- Live FK query additionally returned: `invoices.customerId / proformas.customerId /
  quotations.customerId / vouchers.customerId / booking_requests.customerId` → Customer
  `ON DELETE RESTRICT`; `jobs.customerId / letters.customerId` → `ON DELETE SET NULL`.
- `delivery_orders.recipient` is `NOT NULL` free text; `delivery_orders.recipientId` nullable
  FK → Customer (information_schema query).

---

## 2. Code inventory

All party-field reads/writes found by `grep -rn 'shipperId|consigneeId|agentId|notifyParty'`
over `apps/api/src` (18 + 18 + 20 + 12 hits; agents-module hits are unrelated
`AgentDestination.agentId`). Grouped by module, with the value source stated.

### 2.1 Cargo (`apps/api/src/modules/cargo/`)

| File:line | Op | Who sets the value |
|---|---|---|
| `cargo.service.ts:60` | read — selects `customer {id,code,name,shortName}` | derived relation |
| `cargo.service.ts:66-67` | read — selects `shipperId`, `consigneeId` scalars in list+detail `select` | stored columns |
| `cargo.service.ts:116-117` | read — search OR-branches on `customer.name` / `customer.code` only (no shipper/consignee search) | query filter |
| `cargo.service.ts:182-183` | **write** — create: `shipperId: dto.shipperId ?? null`, `consigneeId: dto.consigneeId ?? null` | request payload, default `null` |
| `cargo.service.ts:210` + `321-341` | validate — `validateRelations(portId, customerId, yardId, destinationPortId)` on create/update; validates customer/port/yard/destination `deletedAt` (325, 332, 341); **no shipper/consignee validation** | derived from payload + `existing` |
| `cargo.service.ts:242-243` | **write** — update: `dto.shipperId ?? existing.shipperId` (same for consignee) | request payload, else previous value |
| `cargo.dto.ts:138-147` | DTO create: `shipperId?/consigneeId?: string`, `@IsOptional @IsString @MaxLength(40)` | — |
| `cargo.dto.ts:299-308` | DTO update: same shape | — |
| `cargo.controller.ts:31-33` / `43-45` | entry: `POST /cargo`, `PATCH /cargo/:id` pass DTO untouched | — |

### 2.2 Manifest (`apps/api/src/modules/manifest/`)

| File:line | Op | Who sets the value |
|---|---|---|
| `manifest.service.ts:56-59` | read — select scalars `shipperId/consigneeId/agentId/notifyParty` (list) | stored columns |
| `manifest.service.ts:85-87` | read — select relations `shipper/consignee/agent {id,code,name,shortName}` (list + detail) | derived relation |
| `manifest.service.ts:156` | read — list `where deletedAt: null` | — |
| `manifest.service.ts:259-262` | **write** — create: `shipperId/consigneeId/agentId/notifyParty` straight from `dto` | request payload (no default) |
| `manifest.service.ts:294-297` | **write** — update: `dto.X !== undefined ? { X: dto.X || null } : {}` (`''` clears to null) | request payload |
| `manifest.service.ts:318-324` | soft-delete: sets `deletedAt: new Date()` | — |
| `manifest.dto.ts:35-48` | DTO create: `@IsOptional @IsString`, descriptions "Shipper customer ID (legacy shipper)", "Consignee customer ID (legacy consignee)", "Agent customer ID (legacy agent)" | — |
| `manifest.dto.ts:50-54` | DTO create `notifyParty`: `@IsString @MaxLength(255)` "free text, legacy notify_party" | — |
| `manifest.dto.ts:105-125` | DTO update: `string \| null`, "null to clear" | — |
| `manifest.controller.ts:57-59` / `63-65` | entry: `POST /manifests`, `PATCH /manifests/:id` | — |

No existence check for shipper/consignee/agent IDs anywhere in this module: grep for
`customer.findUnique|shipper.findUnique|consignee.findUnique|agent.findUnique` in
manifest/bill/cargo returned only `cargo.service.ts:321` (customer).

### 2.3 Bill of Lading (`apps/api/src/modules/bill/`)

| File:line | Op | Who sets the value |
|---|---|---|
| `bill.service.ts:58-60` | read — select scalars (list) | stored columns |
| `bill.service.ts:85-86` | read — select relations `shipper/consignee {id,code,name,shortName}` | derived relation |
| `bill.service.ts:149-150` | read — list filters `query.shipperId ? { shipperId: ... }` and same for consignee | query params |
| `bill.service.ts:165` | read — search OR-branch `notifyParty contains` (case-insensitive) | query param |
| `bill.service.ts:219-221` | read — create fetches manifest with `shipperId/consigneeId/notifyParty` | source for derivation |
| `bill.service.ts:244-246` | **write** — create: `shipperId: dto.shipperId ?? manifest.shipperId`, `consigneeId: dto.consigneeId ?? manifest.consigneeId`, `notifyParty: dto.notifyParty ?? manifest.notifyParty` | **derived from the manifest**, overridable by payload |
| `bill.service.ts:286-288` | **write** — update (DRAFT only, `assertEditable` 280): `dto.X !== undefined ? { X: dto.X \|\| null } : {}` | request payload |
| `bill.dto.ts:43-57` | DTO create: descriptions "defaults from the manifest"; `notifyParty @MaxLength(255)` "free text on the printed document" | — |
| `bill.dto.ts:127-142` | DTO update: `string \| null`, "null to clear" | — |
| `bill.dto.ts:343-352` | List filters `shipperId?`, `consigneeId?` | — |
| `bill.controller.ts:54-56` / `60-62` | entry: `POST /bills`, `PATCH /bills/:id` | — |

Error mapping for bad IDs: `manifest.service.ts:270-275` and `bill.service.ts:261-268` catch
`P2002 || P2018` → `409` with message "duplicate reference"; the global filter maps
`P2003/P2014/P2018 → 400` (`http-exception.filter.ts:76-88`).

### 2.4 Related modules touched by party values

| File:line | Op | Who sets the value |
|---|---|---|
| `delivery-release.service.ts:174` | D/O create DTO: `recipient: string; recipientId?: string` | request payload |
| `delivery-release.service.ts:179-188` | create: validates `recipientId` Customer `deletedAt: null` (180-181) → writes `recipient` text + `recipientId ?? null` | payload |
| `delivery-release.service.ts:199-211` | update: same re-validation (208-209), `disconnect`/`connect` for `recipientCustomer` (211) | payload |
| `delivery-release.service.ts:112,119-130` | serialize: `recipient` + `recipientCustomer {id,name}` | derived |
| `portal.service.ts:142` | read — count manifests `where agentId: customerId` | derived from JWT portal customer |
| `portal.service.ts:288-292` | read — list manifests `where agentId: customerId`, `customerId = await this.portalCustomerIdOf(actor)` (288) | **derived from actor**, not payload |

`load-planning`, `actual-loading`, `discharge` modules: grep for
`shipperId|consigneeId|agentId|notifyParty` across their services+DTOs → **ALL ZERO** (query).

### 2.5 Modules exposing the new masters

`apps/api/src/modules/shippers/`, `consignees/`, `agents/` exist (directory listing) with
`agents.service.ts` performing CRUD on `AgentDestination` (lines 159-230, `agentId` scoping).
Neither `manifest`, `bill` nor `cargo` imports/references these modules (no hits in §2.1-2.3).

---

## 3. Document inventory (party names in generated documents/reports)

**No dedicated template/PDF files exist.** `find apps/web/src -name '*.tsx' | grep -iE
'bill|manifest|delivery|release|print|document'` → only the 4 page files below;
`grep -rln 'window.print|@media print' apps/web/src` → only `ledger/page.tsx` (unrelated to
parties). Documents are therefore rendered as on-screen detail/list views:

| View | Field source | Citation |
|---|---|---|
| **B/L list** — column header `fields.consignee`; cell renders `b.consignee?.name ?? b.notifyParty ?? '—'` | API `bill.service.ts:85-86` (Customer relation) with free-text fallback | `apps/web/src/app/[locale]/(dashboard)/bills/page.tsx:507`, `:535` |
| **B/L create form** — party input = `notifyParty` free text only (`fields.notifyParty`); payload sends `notifyParty` only | payload `bills/page.tsx:228`; input `:698-701` | — |
| **B/L detail header editor** — editable `notifyParty`; **no shipper/consignee/agent editor** | PATCH payload `bills/page.tsx:291`; inputs `:882-887`; grep for shipper display in this file returns no display row (only `shipperCost`-free hits at 507/535 for consignee) | — |
| **Manifest detail dialog** — `detail.shipper?.name ?? '—'`, `detail.consignee?.name ?? '—'`, `detail.agent?.name ?? '—'`, `detail.notifyParty ?? '—'` | API `manifest.service.ts:85-87` | `manifest/page.tsx:939`, `:963`, `:987`, `:1004` |
| **Manifest create form payload** | `manifest/page.tsx:212-215` (`shipperId/consigneeId/agentId/notifyParty` from form) | inputs `:718-730`, `:736-748`, `:754-764`, `:770-775` |
| **Manifest header editor (DRAFT)** | PATCH payload `manifest/page.tsx:285-288` | selects `:926-930`, `:950-954`, `:974-978`; notify `:992-1000` |
| **Manifest list** — party columns absent: headers are No/Voyage/Route/Status/Items/TotalWeight/Created/Actions | — | `manifest/page.tsx:576-583` |
| **D/O list cell + detail** — `d.recipient` / `detail.recipient` (free text) | API `delivery-release.service.ts:119,130` | `delivery-orders/page.tsx:219`, `:268-270`, `:293-294` |
| **R/O page** — no recipient/party rendering (grep `recipient` → empty) | — | `release-orders/page.tsx` |

Note (factual): `shipperCost` at `manifest/page.tsx:1015` is a **cost** label, not a party.

---

## 4. Data inventory (live DB, 2026-09-29)

### 4.1 Scope tables: party columns present (information_schema query)

```
Cargo.consigneeId / Cargo.customerId / Cargo.shipperId
bills_of_lading.consigneeId / bills_of_lading.notifyParty / bills_of_lading.shipperId
manifests.agentId / manifests.consigneeId / manifests.notifyParty / manifests.shipperId
```
Only `deletedAt` (no party column) on: `ActualLoading`, `Discharge`, `LoadList`, `Customer`
(+ masters `agents/consignees/shippers`). Live table names: `Cargo`, `LoadList`,
`ActualLoading`, `Discharge`, `manifests`, `manifest_items`, `bills_of_lading`,
`bills_of_lading_items` (information_schema query) — `LoadList/ActualLoading/Discharge` and all
item tables contain **zero** party columns.

### 4.2 Counts of non-null party references (SQL `count(*)` per table)

| Table | rows | shipperId | consigneeId | agentId | notifyParty | customerId |
|---|---|---|---|---|---|---|
| `Cargo` | 33 | **0** | **0** | n/a | n/a | 33 |
| `manifests` | 4 | **4** | **3** | **1** | **2** | n/a |
| `bills_of_lading` | 2 | **2** | **2** | n/a (no column) | **2** | n/a |

Row-level detail (query):

```
MAN-2609-00001 shipper=cmtxnljlw… (AL Co 1ek25e) consignee=cmtxnbsrv… (AL Co 46tyen) agent=null notify="Bushehr Cargo Agency"
MAN-2609-00002 shipper=same                          consignee=same                  agent=null notify="Khalifa Shipping Co"
MAN-2609-00003 shipper=same                          consignee=null                  agent=null notify=null
MAN-2609-00004 shipper=same                          consignee=same                  agent=cmu0hfma… (Meridian Freight Co. (Portal Demo)) notify=null
BOL-2609-00001 shipper=same consignee=same notify="Bushehr Cargo Agency"
BOL-2609-00002 shipper=same consignee=same notify="Bushehr Cargo Agency"
```
All 6 rows: `deletedAt IS NULL`. Soft-deleted counts: `Cargo 0/33`, `manifests 0/4`,
`bills_of_lading 0/2` (query).

### 4.3 Match rate against the new masters — heuristic stated

**Heuristic (stated as required):** primary = normalized **name** equality
`lower(trim(master.name)) = lower(trim(Customer.name))`; fallback = **taxId** equality when both
sides non-null; additionally checked = **code-suffix** equality (segment after the last `-`).
Master side restricted to `deletedAt IS NULL`.

SQL shape used (per pair):
`JOIN "Customer" c ON c.id = t."<col>" LEFT JOIN "<master>" m ON m."deletedAt" IS NULL AND lower(trim(m.name))=lower(trim(c.name)) …`

| Reference | refs | matched by name | matched by taxId only |
|---|---|---|---|
| `manifests.shipperId` → Shipper | 4 | **0** | 0 |
| `manifests.consigneeId` → Consignee | 3 | **0** | 0 |
| `manifests.agentId` → Agent | 1 | **0** | 0 |
| `bills_of_lading.shipperId` → Shipper | 2 | **0** | 0 |
| `bills_of_lading.consigneeId` → Consignee | 2 | **0** | 0 |

- **taxId fallback is unobservable:** `SELECT count("taxId") FROM "Customer"` →
  `{total: 30, live: 29, with_taxid: 0}` — no Customer carries a taxId.
- **Code-suffix check:** only `Customer T3A-001` ↔ `Agent AGT-001` matched, and `T3A-001` is
  **not** among the 3 referenced parties (query).
- Distinct Customers actually referenced by manifest/B-L parties: **3** (query):
  `AL Co 46tyen` (code `ALCUS-46TYEN`, type `SHIPPER`),
  `AL Co 1ek25e` (code `ALCUS-1EK25E`, type `CONSIGNEE`),
  `Meridian Freight Co. (Portal Demo)` (code `AGT-P20DEMO`, type `AGENT`) — all `taxId=null`,
  all live.
- Customer type distribution (live): `SHIPPER 26, AGENT 1, CONSIGNEE 1, FORWARDER 1`
  (`SELECT type, count(*) FROM "Customer" WHERE "deletedAt" IS NULL GROUP BY type`).

### 4.4 Reverse orphans (masters ↔ references)

Master inventory (query):

| Master | total | live | soft-deleted | referenced by any `Cargo` row |
|---|---|---|---|---|
| `shippers` | **0** | 0 | 0 | 0 |
| `consignees` | **0** | 0 | 0 | 0 |
| `agents` | **1** | 1 | 0 | **0** |

- The single Agent master is `AGT-001 "Arash alidadi"`, `taxId 34234234234`, active.
- Every `Cargo.shipperId/consigneeId` is NULL (§4.2), so **no** master row is referenced by any
  document — the 1 Agent master is an unreferenced (reverse-orphan) record.
- Name overlap between masters and Customer (dedup candidates):
  `shippers ∩ consignees = (none)`, `shippers ∩ Customer = (none)` (INTERSECT queries).
- Zero party FKs point at a soft-deleted parent today:
  `live manifests → soft-deleted Customer shipper: 0`,
  `live bills → soft-deleted Customer consignee: 0` (query).
- `notifyParty` free-text values in use: `"Khalifa Shipping Co"`, `"Bushehr Cargo Agency"`
  (DISTINCT query) — neither matches any master (masters: 0 shippers/consignees, agent name
  `Arash alidadi`).

### 4.5 Migration-vs-DB note for Cargo FKs

See §1.4: `Cargo.shipperId/consigneeId` columns + FKs exist live (query) but no file under
`prisma/migrations/` creates them (grep, zero matches for `REFERENCES "shippers"|"consignees"`).

---

## 5. UI inventory (form fields writing party references)

| Page | Field(s) writing party refs | Option source | Citation |
|---|---|---|---|
| **Manifest** create dialog | `mf-shipper` select → `createForm.shipperId`; `mf-consignee` → `consigneeId`; `mf-agent` → `agentId`; notify-party text input | **`customers`** — `api.get('/customers?pageSize=100')`; all three selects `customers.map((c) => …)`, placeholder option text `create.selectCustomer` | fetch `manifest/page.tsx:186`; selects `:718-730`, `:736-748`, `:754-764` (placeholder `:724`, `:742`, `:760`); payload `:212-215` |
| **Manifest** header editor (DRAFT) | `headerDraft.shipperId/consigneeId/agentId/notifyParty` → `PATCH /manifests/:id` | same `customers` state (no other party endpoint is fetched on this page) | values `:926`, `:950`, `:974`, `:998`; payload `:285-288` |
| **B/L** create dialog | **no party select** — only `notifyParty` free-text `Input` | n/a | input `bills/page.tsx:698-703`; payload `:228` sends only `notifyParty` |
| **B/L** header editor | `notifyParty` only — no shipper/consignee/agent editor | n/a | `:882-887`; payload `:291` |
| **B/L** list | renders `b.consignee?.name ?? b.notifyParty` (read-only) | API-derived | `:507`, `:535` |
| **Cargo** create/edit | **no shipper/consignee field at all** | n/a | grep `shipperId\|consigneeId\|/shippers\|/consignees` in `cargo/page.tsx` → only `:189` (`/customers`, i.e. the required `customerId`) |
| **Delivery Orders** | `recipient` free-text `Input` (required client-side) — no `recipientId`/Customer select | n/a | `delivery-orders/page.tsx:268-270`, validation `:102`, payload `:108` |

Cross-checks:

- None of the three pages (`manifest`, `bills`, `cargo`) fetches `/shippers`, `/consignees` or
  `/agents` (their only party endpoint is `/customers`, at `manifest:186`, `bills:194`,
  `cargo:189`).
- `bills/page.tsx` declares `customers` state (`:129`) and fetches it (`:194`) but never renders
  it — grep `customers` returns only those 2 lines.
- Master CRUD pages exist in the tree as untracked dirs:
  `apps/web/src/app/[locale]/(dashboard)/{shippers,consignees,agents}/` (git status) — not
  referenced by the B/L, Manifest or Cargo pages (grep above).

---

## 6. Test inventory (tests asserting current party behaviour)

### 6.1 Tests that pass **Customer** IDs into party fields (directly encode current wiring)

| Test | Line(s) | Assertion / action |
|---|---|---|
| `apps/api/test/manifest.e2e-spec.ts` | `510-523` | `it('update (header) works in DRAFT only; shipper/consignee set; unknown manifest 404')` — sends `shipperId: customerId` (`:515`), asserts `upd.body.data.shipperId === customerId` (`:522`), `notifyParty === 'MF Notify'` (`:523`) |
| `apps/api/test/bill.e2e-spec.ts` | `322` | fixture manifest created with `shipperId: customerId` |
| `apps/api/test/bill.e2e-spec.ts` | `502-503` | comment "Parties default from the manifest"; `expect(created.shipperId).toBe(customerId)` |
| `apps/api/test/bill.e2e-spec.ts` | `645-657` | header PATCH with `notifyParty: 'BL Notify'` (free text round-trip) |
| `apps/api/test/delivery-release.e2e-spec.ts` | `151-153` | fixture manifest `shipperId: customerId` |
| `apps/api/test/portal.e2e-spec.ts` | `83`, `97`, `109` | manifest fixtures with `agentId: custA.id / custB.id` (Customer IDs); comment "only the agentId scoping matters here" (`:83`) |

### 6.2 Tests that already use the **new masters** (encode the target wiring for Cargo)

| Test | Line(s) | Assertion / action |
|---|---|---|
| `apps/api/test/cargo-inventory.e2e-spec.ts` | `27-30` | comment: "Cargo.shipperId / Cargo.consigneeId are FKs to the Phase 2 party masters (shippers / consignees tables), NOT to Customer." |
| same | `85-102` | fixture `shipper.create` / `consignee.create` **via PrismaClient**; comment `:85-88` claims `POST /shippers` returns 403 because shipper:* permissions are missing — **stale claim**: `SELECT code FROM Permission WHERE code LIKE 'shipper:%'` → `shipper:read, shipper:create, shipper:update, shipper:delete` (likewise `consignee:*`, `agent:*` exist; seeded by `scripts/seed-phase2-permissions.cjs`, file present) |
| same | `146-149` | cleanup deletes created shippers/consignees |
| same | `330-331` | create cargo with `shipperId/consigneeId` = master IDs |
| same | `349-350` | `expect(d.shipperId).toBe(createdShippers[0].id)` / consignee same |
| same | `357-369` | `it('returns null for omitted Phase 3A party/financial fields')` — `shipperId/consigneeId` null when omitted |
| same | `401-409` | update cargo with master IDs → echoed back |

### 6.3 Test coverage gaps (facts)

- No web/UI tests at all: `find apps/web -name '*.test.*' -o -name '*.spec.*'` → empty.
- No dedicated e2e file for the new masters: `ls apps/api/test | grep -iE
  'shipper|consignee|agent|party'` → empty.
- `manifest.e2e-spec.ts` sets party IDs only on **update** (`:515`), never on create — grep for
  `shipperId|consigneeId|agentId` in that file returns only `:515` and `:522`.
- B/L party derivation is asserted only for `shipperId` (`bill.e2e-spec.ts:502-503`); no
  assertion covers `consigneeId` derivation (grep for `consigneeId` in `bill.e2e-spec.ts` → no
  hits).

### 6.4 Which assertions encode the Customer→party wiring (would be touched by a cutover)

Facts only, grouped by what they pin:

- **Manifest.shipperId = Customer**: `manifest.e2e-spec.ts:515,522`.
- **Manifest/B-L shipper derived through Customer**: `bill.e2e-spec.ts:322,502-503`,
  `delivery-release.e2e-spec.ts:151-153`.
- **Manifest.agentId = Customer (portal scoping)**: `portal.e2e-spec.ts:83,97,109`.
- **Cargo.shipperId/consigneeId = masters**: `cargo-inventory.e2e-spec.ts:330-331,349-350,
  357-369,401-409` (these already target the masters and would be unaffected by a
  Manifest/B-L-side retargeting).
- **Free-text notifyParty/recipient** (no FK): `bill.e2e-spec.ts:645-657`,
  `manifest.e2e-spec.ts:516,523`, D/O recipient input `delivery-orders/page.tsx:102,108`.

---

## Appendix — reproduction queries

Run read-only via `PrismaClient.$queryRawUnsafe` against `shipping_erp` (scripts deleted after use):

1. Party FK map: `information_schema.table_constraints` ⋈ `key_column_usage` ⋈
   `constraint_column_usage` ⋈ `referential_constraints` filtered on
   `column_name IN ('shipperId','consigneeId','agentId','customerId','recipientId')`.
2. Nullability: `information_schema.columns` for the same columns.
3. Counts: `SELECT count(*), count("shipperId"), … FROM "<table>"` per table (§4.2).
4. Match heuristic: `JOIN "Customer" c ON c.id=t."<col>" LEFT JOIN "<master>" m ON
   m."deletedAt" IS NULL AND lower(trim(m.name))=lower(trim(c.name))` (+ `m2` taxId join +
   `split_part(code,'-',…)` suffix join).
5. Orphans: `count(*) FILTER (WHERE "deletedAt" IS NULL)` per master +
   `EXISTS (SELECT 1 FROM "Cargo" c WHERE c."shipperId" = m.id)`.

---

## current-plan/party-cutover-plan.md

# Phase 2 — B/L/Manifest Party Reference Cutover Plan

Status: APPROVED (decision-maker) — **EXECUTED**: task-unit 0 (portal agent linkage) and task-unit 1 (cutover) both COMPLETE; logs `implementation-log/phase-2-portal-agent-linkage.md` and `implementation-log/phase-2-party-cutover.md` (ends `EXECUTION_STATUS: COMPLETE`, `UI_GATE: PASS`). Independently re-verified 2026-09-30: migration 31 up to date, live FKs → masters, suite 307/232/75 = baseline, UI gate re-checked. §8 item 2 (decision-maker review + state update) — state recorded in `11-implementation-state.md`.
Followed by: one Hermes implementation task per task-unit below, in order.
Post-completion follow-ups (decision-maker approved 2026-09-30): i18n gaps, portal fallback-shim
removal, migration-replay completeness — all executed and verified; see
`implementation-log/phase-2-followups.md`.

## 0. Decision basis (from evidence pack)

- Manifest + B/L party FKs → `Customer` (all nullable, SET NULL) [§1, §4.2].
- Cargo party FKs → masters already, but exist in **no migration file** [§1.4, §4.5].
- Live party data: manifests 4/3/1, bills 2/2, Cargo 0/33 [§4.2]. **0 of 12 Customer party refs
  match any master** under any stated heuristic; no Customer carries a taxId [§4.3].
- Masters: 0 shippers, 0 consignees, 1 unreferenced Agent [§4.4]. Zero soft-deleted parents referenced [§4.4].
- B/L parties are **derived from the Manifest** in code [§2]; B/L UI has no party selects [§5].
- All party selects in UI read `/customers` [§5].
- 6 tests pin Customer wiring; 8 already pin Cargo→masters [§6].

## 1. Target state (from 04-final-data-model + locked decisions)

- `Manifest.shipperId → Shipper`, `consigneeId → Consignee`, `agentId → Agent` (nullable, SET NULL).
- `BillOfLading.shipperId → Shipper`, `consigneeId → Consignee` (nullable, SET NULL) — **still derived
  from the Manifest at creation; direct FK kept for query/display**.
- `Cargo` unchanged (already on masters). `Cargo.customerId` (required) remains the commercial
  counterparty per schema comment [schema.prisma:417].
- `notifyParty` stays free text (manifests + B/L) for this phase; structured notify ref is deferred.
- `Customer` model and its commercial role are NOT removed or reduced in this phase.
- Existing numbers/rows: no voyage/manifest/B-L numbers change. Party values on existing live rows
  (4 manifests / 2 B-Ls referencing 3 Customers) **cannot be remapped** (0 matches) → those FKs are
  nulled by the migration; rows keep their free-text notifyParty and remain valid. This is the
  documented, accepted data consequence of greenfield cutover.

## 2. Migration (single migration, additive + repoint, non-destructive)

1. Drop old Manifest/B-L party FK constraints (SET NULL to Customer); keep columns.
2. Add new FKs to `shippers`/`consignees`/`agents` (ON DELETE SET NULL ON UPDATE CASCADE), Prisma naming.
3. `UPDATE manifests SET "shipperId"=NULL, "consigneeId"=NULL, "agentId"=NULL;` and same for
   `bills_of_lading` (safe: 6 rows, soft-delete-none). Explicit, commented, idempotent-safe.
4. **Declare the missing Cargo party FKs/columns in a migration file** (closes evidence §1.4 gap):
   `CREATE COLUMN IF NOT EXISTS`-style guarded statements matching schema.prisma:457-458 so a fresh
   replay produces a complete schema.
5. Schema.prisma updated to match. `migrate status` before/after in the log. No `db push`.

## 3. API changes

- `manifests` DTO + service: `shipperId` must reference a live Shipper (existence check like Cargo's
  customerId check [§2]); same for consignee/agent. P2002/foreign-key violations → 400/409 with
  clear messages.
- `bills` service: creation derives shipper/consignee from the Manifest (unchanged logic), now
  reading master IDs from the manifest; existence of manifest parties is asserted at B/L creation.
- **Portal agent scoping — decision-maker addendum (2026-09-29):** portal currently scopes
  manifests by `User.portalCustomerId` (a Customer id) compared to `manifests.agentId`
  (portal.service.ts:142,292) — contradicted by code reality during pre-flight. DECISION: add
  `User.portalAgentId` (nullable, unique) FK → Agent master; portal scoping switches to the Agent
  id; `portalCustomerId` column RETAINED (no destructive change) but no longer used for manifest
  scoping. Executed as a SEPARATE task-unit BEFORE this cutover unit; this unit then proceeds as
  specified. Portal seed/fixtures update in that unit.
- No new routes; no permission changes (reuse existing manifest:*/bill:* codes).

## 4. UI changes

- Manifest create dialog + DRAFT header editor: shipper/consignee/agent selects switch from
  `/customers` to `/shippers`, `/consignees`, `/agents` (pageSize=100, live-only), localized
  placeholders (drop `selectCustomer` wording for these three fields).
- B/L page: unchanged (no party selects; derived display stays).
- Cargo page: unchanged.
- en/fa/ar keys updated where labels/placeholder text change.

## 5. Tests

- Update the 6 Customer-pinning tests [§6] to the master-based wiring.
- Add: manifest create with master refs (201 + echo); unknown master id → 400; B/L create derives
  parties from manifest's master refs; soft-deleted master → rejected/SET NULL behavior test.
- Cargo master-pinning tests (8) must stay green. No new failures elsewhere.

## 6. Verification + gates

- `prisma validate`, `migrate status` (before/after), API+web tsc, chunked per-package tests,
  live API checks (manifest create with masters, B/L derivation, unknown-id rejection).
- **UI gate §3.1 (mandatory):** manifest create via UI using master selects (create a fixture
  shipper+consignee first), verify persisted values, verify B/L created from that manifest shows
  the derived parties; fa spot-check; 0 console errors. PASS/FAIL + evidence in log.
- Fixtures deleted after checks.

## 7. Out of scope

- B/L release status/revision model; ManifestItem→B/LItem; Manifest date fields; document/print
  templates; structured notifyParty; Customer deprecation; Cargo logic changes; portal scope;
  invoice/voucher/ledger; numbering.

## 8. Task split (sequential Hermes tasks)

0. **Portal agent linkage (DECISION-MAKER ADDENDUM 2026-09-29, executes FIRST):** add
   `User.portalAgentId` FK → Agent; portal manifest scoping (dashboard count + shipments list)
   switches to the Agent id; seed idempotently links the demo portal user to the demo Agent
   master; portal fixtures updated to Agent-master ids. **FK reality (verified):**
   `manifests.agentId` HAS a FK constraint to Customer today (schema.prisma:1145), so the linkage
   unit CANNOT write an Agent-master id into a manifest.agentId. Therefore: linkage unit sets
   `User.portalAgentId` = demo Agent-master id and switches the two scoping queries to it; the
   demo seeded manifest temporarily keeps agentId = Customer id and the portal's pre-cutover
   scoping tests that assert via the OLD path are updated in the CUTOVER unit (which nulls
   manifest agentIds and re-seeds the demo manifest with the Agent-master id). Interim acceptance
   for the linkage unit: portal suite green under the updated wiring (no Customer-agent FK
   violation), dashboard/shipments queries use portalAgentId, demo user sees their shipment list
   in the UI (gate §3.1 applies — portal has a UI).
1. **Cutover implementation** — sections 2–6 above, one task, one log:
   `implementation-log/phase-2-party-cutover.md` (resumed; pre-flight evidence already recorded —
   do not redo the survey; STOP-rule count re-check still required).
2. Review + state update by decision-maker; UI gate verdict recorded.

## 9. Mechanical notes for the cutover unit (recorded by Hermes at stop)

- On repoint, drop the shortName selects/types: manifest.service.ts:85-87, bill.service.ts:85-86,
  shared manifest.ts:71-73, bill.ts:72-73/208-209.
- Migration must ALSO declare `shippers`/`consignees`/`agents` tables guarded (they exist in no
  migration file — wider replay gap than evidence §1.4) for fresh-replay completeness.

