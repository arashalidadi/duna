# Quotations & Proforma Invoices — Document Analysis

> **Scope:** The two pre-sales specimens in the source pack — a **Quotation** and a **Proforma
> Invoice** — and what they imply for the commercial documents the dashboard must produce.
>
> Sources:
> - `docs/duna-analysis/documents/QUO-SHADMAN MEABADI 1X FINISHER-1.pdf` — `DSQUO/25-017`, 20-Nov-25
> - `docs/duna-analysis/documents/PRO-MEHDI BAGHSIAH 1X R340L, 1X BREAKER, 1X QUICK QOUPLER.pdf` — `DSPRO/26-001`, 22-Aug-26
>
> Related: [`invoices.md`](invoices.md) (the Tax Invoice, for comparison),
> [`document-catalog.md`](document-catalog.md) §5–§6 (raw facts).

---

## 1. Why these two documents are kept together

The employer mentions both in one breath: *"Then **Proforma Invoice** … **Quotation** likewise"*
(`EMP-643`, `EMP-645`; `REQ-152`, `REQ-153`). They are both pre-sales documents, and they are both
listed among the output types the employer wants templated (`EMP-723`).

But the specimens show they are **not the same document with different wording** — they have
different subjects, different column sets and different commercial content:

| | Quotation `DSQUO/25-017` | Proforma `DSPRO/26-001` |
|---|---|---|
| Subject | **Services** (transport, freight, documentation) | **Sale of goods** (3 machines) |
| Value | 7,700.00 AED | 690,000.00 AED |
| Customer | MR. SHADMAN MEABADI | MR. RAMIN AHMADABADI |
| Date | 20-Nov-25 | 22-Aug-26 |
| VAT | none at all | none at all |
| Weights | none | Net / Gross / Total-gross |
| Terms | none | FOB, 100% advance, 1 month validity |
| Origin/beneficiary | none | India → UAE |

Treat them as **two document families**.

---

## 2. Quotation — `DSQUO/25-017`

### 2.1 Content

| # | Description | Year | Qty | Unit Price (AED) | Amount (AED) |
|---|---|---|---|---|---|
| 1 | LAND TRANSPORT CHARGE FROM DESIGNATED SHOWROOM TO DUBAI HAMRIYA PORT | — | 1 | 700,00.00 | 700,00.00 |
| 2 | FREIGHT CHARGE FROM HAMRIYA TO BUSHEHR | — | 1 | 6,500.00 | 6,500.00 |
| 3 | DOCUMENTATION AND EXIT CHARGE | — | 1 | 500.00 | 500.00 |
| | **SUB TOTAL** | | | | **7,700.00** |
| | OTHER CHARGES | | | | 0.00 |
| | **GRAND TOTAL** | | | | **7,700.00** |

Header: `QUOTATION NO: DSQUO/25-017` · `DATE: 20-NOV-25` · `TO: MR. SHADMAN MEABADI`.
Body text: *"Thank you for your enquiry. We are pleased to enclose the applicable charges about 1
UNIT USED VOLVO FINISHER (as per packing list) for your consideration. Kindly note that we are able
to provide the following operations and rate."*
Footer: `FOR DUNA SHIPPING LLC` (signature space).

### 2.2 Observations

- **Service quotation.** All three lines are charges Duna will levy: inland pickup, sea freight,
  documentation/exit. This is the same charge vocabulary as the Tax Invoice (`invoices.md`).
- **Arithmetic:** 700 + 6,500 + 500 = 7,700 ✓. The `700,00.00` in the PDF is a formatting artefact
  (a stray thousands separator); the intended value is **700.00**.
- **An empty `YEAR` column** is present and unused — inherited from a machinery-sale template. This
  suggests the company keeps one hand-edited Word file per document family and adapts it.
- **`OTHER CHARGES`** is a separate row after the subtotal — i.e. the form anticipates charges outside
  the line table.
- **No VAT, no validity, no terms, no customer address** — the lightest document in the pack.
- **Numbering** `DSQUO/<yy>-<seq>`: note this specimen is `25-` while the current operating year in
  the other documents is `26-`, so the sequence is **year-scoped** (or at least the year appears in
  the number).
- Customer is identified by **name only** — no code, address or TRN. Consistent with the employer's
  "Name is the only mandatory Customer field" (`REQ-011`).

---

## 3. Proforma Invoice — `DSPRO/26-001`

### 3.1 Content

**Header block**

| Field | Value |
|---|---|
| Proforma Invoice No | `DSPRO/26-001` |
| Proforma Invoice Date | 22-AUG-26 |
| Validity of P/I | 1 MONTH |
| Seller | DUNA SHIPPING LLC · OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE · P.O BOX 63088 · TEL 0097142527707 · MOB 00971506445868 · E-MAIL info@dunashipping.com |
| Buyer | MR. RAMIN AHMADABADI |
| Country of Beneficiary | UAE |
| Country of Origin | INDIA |
| Terms of Delivery | FOB |
| Terms of Payment | 100% ADVANCE PAYMENT |
| Transaction Currency | AED |
| Freight forwarder | DUNA SHIPPING LLC, DUBAI, UAE |
| Partial Shipment | Allowed |
| Port/Airport of discharge | BANDAR ABBAS, PERSIAN GULF, IRAN |
| Final Delivery Place | MAKU FREE ZONE |

**Line block**

| # | Description | Qty | Net Wt (KGS) | G.Wt (KGS) | T.G Wt (KGS) | Unit Price (AED) | Amount (AED) |
|---|---|---|---|---|---|---|---|
| 1 | BRAND NEW HYUNDAI R340L EXCAVATOR — YEAR MADE: 2026 | 1 | 33,800 | 33,800 | 33,800 | 520,000.00 | 520,000.00 |
| 2 | BRAND NEW HYDRAULIC BREAKER | 1 | 1,000 | 1,000 | 1,000 | 125,000.00 | 125,000.00 |
| 3 | BRAND NEW QUICK QOUPLER | 1 | 1,000 | 1,000 | 1,000 | 45,000.00 | 45,000.00 |
| | Sub Total Amount | | | | | | 690,000.00 |
| | Freight Charges | | | | | | 0.00 |
| | **Grand Total** | | | | | | **AED 690,000.00** |

Signature: MOHAMMAD KAZEM JOWKAR.
Certification clause: *"It is hereby certified this proforma invoice shows the actual price of the
goods described, that no other proforma invoice has been or will be issued, and that all particulars
are true and correct."*

### 3.2 Observations

- **Goods-sale document, not a service document.** Three brand-new machines with weights, an
  Incoterm, an origin and a beneficiary country. This is a different business activity from Duna's
  freight operations — Duna also **sells machinery**.
- **`T.G Wt`** = total gross weight; on each line it equals the gross weight because quantity is 1.
- **Freight charges are a separate footer line** (0.00 here), not a line item.
- **No VAT anywhere.**
- **Validity of 1 month** — a real business rule the employer never mentioned.
- **Partial shipment "Allowed"** — another unmentioned rule.
- **Final Delivery Place (`MAKU FREE ZONE`) is distinct from the discharge port (BANDAR ABBAS)** —
  an extra delivery leg beyond the port.
- The seller address here (`OFFICE NO 203, AL NOKHITHA BLDG`) differs from the B/L letterhead
  (`AL NOKHITHA BUILDING, HAMRIYA PORT`). Two address strings for the same office are in circulation.

---

## 4. What this means for the system

### 4.1 Two pre-sales document families are needed

| | Quotation | Proforma |
|---|---|---|
| Subject | Services | Goods |
| Needs | Description / Year / Qty / Unit price / Amount / Other charges / Subtotal / Grand total | No / Date / Validity / Seller / Buyer / Origin / Beneficiary / Delivery terms / Payment terms / Currency / Forwarder / Partial shipment / Discharge port / Final place / Net & gross weights / Unit price / Amount / Freight / Grand total / Certification |
| VAT | absent | absent |

A single "Quotation/Proforma" entity with optional columns would be a poor fit — the Proforma has
roughly **twenty** fields the Quotation does not.

### 4.2 The employer said almost nothing about either

The employer's entire Proforma + Quotation requirement is two sentences
(`EMP-643`–`EMP-645`). Everything above comes from the specimens. This is therefore an area where
**the documents, not the transcripts, are the primary evidence.**

Fields that exist on the real Proforma but are nowhere in the employer's statements:
validity period, terms of delivery, terms of payment, transaction currency, freight forwarder,
partial shipment, final delivery place, country of origin, country of beneficiary, net/gross weight
columns, certification clause.

### 4.3 Conversion behaviour is unevidenced

The employer never said whether a Quotation converts into a Proforma, or a Proforma into an Invoice.
Nothing in the specimens shows it. Any conversion flow would be a design decision, not a recovered
requirement.

### 4.4 Numbering

| Document | Pattern | Year-scoped? |
|---|---|---|
| Quotation | `DSQUO/<yy>-<seq>` | Yes (`DSQUO/25-017` in a pack otherwise dated 2026) |
| Proforma | `DSPRO/<yy>-<seq>` | Presumed yes — only one specimen (`26-001`) |

---

## 5. Open questions specific to these documents

| ID | Question |
|---|---|
| Q-PRO-01 | Does a Proforma ever convert into a Tax Invoice, and if so what carries over? |
| Q-PRO-02 | Is the Proforma's goods-sale activity in scope for the dashboard at all, or is it a separate line of business tracked elsewhere? |
| Q-PRO-03 | Can a Proforma carry VAT, given the specimen has no VAT concept? |
| Q-QUO-01 | Is the `YEAR` column meaningful, or a leftover from a machine-sale template? |
| Q-QUO-02 | What is a Quotation's validity, given it states none? |
| Q-BOTH-01 | Are these sequences global or per-customer / per-destination? Only one specimen each. |
| Q-BOTH-02 | The employer listed both among the document types he wants to **upload templates** for (`EMP-723`). No templates supplied — see `open-questions.md` SRC-02. |
