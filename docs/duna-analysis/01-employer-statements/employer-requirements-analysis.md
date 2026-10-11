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
