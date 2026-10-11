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
