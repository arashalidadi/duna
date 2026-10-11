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
