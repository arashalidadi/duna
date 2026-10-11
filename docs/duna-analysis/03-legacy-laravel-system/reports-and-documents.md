# Legacy Laravel — Reports & Documents

> Every document the legacy system can produce, compared with the real document set in
> [`../02-business-documents/`](../02-business-documents/).

---

## 1. Documents the legacy system produces

| # | Document | Route | Mechanism | Printable |
|---|---|---|---|---|
| 1 | Load List | `/admin/loading-list/list/preview/{id}` | Blade | ✅ browser print |
| 2 | Manifest | `/admin/manifests/preview/{id}` | Blade | ✅ browser print |
| 3 | Bill of Lading | `/admin/manifests/bl/preview/{id}` | Blade | ✅ browser print |
| 4 | Tax Invoice | `/admin/invoices/view/{id}` | Blade | ✅ browser print |
| 5 | Payment Voucher | `/admin/ledger/{id}` | Blade | ✅ browser print |
| 6 | Receipt Voucher | `/admin/ledger/{id}` | Blade | ✅ browser print |
| 7 | Ledger statement | `/admin/ledger/preview` | Blade | ✅ browser print |
| 8 | Proforma Invoice | (performa preview) | Blade | ✅ browser print |
| 9 | Offer | (offer view) | Blade + rich text | ✅ browser print |
| 10 | Quotation | (quotation view) | Blade + rich text | ✅ browser print |
| 11 | Manifest Report (voyage P&L) | `/admin/manifest-report` | Blade | ✅ on-screen + print |

**No PDF export anywhere.** There is no PDF library in `composer.json` and no server-side rendering
path — every "document" is a Blade page printed by the browser via the jQuery `printPreview` plugin.

---

## 2. Coverage against the real document set

| Real document (from [`document-catalog.md`](../02-business-documents/document-catalog.md)) | Legacy equivalent | Gap |
|---|---|---|
| Tax Invoice (`DSINV/26-172`) | ✅ Invoice print | Prefix is `DSAED/`, not `DSINV/`; unit-price column prints the line total; VAT double-counted in the footer |
| Proforma Invoice (`DSPRO/26-001`) | ✅ Performa print | Prefix transposed (`SDPRO`); a genuine "Proforma Invoice" title required |
| Quotation (`DSQUO/25-017`) | ⚠️ Quotation page | Legacy quotation is a free-text body; the real quotation is a **line-item table** |
| Bill of Lading (`KHS/20261104`) | ✅ B/L print | Number format differs; no draft state; no release state |
| Manifest (`DSMAN/KHO-26-006`) | ✅ Manifest print | Template prints `VESSEL = DUNA SHIPPING LLC` (defect **D11**) |
| Receipt Voucher (**No. `477`**) | ✅ Receipt voucher | Voucher numbering differs: the real voucher is a **plain sequential number (`477`)**, whereas the legacy uses a three-series scheme (`DSAO/26-097` in our specimen). **Corrected 2026-10-11:** an earlier revision of this row cited a “real” number `DSR/26-190`; that string is fabricated and appears in no extracted document (error **E1**). |
| Statement of Account (TallyPrime ledger) | ⚠️ Ledger statement | Has an opening balance, running balance and the same double-entry columns — but the code has two bugs (see [`calculations.md`](calculations.md) §3) |
| Delivery Order | ❌ none | Not implemented at all |
| Company Archive | ❌ none | Not implemented at all |

---

## 3. Load List

**Header:** App title from `kv('app_title')`, address, tel1, tel2, email.
**Columns:**

```
NO | CUSTOMER | SHOWROOM | DESCRIPTION (CHNO) | QTY | YARD | DATE ARRIVAL | INSP. STATUS | DATE OF LOAD | NO OF DAYS
```

**Notes:**
- `DESCRIPTION (CHNO)` renders `qtydescr` + `chno` — consistent with the employer's description of
  the load list (`REQ-085`).
- `NO OF DAYS` uses the formula in [`calculations.md`](calculations.md) §7.
- There is no signature block, no stamp, no PDF.

---

## 4. Manifest

**Header:** Company name, address, tel, email, plus a `letterhead` image from `kv('letterhead')`.
**Body:**

- Vessel name — **hard-coded in the template as `VESSEL = DUNA SHIPPING LLC`** (defect **D11**).
- Voyage, POL, POD.
- Shipper / Consignee / Agent blocks.
- Item table: `NO | CUSTOMER | SHOWROOM | DESCRIPTION (CHNO) | QTY | UNIT | WEIGHT`.
- Totals: `total_unit`, `total_weight`.
- Cost columns: `gas`, `lashing`, `shipper`, `pod`, `pol`.
- Footer: signature image (`kv('signature')`), watermark (`kv('watermark')`).

**Critical defect:** the vessel is hard-coded. The real manifest in
[`document-catalog.md`](../02-business-documents/document-catalog.md) shows:

```
VESSEL: BARGE MEHDI 11 / TUG LAYAN GULF
```

so the legacy template could **never** have produced a correct manifest for any vessel.

---

## 5. Bill of Lading

**Header:** Company name, address, tel, email, letterhead.
**Body:**

- B/L number (randomly generated — defect **D13**).
- Vessel, voyage, POL, POD.
- Shipper / Consignee / Notify Party.
- Marks & numbers, description of goods, quantity, net weight.
- Place and date of issue.
- Signature image and watermark.

**Status:** `status` is displayed but is always `PENDING` (defect **D1**); `bl_status` (`-` /
`SURRENDERED`) is displayed separately. There is no draft watermark and no release stamp.

---

## 6. Tax Invoice

**Header:** Company name, address, tel1, tel2, email, letterhead.
**Body:**

- Invoice number (`DSAED/{rand6}` — defect **D13** and a wrong prefix).
- Date.
- Customer block: first name, last name, address, email, mobile.
- Line table: `NO | DESCRIPTION | UNIT PRICE (AED) | QTY | VAT | AMOUNT (AED)`.
- Footer: `Sub Total`, `VAT`, `Total Amount`, plus `btotal` (balance) and `aed_account_details`
  from `kv()`.

**Defects:**

| # | Defect |
|---|---|
| D3 | The preview reads `$inv->number` but the column is `code` — the number prints as null |
| D4 | Footer renders `vatamount + subtotal` where `subtotal` already includes VAT — VAT is **double-counted** |
| D5 | The `UNIT PRICE (AED)` column prints the line **total**, not the unit price |

**Correct maths** (confirmed against the real `DSINV/26-172` in
[`invoices.md`](../02-business-documents/invoices.md)):

```
lineNet    = unit × qty
lineVat    = lineNet × vat% / 100
lineAmount = lineNet + lineVat
Sub Total  = Σ lineAmount          ← already VAT-inclusive
footer VAT = memo only             ← NOT added again
Total      = Sub Total
```

---

## 7. Vouchers (payment / receipt)

**Payment voucher** (`FinController@submitPayment`):

- Customer, amount, description, note.
- Optional **ID-card upload** (`ID_doc`) → `assets/imgs/id_docs/`.
- Writes a `Fin` row with `type='payment'`.

**Receipt voucher** (`FinController@submitReciept`):

- Customer, amount, description, note.
- **No ID-card field.**
- Writes a `Fin` row with `type='reciept'`.

Both are printed from the same `/admin/ledger/{id}` view. The employer's payment form
(`REQ-166`) asks for: customer, amount, note, description, date, ID-card upload, **and an allocation
to one or more invoices** — the legacy payment form has no allocation.

---

## 8. Ledger statement

`/admin/ledger/preview` with a date range produces:

```
Opening balance (from the last row before the range, or the customer's opening debit/credit)
   ↓
NO | DATE | REF | DESCRIPTION | DEBIT | CREDIT | BALANCE
   ↓
Totals row
```

The shape matches the real TallyPrime Statement of Account in
[`statements-of-account.md`](../02-business-documents/statements-of-account.md), which is good
evidence that the employer's ledger conventions did not change.

**Two bugs** break the display (see [`calculations.md`](calculations.md) §3):

1. The balance branch has a duplicated `$debit > $credit` condition, so credit-side balances print `0`.
2. Rows are ordered `desc` while the running balance accumulates in ascending order — the running
   balance is computed against the wrong direction.

---

## 9. Manifest Report (voyage P&L)

`/admin/manifest-report` — the only true "report" in the system.

**Input:** a date range plus a shipper filter.

**Output rows:**

- Party: consignee, agent.
- Vessel / voyage / POL / POD.
- Date.
- **Income** = Σ totals of the invoices linked to the manifest.
- **Costs** = the manifest's `gas`, `lashing`, `shipper`, `pod`, `pol`.
- **Profit** = income − costs.

**Against `REQ-190`–`REQ-194`:** the employer's shipping-cost report is keyed by **vessel + voyage +
shipper + consignee + agent** with lines for B/L fees, gas, lashing and other charges. The legacy
report is close in shape but:
- It has no B/L-fee line (`REQ-191` item 1).
- It has no "other charges" line (`REQ-191` item 2).
- It is keyed on the manifest, and the voyage counter is wrong (defect **D12**).

---

## 10. Settings that affect documents

All stored in `key_values` and read at render time:

| Key | Used by |
|---|---|
| `app_title` | Every header |
| `address`, `tel1`, `tel2`, `email` | Every header |
| `letterhead` | Manifest, B/L, Invoice |
| `signature` | Manifest, B/L, Invoice |
| `watermark` | Manifest, B/L |
| `light_logo`, `dark_logo`, `favicon`, `mag_logo`, `login_poster`, `shop_header` | Chrome |
| `admin_paginate_number` | List pagination |
| `default_role`, `default_avatar` | User creation |
| `aed_account_details` | Invoice footer (bank details) |

**This is the closest thing the legacy system has to document templates** — a handful of global
images plus text. The employer's `REQ-124` (upload per-document-type templates, 9 types, with
versioning) is a substantial step up.
