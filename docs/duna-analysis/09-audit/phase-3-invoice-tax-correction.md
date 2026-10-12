# Phase 3 — Invoice tax, links, TRN and controlled correction

Status: implementation complete on branch `arena/be9b4e5b-duna`, **not deployed**. Phase 4 has not started and needs explicit owner approval.
Roadmap: `initial-roadmap.md` (Phase 3 block, ~L126–140). Evidence: `confirmed-decisions.md` DEC-019…023, DEC-068…072, DEC-100…105; `audit-findings.md` AUD-001, AUD-002, AUD-003; `requirements-catalog.md` REQ-134, REQ-141, REQ-143/144/145/147.

## 1. What changed

### Database (`prisma/schema.prisma`, `prisma/migrations/20261013120000_invoice_tax_links_correction/migration.sql`)
The migration is additive. It drops, renames and re-types nothing, and it changes no invoice header total, subtotal, tax or status.

| # | Change | Backfill / effect on existing rows |
|---|---|---|
| 1 | `invoice_items.taxRate DECIMAL(5,2)` and `taxAmount DECIMAL(18,2)`, both nullable | `taxRate` is copied from the header rate of the same invoice. `taxAmount` is **not** backfilled. |
| 2 | `invoices.trn VARCHAR(40)`, nullable | Historical invoices stay NULL. Their printed TRN is not recorded, and `CompanySettings` holds only the current value. |
| 3 | `CompanySettings.invoiceCorrectionApprovalRequired BOOLEAN NOT NULL DEFAULT false` | Approval is off until the owner turns it on. |
| 4 | `invoice_jobs (invoiceId, jobId)` many-to-many | **No rows are invented.** No existing link is inferred. |
| 5 | `invoice_bills (invoiceId, billOfLadingId)` | Each existing `invoices.billOfLadingId` is copied in. `ON CONFLICT` makes this replay-safe. The legacy column is kept. |
| 6 | `invoice_corrections` (original, replacement, status, reason, requester, approver, timestamps, decision note); unique index on `replacementInvoiceId` | None. |

Prisma models: `InvoiceJob`, `InvoiceBill` (~L1537, ~L1550) and `InvoiceCorrection` (~L1572).

### API (`apps/api/src/modules/invoice/`)
- `invoice-tax.ts` (new): per-line tax arithmetic. Header VAT = sum of line VAT. The discount is allocated pro-rata by line amount, with the remainder on the last line. Rounding is exact decimal, per group.
- `invoice-number.ts` (new): the INV numbering helper, extracted from `invoice.service.ts`. Numbering behaviour is unchanged (Phase 2 family `invoice`).
- `invoice.service.ts`: rewritten. Public methods are unchanged from HEAD (`create`, `list`, `findById`, `update`, `remove`, `addItem`, `updateItem`, `removeItem`, `issue`, `cancel`) and `companyTrn` is added. Line VAT is accepted on create and item writes. The TRN is snapshotted at issue. The same-voyage guard for B/L and manifest anchors is kept.
- `dto/invoice.dto.ts`: optional `taxRate` on item DTOs. Nothing removed.
- `invoice-correction.service.ts` and `invoice-correction.controller.ts` (new):
  - `GET  /invoices/:id/corrections` (`invoice:read`)
  - `POST /invoices/:id/corrections` (`invoice:correct`)
  - `POST /invoice-corrections/:id/approve` and `/reject` (`invoice:approve_correction`)
  - The original moves ISSUED → CANCELLED, with reason, user and timestamp recorded. Its money fields are not touched. The replacement is a new DRAFT linked to the original. Each step writes an audit entry.
  - The requester cannot approve their own correction. This applies to everyone, including the primary administrator (see §4).
- `invoice.module.ts`: registers the correction controller and service.
- `apps/api/src/modules/jobs/job.service.ts` and `job.controller.ts`: `GET /jobs/:id/invoices`, so a Job lists its invoices.
- `apps/api/src/modules/proforma/proforma.service.ts`: proforma → invoice conversion copies the line `taxRate` and uses `recomputeInvoiceTax`.

### Permissions (`prisma/seed/core.ts`)
- New codes `invoice:correct` and `invoice:approve_correction`. Both are **explicit grant only**: ADMIN does not receive them automatically (same pattern as `release:override`).
- The seed still does not insert demo data. No counter or invoice rows are seeded.

### Shared types (`packages/shared/src/invoice.ts`)
Optional fields only: `InvoiceItem.taxRate/taxAmount`, `Invoice.trn/jobLinks/billLinks/correctionAsReplacement/correctionsAsOriginal`, and the `InvoiceJobLink`, `InvoiceBillLink`, `InvoiceCorrectionRef` types. Existing constructors still compile.

### Web (`apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx`, `apps/web/messages/{en,ar,fa}.json`)
- New "VAT %" input on the add-line form (blank = header rate). A "VAT %" column in the line table. Draft lines are editable. Issued lines show the rate read-only.
- Detail panel shows the TRN, linked Job numbers and linked B/L numbers.
- Correction panel: request a correction (needs `invoice:correct`, ISSUED invoices only, reason required). Approve or reject pending corrections (needs `invoice:approve_correction`). Rejection needs a reason.
- Translation keys added in all three locales (`items.vatRate`, `items.vatRatePlaceholder`, `fields.trn`, `links.*`, `correction.*`). The Arabic and Persian strings are my translations and should be reviewed by a native speaker.

### Docs
This report.

## 2. Acceptance criteria (roadmap) against evidence

| Criterion | Evidence | Status |
|---|---|---|
| Per-line VAT with backfill | Migration step 2 (`taxRate` from header). `invoice-tax.ts`. | Migration verified on PGlite (§3). Runtime service path **not executed**. |
| Header VAT = sum of line VAT | `invoice-tax.ts` invariants, 20,000 random cases. | Passes (§3). |
| 0%/5% example yields correct per-line VAT and unchanged total formula | Acceptance example in `tax-check.cjs`: VAT 0 and 10, total 310. | Passes (§3). |
| Issued and cancelled money fields byte-identical | Migration does not touch header money. `taxAmount` not backfilled. Issue and cancel do not recompute. Checked on PGlite. | Migration checked. Re-fetch of a live issued invoice **not executed**. |
| Invoice ↔ Job join with backfill | `invoice_jobs` created empty, by design. Both directions covered in the e2e spec. | Schema checked. E2E **not executed**. |
| Invoice ↔ B/L join with backfill; legacy `billOfLadingId` kept | Migration step 5. | Migration checked on PGlite: legacy B/L copied. |
| TRN snapshot | `invoices.trn` set at issue from `CompanySettings`. | E2E **not executed**. |
| Controlled correction preserves original, reason, user, timestamp, approval and links | Correction service, audit entries, e2e spec covers immutability and replacement. | E2E **not executed**. |
| No credit-note format invented | No credit-note numbering or format is added. The replacement uses the normal INV family. | Met by design. |

## 3. Checks run in this sandbox

| Check | Command or harness | Result |
|---|---|---|
| Migration on a disposable Postgres-compatible DB (PGlite, sandbox only) | `/tmp/p3/harness/migrate-check.cjs` | 39/39 pre-Phase-3 migrations apply. All Phase 3 checks PASS: money byte-identity, line `taxRate` backfill, no per-line `taxAmount` backfill, legacy B/L copied, no invented `invoice_jobs`, approval default false, PK blocks duplicate links. |
| Tax arithmetic | `/tmp/p3/harness/tax-check.cjs`, `tax-classify.cjs` against compiled `invoice-tax.ts` | Multi-rate invariants hold over 20,000 random invoices. The 0%/5% example passes. Single-rate vs legacy header formula: **14 of 20,000 differ by one cent**. All 14 are at exact half-cent points, where the legacy float `toFixed` is wrong and the exact decimal result is right. No other differences. |
| API type check | `apps/api`: `tsc --noEmit -p tsconfig.json` | Exit 0, 0 errors. |
| New e2e spec type check | `apps/api/test/invoice-phase3.e2e-spec.ts` with project options plus `--types jest,node` | Exit 0, 0 errors. (`--strict` is not used: it reports 73 unrelated errors in existing DTOs.) |
| Shared package build | `packages/shared`: `tsc -p tsconfig.json` | Exit 0. `dist` is git-ignored and was rebuilt locally. |
| Web type check | `apps/web`: `tsc --noEmit -p tsconfig.json` | Exit 0, 0 errors (run after the shared rebuild). |
| Web lint | `apps/web`: `eslint` on the invoices page | Exit 0, no findings. |
| API lint | `apps/api`: `eslint` on the changed invoice, jobs and proforma files | 0 errors. 1 warning at `job.service.ts` line 282. That line is unchanged from HEAD, so the warning predates Phase 3. |

**Not executed:**
- The Nest e2e suites (`invoice.e2e-spec.ts`, the new `invoice-phase3.e2e-spec.ts`, and the others). They need the live Postgres database and the Prisma engine. Neither is available in this sandbox. **No test result from them is claimed.**
- The Prisma migration on the owner's server.
- Any browser test of the web changes.

## 4. Owner-confirmable points

1. **Approver must differ from requester, for everyone, including the primary administrator.** This follows the "no second approver" rule for the primary administrator. Under this rule the primary administrator cannot approve their own correction, so a correction they request needs a different approver, and if none exists it stays pending. The owner should confirm this.
2. **Plain `invoice:cancel` on ISSUED invoices is unchanged** for backward compatibility. The existing test at `invoice.e2e-spec.ts` ~L360 relies on it. Whether plain cancel should be blocked in favour of the correction route is an open business decision.
3. **Header `taxRate` on DRAFT update stays a bulk-apply input.** The existing e2e test at `invoice.e2e-spec.ts` ~L291 expects it to drive totals. AUD-001 proposed a read-only derived header. This is a deliberate deviation until the owner decides.
4. **Mixed-rate discount allocation** (pro-rata by line amount, remainder on the last line, rounding per rate group) is a convention I chose. It is not in the decision log. The owner should confirm it.
5. **Single-rate DRAFT totals use exact decimal rounding.** The legacy float `toFixed` path can differ by one cent at exact half-cent points (14 of 20,000 in random testing). This affects new DRAFTs only. Issued invoices keep their stored values.
6. **Correction approval setting** (`invoiceCorrectionApprovalRequired`) defaults to off, so corrections apply immediately until the owner enables approval.
7. **Historical TRN** stays NULL on existing invoices. Nothing in the records shows the TRN that was printed on them.

## 5. Server-side actions required (not executed; owner authorization needed)

Nothing has been run against the owner's server. Required steps, in order:

1. **Prerequisites:** the server project is `~/shipping-dashboard/new-erp`. Database backup or snapshot taken first. No secrets are needed in this report.
2. **Verify migration state first:** check `_prisma_migrations` for the Phase 2 migrations and confirm no failed (P3009) rows. Do not run `migrate reset`, `db push`, or edit migration history.
3. **Apply the migration:** `prisma migrate deploy` (applies only the pending `20261013120000_invoice_tax_links_correction`). **This writes to the database:** it adds columns and tables, and it sets `invoice_items.taxRate` on existing rows and copies `invoices.billOfLadingId` into `invoice_bills`. It deletes nothing. A test database is recommended first. Owner approval is required for this step.
4. **Regenerate the Prisma client and rebuild/restart the API and web.** This is not a DB change.
5. **Seed:** run only the permission-catalogue upsert. Do not run demo or sample seeds. `invoice:correct` and `invoice:approve_correction` are granted only where the owner assigns them.
6. **Post-deploy check (read-only):** confirm an existing ISSUED invoice returns the same `subtotal`, `taxAmount`, `totalAmount` as before. Confirm `invoice_bills` row count equals the number of invoices that had a B/L.

Phase 3 changes are not deployed until steps 3–5 are executed with owner authorization.

## 6. Not in scope

- Phase 4 (not started).
- Credit-note format, numbering or PDF. Not invented.
- Changing live numbering formats or voyage behaviour.
