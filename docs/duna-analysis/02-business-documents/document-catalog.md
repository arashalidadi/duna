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
