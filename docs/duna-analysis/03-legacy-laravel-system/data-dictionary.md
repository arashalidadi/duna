# Legacy Laravel — Data Dictionary

> Field-level meanings for the legacy schema. Read
> [`database-schema.md`](database-schema.md) first for the table-level picture.
>
> **Caution:** this is the *legacy* meaning of each field. Where the current system uses different
> semantics for a same-named concept, that is called out in
> [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).

---

## 1. Parties

### `users` — one table for staff, admins and customers

| Field | Meaning in the legacy system | Employer's concept |
|---|---|---|
| `level` | `Admin` = back-office user; `User` = customer/portal user. Drives middleware. | Not a concept the employer uses |
| `user_code` | Customer code, generated as `'CUST00' . (lastId+1)` → `CUST001`, `CUST0010`, … | `REQ-013`/`REQ-014` — system-generated `CUST` code. Direction matches; format and collision-safety do not |
| `fname` / `lname` | Given / family name | Customer "Name" (`REQ-011`) |
| `compayname` | Company name — **field name is misspelled in the code** | Customer may be a legal entity (`REQ-019`) |
| `mobile`, `email`, `address` | Contact details | Optional customer fields (`REQ-012`) |
| `nationalCode` | National ID | The employer moved this to Shipper/Consignee, not Customer (`REQ-017`, `REQ-051`) |
| `role_id` | FK to `roles` | Access Control section (`REQ-001`) |
| `debit` / `credit` | Running ledger totals, recomputed by `CalculateDebitCredit()` | Debit/Credit/Balance (`REQ-150`, `REQ-151`, `REQ-161`) |
| `active` | Soft enable flag | – |
| `api_token` | Sanctum-style token | – |

**Critical:** because Customer *is* a `User` row, the legacy system has **no way to represent a
customer who is not also a portal login**, and no way to keep the internal customer separate from the
documentary parties. This is the structural gap the party cutover in the new system fixed.

---

## 2. Master data

### `ports`

| Field | Meaning |
|---|---|
| `title` | Display name, e.g. `Hamriyah Port, Dubai, UAE` — the employer's three-part string stored as one value |
| `abb` | Abbreviation used in number generation and (by the employer's request) in the Load List, e.g. `HAM` |

> The employer wants Port / City / Country as three fields (`REQ-030`); the legacy system stores one
> concatenated `title`.

### `yards`

| Field | Meaning |
|---|---|
| `port_id` | Owning port |
| `title` | Yard name, e.g. `F15`, `B15` |

Matches `REQ-035`.

### `shippers` / `consignees` / `agents`

| Field | Meaning |
|---|---|
| `title` (Shipper) / `name` (Consignee) / `company` (Agent) | Party name — **three different column names for the same concept** |
| `address`, `phone`, `email` | Contact details |
| identifier fields | National ID / TRN equivalents |

Matches `REQ-050`–`REQ-056` in spirit; the employer wants one consistent field set across all three.

### `portshippers`

| Field | Meaning |
|---|---|
| `port_id`, `shipper_id` | The port+shipper pairing |
| voyage counter | **The voyage sequence lives here** |

> ⚠️ The voyage counter is keyed on **port + shipper**, not on **vessel + destination** as the
> employer requires (`REQ-040`). See [`calculations.md`](calculations.md) §4.

---

## 3. Cargo / Loading

### `loadings` — the operational record

| Field | Meaning | Employer's concept |
|---|---|---|
| `user_id` | The customer | `REQ-060` — customer is the first field ✓ |
| `pol_id` / `pod_id` | Port of loading / discharge | ✓ |
| `yard_id` | Storage yard | ✓ (`REQ-036`) |
| `portshipper_id` | Drives voyage number generation | No equivalent |
| `description` | Goods description | ✓ |
| `chno` | Chassis number | ✓ |
| `qty` / `qty_descr` | Quantity + its description | Partially — the employer wants units *and* packages separately (`REQ-071`) |
| `gross` / `net` | Weights | ✓ |
| `measurment` | CBM (**misspelled in the code**) | ✓ |
| `showroom` | Origin showroom | Mentioned in the Quotation specimen only |
| `arrival_date` | Intake date | ✓ (`REQ-069`) |
| `loading_date` | Load date | ✓ (`REQ-069`) |
| `inspection_status` | `PENDING` / `DONE` / `LOCAL` / `NONEED` | ✓ (`REQ-081`), plus two extra states |
| `loading_status` | `LOADED` / `INYARD` | ✓ (`REQ-093` — returning to yard) |
| `admin_status` | `PENDING` / `APPROVED` — management review gate | **Not requested by the employer.** Legacy-only concept |
| `note` | Free-text note | A weak precursor to the employer's Comment (`REQ-065`) — but it is not surfaced to accounting in a structured way |
| `vessel`, `voyage` | Free-text strings | The employer wants Vessel master + derived voyage (`REQ-037`, `REQ-040`) |
| `manifest_id` | Set when attached to a manifest | ✓ |
| `total_unit`, `total_weight` | Aggregates | ✓ |

**Missing versus the employer's field list:** Shipper, Serial Number, Units-vs-Packages split,
Weight Unit, Document Status, and a first-class Comment.

---

## 4. Documents

### `manifests`

| Field | Meaning |
|---|---|
| `number` | `{port.abb}/{rand6}{year}` — **random**, not sequential |
| `vessel` / `voyage` | Free-text strings (no Vessel master) |
| `pol_id` / `pod_id` | Ports |
| `shipper_id` / `consignee_id` / `agent_id` | Party masters at manifest level |
| `notify_party` | Notify party text |
| `similar_con` | Flag: notify party is the same as consignee |
| `gas_cost`, `lashing_cost`, `shipper_cost`, `pod_cost`, `pol_cost` | **The five voyage cost columns** — the legacy system's answer to `REQ-191` |
| `total_unit`, `total_weight` | Aggregates recomputed on write |
| `descr` | Description |

### `bls`

| Field | Meaning |
|---|---|
| `number` | `{port.abb}/{year}{rand4}` — random |
| `status` | Only ever `PENDING` — `RELEASED` is defined but never written (defect **D1**) |
| `bl_status` | `-` or `SURRENDERED` — a **different** concept from `status` (defect **D2**) |
| `vessel` / `voyage` | Free text |
| `similar_con`, `notify_party` | As per manifest |
| `total_unit`, `total_weight` | Aggregates |

### `invoices` / `invoiceitems`

| Field | Meaning |
|---|---|
| `code` | `DSAED/{rand6}` — **the field is `code`, but the preview template reads `number`** (defect **D3**) |
| `title` | Free heading printed at the top of the invoice |
| `todescr` | Bill-to description block |
| `status` | `PAID` / `UNPAID` — **no Partial state**, unlike `REQ-149` |
| `total` | **Net** of VAT |
| `totalvat` | VAT amount |
| `btotal` | Sub-total before VAT |
| Item `unit` | Unit price |
| Item `vat` | VAT **percentage** for the line ✓ `REQ-144` |
| Item `vatamount` | VAT amount for the line |
| Item `subtotal` | **Already includes VAT** — see [`calculations.md`](calculations.md) §2 |

---

## 5. Finance

### `fins` — the ledger

| Field | Meaning |
|---|---|
| `type` | `invoice` \| `payment` \| `reciept` (**misspelled** — "reciept") |
| `status` | `Sales` or `Payment` on the debit side; `Received` on the credit side |
| `debit` | Money out of the party's favour (invoice issued, payment made by Duna) |
| `credit` | Money in the party's favour (payment received) |
| `invoice_id` | Populated only when `type='invoice'` |
| `descr`, `note` | Description and note |
| `ID_doc` | Path to an uploaded **ID-card image** — legacy has some ID-capture support after all, though only in this one place |
| `amount` | Amount as entered |

**Structure:** a flat list of movements per party. No allocation table, no journal, no chart of
accounts.

### Ledger semantics (verified in code)

| Action | Effect |
|---|---|
| Invoice issued | `Fin` row, `type='invoice'`, `debit` = invoice total |
| Payment made by Duna | `Fin` row, `type='payment'`, `debit` = amount |
| Money received | `Fin` row, `type='reciept'`, `credit` = amount |
| After any write | `CalculateDebitCredit()` recomputes `users.debit` / `users.credit` |

---

## 6. Pre-sales documents

### `offers` / `quotations`

| Field | Meaning |
|---|---|
| `title` | Document title |
| `body` | **The entire document as rich HTML** — there are no line items |
| `number` | `DSOFF/{rand6}` and `DSQUO/{rand6}` respectively |
| `user_id` | Customer |

> The legacy system cannot produce the Quotation line-item table seen in the real `DSQUO/25-017`
> specimen — the whole document is a free-text HTML body.

### `performas` / `performa_items`

| Field | Meaning |
|---|---|
| `number` | `SDPRO/{rand6}` — **prefix transposed** relative to the real `DSPRO/…` documents |
| `buyer`, `forwarder` | Buyer and freight forwarder |
| `port_id` | Discharge port |
| `currency` | Transaction currency |
| `pi` | Proforma-invoice reference |
| `benefit` | Beneficiary |
| `origin` | Country of origin |
| `termdelivery`, `termpayment` | Delivery terms / payment terms |
| `partial` | Partial shipment |
| `finalplace` | Final delivery place |
| `insurance` | Insurance amount |
| `btotal`, `total`, `total_net`, `total_gross` | Money and weight totals |
| Item fields | `descr`, `qty`, `price`, `gross`, `net`, `total` |

**This is the one place where the legacy schema is closer to the real paperwork than the employer's
transcripts are** — the Performa model captures most of the Proforma fields seen on `DSPRO/26-001`.

---

## 7. Settings — `key_values`

| Key | Used for |
|---|---|
| `app_title` | Company name printed on documents |
| `address`, `tel1`, `tel2`, `email` | Letterhead block |
| `light_logo`, `dark_logo`, `favicon`, `mag_logo`, `shop_header`, `login_poster` | Branding |
| `letterhead` | Image at the top of the printed invoice |
| `signature` | Signature image on printed documents |
| `watermark` | Watermark image (**note:** this is a general watermark, not the B/L `DRAFT` watermark) |
| `default_avatar` | User avatar fallback |
| `aed_account_details` | Bank account block on the invoice |
| `admin_paginate_number` | Page size |
| `default_role` | Role assigned to new users |

> The presence of uploadable `letterhead`, `signature` and `watermark` settings is the legacy
> precursor to the employer's document-template requirement (`REQ-124`). The new system's
> `DocumentTemplate` / `DocumentTemplateVersion` models are the generalised form.
