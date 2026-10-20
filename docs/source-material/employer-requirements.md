# Employer requirements — source material

The employer’s own statements, the verbatim meeting transcripts, the requirements catalogue, glossary and open questions. This is evidence, not specification: `docs/business-requirements.md` is the derived specification.

> Merged from 27 files on 2026-10-20. Every original document appears below in full, under a heading naming its former path.

---

## duna-analysis/01-employer-statements/business-processes.md

# Business Processes — End-to-End

> **Purpose:** The operational and commercial processes as the employer describes them, in sequence.
> Each step names the requirement IDs that apply and the source statements it is built from.
>
> This is the employer's *as-described* process. Where the current system diverges, see
> [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).

---

## Process A — Standard marine movement (Duna's core business)

The flow the employer narrates from `EMP-001` to `EMP-053`.

```
A1  Customer exists                       (REQ-011 – REQ-014, REQ-018)
A2  Cargo arrives at a port / yard        (REQ-060 – REQ-064, REQ-069)
A3  Yard inventory updated                (REQ-035, REQ-036)
A4  Customs documents prepared            (REQ-063)
A5  Inspection booked & performed         (REQ-080, REQ-081)
A6  Destination filter → vessel decision  (REQ-094)
A7  Load List built & printed             (REQ-090, REQ-091, REQ-082 gate)
A8  Load List amended next day if needed  (REQ-092)
A9  Operators load; results recorded      (REQ-070 loading date)
A10 Unloaded cargo returns to yard        (REQ-093)
A11 Bill of Lading drafted                (REQ-100, REQ-101, REQ-104)
A12 B/L sent to customer for review       (REQ-105)
A13 B/L finalised                         (REQ-104)
A14 Manifest consolidated                 (REQ-110 – REQ-112)
A15 Manifest printed+stamped for captain  (REQ-113, REQ-122)
A16 Manifest PDF to destination agent     (REQ-113)
A17 Invoices generated                    (REQ-140, REQ-141)
A18 Invoice posted as Debit               (REQ-150)
A19 Vessel sails, reaches destination     —
A20 Discharge at destination              —
A21 Customer pays (full / partial / none) (REQ-149, REQ-163 – REQ-165)
A22 Release Order issued                  (REQ-180 – REQ-182)
A23 Agent sees release, hands documents   (REQ-187)
A24 Unpaid release → alert                (REQ-184)
```

### Notes on Process A

- **A6 is a management decision, not a system action.** The employer describes himself looking at
  counts per destination and choosing where to send the vessel (`EMP-094`–`EMP-097`). The system's
  job is to make those counts available.
- **A9 → A10 is the only "undo" in the flow.** Cargo planned for a vessel but not loaded must return
  to inventory, not disappear (`EMP-534`–`EMP-537`).
- **A11 precedes A14.** B/Ls first, then the manifest consolidates them (`EMP-024`–`EMP-027`,
  `EMP-567`, `EMP-568`). This ordering matters: it is the opposite of the legacy Laravel system
  (see `../03-legacy-laravel-system/workflows.md`).
- **A17 is triggered by issued B/Ls**, not by the manifest (`EMP-608`, `EMP-623`, `REQ-140`).

---

## Process B — ETOZ / ETDZ (end-to-end handling)

From `EMP-054`–`EMP-067`, `EMP-403`–`EMP-408`, `EMP-411`–`EMP-414`, `EMP-603`–`EMP-605`.

```
B1  Customer instructs Duna (often by phone only)      (REQ-018)
B2  Job opened; Job Number assigned                    (REQ-130, REQ-135)
B3  Goods collected at origin (e.g. Australia / China) (REQ-020)
B4  Shipped to a UAE port (e.g. Jebel Ali)             —
B5  Customs clearance paid & performed                 (REQ-132)
B6  Low-bed / inland transport to loading port         (REQ-132)
B7  Repair or mechanical work if needed                (REQ-132)
B8  Every cost noted against the Job Number            (REQ-133)
    ↳ ad-hoc facts also written into the Cargo Comment (REQ-065 – REQ-067)
B9  Storage accrues while waiting                      (REQ-070)
B10 Continue with Process A from A5 onward             —
B11 Invoice drafted and matched against Job Numbers    (REQ-134, REQ-141)
B12 Invoice issued to the Customer (not the document
    parties)                                           (REQ-018, EMP-415 – EMP-421)
```

### Notes on Process B

- **B2 and B8 are the whole point of the Job Number.** Expenses are irregular and spread over weeks
  or months; the accountant must be able to reconstruct the spend stage by stage
  (`EMP-064`, `EMP-065`, `EMP-176`–`EMP-178`).
- **B12:** the invoice is issued to the *internal customer* even though the B/L names different
  parties (`EMP-415`–`EMP-421`). This is the clearest practical consequence of `REQ-018`.

---

## Process C — Inbound cargo and Delivery Order

From `EMP-162`, `EMP-163`, `EMP-665`–`EMP-672`.

```
C1  Inbound cargo arrives and is discharged at a Duna port
C2  Delivery Order created (number, date, customer, port)
C3  D/O printed and stamped
C4  D/O handed to the customer together with the other documents
C5  Consignee clears the cargo and collects it
```

Only five steps are given. The eligibility rule for C2 is **not stated** — see
`open-questions.md` DO-01.

---

## Process D — Cash: receipts and payments

From `EMP-130`–`EMP-134`, `EMP-654`–`EMP-664`, `EMP-703`–`EMP-720`.

```
D1  Invoice issued                    → Debit on customer ledger   (REQ-150)
D2  Customer pays                     → Receipt Voucher            (REQ-163)
D3  Allocate to a specific invoice / B/L (optional)                (REQ-164)
D3' No allocation                     → posts as Credit anyway     (REQ-165)
D4  Balance = Debit − Credit                                        (REQ-161)
D5  Customer asks for a statement      → Ledger Statement by range  (REQ-162)
D6  Duna pays someone                  → Payment Voucher            (REQ-163)
D6a ID card captured front & back      + recipient signature        (REQ-168)
D6b Money paid out                     → Debit on that party        (REQ-166)
D7  Non-customer spend (office, daily) → recorded in the same ledger (REQ-167)
D8  Loans / non-invoice movements      → General Journal entry      (REQ-166)
```

### Notes on Process D

- **D3′ is a requirement, not a gap.** Unallocated payment must post as Credit without error
  (`EMP-660`). Do not add validation here.
- **D6a is unusual and easy to miss.** ID-card capture is required for Payment Vouchers *and* for
  Salary Slips (`EMP-703`–`EMP-712`) — the employer brings it up twice, in two separate clips.
- **D7 exists for tax reasons**, not for customer accounting: office expenses must be recorded so
  they can be deducted at year end (`EMP-720`).

---

## Process E — Payroll

From `EMP-651`–`EMP-653`, `EMP-708`–`EMP-712`.

```
E1  Employees defined
E2  One or two days before month end: Salary Slip prepared
E3  Employee ID card captured front and back (upload or camera)
E4  Slip printed, ID card images included
E5  Employee signs the printed slip
```

Whether E5 posts anything to a ledger is **not stated** (`open-questions.md` SAL-01).

---

## Process F — Periodic reporting and control

From `EMP-126`–`EMP-129`, `EMP-617`–`EMP-622`, `EMP-693`–`EMP-702`.

```
F1  Per manifest (per vessel trip to a destination):
      costs   = charter + Port Use + Handling + Lashing + misc
      income  = Σ invoices issued against that manifest's B/Ls
      result  = income − costs                              (REQ-190 – REQ-192)
F2  Quarterly: VAT report (VAT collected vs VAT paid)       (REQ-194)
F3  Annually: filters over F1 → annual P&L for tax          (REQ-193)
F4  Continuously: overdue-invoice alarm                     (REQ-154)
F5  Continuously: unpaid-release alert                      (REQ-184)
```

---

## Process G — Document production (applies to every printable document)

From `EMP-037`–`EMP-040`, `EMP-169`–`EMP-172`, `EMP-575`–`EMP-586`, `EMP-721`–`EMP-725`.

```
G1  Choose output: PDF | Excel | Print
G2  PDF   → stamps, marks and signature ARE applied
G3  Excel → raw data, for manual correction before issue
G4  Print → stamps, marks and signature are REMOVED, so a live
            physical stamp can be applied to the paper
G5  Layout follows a company-supplied template per document type
```

**G4 is the step most likely to be "fixed" by mistake.** It is a deliberate requirement
(`EMP-172`, `EMP-582`, `REQ-122`).

---

## Hand-off points between roles

| From | To | Artefact | Requirement |
|---|---|---|---|
| Operations | Operations | Cargo record + Comment | REQ-061, REQ-065 |
| Operations | Accounting | Cargo Comment (read at invoicing) | REQ-067 |
| Operations | Operations | Job Number cost notes | REQ-130, REQ-133 |
| Operations | Yard crew | Printed Load List | REQ-090 |
| Operations | Captain | Printed + stamped Manifest | REQ-113 |
| Operations | Customer | Draft B/L for review | REQ-104, REQ-105 |
| Operations | Destination Agent | Manifest PDF | REQ-113 |
| Accounting | Customer | Invoice (Tax Invoice) | REQ-146 |
| Accounting | Customer | Receipt Voucher | REQ-163 |
| Accounting | Recipient | Payment Voucher + ID record | REQ-168 |
| Accounting | Agent | Release Order notification | REQ-180 |
| Operations | Customer | Delivery Order | REQ-185 |

---

## duna-analysis/01-employer-statements/business-rules.md

# Business Rules

> **Purpose:** The operational rules the employer stated, in a compact, testable form.
> Every rule carries its classification and evidence. Rules marked **INFERRED** are *not* employer
> statements — do not treat them as settled.
>
> Companion: [`requirements-catalog.md`](requirements-catalog.md) (full list),
> [`open-questions.md`](open-questions.md) (everything unresolved).

---

## Classification used in this file

| Mark | Meaning |
|---|---|
| **EXPLICIT** | Stated by the employer, unambiguous. Safe to implement. |
| **INFERRED** | Derived. Needs confirmation before it becomes a rule. |
| **UNRESOLVED** | Raised but not settled. Do not implement a value. |
| **CONTRADICTED** | Incompatible variants exist. Do not pick a side silently. |

---

## R1 — Identity and numbering rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R1.1 | Each Customer receives a system-generated sequential code prefixed `CUST`. The user never types it. | EXPLICIT | EMP-205, EMP-213, EMP-216, EMP-220, EMP-231 |
| R1.2 | The customer code **format** (separator, segment count) is not settled. | CONTRADICTED | EMP-207 vs EMP-213/216 vs EMP-222 vs EMP-233 |
| R1.3 | B/L numbers are scoped **per destination**. | EXPLICIT | EMP-542, EMP-543, EMP-546 |
| R1.4 | B/L number format is not settled (`KHS/26-2/2026` vs `RJS/26-10` vs observed `KHS/26-110`). | CONTRADICTED | EMP-544, EMP-546; see `../02-business-documents/document-catalog.md` |
| R1.5 | Manifest numbers are system-generated, unique per manifest, in a company-defined format. | EXPLICIT | EMP-589 |
| R1.6 | Voyage number is `n/yy`, counting **per vessel + per destination + per year**, restarting at 1 for a new destination or a new year. | EXPLICIT | EMP-315 – EMP-331 |
| R1.7 | The voyage number is derived automatically when vessel + destination are chosen. | EXPLICIT | EMP-320, EMP-329, EMP-330, EMP-552 |
| R1.8 | Voyage year is represented by two digits (`/26`). | EXPLICIT | EMP-317 – EMP-322 |
| R1.9 | Each Port has a mandatory abbreviation, used in space-constrained views instead of the full name. | EXPLICIT | EMP-256, EMP-264 – EMP-266, EMP-268 |

---

## R2 — Mandatory / optional rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R2.1 | Customer: **Name only** is mandatory. Contact, Email, Address are optional. | EXPLICIT | EMP-209, EMP-219, EMP-221, EMP-229 |
| R2.2 | Customer must **not** have Type, Currency, TRN Number or Short Name. | EXPLICIT | EMP-225, EMP-237 |
| R2.3 | Port: Name, City, Country **and** Abbreviation are all mandatory. | EXPLICIT | EMP-268 |
| R2.4 | Yard: only the owning Port and a name. | EXPLICIT | EMP-276 – EMP-279 |
| R2.5 | Vessel: name mandatory; IMO optional and must not block saving. | EXPLICIT | EMP-342 – EMP-344 |
| R2.6 | Shipper / Consignee: Name mandatory; National ID / TRN, Address, Contact, Email optional. | EXPLICIT | EMP-347 – EMP-357, EMP-362 – EMP-372 |
| R2.7 | Agent: Name, Address, Contact Number, Email. | EXPLICIT | EMP-374 – EMP-378 |
| R2.8 | **General principle:** an optional field that is empty must never produce an error on save. | EXPLICIT | EMP-209, EMP-344, EMP-355, EMP-660 |

---

## R3 — Yard, inventory and dependency rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R3.1 | A Yard belongs to exactly one Port. | EXPLICIT | EMP-276 |
| R3.2 | Selecting a Port of Loading filters the Yard list to that port's yards. | EXPLICIT | EMP-283 – EMP-288, EMP-466, EMP-467 |
| R3.3 | Yard Inventory must be filterable **by destination** so a vessel can be allocated. | EXPLICIT | EMP-042 – EMP-046, EMP-094 – EMP-097, EMP-499 – EMP-503 |
| R3.4 | Cargo planned but **not loaded** returns to Yard Inventory and stays eligible for a later trip. | EXPLICIT | EMP-016, EMP-017, EMP-049, EMP-534 – EMP-537 |
| R3.5 | Days in port = loading date − arrival date. | EXPLICIT | EMP-019, EMP-020, EMP-481 |
| R3.6 | Days in port drives the storage / warehousing charge payable to the port authority. | EXPLICIT | EMP-020, EMP-021, EMP-481 |
| R3.7 | If loading date is not yet recorded, days-in-port is still expected to be shown against today. | INFERRED | `../03-legacy-laravel-system/calculations.md` shows the legacy system did exactly this; the employer did not state it. |

---

## R4 — Inspection rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R4.1 | Inspection is booked (fee + slot) with customs, then performed. | EXPLICIT | EMP-473 – EMP-477 |
| R4.2 | Inspection states include at minimum **Pending** and **Done**. | EXPLICIT | EMP-077, EMP-478, EMP-506, EMP-516 |
| R4.3 | **Inspection = Done is a hard precondition** for Load List inclusion. | EXPLICIT | EMP-078, EMP-508, EMP-516 |
| R4.4 | Attempting to select an uninspected cargo **must raise an error** stating the inspection has not been done. | EXPLICIT | EMP-512 – EMP-515 |
| R4.5 | Pending inspection should be visually distinguished (employer suggests red). | EXPLICIT | EMP-479 |
| R4.6 | Whether a **failed** inspection has its own state, and whether re-inspection is allowed, is not stated. | UNRESOLVED | — |

---

## R5 — Load List rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R5.1 | A Load List belongs to one vessel. | EXPLICIT | EMP-306 – EMP-311, EMP-510 |
| R5.2 | A Load List is printable and is handed to the loading operators. | EXPLICIT | EMP-014, EMP-047, EMP-308, EMP-511 |
| R5.3 | A Load List can be **edited after creation** to append cargo inspected later, then re-printed as one document. | EXPLICIT | EMP-528 – EMP-533 |
| R5.4 | Load List columns: loading port, destination port, Description, Chassis Number, Serial Number, units, packages, Weight, arrival date, Yard, inspection status. | EXPLICIT | EMP-523, EMP-524 |

---

## R6 — Bill of Lading rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R6.1 | One B/L per loaded cargo item. | EXPLICIT | EMP-034 – EMP-036 |
| R6.2 | A B/L is first created in **Draft** with a `DRAFT` watermark. | EXPLICIT | EMP-562, EMP-563 |
| R6.3 | The draft goes to the customer for review; corrections are applied. | EXPLICIT | EMP-563, EMP-564 |
| R6.4 | The B/L leaves Draft when final / approved. | EXPLICIT | EMP-565 |
| R6.5 | B/L carries Shipper, Consignee, Notify Party, vessel, voyage, POL, POD, Marks & Numbers, Description, net/gross weight, CBM, Totals, Place of Issue, Freight (Collect/Prepaid), issue date, stamp/signature area. | EXPLICIT | EMP-540 – EMP-561 |
| R6.6 | The documentary parties are chosen by the customer, not by Duna. | EXPLICIT | EMP-391, EMP-417 – EMP-420 |
| R6.7 | Whether a finalised B/L can be amended, voided or re-issued is not stated. | UNRESOLVED | — |

---

## R7 — Manifest rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R7.1 | The Manifest consolidates the **issued** B/Ls of one voyage. | EXPLICIT | EMP-024, EMP-567, EMP-568, EMP-591, EMP-592 |
| R7.2 | Rows are numbered sequentially. | EXPLICIT | EMP-026, EMP-591, EMP-592 |
| R7.3 | Units and packages (Nagle) are shown **separately** per row and summed separately in the totals. | EXPLICIT | EMP-029 – EMP-031, EMP-597 – EXP-600 |
| R7.4 | The final page prints total units, total packages and total weight. | EXPLICIT | EMP-032, EMP-574, EMP-600 |
| R7.5 | **Only one manifest is issued per voyage, and Duna is the issuer — therefore partner / forwarder B/Ls with different formats and different numbering must be accepted onto the manifest.** | EXPLICIT | EMP-068 – EMP-074 |
| R7.6 | The manifest is printed and physically stamped for the captain; a PDF copy goes to the destination agent. | EXPLICIT | EMP-585, EMP-586 |

---

## R8 — Invoicing rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R8.1 | An invoice is either auto-drafted from issued B/Ls, or created standalone. | EXPLICIT | EMP-607, EMP-608, EMP-623 – EMP-628 |
| R8.2 | A B/L-derived invoice starts in **Draft** and is matched against the related Job Numbers before issue. | EXPLICIT | EMP-608, EMP-609, EMP-624, EMP-625 |
| R8.3 | Line = Description, Rate, Quantity, VAT %, VAT amount, Amount incl. VAT. | EXPLICIT | EMP-112 – EMP-118, EMP-611 |
| R8.4 | VAT is captured **per line** as a percentage. | EXPLICIT | EMP-114, EMP-115 |
| R8.5 | Totals block = Subtotal, VAT, Total Amount. | EXPLICIT | EMP-612 – EMP-614 |
| R8.6 | Amount incl. VAT = (Rate × Quantity) plus that line's VAT. | EXPLICIT | EMP-118 |
| R8.7 | Invoice status ∈ {Paid, Partial, Unpaid}. | EXPLICIT | EMP-428, EMP-642 |
| R8.8 | The printed document is a **Tax Invoice** carrying customer address/contact/email, invoice number, invoice date, payment deadline, TRN. | EXPLICIT | EMP-106 – EMP-109 |
| R8.9 | Issuing posts the invoice to the customer's ledger as **Debit**, under "Sales". | EXPLICIT | EMP-120, EMP-121, EMP-630, EMP-631 |
| R8.10 | VAT-able and non-VAT invoices must be separable for a quarterly VAT report (collected vs paid). | EXPLICIT | EMP-617 – EMP-622 |
| R8.11 | The default VAT rate and the taxability of each service line are **not stated**. | UNRESOLVED | The observed Tax Invoice shows 0% VAT on all lines. |
| R8.12 | Currency is not a Customer attribute; where multi-currency applies it is **not** stated whether it lives on the invoice or elsewhere. | UNRESOLVED | EMP-225, EMP-226 |

---

## R9 — Ledger, payment and voucher rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R9.1 | Payment received posts as **Credit** on the customer ledger. | EXPLICIT | EMP-132, EMP-632 |
| R9.2 | Balance = Debit − Credit; it may be positive (customer owes), negative (customer is owed) or zero. | EXPLICIT | EMP-133, EMP-134 |
| R9.3 | A ledger statement is produced for a customer over an arbitrary date range. | EXPLICIT | EMP-662 – EMP-664 |
| R9.4 | Voucher types: Payment Voucher, Receipt Voucher. | EXPLICIT | EMP-654, EMP-655 |
| R9.5 | A voucher selects the customer **first**, then optionally allocates to a specific invoice or B/L number. | EXPLICIT | EMP-656 – EMP-659 |
| R9.6 | **An unallocated payment must not raise an error** — it posts to the customer ledger as Credit. | EXPLICIT | EMP-660 |
| R9.7 | A General Journal entry can be posted directly onto a party's ledger: money paid out = Debit, money received = Credit. | EXPLICIT | EMP-714 – EMP-719 |
| R9.8 | Non-customer spend (office, daily, company running costs) is recorded in the same ledger so it can be deducted at year end. | EXPLICIT | EMP-647 – EMP-650, EMP-720 |
| R9.9 | Whether the ledger is a formal double-entry chart of accounts, or a set of per-party running balances, is **not stated**. | UNRESOLVED | See `open-questions.md` FIN-01 |
| R9.10 | Whether a single payment may settle **several** invoices at once is not stated by the employer, but the real Receipt Voucher in the document pack settles two. | CONTRADICTED | EMP-659 vs `../02-business-documents/receipt-vouchers.md` |
| R9.11 | Payment Voucher requires ID-card capture (front + back) and a recipient signature on the print. | EXPLICIT | EMP-703 – EMP-707 |
| R9.12 | Salary Slip requires the same ID-card capture and signature. | EXPLICIT | EMP-708 – EMP-712 |

---

## R10 — Release / Delivery / Agent rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R10.1 | A Release Order is issued after the vessel reaches and discharges at the destination. | EXPLICIT | EMP-138, EMP-674 |
| R10.2 | Release authorises the destination agent to hand the documents to the Consignee. | EXPLICIT | EMP-675 |
| R10.3 | Each release records Paid / Partial / Unpaid (credit). | EXPLICIT | EMP-142 – EMP-145, EMP-685 – EMP-689 |
| R10.4 | A release report classifies every B/L as Released+Paid, Released+Partial or Released+Unpaid. | EXPLICIT | EMP-146, EMP-147 |
| R10.5 | An alert fires for a released document that remains unpaid. | EXPLICIT | EMP-148, EMP-149 |
| R10.6 | The follow-up window the employer expects is **one to two weeks**; the exact alert threshold is an illustration, not a specification. | UNRESOLVED | EMP-692, EMP-148, EMP-149 |
| R10.7 | A Delivery Order is issued when inbound cargo is discharged at a Duna port; it carries number, date, customer and port; it is printed and stamped. | EXPLICIT | EMP-162, EMP-163, EMP-666 – EMP-672 |
| R10.8 | **Agents see only their own destination's B/Ls, Manifests and Release Orders.** | EXPLICIT | EMP-155, EMP-679 |
| R10.9 | Agents have their own login. | EXPLICIT | EMP-157 |
| R10.10 | Whether an agent may perform any **write** action (book, upload, confirm) is not stated; only viewing is described. | UNRESOLVED | EMP-681 |

---

## R11 — Output and document rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R11.1 | Every document screen offers PDF, Excel and Print. | EXPLICIT | EMP-037, EMP-169, EMP-575 – EMP-579 |
| R11.2 | **PDF output includes stamps, marks and signature.** | EXPLICIT | EMP-040, EMP-171, EMP-580, EMP-581 |
| R11.3 | **Print output removes stamps, marks and signature**, so a live physical stamp can be applied. | EXPLICIT | EMP-039, EMP-172, EMP-582, EMP-583 |
| R11.4 | Company templates are uploaded per document type: Loading List, Invoice, Delivery Order, Release Order, Salary Slip, Voucher, Payment, Receipt, Ledger. | EXPLICIT | EMP-721 – EMP-725 |
| R11.5 | Those templates are **not present in this repository**. | UNRESOLVED | EMP-035, EMP-107, EMP-119, EMP-572 |

---

## R12 — Reporting rules

| # | Rule | Class | Evidence |
|---|---|---|---|
| R12.1 | Per manifest: cost = charter + Port Use + Handling + Lashing + miscellaneous. | EXPLICIT | EMP-696 |
| R12.2 | Per manifest: income = Σ invoices issued against that manifest's B/Ls. | EXPLICIT | EMP-698 |
| R12.3 | Per manifest: P&L = income − cost. | EXPLICIT | EMP-699 – EMP-701 |
| R12.4 | The annual tax P&L is obtained by filtering the per-manifest results. | EXPLICIT | EMP-702 |
| R12.5 | Whether manifest costs are **stored** or **computed** is not stated. | UNRESOLVED | EMP-695, EMP-696 |
| R12.6 | Whether P&L income is measured before or after VAT is not stated. | UNRESOLVED | EMP-698 |

---

## duna-analysis/01-employer-statements/employer-original-statements.en.md

# Employer Original Statements — Complete English Source Record

> **Status:** Primary evidence document. Read this first if you need to know what the employer
> actually said, in the order they said it.
>
> **Purpose:** This is a *faithful, complete English rendering* of every employer statement
> available in this repository. It is deliberately **not** a specification and **not** a summary.
> Repetitions, self-corrections, vague phrasing, and apparent contradictions are preserved on
> purpose, so that a future reader can interpret the employer's meaning independently instead of
> inheriting a previous model's interpretation.
>
> **Companion documents:**
> - [`employer-requirements-analysis.md`](employer-requirements-analysis.md) — domain-grouped analysis (interpretation layer).
> - [`requirements-catalog.md`](requirements-catalog.md) — stable `REQ-*` catalogue.
> - [`open-questions.md`](open-questions.md) — ambiguities and unanswered questions.
> - [`../07-traceability/source-inventory.md`](../07-traceability/source-inventory.md) — inventory of the raw files.

---

## 0. How to read this document

### 0.1 Source files and how they are referenced

Every statement below carries a stable ID of the form `EMP-nnn`. IDs are assigned sequentially
across the whole document, so `EMP-001` is the earliest retained statement and the highest number
is the last. Each source file also gets a **segment reference** of the form `[SRC-file-key ¶n]`
where `¶n` is the paragraph index inside the original Persian file (paragraphs are separated by
blank lines in the originals).

| Source key | Original file (under `docs/duna-analysis/requirements/`) | Ordering evidence | Size |
|---|---|---|---|
| `SRC-A1` | `part1_0-15.txt` | Filename: minutes 0–15 of a long recording | 17,180 bytes |
| `SRC-A2` | `part2_15-end.txt` | Filename: minutes 15–end; text continues mid-sentence from `SRC-A1` | 16,199 bytes |
| `SRC-B01` … `SRC-B18` | `audio_2026-09-14_HH-MM-SS.txt` (18 files) | Filename timestamp, 2026-09-14 04:57:33 → 05:07:52 | 877–19,707 bytes |

**Group A** (`SRC-A1` + `SRC-A2`) is one continuous recording, split into two files at the
15-minute mark. This is *provable from the text*: `SRC-A1` ends mid-sentence
("…which customer this machine belongs to, what it is, what its Chassis Number is, blah…") and
`SRC-A2` begins mid-sentence ("What is it? The gear, the city of the goods, how much it weighs…").

**Group B** (the 18 `audio_*` files) is a separate batch of short voice clips recorded on
2026-09-14 between 04:57:33 and 05:07:52. Their internal order is certain (timestamps in the
filenames).

### 0.2 Ordering between Group A and Group B — documented uncertainty

> **The relative chronological order of Group A and Group B cannot be established reliably from
> the available metadata.** No file carries a creation timestamp other than the `audio_*` filenames,
> and no statement in either group explicitly references the other.

The arrangement chosen here puts **Group A first**, for these reasons, all of which are stated as
*inference*, not fact:

1. `docs/source-material/business-analysis.md` (§1.1) lists the two `part*` files as
   "Voice Group A — Main operational/accounting explanation" and lists the Overview/sidebar and
   Shipper/Consignee/Agent/Yard material *after* them. That is a previous model's judgement, not
   primary evidence, but it is the only prior attempt at ordering.
2. Group A is a pure business narrative. It never refers to "this app", a sidebar, or any screen.
   Group B repeatedly refers to the application's left-hand sidebar
   ("the left side of this app that says **Overview**"). It is therefore likely that Group B was
   recorded while a dashboard existed and Group A was recorded as a general business briefing.
3. `SRC-A2` closes with "we'll go into the details later", which reads as the end of a
   first, high-level pass.

**Alternative hypothesis (not excluded):** Group B could have been recorded first (a UI sketch
walk-through) and Group A afterwards. If the distinction ever matters for a business decision,
confirm it with the employer. Nothing in this knowledge base depends on which group came first,
because no statement in either group contradicts a statement in the other on a matter of business
rule.

### 0.3 Translation conventions

- **Bold** marks an English term the employer spoke in English inside Persian speech
  (e.g. **Overview**, **Master Data**, **Job Number**, **VAT**).
- `[inaudible]` marks a passage the transcript itself flags as unintelligible
  (`[نامفهوم]` / `[بخش نامشخص است]`).
- A **TN (translator's note)** block marks an editorial clarification added by the translator.
  Translator's notes are **never** employer statements.
- Persian-only business words are given with the original on first use, e.g. Nagle (نقل).
- The employer sometimes states a code format and then restates it differently within the same
  breath (e.g. `CUST 3-3-1`, then `CUST 3SF-2`, then `CUST 3.1`). All variants are preserved
  verbatim; the conflict is recorded in
  [`../04-business-analysis/contradictions-register.md`](../04-business-analysis/contradictions-register.md).

### 0.4 Completeness statement

All 20 transcript files present in `docs/duna-analysis/requirements/` have been read end-to-end and
are rendered below. No transcript has been replaced by a summary.

### 0.5 Repeated content is intentional

The employer restates the same requirement several times across the clips. Examples: the internal
nature of Customer recurs in `SRC-B01` and `SRC-B10`; the "print without stamp / PDF with stamp"
rule recurs in `SRC-A1`, `SRC-A2` and `SRC-B11`. These repeats are retained because each
restatement adds or shifts detail, and because a faithful record must show the employer's own
emphasis.

---

## GROUP A — Long business explanation (2 files)

### Source `SRC-A1` — `part1_0-15.txt` (recording minutes 0:00–15:00)

---

**EMP-001** — `[SRC-A1 ¶1]`
"Look, the part I want to explain to you: we are a shipping company and our head office is in
Dubai, United Arab Emirates."

**EMP-002** — `[SRC-A1 ¶2]`
"Hamriyah Port, Dubai port, Hamriyah port, Dubai port."

**EMP-003** — `[SRC-A1 ¶3]`
"Okay, the way it works is, for example, the vessels are either our own — meaning they are under
our own ownership — or we rent the vessel. Now, either we charter it per trip, or Time Charter, we
rent it for a period of time. Okay, that's that."

**EMP-004** — `[SRC-A1 ¶4]`
"Now in between, we have a set of activities, which is the transport of machinery, civil,
construction, Shipping in general, anything, moving for instance from one point to another point
by sea."

**EMP-005** — `[SRC-A1 ¶5]`
"Now, when we want to — suppose — take delivery of a machine today at the port, first of all we
must know which customer it is connected to. So look, the customer is the main pillar for us —
which of our customers this machine belongs to."

**EMP-006** — `[SRC-A1 ¶6]`
"Then this customer must also be given a dedicated code. For example, the thing we currently write
by hand — suppose one of our customers is Arash Alidadi. Okay, Arash Alidadi — now we wrote his
name, we wrote his email, we wrote his mobile number too. Now we wrote his information and Details."

**EMP-007** — `[SRC-A1 ¶7]`
"Now either it is a Company, meaning a company, or it is a natural person — meaning for example
either an individual or a company — our customer. A company too, in the same way, we register a set
of Details for them; the name is obvious of course."

**EMP-008** — `[SRC-A1 ¶8]`
"Then it gives it a random code, it gives some code. For example, the way we used to write it by
hand, we would assign a dedicated number to a customer — Customer, for example CUSD, for example
33431. The next one, the same Customer, for example 332334 — in order, like that, for every new
customer that gets registered."

> **TN:** The employer is describing the *manual, historical* coding habit, and the two examples
> (`CUSD 33431`, `332334`) are inconsistent with each other. This is a description of past practice,
> not necessarily a requested format. See also `EMP-205`–`EMP-235`, where different Customer code
> formats are requested for the new system.

**EMP-009** — `[SRC-A1 ¶9]`
"Okay, now this customer is registered — that, for example, such-and-such machine was delivered
to us."

**EMP-010** — `[SRC-A1 ¶10]`
"Now we must have a Load List — meaning warehouse inventory. We must have a warehouse inventory,
so we can see, for example, what these Details are; whose machine it is, what it was, what date it
entered, which port it entered — Port Rashid, Port Hamriyah, Port Jebel Ali — and where its
destination is."

**EMP-011** — `[SRC-A1 ¶11]`
"Okay, where its destination is, what their date is, with what kind of documents — what documents
it has, for example it has Export Paper, I don't know, it has an R.D.A., it has Import Paper, it
has an Export Certificate — with what Mode whatever was imported."

> **TN:** "آر‌دی‌ای" (R.D.A.) is spoken letter-by-letter and its meaning is not established by
> the transcript. It may be a mis-hearing of another document acronym. Recorded as unresolved
> (see `open-questions.md`, DOC-01).

**EMP-012** — `[SRC-A1 ¶12]`
"Then, suppose, when our vessel arrives — or when we want to make a decision about which loading
we assign this vessel to — for example we say, let's put it for Port Hamriyah, for the machines
bound for Khorramshahr, for instance."

**EMP-013** — `[SRC-A1 ¶13]`
"Okay, we have an empty vessel, we want to do this job; the machines that are for Khorramshahr
are in Hamriyah, we want to load them."

**EMP-014** — `[SRC-A1 ¶14]`
"After the inspection is confirmed, we then prepare a Load List. We prepare a Load List — for
example now 20 machines, 30 machines, 40 machines, whatever it is — we prepare it and we Print
these, we hand them to the Operator guys."

**EMP-015** — `[SRC-A1 ¶15]`
"The Operator guys — that, for example, this vessel must load this number of machines into this
vessel. Okay, they start loading."

**EMP-016** — `[SRC-A1 ¶16]`
"All of a sudden you see that during loading, for example, one machine doesn't get loaded. Now
either it doesn't fit, or it breaks down, you don't load it, for whatever reason. One machine out
of this list we handed them remains."

**EMP-017** — `[SRC-A1 ¶17]`
"Okay, this machine automatically goes back again into the warehouse inventory and stays for,
for example, the next trip. Meaning at first — yes, right — it goes back, it is removed from the
list, it goes back into the main system, into an inventory list, so we put it aside for the next
Shift, for the next vessel that we want to load."

**EMP-018** — `[SRC-A1 ¶18]`
"Okay, now the machine we loaded — its loading date is also specified now. Look, its arrival date
is specified, which Yard it was discharged into, what date it was discharged, and what documents
it has."

**EMP-019** — `[SRC-A1 ¶19]`
"Okay, the loading date is also specified here. Now, for example, you take delivery of a machine
today, its loading date is one month later. Once we do the loading, we also enter the loading
dates — so what happens here? Here the number of days it has been in the port also becomes
specified."

**EMP-020** — `[SRC-A1 ¶20]`
"For example, for the warehousing we want to pay to DP, here it becomes the loading date minus the
arrival date — for example the number of days it has been in the port."

> **TN:** "DP" is spoken as letters. In context (a port authority charge) it most likely refers to
> the port operator (Dubai Ports / DP World). Not confirmed by the transcript.

**EMP-021** — `[SRC-A1 ¶21]`
"Here we understand, for example, how many days this machine, this Shipment, this goods has stayed
in the port, so we can go and calculate its warehousing, to know how much it is. Okay, that's
that."

**EMP-022** — `[SRC-A1 ¶22]`
"Now the vessel has been loaded, the vessel has been loaded — we must specify how many of these
machines that we gave to the Operators in the Load List have been loaded. For example, we gave
them 20, 19 were loaded. That one goes back again into the warehouse inventory."

**EMP-023** — `[SRC-A1 ¶23]`
"Okay, Yard inventory."

**EMP-024** — `[SRC-A1 ¶24]`
"Okay, out of those 19 that were loaded, now we must prepare the vessel's Manifest."

**EMP-025** — `[SRC-A1 ¶25]`
"The vessel's Manifest too, as is known — for example the vessel name, Manifest number, port of
loading, destination port, and a set of other Details."

**EMP-026** — `[SRC-A1 ¶26]`
"Okay, then in the Manifest it numbers the rows — one, two, three, four, five, six."

**EMP-027** — `[SRC-A1 ¶27]`
"Okay, then in order it assigns a Bill of Lading number to each of them."

**EMP-028** — `[SRC-A1 ¶28]`
"Then Shipper, Shipper and Chassis, whatever information is needed in the Manifest, you enter it."

**EMP-029** — `[SRC-A1 ¶29]`
"Then it is issued in the name of Consignee, Shipper, quantity, weight — which must also give a
Total."

**EMP-030** — `[SRC-A1 ¶30]`
"For example Total — for example thirty machines were loaded, plus, say, twenty Nagle. Nagle means
it is not a machine, meaning [inaudible] in the port."

> **TN:** "Nagle" (نقل) is the employer's own term for loose/accompanying pieces that are not
> complete machines — pallets, boxes, bundles, spare parts. See the glossary.

**EMP-031** — `[SRC-A1 ¶31]`
"For example thirty machines, plus, say, ninety Nagle loaded."

**EMP-032** — `[SRC-A1 ¶32]`
"With the total weight — which you then enter."

**EMP-033** — `[SRC-A1 ¶33]`
"This becomes the Manifest. Meaning, for example, a form so that the captain and Crew know that
this many machines have been loaded and the list is in their hands."

**EMP-034** — `[SRC-A1 ¶34]`
"Okay, now each of these goods that has been loaded gets a dedicated Bill of Lading. It's called a
Bill of Lading."

**EMP-035** — `[SRC-A1 ¶35]`
"This Bill of Lading is for one of those goods that is now specified; for example its Shipper is
specified, its Consignee is specified, its Notify Party — and it's a standard Bill of Lading whose
formats we have, I'll send them to you."

**EMP-036** — `[SRC-A1 ¶36]`
"Okay, for every goods item that we load onto the vessel, there is a Bill of Lading — in a sense
unique to itself — and we must send this Bill of Lading to the customer, that, look, this is your
Bill of Lading and, for example, the machine is now moving from Hamriyah towards Khorramshahr."

**EMP-037** — `[SRC-A1 ¶37]`
"Okay, now that we've Printed the Manifest, these outputs must be given to us — for example give
us an output that becomes PDF, we take a Print, or for example give Excel, give Excel so that we
can then manually make a set of corrections or something specific in it, stamp it, hand it to
[inaudible], hand it to the captain."

**EMP-038** — `[SRC-A1 ¶38]`
"These Bills of Lading also get Printed — for example it Prints out, it gives PDF out so we take a
Print."

**EMP-039** — `[SRC-A1 ¶39]`
"Now we physically stamp it there. We physically put the stamp on the ones that need to be
Printed."

**EMP-040** — `[SRC-A1 ¶40]`
"The ones we take as PDF — well, the stamp is already applied on it; meaning this stamp of theirs
must be saved in it automatically, so that when you take a PDF, the Stamp itself is the default."

**EMP-041** — `[SRC-A1 ¶41]`
"Okay, this is up to here in the process."

**EMP-042** — `[SRC-A1 ¶42]`
"So it came to pass that we had our warehouse inventory, and then, which vessel we want to assign
to where, to which destination to assign it, also became clear."

**EMP-043** — `[SRC-A1 ¶43]`
"Then we apply a set of filters on our inventory. For example we enter Khorramshahr, Port
Hamriyah."

**EMP-044** — `[SRC-A1 ¶44]`
"Okay, when we enter Port Hamriyah, we enter Khorramshahr, for example, out of the total 120
machines we currently have in inventory, for example 20 of them are for Khorramshahr."

**EMP-045** — `[SRC-A1 ¶45]`
"These 20 must be filtered and come up — filtered and come up."

**EMP-046** — `[SRC-A1 ¶46]`
"Now which of them do we want to load? For example, 19 of them are eligible for loading. We select
those 19."

**EMP-047** — `[SRC-A1 ¶47]`
"Okay, this must be Printed as a Load List — that, for example, these 19 machines with this vessel
are handed to the Operator; we take a Print, PDF, hand it to the Operators inside the yard, and
they start loading."

**EMP-048** — `[SRC-A1 ¶48]`
"Now, however many of this list we gave them they managed to load — its loading dates they also
write for us by hand and give to the office staff. The office staff enter them."

**EMP-049** — `[SRC-A1 ¶49]`
"Whatever they could not load, for whatever reason — breakdown, or no space, or whatever — that
remaining number must also go back in the system into the Yard inventory, so we know, for example,
we still have this many machines for Khorramshahr, so it's there for later decision-making."

**EMP-050** — `[SRC-A1 ¶50]`
"Okay, that's the end of the operations stage, and the Manifest likewise."

**EMP-051** — `[SRC-A1 ¶51]`
"Now, however many machines were loaded onto the vessel — then these, as PDF output, PDF or Excel
it gives out — then we send each Bill of Lading to the customers."

**EMP-052** — `[SRC-A1 ¶52]`
"Okay, now this stage is finished, we move on to the next stage — the accounting stage."

**EMP-053** — `[SRC-A1 ¶53]`
"So the Operation stage is done. The Bill of Lading and Manifest stage is done too. We move to the
accounting stage."

**EMP-054** — `[SRC-A1 ¶54]`
"Accounting stage. Now look, for example, there are a set of goods where we also do the clearance
work ourselves — like the ETOZ case."

> **TN:** "ETOZ" / "ETDZ" is spoken as an acronym the employer uses for end-to-end handling: Duna
> collects the goods abroad, clears it, moves it, and delivers it. It is spelled inconsistently in
> the transcripts (`ETOZ` in `SRC-A1`, `ETDZ` in `SRC-B13`). See glossary.

**EMP-055** — `[SRC-A1 ¶55]`
"Okay, this work that we are doing as ETOZ. For example, we picked up a machine for a customer from
China, brought it to, for example, Jebel Ali."

**EMP-056** — `[SRC-A1 ¶56]`
"We cleared it from Jebel Ali."

**EMP-057** — `[SRC-A1 ¶57]`
"Then we took a low-bed trailer. The low-bed took it from Jebel Ali and brought it to Hamriyah."

**EMP-058** — `[SRC-A1 ¶58]`
"Hamriyah, for example, discharged it."

**EMP-059** — `[SRC-A1 ¶59]`
"Now suppose, for example, mechanical work was done on it, blah blah, go on. This is an ETOZ
process."

**EMP-060** — `[SRC-A1 ¶60]`
"Technically, because during the process — for example, a set of expenses are incurred for the
machine or Cargo or whatever — this is technically called a Job Number."

**EMP-061** — `[SRC-A1 ¶61]`
"Meaning the petty expenses incurred from the beginning to the end for one Cargo or, for example,
Shipment — so that at the end, when the accountant wants to issue an Invoice, they look at this Job
Number."

**EMP-062** — `[SRC-A1 ¶62]`
"It's like having a note, that, look, I spent a thousand dirhams on it here in China."

**EMP-063** — `[SRC-A1 ¶63]`
"Then again, I paid, say, ten thousand dollars freight for it to come to Jebel Ali."

**EMP-064** — `[SRC-A1 ¶64]`
"Okay, these don't happen daily. For example, that thousand dirhams you spent in China — maybe its
loading is two weeks later."

**EMP-065** — `[SRC-A1 ¶65]`
"Then two weeks later you pay another freight for it, it comes to Jebel Ali, then again maybe it
takes a month to reach Jebel Ali."

**EMP-066** — `[SRC-A1 ¶66]`
"Now for example the state [inaudible] of this Job Number."

**EMP-067** — `[SRC-A1 ¶67]`
"For example, for one goods item a dedicated Job Number is assigned — so that afterwards, when you
want to enter it and do its accounting, you see this Job Number there — how much has been spent on
it from this ETOZ."

**EMP-068** — `[SRC-A1 ¶68]`
"Okay, now when the vessel has departed and its Manifest is closed — this Manifest, look, it's
possible that partner companies and Forwarders also load onto our vessels."

**EMP-069** — `[SRC-A1 ¶69]`
"Now, after all, we allocate a bit of space between them."

**EMP-070** — `[SRC-A1 ¶70]`
"For example, out of a total of 30 machines, 20 machines were mine — belonged to our own company —
for example 5 of them belonged to another company, 5 of them belonged to another company."

**EMP-071** — `[SRC-A1 ¶71]`
"Their Bill of Lading format is also different from ours."

**EMP-072** — `[SRC-A1 ¶72]`
"Their Bill of Lading numbering format is different from ours."

**EMP-073** — `[SRC-A1 ¶73]`
"Okay, we must be able to — we must be able to — add their Bills of Lading to the Manifest too."

**EMP-074** — `[SRC-A1 ¶74]`
"Meaning it must have this Option, because there is only one Manifest and we are the ones who must
issue it."

**EMP-075** — `[SRC-A1 ¶75]`
"Okay, once the Manifest is closed — this is an important point that Arash should always keep in
mind — from the moment we take delivery of the machine, the guys want to do Data Entry, that,
look, which customer this machine belongs to, what it is, what its Chassis Number is, blah…"

*(End of `SRC-A1`. The sentence continues in `SRC-A2`.)*

---
### Source `SRC-A2` — `part2_15-end.txt` (recording minutes 15:00–end)

---

**EMP-076** — `[SRC-A2 ¶1]` *(continuation of EMP-075)*
"What is it? The gear, the city of the goods, how much it weighs, how many Nagle accompany it,
which Yard it was discharged into, what date it was discharged, what the type of its documents is."

**EMP-077** — `[SRC-A2 ¶2]`
"And that, for example, when we want to take a print and hand it to the operations guys, its
Inspection, for example, should be specified — that, look, the Inspection has been done; meaning
it should be ticked, that these are allowed to load, that it can come into the loading list."

**EMP-078** — `[SRC-A2 ¶3]`
"Meaning this loading Load List — you must consider a set of conditions for it, that, look, one of
the most important of them is this Inspection. Its Inspection must definitely be ticked; meaning
the guys have done the Inspection, it is ticked, and it is eligible to be selected and go into the
Load List, and that Operator…"

**EMP-079** — `[SRC-A2 ¶4]`
"Now I want to know this — for every machine we take delivery of, every goods item we want to take
delivery of, also put a Comment, a place for a Comment, for these."

**EMP-080** — `[SRC-A2 ¶5]`
"Why? Because, for example, sometimes a set of expenses are incurred for one machine, one customer,
and when it is brought into the Comment, this prevents it from being forgotten."

**EMP-081** — `[SRC-A2 ¶6]`
"Then these Comments, for example, where are they useful? For when we want to issue the customer's
statement in the Accounting section."

**EMP-082** — `[SRC-A2 ¶7]`
"That accountant sees these Comments."

**EMP-083** — `[SRC-A2 ¶8]`
"For example, they see that, look, this machine that came — we paid its Transport cost, we paid its
customs cost, for example."

**EMP-084** — `[SRC-A2 ¶9]`
"If it needed repairs inside the Port, for example, we did it, we paid for it."

**EMP-085** — `[SRC-A2 ¶10]`
"This, the operations guys write in the Comment section — meaning the employee who is responsible
for these tasks writes it in that Comment."

**EMP-086** — `[SRC-A2 ¶11]`
"And then that accountant, automatically, when they want to issue their statements, can read these
Comments."

**EMP-087** — `[SRC-A2 ¶12]`
"And there is no longer any need to ask questions, and, for example, running around here and there
and making inquiries and, you know, those things."

**EMP-088** — `[SRC-A2 ¶13]`
"These Comments."

**EMP-089** — `[SRC-A2 ¶14]`
"Okay, then once we've entered this data, the Cargo is Registered."

**EMP-090** — `[SRC-A2 ¶15]`
"For example, it comes into this List of the Cargos themselves."

**EMP-091** — `[SRC-A2 ¶16]`
"Okay, now that this Cargo List is written and it's specified that, look, now we have a List, for
example our Customers — who are they? Arash Alidadi, Kianoush Jowkar."

**EMP-092** — `[SRC-A2 ¶17]`
"Well, then it's specified — look, this machine is such-and-such, its Chassis Number is
such-and-such."

**EMP-093** — `[SRC-A2 ¶18]`
"Suppose, for example, Hamriyah to Khorramshahr."

**EMP-094** — `[SRC-A2 ¶19]`
"Okay, these must have a set of Filters inside them."

**EMP-095** — `[SRC-A2 ¶20]`
"Why? Because when, for example, I as management want to decide which destination to assign this
vessel, this craft to — meaning, for example, where to load and which destination to assign it to
— this must specify for me that, look, we have 30 machines for Khorramshahr."

**EMP-096** — `[SRC-A2 ¶21]`
"For example, for destination Bushehr, suppose we have 10 machines. For destination Bandar Abbas,
for example, we have 10 machines."

**EMP-097** — `[SRC-A2 ¶22]`
"Okay, so it's natural that I immediately assign the vessel to Khorramshahr."

**EMP-098** — `[SRC-A2 ¶23]`
"Okay, now we come to invoicing — issuing the statement."

**EMP-099** — `[SRC-A2 ¶24]`
"Okay, every expense, whatever has been incurred — if it has a Job Number, that specifies what the
expense is; if not, if the guys wrote it in those Comments, then this accountant sees it."

**EMP-100** — `[SRC-A2 ¶25]`
"Okay, whenever they want to issue this Bill, again the customer must be specified."

**EMP-101** — `[SRC-A2 ¶26]`
"For example, look, such-and-such Bill of Lading that we issued from the very beginning — its
customer was specified; meaning it went into that customer's profile."

**EMP-102** — `[SRC-A2 ¶27]`
"Now they come and issue its statement."

**EMP-103** — `[SRC-A2 ¶28]`
"Your statement, for example row one, two, three, four — a set of information and Details related
to the machine and the Bill of Lading number and so on; we specify the details of, for example,
what the Bill, the statement is being issued for, and so on."

**EMP-104** — `[SRC-A2 ¶29]`
"And then, whatever expense has been incurred — for example vessel freight, crane operation,
low-bed cost, clearance cost, whatever it is — these must come."

**EMP-105** — `[SRC-A2 ¶30]`
"Okay, this Invoice must also have different sections."

**EMP-106** — `[SRC-A2 ¶31]`
"From the top, it must be a **Tax Invoice**, because this is the UAE law — that, for example,
Address and mobile number and Contact Number and Email and these things…"

**EMP-107** — `[SRC-A2 ¶32]`
"On the other side too, on the right — now I'll send you the format of these Invoices."

**EMP-108** — `[SRC-A2 ¶33]`
"On the right too is this Invoice Number and the date of this Invoice and the maximum payment
deadline and blah and so on."

**EMP-109** — `[SRC-A2 ¶34]`
"Then we also have a **TRN Number**. Now we'll see that TRN in the format, in the Details."

**EMP-110** — `[SRC-A2 ¶35]`
"Okay, then this Invoice — for example two rows, three rows, four rows must be addable, so it can
be written."

**EMP-111** — `[SRC-A2 ¶36]`
"Okay, this row — one row of its own, one, two, three, four."

**EMP-112** — `[SRC-A2 ¶37]`
"Okay, then we get to the Description stage — description, Rate or now Fee — then we get to
Quantity or QTY."

**EMP-113** — `[SRC-A2 ¶38]`
"Okay, then here we also have another row here, **Value Added Tax**, value added."

**EMP-114** — `[SRC-A2 ¶39]`
"Here the row must take a percentage."

**EMP-115** — `[SRC-A2 ¶40]`
"For example, if in this row I write five for VAT, it means five percent of this transaction
includes VAT."

**EMP-116** — `[SRC-A2 ¶41]`
"The VAT amount is also written separately."

**EMP-117** — `[SRC-A2 ¶42]`
"Another row, for example VAT… and this row — now the VAT amount is specified."

**EMP-118** — `[SRC-A2 ¶43]`
"The next row is where you write its Amount — meaning Rate multiplied by quantity, plus the VAT
percentage — it sits in that row."

**EMP-119** — `[SRC-A2 ¶44]`
"Now you'd know its shape — I'll send you the statement format so you know."

**EMP-120** — `[SRC-A2 ¶45]`
"Okay, once you've issued this invoice, this automatically, for example, goes under the title
**Sales** into that customer's section, it sits in that customer's profile."

**EMP-121** — `[SRC-A2 ¶46]`
"It sits in their account as **Debit**."

**EMP-122** — `[SRC-A2 ¶47]`
"Okay, for this Manifest — now for example 20, 30, 40, however many Bills of Lading we have — we
issue these Invoices."

**EMP-123** — `[SRC-A2 ¶48]`
"And each Invoice that is linked goes and sits in the Ledger account — or the same customer's
general account."

**EMP-124** — `[SRC-A2 ¶49]`
"That's how it is."

**EMP-125** — `[SRC-A2 ¶50]`
"Okay, this is now specified. These Invoices are finished."

**EMP-126** — `[SRC-A2 ¶51]`
"Okay, now here we must specify: this vessel that, for example, went for us on trip **1-26** from
Hamriyah to Khorramshahr must give us a report."

**EMP-127** — `[SRC-A2 ¶52]`
"So that, now for example, we enter a set of data for it, it must give us a set of reports that,
look, how much has been spent on this vessel, how much income there has been — now for example how
much profit or loss resulted from this trip this vessel made — it should specify that too."

**EMP-128** — `[SRC-A2 ¶53]`
"Okay, okay, then after these invoices have been issued and these expenses have been incurred and,
for example, Port Handling and Port Use and so on have been paid, the vessel has gone out — I'm
saying this data must be entered and it must specify how much profit and loss this vessel had."

**EMP-129** — `[SRC-A2 ¶54]`
"Okay, that's that."

**EMP-130** — `[SRC-A2 ¶55]`
"Now these Invoices that were issued go and sit in the customers' subsidiary accounts."

**EMP-131** — `[SRC-A2 ¶56]`
"That subsidiary account or the customers' general account — for example, that's their thing — for
example their **Customer Ledger**."

**EMP-132** — `[SRC-A2 ¶57]`
"Now they make a payment, we give them a receipt, it automatically goes into the system to the Sub
Customer and sits as **Credit**."

**EMP-133** — `[SRC-A2 ¶58]`
"Now this Credit, Debit — they get added and subtracted from each other, the Balance is obtained."

**EMP-134** — `[SRC-A2 ¶59]`
"That, look, how much a customer owes us, or for example how much they are owed, or their Balance
is simply zero — it should specify."

**EMP-135** — `[SRC-A2 ¶60]`
"Okay, now when we issue an Invoice, the Invoice issue date must also be specified."

**EMP-136** — `[SRC-A2 ¶61]`
"Or for example, now, why do we want to see this? How long does it take for, look, the customer to
pay this money?"

**EMP-137** — `[SRC-A2 ¶62]`
"This should either give an Alarm, or give us a report."

**EMP-138** — `[SRC-A2 ¶63]`
"Okay, now after these Invoices have been issued, have come and sat in the customer's account and
so on, we get to Releasing — in a sense, the documents — the **Release Order**."

**EMP-139** — `[SRC-A2 ¶64]`
"Okay, once, look, the vessel has reached the destination and the destination has discharged and so
on, then the customer now, suppose, wants to go and take delivery of their machine."

**EMP-140** — `[SRC-A2 ¶65]`
"Okay, they call us: how much has this become, its cost is blah. We've also sent them its invoice."

**EMP-141** — `[SRC-A2 ¶66]`
"Now suppose they want to pay."

**EMP-142** — `[SRC-A2 ¶67]`
"Now either they want to pay a part of this Invoice, or they want to pay all of it, or they say,
look, give it to them on credit — for example they'll pay one week later, ten days later."

**EMP-143** — `[SRC-A2 ¶68]`
"Okay, when we want to give them Release, we must specify — it should put an Option there for it in
the system — what? That, look, we took the money for this, it's settled, and we gave the Release
Order to our agent in Khorramshahr."

**EMP-144** — `[SRC-A2 ¶69]`
"Or, for example, they've paid a part of it, a portion of it."

**EMP-145** — `[SRC-A2 ¶70]`
"Or they haven't paid at all — they want to take it on credit."

**EMP-146** — `[SRC-A2 ¶71]`
"Okay, this Release Order that we issue, that we approve — this must give us a report."

**EMP-147** — `[SRC-A2 ¶72]`
"Ah — so that afterwards we know which, look, in this Manifest we sent, or in this Bill of Lading
we sent, it specifies for us which of them are Released and Paid — paid; which of them were
Released and were Partial Payment — they paid a part of them; which ones were Released and are
simply Unpaid — meaning not paid."

**EMP-148** — `[SRC-A2 ¶73]`
"It should specify these for us and set an Alarm, put a Notice, that, look, such-and-such document
has now been Released for one week but no money has been paid."

**EMP-149** — `[SRC-A2 ¶74]`
"Or, for example, such-and-such document — we gave Release for it one month ago — and, for example,
they still haven't paid 20% of it."

**EMP-150** — `[SRC-A2 ¶75]`
"Like that."

**EMP-151** — `[SRC-A2 ¶76]`
"Now this really needs a fine detail that I'll tell you later."

**EMP-152** — `[SRC-A2 ¶77]`
"I'm saying these in general."

**EMP-153** — `[SRC-A2 ¶78]`
"Now when the destination — meaning Khorramshahr, Bushehr, Bandar Abbas, wherever it's going to
discharge — the Agents there call us, they say, look, has such-and-such Bill of Lading been
Released or not?"

**EMP-154** — `[SRC-A2 ¶79]`
"For example, they should have access in the Release Order section and to the Bills of Lading
related to themselves."

**EMP-155** — `[SRC-A2 ¶80]`
"Meaning look — Khorramshahr only sees what belongs to Khorramshahr, Bushehr only sees what belongs
to Bushehr, Bandar Abbas only sees what belongs to Bandar Abbas."

**EMP-156** — `[SRC-A2 ¶81]`
"There they see that, look, if a document is Released, then there's no need to call at all."

**EMP-157** — `[SRC-A2 ¶82]`
"For example, they themselves have a Login, they go and see there — for example Bill of Lading
such-and-such — there it says, for example, it is not Released, the Bill of Lading is not there."

**EMP-158** — `[SRC-A2 ¶83]`
"There, they themselves directly tell the customer: look, the Bill of Lading is not Released; go
and coordinate with the shipping company of origin — for example with Dubai — and see what your
problem is."

**EMP-159** — `[SRC-A2 ¶84]`
"Or, if it is Released, they themselves see it in the system — so they don't have to keep calling
me."

**EMP-160** — `[SRC-A2 ¶85]`
"Like that."

**EMP-161** — `[SRC-A2 ¶86]`
"Okay, that was the general outline that I have."

**EMP-162** — `[SRC-A2 ¶87]`
"Now there are also a set of cargos that come in — meaning we must bring them here and discharge
them, and after we've discharged them we give a **Delivery Order** — meaning we give a Delivery
Order."

**EMP-163** — `[SRC-A2 ¶88]`
"This too is a section that you must fit in there."

**EMP-164** — `[SRC-A2 ¶89]`
"Now among the Options I told you — the Option, for example, Loading was, operations, that, now, we
specify how many Yard inventories I have, in which Ports, to which destination, how many, what we
gave, this has come in, its customer is specified too."

**EMP-165** — `[SRC-A2 ¶90]`
"Then these — the eligible ones — come into the Load List."

**EMP-166** — `[SRC-A2 ¶91]`
"The Load List gets printed, we give it to, for example, the Operators so they do the loading."

**EMP-167** — `[SRC-A2 ¶92]`
"Then we come and enter the Bill of Lading and Manifest issuing stage."

**EMP-168** — `[SRC-A2 ¶93]`
"Now those that are Final and have been loaded come into the Manifest list."

**EMP-169** — `[SRC-A2 ¶94]`
"Manifest — now PDF output, Excel, whatever it gives, let it give."

**EMP-170** — `[SRC-A2 ¶95]`
"We take a Print."

**EMP-171** — `[SRC-A2 ¶96]`
"If it gives PDF, let it give it together with Mark/Stamp."

**EMP-172** — `[SRC-A2 ¶97]`
"And if we want to take a Print, well, it should remove those Stamps; we take a Print and put the
original Stamp — meaning we put a live Stamp, a live stamp — both for the Manifest and for the
Bill of Lading."

**EMP-173** — `[SRC-A2 ¶98]`
"Okay, then we enter the stage… let me add some Options here — for example Delivery Order, let me
tell you Release Order — we should consider these things."

**EMP-174** — `[SRC-A2 ¶99]`
"Then we also enter the Accounting section."

**EMP-175** — `[SRC-A2 ¶100]`
"I mean accounting."

**EMP-176** — `[SRC-A2 ¶101]`
"Now, for example, always keep in mind those Comments, or that Job Number — the ETOZ that we are
doing for one single Shipment — it may take one month, two months."

**EMP-177** — `[SRC-A2 ¶102]`
"This accountant should know that, look, this machine for which we hit Start one month ago — how
much has been spent on it step by step."

**EMP-178** — `[SRC-A2 ¶103]`
"So that when they come to issue an Invoice, they know not to write something wrong, or for
example not to lose track of it and forget to include it."

**EMP-179** — `[SRC-A2 ¶104]`
"That's that."

**EMP-180** — `[SRC-A2 ¶105]`
"Then these statements that are issued automatically go and sit in the customer's account."

**EMP-181** — `[SRC-A2 ¶106]`
"And the customer's payments too — their receipt, the **Payment Voucher** — those should also be
specified."

**EMP-182** — `[SRC-A2 ¶107]`
"Now, what detailed Options each of them should have, what things we should do in that Receipt
Voucher and Payment Voucher, what its shape and form should be."

**EMP-183** — `[SRC-A2 ¶108]`
"For example, this Invoice that you issue — what its Details should be and so on — which I'll tell
you in full."

**EMP-184** — `[SRC-A2 ¶109]`
"We'll go into the details later."

*(End of Group A.)*

---

## GROUP B — Timestamped voice clips, 2026-09-14 04:57:33 → 05:07:52 (18 files)

---

### Source `SRC-B01` — `audio_2026-09-14_04-57-33.txt` (04:57:33) — Sidebar structure, Master Data, Customers

---

**EMP-185** — `[SRC-B01 ¶1]`
"Look, on the left side — the data — meaning the left side of this app that says **Overview** — we
have 1, 2, 3, 4, 5, 6; we have six general sections, and they must be in this order."

**EMP-186** — `[SRC-B01 ¶2]`
"For example, the first section must be **Overview**, then it must be **Operations**, then **B/L and
Manifest**, then **Accounting**, then that **Master Data**, and finally **Access Control**."

**EMP-187** — `[SRC-B01 ¶3]`
"Each of these, when we click on them, must open their Options in a drop-down (accordion) way."

**EMP-188** — `[SRC-B01 ¶4]`
"Okay, now what we want is to start from **Master Data**. We want to start. Okay, there is a set of
data that we must enter from the beginning, and it stays fixed in the system."

**EMP-189** — `[SRC-B01 ¶5]`
"And when in various places — for example like **Operations**, or issuing a **Bill of Lading**, or
issuing a **Manifest**, or now issuing a statement — when we want to issue these, we need a set of
pre-determined Data, and there we must only Select them."

**EMP-190** — `[SRC-B01 ¶6]`
"Now, for Selecting them — so that, for example, that Operator doesn't have to enter them manually
again and, for example, make errors or enter them wrongly — we come and enter these in the Master
Data section."

**EMP-191** — `[SRC-B01 ¶7]`
"Now Master Data has a set of sub-items — it has a drop-down state."

**EMP-192** — `[SRC-B01 ¶8]`
"So what did it become now? It became that Master Data section."

**EMP-193** — `[SRC-B01 ¶9]`
"Yes, yes — the Master Data section became:"

**EMP-194** — `[SRC-B01 ¶10]`
"**Customers, Ports, Yards, Vessels, Shippers, Consignees, Agents**"

**EMP-195** — `[SRC-B01 ¶11]`
"Okay, each of these must have a set of…"

**EMP-196** — `[SRC-B01 ¶12]`
"For example, now we go into the **Customers** section."

**EMP-197** — `[SRC-B01 ¶13]`
"Okay, now Customer — for us to want to create a **New Customer** — because everything of ours is
based on Customer."

**EMP-198** — `[SRC-B01 ¶14]`
"Okay, Customer may be a person whose name is not in the Bill of Lading specifications and so on at
all. Meaning it is our own private customer — it is Internal — meaning it is internal to us; we
ourselves know this is our customer."

**EMP-199** — `[SRC-B01 ¶15]`
"It may be a natural person at all, it may be a legal entity, but its name is neither in the Bill
of Lading, nor in Shipper, nor in Consignee. Meaning it is a separate thing."

**EMP-200** — `[SRC-B01 ¶16]`
"Okay, now for entering, for example, a Customer — what Options do we need?"

**EMP-201** — `[SRC-B01 ¶17]`
"For example, first of all there is **Name** — Name is either a personal name, for example Arash
Alidadi, or a legal one, company such-and-such."

**EMP-202** — `[SRC-B01 ¶18]`
"**Contact Number**."

**EMP-203** — `[SRC-B01 ¶19]`
"For example, now we go to Name — Arash Alidadi."

**EMP-204** — `[SRC-B01 ¶20]`
"Then, now, a Contact Number, one Email, one Address."

**EMP-205** — `[SRC-B01 ¶21]`
"Now this one — the system itself should give it a Code."

**EMP-206** — `[SRC-B01 ¶22]`
"What should the format of giving the Code be? For example:"

**EMP-207** — `[SRC-B01 ¶23]`
"**CUST 3-3-1**"

**EMP-208** — `[SRC-B01 ¶24]`
"Okay, the next name we write — for example, let's say Kianoush Jowkar."

**EMP-209** — `[SRC-B01 ¶25]`
"Okay, only that Name should be starred, okay — meaning the rest of the Fields should not be
mandatory. If there is something to fill, they fill it; if not, it doesn't matter — meaning it
shouldn't give an Error. Only that Name is important."

**EMP-210** — `[SRC-B01 ¶26]`
"Okay, for example, the next name becomes Kianoush Jowkar."

**EMP-211** — `[SRC-B01 ¶27]`
"I want to add a new Customer named Kianoush Jowkar."

**EMP-212** — `[SRC-B01 ¶28]`
"The system itself gives it the next number:"

**EMP-213** — `[SRC-B01 ¶29]`
"**CUST 3SF-2**"

**EMP-214** — `[SRC-B01 ¶30]`
"Next, for example, Siroos such-and-such, Ali Mahmoudi."

**EMP-215** — `[SRC-B01 ¶31]`
"The system itself automatically gives it another number, gives it a Code:"

**EMP-216** — `[SRC-B01 ¶32]`
"**CUST 3SF-3**"

**EMP-217** — `[SRC-B01 ¶33]`
"And so on in order — the Customers go up and get numbered."

**EMP-218** — `[SRC-B01 ¶34]`
"Okay, we said Customers — what Options are needed for that **Data Entry**?"

**EMP-219** — `[SRC-B01 ¶35]`
"One is Name — only it should be starred, that's it."

**EMP-220** — `[SRC-B01 ¶36]`
"That Code too — the system gives it automatically."

**EMP-221** — `[SRC-B01 ¶37]`
"Contact Number and Email and Address should also be among the Options — meaning filling them is
not obligatory."

**EMP-222** — `[SRC-B01 ¶38]`
"**CUST 2SF-1** — now **2SF-1, 3SF-1** — whatever it writes, and the next one **3SF-2**, the next
**3SF-3**, **3SF-4**, **3SF-5** — and so on, up to for example a thousand Customers, two thousand,
three thousand, whatever you have — this gets registered and then it comes into the List."

**EMP-223** — `[SRC-B01 ¶39]`
"Then it comes into the List."

**EMP-224** — `[SRC-B01 ¶40]`
"Now we put **Edit**, we put **Delete**, we put a **Status** — whatever you put there, it specifies
it in that List itself."

**EMP-225** — `[SRC-B01 ¶41]`
"For example, that **Type** section, and I don't know, **Currency** and **TRN Number** and so on —
those are not there; there is no need to bring them into the Customer information."

**EMP-226** — `[SRC-B01 ¶42]`
"Okay, that Currency and the gear and those things belong to the Accounting part of it, which we'll
explain later."

**EMP-227** — `[SRC-B01 ¶43]`
"So adding a Customer here is only:"

**EMP-228** — `[SRC-B01 ¶44]`
"**Name**"

**EMP-229** — `[SRC-B01 ¶45]`
"Now **Contact Number, Email, Address**"

**EMP-230** — `[SRC-B01 ¶46]`
"And that Code."

**EMP-231** — `[SRC-B01 ¶47]`
"The Code — well, the system gives it itself."

**EMP-232** — `[SRC-B01 ¶48]`
"Its format must be like this:"

**EMP-233** — `[SRC-B01 ¶49]`
"**CUST 3.1**"

**EMP-234** — `[SRC-B01 ¶50]`
"For example, the next Customer:"

**EMP-235** — `[SRC-B01 ¶51]`
"**3.2, 3.3, 3.4**"

**EMP-236** — `[SRC-B01 ¶52]`
"Okay, then when we want to go and see these Customer Lists — so the Customers are in such a state
that now, for example, its Customer, its Status, now it has an Edit, it has a Delete, whatever it
has."

**EMP-237** — `[SRC-B01 ¶53]`
"That **Type** section, and I don't know, **Currency** and **TRN Number** and **Short Name** and
those things — there is no need for them at all."

**EMP-238** — `[SRC-B01 ¶54]`
"That's the end of the Customer section."

> **TN:** Note the three different Customer code formats given within this one clip
> (`CUST 3-3-1`, `CUST 3SF-2`, `CUST 3.1`). The employer is clearly improvising the example. The
> *substantive* requirement is: a system-generated sequential code with a `CUST` prefix. The
> formatting is recorded as an unresolved decision, not a contradiction in business meaning.

---
### Source `SRC-B02` — `audio_2026-09-14_04-59-40.txt` (04:59:40) — Ports and abbreviations

---

**EMP-239** — `[SRC-B02 ¶1]`
"Okay, after Customer we get to, for example, registering Ports — the ports."

**EMP-240** — `[SRC-B02 ¶2]`
"Okay, in the Port section, we write the Port's name. Okay, because later in the Bill of Lading,
when it writes **Port of Loading** or **Port of Discharge** — meaning now the loading port or the
discharge port — you must write the Port's name."

**EMP-241** — `[SRC-B02 ¶3]`
"Then its Format is like this: comma with a space, Space, for example the city name, again a comma
with a space, the country name."

**EMP-242** — `[SRC-B02 ¶4]`
"For example, now we want to register Bandar Abbas port — for example we want to register Rajaee
port. What is the Port's name? For example, Rajaee."

**EMP-243** — `[SRC-B02 ¶5]`
"Okay, where is its address? It becomes like this — that, for example:"

**EMP-244** — `[SRC-B02 ¶6]`
"**Bandar Abbas, Persian Gulf, Iran**"

**EMP-245** — `[SRC-B02 ¶7]`
"For example, like this."

**EMP-246** — `[SRC-B02 ¶8]`
"Now, for example, for Bushehr we want to register:"

**EMP-247** — `[SRC-B02 ¶9]`
"**Bushehr, Persian Gulf, Iran**"

**EMP-248** — `[SRC-B02 ¶10]`
"Or some such state."

**EMP-249** — `[SRC-B02 ¶11]`
"For example, for Hamriyah Port Dubai we register:"

**EMP-250** — `[SRC-B02 ¶12]`
"**Hamriyah Port, Dubai, UAE**"

**EMP-251** — `[SRC-B02 ¶13]`
"Like this."

**EMP-252** — `[SRC-B02 ¶14]`
"Now we want to register, for example, the one for Sohar port."

**EMP-253** — `[SRC-B02 ¶15]`
"Okay, for example it becomes:"

**EMP-254** — `[SRC-B02 ¶16]`
"**Port of Sohar, Oman**"

**EMP-255** — `[SRC-B02 ¶17]`
"Then what does it become for it? For example Oman — its country name becomes Oman."

**EMP-256** — `[SRC-B02 ¶18]`
"Okay, now for the codes, we must consider an Abbreviation for it. For example, an abbreviated
state."

**EMP-257** — `[SRC-B02 ¶19]`
"Okay, because the Load List — the Load List takes up a lot of space — so because of that, here we
consider an Abbreviation for that Port name."

**EMP-258** — `[SRC-B02 ¶20]`
"So that when we want to look at the Load List and so on, the origin Port and the destination Port
are written as an Abbreviation — meaning abbreviated — not that the full Port name is written."

**EMP-259** — `[SRC-B02 ¶21]`
"Because it takes up a lot of space and it empties out a lot of the space — because of that."

**EMP-260** — `[SRC-B02 ¶22]`
"Okay, so what do we do for Port? We write a Port name — now its city and its country — and that
Abbreviation, or now to put it the same way, that Code — which we use from this Code in the Load
List, in the Load List display, when we want to enter the Data for entering a new Cargo, we Select
that Port and port and Destination."

**EMP-261** — `[SRC-B02 ¶23]`
"For example, it says:"

**EMP-262** — `[SRC-B02 ¶24]`
"**Hamriyah Port, Dubai, UAE**"

**EMP-263** — `[SRC-B02 ¶25]`
"For example, we Select this."

**EMP-264** — `[SRC-B02 ¶26]`
"Then when we want to come and look in that List, it says, for example, **Port of Loading** — now
here, instead of it saying Hamriyah Port, Dubai, for example we defined an Abbreviation for it:"

**EMP-265** — `[SRC-B02 ¶27]`
"**HAM**"

**EMP-266** — `[SRC-B02 ¶28]`
"For example, Hamriyah — there it says **HAM**, not that it has written Hamriyah Port, Dubai in
full."

**EMP-267** — `[SRC-B02 ¶29]`
"Okay?"

**EMP-268** — `[SRC-B02 ¶30]`
"Now this Port name — now this can all be starred, okay — meaning the Port name should be starred,
its city should be starred, its Country too should be starred — and that Code of it, that we
ourselves want to set an Abbreviation for, that should also be starred."

**EMP-269** — `[SRC-B02 ¶31]`
"Then we click **Create Port** — the Port is registered."

**EMP-270** — `[SRC-B02 ¶32]`
"That's its Port section too."

---

### Source `SRC-B03` — `audio_2026-09-14_05-00-18.txt` (05:00:18) — Yards

---

**EMP-271** — `[SRC-B03 ¶1]`
"Okay, now for entering **Yard**s."

**EMP-272** — `[SRC-B03 ¶2]`
"When are Yards useful to us?"

**EMP-273** — `[SRC-B03 ¶3]`
"When we want to take delivery of a Cargo — to see which Port we took delivery in and which Yard we
discharged it into."

**EMP-274** — `[SRC-B03 ¶4]`
"In that section of Data that we want to enter, for **Operations** and I don't know **Yard
Inventory** and those things — this discharge **Location** of that goods is important."

**EMP-275** — `[SRC-B03 ¶5]`
"Now I'll say we define it here."

**EMP-276** — `[SRC-B03 ¶6]`
"When we want to define the Yards — that we only specify which Port it belongs to and what the
Yard's name is."

**EMP-277** — `[SRC-B03 ¶7]`
"For example:"

**EMP-278** — `[SRC-B03 ¶8]`
"**Port Hamriyah — Yard F15**"

**EMP-279** — `[SRC-B03 ¶9]`
"Done — that alone is enough."

---

### Source `SRC-B04` — `audio_2026-09-14_05-00-51.txt` (05:00:51) — Yard selection cascades from Port

---

**EMP-280** — `[SRC-B04 ¶1]`
"Okay, when we want to Select it — for example, when we take delivery of a Cargo, suppose there it
says **Port of Loading**."

**EMP-281** — `[SRC-B04 ¶2]`
"We want to do a Data Entry, we want to register a Cargo."

**EMP-282** — `[SRC-B04 ¶3]`
"Okay, the Cargo we want to register — one of its Options is the loading Port — what its loading
port is."

**EMP-283** — `[SRC-B04 ¶4]`
"For example, we select **Hamriyah**."

**EMP-284** — `[SRC-B04 ¶5]`
"The moment we selected Hamriyah, the Yards that we previously registered under the name Hamriyah
— is, meaning… of course, they come up."

**EMP-285** — `[SRC-B04 ¶6]`
"Now, for example, **B15**, **B16**, **B17** — whatever it is — we register it there."

**EMP-286** — `[SRC-B04 ¶7]`
"Meaning the Yards that belong to Hamriyah come up automatically."

**EMP-287** — `[SRC-B04 ¶8]`
"Or, for example, the Yards that we saved for **Jebel Ali** — automatically come up."

**EMP-288** — `[SRC-B04 ¶9]`
"The Yards that, for example, we registered for **Rajai / Bandar Abbas** — automatically come up."

**EMP-289** — `[SRC-B04 ¶10]`
"There we Select it."

> **TN:** The Yard codes in this clip (`B15/B16/B17`) differ from that in `EMP-278` (`F15`). Both
> are illustrative examples, not conflicting rules.

---

### Source `SRC-B05` — `audio_2026-09-14_05-01-56.txt` (05:01:56) — Vessels, Tug & Barge, Voyage numbering

---

**EMP-290** — `[SRC-B05 ¶1]`
"Okay, after Yard we get to **Vessels** — meaning the ships."

**EMP-291** — `[SRC-B05 ¶2]`
"Okay, for the vessels we can consider the vessel's name — **Vessel Name**."

**EMP-292** — `[SRC-B05 ¶3]`
"And now if they have anything else, then… now the vessels are divided into a few types."

**EMP-293** — `[SRC-B05 ¶4]`
"Now either they are **Tug & Barge** — which becomes **Tug** and **Barge** — or they are **Landing
Craft** — or now they are **Vessel**."

**EMP-294** — `[SRC-B05 ¶5]`
"These we can now write both as **Tug Name** and **Barge Name**, or we can write only Vessel Name."

**EMP-295** — `[SRC-B05 ¶6]`
"And also that we consider an Option — an IMO Number — for it too."

**EMP-296** — `[SRC-B05 ¶7]`
"IMO Number too… [passage unclear]. It doesn't matter at all — just the vessel's name and its
specifications."

**EMP-297** — `[SRC-B05 ¶8]`
"Now I'm saying we have two models of vessels — it must either be **Tug & Barge**, which writes:"

**EMP-298** — `[SRC-B05 ¶9]`
"**Tug Name / Barge Name**"

**EMP-299** — `[SRC-B05 ¶10]`
"Or, for example:"

**EMP-300** — `[SRC-B05 ¶11]`
"**Vessel Name / Landing Craft Name**"

**EMP-301** — `[SRC-B05 ¶12]`
"Something like that."

**EMP-302** — `[SRC-B05 ¶13]`
"Okay, **Load List**, Loading List, Print."

**EMP-303** — `[SRC-B05 ¶14]`
"Suppose we want to say that, look, for example 20 machines — their document work is ready."

**EMP-304** — `[SRC-B05 ¶15]`
"Now we want to bring them into their Loading List."

**EMP-305** — `[SRC-B05 ¶16]`
"We prepared the Loading List."

**EMP-306** — `[SRC-B05 ¶17]`
"Now we want to link it to a vessel."

**EMP-307** — `[SRC-B05 ¶18]`
"For example, we say that, look, these 20 machines are for the vessel **Mahdi Yazd**."

**EMP-308** — `[SRC-B05 ¶19]`
"We take a Print of this and give it to the Operators."

**EMP-309** — `[SRC-B05 ¶20]`
"The Operators — now according to the Loading List we gave them — that, look, such-and-such machine
entered on this date, this many Packages accompany it, it is in this Yard."

**EMP-310** — `[SRC-B05 ¶21]`
"We want to say, for example, now it is the Load List of the vessel **Mahdi Yazd**."

**EMP-311** — `[SRC-B05 ¶22]`
"We listed 20 machines for it to be loaded onto Mahdi Yazd."

**EMP-312** — `[SRC-B05 ¶23]`
"And where else is this vessel's name useful?"

**EMP-313** — `[SRC-B05 ¶24]`
"In the Bill of Lading."

**EMP-314** — `[SRC-B05 ¶25]`
"In issuing the Bill of Lading — issuing the Bill of Lading and the Manifest — it should give them
automatically."

**EMP-315** — `[SRC-B05 ¶26]`
"For example, suppose Mahdi Yazd in the year 2026 — this is now its first trip going to
Khorramshahr."

**EMP-316** — `[SRC-B05 ¶27]`
"So when we are issuing the Khorramshahr Bill of Lading, **Vessel Mahdi Yazd**, for example,
becomes:"

**EMP-317** — `[SRC-B05 ¶28]`
"**Voyage 1/26**"

**EMP-318** — `[SRC-B05 ¶29]`
"If it is its second time in 2026 that it is going to Khorramshahr, for example it becomes:"

**EMP-319** — `[SRC-B05 ¶30]`
"**Voyage 2/26**"

**EMP-320** — `[SRC-B05 ¶31]`
"Meaning the system itself must give this automatically."

**EMP-321** — `[SRC-B05 ¶32]`
"If it is its third time, for example it becomes:"

**EMP-322** — `[SRC-B05 ¶33]`
"**Voyage 3/26**"

**EMP-323** — `[SRC-B05 ¶34]`
"Okay, this must be defined **separately for each Destination**."

**EMP-324** — `[SRC-B05 ¶35]`
"That the system itself must…"

**EMP-325** — `[SRC-B05 ¶36]`
"For example, Mahdi Yazd's next trip may go to Bandar Abbas."

**EMP-326** — `[SRC-B05 ¶37]`
"It goes to Bandar Abbas for the first time."

**EMP-327** — `[SRC-B05 ¶38]`
"So in the Bandar Abbas programme, for example, the vessel name becomes Mahdi Yazd, its Voyage
becomes **Voyage 1/26**."

**EMP-328** — `[SRC-B05 ¶39]`
"What does that mean?"

**EMP-329** — `[SRC-B05 ¶40]`
"So when you wanted to issue the Khorramshahr Bill of Lading, you selected, for example, the name
Mahdi Yazd — its Voyage itself must automatically come:"

**EMP-330** — `[SRC-B05 ¶41]`
"**Voyage 5/26**"

**EMP-331** — `[SRC-B05 ¶42]`
"Meaning, look, it is the fifth time in 2026 that it is going towards Khorramshahr."

**EMP-332** — `[SRC-B05 ¶43]`
"The Manifest too — now those Details at the top of it that we want to enter — one of its options
is the vessel name, of course."

**EMP-333** — `[SRC-B05 ¶44]`
"The vessel name and Voyage — these Manifest Details must definitely be stated."

**EMP-334** — `[SRC-B05 ¶45]`
"Okay, now what Options do we need here to add the vessel names?"

**EMP-335** — `[SRC-B05 ¶46]`
"Same as what I said:"

**EMP-336** — `[SRC-B05 ¶47]`
"Just the vessel name."

**EMP-337** — `[SRC-B05 ¶48]`
"Now if it is **Tug & Barge**, it should write:"

**EMP-338** — `[SRC-B05 ¶49]`
"**Tug Name / Barge Name**"

**EMP-339** — `[SRC-B05 ¶50]`
"And if it is a Landing Craft or a vessel, then now it is specified:"

**EMP-340** — `[SRC-B05 ¶51]`
"**Vessel Name**"

**EMP-341** — `[SRC-B05 ¶52]`
"It has one name."

**EMP-342** — `[SRC-B05 ¶53]`
"Put an **IMO Number** for it too."

**EMP-343** — `[SRC-B05 ¶54]`
"IMO Number is also part of its thing — it should be among its Options, not among the… starred."

**EMP-344** — `[SRC-B05 ¶55]`
"Meaning if we have it, we enter it; if we don't have it, it shouldn't give an Error — it should
register."

---

### Source `SRC-B06` — `audio_2026-09-14_05-02-13.txt` (05:02:13) — Shippers

---

**EMP-345** — `[SRC-B06 ¶1]`
"The next option is **Shippers**."

**EMP-346** — `[SRC-B06 ¶2]`
"Shippers — well, that's obvious. The first data registered in the Bill of Lading is the
**Shipper**."

**EMP-347** — `[SRC-B06 ¶3]`
"The Shipper's information must also be like this:"

**EMP-348** — `[SRC-B06 ¶4]`
"**Name**"

**EMP-349** — `[SRC-B06 ¶5]`
"For example National ID — or, for example, some countries don't have a National ID, they have a
**TRN Number** — now, or they have anything else."

**EMP-350** — `[SRC-B06 ¶6]`
"**National ID / TRN Number**"

**EMP-351** — `[SRC-B06 ¶7]`
"**Address**"

**EMP-352** — `[SRC-B06 ¶8]`
"**Contact Number**"

**EMP-353** — `[SRC-B06 ¶9]`
"**Email**"

**EMP-354** — `[SRC-B06 ¶10]`
"These should be among its Options."

**EMP-355** — `[SRC-B06 ¶11]`
"If there is something, they write it; if not, for example, it shouldn't give an Error."

**EMP-356** — `[SRC-B06 ¶12]`
"Only that company name — natural or legal — that one should be starred."

**EMP-357** — `[SRC-B06 ¶13]`
"The rest of the items should be among the Options — meaning, for example, optional."

---

### Source `SRC-B07` — `audio_2026-09-14_05-02-40.txt` (05:02:40) — When Shipper is used

---

**EMP-358** — `[SRC-B07 ¶1]`
"When is this Shipper useful?"

**EMP-359** — `[SRC-B07 ¶2]`
"When we want to issue a Bill of Lading — the first data we must enter is its Shipper."

**EMP-360** — `[SRC-B07 ¶3]`
"Shipper — the Shipper's specifications."

**EMP-361** — `[SRC-B07 ¶4]`
"In the Manifest too, one of the options is Shipper — which we select there."

---

### Source `SRC-B08` — `audio_2026-09-14_05-02-53.txt` (05:02:53) — Consignees

---

**EMP-362** — `[SRC-B08 ¶1]`
"**Consignee** is exactly the same thing as **Shipper** — the same information."

**EMP-363** — `[SRC-B08 ¶2]`
"Okay, **Consignee** — now it's either a natural person or a legal entity."

**EMP-364** — `[SRC-B08 ¶3]`
"So for Consignee we must write a **Name**."

**EMP-365** — `[SRC-B08 ¶4]`
"Then **National ID** or **TRN Number**. Now, for example, this can be written in one row, or you
can separate them with a Slash."

**EMP-366** — `[SRC-B08 ¶5]`
"If we have the **National ID**, we enter its National ID; if we have its **TRN Number**, we enter
its TRN Number."

**EMP-367** — `[SRC-B08 ¶6]`
"**National ID / TRN Number**"

**EMP-368** — `[SRC-B08 ¶7]`
"In other words:"

**EMP-369** — `[SRC-B08 ¶8]`
"**Address**"

**EMP-370** — `[SRC-B08 ¶9]`
"**Contact Number**"

**EMP-371** — `[SRC-B08 ¶10]`
"**Email**"

**EMP-372** — `[SRC-B08 ¶11]`
"Done."

---

### Source `SRC-B09` — `audio_2026-09-14_05-03-16.txt` (05:03:16) — Agents; end of Master Data

---

**EMP-373** — `[SRC-B09 ¶1]`
"Okay, the last stage — the other Option that we add in this Master Data — is **Agents**."

**EMP-374** — `[SRC-B09 ¶2]`
"The Agent's Details too, again in the same way — for example as:"

**EMP-375** — `[SRC-B09 ¶3]`
"**Name**"

**EMP-376** — `[SRC-B09 ¶4]`
"**Address**"

**EMP-377** — `[SRC-B09 ¶5]`
"**Contact Number**"

**EMP-378** — `[SRC-B09 ¶6]`
"**Email**"

**EMP-379** — `[SRC-B09 ¶7]`
"This Agent Data must be stated in the Bill of Lading."

**EMP-380** — `[SRC-B09 ¶8]`
"Now, for example, the Bandar Abbas Agent — in the Bandar Abbas Bills of Lading; the Agent, for
example, of Bushehr — in the Bushehr Bills of Lading."

**EMP-381** — `[SRC-B09 ¶9]`
"The Agent for each destination is different — which, of course, is stated in the Bills of Lading
related to that same destination."

**EMP-382** — `[SRC-B09 ¶10]`
"Okay, we've reached the Master Data stage."

**EMP-383** — `[SRC-B09 ¶11]`
"This is a set of Data that we must save as default, because we must use these in various places."

---

### Source `SRC-B10` — `audio_2026-09-14_05-03-32.txt` (05:03:32) — Customer vs Shipper/Consignee; ETOZ; Job Number; Ledger

---

**EMP-384** — `[SRC-B10 ¶1]`
"Okay, look — each of these must be defined separately."

**EMP-385** — `[SRC-B10 ¶2]`
"Because a Customer may, for example, not be our Shipper, not be our Consignee."

**EMP-386** — `[SRC-B10 ¶3]`
"Customer is a separate natural or legal person who is in contact with us privately."

**EMP-387** — `[SRC-B10 ¶4]`
"It's possible that, for example, our customer is in contact with us by telephone."

**EMP-388** — `[SRC-B10 ¶5]`
"Now they may have gone and, for example, from China or the UAE or now any other country, bought a
machine, bought something."

**EMP-389** — `[SRC-B10 ¶6]`
"Our Shipper, for example, becomes that selling company."

**EMP-390** — `[SRC-B10 ¶7]`
"You see? Whose information we must bring into the Bill of Lading."

**EMP-391** — `[SRC-B10 ¶8]`
"Our Consignee too becomes — now whoever that company at the destination wants to put on the
document — now whatever they want to write."

**EMP-392** — `[SRC-B10 ¶9]`
"Okay, in the Customer section we have nothing to do with this Shipper and Consignee and blah and
those things."

**EMP-393** — `[SRC-B10 ¶10]`
"Customer is directly the person we are in contact with and for whom we issue the statement."

**EMP-394** — `[SRC-B10 ¶11]`
"Now, for example, let's say we have a customer — suppose we have a customer — they give us a
machine in Australia."

**EMP-395** — `[SRC-B10 ¶12]`
"Okay, they tell us: look, deliver this to us in Khorramshahr."

**EMP-396** — `[SRC-B10 ¶13]`
"Who is our Customer?"

**EMP-397** — `[SRC-B10 ¶14]`
"For example, it's Arash Alidadi. Done, that's it."

**EMP-398** — `[SRC-B10 ¶15]`
"So this machine is registered in our system under the name of Arash Alidadi."

**EMP-399** — `[SRC-B10 ¶16]`
"We only know Arash Alidadi."

**EMP-400** — `[SRC-B10 ¶17]`
"Now that Australian company — who is the Shipper?"

**EMP-401** — `[SRC-B10 ¶18]`
"Then again, who is the Consignee?"

**EMP-402** — `[SRC-B10 ¶19]`
"It separates."

**EMP-403** — `[SRC-B10 ¶20]`
"We pick it up from there and bring it to Jebel Ali, for example, UAE."

**EMP-404** — `[SRC-B10 ¶21]`
"We clear it from Jebel Ali."

**EMP-405** — `[SRC-B10 ¶22]`
"We bring it to Hamriyah Port Dubai."

**EMP-406** — `[SRC-B10 ¶23]`
"We load it from Hamriyah Port Dubai."

**EMP-407** — `[SRC-B10 ¶24]`
"We send this to Khorramshahr."

**EMP-408** — `[SRC-B10 ¶25]`
"This is ETOZ."

**EMP-409** — `[SRC-B10 ¶26]`
"From the moment we hit Start until, for example, we deliver it — a set of expenses are incurred
frequently and repeatedly."

**EMP-410** — `[SRC-B10 ¶27]`
"Suppose, look, repair costs — or, for example, vessel cost, clearance cost, low-bed cost, moving
cost — whatever it is."

**EMP-411** — `[SRC-B10 ¶28]`
"From the moment this Start is registered and this thing is recorded — like a **Job Number** state,
like a **Job Number** state, like a note-taking state, like a Note state — that, look, we take
notes: from day one, what has been spent on this."

**EMP-412** — `[SRC-B10 ¶29]`
"Job Number, Job Number, Invoice."

**EMP-413** — `[SRC-B10 ¶30]`
"Now we want to say, for example, Mr Arash as our Customer — when we want to issue an Invoice for
him — we use this Job Number like a Note, of course."

**EMP-414** — `[SRC-B10 ¶31]`
"Come here — for example, a thousand dirhams was spent on Repairing; a thousand dirhams on Jebel
Ali clearance; a thousand dirhams on the low-bed until it came to Hamriyah; then again here, for
example, 500 dirhams was spent on customs documents; and again, for example, 10,000 dirhams was
spent until it reached Khorramshahr."

**EMP-415** — `[SRC-B10 ¶32]`
"Okay, when we issue this Invoice — in whose name is the Invoice issued?"

**EMP-416** — `[SRC-B10 ¶33]`
"Meaning this Invoice is issued in our system for Arash Alidadi, who is our Customer."

**EMP-417** — `[SRC-B10 ¶34]`
"Okay, now it's possible that the Details inside it — for example, Arash says, look, write this
Bill of Lading in the name of, for example, such-and-such company."

**EMP-418** — `[SRC-B10 ¶35]`
"Okay, that doesn't matter any more."

**EMP-419** — `[SRC-B10 ¶36]`
"For the Bill of Lading, whatever they want, we write it for them."

**EMP-420** — `[SRC-B10 ¶37]`
"Whatever name they want it to be."

**EMP-421** — `[SRC-B10 ¶38]`
"Once we've issued the statement, this goes and sits in Arash Alidadi's profile."

**EMP-422** — `[SRC-B10 ¶39]`
"For example, we issued an Invoice for him — it goes as Sales into his Ledger section and sits
there; it sits, for example, as Debit in his account."

**EMP-423** — `[SRC-B10 ¶40]`
"For example, in total, look, from this ETOZ it became forty thousand dirhams."

**EMP-424** — `[SRC-B10 ¶41]`
"Okay, this should come and sit in Arash Alidadi's system."

**EMP-425** — `[SRC-B10 ¶42]`
"Now the rest of the customers follow the same pattern."

**EMP-426** — `[SRC-B10 ¶43]`
"Each of them should have a Profile — so that when I, for example, enter Arash Alidadi, I go into
Arash's Profile, and see, look, how many Invoices I have issued for him, how much money he has
given us, how much he is in debt, how much he is owed."

**EMP-427** — `[SRC-B10 ¶44]`
"His account's Credit and Debit — how much time has passed since the last statement we issued for
him."

**EMP-428** — `[SRC-B10 ¶45]`
"Whether he has paid his statement — it's Paid, it's Unpaid, or it's a Partial Payment."

**EMP-429** — `[SRC-B10 ¶46]`
"Something like that."

**EMP-430** — `[SRC-B10 ¶47]`
"That's why I'm saying — look, this Customer is completely separate from the Shipper and the
Consignee and the rest of the information."

**EMP-431** — `[SRC-B10 ¶48]`
"Customer is an Internal thing — meaning it is internal, and it is only for us."

---
### Source `SRC-B11` — `audio_2026-09-14_05-05-14.txt` (05:05:14) — Operations: Cargo registration, Inspection, Load List, B/L, Manifest, output

---

**EMP-432** — `[SRC-B11 ¶1]`
"Okay, now the stage after this Master Data that we entered — we go to my first main section, which
is the same **Operations**."

**EMP-433** — `[SRC-B11 ¶2]`
"Operations means operations."

**EMP-434** — `[SRC-B11 ¶3]`
"Okay, its first option says **Cargo**."

**EMP-435** — `[SRC-B11 ¶4]`
"Okay, when is this? When we want to Register a goods item."

**EMP-436** — `[SRC-B11 ¶5]`
"Firstly, we took delivery somewhere — one of the ports around the world — for example a machine,
Cargo, a container, something we took delivery of for moving."

**EMP-437** — `[SRC-B11 ¶6]`
"Okay, in this section, when we enter it, we must enter a set of data so this Cargo gets
registered."

**EMP-438** — `[SRC-B11 ¶7]`
"Okay, when we want to register the first Cargo — meaning when we click **New Cargo** — these
Options, the fields, should come up so we can fill them."

**EMP-439** — `[SRC-B11 ¶8]`
"The first important thing is the **Customer**."

**EMP-440** — `[SRC-B11 ¶9]`
"Let's see whose this goods, this Cargo, this commodity is — meaning which of our customers it
belongs to."

**EMP-441** — `[SRC-B11 ¶10]`
"For example, we want to say this goods belongs to Arash Alidadi."

**EMP-442** — `[SRC-B11 ¶11]`
"Okay, this Arash Alidadi — we entered him previously in that Master Data."

**EMP-443** — `[SRC-B11 ¶12]`
"Now that we want to register a Cargo, the first thing that should come up must be Customer."

**EMP-444** — `[SRC-B11 ¶13]`
"Whose is this Cargo? For example, it belongs to Arash Alidadi."

**EMP-445** — `[SRC-B11 ¶14]`
"Okay, what is it? We must add a set of Options here so this data gets registered, so this Cargo
gets registered."

**EMP-446** — `[SRC-B11 ¶15]`
"Okay, the first thing we must consider in the section for Registering a Cargo — the first thing
must be that this Customer is specified."

**EMP-447** — `[SRC-B11 ¶16]`
"Let's see our customer — meaning this machine, Cargo or Container, whatever we took delivery of
somewhere — whose is it; meaning it goes to whose account."

**EMP-448** — `[SRC-B11 ¶17]`
"This Customer here — that place where we had the data in Master Data, where we were entering the
Customers — here it must come up so we can Select it."

**EMP-449** — `[SRC-B11 ¶18]`
"Now either we write its name or, for example, we write its code and Search — it comes up — we
Select it."

**EMP-450** — `[SRC-B11 ¶19]`
"The next Option is **Shipper Name**."

**EMP-451** — `[SRC-B11 ¶20]`
"We must write the Shipper's name."

**EMP-452** — `[SRC-B11 ¶21]`
"And, look, from what… [inaudible] we took delivery of this."

**EMP-453** — `[SRC-B11 ¶22]`
"**Port of Loading** — where is its loading port?"

**EMP-454** — `[SRC-B11 ¶23]`
"**Port of Destination** — meaning that port which is the goods' destination."

**EMP-455** — `[SRC-B11 ¶24]`
"Let's consider a **Description** for it — the description of the goods."

**EMP-456** — `[SRC-B11 ¶25]`
"**Chassis Number**"

**EMP-457** — `[SRC-B11 ¶26]`
"**Serial Number**"

**EMP-458** — `[SRC-B11 ¶27]`
"**Number of Units**"

**EMP-459** — `[SRC-B11 ¶28]`
"**Number of Packages**"

**EMP-460** — `[SRC-B11 ¶29]`
"How many machines there are, how many Packages."

**EMP-461** — `[SRC-B11 ¶30]`
"For example, it's possible we take one machine and three or four Nagle accompany it."

**EMP-462** — `[SRC-B11 ¶31]`
"**Weight**"

**EMP-463** — `[SRC-B11 ¶32]`
"Then that **Weight Unit** must also be specified — which is mainly Kilogram."

**EMP-464** — `[SRC-B11 ¶33]`
"And **Arrival Date** — the date we received it."

**EMP-465** — `[SRC-B11 ¶34]`
"**Yard**."

**EMP-466** — `[SRC-B11 ¶35]`
"Okay, here, for example, when we are selecting Port of Loading and, for example, Hamriyah — those
Yards that we previously entered in Master Data for Hamriyah — those Yards come up automatically,
of course."

**EMP-467** — `[SRC-B11 ¶36]`
"Meaning when we select the Port, automatically their Yard names come up and here we Select."

**EMP-468** — `[SRC-B11 ¶37]`
"Okay, the next Option is **Document Status**."

**EMP-469** — `[SRC-B11 ¶38]`
"Look, with what documents did this come and enter the Port?"

**EMP-470** — `[SRC-B11 ¶39]`
"For example, it had **EXID**, it had **BCC**, it was a **Local Transfer**."

**EMP-471** — `[SRC-B11 ¶40]`
"Now this, the guys enter manually — what type of Document it is."

**EMP-472** — `[SRC-B11 ¶41]`
"The next stage is its **Inspection** — its inspection."

**EMP-473** — `[SRC-B11 ¶42]`
"For example, generally the Dubai customs — when, look, you take delivery of a goods item, of
something, in the customs and you want to carry out loading — you must prepare its Documents, its
customs papers."

**EMP-474** — `[SRC-B11 ¶43]`
"Then, for example, you **Book** an inspection slot."

**EMP-475** — `[SRC-B11 ¶44]`
"Technically they say **Book Inspection**."

**EMP-476** — `[SRC-B11 ¶45]`
"You pay its amount and you also Book its time."

**EMP-477** — `[SRC-B11 ¶46]`
"And when its inspection time arrives, they carry out the inspection."

**EMP-478** — `[SRC-B11 ¶47]`
"And Pending too — the text itself."

**EMP-479** — `[SRC-B11 ¶48]`
"That Pending text itself — for example, you can consider it red — so that in that Load Status,
in that general section, for example, for example, in Yard Inventory it is specified that, look,
its Inspection has not been done."

**EMP-480** — `[SRC-B11 ¶49]`
"And its last option — of course — is **Loading Date / Loading Time** — its loading time, which we
specify: its Arrival Date was this, when was its Loading Time."

**EMP-481** — `[SRC-B11 ¶50]`
"That we need it when we want to pay its **Storage**, its warehousing — the **Number of Days** —
when we want to look at its Number of Days, to know how many days this has been in the Port and we
want to go and calculate its warehousing — we need to know this."

**EMP-482** — `[SRC-B11 ¶51]`
"Now we must consider a Comment here."

**EMP-483** — `[SRC-B11 ¶52]`
"Absolutely, absolutely, absolutely."

**EMP-484** — `[SRC-B11 ¶53]`
"Why?"

**EMP-485** — `[SRC-B11 ¶54]`
"Because, for example, sometimes a set of expenses are incurred for one machine, one customer —
and when it is brought into the Comment, this prevents it from being forgotten."

**EMP-486** — `[SRC-B11 ¶55]`
"Then these Comments — for example, where are they useful? For when we want to issue the customer's
statement in the Accounting section."

**EMP-487** — `[SRC-B11 ¶56]`
"That accountant sees these Comments."

**EMP-488** — `[SRC-B11 ¶57]`
"For example, they see that, look, this machine that came — we paid its Transport cost, we paid its
customs cost."

**EMP-489** — `[SRC-B11 ¶58]`
"If it needed any repairs inside the Port — for example, we did it, we paid for it."

**EMP-490** — `[SRC-B11 ¶59]`
"This, the operations guys write in the Comment section — meaning that employee to whose account
they are responsible for these things writes it in that Comment."

**EMP-491** — `[SRC-B11 ¶60]`
"And then that accountant, automatically, when they want to issue their statements, can read these
Comments."

**EMP-492** — `[SRC-B11 ¶61]`
"And there is no longer any need for asking questions and, for example, scattering here and there
and making inquiries and, you know, those things."

**EMP-493** — `[SRC-B11 ¶62]`
"These Comments."

**EMP-494** — `[SRC-B11 ¶63]`
"Okay, then after we've entered this data, the Cargo is Registered."

**EMP-495** — `[SRC-B11 ¶64]`
"For example, it comes into this List of the Cargos themselves."

**EMP-496** — `[SRC-B11 ¶65]`
"Okay, now that this Cargo List is written and it's specified that, look, this customer of ours —
now we have a List."

**EMP-497** — `[SRC-B11 ¶66]`
"For example, who are the Customers? Arash Alidadi, Kianoush Jowkar."

**EMP-498** — `[SRC-B11 ¶67]`
"Well, then it's specified — look, this machine is such-and-such, its Chassis Number is
such-and-such."

**EMP-499** — `[SRC-B11 ¶68]`
"Suppose, for example, Hamriyah to Khorramshahr."

**EMP-500** — `[SRC-B11 ¶69]`
"Okay, these must have a set of Filters inside them."

**EMP-501** — `[SRC-B11 ¶70]`
"Why? Because when, for example, I as management want to decide which destination to assign this
vessel, this craft to — meaning, for example, where to load and assign it to which destination —
this must specify for me that, look, we have 30 machines for Khorramshahr."

**EMP-502** — `[SRC-B11 ¶71]`
"For example, for destination Bushehr — suppose, for example, we have 10 machines. For destination
Bandar Abbas, for example, we have 10 machines."

**EMP-503** — `[SRC-B11 ¶72]`
"Okay, so it's natural that I immediately assign the vessel to Khorramshahr."

**EMP-504** — `[SRC-B11 ¶73]`
"Okay, when we want to do the Khorramshahr loading — suppose, look, the vessel has come and berthed
at one of the Hamriyah berths."

**EMP-505** — `[SRC-B11 ¶74]`
"Okay, here the employees gather the documents, they do the Inspection work."

**EMP-506** — `[SRC-B11 ¶75]`
"Okay, when they've done the Inspection work — in that Inspection section, for example, the state
is Done."

**EMP-507** — `[SRC-B11 ¶76]`
"Now you have to place a Select option, something there — that this employee there selects that its
Inspection has been done."

**EMP-508** — `[SRC-B11 ¶77]`
"Okay, the machines and Cargos whose Inspection has been done are the necessary condition for
entering into that Loading List's account."

**EMP-509** — `[SRC-B11 ¶78]`
"Now what is the Loading List?"

**EMP-510** — `[SRC-B11 ¶79]`
"A vessel — the vessel names that, for example, we previously entered in those Master Data — they
are useful to us here."

**EMP-511** — `[SRC-B11 ¶80]`
"We prepare a Loading List, we take a Print and hand it to the loading Operators, so they start
loading."

**EMP-512** — `[SRC-B11 ¶81]`
"Okay, now for example the Loading List option — the Loading List can help us with this: that,
look, if a machine has not been Inspected, automatically don't bring it for it — don't allow us to
select it for the Loading List."

**EMP-513** — `[SRC-B11 ¶82]`
"For example, give an Error."

**EMP-514** — `[SRC-B11 ¶83]`
"What should its Error be?"

**EMP-515** — `[SRC-B11 ¶84]`
"That, look, for example, we haven't done its Inspection."

**EMP-516** — `[SRC-B11 ¶85]`
"If they have done its Inspection and it has gone from the Pending state to the Done state and it
is registered — that is the precondition for us to be able to select it for the Loading List."

**EMP-517** — `[SRC-B11 ¶86]`
"Okay, suppose, for example, out of the total of our Yard Inventories that are fifty, for example
twenty of them are for Khorramshahr."

**EMP-518** — `[SRC-B11 ¶87]`
"Okay, out of those twenty that are for Khorramshahr, suppose twenty of them have had their
Inspection done and are ready to enter the Loading List."

**EMP-519** — `[SRC-B11 ¶88]`
"Okay, we prepare the Loading List."

**EMP-520** — `[SRC-B11 ¶89]`
"What must the Loading List include?"

**EMP-521** — `[SRC-B11 ¶90]`
"It includes a set of information that we entered previously, of course."

**EMP-522** — `[SRC-B11 ¶91]`
"Okay, for example:"

**EMP-523** — `[SRC-B11 ¶92]`
"Loading port, destination port, Description, Chassis Number, Serial Number, number of machines,
number of Packages, Weight, arrival date, Yard and those things."

**EMP-524** — `[SRC-B11 ¶93]`
"And its Inspection is Done."

**EMP-525** — `[SRC-B11 ¶94]`
"So that we take a Print of these and give it to the Operator — and the Operators know this machine
that is, for example, in such-and-such Yard in Hamriyah — its Inspection has also been done and it
is ready for loading."

**EMP-526** — `[SRC-B11 ¶95]`
"Okay, this List — for example those twenty — we took a Print and handed it over."

**EMP-527** — `[SRC-B11 ¶96]`
"Well, these have a set of other fine details too."

**EMP-528** — `[SRC-B11 ¶97]`
"Suppose, suppose that on the first night the vessel comes and we want to start loading — out of
the total of these 20 machines, now we want to prepare a Loading List and give it to the Operators
so they start loading."

**EMP-529** — `[SRC-B11 ¶98]`
"Then suppose that on the first night, for example, out of these 20, we Inspected 7 of them and 7
are ready for loading."

**EMP-530** — `[SRC-B11 ¶99]`
"Okay, this Loading List that we create — we Create it — 7 machines come into our Load List."

**EMP-531** — `[SRC-B11 ¶100]`
"We take a Print, we give it to the Operators to load."

**EMP-532** — `[SRC-B11 ¶101]`
"Okay, tomorrow we prepare the remaining 13 — for example tomorrow — again we say we Edit the same
Loading List, we also add those other 13 to it."

**EMP-533** — `[SRC-B11 ¶102]`
"We Print it in one go, we give it to the Operators so they know, for example, those 7 from
yesterday have been loaded, 13 others have also become ready for loading."

**EMP-534** — `[SRC-B11 ¶103]`
"Okay, when the loading is finished and the Operators announce to us that, for example, out of this
List of twenty you handed us, we managed to load 19 of them."

**EMP-535** — `[SRC-B11 ¶104]`
"For example, one of them for whatever reason we could not load — either there was no space, or it
was broken, or the Crane had a problem, or whatever."

**EMP-536** — `[SRC-B11 ¶105]`
"One of them remained."

**EMP-537** — `[SRC-B11 ¶106]`
"This one must have the ability to be removed from the Loading List and go back into the Yard
Inventory and that Cargo section — that same one — to remain available for, for example, the next
Trip, the next vessel, the next loading."

**EMP-538** — `[SRC-B11 ¶107]`
"Okay, once this Load List is completed and it's specified and Finalized and the Load List is
closed — or, for example, this vessel Mahdi 11 out of this total of, for example, 20 machines
available, has loaded 19 of them — okay, now these 19 go to the stage of issuing the Bill of
Lading and Manifest."

**EMP-539** — `[SRC-B11 ¶108]`
"Okay, these 19 that we have — well, each of them belongs to a Customer."

**EMP-540** — `[SRC-B11 ¶109]`
"Okay, now each Bill of Lading we want to issue:"

**EMP-541** — `[SRC-B11 ¶110]`
"Shipper, Consignee, Bill of Lading number."

**EMP-542** — `[SRC-B11 ¶111]`
"For example, the Bill of Lading number must be specified for each destination — for example,
according to the form we gave it, it should Generate it, of course."

**EMP-543** — `[SRC-B11 ¶112]`
"For example, for Khorramshahr we wrote — suppose:"

**EMP-544** — `[SRC-B11 ¶113]`
"**KHS/26-2/2026**"

**EMP-545** — `[SRC-B11 ¶114]`
"Or, for example, if we want to issue a Bill of Lading for Rajaee:"

**EMP-546** — `[SRC-B11 ¶115]`
"**RJS/26-10**"

**EMP-547** — `[SRC-B11 ¶116]`
"The dash… for example, this 10 is the Bill of Lading that we issued in the year 2026 for Rajaee."

**EMP-548** — `[SRC-B11 ¶117]`
"Okay, once we've also brought all the Details of the Bill of Lading — look, we entered the
Shippers previously in the Master Data."

**EMP-549** — `[SRC-B11 ¶118]`
"Here we Select."

**EMP-550** — `[SRC-B11 ¶119]`
"Consignee likewise — we entered it previously, we issue it, we select it."

**EMP-551** — `[SRC-B11 ¶120]`
"Notify Party likewise."

**EMP-552** — `[SRC-B11 ¶121]`
"The vessel name — the Voyage, of course, the system itself must automatically detect which trip
number of this vessel it is that we are… Khorramshahr…"

**EMP-553** — `[SRC-B11 ¶122]`
"Loading Port — we entered it previously — here we Select."

**EMP-554** — `[SRC-B11 ¶123]`
"Destination Port likewise."

**EMP-555** — `[SRC-B11 ¶124]`
"Okay, we get to that Bill of Lading format which, for example, has a **Quantity** section, has
quantity, has **Marks & Numbers**, has Description, has net weight, has gross weight, has **CBM**."

**EMP-556** — `[SRC-B11 ¶125]`
"Then at the bottom of it, for example, it has Total."

**EMP-557** — `[SRC-B11 ¶126]`
"Shipper, the goods, whatever the customer has in mind, should be stated in the Shipper."

**EMP-558** — `[SRC-B11 ¶127]`
"Then it has **Place of B/L Issue**."

**EMP-559** — `[SRC-B11 ¶128]`
"That **Freight Charges** — now the **Collect** or **Prepaid** section — it must have."

**EMP-560** — `[SRC-B11 ¶129]`
"Date — for example, the Bill of Lading issue date."

**EMP-561** — `[SRC-B11 ¶130]`
"That Stamp section of it — or, for example, a set of explanations that the conventions and
international laws of the Bill of Lading — according to that same form we give it, the Bill of
Lading should be issued."

**EMP-562** — `[SRC-B11 ¶131]`
"Okay, the Bill of Lading… the first thing when the Bill of Lading is issued — it must be in
**Draft** state."

**EMP-563** — `[SRC-B11 ¶132]`
"That, for example, its Watermark section says **DRAFT** and we send it to the customer to check."

**EMP-564** — `[SRC-B11 ¶133]`
"If, for example, it needs corrections — adding or removing a set of information — they announce it
to us."

**EMP-565** — `[SRC-B11 ¶134]`
"And then, when it's Final, finished, Approved — the Bill of Lading is issued and comes out of the
Draft state."

**EMP-566** — `[SRC-B11 ¶135]`
"Okay, once it has come out of the Draft state — well, now afterwards what do we want to do?"

**EMP-567** — `[SRC-B11 ¶136]`
"We want to issue the Manifest, of course."

**EMP-568** — `[SRC-B11 ¶137]`
"We want to issue the Manifest and hand it to, for example, the vessel."

**EMP-569** — `[SRC-B11 ¶138]`
"Okay, the Manifest too — according to that same format of ours that, for example, we enter into
the system."

**EMP-570** — `[SRC-B11 ¶139]`
"Vessel name, its Voyage, for example its Manifest Number according to that same format we want,
date, for example loading, loading port, exit port, and a set of other Data."

**EMP-571** — `[SRC-B11 ¶140]`
"Also, for example, we have put our own shipping company's name and specifications in the middle
there."

**EMP-572** — `[SRC-B11 ¶141]`
"If you want, we Upload that same Format that we have into the system."

**EMP-573** — `[SRC-B11 ¶142]`
"Okay, its Titles too — of course, which include, for example, the row, the description of the
goods — then, for example, Consignee, Shipper, weight, quantity — which in the end the number of
Manifest pages — for example two pages, three pages, whatever it is."

**EMP-574** — `[SRC-B11 ¶143]`
"The last page also gives us a Total Weight, Total Quantity — that, look, Total this many machines
and this many Packages with this much Weight have been loaded, for example."

**EMP-575** — `[SRC-B11 ¶144]`
"Okay, when we want… whether the PDF of the Bill of Lading — this must give us an output, of
course, for the Bills of Lading."

**EMP-576** — `[SRC-B11 ¶145]`
"Now either it gives us an Excel output and a PDF output."

**EMP-577** — `[SRC-B11 ¶146]`
"Whichever of them is needed now."

**EMP-578** — `[SRC-B11 ¶147]`
"If we want PDF, it gives PDF; if we also want Excel, it gives Excel."

**EMP-579** — `[SRC-B11 ¶148]`
"Or, for example, it directly takes a PDF."

**EMP-580** — `[SRC-B11 ¶149]`
"When we want to take a PDF, those Stamps and Marks and signatures must automatically be in the
system."

**EMP-581** — `[SRC-B11 ¶150]`
"Meaning there, itself — when we want to take the PDF of the Bill of Lading — it has applied those
Stamps itself; meaning they are ready."

**EMP-582** — `[SRC-B11 ¶151]`
"But when we want to take a Print — meaning we want to apply a live Stamp or a live seal — then it
must automatically remove those."

**EMP-583** — `[SRC-B11 ¶152]`
"So that, for example, that live Stamp is applied."

**EMP-584** — `[SRC-B11 ¶153]`
"Okay, we send the Bill of Lading to the customer."

**EMP-585** — `[SRC-B11 ¶154]`
"Likewise the Manifest — which we Print, apply a live stamp, and hand to the captain."

**EMP-586** — `[SRC-B11 ¶155]`
"We also send a PDF copy of it to the destination Agent."

---

### Source `SRC-B12` — `audio_2026-09-14_05-05-37.txt` (05:05:37) — Manifest structure and totals

---

**EMP-587** — `[SRC-B12 ¶1]`
"What is the Manifest information like?"

**EMP-588** — `[SRC-B12 ¶2]`
"The Manifest information — at its header there is a set of Data: the vessel name — now either
**Tug & Barge** or that it is a **Landing Craft** — one name and its **Voyage**, the loading port,
the discharge port and the Manifest number."

**EMP-589** — `[SRC-B12 ¶3]`
"The Manifest number — which each time, uniquely, each time the system must automatically, according
to the format we give it, give a new number itself."

**EMP-590** — `[SRC-B12 ¶4]`
"Okay, our Manifest Titles."

**EMP-591** — `[SRC-B12 ¶5]`
"After these top Details — the row — is the Bill of Lading number."

**EMP-592** — `[SRC-B12 ¶6]`
"Okay, according to those Bills of Lading that have been issued — for example, for this vessel, for
this Khorramshahr — this must, in order, for example number 1, 2, 3, 4 — like that, according to
those Bill of Lading numbers, it should write."

**EMP-593** — `[SRC-B12 ¶7]`
"Then we get to the **description of the goods**, their Shipper, their Consignee."

**EMP-594** — `[SRC-B12 ¶8]`
"Okay, these Bills of Lading that were issued previously — they have a description of the goods, of
course."

**EMP-595** — `[SRC-B12 ¶9]`
"For example, one such-and-such machine — **Excavator PC400** — Excavator with this Chassis
Number."

**EMP-596** — `[SRC-B12 ¶10]`
"Then its Shipper, its Consignee, its quantity, its weight."

**EMP-597** — `[SRC-B12 ¶11]`
"Its quantity is the total, of course."

**EMP-598** — `[SRC-B12 ¶12]`
"Meaning, for example, its machine must be specified, its Nagle must also be specified —
separately."

**EMP-599** — `[SRC-B12 ¶13]`
"That, look, for example, this is one machine, plus two Nagle."

**EMP-600** — `[SRC-B12 ¶14]`
"Then at the end it also gives us a Total — that, for example, this many machines and this many
Nagle and the weight, in total this much, have been loaded onto this vessel."

---
### Source `SRC-B13` — `audio_2026-09-14_05-06-35.txt` (05:06:35) — Accounting: Jobs, Invoices, VAT, Ledger, Documents, Release/Delivery, Agent portal, Reports

---

**EMP-601** — `[SRC-B13 ¶1]`
"Okay, we get to the **Accounting** section."

**EMP-602** — `[SRC-B13 ¶2]`
"Okay, the Accounting section here really… for example, we have many Options."

**EMP-603** — `[SRC-B13 ¶3]`
"First of all — for every Invoice — meaning before we want to issue the Invoice — we must consider
a **Job** to the account — for example, writing a Note for every machine or now whatever work we
take delivery of."

**EMP-604** — `[SRC-B13 ¶4]`
"It assigns a **Job Number** to it."

**EMP-605** — `[SRC-B13 ¶5]`
"Okay, we specify that Job Number's Customer — and now **ETDZ** — every expense we incurred for the
Cargo, come, put it into this Job Number."

> **TN:** The employer says "ETDZ" here and "ETOZ" in `EMP-054` / `EMP-408`. Same concept,
> inconsistent transliteration in the transcripts.

**EMP-606** — `[SRC-B13 ¶6]`
"Okay, the next stage is these Invoices."

**EMP-607** — `[SRC-B13 ¶7]`
"Okay, we can issue these Invoices in two ways."

**EMP-608** — `[SRC-B13 ¶8]`
"One is that those Bills of Lading that have been issued and that we have sent to the customer —
their Invoice must automatically come into **Draft** — it becomes like a Draft state."

**EMP-609** — `[SRC-B13 ¶9]`
"So that then I come and check it against the related Job Numbers — Match all of them."

**EMP-610** — `[SRC-B13 ¶10]`
"And now, for example, in the format we have:"

**EMP-611** — `[SRC-B13 ¶11]`
"**Description of goods, Rate, quantity, VAT and the total amount which includes VAT.**"

**EMP-612** — `[SRC-B13 ¶12]`
"Then in its Total section, we write the total amount separately, the VAT amount separately."

**EMP-613** — `[SRC-B13 ¶13]`
"For example, like:"

**EMP-614** — `[SRC-B13 ¶14]`
"**Subtotal, VAT and Total Amount**"

**EMP-615** — `[SRC-B13 ¶15]`
"This too we must consider."

**EMP-616** — `[SRC-B13 ¶16]`
"Now this… how do I say it?"

**EMP-617** — `[SRC-B13 ¶17]`
"There are a set of invoices that have VAT, and a set of invoices that don't have VAT."

**EMP-618** — `[SRC-B13 ¶18]`
"The ones that have VAT — later, for example, at that time when we want to send the tax list — the
system should automatically show us that, look, in this quarter — for example February, March and
April — these twenty invoices had VAT, their VAT amount is this much, the total VAT amount is, for
example, this much."

**EMP-619** — `[SRC-B13 ¶19]`
"This much we collected."

**EMP-620** — `[SRC-B13 ¶20]`
"Or, for example, such-and-such invoices included VAT — we paid their VAT."

**EMP-621** — `[SRC-B13 ¶21]`
"So that when we want to send this VAT report, we know how much VAT we paid, how much VAT we
received."

**EMP-622** — `[SRC-B13 ¶22]`
"That this is needed for the quarterly reports."

**EMP-623** — `[SRC-B13 ¶23]`
"Okay, these Invoices — one is that those Bills of Lading that we issued — here after being
**Issued** — meaning after being issued:"

**EMP-624** — `[SRC-B13 ¶24]`
"**Invoice Draft**"

**EMP-625** — `[SRC-B13 ¶25]`
"Draft Invoice — 4, 5 Lines — whatever Rate — based on the Job Numbers we previously assigned — we
can issue these Invoices."

**EMP-626** — `[SRC-B13 ¶26]`
"There is another model of this Invoice — which is the normal Invoice."

**EMP-627** — `[SRC-B13 ¶27]`
"Now, for example, suppose we want to issue an Invoice for a customer just like that, outside the
topic of the Bill of Lading and Job Number and those things."

**EMP-628** — `[SRC-B13 ¶28]`
"Okay, this too I must consider."

**EMP-629** — `[SRC-B13 ¶29]`
"Now the Invoice that is issued — each Invoice belongs to a Customer, of course."

**EMP-630** — `[SRC-B13 ¶30]`
"This automatically goes and sits in the Customer's Profile and Ledger account — as **Debit**."

**EMP-631** — `[SRC-B13 ¶31]`
"It sits as Debit."

**EMP-632** — `[SRC-B13 ¶32]`
"So that in total — when now a payment of something wants to take place — it goes into the Ledger
account and sits as **Credit**."

**EMP-633** — `[SRC-B13 ¶33]`
"After these Invoices…"

**EMP-634** — `[SRC-B13 ¶34]`
"Now these Invoices must have a set of Details, of course."

**EMP-635** — `[SRC-B13 ¶35]`
"The number of this Invoice."

**EMP-636** — `[SRC-B13 ¶36]`
"For example, the number of this Invoice."

**EMP-637** — `[SRC-B13 ¶37]`
"Then let me say this… which customer it belongs to."

**EMP-638** — `[SRC-B13 ¶38]`
"The Bill of Lading specifications — its description."

**EMP-639** — `[SRC-B13 ¶39]`
"Or, for example, if it was previously specified for that Bill of Lading — it was issued for this
Bill of Lading — which Manifest it belongs to."

**EMP-640** — `[SRC-B13 ¶40]`
"Its issue date."

**EMP-641** — `[SRC-B13 ¶41]`
"Its payment deadline date."

**EMP-642** — `[SRC-B13 ¶42]`
"Now, if after this Invoice, for example, it has been paid — the amount that has been paid from it,
or it is a Partial Payment, or it hasn't been paid — these should be specified."

**EMP-643** — `[SRC-B13 ¶43]`
"Then **Proforma Invoice**."

**EMP-644** — `[SRC-B13 ¶44]`
"This Invoice — which now, based on that same Format of ours — we Upload its Excel, for example —
and we enter the Data based on that Format we want."

**EMP-645** — `[SRC-B13 ¶45]`
"**Quotation** likewise."

**EMP-646** — `[SRC-B13 ¶46]`
"**Delivery Order, Release Order, Vouchers, Salary** and that **Ledger** section."

**EMP-647** — `[SRC-B13 ¶47]`
"The Ledger section should not necessarily all be for those Customers."

**EMP-648** — `[SRC-B13 ¶48]`
"Why?"

**EMP-649** — `[SRC-B13 ¶49]`
"Because, for example, when we want to give these annual Tax reports — or suppose we want to record
the office expenses — this Ledger — for example, the office expenses must also be in that same
Ledger, of course."

**EMP-650** — `[SRC-B13 ¶50]`
"So we understand how much VAT we spent — we record its daily entries."

**EMP-651** — `[SRC-B13 ¶51]`
"The **Salary** section too — of course, we define the employees."

**EMP-652** — `[SRC-B13 ¶52]`
"Like a Salary state."

**EMP-653** — `[SRC-B13 ¶53]`
"A **Salary Slip** must be issued for each of their months."

**EMP-654** — `[SRC-B13 ¶54]`
"The Voucher section — of course, we have two types of Voucher."

**EMP-655** — `[SRC-B13 ¶55]`
"One is the **Payment Voucher**, one is the **Receipt Voucher**."

**EMP-656** — `[SRC-B13 ¶56]`
"It should be specified which Customer it is."

**EMP-657** — `[SRC-B13 ¶57]`
"Meaning whether we want to make a Payment, or we want to give a Receipt — meaning we have received
money."

**EMP-658** — `[SRC-B13 ¶58]`
"First of all, this Customer must be specified — which Customer this belongs to."

**EMP-659** — `[SRC-B13 ¶59]`
"And then, once we've specified that this money we took — for example, was for this specific
Invoice, was for a specific Bill of Lading number — if we specified these, then, of course, it
automatically goes and sits in their account."

**EMP-660** — `[SRC-B13 ¶60]`
"And if we haven't written anything — for example, it shouldn't give an Error — it goes and sits in
their Ledger system as Credit."

**EMP-661** — `[SRC-B13 ¶61]`
"Which then gives the Balance accordingly."

**EMP-662** — `[SRC-B13 ¶62]`
"That, look, for this Customer — for example, we now create a Ledger Statement for them."

**EMP-663** — `[SRC-B13 ¶63]`
"Which we then give a range to — for example, such-and-such month to such-and-such month,
such-and-such date to such-and-such date."

**EMP-664** — `[SRC-B13 ¶64]`
"It gives us the Statement — that, look, this many statements have been issued for them, how much
they have paid, for example how much their Balance is."

**EMP-665** — `[SRC-B13 ¶65]`
"Okay, the **Release Order** and **Delivery Order** section."

**EMP-666** — `[SRC-B13 ¶66]`
"Delivery Order relates to the goods that we brought — for example, we discharged them in our own
port and now we want to issue a Delivery Order and give it to the customer, of course."

**EMP-667** — `[SRC-B13 ¶67]`
"Together with the other documents we hand it to the customer — so they go and deliver it in the
name of the Consignee — so they go and get the machine, now come and clear their Cargo and take
it."

**EMP-668** — `[SRC-B13 ¶68]`
"This Delivery Order likewise — of course."

**EMP-669** — `[SRC-B13 ¶69]`
"For example, its Customer should be specified."

**EMP-670** — `[SRC-B13 ¶70]`
"Each of these has a number, has a date."

**EMP-671** — `[SRC-B13 ¶71]`
"And now the Delivery Order that is specific to that Port — that, for example, we state inside it
that the Port is such-and-such."

**EMP-672** — `[SRC-B13 ¶72]`
"And that account — a standard Delivery Order state — is issued and Printed, is Stamped, and
together with the other documents is handed to the customer."

**EMP-673** — `[SRC-B13 ¶73]`
"Okay, the **Release Order** section."

**EMP-674** — `[SRC-B13 ¶74]`
"The Bills of Lading that are issued — the Manifest — and then the craft moves, reaches the
destination, is discharged."

**EMP-675** — `[SRC-B13 ¶75]`
"There a warehouse receipt is issued and the documents stay with the Agent until such time as, for
example, we announce this Release to that Agent — that, look, such-and-such Bill of Lading with
these specifications has been **Released** — and you can hand the documents to the Consignee too."

**EMP-676** — `[SRC-B13 ¶76]`
"Now here we must consider a mechanism — that we ourselves, to the account, give the Agents an
access."

**EMP-677** — `[SRC-B13 ¶77]`
"They see their own port."

**EMP-678** — `[SRC-B13 ¶78]`
"Likewise, separately, they see their own Bills of Lading and Manifests — for example, their own
port's."

**EMP-679** — `[SRC-B13 ¶79]`
"Meaning look — Khorramshahr only sees what belongs to Khorramshahr, Bushehr only sees what belongs
to Bushehr, Bandar Abbas only sees what belongs to Bandar Abbas."

**EMP-680** — `[SRC-B13 ¶80]`
"There they see, of course, that, look, they see the Bills of Lading related to themselves."

**EMP-681** — `[SRC-B13 ¶81]`
"In the Release Order section too — of course, it is specified."

**EMP-682** — `[SRC-B13 ¶82]`
"For example, there is a Bill of Lading number — now, for example, Consignee, description of the
goods, and that section, for example, now the tick that needs to be specified as a Mark."

**EMP-683** — `[SRC-B13 ¶83]`
"Or, for example, its Status writes **Released**."

**EMP-684** — `[SRC-B13 ¶84]`
"These things."

**EMP-685** — `[SRC-B13 ¶85]`
"Okay, its payment section should also be specified for the accountant."

**EMP-686** — `[SRC-B13 ¶86]`
"This must also have a Payment section."

**EMP-687** — `[SRC-B13 ¶87]`
"It should be specified that, look, this document we released — the customer has paid in full, it's
Paid — the Invoice related to this Release Order has been paid."

**EMP-688** — `[SRC-B13 ¶88]`
"Or, for example, they took it on credit — it's Unpaid."

**EMP-689** — `[SRC-B13 ¶89]`
"Or that it's a **Partial Payment** — they paid a part of it, and they must pay a part of it
later."

**EMP-690** — `[SRC-B13 ¶90]`
"This should be specified."

**EMP-691** — `[SRC-B13 ¶91]`
"So that later we can, for example, quickly Follow-up."

**EMP-692** — `[SRC-B13 ¶92]`
"That if this Invoice has been Released and they took it on credit — for example, now within one or
two weeks — it gives us a warning there, so we can talk to the customer there so they make their
payment."

**EMP-693** — `[SRC-B13 ¶93]`
"Okay, now we get to the **Reports** stage."

**EMP-694** — `[SRC-B13 ¶94]`
"Reports."

**EMP-695** — `[SRC-B13 ¶95]`
"We must specify a mechanism — that for every vessel — meaning every Manifest that is closed towards
a destination — now Khorramshahr, Bushehr, Bandar Abbas, wherever — towards whatever destination
this Manifest is closed — we consider the vessel's expenses."

**EMP-696** — `[SRC-B13 ¶96]`
"For example, vessel charter, **Port Use** costs, **Handling**, **Lashing**, and now its
miscellaneous costs — we consider them."

**EMP-697** — `[SRC-B13 ¶97]`
"Okay, what does its income become?"

**EMP-698** — `[SRC-B13 ¶98]`
"The total sum of the Invoice amounts — the statements issued for its Bills of Lading — becomes its
income."

**EMP-699** — `[SRC-B13 ¶99]`
"So that when you subtract these from each other, the profit and loss of one vessel, of one
Manifest is obtained."

**EMP-700** — `[SRC-B13 ¶100]`
"This Report is very important — that we know, look, for each Manifest that has been closed, how
much we spent, how much, for example, income we had."

**EMP-701** — `[SRC-B13 ¶101]`
"Now its profit and loss is specified."

**EMP-702** — `[SRC-B13 ¶102]`
"So that when we want to, for example, do the annual Tax — without trouble and using a few Filters
we can bring out that profit and loss statement and those things in general."

---

### Source `SRC-B14` — `audio_2026-09-14_05-06-46.txt` (05:06:46) — Payment Voucher ID card and signature

---

**EMP-703** — `[SRC-B14 ¶1]`
"For example, in the **Voucher** section — when we want to pay money — the **Payment** section must
have two blank places, two Options built into it."

**EMP-704** — `[SRC-B14 ¶2]`
"That, for example, that **ID Card** of the recipient — as, for example, a document and receipt —
should be built in there."

**EMP-705** — `[SRC-B14 ¶3]`
"Which now either we take a photo, or we Upload it, or, for example, it Take Photos from the back
and front of their ID Card."

**EMP-706** — `[SRC-B14 ¶4]`
"When we want to give them the money and issue a receipt for them — we Upload their ID Card or its
photo, or we take a photo of it — it should be uploaded there."

**EMP-707** — `[SRC-B14 ¶5]`
"And then we take a signature from the recipient."

---

### Source `SRC-B15` — `audio_2026-09-14_05-07-11.txt` (05:07:11) — Salary Slip ID card and signature

---

**EMP-708** — `[SRC-B15 ¶1]`
"The **Salary Slip** section is the same way."

**EMP-709** — `[SRC-B15 ¶2]`
"If, for example, one or two days before the end of each month, when we prepare the Salary Slip —
the place for the scan of that employee's **ID Card** — front and back — must be there."

**EMP-710** — `[SRC-B15 ¶3]`
"Which now either it is as an Upload — meaning they Upload the ready photo from within the system —
or they take a photo directly through the Camera, from front and back — and it is in that Salary
Slip of theirs."

**EMP-711** — `[SRC-B15 ¶4]`
"So that when the Print is taken, the output is taken — those ID Cards are specified — and that
employee signs below it."

**EMP-712** — `[SRC-B15 ¶5]`
"Meaning they have actually received the money."

---

### Source `SRC-B16` — `audio_2026-09-14_05-07-29.txt` (05:07:29) — "Company Archive" title

---

**EMP-713** — `[SRC-B16 ¶1]`
"Title: 'Company Archive'"

> **TN:** This clip is a single 38-byte line. It is a content heading the employer dictated for the
> UI. It implies an archive / company-archive area, but no further detail is given anywhere in the
> transcript set. Recorded as an unresolved topic (see `open-questions.md`, ARCH-01).

---

### Source `SRC-B17` — `audio_2026-09-14_05-07-41.txt` (05:07:41) — General Journal, daily entries, office expenses

---

**EMP-714** — `[SRC-B17 ¶1]`
"One of the other items is the daily entries."

**EMP-715** — `[SRC-B17 ¶2]`
"For example, when those Customer Profiles, the Customer Ledgers — it must have the ability that,
even without issuing this Invoice, we can, for example, add to it there."

**EMP-716** — `[SRC-B17 ¶3]`
"For example, a **General Journal** — money that, for example, we paid to a person or received from
a person, outside the scope of the main work — and we want, now, for example, it to be as a loan —
we want to bring it into their Ledger."

**EMP-717** — `[SRC-B17 ¶4]`
"Such an Option should be put in the Ledger — that we can add a General Journal to it."

**EMP-718** — `[SRC-B17 ¶5]`
"Now, if we have made a payment to a person — we bring it into their account, into that Ledger
section of theirs — as **Debit**."

**EMP-719** — `[SRC-B17 ¶6]`
"And if a person has paid something to us — we bring it into their account as **Credit**."

**EMP-720** — `[SRC-B17 ¶7]`
"Those daily expenses and office expenses and the company's running costs — we must definitely put a
mechanism in place for them, so these expenses are recorded, and at the end of the year they are
deducted from the income as company expenses."

---

### Source `SRC-B18` — `audio_2026-09-14_05-07-52.txt` (05:07:52) — Output templates and formats

---

**EMP-721** — `[SRC-B18 ¶1]`
"At every stage where we need an output — now whether a PDF output, or an Excel output, or a Print —
we have specific formats and specific shapes."

**EMP-722** — `[SRC-B18 ¶2]`
"For example, we have our own company's special formats — which, for example, we Upload — so it
understands what model of output we want in the **Loading List** section, what Print we want."

**EMP-723** — `[SRC-B18 ¶3]`
"Or, for example, the **Invoice** section, the **Delivery Order** section, the **Release Order**
section, the **Salary Slip** section, **Voucher**, **Payment**, **Receipt** — each of these has a
specific format."

**EMP-724** — `[SRC-B18 ¶4]`
"Or, for example, the **Ledger** section — which Options we want — when we want to take a Print —
what the appearance of that Print should be."

**EMP-725** — `[SRC-B18 ¶5]`
"We Upload these."

---

## Appendix A — Coverage checklist

| Source key | File | Paragraphs covered | Statement IDs |
|---|---|---|---|
| `SRC-A1` | `part1_0-15.txt` | ¶1–¶75 | EMP-001 – EMP-075 |
| `SRC-A2` | `part2_15-end.txt` | ¶1–¶109 | EMP-076 – EMP-184 |
| `SRC-B01` | `audio_2026-09-14_04-57-33.txt` | ¶1–¶54 | EMP-185 – EMP-238 |
| `SRC-B02` | `audio_2026-09-14_04-59-40.txt` | ¶1–¶32 | EMP-239 – EMP-270 |
| `SRC-B03` | `audio_2026-09-14_05-00-18.txt` | ¶1–¶9 | EMP-271 – EMP-279 |
| `SRC-B04` | `audio_2026-09-14_05-00-51.txt` | ¶1–¶10 | EMP-280 – EMP-289 |
| `SRC-B05` | `audio_2026-09-14_05-01-56.txt` | ¶1–¶55 | EMP-290 – EMP-344 |
| `SRC-B06` | `audio_2026-09-14_05-02-13.txt` | ¶1–¶13 | EMP-345 – EMP-357 |
| `SRC-B07` | `audio_2026-09-14_05-02-40.txt` | ¶1–¶4 | EMP-358 – EMP-361 |
| `SRC-B08` | `audio_2026-09-14_05-02-53.txt` | ¶1–¶11 | EMP-362 – EMP-372 |
| `SRC-B09` | `audio_2026-09-14_05-03-16.txt` | ¶1–¶11 | EMP-373 – EMP-383 |
| `SRC-B10` | `audio_2026-09-14_05-03-32.txt` | ¶1–¶48 | EMP-384 – EMP-431 |
| `SRC-B11` | `audio_2026-09-14_05-05-14.txt` | ¶1–¶155 | EMP-432 – EMP-586 |
| `SRC-B12` | `audio_2026-09-14_05-05-37.txt` | ¶1–¶14 | EMP-587 – EMP-600 |
| `SRC-B13` | `audio_2026-09-14_05-06-35.txt` | ¶1–¶102 | EMP-601 – EMP-702 |
| `SRC-B14` | `audio_2026-09-14_05-06-46.txt` | ¶1–¶5 | EMP-703 – EMP-707 |
| `SRC-B15` | `audio_2026-09-14_05-07-11.txt` | ¶1–¶5 | EMP-708 – EMP-712 |
| `SRC-B16` | `audio_2026-09-14_05-07-29.txt` | ¶1 | EMP-713 |
| `SRC-B17` | `audio_2026-09-14_05-07-41.txt` | ¶1–¶7 | EMP-714 – EMP-720 |
| `SRC-B18` | `audio_2026-09-14_05-07-52.txt` | ¶1–¶5 | EMP-721 – EMP-725 |

**Total: 20 files, 725 numbered statements.**

## Appendix B — Topic index (quick lookup by statement IDs)

| Topic | Primary statements |
|---|---|
| Company identity, ports of operation, fleet ownership | EMP-001 – EMP-005 |
| Customer as the central entity; historical manual codes | EMP-006 – EMP-009, EMP-197 – EMP-200, EMP-384 – EMP-431 |
| Yard / warehouse inventory | EMP-010 – EMP-024, EMP-162 – EMP-166, EMP-271 – EMP-289 |
| Load List / Loading List | EMP-014 – EMP-022, EMP-047 – EMP-049, EMP-302 – EMP-311, EMP-508 – EMP-537 |
| Inspection gating | EMP-014, EMP-077 – EMP-078, EMP-472 – EMP-479, EMP-504 – EMP-516 |
| Manifest | EMP-024 – EMP-033, EMP-168 – EMP-172, EMP-567 – EMP-574, EMP-587 – EMP-600 |
| Bill of Lading | EMP-034 – EMP-040, EMP-540 – EMP-566 |
| Partner / forwarder B/Ls in one Manifest | EMP-068 – EMP-074 |
| Job Number / ETOZ costing | EMP-054 – EMP-067, EMP-176 – EMP-178, EMP-411 – EMP-414, EMP-603 – EMP-605 |
| Cargo registration fields | EMP-075 – EMP-076, EMP-432 – EMP-481 |
| Cargo Comments | EMP-079 – EMP-088, EMP-482 – EMP-493 |
| Destination filters for vessel allocation | EMP-042 – EMP-046, EMP-094 – EMP-097, EMP-499 – EMP-503 |
| Invoice structure, Tax Invoice, VAT | EMP-098 – EMP-125, EMP-606 – EMP-642 |
| Ledger, Debit/Credit, Balance, Statement | EMP-130 – EMP-137, EMP-421 – EMP-429, EMP-662 – EMP-664 |
| General Journal, office/daily expenses | EMP-649 – EMP-650, EMP-714 – EMP-720 |
| Release Order, agent notification, credit releases, alerts | EMP-138 – EMP-160, EMP-673 – EMP-692 |
| Delivery Order | EMP-162 – EMP-163, EMP-665 – EMP-672 |
| Agent portal and destination scoping | EMP-153 – EMP-159, EMP-676 – EMP-681 |
| Vouchers, ID card capture, signature | EMP-654 – EMP-661, EMP-703 – EMP-707 |
| Salary and Salary Slip | EMP-651 – EMP-653, EMP-708 – EMP-712 |
| Proforma / Quotation | EMP-643 – EMP-645 |
| Reports: voyage/manifest P&L, VAT report | EMP-126 – EMP-129, EMP-617 – EMP-622, EMP-693 – EMP-702 |
| Output templates, PDF/Excel/Print, stamp rules | EMP-037 – EMP-040, EMP-169 – EMP-172, EMP-575 – EMP-586, EMP-721 – EMP-725 |
| Sidebar / navigation structure | EMP-185 – EMP-194 |
| Master data definitions (Ports, Yards, Vessels, Shippers, Consignees, Agents) | EMP-239 – EMP-383 |
| Company Archive (title only) | EMP-713 |

## Appendix C — Known gaps in this record

1. **No audio was available.** Only the Persian transcripts were available. Where the transcript
   itself marks a passage as unintelligible, this record marks it `[inaudible]`; it cannot be
   recovered from the materials in this repository.
2. **`/home/duna/dunaData/transcripts/` does not exist in this repository.** Several existing
   project documents (notably `docs/plan.md`) name that path as the
   "highest authority" transcript source. It is absent from this checkout; the only transcript
   copies available are the 20 files under `docs/duna-analysis/requirements/`. If the employer has a
   fuller transcript set, statements from it are **not** represented here.
3. **Group A ↔ Group B ordering is inferred, not evidenced** (see §0.2).
4. **`SRC-B16`** is a bare title with no explanatory content.
5. Some clips are separated by gaps of 1–2 minutes (e.g. `SRC-B09` 05:03:32 → `SRC-B11` 05:05:14,
   a 1m42s gap). It is not known whether additional voice material existed in those gaps and was
   not transcribed.
6. **The employer repeatedly promises formats that are not in this repository:**
   "I'll send you the format of these Invoices" (EMP-107), "we have our own company's special
   formats — which we Upload" (EMP-722). Only 7 PDF documents were supplied
   (see [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md)),
   and none of them is a blank/uploadable template.

---

## duna-analysis/01-employer-statements/employer-requirements-analysis.md

# Employer Requirements Analysis

> **Purpose:** Domain-by-domain interpretation of the employer statements. This is the *analysis*
> layer — the raw statements are in
> [`employer-original-statements.en.md`](employer-original-statements.en.md), and the citable
> requirement list is in [`requirements-catalog.md`](requirements-catalog.md).
>
> **Reading order for a new agent:** this file → `requirements-catalog.md` → `open-questions.md`.

---

## 1. What kind of company this is

Duna Shipping LLC is a Dubai-headquartered marine transport operator
(`EMP-001`, `EMP-002`). It moves machinery — civil, construction and general cargo — by sea between
UAE ports and Iranian / regional destinations (`EMP-004`). Two facts shape everything else:

1. **The fleet is partly owned, partly chartered.** Vessels are owned outright, voyage-chartered
   (per trip), or time-chartered for a period (`EMP-003`, `REQ-039`).
2. **The customer, not the shipment, is the organising principle.** The employer opens his whole
   explanation with: "the customer is the main pillar for us" (`EMP-005`), and returns to it at the
   end of the detailed walk-through: "everything of ours is based on Customer" (`EMP-197`).

Consequences that a future agent must internalise:
- Cargo is registered *against a customer first*; every other attribute follows (`REQ-060`).
- Accounting, statements, balances and alerts are all organised per customer (`REQ-150`–`REQ-162`).
- The customer is **not** a document party (`REQ-018`). See §3.

---

## 2. The information architecture the employer asked for

Six sidebar sections, in a fixed order, each expanding as an accordion
(`EMP-185`–`EMP-187`, `REQ-001`, `REQ-002`):

```
Overview
Operations
B/L & Manifest
Accounting
Master Data
Access Control
```

The employer then deliberately walks **Master Data first** (`EMP-188`, `REQ-003`) because, in his
words, master data is entered once and then only *selected*, so that operators stop re-typing it and
making mistakes (`EMP-189`, `EMP-190`, `REQ-201`).

Master Data is exactly seven registers (`EMP-194`, `REQ-010`):
**Customers, Ports, Yards, Vessels, Shippers, Consignees, Agents.**

> **Note for the current system.** The live dashboard's sidebar has a different section set and
> order. See [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md)
> before treating the six-section order as a change request — the employer's six sections were
> dictated against an earlier UI state.

---

## 3. The party model (the most important structural finding)

The employer states this four separate times, in two different transcript groups
(`EMP-198`, `EMP-199`, `EMP-384`–`EMP-393`, `EMP-430`, `EMP-431`). Reduced to one sentence:

> **Customer is Duna's internal commercial counterparty. Shipper and Consignee are documentary
> parties that appear on the Bill of Lading. They are usually three different entities, and the
> Customer's name may never appear on any document.**

The worked example (`EMP-394`–`EMP-408`) is worth memorising:

| Step | Fact |
|---|---|
| Buyer in Australia purchases a machine | → that buyer is Duna's **Customer** |
| The Australian seller | → the **Shipper** on the B/L |
| Whoever the destination party nominates | → the **Consignee** on the B/L |
| Duna picks up, clears at Jebel Ali, truck/low-bed to Hamriyah, loads, ships to Khorramshahr | → the **ETOZ / ETDZ** movement |
| Invoice issued to | → the **Customer** (the Australian buyer) |

Two corollaries the employer states explicitly:
- "For the Bill of Lading, whatever they want, we write it for them" — the customer dictates the
  documentary parties (`EMP-417`–`EMP-420`).
- Adding Type / Currency / TRN / Short Name to Customer is **explicitly rejected**
  (`EMP-225`, `EMP-237`, `REQ-017`).

This is also the single largest **correction** the current system has already absorbed: the party
masters (Shipper / Consignee / Agent) are now separate entities from Customer.

---

## 4. Operations: intake → inspection → load list → B/L → manifest

### 4.1 Intake
Data entry starts "from the moment we take delivery" (`EMP-075`, `EMP-076`, `REQ-202`). The field
list is fixed (`EMP-450`–`EMP-482`, `REQ-061`). Two fields carry hidden weight:

- **Arrival date + loading date** exist mainly so **days in port** can be derived, which is what
  storage/warehousing charges to the port authority are computed from
  (`EMP-018`–`EMP-021`, `EMP-481`, `REQ-069`, `REQ-070`).
- **Comment** is the cross-module channel from operations to accounting
  (`EMP-079`–`EMP-088`, `EMP-482`–`EMP-493`, `REQ-065`–`REQ-067`). The employer demands it three
  times in one breath ("Absolutely, absolutely, absolutely", `EMP-483`).

### 4.2 Inspection as a gate
Inspection is booked and paid for with Dubai customs, then performed (`EMP-473`–`EMP-477`).
**Inspection Done is a hard precondition** for Load List inclusion, and selecting an uninspected
cargo must raise an error saying the inspection has not been done (`EMP-078`, `EMP-512`–`EMP-516`,
`REQ-082`). This is the only hard validation rule the employer spells out in the operations flow.

### 4.3 Load List
Per vessel, printed for the operators (`EMP-014`, `EMP-306`–`EMP-311`). Two behaviours matter:

- **It is editable after creation.** The employer's own worked example: 7 machines inspected and
  loaded on night one; the remaining 13 are appended to the *same* load list the next day and one
  print is taken (`EMP-528`–`EMP-533`, `REQ-092`).
- **Unloaded cargo returns to Yard Inventory** and stays available for a later trip
  (`EMP-016`, `EMP-017`, `EMP-049`, `EMP-534`–`EMP-537`, `REQ-093`).

Destination filters over yard inventory are what management uses to decide where to send a vessel
(`EMP-042`–`EMP-046`, `EMP-094`–`EMP-097`, `REQ-094`).

### 4.4 Bill of Lading
One B/L per loaded cargo item (`EMP-034`–`EMP-036`, `REQ-100`). Content is a conventional B/L
(`EMP-540`–`EMP-561`, `REQ-101`). Numbering is **per destination**
(`EMP-542`–`EMP-547`, `REQ-102`) — the exact format is unresolved (`BL-01`).
Lifecycle: **Draft** (with `DRAFT` watermark, sent to the customer for review) → corrections →
final/approved (`EMP-562`–`EMP-565`, `REQ-104`, `REQ-105`).

### 4.5 Manifest — and the co-loading rule
The manifest consolidates the issued B/Ls for one voyage, rows numbered, with totals for units,
packages and weight on the last page (`EMP-024`–`EMP-033`, `EMP-587`–`EMP-600`,
`REQ-110`–`REQ-112`).

**Co-loading is a structural requirement, not an edge case** (`EMP-068`–`EMP-074`, `REQ-107`):
partner companies and forwarders also load onto Duna's vessel, their B/L *format* and *numbering*
differ from Duna's, and Duna must still be able to put their B/Ls on the manifest — because only one
manifest is issued and Duna is the issuer. Any manifest model that assumes every line is a
Duna-generated B/L will fail in production.

---

## 5. Job costing and ETOZ

**ETOZ / ETDZ** is end-to-end handling: collect abroad → clear → move → deliver
(`EMP-054`–`EMP-059`, `EMP-403`–`EMP-408`, `REQ-131`).

Because expenses on such a job accrue over weeks or months and are entered irregularly
(`EMP-064`, `EMP-065`), the employer needs a **Job Number**: a running cost note per machine from
intake to delivery, so the accountant can see stage-by-stage spend and not lose or double-count items
(`EMP-060`–`EMP-067`, `EMP-176`–`EMP-178`, `REQ-130`, `REQ-133`).

Named cost categories: repair, freight, customs clearance, low-bed transport, crane/loading,
customs documentation, storage (`EMP-104`, `EMP-410`, `EMP-414`, `EMP-696`, `REQ-132`).

---

## 6. Accounting

### 6.1 Invoices
Two creation paths (`EMP-607`, `EMP-608`, `REQ-140`):
1. **Auto-drafted from issued B/Ls**, arriving in Draft and then matched against Job Numbers
   (`EMP-608`, `EMP-609`, `EMP-624`, `EMP-625`, `REQ-141`).
2. **Standalone**, with no B/L or Job link (`EMP-626`–`EMP-628`).

Line structure: Description, Rate, Quantity, VAT %, VAT amount, Amount incl. VAT
(`EMP-112`–`EMP-118`, `EMP-611`, `REQ-142`). Totals block: Subtotal / VAT / Total Amount
(`EMP-612`–`EMP-614`, `REQ-143`). VAT is **per line**, typed as a percentage (`REQ-144`).

The printed document is a **Tax Invoice** — a UAE legal requirement — carrying address, contact
number, email, invoice number, invoice date, payment deadline and TRN (`EMP-106`–`EMP-109`,
`REQ-146`, `REQ-147`).

Some invoices are VAT-able and some are not, and the system must be able to separate them for a
**quarterly VAT report** showing VAT collected vs VAT paid (`EMP-617`–`EMP-622`, `REQ-145`,
`REQ-194`).

Status is Paid / Partial / Unpaid (`EMP-428`, `EMP-642`, `REQ-149`).

### 6.2 Ledger
Issued invoices post as **Debit** under "Sales" in the customer's ledger
(`EMP-120`–`EMP-123`, `EMP-630`, `EMP-631`, `REQ-150`); payments post as **Credit**
(`EMP-132`, `EMP-632`, `REQ-151`); the balance is Debit − Credit (`EMP-133`, `EMP-134`, `REQ-161`).
A **Ledger Statement** is produced over an arbitrary date range (`EMP-662`–`EMP-664`, `REQ-162`).

Three things the ledger is expected to absorb beyond invoicing:
- **General Journal** entries posted directly to a customer ledger — money out = Debit, money in =
  Credit (`EMP-714`–`EMP-719`, `REQ-166`).
- **Office / daily / running costs**, so they can be deducted at year end for the annual tax
  computation (`EMP-647`–`EMP-650`, `EMP-720`, `REQ-167`, `REQ-195`).
- **Unallocated payments**, which must post as Credit and must **not** error
  (`EMP-660`, `REQ-165`).

> The employer never uses the words "chart of accounts" or "double entry". Treating `REQ-166` as a
> mandate for a full double-entry ledger is an **inference**. See `open-questions.md` FIN-01.

### 6.3 Vouchers and salary
Two voucher types (`EMP-654`, `EMP-655`, `REQ-163`). Customer is selected first, then optional
allocation to a specific invoice or B/L number (`EMP-656`–`EMP-659`, `REQ-164`).

**Payment Vouchers require ID-card capture** (front and back, upload or camera) plus the
recipient's signature on the print (`EMP-703`–`EMP-707`, `REQ-168`). **Salary Slips require the
same** (`EMP-708`–`EMP-712`, `REQ-170`), prepared one or two days before month end (`EMP-709`).

---

## 7. Release, Delivery and the Agent portal

**Release Order** is issued after the vessel reaches the destination and discharges, authorising the
destination agent to hand over the documents (`EMP-138`, `EMP-674`, `EMP-675`, `REQ-180`). Each
release records whether the invoice was fully paid, partly paid, or released on credit
(`EMP-142`–`EMP-145`, `EMP-685`–`EMP-689`, `REQ-182`).

A **Release Report** classifies every B/L as Released+Paid / Released+Partial / Released+Unpaid, and
an **alert** fires when a released document stays unpaid — the employer's own illustration is
"released a week ago, no money", and the follow-up window he expects is one to two weeks
(`EMP-146`–`EMP-150`, `EMP-692`, `REQ-183`, `REQ-184`).

**Delivery Order** is the inbound counterpart: after Duna discharges cargo at its own port, it hands
the customer a D/O so the consignee can clear and collect (`EMP-162`, `EMP-163`, `EMP-666`,
`EMP-667`, `REQ-185`); it carries a number, a date, a customer and a port, and is printed and stamped
(`EMP-669`–`EMP-672`, `REQ-186`).

**Agent portal**: agents get their own login and see **only their own destination** — the employer
states the scoping rule twice, verbatim: "Khorramshahr only sees what belongs to Khorramshahr,
Bushehr only sees Bushehr, Bandar Abbas only sees Bandar Abbas"
(`EMP-153`–`EMP-159`, `EMP-676`–`EMP-680`, `REQ-187`). The stated purpose is that agents stop
telephoning Duna to ask whether a B/L has been released (`EMP-153`, `EMP-156`, `EMP-159`,
`REQ-188`).

---

## 8. Reporting

Two reports are required, and both are stated as important:

1. **Per-manifest / per-voyage P&L.** Costs = vessel charter + Port Use + Handling + Lashing +
   miscellaneous. Income = the sum of the invoices issued against that manifest's B/Ls. The
   difference is the trip's profit or loss
   (`EMP-126`–`EMP-129`, `EMP-693`–`EMP-701`, `REQ-190`–`REQ-192`).
2. **Annual tax P&L**, obtained by applying filters over the per-manifest results
   (`EMP-702`, `REQ-193`).

Plus the **quarterly VAT report** (`REQ-194`).

---

## 9. Document output — the counter-intuitive rule

| Output | Stamps / signature |
|---|---|
| **PDF** | Must be **included** automatically |
| **Print** | Must be **removed**, so a live physical stamp can be applied |

Stated in `EMP-039`/`EMP-040`, `EMP-171`/`EMP-172`, `EMP-580`–`EMP-583` (`REQ-121`, `REQ-122`).
Excel output is requested so staff can make manual corrections before issuing (`EMP-037`,
`EMP-169`, `REQ-123`).

The employer also expects to **upload the company's own templates** for Loading List, Invoice,
Delivery Order, Release Order, Salary Slip, Voucher, Payment, Receipt and Ledger
(`EMP-721`–`EMP-725`, `REQ-124`). **None of those templates exist in this repository** (`REQ-125`,
`SRC-02`).

---

## 10. Cross-cutting constraints

- **Optional means optional.** "If we have it we enter it; if we don't have it, it shouldn't give an
  Error" (`EMP-209`, `EMP-344`, `EMP-355`, `EMP-660`, `REQ-200`).
- **Master data is selected, never re-typed** (`EMP-189`, `EMP-190`, `EMP-383`, `REQ-201`).
- **Data is captured at intake, not retrospectively** (`EMP-075`, `EMP-076`, `REQ-202`).
- **Only-name-mandatory for Customer** — and the employer explicitly lists the fields that must
  *not* be there (`EMP-209`, `EMP-225`, `EMP-237`, `REQ-011`, `REQ-017`).

---

## 11. What is *not* in the employer's statements

Useful for calibrating how much of the current system is employer-driven versus invented:

| Not mentioned by the employer | Present in the current system |
|---|---|
| Letters / correspondence | Yes (`/letters`) |
| Employees as a master register (only "Salary" / "Salary Slip") | Yes (`/employees`) |
| Discharge / actual loading as distinct operations | Yes (`/actual-loading`, `/discharges`) |
| Bookings | Yes (`/bookings`) |
| Voyages as a first-class entity (only "voyage number") | Yes (`/voyages`) |
| Currencies as master data | Yes (`currencies` API module) |
| Load planning separate from load list | Yes (nav item, `load-planning` API module) |
| Audit log | Yes (`AuditLog` model) |

These are not contradictions — the employer's brief was a business walk-through, not a specification
— but a future agent should not assume they are employer requirements.

---

## duna-analysis/01-employer-statements/open-questions.md

# Open Questions & Unresolved Decisions

> **Purpose:** Everything a future agent must **not** invent an answer to. Each item records what is
> known, what is missing, and why it matters.
>
> Two sources feed this document:
> 1. **Q01–Q160** — the pre-existing Persian discovery questionnaire at
>    `docs/source-material/business-analysis.md`
>    (28 topic sections). This document does **not** reprint them; it states, per section, how far
>    the available evidence already answers them.
> 2. **Own findings** — ambiguities found while building this knowledge base (IDs below).

---

## 0. Status summary

| Disposition | Count | Meaning |
|---|---|---|
| **Answered by evidence** | ~55 of 160 | The transcripts and/or the 7 real documents settle it. |
| **Partially answered** | ~40 of 160 | Direction is clear; the exact value/threshold/format is not. |
| **Not answered at all** | ~65 of 160 | Nothing in the repository addresses it. Must go back to the employer. |

> The counts are approximate. They are derived from the coverage tables in §2, which are
> reproducible against the transcript set.

---

## 1. Own findings — ambiguity register

| ID | Area | Question | What is known | Blocker / risk |
|---|---|---|---|---|
| **CUST-01** | Customer code | What is the exact customer code format? | Prefix `CUST`, system-generated, sequential (REQ-014). Four incompatible examples given: `CUST 3-3-1`, `CUST 3SF-2`, `CUST 2SF-1/3SF-1…N`, `CUST 3.1/3.2/3.3`. | Cosmetic, but the employer will notice. The current system's `NumberingSequence` model can express any of them — only the seeded format string is missing. |
| **CUST-02** | Customer | Does a customer ever have a credit limit or currency? | The employer explicitly **removed** Type / Currency / TRN / Short Name from Customer (REQ-017). But he asked for multi-currency handling elsewhere in accounting (Q85). | If multi-currency is real, the currency has to live somewhere — most likely the Invoice, not the Customer. |
| **BL-01** | B/L number | Exact B/L number format? | Per-destination numbering confirmed. Real samples show `KHS/26-110`, `KHS/26-108`. Employer's spoken examples `KHS/26-2/2026` and `RJS/26-10` do not match each other or the samples. | Blocks number-generation seeding. |
| **MAN-01** | Manifest number | Exact manifest number format? | Real samples: `DSMAN/KHO-26-006`, `DSKHS-26-005`. Employer gave no format; legacy code generated `{port.abb}/{rand6}{year}` — **random**, not sequential. | Random generation (legacy) contradicts "numbered in order" expectations and makes numbers non-reproducible. |
| **VOY-01** | Voyage number | Is the voyage counter per vessel+per destination+per year (employer) or per Port+Shipper (legacy `generateVoyage`)? | Employer: per vessel + per destination + per year (REQ-040). Legacy: per `Portshipper` record. | These are different keys. The employer's rule is the requirement; legacy is only evidence of an older implementation. |
| **CRG-01** | Cargo docs | What are **EXID**, **BCC**, **R.D.A.**? | EXID, BCC, Local Transfer are the three named Document Status values (REQ-063). Export Paper, Import Paper, Export Certificate, R.D.A. are named as intake documents (REQ-064). | No expansion anywhere. The real PDFs do not use these terms. |
| **CRG-02** | Cargo comment | Is the comment field editable and deletable after entry, and is a comment mandatory at cargo creation? | The employer only said operations "write it in that Comment" and accounting reads it (REQ-065 – REQ-067). | Editability is **inferred**, not stated. Mandatoriness is **not stated at all**. |
| **CRG-03** | Cargo ↔ Job | Is the Job ↔ Cargo link 1:1 or 1:many? | The employer speaks of "one machine / one shipment" having a Job Number, and of a Job belonging to a Customer. | Not stated. Affects schema cardinality. |
| **INV-01** | VAT | What is the default VAT rate, and which services are VAT-able vs not? | Lines carry a VAT % typed by the user (REQ-144). The one real Tax Invoice in the pack shows **VAT 0%** on all lines. | The employer's 5% figure is only an *example* ("if I write five"). Default is unknown. |
| **INV-02** | Invoice | Is there a correction / re-issue flow for an issued invoice? | Draft B/L has a correction flow (REQ-105); no equivalent is stated for invoices. | Not stated. |
| **FIN-01** | Ledger | Is there a formal **double-entry** chart of accounts, or is the "ledger" purely a per-customer running balance? | The employer describes Debit/Credit per customer (REQ-150/151) plus a "General Journal" (REQ-166) plus office expenses in the same ledger (REQ-167). | He never says "chart of accounts" or "double entry". Prior AI analyses proposed full double-entry; that is an **inference**, not employer evidence. |
| **FIN-02** | Voucher | Can one payment settle **several** invoices at once? | The employer says allocation is to "a specific Invoice" or "a specific B/L number" (REQ-164) — singular each time. The real Receipt Voucher settles **two** invoices at once. | Evidence conflicts with the phrasing. Multi-invoice allocation is **required by the real document** but not stated by the employer. |
| **FIN-03** | Voucher | Is overpayment (payment > invoice) allowed, and how is the surplus held? | Unallocated payment must not error (REQ-165) — this covers the surplus case implicitly. | Explicit overpayment policy is absent. |
| **FIN-04** | Alerts | What is the overdue threshold that triggers the "customer hasn't paid" alarm? | The employer asks for an alarm (REQ-154) but gives no number. | Threshold must come from the employer. |
| **RLS-01** | Release | What is the alert window for a credit release? | "one or two weeks" for follow-up (REQ-184); illustrative examples of "one week unpaid" and "one month, 20% unpaid". | The illustrative numbers are not a policy. |
| **RLS-02** | Release | Who is authorised to release on credit, and is there a limit? | Not stated. | Policy gap. |
| **DO-01** | Delivery Order | What exactly makes a cargo eligible for a Delivery Order? | Issued after Duna discharges inbound cargo at its own port (REQ-185). | Precise eligibility rule absent. |
| **AGT-01** | Agent portal | Beyond viewing B/Ls / Manifests / Release Orders, may an agent **submit bookings** or upload documents? | Only viewing is stated (REQ-187, EMP-681). | Any write capability would be an invention. |
| **AGT-02** | Agent portal | Is the agent scoped to a **port** or to a **destination** — and can an agent cover several destinations? | "Their own port"; one agent per destination (EMP-380, EMP-677). | Singular in the transcripts; real business may have multi-destination agents. |
| **RPT-01** | Reports | Are voyage costs **stored** on the manifest, or computed from source documents? | The employer lists cost categories to be "considered" on the manifest (REQ-191); legacy stores five cost columns on the manifest. | Not settled. |
| **RPT-02** | Reports | Is income measured gross or net of VAT? | "Sum of the Invoice amounts". The employer's Invoice block separates Subtotal / VAT / Total. | Which of the three feeds the P&L income figure is unspecified. |
| **SAL-01** | Salary | Does paying salary post to any ledger or voucher? | Not stated; nothing in the transcripts implies it. | See REQ-172 (inferred). |
| **SAL-02** | Salary | What are the salary components (basic, allowance, overtime, deductions)? | Not stated beyond "Salary Slip". | Full payroll schema would be invention. |
| **ARCH-01** | Archive | What is the "Company Archive" (EMP-713)? | Title only. | Zero detail. Do not design it from the title. |
| **SRC-01** | Sources | Where is the full transcript set? | `docs/plan.md` names `/home/duna/dunaData/transcripts/` as the highest authority. **That path does not exist in this repository.** Only the 20 files under `docs/duna-analysis/requirements/` are available. | There may be employer statements that are simply not represented anywhere in this knowledge base. |
| **SRC-02** | Sources | Where are the company's own document templates? | The employer promises them six times (REQ-125). Not supplied. | Any template design would be invented. |
| **SRC-03** | Sources | One PDF (the Receipt Voucher) is a **scan**, not a digital document. | Its content was recovered by OCR in this analysis with high confidence (see `../02-business-documents/receipt-vouchers.md`). | OCR-derived figures should be treated as near-certain but not as a signed source. |

---

## 2. Coverage of the pre-existing questionnaire (Q01–Q160)

The questionnaire lives at
`docs/source-material/business-analysis.md` (Persian, 28 sections).
Below, each section is assessed against the evidence now available. "Answered" means a future agent
can act on it without further input; "Partial" means the direction is known but a value/threshold/
format is missing; "Open" means nothing in the repository addresses it.

| # | Section (translated) | Q range | Disposition | Where the evidence is |
|---|---|---|---|---|
| 1 | Overall business structure & how a job starts | Q01–Q04 | **Answered** | EMP-001 – EMP-005; REQ-060, REQ-130 |
| 2 | Customer and relationship to other parties | Q05–Q10 | **Answered** (Q09 status, Q10 credit → Partial) | REQ-018 – REQ-020; CUST-02 |
| 3 | Cargo & cargo information | Q11–Q16 | **Partial** | REQ-061 – REQ-064, REQ-071; CRG-01, CRG-03 |
| 4 | Cargo route & storage location | Q17–Q21 | **Partial** (Q20 internal yard transfer → Open; Q21 dates → Answered) | REQ-030 – REQ-036, REQ-069, REQ-070 |
| 5 | Documents & document status | Q22–Q26 | **Partial** (Q24 validity date, Q25 multiple files, Q26 versions → Open) | REQ-063, REQ-064; CRG-01 |
| 6 | Inspection | Q27–Q31 | **Partial** (Q28 result values, Q29 evidence doc, Q30 multiple inspections → Open) | REQ-080 – REQ-083 |
| 7 | Loading List & loading | Q32–Q38 | **Partial** (Q34 multi-stage, Q37 operator real data, Q38 proof of loading → Open) | REQ-090 – REQ-094 |
| 8 | Vessel & Voyage | Q39–Q43 | **Partial** (Q43 voyage change → Open) | REQ-037 – REQ-041; VOY-01 |
| 9 | Bill of Lading | Q44–Q51 | **Partial** (Q47 post-final amendment, Q49 originals count, Q50 surrender/release, Q51 freight → Open/Partial) | REQ-100 – REQ-107; BL-01 |
| 10 | Manifest | Q52–Q58 | **Partial** (Q54 revised manifest, Q56 totals, Q57 ownership, Q58 co-loading → Partial) | REQ-110 – REQ-114 |
| 11 | Customer / Shipper / Consignee / Agent distinction | Q59–Q63 | **Answered** | REQ-018, REQ-050 – REQ-056 |
| 12 | Invoice & revenue | Q64–Q72 | **Partial** (Q71 credit terms, Q72 corrective invoice → Open) | REQ-140 – REQ-154; INV-01, INV-02 |
| 13 | Job & costs | Q73–Q79 | **Partial** (Q76 direct vs indirect, Q77 cost without job, Q78 timing, Q79 correction → Partial) | REQ-130 – REQ-135 |
| 14 | Ledger & accounting | Q80–Q87 | **Partial** (Q80 main account, Q82 general journal model, Q85 multi-currency, Q86 balance definition → Partial) | REQ-160 – REQ-167; FIN-01 |
| 15 | Payment & Receipt Voucher | Q88–Q96 | **Partial** (Q94 partial payment, Q95 advance, Q96 overpayment → Partial) | REQ-163 – REQ-165; FIN-02, FIN-03 |
| 16 | Release Order | Q97–Q101 | **Partial** (Q99 release approval, Q100 multiple releases, Q101 history → Open) | REQ-180 – REQ-184; RLS-01, RLS-02 |
| 17 | Agent portal / agent access | Q102–Q106 | **Partial** (Q105 agent operations, Q106 several agents per port → Open) | REQ-187, REQ-188; AGT-01, AGT-02 |
| 18 | Delivery Order | Q107–Q110 | **Partial** (Q108 eligibility, Q109 relation to release, Q110 delivery confirmation → Open) | REQ-185, REQ-186; DO-01 |
| 19 | Proforma & Quotation | Q111–Q115 | **Partial** (Q112 PI↔customer/job, Q113 validity, Q115 revised versions → Open) | REQ-152, REQ-153; real PDFs `DSPRO/26-001`, `DSQUO/25-017` |
| 20 | Reporting | Q116–Q123 | **Partial** (Q122 cost allocation, Q123 tax report → Partial) | REQ-190 – REQ-195; RPT-01, RPT-02 |
| 21 | Alerts & follow-up | Q124–Q128 | **Open** (only two alerts are stated at all: overdue invoice, unpaid release) | REQ-154, REQ-184; FIN-04, RLS-01 |
| 22 | Archive | Q129–Q133 | **Open** | ARCH-01 |
| 23 | Letters & correspondence | Q134–Q137 | **Open** | No transcript mentions letters. (The current system has a Letters module — see `../05-current-project/`.) |
| 24 | Users, roles & security | Q138–Q141 | **Partial** (Q138/Q139 real roles and their access → Open; Q140/Q141 activity log & change history → Open) | Only "Access Control" as a sidebar section is stated (REQ-001). |
| 25 | Outputs & templates | Q142–Q147 | **Partial** (Q143 existing templates, Q147 copy count → Open) | REQ-120 – REQ-125; SRC-02 |
| 26 | Salary | Q148–Q152 | **Partial** (Q149 components, Q152 correction → Open) | REQ-169 – REQ-171; SAL-01, SAL-02 |
| 27 | Special & exceptional cases | Q153–Q159 | **Open** (cancellation, re-open, returned goods, destination change, vessel change, partial loading, lost/damaged) | Only "partial loading → return to yard" is covered (REQ-093). |
| 28 | Most important final request | Q160 | **Open** | By definition — it asks for what was *not* said. |

---

## 3. Standing rules for future agents

1. **Never promote an INFERRED row to a business rule.** Record it as inferred.
2. **Never silently pick a side in a CONTRADICTED row.** Surface it here and, if a decision is
   unavoidable, mark the implementation as provisional.
3. **Two items in this register are safety-critical because intuition points the wrong way:**
   - `REQ-122` — print must *strip* stamps (it feels like a bug; it is a requirement).
   - `REQ-165` — unallocated payment must *not* error (it feels like missing validation; it is a
     requirement).
4. **If the employer answers any item in §1**, update this file, then update the corresponding
   `REQ-*` row's classification, then update
   [`../07-traceability/requirements-traceability.md`](../07-traceability/requirements-traceability.md).
   Do not edit only one of the three.

---

## duna-analysis/01-employer-statements/requirements-catalog.md

# Requirements Catalogue (`REQ-*`)

> **Purpose:** The single stable, citable list of employer requirements extracted from the transcripts.
> Every other document in `docs/duna-analysis/` refers to requirements by these IDs.
>
> **How to use:** Search by `REQ-` ID. Each row records the requirement, its **classification**
> (explicit / inferred / unresolved / contradicted), its **evidence** (statement IDs from
> [`employer-original-statements.en.md`](employer-original-statements.en.md)), and, where useful, a
> note.
>
> **Classification legend**
> - **EXPLICIT** — the employer stated it directly and unambiguously.
> - **INFERRED** — derived from what the employer said; reasonable but not stated verbatim.
> - **UNRESOLVED** — the employer raised it but did not settle it (format, policy, or value missing).
> - **CONTRADICTED** — the employer gave incompatible variants, or another source conflicts with it.
>
> **Rule:** Do not promote an INFERRED or UNRESOLVED item to a business rule without employer
> confirmation. Do not silently resolve a CONTRADICTED item.

---

## 1. Navigation & information architecture

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-001 | The dashboard sidebar has exactly **six** top-level sections, in this order: Overview, Operations, B/L & Manifest, Accounting, Master Data, Access Control. | EXPLICIT | EMP-185, EMP-186 | — |
| REQ-002 | Each sidebar section expands as an accordion / drop-down to reveal its sub-items. | EXPLICIT | EMP-187 | — |
| REQ-003 | Master data is defined **before** operations in the employer's own walk-through order. | EXPLICIT | EMP-188 | Ordering of *explanation*, not necessarily a UI ordering mandate. |
| REQ-004 | A **Company Archive** area exists (title "Company Archive"). | UNRESOLVED | EMP-713 | Title only; no fields, rules, or behaviour given. |

---

## 2. Master Data — Customer

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-010 | Master Data contains exactly these seven registers: **Customers, Ports, Yards, Vessels, Shippers, Consignees, Agents**. | EXPLICIT | EMP-194 | — |
| REQ-011 | Customer Name is the **only mandatory** field. | EXPLICIT | EMP-209, EMP-219, EMP-356 | — |
| REQ-012 | Customer has optional Contact Number, Email, Address. | EXPLICIT | EMP-204, EMP-221, EMP-229 | — |
| REQ-013 | The system generates the Customer **code** automatically; the user does not type it. | EXPLICIT | EMP-205, EMP-220, EMP-231 | — |
| REQ-014 | The Customer code carries a `CUST` prefix and increments sequentially per new customer. | EXPLICIT | EMP-207, EMP-213, EMP-216, EMP-222, EMP-233 | — |
| REQ-015 | **Exact Customer code format is unresolved.** The employer gave three different examples in one clip. | CONTRADICTED | EMP-207 vs EMP-213/EMP-216 vs EMP-222 vs EMP-233 | `CUST 3-3-1`, `CUST 3SF-2/3`, `CUST 2SF-1/3SF-1..N`, `CUST 3.1/3.2/3.3`. Substantive requirement (REQ-014) is clear; only the string format is open. |
| REQ-016 | Customer list rows support Edit, Delete and a Status indicator. | EXPLICIT | EMP-224, EMP-236 | — |
| REQ-017 | Customer record must **not** carry Type, Currency, TRN Number or Short Name fields. | EXPLICIT | EMP-225, EMP-237 | Explicit *exclusion* — do not add these back. |
| REQ-018 | A Customer is an **internal commercial counterparty**: the party Duna invoices and whose ledger Duna maintains. It is not necessarily the Shipper or Consignee on any document. | EXPLICIT | EMP-198, EMP-199, EMP-384 – EMP-393, EMP-430, EMP-431 | Single most important structural requirement in the whole transcript set. |
| REQ-019 | A Customer may be a natural person or a legal entity. | EXPLICIT | EMP-199, EMP-201, EMP-356 | — |
| REQ-020 | The worked example: a customer in Australia buys a machine; Duna moves it Australia → Jebel Ali (clearance) → Hamriyah → Khorramshahr. The Australian seller is the Shipper; the destination party is the Consignee; only the Australian buyer is Duna's Customer. | EXPLICIT | EMP-394 – EMP-408 | — |
| REQ-021 | Customers must be selectable by name or by code with a search. | EXPLICIT | EMP-449 | — |

---

## 3. Master Data — Port, Yard, Vessel

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-030 | Port is recorded as **Port name, City, Country** — three parts, comma-separated. | EXPLICIT | EMP-241 – EMP-255 | Examples: `Hamriyah Port, Dubai, UAE`; `Bandar Abbas, Persian Gulf, Iran`; `Port of Sohar, Oman`. |
| REQ-031 | Port Name, City, Country and Abbreviation are all **mandatory**. | EXPLICIT | EMP-268 | — |
| REQ-032 | A Port has a mandatory short **abbreviation** (e.g. `HAM` for Hamriyah). | EXPLICIT | EMP-256, EMP-264 – EMP-266 | — |
| REQ-033 | The abbreviation is used instead of the full port name inside the Load List, to save horizontal space. | EXPLICIT | EMP-257 – EMP-259 | — |
| REQ-034 | Ports referenced in practice: Hamriyah, Jebel Ali, Port Rashid (UAE, loading side); Khorramshahr, Bushehr, Bandar Abbas / Rajaee (Iran, discharge side); Sohar (Oman). | EXPLICIT | EMP-002, EMP-010, EMP-242 – EMP-255, EMP-501, EMP-502 | — |
| REQ-035 | A Yard records only **which Port it belongs to** plus a **Yard name**. | EXPLICIT | EMP-276 – EMP-279 | — |
| REQ-036 | Selecting a Port of Loading filters the Yard picker to that port's yards only. | EXPLICIT | EMP-280 – EMP-289, EMP-466, EMP-467 | Cascade behaviour. |
| REQ-037 | Vessel falls into two shapes: **Tug & Barge** (two names) or **Vessel / Landing Craft** (one name). | EXPLICIT | EMP-293, EMP-297 – EMP-301, EMP-336 – EMP-341 | — |
| REQ-038 | Vessel may carry an optional **IMO Number**; absence must not block saving. | EXPLICIT | EMP-295, EMP-342 – EMP-344 | — |
| REQ-039 | Vessels are either owned by Duna, chartered per trip (voyage charter), or time-chartered for a period. | EXPLICIT | EMP-003 | Stated as background, not as a schema field. |
| REQ-040 | **Voyage number** is `n/yy` (e.g. `1/26`, `5/26`) and counts trips **per vessel + per destination + per year**, restarting at 1 for each new destination and each new year. | EXPLICIT | EMP-315 – EMP-331 | Confirmed by EMP-323 ("this must be defined separately for each Destination"). |
| REQ-041 | The system derives the voyage number automatically when the vessel is selected for a given destination. | EXPLICIT | EMP-320, EMP-329, EMP-330, EMP-552 | — |

---

## 4. Master Data — Shipper, Consignee, Agent

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-050 | Shipper fields: Name (mandatory), National ID / TRN Number, Address, Contact Number, Email (all optional). | EXPLICIT | EMP-347 – EMP-356 | — |
| REQ-051 | Consignee fields are identical to Shipper fields. | EXPLICIT | EMP-362 – EMP-372 | — |
| REQ-052 | National ID and TRN may be recorded in one field separated by a slash; whichever exists is entered. | EXPLICIT | EMP-365 – EMP-367 | — |
| REQ-053 | Shipper is the **first** party entered on a Bill of Lading and is also a Manifest column. | EXPLICIT | EMP-346, EMP-359 – EMP-361 | — |
| REQ-054 | Consignee is chosen by the customer/destination party, not by Duna. | EXPLICIT | EMP-391, EMP-417 – EMP-420 | — |
| REQ-055 | Agent fields: Name, Address, Contact Number, Email. | EXPLICIT | EMP-374 – EMP-378 | — |
| REQ-056 | Agent details are printed on the Bill of Lading, and the Agent used depends on the **destination**. | EXPLICIT | EMP-379 – EMP-381 | — |

---

## 5. Operations — Cargo registration

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-060 | Cargo registration ("New Cargo") begins with **Customer** selection — it is the first field. | EXPLICIT | EMP-439 – EMP-449, EMP-005 | — |
| REQ-061 | Cargo fields, in the employer's stated order: Customer, Shipper Name, Port of Loading, Port of Destination, Description, Chassis Number, Serial Number, Number of Units, Number of Packages, Weight, Weight Unit, Arrival Date, Yard, Document Status, Inspection, Loading Date/Time, Comment. | EXPLICIT | EMP-450 – EMP-482 | — |
| REQ-062 | Weight carries a **weight unit**, mainly Kilogram. | EXPLICIT | EMP-463 | — |
| REQ-063 | **Document Status** records the paperwork the cargo entered the port with. Named values: **EXID**, **BCC**, **Local Transfer**. Entered manually. | EXPLICIT | EMP-468 – EMP-471 | The three names are spoken letter-sequences; their expansions are not confirmed. |
| REQ-064 | Other document types referenced in the business narrative: Export Paper, Import Paper, Export Certificate, R.D.A. | UNRESOLVED | EMP-011 | "R.D.A." is not expanded anywhere. |
| REQ-065 | Cargo carries a **Comment** field. The employer repeated this requirement in both transcript groups and three times in one clip ("Absolutely, absolutely, absolutely"). | EXPLICIT | EMP-079 – EMP-088, EMP-482 – EMP-493 | — |
| REQ-066 | The Comment records ad-hoc costs and handling facts (transport paid, customs paid, repairs done in port). | EXPLICIT | EMP-083 – EMP-085, EMP-488 – EMP-490 | — |
| REQ-067 | Operations staff write the Comment; **accounting staff must be able to read it** when preparing the customer's invoice. | EXPLICIT | EMP-081, EMP-082, EMP-086, EMP-486, EMP-487, EMP-491 | Cross-module visibility requirement. |
| REQ-068 | Comment edits and deletions are permitted (implied by "writes it in that Comment" + "editable" phrasing across the transcripts). | INFERRED | EMP-085, EMP-490 | The employer never explicitly said "editable". Flagged as inferred; see `open-questions.md` CRG-02. |
| REQ-069 | Cargo registration captures arrival date, discharge yard and discharge date so that **days in port** can be computed. | EXPLICIT | EMP-018 – EMP-021, EMP-464, EMP-480, EMP-481 | — |
| REQ-070 | **Days in port = loading date − arrival date**, used to compute storage/warehousing charges payable to the port authority. | EXPLICIT | EMP-019 – EMP-021, EMP-481 | — |
| REQ-071 | "Nagle" (نقل) means accompanying loose pieces that are **not** complete machines. Units and Packages are counted separately and both appear on the Manifest / B/L. | EXPLICIT | EMP-030, EMP-031, EMP-459 – EMP-461, EMP-598, EMP-599 | e.g. "1 machine plus 2 Nagle". |

---

## 6. Operations — Inspection

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-080 | Inspection is **booked** (a slot and a fee) with Dubai customs, then performed. | EXPLICIT | EMP-473 – EMP-477 | — |
| REQ-081 | Inspection has at least two states: **Pending** and **Done**. | EXPLICIT | EMP-077, EMP-478, EMP-506, EMP-516 | — |
| REQ-082 | **Inspection Done is a hard precondition** for a cargo to enter a Load List. Attempting to select an uninspected cargo must raise an error stating the inspection has not been done. | EXPLICIT | EMP-078, EMP-508, EMP-512 – EMP-516 | Strongly and repeatedly stated. |
| REQ-083 | Pending inspection should be visually highlighted (employer suggests red) in the yard inventory / load status views. | EXPLICIT | EMP-479 | UI suggestion, not a business rule. |

---

## 7. Operations — Load List / Loading

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-090 | A Load List is produced **per vessel** and printed for the loading operators. | EXPLICIT | EMP-014, EMP-306 – EMP-311, EMP-510, EMP-511 | — |
| REQ-091 | Load List columns: loading port, destination port, Description, Chassis Number, Serial Number, number of machines, number of Packages, Weight, arrival date, Yard, and Inspection status. | EXPLICIT | EMP-523, EMP-524 | — |
| REQ-092 | The Load List is **editable after creation** so that cargo inspected later the same night / next day can be appended and re-printed in one go. | EXPLICIT | EMP-528 – EMP-533 | Explicitly stated with a worked example (7 loaded, then 13 added). |
| REQ-093 | Cargo that was on the Load List but **not loaded** returns to Yard Inventory and remains available for a later trip. | EXPLICIT | EMP-016, EMP-017, EMP-022, EMP-049, EMP-534 – EMP-537 | — |
| REQ-094 | Yard Inventory supports **filters by destination** so management can decide which destination to assign a vessel to (e.g. 30 for Khorramshahr vs 10 for Bushehr vs 10 for Bandar Abbas). | EXPLICIT | EMP-042 – EMP-046, EMP-094 – EMP-097, EMP-499 – EMP-503 | — |

---

## 8. Bill of Lading

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-100 | Every loaded cargo item receives its own Bill of Lading. | EXPLICIT | EMP-034 – EMP-036 | — |
| REQ-101 | B/L content includes Shipper, Consignee, Notify Party, B/L number, vessel name, voyage, loading port, destination port, Quantity, Marks & Numbers, Description, net weight, gross weight, CBM, Total, Place of B/L Issue, Freight Charges (Collect/Prepaid), issue date, stamp/signature area. | EXPLICIT | EMP-035, EMP-540 – EMP-561 | — |
| REQ-102 | **B/L numbering is per destination.** Examples: `KHS/26-2/2026` (Khorramshahr), `RJS/26-10` (Rajaee). | EXPLICIT | EMP-542 – EMP-547 | The two examples have different shapes — see REQ-103. |
| REQ-103 | **Exact B/L number format is unresolved.** `KHS/26-2/2026` (destination abbrev / yy-seq / yyyy) and `RJS/26-10` (destination abbrev / yy-seq) are structurally different. | CONTRADICTED | EMP-544 vs EMP-546 | Real-world evidence (see `../02-business-documents/`) shows `KHS/26-110`. All three must be reconciled by the employer. |
| REQ-104 | A B/L is first issued as **Draft** with a `DRAFT` watermark, sent to the customer for review, then finalised/approved out of Draft. | EXPLICIT | EMP-562 – EMP-565 | — |
| REQ-105 | Corrections requested by the customer on the draft B/L are applied before finalisation. | EXPLICIT | EMP-564 | — |
| REQ-106 | The B/L is sent to the customer as a finished document. | EXPLICIT | EMP-036, EMP-051, EMP-584 | — |
| REQ-107 | The manifest must be able to include **partner / forwarder Bills of Lading** whose number format and layout differ from Duna's, because only one manifest is issued per voyage and Duna is the issuer. | EXPLICIT | EMP-068 – EMP-074 | Structural requirement: not every manifest line is generated by Duna. |

---

## 9. Manifest

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-110 | Manifest header: vessel name (Tug & Barge or Landing Craft), Voyage, port of loading, port of discharge, Manifest number, date. | EXPLICIT | EMP-025, EMP-569, EMP-570, EMP-588 | — |
| REQ-111 | Manifest rows are numbered 1, 2, 3… and each row carries a B/L number, goods description, Shipper, Consignee, quantity (units **and** packages separately) and weight, taken from the issued B/Ls. | EXPLICIT | EMP-026 – EMP-029, EMP-591 – EMP-599 | — |
| REQ-112 | The last manifest page prints **Total units, Total packages, Total weight**. | EXPLICIT | EMP-029 – EMP-032, EMP-574, EMP-600 | — |
| REQ-113 | The Manifest is printed and physically stamped for the captain; a PDF copy is sent to the destination Agent. | EXPLICIT | EMP-033, EMP-585, EMP-586 | — |
| REQ-114 | Manifest numbers are system-generated in a company-defined format. | EXPLICIT | EMP-589 | Format not dictated in the transcripts; real samples show `DSMAN/KHO-26-006` and `DSKHS-26-005` — see `../02-business-documents/document-catalog.md`. |

---

## 10. Output, printing and document templates

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-120 | Every document screen must offer **PDF output**, **Excel output** and **Print**. | EXPLICIT | EMP-037, EMP-169, EMP-575 – EMP-579, EMP-721 | — |
| REQ-121 | **PDF output must include stamps, marks and signature.** | EXPLICIT | EMP-040, EMP-171, EMP-580, EMP-581 | — |
| REQ-122 | **Print must strip stamps, marks and signature** so a live physical stamp can be applied to the printed sheet. Applies to both B/L and Manifest. | EXPLICIT | EMP-039, EMP-172, EMP-582, EMP-583 | Counter-intuitive but stated three times — do not "fix" it. |
| REQ-123 | Excel output is wanted so staff can make manual corrections before issuing. | EXPLICIT | EMP-037, EMP-169 | — |
| REQ-124 | The company has **its own output templates** per document type and wants to upload them. Named types: Loading List, Invoice, Delivery Order, Release Order, Salary Slip, Voucher, Payment, Receipt, Ledger. | EXPLICIT | EMP-035, EMP-572, EMP-721 – EMP-725 | — |
| REQ-125 | The uploaded templates are **not present in this repository**. | UNRESOLVED | EMP-035, EMP-107, EMP-119, EMP-572, EMP-722, EMP-725 | The employer says "I'll send you the format" repeatedly; only 7 completed sample PDFs were supplied (see `../02-business-documents/`). |

---

## 11. Jobs & job costing

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-130 | A **Job** (Job Number) is a running cost note attached to a single machine / cargo / shipment, opened when work starts and accumulating every expense until delivery. | EXPLICIT | EMP-060, EMP-061, EMP-067, EMP-411 – EMP-414, EMP-603 – EMP-605 | — |
| REQ-131 | A Job is created for **ETOZ / ETDZ** work: end-to-end handling where Duna collects the goods abroad, clears it, moves it and delivers it. | EXPLICIT | EMP-054 – EMP-059, EMP-403 – EMP-408, EMP-605 | Spelling of the acronym varies (`ETOZ` / `ETDZ`). |
| REQ-132 | Job cost categories named by the employer: repair, freight, customs clearance, low-bed transport, crane/loading, customs documentation, vessel freight, storage. | EXPLICIT | EMP-104, EMP-410, EMP-414, EMP-696 | — |
| REQ-133 | Expenses accrue over weeks or months and are not entered daily; the accountant must be able to see **stage-by-stage** spend. | EXPLICIT | EMP-064, EMP-065, EMP-176 – EMP-178 | — |
| REQ-134 | The invoice is prepared by checking / matching the draft against the related Job Numbers. | EXPLICIT | EMP-099, EMP-609, EMP-625 | — |
| REQ-135 | Job Number carries a Customer. | EXPLICIT | EMP-605 | — |

---

## 12. Invoicing

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-140 | An Invoice can be produced in **two ways**: (a) auto-drafted from issued Bills of Lading, or (b) created standalone for a customer with no B/L / Job link. | EXPLICIT | EMP-607, EMP-608, EMP-623 – EMP-628 | — |
| REQ-141 | The B/L-generated invoice arrives in **Draft** state and is then matched against Job Numbers before issue. | EXPLICIT | EMP-608, EMP-609, EMP-624, EMP-625 | — |
| REQ-142 | Invoice line columns: **Description, Rate (Fee), Quantity (QTY), VAT %, VAT amount, Amount (incl. VAT)**. | EXPLICIT | EMP-112 – EMP-118, EMP-611 | — |
| REQ-143 | Invoice totals block: **Subtotal, VAT, Total Amount**. | EXPLICIT | EMP-612 – EMP-614 | — |
| REQ-144 | VAT is entered **per line** as a percentage. | EXPLICIT | EMP-114, EMP-115, EMP-611 | The employer writes "five" in the VAT row to mean 5%. |
| REQ-145 | Some invoices carry VAT and some do not; the system must separate them so a **quarterly VAT report** can be produced (VAT collected vs VAT paid). | EXPLICIT | EMP-617 – EMP-622 | — |
| REQ-146 | The printed document is a **Tax Invoice** (UAE legal requirement) and carries the customer's Address, mobile/contact number, Email. | EXPLICIT | EMP-106 | — |
| REQ-147 | The Invoice header carries **Invoice Number, Invoice Date, payment due date (maximum payment deadline), TRN Number**. | EXPLICIT | EMP-108, EMP-109, EMP-635 – EMP-641 | — |
| REQ-148 | Invoice records which **B/L and which Manifest** it relates to. | EXPLICIT | EMP-638, EMP-639 | — |
| REQ-149 | Invoice payment status is one of **Paid / Partial (Partial Payment) / Unpaid**. | EXPLICIT | EMP-428, EMP-642, EMP-687 – EMP-689 | — |
| REQ-150 | Issuing an Invoice posts it to the customer's ledger as **Debit** (under "Sales"). | EXPLICIT | EMP-120 – EMP-123, EMP-630, EMP-631 | — |
| REQ-151 | Payment received posts to the customer's ledger as **Credit**. | EXPLICIT | EMP-132, EMP-632 | — |
| REQ-152 | A **Proforma Invoice** document type exists. | EXPLICIT | EMP-643, EMP-644 | — |
| REQ-153 | A **Quotation** document type exists. | EXPLICIT | EMP-645 | — |
| REQ-154 | Overdue invoices should raise an **alarm or report** so the team can follow up on how long a customer takes to pay. | EXPLICIT | EMP-135 – EMP-137 | Trigger threshold not stated — see `open-questions.md` FIN-04. |

---

## 13. Ledger, vouchers, salary

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-160 | Each customer has a **Ledger / profile** showing invoices issued, payments received, debit, credit, balance, and how long since the last statement. | EXPLICIT | EMP-130 – EMP-134, EMP-421 – EMP-429 | — |
| REQ-161 | Balance = Debit − Credit; it must show how much the customer owes, how much is owed to them, or zero. | EXPLICIT | EMP-133, EMP-134 | — |
| REQ-162 | A **Ledger Statement** can be produced for a customer over an arbitrary **date range**. | EXPLICIT | EMP-662 – EMP-664 | — |
| REQ-163 | There are two voucher types: **Payment Voucher** and **Receipt Voucher**. | EXPLICIT | EMP-181, EMP-654, EMP-655 | — |
| REQ-164 | A voucher first selects the **Customer**, then optionally allocates to a specific **Invoice** or **B/L number**. | EXPLICIT | EMP-656 – EMP-659 | — |
| REQ-165 | **An unallocated payment must NOT raise an error** — it posts to the customer ledger as Credit. | EXPLICIT | EMP-660 | Explicitly stated; do not add a validation that blocks it. |
| REQ-166 | A **General Journal** capability allows posting directly onto a customer ledger outside invoicing (e.g. loans). Money paid out = Debit; money received = Credit. | EXPLICIT | EMP-714 – EMP-719 | — |
| REQ-167 | The Ledger is **not** only for customers: daily expenses, office expenses and company running costs must also be recorded there so they can be deducted at year end for the annual tax computation. | EXPLICIT | EMP-647 – EMP-650, EMP-720 | — |
| REQ-168 | **Payment Vouchers require ID-card capture** (front and back) of the recipient — by upload or by camera — plus the recipient's signature on the printed voucher. | EXPLICIT | EMP-703 – EMP-707 | — |
| REQ-169 | Salary: employees are defined, and a **Salary Slip** is issued for each month. | EXPLICIT | EMP-651 – EMP-653 | — |
| REQ-170 | **Salary Slips also require ID-card capture** (front and back, upload or camera) printed with the employee's signature. | EXPLICIT | EMP-708 – EMP-712 | — |
| REQ-171 | Salary slips are prepared one or two days before the end of each month. | EXPLICIT | EMP-709 | — |
| REQ-172 | Salary is self-contained (no voucher/ledger posting implied by the employer). | INFERRED | EMP-651 – EMP-653 | The employer never said whether paying salary posts to a ledger. Flagged as inferred. |

---

## 14. Release Order, Delivery Order, Agent portal

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-180 | A **Release Order** is issued when the customer's cargo has reached the destination, been discharged, and Duna authorises the destination Agent to hand over the documents. | EXPLICIT | EMP-138, EMP-674, EMP-675 | — |
| REQ-181 | Release Order rows show B/L number, Consignee, goods description and a Released status marker. | EXPLICIT | EMP-681 – EMP-683 | — |
| REQ-182 | Release Order records the **payment condition** at release: fully Paid, Partial Payment, or Unpaid (released on credit). | EXPLICIT | EMP-142 – EMP-145, EMP-685 – EMP-689 | — |
| REQ-183 | A **Release Report** shows, per B/L / Manifest, which items were Released+Paid, Released+Partial, Released+Unpaid. | EXPLICIT | EMP-146, EMP-147 | — |
| REQ-184 | An **alert / notice** is raised when a released document remains unpaid — the employer's example thresholds are "released for one week with no payment" and "released one month ago, 20% still unpaid"; the follow-up window he expects is "one or two weeks". | EXPLICIT | EMP-148, EMP-149, EMP-692 | The exact threshold is *illustrated*, not specified. Threshold is UNRESOLVED (see `open-questions.md` RLS-01). |
| REQ-185 | A **Delivery Order** is issued when Duna has discharged inbound cargo at its own port and hands the documents to the customer so the Consignee can clear and collect. | EXPLICIT | EMP-162, EMP-163, EMP-666, EMP-667 | — |
| REQ-186 | Delivery Order carries a number, a date, a Customer and a **Port**, and is printed and stamped. | EXPLICIT | EMP-669 – EMP-672 | — |
| REQ-187 | Agents get their own **login** and see only their own destination's data — "Khorramshahr only sees Khorramshahr". Scoped to their own B/Ls, Manifests and Release Orders. | EXPLICIT | EMP-153 – EMP-159, EMP-676 – EMP-680 | Restated twice verbatim; strong requirement. |
| REQ-188 | The Agent portal exists so that agents stop telephoning Duna to ask whether a B/L has been released. | EXPLICIT | EMP-153, EMP-156, EMP-159 | Statement of intent behind REQ-187. |

---

## 15. Reporting

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-190 | For every Manifest (i.e. every vessel trip to a destination) the system computes a **P&L**: cost vs income, and the resulting profit or loss. | EXPLICIT | EMP-126 – EMP-129, EMP-693 – EMP-701 | — |
| REQ-191 | Voyage / manifest **cost categories** named by the employer: vessel charter, Port Use, Handling, Lashing, and miscellaneous costs. | EXPLICIT | EMP-696 | — |
| REQ-192 | Voyage / manifest **income** = the sum of the invoices (statements) issued against that manifest's Bills of Lading. | EXPLICIT | EMP-698 | — |
| REQ-193 | The annual tax P&L must be obtainable by applying **filters** over the per-manifest P&L results. | EXPLICIT | EMP-702 | — |
| REQ-194 | A **quarterly VAT report** (VAT collected vs VAT paid) is required. | EXPLICIT | EMP-617 – EMP-622 | Same evidence as REQ-145; kept as a separate requirement because it is a distinct deliverable. |
| REQ-195 | Office / daily expenses must feed the annual tax computation. | EXPLICIT | EMP-720 | Overlaps REQ-167. |

---

## 16. Cross-cutting constraints

| ID | Requirement | Class | Evidence | Notes |
|---|---|---|---|---|
| REQ-200 | Optional fields must never block saving: "if we have it we enter it; if we don't have it, it shouldn't give an Error." | EXPLICIT | EMP-209, EMP-344, EMP-355, EMP-660 | Applies generally, stated on Customer, Vessel IMO, Shipper and Voucher. |
| REQ-201 | Master data is entered once and re-used by selection, to prevent operators re-typing it and making mistakes. | EXPLICIT | EMP-189, EMP-190, EMP-383 | — |
| REQ-202 | Data captured at intake must be recorded at intake time, not retrospectively ("from the moment we take delivery… the guys want to do Data Entry"). | EXPLICIT | EMP-075, EMP-076 | — |

---

## duna-analysis/01-employer-statements/terminology-glossary.md

# Terminology Glossary

> **Purpose:** Map the employer's vocabulary — including words that are his own, mis-heard, or used
> in a company-specific sense — to the domain concepts and, where one exists, to the current
> system's entity or field.
>
> Two warnings for future agents:
> 1. The employer is **not** describing a data model. He is describing a business. Words like
>    "Cargo", "Shipment", "Job" and "goods" are used interchangeably in places.
> 2. Several terms below (Nagle, ETOZ, EXID, BCC, R.D.A.) have **no standard expansion** and must not
>    be "corrected" into a guess.

---

## 1. Parties — the four-way distinction

| Term (as spoken) | Meaning in Duna's business | Appears on documents? | Current system entity |
|---|---|---|---|
| **Customer** | Duna's internal commercial counterparty: the party Duna invoices and whose ledger Duna keeps. May be a natural person or a company. Usually **not** the Shipper or the Consignee. | Usually **no** | `Customer` |
| **Shipper** | The documentary shipper on the Bill of Lading — in Duna's words, "that selling company". Chosen by the customer. | Yes | `Shipper` |
| **Consignee** | The documentary consignee on the B/L — whoever the destination party nominates. | Yes | `Consignee` |
| **Agent** | Duna's representative at a **destination** port. Holds the documents until release. Gets a portal login scoped to their own destination. | Yes (as "Carrier's Agent") | `Agent` + `AgentDestination` |
| **Notify Party** | Standard B/L notify party. | Yes | `BillOfLading.notifyParty`, `Manifest.notifyParty` |
| **Forwarder / partner company** | Another company whose cargo is co-loaded onto a Duna vessel and whose B/L (different format, different numbering) must still go on Duna's single manifest. | Yes | *No dedicated entity — see `open-questions.md` and `../04-business-analysis/`* |

> The single most important sentence in the transcripts:
> *"Customer is an Internal thing — meaning it is internal, and it is only for us."* (EMP-431)

---

## 2. Cargo and units

| Term | Meaning | Notes |
|---|---|---|
| **Cargo** | A registered unit of goods — typically a machine, but can be a container or general goods. The employer also says "goods", "commodity", "Shipment", "machine" for the same thing. | Current entity: `Cargo` |
| **Nagle** (نقل) | Loose / accompanying pieces that are **not** complete machines — pallets, boxes, bundles, spare parts. Counted **separately** from machines. | "1 machine plus 2 Nagle". Current fields: `Cargo.packages` (comment says "package / naggle count"), `Cargo.packageType` (comment: "e.g. NAGGLE, BUNDLE, LOOSE"). |
| **Units** | Count of complete machines. | `Cargo.quantity` / `units` |
| **Packages** | Count of Nagle / packages. | `Cargo.packages` |
| **Chassis Number** | Machine chassis/serial identifier; the employer's primary physical identifier for a machine. | `Cargo.chassisNumber` (note: `Cargo.chassis` also exists — see §6) |
| **Serial Number** | Secondary machine identifier, distinct from chassis in the employer's field list. | `Cargo.serialNumber` |
| **CBM** | Cubic measurement / volume on the B/L. | `BillOfLading.totalVolume` |
| **Weight Unit** | Mainly Kilogram. | `Cargo.weightUnit` (`KG` / `MT`) |

---

## 3. Places and assets

| Term | Meaning | Notes |
|---|---|---|
| **Port** | A seaport, recorded as Port name, City, Country + a mandatory abbreviation. | `Port` |
| **Abbreviation / Code** | Short port code (`HAM` for Hamriyah) used in space-constrained views like the Load List. | `Port.abbreviation` |
| **Yard** | A storage area inside a port. Defined only by "which port" + "name". | `Yard` |
| **Yard Inventory / warehouse inventory** | The live list of cargo sitting in yards awaiting loading. | `YardInventory` |
| **Vessel** | A ship. Two shapes: **Tug & Barge** (a tug plus a barge, two names) or **Vessel / Landing Craft** (one name). | `Vessel`, `VesselType` (TUG / BARGE / LANDING_CRAFT) |
| **IMO Number** | International Maritime Organization number; optional. | `Vessel.imoNumber`, `Manifest.vesselImo`, `BillOfLading.vesselImo` |
| **Charter types** | Owned, voyage charter (per trip), time charter (per period). | Background only; not modelled. |
| **Operator** | The yard crew who physically load the vessel. They receive the printed Load List and report back what actually got loaded. | Not a system role in the transcripts. |
| **Berth** | Where the vessel ties up inside the port. | Mentioned once (EMP-504). |
| **Low-bed / low-bed trailer** | The trailer used to move machinery overland between ports (e.g. Jebel Ali → Hamriyah). | A cost category (REQ-132). |

---

## 4. Movements and documents

| Term | Meaning | Notes |
|---|---|---|
| **ETOZ / ETDZ** | End-to-end handling: Duna collects the goods at origin, clears customs, moves it, and delivers it. Spelled two different ways in the transcripts. The employer never expands the acronym. | Costed by a Job Number (REQ-131). |
| **Job / Job Number** | A running cost note for one machine / cargo / shipment, opened when work starts and accumulating every expense until delivery. | `Job` + `JobCostItem` |
| **Load List / Loading List** | The per-vessel pick list printed for the operators; also used by the employer to mean the yard inventory itself. **Two senses — check context.** | `LoadList` |
| **Inspection** | Customs inspection of the cargo, booked and paid for in advance. **Done** is a hard gate for Load List inclusion. | `Inspection` |
| **Bill of Lading (B/L)** | Standard marine B/L, one per loaded cargo item. Draft (watermarked) → Final. | `BillOfLading` |
| **DRAFT watermark** | The visual mark on a draft B/L. | `BillOfLading.status = DRAFT` |
| **Manifest** | The voyage cargo list Duna issues to the captain and to the destination agent. Consolidates the issued B/Ls. **Only one per voyage, and it must also carry partner/forwarder B/Ls.** | `Manifest` + `ManifestItem` |
| **Invoice** | In Duna's usage, always a **Tax Invoice** (UAE legal form), issued to the Customer. | `Invoice` |
| **Statement** | The employer uses "statement" (صورتحساب) to mean **the invoice document itself**, not a statement of account. This is a recurring translation trap. | See also "Ledger Statement" below. |
| **Proforma Invoice (PI)** | A proforma document. | `Proforma` |
| **Quotation** | A price quotation. | `Quotation` |
| **Release Order (R/O)** | Duna's authorisation to the destination agent to hand over the documents, issued after discharge. Records Paid / Partial / Unpaid. | `ReleaseOrder` |
| **Delivery Order (D/O)** | Issued to the customer after Duna discharges inbound cargo at its own port, so the consignee can clear and collect. | `DeliveryOrder` |
| **Payment Voucher** | Records money Duna **pays out**. Requires ID-card capture + recipient signature. | `Voucher` (`type = PAYMENT`) |
| **Receipt Voucher** | Records money Duna **receives**. | `Voucher` (`type = RECEIPT`) |
| **Ledger / Sub Customer / Customer Ledger** | The running Debit/Credit account for a party. | Derived; `Voucher` + `Invoice` feed it |
| **Ledger Statement** | A date-ranged statement of a customer's ledger — this *is* a statement of account. | Derived from `Ledger` |
| **General Journal** | Direct postings onto a party's ledger that are not invoices or vouchers (e.g. loans). | *Not currently modelled as such* |
| **Salary Slip** | The monthly payslip, carrying ID-card images and an employee signature. | `SalaryRecord` |
| **Warehouse receipt** | Issued at the destination when cargo is discharged; documents stay with the agent until release. | Mentioned once (EMP-675); not modelled. |
| **Company Archive** | A UI title dictated by the employer with no further detail. | *Not modelled* — see `open-questions.md` ARCH-01 |

---

## 5. Money, status and control words

| Term | Meaning |
|---|---|
| **Debit** | What the customer **owes** Duna. An issued invoice posts as Debit. |
| **Credit** | What Duna **owes** the customer, or what the customer has paid. A payment posts as Credit. |
| **Balance** | Debit − Credit. |
| **Sales** | The label the employer uses for the invoice side of the ledger. |
| **Paid / Partial Payment / Unpaid** | Invoice payment status. Also used for the release condition. |
| **Credit (as in "on credit")** | Released without payment — the customer pays later. **Do not confuse with the accounting "Credit".** The employer uses one word for both senses. |
| **Advance** | Money received before it is allocated — the real Receipt Voucher shows an "Advance" line. |
| **VAT / Value Added Tax** | Captured **per invoice line** as a percentage. |
| **TRN** | Tax Registration Number. Appears on the Tax Invoice header. The employer explicitly does **not** want it on Customer. |
| **Subtotal / VAT / Total Amount** | The three invoice totals. |
| **Alarm / Notice** | The employer's word for an alert. Two are requested: overdue invoice, unpaid release. |
| **Filter** | Used both for list filtering and for selecting report ranges ("using a few Filters we can bring out that P&L"). |
| **Starred** | The employer's word for a mandatory field. |
| **Option** | The employer's word for a field, a form control, or a feature — context-dependent. |
| **Status** | Used for cargo document status, invoice status, release status and customer status — four different concepts. |

---

## 6. Translation traps — read before translating anything

| Persian / spoken | Literal rendering | Correct rendering |
|---|---|---|
| صورتحساب | "statement" | **Invoice** (the document). "Ledger Statement" (گردش حساب) is the statement of account. |
| بارنامه | "waybill" | **Bill of Lading** |
| مانیفست | — | **Manifest** |
| نقل | "transfer / confectionery" | **Nagle — loose accompanying pieces.** Never translate it as "transfer". |
| انبار | "warehouse" | **Yard** in Duna's usage (an open storage area inside a port). |
| موجودی انبار | "warehouse stock" | **Yard Inventory** |
| لیست بارگیری | "loading list" | **Load List** — but the employer also uses it to mean the yard inventory itself. Check context. |
| کار / شماره کار | "work / work number" | **Job / Job Number** |
| صورتجلسه / بازرسی | — | **Inspection** |
| ترخیص | "clearance" | **Customs clearance** |
| حواله / ترخیصیه | — | **Delivery Order** |
| آزادسازی | "releasing" | **Release (Order)** |
| قبض پرداخت / قبض دریافت | "payment receipt / receipt" | **Payment Voucher / Receipt Voucher** |
| دفتر کل / دفتر معین | "general ledger / subsidiary ledger" | **Ledger**; the employer uses both for the same customer account. |
| روزنامه | "journal/newspaper" | **Journal** (General Journal) |
| حقوق / فیش حقوقی | "salary" | **Salary / Salary Slip** |
| مهر | "stamp/seal" | **Stamp** — and note the rule that Print must *omit* it. |
| فرمت | "format" | **Template** in most usages. |
| ستاره‌دار | "starred" | **Mandatory** |

---

## 7. Abbreviations seen in the real documents

See [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md)
for the evidence.

| Abbrev | Expansion | Source |
|---|---|---|
| `KHS` | Khorramshahr | B/L numbers `KHS/26-` |
| `RJS` | Rajaee (Bandar Abbas) | Employer example `RJS/26-` |
| `HAM` | Hamriyah | Employer example |
| `DSINV` | Duna Shipping Invoice | Tax Invoice `DSINV/26-172` |
| `DSMAN` | Duna Shipping Manifest | Manifest `DSMAN/KHO-26-006` |
| `DSKHS` | Duna Shipping, Khorramshahr | Manifest reference on the Tax Invoice |
| `DSPRO` | Duna Shipping Proforma | Proforma `DSPRO/26-001` |
| `DSQUO` | Duna Shipping Quotation | Quotation `DSQUO/25-017` |
| `TRN` | Tax Registration Number | Tax Invoice header |
| `POD` | Port of Discharge / proof of delivery — **ambiguous** | Shipment docs |
| `POL` | Port of Loading | Shipment docs |
| `CBM` | Cubic metre | B/L / Manifest |
| `IMO` | International Maritime Organization (number) | Vessel |

---

## duna-analysis/requirements/audio_2026-09-14_04-57-33.txt

نگاه، تو قسمت سمت چپ، دیتاها، یعنی قسمت سمت چپ این اپه که نوشته **Overview**، ما ۱، ۲، ۳، ۴، ۵، ۶؛ شش تا بخش کلی داریم که باید به این ترتیب باشه.

مثلاً اولین بخشش باید **Overview** باشه، بعدش باید **Operations** باشه، بعدش **B/L و Manifest** باشه، بعدش **Accounting**، بعدش اون **Master Data** و در آخر هم **Access Control**.

هر کدوم از این‌ها زمانی که روشون کلیک می‌کنیم، باید به صورت کشویی Optionهاشون باز بشه.

خب، حالا ما چیزی که می‌خوایم، شروع کنیم از **Master Data**. می‌خوایم شروع کنیم. خب، یه سری داده‌ها هست که ما باید از اول این داده‌ها رو وارد کنیم و به صورت فیکس توی سیستم بمونه دیگه.

و زمانی که تو جاهای مختلف، مثلاً مثل **Operations** یا صدور **بارنامه** یا صدور **Manifest** یا حالا صدور صورت‌حساب، این‌ها می‌خواییم صادر کنیم، یه سری Dataهای از قبل تعیین‌شده رو نیاز داریم که اونجا فقط باید اونا رو Select کنیم.

حالا برای Select کردنشون که دیگه مثلاً اون Operator نخواد به صورت دستی مجدد وارد کنه و مثلاً خطا بزنه یا اشتباه وارد کنه، تو قسمت Master Data اینا رو میاییم وارد می‌کنیم.

حالا Master Data یه سری ریز داره دیگه، یه سری حالت کشویی داره.

پس چی شد الان؟ شد اون قسمت Master Data.

آره، آره، قسمت Master Data شد:

**Customers، Ports، Yards، Vessels، Shippers، Consignees، Agents**

خب، اینا هر کدوم باید یه سری...

مثلاً الان می‌ریم تو بخش **Customers**.

خب، الان Customer برای این‌که بخواییم یه **New Customer** ایجاد کنیم، چون ما همه‌چیزمون بر اساس Customerـه.

خب، Customer شاید یه شخصی باشه که اصلاً هیچ اسمی ازش توی مشخصات بارنامه و اینا نباشه دیگه. یعنی یه مشتری شخصی ما هست، Internاله، یعنی داخلی خودمونه، خودمون می‌دونیم این مشتریمونه.

اصلاً شاید یه شخص حقیقی باشه، شاید یه شخص حقوقی باشه، ولی اسمش اصلاً نه توی بارنامه باشه، نه تو Shipper باشه، نه تو Consignee. یعنی یه چیز جداگونه است.

خب، حالا برای وارد کردن مثلاً Customer چه Optionهایی لازم داریم؟

مثلاً اول کار **Name** باشه دیگه؛ Name یا اسم شخصیه، مثلاً آرش علیدادی، یا حقوقیه، شرکت فلان.

**Contact Number**.

مثلاً الان ما می‌ریم Name، آرش علیدادی.

بعد دیگه حالا یه Contact Number، یه دونه Email، یه دونه Address.

حالا این یک Code خود سیستم بده.

فرمت Code دادنش چجوری باشه؟ مثلاً:

**CUST 3-3-1**

خب، اسم بعدی که می‌نویسیم، آقا مثلاً می‌دیم کیانوش جوکار.

خب، فقط اون Name ستاره‌دار باشه‌ها؛ یعنی بقیه Fieldها اجباری نباشه. پر کردنش اگه بود که بزنه، نبودم مهم نیست، یعنی Error نده. فقط اون Name مهمه.

خب، مثلاً اسم بعدی می‌شه کیانوش جوکار.

من می‌خوایم یه Customer جدیدی اضافه کنم به اسم کیانوش جوکار.

خود سیستم یه شماره بعدی رو بهش بده دیگه:

**CUST 3SF-2**

بعدی مثلاً سیروس فلان، علی محمودی.

خود سیستم اتومات دیگه یه شماره بهش بده، یه Code بهش بده:

**CUST 3SF-3**

دیگه همین‌جور به ترتیب Customerها بره بالا شماره‌گذاری بشه.

خب، Customerها گفتیم Optionهای پر کردن برای اون **Data Entry** چی‌ها لازمه؟

یکی Name، فقط ستاره‌دار باشه، همین.

اون Code هم که دیگه خود سیستم اتومات بهش می‌ده.

Contact Number و Email و Address هم جزو Option باشه، یعنی واجب نیست پر کردنش.

**CUST 2SF-1**، حالا **2SF-1، 3SF-1**، هر چیزی که می‌نویسه و بعدی **3SF-2**، بعدی **3SF-3**، **3SF-4**، **3SF-5** و همین‌جور دیگه تا مثلاً هزار تا Customer، دو هزار تا، سه هزار تا، هر چیزی که داری، این ثبت بشه و دیگه میاد تو List.

دیگه میاد تو List.

حالا **Edit** می‌ذاریم، **Delete** می‌ذاریم، **Status** می‌ذاره، هر چیزی که می‌ذاری اینجا، توی اون Listـه خودش مشخص می‌کنه دیگه.

مثلاً دیگه اون قسمت **Type** و نمی‌دونم **Currency** و **TRN Number** و اینا، اینا نیست؛ نیازی نیست توی اطلاعات Customer آورده بشه.

خب، اون Currency و بَند و بساط و این چیزاش مربوط به قسمت Accountingـشه که حالا بعداً توضیح می‌دیم.

پس اینجا اضافه کردن Customer فقط:

**Name**

حالا **Contact Number، Email، Address**

و اون Code.

Code هم که دیگه خود سیستم می‌ده.

فرمتش باید به این صورت باشه:

**CUST 3.1**

مثلاً دیگه Customer بعدی:

**3.2، 3.3، 3.4**

خب، بعدش که دیگه می‌خوایم بریم این Listهای Customerها رو ببینیم، که دیگه Customerهاش به صورتی جوریه که دیگه حالا مثلاً Customerـش، Statusـش، حالا Editـی داره، Delete داره، هر چیزی که داره دیگه.

اون قسمت Type و نمی‌دونم Currency و TRN Number و Short Name و این چیزها اصلاً نیازی نیست.

این از بخش Customerـش.

---

## duna-analysis/requirements/audio_2026-09-14_04-59-40.txt

خب، بعد از Customer می‌رسیم به مثلاً ثبت کردن Portها، بنادر.

خب، توی قسمت Port، ما اسم Port رو می‌نویسیم. خب، چون بعداً توی بارنامه وقتی می‌نویسه **Port of Loading** یا **Port of Discharge**، یعنی حالا بندر بارگیری یا بندر تخلیه، اسم Port رو باید بنویسی.

بعد Formatـش به این صورته که کاما با یه فاصله، Space، مثلاً اسم شهر، دوباره کاما با یه فاصله، اسم کشور.

مثلاً الان می‌خوایم Port بندرعباس رو ثبت کنیم، مثلاً Port رجایی رو ثبت کنیم. اسم Port چیه؟ مثلاً رجایی.

خب، آدرسش کجاست؟ به این صورت می‌شه که آقا مثلاً:

**Bandar Abbas, Persian Gulf, Iran**

مثلاً این‌جوری.

الان مثلاً برای بوشهر می‌خوایم ثبت کنیم:

**Bushehr, Persian Gulf, Iran**

یا همچین حالتی.

مثلاً برای Hamriyah Port دبی ثبت کنیم:

**Hamriyah Port, Dubai, UAE**

این‌جوری.

الان می‌خوایم مثلاً مال Port صحار رو ثبت کنیم.

خب، مثلاً می‌شه:

**Port of Sohar, Oman**

بعد اون براش می‌شه چی؟ مثلاً Oman، اسم کشورش می‌شه Oman.

خب، حالا این برای کدها، یه Abbreviation باید در نظر بگیریم. مثلاً حالت اختصاری.

خب، چون Load List، Load List خیلی فضا می‌گیره، پس به خاطر همین اینجا یه Abbreviation برای اون اسم Port در نظر می‌گیریم.

که زمانی که می‌خوایم توی Load List و اینا نگاه کنیم، Port مبدأ و Port مقصد به صورت Abbreviation، یعنی اختصار، نوشته شده باشه؛ نه این‌که اسم کامل Port نوشته باشه.

چون خیلی جا می‌گیره و فضا زیادش خالی می‌کنه، به خاطر همین.

خب، پس برای Port چی کار می‌کنیم؟ یه اسم Port می‌نویسیم، حالا شهرش و کشورش و اون Abbreviation، یا حالا به‌صحبت همین Code که از این Code توی اون Load List، توی نمایش Load List، وقتی می‌خوایم برای وارد کردن یک Cargo جدید اطلاعات Data رو وارد کنیم، اون Port و بندر و Destination رو Select می‌کنیم، انتخاب می‌کنیم.

مثلاً نوشته آقا:

**Hamriyah Port, Dubai, UAE**

مثلاً این رو Select می‌کنیم.

بعد زمانی که می‌خوایم بیایم توی اون List نگاه کنیم، نوشته مثلاً **Port of Loading**، حالا دیگه اینجا به جای این‌که نوشته باشه Hamriyah Port, Dubai، مثلاً براش Abbreviation تعریف کردیم:

**HAM**

مثلاً Hamriyah؛ اونجا دیگه نوشته **HAM**، نه این‌که کامل نوشته باشه Hamriyah Port, Dubai.

اوکی؟

حالا این اسم Port باید حالا این می‌تونه همه‌ش ستاره‌دار باشه دیگه؛ یعنی اسم Port ستاره باشه، شهرش ستاره باشه، Countryـش هم ستاره باشه، اون Codeش هم که خودمون بخوایم یه Abbreviation براش بزنیم، اونم ستاره‌دار باشه.

بعد دیگه می‌زنیم **Create Port**، Port ثبت می‌شه.

اینم قسمت Portش.

---

## duna-analysis/requirements/audio_2026-09-14_05-00-18.txt

خب، حالا برای وارد کردن **Yard**ها.

Yardها چه زمانی به دردمون می‌خورن؟

زمانی که یه Cargo می‌خواییم تحویل بگیریم، ببینیم تو کدوم Port تحویل گرفتیم و تو کدوم Yard تخلیه‌ش کردیم دیگه.

تو اون قسمت Dataهایی که می‌خواییم وارد کنیم، برای **Operations** و نمی‌دونم **Yard Inventory** و این چیزها، این **Location** تخلیه اون کالا مهمه.

حالا اینجا می‌گم تعریفش می‌کنیم دیگه.

Yard زمانی که بخواییم Yardها رو تعریف کنیم، این‌که فقط مشخص کنیم مال کدوم Portه و این‌که اسم Yard چیه.

مثلاً:

**Port Hamriyah — Yard F15**

تموم، همین کفایت می‌کنه دیگه.

---

## duna-analysis/requirements/audio_2026-09-14_05-00-51.txt

خب، زمانی هم که می‌خوایم Selectـش کنیم، مثلاً زمانی که یک Cargo تحویل می‌گیریم، فرضاً اونجا نوشته که **Port of Loading** دیگه.

می‌خواییم یک Data Entry کنیم، می‌خواییم یک Cargo رو ثبت کنیم.

خب، Cargoای که می‌خواییم ثبت کنیم، یکی از Optionهاش اینه که Port بارگیری دیگه، بندر بارگیریش چیه.

مثلاً **Hamriyah** رو انتخاب می‌کنیم.

به محض این‌که Hamriyah رو انتخاب کردیم، Yardهایی که قبلاً به اسم Hamriyah ثبت کردیم، است یعنی... البته میاد بالا.

حالا مثلاً **B15**، **B16**، **B17**، هرچی هست، اونجا ثبتش می‌کنیم.

یعنی به صورت اتومات این Yardهایی که مربوط به Hamriyah هستن میاد بالا.

یا مثلاً Yardهایی که برای **Jebel Ali** ذخیره کردیم، اتومات میاد بالا.

Yardهایی که مثلاً برای **Rajai / Bandar Abbas** ثبت کردیم، اتومات میاد بالا.

اونجا Selectـش می‌کنیم.

---

## duna-analysis/requirements/audio_2026-09-14_05-01-56.txt

خب، بعد از Yard می‌رسیم به **Vessels**، یعنی کشتی‌ها.

خب، برای کشتی‌ها می‌تونیم اسم کشتی رو در نظر بگیریم، **Vessel Name**.

و حالا اگه چیز دیگه‌ای دارن، دیگه... حالا کشتی‌ها به چند تا تیپ تقسیم می‌شن.

حالا یا **Tug & Barge** هستن، که می‌شه **Tug** و **Barge**؛ یا **Landing Craft** هستن؛ یا حالا **Vessel** هستن دیگه.

اینا رو می‌تونیم حالا هم **Tug Name** و **Barge Name** بنویسیم، هم Vessel Name فقط بنویسیم.

هم این‌که یه Option آی IMO Number هم براش در نظر بگیریم.

IMO Number هم... [بخش نامشخص است.] اصلاً مهم نیست، همون فقط اسم کشتی و مشخصاتش.

حالا می‌گم که کشتی‌ها دو مدل داریم؛ باید یا **Tug & Barge** هست که می‌نویسه:

**Tug Name / Barge Name**

یا مثلاً:

**Vessel Name / Landing Craft Name**

مثل این‌جوری همچین چیزی.

خب، **Load List**، Loading List، Print.

به فرض می‌خواییم بگیم که آقا مثلاً ۲۰ تا ماشین، کارهای اسنادش آماده شده.

حالا می‌خواییم وارد Loading Listشون کنیم.

Loading List رو آماده کردیم.

حالا می‌خواییم وصلش کنیم به کشتی دیگه.

مثلاً بگیم که آقا این ۲۰ دستگاه برای کشتی **Mahdi Yazd** هست.

اینو Print بگیریم، بدیم دست Operatorها.

Operatorها که دیگه طبق Loading Listی که بهشون دادیم، آقا مثلاً فلان دستگاه این تاریخ وارد شده، این‌قدر Package همراهشه، توی این Yardه.

می‌خواییم مثلاً الان Load List کشتی **Mahdi Yazd** است دیگه.

۲۰ دستگاه لیست کردیم براش که توی Mahdi Yazd بارگیری کنه.

و دیگه کجا این اسم کشتی به درد می‌خوره؟

توی بارنامه.

توی صدور بارنامه، صدور بارنامه و Manifest دیگه اتومات بده.

مثلاً فرض کن Mahdi Yazd تو سال ۲۰۲۶ این الان بار اولش داره می‌ره خرمشهر.

پس زمانی که داریم بارنامه خرمشهر رو صادر می‌کنیم، **Vessel Mahdi Yazd** مثلاً می‌شه:

**Voyage 1/26**

اگه بار دومش باشه که توی سال 2026 داره می‌ره خرمشهر، مثلاً بشه:

**Voyage 2/26**

یعنی اینو خود سیستم باید اتومات بده.

بار سومش باشه، مثلاً می‌شه:

**Voyage 3/26**

خب، این برای هر Destination جدا باید تعریف بشه.

که این خود سیستم اینو باید...

مثلاً Mahdi Yazd شاید سفر بعدیش بره بندرعباس.

برای بار اولش می‌ره بندرعباس.

پس توی برنامه بندرعباس، مثلاً اسم کشتی می‌شه Mahdi Yazd، Voyageـش می‌شه **Voyage 1/26**.

یعنی چی؟

پس زمانی که شما خواستی بارنامه خرمشهر رو صادر کنی، اسم Mahdi Yazd رو مثلاً انتخاب کردی، Voyageـش خودش اتومات مثلاً باید بیاد:

**Voyage 5/26**

یعنی آقا، بار پنجمشه که داره توی سال 2026 می‌ره سمت خرمشهر.

Manifest هم که دیگه حالا اون Details بالاشی که می‌خواییم وارد کنیم، یکی از گزینه‌هاش اسم کشتیه دیگه.

اسم کشتی و Voyage، این Detailsهای Manifest حتماً باید قید بشه.

خب، حالا اینجا چه Optionهایی لازم داریم برای این‌که اسم کشتی‌ها رو اضافه کنیم؟

همونی که گفتم:

فقط اسم کشتی.

حالا اگه **Tug & Barge** که بنویسه:

**Tug Name / Barge Name**

اگر هم که Landing Craft یا کشتیه که دیگه حالا مشخص می‌شه:

**Vessel Name**

یه دونه اسم داره.

یه **IMO Number** هم براش بذاره.

IMO Number هم جزو چیزشه، دیگه جزو Optionش باید باشه، نه جزو... ستاره‌دار.

یعنی اگه داشتیم وارد کنیم، اگه هم نداشتیم Error نده دیگه، ثبت کنه.

---

## duna-analysis/requirements/audio_2026-09-14_05-02-13.txt

گزینه بعدی **Shippers**.

Shippers که دیگه مشخصه دیگه. اولین دیتایی که توی بارنامه ثبت می‌شه، **Shipper**ه.

اطلاعات Shipper هم باید به این صورت باشه:

**Name**

مثلاً National ID، یا مثلاً بعضی کشورها National ID ندارن، **TRN Number** دارن، حالا یا هر چیز دیگه‌ای دارن.

**National ID / TRN Number**

**Address**

**Contact Number**

**Email**

اینا جزو Optionهاش باشه.

اگه بود که بنویسه، اگه هم نبود مثلاً Error نده.

فقط اون اسم Company، حقیقی یا حقوقیه، اون ستاره‌دار باشه.

بقیه موارد جزو Option باشن، یعنی مثلاً اختیاری باشه.

---

## duna-analysis/requirements/audio_2026-09-14_05-02-40.txt

این Shipper چه زمانی به درد می‌خوره؟

زمانی که می‌خواییم صدور بارنامه کنیم، اولین دیتایی که باید وارد کنیم Shipperـشه دیگه.

Shipper، مشخصات Shipper.

توی Manifest هم یکی از گزینه‌ها Shipperـه که دیگه اونجا انتخابش می‌کنیم.

---

## duna-analysis/requirements/audio_2026-09-14_05-02-53.txt

**Consignee** هم دقیقاً همون چیز **Shipper**ه، همون اطلاعاته.

خب، **Consignee** حالا یا شخصیت حقیقیه یا حقوقی.

پس برای Consignee یه **Name** باید بنویسیم.

بعد **National ID** یا **TRN Number**. حالا مثلاً اینو تو یه ردیف می‌شه بنویسی یا با یه Slash می‌شه جداش کنی.

اگه **National ID** داشتیم، National IDـشو می‌زنیم؛ اگه **TRN Number**شو داشتیم، TRN Numberـشو می‌زنیم.

**National ID / TRN Number**

دیگه ورد بگم:

**Address**

**Contact Number**

**Email**

تمام.

---

## duna-analysis/requirements/audio_2026-09-14_05-03-16.txt

خب، مرحله آخری هم که توی این Master Data، یعنی Option دیگه‌ای که توی Master Data اضافه کنیم، **Agents** هستن دیگه.

Details ایجنت هم باز به همون صورت، مثلاً به صورت:

**Name**
**Address**
**Contact Number**
**Email**

این Agent Dataها باید توی بارنامه قید بشه.

حالا مثلاً Agent بندرعباس، توی بارنامه‌های بندرعباس؛ Agent مثلاً بوشهر، توی بارنامه‌های بوشهر.

Agent هر مقصدی متفاوته که دیگه توی بارنامه‌های مربوط به همون مقصد قید می‌شه.

خب، این رسیدیم به مرحله Master Data.

این یه سری Dataهایی هست که به صورت پیش‌فرض باید ذخیره کنیم، چون تو جای‌جای مختلف باید از اینا استفاده کنیم.

---

## duna-analysis/requirements/audio_2026-09-14_05-03-32.txt

خب، نگاه، این باید هر کدوم از اینا به صورت جداگونه تعریف بشه.

چون Customer ممکنه که آقا مثلاً Shipper ما نباشه، Consignee ما نباشه.

Customer یه شخصیت حقیقی یا حقوقی جداگونه هست که به صورت خصوصی با ما در ارتباطه.

امکان داره که مثلاً مشتری ما به صورت تلفنی با ما در ارتباط باشه.

حالا رفته باشه مثلاً از چین یا امارات یا حالا هر کشور دیگه، یه دستگاه، یه چیزی خریده باشه.

Shipper ما مثلاً می‌شه اون شرکت فروشندهه.

متوجه‌ای؟ که اطلاعاتش رو باید بیاریم توی بارنامه.

Consigneeمون هم می‌شه حالا کسی که اون شرکتی که مثلاً توی مقصد به نامه، حالا هر چیزی که می‌خواد بزنه.

خب، ما تو بخش Customer کاری به این Shipper و Consignee و فلان، این حرف‌ها نداریم.

Customer مستقیم کسیه که ما باهاش در ارتباط داریم و صورت‌حساب براش صادر می‌کنیم.

حالا مثلاً می‌گه ما یه مشتری، فرض کن یه مشتری ما داریم، به ما یه دستگاهی می‌ده توی استرالیا.

خب، به ما می‌گه آقا مثلاً اینو خرمشهر به ما تحویل بده.

Customer ما کیه؟

مثلاً آرش علیدادیه. تمام شد، رفت.

پس این دستگاه به نام آرش علیدادی توی سیستم ما ثبت شده.

ما فقط آرش علیدادی رو می‌شناسیم.

حالا اون شرکت استرالیا Shipper کیه؟

بعد دوباره Consignee کیه؟

جدا می‌شه.

از اونجا برمی‌داریم میاریم جبل‌علی، مثلاً امارات.

از جبل‌علی ترخیص می‌کنیم.

میاریم Hamriyah Port Dubai.

از Hamriyah Port Dubai بارگیری می‌کنیم.

این رو می‌فرستیم خرمشهر.

این ETOZـه.

از زمانی که Start می‌زنیم تا زمانی که مثلاً تحویل می‌دیم، یه سری هزینه‌ها به صورت Frequent و مکرر انجام می‌شه.

فرض کن آقا هزینه تعمیرات، یا مثلاً هزینه کشتی، هزینه ترخیص، هزینه کمرشکن، هزینه جابه‌جایی، هر چیزی که هست.

از زمانی که این Start کار زده می‌شه و این چیز ثبت می‌شه، مثل یه حالت **Job Number**، مثل یه حالت **Job Number**، مثل حالت یادداشت، مثل حالت Note، که آقا ما Note برداری کنیم که از روز اول این چی خرجش شده.

Job Number، Job Number، Invoice.

حالا می‌خوایم بگیم که مثلاً آقای آرش به عنوان Customer ما، Invoice که می‌خوایم براش صادر کنیم، از این Job Number مثل Note استفاده می‌کنیم دیگه.

بیا اینجا مثلاً هزار درهم خرج Repairing شده، هزار درهم ترخیص جبل‌علی شده، هزار درهم کمرشکن شده تا اومده Hamriyah، دوباره اینجا مثلاً ۵۰۰ درهم خرج اسناد گمرکی شده و دوباره مثلاً ۱۰,۰۰۰ درهم هزینه شده تا رسیده به خرمشهر.

خب، این زمانی که این Invoice رو صادر می‌کنیم، Invoice به نام کی صادر می‌شه؟

یعنی این Invoice در سیستم ما برای آرش علیدادی که Customerمونه صادر می‌کنیم.

خب، حالا امکان داره Details داخلش، مثلاً آرش می‌گه آقا این Bill of Lading رو بزن به نام مثلاً فلان شرکت.

خب، این دیگه مهم نیست.

برای Bill of Lading هر چیزی بخواد، ما براش می‌زنیم.

هر اسمی می‌خواد باشه.

زمانی که دیگه صورت‌حساب رو صادر کردیم، این بره توی پروفایل آرش علیدادی بشینه دیگه.

مثلاً یه Invoice براش صادر کردیم، به عنوان Sales می‌ره تو قسمت Ledgerش می‌شینه، به عنوان مثلاً Debit می‌شینه توی حسابش.

مثلاً جمعاً آقا از این ETOZ شده چهل هزار درهم.

خب، این بیاد توی سیستم آرش علیدادی بشینه.

حالا بقیه مشتری هم به همین منوال دیگه.

هر کدوم یه Profile داشته باشن که زمانی من آقا مثلاً می‌زنم آرش علیدادی، می‌رم توی Profile آرش، ببینم آقا چند تا Invoice براش صادر کردم، چقدر پول به ما داده، چقدر بدهکاره، چقدر بستانکاره.

این حسابش Credit و Debitـش، از زمانی که آخرین صورت‌حساب براش صادر کردیم چقدر وقت ازش گذشته.

صورت‌حسابشو پرداخت کرده، Paid شده، Unpaid شده، یا Partial Paymentـه.

یه همچین چیزی.

به خاطر همین دارم می‌گم که آقا، این Customer کاملاً جداگونه از Shipper و Consignee و بقیه اطلاعات هست.

Customer یه چیز Internalـه، یعنی داخلیه و فقط برای ما هست.

---

## duna-analysis/requirements/audio_2026-09-14_05-05-14.txt

خب، حالا مرحله بعد از این Master Dataهایی که وارد کردیم، می‌ریم بر سر اولین بخش اصلی من که همون Operationsه.

Operations یعنی عملیات.

خب، اولین گزینه‌ش که می‌نویسه **Cargo**.

خب، زمانی که این چه زمانیه؟ زمانی که ما یک کالایی رو می‌خواییم Register کنیم دیگه.

اولاً یه جایی تحویل گرفتیم، یکی از بنادر سراسر دنیا، مثلاً دستگاهی، Cargo، کانتینری، یه چیزی تحویل گرفتیم برای جابه‌جایی.

خب، تو این قسمت زمانی که واردش می‌شیم، یه سری دیتاها باید وارد کنیم دیگه تا این Cargo ثبت بشه.

خب، زمانی که اولین Cargo رو می‌خواییم ثبت کنیم، یعنی **New Cargo** که بزنیم، این Optionهای فیلدها بیاد بالا که اینا رو پر کنیم.

اولین چیزی که مهمه **Customer**ره.

ببینیم این جنس، این Cargo، این کالا مال کیه، یعنی کدومیه که از مشتری‌های ما هست.

مثلاً می‌خواییم بگیم این کالا مال آرش علیدادیه.

خب، این آرش علیدادی رو ما قبلاً توی اون Master Data وارد کردیم دیگه.

الان که می‌خواییم یک Cargo ثبت کنیم، اولین چیزی که میاد بالا باید Customer باشه.

این Cargo مال کیه؟ مثلاً مال آرش علیدادیه.

خب، چیه؟ یه سری Optionها باید اینجا اضافه کنیم دیگه تا این دیتا ثبت بشه، تا این Cargo ثبت بشه.

خب، اولین چیزی که باید توی قسمت Register کردن یک Cargo در نظر بگیریم، اولین چیز باید این Customer مشخص بشه.

ببینیم مشتری‌مون، یعنی این دستگاه، Cargo یا Container، هر چیزی که ما یک جایی تحویل گرفتیم، این مال کیه؛ یعنی بره توی حساب کی.

این Customer اینجا، اونجایی که دیتا توی Master Data داشتیم Customerها رو وارد می‌کردیم، اینجا باید بیاد بالا که Selectش کنیم.

حالا یا اسمشو بنویسیم یا کدشو مثلاً Search بنویسیم، میاد بالا، Selectش می‌کنیم.

Option بعدی **Shipper Name**.

اسم Shipper رو باید بنویسیم.

و آقا، از چه... [نامفهوم] اینو تحویل گرفتیم.

**Port of Loading**، بندر بارگیریش کجاست؟

**Port of Destination**، یعنی اون بندری که مقصد کالا کجاست.

یه **Description** براش در نظر بگیریم، شرح کالا.

**Chassis Number**

**Serial Number**

**Number of Units**

**Number of Packages**

چند تا دستگاه هست، چند تا Package.

مثلاً امکان داره ما یه دستگاه بگیریم، سه، چهار تا Nagle هم همراهش باشه.

**Weight**

بعد اون **Weight Unit** هم باید مشخص کنیم که عمدتاً Kilogramـه.

و **Arrival Date**، تاریخ که دریافت کردیم.

**Yard**.

خب، اینجا مثلاً زمانی که ما داریم Port of Loading و مثلاً Hamriyah رو انتخاب می‌کنیم، این Yardهایی که قبلاً توی Master Data وارد کرده بودیم برای Hamriyah، این Yardها اتومات میاد بالا دیگه.

یعنی زمانی که Port رو انتخاب می‌کنیم، اتوماتیک اسم Yardهاشون میاد بالا و اینجا Select می‌کنیم.

خب، Option بعدی **Document Status**ه.

آقا، این با چه اسنادی اومده وارد Port شده؟

مثلاً **EXID** داشته، **BCC** داشته، **Local Transfer** بوده.

حالا اینو بچه‌ها به صورت دستی وارد می‌کنن که چه نوع Documentـی.

مرحله بعدی **Inspection**شه، بازرسیشه.

مثلاً کلی گمرکات دبی، زمانی که آقا یک کالا، یک چیزی رو توی گمرک تحویل می‌گیری و می‌خوای بارگیری انجام بدی، باید Documents، اسناد و گمرکش رو آماده کنی.

بعد مثلاً یک نوبت بازرسی Book کنی.

اصطلاحاً می‌گن **Book Inspection**.

مبلغش رو پرداخت می‌کنی و تایمش هم Book می‌کنی.

و زمان بازرسیش که فرامی‌رسه، بازرسی رو انجام می‌دن.

و Pending هم خود متنه.

خود متن Pending رو مثلاً می‌تونی قرمز در نظرش بگیریم، که توی اون Load Status، توی اون قسمت کلی، مثلاً مثلاً Yard Inventory مشخص بشه که آقا این Inspectionـش انجام نشده.

و گزینه آخرش هم که دیگه **Loading Date / Loading Time**ه، تایم بارگیریشه که مشخص کنیم آقا Arrival Dateش بوده، Loading Timeش کی بوده.

این‌که نیاز داریم زمانی که بخواییم **Storage** یا انبارداریش رو پرداخت کنیم، **Number of Days**، زمانی که بخواییم Number of Daysـش نگاه کنیم که آقا این چند روز توی Port بوده و بخواییم بریم انبارداریش حساب کنیم، اینو بدونیم.

حالا یک Comment باید اینجا در نظر بگیریم.

حتماً حتماً حتماً.

چرا؟

چون که مثلاً بعضی مواقع یک سری هزینه‌ها انجام می‌شه برای یه دونه دستگاه، یه مشتری، و این وقتی توی Comment آورده بشه دیگه این از فراموشی جلوگیری می‌شه.

دیگه و بعد این Commentها مثلاً برای کجا مفیده؟

برای زمانی که می‌خوایم توی قسمت Accounting صورت‌حساب مشتری صادر کنیم.

اون حسابدار این Commentها رو می‌بینه دیگه.

مثلاً می‌بینه که آقا این دستگاهی که اومده، هزینه مثلاً Transportـشو ما پرداخت کردیم، هزینه گمرکیشو مثلاً ما پرداخت کردیم.

اگه تعمیراتی داخل Port نیاز داشته، مثلاً ما انجام دادیم، پرداخت کردیم.

اینو بچه‌های عملیات تو قسمت Comment، یعنی اون کارمندی که به حساب مسئول این کارها هست، تو قسمت اون Comment می‌نویسه.

و دیگه اون حسابدار اتومات، زمانی که می‌خواد صورت‌حساب‌هاش رو صادر کنه، می‌تونه این Commentها رو بخونه.

و دیگه نیازی به سؤال کردن و مثلاً متفرق رفتن این طرف و اون طرف و پرس‌وجو کردن و حالا مثلاً این چیزا نباشه.

این Commentها.

خب، بعد که دیگه این دیتاها رو وارد کردیم، Cargo Register می‌شه دیگه.

آقا مثلاً میاد تو قسمت این List خود Cargoها دیگه.

میاد تو قسمت List خود Cargoها.

خب، زمانی که دیگه این List Cargoها نوشته شد و مشخص می‌شه که آقا مثلاً این مشتری‌مون الان List داریم دیگه.

مثلاً Customerها کی هستن؟

آرش علیدادی، کیانوش جوکار.

خوب، بعد مشخصه دیگه، آقا این دستگاه فلانه، Chassis Numberش هم فلانه.

به فرض مثلاً Hamriyah به خرمشهره.

خب، اینا باید یه سری Filterها داخلش داشته باشه دیگه.

چرا؟

چون زمانی که مثلاً من به عنوان مدیریت بخوام تصمیم بگیرم که آقا الان این کشتی، این شناور رو به کدوم مقصد اختصاص بدم، یعنی مثلاً کجا بارگیری کنم و به کدوم مقصد اختصاص بدم، این باید برای من مشخص کنه که مثلاً آقا ما برای خرمشهر ۳۰ تا دستگاه داریم.

برای مثلاً مقصد بوشهر، به فرض مثلاً ۱۰ تا دستگاه داریم.

برای مقصد بندرعباس مثلاً ۱۰ تا دستگاه داریم.

خب، پس یه چیز طبیعیه که من آقا بلافاصله کشتی رو اختصاص می‌دم به خرمشهر.

خب، زمانی که ما می‌خواییم بارگیری خرمشهر رو انجام بدیم، فرضاً که آقا کشتی اومده توی یکی از اسکله‌های Hamriyah پهلو گرفته.

خب، ما اینجا کارمندها مدارک‌ها رو جمع می‌کنن، کارهای Inspection رو انجام می‌دن.

خب، زمانی که کار Inspection رو انجام دادن، توی اون قسمت Inspection، مثلاً حالت Done.

حالا یه گزینه Selectی، یه چیزی باید اونجا قرار بدی که آقا این کارمند اونجا انتخاب کنه که این Inspectionـش انجام شده.

خب، دستگاه‌ها و Cargoهایی که مثلاً Inspectionـشون انجام شده، شرط لازم هستن که وارد به حساب اون Loading List بشن.

حالا Loading List چیه؟

یه کشتی، اسم کشتی‌هایی که مثلاً ما قبلاً وارد کردیم تو اون Master Dataها، اینجا به دردمون می‌خورن.

یه Loading List آماده کنیم، Print بگیریم و تحویل Operatorهای بارگیری بدیم، که بارگیری رو شروع کنن.

خب، حالا مثلاً ما Option Loading List؛ Loading List می‌تونه یک کمک به ما کنه که آقا مثلاً اگه دستگاهی Inspection نشده باشه، اتوماتیک براش نیارتش، اجازه نده که ما انتخابش کنیم برای Loading List.

مثلاً Error بده.

Errorش چی باشه؟

که آقا مثلاً Inspectionـشو انجام ندادیم.

اگه Inspectionـشو انجام داده باشن و از حالت Pending به حالت Done رفته باشه، ثبت شده باشه، پیش‌شرطش باشه که ما بتونیم برای Loading List انتخابش کنیم.

خب، فرض کن مثلاً از تعداد کل Yard Inventoryهای ما که پنجاه تا هست، مثلاً بیست‌تاش برای خرمشهره.

خب، از این بیست‌تایی که برای خرمشهره، فرض کن بیست‌تاش Inspectionش انجام شده و مستعده این است که مثلاً وارد Loading List بشن.

خب، Loading List آماده می‌کنیم.

Loading List شامل چی باید باشه؟

شامل یه سری اطلاعاتیه که از قبل وارد کردیم دیگه.

خب، مثلاً:

بندر بارگیری، بندر مقصد، Description، Chassis Number، Serial Number، تعداد دستگاه، تعداد Package، Weight، تاریخ ورود، Yard و این چیزا.

و Inspectionـش Done شده باشه.

که اینا ما Print بگیریم، بدیم دست Operator و Operatorها بدونن این دستگاهی که مثلاً تو فلان Yard حمریه، Inspectionـش هم انجام شده و آماده بارگیریه.

خب، این List، مثلاً بیستایی، Print گرفتیم تحویلش داریم.

خوب، اینا یه سری ریزه‌کاری‌های دیگه هم داره.

به فرض فرض کنید شب اولی که کشتی میاد و ما می‌خواییم شروع به بارگیری کنیم، از جمع این ۲۰ دستگاه الان می‌خواییم یه Loading List آماده کنیم، بدیم دست Operatorها که شروع به بارگیری کنن.

دیگه فرض کنید که شب اول مثلاً از این ۲۰ تا، ۷ تاشو Inspection کردیم و ۷ تا آماده بارگیریه.

خب، این Loading List رو که به وجود میاریم، Create می‌کنیم، ۷ تا دستگاه میاد توی Load List ما.

Print می‌گیریم، می‌دیم دست Operatorها که بارگیری کنن.

خب، فردا ۱۳ تای بقیه رو مثلاً فردا آماده می‌کنیم، دوباره می‌گیم همون Loading List رو Edit می‌کنیم، اون ۱۳ تای دیگر هم بهش اضافه می‌کنیم.

یک‌جا Print می‌کنیم، می‌دیم دست Operatorها که بدونن مثلاً اون ۷ تای دیروز بارگیری کردن، ۱۳ تای دیگه هم مثلاً آماده بارگیری شده.

خب، زمانی که دیگه بارگیری تمام می‌شه و Operatorها به ما اعلام می‌کنه که مثلاً از این List بیستی که به ما تحویل دادید، ۱۹ تاشو تونستیم بارگیری کنیم.

مثلاً یه دونه‌شو به هر دلیلی نشده بارگیری کنیم؛ یا جا نبوده، یا خراب بوده، یا Crane مشکل داشته، یا هر چیزی.

یه دونه‌ش مونده.

این یه دونه قابلیت اینو داشته باشه که از Loading List حذفش کنیم و برگرده توی Yard Inventory و قسمت همون Cargo، همون که موجود بمونه برای مثلاً Trip بعدی، برای کشتی بعدی، برای بارگیری بعدی.

خب، زمانی که دیگه این Load List تکمیل شد و دیگه مشخص شد و Finalized شد و Load List بسته شد، یا مثلاً این کشتی Mahdi 11 از این مجموع مثلاً ۲۰ دستگاه موجود، ۱۹ تاشو بارگیری کرده، خب حالا این ۱۹ تاهه می‌ره برای مرحله صدور بارنامه و Manifest.

خب، این ۱۹ تایی که ما داریم، خب هر کدومش متعلق به یه Customerه دیگه.

خب، حالا هر بارنامه‌ای هم که می‌خواییم صادر کنیم:

Shipper، Consignee، شماره بارنامه.

مثلاً شماره بارنامه برای هر مقصد باید مشخص، مثلاً طبق فرمی که بهش دادیم، Generate کنه دیگه.

مثلاً برای خرمشهر نوشتیم، به فرض:

**KHS/26-2/2026**

یا مثلاً برای رجایی اگه می‌خواییم بارنامه صادر کنیم:

**RJS/26-10**

خط فاصله... مثلاً این ۱۰ همین بارنامه‌ایه که ما تو سال ۲۰۲۶ برای رجایی صادر کردیم.

خب، زمانی که دیگه همه Detailsهای بارنامه هم آوردیم، نگاه Shipperها رو قبلاً تو Data Master Dataها وارد کردیم.

اینجا Select می‌کنیم.

Consignee را همین‌طور، قبلاً وارد کردیم، صادر می‌کنیم، انتخاب می‌کنیم.

Notify Party هم به همین صورت.

اسم کشتی، Voyage را که دیگه سیستم خودش اتوماتیک باید تشخیص بده که این کشتی بار چندمه‌ست که داریم این رو خرمشهر...

Port بارگیری که قبلاً وارد کردیم، اینجا Select می‌کنیم.

Port مقصد هم همین‌طور.

خب، می‌رسیم بر سر اون فرمت بارنامه که مثلاً قسمت **Quantity** داره، تعداد داره، **Marks & Numbers** داره، Description داره، وزن خالص، وزن ناخالص داره، **CBM** داره.

بعد پایینش مثلاً Total داره.

Shipper، کالا، هر چیزی که مشتری مدنظرشه، توی Shipper قید باشه.

بعد **Place of B/L Issue** داره.

اون **Freight Charges**، حالا قسمت **Collect** یا **Prepaid** باید داشته باشه.

تاریخ، مثلاً تاریخ صدور بارنامه.

اون قسمت Stampـش، یا مثلاً یک سری توضیحاتی که کنوانسیون‌ها و قوانین بین‌المللی بارنامه از طبق همون فرمی که بهش می‌دیم، بارنامه صادر بشه.

خب، بارنامه رو... بارنامه اولین چیزی که بارنامه صادر می‌شه باید به صورت **Draft** باشه.

که مثلاً قسمت Watermarkـش **DRAFT** خورده باشه و ما بفرستیم برای مشتری چک کنه.

اگه مثلاً نیاز به اصلاحات داشته باشه، یک کم یا زیاد کردن یک سری اطلاعات باشه، به ما اعلام بده.

و بعد که Final شد، تمام شد، Approved شد، بارنامه صادر بشه و از حالت Draft در بیاد.

خب، زمانش که از حالت Draft در اومد، خب الان بعدش دیگه می‌خواییم چکار کنیم؟

می‌خواییم Manifest رو صادر کنیم دیگه.

می‌خواییم Manifest رو صادر کنیم و تحویل مثلاً کشتی بدیم دیگه.

خب، Manifest هم طبق همون فرمت خودمون که مثلاً وارد سیستم بکنیم.

اسم کشتی، Voyageـش، مثلاً Manifest Numberـش طبق همون فرمت دلخواه‌مون، تاریخ، مثلاً بارگیری، بندر بارگیری، بندر خروج و یه سری Dataهای دیگه.

یه هم مثلاً اسم و مشخصات کشتیرانی خودمون اون وسط در نظر گذاشته‌ای.

بخوای همون Formatـی که داریم Upload بکنیم توی سیستم.

خب، Titleهاش هم که دیگه شامل مثلاً ردیفه، شرح کالا هست، بعد دیگه مثلاً Consignee، Shipper، وزن، تعداد که در نهایت تعداد صفحات Manifest، مثلاً دو صفحه باشه، سه صفحه باشه، هر چیزی که باشه.

صفحه آخر هم یه Total Weight، Total Quantity رو هم به ما بده که آقا Total این‌قدر دستگاه و این‌قدر Package به Weight این‌قدر مثلاً بارگیری شده.

خب، زمانی که ما بخواییم... چه PDF بارنامه، این باید یه خروجی به ما بده دیگه برای بارنامه‌ها.

حالا یا خروجی Excel به ما بده و خروجی PDF.

هر کدومش که حالا بنا به نیاز شد.

اگه PDF خواستیم PDF بده، اگه هم Excel خواستیم Excel بده.

یا مثلاً مستقیم PDF بگیره.

زمانی که بخواییم PDF بگیریم، باید اون Stampها و Markها و امضاها اتومات توی سیستم باشه.

یعنی اونجا خودش زمانی که می‌خواییم PDF بارنامه رو بگیریم، اون Stampها رو خودش زده باشه؛ یعنی آماده باشه.

ولی زمانی که بخواییم Print بگیریم، یعنی بخواییم Stamp زنده یا مهر زنده بزنیم، دیگه اونا رو باید اتومات حذف کنه.

که مثلاً اون Stamp زنده زده بشه.

خب، بارنامه رو می‌فرستیم برای مشتری.

همون‌طور Manifest هم که Print می‌گیریم، مهر زنده تحویل به ناخدا می‌دیم.

یه نسخه PDFش هم می‌فرستیم برای Agent مقصد.

---

## duna-analysis/requirements/audio_2026-09-14_05-05-37.txt

اطلاعات Manifest به چه شکله؟

اطلاعات Manifest، اون سر تیترش یه سری Dataها هست؛ از این‌که اسم کشتی، حالا یا **Tug & Barge** یا این‌که **Landing Craft**ه، یه دونه اسم و **Voyage**ش، بندر بارگیری، بندر تخلیه و شماره Manifest.

شماره Manifest که هر بار به صورت منحصر‌به‌فرد، هر بار سیستم باید به صورت اتومات، طبق فرمتی که بهش می‌دیم، شماره جدید بده خودش.

خب، Titleهای Manifestمون.

بعد از این Detailsهای بالا، ردیف، شماره بارنامه هست.

خب، طبق همون بارنامه‌هایی که صادر شده، مثلاً برای این کشتی، برای این خرمشهر، این باید به صورت به ترتیب مثلاً شماره 1، 2، 3، 4، همین‌جور طبق اون شماره بارنامه‌ها بزنه.

بعد می‌رسیم به **شرح کالا**، Shipperشون، Consigneeشون.

خب، این بارنامه‌هایی که قبلاً صادر شده، یه شرح کالا داره دیگه.

مثلاً یک دستگاه فلان، **Excavator PC400**، Excavator به این Chassis Number.

بعد Shipperش، Consigneeش، تعدادش، وزنش.

تعدادش هم مجموعه دیگه.

یعنی مثلاً دستگاهش مشخص باید باشه، Nagleش هم مشخص باشه، جدا جدا.

که آقا مثلاً این یک دستگاهه، به‌علاوه دو Nagle.

بعد در پایان هم Total به ما بگه که مثلاً این‌قدر دستگاه و این‌قدر Nagle و وزن کلن جمعاً این‌قدر بارگیری شده توی این کشتی.

---

## duna-analysis/requirements/audio_2026-09-14_05-06-35.txt

خب، می‌رسیم به بخش **Accounting**.

خب، بخش Accounting خودش اینجا خیلی باید، مثلاً Option زیاد داریم.

اول از هر چیزی، ما برای هر Invoice، یعنی ما قبل از Invoice که بخواییم صادر کنیم، یه **Job** باید در نظر بگیریم که به حساب، مثلاً Note نوشتن برای هر دستگاه یا حالا هر کاری که تحویل می‌گیریم.

**Job Number** بهش اختصاص می‌ده.

خب، اون Job Numberـه Customerـش رو مشخص می‌کنیم و حالا **ETDZ**، هر هزینه‌ای که برای Cargo انجام دادیم، بیا توی این Job Number.

خب، مرحله بعدش این Invoiceها هست.

خب، این Invoiceها رو به دو صورت می‌تونیم بزنیم.

یکی این‌که اون بارنامه‌هایی که دیگه صادر شدن و دیگه ارسال کردیم برای مشتری، این‌ها باید Invoiceـش اتوماتیک بیاد توی **Draft**، بشه مثل حالت Draft.

که دیگه بعد بیام چکش کنیم با Job Numberهای مرتبط با اون، همه‌شون Match کنیم.

و حالا مثلاً در فرمت که داریم:

**شرح کالا، Rate، تعداد، VAT و مبلغ کل که شامل VAT می‌شه.**

بعد توی اون قسمت Totalـش، مبلغ کل رو جدا می‌نویسیم، مبلغ VAT رو جدا.

مثلاً مثل:

**Subtotal، VAT و Total Amount**

اینم باید در نظر بگیریم.

حالا این... برای چه جوری می‌گم؟

یه سری فاکتورها هستن که VAT دارن، یه سری فاکتورها هستن VAT ندارن.

اونایی که VAT دارن، بعداً مثلاً اون زمانی که می‌خواییم لیست مالیاتی رو بفرسیم، سیستم اتومات به‌مون نشون بده که آقا مثلاً توی این فصل، مثلاً February و March و April، این بیست تا فاکتور VAT داشته، مبلغ VATشون هم این‌قدره، جمع مبلغ VAT مثلاً این‌قدر هست.

این‌قدر گرفتیم.

یا مثلاً فلان فاکتورها شامل VAT بوده، VATـشون رو پرداخت کردیم.

که زمانی که می‌خواییم این گزارش VAT رو بفرسیم، بدونیم چقدر VAT پرداخت کردیم، چقدر VAT دریافت کردیم.

که این برای گزارش‌های سه‌ماهه لازمه.

خب، این Invoiceها یکی اون که اون بارنامه‌هایی که صادر کردیم، اینجا بعد از **Issued** شدن، یعنی بعد از صادر شدن:

**Invoice Draft**

Draft Invoice، ۴، ۵ Line، هرچه Rate، بر اساس Job Numberهایی که قبلاً اختصاص دادیم، بتونیم این Invoiceها رو صادر کنیم.

یه مدل دیگه این Invoice هم هست که این Invoice معمولیه.

حالا مثلاً فرض کنید که ما یه Invoice همین‌جوری خارج از بحث بارنامه و Job Number و این چیزا بخوایم برای یه مشتری صادر کنیم.

خب، این هم باید در نظر بگم.

حالا Invoice که صادر می‌شه، هر Invoice متعلق به یه Customer دیگه.

این اتومات بره توی حساب Profile و Ledger مشتری بشینه، به عنوان **Debit**.

به عنوان Debit بشینه.

که دیگه در مجموع، زمانی که حالا پرداختی چیزی هم خواست صورت بگیره، بره توی حساب Ledger به عنوان **Credit** بشینه.

بعد از این Invoiceها...

حالا این Invoiceها یه سری Details باید داشته باشه دیگه.

شماره این Invoice.

مثلاً شماره این Invoice.

بعد بگم این... که مال چه مشتریه.

مشخصات Bill of Lading، اون شرحش.

یا مثلاً اگه برای اون بارنامه از قبل مشخص باشه، برای این بارنامه صادر شده که مربوط به کدوم Manifestه.

تاریخ صدورش.

تاریخ مهلت پرداختش.

حالا اگه بعد این Invoice اگه مثلاً پرداخت شده باشه، مبلغی که ازش پرداخت شده یا Partial Payment هست یا پرداخت نشده باشه، اینا مشخص باشه.

بعدش **Proforma Invoice**.

این Invoice که حالا بر اساس همون Format خودمون، Excelـش رو مثلاً Upload می‌کنیم و Dataها رو بر اساس اون Formatی که بخواییم وارد کنیم.

**Quotation** هم همین‌جور.

**Delivery Order، Release Order، Vouchers، Salary** و اون قسمت **Ledger**.

قسمت Ledger الزامن همش برای اون Customerها نباشه.

چرا؟

چون مثلاً زمانی که می‌خواییم این گزارش‌های Tax سالیانه رو بدیم، یا به فرض هزینه‌های دفتری رو بخواییم ثبت کنیم، این Ledger، مثلاً هزینه‌های دفتری هم باید توی همون Ledger باشه دیگه.

که بفهمیم VAT چقدر هزینه کردیم، ثبت‌های روزانه‌ش رو بزنیم.

قسمت **Salary** هم که دیگه کارمندها رو تعریف می‌کنیم.

مثل حالت یک Salary.

**Salary Slip** برای هر ماهشون باید صادر بشه.

قسمت Voucher هم که دو نوع Voucher داریم دیگه.

یکی **Payment Voucher**، یه **Receipt Voucher**.

مشخص بشه که حالا کدوم Customerه.

یعنی چه Payment بخواییم پرداخت کنیم، چه Receipt بخواییم بدیم، یعنی پول دریافت کرده باشیم.

اول از هر چیزی این Customer باید مشخص باشه که این مربوط به کدوم Customerه.

و بعد که دیگه مشخص کردیم که حالا این پولی که گرفتیم، مثلاً برای این Invoice خاصی بوده، برای شماره بارنامه خاصی بوده، اینا اگه مشخص کردیم که دیگه حالا اتومات می‌ره تو حسابش می‌شینه.

اگر هم چیزی ننوشته بودیم، مثلاً Error نده دیگه، به عنوان Credit بره توی سیستم Ledgerش بشینه.

که بعد Balance رو به همون بده.

که دیگه آقا این Customer مثلاً توی حالا Ledger Statement براش درست کنیم.

که دیگه یه بازه بهش می‌دیم، مثلاً فلان ماه تا فلان ماه، فلان تاریخ تا فلان تاریخ.

Statement رو به ما بده که آقا این‌قدر صورت‌حساب براش صادر شده، چقدر پرداخت کرده، مثلاً Balanceـش چقدره.

خب، قسمت **Release Order** و **Delivery Order**.

Delivery Order مربوط به کالاهایی هست که آوردیم، مثلاً توی بندر خودمون تخلیه کردیم و الان می‌خواییم Delivery Order صادر کنیم و به مشتری بدیم دیگه.

همراه با سایر اسناد هم به مشتری تحویل بدیم، که بره به اسم Consignee تحویل بدیم، که بره دستگاه، حالا بیاد Cargoـش رو ترخیص کنه و ببره.

این Delivery Order هم همون دیگه.

مثلاً Customerـش مشخص باشه.

اینا هر کدوم یه شماره داره، یه تاریخ داره.

و حالا Delivery Orderی که برای اون Port مشخصه، که مثلاً داخلش قید کنیم مثلاً Port فلانه.

و اون حساب حالت استاندارد Delivery Order صادر بشه و Print گرفته بشه، Stamp بشه و با سایر اسناد هم تحویل مشتری بشه.

خب، قسمت **Release Order**.

بارنامه‌هایی که صادر می‌شه، Manifest و بعد شناور حرکت می‌کنه، می‌رسه تا مقصد، تخلیه می‌شه.

اونجا قبض انبار صادر می‌شه و اسناد پیش Agent می‌مونن تا مادامی که مثلاً ما این Release رو به اون Agent اعلام کنیم که آقا مثلاً فلان بارنامه با این مشخصات، **Release** شده و اسناد هم رو می‌تونید به Consignee تحویل بدید.

حالا اینجا باید یه سازوکاری در نظر بگیریم که خود Agentها بهشون به حساب یه دسترسی بدیم.

ببینن بندر خودشون رو.

به همین صورت جداگونه بارنامه‌ها و Manifestهای خود، مثلاً بندر خودشون رو ببینن.

یعنی نگاه، مثلاً خرمشهر فقط مال خرمشهر رو ببینه، بوشهر فقط مال بوشهر رو ببینه، بندرعباس فقط مال بندرعباس رو ببینه.

اونجا ببینند که دیگه آقا مثلاً بارنامه‌های مربوط به خودش رو ببینن.

توی قسمت Release Order هم که دیگه مشخصه.

مثلاً یه شماره بارنامه هست، حالا مثلاً Consignee، شرح کالا و اون قسمت مثلاً حالا تیکی که به صورت Mark می‌خواد مشخص بشه.

یا مثلاً Statusش بنویسه **Released**.

این چیزها.

خب، قسمت پرداختش هم برای حسابدار مشخص بشه.

این باید یه قسمت Payment هم داشته باشه.

این مشخص بشه که آقا این سندی که آزاد کردیم، مشتری کامل پرداخت کرده، Paid شده، این Invoiceـی که مربوط به این Release Order بوده پرداخت شده.

یا مثلاً به صورت اعتباری برده، Unpaid شده.

یا این‌که **Partial Payment**، یه بخشش رو پرداخت کرده، یه بخشش رو باید بعداً بخواد پرداخت کنه.

این مشخص باشه.

که بعداً ما بتونیم مثلاً به صورت سریع بتونیم Follow-up کنیم.

که اگه این Invoice Released شده و اعتباری برده باشه، مثلاً حالا ظرف مدت یکی دو هفته اینا به ما اخطار بده، که ما با مشتری اونجا صحبت کنیم که پرداختیشو انجام بده.

خب، حالا می‌رسیم به مرحله **Reports**.

Reports.

ما باید یه سازوکار مشخص کنیم که هر کشتی، یعنی هر Manifestی که بسته می‌شه به سمت یه مقصدی، حالا خرمشهر، بوشهر، بندرعباس، هر جا، به سمت هر مقصدی که این Manifest بسته می‌شه، هزینه‌های شناور رو در نظر بگیریم.

مثلاً اجاره کشتی، هزینه‌های **Port Use**، **Handling**، **Lashing** و حالا هزینه متفرقه‌ش رو در نظر بگیریم.

خب، درآمدش چی می‌شه؟

مجموع کل مبالغ Invoiceها، صورت‌حساب صادرشده بابت بارنامه‌هاش، به عنوان درآمدش می‌شه.

که این‌ها رو از هم کم کنی، سود و زیان یک کشتی، یک Manifest به دست بیاد.

این Report خیلی مهمه که ما بدونیم آقا مثلاً به ازای هر Manifestی که بسته شده، چقدر هزینه کردیم، چقدر مثلاً درآمد داشته.

حالا اون سود و زیانش مشخص بشه.

که زمانی که بخواییم مثلاً Tax سالیانه رو انجام بدیم، بدون دردسر و با استفاده از چند تا Filter بتونیم اون صورت سود و زیان و این چیزها رو به صورت کلی دربیاریم.

---

## duna-analysis/requirements/audio_2026-09-14_05-06-46.txt

مثلاً تو قسمت **Voucher**، زمانی که می‌خواییم پول پرداخت کنیم، قسمت **Payment** باید دو تا جای خالی، دو تا Option تعبیه بشه.

که مثلاً اون **ID Card** تحویل‌گیرنده، به عنوان مثلاً مدرک و رسید، اونجا تعبیه بشه.

که حالا یا عکس بگیریم یا Upload کنیم، یا مثلاً Take Photo بشه از پشت و روی ID Cardش.

زمانی که می‌خواییم پول رو بهش بدیم و رسید براش صادر کنیم، ID Cardش یا عکسش رو Upload کنیم یا ازش عکس بگیریم، اونجا بارگذاری بشه.

و بعد امضا از دریافت‌کننده بگیریم.

---

## duna-analysis/requirements/audio_2026-09-14_05-07-11.txt

قسمت **Salary Slip** هم به همین صورت.

اگه مثلاً یکی دو روز قبل از پایان هر ماه که Salary Slip رو تنظیم می‌کنیم، باید جای اسکن کارت‌های **ID Card**، پشت و روی اون کارمند، اونجا باشه.

که حالا یا به صورت Upload باشه؛ یعنی عکس آماده رو از توی سیستم Upload کنه، یا مستقیم از طریق Camera عکس بگیره، از پشت و رو، و توی اون Salary Slipـش باشه.

که زمانی که Print گرفته می‌شه، خروجی گرفته می‌شه، اون ID Cardها مشخص باشه و اون کارمند زیرش امضا کنه.

که یعنی اصلاً پول دریافت کرده.

---

## duna-analysis/requirements/audio_2026-09-14_05-07-29.txt

عنوان «بایگانی شرکت»

---

## duna-analysis/requirements/audio_2026-09-14_05-07-41.txt

یکی از موارد دیگه هم هست، اون ثبت‌های روزانه.

مثلاً زمانی که اون Profile مشتری‌ها، Ledger مشتری‌ها، باید قابلیت اینو داشته باشه که بدون صدور این Invoice هم بتونیم مثلاً اونجا بهشون اضافه کنیم.

مثلاً **General Journal**، پولی که مثلاً به یه شخص پرداخت کردیم یا از یه شخصی دریافت کردیم، خارج از حوزه کار اصلی، و بخواییم حالا مثلاً به صورت قرض باشه، بخواییم بیاریم توی Ledgerش.

توی Ledger همچین Optionی گذاشته باشه که بتونیم General Journal بهش اضافه کنیم.

حالا اگه ما به یه شخصی پرداختی کردیم، میاریم تو حسابش، توی اون قسمت Ledgerش، به عنوان **Debit**.

و اگه یه شخصی چیزی به ما پرداخت کرده باشه، میاریم تو حسابش به عنوان **Credit**.

اون هزینه‌های روزانه و هزینه‌های دفتری و خرج‌ومخارج شرکت هم حتماً باید یه سازوکاری براش انجام بدیم که این هزینه‌ها ثبت بشن و در پایان سال به عنوان هزینه‌های شرکت از درآمد کسر بشن.

---

## duna-analysis/requirements/audio_2026-09-14_05-07-52.txt

تو هر مرحله که نیاز به خروجی، حالا چه خروجی PDF، چه خروجی Excel و چه Print داشته باشیم، فرمت‌های خاص و شکل‌های خاص داریم.

مثلاً فرمت‌های مخصوص شرکت خودمون رو داریم که اینا رو مثلاً Upload می‌کنیم، که متوجه بشه توی قسمت **Loading List** چه مدل خروجی می‌خوایم، چه پرینتی می‌خوایم.

یا مثلاً قسمت **Invoice**، قسمت **Delivery Order**، قسمت **Release Order**، قسمت **Salary Slip**، **Voucher**، **Payment**، **Receipt**، این‌ها هر کدوم یه فرمت خاص دارن.

یا مثلاً قسمت **Ledger**، چه Optionهایی می‌خواییم، زمانی که می‌خواییم Print بگیریم، این شکل ظاهری Print به چه شکل باشه.

اینا رو Upload می‌کنیم.

---

## duna-analysis/requirements/part1_0-15.txt

نگاه، این قسمت که بخوام برات توضیح بدم، ما یه شرکت کشتیرانی هستیم که دفتر مرکزی‌مون توی دبی، امارات متحده عربیه.

پورت حمریه، پورت دبی، بندر حمریه، پورت دبی.

خب، به این صورتی که ما مثلاً کشتی‌ها یا مال خودمون هستن، یعنی تحت مالکیت خودمون هستن، یا این‌که مثلاً کشتی رو اجاره می‌کنیم. حالا یا سفری اجاره می‌کنیم یا Time Charter، برای یه مدت اجاره می‌کنیم. خب، این از این.

حالا در این بین ما یه سری کار داریم، که چیز حمل‌ونقل ماشین‌آلات، مدنی، عمرانی، Shipping کلن، هر چیزی، جابه‌جایی مثلاً از یه نقطه به یه نقطه دیگه دریایی.

حالا ما زمانی که بخواییم مثلاً فرض کنید که یه دستگاهی رو امروز توی پورت تحویل می‌گیریم، اول از هر چیزی باید بدونیم که این وصلِه به کدوم مشتری. پس نگاه، مشتری برای ما رکن اصلیه که این دستگاه مال کدوم مشتری ما هست.

بعد این مشتری باید یه کد اختصاصی هم بهش بدی. مثلاً ما یه چیزی که حالا دستی داریم می‌نویسیم، مثلاً فرض کن که یکی از مشتری ما آرش علیدادی. خب، آرش علیدادی، حالا اسمشو نوشتیم، ایمیلشو نوشتیم، شماره موبایلش هم نوشتیم. حالا اطلاعات و Detailsش رو نوشتیم.

حالا یا Companyـه، یعنی شرکته، یا شخص حقیقیه، یعنی مثلاً یا شخصه یا شرکته، مشتری ما. شرکت هم باز به همین شکل دیگه، یه سری Details براشون ثبت می‌کنیم، اسمش هم که مشخصه.

بعد این یه کد رندومی، یه کد مثلاً می‌ده دیگه. مثلاً ما دستی که می‌نوشتیم، یه مشتری یه شماره براش اختصاصی می‌ذاشتیم، Customer مثلاً CUSD، مثلاً 33431. بعدی همین Customer مثلاً 332334، به ترتیب هر مشتری جدیدی که ثبت می‌شه این‌جوری.

خب، حالا این مشتری ثبت می‌شه که آقا، مثلاً فلان دستگاه به ما تحویل داده.

حالا این ما باید یه Load List داشته باشیم دیگه، یعنی موجودی انبار. یه موجودی انبار داشته باشیم، ببینیم مثلاً این‌ها، این Detailsهاش چی هست دیگه؛ دستگاه مال کیه، چی بوده، چه تاریخی وارد شده، وارد مثلاً کدوم پورت شده، پورت راشد شده، پورت حمریه شده، پورت جبل‌علی شده و این‌که مقصدش کجاست.

خب، این‌که مقصدش کجاست، چه تاریخ و ارشون، با چه نوع اسنادیه، اسناد چه اسنادی داره، مثلاً Export Paper داره، نمی‌دونم آر‌دی‌ای داره، Import Paper داره، Export Certificate داره، این‌که با چه Modeـی چیزی وارد شده.

بعد حالا به فرض، زمانی که ما کشتی همون می‌رسن یا می‌خواییم تصمیم‌گیری کنیم که مثلاً این کشتی رو اختصاص بدیم به کدوم بارگیری، مثلاً بزنیمش آقا برای بندر حمریه، برای دستگاه‌های مربوط به خرمشهر، مثلاً.

خب، یک کشتی خالی داریم، می‌خواییم این کار رو انجام بدیم؛ دستگاه‌هایی که برای خرمشهر هستن، تو حمریه هستن، این‌ها رو می‌خواییم بارگیری کنیم.

بعد از این‌که بازرسی تأیید شد، دیگه یه Load List آماده می‌کنیم. یه Load List آماده می‌کنیم، مثلاً حالا ۲۰ تا دستگاه، ۳۰ تا دستگاه، ۴۰ تا دستگاه، هر چیزی که هست، آماده می‌کنیم و اینا رو Print می‌گیریم، می‌دیم دست بچه‌های Operator.

بچه‌های Operator که آقا مثلاً این کشتی این تعداد دستگاه باید بارگیری، این کشتی بشه. خب، اینا شروع می‌کنن به بارگیری.

یه‌هو می‌بینی آقا در طول بارگیری مثلاً یه دونه دستگاه بارگیری نمی‌شه. حالا یا جا نمی‌شه یا خراب می‌شه، بارگیریش نمی‌کنی، به هر دلیلی. آقا یه دونه دستگاه از تو این لیستی که بهش تحویل دادیم می‌مونه.

خب، این دستگاه اوتومات دیگه برمی‌گرده دوباره تو موجودی انبار و می‌مونه برای مثلاً سفر بعدی. یعنی اوله، بله دیگه، برمی‌گرده از لیست حذف می‌شه دیگه، دوباره برمی‌گرده توی سیستم اصلی، توی یه لیست موجودی، که دیگه حالا مثلاً بذاریمش برای Shift بعدی، برای مثلاً کشتی بعدی که بخوایم بارگیری کنیم.

خب، حالا این دستگاهی که بارگیری کردیم، دیگه تاریخ بارگیری‌هاشون هم مشخص شده. نگاه، تاریخ ورودش مشخص شده، این‌که تو کدوم Yard تخلیه شده، چه تاریخی تخلیه شده و چه اسنادی داره.

خب، تاریخ بارگیری هم اینجا مشخص می‌شه دیگه. حالا مثلاً یه دستگاهی امروز تحویل می‌گیری، یک ماه دیگه تاریخ مثلاً بارگیریش. بارگیریش هم که انجام بدیم، تاریخ‌های بارگیری هم که وارد می‌کنیم، اینجا دیگه چی می‌شه؟ اینجا تعداد روزی که موجود تو پورت هم مشخص می‌شه.

مثلاً برای بدِ انبارداری که می‌خواییم پرداخت کنیم به DP، اینجا تاریخ بارگیری منهای تاریخ ورود می‌شه، مثلاً تعداد روزی که توی پورته.

اینجا ما می‌فهمیم که مثلاً این دستگاه، این Shipment، این کالا چند روز توی پورت مونده که ما حالا بخوایم بریم انبارداریش رو حساب کنیم، بدونیم چقدره. خب، این از این.

حالا کشتی که بارگیری شد، کشتی که بارگیری شد، آقا این باید مشخص کنیم که این Load Listی که زدیم، چه تعداد از این دستگاه‌هایی که توی Load List تحویل Operatorها داریم، این بارگیری شده. مثلاً ۲۰ تا بهشون دادیم، ۱۹ تا بارگیری شده. این یه دونه که دیگه برمی‌گرده دوباره تو موجودی انبار.

خب، موجودی Yard.

خب، از اون ۱۹ تایی که بارگیری شده، حالا باید Manifest کشتی رو آماده کنیم.

Manifest کشتی هم که دیگه مشخصه؛ مثلاً اسم کشتی، شماره Manifest، بندر بارگیری، بندر مقصد و یه سری Details دیگه.

خب، بعد توی Manifest میاد ردیف می‌زنه دیگه، یک، دو، سه، چهار، پنج، شیش.

خب، بعد به ترتیب به هر کدومش یه شماره بارنامه اختصاص می‌ده.

خب، بعد Shipper، Shipper و Chassis، حالا هرچی اطلاعاتی که توی Manifest لازمه می‌زنی.

بعد به اسم می‌زنه Consignee، Shipper، تعداد، وزن، که مثلاً یه Total هم باید بزنه.

مثلاً Total، مثلاً سی تا دستگاه بارگیری شده، به‌علاوه یه مثلاً بیست تا Nagle. Nagle یعنی دستگاه نیست، یعنی [نامفهوم] توی پورته.

مثلاً سی تا دستگاه، به‌علاوه یه مثلاً نود تا Nagle بارگیری شده.

به وزن این‌قدر کل وزنم که دیگه می‌زنی.

این می‌شه Manifest. یعنی مثلاً صورتی که ناخدا و Crew بدونن که آقا این‌قدر دستگاه بارگیری کردن و لیستش دستشونه.

خب، حالا هر کدوم از این کالاهایی که بارگیری شده، یه بارنامه اختصاصی می‌خوره دیگه. Bill of Lading بهش می‌گن.

این Bill of Lading هم برای یه دونه از اون کالاهایی که دیگه مشخصه؛ مثلاً Shipperش مشخصه، Consigneeش مشخصه، اون Notify Partyش و یه Bill of Lading استانداردی که حالا Formatهاش رو داریم، برات می‌فرستم.

خب، به ازای هر کالایی هم که توی کشتی بارگیری می‌کنیم، یه بارنامه، به حساب منحصر‌به‌فرد برای خودش داره که دیگه این بارنامه رو باید می‌فرستیم برای به حساب مشتری که آقا، این بارنامه‌ته و مثلاً دیگه دستگاه داره از حمریه حرکت می‌کنه به سمت خرمشهر.

خب، این دیگه Manifest رو که دیگه Print گرفتیم، دیگه این خروجی‌ها باید به ما بده که دیگه مثلاً یه خروجی به ما بده که PDF بشه، Print بگیریم، یا مثلاً Excel بده، Excel بده که بعد یه سری اصلاحات یا چیزی خاص توش دستی انجام بدیم، مهر بزنیم، تحویل به حساب [نامفهوم] بدیم، تحویل ناخدا.

این بارنامه‌ها هم Print بگیره، مثلاً Print می‌ده بیرون، PDF می‌ده بیرون که Print بگیریم.

حالا مهرش رو اونجا فیزیکی می‌زنیم دیگه. فیزیکی مهر رو می‌زنیم برای اونایی که به حساب می‌خواد Print بگیری.

اونایی که PDF می‌گیریم هم که دیگه مهرش روش زده دیگه، یعنی اوتومات این مهرش توش ذخیره شده باشه که وقتی می‌خوای PDF بگیری، خودش Stamp پیش‌فرض باشه.

خب، این تا اینجای کار.

پس این پیش اومد که دیگه ما موجودی انبارمون رو داشتیم و بعد این‌که بخوایم کشتی به کجا اختصاص بدیم، به کدوم مقصد اختصاص بدیم هم مشخص شد.

بعد ما از موجودیمون یه سری فیلترها می‌زنیم دیگه. مثلاً می‌زنیم خرمشهر، بندر حمریه.

خب، بندر حمریه رو که بزنیم، خرمشهر بزنیم، مثلاً از جمع این ۱۲۰ دستگاهی که الان موجود داریم، مثلاً ۲۰ تاش مال خرمشهره.

این ۲۰ تا باید فیلتر بشه بیاد بالا، فیلتر بشه بیاد بالا.

حالا کدوم‌هاشو می‌خوایم بارگیری کنیم؟ مثلاً ۱۹ تاش واجد شرایط بارگیریه. ۱۹ تاش رو انتخاب می‌کنیم.

خب، این به صورت یه Load Listی باید Print بشه که آقا مثلاً این ۱۹ تا دستگاه با این شناور تحویل Operator، Print بگیریم PDF، تحویل Operatorهایی توی محوطه بدیم و شروع کنن به بارگیری.

حالا هر چند تا از این لیسته که بهش دادیم، تونست بارگیری کنه، تاریخ بارگیری‌هاش هم دستی برای ما می‌نویسه، می‌ده به بچه‌های دفتری. بچه‌های دفتری وارد می‌کنن.

هر چیزی هم که نشد بارگیری کنی، به هر دلیلی، خرابی یا جا نبوده یا هرچی، اون تعدادی هم که می‌مونه دوباره باید توی سیستم برگرده توی موجودی Yard، که آقا بدونیم مثلاً این‌قدر دستگاه دیگه هنوز داریم برای خرمشهر، چیزی برای تصمیم‌گیری‌های بعدیش باشه.

خب، این از مرحله عملیات و Manifest هم به همین شکل دیگه.

حالا همون تعداد دستگاهی که تو شناور بارگیری شده، بعد اینا رو که PDF خروجی، PDF یا Excel می‌ده بیرون، دیگه ما هر بارنامه‌ای رو می‌فرستیم برای مشتری‌ها.

خب، حالا این مرحله تمام شد، می‌ریم وارد مرحله بعدش می‌شیم دیگه، مرحله حسابداری.

پس مرحله Operation تموم شد.

مرحله بارنامه و Manifest هم تموم شد.

می‌ریم به مرحله حسابداری.

مرحله حسابداری.

حالا نگاه کنیم، مثلاً یه سری کالاها هست، ما مثلاً کار ترخیصش هم خودمون داریم انجام می‌دیم، مثل حالت ETOZ.

خب، این کاره که داریم به صورت ETOZ انجام می‌دیم. مثلاً یه دستگاه رو ما برای مشتری از چین برداشتیم، آوردیم مثلاً جبل‌علی.

از جبل‌علی ترخیص کردیم.

بعد کمرشکن گرفتیم. کمرشکن از جبل‌علی برداشته و آوردتش حمریه.

حمریه مثلاً تخلیهش کرده.

حالا به فرض مثلاً خرج مکانیکی شده، فلان شده، بزن. این یه فرآیند ETOZیه.

اصطلاحاً برای این‌که مثلاً در حین فرآیند، چون مثلاً یه سری هزینه‌ها می‌شه برای دستگاه یا Cargo یا هر چیزی، این اصطلاحاً بهش می‌گن Job Number.

یعنی خورده‌خرج‌هایی که از اول تا آخر برای یه دونه Cargo یا مثلاً Shipment انجام شده، که بعد آخر کار که حسابدار می‌خواد Invoice صادر کنه، این Job Number رو نگاه می‌کنه.

یه چیزی مثل مثلاً یادداشت داشته که آقا، مثلاً من چین اینجا هزار درهم خرجش کردم.

بعد دوباره کرایه حمل مثلاً ده هزار دلار دادم تا آمده جبل‌علی.

خب، اینا روزانه که اتفاق نمی‌افته. مثلاً اون هزار درهم که مثلاً چین خرجش کردی، شاید بارگیریش مثلاً دو هفته دیگه باشه.

دوباره دو هفته دیگه یک کرایه می‌دی براش، میاد جبل‌علی، دوباره مثلاً یک ماه طول می‌کشه تا برسه جبل‌علی.

حالا مثلاً حالت [نامفهوم] این Job Numberه.

مثلاً برای یک کالا یه Job Number اختصاصی می‌زنه، که دیگه بعد که خواستی واردش کنی و حسابدارش رو انجام بدی، این Job Number اونجا می‌بینه دیگه، که مثلاً این از این ETOZ چقدر خرجش شده.

خب، حالا زمانی که کشتی خروج کرد و Manifestش بسته شد، این Manifest، نگاه کن، مثلاً امکان داره که شرکت‌های همکار و Forwarderها هم توی کشتی‌های ما بارگیری کنن دیگه.

حالا بالاخره مثلاً یه‌ذر فضا بینشون اختصاص می‌دیم.

مثلاً آقا، از جمع ۳۰ تا دستگاه، ۲۰ تا دستگاه مال من بوده، مال شرکت خودمون بوده، مثلاً ۵ تاش مال یه شرکت دیگه، ۵ تاش مال یه شرکت دیگه.

اونا هم Format بارنامه‌هاشون فرق می‌کنه با ما.

Format شماره بارنامه‌هاشون با ما فرق می‌کنه.

خب، ما باید بتونیم که، ما باید بتونیم که، اون بارنامه‌های اونا رو هم به Manifest اضافه کنیم.

یعنی این Option رو باید داشته باشه، چون Manifest یه دونه بیشتر نیست و اونم ما باید صادرش کنیم.

خب، زمانی که دیگه Manifest بسته شد، این یه نکته مهمی هم که از آرش باید همیشه مدنظرِمون باشه، اینه که از لحظه‌ای که ما ماشین رو تحویل می‌گیریم، بچه‌ها می‌خوان Data Entry کنن که آقا مثلاً این ماشین مربوط به کدوم مشتریه، چیه، Chassis Numberش چیه، فلان...

---

## duna-analysis/requirements/part2_15-end.txt

چیه؟ بند و بساط، شهر کالا، وزنش چقدره، چند تا Nagle همراه داره، توی کدوم Yard تخلیه شده، چه تاریخی تخلیه شده، نوع اسنادش چیه.

و این‌که مثلاً زمانی که می‌خواییم پرینت بگیریم، بدیم دست بچه‌های عملیات، Inspectionـش مثلاً مشخص شده باشه که آقا Inspection انجام شده؛ یعنی تیک بخوره که آقا اینا می‌تونن بارگیری کنن، بیاد تو لیست بارگیری.

یعنی این Load List بارگیری، یه سری شرایط براش باید در نظر بگیری که آقا یکی از مهم‌ترینش این Inspectionـه. Inspectionـش باید حتماً تیک خورده باشه؛ یعنی آقا Inspection رو بچه‌ها انجام دادن و تیک خورده و این واجد شرایطیه که آقا انتخاب بشه و بره توی Load List و اون Operator...

حالا می‌خوام بدونیم که این یک سری برای هر دستگاهی که ما تحویل می‌گیریم، هر کالایی که می‌خوایم تحویل بگیریم، یه Comment هم یه جای Comment هم بذار برای اینا.

چرا؟ چون که مثلاً هر اتفاقی که می‌افته این بچه‌ها توی Comment بنویسن که نخواد یادداشت بشه و توی WhatsApp بشه و مثلاً یادشون بره. فلان، این Comment رو بنویسن و این Comment در نهایت بیاد تو قسمت حسابداری که اون بقیه حسابداری‌ها، بچه‌ها ببینن.

مثلاً آقا، یه دستگاه ما تحویل گرفتیم توی پورت. خب الان مثلاً روشن نمی‌شه. به فرض باید بریم باتری بگیریم، بیارن باتری، کارشو انجام بدیم، مکانیک بیاریم تعمیرشو کنه.

حالا این توی Comment بیاد. مثلاً آقا عملیات باتری انجام شده، یا آقا مثلاً عملیات جرثقیل برای تخلیه کردنش انجام شده.

خب، اینا توی این Commentها که بیاد دیگه، هیچ چیزی گم نمی‌شه دیگه.

و این Commentها قابل Edit باشه، قابل پاک کردن باشه، هر چیزی که هست.

بعد بیاد و حسابدار، زمانی که می‌خواد صورت‌حساب برای هر ردیف Manifest صادر کنه، یا هر بارنامه صادر کنه، اگه بارنامه و اگه اون بارنامه Comment خاصی داشت، بچه‌ها توی عملیات یا هر چیزی نوشته بودن، این Commentها رو ببینه اینجا و به صورت‌حسابشون اضافه کنه.

خب، حالا می‌رسیم به مرحله صورت‌حساب زدن.

خب، هر خرجی، هر چیزی که شده، اگه Job Number داره که مشخص می‌کنه آقا چه خرجه، اگرم توی اون Commentها بچه‌ها نوشتن که این حسابدار می‌بینه.

خب، هر زمانی که می‌خواد این Bill صادر کنه، بازم باید مشتریش مشخصه دیگه.

مثلاً آقا، فلان بارنامه که از همون اول صادر کردیم، مشتریش مشخص بوده؛ یعنی رفته توی پروفایل اون مشتریه.

حالا می‌آید صورت‌حسابش رو می‌زنید.

صورت‌حساب شما مثلاً ردیف یک، دو، سه، چهار؛ یه سری اطلاعات و Details مربوط به دستگاه و شماره بارنامه و اینا، مشخصات مثلاً Bill، صورت‌حساب برای چی صادر بشه و اینا مشخص می‌کنیم.

و دیگه حالا هر هزینه که شده باشه، مثلاً کرایه حمل کشتی، عملیات جرثقیل، هزینه کمرشکن، هزینه ترخیص، هر چیزی که هست باید اینا بیاد.

خب، این Invoice هم باید بخش‌های مختلف داشته باشه.

از اون بالاش که باید **Tax Invoice** باشه، چون این قانون اماراته که مثلاً Address و شماره موبایل و Contact Number و Email و از این چیزها...

همون طرف دیگه هم سمت راست، حالا من این فرمت این Invoiceها رو برات می‌فرستم.

سمت راست هم این Invoice Number و تاریخ این Invoice و حداکثر مهلت پرداخت و فلان و از این حرفا.

بعد این یه **TRN Number** هم داریم دیگه. حالا اون TRN رو توی فرمت، Detailsها رو ببینیم.

خب، بعد این Invoice هم که مثلاً دو ردیف، سه ردیف، چهار ردیف قابل اضافه کردن باشه، که این بتونه بنویسه.

خب، این ردیف هم که یک ردیف خودش، یک، دو، سه، چهار.

خب، بعد می‌رسیم به مرحله Description، شرح، Rate یا حالا Fee، بعد Quantity یا QTY می‌رسیم.

خب، بعد اینجا هم یه ردیف دیگه اینجا وقت داریم، **Value Added Tax**، ارزش افزوده.

اینجا ردیفه باید درصد بخوره.

مثلاً تو این ردیف VAT اگه من می‌نویسم پنج، یعنی پنج درصد این معامله VAT شاملش شده.

خب، مبلغ VAT هم جداگونه می‌نویستی.

یه ردیف دیگه هم مثلاً VAT... و این ردیف، حالا مبلغ VAT مشخص شده.

ردیف بعدی هم Amountـش رو می‌نویستی، یعنی Rate ضربدر تعداد، به‌علاوه درصد VAT، تو اون ردیفه می‌شینه.

حالا این چیزش رو برات می‌دونسته، فرمت صورت‌حساب و برات می‌فرستم که بدونی.

خب، زمانی که دیگه این فاکتور رو صادر کردی، این اتومات مثلاً با عنوان **Sales** می‌ره توی قسمت اون مشتریه، توی پروفایل اون مشتریه می‌شینه.

با عنوان **Debit** می‌شینه توی حسابش.

خب، برای این Manifest، حالا مثلاً ۲۰ تا، ۳۰ تا، ۴۰ تا، هر چقدر که بارنامه داشته باشیم، ما این Invoiceها رو صادر می‌کنیم.

و هر Invoice هم که ارتباط می‌ره، می‌شینه توی حساب Ledger، یا همون حساب کل مشتری دیگه.

این چیز می‌شه.

خب، این حالا دیگه مشخص می‌شه.

این Invoiceها تمام می‌شه.

خب، حالا ما باید اینجا مشخص کنیم که این شناوری که مثلاً برای ما توی سفر **1-26** از حمریه رفته به خرمشهر، یه گزارش باید به ما بده.

که دیگه حالا مثلاً این، ما یه دیتاهایی براش وارد می‌کنیم، یه سری گزارش‌ها باید به ما بده که آقا مثلاً چقدر خرج این کشتی شده، چقدر درآمد شده، حالا مثلاً سود یا ضرر حاصل از این سفری که این کشتی رفته چقدره، اینم مشخص کنه.

خب، خب، بعد از اینکه دیگه این فاکتورها صادر شد و این هزینه‌ها انجام شد و مثلاً Port Handling و Port Use و اینا پرداخت شده، کشتی رفت بیرون، می‌گم که این دیتاها باید وارد بشه و مشخص کنه که این کشتی مثلاً چقدر سود و زیانش شده.

خب، این از این.

حالا این Invoiceهایی که صادر شد، می‌ره تو حساب معین مشتری‌ها می‌شینه.

اون حساب معین یا حساب کل مشتری‌ها، مثلاً این چیزشونه دیگه، مثلاً **Customer Ledger**شونه دیگه.

حالا پولی پرداخت می‌کنن، رسید بهشون می‌دیم، می‌ره اتومات می‌ره توی سیستم به Sub Customer و به عنوان **Credit** می‌شینه.

حالا این Credit، Debit، از هم کم و زیاد می‌شن، Balance به دست میاد دیگه.

که آقا، من به یه مشتری، یه مشتری چقدر به ما بدهکاره و یا مثلاً چقدر طلبکاره یا اصلاً Balanceـش صفره، مشخص کنه.

خب، حالا زمانی که Invoice صادر می‌کنیم، این تاریخ صدور Invoice هم باید مشخص بشه.

یا مثلاً حالا این برای چی می‌خواییم ببینم؟ چه مدت زمانی طول می‌کشه که آقا مشتری این پولو می‌خواد پرداخت کنه؟

این یا Alarm بده، گزارش به ما بده.

خب، حالا بعد که دیگه این Invoiceها صادر شد، اومد توی حساب مشتری نشست و اینا، می‌رسیم بر سر Release کردن، به حساب اسناد، **Release Order**.

خب، زمانی که دیگه آقا شناور رسید مقصد و مقصد هم تخلیه کرد و اینا، بعد مشتری حالا مثلاً فرض کنه که می‌خواد بره ماشینشو تحویل بگیره دیگه.

خب، به ما زنگ می‌زنه که آقا این چقدر شده، هزینش فلان. فاکتورش هم که براش فرستادیم.

حالا فرض کن که می‌خواد پرداخت کنه.

حالا یا یه بخشی از این Invoice رو می‌خواد پرداخت کنه، یا همه‌شو می‌خواد پرداخت کنه، یا می‌گه که آقا مثلاً اعتباری به این بدید، مثلاً یه هفته دیگه، ده روز دیگه پرداخت می‌کنه.

خب، ما زمانی که می‌خواییم Release بهش بدیم، باید مشخص کنیم که آقا این تو سیستم جا براش Option بذاره که چی؟

که آقا ما اینو پول گرفتیم، تسویه شده و Release Order دادیم به ایجنتمون توی خرمشهر.

یا مثلاً یه پارتیشو، یه بخششو پرداخت کرده.

یا اصلاً پرداخت نکرده، اعتباری می‌خواد ببره.

خب، این Release Order که ما می‌زنیم، تأیید می‌کنیم، این باید به ما گزارش بده.

ها، که بعد بدونیم چه آقا مثلاً توی این Manifestی که فرستادیم یا توی این بارنامه که فرستادیم، برای ما مشخص کنه که آقا کدوماش Release و Paid شدن، پرداخت شدن، کدوماش Release بوده و Partial Payment بوده، یه بخشش پرداخت کرده، کدوم‌ها Release بودن، اصلاً Unpaid شده، یعنی پرداخت نشده.

اینا رو برای ما مشخص کنه و Alarm بذاره، Notice بذاره که آقا مثلاً فلان سند الان یه هفته‌ست Released شده ولی پولی پرداخت نشده.

یا مثلاً فلان سند الان یک ماهه Release دادیم و این‌که مثلاً هنوز ۲۰٪ش رو پرداخت نکرده.

این‌جوری.

حالا این خیلی نیاز به نکته یه ریز داره که من بعد بگم.

اینا رو کلی دارم می‌گم.

حالا زمانی که مقصد، یعنی خرمشهر، بوشهر، بندرعباس، هر جایی که می‌خواد بره تخلیه کنه، Agentهای اونجا به ما زنگ می‌زنن، می‌گه آقا مثلاً فلان بارنامه Release شده یا نه؟

مثلاً دسترسی داشته باشن توی قسمت Release Order و بارنامه‌های مربوط به خودشون.

یعنی نگاه، مثلاً خرمشهر فقط مال خرمشهر رو ببینه، بوشهر فقط مال بوشهر رو ببینه، بندرعباس فقط مال بندرعباس رو ببینه.

اونجا ببینن که دیگه آقا مثلاً اگه یه سندی بلا Release هست، دیگه اصلاً نیاز نباشه زنگ بزنن.

خودشون مثلاً یه Login داشته باشن، برن و ببینند اونجا مثلاً بارنامه فلان، اونجا زده مثلاً Release نیست، دیگه Bill of Lading نیست.

اونجا خودش مستقیم به مشتری می‌گه که آقا، بارنامه Release نیست، برو با کشتیرانی مبدأ، مثلاً با دبی، هماهنگ کن ببین مشکلت چیه.

یا این‌که اگر Release باشه، خودش تو سیستم می‌بینه دیگه که دیگه نخواد هی به من زنگ بزنه.

این‌جوری.

خب، این کلیاتی بود که من دارم.

حالا یه سری بارها هم هست، وارد می‌شه؛ یعنی ما باید بیاریم اینجا تخلیه کنیم و بعد از این‌که تخلیه کردیم **Delivery Order** بدیم، یعنی Delivery Order بدیم.

این هم یه قسمتیه که باید اونجا بگنجونیش.

حالا توی این Optionهایی که بهت گفتم، Option مثلاً Loading بود، عملیات، که دیگه حالا مشخص کنیم تعداد موجودی‌های Yard من چقدر، تو کدوم Portها، به کدوم مقصد، چند تا، چی دادیم، این وارد شده، مشتریش هم مشخص باشه.

بعد اینا رو مثلاً واجد شرایط‌ها بیاد توی Load List.

Load List پرینت گرفته بشه، بدیم دست مثلاً Operatorها که بارگیری رو انجام بدن.

بعد میاییم وارد مرحله صدور بارنامه و Manifest می‌شیم.

حالا اون‌هایی که Final شدن و بارگیری شدن بیاد تو لیست Manifest.

Manifest، حالا خروجی PDF، Excel، هر چیزی که می‌ده بده.

ما Print بگیریم.

اگه PDF می‌ده همراه با Mark/Stamp بده.

اگرم بخواییم Print بگیریم، خب Stamp اینا رو حذف کنه، Print بگیریم و Stamp Original بزنیم؛ یعنی Stamp زنده، مهر زنده بزنیم، هم برای Manifest هم برای بارنامه.

خب، بعد وارد مرحله... یه Optionها اینجا اضافه کنم، مثلاً Delivery Order دیگه، برات بگم Release Order، این چیزها اینا رو در نظر بگیریم.

بعد هم وارد بخش Accounting می‌شیم.

منظورم اینه که حسابداریه.

حالا مثلاً اون Commentها همیشه حواست باشه، یا اون Job Number، ETOZی که یک کاری داریم برای یکی دونه Shipment انجام می‌دیم، شاید یک ماه، دو ماه طول بکشه.

این حسابدار بدونه که آقا، این مثلاً دستگاهی که یک ماه پیش Start کار رو زدیم، مثلاً مرحله‌به‌مرحله چقدر خرجش شده.

که زمانی که میاد Invoice صادر کنه، بدونه چیزی رو اشتباه ننویسه یا مثلاً از دستشون نده که مثلاً یادش بره قید کنه.

این از این.

بعد این صورت‌حساب‌هایی که صادر می‌شه، اتومات بره تو حساب مشتری بشینه.

و پرداختی‌های مشتری هم دیگه اونجا، رسیدش، **Payment Voucher**، اینا هم مشخص کنه.

حالا اینا هر کدومش چه Option ریزی داشته باشن، چه کارهایی باید توی اون Receipt Voucher و Payment Voucher انجام بدیم، اون شکل و شمایلش چی باشه.

مثلاً این Invoiceی که صادر می‌کنی، Detailsش چی باشه و اینا، که دیگه کامل بهت می‌گم.

بعداً وارد جزئیات می‌شیم.

