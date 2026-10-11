# Target System — Domain Model, Relationships and Financial Specification

**Status:** Canonical target specification. Documentation only — no application code was changed.
**Created:** 2026-10-11.

This document describes the **target** system. Where it states that something exists today, that is verified
implementation state; where it states that something must exist, that is a requirement. The two are never
blended. Cross-references: `confirmed-decisions.md` (DEC-*), `question-reconciliation.md` (Q-AUD-*),
`implementation-gap-analysis.md` (GAP-*).

---

## 1 · Core domain entities and responsibilities

### 1.1 Party model — four distinct concepts (DEC-073)

| Entity | Responsibility | Role in a transaction |
| --- | --- | --- |
| **Customer** | The commercial counterparty of Duna. May be a natural person or a legal entity. Appears on the **invoice** and in the **ledger**. | Bills and is billed. |
| **Shipper** | Party named as shipper on the **B/L**. | Document party. |
| **Consignee** | Party named as consignee on the **B/L**. | Document party. |
| **Agent** | Destination agent. Has a **portal login**. | Operational party, destination-scoped. |

**Invariant:** these must never be collapsed into one entity or one role field. The worked example from the
employer (§2.9) makes the separation concrete: goods bought in Australia, an Australian shipper, a different
consignee at the destination, yet the internal Customer is a named individual to whom the invoice is issued.

**Contacts** (phone, email, address) belong to the **Shipper, Consignee or Agent** as applicable (DEC-076).
The Customer carries its own contact details because it is a separate commercial entity — this is not a
conflation, provided the entities stay separate.

**RESTRICTION (REQ-017 / DEC-075):** the Customer record must **not** carry Type, Currency, TRN Number or Short
Name. The current schema carries all four. The `type` column is additionally seeded with the **wrong semantics**
(commercial roles rather than the natural/legal distinction) and must be removed or repurposed.

### 1.2 Operational model

| Entity | Responsibility | Notes |
| --- | --- | --- |
| **Port** | Operational location. Official name, display name, country, code/abbreviation, aliases, active flag (DEC-064). | Display format evidenced as `Name, City/Region, Country` — e.g. `KHORRAM SHAHR, PERSIAN GULF, IRAN`. Iranian ports record "Persian Gulf" in the city position; do not "correct" this. |
| **Yard** | Storage facility within a port. | Yard selection is dependent on the selected port (REQ-0xx; §2.4). |
| **Vessel** | A vessel, which may be a **Tug & Barge** pair (two names) or a **Vessel / Landing Craft** (one name). IMO optional (REQ-038). | `VesselType` includes `TUG`, `BARGE`, `LANDING_CRAFT`; `Voyage` carries `vesselId`, `tugVesselId`, `bargeVesselId`. |
| **Voyage** | A trip of a vessel to a destination. Numbered per **vessel + destination + year** (REQ-040). | Current code scopes per destination + year; the **vessel** component is missing. |
| **Cargo** | Goods registered for handling. | Carries duplicate legacy columns (`comments`/`comment`, `chassis`/`chassisNumber`, `serial`/`serialNumber`) — see AUD-015. |
| **Inspection** | Readiness check. `InspectionStatus` = `PENDING / BOOKED / DONE / FAILED / NEEDS_REINSPECTION`. | **Inspection `DONE` is a hard precondition** for entering a Load List (REQ-082) — verified implemented at `load-planning.service.ts:381,556`. |
| **Load List / Actual Loading** | Planned then actual loading onto a voyage. | State model conflict: ADR-041 says 3 states, enum has 6 (Q-AUD-12). |
| **Discharge** | Unloading at destination. | |
| **Job** | **The overall customer commercial order/operation** transporting goods from origin to destination (DEC-068). | Spans multiple goods, B/Ls, manifests, documents, costs, invoices and payments over time. |

### 1.3 Job is not a B/L, voyage, manifest, invoice or payment (DEC-070)

A Job is the **commercial wrapper**. It is the thing the customer asked for. It accumulates costs over weeks or
months (§2.10 names Repairing, Customs, Lowbed, Transport, Ship, Crane) and is what the accountant matches an
invoice against (EMP-609). It is distinct from:

- the **B/L** (a transport document),
- the **voyage** (a vessel movement),
- the **manifest** (a consolidation of B/Ls for a voyage),
- the **invoice** (a billing document — and one invoice may cover several Jobs),
- the **payment** (a settlement).

### 1.4 Confirmed cardinalities

| Relationship | Cardinality | Basis | Phase |
| --- | --- | --- | --- |
| Invoice ↔ Job | **Many-to-many** | Q-AUD-01, DEC-071, EMP-609 | P3 |
| Invoice ↔ B/L | **One or many** (both supported) | Q-AUD-02, DEC-105 | P3 |
| Invoice ↔ Manifest | Reference (denormalised) | Real invoice carries a `manifest_number` | P3 |
| Payment/Receipt ↔ Invoice | **Many-to-many with per-reference amounts** | Q-AUD-04, DEC-013…015 | P6 |
| Payment ↔ Advance / unallocated credit | Supported | DEC-014 | P6 |
| Manifest ↔ B/L | **One manifest consolidates many APPROVED B/Ls** | ADR-047; verified implemented (`manifest.service.ts:293-347`) | done |
| B/L ↔ Actual Loading | B/L derives from COMPLETED Actual Loading with `actualQuantity > 0` | ADR-029/042; verified implemented (`bill.service.ts:304,589-601`) | done |
| Job ↔ Cargo | One Job may cover multiple goods | DEC-068 | P3 |
| Agent ↔ Destination | Agent is destination-scoped | REQ-187, §2.18 | P5 |

---

## 2 · Financial specification

### 2.1 Why a real ledger is required

The current ledger is a **derived view**: `apps/api/src/modules/ledger/ledger.controller.ts` is 18 lines
delegating to `VoucherService.ledger()`, which sums ISSUED invoices (debit) and POSTED vouchers (credit). That is
adequate for a **customer balance** and it is deliberate (ADR-032).

It is **not** accounting. It cannot represent:
- a general journal posting (REQ-166 — loans and receipts outside the invoice cycle);
- office and daily expenses (REQ-167, REQ-195);
- a payment allocated across several invoices with per-reference amounts (DEC-015);
- an advance held as unallocated credit (DEC-014);
- a correction, reversal or credit note (DEC-020);
- multi-currency with recorded rates (DEC-004…006).

**Legacy offers nothing to copy.** Source pack §4.2 lists *"Ledger as independent accounting entity"* among the
legacy **gaps**. The legacy system had no ledger, no Delivery Order, no Release Order workflow, no Salary and no
financial reports. There is no legacy accounting structure to inherit — only behaviour to avoid.

**DEC-043 (invariant):** customer balance summaries must **never** substitute for the accounting ledger.

### 2.2 Required accounting structure

| Element | Requirement | Decision |
| --- | --- | --- |
| Accounting entries | Every relevant business transaction produces entries | DEC-078/079 |
| Posting controls | Post and correct under permission control | DEC-110 |
| Traceability | Reports trace to source transactions, allocations, rates, entries | DEC-042 |
| Reconciliation | Customer balances reconcile with payments, allocations, advances, invoices and entries | DEC-079 |
| Multi-currency | Entries carry original amount/currency, rate, and base equivalent | DEC-004/005 |
| Reversals and corrections | Consistent treatment; corrections create new events, never erasure | DEC-023/048/079 |
| General journal | Direct postings outside the invoice cycle | DEC-078, REQ-166 |
| Office expenses | Recorded for year-end P&L | DEC-078, REQ-167/195 |

**Migration approach (TECHNICAL RECOMMENDATION, DEC-081):** additive. Introduce the accounting-entry model
alongside the derived ledger, run both, reconcile, and only then consider switching the read path. This avoids
silently restating historical balances.

### 2.3 Multi-currency (DEC-001…012)

Required behaviour, per transaction:
1. Store the **original amount and currency** (never converted in place).
2. Store the **exchange rate applied**, its **effective date**, and where appropriate its **source**.
3. Store the resulting **base/reporting-currency equivalent**.
4. Changing a default currency or a current rate **must never** silently recalculate history.
5. Rates are centrally managed; transaction-specific overrides are permitted and controlled.
6. Rate changes and overrides are permission-controlled and audited.
7. Reporting balances across currencies must be consistent and must not mix currencies without an explicit
   conversion rule.
8. FX gains/losses are accounted for where appropriate to the accounting model.

At least **AED, USD, AUD, CNY, IRR** must be supported, extensible by administrators.

**Explicit correction:** the five real document samples are all AED, but this **does not** establish a universal
currency policy. An earlier draft asserted AED as the default on sample evidence alone; that claim is withdrawn.
AED is a **seed/reference default only** (DEC-003).

**Verified gap:** no `CurrencyRate` or `ExchangeRate` model exists (AUD-023). `Voucher.exchangeRate Decimal(10,4)`
exists in isolation; `Invoice` has no rate field. Only USD and AED are seeded; `CompanySettings.defaultCurrency`
and `Invoice.currencyCode` both default to **USD**.

### 2.4 Payments, allocation and advances (DEC-013…018)

A payment or receipt may reference one invoice, several invoices, an advance, other documents, or nothing.
Allocations are stored **per reference with amounts**.

| State | Meaning |
| --- | --- |
| Allocated to one invoice | Simple case |
| Allocated across multiple invoices | Sum of allocations ≤ payment amount |
| Partly allocated | Remainder held as unallocated credit |
| Fully unallocated | Held entirely as customer advance/credit |

**REQ-165 is a hard constraint:** an unallocated payment must **never** raise an error. This is already satisfied
(`Voucher.invoiceId` is nullable) and must not be regressed.

Allocation may be **manual** or **automatic** according to an administrator-configured policy. "Oldest
outstanding invoice first" is an **example** policy, not a company rule.

Reported figures: total received, total allocated, unallocated amount, remaining credit/advance, outstanding per
invoice, allocation history, **reallocation** history, and references to payment, invoice, advance and accounting
entry.

**Invariant:** allocation changes are auditable; never silently change historical allocations; never let customer
balances drift from accounting records (DEC-018).

**Verified gap:** `Voucher.invoiceId` is a single nullable column; there is no `VoucherAllocation` model and no
`billOfLadingId` on `Voucher` (AUD-005).

### 2.5 Controlled financial corrections (DEC-019…023)

| Record state | Treatment |
| --- | --- |
| Legitimately editable (draft, not posted) | Ordinary edit under permission |
| Finalized / posted / historically significant | Controlled correction workflow |

Available mechanisms (configuration decides which applies): cancellation, reversal, correction entry, credit
note, cancellation-and-reissue, linked replacement document.

Every correction must preserve: previous and corrected values, the original record, reason, user, timestamp,
approvals, and relationships among documents and accounting entries. Manager approval is available and **required
where configured**. Corrections must permit reconstruction of before and after.

**Verified gap:** `InvoiceStatus` = `DRAFT | ISSUED | CANCELLED`. There is no credit note, no linked replacement
document, no correction reason, and no correction audit trail.

**REQ-069 (from the audit findings, restated):** an issued invoice's stored money fields must **never** be
silently recomputed. Any VAT or currency migration must either leave issued invoices untouched or treat the
change as an explicit, audited correction.

### 2.6 Tax / VAT (DEC-100…104)

- Tax types and rates are **administrator-configurable**.
- Tax is applied at the **invoice-line level** — evidenced by EMP-113/114/115/118 and EMP-611.
- Each finalized invoice preserves the **tax treatment actually applied** (rates and amounts), so later
  configuration changes do not silently recalculate history.
- Calculations distinguish **Subtotal**, applicable **line-level taxes**, and **Total** (EMP-612/614).
- **No universal rate.** Evidence includes an invoice with **zero** VAT (`DSINV/26-172`: `VAT: 0.00 AED` on
  `27,370.00 AED`) and a spoken example of 5% (EMP-115). EMP-617: *"There are a set of invoices that have VAT,
  and a set that don't."*

**Verified gap:** `Invoice.taxRate` is **header-level**; `InvoiceItem` has no tax column. The service computes
`tax = (subtotal − discount) × rate / 100` (`invoice.service.ts:546-573`). The arithmetic is correct; the
granularity is wrong (AUD-001).

### 2.7 Invoice structure confirmed by evidence (EMP-607…617)

- Invoices are produced **two ways** (EMP-607): (a) linked to a B/L/Manifest/Job, and (b) standalone.
- For B/L-linked invoices, after the B/L is issued the invoice is auto-created in **Draft** so the accountant can
  match it against the related Job Numbers (EMP-608/609).
- Row columns: **Description of goods, Rate, quantity, VAT, and total amount including VAT** (EMP-611).
- Totals block: **Subtotal, VAT, Total Amount**, written separately (EMP-612/614).
- Some invoices carry VAT and some do not (EMP-617).
- The real tax invoice additionally carries: `TRN`, `BOE/DEC/BL#`, `Manifest`, `Vessel`, `Voyage`,
  `Loading Port`, `Discharge Port`, `Currency`.

**Verified gap:** `Invoice` has no TRN field. TRN exists only on `CompanySettings` (`taxNumber`) and `Customer`
(`taxId`), and `CompanySettings` has **no endpoint** — so the TRN required on a printed tax invoice (REQ-147)
cannot currently be maintained through the product (AUD-008).

---

## 3 · Reporting implications of the financial model

Because reporting must be traceable (DEC-042), every financial report must be able to answer:

1. What was the original transaction, in its original currency?
2. What rate was applied, from what source, effective when?
3. What accounting entries did it produce?
4. How was a payment allocated, and has that allocation changed?
5. What correction was applied, when, by whom, and what did it replace?

A report that cannot answer these is a **summary**, not an accounting report, and must be labelled as such.

**Voyage / manifest P&L (REQ-190-193, DEC-038):**
- Costs: **Vessel Hire, Port Use, Port Handling, Lashing, other** (§2.19 / REQ-191) — configurable.
- Income: the sum of invoices issued against that Manifest/Voyage's B/Ls (REQ-192).
- Annual tax P&L by filtering per-manifest results (REQ-193).
- Quarterly VAT report: VAT collected vs VAT paid (REQ-194).

**Verified gap:** no `reports` module; no `report:*` permission codes; the navigation `insightControl` section
contains a single `reports` item marked `status: 'planned'` (AUD-009). The `Manifest` model carries **legacy**
cost columns (`gasCost`, `lashingCost`, `shipperCost`, `podCost`, `polCost`) which do **not** match the required
categories — only `lashing` overlaps.
