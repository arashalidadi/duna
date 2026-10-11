# Legacy Laravel System — Overview

> **Status: HISTORICAL EVIDENCE ONLY.**
> This is Duna's *previous* dashboard. It is **not** the specification for the current system, and
> nothing in this folder should be used to justify deleting a current feature just because the old
> system lacked it.
>
> **Source:** `docs/duna-analysis/legacy-source/duna-clean.zip` (16.9 MB, 2,489 entries — 2,215 of
> them under `assets/`). For analysis, the 199 non-asset files were extracted to a scratch directory
> (`/tmp/legacy/src/duna-clean/`, not persisted).
>
> **Companion:** `docs/duna-analysis/legacy-source/docs-legacy/*.md` — a *previous AI analysis* of
> this same codebase. It is useful but **partly wrong**; see §6.

---

## 1. What the archive contains

| Metric | Value |
|---|---|
| Total ZIP entries | 2,489 |
| Under `assets/` (images, fonts, vendor JS/CSS) | 2,215 |
| Application files analysed | 199 |
| PHP application code | **22,833 LOC** |
| Blade view code | **15,409 LOC across 68 views** |
| Eloquent models | 23 |
| Controllers | 15 |
| Migrations | **4** (all stock Laravel — see §4) |
| Seeders | 1 (empty) |

**Framework:** Laravel 10 (`laravel/framework ^10.10`), PHP ^8.1.
**Dependencies:** `laravel/sanctum ^3.3`, `laravel/tinker`, `laravelcollective/html ^6.4`,
`maatwebsite/excel ^3.1`, `morilog/jalali 3.*` (Persian calendar), `guzzlehttp/guzzle ^7.2`.
**Dev:** phpunit, mockery, faker, pint, sail, collision, ignition.

Config present: `.env` (values redacted in this analysis — see `source-code-reference.md`),
`config/database.php`, standard Laravel config tree.

---

## 2. What the system is

A **server-rendered Laravel admin panel plus a customer portal**, in Persian, built on a Bootstrap-5
admin template. It handles:

- Master data: Ports, Yards, Vessels, Shippers, Consignees, Agents, Customers (= `User` records with
  `level='User'`)
- Operations: Loading (cargo intake + load lists), Loading Lists
- Documents: Manifests, Bills of Lading
- Commercial: Invoices, Quotations, Offers, Performa (Proforma)
- Finance: `Fin` rows (ledger), Payment/Receipt vouchers, Release Manager, Manifest Report
- Access: Users, Roles, Permissions (fine-grained), Settings (key/value)

**Two access tiers**, enforced by two middleware classes:
`AdminMiddleware` (requires `level == 'Admin'`) and `UserMiddleware` (requires `level == 'User'`).
There is **no** per-port or per-agent scoping anywhere — see §5.

---

## 3. Module map

```
Dashboard (counts only)
│
├── Loading                         ← cargo intake + load lists
│   ├── All loading
│   ├── Loading List (create/preview)
│   ├── Add new
│   ├── Yards
│   └── Ports
│
├── Manifest/BL
│   ├── All Manifest / Create Manifest
│   ├── All BL
│   ├── Shipper
│   ├── Agent
│   └── Consignee
│
├── Accounting
│   ├── Ledger
│   ├── Manifest Report
│   ├── Release Manager
│   ├── All Invoices / New Invoice
│   ├── Offers
│   ├── Quotations
│   └── Proforma (Performa)
│
├── Users
│   ├── All Users / New User
│   ├── Permissions
│   └── Roles
│
├── New Customer
└── Settings (General)
```

**Customer-facing portal** (separate route group, `ProfileController`): dashboard, invoices, B/Ls,
fins/ledger, offers, quotations, performas, edit profile.

---

## 4. The single most important structural fact

> **The schema was never migrated.** Only the four stock Laravel migrations exist
> (`users`, `password_reset_tokens`, `failed_jobs`, `personal_access_tokens`) — and the `users`
> migration is the *default* one (`id`, `name`, `email`, `email_verified_at`, `password`,
> `rememberToken`, `timestamps`), which does **not** match the `User` model the application actually
> uses.

Consequences:
1. **The true schema must be reconstructed from the models, controllers and Blade views.** That is
   what [`database-schema.md`](database-schema.md) and [`data-dictionary.md`](data-dictionary.md) do.
2. There is **no schema history** — no way to tell what changed when.
3. Any migration to the new system must be written from the code, not replayed.

---

## 5. Entities the legacy system has

| Entity | Model | Notes |
|---|---|---|
| User (Admin, Customer, Portal user) | `User` | `level` ∈ {Admin, User}; Customer = `level='User'` |
| Role, Permission | `Role`, `Permission` | Pivot `role_permission`, `user_role` |
| Port | `Port` | has `abb` (abbreviation) and `title` |
| Yard | `Yard` | belongs to a Port |
| Shipper | `Shipper` | – |
| Consignee | `Consignee` | – |
| Agent | `Agent` | – |
| Vessel | *(none)* | **Vessels are free-text strings on Loading/Manifest/BL** |
| Loading (cargo) | `Loading` | the central operational record |
| LoadingList | `Loadinglist` | – |
| Manifest | `Manifest` | – |
| Bill of Lading | `Bl` | – |
| Invoice + lines | `Invoice`, `Invoiceitem` | – |
| Fin (ledger row) | `Fin` | debit/credit + type |
| Offer + body | `Offer` | free-text rich document |
| Quotation + body | `Quotation` | free-text rich document |
| Performa + items | `Performa`, `Performa_item` | Proforma |
| Portshipper | `Portshipper` | port + shipper pairing, carries the voyage counter |
| KeyValue | `KeyValue` | runtime settings store |
| CompanySettings-equivalent | `KeyValue` | logo, letterhead, signature, watermark, address, tel, email |

**Entities the legacy system does NOT have** (all of which the employer asked for):

| Missing | Employer requirement |
|---|---|
| **Job / Job Number / job costing** | `REQ-130` – `REQ-135` |
| **Cargo Comment / notes entity** | `REQ-065` – `REQ-067` (only a free-text `note` on Loading) |
| **Vessel master** | `REQ-037`, `REQ-038` (names are free text) |
| **Voyage master** | voyage is a derived string; the counter lives on `Portshipper` |
| **Delivery Order** | `REQ-185`, `REQ-186` |
| **Agent portal** | `REQ-187`, `REQ-188` |
| **Per-port / per-destination scoping** | `REQ-187` |
| **ID-card capture** | `REQ-168`, `REQ-170` |
| **General Journal** | `REQ-166` |
| **Document templates** | `REQ-124` |
| **Salary / Salary Slip** | `REQ-169`, `REQ-170` |
| **Audit log** | – |
| **Notifications / alerts** | `REQ-154`, `REQ-184` |

---

## 6. Relationship to the existing `docs-legacy/` analysis

`docs/duna-analysis/legacy-source/docs-legacy/` contains five markdown files produced by a previous
AI pass over this codebase:

| File | Content |
|---|---|
| `00-OVERVIEW.md` | project summary, module mapping |
| `01-DOMAIN-MODEL.md` | entity/field dictionary |
| `02-WORKFLOWS.md` | workflows, status machines, RBAC, business rules |
| `03-UI-PAGES.md` | UI page inventory |
| `04-DATA-DICTIONARY.md` | data dictionary |

**Verified against the code, `00-OVERVIEW.md` is unreliable.** It marks **Ledger, Salary, Financial
Reports and Letters as "Missing"**, but:

- A **Ledger does exist** — `Fin` model, `admin/fins/*` views, `FinController@getledger` (list) and
  `FinController@preview` (date-ranged statement).
- **Letters** genuinely do not exist — that part is right.
- **Salary** genuinely does not exist — that part is right.
- **Financial Reports** exist in a limited form — `admin/manifest/report.blade.php` (manifest P&L).

**Rule for future agents:** treat `docs-legacy/*.md` as a *prior analysis to be verified*, not as
fact. Where this folder and `docs-legacy/` disagree, the code wins, and this folder reflects the
code.

---

## 7. Known defects found while reading the code

These are recorded because they explain *why* certain legacy behaviours cannot be trusted as
evidence of business intent.

| # | Defect | Location |
|---|---|---|
| D1 | **B/L release status can never become `RELEASED`.** `Bl::RELEASED` is defined but the constant is only ever *read* (in `release.blade.php`); `Bl.status` is only ever *written* as `Bl::PENDING`. The Release Manager screen has no action to change it — only Delete. | `ManifestController@createbl`, `admin/fins/release.blade.php` |
| D2 | **`bl_status` and `status` are two different fields** that look like one. `bl_status` holds `-` or `SURRENDERED`; `status` holds `PENDING`. The Release Manager displays `status`. | `Bl` model, B/L create/edit views |
| D3 | **Invoice preview uses `$inv->number`, but the field is `$inv->code`.** The list view uses `code`; the preview uses `number`. The preview's invoice number therefore renders empty. | `admin/invoices/view.blade.php` vs `InvoiceController@store` |
| D4 | **Invoice line VAT is double-counted in the preview.** `subtotal` already includes VAT, and the "AMOUNT (INCL VAT)" cell renders `vatamount + subtotal`. | `admin/invoices/view.blade.php` |
| D5 | **The "UNIT PRICE (AED)" column actually prints the line total** (`subtotal` = qty × unit + VAT). | `admin/invoices/view.blade.php` |
| D6 | **Quotation list filtering by user returns Offers**, because `QuotationController@index` calls `$user->offers()`. | `QuotationController@index` |
| D7 | **Balance display never handles credit > debit.** Both branches test `$debit > $credit`; the `else` always prints 0. | `admin/fins/preview.blade.php`, `admin/manifest/report.blade.php`, `admin/invoices/index.blade.php` |
| D8 | **The Ledger Account statement is ordered newest-first** while accumulating a running balance from the top — so the running balance is meaningless. | `FinController@preview` |
| D9 | **Dead code referencing non-existent models:** `chargewallet` (`Log`, `wallet`, `bedeh`, `bestan`), `ajaxGetAddress` (`addresses()`, `State`, `City`), `export` (`App\Exports\UsersExport`). | `UserController` |
| D10 | **Role deletion hard-codes `default_role = 8`.** | `RoleController@destroy` |
| D11 | **Manifest template prints `VESSEL = DUNA SHIPPING LLC`** — the company name in the vessel field. (This defect is also present in the real PDF, so it is a template defect the company lives with.) | `admin/manifest/preview.blade.php` |
| D12 | **Voyage counter is keyed on Port + Shipper, not on vessel + destination** — contradicting `REQ-040`. | `Helpers/helpers.php::generateVoyage` |
| D13 | **Invoice numbers, B/L numbers and manifest numbers are partly random** (`rand4` / `rand6`), not sequential. | `Helpers/helpers.php` |
| D14 | **Customer code is `'CUST00' . (lastId + 1)`** — a literal string concat, so ids ≥ 1000 produce codes longer than intended and the prefix is not configurable. | `UserController` |

---

## 8. How to use this folder

| If you want… | Read |
|---|---|
| A one-paragraph summary | this file |
| The reconstructed tables and columns | [`database-schema.md`](database-schema.md) |
| What a field means | [`data-dictionary.md`](data-dictionary.md) |
| What screens exist and what they do | [`modules-and-pages.md`](modules-and-pages.md) |
| How the business flow actually runs in code | [`workflows.md`](workflows.md) |
| Rules the code enforces | [`business-rules.md`](business-rules.md) |
| Money maths | [`calculations.md`](calculations.md) |
| Printed output | [`reports-and-documents.md`](reports-and-documents.md) |
| Roles and permissions | [`permissions.md`](permissions.md) |
| Where to look in the code | [`source-code-reference.md`](source-code-reference.md) |
| Comparison with the current system | [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md) |
