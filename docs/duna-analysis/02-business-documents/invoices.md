# Invoices — Document Analysis

> **Scope:** The one Tax Invoice specimen (`DSINV/26-172`) in the source pack, plus what it implies
> about the invoice requirements in
> [`../01-employer-statements/requirements-catalog.md`](../01-employer-statements/requirements-catalog.md).
>
> Source: `docs/duna-analysis/documents/INV-GRAND CRANE USED TRUCK CRANE +1 PKG CH.NO 0127-1.pdf`
> (1 page, Excel for Microsoft 365, created 2026-08-10, metadata title "Tax Invoice # 1859").
>
> Related: [`document-catalog.md`](document-catalog.md) §4 (raw facts),
> [`quotations.md`](quotations.md) (the Proforma comparison).

---

## 1. Specimen at a glance

| Field | Value |
|---|---|
| Invoice No. | `DSINV/26-172` |
| Date | 6-Aug-26 |
| Bill To | MR. SHAHOKH SHAHVARAEI |
| Duna TRN | `100353243700003` |
| Currency | AED |
| B/L ref | `KHS/26-108` |
| Manifest ref | `DSKHS-26-005` |
| Vessel / Voyage | DAHAR 10 / `02/26` |
| Loading port / Discharge port | HAMRIYA / KHORRAM SHAHR |
| Goods | USED TRUCK CRANE + 1 PKG · CH.NO `KG54W00127` · HS CODE `87051010` |
| Sub Total | 27,370.00 |
| VAT | 0.00 |
| **Total Amount** | **AED 27,370.00** |

---

## 2. Layout, zone by zone

```
┌──────────────────────────────────────────────────────────────┐
│  TAX INVOICE                            (letterhead / logo)  │
├──────────────────────────────────────────────────────────────┤
│ Invoice No:  DSINV/26-172     BILL TO:   MR. SHAHOKH …        │
│ TRN/ID:      100353243700003  Address:   …                    │
│ Date:        6-Aug-26         Customer ID: …                  │
│ Currency:    AED              E-mail: …   Contact: …          │
│                               TRN No: …                       │
├──────────────────────────────────────────────────────────────┤
│ BOE/DEC/BL#   MANIFEST#      VESSEL     LOADING   DISCHARGE   │
│  VOYAGE                                                       │
│ KHS/26-108    DSKHS-26-005   DAHAR 10   HAMRIYA   KHORRAM     │
│  02/26                                             SHAHR      │
├──────────────────────────────────────────────────────────────┤
│ DESCRIPTION OF GOODS: USED TRUCK CRANE + 1 PKG                │
│ CH.NO: KG54W00127   HS CODE: 87051010                         │
├──────────────────────────────────────────────────────────────┤
│ # │ DESCRIPTION        │ QTY │ UNIT PRICE │ VAT % │ VAT │ AMOUNT │
│ 1 │ FREIGHT CHARGE     │  1  │ 22,020.00  │   0   │0.00 │   —     │
│ 2 │ STORAGE CHARGE     │  1  │    650.00  │   0   │0.00 │   —     │
│ 3 │ CUSTOMS DOCUMENT.  │  1  │    200.00  │   0   │0.00 │   —     │
│ 4 │ TRANSPORTATION …   │  1  │  4,500.00  │   0   │0.00 │4,500.00 │
├──────────────────────────────────────────────────────────────┤
│                              Sub Total         27,370.00      │
│                              VAT                    0.00      │
│                              Total Amount   AED 27,370.00     │
├──────────────────────────────────────────────────────────────┤
│ Authorised Signatory                                          │
│ * if any discrepancy is noticed in the invoice, kindly inform │
│   us in writing within 7 days, otherwise the above amount …   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. What the specimen confirms about the employer's requirements

| Requirement | Status | Evidence from the specimen |
|---|---|---|
| `REQ-142` line columns: Description, Rate, Qty, VAT %, VAT amount, Amount incl. VAT | **Confirmed** | Column headers are `# / DESCRIPTION / QTY / UNIT PRICE / VAT % / VAT / AMOUNT (INCL VAT)` |
| `REQ-143` totals block: Subtotal, VAT, Total Amount | **Confirmed** | Three labelled rows at the foot |
| `REQ-144` VAT per line as a percentage | **Confirmed** | A `VAT %` column exists per line |
| `REQ-146` printed as a **Tax Invoice** with customer address/contact/email | **Partly confirmed** | Title is TAX INVOICE; the form has `Address`, `E-mail`, `Contact` and `Customer ID` fields — but **they are empty on this specimen** |
| `REQ-147` invoice number, date, payment deadline, TRN | **Partly confirmed** | `Invoice No`, `Date` and `TRN/ID` are present. **There is no payment-deadline / due-date field on the form at all** |
| `REQ-148` carries B/L and Manifest references | **Confirmed** | `BOE/DEC/BL#` and `MANIFEST#` fields, both populated |
| `REQ-150` posts as Debit under "Sales" | **Not visible** | Ledger posting is not on the printed form |
| `REQ-140` two creation paths (from B/L, or standalone) | **Consistent** | This specimen is B/L-anchored; the employer says standalone invoices also exist |

---

## 4. What the specimen reveals that the employer did not say

These are **new business facts** established by the document, and they should be treated as
employer-grade evidence (they come from real paperwork, not from an interview):

| # | Finding | Detail |
|---|---|---|
| F1 | **There is a 7-day discrepancy window.** | Footer: "if any discrepancy is noticed in the invoice, kindly inform us in writing within 7 days, otherwise the above amount will be considered as correct." |
| F2 | **An HS Code is printed.** | `HS CODE: 87051010` — a customs tariff classification, needed for the goods description. |
| F3 | **The invoice carries a goods description block separate from the charge lines.** | `DESCRIPTION OF GOODS` + `CH.NO` + HS CODE, above the charge table. |
| F4 | **Observed VAT default is 0%.** | All four lines are VAT 0. The employer's "5%" was an example only. |
| F5 | **Two numbering schemes coexist.** | Document number `DSINV/26-172` and the Excel metadata counter `Tax Invoice # 1859`. |
| F6 | **A Customer ID field exists** on the form (empty here). | This is the field the employer's customer code (`REQ-014`) would populate. |
| F7 | **One invoice bundles several charge types for one shipment.** | Freight + storage + customs documentation + inland transport — the practical shape of `EMP-104` / `REQ-132`. |
| F8 | **There is no payment-terms / due-date field.** | The employer asked for a "maximum payment deadline" (`EMP-108`, `REQ-147`); the current form has nowhere to put it. This is a genuine gap in today's paperwork. |

---

## 5. Arithmetic model

```
Line amount (incl. VAT) = UNIT PRICE × QTY  +  VAT amount
Line VAT amount         = (UNIT PRICE × QTY) × VAT % / 100
Sub Total               = Σ line amounts                    → 27,370.00
VAT (block)             = Σ line VAT amounts                →      0.00
Total Amount            = Sub Total   (VAT already included) → 27,370.00
```

> **Note the semantics.** Because the line `AMOUNT` column is already **inclusive** of VAT, the
> footer's `Sub Total` is *also* inclusive of VAT, and the footer `VAT` row is a **memo** of the VAT
> contained within it — not an amount to be added again.
>
> This is a common source of double-counting. The employer's own words match it: "Rate multiplied by
> quantity, plus the VAT percentage — it sits in that row" (`EMP-118`), and then "we write the total
> amount separately, the **VAT amount** separately" (`EMP-612`).

**Verify against the legacy system:** the legacy Laravel invoice preview
([`../03-legacy-laravel-system/calculations.md`](../03-legacy-laravel-system/calculations.md))
computes `AMOUNT (INCL VAT)` as `vatamount + subtotal` where `subtotal` *already* included VAT —
i.e. it **double-counts VAT**. The specimen proves the correct model is the one above.

---

## 6. Differences from the Proforma Invoice

| Aspect | Tax Invoice (`DSINV/26-172`) | Proforma (`DSPRO/26-001`) |
|---|---|---|
| Subject | Services (freight, storage, customs, transport) | Sale of machinery |
| VAT | Per-line VAT columns present (all 0%) | No VAT at all |
| Weights | None | Net / Gross / Total-gross weight columns |
| Incoterm | None | `FOB` (Terms of Delivery) |
| Payment terms | None on form | `100% ADVANCE PAYMENT` |
| Validity | None | `1 MONTH` |
| Origin / beneficiary | None | `Country of Origin: INDIA`, `Country of Beneficiary: UAE` |
| Partial shipment | n/a | `Allowed` |
| Final delivery place | Discharge port only | `MAKU FREE ZONE` |
| Document refs | B/L + Manifest | Freight forwarder name/address |
| Certification | 7-day discrepancy note | "actual price … no other proforma invoice has been or will be issued" |
| Numbering | `DSINV/<yy>-<seq>` | `DSPRO/<yy>-<seq>` |

**Implication:** the system needs **two structurally different invoice-like documents**, not one
invoice type with optional fields. See
[`quotations.md`](quotations.md) for the third shape (Quotation).

---

## 7. Gaps in the specimen

| Missing | Consequence |
|---|---|
| Payment deadline / due date | `REQ-147` cannot be satisfied by copying the current form |
| Populated customer address / email / contact | The fields exist but Duna does not fill them today, despite `REQ-146` |
| Payment status (Paid / Partial / Unpaid) | Not printed; presumably tracked outside the document |
| Bank / payment instructions | Not on this form |
| Invoice sequence continuity | Only one specimen; cannot tell whether the sequence is global, yearly, or per destination |
| Discounts | No discount column exists |
| Multi-currency | Only AED observed |

---

## 8. Open items carried forward

| ID | Question |
|---|---|
| `INV-01` | Default VAT rate and per-service taxability (specimen shows 0% everywhere) |
| `INV-02` | Invoice correction / re-issue flow |
| — | Is the invoice number sequence global or scoped? (Only one specimen.) |
| — | Where does the payment deadline live, given the current form has no field for it? |
| `FIN-04` | Overdue threshold for the payment-follow-up alarm |
