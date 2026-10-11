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
