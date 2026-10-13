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
  - A non-owner requester cannot approve their own correction. The primary administrator is exempt, per DEC-116 (see §4 and §7).
- `invoice.module.ts`: registers the correction controller and service.
- `apps/api/src/modules/jobs/job.service.ts` and `job.controller.ts`: `GET /jobs/:id/invoices`, so a Job lists its invoices.
- `apps/api/src/modules/proforma/proforma.service.ts`: proforma → invoice conversion copies the line `taxRate` and uses `recomputeInvoiceTax`.

### Permissions (`prisma/seed/core.ts`)
- New codes `invoice:correct` and `invoice:approve_correction`. ADMIN receives them through the all-permissions loop. Only `release:override` is explicit grant only (DEC-116). This replaces the Phase 3 first version, which also excluded the two invoice codes. See §7.
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

1. **Approver must differ from requester, except the primary administrator (DEC-116).** Changed in §7. The first version also blocked the owner from approving their own request, which DEC-116 does not allow. ADMIN-role users and other non-owner users remain blocked from self-approval. Owner to confirm.
2. **Plain `invoice:cancel` on ISSUED invoices is unchanged** for backward compatibility. The existing test at `invoice.e2e-spec.ts` ~L360 relies on it. Whether plain cancel should be blocked in favour of the correction route is an open business decision.
3. **Header `taxRate` on DRAFT update stays a bulk-apply input.** The existing e2e test at `invoice.e2e-spec.ts` ~L291 expects it to drive totals. AUD-001 proposed a read-only derived header. This is a deliberate deviation until the owner decides.
4. **Mixed-rate discount allocation** (pro-rata by line amount, remainder on the last line, rounding per rate group) is a convention I chose. It is not in the decision log. The owner should confirm it.
5. **Single-rate DRAFT totals use exact decimal rounding.** The legacy float `toFixed` path can differ by one cent at exact half-cent points (14 of 20,000 in random testing). This affects new DRAFTs only. Issued invoices keep their stored values.
6. **Correction approval setting** (`invoiceCorrectionApprovalRequired`) defaults to off, so corrections apply immediately until the owner enables approval.
7. **Historical TRN** stays NULL on existing invoices. Nothing in the records shows the TRN that was printed on them.

## 5. Server-side actions required (not executed; owner authorization needed)

Nothing has been run against the owner's server. Run these after pulling the commit that contains the §7 fix, in this order. Stop at any failed step.

1. **Pull and install:** update the branch, then `pnpm install --frozen-lockfile`.
2. **Preflight (read-only).** Confirm the primary administrator and the seeded admin account. Stop if there is more than one primary administrator.
   `SELECT email, "isPrimaryAdmin", "isActive", "lockedUntil" FROM "User" WHERE "isPrimaryAdmin" OR email = '<SEED_ADMIN_EMAIL>';`
   Also check that migration `20261013120000_invoice_tax_links_correction` is listed in `_prisma_migrations` and applied. If it is not, apply it first (step 3).
3. **Phase 3 migration, only if pending:** `pnpm prisma migrate deploy`. It applies only pending migrations. It is additive. It sets `invoice_items.taxRate` on existing rows and copies `invoices.billOfLadingId` into `invoice_bills`. It deletes nothing. A test database first is recommended. Owner approval is required.
4. **Core seed (writes to the database):** `pnpm db:seed`, with `SEED_DEMO_DATA` **unset**. Do not set it. The seed:
   - creates any missing permission rows, including `invoice:correct` and `invoice:approve_correction`;
   - adds missing ADMIN grants for every catalogue permission except `release:override`. It only adds and never revokes;
   - upserts the admin account. On every run it sets `isActive = true` and clears `failedLoginAttempts` and `lockedUntil` for that account. This is existing seed behaviour. The owner should confirm it is acceptable before running;
   - designates a primary administrator only if none exists.
   The static guard `pnpm check:seed-safety` is passing. Demo data is not created by default.
5. **Restart the API and web.** No re-login is needed. Permissions are resolved from the database on every request.
6. **Verify (read-only).** Log in as the ADMIN account and call `GET /api/v1/auth/me`. The permissions list must include `invoice:correct` and `invoice:approve_correction`, and must not include `release:override`.

**Test commands (server or CI, not the production database):**
- `cd apps/api && pnpm test -- invoice-phase3` runs the Phase 3 e2e suite. It needs a Postgres `DATABASE_URL` with the schema and seed applied. It writes test records (customers, invoices, roles, users, and two correction workflows) and keeps them. It does not delete data. Use a disposable or test database.
- `pnpm test -- invoice.e2e-spec` and `pnpm test -- auth.e2e-spec` are the existing invoice and auth suites that cover permissions.
- `pnpm test:seed-safety` writes to `SEED_TEST_DATABASE_URL`. Use a disposable database only.

Fallback to step 4, if the owner does not want the full seed: if the permission rows already exist, the ADMIN role can be given the two codes on the Roles screen. That screen replaces the role's whole permission set, so the current set must be checked first. Creating the rows still requires the seed.

## 6. Not in scope

- Phase 4 (not started).
- Credit-note format, numbering or PDF. Not invented.
- Changing live numbering formats or voyage behaviour.

## 7. Review fix: ADMIN correction permissions (2026-10-13)

**Reported.** Running `invoice-phase3.e2e-spec.ts` gave 5 passing and 3 failing tests. All three failures were `403 Forbidden` from the correction endpoints, for the ADMIN account.

**Root cause (verified).** The ADMIN role was never given `invoice:correct` or `invoice:approve_correction`. In the first version of this phase, both codes were added to the explicit-grant-only set in `prisma/seed/core.ts`, copying the `release:override` rule. That was my error, not an owner decision:
- DEC-116 reserves only release-exception authority. It says ordinary managers and administrators must not inherit `release:override`. It says nothing about invoice correction.
- `docs/permissions.md` describes ADMIN as "Full access (bind-all seed permissions)".

The permission path is ADMIN role → `RolePermission` rows → `AuthService.resolvePermissions` (per request, from the database) → `PermissionsGuard`. With the rows missing, the guard correctly returned 403. The guard and endpoint configuration were correct.

**Fix.**
- **Seed (`prisma/seed/core.ts`).** `EXPLICIT_GRANT_ONLY` is now `{'release:override'}`. ADMIN receives the two invoice codes through the same all-permissions loop as every other permission. `release:override` stays explicit only, per DEC-116. No isolated exception for this endpoint.
- **Approval (`invoice-correction.service.ts`).** The requester-cannot-approve rule is kept for non-owner users, including ADMIN-role users. The primary administrator is exempt, per DEC-116 ("require no approval from any other user … to approve operations"). This is a change from the first version (§4 item 1).
- **Validation (`dto/invoice.dto.ts`).** `CorrectInvoiceDto.reason` and `RejectInvoiceCorrectionDto.reason` reject whitespace-only text at the validation layer (400). The service check remains as a backstop.
- **Tests (`apps/api/test/invoice-phase3.e2e-spec.ts`).**
  - `/auth/me` for ADMIN asserts that both invoice correction codes are present.
  - The approval gate uses a non-owner requester who holds both correction permissions. Self-approval is refused (403), a different user approves (200, applied), and ADMIN rejects a second request.
  - A separate DEC-116 test asserts that the primary administrator can approve their own correction directly. It first checks that `admin@shipping.local` is the primary administrator.
  - The `release:override` check is a separate test, described in §8.
  - The 403 for a user without `invoice:correct` and the 400 for a blank reason are unchanged.
  - The `finally` block no longer deletes the `CompanySettings` row. Only the approval flag is restored.
- **Docs.** `docs/permissions.md` ADMIN row states the exception. This section and §4/§5 are updated.

**Files changed in this fix.** `prisma/seed/core.ts`, `apps/api/src/modules/invoice/invoice-correction.service.ts`, `apps/api/src/modules/invoice/dto/invoice.dto.ts`, `apps/api/test/invoice-phase3.e2e-spec.ts`, `docs/permissions.md`, and this report. No migration was added or changed.

**Checks run in this review.**

| Check | Result |
|---|---|
| Reproduce on the committed seed (in-memory harness, real seed + `resolvePermissions` + `PermissionsGuard`, sandbox only) | ADMIN lacks `invoice:correct`, `invoice:approve_correction`, and `release:override`. Guard returns `ForbiddenException` for ADMIN on `invoice:correct`. Matches the reported 403s. |
| Same harness after the fix | ADMIN holds both invoice codes and lacks only `release:override`. Guard allows ADMIN and the primary administrator. Guard returns `ForbiddenException` for a user without `invoice:correct`. |
| DTO check (class-validator) | `"   "` and `""` fail validation. `"Wrong freight rate"` and `" x "` pass. |
| API `tsc --noEmit` | Exit 0, after dependencies were installed and the Prisma client types were generated. |
| E2E spec type check | Exit 0. |
| ESLint on changed API files | Exit 0. |
| `pnpm check:seed-safety` | Exit 0. "SEED SAFETY OK". |

**Not run in this review.** `invoice-phase3.e2e-spec.ts`, `invoice.e2e-spec.ts`, `auth.e2e-spec.ts`, and `scripts/test-seed-safety.ts`. This sandbox has no PostgreSQL, and the Prisma query engine cannot be downloaded (its host is not on the allowlist). The Prisma client was generated with a placeholder engine for type checks only, so no query was run. **No e2e pass is claimed here.** The reported run (5 pass, 3 fail) is the only runtime evidence. The rerun must be done on the server (§5, test commands).

**Owner decisions to confirm.**
1. The primary administrator may approve their own correction (DEC-116). Non-owner users, including ADMIN-role users, cannot.
2. ADMIN holds `invoice:correct` and `invoice:approve_correction`. It does not hold `release:override` (DEC-116).
3. The correction approval setting (`invoiceCorrectionApprovalRequired`) stays off by default.

## 8. Test-fix round: three failing assertions (2026-10-13)

Three assertions failed in the reported run. Status of each:

**(a) Money text, `1300` vs `1300.00`: resolved as a test-assertion mismatch.**
- The round-trip test sets up 1000 at 5% and 250 at 0%. Subtotal 1250, VAT 50.00, total 1300.00. The calculation is correct.
- The audit record stores `totalAmount` with `toFixed(2)`, giving `"1300.00"`. The API returns the Prisma `Decimal` JSON form, giving `"1300"` (verified with the `decimal.js` bundled in Prisma's runtime). Both are the same value.
- Fix: the assertion compares `Number(...)`, as `invoice.e2e-spec.ts` already does. No financial code or data structure changed.

**(b) `release:override` in ADMIN's effective permissions: origin identified; NOT changed. Owner authorization required.**
- Origin, from git history on this branch:
  - The original seed (`c997624`, `prisma/seed/core.ts` ~L252) granted ADMIN every catalogue permission, including `release:override`. That was the default before DEC-116.
  - Commit `66628c3` (DEC-116) added `EXPLICIT_GRANT_ONLY`, so the seed no longer grants it. The seed only adds grants and never revokes. A grant made by the earlier seed therefore remains in any database seeded before `66628c3`.
  - So the grant is most likely a **legacy seed default**, not an explicit assignment. This is an inference from the code history until the owner runs the query below.
- Why not changed now: revoking it changes release-override authority for everyone holding the ADMIN role. The seed comment (`prisma/seed/core.ts`, the DEC-116 block) says revoking an inherited grant needs a separate, audited reconciliation (inspect, snapshot, classify, revoke). It is deliberately not automatic.
- The assertion is kept as its own test, so the open item is reported separately. Its expectation is unchanged (DEC-116).

Read-only classification, to run on the owner's database (no writes):

```sql
-- 1. Which roles hold release:override, and who holds those roles
SELECT r.code AS role, u.email, u."isPrimaryAdmin"
FROM "RolePermission" rp
JOIN "Permission" p ON p.id = rp."permissionId" AND p.code = 'release:override'
JOIN "Role" r ON r.id = rp."roleId"
LEFT JOIN "UserRole" ur ON ur."roleId" = r.id
LEFT JOIN "User" u ON u.id = ur."userId";

-- 2. Was the ADMIN grant ever set explicitly through the role screen (audited)?
SELECT "timestamp", "actorEmail", metadata
FROM "AuditLog"
WHERE action = 'role:permissions:set' AND metadata->>'releaseOverrideGranted' = 'true'
ORDER BY "timestamp";
```

Classification:
- If query 2 has no row for ADMIN, the grant is a **legacy seed default**. Reconcile it.
- If query 2 has a row, it was an explicit grant made by the named actor. Check that the actor was the primary administrator (DEC-116). If so, keep the grant and report that DEC-116 is satisfied as recorded.

Reconciliation, only after the owner authorizes it. Do it through the API so the change is audited. Do not run SQL directly:
1. Snapshot: `GET /api/v1/roles/<ADMIN id>` and save the full permission list.
2. Send `PATCH /api/v1/roles/<ADMIN id>/permissions` as the primary administrator, with the same list minus `release:override`. The server records `role:permissions:set` with `removed: ["release:override"]`. The PATCH replaces the whole set, so the list must be complete.
3. Check: query 1 returns no ADMIN row, and the DEC-116 test passes.

If the owner decides ADMIN should keep `release:override`, DEC-116 must be amended first, and the DEC-116 test removed. That decision belongs to the owner.

**(c) Owner self-approval, `200` vs expected `403`: resolved by following DEC-116. The test was wrong for the owner account.**
- DEC-116: the primary administrator "require[s] no approval from any other user … to approve operations" and may "approve release exceptions directly as owner". The test used `admin@shipping.local`, which is the primary administrator (the seed designates it when no owner exists, per the Phase 1 runbook §4). The `200` is therefore the documented behaviour.
- The test now checks the owner case explicitly: the primary administrator approves directly (200, applied).
- Non-owner self-approval is refused (403), tested with a requester who is not the owner and who holds both permissions.
- **Not documented, still a design choice:** DEC-022 says approval is required where configured and that "who approves is configuration". It does not say the requester must differ from the approver. The non-owner refusal is my design from Phase 3 and is still unconfirmed. Keep it, or remove it so that approval depends only on the `invoice:approve_correction` grant? Owner to confirm.

**Checks run for this round.**

| Check | Result |
|---|---|
| API `tsc --noEmit` | Exit 0 |
| E2E spec type check | Exit 0 |
| ESLint, spec and correction service | Exit 0 |
| Prisma Decimal JSON vs `toFixed(2)` (decimal.js) | `"1300"` vs `"1300.00"`, same value |
| Tax and total arithmetic, 1000 at 5% + 250 at 0% | Tax 50.00, total 1300.00 |
| **E2E `invoice-phase3.e2e-spec.ts`** | **Not run.** The sandbox cannot download Prisma's query engine (`binaries.prisma.sh` is not reachable), and there is no PostgreSQL. No pass is claimed. |

**Expected results on the owner's test database, after the test fix:** every Phase 3 test passes except `DEC-116 reconciliation: ADMIN role should not hold release:override`. That one fails until the reconciliation in §8(b) is authorized and carried out.

## 9. Owner report and Phase 3 close-out status (2026-10-13)

**Owner-reported result (not run by the assistant).** The owner reports that `apps/api/test/invoice-phase3.e2e-spec.ts` passed **11/11** on the owner's server. The spec has 11 `it` blocks. This sandbox has no database, so no pass is claimed from here.

**What the 11/11 implies, to be confirmed by the owner.**
- One of the 11 is `DEC-116 reconciliation: ADMIN role should not hold release:override` (line ~315). A pass means the ADMIN role no longer holds `release:override` on the database used. That only happens if §8(b) was carried out. It is an inference from the count, not a recorded fact. The owner should confirm it with the §8(b) read-only queries, and the reconciliation should show an audited `role:permissions:set` entry with `removed: ["release:override"]`.
- The owner has not yet said which database was used (name, and whether it is a disposable test database or the live one). The test creates its own customers, jobs and invoices and temporarily changes `CompanySettings.invoiceCorrectionApprovalRequired`, so the database used matters.
- The owner has not yet said whether migration `20261013120000_invoice_tax_links_correction` and the seed were applied to that database. A seed run only adds grants. Migration status must be checked against `_prisma_migrations`, not inferred from a passing test.

**Still open for Phase 3.**
- The Phase 3 invoice screens have not been exercised in a browser. Only type checks and ESLint ran on the web code.
- The owner-confirmable points in §4 are unchanged. None of them was decided by the 11/11 result.

**Status.** Phase 3 is recorded as owner-verified on the owner's server, subject to the three confirmations above. No further Phase 3 code change is needed for the 11 tests. The Phase 3 close-out is complete once the owner confirms the database, the reconciliation status, and the migration status.
