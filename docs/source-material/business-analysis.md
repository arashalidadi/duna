# Business analysis — source material

Document-by-document business analysis, the consolidated business model, the entity/relationship model, the contradictions register and the review of prior analyses.

> Merged from 15 files on 2026-10-20. Every original document appears below in full, under a heading naming its former path.

---

## duna-analysis/02-business-documents/document-analysis.md

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

---

## duna-analysis/02-business-documents/document-catalog.md

# Business Document Catalogue

> **Purpose:** Inventory and factual description of the **seven real company documents** supplied with
> the source pack. These are the only artefacts that show what Duna's paperwork actually looks like —
> as opposed to how the employer describes it.
>
> **Source location:** `docs/duna-analysis/documents/` (7 PDFs, all tracked in Git).
> **Extraction method:** text extracted with PyMuPDF 1.28.2; the one scan-only PDF (Receipt Voucher)
> was rendered at 200 dpi and read with RapidOCR (ONNX Runtime). See §8 for confidence notes.
>
> **Companion documents:** [`document-analysis.md`](document-analysis.md) (what the documents tell us
> about the business), [`invoices.md`](invoices.md), [`quotations.md`](quotations.md),
> [`receipt-vouchers.md`](receipt-vouchers.md), [`statements-of-account.md`](statements-of-account.md).

---

## 1. Inventory

| # | File (in `documents/`) | Pages | Document type | Number | Date | Origin tool |
|---|---|---|---|---|---|---|
| 1 | `BL-1X D155A CH NO 8308-1.pdf` | 1 | Bill of Lading | `KHS/26-110` | 29-Aug-26 | Microsoft Word → Print to PDF |
| 2 | `MAN-MEHDI 11 KHO-26-006.pdf` | 3 | Cargo Manifest | `DSMAN/KHO-26-006` | 05-Sep-26 | (Word-derived) |
| 3 | `INV-GRAND CRANE USED TRUCK CRANE +1 PKG CH.NO 0127-1.pdf` | 1 | Tax Invoice | `DSINV/26-172` | 6-Aug-26 | Microsoft Excel for M365 |
| 4 | `PRO-MEHDI BAGHSIAH 1X R340L, 1X BREAKER, 1X QUICK QOUPLER.pdf` | 1 | Proforma Invoice | `DSPRO/26-001` | 22-Aug-26 | Microsoft Word 2019 |
| 5 | `QUO-SHADMAN MEABADI 1X FINISHER-1.pdf` | 1 | Quotation | `DSQUO/25-017` | 20-Nov-25 | Microsoft Word 2019 |
| 6 | `DUNA  SHIPPING SOA.pdf` | 1 | Ledger Account (statement) | — | 1-Jul-26 → 7-Sep-26 | TallyPrime |
| 7 | `DUNA  SHIPPING  -  RECEIPT  VOUCHER.pdf` | 1 | Receipt Voucher | `477` | 6-Aug-26 | **Scanned** (Canon iR-ADV C5235) |

Total extracted text: 9 pages. Six of seven PDFs carry a usable text layer; the Receipt Voucher does
not.

> **Important scope note.** These are **completed sample documents**, not blank templates. The
> employer repeatedly promised to supply the company's own output templates for the new system
> (`EMP-035`, `EMP-107`, `EMP-119`, `EMP-572`, `EMP-722`, `EMP-725`). **No template was supplied.**
> See `open-questions.md` SRC-02.

---

## 2. Bill of Lading — `KHS/26-110`

**File:** `BL-1X D155A CH NO 8308-1.pdf` · 1 page · created 2026-09-04 · Word → Print to PDF ·
author "Duna Shipping L.L.C".

| Field | Value |
|---|---|
| B/L No. | `KHS/26-110` |
| Shipper | RAS AL KHAIMAH MACHINERIES LLC, DUBAI, UAE |
| Consignee | JOINT MECHANIC CO — National ID `10100670462` |
| Notify Party | SAME AS CONSIGNEE |
| Destination Agent | BADBAN ARVAND ROOD SHIPPING CO, KHORRAM SHAHR, IRAN — contact `+98 9365855027`, `a.mahmoodiani_bar@yahoo.com` |
| Vessel | MEHDI 11 |
| Voyage | `02/26` |
| Port of Loading | HAMRIYA PORT, DUBAI, UAE |
| Port of Discharge | KHORRAM SHAHR, PERSIAN GULF, IRAN |
| Marks & Numbers / QTY | 1 UNIT |
| Description of Goods | USED KOMATSU D155A BULLDOZER · CH.NO `KMT0D105EMC088308` · (ON DECK) |
| Gross Weight | 42,000 KGS |
| Measurement (CBM) | *(blank on this document)* |
| Total numbers of units & packages | 1 UNIT / 42,000 KGS |
| Place of B/L issue | DUBAI |
| Date of B/L issue | 29-AUG-26 |
| Freight charge | FREIGHT PREPAID |
| No. of original B/L | 1 |
| Stamp & signature block | "STAMP & SIGNATURE … AS AGENT" |

**Company letterhead (appears on the B/L):**
AL NOKHITHA BUILDING, HAMRIYA PORT, DUBAI, UAE · CONTACT `+97142527707` ·
MOB `+971503003596 | +971506445868` · E-MAIL `info@dunashipping.com | dunashipping@yahoo.com` ·
WEB `www.dunashipping.com`

**What this tells us**
- The B/L number `KHS/26-110` is `<destination abbrev>/<yy>-<sequence>` with a **3-digit sequence**.
  This does **not** match either of the employer's spoken examples (`KHS/26-2/2026`, `RJS/26-10`) —
  see `open-questions.md` BL-01.
- The voyage is `02/26`, i.e. `nn/yy`, consistent with `REQ-040`.
- Consignee carries a **National ID**, matching `REQ-051`.
- Notify Party can literally be "SAME AS CONSIGNEE" — a value, not a party.
- A **destination agent** block exists on the B/L, matching `REQ-056`.
- CBM exists as a column but was left blank — optional in practice.
- Standard B/L clauses are printed in full (carriage, surrender of one original, "one of which being
  accomplished the others to stand void").

---

## 3. Cargo Manifest — `DSMAN/KHO-26-006`

**File:** `MAN-MEHDI 11 KHO-26-006.pdf` · 3 pages · dated 05-Sep-26.

| Field | Value |
|---|---|
| Manifest No. | `DSMAN/KHO-26-006` |
| Date | 05-Sep-26 |
| Vessel / Barge | BARGE **MEHDI 11** |
| Tug | **LAYAN GULF** |
| Port of loading | HAMRIYA PORT, DUBAI, UAE |
| Port of discharge | KHORRAM SHAHR, PERSIAN GULF, IRAN |
| Rows | 45 |
| B/L numbers carried | `KHS/26-110` … `KHS/26-139` (Duna series) **plus** `NES260900266`, `NES260900267` |
| Totals line | **32 UNITS AND 79 PKGS** · total weight **991,886** |
| Footer | prints `VESSEL = DUNA SHIPPING LLC` |

**What this tells us**
- **Confirms co-loading.** Two B/Ls on the manifest (`NES260900266`, `NES260900267`) use a completely
  different numbering scheme from Duna's `KHS/26-nnn`. This is exactly the partner/forwarder case the
  employer described (`EMP-068`–`EMP-074`, `REQ-107`) and it is real, not hypothetical.
- **A single B/L can occupy several manifest rows** — 30 Duna B/Ls plus 2 partner B/Ls produce 45
  rows, so the manifest is not a 1:1 projection of B/Ls.
- **Units and packages are totalled separately** — "32 UNITS AND 79 PKGS" — confirming `REQ-073`/R7.3
  and the employer's Nagle distinction.
- The manifest names both a **barge and a tug**, confirming the Tug & Barge vessel shape (`REQ-037`).
- The footer printing "VESSEL = DUNA SHIPPING LLC" is a **template defect** in the source document:
  it puts the company name in the vessel field. Do not copy it forward.

---

## 4. Tax Invoice — `DSINV/26-172`

**File:** `INV-GRAND CRANE USED TRUCK CRANE +1 PKG CH.NO 0127-1.pdf` · 1 page · created 2026-08-10 ·
Excel for M365. Document metadata title: *"Tax Invoice # 1859"*.

| Field | Value |
|---|---|
| Invoice No. | `DSINV/26-172` |
| Date | 6-Aug-26 |
| Bill To | MR. SHAHOKH SHAHVARAEI |
| TRN No. (Duna) | `100353243700003` |
| Currency | AED |
| B/L (BOE/DEC/BL#) | `KHS/26-108` |
| Manifest # | `DSKHS-26-005` |
| Vessel | DAHAR 10 |
| Voyage | `02/26` |
| Loading port | HAMRIYA |
| Discharge port | KHORRAM SHAHR |
| Description of goods | USED TRUCK CRANE + 1 PKG · CH.NO `KG54W00127` · HS CODE `87051010` |

**Line items**

| # | Description | Qty | Unit price (AED) | VAT % | VAT | Amount (incl. VAT) |
|---|---|---|---|---|---|---|
| 1 | FREIGHT CHARGE | 1 | 22,020.00 | 0 | 0.00 | — |
| 2 | STORAGE CHARGE | 1 | 650.00 | 0 | 0.00 | — |
| 3 | CUSTOMS DOCUMENTATION | 1 | 200.00 | 0 | 0.00 | — |
| 4 | TRANSPORTATION CHARGE FROM JEBEL ALI TO HAMRIYA | 1 | 4,500.00 | 0 | 0.00 | 4,500.00 |
| | **Sub Total** | | | | **0.00** | **27,370.00** |
| | **Total Amount** | | | | | **AED 27,370.00** |

*(22,020 + 650 + 200 + 4,500 = 27,370 — arithmetic checks out.)*

**Footer note:**
> "if any discrepancy is noticed in the invoice, kindly inform us in writing within 7 days, otherwise
> the above amount will be considered as correct."

**What this tells us**
- The printed document really is headed **TAX INVOICE** (`REQ-146`).
- **Every line on this invoice is VAT 0%** — so the observed default is zero, and the employer's
  "5%" was an example only (`open-questions.md` INV-01).
- Line structure is Description / QTY / UNIT PRICE / VAT % / VAT AMOUNT / AMOUNT (INCL VAT) —
  exactly `REQ-142`, with the column order the employer described.
- The invoice carries **both** a B/L reference and a Manifest reference (`REQ-148`).
- It shows that one invoice can bundle **several different charge types** (freight, storage, customs
  documentation, inland transport) for a single shipment — i.e. the "expenses incurred" model of
  `EMP-104` / `REQ-132`.
- There is a **discrepancy window of 7 days** — a business rule not mentioned anywhere in the
  transcripts.
- The Excel metadata carries a separate internal counter (`Tax Invoice # 1859`) distinct from the
  document number `DSINV/26-172`. Two numbering schemes coexist.

---

## 5. Proforma Invoice — `DSPRO/26-001`

**File:** `PRO-MEHDI BAGHSIAH 1X R340L, 1X BREAKER, 1X QUICK QOUPLER.pdf` · 1 page · 22-Aug-26 ·
Word 2019.

| Field | Value |
|---|---|
| Proforma Invoice No. | `DSPRO/26-001` |
| Date | 22-AUG-26 |
| Validity of P/I | 1 MONTH |
| Seller | DUNA SHIPPING LLC — OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE · P.O BOX 63088 · TEL `0097142527707` · MOB `00971506445868` · E-MAIL `info@dunashipping.com` |
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

| # | Description | Qty | Net Wt (KGS) | G. Wt (KGS) | T.G Wt (KGS) | Unit Price (AED) | Amount (AED) |
|---|---|---|---|---|---|---|---|
| 1 | BRAND NEW HYUNDAI R340L EXCAVATOR (YEAR MADE 2026) | 1 | 33,800 | 33,800 | 33,800 | 520,000.00 | 520,000.00 |
| 2 | BRAND NEW HYDRAULIC BREAKER | 1 | 1,000 | 1,000 | 1,000 | 125,000.00 | 125,000.00 |
| 3 | BRAND NEW QUICK QOUPLER | 1 | 1,000 | 1,000 | 1,000 | 45,000.00 | 45,000.00 |
| | Sub Total | | | | | | **690,000.00** |
| | Freight Charges | | | | | | 0.00 |
| | **Grand Total** | | | | | | **AED 690,000.00** |

Signature: MOHAMMAD KAZEM JOWKAR. Certification clause printed below.

**What this tells us**
- The Proforma is a **goods-sale** document (selling machinery), structurally different from the
  service Tax Invoice: it has net/gross/Total-gross weights, country of origin, Incoterm (FOB),
  payment terms, partial shipment, final delivery place, and a **validity period of one month**.
- It carries **no VAT line at all** — VAT appears only on the Tax Invoice form.
- The seller address differs from the B/L letterhead (Office No. 203 vs the B/L's building-level
  address) — the company has more than one address string in circulation.

---

## 6. Quotation — `DSQUO/25-017`

**File:** `QUO-SHADMAN MEABADI 1X FINISHER-1.pdf` · 1 page · 20-Nov-25 · Word 2019.

| # | Description | Year | Qty | Unit Price (AED) | Amount (AED) |
|---|---|---|---|---|---|
| 1 | LAND TRANSPORT CHARGE FROM DESIGNATED SHOWROOM TO DUBAI HAMRIYA PORT | — | 1 | 700,00.00 | 700,00.00 |
| 2 | FREIGHT CHARGE FROM HAMRIYA TO BUSHEHR | — | 1 | 6,500.00 | 6,500.00 |
| 3 | DOCUMENTATION AND EXIT CHARGE | — | 1 | 500.00 | 500.00 |
| | **SUB TOTAL** | | | | **7,700.00** |
| | OTHER CHARGES | | | | 0.00 |
| | **GRAND TOTAL** | | | | **7,700.00** |

Addressed TO: MR. SHADMAN MEABADI. Subject: "1 UNIT USED VOLVO FINISHER (as per packing list)".
Signed "FOR DUNA SHIPPING LLC".

**What this tells us**
- The Quotation is a **service** quotation (transport + freight + documentation), unlike the
  goods-sale Proforma. Two distinct pre-sales documents exist.
- No VAT line, no validity period, no terms — a much lighter document than the Proforma.
- Note the number formatting artefact `700,00.00` in the source PDF: the amount is **700.00 AED**
  rendered with a stray thousands separator. (6,500 + 500 + 700 = 7,700 — confirms the reading.)
- A **YEAR** column exists and is empty — presumably for machine year of manufacture, inherited from
  a machinery-sale template.

---

## 7. Ledger Account (Statement of Account) — DUNA SHIPPING, 1-Jul-26 → 7-Sep-26

**File:** `DUNA  SHIPPING SOA.pdf` · 1 page · generated by **TallyPrime** on 2026-09-07 ·
metadata title "Ledger Vouchers".

**Issuer (letterhead):** RUKN ALHMREYA TRANSPORT L.L.C · AL NOKITA CUSTOMS BUILDING · DUBAI ·
Emirate: Dubai · **TRN 104652986100003**.

**Ledger subject:** DUNA SHIPPING. Period: 1-Jul-26 to 7-Sep-26.

| Date | Particulars (abridged) | Balance | Amount | Dr/Cr | Vch No. | Vch Type |
|---|---|---|---|---|---|---|
| 4-Jul-26 | TRAILER & FORKLIFT WORK RECORDED FOR LAODING 1 TRAILER COUNTERWEIGHT & 4 TYRES IN ZAM ZAM BARGE | 115.50 Dr | 115.50 | Cr | 1380 | Sales |
| 25-Jul-26 | CASH RECEIVED FROM DUNA SHIPPING AGT INV 1380 | 4.50 Cr | 120.00 | Dr | 446 | Receipt 2026 |
| 28-Jul-26 | LOWBED CHARGES FOR SHIFTING 3 TRIP LOWBED WITH KOMATSU EXCAVATOR & 3 TRUCK SHIFTING TO DAHARA 10 SHIP | 1,098.00 Dr | 1,102.50 | Cr | 1517 | Sales |
| 30-Jul-26 | TRAILER CHARGES FOR SHIFTING 2 TRAILER HEAVY MACHINERY PKGS — BARGE DAHAR 10 | 1,518.00 Dr | 420.00 | Cr | 1526 | Sales |
| 6-Aug-26 | CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526 | 82.00 Cr | 1,600.00 | Dr | 477 | Receipt 2026 |
| 2-Sep-26 | LOWBED CHARGES FOR SHIFTING 6 KOMATSU EXCAVATOR & 2 PC EXCAVATOR FROM A09 YRD TO KHORAMSHAHR 1051 | 2,018.00 Dr | 2,100.00 | Cr | 1703 | Sales |
| 3-Sep-26 | TRAILER & FORKLIFT CHARGES FOR LAODING & SHIFTING CARGO TO KHORAMSHAHR BARGE | 2,648.00 Dr | 630.00 | Cr | 1708 | Sales |
| 4-Sep-26 | TRAILER CHARGES FOR SHIFITNG 3 TRAILER PKGS ON KHORAMSHHAHR BARGE 1051 & 1 TRAILER MACHINERY LOAD ON MEHDI 11 | 3,183.50 Dr | 535.50 | Cr | 1717 | Sales |
| 7-Sep-26 | CASH RECEIVED FROM DUNA SHIPPING | **683.50 Dr** | 2,500.00 | Dr | 532 | Receipt 2026 |
| | **Totals** | | **4,220.00** | **4,903.50** | | |

**Closing Balance: 683.50 Dr.** (4,903.50 − 4,220.00 = 683.50 ✓)

> ⚠️ **Direction warning — this is the most mis-read document in the pack.**
> This statement is issued **by RUKN ALHMREYA TRANSPORT L.L.C** and is the ledger **of DUNA
> SHIPPING in RUKN's books**. Therefore:
> - "Sales" rows are RUKN **selling services to Duna** → they **debit** Duna.
> - "Receipt" rows are RUKN **receiving cash from Duna** → they **credit** Duna.
> - The closing `683.50 Dr` means **Duna owes RUKN 683.50 AED**.
>
> **Duna is the payer here, not the issuer.** This document is evidence of Duna's **cost side**
> (subcontracted trailer / low-bed / forklift work), not of Duna's revenue.

**What this tells us**
- Duna buys **trailer, low-bed and forklift services** from subcontractors — these are precisely the
  "low-bed cost", "crane operation", "Handling" cost categories the employer named (`EMP-104`,
  `EMP-410`, `EMP-696`, `REQ-132`, `REQ-191`).
- The accounting is produced in **TallyPrime**, not in the Laravel system — the external accountant's
  book of record is separate from any Duna application. This matters for any "the system is the
  ledger" assumption.
- Ledger behaviour confirmed: running balance carried line by line; Sales → debit; Receipt → credit;
  a closing balance is stated (`REQ-161`).
- Voucher numbering in the real world is a **plain running number with a year suffix in the type
  name** (`Receipt 2026`, voucher `477`) — not a formatted document number.
- A single receipt (`477`) settles **two** sales invoices (`1517`, `1526`) — see §8 and
  `open-questions.md` FIN-02.
- The employer's destinations (Khorramshahr) and vessels (MEHDI 11, DAHAR 10) appear here too, so
  the documents are from the same operating period.
- Note the source document contains spelling artefacts ("LAODING", "SHIFITNG", "KHORAMSHHAHR") —
  the real paperwork is typed quickly and inconsistently. Do not assume clean master data.

---

## 8. Receipt Voucher — No. 477

**File:** `DUNA  SHIPPING  -  RECEIPT  VOUCHER.pdf` · 1 page · dated **6-Aug-26** ·
**SCAN ONLY** (two images from a Canon iR-ADV C5235; no text layer in the PDF).

Content below was recovered by **OCR** (rendering at 200 dpi, read with RapidOCR / ONNX Runtime).
Detection confidence was high (≥0.94 on every line). Treat the figures as reliable but OCR-derived.

| Field | Value |
|---|---|
| Letterhead | RUKN ALHMREYA TRANSPORT L.L.C · AL NOKITA CUSTOMS BUILDING · DUBAI · Emirate: Dubai |
| Title | Receipt **2026** Voucher |
| No. | **477** |
| Dated | 6-Aug-26 |
| Account | DUNA SHIPPING |
| Amount | **1,600.00** |
| Against Ref 1517 | **1,102.50 Cr** |
| Against Ref 1526 | **420.00 Cr** |
| Advance 477 | **77.50 Cr** |
| Through | Cash |
| On Account of | CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526 |
| Amount in words | DIRHAMS One Thousand Six Hundred Only |
| Footer amount | AED 1,600.00 |
| Authorised Signatory | **SHABIN** / Account Dept. |

**(1,102.50 + 420.00 + 77.50 = 1,600.00 ✓)**

**What this tells us**
- Corroborates the SOA line for voucher 477 exactly (date, amount, references).
- **A single voucher settles two invoices plus an "Advance" line.** The advance (77.50) is the
  unallocated remainder — the real-world instance of `REQ-165` ("an unallocated payment must not
  error; it posts as Credit").
- The voucher is **issued by the counterparty**, not by Duna — so Duna's own voucher forms, which the
  employer wants ID-card capture on (`REQ-168`), are not represented by this sample.
- The OCR run also recovered a **handwritten/inked signature** and stamp image, which cannot be
  transcribed — consistent with the employer's "live stamp on print" rule (`REQ-122`).

See [`receipt-vouchers.md`](receipt-vouchers.md) for the full OCR transcript.

---

## 9. Cross-document observations

1. **Numbering schemes observed**

   | Document | Observed pattern | Example |
   |---|---|---|
   | Bill of Lading | `<DEST>-abbrev>/<yy>-<3-digit seq>` | `KHS/26-110` |
   | Partner B/L | different scheme entirely | `NES260900266` |
   | Manifest | `DSMAN/<DEST>-<yy>-<3-digit seq>` | `DSMAN/KHO-26-006` |
   | Manifest (as referenced on invoice) | `DS<KHS>-<yy>-<seq>` | `DSKHS-26-005` |
   | Tax Invoice | `DSINV/<yy>-<seq>` | `DSINV/26-172` |
   | Proforma | `DSPRO/<yy>-<seq>` | `DSPRO/26-001` |
   | Quotation | `DSQUO/<yy>-<seq>` | `DSQUO/25-017` |
   | Voucher (external) | plain running number | `477` |
   | Voyage | `nn/yy` | `02/26` |

   Note that the invoice's internal Excel counter (`# 1859`) is a **ninth** scheme. The employer's
   spoken B/L examples match none of the observed ones.

2. **Two distinct pre-sales documents**, with different shapes: *Quotation* = services, light;
   *Proforma* = goods sale, heavy (weights, Incoterms, validity, origin/beneficiary).

3. **Two distinct invoice shapes**: *Tax Invoice* (services, VAT-able, per-line VAT columns) and
   *Proforma* (goods, no VAT).

4. **The external accountant runs TallyPrime.** Any system built for Duna will coexist with, or have
   to displace, that.

5. **Documents are produced from Word and Excel**, not from an application. That is the strongest
   argument for the document-template requirement (`REQ-124`): the company's actual "system" today is
   a set of Office files.

6. **Nothing in the pack shows a Delivery Order, Release Order, Salary Slip, Payment Voucher issued by
   Duna, Load List or company Archive.** Five of the nine document types the employer wants templated
   (`EMP-723`) have **no sample at all**.

---

## 10. Extraction provenance & limitations

| Item | Detail |
|---|---|
| Text extraction | PyMuPDF 1.28.2, `get_text()`, run against all 7 PDFs. Working files were under `/tmp` (not persisted). |
| OCR | The Receipt Voucher yielded **no** text layer. Rendered at 200 dpi → PNG, read with `rapidocr-onnxruntime` 1.4.4. Every reported line scored ≥ 0.94 confidence. |
| Page count | 9 pages total across 7 files. |
| **Limitation 1** | The Receipt Voucher content is OCR-derived. Figures cross-check against the SOA, so confidence is high, but it is not a digitally-signed source. |
| **Limitation 2** | The Manifest's 45 rows were read as text; individual row-level detail (per-row consignee/shipper/weight) was spot-checked, not transcribed row by row into this catalogue. If row-level data is needed, re-extract `MAN-MEHDI 11 KHO-26-006.pdf`. |
| **Limitation 3** | Embedded images (company stamp, signature, 30 decorative images on the B/L) were not analysed — they are logos, rules and a signature. |
| **Limitation 4** | No blank templates were supplied, so the *layout* of Duna's documents beyond these samples is unknown. |

---

## duna-analysis/02-business-documents/invoices.md

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

---

## duna-analysis/02-business-documents/quotations.md

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

---

## duna-analysis/02-business-documents/receipt-vouchers.md

# Receipt Vouchers — Document Analysis

> **Scope:** Analysis of the one voucher specimen in the source pack. It is **not issued by Duna** —
> see §1. This page exists mainly because the document is scan-only and had to be OCR'd, and because
> it is the only evidence of how multi-invoice settlement works in practice.
>
> Source: `docs/duna-analysis/documents/DUNA  SHIPPING  -  RECEIPT  VOUCHER.pdf`

---

## 1. Critical orientation — who issued this?

| Fact | Evidence |
|---|---|
| Letterhead | RUKN ALHMREYA TRANSPORT L.L.C, AL NOKITA CUSTOMS BUILDING, DUBAI |
| "Account:" field | DUNA SHIPPING |
| Wording | "CASH **RECEIVED FROM** DUNA SHIPPING AGT INV 1517, 1526" |
| Signatory | SHABIN / Account Dept. |

**Conclusion:** this is RUKN's receipt voucher recording **cash received from Duna**. From Duna's
point of view it is a **payment out**, and RUKN is a **subcontractor** supplying trailer / low-bed /
forklift services.

**Do not mistake this for a Duna-issued Receipt Voucher.** The employer's own Receipt Voucher
requirements (`REQ-163`, `REQ-165`) describe Duna receiving money from *its* customers; this document
shows the mirror image.

---

## 2. Full OCR transcript

Rendered at 200 dpi from the PDF's single scanned page and read with RapidOCR (ONNX Runtime).
The value in the left column is the detector's confidence for that line.

```
1.00  RUKNALHMREYATRANSPORTL.L.C
1.00  ALNOKITACUSTOMSBUILDING
0.99  DUBAI
0.99  Emirate:Dubai
1.00  Receipt2026Voucher
0.99  No.:477
0.95  Dated : 6-Aug-26
0.99  Particulars
1.00  Amount
1.00  Account:
0.96  DUNA SHIPPING
1.00  1,600.00
1.00  AgstRef1517
0.99  1,102.50 Cr
0.94  Agst Ref 1526
0.96  420.00 Cr
1.00  Advance477
0.96  77.50 Cr
0.99  Through :
1.00  Cash
0.98  On Account of :
0.97  CASHRECEIVEDFROMDUNA SHIPPING AGT
0.97  INV 1517，1526
0.97  Amount (in words) :
0.96  DiRHAMS One Thousand SixHundred Only
0.98  DAED 1,600.00
1.00  Authorised Signatory
0.99  SHABIN
0.97  Account Dept.
```

**Reading notes (editorial, not OCR output):**
- `Agst Ref` = **Against Ref** — the standard Tally / Gulf-accounting label for "this receipt is
  applied against reference X".
- `DAED` = **AED** (OCR dropped/merged the character before AED).
- `Receipt2026Voucher` = the voucher type is literally named **`Receipt 2026`** — type name + year,
  which is why the SOA's `Vch Type` column reads `Receipt 2026`.
- `Advance 477` = an advance line **identified by the voucher's own number**, i.e. the unapplied
  remainder is booked as an advance under reference 477.

---

## 3. Structure of the document

| Zone | Content |
|---|---|
| Header | Company letterhead (name, building, city, emirate) |
| Title block | Voucher type (`Receipt 2026`), **No.**, **Dated** |
| Body left | **Particulars** = a list of allocation references |
| Body right | **Amount** per allocation line, each marked `Cr` |
| Account line | `Account:` = the counterparty (DUNA SHIPPING), with the **total** amount beside it |
| Through | Payment method (`Cash`) |
| On Account of | Free-text narrative ("CASH RECEIVED FROM …") |
| Amount in words | "DIRHAMS One Thousand Six Hundred Only" |
| Footer | Total in figures, plus an **Authorised Signatory** block (signed "SHABIN", "Account Dept.") |

---

## 4. Allocation model — the important finding

```
Receipt total                      1,600.00
  ├─ Against Ref 1517              1,102.50 Cr     ← settles sales invoice 1517 in full
  ├─ Against Ref 1526                420.00 Cr     ← settles sales invoice 1526 in full
  └─ Advance 477                       77.50 Cr    ← unapplied surplus, held as an advance
                                   ─────────
                                    1,600.00  ✓
```

Three consequences for the Duna system:

1. **One payment settles several invoices.** The employer's own phrasing is singular
   ("for this specific Invoice", `EMP-659`), but the real document settles two. Multi-invoice
   allocation is therefore a **confirmed practical requirement** even though it is not a stated
   employer requirement. See `open-questions.md` FIN-02.
2. **The surplus has a home.** It is not rejected and not lost — it is booked as an **Advance**
   against the voucher's own number. This is the real-world version of `REQ-165`: an unallocated
   payment must post, not error.
3. **Allocations are credit-side entries.** Each allocation line is marked `Cr`, i.e. the allocation
   credits the counterparty's account — matching `REQ-151` / `REQ-165`.

---

## 5. Cross-check against the Statement of Account

| Field | Receipt Voucher (OCR) | SOA row for voucher 477 |
|---|---|---|
| Date | 6-Aug-26 | 6-Aug-26 ✓ |
| Vch No. | 477 | 477 ✓ |
| Amount | 1,600.00 | 1,600.00 ✓ |
| References | 1517, 1526 | "CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517 , 1526" ✓ |
| Direction | Dr on Duna's ledger (Duna paid) | `Dr` column ✓ |

The two documents are independent renderings of the same transaction and agree exactly. The OCR
result is therefore treated as **reliable**.

---

## 6. What this document does *not* show

| Not present | Why it matters |
|---|---|
| ID-card images of the recipient | The employer requires these on **Duna's** Payment Vouchers (`REQ-168`). This specimen is a third party's Receipt Voucher, so it says nothing either way. |
| Cheque / transfer reference | Payment was `Cash`. Bank and cheque fields are therefore unevidenced. |
| VAT | No VAT appears on the voucher; vouchers are settlement documents, not tax documents. |
| Currency line | Implied AED; no explicit currency field. |
| Duna's own numbering | The number `477` belongs to **RUKN's** voucher series. |

---

## 7. Implications for the dashboard

| Requirement | Evidence from this document |
|---|---|
| `REQ-163` two voucher types | Confirms the Receipt voucher type exists in the real workflow |
| `REQ-164` allocate to a specific invoice | Confirms allocation references are printed on the voucher |
| `REQ-165` unallocated must not error | Confirms the surplus is booked as **Advance** |
| `REQ-162` ledger statement by range | The companion SOA confirms date-ranged statements |
| `REQ-122` print strips stamps | The specimen carries an **inked** stamp and signature on the scan — i.e. applied physically after printing, exactly as the employer described |

---

## 8. Provenance

| Item | Detail |
|---|---|
| PDF | 1 page, no embedded text layer (2 scanned images, Canon iR-ADV C5235) |
| Method | Rendered to PNG at 200 dpi → RapidOCR (ONNX Runtime) via `rapidocr-onnxruntime` 1.4.4 |
| Confidence | Every transcribed line ≥ 0.94; arithmetic self-checks; cross-checks against the SOA |
| Reproduce | `/home/user/pdfenv/bin/python` with PyMuPDF + `rapidocr-onnxruntime`; `opencv-python-headless` is required (the default `opencv-python` needs `libGL.so.1`, which is absent in this sandbox) |
| Caution | The figures are OCR-derived, not from a digital source. They are treated as reliable because they reconcile with the SOA, but they are not a signed record. |

---

## duna-analysis/02-business-documents/statements-of-account.md

# Statements of Account (Ledger Account) — Document Analysis

> **Scope:** The one ledger specimen in the source pack: a TallyPrime "Ledger Account" printout for
> **DUNA SHIPPING**, 1-Jul-26 → 7-Sep-26.
>
> Source: `docs/duna-analysis/documents/DUNA  SHIPPING SOA.pdf` (1 page, TallyPrime, generated
> 2026-09-07, metadata title "Ledger Vouchers").
>
> Companion: [`receipt-vouchers.md`](receipt-vouchers.md) (voucher 477, which appears on this
> statement), [`document-catalog.md`](document-catalog.md) §7 (raw facts).

---

## 1. Orientation — read this first

> ⚠️ **The statement is issued BY RUKN ALHMREYA TRANSPORT L.L.C and is the account OF DUNA SHIPPING
> in RUKN's books.**

| Element | Value | Meaning |
|---|---|---|
| Letterhead | RUKN ALHMREYA TRANSPORT L.L.C · AL NOKITA CUSTOMS BUILDING · DUBAI · Emirate: Dubai · **TRN 104652986100003** | RUKN is the **issuer** |
| Ledger title | "DUNA SHIPPING — **Ledger Account**" | Duna is the **subject** |
| Period | 1-Jul-26 to 7-Sep-26 | RUKN's reporting period |

Therefore, in this document:

| Voucher type | What it is | Effect on Duna's balance |
|---|---|---|
| **Sales** | RUKN sold services **to** Duna | **Debit** (Duna owes more) |
| **Receipt** | RUKN received cash **from** Duna | **Credit** (Duna owes less) |

**Closing balance `683.50 Dr` means Duna owes RUKN 683.50 AED.**

**Business meaning:** Duna is the **payer**, RUKN is a **subcontractor** providing trailer, low-bed
and forklift services. This statement is evidence of **Duna's cost side**, not its revenue side.

Getting this backwards is the single easiest way to mis-read the whole document pack.

---

## 2. Full statement

| Date | Particulars (abridged; original spelling kept) | Balance | Amount | Dr/Cr | Vch No. | Vch Type |
|---|---|---:|---:|:--:|---:|---|
| 4-Jul-26 | TRAILER & FORKLIFT WORK RECORDED FOR **LAODING** 1 TRAILER COUNTERWEIGHT & 4 TYRES IN ZAM ZAM BARGE | 115.50 Dr | 115.50 | Cr | 1380 | Sales |
| 25-Jul-26 | CASH RECEIVED FROM DUNA SHIPPING AGT INV 1380 | 4.50 Cr | 120.00 | Dr | 446 | Receipt 2026 |
| 28-Jul-26 | LOWBED CHARGES FOR SHIFTING 3 TRIP LOWBED WITH KOMATSU EXCAVATOR & 3 TRUCK SHIFTING TO DAHARA 10 SHIP | 1,098.00 Dr | 1,102.50 | Cr | 1517 | Sales |
| 30-Jul-26 | TRAILER CHARGES FOR SHIFTING 2 TRAILER HEAVY MACHINERY PKGS — BARGE DAHAR 10 | 1,518.00 Dr | 420.00 | Cr | 1526 | Sales |
| 6-Aug-26 | CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526 | 82.00 Cr | 1,600.00 | Dr | 477 | Receipt 2026 |
| 2-Sep-26 | LOWBED CHARGES FOR SHIFTING 6 KOMATSU EXCAVATOR & 2 PC EXCAVATOR FROM A09 YRD TO KHORAMSHAHR 1051 | 2,018.00 Dr | 2,100.00 | Cr | 1703 | Sales |
| 3-Sep-26 | TRAILER & FORKLIFT CHARGES FOR **LAODING** & SHIFTING CARGO TO KHORAMSHAHR BARGE | 2,648.00 Dr | 630.00 | Cr | 1708 | Sales |
| 4-Sep-26 | TRAILER CHARGES FOR **SHIFITNG** 3 TRAILER PKGS ON **KHORAMSHHAHR** BARGE 1051 & 1 TRAILER MACHINERY LOAD ON MEHDI 11 | 3,183.50 Dr | 535.50 | Cr | 1717 | Sales |
| 7-Sep-26 | CASH RECEIVED FROM DUNA SHIPPING | **683.50 Dr** | 2,500.00 | Dr | 532 | Receipt 2026 |
| | **Totals** | | **4,220.00** | **4,903.50** | | |
| | **Closing Balance** | **683.50 Dr** | | | | |

**Check:** 4,903.50 (debits) − 4,220.00 (credits) = **683.50 Dr** ✓

> The column layout in the PDF is `Date | Particulars | Balance | Debit | Credit | Vch No. | Vch Type`,
> but the extracted text emits the amount column before the Dr/Cr marker. The table above resolves
> each row using the running balance, which reconciles exactly.

---

## 3. Running-balance walk

| Date | Movement | Running balance |
|---|---|---|
| 4-Jul-26 | +115.50 (Sales → Dr) | 115.50 Dr |
| 25-Jul-26 | −120.00 (Receipt → Cr) | 4.50 Cr |
| 28-Jul-26 | +1,102.50 | 1,098.00 Dr |
| 30-Jul-26 | +420.00 | 1,518.00 Dr |
| 6-Aug-26 | −1,600.00 | 82.00 Cr |
| 2-Sep-26 | +2,100.00 | 2,018.00 Dr |
| 3-Sep-26 | +630.00 | 2,648.00 Dr |
| 4-Sep-26 | +535.50 | 3,183.50 Dr |
| 7-Sep-26 | −2,500.00 | **683.50 Dr** |

The balance changes sign three times in nine lines — so any balance rendering must handle
**both** a debit-side and a credit-side balance, not just "amount owed".

---

## 4. What this document confirms

| Requirement (employer's) | Status | Evidence here |
|---|---|---|
| `REQ-150` invoice/sale posts as **Debit** | **Confirmed** | Every `Sales` voucher debits the account |
| `REQ-151` payment posts as **Credit** | **Confirmed** | Every `Receipt` voucher credits the account |
| `REQ-161` Balance = Debit − Credit, can be either sign | **Confirmed** | The balance flips sign; closing is `683.50 Dr` |
| `REQ-162` Ledger Statement over a **date range** | **Confirmed** | Header "1-Jul-26 to 7-Sep-26"; totals for the period |
| `REQ-163` two voucher types | **Consistent** | `Sales` and `Receipt 2026` types appear; a Payment type is the mirror of Receipt |
| `REQ-164` allocation to a specific invoice | **Confirmed** | Receipt narrations name the invoices: "AGT INV 1380", "AGT INV 1517, 1526" |
| `REQ-165` unallocated must not error | **Confirmed by the companion voucher** | Receipt 477 settles 1517 + 1526 and books the remaining 77.50 as **Advance** |

---

## 5. What this document reveals that the employer did not say

| # | Finding | Detail |
|---|---|---|
| F1 | **The external book of record is TallyPrime.** | The statement is a TallyPrime "Ledger Vouchers" printout. Duna's accounting today runs in third-party accounting software, not in the Laravel system. |
| F2 | **Voucher numbering is a plain running number**, with the year carried in the *type name*. | `Vch No.` values are 446, 477, 532, 1380, 1517, 1526, 1703, 1708, 1717 — one shared numeric series; `Vch Type` is literally `Receipt 2026`. |
| F3 | **Sales and Receipts share one numeric series.** | 1517 (Sales) and 1526 (Sales) sit between 1380 and 1703; 446/477/532 (Receipts) interleave. There is no per-type prefix. |
| F4 | **One receipt settles multiple invoices.** | Voucher 477 settles 1517 *and* 1526. The employer's phrasing is singular (`EMP-659`); reality is plural. See `open-questions.md` FIN-02. |
| F5 | **The narration is the allocation record.** | "AGT INV 1517, 1526" is free text in the Particulars column — allocation is recorded narratively, not as structured references. |
| F6 | **Duna buys subcontracted trailer / low-bed / forklift work.** | Every Sales line is one of those. These are exactly the cost categories the employer named for voyage P&L (`EMP-696`: Handling, Lashing, etc.) and for job costing (`EMP-104`, `EMP-410`). |
| F7 | **Barge and vessel names appear in cost narrations.** | "ZAM ZAM BARGE", "DAHAR 10", "BARGE 1051", "MEHDI 11" — subcontractor costs are attributable to specific vessels/barges in free text. |
| F8 | **The yard appears in cost narrations.** | "FROM A09 YRD TO KHORAMSHAHR 1051" — yard codes are used in cost descriptions. |
| F9 | **Master data quality in the real paperwork is poor.** | "LAODING", "SHIFITNG", "KHORAMSHHAHR", "ZAM ZAM", "DAHARA 10" / "DAHAR 10" — the same names are spelled differently across lines. Any migration or matching will need fuzzy tolerance. |
| F10 | **The counterparty has its own TRN on the statement.** | `104652986100003` — parties carry TRNs in practice, even though the employer does not want TRN on *Customer* (`REQ-017`). |

---

## 6. Structural model implied by the statement

```
Party (RUKN)  ── issues ──►  Ledger Account (subject: DUNA SHIPPING)
                                  │
                                  ├── Sales voucher   → Debit  + amount
                                  ├── Receipt voucher → Credit − amount
                                  │        │
                                  │        └── allocated to one or more invoices (narrated)
                                  │
                                  └── balance carried line by line, both signs
```

Note what is **absent**: there is no chart-of-accounts column, no cost centre, no currency column,
and no separate "invoice" object — the Sales voucher *is* the invoice as far as this ledger is
concerned.

---

## 7. Reconciliation with the Receipt Voucher

| Field | Receipt Voucher 477 (OCR) | SOA row, 6-Aug-26 |
|---|---|---|
| Date | 6-Aug-26 | 6-Aug-26 ✓ |
| Vch No. | 477 | 477 ✓ |
| Amount | 1,600.00 | 1,600.00 ✓ |
| Direction | Cash received by RUKN from Duna | `Dr` on Duna's ledger (Duna paid) ✓ |
| References | Against 1517 (1,102.50 Cr), 1526 (420.00 Cr), Advance 477 (77.50 Cr) | Narration "AGT INV 1517, 1526" ✓ |

The two documents reconcile exactly, which is why the OCR-derived figures in
[`receipt-vouchers.md`](receipt-vouchers.md) are treated as reliable.

---

## 8. Implications for the dashboard

1. **Ledger views must handle both signs** and must show a running balance, not only a closing
   figure.
2. **Date-range filtering is mandatory** (`REQ-162`) — it is the primary way the statement is used.
3. **Voucher numbering should be configurable**, because the observed real-world scheme (plain
   running number, year in the type name) differs from every `DS…`-prefixed scheme used on the
   customer-facing documents.
4. **Allocation must be multi-invoice capable**, with a place for the unapplied remainder (Advance).
5. **Do not assume the system will be the book of record.** Today it is TallyPrime. Any ledger
   feature either has to coexist with it or displace it deliberately — a business decision, not a
   technical one.
6. **Expect dirty master data.** Vessel, barge, port and yard names appear with inconsistent
   spellings in the source paperwork.

---

## duna-analysis/04-business-analysis/capability-gap-analysis.md

# Capability Gap Analysis

> For each capability area: **what the employer asked for → what the real documents prove → what the
> legacy system could do → what is therefore missing.**
>
> The "current system" column is deliberately **not** filled in here. Phase 8 assesses the current
> Next.js/NestJS system directly — see
> [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).

---

## 0. Requirement baseline

| Metric | Value |
|---|---|
| Requirement IDs (`REQ-*`) | **127** |
| Sections | 16 |
| EXPLICIT | 120 |
| INFERRED | 2 |
| UNRESOLVED | 3 |
| CONTRADICTED | 2 |

| # | Section | REQs |
|---|---|---|
| 1 | Navigation & information architecture | 4 |
| 2 | Master Data — Customer | 12 |
| 3 | Master Data — Port, Yard, Vessel | 12 |
| 4 | Master Data — Shipper, Consignee, Agent | 7 |
| 5 | Operations — Cargo registration | 12 |
| 6 | Operations — Inspection | 4 |
| 7 | Operations — Load List / Loading | 5 |
| 8 | Bill of Lading | 8 |
| 9 | Manifest | 5 |
| 10 | Output, printing and document templates | 6 |
| 11 | Jobs & job costing | 6 |
| 12 | Invoicing | 15 |
| 13 | Ledger, vouchers, salary | 13 |
| 14 | Release Order, Delivery Order, Agent portal | 9 |
| 15 | Reporting | 6 |
| 16 | Cross-cutting constraints | 3 |

---

## 1. Capability matrix

Legend: ✅ supported · ⚠️ partial / defective · ❌ absent

| # | Capability | REQs | Document evidence | Legacy | Gap |
|---|---|---|---|---|---|
| **1** | Six-section navigation (Overview, Operations, B/L & Manifest, Accounting, Master Data, Access Control) | 001–004 | — | ❌ (flat menu) | New |
| **2** | Customer master, name-only mandatory, auto code | 010–021 | SOA, Invoice | ⚠️ (two creation paths, one unvalidated) | Format unresolved (C-06) |
| **3** | Port master (name/city/country + abbreviation) | 030–036 | All docs | ⚠️ (one string + abbreviation) | Split into 3 fields |
| **4** | Yard master, port-scoped | 035, 036 | SOA narrations | ✅ | — |
| **5** | **Vessel master** (barge + tug) | 037, 038 | Manifest | ❌ (free text; template hard-codes the company name) | New entity |
| **6** | Shipper / Consignee / Agent masters | 044–055 | B/L, Manifest | ✅ | Cleaner separation needed |
| **7** | Cargo registration | 060–070 | Manifest rows | ✅ | Plus comment entity |
| **8** | Cargo **comments visible to accounting** | 065–067 | — | ❌ | New |
| **9** | Inspection: booked, paid, result recorded | 075–082 | — | ⚠️ (a status field only) | New entity |
| **10** | Inspection **hard-gates** the load list | 082 | — | ❌ (no check in code) | New validation |
| **11** | Load List per voyage, editable next day | 083–094 | Legacy print | ✅ | — |
| **12** | Load List uses the port **abbreviation** | 033 | — | ❌ | New |
| **13** | Days-in-port calculation | 070 | — | ⚠️ (present, with a "today" fallback) | Confirm fallback |
| **14** | B/L: draft → revision → final | 100–105 | B/L | ❌ (no draft state) | New |
| **15** | B/L numbering per destination | 102, 103 | `KHS/26-110` | ⚠️ (date-based, random) | Format unresolved (C-01) |
| **16** | **Co-loading / partner B/Ls on one manifest** | 107 | ✅ Proved (`NES260900266/7`) | ❌ | New |
| **17** | Manifest as a consolidation of B/Ls | 110–116 | Manifest | ❌ (**inverted**) | Structural change |
| **18** | Voyage numbering per vessel + destination | 040–042 | `02/26` | ❌ (port + shipper) | New (C-05) |
| **19** | Outputs: PDF / Print / Excel | 120 | — | ❌ (browser print only) | **New capability** |
| **20** | Print **without** stamp; PDF **with** stamp | 121, 122 | — | ❌ | New |
| **21** | Uploadable document templates, 9 types, versioned | 124 | All 7 PDFs | ❌ (global images only) | New |
| **22** | Job / job costing | 130–135 | — | ❌ | New |
| **23** | Invoice with line items, VAT per line | 140–144 | `DSINV/26-172` | ⚠️ (**VAT double-counted**) | Fix arithmetic |
| **24** | Invoice may span several B/Ls | 141 | Invoice refs | ⚠️ (optional single B/L link) | New |
| **25** | Partial payment state | 149 | — | ❌ (PAID/UNPAID only) | New |
| **26** | Ledger / running balance | 160–163 | SOA | ⚠️ (two display bugs) | Fix |
| **27** | Receipt & payment vouchers | 165–168 | Voucher **No. `477`** | ✅ | Add allocation; ID-card on both. *(Corrected 2026-10-11: was `DSR/26-190` — fabricated; see error E1.)* |
| **28** | Payments to a named person | 171, 172 | — | ⚠️ (free-text description) | New |
| **29** | General Journal | 166, 167 | — | ❌ | New |
| **30** | Salary / salary slip | 169, 170 | — | ❌ | New (process undescribed) |
| **31** | Release Order workflow | 180–184 | — | ❌ (**view-only screen**) | New |
| **32** | Delivery Order | 185, 186 | — | ❌ | New (process thin) |
| **33** | **Agent portal, destination-scoped** | 187, 188 | — | ❌ (unscoped customer portal) | New |
| **34** | Voyage P&L report | 190–194 | — | ⚠️ (manifest report exists, wrong keying) | Extend |
| **35** | Alerts (payment overdue, cargo stuck, inspection pending) | 154, 184 | — | ❌ | New |
| **36** | Company Archive | 004 (REQ-004, `EMP-713`) | — | ❌ | Undescribed |
| **37** | Audit trail | — | — | ❌ | New |
| **38** | Notifications | 154 | — | ❌ | New |

---

## 2. Gap classification

### 2.1 Category A — genuinely new capability (nothing to port)
No legacy code, no document evidence, no employer process detail:

| Capability | REQs | Risk |
|---|---|---|
| Job costing | 130–135 | **High** — the employer described cost types but not the lifecycle |
| Salary / payroll | 169, 170 | **High** — almost no employer input |
| General Journal | 166, 167 | Medium |
| Delivery Order | 185, 186 | Medium |
| Release Order workflow | 180–184 | Medium |
| Agent portal | 187, 188 | Medium |
| Alerts / notifications | 154, 184 | Medium |
| Company Archive | 004 | **High** — title only |
| Document templates | 124 | Medium — 7 real specimens available as the design basis |
| Audit trail | — | Low |
| PDF generation | 120 | Low — well-understood technology |

### 2.2 Category B — legacy has something, but it is wrong
The dangerous category: there *is* code, so it looks done, but it must not be ported.

| Capability | Legacy defect | Consequence of porting it |
|---|---|---|
| Invoice totals | VAT double-counted in the footer (**D4**) | Every VAT-bearing invoice overstates its total |
| Unit price column | Prints the line total (**D5**) | Column header lies |
| Ledger statement | Ordered `desc` while accumulating (**D8**) | Running balance is meaningless |
| Credit balances | Duplicated condition prints `0` (**D7**) | Every customer in credit shows zero |
| B/L release | `RELEASED` never written (**D1**) | Release appears implemented but does nothing |
| Voyage counter | Keyed on port + shipper (**D12**) | Voyage numbers collide across vessels |
| Number generation | Random components (**D13**) | Numbers are not reproducible or auditable |
| Manifest template | Hard-coded vessel name (**D11**) | Every manifest names the company as the vessel |
| Quotation | Free-text body (**D29-adjacent**) | Cannot reproduce the real line-item quotation |

### 2.3 Category C — structural inversions
Not bugs — deliberate legacy design that contradicts the employer.

| Legacy | Employer | Consequence |
|---|---|---|
| Manifest → B/L | B/L → Manifest | Blocks co-loading and per-B/L parties |
| Parties on manifest | Parties per B/L | Same |
| Customers are users | Customer is a commercial party | Blocks the whole party model |
| Port as one string | Port / City / Country | Breaks `REQ-030` |
| Voyage as a string on B/L | Voyage is an entity | Blocks voyage P&L |

### 2.4 Category D — confirmed correct in legacy, safe to carry forward

| Capability | Why it is safe |
|---|---|
| Days-in-port formula | Two independent sources (`REQ-070`, code) |
| `Balance = Debit − Credit` | Confirmed by the real SOA **and** the code |
| Invoice → debit, receipt → credit, payment → debit | Confirmed by the real SOA |
| Load list shape (`NO, CUSTOMER, SHOWROOM, DESCRIPTION, QTY, YARD, ARRIVAL, INSP, LOAD DATE, DAYS`) | Matches `REQ-085` |
| Inspection status values (`PENDING / DONE / LOCAL / NONEED`) | Matches `REQ-075` |
| Loading status values (`IN YARD / LOADED`) | Matches `REQ-093` |
| Voyage P&L = revenue − costs | Confirmed by employer and code |
| Receipt/payment as **separate** permissions | Good granularity worth preserving |
| Payment-status change as its own permission | Same |

---

## 3. Coverage by evidence layer

| Layer | Covers | Cannot cover |
|---|---|---|
| **Employer transcripts** (20 files) | Intent, process, rules, UI structure, statuses | Exact formats, exceptions, salary, letters, archive |
| **Real documents** (7 PDFs) | Actual formats, arithmetic, layout, party blocks, real names and values | Process, rules, future intent |
| **Legacy code** (199 files) | What was once attempted, data shapes, screen inventory | Anything never built (jobs, salary, DO, release, agent portal) |
| **Prior analyses** (8 files) | Framing, checklists, hypotheses | Verified fact (see [`prior-analysis-review.md`](prior-analysis-review.md)) |
| **Current system** | What exists today | — (Phase 8) |

### 3.1 The blind spot

**No source in this workspace answers questions about what the employer has not yet talked about.**
The 160-question questionnaire (Q01–Q160) is the best available map of that blind spot, and it is
**unanswered**.

---

## 4. Priority order for closing gaps

Derived from the employer's own emphasis and from how many downstream requirements each gap blocks.

| Priority | Gaps | Why |
|---|---|---|
| **P0** | Number formats (C-01…C-07) | Blocks every document; the employer will notice immediately |
| **P0** | Invoice arithmetic | Every invoice is wrong if VAT is non-zero |
| **P0** | Ledger balance correctness | Every customer balance is wrong |
| **P1** | B/L → Manifest ordering; per-B/L parties | Blocks co-loading, the single clearest document-proven requirement |
| **P1** | Vessel & Voyage masters | Blocks voyage P&L and voyage numbering |
| **P1** | Release workflow | The employer raised it repeatedly; the legacy screen is a dead end |
| **P2** | Job costing | Described but thin |
| **P2** | Document templates + PDF | Well-specified by the 7 specimens |
| **P2** | Agent portal | Clear intent, unclear scope |
| **P3** | Salary, Letters, Company Archive | Almost no employer input — **must not be built on inference alone** |

---

## 5. Explicit non-gaps

Recorded so nobody "fixes" them:

| Behaviour | Status |
|---|---|
| Legacy `admin_status` management-review gate | **Not required** — legacy-only |
| Legacy random number components | **Not required** — placeholder |
| Legacy `Offer` entity (separate from Quotation) | **Not required** — merged |
| Legacy hard-coded role id 8 on role deletion | **Not required** — a defect |
| Legacy two customer-creation paths | **Not required** — an artefact |
| Legacy SMS gateway integration | **Not mentioned** by the employer; scope unknown |
| Legacy customer "wallet" | **Not mentioned**; dead code |

---

## duna-analysis/04-business-analysis/consolidated-business-model.md

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

---

## duna-analysis/04-business-analysis/contradictions-register.md

# Contradictions Register

> Every place where two or more sources disagree.
>
> **Rule: contradictions are recorded, never silently resolved.** Each entry states the competing
> claims, the evidence for each, a *provisional* reading (clearly labelled as such), and the question
> that must be put to the employer.
>
> Severity key: **B** = blocks implementation · **H** = high (visible wrong behaviour) ·
> **M** = medium · **L** = low / cosmetic.

---

> ## ⚠️ Corrections applied 2026-10-11 (see `09-audit/README.md` §5)
>
> Three entries have changed status. The affected entries carry an inline note; the summary table below
> has been adjusted to match.
>
> | Entry | Change |
> |---|---|
> | **C-07** | **WITHDRAWN** — the claimed real voucher `DSR/26-190` is **fabricated**; it appears in no extracted document, transcript or legacy source. The real receipt voucher is **No. 477**, plain numeric (allocation references `1517`, `1526`, `Advance 477`). There is therefore no `DSR` series to reconcile against the legacy three-series scheme. This is error **E1**; the same string propagated into 8 further files. |
> | **C-17** | **RE-FRAMED** — not a contradiction between two sources. It is a **legacy defect** (hard-coded `VESSEL = DUNA SHIPPING LLC`), correctly identified. The analysis text was right; only its severity framing as a *source conflict* was misleading. No change to the finding. |
> | **C-22** | **RESOLVED** — `/home/duna/dunaData/` is a **stale historical path**. Employer materials are present at `docs/duna-analysis/requirements/` (20 `.txt` transcripts). Source gap **SRC-01 is withdrawn**; it never blocked verification because the inventory reconciles to present files. |
>
> **Note on counts.** The severity table below is retained as originally published; its totals were
> already internally inconsistent (the **H** row listed 10 IDs while claiming 12). Corrected totals, with
> C-07 withdrawn: **B** = 3, **H** = 12, **M** = 7, **L** = 1. The authoritative per-entry dispositions are
> in `09-audit/question-reconciliation.md`.

---

## 1. Numbering

### C-01 · B/L number format — **B**
| Source | Claim |
|---|---|
| Employer (spoken, `EMP-544`) | `KHS/26-2/2026` — destination abbrev / yy-seq / yyyy |
| Employer (spoken, `EMP-546`) | `RJS/26-10` — destination abbrev / yy-seq |
| Real document (`BL-1X D155A …pdf`) | `KHS/26-110` |
| Real manifest (`DSMAN/KHO-26-006`) | carries `KHS/26-110` … `KHS/26-139` — a **3-digit** sequence |
| Real invoice (`DSINV/26-172`) | references `KHS/26-108` |
| Legacy code (`generateBLNumber`) | `{port.abb}/{yy}{mm}{dd}` → e.g. `KHS/20261104` |

**Analysis.** Four shapes. The real documents are the strongest evidence and they agree with each
other: `<DEST>/<yy>-<seq3>`. The employer's spoken examples are probably improvised (he produced
three different customer-code examples in one breath too — see C-11). The legacy format is
date-based and unrelated.

**Provisional reading (INFERRED, not confirmed):** `<DEST-ABBREV>/<yy>-<seq>`, sequence per
destination per year, zero-padded to 3 digits. Matches `REQ-102`.

**Question for the employer:** show him `KHS/26-110` and `KHS/26-108` and ask whether these are his
numbers and what the sequence resets on.

---

### C-02 · Manifest number format — **B**
| Source | Claim |
|---|---|
| Real manifest | `DSMAN/KHO-26-006` |
| Real invoice reference | `DSKHS-26-005` |
| Legacy code (`generateManifestNumber`) | `{port.abb}/{rand6}{dd}{mm}{yyyy}` → e.g. `KHO/4829132026` — **random** |

**Analysis.** Two real formats differ from each other in prefix shape (`DSMAN/KHO-` vs `DSKHS-`),
which suggests either two series or an inconsistency in the company's own documents. The legacy
format is random and shares nothing with either.

**Provisional reading:** at least one manifest series exists of the form
`DSMAN/<DEST>-<yy>-<seq3>`. `DSKHS-26-005` is either an older series or a typo. **Unresolved.**

**Question:** is `DSKHS-26-005` the same series as `DSMAN/KHO-26-006`?

> **Status update (2026-10-12) — premise corrected.** The original text above is **retained for history**; the
> correction is recorded here.
>
> `DSKHS-26-005` occurs **zero times** in the Manifest PDF (`MAN-MEHDI 11 KHO-26-006.pdf`). It is a field on
> the **Tax Invoice** (`INV-GRAND CRANE ...0127-1.pdf`), which covers a **different voyage**: vessel
> **DAHAR 10**, B/L `KHS/26-108`. The Manifest covers barge **MEHDI 11** with B/Ls `KHS/26-110`...`KHS/26-139`.
>
> **Consequences:**
> - The reading *"at least two manifest series in the evidence"* is **withdrawn**. There is only one manifest
>   series evidenced (`DSMAN/<DEST>-<yy>-<seq3>`).
> - The **"typo" reading is weakened but not eliminated**: `DSKHS-26-005` remains a single occurrence on an
>   unrelated document and a different voyage, so it cannot be assumed to be a mistyped manifest number. It is
>   now best classified as an **out-of-scope reference on another document**, not as a competing manifest
>   series.
> - **C-02 no longer blocks implementation.** The manifest format needed for P2 seeding is evidenced directly
>   by the Manifest itself. C-02 is reclassified from **B — blocks implementation** to **L — low (data
>   hygiene)**.
>
> *Verified by:* direct text-layer extraction from both PDFs; `DSKHS` returned 0 matches in the Manifest and
> 1 match in the Tax Invoice. **No visual inspection was performed or claimed.**

---

### C-03 · Invoice number — **H**
| Source | Claim |
|---|---|
| Real invoice | `DSINV/26-172` |
| Legacy code (`getinvoiceCode`) | `DSAED/{rand6}` — random, wrong prefix |
| Prior analysis (`duna_source_pack.md` §4.4) | "Invoice code sequential" |

**Analysis.** The prior analysis is simply wrong about the legacy code — the generator uses
`rand(111111, 999999)`. The real prefix is `DSINV`, not `DSAED`.

**Provisional reading:** `DSINV/<yy>-<seq3>`. **Do not port the legacy format.**

---

### C-04 · Proforma prefix — **M**
| Source | Claim |
|---|---|
| Real proforma | `DSPRO/26-001` |
| Legacy code (`getPerformaNumber`) | `SDPRO/…` — the first two letters are **transposed** |

**Provisional reading:** `DSPRO/<yy>-<seq3>`. The legacy transposition is a typo in the generator.

---

### C-05 · Voyage counter keying — **H**
| Source | Claim |
|---|---|
| Employer (`REQ-041`) | Voyage is numbered per **vessel + destination** |
| Legacy code (`generateVoyage($shipper,$port)`) | Voyage counter keyed on **port + shipper** |

**Analysis.** Direct contradiction. The legacy keying is defect **D12**.

**Provisional reading:** follow the employer — vessel + destination.

---

### C-06 · Customer code format — **M**
| Source | Claim |
|---|---|
| Employer, one breath (`EMP-207`…`EMP-233`) | `CUST 3-3-1`, `CUST 3SF-2`, `CUST 2SF-1 / 3SF-1…N`, `CUST 3.1 / 3.2 / 3.3` |
| Legacy code | `CUST00{id+1}` |

**Analysis.** Four incompatible examples from the employer in a single explanation. The substantive
requirement is clear: a system-generated, sequential, prefixed code (`REQ-014`). Only the **string
format** is open. The legacy format is unrelated.

**Provisional reading:** keep the format in a seeded `NumberingSequence` so it can be changed without
code. **Do not hard-code any of the four.**

---

### C-07 · ~~Receipt voucher series~~ — **WITHDRAWN (2026-10-11)**
| Source | Claim |
|---|---|
| Real voucher | ~~`DSR/26-190`~~ → **corrected: Voucher No. `477`, plain numeric** |
| Legacy code | a three-series scheme; the receipt series in our specimen is `DSAO/26-097` |

**Analysis — CORRECTED.** The string `DSR/26-190` is **fabricated**. It appears in no extracted document, in no
transcript, and in no legacy source. The real receipt voucher in the sample set is **No. 477**, a plain
sequential number, and its allocation references are `1517`, `1526` and `Advance 477`. This entry was derived
from that false premise and is therefore **withdrawn as a contradiction**: there is no `DSR` series to
reconcile against the legacy three-series scheme.

**Residual open item.** That the voucher series is plain numeric is confirmed by one specimen. The format is
configurable data, so a wider sample can be adopted without migration.

**Correction scope.** The same fabricated string propagated into 8 further files. See
`09-audit/README.md` §5 (error **E1**) for the authoritative correction list; `09-audit/target-documents-and-configuration.md` §3 for the verified numbering samples.

---

## 2. Process order and structure

### C-08 · Manifest vs B/L creation order — **B**
| Source | Claim |
|---|---|
| Employer (`EMP-024`–`EMP-027`, `EMP-567`, `EMP-568`) | **B/L first**; the manifest is a consolidation of issued B/Ls |
| Legacy code (`ManifestController@createbl`) | **Manifest first**; B/Ls are created *against* a manifest and inherit vessel, voyage and parties |
| Current project (`ADR-045`, `ADR-047`) | Manifest is a downstream consolidation of **approved** B/Ls — i.e. the employer's order |

**Analysis.** This is the single most consequential structural contradiction in the whole knowledge
base. The employer and the current project agree; the legacy system disagrees.

**Provisional reading:** the employer is right, and the current project has already adopted his
order. **Do not re-import the legacy nesting.**

---

### C-09 · Party ownership on B/L vs Manifest — **H**
| Source | Claim |
|---|---|
| Employer | Parties are per B/L |
| Legacy code | Parties are set at **manifest** level and default onto B/Ls |
| Real manifest | Rows carry **both** shipper and consignee per B/L row — so parties are effectively per B/L |

**Analysis.** The real document supports the employer. Legacy inheritance is a convenience that
breaks the co-loading case.

**Provisional reading:** parties per B/L. This is what makes the partner-B/L requirement
(`REQ-107`) implementable.

---

### C-10 · Management approval gate on cargo — **M**
| Source | Claim |
|---|---|
| Legacy code | `admin_status: PENDING → APPROVED`, with its own permission `loadings.adminapprove` |
| Employer | **Never mentioned** any approval step on cargo intake |

**Analysis.** Legacy-only behaviour. The employer's flow goes straight from intake to inspection.

**Provisional reading:** **legacy-only.** Do not carry it into the new system unless the employer
asks for it. Note that the current project *does* have an approval concept for B/Ls before manifest
consolidation (`ADR-047`) — that is a different gate and is consistent with the employer's
draft→final B/L lifecycle.

---

## 3. Financial

### C-11 · Invoice VAT arithmetic — **H**
| Source | Claim |
|---|---|
| Legacy code (`invoices/view.blade.php`) | Footer renders `vatamount + subtotal` |
| `invoiceitems` semantics | `subtotal` **already includes** VAT (each line's VAT is added into the line amount) |
| Real invoice `DSINV/26-172` | Sub Total 27,370.00 · VAT 0.00 · Total 27,370.00 |
| Employer (`REQ-144`) | VAT is a percentage per line |

**Analysis.** The legacy footer **double-counts** VAT whenever VAT is non-zero. The specimen cannot
disprove it because its VAT is zero — but the specimen *does* prove that `Total = Sub Total` when
VAT is zero, which is the double-count's degenerate case.

**Provisional reading (verified arithmetic):**
```
lineNet    = unit × qty
lineVat    = lineNet × vat% / 100
lineAmount = lineNet + lineVat
Sub Total  = Σ lineAmount      ← already VAT-inclusive
footer VAT = memo only
Total      = Sub Total
```

**Question:** confirm with the employer that the footer VAT figure is a memo and is **not** added
again.

---

### C-12 · "UNIT PRICE" column contents — **M**
| Source | Claim |
|---|---|
| Legacy invoice template | Header `UNIT PRICE (AED)`; cell prints the **line total** |
| Real invoice | Shows `UNIT PRICE` and `AMOUNT (AED)` as separate columns |

**Analysis.** A legacy rendering bug (defect **D5**), not a business rule.

---

### C-13 · Invoice payment status granularity — **H**
| Source | Claim |
|---|---|
| Legacy code | `PAID` / `UNPAID` — two states only |
| Employer (`REQ-149`) | Partial payment must be representable |

**Analysis.** Not a contradiction in the strict sense — the legacy system simply cannot express what
the employer wants.

**Provisional reading:** implement `UNPAID / PARTIAL / PAID`.

---

### C-14 · Direction of the ledger statement — **M**
| Source | Claim |
|---|---|
| Legacy code (`FinController@preview`) | Rows ordered **descending**, running balance accumulated from the top |
| Real TallyPrime SOA | Rows **ascending** by date, running balance accumulates forwards |

**Analysis.** The legacy ordering is a bug (defect **D8**) that makes the running balance
meaningless. Two independent sources (the real SOA and basic accounting practice) agree that
ascending is correct.

---

### C-15 · Debit/credit balance display — **H**
| Source | Claim |
|---|---|
| Legacy code (`CalculateDebitCredit` + views) | A duplicated `$debit > $credit` condition means credit-side balances print `0` |
| Real SOA | Closing balance shown as `683.50 Dr` — a **labelled** balance with a Dr/Cr suffix |

**Analysis.** The legacy display is a bug (defect **D7**). The real SOA shows the correct
presentation: a magnitude plus a `Dr`/`Cr` marker.

---

## 4. Document shape

### C-16 · Quotation structure — **H**
| Source | Claim |
|---|---|
| Legacy code | Quotation is a single **free-text HTML body** |
| Real quotation `DSQUO/25-017` | A **line-item table** (description, qty, rate, amount) with a grand total |

**Analysis.** The legacy Quotation/Offer models cannot reproduce the real document. By contrast the
legacy **Proforma** *is* line-item based — so the two pre-sales document families were modelled
differently in the legacy system even though the real documents are structurally similar.

**Provisional reading:** both Quotation and Proforma need line items. See
[`../02-business-documents/quotations.md`](../02-business-documents/quotations.md).

---

### C-17 · Vessel printed on the manifest — **H**
| Source | Claim |
|---|---|
| Legacy template (`manifest/preview.blade.php`) | Hard-coded `VESSEL = DUNA SHIPPING LLC` |
| Real manifest | `VESSEL: BARGE MEHDI 11 / TUG LAYAN GULF` |

**Analysis.** The legacy template could never have produced a correct manifest (defect **D11**).
The real document also shows the **tug and barge** convention, which the legacy data model does not
capture.

> **STATUS UPDATE (2026-10-11) — RE-FRAMED, finding unchanged.** This is **not** a contradiction
> between two sources; it is a **legacy defect**, correctly identified as defect **D11**. The two lines
> above stand as written. Only the classification was misleading — legacy is evidence of previous
> behaviour, not the specification, so a hard-coded value in a legacy template is a defect to report,
> not a conflict to reconcile. No change to the finding; no action beyond keeping it as a recorded
> legacy defect.

---

### C-18 · Co-loading / partner B/Ls — **H**
| Source | Claim |
|---|---|
| Employer (`REQ-107`) | Partner B/Ls with different formats must be able to sit on one manifest |
| Legacy code | B/Ls must belong to a manifest and inherit its parties; number format is generated, not free |
| Real manifest | ✅ Confirms the employer — rows `NES260900266`, `NES260900267` sit alongside `KHS/26-nnn` |

**Analysis.** The employer is right and the real document proves it. The legacy model cannot do this.

---

## 5. Prior-analysis contradictions

### C-19 · Is there a Ledger in the legacy system? — **M**
| Source | Claim |
|---|---|
| `docs-legacy/00-OVERVIEW.md` line 34 | "Accounting → Ledger — Not found as separate model — ❌ Missing" |
| `docs-legacy/03-UI-PAGES.md` lines 61–62 | `admin/fins/ledger`, `admin/fins/showledger` — **listed as existing** |
| Verified code | `Fin` model, `FinController` (215 lines, 11 methods), 4 Blade views |

**Analysis.** `00-OVERVIEW.md` is **wrong**, and the same document set contradicts itself. The
correct statement is that the legacy ledger is *inadequate* (no double entry, no general journal, no
accounts), not *absent*.

---

### C-20 · Is the legacy invoice code sequential? — **L**
| Source | Claim |
|---|---|
| `duna_source_pack.md` §4.4 | "Invoice code sequential" |
| Verified code (`getinvoiceCode()`) | `DSAED/` . `rand(111111,999999)` — random |

**Analysis.** The prior analysis is wrong. Treat prior analyses as hypotheses.

---

### C-21 · Legacy B/L release states — **M**
| Source | Claim |
|---|---|
| `duna_business_analysis.md` §4.3 and `duna_source_pack.md` §4.3 | "Legacy B/L: `PENDING → RELEASED`" |
| Verified code | `RELEASED` is a declared constant; **no code path ever writes it**. `ReleaseController` has no release action — only Delete |

**Analysis.** Both prior analyses describe the *intended* lifecycle as if it were implemented
(defect **D1**).

---

## 6. Workspace / source contradictions

### C-22 · The highest-authority source is absent — **H**
| Source | Claim |
|---|---|
| `docs/plan.md` | Names `/home/duna/dunaData/` as the highest-authority source |
| This workspace | `/home/duna/dunaData/` **does not exist** |

**Analysis.** Recorded as source gap **SRC-01**. Nothing in this knowledge base has been verified
against it. **Any conclusion here is provisional with respect to that missing source.**

> **STATUS UPDATE (2026-10-11) — RESOLVED, source gap WITHDRAWN.** `/home/duna/dunaData/` is a **stale
> historical path**, not a missing source. Employer materials are present and complete at
> `docs/duna-analysis/requirements/` (20 `.txt` transcripts, all listed in source pack §3). The source
> inventory reconciles fully to present files, so **SRC-01 is withdrawn** — it never hindered
> verification. The only genuinely absent materials are: the original **audio** recordings, the Company
> Archive "next file" alluded to in the transcripts, and the company's official **output templates**.
> Those three are recorded separately (the templates as scoped limitation, `09-audit/README.md` §3.4).

---

## 7. Summary by severity

| Severity | Count | IDs |
|---|---|---|
| **B** — blocks implementation | 3 → **2** | C-01, C-08 — **C-02 reclassified to L (2026-10-12)** |
| **H** — high | 12 | C-03, C-05, C-09, C-11, C-13, C-15, C-16, C-17, C-18, C-22 |
| **M** — medium | 8 → **7** | C-04, C-06, ~~C-07~~, C-10, C-12, C-14, C-19, C-21 — **C-07 withdrawn** |
| **L** — low | 1 → **2** | C-20, **C-02** (reclassified from B, 2026-10-12) |

### 7.1 The pattern

Almost every contradiction falls into one of three shapes:

1. **The legacy system does not implement what it declares** (C-03, C-11, C-12, C-14, C-15, C-17,
   C-20, C-21). ⟹ Treat legacy code as evidence of *attempted* behaviour, and always look for the
   executing line.
2. **The employer improvises examples** (C-01, C-02, C-06). ⟹ Trust real documents over spoken
   examples for *formats*; trust the employer over documents for *rules*.
3. **A prior analysis asserts without verifying** (C-19, C-20, C-21). ⟹ Verify against code.

### 7.2 Contradictions that are NOT contradictions

Recorded so they are not re-opened:

| Apparent conflict | Why it is not one |
|---|---|
| "Journal entries are debits" vs "payments are debits" | Both true. Journal entries and payments are **both** money-out representations in this system's convention (`REQ-166`) |
| One B/L per cargo vs several cargos per B/L | Not settled by the employer, but the real B/L shows one machine with one chassis number. Currently **unresolved**, not contradicted |
| `DSMAN/KHO-26-006` vs `DSKHS-26-005` | Two different voyages/manifests in the evidence set. Not necessarily a contradiction — see C-02 |

---

## duna-analysis/04-business-analysis/customer-relationship-hypotheses.md

# Customer-Relationship Hypotheses

> Phase 9. Every hypothesis anyone has advanced — or could advance — about **how Customer relates to
> the other parties**, tested against the evidence.
>
> This matters because it is the single structural decision that the legacy system got wrong
> (customers **were** users) and the current system got right (Customer is its own entity).

---

## 0. The employer's own statement (authoritative)

`REQ-018`, `REQ-020`:

> A Customer is an **internal commercial counterparty**: the party Duna invoices and whose ledger Duna
> maintains. It is **not necessarily** the Shipper or the Consignee on any document.

And the worked example (`EMP-394`–`EMP-408`):

> A customer in Australia buys a machine; Duna moves it Australia → Jebel Ali (clearance) → Hamriyah →
> Khorramshahr. **The Australian seller is the Shipper. The destination party is the Consignee. Only
> the Australian buyer is Duna's Customer.**

---

## 1. Hypothesis register

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| **H1** | Customer **is** the Shipper | ❌ **Rejected** | `REQ-018`, `REQ-020`; B/L `KHS/26-110` shows `RAS AL KHAIMAH MACHINERIES LLC` as Shipper and a different party as Customer |
| **H2** | Customer **is** the Consignee | ❌ **Rejected** | `REQ-020` — the consignee is chosen by the customer/destination party, not by Duna (`REQ-054`) |
| **H3** | Customer is always one of Shipper / Consignee / Notify | ❌ **Rejected** | `REQ-018` — "not necessarily". In the Australian example the Customer is the buyer, who is neither Shipper nor Consignee |
| **H4** | Customer is a **User** account in the system | ❌ **Rejected for the new system** | This is what the **legacy** system did (`level='User'`). The employer never said it. The current system correctly separates `Customer` from `User` |
| **H5** | Every Shipper / Consignee is also a Customer | ❌ **Rejected** | `REQ-018`; real documents show shipper/consignee names that never appear as customers |
| **H6** | A Customer can be a natural person **or** a legal entity | ✅ **Accepted** | `REQ-019`. Real evidence: Tax Invoice `DSINV/26-172` is billed to `MR. SHAHOKH SHAHVARAEI` — a person |
| **H7** | A Customer has one ledger, spanning all their jobs | ✅ **Accepted** | `REQ-160`, `REQ-161`; the real SOA is a per-account ledger with a running balance |
| **H8** | Several Customers could be the same real-world party under different names | ⚠️ **Unresolved** | No evidence either way. Risk: the employer's customer list may contain duplicates (the SOA and invoices show person names, not company names) |
| **H9** | An Agent can also be a Customer | ⚠️ **Unresolved** | Agents are destination representatives (`REQ-055`, `REQ-056`). Nothing says they cannot also be customers |
| **H10** | The Customer is who the **invoice** is addressed to | ✅ **Accepted** | `REQ-146` + every real invoice/quotation/proforma is addressed to a named individual |
| **H11** | The Customer is who the **voucher** is raised against | ✅ **Accepted** | `REQ-164`; the real SOA is an account for `DUNA SHIPPING` at `RUKN ALHMREYA TRANSPORT` |
| **H12** | Agents should see **all** customers' data for their destination | ❌ **Rejected** | `REQ-187` — agents see **their own destination's** data. The scoping axis is the **destination**, not the customer |
| **H13** | A Customer record needs Type / Currency / TRN / Short Name | ❌ **Rejected — explicitly** | `REQ-017` — the employer explicitly **removed** these fields |
| **H14** | Customer credit limits exist | ⚠️ **Unresolved** | `REQ-017` removed Type/Currency/TRN/Short Name but said nothing about credit. Multi-currency was raised elsewhere (Q85). See `open-questions.md` CUST-02 |
| **H15** | One Customer → many Jobs → many Cargos | ✅ **Accepted** | `REQ-130`, `REQ-135`; the Job carries a Customer |
| **H16** | One Cargo belongs to exactly one Customer | ✅ **Accepted** | `REQ-060` — cargo registration **begins** with Customer selection |
| **H17** | A single Manifest can carry several different Customers | ✅ **Accepted** | `REQ-115`. Proved by the real manifest, whose 45 rows carry different shippers and consignees |
| **H18** | A single Invoice can cover several B/Ls (possibly of different customers?) | 🟡 **Partly accepted** | `REQ-141` — an invoice can cover several B/Ls. Whether those B/Ls may belong to **different customers** is **not stated** — an invoice has one customer, so presumably not |

---

## 2. The accepted model

```
                    ┌──────────────────────────────────────────┐
                    │  Customer  (commercial counterparty)     │
                    │  • name is the ONLY mandatory field      │
                    │  • system-generated code                 │
                    │  • optional contact / email / address    │
                    │  • NOT Shipper, NOT Consignee, NOT User  │
                    └───┬───────────┬──────────┬───────────┬───┘
                        │           │          │           │
                 1..n   │    1..n   │   1..n   │    1..n   │
              ┌─────────▼┐  ┌───────▼──┐ ┌─────▼────┐ ┌───▼──────┐
              │   Job    │  │  Cargo   │ │ Invoice  │ │  Ledger  │
              │ (cost    │  │ (operat- │ │ (money   │ │ (Dr − Cr │
              │  note)   │  │  ional)  │ │  in)     │ │  = bal)  │
              └──────────┘  └─────┬────┘ └──────────┘ └──────────┘
                                  │
                          ┌───────▼────────┐
                          │  B/L / Manifest│
                          │  ── Shipper    │  ← independent parties
                          │  ── Consignee  │
                          │  ── Notify     │
                          │  ── Agent      │
                          └────────────────┘
```

**The one sentence to remember:** *Customer is who pays; Shipper, Consignee, Notify and Agent are who
appear on the transport documents. They are different axes and must never be merged.*

---

## 3. Consequences if the hypotheses are got wrong

| Mistake | Consequence |
|---|---|
| Merging Customer with Shipper | Invoices go to the wrong party; the ledger balances against the wrong entity |
| Merging Customer with User | Every customer needs a login; agents and customers are conflated; scoping breaks |
| Deriving parties from the Manifest (the legacy mistake) | Co-loading (`REQ-107`) becomes impossible; a manifest cannot carry two shippers |
| Scoping the agent portal by Customer instead of Destination | Agents see the wrong data — the exact problem `REQ-188` exists to solve |
| Adding Type / Currency / TRN to Customer | Direct violation of `REQ-017`; the employer will notice immediately |

---

## 4. Open questions that remain

| ID | Question | Why it matters |
|---|---|---|
| **H-Q1** | Can two Customer records refer to the same real-world party? | The real documents use **person names** (`MR. SHAHOKH SHAHVARAEI`, `MR. RAMIN AHMADABADI`, `MR. SHADMAN MEABADI`). Person-based customer records invite duplicates |
| **H-Q2** | If a Customer is a natural person, what is the "name"? | `REQ-011` says name-only-mandatory; `REQ-019` says a person or an entity. Real invoices use `MR. <Firstname> <Lastname>` |
| **H-Q3** | Is there any notion of customer **credit** or payment terms? | `REQ-182` mentions releasing cargo "on credit" — which implies a credit concept exists somewhere |
| **H-Q4** | Can an Agent be a Customer? | Affects whether the agent portal and the customer portal share an identity model |
| **H-Q5** | Can one invoice span B/Ls belonging to **different** customers? | `REQ-141` says an invoice can cover several B/Ls; it does not say the customers must match |

All five are recorded in
[`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md).

---

## 5. How the two systems compare on this

| | Legacy | Current |
|---|---|---|
| Customer is a User | ✅ (it *was*) | ❌ (correctly separated) |
| Shipper/Consignee masters | ✅ | ✅ and **active** |
| Parties per B/L | ❌ (inherited from manifest) | ✅ |
| Several customers per manifest | ✅ | ✅ |
| Agent scoping | ❌ none | 🟡 foundation; destination scoping is Phase 8 |
| Customer 360 (cargo, jobs, invoices, ledger) | ❌ | ⏳ Phase 8 |

The legacy system's single worst modelling decision — **customers are users** — has been undone.
Everything else in this file is either already correct in the current system or is a Phase 8 item.

---

## duna-analysis/04-business-analysis/entity-relationship-model.md

# Entity–Relationship Model

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> Three views of the same domain:
> 1. **§2 — the target model** (what the business needs, per the employer)
> 2. **§3 — the current system's model** (what `prisma/schema.prisma` actually has, 62 models / 25 enums)
> 3. **§4 — the legacy model** (what the Laravel system had, 23 models)
>
> Then §5 maps them and §6 lists what is still missing.

---

## 1. How to read this file

| Symbol | Meaning |
|---|---|
| ✅ | Entity exists in that system |
| ⚠️ | Exists but wrong / partial / defective |
| ❌ | Does not exist |

---

## 2. Target model (from the employer's requirements)

```
                       ┌──────────────┐
                       │    Port      │  name, city, country, abbreviation
                       └──────┬───────┘
                              │ 1..n
                       ┌──────▼───────┐
                       │     Yard     │  port-scoped storage location
                       └──────┬───────┘
                              │
┌──────────────┐       ┌──────▼───────────────────────────────────┐
│   Customer   │ 1..n  │              Cargo                       │
│  name only   ├──────►│  chassis no., qty, description,          │
│  mandatory   │       │  net/gross weight, measurement,          │
└──────┬───────┘       │  arrival date, loading date              │
       │               │  inspection status · loading status      │
       │               └───┬───────────┬──────────┬───────────────┘
       │                   │           │          │
       │           ┌───────▼──┐  ┌─────▼─────┐  ┌─▼──────────────┐
       │           │  Cargo   │  │Inspection │  │  LoadListItem  │
       │           │Comment   │  │ booked /  │  │  (selection)   │
       │           │ (→ acct) │  │ paid /    │  └───┬────────────┘
       │           └──────────┘  │ result    │      │
       │                         └───────────┘  ┌───▼────────────┐
       │                                        │   LoadList     │
       │                                        │ (per voyage)   │
       │                                        └───┬────────────┘
       │                                            │
       │   ┌──────────┐      ┌──────────┐      ┌─────▼──────────┐
       │   │  Vessel  │ 1..n │  Voyage  │ 1..1 │    Manifest    │
       │   │ barge +  ├─────►│  nn/yy   ├──────►│  consolidation│
       │   │ tug      │      └──────────┘      └─────▲──────────┘
       │   └──────────┘                              │
       │                                        ┌────┴──────────┐
       │                                        │ BillOfLading  │
       │   ┌──────────┐  ┌──────────┐           │ draft → final │
       ├───┤  Shipper ├─►│Consignee │◄──────────┤ released?     │
       │   └──────────┘  └──────────┘           └────┬──────────┘
       │   ┌──────────┐                              │
       └───┤  Agent   │ (destination-scoped)         │
           └──────────┘                              │
       ┌───────────────┐   ┌──────────────┐     ┌─────▼──────────┐
       │  Job / Job    │   │   Invoice    │◄────┤  (invoice may  │
       │  CostItem     │◄──┤ line items,  │     │  span several  │
       └───────────────┘   │ VAT per line │     │  B/Ls)         │
                           └──────┬───────┘     └────────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │   Ledger / Vouchers      │
                     │  invoice · receipt ·     │
                     │  payment · journal       │
                     │  → Balance = Dr − Cr     │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │  Release Order (via Agent)│
                     │  Delivery Order           │
                     └───────────────────────────┘
```

### 2.1 Parties

| Entity | Cardinality vs Cargo | Notes |
|---|---|---|
| Customer | 1..n | **Name is the only mandatory field** (`REQ-011`) |
| Shipper | 1..n on B/L | Name + address block |
| Consignee | 1..n on B/L | Name + address block |
| Notify Party | on B/L | Often "SAME AS CONSIGNEE" |
| Agent | per destination | Needs destination-scoped portal access (`REQ-187`) |

### 2.2 Key cardinality decisions (from the employer, not inferred)

| Relationship | Cardinality | Requirement |
|---|---|---|
| Customer → Cargo | 1 : n | `REQ-011` |
| Cargo → B/L | n : 1 (a B/L can cover several cargos) | `REQ-100` |
| B/L → Manifest | n : 1, **after** the B/L is issued | `EMP-024`–`EMP-027` |
| Manifest → Voyage | 1 : 1 | `REQ-110` |
| Vessel → Voyage | 1 : n | `REQ-040` |
| Invoice → B/L | **1 : n** (one invoice may cover several B/Ls) | `REQ-141` |
| Manifest → Customer | **1 : n** (a manifest can carry several customers) | `REQ-115` |
| Manifest → Shipper/Consignee | 1 : n | `REQ-116` |
| Job → Invoice | 1 : n | `REQ-134` |
| Agent → Destination | n : n | `REQ-187` |

---

## 3. Current system model (`prisma/schema.prisma`)

62 models, 25 enums. Grouped:

### 3.1 Identity & access
`User`, `RefreshToken`, `Role`, `Permission`, `RolePermission`, `UserRole`, `CompanySettings`, `Currency`

### 3.2 Master data
`Port`, `Vard`→`Yard`, `Customer`, `Shipper`, `Consignee`, `Agent`, `AgentDestination`, `Vessel`, `Voyage`, `VoyageDestination`

### 3.3 Operations
`Cargo`, `YardInventory`, `Inspection`, `LoadList`, `LoadListItem`, `ActualLoading`, `ActualLoadingItem`, `Discharge`, `DischargeItem`, `BookingRequest`

### 3.4 Documents
`Manifest`, `ManifestItem`, `BillOfLading`, `BillOfLadingRevision`, `BillOfLadingItem`, `Invoice`, `InvoiceItem`, `Proforma`, `ProformaItem`, `Quotation`, `QuotationItem`, `DeliveryOrder`, `ReleaseOrder`, `Letter`

### 3.5 Finance
`Job`, `JobCostItem`, `Voucher`, `Employee`, `SalaryRecord`

### 3.6 Platform
`NumberingSequence`, `AuditLog`, `FileAttachment`, `DocumentTemplate`, `DocumentTemplateVersion`

### 3.7 Notable enums
`CargoStatus`, `CargoType`, `InspectionStatus`, `LoadingStatus`, `WeightUnit`, `InventoryStatus`, `LoadListItemSelectionStatus`, `VesselType`, `VoyageStatus`, `LoadListStatus`, `ActualLoadingStatus`, `DischargeStatus`, `DischargeResult`, `BookingStatus`, `LoadingResult`, `ManifestStatus`, `BlStatus`, `BlType`, `FreightTerms`, `InvoiceStatus`, `ProformaStatus`, `QuotationStatus`, `EmployeeStatus`, `SalaryStatus`, `VoucherType`, `VoucherMethod`, `VoucherStatus`, `DeliveryOrderStatus`, `LetterDirection`, `LetterStatus`, `JobStatus`, `JobItemKind`

### 3.8 ⚠️ What the current schema appears to lack

| Missing | Employer requirement |
|---|---|
| **A `Ledger` / `LedgerEntry` model** | `REQ-160`–`REQ-167`. Only `Voucher` exists — vouchers are the *inputs*; there is no running ledger/account entity. **This needs verification in Phase 8** |
| **Cargo Comment** | `REQ-065`–`REQ-067` |
| **General Journal** | `REQ-166` |

> These three are flagged for verification, not asserted. Phase 8 checks whether they are modelled
> another way (e.g. `Voucher` with a journal type, or a view).

---

## 4. Legacy model (23 Eloquent models)

| Legacy model | Target equivalent | Verdict |
|---|---|---|
| `User` (level Admin/User) | `User` + `Customer` | ⚠️ **Customers were users** — the single worst legacy modelling decision |
| `Role`, `Permission`, `HasRole` | `Role`, `Permission`, `RolePermission`, `UserRole` | ✅ |
| `KeyValue` | `CompanySettings` | ✅ |
| `Port` | `Port` | ⚠️ one string instead of name/city/country |
| `Yard` | `Yard` | ✅ |
| `Loading` | `Cargo` | ⚠️ plus a legacy-only `admin_status` |
| `Doc` | (attachment) | ⚠️ ad-hoc |
| `Loadinglist` | `LoadList` | ✅ |
| `Manifest`, `Item` | `Manifest`, `ManifestItem` | ⚠️ inverted creation order |
| `Bl` | `BillOfLading` | ⚠️ no draft/final, no release |
| `Shipper`, `Consignee`, `Agent` | same | ✅ |
| `Portshipper` | `Voyage` counter | ❌ wrong keying (defect **D12**) |
| `Invoice`, `InvoiceItem`(inline) | `Invoice`, `InvoiceItem` | ⚠️ wrong arithmetic |
| `Fin` | `Voucher` / Ledger | ⚠️ exists but is not double-entry |
| `Offer`, `Quotation` | `Quotation` | ⚠️ free-text, no line items |
| `Performa`, `Performa_item` | `Proforma`, `ProformaItem` | ✅ best-modelled legacy document |

**Legacy has no equivalent of:** `Job`, `JobCostItem`, `Vessel`, `Voyage`, `DeliveryOrder`,
`ReleaseOrder`, `Letter`, `Employee`, `SalaryRecord`, `NumberingSequence`, `AuditLog`,
`FileAttachment`, `DocumentTemplate`, `Inspection` (as an entity), `ActualLoading`, `Discharge`,
`BookingRequest`, `AgentDestination`, `VoyageDestination`, `Currency`.

---

## 5. Legacy → current mapping

| Legacy | Current | Change |
|---|---|---|
| `users` (both staff and customers) | `User` + `Customer` | ✅ **Split** — the most important correction |
| `ports.title` | `Port` (name, city, country) | ✅ Split into three fields (`REQ-030`) |
| `loadings` | `Cargo` + `YardInventory` + `Inspection` | ✅ Decomposed into three first-class concepts |
| `loadings.loading_status` | `LoadingStatus` + `ActualLoading` | ✅ Actual loading is now its own record |
| `loadinglists` | `LoadList` + `LoadListItem` | ✅ |
| `manifests` / `items` | `Manifest` / `ManifestItem` | ✅ plus `ManifestStatus` |
| `bls` | `BillOfLading` + `BillOfLadingItem` + `BillOfLadingRevision` | ✅ Revisions are now first-class |
| `bls.status` (PENDING only) | `BlStatus` enum | ✅ |
| `Portshipper` voyage counter | `Voyage` + `NumberingSequence` | ✅ Fixed keying |
| `invoices` | `Invoice` + `InvoiceItem` | ⚠️ Arithmetic must not be ported |
| `fins` | `Voucher` | ⚠️ No ledger entity — see §3.8 |
| `offers` | *(dropped)* | Offer and Quotation were merged |
| `quotations` (free text) | `Quotation` + `QuotationItem` | ✅ Now line-item based |
| `performas` / `performa_items` | `Proforma` + `ProformaItem` | ✅ |
| `key_values` | `CompanySettings` | ✅ Typed columns instead of a KV bag |
| *(none)* | `DocumentTemplate` + `DocumentTemplateVersion` | ✅ New |
| *(none)* | `NumberingSequence` | ✅ New — replaces random generators |
| *(none)* | `AuditLog`, `FileAttachment` | ✅ New |
| *(none)* | `Job`, `JobCostItem`, `Employee`, `SalaryRecord` | ✅ New |
| *(none)* | `DeliveryOrder`, `ReleaseOrder`, `Letter` | ✅ New |
| *(none)* | `AgentDestination`, `VoyageDestination` | ✅ New — enables agent scoping |
| *(none)* | `Discharge`, `DischargeItem`, `BookingRequest` | ✅ New — Phase 10+ scope |

---

## 6. Open modelling questions

| # | Question | Blocks |
|---|---|---|
| E1 | Is there a ledger entity, or is the ledger derived from vouchers? | Finance module |
| E2 | Is cargo comment modelled? (`REQ-065`–`REQ-067`) | Cargo module |
| E3 | Is there a general journal? (`REQ-166`) | Finance module |
| E4 | One cargo per B/L, or several cargos per B/L? | B/L module |
| E5 | Does `Job` map 1:1 to `Voyage`, or is it independent? | Job costing |
| E6 | How is the two-business split (freight vs resale, §2 of the consolidated model) represented? | Sales documents |

See [`../07-traceability/`](../07-traceability/) once written, and Phase 8 in
[`../05-current-project/`](../05-current-project/).

---

## duna-analysis/04-business-analysis/prior-analysis-review.md

# Review of Prior AI Analyses

> Phase 6. There are **two families** of prior analysis in this repository:
>
> | Family | Location | Language | Size |
> |---|---|---|---|
> | **Discovery analyses** | `docs/duna-analysis/existing-analysis/` (3 files) | Persian | 1,967 lines |
> | **Legacy code analyses** | `docs/duna-analysis/legacy-source/docs-legacy/` (5 files) | English | — |
> | **Current-project docs** | `docs/` (13 files, incl. `decisions.md` 86 KB, `progress.md` 91 KB) | English | — |
>
> **Standing rule for future agents:** every prior analysis is a *hypothesis to be verified against
> primary evidence* (transcripts → PDFs → legacy code → current code), never a fact. This file
> records where each one holds up and where it does not.

---

## 1. `existing-analysis/duna_business_analysis.md` (513 lines, Persian)

**What it is:** a deep business & product analysis — domain concepts, proposed operational workflow,
accounting model, document architecture, agent portal, status architecture, gaps, product direction.

### 1.1 Findings that are CONFIRMED by primary evidence

| Claim (translated) | Verified against | Verdict |
|---|---|---|
| Duna is a shipping / maritime logistics company handling heavy cargo, machinery, equipment | Transcripts + all 7 PDFs | ✅ Confirmed |
| Four interlocking flows: Operational, Commercial, Document, Control | Transcripts | ✅ A sound framing; adopted in [`consolidated-business-model.md`](consolidated-business-model.md) |
| Two business streams: (A) export/outbound, (B) inbound / discharge-at-own-port | Transcripts | ✅ Confirmed — the second stream is the "flipping" business; see [`../01-employer-statements/employer-requirements-analysis.md`](../01-employer-statements/employer-requirements-analysis.md) §2 |
| Customer, Shipper, Consignee, Agent must **not** be merged | Transcripts + B/L + manifest | ✅ Confirmed |
| Cargo is the operational unit with a full lifecycle trail | Transcripts | ✅ Confirmed |
| B/L lifecycle `Prepare → Draft → Send → Revision → Approved → Final`, then `Released / Unreleased` at destination | Transcripts | ✅ Confirmed (`REQ-104`, `REQ-180`) |
| **Draft vs Released are two different axes and must not be collapsed into one status** | Transcripts | ✅ Confirmed; the legacy system's single `status`/`bl_status` pair is exactly the mistake warned against |
| Manifest should be built FROM B/Ls; totals aggregated; snapshot of membership at finalisation | Transcripts (`EMP-024`–`EMP-027`) | ✅ Confirmed — and this is the **opposite** of the legacy flow (see [`../03-legacy-laravel-system/workflows.md`](../03-legacy-laravel-system/workflows.md) §2) |
| `Customer → Invoice → Debit`; `Customer → Payment/Receipt → Credit`; `Balance = Debit − Credit` | SOA PDF + legacy `CalculateDebitCredit()` | ✅ Confirmed by two independent sources |
| Job costing needs Transport, Customs, Repair, Crane, Vessel, Port Handling, Port Use, Lashing, Storage | Transcripts (`REQ-191`) | ✅ Close match |
| Voyage P&L = Σ invoice revenue − Σ voyage costs | Transcripts (`REQ-192`) + legacy `manifest/report.blade.php` | ✅ Confirmed |
| General Journal needed for amounts outside the Invoice/Shipment path, separate from but linkable to Customer Ledger | Transcripts (`REQ-166`, `REQ-167`) | ✅ Confirmed |
| Success test: "for any cargo, can we answer where it came from, where it is, which vessel/voyage, which B/L and manifest, what costs, what invoices, how much paid, released or not, and the financial outcome?" | — | ✅ An excellent acceptance test; reproduced in [`consolidated-business-model.md`](consolidated-business-model.md) |

### 1.2 Claims that are WRONG or UNVERIFIED

| # | Claim | Assessment |
|---|---|---|
| A1 | "Legacy B/L: `PENDING → RELEASED`" | ❌ **Wrong.** `RELEASED` is defined as a constant in `Bl.php` but is **never written anywhere**. B/L `status` is always `PENDING` (defect **D1**). See [`../03-legacy-laravel-system/system-overview.md`](../03-legacy-laravel-system/system-overview.md) §7 |
| A2 | "Legacy workflow `Loading → Admin Review → Approved → BL → Manifest → Invoice → Fin`" | ⚠️ Half right on order, but it **omits** that B/Ls are created *against* a manifest in code. The chain in code is `Loading → Admin Review → Manifest → BL → Invoice → Fin` |
| A3 | "Legacy `in_status: PENDING / DONE / LOCAL ED / NO NEED`" | ⚠️ Names are right in substance; the actual column is `inspection_status` and the values are `PENDING`, `DONE`, `LOCAL`, `NONEED` ("LOCAL ED" is a transcription artefact) |
| A4 | "Legacy `status: LOADED / IN_YARD`" | ✅ Correct (`loading_status`) |
| A5 | "Legacy has PDF-ready print/preview pages" | ⚠️ Misleading. Pages are **print-ready in the browser**; there is **no PDF engine** in the project (no DOMPDF/Snappy). The "PDF" in the employer's requirement (`REQ-122`) is a genuine new capability |
| A6 | "Legacy invoice: `PAID / UNPAID`" | ✅ Correct |
| A7 | Job / Shipment treated as if it already exists as a concept | ❌ There is **no Job entity at all** in the legacy system. It is a proposed concept, correctly identified as a gap |

### 1.3 What this document gets right in method

Its §15 "What Should NOT Be Done Yet" is the single most valuable part and should be treated as
guidance:

> - Do not finalise the schema.
> - Do not copy the legacy models.
> - Do not merge Customer with User or Shipper.
> - Do not make Invoice depend only on B/L.
> - Do not treat Release as merely a status on B/L.
> - Do not treat Voyage as merely a string on Vessel.
> - Do not treat Ledger as merely a reporting table.
> - Do not design Comment without an audit trail.

Every one of these eight rules is consistent with the employer's statements and with the legacy code
evidence.

---

## 2. `existing-analysis/duna_client_discovery_questions_v2.md` (885 lines, Persian)

**What it is:** a 160-question discovery questionnaire (Q01–Q160) across 28 sections, plus 5 worked
example answers.

### 2.1 Assessment

This is a **well-constructed** questionnaire: one topic per question, plain language, examples,
invites voice answers, and asks for sample documents. It was written by an earlier AI analysis and
**there is no evidence the employer ever answered it.**

- The 160 questions map cleanly onto the employer's own statements.
- The Q-numbering (Q01–Q160) is adopted by this knowledge base as the canonical open-question ID
  space — see [`../07-traceability/source-inventory.md`](../07-traceability/source-inventory.md) and
  the coverage table in [`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md).
- ⚠️ The Q-numbers do **not** correspond to the `REQ-` numbers in this knowledge base. They are a
  separate ID space. A crosswalk is provided in [`../07-traceability/`](../07-traceability/).

### 2.2 Coverage

| Q range | Topic | Answered by employer statements? | See |
|---|---|---|---|
| Q01–Q04 | How a job starts, job types, Cargo vs Shipment vs Job vs B/L, job end | Partial | `employer-requirements-analysis.md` §2 |
| Q05–Q10 | Customer definition, job types per customer, static vs job data, contacts, status, credit | Partial | `REQ-004`–`REQ-020` |
| Q11–Q16 | Cargo types, primary identifier, multiple machines, package/Nagle, weight & size, technical data | **Partial — "Nagle" is unresolved** | `open-questions.md` Q-CARGO-01 |
| Q17–Q21 | Cargo route, ports & yards, entry vs current yard, internal transfer, key dates | Partial | `REQ-060`–`REQ-070` |
| Q22–Q26 | Cargo intake documents, document status, validity, multiple files, versioning | Weak — employer did not describe cargo document status in detail | `open-questions.md` |
| Q27–Q31 | Inspection process, result, evidence, multiple inspections, effect on loading | **Good** | `REQ-075`–`REQ-082` |
| Q32–Q38 | Load list: creator, per-vessel, stages, removal, partial loading, operator data, proof of loading | **Good** | `REQ-083`–`REQ-093` |
| Q39–Q43 | Vessel structure, tug & barge, voyage number, voyage vs destination, voyage change | **Good** | `REQ-037`–`REQ-042` |
| Q44–Q51 | B/L: timing, multiple cargo, draft/final, post-final amendment, number, originals, surrender/release, freight | **Good** | `REQ-100`–`REQ-108` |
| Q52–Q58 | Manifest: creation condition, member B/Ls, amended manifest, number, totals, ownership, forwarder/co-loading | **Good** | `REQ-110`–`REQ-116` |
| Q59–Q63 | Customer vs Shipper vs Consignee vs Agent, changes, notify party, agent, agent change | **Good** | `REQ-044`–`REQ-055` |
| Q64–Q72 | Invoice types, B/L vs manifest basis, invoice↔job cardinality, line items, VAT, credit terms, amended invoice | **Good** | `REQ-140`–`REQ-150` |
| Q73–Q79 | Job definition, scope, cost types, direct vs indirect, cost without job, timing, correction | **Good** | `REQ-130`–`REQ-135` |
| Q80–Q87 | Ledger, debit/credit, general journal, office expenses, bank/cash, multi-currency, balance, statement | **Good** | `REQ-160`–`REQ-167` |
| Q88–Q96 | Payment types, payment voucher, receipt voucher, payment to a person, ID card, signature, partial, advance, overpayment | **Good** | `REQ-165`–`REQ-172` |
| Q97–Q101 | Release conditions, full/partial/credit, approval, multiple releases, release history | **Good** | `REQ-180`–`REQ-184` |
| Q102–Q106 | Agent portal: visible data, access limits, document access, operations, multiple agents per port | **Good** | `REQ-187`, `REQ-188` |
| Q107–Q110 | Delivery order: use cases, issue condition, DO vs release, delivery confirmation | **Good** | `REQ-185`, `REQ-186` |
| Q111–Q115 | Proforma, relation to customer/job, validity, quotation, amended versions | **Good** | `REQ-190`+; [`../02-business-documents/quotations.md`](../02-business-documents/quotations.md) |
| Q116–Q123 | Reporting: daily, operations, vessel/voyage, P&L, revenue, voyage cost, cost allocation, tax | **Good** | `REQ-190`–`REQ-194` |
| Q124–Q128 | Alerts, payment delay, cargo left in yard, pending inspection, other alerts | **Good** | `REQ-154`, `REQ-184` |
| Q129–Q133 | Company archive, link to case, search, versioning, deletion | Weak | EMP-713 |
| Q134–Q137 | Letters, basis, numbering, signature & stamp | **No employer input found** | — |
| Q138–Q141 | Roles, per-role access, activity log, change history | Weak | `REQ-001`–`REQ-003` |
| Q142–Q147 | Outputs, templates, PDF & Excel, print with/without stamp, signature, multiple copies | **Good** | `REQ-120`–`REQ-124` |
| Q148–Q152 | Salary | **No employer input found** | EMP-716, EMP-717 |
| Q153–Q160 | Cancellation, re-open, return, destination change, vessel change, partial loading, lost/damaged, unstated cases | Weak | — |

**Net:** the questionnaire is a good artefact, but it is **unanswered**. Its main residual value is
as a checklist of what the employer has *not* told us.

---

## 3. `existing-analysis/duna_source_pack.md` (569 lines, Persian)

**What it is:** a consolidated source pack — source index, a "corrected" voice transcript grouped by
topic, real-document evidence, legacy module inventory, legacy gaps, legacy workflow, and a list of
20 "items to verify".

### 3.1 Confirmed

| Claim | Verdict |
|---|---|
| Document evidence for B/L, Manifest, Receipt Voucher, SOA, Tax Invoice, Proforma, Quotation | ✅ Matches the 7 PDFs analysed in [`../02-business-documents/`](../02-business-documents/) |
| Manifest `DSMAN/KHO-26-006`, vessel `BARGE MEHDI 11`, tug `LAYAN GULF`, voyage `02/26`, 45 rows, totals `32 UNITS AND 79 PKGS`, `991,886 KGS` | ✅ Matches |
| Receipt voucher no. 477, `RUKN ALHMREYA TRANSPORT L.L.C`, AED 1,600, refs `1517`, `1526`, `Advance 477` | ✅ Matches |
| SOA period `1-Jul-26 to 7-Sep-26`, closing balance `683.50 Dr` | ✅ Matches |
| Tax invoice `DSINV/26-172`, `MR. SHAHOKH SHAHVARAEI`, `AED 27,370.00`, VAT 0 | ✅ Matches |
| Proforma `DSPRO/26-001`, `MR. RAMIN AHMADABADI`, AED 690,000, FOB Bandar Abbas → Maku Free Zone | ✅ Matches |
| Quotation `DSQUO/25-017`, `MR. SHADMAN MEABADI`, Volvo finisher, AED 7,700 | ✅ Matches |
| Legacy gaps: Vessel as a proper entity, Delivery Order, Release Order, Salary, Letters, customer CRM, clean party separation, API layer | ✅ Matches our independent code analysis |

### 3.2 Wrong or imprecise

| # | Claim | Correction |
|---|---|---|
| S1 | "Ledger as an independent accounting entity" is a legacy gap | ⚠️ Imprecise. A `Fin` model and `admin/fins/*` screens **do exist**. What is missing is a *proper double-entry* ledger (no journal entries, no accounts, no general journal). Reworded: the gap is **Ledger quality**, not Ledger existence |
| S2 | "Legacy manifest number is generated by destination/port sequence" | ⚠️ Partly right in intent, but the implementation has a **random** component: `generateManifestNumber($port)` builds `KHO/{rand}{dd}{mm}{yyyy}` |
| S3 | "Voyage generated by Shipper + destination" | ✅ Correct — and this is precisely defect **D12**: it should be keyed on vessel + destination |
| S4 | "Invoice code sequential" | ❌ **Wrong.** `getinvoiceCode()` returns `DSAED/{rand6}` — random, not sequential |
| S5 | "Legacy B/L: `PENDING → RELEASED`" | ❌ Same error as A1 — `RELEASED` is never written |
| S6 | "PDF-ready print/preview pages" | ⚠️ Same as A5 — browser print only |
| S7 | "45 numbered rows are represented in the source text" | ⚠️ Should be verified against the rendered manifest; the row count in our own catalogue is recorded separately in [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md) |
| S8 | Vessel on the tax invoice given as `DAHAR 10`, manifest `DSKHS-26-005`, reference `BL#: KHS/26-108` | ✅ Consistent with the specimen — note this is a **different** voyage/manifest from `DSMAN/KHO-26-006`, so there are at least two manifest series in the evidence |

### 3.3 Its "20 items to verify" — disposition

| # | Item | Status in this knowledge base |
|---|---|---|
| 1 | Exact customer code format; `CUST 3.1` vs `CUST 3SF-2` | **Unresolved.** Recorded in [`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md) |
| 2 | Exact voyage-number logic | **Partially resolved.** Employer: per vessel + destination; legacy: port+shipper (wrong); real docs: `02/26`. See [`../03-legacy-laravel-system/calculations.md`](../03-legacy-laravel-system/calculations.md) §1 |
| 3 | Exact B/L number format per port | **Unresolved — three-way contradiction** (legacy `KHS/20261104` vs real `KHS/26-110` vs employer `KHS/26-2/2026`). See [`contradictions-register.md`](contradictions-register.md) |
| 4 | Exact manifest number format | **Contradiction** (legacy `KHO/4829132026` vs real `DSMAN/KHO-26-006` vs `DSKHS-26-005`) |
| 5 | Difference between Voyage and Manifest number | **Resolved.** Voyage = per vessel+destination, `nn/yy`; Manifest = per voyage, its own series |
| 6 | Document status & cargo intake document types | Weak evidence |
| 7 | Meaning of "Nagle / Package" | **Unresolved** — translation trap; see [`../01-employer-statements/terminology-glossary.md`](../01-employer-statements/terminology-glossary.md) |
| 8 | ETOZ / ETDZ term | **Unresolved** |
| 9 | What the Customer Ledger consists of vs the General Ledger | Partially resolved (`REQ-160`–`REQ-167`) |
| 10 | Is an invoice always linked to one B/L, or can it span several? | **Resolved.** An invoice **can** span several B/Ls (`REQ-141`); the legacy link is optional |
| 11 | Can one manifest have several customers / shippers / consignees? | **Resolved — yes** (`REQ-115`, `REQ-116`) |
| 12 | Who approves, and under what conditions? | **Not the employer's own flow.** `admin_status` is a legacy-only gate |
| 13 | Does a load list have version history, or is it just an edited record? | **Resolved.** Only the current version matters (`REQ-094`) |
| 14 | Who can edit/delete a comment; is an audit trail needed? | **Resolved.** Author can edit/delete; accounting must see it (`REQ-065`–`REQ-067`) |
| 15 | Exact release rules for full / partial / credit | Partially resolved (`REQ-180`–`REQ-183`) |
| 16 | Agent access scope; download/print of documents | Partially resolved (`REQ-187`, `REQ-188`) |
| 17 | Delivery order details and relation to cargo/B/L/consignee | Partially resolved (`REQ-185`, `REQ-186`) |
| 18 | VAT: which invoices, which rates, per line or per invoice? | **Resolved.** Per line, with a percentage field; the real specimen has VAT 0 (`REQ-144`) |
| 19 | Vessel/voyage cost structure and the level at which each cost is booked | Partially resolved (`REQ-191`) |
| 20 | Company archive and retention policy | Weak evidence |

---

## 4. `legacy-source/docs-legacy/` (5 files, English)

| File | Value | Verdict |
|---|---|---|
| `00-OVERVIEW.md` | Module inventory with ✅/❌ presence marks | ⚠️ **Unreliable on presence.** See §4.1 |
| `01-DOMAIN-MODEL.md` | Domain model with proposed schemas | ⚠️ Mixes *what exists* with *what should exist*. The "Missing" entities tables (lines ~412–417) are **proposals**, not findings |
| `02-WORKFLOWS.md` | Workflow narrative | ⚠️ Adequate but misses that B/L creation is nested under the manifest controller |
| `03-UI-PAGES.md` | Page-by-page inventory with Blade paths | ✅ **The most useful of the five.** Paths verified correct |
| `04-DATA-DICTIONARY.md` | Field-level dictionary | ✅ Useful; superseded in depth by [`../03-legacy-laravel-system/data-dictionary.md`](../03-legacy-laravel-system/data-dictionary.md) |

### 4.1 The `00-OVERVIEW.md` presence error — verified

`00-OVERVIEW.md` line 34 states:

```
| **Accounting → Ledger** | Not found as separate model | ❌ Missing |
```

**This is false.** Verified against the code:

- `app/Models/Fin.php` — a separate Eloquent model (29 lines)
- `app/Http/Controllers/Admin/FinController.php` — 215 lines, 11 methods
- `resources/views/admin/fins/` — 4 views (`ledger`, `preview`, `showledger`, `release`)

**And the same document set contradicts itself:** `03-UI-PAGES.md` lines 61–62 list
`admin/fins/ledger` and `admin/fins/showledger` as existing pages.

Corrected verdicts:

| Entity | `00-OVERVIEW.md` says | Reality |
|---|---|---|
| Ledger | ❌ Missing | ⚠️ **Exists** (`Fin` model + 4 screens) but is **not a proper double-entry ledger** — no accounts, no journal entries, no general journal |
| Salary | ❌ Missing | ✅ Correct — genuinely absent |
| Financial Reports | ❌ Missing | ⚠️ Partly wrong — `admin/manifest/report.blade.php` (voyage P&L) exists |
| Letters | ❌ Missing | ✅ Correct — genuinely absent |

---

## 5. `docs/` — the current project's own documentation

| File | Value for this knowledge base |
|---|---|
| `docs/business-requirements.md` (3.9 KB) | ⚠️ **Thin** — 3.9 KB against ~200 employer requirements. Superseded by `01-employer-statements/requirements-catalog.md` (26.9 KB) |
| `docs/architecture.md` | ✅ Authoritative for the **current** system |
| `docs/database-schema.md` | ✅ Authoritative for the **current** schema |
| `docs/permissions.md` | ✅ 105 permissions across 12 resources |
| `docs/workflows.md` | ✅ Current-system workflows |
| `docs/api.md` | ✅ Current API surface |
| `docs/decisions.md` (86 KB) | ✅ **Highest-value current-project doc** — ADRs |
| `docs/progress.md` (91 KB) | ✅ Phase-by-phase build log |
| `docs/design-system.md` | ✅ UI conventions |
| `docs/plan.md` | ⚠️ Cites `/home/duna/dunaData/` as the highest authority — that path **does not exist in this workspace** (gap **SRC-01**) |
| `docs/CLAUDE.md`, `README.md` | ✅ Repo conventions |

**Note:** `docs/` describes the *current* system and is analysed in Phase 8 —
[`../05-current-project/`](../05-current-project/).

---

## 6. Consolidated verdict

| Prior analysis | Trust level | How to use it |
|---|---|---|
| `duna_business_analysis.md` | **Medium-high** on business framing; **low** on legacy specifics | Use §12 (product direction), §15 (what not to do), §16 (definition of success) as guidance. Do **not** trust its legacy status claims |
| `duna_client_discovery_questions_v2.md` | **High** as a checklist; **unanswered** | Use Q01–Q160 as the canonical open-question ID space and as a coverage checklist |
| `duna_source_pack.md` | **High** on document evidence; **low** on legacy implementation details | Use its document transcriptions as a cross-check on Phase 4; do **not** trust its claims about legacy number generation |
| `docs-legacy/03-UI-PAGES.md`, `04-DATA-DICTIONARY.md` | **High** | Use as a cross-check on Phase 5 |
| `docs-legacy/00-OVERVIEW.md`, `01-DOMAIN-MODEL.md` | **Low** on presence claims | Verify every ✅/❌ against code before relying on it |
| `docs/decisions.md`, `docs/progress.md` | **High** for the current system | Primary source for Phase 8 |

### 6.1 The three recurring errors in prior analyses

1. **Assuming the legacy system implements what it merely declares.** `RELEASED` is a constant, not a
   behaviour. `PDF-ready` means "prints from the browser". `Sequential` invoice codes are random.
2. **Reporting "missing" for "not modelled the way I would model it."** Ledger is the clearest case.
3. **Stating the employer's desired flow as if it were the legacy flow.** The manifest-before-B/L vs
   B/L-before-manifest inversion is the clearest case.

> **Rule for future agents:** when a prior analysis says a legacy behaviour *exists*, look for the
> line of code that performs it. When it says a behaviour is *missing*, look for the screen that
> would have hosted it. Both directions have been wrong in this repository.

---

## 7. Where the prior analyses left gaps that this knowledge base fills

| Gap | Filled by |
|---|---|
| No verbatim, sequence-preserving English record of the employer's statements | [`../01-employer-statements/employer-original-statements.en.md`](../01-employer-statements/employer-original-statements.en.md) (113 KB) |
| No REQ-ID traceability from statement → requirement → evidence | [`../01-employer-statements/requirements-catalog.md`](../01-employer-statements/requirements-catalog.md), [`../07-traceability/`](../07-traceability/) |
| No line-by-line verification of legacy behaviour against code | [`../03-legacy-laravel-system/`](../03-legacy-laravel-system/) (11 files) |
| No defect register for the legacy system | `system-overview.md` §7, D1–D14 |
| No cross-document synthesis of the 7 PDFs | [`../02-business-documents/document-analysis.md`](../02-business-documents/document-analysis.md) |
| No explicit contradiction register | [`contradictions-register.md`](contradictions-register.md) |
| No comparison of legacy vs current | [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md) |

---

## duna-analysis/existing-analysis/duna_business_analysis.md

# Duna Shipping Dashboard — Deep Business & Product Analysis

> هدف این سند تبدیل صحبت‌های کارفرما + اسناد واقعی + شواهد Legacy به یک مدل روشن از کسب‌وکار است. این سند **طراحی فنی یا Schema نهایی** نیست؛ تصمیم‌های فنی باید بعد از کامل شدن Discovery و تأیید قواعد کسب‌وکار انجام شوند.

---

# 1. Executive Summary

Duna در اصل یک شرکت Shipping / Maritime Logistics است که کالاهای عمدتاً سنگین، ماشین‌آلات، تجهیزات و Cargo را از بندر مبدأ تحویل می‌گیرد، در Yard نگهداری و آماده‌سازی می‌کند، پس از اسناد و Inspection در Loading List قرار می‌دهد، با Vessel/Voyage مشخص بارگیری می‌کند، B/L و Manifest صادر می‌کند، سپس هزینه‌ها و درآمدهای مرتبط را در Accounting مدیریت می‌کند و در مقصد با Agent، Release Order و گاهی Delivery Order فرآیند تحویل را کنترل می‌کند.

مرکز واقعی سیستم فقط «بارگیری» نیست. سیستم باید چهار جریان به‌هم‌پیوسته را کنترل کند:

1. **Operational Flow** — Cargo → Yard → Inspection → Loading → Vessel → B/L → Manifest → Destination
2. **Commercial Flow** — Customer → Shipment/Job → Invoice → Receivable → Payment/Balance
3. **Document Flow** — Source Documents → B/L / Manifest / Invoice / Release / Delivery / Vouchers → Archive
4. **Control Flow** — Roles → Approvals → Agent access → Statuses → Audit/History → Reports

نقطه کلیدی مدل جدید، جدا نگه داشتن مفاهیم زیر است:

- Customer: طرف تجاری/داخلی که شرکت با او رابطه دارد و معمولاً Invoice برای او صادر می‌شود.
- Shipper: طرف فرستنده/صاحب بار در سند حمل.
- Consignee: گیرنده مقصد در سند حمل.
- Agent: نماینده مقصد یا Port.
- Cargo: واحد عملیاتی/کالایی که تحویل گرفته شده.
- Shipment/Job: پرونده عملیاتی/تجاری یک کار که ممکن است چند هفته یا ماه طول بکشد.
- B/L: سند حمل برای محموله/کالا.
- Manifest: تجمیع B/Lهای یک Vessel/Voyage.
- Invoice: طلب مالی از Customer یا سند تجاری مستقل.
- Ledger: تاریخچه مالی و مانده حساب.
- Release Order: مجوز آزادسازی اسناد/کالا پس از احراز شرایط پرداخت.
- Delivery Order: سند تحویل کالا در جریان‌های ورودی/تخلیه.

---

# 2. Business Model Inferred from the Sources

## 2.1 دو جریان اصلی کسب‌وکار

### A. Export / Outbound-like Maritime Flow

`Customer/Cargo → Origin Port → Yard → Inspection → Loading List → Vessel/Voyage → B/L → Manifest → Invoice → Payment → Release → Destination Agent`

### B. Inbound / Discharge-at-own-port Flow

`Cargo Arrival → Port/Yard → Documentation/Inspection → Delivery Order → Customer/Consignee Release → Delivery`

در حالت دوم باید مشخص شود دقیقاً چه تفاوتی با جریان اول دارد و آیا در همان Inventory model قرار می‌گیرد یا Workflow جدا دارد.

---

# 3. Core Domain Concepts

## 3.1 Customer

Customer یک موجودیت داخلی و تجاری است و نباید با Shipper/Consignee ادغام شود.

Customer باید یک «360-degree profile» داشته باشد:

- مشخصات تماس
- Cargoها و Shipmentها
- Job Numberها
- Invoiceها
- Payment/Receiptها
- Debit/Credit
- Balance
- Release/Delivery history
- اسناد/Commentهای مرتبط
- تاریخچه فعالیت

این Profile احتمالاً یکی از مهم‌ترین صفحات مدیریتی سیستم جدید خواهد بود.

## 3.2 Cargo

Cargo واحد اصلی عملیات است.

یک Cargo حداقل باید بتواند به Customer، Shipper، Consignee، Port، Yard، Destination، Shipment/Job و بعداً Loading/B/L/Manifest متصل شود.

از منظر کسب‌وکار، Cargo از لحظه تحویل تا تحویل نهایی یک «ردپای کامل» دارد.

## 3.3 Shipment / Job

Job از Cargo مهم‌تر یا وسیع‌تر است؛ چون هزینه‌های چندمرحله‌ای را در طول زمان جمع می‌کند.

احتمالاً باید یک ساختار Parent/Case برای کار داشته باشیم که چند Cargo، چند هزینه و چند سند را پوشش دهد.

این مورد یکی از مهم‌ترین موضوعات Discovery است.

## 3.4 Vessel / Voyage

Vessel دارایی/وسیله حمل است؛ Voyage رویداد یا سفر مشخص آن Vessel برای یک مقصد/مسیر مشخص است.

این دو نباید یکی باشند.

## 3.5 Manifest

Manifest واحد تجمیع سفر است و به یک Vessel/Voyage و مسیر متصل است.

هر Manifest چند B/L می‌تواند داشته باشد.

## 3.6 B/L

B/L سند حمل است و باید Lifecycle داشته باشد:

`Draft → Review → Approved/Final → Released` 

جزئیات دقیق Release باید جداگانه تعریف شود.

---

# 4. Operational Workflow پیشنهادی

## Stage 1 — Cargo Intake

کاربر Cargo را ثبت می‌کند:

- Customer
- Shipper / Consignee
- Description
- Chassis / Serial
- Units / Packages
- Weight
- Port of Loading
- Destination
- Yard
- Arrival Date
- Documents
- Comment

### Business Rule
با انتخاب Port، فقط Yardهای مرتبط قابل انتخاب باشند.

---

## Stage 2 — Document & Inspection

- اسناد بررسی می‌شوند.
- Inspection Book می‌شود.
- Inspection Status از Pending به Done می‌رود.
- فقط Cargoهای واجد شرایط اجازه ورود به Loading List دارند.

### Business Rule
`Inspection = Done` یک prerequisite برای Loading List است.

---

## Stage 3 — Vessel Assignment

مدیریت بر اساس Destination و Inventory تصمیم می‌گیرد چه Cargoهایی روی چه Vessel/Voyage قرار بگیرند.

Dashboard باید امکان دیدن Inventory بر اساس:
- Port
- Yard
- Destination
- Customer
- Inspection Status
- Age / Days in Port

داشته باشد.

---

## Stage 4 — Loading List

Loading List مجموعه‌ای از Cargoهای انتخاب‌شده برای یک Vessel/Voyage است.

باید:
- Create شود
- Edit شود
- Cargo اضافه/حذف شود
- Print/PDF شود
- Finalize شود
- وضعیت بارگیری هر مورد را ثبت کند

### وضعیت پیشنهادی کسب‌وکاری
`Draft → In Progress → Partially Loaded → Completed → Finalized`

و در سطح هر Cargo:
`Selected → Loaded / Not Loaded → Returned to Yard`

این وضعیت‌ها نیاز به تأیید کارفرما دارند.

---

# 5. B/L and Manifest Workflow

## B/L

B/L از Loading/Cargoهای نهایی‌شده ساخته می‌شود.

فرایند:

`Prepare → Draft → Send to Customer → Revision (if needed) → Approved → Final`

و سپس در مقصد:

`Released / Unreleased`

### نکته
Draft و Released دو مفهوم متفاوت‌اند:
- Draft/Final = وضعیت تولید سند
- Released/Unreleased = وضعیت آزادسازی سند/کالا

در طراحی جدید نباید این دو در یک Status ساده ادغام شوند.

## Manifest

Manifest باید از B/Lهای مرتبط با Vessel/Voyage ساخته شود.

Totalها از B/Lها Aggregate می‌شوند.

همچنین باید به‌صورت Snapshot نگه داشته شود که در زمان Finalization چه B/Lهایی داخل Manifest بوده‌اند.

---

# 6. Accounting Model

Accounting بزرگ‌ترین Gap Legacy است و نباید با مدل Fin قدیمی حل شود.

## 6.1 Commercial Accounting

`Customer → Invoice → Debit`

`Customer → Payment/Receipt → Credit`

`Debit - Credit = Balance`

## 6.2 Job Costing

`Job → Cost Entries`

هزینه‌ها می‌توانند:
- Transport
- Customs
- Repair
- Crane
- Vessel
- Port Handling
- Port Use
- Lashing
- Storage
- سایر هزینه‌ها

باشند.

## 6.3 Voyage Profitability

`Voyage Revenue = Sum of relevant Invoice revenue`

`Voyage Costs = Sum of relevant Voyage-linked expenses`

`Voyage P&L = Revenue - Costs`

ولی باید مشخص شود کدام هزینه‌ها مستقیم، غیرمستقیم و مشترک هستند.

## 6.4 General Journal

برای مبالغی که در مسیر استاندارد Invoice/Shipment نیستند، Journal Entry لازم است.

این مورد احتمالاً باید از Customer Ledger جدا ولی به آن قابل اتصال باشد.

---

# 7. Document Architecture

اسناد واقعی نشان می‌دهند که سیستم باید Template-driven باشد، اما Template فقط «تصویر» نیست؛ باید Placeholderهای دیتا داشته باشد.

هر Template باید قابلیت تعیین موارد زیر را داشته باشد:

- Header
- Footer
- Table Columns
- Logo
- Company Info
- Dynamic Fields
- Numbering
- Stamp
- Signature
- Watermark
- Print version
- PDF version

برای بعضی اسناد، PDF و Print نباید خروجی یکسان داشته باشند؛ Print ممکن است Stamp دیجیتال را نداشته باشد و مهر زنده بخورد.

---

# 8. Agent Portal

Agent یک User عادی نیست.

Agent به یک Destination/Port محدود است.

مثلاً:

`Agent Khoramshahr → Khoramshahr documents only`

Agent باید بتواند وضعیت:
- B/L
- Release Order
- شاید Manifest
- شاید Delivery Order

را ببیند.

باید مشخص شود آیا Agent اجازه Download، Print، Upload Document یا ثبت Comment هم دارد.

---

# 9. Search / Filtering / Management Dashboard

مدیریت برای تصمیم‌گیری باید بتواند سریع پاسخ دهد:

- الان چند Cargo در هر Port داریم؟
- چند Cargo در هر Yard داریم؟
- چند Cargo برای هر Destination داریم؟
- چند مورد Inspection Done/Pending است؟
- چند مورد آماده Loading هستند؟
- چند مورد Loaded شده؟
- چند مورد در Yard مانده‌اند؟
- چند روز در Port مانده‌اند؟
- کدام Vessel/Voyage چه Cargoهایی دارد؟
- کدام B/Lها Draft هستند؟
- کدام Invoiceها Unpaid/Partial هستند؟
- کدام Releaseها صادر شده ولی پرداخت کامل نشده‌اند؟
- سود/زیان هر Voyage چیست؟

این‌ها باید ورودی اصلی Dashboard Management باشند.

---

# 10. Status Architecture

یکی از مهم‌ترین اصلاحات نسبت به Legacy، تفکیک Statusهاست.

به‌جای یک Status واحد، احتمالاً چند محور لازم است:

### Cargo Operational Status
`Received → In Yard → Ready for Loading → Selected → Loaded → Delivered`

### Inspection Status
`Pending → Booked → Done → Failed/Need Reinspection`

### Document Status
`Pending → Submitted → Verified → Missing/Rejected`

### B/L Document Status
`Draft → Review → Approved → Final`

### Payment Status
`Unpaid → Partial → Paid`

### Release Status
`Not Released → Released`

### Loading List Status
`Draft → In Progress → Finalized`

همه این‌ها باید با تأیید کارفرما نهایی شوند.

---

# 11. Major Gaps / Unanswered Business Questions

1. Customer دقیقاً چیست و Unit اصلی قرارداد با Customer چیست؟ Cargo، Shipment یا Job؟
2. یک Customer می‌تواند چند Shipment و چند Job داشته باشد؟
3. یک Job می‌تواند چند Cargo و چند B/L داشته باشد؟
4. Invoice به Customer، Job، B/L یا ترکیبی از این‌ها تعلق دارد؟
5. هزینه‌ها دقیقاً در چه سطحی ثبت می‌شوند؟
6. یک Expense می‌تواند هم به Job و هم به Voyage مربوط باشد؟
7. یک Vessel می‌تواند چند Voyage همزمان/متوالی داشته باشد؟
8. Voyage بر چه مبنایی شماره می‌گیرد؟ Vessel+Destination+Year؟
9. یک Manifest دقیقاً معادل یک Voyage است؟
10. آیا یک Manifest می‌تواند چند Customer داشته باشد؟
11. آیا یک B/L می‌تواند چند Cargo داشته باشد؟
12. آیا یک Cargo می‌تواند در چند B/L قرار گیرد؟
13. Release بر اساس B/L است یا Cargo یا Invoice؟
14. Partial Payment دقیقاً چه اثری بر Release دارد؟
15. آیا Credit Customer به سقف اعتبار و تاریخ سررسید وابسته است؟
16. Delivery Order فقط برای Inbound است یا در Outbound هم استفاده می‌شود؟
17. Agent چه عملیات دیگری می‌تواند انجام دهد؟
18. Archive باید فقط File Storage باشد یا سندمحور و Searchable هم باشد؟
19. Audit Trail لازم است یا فقط آخرین وضعیت کافی است؟
20. چه کسی می‌تواند رکورد را Delete کند و آیا Hard Delete مجاز است؟

---

# 12. Recommended Product Direction

بدون ورود به تکنولوژی، منطق محصول بهتر است حول 6 بخش اصلی بماند:

1. **Overview**
2. **Operations**
3. **B/L & Manifest**
4. **Accounting**
5. **Master Data**
6. **Access Control**

ولی در زیر این 6 بخش، مدل واقعی باید بر پایه یک زنجیره واحد باشد:

`Customer → Job/Shipment → Cargo → Yard/Inspection → Loading → Vessel/Voyage → B/L → Manifest → Invoice → Payment → Release/Delivery → Ledger/Reports`

این زنجیره باید از هر نقطه قابل مشاهده باشد.

مثلاً از Customer Profile باید بتوان به Job، Cargo، B/L، Invoice و Ledger رسید.

از B/L باید بتوان به Cargo، Manifest، Customer، Invoice و Release رسید.

از Voyage باید بتوان به Cargo، B/L، Manifest، Revenue و Cost رسید.

---

# 13. High-Value Dashboard Views

## Management Overview

Cards / KPIs:
- Cargo in Yard
- Ready for Loading
- Pending Inspection
- Active Voyages
- Draft B/Ls
- Unpaid Invoices
- Partial Payments
- Released but Unpaid
- Customer Receivables
- Voyage Profitability

## Operations View

- Inventory by Port/Yard/Destination
- Days in Port
- Inspection queue
- Ready to load
- Loading progress
- Not loaded / returned to Yard

## Finance View

- Receivables aging
- Paid / Partial / Unpaid
- VAT summary
- Customer balances
- Job cost
- Voyage P&L

---

# 14. Priority of Discovery

### P0 — باید قبل از مدل‌سازی نهایی روشن شود
- Customer / Job / Cargo relationship
- Shipment definition
- B/L ↔ Cargo cardinality
- Manifest ↔ Voyage definition
- Invoice ↔ Customer / Job / B/L
- Payment / Release rule
- Cost attribution
- Statuses

### P1
- Agent permissions
- Document versions
- Template rules
- VAT rules
- Numbering rules
- Delivery Order
- Archive

### P2
- Advanced reporting
- Customer portal details
- Notifications
- Automation
- Additional dashboard KPIs

---

# 15. What Should NOT Be Done Yet

تا وقتی جواب‌های Discovery نیامده:

- Schema نهایی را قطعی نکنیم.
- Legacy modelها را Copy نکنیم.
- Customer را با User یا Shipper یکی نکنیم.
- Invoice را فقط به B/L وابسته نکنیم.
- Release را فقط یک Status روی B/L فرض نکنیم.
- Voyage را فقط یک String روی Vessel فرض نکنیم.
- Ledger را صرفاً یک جدول گزارش فرض نکنیم.
- Comment را بدون Audit Trail طراحی نکنیم.

---

# 16. Definition of Success

وقتی Discovery کامل شود، باید بتوانیم برای هر Cargo این سؤال را بدون ابهام جواب دهیم:

> «این کالا مال چه Customerی است، از کجا آمده، در کدام Port/Yard است، چه اسنادی دارد، Inspection شده یا نه، برای کدام Vessel/Voyage انتخاب شده، در کدام B/L و Manifest قرار گرفته، چه هزینه‌هایی داشته، چه Invoiceهایی برایش صادر شده، چقدر پرداخت شده، Released شده یا نه، و در نهایت چه نتیجه مالی برای Customer و Voyage ایجاد کرده است؟»

اگر سیستم بتواند این زنجیره را بدون شکستن Context دنبال کند، هسته اصلی کسب‌وکار Duna مدل شده است.

---

# 17. Recommended Next Step

گام بعدی باید یک **Business Discovery Questionnaire** باشد که فقط از کارفرما اطلاعات کسب‌وکار بگیرد؛ نه اطلاعات فنی.

هر سؤال باید:
- یک موضوع مشخص داشته باشد.
- با زبان ساده نوشته شود.
- مثال داشته باشد.
- از کارفرما بخواهد فرآیند واقعی را توضیح دهد.
- در صورت امکان نمونه سند/فایل/ویس بخواهد.

پرسشنامه باید به شکلی طراحی شود که کارفرما بتواند با Voice Answer پاسخ دهد و پاسخ‌ها بعداً قابل تبدیل به Requirement قابل اتکا باشند.

---

## duna-analysis/existing-analysis/duna_client_discovery_questions_v2.md

# پرسشنامه تکمیل اطلاعات کسب‌وکار Duna
## نسخه پالایش‌شده برای پاسخ‌گویی کارفرما

این پرسشنامه برای تکمیل اطلاعاتی است که در توضیحات قبلی، ویس‌ها، اسناد نمونه شرکت و سیستم قبلی هنوز به‌صورت کامل یا قطعی مشخص نشده‌اند.

هدف این پرسشنامه این نیست که درباره نحوه برنامه‌نویسی یا طراحی دیتابیس سؤال شود. فقط می‌خواهیم **نحوه واقعی انجام کار در شرکت** را دقیق بفهمیم تا هیچ مرحله، داده، سند یا حالت مهمی از فرآیند جا نماند.

### روش پاسخ دادن
برای هر سؤال:
- با زبان ساده و بر اساس کار واقعی شرکت پاسخ دهید.
- اگر چند حالت متفاوت وجود دارد، همه حالت‌ها را بگویید.
- اگر برای توضیح سؤال نمونه واقعی دارید، همان نمونه را بگویید.
- اگر سند، فایل Excel، PDF، WhatsApp، فرم، نامه یا نمونه واقعی مرتبط وجود دارد، نام آن را ذکر کنید یا فایلش را ارائه دهید.
- اگر چیزی در شرکت اصلاً استفاده نمی‌شود، صریحاً بنویسید «استفاده نمی‌شود».

---

# 1. ساختار کلی کسب‌وکار و شروع یک کار

### Q01 — یک کار از کجا شروع می‌شود؟
لطفاً یک نمونه واقعی را از اولین تماس یا درخواست مشتری تا پایان کار، به ترتیب توضیح دهید.

مثلاً:
درخواست مشتری → دریافت کالا → انتقال → بندر → Yard → بازرسی → بارگیری → B/L → Manifest → Invoice → Payment → Release/Delivery

آیا فرآیندهای دیگری هم دارید که در این زنجیره نیست؟

### Q02 — انواع کارهای شرکت
همه نوع خدماتی که شرکت انجام می‌دهد را مشخص کنید.
مثلاً:
- حمل دریایی
- ترخیص
- حمل زمینی
- تخلیه/بارگیری
- انبارداری/Yard
- کارهای اسنادی
- خدمات Agent
- ETO/ETOZ یا سایر خدمات

برای هر نوع خدمت، بگویید روند کلی آن چیست.

### Q03 — تفاوت بین Cargo، Shipment، Job و B/L
در صحبت‌ها این اصطلاحات استفاده شده‌اند. لطفاً با مثال واقعی توضیح دهید:
- یک Cargo دقیقاً چیست؟
- یک Shipment دقیقاً چیست؟
- یک Job دقیقاً چیست؟
- یک B/L چه چیزی را نمایندگی می‌کند؟
- آیا یک Job می‌تواند چند Cargo داشته باشد؟
- آیا یک Shipment می‌تواند چند Cargo یا چند B/L داشته باشد؟

### Q04 — چه چیزی باعث پایان یک کار می‌شود؟
برای هر نوع کار، چه زمانی از نظر شما کار «تمام‌شده» محسوب می‌شود؟

مثلاً:
- وقتی بارگیری کامل شد؟
- وقتی کشتی حرکت کرد؟
- وقتی تخلیه شد؟
- وقتی Invoice پرداخت شد؟
- وقتی Release انجام شد؟
- وقتی کالا تحویل شد؟

---

# 2. Customer و رابطه با طرف‌های مختلف

### Q05 — Customer در تمام حالات واقعی
توضیح داده شد که Customer ممکن است Shipper یا Consignee نباشد.
لطفاً 3 مثال واقعی از رابطه Customer با شرکت بدهید:
1. Customer شخص حقیقی
2. Customer شرکت
3. Customerی که نامش روی B/L نمی‌آید

### Q06 — یک Customer چند نوع کار می‌تواند داشته باشد؟
آیا یک Customer می‌تواند همزمان:
- چند Shipment
- چند Cargo
- چند Job
- چند Invoice
- چند Payment
- چند Release
- چند Delivery
داشته باشد؟

### Q07 — اطلاعات ثابت و اطلاعات کاری Customer
کدام اطلاعات Customer همیشه مربوط به خود Customer است و کدام اطلاعات فقط مربوط به هر کار/Shipment است؟

مثلاً:
Address، Contact، Credit Terms، Currency، Tax Information و غیره.

### Q08 — چند شخص در یک Customer؟
آیا برای یک شرکت مشتری، چند Contact Person دارید؟
اگر بله، هر شخص چه اطلاعاتی دارد و کدام شخص Contact اصلی است؟

### Q09 — وضعیت Customer
چه حالت‌هایی برای Customer دارید؟
مثلاً Active / Inactive / Blocked / Suspended.
چه چیزی باعث تغییر Status می‌شود؟

### Q10 — اعتبار مشتری
آیا برای Customer اعتبار مدت‌دار وجود دارد؟
مثلاً:
7 روز، 15 روز، 30 روز، 60 روز.
چه کسی تعیین می‌کند و از کجا مشخص می‌شود؟

---

# 3. Cargo و اطلاعات کالا

### Q11 — انواع Cargo
چه نوع کالاهایی ثبت می‌کنید؟
مثلاً:
- ماشین‌آلات
- خودرو
- کانتینر
- تجهیزات
- پکیج/قطعات
- بار چندبخشی

آیا اطلاعات هر نوع Cargo با دیگری فرق دارد؟

### Q12 — شناسه اصلی Cargo
در شرکت، برای پیدا کردن یک Cargo بیشتر از چه چیزی استفاده می‌کنید؟
مثلاً:
- Cargo Number
- Chassis Number
- Serial Number
- Customer
- B/L
- Job Number

### Q13 — چند دستگاه در یک Cargo
آیا یک رکورد Cargo می‌تواند شامل چند دستگاه باشد؟
مثلاً 1 دستگاه + 4 Package.
در چه شرایطی این اتفاق می‌افتد؟

### Q14 — Package / Nagle
لطفاً دقیقاً توضیح دهید «Package/Nagle» در کار شما چیست و چه تفاوتی با Unit/Device دارد.

مثلاً آیا:
1 Unit + 4 Packages
یک Cargo محسوب می‌شود؟

### Q15 — وزن و اندازه
چه اطلاعاتی برای Cargo ثبت می‌کنید؟
- Gross Weight
- Net Weight
- Measurement / CBM
- Length / Width / Height
- Weight Unit
- Dimension Unit

آیا همیشه همه این موارد موجود هستند؟

### Q16 — اطلاعات فنی کالا
غیر از Chassis و Serial، چه اطلاعات فنی ممکن است لازم باشد؟
مثلاً Model، Type، Capacity، HS Code، Tariff No، Year، Brand و غیره.

کدام‌ها عمومی‌اند و کدام‌ها فقط برای بعضی کالاها هستند؟

---

# 4. مسیر جابه‌جایی و محل نگهداری Cargo

### Q17 — مسیر واقعی Cargo
لطفاً یک Cargo را که از یک کشور دیگر وارد می‌شود تا مقصد نهایی مرحله‌به‌مرحله توضیح دهید.

مثال:
China → Jebel Ali → Hamriyah → Khorramshahr

آیا مسیرهای دیگری هم دارید؟

### Q18 — چند Port و چند Yard
یک Cargo می‌تواند در طول فرآیند چند Port و چند Yard داشته باشد؟
اگر بله، ترتیب آن را چگونه ثبت می‌کنید؟

### Q19 — Yard ورود و Yard فعلی
آیا فقط یک Yard برای Cargo داریم یا باید تاریخچه جابه‌جایی بین Yardها حفظ شود؟

مثلاً:
A09 → F15 → دیگری.

### Q20 — انتقال داخلی بین Yardها
اگر Cargo از یک Yard به Yard دیگر منتقل شود:
- چه کسی ثبت می‌کند؟
- دلیل انتقال چیست؟
- هزینه انتقال ثبت می‌شود؟
- تاریخ و زمان انتقال ثبت می‌شود؟

### Q21 — تاریخ‌های مهم Cargo
همه تاریخ‌هایی که واقعاً نیاز دارید را مشخص کنید:
- تاریخ دریافت
- تاریخ ورود به Port
- تاریخ ورود به Yard
- تاریخ Inspection
- تاریخ Booking
- تاریخ Loading
- تاریخ خروج Vessel
- تاریخ Discharge
- تاریخ Release
- تاریخ Delivery
- تاریخ تحویل نهایی

اگر تاریخ دیگری هست اضافه کنید.

---

# 5. Documents و وضعیت اسناد

### Q22 — انواع اسناد ورودی Cargo
لطفاً تمام اسنادی را که ممکن است هنگام دریافت Cargo داشته باشید فهرست کنید و بگویید در چه مرحله‌ای دریافت می‌شوند.

### Q23 — Document Status
چه وضعیت‌هایی برای Document دارید؟
مثلاً:
Pending / Received / Verified / Missing / Expired / Approved / Rejected

کدام‌ها واقعاً استفاده می‌شوند؟

### Q24 — تاریخ اعتبار سند
آیا بعضی اسناد تاریخ انقضا دارند؟
اگر بله، آیا باید قبل از انقضا هشدار داده شود؟

### Q25 — چند فایل برای یک Cargo
آیا یک Cargo می‌تواند چند سند داشته باشد؟
و آیا هر سند:
- نوع سند
- تاریخ
- صادرکننده
- شماره سند
- توضیح
دارد؟

### Q26 — نسخه سند
اگر یک سند اصلاح شود، نسخه قبلی نگهداری می‌شود یا با نسخه جدید جایگزین می‌شود؟

---

# 6. Inspection

### Q27 — فرآیند کامل Inspection
لطفاً از لحظه درخواست Inspection تا پایان آن توضیح دهید:
چه کسی درخواست می‌دهد، چه کسی انجام می‌دهد، چه زمانی هزینه پرداخت می‌شود و نتیجه چگونه ثبت می‌شود؟

### Q28 — نتیجه Inspection
آیا Inspection فقط Done/Pending است یا نتیجه‌های دیگری هم دارد؟
مثلاً:
Passed / Failed / Recheck / Rejected.

### Q29 — سند یا مدرک Inspection
آیا نتیجه Inspection دارای فایل، شماره، تاریخ یا گزارش است؟

### Q30 — چند Inspection برای یک Cargo
آیا یک Cargo ممکن است چند بار Inspection شود؟

### Q31 — اثر Inspection روی Loading
آیا فقط Done شدن Inspection کافی است یا شرایط دیگری هم باید برقرار باشد تا Cargo وارد Loading List شود؟

تمام شرایط را مشخص کنید.

---

# 7. Loading List و بارگیری

### Q32 — چه کسی Loading List را ایجاد می‌کند؟
و چه کسی می‌تواند آن را Edit یا Finalize کند؟

### Q33 — یک Loading List برای یک Vessel
آیا هر Loading List فقط متعلق به یک Vessel/Voyage و یک Destination است؟

### Q34 — چند مرحله Loading List
مثلاً امروز 7 دستگاه و فردا 13 دستگاه.
آیا همیشه یک Loading List را Edit می‌کنید یا Loading List جدید می‌سازید؟

### Q35 — حذف از Loading List
اگر Cargo بعد از ورود به Loading List بارگیری نشود:
- دلیل ثبت می‌شود؟
- چه کسی آن را حذف می‌کند؟
- آیا به‌صورت خودکار به Yard Inventory برمی‌گردد؟

### Q36 — بارگیری ناقص
اگر فقط بخشی از Packages یا Units بارگیری شود، چگونه ثبت می‌کنید؟

### Q37 — اطلاعات واقعی اپراتور
Operator هنگام بارگیری چه اطلاعاتی را وارد می‌کند؟
مثلاً Loaded / Not Loaded / Quantity Loaded / Reason / Date / Time.

### Q38 — اثبات بارگیری
آیا برای بارگیری عکس، امضا، فرم، Weight Note یا مدرک دیگری وجود دارد؟

---

# 8. Vessel و Voyage

### Q39 — ساختار دقیق Vessel
برای Vessel چه مشخصاتی واقعاً دارید؟
مثلاً:
Name، IMO، Flag، Owner، Type، Capacity و غیره.

برای Tug، Barge و Landing Craft چه اطلاعاتی متفاوت است؟

### Q40 — Tug و Barge
آیا Tug و Barge دو موجودیت جدا هستند یا یک Vessel ترکیبی محسوب می‌شوند؟

### Q41 — Voyage Number
قاعده واقعی Voyage Number را با یک مثال توضیح دهید.

مثلاً اگر یک Vessel:
- یک بار به Khorramshahr
- یک بار به Bandar Abbas
- دوباره به Khorramshahr

برود، شماره Voyage چگونه تعیین می‌شود؟

### Q42 — Voyage در برابر Destination
آیا Voyage Number برای هر Destination جداست یا برای خود Vessel یک شماره سراسری دارد؟

### Q43 — تغییر Voyage
اگر مقصد یا Vessel تغییر کند، Voyage قبلی چه می‌شود؟

---

# 9. B/L

### Q44 — B/L چه زمانی ایجاد می‌شود؟
دقیقاً در چه مرحله‌ای B/L ساخته می‌شود؟

### Q45 — یک B/L برای چند Cargo
آیا یک B/L می‌تواند چند Cargo/Unit/Package داشته باشد؟

### Q46 — Draft و Final
چه کسی B/L Draft را تأیید می‌کند؟
چه کسی اجازه Final کردن دارد؟

### Q47 — اصلاح بعد از Final
اگر B/L Final شد و بعد اشتباه پیدا شد:
- Edit می‌شود؟
- نسخه جدید صادر می‌شود؟
- شماره تغییر می‌کند؟
- نسخه قبلی نگهداری می‌شود؟

### Q48 — B/L Number
فرمت شماره B/L را برای هر Port/Destination دقیقاً با چند مثال مختلف توضیح دهید.

### Q49 — Original B/L
Original B/L چند نسخه دارد؟
چه کسی نگه می‌دارد؟
چه کسی تحویل می‌گیرد؟

### Q50 — Surrender / Release
چه ارتباطی بین Original B/L، Surrender و Release Order وجود دارد؟

### Q51 — Freight
Freight همیشه Prepaid است یا Collect هم دارید؟
چه حالت‌های دیگری وجود دارد؟

---

# 10. Manifest

### Q52 — شرط ایجاد Manifest
Manifest چه زمانی ساخته می‌شود؟
آیا فقط بعد از Final شدن B/Lها می‌توان Manifest ساخت؟

### Q53 — B/Lهای داخل Manifest
آیا هر B/L فقط در یک Manifest قرار می‌گیرد یا ممکن است در چند Manifest باشد؟

### Q54 — Manifest اصلاح‌شده
اگر بعد از Final شدن Manifest، یک B/L اضافه/حذف/اصلاح شود چه اتفاقی می‌افتد؟

### Q55 — شماره Manifest
فرمت دقیق شماره Manifest را با چند نمونه واقعی برای مقصدهای مختلف بدهید.

### Q56 — Totalهای Manifest
Totalها دقیقاً از چه چیزی محاسبه می‌شوند؟
مثلاً:
Units، Packages، Gross Weight، Net Weight.

### Q57 — Manifest متعلق به چه کسی است؟
آیا Shipper روی Manifest همیشه یکی است یا ممکن است چند Shipper در یک Manifest باشند؟

### Q58 — Forwarder / Co-loading
اگر شرکت‌های همکار هم کالا روی شناور داشته باشند، دقیقاً چه اطلاعاتی از آن‌ها ثبت می‌شود و در Manifest چگونه نمایش داده می‌شوند؟

---

# 11. Customer، Shipper، Consignee و Agent

### Q59 — تفاوت عملی چهار نقش
لطفاً برای یک Shipment واقعی مشخص کنید:
Customer چه کسی است؟
Shipper چه کسی است؟
Consignee چه کسی است؟
Agent مقصد چه کسی است؟

### Q60 — تغییر Shipper/Consignee
اگر اطلاعات Shipper یا Consignee بعداً اصلاح شود، روی B/Lهای قبلی چه اتفاقی می‌افتد؟

### Q61 — Notify Party
Notify Party همیشه همان Consignee است یا مستقل است؟
در چه شرایطی فرق می‌کند؟

### Q62 — Agent
آیا هر Destination دقیقاً یک Agent دارد یا ممکن است چند Agent داشته باشد؟

### Q63 — تغییر Agent
اگر Agent مقصد تغییر کند، چه چیزی باید به‌روزرسانی شود؟

---

# 12. Invoice و درآمد

### Q64 — انواع Invoice
تمام انواع Invoiceهایی که واقعاً صادر می‌کنید را مشخص کنید.
مثلاً:
- Sales Invoice
- Draft Invoice
- Proforma Invoice
- سایر موارد

### Q65 — Invoice بر اساس B/L یا Manifest
در چه شرایطی Invoice به یک B/L مربوط است و در چه شرایطی به Manifest یا Job؟

### Q66 — یک Invoice چند Job دارد؟
آیا یک Invoice می‌تواند هزینه‌های چند Job را شامل شود؟

### Q67 — یک Job چند Invoice دارد؟
مثلاً هزینه‌ها در چند مرحله ایجاد شود. آیا چند Invoice برای یک Job مجاز است؟

### Q68 — Line Itemهای Invoice
غیر از نمونه Invoice فعلی، همه نوع هزینه‌هایی که ممکن است به‌صورت Line در Invoice بیایند را فهرست کنید.

### Q69 — VAT
چه خدماتی VAT دارند و چه خدماتی ندارند؟
قواعدی که در عمل استفاده می‌کنید را توضیح دهید.

### Q70 — VAT در زمان Invoice
آیا VAT به‌صورت دستی انتخاب می‌شود یا بر اساس نوع خدمت/Customer/Port محاسبه می‌شود؟

### Q71 — Credit Terms
تاریخ سررسید Invoice چگونه تعیین می‌شود؟
آیا برای هر Customer یا Invoice متفاوت است؟

### Q72 — Invoice اصلاحی
اگر Invoice اشتباه صادر شود:
- Edit؟
- Cancel؟
- Credit Note؟
- New Invoice؟

در شرکت چه کاری انجام می‌دهید؟

---

# 13. Job و هزینه‌ها

### Q73 — تعریف دقیق Job
یک Job با چه رویدادی ایجاد می‌شود؟

### Q74 — محدوده Job
لطفاً با 3 نمونه واقعی بگویید Job مربوط به:
- یک دستگاه
- چند دستگاه
- یک Shipment
چگونه تعیین می‌شود.

### Q75 — انواع هزینه Job
تمام هزینه‌هایی که ممکن است در Job جمع شوند را فهرست کنید.

### Q76 — هزینه مستقیم و غیرمستقیم
مثلاً اجاره کشتی، هزینه دفتر، حقوق، جرثقیل، حمل زمینی، ترخیص و غیره.
کدام هزینه مستقیماً به Job نسبت داده می‌شود؟

### Q77 — هزینه بدون Job
اگر هزینه‌ای به هیچ Cargo/Job مربوط نباشد، چگونه ثبت می‌شود؟

### Q78 — زمان ثبت هزینه
هزینه را چه زمانی ثبت می‌کنید؟
هنگام وقوع، هنگام پرداخت یا هنگام صدور Invoice؟

### Q79 — اصلاح هزینه
اگر هزینه بعداً تغییر کند یا اشتباه ثبت شده باشد، چگونه اصلاح می‌شود؟

---

# 14. Ledger و Accounting

### Q80 — حساب اصلی
برای هر Customer چه حسابی در نظر می‌گیرید و برای شرکت چه حساب‌های دیگری وجود دارد؟

### Q81 — Debit/Credit
برای چند نمونه واقعی توضیح دهید که چه تراکنشی Debit و چه تراکنشی Credit محسوب می‌شود.

### Q82 — General Journal
چه نوع تراکنش‌هایی باید بدون Invoice در General Journal ثبت شوند؟
مثال واقعی بدهید.

### Q83 — هزینه‌های دفتری
تمام دسته‌های هزینه جاری شرکت را فهرست کنید.

### Q84 — حساب بانکی و Cash
پرداخت‌ها و دریافت‌ها از چه مسیرهایی انجام می‌شوند؟
Cash، Bank Transfer، Cheque و غیره.

### Q85 — چند ارز
آیا فقط AED دارید یا ارزهای دیگر هم دارید؟
اگر چند ارز دارید، تسعیر چگونه انجام می‌شود؟

### Q86 — Balance
Balance مشتری چگونه باید نمایش داده شود؟
چه زمانی بدهکار، بستانکار یا صفر محسوب می‌شود؟

### Q87 — Statement
Statement مشتری چه فیلدهایی باید داشته باشد؟
بازه زمانی، Invoice، Payment، Credit، Debit، Balance و غیره.

---

# 15. Payment و Receipt Voucher

### Q88 — انواع Payment
تمام روش‌های پرداخت واقعی شرکت را مشخص کنید.

### Q89 — Payment Voucher
در Payment Voucher چه اطلاعاتی اجباری است؟

### Q90 — Receipt Voucher
در Receipt Voucher چه اطلاعاتی اجباری است؟

### Q91 — پرداخت به شخص
اگر پول به یک فرد پرداخت شود، چه اطلاعاتی از دریافت‌کننده ثبت می‌کنید؟

### Q92 — ID Card
برای ID Card دریافت‌کننده:
- دو طرف کارت لازم است؟
- در چه نوع پرداخت‌هایی؟
- همیشه یا فقط بعضی پرداخت‌ها؟

### Q93 — امضا
امضا چگونه ثبت می‌شود؟
روی صفحه، روی تصویر یا به شکل دیگری؟

### Q94 — Partial Payment
اگر یک Invoice چند بار پرداخت شود، هر پرداخت جداگانه ثبت می‌شود؟

### Q95 — Advance Payment
اگر پول قبل از Invoice پرداخت شود، چگونه ثبت و بعداً با Invoice تطبیق داده می‌شود؟

### Q96 — Overpayment
اگر مشتری بیشتر از بدهی خود پرداخت کند، مبلغ اضافه چه می‌شود؟

---

# 16. Release Order

### Q97 — شرط Release
تمام شرایطی که باید قبل از Release Order برقرار باشد چیست؟

### Q98 — Full / Partial / Credit
سه حالت زیر را با مثال واقعی توضیح دهید:
- Full Payment
- Partial Payment
- Credit / Unpaid

### Q99 — تایید Release
چه کسی Release را تأیید می‌کند؟

### Q100 — چند بار Release
آیا یک B/L ممکن است چند Release یا اصلاح Release داشته باشد؟

### Q101 — Release تاریخچه
آیا تاریخچه تغییر وضعیت Release باید نگهداری شود؟

---

# 17. Agent Portal / دسترسی Agent

### Q102 — اطلاعات قابل مشاهده Agent
Agent مقصد دقیقاً چه اطلاعاتی را باید ببیند؟

### Q103 — محدودیت دسترسی Agent
Agent فقط Port خودش را می‌بیند یا فقط B/Lهای مربوط به Agent خودش؟

### Q104 — دسترسی به اسناد
آیا Agent می‌تواند B/L، Manifest، Release Order و سایر اسناد را دانلود کند؟

### Q105 — عملیات Agent
Agent فقط مشاهده می‌کند یا می‌تواند چیزی مثل:
- Confirm
- Update Status
- Upload Document
- Add Note
را انجام دهد؟

### Q106 — چند Agent برای یک Port
اگر چند Agent در یک مقصد باشند، دسترسی آن‌ها چگونه جدا می‌شود؟

---

# 18. Delivery Order

### Q107 — موارد استفاده Delivery Order
در چه نوع Cargoهایی Delivery Order صادر می‌شود؟

### Q108 — شرط صدور DO
چه شرایطی باید قبل از صدور DO برقرار باشد؟

### Q109 — DO و Release
تفاوت عملی Delivery Order و Release Order در شرکت چیست؟

### Q110 — تأیید تحویل
آیا Delivery Order با امضا، مهر یا مدرک تحویل نهایی همراه است؟

---

# 19. Proforma و Quotation

### Q111 — Proforma
Proforma در چه مرحله‌ای و برای چه نوع کاری صادر می‌شود؟

### Q112 — ارتباط PI با Customer/Job
آیا Proforma به Customer، Job، Shipment یا Cargo متصل است؟

### Q113 — اعتبار Proforma
Validity و شرایط پرداخت چگونه تعیین می‌شود؟

### Q114 — Quotation
Quotation قبل از شروع کار صادر می‌شود؟
آیا بعداً به Proforma یا Invoice تبدیل می‌شود؟

### Q115 — نسخه‌های اصلاح‌شده
اگر Quotation یا Proforma اصلاح شود، نسخه قبلی نگهداری می‌شود؟

---

# 20. Reporting

### Q116 — گزارش‌های روزانه
هر روز چه گزارش‌هایی واقعاً لازم دارید؟

### Q117 — گزارش عملیات
مدیریت باید بتواند چه چیزهایی را ببیند؟
مثلاً:
Cargoهای موجود، Pending Inspection، آماده Loading، Loaded، در Yard و غیره.

### Q118 — گزارش Vessel / Voyage
برای هر Voyage چه اطلاعاتی باید در یک صفحه دیده شود؟

### Q119 — سود و زیان
سود و زیان را در چه سطحی می‌خواهید؟
- Voyage
- Vessel
- Manifest
- Job
- Customer
- Company

### Q120 — درآمد
درآمد یک Voyage دقیقاً از چه مواردی تشکیل می‌شود؟

### Q121 — هزینه Voyage
تمام هزینه‌هایی که باید به Voyage نسبت داده شوند را فهرست کنید.

### Q122 — تخصیص هزینه
اگر یک هزینه بین چند Cargo یا چند Voyage مشترک باشد، چگونه تقسیم می‌شود؟

### Q123 — گزارش مالیاتی
تمام گزارش‌های مالی/Tax که شرکت در پایان ماه، فصل یا سال نیاز دارد را مشخص کنید.

---

# 21. Alerts و Follow-up

### Q124 — چه اتفاقاتی باید Alarm بدهند؟
تمام مواردی که نیاز به Reminder/Alarm/Notice دارند را فهرست کنید.

### Q125 — تأخیر Payment
چند روز بعد از سررسید Invoice باید هشدار داده شود؟
آیا شدت هشدارها متفاوت است؟

### Q126 — Cargoهای مانده در Yard
آیا برای Cargoهایی که مدت زیادی در Yard/Port مانده‌اند هشدار لازم است؟

### Q127 — Pending Inspection
آیا Inspection Pending باید به شخص خاصی هشدار داده شود؟

### Q128 — سایر هشدارها
هر هشدار عملیاتی دیگری که در کار شرکت استفاده می‌کنید.

---

# 22. Archive و بایگانی

### Q129 — منظور از بایگانی شرکت
بایگانی دقیقاً شامل چه چیزهایی است؟
مثلاً:
B/L، Manifest، Invoice، Voucher، Customer Documents، Contracts، Letters، Photos و غیره.

### Q130 — ارتباط آرشیو با پرونده
آیا هر سند باید به Customer، Job، Cargo، Shipment یا Vessel قابل جست‌وجو باشد؟

### Q131 — جست‌وجوی آرشیو
معمولاً با چه اطلاعاتی سند را پیدا می‌کنید؟
شماره سند، Customer، تاریخ، Vessel، B/L و غیره.

### Q132 — نگهداری نسخه‌ها
آیا نسخه‌های قبلی اسناد باید نگهداری شوند؟

### Q133 — حذف اسناد
چه کسی اجازه حذف سند را دارد؟
آیا حذف باید در تاریخچه ثبت شود؟

---

# 23. Letters و مکاتبات

### Q134 — چه نامه‌هایی صادر می‌کنید؟
همه نوع نامه‌های واقعی شرکت را فهرست کنید.

### Q135 — نامه بر اساس چه چیزی؟
آیا نامه به Customer، Job، Shipment، Vessel یا یک سند خاص مرتبط است؟

### Q136 — شماره‌گذاری نامه
نامه‌ها شماره و تاریخ خودکار دارند؟

### Q137 — امضا و مهر
نامه‌ها چه نوع Signature/Stamp نیاز دارند؟

---

# 24. Users، Roles و Security

### Q138 — نقش‌های واقعی افراد
تمام نقش‌های واقعی کارکنان و طرف‌های بیرونی را مشخص کنید.

مثلاً:
Admin، Operations، Accounting، Manager، Agent و غیره.

### Q139 — دسترسی هر نقش
برای هر نقش بگویید:
- چه چیزهایی را می‌تواند ببیند؟
- چه چیزهایی را می‌تواند ایجاد کند؟
- چه چیزهایی را می‌تواند Edit کند؟
- چه چیزهایی را می‌تواند Delete کند؟
- چه چیزهایی را می‌تواند Approve/Finalize کند؟

### Q140 — ثبت فعالیت کاربران
آیا لازم است مشخص باشد چه کسی:
Create، Edit، Delete، Approve، Release یا Payment انجام داده است؟

### Q141 — تاریخچه تغییرات
آیا برای اسناد حساس مثل Invoice، B/L، Manifest و Payment باید History تغییرات نگهداری شود؟

---

# 25. خروجی‌ها و Templateها

### Q142 — فهرست کامل خروجی‌ها
تمام اسنادی که سیستم باید تولید کند را فهرست کنید.

### Q143 — Templateهای موجود
برای هر مورد، آیا Template رسمی شرکت وجود دارد؟
مثلاً:
Loading List، B/L، Manifest، Invoice، PI، Quotation، DO، Release Order، Salary Slip، Voucher، Ledger، Letter.

### Q144 — PDF و Excel
برای کدام اسناد:
- فقط PDF
- فقط Excel
- هر دو
لازم است؟

### Q145 — Print با Stamp و بدون Stamp
کدام اسناد:
- PDF با Stamp دیجیتال
- Print بدون Stamp دیجیتال برای مهر زنده
نیاز دارند؟

### Q146 — امضا
کدام اسناد Signature دیجیتال دارند و کدام‌ها باید دستی امضا شوند؟

### Q147 — چند نسخه
برای هر سند چند نسخه لازم است و هر نسخه به چه کسی داده می‌شود؟

---

# 26. Salary

### Q148 — اطلاعات حقوق
برای Salary هر کارمند چه اطلاعاتی دارید؟

### Q149 — اجزای حقوق
Salary شامل چه بخش‌هایی است؟
مثلاً Basic، Allowance، Deduction، Overtime و غیره.

### Q150 — چرخه پرداخت
چه کسی Salary را تنظیم، تأیید و پرداخت می‌کند؟

### Q151 — ID Card و امضا
برای Salary Slip دقیقاً چه زمانی و برای چه کارکنانی ID Card و امضا لازم است؟

### Q152 — اصلاح حقوق
اگر Salary Slip اصلاح شود، نسخه قبلی چه می‌شود؟

---

# 27. موارد خاص و استثنایی

### Q153 — Cancellation
کدام اسناد یا عملیات ممکن است Cancel شوند؟

### Q154 — Re-open
آیا سندی که Final شده می‌تواند دوباره باز شود؟
چه کسی اجازه دارد؟

### Q155 — برگشت کالا
اگر Cargo از مقصد برگردد چه فرآیندی دارید؟

### Q156 — تغییر مقصد
اگر مقصد Cargo بعد از ثبت تغییر کند، چه چیزهایی باید تغییر کند؟

### Q157 — تغییر Vessel
اگر Cargo به Vessel دیگری منتقل شود، چه اطلاعاتی باید تغییر کند؟

### Q158 — بارگیری جزئی
اگر فقط بخشی از Cargo/Package بارگیری شود، فرآیند کامل را توضیح دهید.

### Q159 — Lost / Damaged
اگر کالا آسیب ببیند یا گم شود، آیا فرآیند خاصی برای ثبت آن وجود دارد؟

### Q160 — مواردی که در ویس‌ها گفته نشده
هر فرآیند واقعی شرکت که در این پرسشنامه وجود ندارد ولی انجام می‌شود را حتماً اضافه کنید.

---

# 28. مهم‌ترین درخواست پایانی

لطفاً برای 5 کار واقعی اخیر شرکت، در حد امکان این اطلاعات را به‌صورت نمونه ارائه دهید:

### نمونه 1
یک Cargo ساده که بدون مشکل از ابتدا تا انتها انجام شده.

### نمونه 2
یک Cargo که Inspection یا Loading آن با مشکل مواجه شده.

### نمونه 3
یک کار دارای چند هزینه و Job Number.

### نمونه 4
یک کار دارای Partial Payment / Credit / Release.

### نمونه 5
یک Voyage/Manifest واقعی که چند B/L و چند Customer یا Shipper داشته.

برای هر نمونه، اگر موجود است:
- Cargo information
- Job Number
- B/L
- Manifest
- Invoice
- Payment/Receipt
- Release/Delivery Order
- هزینه‌ها
- وضعیت نهایی

را ارائه کنید.

---

# نتیجه مورد انتظار از این پرسشنامه

بعد از پاسخ به این پرسشنامه، باید بتوانیم بدون حدس زدن، این موارد را به‌صورت دقیق مشخص کنیم:

1. از لحظه شروع یک کار تا پایان آن چه اتفاقاتی رخ می‌دهد.
2. چه اشخاص و شرکت‌هایی در هر مرحله نقش دارند.
3. چه اطلاعاتی در هر مرحله ثبت می‌شود.
4. چه اسنادی ساخته یا دریافت می‌شود.
5. هر سند به چه چیزهایی مربوط است.
6. چه شرایطی اجازه عبور از هر مرحله را می‌دهد.
7. چه وضعیت‌هایی برای هر فرآیند وجود دارد.
8. چه هزینه‌ها و درآمدهایی ایجاد می‌شود.
9. ارتباط Customer، Job، Cargo، Shipment، B/L، Manifest، Invoice، Payment، Release و Delivery چیست.
10. چه گزارش‌ها و هشدارهایی لازم است.
11. چه اطلاعات یا فرآیند دیگری وجود دارد که هنوز در این پرسشنامه نیامده است.

**لطفاً هرجا پاسخ دقیق ندارید، به‌جای حدس زدن بنویسید «نیاز به بررسی» و در صورت امکان نمونه واقعی ارائه کنید.**

---

## duna-analysis/existing-analysis/duna_source_pack.md

# Duna Shipping Dashboard — Consolidated Source Pack

> این فایل «منبع پایه پروژه» است و برای نگهداری یک‌جای اطلاعات جمع‌آوری‌شده از ویس‌های کارفرما، اسناد واقعی شرکت و مستندات Legacy Dashboard تهیه شده است.
>
> نکته: متن ویس‌ها در بخش‌های اصلاح‌شده، transcription را خواناتر کرده است اما **بازنویسی مفهومی نیست**. جاهایی که از روی متن به‌تنهایی قابل تشخیص نبوده‌اند با `[نامفهوم/نیازمند تطبیق با صوت]` مشخص شده‌اند. اسناد نیز تا حد امکان با همان محتوای ارسالی نگه داشته شده‌اند.

---

# 1. Source Index

## 1.1 Voice / Transcript Sources

### Voice Group A — Main operational/accounting explanation
- Part 1: معرفی کسب‌وکار، Customer، Cargo/Inventory، Loading، Manifest، B/L، Accounting، Release/Delivery، Agent، Reports و شرح چرخه عملیاتی.
- Part 2: Yards، انتخاب Yard وابسته به Port، Vessels و Voyage.
- Part 3: Overview / Operations / B/L & Manifest / Accounting / Master Data / Access Control، سپس Customer.
- Part 4: Shipper / Consignee / Agent و تمایز Customer با Shipper/Consignee.
- Part 5: Yard و انتخاب خودکار Yardهای مرتبط با Port.
- Additional: Accounting / Voucher / Salary Slip / General Journal / Template Upload / Customer Ledger.
- Additional: Cargo registration، Inspection، Loading List، B/L، Manifest و خروجی‌ها.
- Additional: Manifest structure، Accounting، Invoice، VAT، Ledger، Release Order، Delivery Order، Agent portal، Reports.

## 1.2 Real Company Documents

### Source Group 1 — Previous PDFs
1. Bill of Lading: `BL-1X D155A CH NO 8308-1`
2. Manifest: `MAN-MEHDI 11 KHO-26-006`

### Source Group 2 — Five Documents from merged DOCX
1. Receipt Voucher
2. Ledger Account / SOA
3. Tax Invoice
4. Proforma Invoice
5. Quotation

## 1.3 Legacy Dashboard Documentation
1. Overview / Project Summary / module mapping
2. Domain Model / ERD / 23 domain entities
3. Workflows / status machines / RBAC / business rules
4. UI Pages Inventory
5. Data Dictionary / fields / relations / legacy gaps

---

# 2. Corrected Voice Transcript — Consolidated

## 2.1 Business Overview and Main Flow

ما یه شرکت کشتیرانی هستیم که دفتر مرکزی‌مون توی دبی، امارات متحده عربیه. پورت حمریه، پورت دبی، بندر حمریه، پورت دبی.

به این صورتی که ما مثلاً کشتی‌ها یا مال خودمون هستن، یعنی تحت مالکیت خودمون هستن، یا این‌که مثلاً کشتی رو اجاره می‌کنیم. حالا یا سفری اجاره می‌کنیم یا Time Charter، برای یه مدت اجاره می‌کنیم.

در این بین ما یه سری کار داریم، مثل حمل‌ونقل ماشین‌آلات، مدنی، عمرانی، Shipping و هر چیزی؛ جابه‌جایی مثلاً از یه نقطه به یه نقطه دیگه دریایی.

وقتی یک دستگاه/Cargo را در Port تحویل می‌گیریم، اولین مسئله این است که بدانیم این دستگاه متعلق به کدام Customer است. Customer برای ما رکن اصلی است.

برای Customer اطلاعات پایه مثل Name، Contact Number، Email و Address نگهداری می‌شود و سیستم باید Code اختصاصی Customer را اتوماتیک ایجاد کند.

Customer با Shipper و Consignee یکی نیست؛ Customer طرف تجاری/داخلی ماست که با او در ارتباطیم و Invoice برای او صادر می‌کنیم. ممکن است نام Customer اصلاً در B/L یا Manifest نیاید.

کالا ممکن است متعلق به Customer باشد ولی Shipper شرکت فروشنده در مبدأ و Consignee طرف مقصد باشد.

---

## 2.2 Yard / Cargo / Inventory

برای هر Cargo باید بدانیم از کدام Port تحویل گرفته شده، در کدام Yard قرار گرفته، چه تاریخی وارد شده، مقصدش چیست و اسنادش چیست.

در Yard Master Data فقط لازم است Port و Yard Name تعریف شوند؛ مثلاً Port Hamriyah — Yard F15.

زمانی که در ثبت Cargo، Port را انتخاب می‌کنیم، فقط Yardهای مرتبط با همان Port باید در انتخاب Yard نمایش داده شوند.

برای Cargo اطلاعاتی مثل Customer، Shipper، Port of Loading، Port of Destination، Description، Chassis Number، Serial Number، Number of Units، Number of Packages، Weight، Weight Unit، Arrival Date، Yard و Document Status مورد نیاز است.

برای هر دستگاه/Cargo باید Comment داشته باشیم تا هزینه‌ها، عملیات، تعمیرات، جرثقیل، حمل و سایر اتفاقات فراموش نشوند. Comment باید بعداً برای Accounting هم قابل مشاهده باشد.

---

## 2.3 Inspection and Loading List

زمانی که اسناد آماده شد، برای کالا Inspection انجام می‌شود. باید وضعیت Inspection مشخص باشد، مثلاً Pending یا Done.

یکی از شروط ورود Cargo به Loading List این است که Inspection انجام شده و وضعیت آن Done باشد. اگر Inspection انجام نشده باشد، سیستم نباید اجازه دهد Cargo در Loading List انتخاب شود.

Loading List را می‌توان مرحله‌ای تکمیل کرد. مثلاً از 20 دستگاه ابتدا 7 دستگاه آماده باشند و وارد Loading List شوند؛ روز بعد 13 دستگاه دیگر اضافه شوند.

Loading List باید اطلاعات عملیاتی مورد نیاز Operator را داشته باشد، از جمله Port of Loading، Port of Destination، Description، Chassis Number، Serial Number، تعداد دستگاه، تعداد Package، Weight، تاریخ ورود، Yard و وضعیت Inspection.

بعد Loading List چاپ و به Operatorهای بارگیری تحویل می‌شود.

اگر از 20 دستگاه فقط 19 دستگاه بارگیری شد، دستگاه باقی‌مانده باید از Loading List حذف و دوباره به Yard Inventory برگردد تا برای Trip بعدی قابل استفاده باشد.

---

## 2.4 Port Master Data

برای Port، نام Port، شهر، کشور و یک Abbreviation لازم است.

فرمت نمایشی نمونه:

`Bandar Abbas, Persian Gulf, Iran`

یا:

`Bushehr, Persian Gulf, Iran`

برای استفاده در Load List، چون نام کامل Port فضای زیادی می‌گیرد، Abbreviation مثل `HAM` برای Hamriyah استفاده می‌شود.

در Data Entry اگر Port انتخاب شود، فقط Yardهای مرتبط با همان Port باید خودکار نمایش داده شوند.

---

## 2.5 Vessel Master Data

برای Vessel می‌توان Vessel Name را ثبت کرد.

کشتی‌ها ممکن است در قالب‌های مختلف باشند، مثل Tug & Barge، Landing Craft یا Vessel.

برای Tug & Barge نام Tug و Barge جدا باشد؛ برای Vessel یا Landing Craft، Vessel Name کافی است.

IMO Number نیز در صورت وجود قابل ثبت باشد و اجباری نباشد.

نام Vessel در Loading List، B/L و Manifest استفاده می‌شود.

Voyage باید برای هر مقصد به‌صورت خودکار تولید شود. در مثال کارفرما برای هر سفر و مقصد چیزی مانند `Voyage 1/26`, `Voyage 2/26` و ... مورد نظر است و این شماره باید توسط سیستم تولید شود.

---

## 2.6 Shipper Master Data

Shipper اولین اطلاعات مهم B/L است.

برای Shipper اطلاعاتی مانند:
- Name
- National ID / TRN Number
- Address
- Contact Number
- Email

لازم است.

فقط Name اجباری باشد و بقیه اختیاری باشند؛ اگر National ID وجود نداشت مثلاً TRN Number یا شناسه دیگر ثبت شود و سیستم Error ندهد.

Shipper در B/L و Manifest استفاده می‌شود.

---

## 2.7 Consignee Master Data

Consignee تقریباً همان ساختار Shipper را دارد:
- Name
- National ID / TRN Number
- Address
- Contact Number
- Email

Name اجباری و سایر فیلدها اختیاری باشند.

---

## 2.8 Agent Master Data

Agent نیز در Master Data تعریف می‌شود، با اطلاعات:
- Name
- Address
- Contact Number
- Email

Agent هر مقصد متفاوت است و باید در B/L مربوط به همان مقصد قید شود؛ مثلاً Agent بندرعباس برای B/Lهای بندرعباس و Agent بوشهر برای B/Lهای بوشهر.

---

## 2.9 Customer vs Shipper / Consignee

Customer باید کاملاً جدا از Shipper و Consignee تعریف شود.

Customer ممکن است شخصیت حقیقی یا حقوقی باشد و رابطه مستقیم و تجاری با شرکت داشته باشد، حتی اگر اسمش در B/L یا Manifest نیاید.

مثال کارفرما: Customer می‌تواند «آرش علیدادی» باشد؛ کالا ممکن است از استرالیا تهیه شده باشد، Shipper شرکت استرالیایی باشد و Consignee در مقصد شرکت دیگری باشد. در سیستم داخلی، کالا و عملیات به Customer آرش علیدادی مرتبط می‌شوند ولی B/L ممکن است نام Shipper و Consignee دیگری داشته باشد.

Invoice باید برای Customer صادر شود و در Profile / Ledger او قرار بگیرد.

در Profile مشتری باید بتوان عملیات و رابطه مالی با آن Customer را دید، از جمله Invoiceها، پرداخت‌ها، بدهی/بستانکاری، Ledger و سوابق مرتبط.

---

## 2.10 ETOZ / Job Number

برای بعضی Shipmentها از ابتدا تا پایان یک فرآیند چند هفته یا چند ماه طول می‌کشد و هزینه‌های مختلفی در مسیر ایجاد می‌شود.

برای این فرآیند باید Job Number وجود داشته باشد.

Job Number باید مانند یک پرونده تجمیعی عمل کند تا هزینه‌های مختلف، مثل Repairing، Customs، Lowbed، Transport، Ship، Crane و سایر هزینه‌ها روی همان کار جمع شوند.

در زمان صدور Invoice، حسابدار باید بتواند Job Numberهای مرتبط را ببیند و هزینه‌ها را در Invoice لحاظ کند.

---

## 2.11 B/L و Manifest

پس از Finalized شدن Loading List، کالاهای بارگیری‌شده وارد مرحله B/L و Manifest می‌شوند.

B/L شامل اطلاعاتی مثل:
- Shipper
- Consignee
- Notify Party
- Vessel
- Voyage
- Port of Loading
- Port of Discharge
- B/L Number
- Description
- Quantity
- Marks & Numbers
- Net/Gross Weight
- CBM
- Place of B/L Issue
- Date of B/L Issue
- Freight Charges (Collect/Prepaid)
- Stamp / Signature

B/L ابتدا باید به صورت Draft صادر شود و Watermark `DRAFT` داشته باشد. سپس برای Customer ارسال می‌شود تا بررسی و اصلاح شود. پس از Approval/Finalization، Draft از بین می‌رود و B/L نهایی صادر می‌شود.

شماره B/L باید طبق Format تعریف‌شده برای مقصد تولید شود.

Manifest نیز شامل Header مثل Vessel، Voyage، Port of Loading، Port of Discharge، Manifest Number و Date است.

ردیف‌های Manifest باید از B/Lهای صادرشده ساخته شوند و شامل B/L Number، Description، Shipper، Consignee، Units/Packages و Gross Weight باشند.

در پایان Manifest باید Total Units، Total Packages و Total Weight نمایش داده شود.

اگر یک Vessel چند شرکت یا Forwarder مختلف را حمل می‌کند، Manifest یکی است ولی B/Lهای شرکت‌های مختلف می‌توانند Format شماره متفاوت داشته باشند.

---

## 2.12 Document Output / Templates

برای هر سند شرکت یک Format خاص دارد و کارفرما می‌خواهد Templateها قابل Upload باشند.

از جمله:
- Loading List
- B/L
- Manifest
- Invoice
- Delivery Order
- Release Order
- Salary Slip
- Voucher
- Payment
- Receipt
- Ledger

برای هر سند باید بتوان Format چاپ، PDF و Excel را طبق Template شرکت تعریف کرد.

برای PDF، Stamp/Mark/Signature می‌تواند اتوماتیک داخل خروجی باشد.

برای Print فیزیکی ممکن است Stamp دیجیتال حذف شود تا مهر زنده و امضا به‌صورت فیزیکی انجام شود.

---

## 2.13 Accounting / Invoice

Invoice می‌تواند دو حالت داشته باشد:

1. Invoice مرتبط با B/L / Manifest / Job Number
2. Invoice مستقل از B/L و Job Number

برای Invoiceهای مرتبط با بارنامه، بعد از Issued شدن B/L، Invoice می‌تواند ابتدا به صورت Draft ساخته شود تا حسابدار آن را با Job Numberهای مرتبط Match کند.

Invoice باید اطلاعاتی مثل Invoice Number، Date، Customer، B/L/Manifest Reference، Description، Rate، Quantity، Amount، VAT، Subtotal و Total داشته باشد.

برخی Invoiceها VAT دارند و برخی ندارند.

سیستم باید گزارش VAT بر اساس بازه زمانی/فصل/ماه بدهد؛ مثلاً Total VAT دریافتی و پرداختی.

Invoice صادرشده باید در Customer Ledger به عنوان Debit بنشیند.

Payment/Receipt در Ledger به عنوان Credit یا مطابق قواعد حسابداری ثبت می‌شود و Balance محاسبه می‌شود.

---

## 2.14 Ledger / General Journal

Customer Profile باید Ledger کامل داشته باشد تا بتوان دید:
- چه Invoiceهایی صادر شده
- چه پرداخت‌هایی انجام شده
- چه مبلغی بدهکار است
- چه مبلغی بستانکار است
- Balance فعلی چیست
- آخرین Invoice چه زمانی صادر شده
- Invoice Paid / Unpaid / Partial Payment است یا نه

علاوه بر Invoice و Payment، باید امکان General Journal برای ثبت پرداخت/دریافت خارج از چرخه مستقیم Invoice وجود داشته باشد.

اگر شرکت به یک شخص پول پرداخت کند، می‌تواند در Ledger به عنوان Debit ثبت شود؛ اگر شخصی پولی به شرکت پرداخت کند، به عنوان Credit ثبت شود.

هزینه‌های جاری شرکت مثل هزینه‌های دفتری نیز باید در سیستم ثبت شوند تا در پایان سال به عنوان هزینه‌های شرکت در محاسبه سود و زیان لحاظ شوند.

---

## 2.15 Payment / Receipt Voucher

Payment Voucher و Receipt Voucher هرکدام سند مالی مستقل دارند.

در Payment باید امکان ثبت/Upload تصویر یا مدرک ID Card گیرنده وجود داشته باشد، ترجیحاً پشت و رو.

بعد امضای دریافت‌کننده نیز باید گرفته و ثبت شود.

همین منطق برای Salary Slip هم وجود دارد: در زمان صدور Salary Slip، تصویر پشت و روی ID Card کارمند قابل Upload یا ثبت با دوربین باشد و در نسخه چاپی نیز همراه با امضای کارمند نشان داده شود تا دریافت حقوق مشخص باشد.

---

## 2.16 Release Order

پس از رسیدن Vessel به مقصد و تخلیه کالا، اگر Customer مبلغ Invoice را کامل پرداخت کند، Release Order صادر می‌شود.

ممکن است:
- Full Payment / Paid
- Partial Payment
- Unpaid / Credit

باشد.

Release Order باید وضعیت پرداخت را نشان دهد و سیستم باید بتواند Released / Paid / Partial / Unpaid را گزارش دهد و برای بدهی‌های معوق Alert/Notice داشته باشد.

Agent مقصد باید بتواند فقط اسناد مربوط به Port خودش را ببیند.

مثلاً Agent خرمشهر فقط بارنامه‌ها و Releaseهای خرمشهر را ببیند.

---

## 2.17 Delivery Order

برای کالاهایی که در بندر شرکت/محل مربوطه تخلیه شده‌اند و باید به مشتری/Consignee تحویل شوند، Delivery Order صادر می‌شود.

Delivery Order دارای شماره، تاریخ، Port و اطلاعات استاندارد خود شرکت است و همراه سایر اسناد به مشتری/Consignee تحویل می‌شود.

---

## 2.18 Agent Access

Agentهای مقصد باید Login مستقل داشته باشند.

هر Agent فقط باید داده‌های مربوط به مقصد خودش را ببیند، به‌خصوص B/L، Manifest و Release Order.

هدف این است که Agent به جای تماس تلفنی مداوم با دفتر مرکزی، خودش وضعیت Release را ببیند و به Customer پاسخ بدهد.

---

## 2.19 Reports / Voyage Profitability

برای هر Manifest / Vessel / Voyage باید گزارش مالی وجود داشته باشد.

هزینه‌های Vessel می‌تواند شامل:
- Vessel Hire
- Port Use
- Port Handling
- Lashing
- سایر هزینه‌های مرتبط با سفر

باشد.

درآمد نیز از مجموع Invoiceهای صادرشده برای بارنامه‌های همان Manifest/Voyage محاسبه می‌شود.

هدف: محاسبه Profit/Loss به ازای هر Vessel/Voyage/Manifest و امکان استخراج گزارش‌های مالی و مالیاتی با Filter.

---

## 2.20 Archive / Company Archive

عنوان «بایگانی شرکت» نیز مطرح شده و قرار است جزئیات آن در فایل بعدی/منبع بعدی تعریف شود.

---

# 3. Real Document Evidence

## 3.1 Bill of Lading — BL-1X D155A CH NO 8308-1

- B/L No: `KHS/26-110`
- Shipper: `RAS AL KHAIMAH MACHINERIES LLC`
- Consignee: `JOINT MECHANIC CO`
- Notify Party: `SAME AS CONSIGNEE`
- Destination Agent: `BADBAN ARVAND ROOD SHIPPING CO`
- Vessel: `MEHDI 11`
- Voyage: `02/26`
- Port of Loading: `HAMRIYA PORT, DUBAI, UAE`
- Port of Discharge: `KHORRAM SHAHR, PERSIAN GULF, IRAN`
- Goods: `USED KOMATSU D155A BULLDOZER`
- Chassis No: `KMT0D105EMC088308`
- Quantity: `1 UNIT`
- Gross Weight: `42,000 KGS`
- On Deck: Yes
- Place of B/L Issue: `DUBAI`
- Date of B/L Issue: `29-AUG-26`
- Freight Charge: `FREIGHT PREPAID`
- No. of Original B/L: `1`
- Stamp & Signature: As Agent

## 3.2 Manifest — MAN-MEHDI 11 KHO-26-006

- Vessel: `BARGE - MEHDI 11`
- Tug: `LAYAN GULF`
- Voyage: `02/26`
- Manifest No: `DSMAN/KHO-26-006`
- Date: `05-Sep-26`
- Port of Loading: `HAMRIYA, DUBAI, UAE`
- Port of Discharge: `KHORRAM SHAHR, PERSIAN GULF, IRAN`
- Company: `DUNA SHIPPING LLC`
- Address: `AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE`
- Contact / Mobile / Email are present.
- Table fields: `#`, `BL`, `DESCRIPTION OF GOODS`, `CONSIGNEE`, `SHIPPER`, `UNIT/PKGS`, `GROSS WEIGHT (KGS)`.
- 45 numbered rows are represented in the source text.
- Total shown: `32 UNITS AND 79 PKGS`, with `111` in total unit/pkg column and `991,886 KGS` gross weight.

## 3.3 Receipt Voucher

- Company: `RUKN ALHMREYA TRANSPORT L.L.C`
- TRN: `104652986100003`
- Voucher No: `477`
- Date: `6-Aug-26`
- Account: `DUNA SHIPPING`
- Amount: `AED 1,600.00`
- References: `1517`, `1526`, `Advance 477`
- Through: `Cash`
- On Account of: `CASH RECEIVED FROM DUNA SHIPPING AGT`
- Authorised Signature present.

## 3.4 Ledger Account / SOA

- Account: `DUNA SHIPPING`
- Period: `1-Jul-26 to 7-Sep-26`
- Transactions contain Sales and Receipt entries.
- Closing Balance shown: `683.50 Dr`
- Totals shown: Debit `4,903.50`, Credit `4,220.00`.
- Particulars include trailer, forklift, lowbed, cargo shifting, loading and voyage-specific work.

## 3.5 Tax Invoice

- Bill To: `MR. SHAHOKH SHAHVARAEI`
- Invoice No: `DSINV/26-172`
- Date: `6-Aug-26`
- Currency: `AED`
- TRN: `100353243700003`
- Reference: `BOE/DEC/BL#: KHS/26-108`
- Manifest: `DSKHS-26-005`
- Vessel: `DAHAR 10`
- Voyage: `02/26`
- Loading Port: `HAMRIYA`
- Discharge Port: `KHORRAM SHAHR`
- Goods: `USED TRUCK CRANE + 1 PKG`
- Charges: Freight, Storage, Customs Documentation, Transportation Jebel Ali → Hamriyah
- Sub Total: `27,370.00 AED`
- VAT: `0.00 AED`
- Total: `27,370.00 AED`

## 3.6 Proforma Invoice

- Seller: `DUNA SHIPPING LLC`
- PI No: `DSPRO/26-001`
- Date: `22-AUG-26`
- Buyer: `MR. RAMIN AHMADABADI`
- Origin: `INDIA`
- Terms of Delivery: `FOB`
- Payment: `100% ADVANCE PAYMENT`
- Currency: `AED`
- Port/Airport of Discharge: `BANDAR ABBAS, PERSIAN GULF, IRAN`
- Final Delivery Place: `MAKU FREE ZONE`
- Items include Hyundai R340L Excavator, Hydraulic Breaker, Quick Coupler.
- Grand Total: `690,000.00 AED`

## 3.7 Quotation

- Quotation No: `DSQUO/25-017`
- Date: `20-NOV-25`
- To: `MR. SHADMAN MEABADI`
- Subject: `1 UNIT USED VOLVO FINISHER`
- Items include Land Transport to Dubai Hamriyah Port, Freight Hamriyah → Bushehr, Documentation and Exit Charge.
- Grand Total: `7,700.00 AED`

---

# 4. Legacy Dashboard — What Exists

## 4.1 Existing / Partial Modules

- Operations → Yard Inventory
- Operations → Load List
- Operations → Yard
- Operations → Port
- B/L
- Manifest
- Shipper
- Agent
- Consignee
- Invoice
- Fin / Voucher
- Proforma
- Quotation
- Customer/user-related functionality
- Users / Roles / Permissions
- Customer Portal

## 4.2 Legacy Gaps

- Vessel as proper entity/model
- Ledger as independent accounting entity
- Delivery Order
- Release Order as independent document/workflow
- Salary
- Financial Reports
- Letters
- Robust Customer CRM/profile
- Clean Customer/Party separation
- API layer

## 4.3 Legacy Workflow

`Loading → Admin Review → Approved → BL → Manifest → Invoice → Fin`

Legacy Loading has parallel status concepts:
- admin_status: PENDING → APPROVED
- status: LOADED / IN_YARD
- in_status: PENDING / DONE / LOCAL ED / NO NEED

Legacy B/L: PENDING → RELEASED
Legacy Invoice: PAID / UNPAID

## 4.4 Legacy Auto Generation

- Manifest number by destination/Port sequence
- Voyage by Shipper + destination
- Invoice code sequential

## 4.5 Legacy UI / Access

- AdminLTE-style RTL interface
- Select2 / DataTables
- AJAX-driven selections
- PDF-ready print/preview pages
- Customer portal
- RBAC permissions
- User-scoped records

---

# 5. Important Evidence Conflicts / Items to Verify

این بخش‌ها عمداً به‌عنوان «Fact to Verify» نگه داشته شده‌اند و نباید بدون سؤال از کارفرما قطعی تلقی شوند:

1. فرمت دقیق Customer Code؛ در ویس چند نمونه متفاوت مثل `CUST 3.1` و `CUST 3SF-2` گفته شد.
2. منطق دقیق Voyage Number؛ یک‌جا وابسته به مقصد بیان شده ولی جزئیات Counter آن نیاز به تعریف دقیق دارد.
3. فرمت دقیق B/L Number برای هر Port.
4. فرمت دقیق Manifest Number.
5. تفاوت دقیق `Voyage` با `Manifest Number`.
6. وضعیت دقیق Document Status و انواع اسناد ورودی Cargo.
7. معنی دقیق `Nagle / Package` در گفتار؛ باید از کارفرما و سند واقعی قطعی شود.
8. اصطلاح ETOZ/ETDZ نیازمند تعیین نام صحیح و معنای دقیق فرآیند است.
9. اینکه `Customer Ledger` دقیقاً از چه حساب‌هایی تشکیل می‌شود و چه چیزی General Ledger است.
10. اینکه Invoice در تمام موارد به یک B/L متصل است یا ممکن است چند B/L / Shipment / Job را پوشش دهد.
11. اینکه یک Manifest چند Customer و چند Shipper/Consignee می‌تواند داشته باشد.
12. اینکه Approval توسط چه کسی و با چه شرایطی انجام می‌شود.
13. اینکه یک Loading List در نهایت Version History دارد یا فقط یک رکورد Edit می‌شود.
14. اینکه چه کسی می‌تواند Comment را Edit/Delete کند و آیا Audit Trail لازم است.
15. قواعد دقیق Release در Full / Partial / Credit.
16. محدوده دسترسی Agent و امکان Download/Print اسناد.
17. جزئیات Delivery Order و ارتباط آن با Cargo/B/L/Consignee.
18. VAT: چه Invoiceهایی مشمول‌اند، چه نرخ‌هایی، و آیا VAT روی Line یا کل Invoice محاسبه می‌شود.
19. ساختار هزینه‌های Vessel/Voyage و اینکه هر هزینه در کدام سطح ثبت می‌شود.
20. بایگانی شرکت و سیاست نگهداری اسناد هنوز کامل نشده است.

