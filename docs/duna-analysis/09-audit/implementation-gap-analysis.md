# Implementation Gap Analysis — Current Application vs Target Requirements

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

**Status:** Canonical. Documentation only — no application code was changed.
**Created:** 2026-10-11.

---

## Verification basis and its limits — read first

All statements below come from **static inspection** of the repository. The test suite was **not executed**.

| Environment fact | Consequence |
| --- | --- |
| No `node_modules` (root, `apps/api`, `apps/web`) | Nothing can be compiled or run |
| No PostgreSQL instance (nothing listening on 5432) | The 22 e2e suites, which require a database, cannot run |
| No `.env` (only `.env.example`) | No runtime configuration |

Therefore:
- **No capability below is classified "implemented and verified by execution."** The maximum classification
  achieved by static inspection is **"present in code, unverified"**.
- **"403/403 tests green" remains UNVERIFIED.** It is cited from `docs/current-plan/11-implementation-state.md`
  and was not reproduced. This is recorded in `README.md` §5.
- Static inspection cannot detect runtime misconfiguration, N+1 or performance problems, concurrency behaviour
  under real load, or defects that appear only with production data volumes.

**Update 2026-10-12 (Phase 1 review, additive).** On 2026-10-12 the 22 API e2e suites were executed in a sandbox against a fresh, disposable database with only the required seed: **22/22 suites and 403/403 tests passed**, and a second run on the same database also passed. This used a sandbox-only WASM Prisma engine and a test-only Jest mapping, not the production native engine, so it is evidence about the code under that harness. The native-engine baseline on the owner's server is still pending (acceptance A4). See [`e2e-sandbox-run-2026-10-12.md`](e2e-sandbox-run-2026-10-12.md).

**Classification legend:**
`IMPLEMENTED-UNVERIFIED` (present in code, tests not run) · `PARTIAL` · `PRESENT-UNVERIFIED`
· `DOCUMENTATION-ONLY` (described but not in code) · `MISSING` · `BLOCKED` (missing evidence).

---

## 1 · Measured system shape

All figures produced by inspecting source during this audit. They supersede the approximate figures in
`05-current-project/` and `FINAL-REPORT.md` (errors E2–E4).

| Measured | Value | Location |
| --- | --- | --- |
| Prisma models | **52** | `prisma/schema.prisma` |
| Prisma enums | **32** | `prisma/schema.prisma` |
| Migrations | 38 | `prisma/migrations/` |
| API modules | **32** | `apps/api/src/modules/` |
| e2e suites | **22** | `apps/api/src/**/*.e2e-spec.ts` |
| Other spec files | 1 in `apps/api`, 1 in `apps/web` | — |
| Dashboard route directories | 35 | `apps/web/src/app/[locale]/(dashboard)/` |
| Seeded permission codes / modules | **160 / 33** | `prisma/seed.ts` (corrected 2026-10-11) |
| Navigation sections | **10** | `nav.ts` `NAV_SECTION_ORDER` |

---

## 2 · Capability-by-capability assessment

### 2.1 Foundations

| Capability | Class | Evidence |
|---|---|---|
| Auth + RBAC (160 codes / 33 modules) | IMPLEMENTED-UNVERIFIED | `prisma/seed.ts`; decorator-based enforcement; 22 e2e suites exist but were not run |
| Audit log model | PRESENT-UNVERIFIED | `AuditLog` model, ~10 code references; **coverage breadth unverified**; no append-only DB enforcement observed |
| Backup / restore | **MISSING** | No backup capability; no scheduled job; no restore procedure |
| Health checks / observability | PRESENT-UNVERIFIED | `health` module exists |

### 2.2 Master data and operations

| Capability | Class | Evidence |
|---|---|---|
| Port / Yard / Vessel / Voyage | IMPLEMENTED-UNVERIFIED | Modules present; `VesselType` includes `TUG`/`BARGE`/`LANDING_CRAFT`; `Voyage` has `tugVesselId`/`bargeVesselId` |
| Port display name, aliases | **MISSING** | `Port` has no display name or aliases (DEC-064) |
| Port city/abbreviation mandatory | **PARTIAL** | Both nullable, contradicting REQ-031; seeded ports set no abbreviation |
| Party masters (Shipper/Consignee/Agent) | IMPLEMENTED-UNVERIFIED | Cutover from Customer completed (Phase 2) |
| Customer without prohibited fields | **PARTIAL** | All four REQ-017-prohibited fields present; `type` carries the **wrong semantics** (commercial role rather than natural/legal) |
| Cargo / yard inventory | IMPLEMENTED-UNVERIFIED | Duplicate legacy columns remain: `comments`/`comment`, `chassis`/`chassisNumber`, `serial`/`serialNumber` (AUD-015) |
| Inspection 5-state + load-list gating | IMPLEMENTED-UNVERIFIED | `load-planning.service.ts:381,556` rejects `inspectionStatus !== 'DONE'` — REQ-082 satisfied |
| Load list / actual loading state model | **PARTIAL** | Enum has 6 states; ADR-041 specifies 3 (Q-AUD-12) |
| Job + job costing | **PARTIAL** | `Job` + `JobCostItem` exist; **no invoice link**; no creation rules |
| Discharge | IMPLEMENTED-UNVERIFIED | Module present |

### 2.3 Documents and lifecycle

| Capability | Class | Evidence |
|---|---|---|
| B/L created from Actual Loading | IMPLEMENTED-UNVERIFIED | `bill.service.ts:304, 589-601, 918-920` — COMPLETED Actual Loading with `actualQuantity > 0` (ADR-029/042) |
| B/L draft → correction → finalisation | **PARTIAL** | `BlStatus` has 6 values with near-duplicate pairs; official labels unconfirmed (DEC-061) |
| Manifest consolidation of APPROVED B/Ls | IMPLEMENTED-UNVERIFIED | `manifest.service.ts:293-347` (ADR-047 d1/d3/d4) |
| Manifest totals (units/packages/weight) | **PARTIAL** | `Manifest` has `totalWeight`/`totalQuantity`/`totalPackages`; no rendered manifest exists |
| Release Order | **PARTIAL** | Model + `financialOverride` (ADR-033) exist; **no payment-state field**; not exposed to agents |
| Delivery Order | **PARTIAL** | Model exists; **no port field** despite REQ-186 |
| Per-destination numbering (B/L, Manifest, Voyage) | IMPLEMENTED-UNVERIFIED | `bill.service.ts:1642-1649`; `manifest.service.ts:1037-1045`; `voyages.service.ts:278-288` |
| Voyage numbering per **vessel** | **MISSING** | Scope key is destination + year only; REQ-040 requires vessel too |
| Configurable numbering for all types | **PARTIAL** | 3 of 14 types on `NumberingService`; 11 use hard-coded local generators; **no seeded sequence rows** |
| Document output (PDF/Excel/Print) | **MISSING** | No rendering dependency anywhere; no `documents` module |
| Uploadable templates | **PARTIAL** | `DocumentTemplate` referenced 16×; **`DocumentTemplateVersion` orphaned** (0×) |
| Company settings endpoint | **MISSING** | `CompanySettings` referenced once; **no module, no endpoint** — TRN and company name cannot be maintained |
| Attachments / sensitive assets | **MISSING** | `FileAttachment` referenced **once**; no upload endpoint, no storage adapter, no asset permissions |

### 2.4 Finance

| Capability | Class | Evidence |
|---|---|---|
| Invoice header + lines | IMPLEMENTED-UNVERIFIED | `Invoice` + `InvoiceItem` |
| Invoice arithmetic | IMPLEMENTED-UNVERIFIED | `invoice.service.ts:546-573` — `subtotal = Σ amount`; `tax = (subtotal − discount) × rate/100`; `total = subtotal − discount + tax`. **Arithmetic correct; granularity wrong** |
| Per-line VAT | **MISSING** | `Invoice.taxRate` is header-level; `InvoiceItem` has no tax column (AUD-001) |
| TRN on invoice | **MISSING** | No TRN field on `Invoice`; `CompanySettings.taxNumber` unreachable (no endpoint) |
| Invoice ↔ Job | **MISSING** | No link in either direction (AUD-002) |
| Invoice ↔ multiple B/Ls | **MISSING** | Single nullable `billOfLadingId` (AUD-003) |
| Vouchers (receipt/payment) | IMPLEMENTED-UNVERIFIED | `Voucher` with type, method, currency, `exchangeRate` |
| Unallocated payment allowed | IMPLEMENTED-UNVERIFIED | `Voucher.invoiceId` nullable — REQ-165 satisfied; must not be regressed |
| Multi-document allocation with per-reference amounts | **MISSING** | No `VoucherAllocation` model (AUD-005) |
| Customer advances / unallocated credit | **MISSING** | No concept beyond a null `invoiceId` |
| General journal | **MISSING** | No `GeneralJournal`/`JournalLine`/`LedgerEntry`/`Account` model (AUD-004) |
| Office / daily expenses | **MISSING** | `Voucher.customerId` is required; ledger is customer-scoped only (AUD-007) |
| Derived customer ledger + statement | IMPLEMENTED-UNVERIFIED | `ledger.controller.ts` (18 lines) → `VoucherService.ledger()`; `LedgerQueryDto` supports `fromDate`/`toDate`/`currencyCode` |
| — but **no `ledger.e2e-spec.ts`** | **GAP** | The derived statement — a financial artefact with money arithmetic — has **no e2e test** (AUD-022) |
| Multi-currency with dated rates | **MISSING** | No `CurrencyRate` model; only USD + AED seeded; `Invoice.currencyCode` and `CompanySettings.defaultCurrency` default to **USD** (AUD-023, DEC-001…006) |
| Controlled financial corrections | **MISSING** | No credit note, no reversal, no linked replacement, no correction audit (DEC-019…023) |
| FX gain/loss accounting | **MISSING** | No accounting model to hold it |

### 2.5 Reporting, portal, configuration

| Capability | Class | Evidence |
|---|---|---|
| Reports module | **MISSING** | No `reports` module; nav `insightControl` has a single `reports` item marked `planned`; no `report:*` permission codes |
| Voyage/manifest P&L | **MISSING** | No computation; `Manifest` carries **legacy** cost columns (`gasCost`, `lashingCost`, `shipperCost`, `podCost`, `polCost`) that do **not** match the required categories (only `lashing` overlaps) |
| VAT report | **MISSING** | Depends on per-line VAT (P3) |
| Custom report builder | **MISSING** | — |
| Agent portal login + destination scoping | IMPLEMENTED-UNVERIFIED | `portal.service.ts` `portalManifestScopeIds()` returns `[portalAgentId]` |
| Agent portal: B/L and Release visibility | **MISSING** | Portal exposes `me`, bookings and statement only — **no B/L or Release listing** (AUD-010) |
| Custom fields / option lists | **MISSING** | No `CustomField` model (DEC-029…033) |
| Configurable document types / workflows | **MISSING** | No `DocumentType`/`WorkflowDefinition`/`Approval` model; statuses are fixed enums (DEC-034, DEC-059) |
| Notifications | **MISSING** | No module, no scheduler, no permission codes (DEC-056) |
| Archive / retention / reopening | **MISSING** | No archive capability; soft-delete (`deletedAt`) only (DEC-082…086) |

### 2.6 Seed data (REQ-198 / AUD-014)

`prisma/seed.ts` (624 lines) writes, **unconditionally and with no environment guard**:

| Seeded | Assessment |
|---|---|
| Currencies USD + AED | Structural — acceptable (but incomplete per DEC-001) |
| 160 permissions, admin + ops roles, admin user | Structural — acceptable |
| `CompanySettings` row `default-company` | Structural — acceptable |
| 2 ports (Jebel Ali, Khalifa) + 2 yards | **Questionable** — Jebel Ali is evidenced (10 mentions); **Khalifa appears in zero sources**; neither sets an abbreviation |
| **1 vessel, 1 voyage, 2 customers, 3 cargo, inspections, 1 load list + items** | **Demo business transactions — contradict REQ-198** |
| Demo portal user → Agent `AGT-001` link; demo manifest `MAN-2609-00004` relink | Demo wiring |

There is **no `SEED_DEMO` flag**. The only `process.env` reads are `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
(lines 313-314). Running the seed against a real database injects fabricated business rows.

---

## 3 · Documentation-only or contradicted

These are described in documentation but **not** supported by code, or are contradicted by code:

| Claim | Reality |
|---|---|
| `docs/architecture.md` — Load Planning, Manifest, B/L, Jobs, Invoices, Release/Delivery/Discharge, Agent Portal are "Planned" | All implemented except **Reports/Documents** (AUD-020) |
| `docs/permissions.md:16` — "Seeded permissions (49)" | **160** codes / **33** modules (AUD-020). **Corrected 2026-10-11** under D1 |
| `docs/database-schema.md:150-172` — 18 entities "not yet implemented" | 12 exist under those names, 3 under different names (`JobLine`→`JobCostItem`, `InvoiceLine`→`InvoiceItem`, `Payment`→`Voucher`), 3 have no equivalent — one of which (`LedgerEntry`) is absent **deliberately** |
| `docs/workflows.md` — `CargoStatus.READY`, inspection `PENDING/APPROVED/REJECTED` | Actual: `READY_FOR_LOADING`; `PENDING/BOOKED/DONE/FAILED/NEEDS_REINSPECTION` |
| `docs/current-plan/09` §2.2 — "B/L still manifest-first", "no B/L revision model", "no ManifestItem→B/L reference" | All three are **done** — see `bill.service.ts` and `manifest.service.ts` |
| `docs/ai-audit/07` — Phase 1 is "NumberingSequence + AuditLog infrastructure" | Both exist; numbering is wired for 3 of 14 types |
| Contradiction **C-07** — receipt voucher `DSR/26-190` | **Fabricated.** Real voucher is **No. 477**, plain numeric (source pack §3.3) |
| Prior analysis — "the employer says Dirham" | **Withdrawn.** Zero word-boundary matches for AED/Dirham/USD/Dollar in the statements |
| Prior analysis — REQ-102 is a Phase 2 gap | **Corrected.** Per-destination B/L numbering already implemented |
| Prior analysis — REQ-040 is a Phase 2 gap | **Corrected.** Implemented as destination + year; **vessel** component missing |

---

## 4 · Summary

| Classification | Count (of 60 assessed capabilities) |
|---|---|
| IMPLEMENTED-UNVERIFIED | 16 |
| PARTIAL | 14 |
| PRESENT-UNVERIFIED | 2 |
| MISSING | 26 |
| BLOCKED (missing evidence) | 2 (template fidelity, port list completeness) |

**The single most important structural finding:** the system has a strong **operational** spine (cargo →
inspection → load list → actual loading → B/L → manifest → release/delivery, with per-destination numbering) and
essentially **no financial spine** — no general ledger, no allocation, no rate history, no corrections, no
reporting, no document output. The confirmed decisions in `confirmed-decisions.md` are overwhelmingly directed at
that missing financial, security and configuration half.
