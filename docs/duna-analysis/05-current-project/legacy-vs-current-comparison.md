# Legacy vs Current — Comparison

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> ⚠️ **Read the standing rule first:**
>
> **Legacy Laravel behaviour is historical evidence, NOT the specification.**
> The current system is **not** a port of the legacy system, and the legacy system must **not** be
> used to decide what the current system should do. Where the two differ, the **employer's
> statements** decide — and where the employer is silent, the current system's own ADRs decide.
>
> **Do not delete a current feature merely because the old system lacked it.**
> **Do not plan to replace the current dashboard with the legacy one.**

---

## 1. At a glance

| Dimension | Legacy Laravel | Current Next.js / NestJS |
|---|---|---|
| Framework | Laravel 10, PHP 8.1, Blade, jQuery, Bootstrap | NestJS + Next.js App Router, React, TypeScript, Tailwind |
| Files / LOC | 199 files, 22,833 PHP + 15,409 Blade | 33 API modules / 38 controllers / 35 web pages; Prisma schema 93.8 KB |
| Models | 23 Eloquent | 62 Prisma models, 25+ enums |
| Migrations | **4** (all stock; schema un-migrated) | **38** |
| Tests | **4 stock scaffolds; no real tests** | **22 e2e suites, 403 tests, 0 failing**; **no web tests** |
| API | None usable (one stock Sanctum route) | Full REST at `/api/v1`, 38 controllers |
| Auth | Session + `level` string | JWT + rotating DB-backed refresh token |
| Permissions | ~35, enforced in **Blade only** | 105 across 12 resources, enforced **server-side** |
| Documents | Browser print only | Models + registry ready; **rendering is Phase 7** |
| Numbering | Random components | `NumberingSequence` with `FOR UPDATE` locking |
| Audit | None | `AuditLog`, same-transaction |
| Multi-tenancy / scoping | None | Port/agent/destination scoping, server-enforced |
| Customer portal | Unscoped `/profile` | `/portal` with server-side company scoping |

---

## 2. Entity-by-entity

| Legacy | Current | Verdict |
|---|---|---|
| `users` (**staff and customers together**) | `User` + `Customer` | ✅ **Fixed** — the single most important correction |
| `roles`, `permissions`, `has_role` | `Role`, `Permission`, `RolePermission`, `UserRole` | ✅ |
| `key_values` (18 keys) | `CompanySettings` + `Currency` | ✅ Typed instead of a KV bag |
| `ports` (`title`, `abbreviation`) | `Port` (name, city, country, code, abbreviation) | ✅ Matches `REQ-030` |
| `yards` | `Yard` | ✅ |
| — | **Vessel** (`VesselType`, tug/barge) | ✅ **New** |
| `portshippers` (voyage counter) | **Voyage** + `VoyageDestination` | ✅ **New**, correctly keyed |
| `shippers`, `consignees`, `agents` | `Shipper`, `Consignee`, `Agent`, **`AgentDestination`** | ✅ Party masters are now **active** |
| `loadings` | `Cargo` + `YardInventory` + `Inspection` | ✅ Decomposed |
| `docs` (ad-hoc uploads) | `FileAttachment` | ✅ Generalised |
| `loadinglists` | `LoadList`, `LoadListItem` | ✅ |
| — | **ActualLoading**, `ActualLoadingItem` | ✅ **New** — "what was really loaded" |
| — | **Discharge**, `DischargeItem` | ✅ **New** |
| `manifests`, `items` | `Manifest`, `ManifestItem` | ✅ **Inverted in the right direction** |
| `bls` | `BillOfLading`, `BillOfLadingItem`, **`BillOfLadingRevision`** | ✅ Revisions are first-class |
| `invoices` (inline items) | `Invoice`, `InvoiceItem` | ✅ Correct arithmetic |
| `fins` | `Voucher` + **derived ledger** | ✅ No table, cannot disagree |
| `offers` | *(merged into Quotation)* | ✅ Simplification |
| `quotations` (free text) | `Quotation`, `QuotationItem` | ✅ Line items, 5-state lifecycle |
| `performas`, `performa_items` | `Proforma`, `ProformaItem` | ✅ + conversion to invoice |
| — | **DeliveryOrder**, **ReleaseOrder** | ✅ **New** |
| — | **Job**, `JobCostItem` | ✅ **New** |
| — | **Employee**, `SalaryRecord` | ✅ **New** |
| — | **Letter** | ✅ **New** |
| — | **BookingRequest** (portal) | ✅ **New** |
| — | **NumberingSequence** | ✅ **New** |
| — | **AuditLog** | ✅ **New** |
| — | **FileAttachment** | ✅ **New** |
| — | **DocumentTemplate**, `DocumentTemplateVersion` | ✅ **New** (rendering pending) |

---

## 3. Behaviour comparison

### 3.1 Process order

| | Legacy | Current | Employer |
|---|---|---|---|
| Manifest ↔ B/L | Manifest **first**; B/Ls created against it | B/L **first**; Manifest consolidates APPROVED B/Ls (`ADR-047`) | ✅ B/L first |

**The current system is right and the legacy system was wrong.**

### 3.2 Party ownership

| | Legacy | Current |
|---|---|---|
| Shipper / Consignee / Notify | Set on the **manifest**, defaulted onto B/Ls | Set **per B/L** (and per manifest item) |

The current model is what makes `REQ-107` (partner B/Ls on one manifest) implementable.

### 3.3 Status machines

| Concept | Legacy | Current |
|---|---|---|
| Cargo | `admin_status` (PENDING/APPROVED), `inspection_status` (4 values), `loading_status` (2 values) | `CargoStatus`, `InspectionStatus` (5 values), `LoadingStatus` — plus `ActualLoading`/`Discharge` lifecycles |
| B/L | `status` = `PENDING` (never `RELEASED`), `bl_status` = `-`/`SURRENDERED` | `DRAFT → … → RELEASED` with configurable names, `bill:release` transition, revisions |
| Invoice | `PAID` / `UNPAID` | `InvoiceStatus` + `paidAmount` cache + derived statement |
| Manifest | none | `ManifestStatus` |
| Load list | none (a record, not a lifecycle) | `DRAFT → FINALIZED (→ CANCELLED)` |
| Quotation | none | `DRAFT → SENT → ACCEPTED \| REJECTED (+CANCELLED)` |
| Proforma | none | mirrors invoice |

### 3.4 Money

| Behaviour | Legacy | Current |
|---|---|---|
| Invoice → customer | `Fin` row, `type='invoice'`, `debit` | ISSUED invoice is the debit side of the derived statement |
| Receipt | `Fin` row, `type='reciept'`, `credit` | `Voucher` `RECEIPT`, POSTED |
| Payment | `Fin` row, `type='payment'`, `debit`, ID-doc | `Voucher` `PAYMENT`, POSTED |
| Balance | `users.debit` / `users.credit` columns, recomputed | **Derived** from invoices + vouchers |
| Partial payment | ❌ (PAID/UNPAID only) | ✅ `paidAmount` |
| Advance / unallocated | ✅ by omission | ✅ `invoiceId` nullable by design |
| Allocation to several invoices | ❌ | ❌ **Still single-invoice FK** — gap vs `REQ-165` |
| General journal | ❌ | ❌ — gap vs `REQ-166` |
| ID-card capture | Payment form only | ❌ Not present (`FileAttachment` exists) |
| Multi-currency | Free-text field | ✅ `Currency` entity |

### 3.5 Numbering

| Document | Legacy | Current | Real documents |
|---|---|---|---|
| B/L | `{port.abb}/{yymmdd}` | `BOL-{DEST}-YYMM-#####` | `KHS/26-110` |
| Manifest | `{port.abb}/{rand6}{ddmmyyyy}` | `MAN-{DEST}-YYMM-#####` | `DSMAN/KHO-26-006` |
| Invoice | `DSAED/{rand6}` | `INV-YYMM-#####` | `DSINV/26-172` |
| Proforma | `SDPRO/…` (transposed) | `PRF-YYMM-#####` | `DSPRO/26-001` |
| Quotation | random | `QT-YYMM-#####` | `DSQUO/25-017` |
| Receipt | 3-series scheme | `RCP-YYMM-#####` | **`477`** (plain numeric — *corrected 2026-10-11; was `DSR/26-190`*, fabricated) |
| Payment | 3-series scheme | `PMT-YYMM-#####` | — |
| Voyage | counter on `Portshipper` (port+shipper) | per-destination leg numbers | `02/26` |
| Customer | `CUST00{id+1}` | configurable sequence | `CUST …` (format unresolved) |

**Neither legacy nor current matches the real documents.** The current system is *closer in spirit*
(destination-scoped, sequential, locked) and — critically — the format is **data**, so it can be
changed without code (ADR-008).

### 3.6 Document output

| | Legacy | Current |
|---|---|---|
| Mechanism | Blade + jQuery `printPreview` | Models + registry exist; **no renderer yet** |
| PDF | ❌ | ⏳ Phase 7 |
| Excel | ❌ (declared, class missing) | ⏳ Phase 7 |
| Print without stamp | ✅ (only mode) | ⏳ Phase 7 |
| Print/PDF with stamp | ❌ | ⏳ Phase 7 |
| Uploadable templates | ❌ (global images only) | ⏳ Phase 7 |

> **This is the one area where the legacy system is currently ahead.** It could print all nine
> document types; the current system cannot print any. That is a **phase-7 scheduling fact**, not a
> reason to port the legacy renderer.

### 3.7 Access control

| | Legacy | Current |
|---|---|---|
| Tier check | `level == 'Admin'` / `'User'` | JWT + roles |
| Permission check | `@can` in Blade — **UI only** | Server-side guards |
| Count | ~35, uneven | 105 across 12 resources |
| Granularity flag | — | `roleGranularPermissions` |
| Portal scoping | None | Server-side, company-scoped; destination scoping pending |

---

## 4. Where the legacy system was right and the current system should check itself

A short list, because it is genuinely short — but it should not be zero, and these are worth
verifying rather than assuming the new system is better:

| Legacy behaviour | Why it may matter |
|---|---|
| **Days-in-port** computed and shown on the cargo list | Confirm the current system surfaces it (`REQ-070`) |
| **Inspection status on the cargo row** in the load list | Confirm the current load list shows it (`REQ-085`) |
| **Load list uses the port abbreviation** | Legacy did **not** do this — but confirm the current one does (`REQ-033`) |
| **ID-card upload on the payment form** | The current `Voucher` has no ID-doc field; `REQ-168` asks for one |
| **Payment and receipt as separate permissions** | Good granularity; confirm the current permission set keeps them separate |
| **Invoice payment status as its own permission** | Same |
| **The real shape of the load list** (`NO, CUSTOMER, SHOWROOM, DESCRIPTION, QTY, YARD, ARRIVAL, INSP, LOAD DATE, DAYS`) | Matches `REQ-085`; confirm the current load list matches |

---

## 5. What must NOT be carried over

| Legacy behaviour | Why not |
|---|---|
| Manifest-first B/L creation | Contradicts the employer (`EMP-024`–`EMP-027`) |
| Parties defaulted from the manifest | Blocks co-loading |
| `admin_status` management review | Legacy-only; the employer never asked for it |
| Random number components | Non-reproducible, non-auditable |
| `'CUST00'.(lastId+1)` | No configurability |
| Hard-coded role id 8 on role deletion | An accident |
| Two customer-creation paths | An accident |
| `Offer` as a separate entity from `Quotation` | Merged, deliberately |
| Free-text quotation body | Cannot reproduce the real `DSQUO/25-017` |
| VAT added to a VAT-inclusive subtotal | Arithmetic error |
| `reciept` / `compayname` / `measurment` misspellings | Do not recreate them as identifiers |
| SMS gateway, wallet, `State`/`City`, `UsersExport` | Dead code from a forked e-commerce project |

---

## 6. Feature-presence matrix (legacy had it → current has it?)

| Legacy screen / capability | Current equivalent | State |
|---|---|---|
| Dashboard counts | `dashboard` page | ✅ Better |
| Cargo list + filters | `cargo` page | ✅ |
| Cargo detail drawer | cargo detail | ✅ |
| Cargo document upload | `FileAttachment` | ✅ |
| Management review | — | ❌ **Deliberately dropped** (legacy-only) |
| Yards CRUD | `yards` page | ✅ |
| Ports CRUD | `ports` page | ✅ + abbreviation |
| Load list create / preview | `load-lists` page | ✅ + 3-state lifecycle |
| Load list print | — | ⏳ Phase 7 |
| Manifest list / create / preview | `manifest` page | ✅ (rewrite in progress) |
| Manifest print | — | ⏳ Phase 7 |
| B/L list / create / preview | `bills` page | ✅ Much better |
| B/L print | — | ⏳ Phase 7 |
| B/L release manager | `release-orders` page + eligibility endpoint | ✅ Actually works now |
| Shipper / Consignee / Agent masters | `shippers`, `consignees`, `agents` pages | ✅ |
| Invoice list / create / print | `invoices` page | ✅ Better arithmetic |
| Invoice print | — | ⏳ Phase 7 |
| Ledger list / statement | `ledger` page | ✅ Derived, correct order |
| Voucher print | — | ⏳ Phase 7 |
| Payment / receipt forms | `vouchers` page | ✅ |
| Proforma | `proformas` page | ✅ + conversion |
| Quotation | `quotations` page | ✅ Much better |
| Offer | *(merged)* | ✅ Deliberate |
| Manifest P&L report | — | ⏳ Phase 8 |
| Users / roles / permissions | `users`, `roles`, `permissions` pages | ✅ Much better |
| Settings | Company settings | ✅ |
| Customer portal | `portal` | ✅ Scoped |
| SMS | — | ❌ Not carried (scope unknown) |
| Wallet | — | ❌ Dead code, not carried |

---

## 7. Summary judgement

| | Legacy | Current |
|---|---|---|
| Business coverage | Broader in **documents you can print**, narrower in everything else | Broader in **domain depth and correctness**, narrower in output |
| Correctness | 14 catalogued defects, several of them money-affecting | 403 tests green; no known money-affecting defect |
| Structural fit to the employer's description | Poor — inverted the core B/L/manifest relationship | Good — matches it |
| Auditability | None | `AuditLog`, revisions, frozen documents |
| Extensibility | Hard-coded formats and templates | Configurable numbering + templates |

**The correct posture for a future agent:**

1. Use the legacy system to answer *"what did the company used to do?"* — especially where the
   employer is silent.
2. Use the employer's statements to answer *"what should it do?"*
3. Use the current system's ADRs to answer *"how has it been decided to build it?"*
4. Never use the legacy system to answer (2) or (3).
