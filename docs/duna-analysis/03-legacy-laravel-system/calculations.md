# Legacy Laravel — Calculations & Number Generation

> Every number the legacy system produces, and how. This is the file to read before porting any
> legacy behaviour into the new system — **several legacy calculations are wrong**, and copying them
> would import defects, not business rules.

---

## 1. Number generation (all in `app/Helpers/helpers.php`)

| Helper | Output shape | Example | Sequential? |
|---|---|---|---|
| `generateBLNumber` | `{port.abb}/{year}{rand4}` | `KHS/20261104` | **No — random 4 digits** |
| `generateManifestNumber` | `{port.abb}/{rand6}{year}` | `KHO/4829132026` | **No — random 6 digits** |
| `generateVoyage` | `nn/yy` per **Portshipper** | `02/26` | **Yes** — but keyed wrong |
| `getinvoiceCode` | `DSAED/{rand6}` | `DSAED/517204` | **No — random 6 digits** |
| `getOfferNumber` | `DSOFF/{rand6}` | | **No** |
| `getQuotationNumber` | `DSQUO/{rand6}` | | **No** |
| `getPerformaNumber` | `SDPRO/{rand6}` | | **No — and the prefix is transposed** |
| Customer code | `'CUST00' . (lastUserId + 1)` | `CUST001` | Yes, but by raw id concat |

### Assessment against reality and against the employer

| Item | Legacy | Reality (real PDFs) | Employer | Verdict |
|---|---|---|---|---|
| B/L number | `KHS/20261104` | `KHS/26-110` | `KHS/26-2/2026`, `RJS/26-10` | **All three disagree.** Only the destination-abbrev prefix is common |
| Manifest number | `KHO/4829132026` | `DSMAN/KHO-26-006`, `DSKHS-26-005` | not specified | Legacy and reality disagree |
| Invoice number | `DSAED/{rand6}` | `DSINV/26-172` | not specified | Prefix and shape both differ |
| Proforma number | `SDPRO/{rand6}` | `DSPRO/26-001` | – | **Prefix transposed** (`SD` vs `DS`) |
| Quotation prefix | `DSQUO/{rand6}` | `DSQUO/25-017` | – | Prefix matches; sequence is random vs year-scoped |
| Voyage | `nn/yy` per Port+Shipper | `02/26` | `nn/yy` per vessel+destination+year | **Shape matches; key does not** |

> **Conclusion:** the legacy numbering is a *placeholder* implementation. It should be read as
> evidence that "numbers are auto-generated", **not** as evidence of any format.

---

## 2. Invoice line maths — where the legacy system is wrong

The controller (`InvoiceController@store`) computes, per line:

```
$item->subtotal  = ($qty * $unit) + $vatAmount     // ← ALREADY VAT-INCLUSIVE
$item->vatamount = $vatAmount
$invoice->total    = Σ $subtotal                    // ← therefore also VAT-inclusive
$invoice->totalvat = Σ $vatAmount
```

The **print template** then renders:

| Column | Expression | Correct? |
|---|---|---|
| `UNIT PRICE (AED)` | `sperateNumber($item->subtotal)` | ❌ prints the line **total**, not the unit price |
| `QTY` | `$item->qty` | ✅ |
| `VAT %` | `$item->vat` | ✅ |
| `VAT AMOUNT` | `sperateNumber($item->vatamount)` | ✅ |
| `AMOUNT (INCL VAT)` | `sperateNumber($item->vatamount + $item->subtotal)` | ❌ **VAT counted twice** |
| `SUBTOTAL` (footer) | `sperateNumber($inv->total)` | ⚠️ labelled "subtotal" but is VAT-inclusive |
| `VAT` (footer) | `sperateNumber($inv->totalvat)` | ⚠️ memo only — must **not** be added again |
| `TOTAL AMOUNT` | `sperateNumber($inv->totalvat + $inv->total)` | ❌ **VAT counted twice again** |

**The correct model** (confirmed by the real Tax Invoice `DSINV/26-172`, where
22,020 + 650 + 200 + 4,500 = 27,370 with VAT 0 on every line):

```
lineNet       = unitPrice × qty
lineVat       = lineNet × vat% / 100
lineAmount    = lineNet + lineVat            // "Amount (incl VAT)"
Sub Total     = Σ lineAmount                 // already VAT-inclusive
VAT (footer)  = Σ lineVat                    // memo
Total Amount  = Sub Total                    // NOT Sub Total + VAT
```

> **Do not port the legacy invoice arithmetic.** See
> [`../02-business-documents/invoices.md`](../02-business-documents/invoices.md) §5.

---

## 3. Ledger maths

`CalculateDebitCredit()` recomputes `users.debit` and `users.credit` by summing the `fins` rows for
that user. Called after every ledger write.

Running-balance display (`admin/fins/preview.blade.php`):

```
$debit  = Σ $fin->debit
$credit = Σ $fin->credit
balance = $debit > $credit ? $debit - $credit
        : $debit > $credit ? $debit - $credit   // ← duplicate condition
        : 0                                     // ← credit > debit always prints 0
```

Two defects:
1. **The second branch is a copy of the first**, so a credit-side balance always renders `0`
   instead of a negative figure. The same duplicated-condition pattern appears in
   `admin/manifest/report.blade.php` and `admin/invoices/index.blade.php`.
2. **The statement is ordered newest-first** (`orderby('created_at','desc')`) while accumulating a
   running balance from the top of the list — so the running balance column is meaningless. A
   statement must be ordered **ascending** to carry a balance.

The real TallyPrime statement
([`../02-business-documents/statements-of-account.md`](../02-business-documents/statements-of-account.md))
does the opposite and does it correctly: ascending, running balance, both signs shown.

---

## 4. Voyage number — the key is wrong

`generateVoyage` is keyed on the **`Portshipper`** record (a port + shipper pairing), producing
`nn/yy`.

The employer's rule (`REQ-040`, `EMP-315`–`EMP-331`) is:

> `n/yy` counted **per vessel + per destination + per year**, restarting at 1 for each new
> destination and each new year.

Because the legacy system has **no Vessel master at all** (vessel is a free-text string on
`Loading`, `Manifest` and `Bl`), it *cannot* implement the employer's rule. The legacy behaviour is
therefore not a competing business rule — it is a **consequence of a missing entity**.

The new system's `NumberingSequence` model supports `scopeType` values
`GLOBAL | DESTINATION | YEAR | YEAR_PERIOD`, which can express the employer's rule.

---

## 5. Manifest report (voyage P&L)

`admin/manifest/report.blade.php` computes:

```
total_cost   = gas_cost + lashing_cost + shipper_cost + pod_cost + pol_cost
total_income = Σ invoice.total            // net of VAT
total_income_paid   = Σ invoice.total where status = PAID
total_income_unpaid = Σ invoice.total where status = UNPAID
profit/loss  = total_income − total_cost
```

Observations:

| Point | Assessment |
|---|---|
| Cost categories | Five fixed columns on the manifest. The employer named charter, Port Use, Handling, Lashing and miscellaneous (`REQ-191`) — **three of the five match**, "charter" and "misc" have no legacy column |
| Income basis | Uses `invoice.total`, which is **VAT-inclusive** in the legacy model (see §2) — so legacy income is overstated by the VAT amount |
| Income scope | Only invoices whose `manifest_id` is set — i.e. invoices linked to that manifest's B/Ls ✓ matches `REQ-192` |
| Paid/unpaid split | ✓ aligns with the employer's "Paid / Partial / Unpaid" reporting need (`REQ-183`) |
| Partial payments | **Not representable** — `Invoice.status` is only `PAID` or `UNPAID` |

---

## 6. Days in port

`admin/loading/index.blade.php` and `admin/loading/preview.blade.php` both compute:

```php
$create = Carbon::parse($lo->arrival_date);
$loadi  = $lo->loading_date
            ? Carbon::parse($lo->loading_date)
            : Carbon::now();
$diff   = $create->diffInDays($loadi);
```

i.e. **days in port = loading date − arrival date, falling back to *today* when not yet loaded.**

This matches `REQ-069` / `REQ-070` exactly, and adds the fallback behaviour (which the employer did
not state — it is an **inference** in [`../01-employer-statements/business-rules.md`](../01-employer-statements/business-rules.md) R3.7).

---

## 7. Aggregates

| Aggregate | Where computed | Rule |
|---|---|---|
| `Manifest.total_unit`, `total_weight` | On every write | Σ over the manifest's loadings/B-Ls |
| `Bl.total_unit`, `total_weight` | On every write | Σ over the B/L's items |
| `Invoice.total`, `totalvat`, `btotal` | On every write | See §2 |
| `Performa.total`, `total_net`, `total_gross` | On every write | `total = Σ line totals + insurance` |
| `User.debit`, `User.credit` | After every ledger write | `CalculateDebitCredit()` |

---

## 8. Rounding and formatting

- Money is stored as MySQL `DECIMAL`; no explicit rounding helper is used in PHP — rounding is
  delegated to the database.
- Display uses `sperateNumber()` (thousands separator).
- Dates display through `engdate()` and `engdate2()` (Gregorian) and the `morilog/jalali` package is
  available for Persian dates.

---

## 9. Summary — what to port and what to reject

| Behaviour | Port? | Reason |
|---|---|---|
| Days-in-port = loading − arrival, fallback to today | **Yes** | Matches `REQ-070`; the fallback is a sensible inference |
| Manifest P&L = Σ manifest invoices − five stored costs | **Partly** | Structure is right; income must be **net of VAT** and the cost categories must be configurable |
| Ledger: invoice → debit, payment/receipt → credit | **Yes** | Matches `REQ-150` / `REQ-151` |
| Running balance on a statement | **Yes, but fix it** | Must be ascending order and must handle both signs |
| Invoice line/total arithmetic | **No** | Double-counts VAT |
| Any number-generation format | **No** | Random components; prefixes disagree with real documents |
| Voyage counter keyed on port + shipper | **No** | Wrong key; the employer's key is vessel + destination + year |
| Customer code `'CUST00' . id` | **No** | Not configurable, collision-prone |
| 'CUST00' prefix itself | **Yes** | Matches `REQ-014`'s prefix |
