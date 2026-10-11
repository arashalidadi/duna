# Legacy Laravel — Source Code Reference

> A file-by-file map of the archive, so an agent can locate any legacy behaviour without
> re-exploring 199 files.
>
> **Source:** `docs/duna-analysis/legacy-source/duna-clean.zip` (16.9 MB). All paths below are
> relative to the archive root (`duna/`, which is the Laravel project root).

---

## 1. Archive metrics

| Metric | Count |
|---|---|
| Files analysed (non-asset) | **199** |
| PHP LOC | **22,833** |
| Blade LOC | **15,409** |
| Eloquent models | **23** |
| Controllers | **15** (13 admin + 3 front, `Controller.php` base shared) |
| Blade views | **68** |
| Migrations | **4** (all stock Laravel) |
| PHP files | 78 |
| Blade files | 68 |

---

## 2. Controllers

### 2.1 Admin (`app/Http/Controllers/Admin/`)

| File | LOC | Methods | Covers |
|---|---|---|---|
| `ManifestController.php` | 511 | 27 | **The biggest and most important file.** Manifest CRUD, B/L CRUD, manifest↔B/L attach/detach, consolidation, preview, B/L preview, manifest P&L report, shipper / consignee / agent masters, three AJAX endpoints |
| `UserController.php` | 401 | 15 | User CRUD, the second customer-creation path, ban, AJAX address lookup, an `export()` that references a missing class, a wallet charge, and log viewer methods |
| `LoadingController.php` | 391 | 23 | Cargo intake CRUD, management review, days-in-port, yards, ports, document upload/download, load-list CRUD and preview |
| `InvoiceController.php` | 241 | 7 | Invoice list, create, store (line-item string parsing), view/print, edit, update, delete |
| `FinController.php` | 215 | 11 | Ledger list, statement preview, delete, ID-doc download, **submit receipt**, **submit payment**, edit, show/voucher, manifest report, release manager |
| `PerformaController.php` | 197 | 7 | Proforma CRUD + preview; the only pre-sales document with structured line items |
| `QuotationController.php` | 103 | 7 | Quotation CRUD + preview; free-text body |
| `OfferController.php` | 102 | 7 | Offer CRUD + preview; free-text body |
| `RoleController.php` | 78 | 6 | Role CRUD with permission pivot; role deletion reassigns users to id 8 |
| `PermissionController.php` | 52 | 4 | Permission CRUD |
| `DashboardController.php` | 42 | 2 | Six dashboard counts + an image-upload endpoint |
| `ConfigController.php` | 41 | 2 | General settings read/write, incl. logo/letterhead/signature/watermark uploads |

### 2.2 Front (`app/Http/Controllers/Front/`)

| File | LOC | Methods | Covers |
|---|---|---|---|
| `ProfileController.php` | 220 | 9 | **The customer portal**: dashboard counts, invoices, B/Ls, ledger, profile edit, logout |
| `AuthController.php` | 82 | 5 | Admin login, admin logout, customer login, login handler |
| `AjaxController.php` | 11 | 0 | **Empty class** — dead code (defect **D9**) |

### 2.3 Key method index

| Method | File | What it does |
|---|---|---|
| `ManifestController@createbl` | Manifest | Creates a B/L **against a manifest**; copies vessel/voyage/parties; sets `status = PENDING` (never `RELEASED` — **D1**) |
| `ManifestController@ajaxloading` | Manifest | AJAX: cargo available for attachment to a manifest |
| `ManifestController@manireport` | Fin | Voyage P&L (note: the P&L lives in `FinController`, not `ManifestController`) |
| `FinController@getledger` | Fin | Ledger list with customer + date filters |
| `FinController@preview` | Fin | Date-ranged ledger **statement** with running balance (**D7**, **D8**) |
| `FinController@submitreciept` | Fin | Money **in** → `credit`; no ID-doc field — note the misspelling of "receipt" in the method name |
| `FinController@submitpayment` | Fin | Money **out** → `debit`; **has** ID-doc upload |
| `FinController@getrelease` | Fin | Release Manager — **read only** (**D1**) |
| `InvoiceController@store` | Invoice | Parses `qty~~descr~~unit~~vat` strings; recomputes totals (**D4**) |
| `LoadingController@index` | Loading | Cargo list + **days-in-port** calculation |
| `UserController@newcustomer` | User | The **unvalidated** customer shortcut |
| `UserController@export` | User | References the missing `App\Exports\UsersExport` (**D9**) |
| `RoleController@destroy` | Role | Reassigns orphaned users to hard-coded role id 8 (**D10**) |

---

## 3. Models (`app/Models/`)

| File | LOC | Notes |
|---|---|---|
| `User.php` | 99 | `level` (`Admin`/`User`), `user_code`, `debit`, `credit`, `openingdebit`, `openingcredit`, roles relation |
| `Loading.php` | 73 | Cargo. `admin_status`, `inspection_status`, `loading_status`, yard/port/customer relations |
| `Bl.php` | 64 | B/L. `status` (`PENDING`, `RELEASED` — the latter never written), `bl_status` (`-`, `SURRENDERED`), voyage, quantity, net weight, marks |
| `Invoice.php` | 44 | `code` (not `number` — **D3**), `total`, `totalvat`, `btotal`, `status` |
| `Manifest.php` | 41 | `vessel`, `voyage`, `total_unit`, `total_weight`, five cost columns, relations to Bl / Loading |
| `Port.php` | 38 | `title`, `abbreviation` |
| `Fin.php` | 29 | Ledger. `type` (`invoice`/`payment`/`reciept`), `debit`, `credit`, `ID_doc` |
| `Performa.php` | 26 | Proforma header; includes an `insurance` amount |
| `HasRole.php` | 25 | Pivot model for the role↔permission relation |
| `Role.php` | 24 | Roles |
| `Shipper.php` | 23 | Shipper master (note: misspelt `compayname`) |
| `Permission.php` | 22 | Permissions |
| `Portshipper.php` | 21 | **The voyage counter lives here** — port + shipper (**D12**) |
| `Consignee.php` | 21 | Consignee master |
| `Agent.php` | 21 | Agent master |
| `KeyValue.php` | 20 | Settings |
| `Yard.php` | 17 | Yard (port + name) |
| `Loadinglist.php` | 17 | Load list header |
| `Quotation.php` | 16 | Free-text quotation |
| `Performa_item.php` | 16 | Proforma line items |
| `Offer.php` | 16 | Free-text offer |
| `Item.php` | 16 | Manifest items |
| `Doc.php` | 16 | Uploaded cargo documents |

---

## 4. Helpers (`app/Helpers/`)

### 4.1 `helpers.php` (503 LOC) — the most important file for business logic

| Function | Line | Purpose |
|---|---|---|
| `kv($key)` / `kvset($key,$value)` | 26 / 31 | Read/write the `key_values` settings table |
| `englishNumber` / `persianNumber` | 46 / 51 | Digit transliteration |
| `sperateNumber($value)` | 56 | Thousands separators for display |
| `engdate` / `engdate2` / `persiandate` / `persiandate2` / `humandiffdate` | 61–79 | Date formatting |
| `generateToken()` | 84 | Random token |
| `generateActiveCode()` | 100 | Random activation code |
| **`generateBLNumber($port)`** | 115 | B/L number generator (**D13** — random component) |
| **`generateManifestNumber($port)`** | 132 | Manifest number generator (**D13**) |
| **`generateVoyage($shipper,$port)`** | 150 | Voyage counter, keyed on shipper + port (**D12**) |
| `getinvoiceCode()` | 178 | Invoice code generator (**D13**) |
| `getOfferNumber()` / `getQuotationNumber()` / `getPerformaNumber()` | 189 / 200 / 212 | Pre-sales number generators |
| **`CalculateDebitCredit($userid)`** | 223 | Recomputes `users.debit` / `users.credit` (**D7**) |
| `attachBLManifest($bls,$id)` | 240 | Propagates `manifest_id` from B/Ls to their invoices |
| `detachManifest($id)` | 258 | Reverses the propagation |
| `smsSavelog` / `smspanelCredit` / `SendSMS` | 276 / 286 / 321 | SMS gateway integration (Persian) |

> Every number generator is analysed in [`calculations.md`](calculations.md) §1.
> Every aggregation routine is analysed in [`calculations.md`](calculations.md) §2–§5.

### 4.2 `uploadImage.php` (104 LOC)
Image upload helper used by `ConfigController` and `DashboardController`.

### 4.3 `order.php` (30 LOC) — **dead code** (defect **D9**)
Defines constants referencing `Tariff`, `State`, `City`, `Address` models that do not exist:

```php
const UNPAIDSTATUS = 'پرداخت نشده', PAIDSTATUS = 'پرداخت شده';
const MELLATPAYMENT = 'درگاه بانک ملت', DEPOSITEPAYMENT = 'واریز به حساب', SAMANPAYMENT = 'درگاه بانک سامان';
```

These are leftovers from an unrelated e-commerce project that this system was forked from. They are
never used: the invoice status constants in real use are the English `PAID` / `UNPAID`.

---

## 5. Views (`resources/views/`)

| Directory | Files | Purpose |
|---|---|---|
| `admin/dashboard.blade.php` | 1 | Six count cards |
| `admin/loading/` | 9 | `index`, `new`, `edit`, `preview`, `loadinglist`, `newloadinglist`, `editloadinglist`, `port`, `yard`, `docs` |
| `admin/manifest/` | 8 | `index`, `create`, `edit`, `preview`, `report`, `shipper`, `consignee`, `agent` |
| `admin/manifest/bl/` | 4 | `index`, `create`, `edit`, `preview` |
| `admin/invoices/` | 4 | `index`, `create`, `edit`, `view` (the printable invoice — **D3**, **D4**, **D5**) |
| `admin/fins/` | 4 | `ledger`, `preview` (statement — **D7**, **D8**), `showledger` (voucher), `release` (Release Manager — **D1**) |
| `admin/users/` | 5 | `index`, `new`, `edit`, `view`, `newcustomer` |
| `admin/roles/`, `admin/permissions/` | 4 | Access control screens |
| `admin/offer/`, `admin/quotation/`, `admin/performa/` | 12 | Pre-sales documents |
| `admin/settings/` | 1 | `general` |
| `admin/error.blade.php`, `admin/pagination.blade.php` | 2 | Chrome |
| `layouts/` | 3 | `admin`, `login`, `profile` |
| `auth/` | 2 | Admin and customer login |
| `profile/` | 8 | Customer portal |
| `errors/` | 2 | `403`, `404` |

---

## 6. Routes

| File | Content |
|---|---|
| `routes/web.php` | **All** application routes. `/admin/*` under `AdminMiddleware`; `/profile/*` under `UserMiddleware` |
| `routes/api.php` | A single stock `/user` Sanctum route — effectively unused |
| `routes/console.php` | Empty |
| `routes/channels.php` | Empty |

See [`modules-and-pages.md`](modules-and-pages.md) for the full route→page table.

---

## 7. Config & bootstrap

| File | Note |
|---|---|
| `config/*.php` | 17 stock Laravel config files (`app`, `auth`, `cache`, `database`, `excel`, `filesystems`, `mail`, `queue`, `sanctum`, `session`, `view`, …) |
| `config/excel.php` | Present because of `maatwebsite/excel` — but no export class exists (**D9**) |
| `bootstrap/app.php`, `bootstrap/cache/*` | Standard |
| `database/migrations/` | **Only 4 stock migrations.** The entire business schema is un-migrated |
| `database/seeders/DatabaseSeeder.php` | **Empty** — roles and permissions were seeded by hand or by a lost seeder |
| `database/factories/UserFactory.php` | Stock |

> **Consequence:** there is no authoritative schema definition. [`database-schema.md`](database-schema.md)
> is a *reconstruction* from models, controllers and views, and is marked with confidence levels.

---

## 8. Tests

`tests/Unit/ExampleTest.php`, `tests/Feature/ExampleTest.php`, `tests/TestCase.php`,
`tests/CreatesApplication.php` — **all stock Laravel scaffolding. No real tests.**

---

## 9. Naming and spelling traps

Search for these exact strings when grepping the archive:

| Correct | Legacy spelling | Where |
|---|---|---|
| receipt | **`reciept`** | `Fin.type`, `FinController@submitreciept`, permission `ledger.reciept` |
| company | **`compayname`** | `Shipper.compayname` |
| measurement | **`measurment`** | `Loading.measurment` |
| loading | **`LAODING`** | Display strings in some views |
| shifting | **`SHIFITNG`** | Display strings |
| Khorramshahr | **`KHORAMSHHAHR`** | Port name |

Misspellings in identifiers are **load-bearing** — they are column names, enum values and method
names, so they cannot be "fixed" without a migration.

---

## 10. How to re-extract this archive

```bash
mkdir -p /tmp/legacy/src && cd /tmp/legacy/src
unzip -q /path/to/duna-clean.zip
# exclude assets if you only want code:
#   '*/public/*', '*/node_modules/*', '*/vendor/*'
find duna -type f \( -name '*.php' -o -name '*.blade.php' \) | wc -l
find duna -type f \( -name '*.php' -o -name '*.blade.php' \) -exec cat {} + | wc -l
```

`/vendor` and `/node_modules` are **not** in the archive, so `composer install` would be needed to
run the system. This analysis was performed statically; **the system was never executed.**
