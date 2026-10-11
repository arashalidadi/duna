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
