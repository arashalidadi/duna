# Business Document Analysis — Cross-Document Synthesis

> **Purpose:** What the seven real documents tell us about the business **taken together** — the
> things no single document shows.
>
> Upstream facts: [`document-catalog.md`](document-catalog.md).
> Per-document deep dives: [`invoices.md`](invoices.md) · [`quotations.md`](quotations.md) ·
> [`receipt-vouchers.md`](receipt-vouchers.md) · [`statements-of-account.md`](statements-of-account.md).

---

## 1. The company as the documents reveal it

| Fact | Evidence |
|---|---|
| Legal name | **DUNA SHIPPING LLC** (Proforma seller block; B/L metadata author "Duna Shipping L.L.C") |
| Registered address | AL NOKHITHA BUILDING / OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE |
| P.O. Box | 63088 |
| Tel | +971 4 252 7707 (also written 0097142527707) |
| Mob | +971 50 300 3596, +971 50 644 5868 (also 00971506445868) |
| Email | info@dunashipping.com, dunashipping@yahoo.com |
| Web | www.dunashipping.com |
| Duna TRN | **100353243700003** (Tax Invoice) |
| Signatories seen | MOHAMMAD KAZEM JOWKAR (Proforma), SHABIN / Account Dept. (counterparty voucher) |

**Two address strings for the same office** are in circulation (building-level vs office-level). Any
"company settings" screen should not assume one canonical address.

---

## 2. Operating picture reconstructed from the documents

```
                    UAE (loading side)                        Iran / region (discharge side)
        ┌──────────────────────────────────┐          ┌──────────────────────────────────┐
        │ Jebel Ali  (import & clearance)  │          │ Khorramshahr  (KHS)              │
        │ Hamriyah   (main loading port)   │  ─────►  │ Bushehr                          │
        │ Showrooms / yards (A09, …)       │          │ Bandar Abbas / Rajaee (RJS)      │
        └──────────────────────────────────┘          │ Bandar Abbas → Maku Free Zone    │
                                                      └──────────────────────────────────┘
   Vessels seen: MEHDI 11 (barge) · LAYAN GULF (tug) · DAHAR 10 · ZAM ZAM (barge) · barge 1051
   Counterparties: RUKN ALHMREYA TRANSPORT L.L.C (subcontractor, UAE)
                   BADBAN ARVAND ROOD SHIPPING CO (destination agent, Khorramshahr)
                   RAS AL KHAIMAH MACHINERIES LLC (shipper)
                   JOINT MECHANIC CO (consignee, National ID 10100670462)
```

Cargo seen: used Komatsu D155A bulldozer, used truck crane (CH `KG54W00127`, HS 87051010), used
Volvo finisher, brand-new Hyundai R340L excavator + breaker + quick coupler, Komatsu excavators.

---

## 3. Two different businesses appear in the documents

| | **Freight / services business** | **Machinery trading business** |
|---|---|---|
| Documents | Quotation `DSQUO/25-017`, Tax Invoice `DSINV/26-172`, B/L, Manifest, SOA | Proforma `DSPRO/26-001` |
| What is sold | Transport, freight, storage, customs documentation, handling | Excavators, breakers, couplers |
| Money scale | 7,700 / 27,370 AED | 690,000 AED |
| VAT | Per-line VAT columns (all 0%) | No VAT concept |
| Weights | Gross weight only | Net / gross / total-gross |
| Customer identified by | Name only | Name only |

The employer's transcripts describe **only the freight business**. The machinery-sale activity is
invisible in the interviews but real in the paperwork.

> **Implication:** before building anything for Proforma, confirm with the employer whether machinery
> trading is in scope for this dashboard. See `open-questions.md` Q-PRO-02.

---

## 4. The document families — and which have no specimen

The employer listed nine output types he wants templated (`EMP-723`):

| # | Document type | Specimen in the pack? |
|---|---|---|
| 1 | Loading List | ❌ none |
| 2 | Invoice | ✅ `DSINV/26-172` (Tax Invoice) |
| 3 | Delivery Order | ❌ none |
| 4 | Release Order | ❌ none |
| 5 | Salary Slip | ❌ none |
| 6 | Voucher | ⚠️ one — but **issued by a counterparty**, not by Duna |
| 7 | Payment | ❌ none issued by Duna |
| 8 | Receipt | ⚠️ see #6 |
| 9 | Ledger | ⚠️ one — but **issued by a counterparty** for Duna as the subject |

Plus documents the employer wants that are not in his list of nine:
Bill of Lading ✅ · Manifest ✅ · Quotation ✅ · Proforma ✅.

**Five of the nine templated types have no specimen at all**, and two of the four "specimens" are
third-party documents. That is the single biggest evidence gap in the document pack.

---

## 5. Numbering — the full picture

| Document | Observed pattern | Example | Year in number? | Prefix |
|---|---|---|---|---|
| Bill of Lading | `<DEST>/<yy>-<seq3>` | `KHS/26-110` | yes (2-digit) | destination abbrev |
| Partner B/L | foreign scheme | `NES260900266` | unknown | none |
| Manifest | `DSMAN/<DEST>-<yy>-<seq3>` | `DSMAN/KHO-26-006` | yes | DSMAN |
| Manifest (as referenced) | `DS<KHS>-<yy>-<seq3>` | `DSKHS-26-005` | yes | DS+destination |
| Tax Invoice | `DSINV/<yy>-<seq>` | `DSINV/26-172` | yes | DSINV |
| Proforma | `DSPRO/<yy>-<seq>` | `DSPRO/26-001` | yes | DSPRO |
| Quotation | `DSQUO/<yy>-<seq>` | `DSQUO/25-017` | yes | DSQUO |
| Voucher (external) | plain running number | `477` | no (year in the **type name**: `Receipt 2026`) | none |
| Invoice internal counter | separate Excel counter | `Tax Invoice # 1859` | no | none |
| Voyage | `nn/yy` | `02/26` | yes | — |

**Two findings:**

1. **The B/L pattern is inconsistent with the employer's spoken examples.** Observed: `KHS/26-110`.
   Employer said: `KHS/26-2/2026` and `RJS/26-10`. Three incompatible shapes → `open-questions.md`
   BL-01. The **destination abbreviation as prefix** is the one part all three agree on.
2. **At least nine numbering schemes coexist**, including an unofficial Excel counter. A configurable
   numbering engine is not a nice-to-have — it is the only way to reproduce this. (The current
   system has a `NumberingSequence` model that can express all of them; only the seeded values are
   missing. See [`../05-current-project/implemented-capabilities.md`](../05-current-project/implemented-capabilities.md).)

---

## 6. Money: VAT, currency, arithmetic

| Topic | Finding |
|---|---|
| VAT | Present as a **per-line percentage column only on the Tax Invoice**. Observed value on every line: **0%**. Absent from Quotation, Proforma, Manifest, B/L, SOA and Voucher. |
| Currency | AED on every document that states one. No multi-currency specimen exists. |
| Line arithmetic | `Amount (incl. VAT) = unit price × qty + line VAT`. The footer `Sub Total` is therefore **already VAT-inclusive**, and the footer `VAT` row is a memo, not an addend. |
| Totals | Tax Invoice: Sub Total → VAT (memo) → Total Amount. Quotation/Proforma: Sub Total → Other charges / Freight → Grand Total. |
| Rounding | All values to 2 decimals; thousands separators used; note the artefact `700,00.00` on the Quotation. |

> The VAT-inclusive subtotal is where implementations go wrong. See
> [`invoices.md`](invoices.md) §5 and
> [`../03-legacy-laravel-system/calculations.md`](../03-legacy-laravel-system/calculations.md), where
> the legacy system double-counts VAT.

---

## 7. What the documents prove about the employer's requirements

| Employer requirement | Verdict from the documents |
|---|---|
| `REQ-037` Tug & Barge vessel shape | **Proved** — the manifest names BARGE MEHDI 11 and TUG LAYAN GULF |
| `REQ-040` voyage `n/yy` per vessel+destination+year | **Consistent** — `02/26` appears on both B/L and Tax Invoice |
| `REQ-051` Consignee carries National ID / TRN | **Proved** — `NATIONAL ID: 10100670462` |
| `REQ-056` Agent on the B/L, per destination | **Proved** — BADBAN ARVAND ROOD SHIPPING CO, Khorramshahr |
| `REQ-071` units and packages counted separately | **Proved** — manifest totals "32 UNITS AND 79 PKGS" |
| `REQ-073`/`REQ-107` partner B/Ls on one manifest | **Proved** — `NES260900266`, `NES260900267` alongside the `KHS/26-nnn` series |
| `REQ-101` B/L content | **Proved** — every field the employer listed is on the specimen except CBM (column present, value blank) |
| `REQ-142`/`REQ-143` invoice line and totals structure | **Proved** exactly |
| `REQ-146` printed as Tax Invoice | **Proved** |
| `REQ-147` payment deadline on the invoice | **Not supported** — the current form has no such field |
| `REQ-148` B/L + Manifest refs on the invoice | **Proved** |
| `REQ-150`/`REQ-151` Debit / Credit semantics | **Proved** by the SOA |
| `REQ-162` date-ranged ledger statement | **Proved** by the SOA |
| `REQ-165` unallocated payment posts as Credit | **Proved** by voucher 477's "Advance" line |
| `REQ-122` print strips stamps | **Consistent** — the one voucher specimen carries a physically-applied ink stamp and signature |

---

## 8. Business rules found only in the documents

These exist in Duna's real paperwork but were **never mentioned in the transcripts**:

| Rule | Source |
|---|---|
| 7-day discrepancy window on invoices | Tax Invoice footer |
| HS Code recorded for cargo | Tax Invoice |
| Proforma validity = 1 month | Proforma |
| Proforma certification clause ("actual price … no other proforma invoice …") | Proforma |
| Partial shipment allowed/not allowed is a stated term | Proforma |
| Final delivery place distinct from discharge port | Proforma (`MAKU FREE ZONE` vs `BANDAR ABBAS`) |
| Freight forwarder named on the Proforma | Proforma |
| Notify Party may be the literal value "SAME AS CONSIGNEE" | Bill of Lading |
| Number of original B/Ls stated (1) | Bill of Lading |
| Cargo may be carried "(ON DECK)" | Bill of Lading |
| Two numbering schemes on one document (printed number + Excel counter) | Tax Invoice metadata |
| Voucher type carries the year (`Receipt 2026`) | SOA |
| Sales and Receipts share one numeric voucher series | SOA |

---

## 9. Evidence quality assessment

| Dimension | Assessment |
|---|---|
| Coverage of the freight lifecycle | **Good** — intake → invoice → B/L → manifest → settlement are all represented |
| Coverage of the money flow | **Partial** — one invoice, one statement, one third-party voucher. No Duna-issued payment/receipt voucher, no salary slip |
| Coverage of release / delivery | **None** — no Release Order, no Delivery Order specimen |
| Coverage of operations | **None** — no Load List, no inspection record, no yard document |
| Templates | **None supplied** — only completed samples |
| Time span | 20-Nov-25 (Quotation) → 07-Sep-26 (SOA); the bulk is Jul–Sep 2026 |
| Number of distinct transactions | ~10 (6 sales + 4 receipts on the SOA; 1 invoice; 1 B/L; 1 manifest; 1 proforma; 1 quotation) |

**Honest limitation:** this is a handful of documents, not a corpus. They establish the *shape* of
Duna's paperwork reliably; they do not establish volumes, edge cases, or the full field-level rules.

---

## 10. What a future agent should do with this folder

1. Use `document-catalog.md` when you need a field-level fact.
2. Use the per-document files when you need to know what a document *means*.
3. **Do not invent a template** for the five document types with no specimen.
4. When implementing any document output, check §6 (VAT-inclusive arithmetic) and §8 (rules found
   only in documents) first.
5. If the employer supplies real templates later, add them to `documents/` and update
   `document-catalog.md` §1 — see
   [`../06-ai-reference/documentation-maintenance-plan.md`](../06-ai-reference/documentation-maintenance-plan.md).
