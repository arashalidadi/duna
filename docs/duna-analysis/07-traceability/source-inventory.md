# Source Inventory

> Phase 1. Every source used to build this knowledge base, with its location, size, provenance,
> authority, and **exactly what it was used for**.
>
> Nothing has been deleted, moved or rewritten. See
> [`../06-ai-reference/source-retention-plan.md`](../06-ai-reference/source-retention-plan.md) for the
> *classification* of each source for future cleanup (Phase 12) — classification is a proposal only.

---

## 1. Summary

| Family | Files | Size | Authority | Status |
|---|---|---|---|---|
| Employer voice transcripts (Persian) | 20 | 94 KB | **Highest** | ✅ All read |
| Real company documents (PDF) | 7 | 1.9 MB | **Highest** for formats & values | ✅ All extracted and analysed |
| Legacy Laravel archive | 1 ZIP (199 files) + 5 md | 16.9 MB | Evidence of past behaviour | ✅ Statically analysed; **never executed** |
| Prior AI analyses | 3 + 5 | 150 KB | Low — verify first | ✅ Reviewed (Phase 6) |
| Current project docs | 13 + 34 | ~300 KB | High for the current system | ✅ Surveyed (Phase 8) |
| Current system code | — | — | High for current reality | ✅ Surveyed read-only |
| **Missing** | — | — | **Highest** | ❌ `/home/duna/dunaData/` — see §7 |

---

## 2. Employer voice transcripts — `requirements/`

**20 files, all in Persian, all read.**

### 2.1 Session A — 18 timestamped files (reliable chronological order)

| # | File | Size | Notes |
|---|---|---|---|
| 1 | `audio_2026-09-14_04-57-33.txt` | 6,369 B | Opens the session |
| 2 | `audio_2026-09-14_04-59-40.txt` | 3,606 B | |
| 3 | `audio_2026-09-14_05-00-18.txt` | 877 B | |
| 4 | `audio_2026-09-14_05-00-51.txt` | 1,208 B | |
| 5 | `audio_2026-09-14_05-01-56.txt` | 4,487 B | |
| 6 | `audio_2026-09-14_05-02-13.txt` | 798 B | |
| 7 | `audio_2026-09-14_05-02-40.txt` | 367 B | |
| 8 | `audio_2026-09-14_05-02-53.txt` | 660 B | |
| 9 | `audio_2026-09-14_05-03-16.txt` | 932 B | |
| 10 | `audio_2026-09-14_05-03-32.txt` | 5,567 B | |
| 11 | `audio_2026-09-14_05-05-14.txt` | **19,707 B** | Largest in session A |
| 12 | `audio_2026-09-14_05-05-37.txt` | 1,803 B | |
| 13 | `audio_2026-09-14_05-06-35.txt` | 12,003 B | |
| 14 | `audio_2026-09-14_05-06-46.txt` | 760 B | |
| 15 | `audio_2026-09-14_05-07-11.txt` | 773 B | |
| 16 | `audio_2026-09-14_05-07-29.txt` | **38 B** | Smallest — a fragment |
| 17 | `audio_2026-09-14_05-07-41.txt` | 1,385 B | |
| 18 | `audio_2026-09-14_05-07-52.txt` | 939 B | Closes the session |

### 2.2 Session B — 2 undated files (a separate, longer session)

| # | File | Size | Notes |
|---|---|---|---|
| 19 | `part1_0-15.txt` | 17,180 B | First 15 minutes of a longer recording |
| 20 | `part2_15-end.txt` | 16,199 B | From minute 15 to the end |

⚠️ **The two files are named as one continuous session, but the naming gives no date.** They were
analysed **after** Session A. Whether Session B is before or after Session A **cannot be determined
from the workspace**. Where the two sessions disagree, both readings are preserved in
[`../01-employer-statements/employer-original-statements.en.md`](../01-employer-statements/employer-original-statements.en.md).

### 2.3 What the transcripts cover

| Topic | Session A | Session B |
|---|---|---|
| Company overview, two business lines | ✅ | ✅ |
| Master data: Customer, Port, Yard, Vessel | ✅ | — |
| Master data: Shipper, Consignee, Agent | ✅ | — |
| Cargo intake, inspection, load list | ✅ | — |
| B/L lifecycle, numbering, release | ✅ | ✅ |
| Manifest, co-loading | ✅ | ✅ |
| Invoice, VAT, job costing | ✅ | ✅ |
| Ledger, vouchers, salary | ✅ | ✅ |
| Release order, delivery order, agent portal | ✅ | ✅ |
| Reports, outputs, templates | ✅ | ✅ |
| Letters, archive | — | partial |
| **Salary detail** | mention only | mention only |
| **Company archive** | one mention (`EMP-713`) | — |

---

## 3. Real company documents — `documents/`

**7 PDFs, 1.9 MB, all text-extracted and analysed.**

| # | File | Pages | Type | Document number | Date | Size |
|---|---|---|---|---|---|---|
| 1 | `BL-1X D155A CH NO 8308-1.pdf` | 1 | Bill of Lading | `KHS/26-110` | 29-Aug-26 | 643 KB |
| 2 | `MAN-MEHDI 11 KHO-26-006.pdf` | 3 | Cargo Manifest | `DSMAN/KHO-26-006` | 05-Sep-26 | 420 KB |
| 3 | `INV-GRAND CRANE USED TRUCK CRANE +1 PKG CH.NO 0127-1.pdf` | 1 | Tax Invoice | `DSINV/26-172` | 06-Aug-26 | 204 KB |
| 4 | `PRO-MEHDI BAGHSIAH 1X R340L, 1X BREAKER, 1X QUICK QOUPLER.pdf` | 1 | Proforma Invoice | `DSPRO/26-001` | 22-Aug-26 | 329 KB |
| 5 | `QUO-SHADMAN MEABADI 1X FINISHER-1.pdf` | 1 | Quotation | `DSQUO/25-017` | 20-Nov-25 | 318 KB |
| 6 | `DUNA  SHIPPING  -  RECEIPT  VOUCHER.pdf` | 1 | Receipt Voucher | **No. `477`** | — | 26 KB |
| 7 | `DUNA  SHIPPING SOA.pdf` | 1 | Statement of Account | — | 1-Jul-26 → 7-Sep-26 | 2.5 KB |

### 3.1 Extraction method and its limits

| Document | Method | Confidence |
|---|---|---|
| 1–5 | **Native PDF text extraction** (PyMuPDF 1.28.2) | **High** — digital text layer |
| 6 | **OCR** (rapidocr-onnxruntime 1.4.4 @ 200 dpi) | **Medium** — per-line confidence recorded in [`../02-business-documents/receipt-vouchers.md`](../02-business-documents/receipt-vouchers.md) |
| 7 | **OCR** (rendered at 200 dpi) | **Medium-high** — a TallyPrime ledger export; small but clean |

> **Typo policy:** typos in the source documents (`LAODING`, `SHIFITNG`, `KHORAMSHHAHR`, `700,00.00`,
> the manifest footer `VESSEL = DUNA SHIPPING LLC`) are **real artefacts, not extraction errors**.
> They are recorded, not normalised.

### 3.2 What each document proved

| Document | Proved |
|---|---|
| B/L | Party blocks; vessel `MEHDI 11`; voyage `02/26`; number format `KHS/26-110`; `FREIGHT PREPAID`; 1 original; "on deck" |
| Manifest | Tug **and** barge convention; 45 rows; **partner B/Ls `NES260900266/7` alongside `KHS/26-nnn`** (proves `REQ-107`); totals `32 UNITS AND 79 PKGS`, `991,886 KGS` |
| Tax Invoice | `DSINV/26-172`; per-line VAT columns; **VAT 0.00**; `Sub Total = Total = 27,370.00`; TRN `100353243700003`; references `KHS/26-108` + `DSKHS-26-005` |
| Proforma | **The second business line** (sale of goods, AED 690,000, FOB India → Bandar Abbas → Maku Free Zone); `100% ADVANCE PAYMENT` |
| Quotation | `DSQUO/25-017`; **line-item table**, not free text; AED 7,700 |
| Receipt Voucher | **Voucher No. `477`**; allocation references `1517`, `1526`, `Advance 477`; cash; AED 1,600. *(Corrected 2026-10-11: a `DSR/26-190` number was previously cited here and is fabricated — error E1.)* |
| Statement of Account | **TallyPrime is the book of record**; closing `683.50 Dr`; debit/credit columns; running balance; shared voucher series |

---

## 4. Legacy Laravel archive — `legacy-source/`

| Item | Size | Contents |
|---|---|---|
| `duna-clean.zip` | **16.9 MB** | The legacy Laravel 10 application |
| `docs-legacy/` | 5 md | `00-OVERVIEW.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS.md`, `03-UI-PAGES.md`, `04-DATA-DICTIONARY.md` |

### 4.1 Archive contents (199 non-asset files analysed)

| Metric | Value |
|---|---|
| PHP files | 78 — **22,833 LOC** |
| Blade files | 68 — **15,409 LOC** |
| Eloquent models | 23 |
| Controllers | 15 |
| Migrations | **4** (all stock Laravel) |
| Seeders | 1 (empty) |
| Tests | 4 (all stock scaffolding) |
| Config files | 17 |

### 4.2 Analysis method and its limits

| | |
|---|---|
| Method | **Static analysis only** — the code was read, never executed |
| `/vendor` and `/node_modules` | **Not present** in the archive, so the app cannot be run without `composer install` |
| Database | **No dump included** — the schema was **reconstructed** from models, controllers and views |
| Consequence | [`../03-legacy-laravel-system/database-schema.md`](../03-legacy-laravel-system/database-schema.md) carries **explicit confidence levels**; runtime-only behaviours (queue jobs, event listeners, scheduled tasks) could not be verified |

### 4.3 What the legacy archive proved

- What the company **actually used**, day to day, for years.
- The **shape** of the load list, manifest, B/L and invoice.
- The **ledger conventions** (debit/credit direction, balance formula) — independently confirming the
  SOA document.
- **14 catalogued defects (D1–D14)** — see
  [`../03-legacy-laravel-system/system-overview.md`](../03-legacy-laravel-system/system-overview.md) §7.
- What was **never** built: jobs, salary, delivery order, release workflow, agent portal, general
  journal, audit trail, document templates, PDF.

---

## 5. Prior AI analyses

### 5.1 `existing-analysis/` (3 files, Persian, 1,967 lines)

| File | Lines | Size |
|---|---|---|
| `duna_business_analysis.md` | 513 | 17.9 KB |
| `duna_client_discovery_questions_v2.md` | 885 | 34.2 KB |
| `duna_source_pack.md` | 569 | 25.6 KB |

### 5.2 `legacy-source/docs-legacy/` (5 files, English)

`00-OVERVIEW.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS.md`, `03-UI-PAGES.md`, `04-DATA-DICTIONARY.md`

### 5.3 Verdict

Reviewed in detail in
[`../04-business-analysis/prior-analysis-review.md`](../04-business-analysis/prior-analysis-review.md).
**Net: good framing, unreliable specifics.** Three recurring error patterns were found:

1. Assuming the legacy system implements what it merely declares.
2. Reporting "missing" for "not modelled the way I would model it."
3. Stating the employer's desired flow as if it were the legacy flow.

---

## 6. Current system (read-only survey)

| Source | What was used |
|---|---|
| `prisma/schema.prisma` (93.8 KB) | 62 models, 25+ enums, 38 migrations |
| `apps/api/src/modules/` | 33 modules, 38 controllers, 38 services |
| `apps/web/src/app/[locale]/(dashboard)/` | 35 pages |
| `docs/decisions.md` (86 KB) | 47 ADRs |
| `docs/progress.md` (91 KB) | Build history |
| `docs/current-plan/` (17 files) | Current plan, implementation state, open business decisions |
| `docs/ai-audit/` (14 files) | Previous audit |
| `docs/permissions.md` | 105 permissions / 12 resources |
| `docs/architecture.md`, `database-schema.md`, `workflows.md`, `api.md` | Current system |

**Read-only.** No application source code was modified at any point.

---

## 7. ⚠️ Missing sources

| ID | Source | Why it matters | Impact |
|---|---|---|---|
| **SRC-01** | **`/home/duna/dunaData/`** — named by `docs/current-plan/00-project-authority.md` as the **highest authority**, especially `transcripts/` | The current plan was written against this transcript set | **Every conclusion in this knowledge base is provisional with respect to it.** The 20 transcripts here may be a subset |
| SRC-02 | `shipping_documents_detailed_reference.md` — named as secondary employer evidence | More document evidence | More specimens may exist |
| SRC-03 | A database dump of the legacy system | The legacy schema had to be reconstructed | Legacy schema carries confidence caveats |
| SRC-04 | `/vendor` in the legacy archive | The app cannot be executed | Static analysis only |
| SRC-05 | A database dump of the **current** system | Current data shapes | Current analysis is schema-based, not data-based |
| SRC-06 | Answers to the **160-question** discovery questionnaire | Would close most open questions | ~40 questions remain materially unanswered |
| SRC-07 | The employer's actual document templates (Word/Excel originals) | `REQ-124` | Only 7 rendered PDFs are available |
| SRC-08 | `/home/duna/backups/shipping_erp_20260926_112141.dump` | Referenced after a data-loss incident | Not present in this workspace |

---

## 8. Provenance of every statement

| ID space | Meaning | Defined in |
|---|---|---|
| `EMP-nnn` | A numbered segment of the employer's original statements | `01-employer-statements/employer-original-statements.en.md` |
| `REQ-nnn` | A numbered requirement derived from the statements | `01-employer-statements/requirements-catalog.md` |
| `Rn.n` | A business rule derived from requirements | `01-employer-statements/business-rules.md` |
| `Dn` | A legacy system defect | `03-legacy-laravel-system/system-overview.md` §7 |
| `Ln` | A legacy business rule as implemented | `03-legacy-laravel-system/business-rules.md` |
| `Gn` | A legacy enforcement gap | `03-legacy-laravel-system/business-rules.md` §2 |
| `C-nn` | A contradiction between sources | `04-business-analysis/contradictions-register.md` |
| `Qnn` | A discovery question from the prior questionnaire | `existing-analysis/duna_client_discovery_questions_v2.md` |
| `SRC-nn` | A missing source | This file, §7 |
| `ADR-nnn` | An architecture decision on the current system | `docs/decisions.md` |
