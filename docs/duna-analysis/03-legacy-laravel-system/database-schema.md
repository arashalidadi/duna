# Legacy Laravel — Reconstructed Database Schema

> **Why "reconstructed":** the archive contains only the four **stock** Laravel migrations
> (`users`, `password_reset_tokens`, `failed_jobs`, `personal_access_tokens`). The application's real
> schema was created outside migrations — see
> [`system-overview.md`](system-overview.md) §4.
>
> Everything below is derived from: the 23 Eloquent models (`$fillable`, casts, relations,
> constants), the 15 controllers (mass-assignment calls), and the 68 Blade views (field names in
> forms and tables).
>
> **Confidence:** High for field names and relations that appear in `$fillable` or in a form.
> **Medium** for fields only seen in a Blade view (they may not be a `$fillable` column — e.g. the
> non-`$fillable` Loading fields in §3). **Unknown** for types, nullability, indexes and defaults.

---

## 1. Access control

### `users`
Core table. Serves **admins, staff and customers** alike; the discriminator is `level`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | bigint PK | |
| `fname`, `lname` | string | First / last name |
| `compayname` | string? | **Sic — misspelling of `companyname` in the code** |
| `mobile` | string? | |
| `email` | string? | |
| `nationalCode` | string? | |
| `address` | text? | |
| `password` | string | |
| `avatar` | string? | |
| `role_id` | bigint FK → roles | |
| `level` | string | `Admin` \| `User` — the access tier |
| `active` | boolean | |
| `api_token` | string? | |
| `auth` | string? | |
| `user_code` | string | **Customer code**: `'CUST00' . (lastId+1)` |
| `debit` | decimal | maintained by `CalculateDebitCredit()` |
| `credit` | decimal | maintained by `CalculateDebitCredit()` |
| `created_at`, `updated_at` | timestamps | |

Relations: `role`, `permissions` (via role), `cargos`/`loadings`, `bls`, `invoices`, `fins`,
`offers`, `quotations`, `performas`.

### `roles`, `permissions`, `role_permission`, `user_role`
- `roles`: `id`, `name`, `label`, timestamps
- `permissions`: `id`, `name`, `label`, timestamps
- `role_permission`: `role_id`, `permission_id`
- `user_role`: `user_id`, `role_id`

Permission names are dot-namespaced strings, e.g. `loadings.show`, `bl.new`, `manifest.report`,
`release.manager`, `ledger.reciept` (**sic — "reciept"**), `bl.delete`.

### `key_values` (model `KeyValue`)
Runtime settings store, read through the `kv()` helper and written through `kvset()`.
Known keys: `app_title`, `address`, `tel1`, `tel2`, `email`, `admin_paginate_number`,
`default_role`, `default_avatar`, `light_logo`, `dark_logo`, `letterhead`, `signature`, `watermark`,
`favicon`, `mag_logo`, `shop_header`, `login_poster`, `aed_account_details`.

---

## 2. Master data

### `ports`
`id`, `title`, `abb` (abbreviation, used in number generation), `created_at`, `updated_at`.
Relations: `yards`, cargos as POL/POD, voyage origins/destinations, manifests as POL/POD,
`agent_destinations`.

### `yards`
`id`, `port_id`, `title`, timestamps. Relations: `port`, cargos, inventories.

### `shippers`
`id`, `title`, plus contact fields seen in the admin views (name/address/phone/email-style fields);
timestamps. Relations: cargos, manifests, B/Ls.

### `consignees`
`id`, `name`, `address`, `phone`, plus identifier fields; timestamps. Relations: cargos, manifests,
B/Ls.

### `agents`
`id`, `company`, `address`, `phone`, timestamps. Relations: manifests, B/Ls.

### `portshippers` (model `Portshipper`)
`id`, `port_id`, `shipper_id`, **voyage counter**, timestamps.
> This table carries the voyage sequence — see [`calculations.md`](calculations.md) §4 for why that
> contradicts the employer's rule.

### `currencies`
A `currencies` concept exists in the new system; the legacy archive has no Currency model — currency
is a free field on Invoice / Performa / B/L only.

---

## 3. Operations

### `loadings` (model `Loading`) — the central operational record

**`$fillable` columns (confirmed writable):**

| Column | Notes |
|---|---|
| `user_id` | the **customer** |
| `pol_id`, `pod_id` | port of loading / discharge |
| `yard_id` | |
| `portshipper_id` | link that drives voyage generation |
| `description` | |
| `note` | free text — the only "comment" the legacy system has |
| `admin_status` | `PENDING` \| `APPROVED` — management review |
| `total_unit`, `total_weight` | |

**Non-`$fillable` columns seen only in views / loading logic (medium confidence):**

| Column | Notes |
|---|---|
| `inspection_status` | `PENDING` \| `DONE` \| `LOCAL` \| `NONEED` |
| `loading_status` | `LOADED` \| `INYARD` |
| `showroom` | origin showroom |
| `chno` | chassis number |
| `qty`, `qty_descr` | quantity and its description |
| `measurment` | **sic** — CBM |
| `gross`, `net` | weights |
| `arrival_date` | |
| `loading_date` | |
| `manifest_id` | set when the cargo is attached to a manifest |
| `vessel`, `voyage` | free-text strings |

**Status constants (from the `Loading` model):**
- `admin_status`: `INPENDING`, `APPROVED`
- `inspection_status`: `INPENDING`, `INDONE`, `INLOCAL`, `INNONEED`
- `loading_status`: `LOADED`, `INYARD`

### `loadinglists` (model `Loadinglist`)
`id`, plus vessel/date/status fields; timestamps. Relations: `loadings` (via Loading), vessel is a
string.

---

## 4. Documents

### `manifests` (model `Manifest`)

| Column | Notes |
|---|---|
| `number` | from `generateManifestNumber()` — `{port.abb}/{rand6}{year}` |
| `user_id` | customer |
| `portshipper_id` | |
| `pol_id`, `pod_id` | |
| `vessel` | **free-text string** |
| `voyage` | **free-text string** |
| `descr` | |
| `shipper_id`, `consignee_id`, `agent_id` | party masters |
| `notify_party`, `similar_con` | `similar_con` = "notify same as consignee" flag |
| `gas_cost`, `lashing_cost`, `shipper_cost`, `pod_cost`, `pol_cost` | the **five voyage cost columns** |
| `total_unit`, `total_weight` | aggregates |
| `created_at`, `updated_at` | |

Relations: `loadings` (via Loading.manifest_id), `bls`, `invoices`, `users`, `pols`, `pods`,
`shippers`, `consignees`, `agents`.

### `bls` (model `Bl`)

| Column | Notes |
|---|---|
| `number` | from `generateBLNumber()` — `{port.abb}/{year}{rand4}` |
| `user_id` | customer |
| `manifest_id` | |
| `vessel`, `voyage` | free-text strings |
| `pol_id`, `pod_id` | |
| `shipper_id`, `consignee_id`, `agent_id` | |
| `notify_party`, `similar_con` | |
| `descr` | |
| `total_unit`, `total_weight` | |
| `status` | `PENDING` (the only value ever written) |
| `bl_status` | `-` \| `SURRENDERED` |
| `created_at`, `updated_at` | |

> Two status columns that look like one — see defect **D2** in
> [`system-overview.md`](system-overview.md) §7.

### `invoices` (model `Invoice`)

| Column | Notes |
|---|---|
| `code` | from `getinvoiceCode()` — `DSAED/{rand6}` |
| `title` | free heading printed on the invoice |
| `todescr` | "to-description" — the bill-to block |
| `user_id` | customer |
| `bl_id`, `manifest_id` | optional document anchors |
| `status` | `PAID` \| `UNPAID` |
| `total`, `totalvat`, `btotal` | money |
| `created_at`, `updated_at` | |

> There is **no** `number` column — which is why the preview page renders an empty invoice number
> (defect **D3**).

### `invoiceitems` (model `Invoiceitem`)

| Column | Notes |
|---|---|
| `invoice_id` | |
| `descr` | |
| `qty` | |
| `unit` | unit price |
| `vat` | VAT **percentage** for the line |
| `vatamount` | VAT amount for the line |
| `subtotal` | **already includes VAT** — see [`calculations.md`](calculations.md) §2 |
| created/updated | |

Lines are **not** submitted as structured fields: the browser posts strings of the shape
`qty~~descr~~unit~~vat` which the controller splits with `explode('~~', …)`.

---

## 5. Finance

### `fins` (model `Fin`) — the ledger table

| Column | Notes |
|---|---|
| `user_id` | the party |
| `type` | `invoice` \| `payment` \| `reciept` (**sic — "reciept"**) |
| `status` | `Sales`/`Payment` for debits, `Received` for credits |
| `descr` | |
| `debit`, `credit` | money |
| `note` | |
| `invoice_id` | only when `type='invoice'` |
| `ID_doc` | **ID-card attachment path** — the only ID-capture support in the legacy system |
| `amount` | |
| `created_at`, `updated_at` | |

There is **no** separate voucher table, no allocation table, and no journal table. Payments and
receipts are `Fin` rows with `type` set.

---

## 6. Pre-sales documents

### `offers` (model `Offer`)
`id`, `title`, `body` (rich HTML), `user_id`, `number` (from `getOfferNumber()` → `DSOFF/{rand6}`),
timestamps. **No line items — the whole document is one HTML body.**

### `quotations` (model `Quotation`)
`id`, `title`, `body` (rich HTML), `user_id`, `number` (from `getQuotationNumber()` →
`DSQUO/{rand6}`), timestamps. Same shape as Offer.

### `performas` (model `Performa`)
`id`, `number` (from `getPerformaNumber()` → `SDPRO/{rand6}` — **note the transposed `SDPRO`
prefix**), `user_id`, `buyer`, `forwarder`, `port_id`, `currency`, `notes`, `pi`, `benefit`,
`origin`, `termdelivery`, `termpayment`, `partial`, `finalplace`, `insurance`, `btotal`, `total`,
`total_net`, `total_gross`, timestamps.

### `performa_items` (model `Performa_item`)
`id`, `performa_id`, `descr`, `qty`, `price`, `gross`, `net`, `total`, timestamps.
Lines are likewise parsed from `qty~~descr~~price~~gross~~net` strings.

---

## 7. Entity-relationship sketch

```
users ──< loadings >── ports (pol/pod) ──< yards
  │         │  │
  │         │  └──────< portshippers >── shippers
  │         │
  │         └──< manifests >── bls >── shippers / consignees / agents
  │                  │           │
  │                  │           └──< invoices >── invoiceitems
  │                  │
  │                  └──< invoices
  │
  ├──< fins  (ledger rows; invoice / payment / reciept)
  ├──< invoices
  ├──< bls
  ├──< offers
  ├──< quotations
  └──< performas >── performa_items

roles ──< role_permission >── permissions
users ──< user_role >── roles
```

**Notable absences in the graph:** no Vessel table, no Voyage table, no Job table, no Cargo-comment
table, no Delivery Order, no Release Order, no Salary, no AuditLog, no FileAttachment, no
DocumentTemplate.

---

## 8. Confidence and caveats

| Area | Confidence | Why |
|---|---|---|
| Field **names** on `$fillable` models | High | read directly from the models |
| Field names seen only in Blade views | Medium | may be computed, aliased or non-persisted |
| Column **types**, nullability, defaults | Low | no migrations; only PHP casts are visible |
| Indexes, foreign keys, cascades | Low | inferred from relation definitions only |
| Table **names** | Medium | Laravel's default pluralisation is assumed where not declared via `$table` |
| Anything about **data volumes** | None | the ZIP contains code, not a database dump |

> **Do not use this schema as a migration source without verifying against a live legacy database.**
> The archive has no data in it.
