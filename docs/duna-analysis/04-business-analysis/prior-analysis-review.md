# Review of Prior AI Analyses

> Phase 6. There are **two families** of prior analysis in this repository:
>
> | Family | Location | Language | Size |
> |---|---|---|---|
> | **Discovery analyses** | `docs/duna-analysis/existing-analysis/` (3 files) | Persian | 1,967 lines |
> | **Legacy code analyses** | `docs/duna-analysis/legacy-source/docs-legacy/` (5 files) | English | — |
> | **Current-project docs** | `docs/` (13 files, incl. `decisions.md` 86 KB, `progress.md` 91 KB) | English | — |
>
> **Standing rule for future agents:** every prior analysis is a *hypothesis to be verified against
> primary evidence* (transcripts → PDFs → legacy code → current code), never a fact. This file
> records where each one holds up and where it does not.

---

## 1. `existing-analysis/duna_business_analysis.md` (513 lines, Persian)

**What it is:** a deep business & product analysis — domain concepts, proposed operational workflow,
accounting model, document architecture, agent portal, status architecture, gaps, product direction.

### 1.1 Findings that are CONFIRMED by primary evidence

| Claim (translated) | Verified against | Verdict |
|---|---|---|
| Duna is a shipping / maritime logistics company handling heavy cargo, machinery, equipment | Transcripts + all 7 PDFs | ✅ Confirmed |
| Four interlocking flows: Operational, Commercial, Document, Control | Transcripts | ✅ A sound framing; adopted in [`consolidated-business-model.md`](consolidated-business-model.md) |
| Two business streams: (A) export/outbound, (B) inbound / discharge-at-own-port | Transcripts | ✅ Confirmed — the second stream is the "flipping" business; see [`../01-employer-statements/employer-requirements-analysis.md`](../01-employer-statements/employer-requirements-analysis.md) §2 |
| Customer, Shipper, Consignee, Agent must **not** be merged | Transcripts + B/L + manifest | ✅ Confirmed |
| Cargo is the operational unit with a full lifecycle trail | Transcripts | ✅ Confirmed |
| B/L lifecycle `Prepare → Draft → Send → Revision → Approved → Final`, then `Released / Unreleased` at destination | Transcripts | ✅ Confirmed (`REQ-104`, `REQ-180`) |
| **Draft vs Released are two different axes and must not be collapsed into one status** | Transcripts | ✅ Confirmed; the legacy system's single `status`/`bl_status` pair is exactly the mistake warned against |
| Manifest should be built FROM B/Ls; totals aggregated; snapshot of membership at finalisation | Transcripts (`EMP-024`–`EMP-027`) | ✅ Confirmed — and this is the **opposite** of the legacy flow (see [`../03-legacy-laravel-system/workflows.md`](../03-legacy-laravel-system/workflows.md) §2) |
| `Customer → Invoice → Debit`; `Customer → Payment/Receipt → Credit`; `Balance = Debit − Credit` | SOA PDF + legacy `CalculateDebitCredit()` | ✅ Confirmed by two independent sources |
| Job costing needs Transport, Customs, Repair, Crane, Vessel, Port Handling, Port Use, Lashing, Storage | Transcripts (`REQ-191`) | ✅ Close match |
| Voyage P&L = Σ invoice revenue − Σ voyage costs | Transcripts (`REQ-192`) + legacy `manifest/report.blade.php` | ✅ Confirmed |
| General Journal needed for amounts outside the Invoice/Shipment path, separate from but linkable to Customer Ledger | Transcripts (`REQ-166`, `REQ-167`) | ✅ Confirmed |
| Success test: "for any cargo, can we answer where it came from, where it is, which vessel/voyage, which B/L and manifest, what costs, what invoices, how much paid, released or not, and the financial outcome?" | — | ✅ An excellent acceptance test; reproduced in [`consolidated-business-model.md`](consolidated-business-model.md) |

### 1.2 Claims that are WRONG or UNVERIFIED

| # | Claim | Assessment |
|---|---|---|
| A1 | "Legacy B/L: `PENDING → RELEASED`" | ❌ **Wrong.** `RELEASED` is defined as a constant in `Bl.php` but is **never written anywhere**. B/L `status` is always `PENDING` (defect **D1**). See [`../03-legacy-laravel-system/system-overview.md`](../03-legacy-laravel-system/system-overview.md) §7 |
| A2 | "Legacy workflow `Loading → Admin Review → Approved → BL → Manifest → Invoice → Fin`" | ⚠️ Half right on order, but it **omits** that B/Ls are created *against* a manifest in code. The chain in code is `Loading → Admin Review → Manifest → BL → Invoice → Fin` |
| A3 | "Legacy `in_status: PENDING / DONE / LOCAL ED / NO NEED`" | ⚠️ Names are right in substance; the actual column is `inspection_status` and the values are `PENDING`, `DONE`, `LOCAL`, `NONEED` ("LOCAL ED" is a transcription artefact) |
| A4 | "Legacy `status: LOADED / IN_YARD`" | ✅ Correct (`loading_status`) |
| A5 | "Legacy has PDF-ready print/preview pages" | ⚠️ Misleading. Pages are **print-ready in the browser**; there is **no PDF engine** in the project (no DOMPDF/Snappy). The "PDF" in the employer's requirement (`REQ-122`) is a genuine new capability |
| A6 | "Legacy invoice: `PAID / UNPAID`" | ✅ Correct |
| A7 | Job / Shipment treated as if it already exists as a concept | ❌ There is **no Job entity at all** in the legacy system. It is a proposed concept, correctly identified as a gap |

### 1.3 What this document gets right in method

Its §15 "What Should NOT Be Done Yet" is the single most valuable part and should be treated as
guidance:

> - Do not finalise the schema.
> - Do not copy the legacy models.
> - Do not merge Customer with User or Shipper.
> - Do not make Invoice depend only on B/L.
> - Do not treat Release as merely a status on B/L.
> - Do not treat Voyage as merely a string on Vessel.
> - Do not treat Ledger as merely a reporting table.
> - Do not design Comment without an audit trail.

Every one of these eight rules is consistent with the employer's statements and with the legacy code
evidence.

---

## 2. `existing-analysis/duna_client_discovery_questions_v2.md` (885 lines, Persian)

**What it is:** a 160-question discovery questionnaire (Q01–Q160) across 28 sections, plus 5 worked
example answers.

### 2.1 Assessment

This is a **well-constructed** questionnaire: one topic per question, plain language, examples,
invites voice answers, and asks for sample documents. It was written by an earlier AI analysis and
**there is no evidence the employer ever answered it.**

- The 160 questions map cleanly onto the employer's own statements.
- The Q-numbering (Q01–Q160) is adopted by this knowledge base as the canonical open-question ID
  space — see [`../07-traceability/source-inventory.md`](../07-traceability/source-inventory.md) and
  the coverage table in [`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md).
- ⚠️ The Q-numbers do **not** correspond to the `REQ-` numbers in this knowledge base. They are a
  separate ID space. A crosswalk is provided in [`../07-traceability/`](../07-traceability/).

### 2.2 Coverage

| Q range | Topic | Answered by employer statements? | See |
|---|---|---|---|
| Q01–Q04 | How a job starts, job types, Cargo vs Shipment vs Job vs B/L, job end | Partial | `employer-requirements-analysis.md` §2 |
| Q05–Q10 | Customer definition, job types per customer, static vs job data, contacts, status, credit | Partial | `REQ-004`–`REQ-020` |
| Q11–Q16 | Cargo types, primary identifier, multiple machines, package/Nagle, weight & size, technical data | **Partial — "Nagle" is unresolved** | `open-questions.md` Q-CARGO-01 |
| Q17–Q21 | Cargo route, ports & yards, entry vs current yard, internal transfer, key dates | Partial | `REQ-060`–`REQ-070` |
| Q22–Q26 | Cargo intake documents, document status, validity, multiple files, versioning | Weak — employer did not describe cargo document status in detail | `open-questions.md` |
| Q27–Q31 | Inspection process, result, evidence, multiple inspections, effect on loading | **Good** | `REQ-075`–`REQ-082` |
| Q32–Q38 | Load list: creator, per-vessel, stages, removal, partial loading, operator data, proof of loading | **Good** | `REQ-083`–`REQ-093` |
| Q39–Q43 | Vessel structure, tug & barge, voyage number, voyage vs destination, voyage change | **Good** | `REQ-037`–`REQ-042` |
| Q44–Q51 | B/L: timing, multiple cargo, draft/final, post-final amendment, number, originals, surrender/release, freight | **Good** | `REQ-100`–`REQ-108` |
| Q52–Q58 | Manifest: creation condition, member B/Ls, amended manifest, number, totals, ownership, forwarder/co-loading | **Good** | `REQ-110`–`REQ-116` |
| Q59–Q63 | Customer vs Shipper vs Consignee vs Agent, changes, notify party, agent, agent change | **Good** | `REQ-044`–`REQ-055` |
| Q64–Q72 | Invoice types, B/L vs manifest basis, invoice↔job cardinality, line items, VAT, credit terms, amended invoice | **Good** | `REQ-140`–`REQ-150` |
| Q73–Q79 | Job definition, scope, cost types, direct vs indirect, cost without job, timing, correction | **Good** | `REQ-130`–`REQ-135` |
| Q80–Q87 | Ledger, debit/credit, general journal, office expenses, bank/cash, multi-currency, balance, statement | **Good** | `REQ-160`–`REQ-167` |
| Q88–Q96 | Payment types, payment voucher, receipt voucher, payment to a person, ID card, signature, partial, advance, overpayment | **Good** | `REQ-165`–`REQ-172` |
| Q97–Q101 | Release conditions, full/partial/credit, approval, multiple releases, release history | **Good** | `REQ-180`–`REQ-184` |
| Q102–Q106 | Agent portal: visible data, access limits, document access, operations, multiple agents per port | **Good** | `REQ-187`, `REQ-188` |
| Q107–Q110 | Delivery order: use cases, issue condition, DO vs release, delivery confirmation | **Good** | `REQ-185`, `REQ-186` |
| Q111–Q115 | Proforma, relation to customer/job, validity, quotation, amended versions | **Good** | `REQ-190`+; [`../02-business-documents/quotations.md`](../02-business-documents/quotations.md) |
| Q116–Q123 | Reporting: daily, operations, vessel/voyage, P&L, revenue, voyage cost, cost allocation, tax | **Good** | `REQ-190`–`REQ-194` |
| Q124–Q128 | Alerts, payment delay, cargo left in yard, pending inspection, other alerts | **Good** | `REQ-154`, `REQ-184` |
| Q129–Q133 | Company archive, link to case, search, versioning, deletion | Weak | EMP-713 |
| Q134–Q137 | Letters, basis, numbering, signature & stamp | **No employer input found** | — |
| Q138–Q141 | Roles, per-role access, activity log, change history | Weak | `REQ-001`–`REQ-003` |
| Q142–Q147 | Outputs, templates, PDF & Excel, print with/without stamp, signature, multiple copies | **Good** | `REQ-120`–`REQ-124` |
| Q148–Q152 | Salary | **No employer input found** | EMP-716, EMP-717 |
| Q153–Q160 | Cancellation, re-open, return, destination change, vessel change, partial loading, lost/damaged, unstated cases | Weak | — |

**Net:** the questionnaire is a good artefact, but it is **unanswered**. Its main residual value is
as a checklist of what the employer has *not* told us.

---

## 3. `existing-analysis/duna_source_pack.md` (569 lines, Persian)

**What it is:** a consolidated source pack — source index, a "corrected" voice transcript grouped by
topic, real-document evidence, legacy module inventory, legacy gaps, legacy workflow, and a list of
20 "items to verify".

### 3.1 Confirmed

| Claim | Verdict |
|---|---|
| Document evidence for B/L, Manifest, Receipt Voucher, SOA, Tax Invoice, Proforma, Quotation | ✅ Matches the 7 PDFs analysed in [`../02-business-documents/`](../02-business-documents/) |
| Manifest `DSMAN/KHO-26-006`, vessel `BARGE MEHDI 11`, tug `LAYAN GULF`, voyage `02/26`, 45 rows, totals `32 UNITS AND 79 PKGS`, `991,886 KGS` | ✅ Matches |
| Receipt voucher no. 477, `RUKN ALHMREYA TRANSPORT L.L.C`, AED 1,600, refs `1517`, `1526`, `Advance 477` | ✅ Matches |
| SOA period `1-Jul-26 to 7-Sep-26`, closing balance `683.50 Dr` | ✅ Matches |
| Tax invoice `DSINV/26-172`, `MR. SHAHOKH SHAHVARAEI`, `AED 27,370.00`, VAT 0 | ✅ Matches |
| Proforma `DSPRO/26-001`, `MR. RAMIN AHMADABADI`, AED 690,000, FOB Bandar Abbas → Maku Free Zone | ✅ Matches |
| Quotation `DSQUO/25-017`, `MR. SHADMAN MEABADI`, Volvo finisher, AED 7,700 | ✅ Matches |
| Legacy gaps: Vessel as a proper entity, Delivery Order, Release Order, Salary, Letters, customer CRM, clean party separation, API layer | ✅ Matches our independent code analysis |

### 3.2 Wrong or imprecise

| # | Claim | Correction |
|---|---|---|
| S1 | "Ledger as an independent accounting entity" is a legacy gap | ⚠️ Imprecise. A `Fin` model and `admin/fins/*` screens **do exist**. What is missing is a *proper double-entry* ledger (no journal entries, no accounts, no general journal). Reworded: the gap is **Ledger quality**, not Ledger existence |
| S2 | "Legacy manifest number is generated by destination/port sequence" | ⚠️ Partly right in intent, but the implementation has a **random** component: `generateManifestNumber($port)` builds `KHO/{rand}{dd}{mm}{yyyy}` |
| S3 | "Voyage generated by Shipper + destination" | ✅ Correct — and this is precisely defect **D12**: it should be keyed on vessel + destination |
| S4 | "Invoice code sequential" | ❌ **Wrong.** `getinvoiceCode()` returns `DSAED/{rand6}` — random, not sequential |
| S5 | "Legacy B/L: `PENDING → RELEASED`" | ❌ Same error as A1 — `RELEASED` is never written |
| S6 | "PDF-ready print/preview pages" | ⚠️ Same as A5 — browser print only |
| S7 | "45 numbered rows are represented in the source text" | ⚠️ Should be verified against the rendered manifest; the row count in our own catalogue is recorded separately in [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md) |
| S8 | Vessel on the tax invoice given as `DAHAR 10`, manifest `DSKHS-26-005`, reference `BL#: KHS/26-108` | ✅ Consistent with the specimen — note this is a **different** voyage/manifest from `DSMAN/KHO-26-006`, so there are at least two manifest series in the evidence |

### 3.3 Its "20 items to verify" — disposition

| # | Item | Status in this knowledge base |
|---|---|---|
| 1 | Exact customer code format; `CUST 3.1` vs `CUST 3SF-2` | **Unresolved.** Recorded in [`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md) |
| 2 | Exact voyage-number logic | **Partially resolved.** Employer: per vessel + destination; legacy: port+shipper (wrong); real docs: `02/26`. See [`../03-legacy-laravel-system/calculations.md`](../03-legacy-laravel-system/calculations.md) §1 |
| 3 | Exact B/L number format per port | **Unresolved — three-way contradiction** (legacy `KHS/20261104` vs real `KHS/26-110` vs employer `KHS/26-2/2026`). See [`contradictions-register.md`](contradictions-register.md) |
| 4 | Exact manifest number format | **Contradiction** (legacy `KHO/4829132026` vs real `DSMAN/KHO-26-006` vs `DSKHS-26-005`) |
| 5 | Difference between Voyage and Manifest number | **Resolved.** Voyage = per vessel+destination, `nn/yy`; Manifest = per voyage, its own series |
| 6 | Document status & cargo intake document types | Weak evidence |
| 7 | Meaning of "Nagle / Package" | **Unresolved** — translation trap; see [`../01-employer-statements/terminology-glossary.md`](../01-employer-statements/terminology-glossary.md) |
| 8 | ETOZ / ETDZ term | **Unresolved** |
| 9 | What the Customer Ledger consists of vs the General Ledger | Partially resolved (`REQ-160`–`REQ-167`) |
| 10 | Is an invoice always linked to one B/L, or can it span several? | **Resolved.** An invoice **can** span several B/Ls (`REQ-141`); the legacy link is optional |
| 11 | Can one manifest have several customers / shippers / consignees? | **Resolved — yes** (`REQ-115`, `REQ-116`) |
| 12 | Who approves, and under what conditions? | **Not the employer's own flow.** `admin_status` is a legacy-only gate |
| 13 | Does a load list have version history, or is it just an edited record? | **Resolved.** Only the current version matters (`REQ-094`) |
| 14 | Who can edit/delete a comment; is an audit trail needed? | **Resolved.** Author can edit/delete; accounting must see it (`REQ-065`–`REQ-067`) |
| 15 | Exact release rules for full / partial / credit | Partially resolved (`REQ-180`–`REQ-183`) |
| 16 | Agent access scope; download/print of documents | Partially resolved (`REQ-187`, `REQ-188`) |
| 17 | Delivery order details and relation to cargo/B/L/consignee | Partially resolved (`REQ-185`, `REQ-186`) |
| 18 | VAT: which invoices, which rates, per line or per invoice? | **Resolved.** Per line, with a percentage field; the real specimen has VAT 0 (`REQ-144`) |
| 19 | Vessel/voyage cost structure and the level at which each cost is booked | Partially resolved (`REQ-191`) |
| 20 | Company archive and retention policy | Weak evidence |

---

## 4. `legacy-source/docs-legacy/` (5 files, English)

| File | Value | Verdict |
|---|---|---|
| `00-OVERVIEW.md` | Module inventory with ✅/❌ presence marks | ⚠️ **Unreliable on presence.** See §4.1 |
| `01-DOMAIN-MODEL.md` | Domain model with proposed schemas | ⚠️ Mixes *what exists* with *what should exist*. The "Missing" entities tables (lines ~412–417) are **proposals**, not findings |
| `02-WORKFLOWS.md` | Workflow narrative | ⚠️ Adequate but misses that B/L creation is nested under the manifest controller |
| `03-UI-PAGES.md` | Page-by-page inventory with Blade paths | ✅ **The most useful of the five.** Paths verified correct |
| `04-DATA-DICTIONARY.md` | Field-level dictionary | ✅ Useful; superseded in depth by [`../03-legacy-laravel-system/data-dictionary.md`](../03-legacy-laravel-system/data-dictionary.md) |

### 4.1 The `00-OVERVIEW.md` presence error — verified

`00-OVERVIEW.md` line 34 states:

```
| **Accounting → Ledger** | Not found as separate model | ❌ Missing |
```

**This is false.** Verified against the code:

- `app/Models/Fin.php` — a separate Eloquent model (29 lines)
- `app/Http/Controllers/Admin/FinController.php` — 215 lines, 11 methods
- `resources/views/admin/fins/` — 4 views (`ledger`, `preview`, `showledger`, `release`)

**And the same document set contradicts itself:** `03-UI-PAGES.md` lines 61–62 list
`admin/fins/ledger` and `admin/fins/showledger` as existing pages.

Corrected verdicts:

| Entity | `00-OVERVIEW.md` says | Reality |
|---|---|---|
| Ledger | ❌ Missing | ⚠️ **Exists** (`Fin` model + 4 screens) but is **not a proper double-entry ledger** — no accounts, no journal entries, no general journal |
| Salary | ❌ Missing | ✅ Correct — genuinely absent |
| Financial Reports | ❌ Missing | ⚠️ Partly wrong — `admin/manifest/report.blade.php` (voyage P&L) exists |
| Letters | ❌ Missing | ✅ Correct — genuinely absent |

---

## 5. `docs/` — the current project's own documentation

| File | Value for this knowledge base |
|---|---|
| `docs/business-requirements.md` (3.9 KB) | ⚠️ **Thin** — 3.9 KB against ~200 employer requirements. Superseded by `01-employer-statements/requirements-catalog.md` (26.9 KB) |
| `docs/architecture.md` | ✅ Authoritative for the **current** system |
| `docs/database-schema.md` | ✅ Authoritative for the **current** schema |
| `docs/permissions.md` | ✅ 105 permissions across 12 resources |
| `docs/workflows.md` | ✅ Current-system workflows |
| `docs/api.md` | ✅ Current API surface |
| `docs/decisions.md` (86 KB) | ✅ **Highest-value current-project doc** — ADRs |
| `docs/progress.md` (91 KB) | ✅ Phase-by-phase build log |
| `docs/design-system.md` | ✅ UI conventions |
| `docs/current-plan/00-project-authority.md` | ⚠️ Cites `/home/duna/dunaData/` as the highest authority — that path **does not exist in this workspace** (gap **SRC-01**) |
| `docs/CLAUDE.md`, `README.md` | ✅ Repo conventions |

**Note:** `docs/` describes the *current* system and is analysed in Phase 8 —
[`../05-current-project/`](../05-current-project/).

---

## 6. Consolidated verdict

| Prior analysis | Trust level | How to use it |
|---|---|---|
| `duna_business_analysis.md` | **Medium-high** on business framing; **low** on legacy specifics | Use §12 (product direction), §15 (what not to do), §16 (definition of success) as guidance. Do **not** trust its legacy status claims |
| `duna_client_discovery_questions_v2.md` | **High** as a checklist; **unanswered** | Use Q01–Q160 as the canonical open-question ID space and as a coverage checklist |
| `duna_source_pack.md` | **High** on document evidence; **low** on legacy implementation details | Use its document transcriptions as a cross-check on Phase 4; do **not** trust its claims about legacy number generation |
| `docs-legacy/03-UI-PAGES.md`, `04-DATA-DICTIONARY.md` | **High** | Use as a cross-check on Phase 5 |
| `docs-legacy/00-OVERVIEW.md`, `01-DOMAIN-MODEL.md` | **Low** on presence claims | Verify every ✅/❌ against code before relying on it |
| `docs/decisions.md`, `docs/progress.md` | **High** for the current system | Primary source for Phase 8 |

### 6.1 The three recurring errors in prior analyses

1. **Assuming the legacy system implements what it merely declares.** `RELEASED` is a constant, not a
   behaviour. `PDF-ready` means "prints from the browser". `Sequential` invoice codes are random.
2. **Reporting "missing" for "not modelled the way I would model it."** Ledger is the clearest case.
3. **Stating the employer's desired flow as if it were the legacy flow.** The manifest-before-B/L vs
   B/L-before-manifest inversion is the clearest case.

> **Rule for future agents:** when a prior analysis says a legacy behaviour *exists*, look for the
> line of code that performs it. When it says a behaviour is *missing*, look for the screen that
> would have hosted it. Both directions have been wrong in this repository.

---

## 7. Where the prior analyses left gaps that this knowledge base fills

| Gap | Filled by |
|---|---|
| No verbatim, sequence-preserving English record of the employer's statements | [`../01-employer-statements/employer-original-statements.en.md`](../01-employer-statements/employer-original-statements.en.md) (113 KB) |
| No REQ-ID traceability from statement → requirement → evidence | [`../01-employer-statements/requirements-catalog.md`](../01-employer-statements/requirements-catalog.md), [`../07-traceability/`](../07-traceability/) |
| No line-by-line verification of legacy behaviour against code | [`../03-legacy-laravel-system/`](../03-legacy-laravel-system/) (11 files) |
| No defect register for the legacy system | `system-overview.md` §7, D1–D14 |
| No cross-document synthesis of the 7 PDFs | [`../02-business-documents/document-analysis.md`](../02-business-documents/document-analysis.md) |
| No explicit contradiction register | [`contradictions-register.md`](contradictions-register.md) |
| No comparison of legacy vs current | [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md) |
