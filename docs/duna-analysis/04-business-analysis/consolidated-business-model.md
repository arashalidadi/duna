# Consolidated Business Model

> The single, synthesised model of **what Duna Shipping actually is and does**, built from all four
> evidence layers: employer statements → real documents → legacy code → current system.
>
> This is the file to read first if you need to understand the business. Everything else in this
> knowledge base is supporting detail.

---

## 1. The company

| Fact | Value | Source |
|---|---|---|
| Legal name | **Duna Shipping LLC** (دونا شیپینگ) | All documents |
| Address | AL Nokhitha Bldg, Hamriya Port, Dubai, UAE | B/L, Manifest |
| TRN (tax registration) | `100353243700003` | Tax Invoice |
| Base currency | **AED** | Invoice, Quotation, Proforma, SOA |
| Business type | Shipping / maritime logistics | Employer |
| Primary activity | Moving heavy cargo — machinery, construction equipment, vehicles — by barge/tug | Documents |

---

## 2. Two businesses, one company

The employer describes **two distinct lines of business** that share the same operational backbone.

### 2.1 Line A — Freight forwarding / shipping (the main business)

```
Customer brings cargo
   → Cargo received at origin port (Hamriya, Dubai / Jebel Ali)
   → Stored in a Yard
   → Documents received
   → Inspection booked and performed
   → Added to a Load List
   → Loaded onto a Vessel (barge + tug) on a Voyage
   → Bill of Lading issued (draft → revision → final)
   → Manifest consolidates the voyage's B/Ls
   → Invoice issued to the Customer
   → Payment received / balance tracked on the Ledger
   → At destination, the Agent releases the cargo
```

### 2.2 Line B — Buy-and-resell ("flipping")

The company also **buys** machinery, moves it, and **resells** it. Evidence:

- The Proforma Invoice `DSPRO/26-001` sells a **Hyundai R340L excavator** for **AED 690,000** with
  `100% ADVANCE PAYMENT`, `FOB`, origin **India**, discharge **Bandar Abbas**, final delivery
  **Maku Free Zone**.
- That is a **sale of goods**, not a freight charge — no B/L or voyage appears on it.
- The Quotation `DSQUO/25-017` quotes freight for a **used Volvo finisher**, i.e. the customer owns
  the machine and Duna only ships it.

**Implication:** the system needs **two commercial document families**:

| | Freight family | Sales family |
|---|---|---|
| Documents | Quotation → B/L → Manifest → Tax Invoice | Quotation → Proforma Invoice → (sale) |
| Subject | A shipment the customer owns | Goods Duna owns and sells |
| Price basis | Freight + handling charges | Goods price (+ freight) |
| VAT behaviour | Per line, 0% on the observed specimen | Per line |

⚠️ **The employer never explicitly separated these two lines.** The separation is **inferred** from
the documents. See [`contradictions-register.md`](contradictions-register.md) and
[`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md).

---

## 3. The parties — and why they must not be merged

| Party | What it is | Appears on |
|---|---|---|
| **Customer** | The commercial counterparty Duna invoices and holds a ledger balance for. An internal/commercial concept | Invoice, Ledger, SOA, Quotation, Proforma |
| **Shipper** | The sender / owner of the goods named on the transport document | B/L, Manifest |
| **Consignee** | The receiver at destination named on the transport document | B/L, Manifest |
| **Notify Party** | Who to notify on arrival (often "SAME AS CONSIGNEE") | B/L |
| **Agent** | Duna's representative at the destination port, who handles release | B/L, Manifest, agent portal |
| **Yard** | A storage location inside a port | Cargo |
| **Port** | Origin or destination. Stored as one "Port, City, Country" string in reality (`HAMRIYA PORT, DUBAI, UAE`) | Everywhere |

**Critical rule:** a Customer is **not** a Shipper and **not** a Consignee. A Customer may be
identified by name only (`REQ-011`); a Shipper/Consignee is a name-and-address block on a document.
The legacy system blurred these; the current system separates them.

**Real example (B/L `KHS/26-110`):**

```
Shipper:          RAS AL KHAIMAH MACHINERIES LLC
Consignee:        JOINT MECHANIC CO
Notify Party:     SAME AS CONSIGNEE
Destination Agent: BADBAN ARVAND ROOD SHIPPING CO
```

None of these is necessarily "the customer".

---

## 4. The operational spine

The chain the employer described, and which every module hangs off:

```
Customer
   └── Job / Shipment                    (commercial case; may last weeks or months)
         └── Cargo                       (one machine / one unit of goods)
               ├── Yard                  (where it is stored)
               ├── Documents             (intake paperwork)
               ├── Inspection            (booked, paid for, result recorded)
               └── Load List             (selected for a specific voyage)
                     └── Vessel / Voyage (barge + tug, voyage nn/yy)
                           └── B/L       (draft → final; per customer)
                                 └── Manifest   (consolidation of a voyage's B/Ls)
                                       └── Invoice   (per customer, may span B/Ls)
                                             └── Ledger / Payment / Balance
                                                   └── Release (at destination, via Agent)
```

### 4.1 The one rule that matters most

**B/L comes first; the Manifest is a consolidation of issued B/Ls** (`EMP-024`–`EMP-027`).

The legacy system inverted this (manifest first, B/Ls created against it) — see
[`../03-legacy-laravel-system/workflows.md`](../03-legacy-laravel-system/workflows.md) §2. The
current project has already restored the employer's order (`ADR-045`, `ADR-047`).

---

## 5. The four flows

Adopted from `duna_business_analysis.md` §1, which frames this well:

### 5.1 Operational flow
`Cargo → Yard → Inspection → Load List → Vessel/Voyage → B/L → Manifest → Destination`

### 5.2 Commercial flow
`Customer → Job → Invoice → Receivable → Payment → Balance`

### 5.3 Document flow
`Intake documents → B/L / Manifest / Invoice / Release / Delivery Order / Vouchers → Archive`

### 5.4 Control flow
`Roles → Permissions → Statuses → Approvals → Agent access → Audit trail → Reports`

---

## 6. Status architecture

Two independent axes, per the employer. **Do not collapse them** (this warning comes from
`duna_business_analysis.md` §5 and is correct):

### 6.1 Document production status (on B/L)
```
Draft → Sent to customer → Revision (if needed) → Approved → Final
```

### 6.2 Release status (on B/L, at destination)
```
Not released → Released        (gated on payment)
```

Plus a separate surrender concept: **`SURRENDERED`** — the paper originals have been handed back.

### 6.3 Cargo statuses

| Axis | Values | Source |
|---|---|---|
| Inspection | `PENDING → DONE \| LOCAL \| NONEED` | Employer + legacy |
| Loading | `IN YARD → LOADED` | Employer + legacy |
| (legacy-only) Management review | `PENDING → APPROVED` | **Legacy only** — see C-10 |

### 6.4 Invoice payment status
```
UNPAID → PARTIAL → PAID
```
The legacy system has only `UNPAID → PAID` (cannot express `REQ-149`).

---

## 7. The money model

### 7.1 Customer ledger

```
Invoice issued      → Debit   (customer owes more)
Payment received    → Credit  (customer owes less)
Payment made to them→ Debit   (we gave them money — e.g. on their behalf)
Balance             = Debit − Credit
```

Confirmed by **two independent sources**: the real TallyPrime Statement of Account, and the legacy
`CalculateDebitCredit()` helper.

### 7.2 The three voucher types

| Voucher | Direction | Legacy `Fin.type` | Has ID-card upload (legacy) |
|---|---|---|---|
| Receipt (money in) | Credit | `reciept` *(sic)* | ❌ |
| Payment (money out) | Debit | `payment` | ✅ |
| Invoice posting | Debit | `invoice` | — |

### 7.3 Job costing
Each Job accrues costs: transport, customs, repair, crane, vessel, port handling, port use, lashing,
storage, and others (`REQ-191`).

### 7.4 Voyage profitability
```
Voyage revenue = Σ invoices linked to the voyage
Voyage cost    = Σ costs booked against the voyage
Voyage P&L     = revenue − cost
```
Confirmed by the employer (`REQ-192`) and by the legacy `admin/manifest/report.blade.php`.

### 7.5 General Journal
Amounts that do not travel the standard invoice/payment path need journal entries — separate from,
but linkable to, the customer ledger (`REQ-166`, `REQ-167`). **Not implemented in the legacy system.**

---

## 8. The document set

Nine document types the employer wants as templates (`REQ-124`):

| # | Document | Real specimen | Legacy support |
|---|---|---|---|
| 1 | Bill of Lading | `KHS/26-110` | ✅ (wrong number format, no draft/release states) |
| 2 | Cargo Manifest | `DSMAN/KHO-26-006` | ✅ (hard-coded vessel) |
| 3 | Tax Invoice | `DSINV/26-172` | ✅ (VAT double-counted) |
| 4 | Proforma Invoice | `DSPRO/26-001` | ✅ (transposed prefix) |
| 5 | Quotation | `DSQUO/25-017` | ⚠️ free-text only |
| 6 | Receipt Voucher | **No. `477`** *(corrected 2026-10-11; was `DSR/26-190` — fabricated)* | ✅ |
| 7 | Payment Voucher | — | ✅ |
| 8 | Statement of Account | TallyPrime ledger | ⚠️ two display bugs |
| 9 | Load List | — | ✅ |

Plus two the employer wants but which have **no specimen and no legacy support**:
**Delivery Order** (`REQ-185`) and **Release Order**.

---

## 9. Outputs

The employer is explicit about output modes (`REQ-120`–`REQ-122`):

| Mode | Stamp? | Notes |
|---|---|---|
| **PDF** | ✅ with stamp | For sending to customers |
| **Print** | ❌ without stamp | For internal use / paper to be stamped by hand |
| **Excel** | — | For data hand-off |

There is **no PDF engine in the legacy system** — every document is a browser print. This is a
genuinely new capability, not a port.

---

## 10. The acceptance test

From `duna_business_analysis.md` §16 — the best single test of whether the business is correctly
modelled:

> For any cargo, can the system answer, without breaking context:
> - Whose cargo is it? (Customer)
> - Where did it come from?
> - Which port and yard is it in?
> - What documents does it have?
> - Has it been inspected?
> - Which vessel and voyage was it assigned to?
> - Which B/L and which manifest is it on?
> - What costs has it incurred?
> - Which invoices were issued for it?
> - How much has been paid?
> - Has it been released?
> - And what was the financial outcome — for the customer and for the voyage?

If the chain can be walked end to end, the core of Duna's business is modelled.

---

## 11. What is still missing from the model

| Gap | Why it matters | See |
|---|---|---|
| No confirmed number formats | Blocks seeding of generators | [`contradictions-register.md`](contradictions-register.md) C-01…C-07 |
| "Nagle" / package concept undefined | Blocks cargo data model | `terminology-glossary.md` |
| ETOZ / ETDZ term undefined | Unknown process | `open-questions.md` |
| Salary / payroll undescribed | `REQ-169`, `REQ-170` exist but the process is unknown | `open-questions.md` |
| Letters undescribed | No employer input at all | `open-questions.md` |
| Company Archive undescribed | Only one passing mention (EMP-713) | `open-questions.md` |
| Release rules for partial/credit only partly known | Blocks release workflow | `REQ-180`–`REQ-183` |
| The highest-authority source is absent | Everything is provisional with respect to it | C-22 / **SRC-01** |
