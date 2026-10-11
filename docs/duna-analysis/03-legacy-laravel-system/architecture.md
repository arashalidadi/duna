# Legacy Laravel — Architecture

> Technical structure of the old system. This explains *how* it was built, which in turn explains
> *why* it cannot express many of the employer's requirements.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Laravel 10.10 (`laravel/framework ^10.10`), PHP ^8.1 |
| Auth | Laravel session auth + Sanctum (`laravel/sanctum ^3.3`); `api_token` column on `users` |
| Views | Blade, 68 views, 15,409 LOC, Bootstrap 5 admin template |
| Forms | `laravelcollective/html ^6.4` (`{!! Form::open(...) !!}`) |
| Excel | `maatwebsite/excel ^3.1` (used only for a non-existent export class — defect **D9**) |
| Dates | `morilog/jalali 3.*` for Persian calendar; `engdate()` / `engdate2()` helpers for Gregorian display |
| HTTP | `guzzlehttp/guzzle ^7.2` |
| Front-end | jQuery + jQuery `printPreview` plugin for printing; CKEditor-style rich text for Offer/Quotation bodies |
| DB | Configurable; `config/database.php` present, connection details in `.env` (redacted here) |
| Queue / cache | Standard Laravel drivers, configured by env |

---

## 2. Request flow

```
Browser
  └─► routes/web.php
        ├── middleware 'admin' (AdminMiddleware)  → /admin/*        (back office)
        └── middleware 'user'  (UserMiddleware)   → /profile/*      (customer portal)
              │
              └─► Controller (app/Http/Controllers/Admin|Front)
                    ├─► Eloquent model (app/Models)
                    ├─► helpers (app/Helpers/helpers.php, app/Helpers/order.php)
                    └─► Blade view (resources/views/...)
```

Middleware aliases are registered in `app/Http/Kernel.php`: `admin`, `user`, plus the stock Laravel
set. Both custom middleware are **level checks only** — they do not inspect permissions.

```php
// AdminMiddleware
if (Auth::user()->level == 'Admin') return $next($request); else abort(403);

// UserMiddleware
if (Auth::user()->level == 'User')  return $next($request); else abort(403);
```

---

## 3. Authorization model

Two independent layers, applied inconsistently:

| Layer | Mechanism | Where used |
|---|---|---|
| **Tier** | `level` column checked by middleware | All `/admin/*` and `/profile/*` routes |
| **Permission** | `roles` ↔ `permissions` pivot, checked in Blade with `@can('…')` | Individual buttons and menu items |

**Permissions gate the UI, not the server.** The permission checks seen in the views are Blade
`@can(...)` directives around buttons. Controllers generally do **not** re-check permissions, so a
permission is a UI affordance rather than a server-side guarantee.

Permissions are dot-namespaced strings, e.g.:

```
loadings.show   loadings.new   loadings.edit   loadings.delete
loadings.yards  loadings.ports loadings.adminapprove
loadinglist.show
manifest.show   manifest.create manifest.shipper
manifest.agents.show  manifest.consignee.show  manifest.report
bl.new          bl.delete
release.manager
invoice.show    invoice.create invoice.edit  invoice.delete
invoice.payment
ledger.show     ledger.payment ledger.reciept  ledger.edit  ledger.delete
offer.show      quotation.show  performa.show
user.index      user.create     users.newcustomer
permission.index  role.index     setting.general
dashboard (implicit)
```

See [`permissions.md`](permissions.md) for the full list and the role mapping.

---

## 4. Application structure

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Admin/  (13 controllers)
│   │   │   ├── DashboardController   ManifestController
│   │   │   ├── FinController         InvoiceController
│   │   │   ├── LoadingController     UserController
│   │   │   ├── OfferController       QuotationController
│   │   │   ├── PerformaController    RoleController
│   │   │   ├── PermissionController  ConfigController
│   │   │   └── AuthController
│   │   └── Front/
│   │       └── ProfileController     (customer portal)
│   └── Middleware/  AdminMiddleware, UserMiddleware
├── Models/          23 Eloquent models
├── Helpers/
│   ├── helpers.php  (kv, kvset, engdate, sperateNumber, generate*Number, …)
│   └── order.php
resources/views/
├── admin/           (modules: loading, manifest, invoices, fins, users, roles,
│                     permissions, settings, offer, quotation, performa, dashboard)
├── profile/         (customer portal views)
└── layouts/         admin.blade.php
routes/
├── web.php          (all application routes)
├── api.php          (a single stock /user route — effectively unused)
└── console.php
database/
├── migrations/      4 stock migrations only
└── seeders/         empty DatabaseSeeder
```

---

## 5. Patterns worth knowing

### 5.1 Fat controllers, thin models
Business logic lives in controllers (e.g. `ManifestController` handles manifest creation, B/L
creation, manifest↔B/L attachment, consolidation and reporting). Models declare `$fillable`,
relations and status constants, and little else.

### 5.2 Line items are client-side string encodings
Invoice and Performa lines are posted as delimited strings and split server-side:

```php
$tgh = explode('~~', $it);      // invoice: qty~~descr~~unit~~vat
$item->qty    = intval($tgh[0]);
$item->descr  = $tgh[1];
$item->unit   = (float) $tgh[2];
$item->vat    = $tgh[3];
```

There is no server-side validation of these strings — a malformed line produces a PHP notice or a
silent zero.

### 5.3 Settings as a key/value table
`KeyValue` + the `kv()` / `kvset()` helpers. Settings — including logo, letterhead, signature and
watermark images — are read on every page render. File uploads for settings are handled inline in
`ConfigController@saveSettings` with a hard-coded list of keys.

### 5.4 Soft delete by convention, not by trait
`deletedAt` columns exist on several models, but the pattern is inconsistent — some controllers
`->delete()` directly, others filter `whereNull('deletedAt')`.

### 5.5 Printing via jQuery `printPreview`
Print output is produced by a jQuery plugin that clones a DOM region
(`$('#print').printPreview({ obj2print:'#printarea' })`). There is **no server-side PDF generation at
all** — no DOMPDF, no Snappy, no headless browser.

> This is the direct reason the employer asks for PDF output with stamps and Print output without
> them (`REQ-121`, `REQ-122`): today everything is a browser print, and the stamp is applied to paper
> afterwards.

### 5.6 Excel export declared but not implemented
`maatwebsite/excel` is a dependency and `UserController@export` exists, but it references
`App\Exports\UsersExport`, which is not in the archive (defect **D9**).

---

## 6. Known architectural gaps versus the employer's needs

| Employer need | Legacy architecture | Consequence |
|---|---|---|
| **PDF / Excel / Print outputs** (`REQ-120`) | Print only (jQuery); no PDF engine | Cannot satisfy as built |
| **Uploadable document templates** (`REQ-124`) | Only a few global image settings (letterhead, signature, watermark) | No per-document-type templating |
| **Vessel & Voyage masters** (`REQ-037`, `REQ-040`) | Free-text strings; voyage counter on `Portshipper` | Cannot key the voyage per vessel+destination |
| **Job costing** (`REQ-130`) | No Job entity | Not representable |
| **Agent portal, port-scoped** (`REQ-187`) | One `User`-level portal, unscoped | Not representable |
| **Server-enforced scoping** | Permissions only gate Blade buttons | A determined user can reach unscoped data |
| **Audit trail** | No `AuditLog`; `createdBy`-style fields on some tables only | Not representable |
| **Attachments** (`REQ-168` ID cards) | Ad-hoc: `Fin.ID_doc` path, `Loading` docs upload | No general attachment service |
| **Multi-currency** | Free-text currency fields on Invoice/Performa/BL | No rate handling |
| **Notifications / alerts** (`REQ-154`, `REQ-184`) | None | Not representable |

---

## 7. What the new system deliberately does differently

For the full comparison see
[`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).
In summary: the new system replaces helpers with a configurable `NumberingSequence`, replaces image
settings with versioned `DocumentTemplate`s, adds first-class Vessel/Voyage/Job/Invoice entities,
adds `AuditLog` and `FileAttachment`, and enforces permissions server-side.
