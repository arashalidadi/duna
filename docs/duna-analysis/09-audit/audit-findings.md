# Audit findings — requirement vs. actual code

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

**Status:** INITIAL findings, **superseded in part** — updated 2026-10-11.
**Legend:** VERIFIED = read in source · DOCUMENTED = docs only · UNVERIFIED = cited, not executed ·
UNRESOLVED = depends on a missing source or open question.

> ### ⚠️ Read this first — this document has been superseded in part
>
> The requirements-discussion round resolved most of the questions these findings raised. **This file is retained
> as the original evidence record** — the code paths and measurements in it remain valid. But where a finding's
> *recommendation* conflicted with a confirmed decision, **the confirmed decision wins**.
>
> **Authoritative documents for the target system:**
> - `confirmed-decisions.md` — confirmed design decisions (`DEC-001`–`DEC-114`)
> - `question-reconciliation.md` — disposition of every `Q-AUD-*` and `SRC-*` item
> - `target-domain-and-finance.md`, `target-documents-and-configuration.md`, `target-security-audit-reporting.md`
> - `implementation-gap-analysis.md` — current state vs target
>
> **Findings whose status changed:** AUD-002, AUD-003, AUD-004, AUD-005, AUD-006, AUD-007, AUD-009, AUD-010,
> AUD-011, AUD-012, AUD-013, AUD-014, AUD-017, AUD-018, AUD-019, AUD-021, AUD-022, AUD-023. Each carries an inline

> **STATUS UPDATE** note.

>
> **Findings that remain as originally written:** AUD-001 (per-line VAT — confirmed correct), AUD-008 (document
> output), AUD-015 (Cargo duplication), AUD-016 (enum conflict), AUD-020 (documentation drift).

**Runtime caveat (applies to every finding):** no `node_modules`, no PostgreSQL, no `.env` in the audit
environment. Nothing was executed. "Implemented" below therefore means *implemented in code, untested by
execution*. See `README.md` §4.

---

## 1. System shape — measured, not quoted

All figures below were produced by inspecting source during this audit (VERIFIED). They supersede the
approximate figures recorded in `05-current-project/` and `FINAL-REPORT.md` (see `README.md` §6, errors E2–E4).

| Measured | Value | Where |
| --- | --- | --- |
| Prisma models | **52** | `prisma/schema.prisma` |
| Prisma enums | **32** | `prisma/schema.prisma` |
| Migrations | 38 | `prisma/migrations/` |
| API modules | **32** | `apps/api/src/modules/` |
| e2e suites | **22** | `apps/api/src/**/*.e2e-spec.ts` |
| Dashboard pages (route dirs) | 35 | `apps/web/src/app/[locale]/(dashboard)/` |
| Seeded permission codes / modules | **161 / 34** | `prisma/seed.ts` — corrected 2026-10-11; an earlier note said 35, conflating 35 web pages with permission modules |
| Nav sections | **10** | `apps/web/src/lib/navigation/nav.ts` (`NAV_SECTION_ORDER`) |

### 1.1 State machines as shipped (VERIFIED — the authoritative list)

Read from `prisma/schema.prisma`. **This is the ground truth; several docs still describe older shapes.**

```
CargoStatus       (6) REGISTERED | AT_YARD | READY_FOR_LOADING | LOADED | DELIVERED | CANCELLED
InspectionStatus  (5) PENDING | BOOKED | DONE | FAILED | NEEDS_REINSPECTION
VoyageStatus      (5) DRAFT | SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
LoadListStatus    (6) DRAFT | IN_PROGRESS | PARTIALLY_LOADED | COMPLETED | FINALIZED | CANCELLED
ActualLoadingStatus(6) DRAFT | IN_PROGRESS | PARTIALLY_LOADED | COMPLETED | FINALIZED | CANCELLED
DischargeStatus   (4) NOT_STARTED | IN_PROGRESS | COMPLETED | CANCELLED
ManifestStatus    (4) DRAFT | SUBMITTED | APPROVED | CANCELLED
BlStatus          (6) DRAFT | FINAL | APPROVED | RELEASED | ISSUED | CANCELLED
InvoiceStatus     (3) DRAFT | ISSUED | CANCELLED
ProformaStatus    (3) DRAFT | ISSUED | CANCELLED
QuotationStatus   (5) DRAFT | SENT | ACCEPTED | REJECTED | CANCELLED
VoucherStatus     (2) POSTED | CANCELLED
DeliveryOrderStatus(2) ISSUED | CANCELLED
JobStatus         (4) DRAFT | OPEN | COMPLETED | CANCELLED
VesselType       (10) incl. TUG | BARGE | LANDING_CRAFT
```

Note what is **absent** by design: `InvoiceStatus` has no `PARTIAL` or `PAID` value. Payment state is derived
(`paidAmount >= totalAmount`) — see AUD-017, and ADR-032.

---

## 2. Capability classification

Legend: **I/U** = implemented, untested · **P** = partial · **M** = missing · **D** = different from documented ·
**?** = uncertain.

| # | Capability | Req | State | Note |
| --- | --- | --- | --- | --- |
| 1 | Auth + RBAC (160 codes, **33** modules) | — | I/U | `prisma/seed.ts`; 22 e2e suites exist |
| 2 | Master data: Port, Yard, Customer, Vessel, Voyage, Currency | REQ-030/031/037 | I/U | field conformance issues → AUD-011, AUD-012 |
| 3 | Party masters: Shipper, Consignee, Agent | — | I/U | cutover from Customer done (Phase 2) |
| 4 | Cargo registration + yard inventory | REQ-0xx | I/U | duplicate columns → AUD-015 |
| 5 | Inspections (5-state) | REQ-082 | I/U | gating verified in code → §3.1 |
| 6 | Load List + Actual Loading | — | I/U | 6-value enum vs ADR-041's 3-state → AUD-016 |
| 7 | Discharge | — | I/U | |
| 8 | Manifest (consolidation of APPROVED B/Ls) | — | I/U | ADR-047 d1/d3/d4 verified in code → §3.2 |
| 9 | Bill of Lading (from Actual Loading) | — | I/U | ADR-045 verified in code → §3.3 |
| 10 | Release / Delivery orders | — | I/U | financial override present (ADR-033) |
| 11 | Jobs + job costing | REQ-134 | P | **no Invoice↔Job link** → AUD-002 |
| 12 | Quotations / Proformas | — | I/U | |
| 13 | Invoices | REQ-141/144/147 | P | header-level VAT, single B/L, no TRN → AUD-001/003/004b |
| 14 | Vouchers (receipt/payment) | REQ-163/165 | P | single-document allocation only → AUD-005 |
| 15 | Derived customer ledger + statement | REQ-160/161/162 | I/U | thin controller over `VoucherService`; no `ledger.e2e-spec.ts` → AUD-022 |
| 16 | General journal | REQ-166 | **M** | no model at all → AUD-004 |
| 17 | Office / daily expense capture | REQ-167/195 | **M** | ledger is customer-scoped only → AUD-007 |
| 18 | ID-card capture (vouchers, salary) | REQ-168/170 | **M** | `FileAttachment` effectively unused → AUD-006 |
| 19 | Employee + salary records | REQ-169/171 | I/U | |
| 20 | Letters (in/out) | — | I/U | |
| 21 | Document output: PDF / Excel / Print | REQ-120–123 | **M** | no renderer dependency anywhere → AUD-008 |
| 22 | Uploadable company templates | REQ-124 | P | models exist, version model orphaned → AUD-008 |
| 23 | Company settings (name, TRN, address) | REQ-146/147 | **M** | model exists, **no endpoint** → AUD-008 |
| 24 | Reporting: manifest P&L, cost categories, VAT | REQ-190–194 | **M** | no `reports` module; nav item is `planned` → AUD-009 |
| 25 | Reminders / alerts on unpaid released docs | REQ-184 | **M** | no notifications module or scheduler → AUD-018 |
| 26 | Agent portal | REQ-187/188 | P | bookings + statement only, **no B/L visibility** → AUD-010 |
| 27 | Audit log | — | I/U | `AuditLog` model, 10 code references |
| 28 | Configurable numbering | ADR-008 | P | **3 of 14 doc types** use the service → AUD-013 |
| 29 | Seed without demo business rows | REQ-198 | **D** | seed still writes demo cargo/voyage/customers → AUD-014 |

---

## 3. What the code confirms is genuinely done

Recorded because several planning documents still describe these as pending or wrong. Each was read in source.

### 3.1 Inspection gates the Load List — REQ-082 satisfied (VERIFIED)

`apps/api/src/modules/load-planning/load-planning.service.ts` rejects cargo whose inspection is not `DONE`:

- line 381: `if (cargo.inspectionStatus !== 'DONE')` → error `Inspection status is ${…}; only DONE cargo may be planned`
- line 556–558: same predicate when adding an item, with the cargo reference in the message
- line 455: the eligibility filter defaults to `inspectionStatus: 'DONE'`

The error message names the inspection status, which is what the employer asked for ("must raise an error stating
the inspection has not been done"). **Requirement met in code.**

### 3.2 Manifest consolidates APPROVED B/Ls, per-item parties (VERIFIED)

`apps/api/src/modules/manifest/manifest.service.ts`:

- line 29–30: `SUBMITTED: ['APPROVED','CANCELLED']`, `APPROVED: []` — APPROVED and CANCELLED are terminal
- line 303: header parties rejected when consolidating with `billIds` — *"each manifest line carries its own B/L
  parties (ADR-047 d4)"*
- line 336: bills must be `status: 'APPROVED'`
- line 347: `throw new BadRequestException('No matching APPROVED B/Ls found')`

This is the B/L-first model (ADR-047) actually implemented, not just designed.

### 3.3 B/L is created from Actual Loading, not from Manifest (VERIFIED)

`apps/api/src/modules/bill/bill.service.ts`:

- line 304: *"(ADR-029/042 predicate: COMPLETED Actual Loading with actualQuantity > 0)"*
- lines 589–591 and 918–920: `actualQuantity: { gt: 0 }` joined to `status: 'COMPLETED'` Actual Loading
- line 601: eligibility message *"(requires a COMPLETED Actual Loading with a recorded quantity greater than 0)"*
- lines 323–325: `createFromManifest` / `createFromCargo` paths (both retained)

So the "manifest-first ordering" that `docs/current-plan/09-final-implementation-roadmap.md` §2.2 still lists as
an open problem has been resolved.

### 3.4 Invoice arithmetic is correct (VERIFIED)

`apps/api/src/modules/invoice/invoice.service.ts:546–573`:

```
subtotal    = SUM(item.amount)                       // amount = qty × unitPrice
taxAmount   = (subtotal − discount) × taxRate / 100, floored at 0
totalAmount = subtotal − discount + tax
paidAmount  = owned by the voucher module (Phase 12)
```

No double-counting, no rounding drift (`toFixed(2)` before `Prisma.Decimal`). **The maths is right; the
granularity is wrong** — see AUD-001.

### 3.5 Voucher-number and document-number collision handling (VERIFIED)

`apps/api/src/modules/voucher/voucher.service.ts:176–204` — find-then-insert, P2002 → 409 → retry. Same
bounded-retry pattern in `cargo.service.ts:151–161`, `invoice.service.ts:200–205`,
`actual-loading.service.ts:250–256`. Number uniqueness is protected by the unique index plus retry, not by a lock
(except where `NumberingService` is used — see AUD-013).

### 3.6 Derived ledger statement, date-range filterable (VERIFIED)

`apps/api/src/modules/ledger/ledger.controller.ts` is 18 lines: a `GET /ledger/customers` delegating to
`voucherService.ledger()`. `LedgerQueryDto` (`voucher.dto.ts:137–160`) carries `customerId` (required),
`fromDate`, `toDate`, `currencyCode`, and an `invoice|voucher|all` filter. That satisfies REQ-162's date-range
requirement at the API level.

---

## 4. Gap register

Each finding: requirement reference → actual implementation and code paths → gap with evidence → desired
behaviour → proposed change → dependencies, risks, acceptance criteria.

---

### AUD-001 · VAT is header-level, not per line

| | |
| --- | --- |
| **Requirement** | REQ-144 — "VAT is entered **per line** as a percentage." EXPLICIT (EMP-114, EMP-115, EMP-611) |
| **Classification** | **Partial** — the feature exists, at the wrong granularity |
| **Status** | CONFIRMED (three independent confirmations) |

**Actual implementation.**
- `prisma/schema.prisma` → `Invoice.taxRate Decimal @db.Decimal(5,2)` with the comment *"percent 0..100"*, and
  `Invoice.taxAmount`.
- `InvoiceItem` → columns are `sequence, description, quantity, unitPrice, amount, notes`. **There is no tax or
  VAT column on the line.**
- `invoice.service.ts:546–573` → `tax = (subtotal − discount) × rate / 100`. One rate for the whole invoice.
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx:63, 292` → a single header `taxRate` field; line items
  carry no VAT input.

**Gap.** REQ-144 asks for a percentage per line. The system applies one percentage to the invoice. Where lines
attract different VAT treatments, the printed tax invoice will be wrong. REQ-146 requires the output be a UAE
**Tax Invoice** — so this is a compliance exposure, not a cosmetic one.

**Desired behaviour.** Each invoice line carries its own VAT percentage; the line amount and line VAT are stored
or derived; the invoice header VAT is the sum of line VAT.

**Proposed change.**
1. Migration: add nullable `taxRate Decimal(5,2)` and `taxAmount Decimal(18,2)` to `invoice_items`.
2. Service: compute per-line VAT; recompute the header as `SUM(line.taxAmount)`.
3. Backfill: for existing `ISSUED` invoices, carry the current header rate down to each line so historical
   totals are unchanged. **Never re-derive an issued invoice's total from new logic** — historical documents are
   frozen (ADR / plan principle: preserve historical document numbers and amounts).
4. DTO + UI: per-line VAT input; header becomes read-only derived.

**Dependencies.** None blocking. Touches one module, one table, one page.

**Risks.** Backfill arithmetic on already-issued invoices; any consumer reading `Invoice.taxRate` as an input
rather than a stored value.

**Acceptance criteria.** An invoice with lines at 0% and 5% produces the correct per-line VAT, a header VAT equal
to their sum, and an unchanged `totalAmount` formula; a previously issued invoice re-fetched after migration
returns byte-identical money fields.

---

### AUD-002 · Invoice is not linked to Job

| | |
| --- | --- |
| **Requirements** | REQ-134 — "The invoice is prepared by checking / matching the draft against the related Job Numbers." REQ-141 — "The B/L-generated invoice arrives in Draft state and is then matched against Job Numbers before issue." Both EXPLICIT |
| **Classification** | **Missing** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED.** Requirement confirmed as **many-to-many** (Q-AUD-01, DEC-071).

> Evidence: source pack §2.10 (accountant must see the *related Job Numbers*, plural) and **EMP-609** — *"check it
> against the related Job Numbers — Match all of them."* Implement as an `InvoiceJob` join table. Implementation
> gap remains. See `target-domain-and-finance.md` §1.4.

**Actual implementation.**
- `prisma/schema.prisma` → `Invoice` fields are `customerId, manifestId, billOfLadingId, voyageId, …`. **No
  `jobId`.**
- `Job` → `customerId, voyageId, jobType, status`, with `items JobCostItem[]`. **No invoice relation.**
- No code path joins invoices to jobs.

**Gap.** The single most-described step in the employer's invoicing narrative — draft arrives from the B/L, is
matched against job numbers, then issued — cannot be expressed. There is no way to see, on an invoice, which jobs
it covers; and no way to see, on a job, what was invoiced. REQ-134 and REQ-141 are unimplemented.

**Desired behaviour.** An invoice draft can be associated with one or more job numbers before issue.

**Proposed change.** Add a join table `InvoiceJob (invoiceId, jobId)` with a unique pair — **not** a single
`Invoice.jobId`, because REQ-141's flow (B/L → invoice) and AUD-003 (an invoice can span several B/Ls, each
potentially under a different job) both imply many-to-many. This is a design assumption and is raised as
**Q-AUD-01** in `open-questions.md`; if the employer confirms one job per invoice, a single nullable
`Invoice.jobId` is simpler.

**Dependencies.** None blocking. Should land in the same phase as AUD-001 and AUD-003 (all three reshape the
invoice).

**Risks.** Choosing single-vs-many wrongly forces a later migration. Hence the question.

**Acceptance criteria.** An invoice can list the jobs it covers; a job can list the invoices that billed it;
issuing is not blocked by having zero job links (REQ-200: optional fields must never block saving).

---

### AUD-003 · An invoice can reference only one B/L

| | |
| --- | --- |
| **Requirement** | REQ-141 (B/L-generated invoice) read together with the employer's invoice samples, which show several B/L numbers on one invoice |
| **Classification** | **Partial** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION (DEC-105).** Support **both** a single B/L and an

> invoice covering multiple B/Ls. All observed evidence is single-reference (the real invoice has one
> `BOE/DEC/BL#: KHS/26-108`; EMP-687 says *"the Invoice related to this Release Order"*), and source pack §5
> item 10 explicitly deferred the question — so an earlier draft's claim that one sample settles it is
> **withdrawn**. The decision resolves it in favour of supporting both. Implementation gap remains.

**Actual implementation.** `Invoice.billOfLadingId String?` — single, nullable. Plus `Invoice.manifestId String?`
and a denormalised `voyageId`.

**Gap.** One invoice ↔ one B/L. Whether the real business needs one-to-many is **UNRESOLVED** — it depends on the
employer's invoice samples (SRC-02, SRC-06). Raised as **Q-AUD-02**.

**Proposed change.** Do not change the schema until answered. If many, an `InvoiceBill (invoiceId, billOfLadingId)`
join mirrors AUD-002 and the two can share one migration.

**Dependencies.** Answer to Q-AUD-02. Shares a phase with AUD-001/AUD-002.

---

### AUD-004 · No General Journal

| | |
| --- | --- |
| **Requirements** | REQ-166 — "A General Journal capability allows posting directly onto a customer ledger outside invoicing (e.g. loans). Money paid out = Debit; money received = Credit." REQ-167 — the ledger is not only for customers; daily/office/running costs must be recorded so they can be deducted at year end |
| **Classification** | **Missing** |
| **Status** | CONFIRMED (schema-level) |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION (DEC-078, DEC-079).** A proper auditable

> general ledger and accounting-entry structure is **required**; customer balance screens are explicitly not a
> substitute (DEC-043). Migration approach: **additive** — introduce accounting entries alongside the derived
> ledger, reconcile, then consider switching the read path (DEC-081). Note that the legacy system had **no**
> ledger at all (source pack §4.2), so there is nothing to inherit. Implementation gap remains — P6.

**Actual implementation.** No `GeneralJournal`, `JournalLine`, `LedgerEntry`, `Ledger` or `Account` model exists
(52 models, all enumerated). The only money-posting entities are `Invoice` (ISSUED) and `Voucher`
(RECEIPT/PAYMENT). The ledger is a **derived view** over those two (ADR-032), materialised by
`VoucherService.ledger()`.

**Gap.** REQ-166 and REQ-167 cannot be satisfied by a derived ledger: there is nowhere to post a loan, an
adjustment, or an electricity bill. Consequently the annual tax computation (REQ-195) has no expense side.

**Desired behaviour.** A posting mechanism that writes directly to a ledger, supporting non-invoice and
non-customer entries.

**Proposed change.** This is the largest single piece of work in the audit and is deliberately **not** bundled
with the invoice fixes. It needs a decision first: **keep the derived ledger and add a journals table alongside
it, or replace the derived ledger with a real posted ledger?** That is **Q-AUD-03**, and it blocks the finance
phase. See `initial-roadmap.md` Phase 3.

**Dependencies.** Decision Q-AUD-03. Also depends on SRC-06 (Q01–Q160 answers) for the chart-of-accounts shape.

**Risks.** Highest-risk item in the roadmap. A posted ledger changes how every financial figure is computed and
must not silently alter historical balances. Recommended approach: additive — introduce the journal model without
changing how existing invoices and vouchers compute the statement; reconcile derived vs. posted and only then
consider switching the read path.

---

### AUD-005 · Voucher allocates to at most one document, and not to a B/L

| | |
| --- | --- |
**Requirement** | REQ-164 — "A voucher first selects the Customer, then optionally allocates to a specific **Invoice** or **B/L number**." REQ-165 — "An unallocated payment must NOT raise an error." |
| **Classification** | **Partial** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION (DEC-013…DEC-018).** A payment may reference

> one invoice, several invoices, an advance, other documents, or nothing — and **allocations must be stored per
> reference with amounts**. Evidence: the real **Receipt Voucher No. 477** carries three references (`1517`,
> `1526`, `Advance 477`). Partial allocation and unallocated credit are both supported. **REQ-165 must not
> regress** — an unallocated payment must never raise an error. Implementation gap remains — P6.

**Actual implementation.** `Voucher.invoiceId String?` — one optional invoice. No `billOfLadingId`. No
`VoucherAllocation` model. `customerId` is required.

**What works.** REQ-165 is satisfied: `invoiceId` is nullable, so an unallocated voucher posts to the customer's
ledger as a credit without error. **Do not add validation here** — the employer was explicit.

**Gap.** REQ-164 wants allocation to a B/L as an alternative target, and a payment covering several invoices is
not expressible. Whether multiple allocation is actually needed is **UNRESOLVED** → **Q-AUD-04**.

**Proposed change.** Minimum: add `Voucher.billOfLadingId String?` so the employer's stated alternative target
exists. If Q-AUD-04 answers "yes, multiple", add `VoucherAllocation (voucherId, invoiceId?, billOfLadingId?,
amount)` and treat the legacy `invoiceId` as the single-allocation fast path.

**Dependencies.** Q-AUD-04. Should ship with AUD-004 (both are ledger-shaping) or immediately after.

**Acceptance criteria.** A voucher can be posted unallocated (no error), allocated to one invoice, and allocated
to a B/L; the customer statement reflects each correctly.

---

### AUD-006 · No ID-card capture and no working attachment path

| | |
| --- | --- |
| **Requirements** | REQ-168 — "Payment Vouchers require ID-card capture (front and back) of the recipient — by upload or by camera — plus the recipient's signature on the printed voucher." REQ-170 — "Salary Slips also require ID-card capture (front and back, upload or camera) printed with the employee's signature." |
| **Classification** | **Missing** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED FOR CONTROLS (DEC-087…DEC-092).** Identity-document and signature

> capture is confirmed, **scoped to payment vouchers and salary slips only** (§2.15, REQ-168/170) — not extended
> indiscriminately. Access, viewing, download, replacement and deletion are permission-restricted and audited;
> no unrestricted public URLs; retention and secure deletion configurable. **Specific retention periods remain a
> compliance input** and are not invented here. Implementation gap remains — P4 (storage/controls), P12
> (retention configuration).

**Actual implementation.**
- `Voucher` columns: no attachment, no ID document, no signature field.
- `prisma/schema.prisma` → `FileAttachment` exists (`entityType, entityId, category, storageKey, filename, …`).
- Orphan check: `FileAttachment` is referenced **once** across `apps/api/src`, `apps/web/src` and `packages`
  (excluding the schema itself). There is no attachments module and no upload endpoint.
- No `Employee` attachment either — `SalaryRecord` has no attachment field.

**Gap.** The model was built; the feature was not. Both REQ-168 and REQ-170 are unimplemented, and there is no
storage adapter, no upload API, and no camera capture path in the web app.

**Proposed change.** Build the attachment capability as its own unit: storage adapter (local now, S3-shaped
later — the `FileAttachment.storageAdapter` column already anticipates it), POST/GET/DELETE endpoints, MIME and
size limits, permission codes, then bind `category` values to voucher and salary-slip entities. Signature capture
is a rendering concern and depends on AUD-008.

**Dependencies.** AUD-008 for printing the signature. Storage location decision → **Q-AUD-05**.

**Risks.** Storing identity documents raises data-protection obligations (retention, access control, encryption
at rest). This needs an explicit decision before implementation, not after.

---

### AUD-007 · The ledger cannot record office or daily expenses

| | |
| --- | --- |
| **Requirements** | REQ-167, REQ-195 — office/daily expenses must feed the annual tax computation |
| **Classification** | **Missing** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED (DEC-078, DEC-079).** Subsumed into the general-ledger requirement:

> office and daily expenses must be recorded so they feed year-end P&L (REQ-167, REQ-195). Cannot be satisfied
> while the ledger is customer-scoped. Implementation gap remains — P6.

**Actual implementation.** `Voucher.customerId` is required (`prisma/schema.prisma`). `VoucherService.ledger()`
is queried by customer. `GET /ledger/customers` requires `customerId` (`voucher.dto.ts:137–140`). There is no
account, cost-centre, or expense-category dimension anywhere in the money model.

**Gap.** Expenses that are not attributable to a customer cannot be recorded at all.

**Proposed change.** Resolved by AUD-004 if a real ledger with accounts is adopted. If the derived ledger is
kept, expenses need at minimum an entity with a category dimension — which is effectively a ledger. **Treat as a
sub-item of AUD-004, not a separate project.**

---

### AUD-008 · No document output pipeline; company settings unreachable

| | |
| --- | --- |
| **Requirements** | REQ-120 (PDF + Excel + Print on every document screen), REQ-121 (PDF carries stamps/marks/signature), REQ-122 (**Print must strip** stamps/marks/signature), REQ-123 (Excel so staff can correct before issuing), REQ-124 (upload the company's own templates), REQ-146 (Tax Invoice with address, mobile, email), REQ-147 (header carries TRN number) |
| **Classification** | **Missing** (rendering) / **Partial** (template models) |
| **Status** | CONFIRMED |

**Actual implementation.**
- **No rendering dependency exists.** Searched all TypeScript for `pdfkit`, `puppeteer`, `exceljs`, `handlebars`,
  `mustache`, `renderTemplate` → **zero matches.**
- No `documents` or `pdf` module (32 modules enumerated; none is documents/printing).
- `DocumentTemplate` exists and is referenced 16 times. **`DocumentTemplateVersion` is referenced 0 times** —
  orphaned. So versioned templates are modelled but never used.
- `CompanySettings` exists (company name, TRN `taxNumber`, address, city, country, phone, email, defaultCurrency)
  and is referenced **once** in application code. **There is no settings module and no endpoint**, so the company
  name and TRN cannot be maintained through the product — yet REQ-146/147 require them on a printed tax invoice.
- `Invoice` has **no TRN field** (grep for `trn|taxId|taxNumber` across `apps/api/src/modules/invoice/dto/` →
  0 matches). TRN exists only on `CompanySettings` and `Customer`.

**Gap.** Six explicit requirements (120–124, 146, 147 partially) are unimplemented. REQ-124 named nine template
types: Loading List, Invoice, Delivery Order, Release Order, Salary Slip, Voucher, Payment, Receipt, Ledger.

**Note on REQ-122.** Print must *strip* stamps while PDF *includes* them. The requirement is counter-intuitive
but stated three times; do not "correct" it. Any renderer must therefore support a **with-stamps** and a
**without-stamps** variant of the same template.

**Dependencies.** `CompanySettings` endpoint (small, do it first). **SRC-07** — the employer's actual templates;
without them, the render approach is guesswork → **Q-AUD-06**.

**Risks.** Choosing a rendering stack (HTML→PDF vs. template-fill vs. Excel-first) before seeing the templates
risks a rewrite. Recommended: Phase 0/1 builds the settings endpoint and the attachment/storage foundation;
rendering starts only once SRC-07 is in hand.

---

### AUD-009 · No reporting; manifest cost fields do not match the employer's categories

| | |
| --- | --- |
| **Requirements** | REQ-190 (per-manifest P&L), REQ-191 (cost categories: vessel charter, Port Use, Handling, Lashing, miscellaneous), REQ-192 (income = sum of invoices against that manifest's B/Ls), REQ-193 (annual tax P&L by filtering per-manifest results), REQ-194 (quarterly VAT report: VAT collected vs. VAT paid) |
| **Classification** | **Missing** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED (DEC-017, DEC-038).** Cost categories are confirmed as **Vessel

> Hire, Port Use, Port Handling, Lashing, and other voyage-related costs** (source pack §2.19, REQ-191), as a
> configurable list. The legacy columns (`gasCost`, `shipperCost`, `podCost`, `polCost`) are historical artifacts
> and must not be treated as the specification. Reporting is confirmed as a **core capability** (DEC-037).
> Prerequisites: P3 (per-line VAT and B/L links) and P6 (expense side) must land before P7.

**Actual implementation.**
- No `reports` module. No `report:*` permission code in `prisma/seed.ts`.
- `apps/web/src/lib/navigation/nav.ts` — the `insightControl` section contains exactly one item:
  `{ labelKey: 'reports', icon: BarChart3, status: 'planned', description: 'Reporting & P&L' }`.
- `Manifest` **does** carry cost columns — but they are the **legacy** ones:
  `gasCost, lashingCost, shipperCost, podCost, polCost` (`prisma/schema.prisma`). Only *lashing* appears in
  REQ-191's named list. There is no vessel charter, no Port Use, no handling, no miscellaneous.

**Gap.** All five reporting requirements are unimplemented. Worse, the cost fields that do exist were inherited
from the legacy system rather than derived from the employer's stated categories — a case where legacy behaviour
was carried forward instead of the requirement. **Do not treat the legacy columns as the specification.**

**Proposed change.** Reporting is a data-modelling problem before it is a UI problem:
1. Introduce cost capture on the voyage/manifest using the employer's own categories (configurable list, not
   hard-coded — REQ-191 names five but the phrasing "miscellaneous costs" implies extensibility).
2. Income side is derivable once AUD-002/AUD-003 land, because REQ-192 needs invoice↔B/L↔manifest links.
3. Then build the P&L computation, the filterable annual view (REQ-193), and the quarterly VAT report (REQ-194 —
   which is only sound once AUD-001 gives per-line VAT).

**Dependencies.** **AUD-001** (VAT report needs per-line VAT), **AUD-002/003** (income rollup needs B/L links),
**AUD-004** (expense side needs somewhere to post costs). **This is why reporting is late in the roadmap, not
because it is low value.**

**Risks.** Producing P&L numbers before the underlying links exist yields figures that look authoritative and are
wrong. Acceptance must include a reconciliation against a manually computed example.

---

### AUD-010 · The agent portal does not show B/L release status

| | |
| --- | --- |
| **Requirements** | REQ-187 — agents get their own login and see only their own destination's data ("Khorramshahr only sees Khorramshahr"), scoped to their own B/Ls, Manifests and Release Orders. REQ-188 — the portal exists so agents **stop telephoning Duna to ask whether a B/L has been released** |
| **Classification** | **Partial** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED (DEC-062, DEC-077).** Cargo-release authorization is the **Release

> Order business workflow**, **not** a B/L lifecycle status — this is the key correction to this finding. Agents
> must see **B/L, Manifest and Release Order** for their own destination (§2.18, REQ-187/188). Legacy cannot
> inform this: defect **D1** means `RELEASED` was defined but **never written**. The portal currently exposes
> only `me`, bookings and statement — the gap stands, but the thing to expose is Release Order status. P5.

**Actual implementation.** `apps/api/src/modules/portal/portal.service.ts`:
- Scope: `portalManifestScopeIds()` (line ~139) returns `[user.portalAgentId]` or `[]`. Manifests are scoped by
  `Agent` master id.
- `portalCustomerIdOf()` → bookings and statement are scoped by `Customer` id.
- `me()` returns `{ customer, summary: { bookingsTotal, bookingsPending, approvedManifests, balanceDue, currencyCode } }`.
- Surface exposed: `me`, bookings, statement. **There is no B/L listing and no release-order listing.**

A candid comment in the file (lines ~123–130) records a known limitation: because `manifests.agentId` now
references `agents`, a user linked only to a portal **Customer** "therefore scopes to NO manifests (empty list)".

**Gap.** REQ-187 is partially met: login works, destination/agent scoping works, statements work. But the portal
does not expose the one thing REQ-188 says it exists for — whether a B/L has been released. An agent logging in
today still has to telephone.

**Proposed change.** Add agent-scoped B/L and release-order read endpoints and a portal page, using the same
`portalAgentId` scope, surfacing `BlStatus` (which already contains `RELEASED`). This is a **small, high-value**
change relative to its benefit — it is the most visible win available.

**Dependencies.** Confirmation of which `BlStatus` values mean "released" to an agent → **Q-AUD-07** (the enum
has both `RELEASED` and `ISSUED`; see AUD-019).

**Acceptance criteria.** An agent scoped to destination D sees only B/Ls and release orders for D; can see
release status without contacting the office; sees nothing for other destinations.

---

### AUD-011 · Customer carries fields the employer explicitly forbade

| | |
| --- | --- |
| **Requirement** | REQ-017 — "Customer record must **not** carry Type, Currency, TRN Number or Short Name fields." EXPLICIT (EMP-225, EMP-237). The catalogue flags this as an *explicit exclusion — do not add these back* |
| **Classification** | **Different from documented requirement** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED (DEC-075).** **REQ-017 stands; no reversal was found in any source.**

> The prohibited fields must not be introduced merely because they are convenient. The Customer model must still
> support **natural and legal persons** (source pack §2.9 — *"حقیقی یا حقوقی"*) and remain distinct from
> commercial roles. The existing `type` column is seeded with **the wrong semantics** (commercial roles rather
> than the natural/legal distinction) and must be removed or repurposed. Do not silently delete — P10.

**Actual implementation.** `prisma/schema.prisma` → `Customer` has **all four**:
`type String?`, `shortName String?`, `taxId String?`, `currency String?`, plus `creditLimit Decimal?`.

`type` is live: `portal.service.ts` `me()` selects `type`, and `prisma/seed.ts` seeds customers.

**Gap.** The system does the opposite of an explicit, twice-stated employer instruction. Either these fields were
added deliberately after the requirement was captured (in which case the requirement record is out of date and
needs an explicit reversal, recorded as such), or they crept in and should be removed.

**Proposed change.** **Do not silently delete.** This is a decision for the employer, recorded as **Q-AUD-08**.
Two defensible outcomes: (a) remove the four fields and migrate any live values elsewhere; (b) keep them and
record an explicit, dated reversal of REQ-017 with the reason. What is not acceptable is leaving an explicit
requirement contradicted in code with nobody having decided.

**Dependencies.** SRC-01 (`dunaData/`) may contain the later instruction that authorised these fields.

**Risks.** Removing `type` touches the portal `me()` contract. Removing `currency` may affect the statement
filter (`LedgerQueryDto.currencyCode`).

---

### AUD-012 · Port city and abbreviation are optional

| | |
| --- | --- |
| **Requirements** | REQ-030 — Port is recorded as Port name, City, Country. REQ-031 — "Port Name, City, Country and Abbreviation are all **mandatory**." EXPLICIT (EMP-241–255, EMP-268) |
| **Classification** | **Partial** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — PARTIALLY RESOLVED (DEC-064…DEC-067).** Evidence establishes **8 ports**

> (Hamriyah, Khorramshahr, Bandar Abbas, Bushehr, Jebel Ali, Rajaee, Sohar, Dubai) and **3 verified codes**
> (HAM per EMP-264-266, KHS and RJS per real B/L numbers and EMP-544/546). The **complete list and remaining
> abbreviations are still needed** before the columns can be constrained. Open points: Bandar Abbas and Rajaee
> may be the same port complex; Khalifa Port is seeded but appears in **zero** sources. Port fields must also
> gain display name and aliases.

**Actual implementation.** `prisma/schema.prisma` → `Port`: `name String` (required), `country String`
(required), `city String?` (**nullable**), `abbreviation String? @unique` (**nullable**) — the schema comment says
*"nullable during migration"*, so this was scaffolding that was never tightened.

**Gap.** REQ-031 says all four are mandatory; two are nullable. Any port created without an abbreviation or city
will produce documents that cannot show the port in the required form.

**Proposed change.** Backfill existing rows, then a migration making both columns `NOT NULL`. **Order matters:**
backfill first, verify zero nulls, then constrain. Blocked until the real port list is known — see **Q-AUD-09**.
If the real list is unavailable, make them required for *new* records (service-layer validation) and leave the
column nullable for historic rows.

---

### AUD-013 · Numbering is configurable for only 3 of 14 document types

| | |
| --- | --- |
| **Reference** | ADR-008 (configurable numbering); `NumberingSequence` model; `common/infrastructure/numbering/numbering.service.ts` |
| **Classification** | **Partial** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION (DEC-024…DEC-028), with two corrections.**

> Numbering must be administrator-configurable per document type. **Correction 1:** REQ-102 (per-destination B/L
> numbering) is **already implemented** — only the format string differs. **Correction 2:** REQ-040 (voyage
> `n/yy`) is **already implemented** per destination + year; the **vessel** component is missing. The remaining
> work is migrating 11 types onto `NumberingService` and re-seeding formats from real samples — P2.

**Actual implementation.**
- `NumberingService.allocateNumber()` exists with `documentType, scopeType, prefix, format, padding, period`, and
  uses `SELECT … FOR UPDATE` (transactional) — the robust path.
- **Used by exactly three modules:** `bill` (5 references), `manifest` (4), `voyages` (3).
- **Eleven document types still use a local `generateReference()`** with a hard-coded `XXX-YYMM-` prefix and
  read-then-write collision retry:

| Module | Prefix | Method |
| --- | --- | --- |
| `invoice` | `INV-YYMM-` | local read-then-write, P2002 retry |
| `proforma` | `PRF-YYMM-` | local |
| `quotation` | `QT-YYMM-` | local |
| `voucher` | `RCP-` / `PMT-YYMM-` | local find-then-insert, P2002 retry |
| `cargo` | `CRG-YYMM-` | local |
| `inspections` | `INS-YYMM-` | local |
| `load-planning` | `LL-YYMM-` | local |
| `actual-loading` | `AL-YYMM-` | local |
| `discharge` | `DIS-YYMM-` | local |
| portal bookings | `BRK-YYMM-` | local |
| salary | `SAL-YYMM-` | local |

**Gap.** A frequently repeated claim — including in the analysis knowledge base — is that number formats are
"data, not code" and can be changed by editing `NumberingSequence` rows. **For 11 of 14 types that is false.**
Changing an invoice number format today requires a code change.

**Proposed change.** Migrate each remaining module onto `NumberingService` one at a time, per document type, with
a seeded `NumberingSequence` row whose prefix/format reproduces the current output exactly. Verify by generating a
number before and after and comparing. Historical numbers are never rewritten.

**Dependencies.** None. Mechanical, per type, and safely incremental — good candidate for early phases because it
is low-risk and removes a class of future surprise.

**Risks.** Under concurrency the local generators are weaker than `NumberingService` (bounded retry vs. row lock);
the migration also removes that weakness.

---

### AUD-014 · The seed still writes demo business rows

| | |
| --- | --- |
| **Requirement** | REQ-198 (no fake business data) and the delivery note for ADR-047 / Phase 5 Unit 4, which states the database holds real data and the system "must not ship demo rows on boot" |
| **Classification** | **Different from documented** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION.** Ports and yards are **operator-managed

> reference data**, seeded from verified documents (DEC-064/065). The structural seed (currencies, permissions,
> roles, admin user, company settings) is separated from demonstration data, which is gated behind an explicit
> opt-in (P1). Dependency: P0 must first measure whether any e2e suite depends on the seeded rows (Q-AUD-11).

**Actual implementation.** `prisma/seed.ts` (624 lines) creates, unconditionally:
- currencies USD + AED — **fine**, these are real reference data
- 160 permissions, `admin` and `ops` roles, an admin user — **fine**, this is structural
- `companySettings` row `default-company` — fine
- 2 ports (Jebel Ali, Khalifa) + 2 yards — **arguably fine**, real-world master data
- **1 vessel, 1 voyage, 2 customers, 3 cargo records (notes: "Approved electronics containers"), inspections,
  1 load list + load list item** — **demo business transactions**
- a demo portal user → demo Agent `AGT-001` link, and a relink of demo manifest `MAN-2609-00004` to that agent

There is **no environment guard**: no `SEED_DEMO` flag, no `NODE_ENV` check. The only `process.env` reads are
`SEED_ADMIN_EMAIL` (line 313) and `SEED_ADMIN_PASSWORD` (line 314).

**Gap.** Running the seed against a real database injects fake cargo, customers, a voyage and a load list. This
directly contradicts both REQ-198 and the ADR-047 delivery note. It is also a live operational hazard: nothing
prevents `pnpm db:seed` on production.

**Proposed change.**
1. Split the seed into **structural** (currencies, permissions, roles, admin user, company settings) and
   **demonstration** (everything else).
2. Structural runs always. Demonstration runs only behind an explicit opt-in (`SEED_DEMO_DATA=true`) and logs a
   loud warning.
3. Ports/yards: decide whether these are seed data or operator-entered master data → **Q-AUD-10**.

**Dependencies.** Confirmation of whether the dev/test workflow depends on the demo rows for manual testing →
**Q-AUD-11**. If it does, provide a separate, clearly named dev fixture script instead.

**Risks.** Removing the demo rows may break developer habits and possibly e2e fixtures that assume seeded cargo.
Check test dependencies before removal.

---

### AUD-015 · Cargo carries duplicate and legacy columns

| | |
| --- | --- |
| **Reference** | Data hygiene; ADR-044 reserved `comments` as canonical with cleanup deferred |
| **Classification** | **Different from documented** |
| **Status** | CONFIRMED |

**Actual implementation.** `prisma/schema.prisma` → `Cargo` contains:
- both `comments String?` **and** `comment String?`
- both `chassis String?` **and** `chassisNumber String?`
- both `serial String?` **and** `serialNumber String?`
- both `serialNumber` **and** `vin String?`
- free-text `pol` / `pod` **alongside** the relational `portId` / `destinationPortId` foreign keys
- a free-text `manifestNumber String?` while `ManifestItem` also exists

**Gap.** Six overlapping representations of three concepts. Whichever column a screen reads, the other can drift.
ADR-044 chose `comments` as canonical but the duplicate was left in place.

**Proposed change.** Do **not** delete columns yet. Per ADR-044 the cleanup is deferred to a later unit. Sequence:
(1) confirm which column each code path and screen writes; (2) backfill canonical ← legacy where the legacy has
data and canonical is null; (3) switch reads; (4) drop the column in a separate, later migration. Expand/contract,
never one-shot.

**Dependencies.** Requires reading every consumer of each column — a bounded task, but it must be done before the
drop, not after.

---

### AUD-016 · Load List / Actual Loading enums have 6 values; ADR-041 specifies 3 states

| | |
| --- | --- |
| **Reference** | ADR-041 (3-state: `DRAFT → FINALIZED (→ CANCELLED)`) |
| **Classification** | **Different from documented** |
| **Status** | CONFIRMED — and genuinely ambiguous |

**Actual implementation.** Both enums ship six values:
`DRAFT | IN_PROGRESS | PARTIALLY_LOADED | COMPLETED | FINALIZED | CANCELLED`.

**Gap.** Either the ADR was never fully applied to the schema, or the ADR is out of date and six states are
intended. The six include both `COMPLETED` and `FINALIZED`, which is exactly the kind of pair that produces
arguably-different business meaning.

**Proposed change.** **No code change until decided** → **Q-AUD-12**. Record which is authoritative. If 3-state
is correct, this is a data migration on real rows and must be planned carefully (map `IN_PROGRESS` and
`PARTIALLY_LOADED` → `DRAFT`; `COMPLETED` → `FINALIZED`).

**Risks.** Guessing wrong corrupts operational state. This is a question, not a task.

---

### AUD-017 · Invoice has no partial/paid state — correct by design, but constrains REQ-184

| | |
| --- | --- |
| **Reference** | ADR-032 (derived ledger, no `PAID` status) |
| **Classification** | **Implemented as designed** — recorded so it is not mistaken for a defect |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — CONFIRMED AS DESIGNED, with a superseding requirement.** The absence of a

> stored `PAID` status remains correct (ADR-032, derived `paidAmount >= totalAmount`). However DEC-078 now
> requires a real accounting ledger, which supersedes the derived model for **accounting** purposes. Payment
> state for *display* may remain derived.

**Actual implementation.** `InvoiceStatus = DRAFT | ISSUED | CANCELLED`. `invoice.service.ts:25` states it
plainly: *"PAID is NOT a stored status: Phase 12 maintains paidAmount, and 'paid' is derived
(paidAmount >= totalAmount) at read time."* Line 132 filters `paidAmount: { lt: totalAmount }` for "outstanding".

**Consequence.** There is no stored "partially paid" state to filter on, and REQ-184 (alert when a released
document remains unpaid) has no status field to hang a rule off — only an amount comparison. That is workable,
but the rule must be expressed as *release date vs. paidAmount ratio*, which is a computation, not a status check.

**No change proposed.** Noted because it shapes how AUD-018 must be built.

---

### AUD-018 · No notification or scheduling capability

| | |
| --- | --- |
| **Requirement** | REQ-184 — "An alert / notice is raised when a released document remains unpaid." Examples: released one week with no payment; released a month ago and 20% still unpaid. Follow-up window "one or two weeks" |
| **Classification** | **Missing** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION (DEC-056…DEC-058).** Notification conditions,

> recipients, timing, repetition and channels must be **configurable**. The historical thresholds — one week
> unpaid (EMP-148), a month with 20% unpaid (EMP-149), follow-up in one or two weeks (EMP-692) — are **examples,
> not universal defaults**, and must not be hard-coded. Channels: in-app and email, extensible. P10.

**Actual implementation.** No `notifications` module. No scheduler, queue, or cron dependency. No notification
permission code in the seed. Nothing computes "released and unpaid".

**Gap.** REQ-184 is unimplemented. Note also that the **threshold is illustrative, not specified** — the
employer gave examples, not a rule. That is already recorded as an open question (RLS-01 in the earlier analysis)
and is carried forward as **Q-AUD-13**.

**Proposed change.** Defer. It depends on AUD-004/AUD-017 for the financial state, on a decision about delivery
mechanism (in-app only? email?), and on the threshold. Cheapest viable first step: an in-app "unpaid released
documents" **list** with no scheduling — which delivers most of the value with none of the infrastructure.

**Dependencies.** Q-AUD-13 (threshold), Q-AUD-14 (delivery mechanism).

---

### AUD-019 · BlStatus has six values, including both FINAL and ISSUED

| | |
| --- | --- |
| **Reference** | ADR-046 — "four states with configurable mapping" |
| **Classification** | **Different from documented** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED (DEC-061, DEC-062).** Official B/L status labels are **not**

> established and must remain **configurable** (DEC-060) — do not invent them. The lifecycle *shape* is
> evidenced: draft (with watermark, sent for correction) → approval/finalization → issuance (§2.11, REQ-105).
> Release authorization is the Release Order, not a B/L status.

**Actual implementation.** `BlStatus = DRAFT | FINAL | APPROVED | RELEASED | ISSUED | CANCELLED` (6).

**Gap.** ADR-046 describes four states; six are modelled. `FINAL` and `ISSUED` are adjacent in meaning, as are
`APPROVED` and `RELEASED`. Which values the employer's workflow actually uses — and which one means "the agent can
collect" — is **UNRESOLVED** → **Q-AUD-07**.

**Impact.** Blocks AUD-010 (portal release visibility): showing agents a status they do not recognise is worse
than showing nothing.

---

### AUD-020 · Four top-level documents are materially stale

| | |
| --- | --- |
| **Reference** | Objective 1 of the audit brief |
| **Classification** | **Different from code** |
| **Status** | CONFIRMED, item by item |

Each item below is a direct contradiction between a document and the source.

| Document | Claims | Actual (VERIFIED) |
| --- | --- | --- |
| `docs/architecture.md` | Module status table marks **Load Planning, Load List, Manifest, B/L, Job/JobCosting/Invoices/Payments, Release/Delivery/Discharge, Reports/Documents/Audit/Agent Portal** as "Planned" | All of those except **Reports/Documents** are implemented (32 modules; each has controller + service + DTO) |
| `docs/database-schema.md:150–172` | "Planned major entities (later phases) … **not yet implemented**" — 18 entities named | **12 exist under those exact names** (`LoadList`, `ActualLoading`, `Manifest`, `BillOfLading`, `Job`, `Invoice`, `ReleaseOrder`, `DeliveryOrder`, `Discharge`, `NumberingSequence`, `DocumentTemplate`, `AuditLog`). **3 more exist under different names** (`JobLine`→`JobCostItem`, `InvoiceLine`→`InvoiceItem`, `Payment`→`Voucher`). **3 have no equivalent**: `LoadPlan` (the `load-planning` module covers it via `LoadList`), `LedgerEntry` (**deliberately** absent — ADR-032 derived ledger), `CurrencyRate` (see AUD-023) |
| `docs/permissions.md:16` | "## Seeded permissions (**49**)" | `prisma/seed.ts` seeds **160** codes across **35** modules |
| `docs/workflows.md` | Cargo `READY → LOADED` and `LOADED → DELIVERED` "endpoint not yet present"; inspection `PENDING / APPROVED / REJECTED` | `CargoStatus` has `READY_FOR_LOADING` (not `READY`); `InspectionStatus` is `PENDING / BOOKED / DONE / FAILED / NEEDS_REINSPECTION` |
| `docs/current-plan/09-final-implementation-roadmap.md` §2.2–2.3 | "B/L and Manifest still depend on Manifest-first ordering and Customer FK parties"; "No B/L revision model"; "No ManifestItem→BillOfLadingItem reference" | All three are **done** — see §3.2 and §3.3, and `BillOfLadingRevision` exists in the schema |

**Why this matters beyond tidiness.** A reader who trusts `architecture.md` believes B/L and Manifest do not
exist and will plan to build them. A reader who trusts `permissions.md` under-counts the permission surface by
111 codes. These documents are actively misleading, not merely incomplete.

**Proposed change.** Corrections are proposed in `doc-consolidation-proposal.md` — not applied, pending approval.

---

### AUD-021 · Navigation has 10 sections where the requirement says 6, plus a stale duplicate entry

| | |
| --- | --- |
| **Requirement** | REQ-001 — "The dashboard sidebar has exactly **six** top-level sections, in this order: Overview, Operations, B/L & Manifest, Accounting, Master Data, Access Control." EXPLICIT (EMP-185, EMP-186) |
| **Classification** | **Different from documented** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION.** **Preserve the discrepancy and document it.**

> Do not automatically delete existing navigation — every additional section corresponds to a feature the employer
> asked for (Salary, Letters, Agent portal, Reports). Separately and unambiguously: the stale `planned` "Agent
> portal" entry, which duplicates the implemented `/portal` and `/agents`, should be removed — P1.

**Actual implementation.** `apps/web/src/lib/navigation/nav.ts` → `NAV_SECTION_ORDER` has **10** entries:
`overview, operations, commercial, masterData, people, correspondence, portal, accessControl, administration,
insightControl`.

Also: the `commercial` section contains
`{ labelKey: 'agents', icon: UserCircle, status: 'planned', description: 'Agent portal' }` — a **planned** "Agent
portal" entry, while `/portal` exists elsewhere in the same file with `status: 'implemented'`, and `/agents`
(Agent master data) exists in `masterData` also marked implemented. The planned entry is stale and duplicates two
implemented pages.

**Assessment.** The 10-section structure is a reasonable *refinement* — Operations/Commercial/People/
Correspondence/Master Data are all real parts of the product. This is not obviously a defect; it is a deviation
from an explicit statement that was never revisited. **Requiring exactly six would remove working navigation.**

**Proposed change.** Do not silently change either side. Raise as **Q-AUD-15**: confirm whether the six-section
structure is a hard requirement (in which case several sections must be merged and the plan adjusted) or whether
the employer accepts the richer structure now that he has seen it. Fix the stale duplicate entry regardless —
that one is unambiguous.

---

### AUD-022 · Test coverage gaps and an unverifiable suite

| | |
| --- | --- |
| **Reference** | Objective 2 — classify as verified / untested / uncertain |
| **Classification** | **Uncertain** (suite not executed) |
| **Status** | CONFIRMED as a limitation |

**Findings.**
- **22 e2e suites exist**, covering: app, auth, master-data, cargo-inventory, inspection, voyage, vessel,
  load-list/actual-loading, manifest, bill, discharge, invoice, voucher, job, salary, letter, quotation,
  proforma, portal, delivery-release, party-masters, party-cutover.
- **No `ledger.e2e-spec.ts`.** The derived customer statement — a financial artefact with money arithmetic — has
  **no e2e test**. This is the single most notable coverage gap found.
- **No `numbering` e2e suite**, despite numbering being the thing most likely to break silently under
  concurrency (AUD-013).
- **`node_modules`, PostgreSQL and `.env` are all absent**, so no suite was run. The "403/403 green" figure is
  DOCUMENTED in `docs/current-plan/11-implementation-state.md` and **UNVERIFIED** here.

**Update 2026-10-12 (Phase 1 review, additive).** On 2026-10-12 the 22 API e2e suites were executed in a sandbox against a fresh, disposable database with only the required seed: **22/22 suites and 403/403 tests passed**, and a second run on the same database also passed. This used a sandbox-only WASM Prisma engine and a test-only Jest mapping, not the production native engine, so it is evidence about the code under that harness. The native-engine baseline on the owner's server is still pending (acceptance A4). See [`e2e-sandbox-run-2026-10-12.md`](e2e-sandbox-run-2026-10-12.md).

**Proposed change.** Phase 0 of the roadmap is: install, configure, migrate, run the suite, and record the real
number. Everything else is built on that. Add ledger and numbering e2e suites in the relevant phases.

### AUD-023 · No dated exchange-rate history

| | |
| --- | --- |
| **Reference** | Multi-currency support; `CurrencyRate` was listed in `docs/database-schema.md` as a planned entity |
| **Classification** | **Missing** |
| **Status** | CONFIRMED |

> **STATUS UPDATE (2026-10-11) — RESOLVED BY DESIGN DECISION (DEC-001…DEC-012), and promoted to a P7

> prerequisite.** Multi-currency **is required** — at least AED, USD, AUD, CNY, IRR, administrator-extensible.
> A dated rate table must land in **P6 before P7 reporting**. **Correction to prior work:** an earlier draft
> claimed "the employer says Dirham"; a word-boundary search returns **zero** AED/Dirham/USD/Dollar matches in
> the statements. AED is evidenced by 5/5 document samples and is **not** a universal policy (DEC-003).

**Actual implementation.**
- `Currency` model exists (`code, name, symbol, isActive, sortOrder`) — a reference list only, **no rates**.
- `CurrencyRate` does **not** exist (verified against all 52 models).
- `Voucher.exchangeRate Decimal(10,4)` and `Voucher.currencyCode` exist — the rate is captured **per voucher**, at
  the moment of entry.
- `Invoice.currencyCode` defaults to `USD` with no rate field. `CompanySettings.defaultCurrency` defaults to
  `USD`; `supportedCurrenciesJson` defaults to `["USD","AED"]`.
- `LedgerQueryDto` filters by one currency at a time (`voucher.dto.ts:152–154`).

**Gap.** There is no historical record of what the exchange rate was on a given date. A multi-currency ledger
statement therefore depends entirely on whatever rate the operator typed into each voucher — which is unauditable
and cannot be restated. `docs/database-schema.md` anticipated `CurrencyRate`; it was never built.

**Note on the default currency.** The business operates in AED, but `Invoice.currencyCode` and
`CompanySettings.defaultCurrency` both default to `USD`. That may be deliberate (USD is the invoicing currency,
AED the reporting currency) or an oversight. Flagged as **Q-AUD-18**; low urgency but easy to get wrong silently.

**Proposed change.** If multi-currency reporting is in scope, add a dated `CurrencyRate` table
(`currencyCode`, `effectiveDate`, `rate`) and make the voucher rate default to the effective rate for the voucher
date while remaining overridable. If multi-currency reporting is *not* in scope, state that explicitly and leave
it.

**Dependencies.** **Q-AUD-19** — is multi-currency reporting actually required? This determines whether the gap is
a defect or an accepted simplification. Does not block any phase today.

---

## 5. Findings that are NOT defects

Recorded so a future reader does not "fix" them:

1. **Invoice has no `PAID` status** (AUD-017) — deliberate, ADR-032. Payment state is derived.
2. **`Invoice.dueDate` exists** — present in schema, DTO (`invoice.dto.ts:83, 149`) and the web form
   (`invoices/page.tsx:66, 222`). Earlier analysis recorded REQ-147's due-date element as missing; **that was
   wrong.** The missing part of REQ-147 is the **TRN number**, not the due date (see AUD-008).
3. **No `LedgerEntry` model** — deliberate (ADR-032, derived ledger). It is not an oversight; but it is also why
   REQ-166/167 are unmet (AUD-004).
4. **B/L can be created without a manifest** — `BillOfLading.manifestId` is nullable by design (ADR-045).
5. **Cargo `READY_FOR_LOADING`** is the correct enum value; documents saying `READY` are stale (AUD-020).
6. **Legacy cost columns on `Manifest`** are not the specification (AUD-009) — but they are also not a bug to
   remove until the replacement cost model exists.

---

## 6. Summary by domain

| Domain | Findings | Largest gap |
| --- | --- | --- |
| Finance & accounting | AUD-001, 002, 003, 004, 005, 007, 017 | General journal + per-line VAT + job linkage |
| Documents & output | AUD-006, 008 | No renderer at all; company settings unreachable |
| Reporting | AUD-009 | Nothing exists; cost categories are legacy-shaped |
| Portal | AUD-010 | B/L release status not exposed |
| Master data | AUD-011, 012 | Customer fields contradict REQ-017 |
| Platform | AUD-013, 014, 015, 016, 019, 022, 023 | Seed ships demo data; numbering half-migrated; no dated FX rates |
| Documentation | AUD-020, 021 | Four top-level docs actively misleading |

**Blocking decisions (all in `open-questions.md`):** Q-AUD-01 (invoice↔job shape), Q-AUD-03 (derived vs. posted
ledger), Q-AUD-06 (template/render approach), Q-AUD-07 (which B/L status means released), Q-AUD-08 (REQ-017
reversal?), Q-AUD-15 (six nav sections or ten).
