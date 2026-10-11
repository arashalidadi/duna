# Legacy Laravel — Business Rules (as implemented)

> Rules the legacy code **actually enforces**, as opposed to rules the employer asked for.
>
> **This is evidence, not specification.** A legacy rule is proof that someone once behaved that way;
> it is not proof that the behaviour is still wanted. Where a legacy rule conflicts with an employer
> statement, the employer wins.

---

## 1. Rules the code enforces

| # | Rule | Where | Verdict vs employer |
|---|---|---|---|
| L1 | Cargo (Loading) requires a customer, POL, POD | `LoadingController` / intake form | ✅ matches `REQ-060` |
| L2 | Selecting a POL filters the Yard picker | Intake form | ✅ matches `REQ-036` |
| L3 | Days in port = loading date − arrival date, else today | `loading/index.blade.php` | ✅ matches `REQ-070`; fallback is an inference |
| L4 | Cargo not loaded stays `INYARD` | `loading_status` | ✅ matches `REQ-093` |
| L5 | A B/L belongs to a manifest | `ManifestController@createbl` | ❌ opposite of the employer's B/L-before-Manifest order |
| L6 | B/L parties default from the manifest | `createbl` | ❌ employer wants parties per B/L |
| L7 | B/L `status` is always `PENDING` | `createbl` | ❌ contradicts `REQ-180`–`REQ-182` |
| L8 | One manifest per voyage (by convention) | `ManifestController` | ✅ directionally matches `REQ-110` |
| L9 | Manifest carries gas / lashing / shipper / pod / pol costs | `manifests` table | ⚠️ partial match with `REQ-191` |
| L10 | Manifest totals recomputed on every write | `ManifestController` | ✅ matches `REQ-112` |
| L11 | Invoice lines carry a VAT percentage | `invoiceitems.vat` | ✅ matches `REQ-144` |
| L12 | Invoice totals recomputed on every write | `InvoiceController` | ✅ but the maths is wrong — see [`calculations.md`](calculations.md) §2 |
| L13 | Invoice status is `PAID` or `UNPAID` only | `Invoice` model | ❌ no Partial state vs `REQ-149` |
| L14 | Issuing an invoice writes a `Fin` row with `debit` | `InvoiceController` | ✅ matches `REQ-150` |
| L15 | Receipt writes a `Fin` row with `credit` | `FinController@submitReciept` | ✅ matches `REQ-151` |
| L16 | Payment writes a `Fin` row with `debit` | `FinController@submitPayment` | ✅ matches `REQ-166` (money out = debit) |
| L17 | Payment form can upload an ID document | `Fin.ID_doc` | ⚠️ partial match with `REQ-168` |
| L18 | Ledger rows can be edited and deleted | `ledger.edit`, `ledger.delete` | ⚠️ not addressed by the employer; mutability of posted ledger rows is questionable practice |
| L19 | A ledger row may be created with no allocation | `FinController` | ✅ matches `REQ-165` |
| L20 | Balance = debit − credit, recomputed after every write | `CalculateDebitCredit()` | ✅ matches `REQ-161` (display is buggy, not the rule) |
| L21 | Five manifest cost columns drive the P&L | `manifest/report.blade.php` | ⚠️ partial match with `REQ-191` |
| L22 | P&L income = Σ manifest-linked invoice totals | `manifest/report.blade.php` | ✅ matches `REQ-192` |
| L23 | Roles carry a permission set; UI elements are gated by `@can` | Blade views | ⚠️ employer only asked for an "Access Control" section (`REQ-001`) |
| L24 | Only `level='Admin'` reaches `/admin/*` | `AdminMiddleware` | ✅ |
| L25 | Only `level='User'` reaches `/profile/*` | `UserMiddleware` | ✅ |
| L26 | New users get the role named by `kv('default_role')` | `UserController` | – |
| L27 | Deleting a role reassigns its users to role id 8 | `RoleController@destroy` | ⚠️ hard-coded — a defect, not a rule |
| L28 | Performa totals include insurance; `total = Σ lines + insurance` | `PerformaController` | ⚠️ not stated by the employer |
| L29 | Offers and Quotations are single free-text HTML bodies | `Offer`, `Quotation` models | ❌ cannot reproduce the line-item table in the real `DSQUO/25-017` |

---

## 2. Rules the code does NOT enforce (gaps)

| # | Missing enforcement | Employer requirement |
|---|---|---|
| G1 | **Inspection does not gate the load list.** Nothing checks `inspection_status` before a cargo is added to a load list | `REQ-082` — a hard precondition, must raise an error |
| G2 | No validation that an optional field is optional — but equally no validation that it is well-formed | `REQ-200` |
| G3 | No B/L draft lifecycle, no DRAFT watermark | `REQ-104` |
| G4 | No release action — `status` never leaves `PENDING` | `REQ-180`–`REQ-182` |
| G5 | No partial-payment state on invoices | `REQ-149` |
| G6 | No per-destination / per-agent data scoping | `REQ-187` |
| G7 | No job or cost-note concept | `REQ-130`–`REQ-135` |
| G8 | No cargo comment surfaced to accounting | `REQ-067` |
| G9 | No vessel master; vessel names are free text with no validation | `REQ-037`, `REQ-040` |
| G10 | No sequential, reproducible numbering | `REQ-013`, `REQ-102`, `REQ-114` |
| G11 | No due date / payment deadline on invoices | `REQ-147` |
| G12 | No alerts of any kind | `REQ-154`, `REQ-184` |
| G13 | No audit trail | — |
| G14 | No overtime / salary / payroll | `REQ-169`, `REQ-170` |
| G15 | No delivery order | `REQ-185`, `REQ-186` |

---

## 3. Conventions visible in the data (not enforced, but followed)

These are conventions inferred from how the code writes data. They are **weak** evidence.

| Convention | Evidence |
|---|---|
| Port name is stored as one "Port, City, Country" string | `ports.title` values; `REQ-030` asks for three fields |
| Port abbreviation is uppercase and short (3 letters) | `HAM` in the employer's own example |
| Yard names are short alphanumeric codes (`F15`, `B15`, `A09`) | Yard examples; `A09 YRD` in the SOA narration |
| Vessels are named, sometimes with a number (`MEHDI 11`, `DAHAR 10`, `ZAM ZAM`) | Free-text values |
| Tug and barge are written as two names when applicable | The real manifest ("BARGE MEHDI 11 / TUG LAYAN GULF") |
| Voyage is `nn/yy` | Everywhere |
| Customers are referred to by `user_code` in UIs | Every customer dropdown renders `fname lname — user_code` |

---

## 4. How to use this file

1. **Do not port L5, L6, L7, L13, L27 or L29.** They are known defects or known divergences.
2. **Port L1–L4, L14–L16, L19, L20, L22** — these match employer requirements.
3. **Treat L9, L17, L21, L23, L28 as open questions**, not rules.
4. **Close the G-list in the new system where the employer asked for it** — see
   [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).
