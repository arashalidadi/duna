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
