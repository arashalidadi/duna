# Duna Business Knowledge Base

> A structured, searchable **English** business knowledge base for **Duna Shipping LLC**, built so
> that a future AI agent can improve the current Next.js dashboard **without re-deriving the business**.
>
> **Start here.** If you read only one file in this directory, read this one and then
> [`06-ai-reference/how-to-use-this-knowledge-base.md`](06-ai-reference/how-to-use-this-knowledge-base.md).

---

## 1. What this is

Everything known about **how Duna Shipping actually works**, distilled from five kinds of source:

| Source | What it tells you |
|---|---|
| 20 Persian voice transcripts from the employer | **Intent** — what he wants, in his own words |
| 7 real company documents (PDF) | **Fact** — the formats, values and layouts the company really uses |
| A legacy Laravel system (199 files) | **History** — what the company actually did for years |
| 8 prior AI analyses | **Framing** — useful, but verify everything |
| The current Next.js / NestJS system | **Reality** — what exists today |

**46 files, ~16,000 lines, 19 MB.**

---

## 2. Directory map

| Directory | Phase | Contents |
|---|---|---|
| [`01-employer-statements/`](01-employer-statements/) | 2, 3 | The employer's own words, in English, **in original sequence**; the 127-requirement catalogue; business rules; processes; glossary; open questions |
| [`02-business-documents/`](02-business-documents/) | 4 | The 7 real PDFs analysed field by field, plus a cross-document synthesis |
| [`03-legacy-laravel-system/`](03-legacy-laravel-system/) | 5 | The old Laravel system: architecture, schema, calculations, workflows, documents, permissions, source map, and **14 catalogued defects (D1–D14)** |
| [`04-business-analysis/`](04-business-analysis/) | 6, 9 | The consolidated business model, ER model, contradictions register, capability gaps, customer-relationship hypotheses, and a review of the prior analyses |
| [`05-current-project/`](05-current-project/) | 8 | The current Next.js/NestJS system, and the **legacy-vs-current comparison** |
| [`06-ai-reference/`](06-ai-reference/) | 10–13 | **How to use this knowledge base**, the maintenance plan, the source-retention plan, and the completeness audit |
| [`07-traceability/`](07-traceability/) | 1, 7 | Source inventory and the **requirements traceability matrix** (all 127 requirements × 4 evidence layers) |
| `requirements/` | — | The 20 Persian transcripts (**originals, untouched**) |
| `documents/` | — | The 7 PDFs (**originals, untouched**) |
| `existing-analysis/` | — | The 3 prior AI analyses (**originals, untouched**) |
| `legacy-source/` | — | `duna-clean.zip` + `docs-legacy/` (**originals, untouched**) |
| `docs-summary.md` | — | The 55.8 KB summary shipped with the source pack |

---

## 3. The five things you must know before touching anything

1. **Legacy Laravel behaviour is historical evidence, NOT the specification.** Do not plan to
   replace the current dashboard with it. Do not delete a current feature merely because the old
   system lacked it.
2. **Do not invent business rules.** Where the employer is ambiguous, the question is recorded in
   `01-employer-statements/open-questions.md`. Raise it; do not answer it.
3. **Do not silently resolve contradictions.** There are 22 catalogued in
   `04-business-analysis/contradictions-register.md`.
4. **Customer ≠ Shipper ≠ Consignee ≠ Agent ≠ User.** The legacy system merged Customers with Users.
   That was its single worst decision. See `04-business-analysis/customer-relationship-hypotheses.md`.
5. **B/L comes first; the Manifest consolidates issued B/Ls.** The legacy system inverted this. The
   current system has it right.

---

## 4. Two requirements that feel like bugs but are not

Recorded prominently because intuition points the wrong way:

| Requirement | What it says | Why it feels wrong |
|---|---|---|
| `REQ-122` | **Print must strip** stamps, marks and signature | It looks like a rendering bug. It is deliberate: the PDF carries the stamp, the printed page is stamped physically by hand afterwards |
| `REQ-165` | **An unallocated payment must NOT raise an error** | It looks like missing validation. It is deliberate: advances and deposits post to the customer ledger with no invoice |

---

## 5. Where to go for a specific question

| You want to know… | Go to |
|---|---|
| What did the employer actually say? | `01-employer-statements/employer-original-statements.en.md` |
| What is required, with a citable ID? | `01-employer-statements/requirements-catalog.md` |
| What does a real invoice / B/L / manifest look like? | `02-business-documents/document-catalog.md` |
| How did the old system do it? | `03-legacy-laravel-system/` |
| What did the old system get wrong? | `03-legacy-laravel-system/system-overview.md` §7 (D1–D14) |
| What does the business actually do, end to end? | `04-business-analysis/consolidated-business-model.md` |
| Two sources disagree — who wins? | `04-business-analysis/contradictions-register.md` |
| What does the current system do? | `05-current-project/implemented-capabilities.md` |
| Old vs new — what changed? | `05-current-project/legacy-vs-current-comparison.md` |
| Is requirement X met today? | `07-traceability/requirements-traceability.md` |
| What is still unknown? | `01-employer-statements/open-questions.md` |
| What is a Persian term in English? | `01-employer-statements/terminology-glossary.md` |

---

## 6. ID conventions

| ID | Meaning |
|---|---|
| `EMP-nnn` | A numbered segment of the employer's original statements |
| `REQ-nnn` | A numbered requirement |
| `Rn.n` | A business rule derived from requirements |
| `Dn` | A legacy system defect (D1–D14) |
| `Ln` / `Gn` | A legacy rule as implemented / a legacy enforcement gap |
| `C-nn` | A contradiction between sources |
| `Qnn` | A discovery question from the pre-existing Persian questionnaire |
| `SRC-nn` | A missing source |
| `ADR-nnn` | An architecture decision on the current system (in `docs/decisions.md`) |

---

## 7. ⚠️ Known limits — read before trusting anything

| Limit | Detail |
|---|---|
| **The authoritative transcript set is missing** | `docs/current-plan/00-project-authority.md` names `/home/duna/dunaData/transcripts/` as the highest authority. **That path does not exist in this workspace** (gap **SRC-01**). The 20 transcripts here may be a subset. **Every conclusion here is provisional with respect to it.** |
| **The legacy system was never executed** | No `/vendor`, no database dump. The schema is a reconstruction with explicit confidence levels. |
| **The current system was surveyed, not exhaustively read** | 62 Prisma models, 33 API modules, 35 pages. The analysis is based on the schema, the ADRs and the project's own state documents — not a line-by-line read of all application code. |
| **The discovery questionnaire is unanswered** | Q01–Q160 exists but the employer never answered it. Roughly 65 of 160 questions have no answer anywhere in the repository. |
| **Salary, Letters and Company Archive are barely described** | The employer mentioned them and moved on. Do not build them on inference. |
| **Some document numbers remain unresolved** | B/L, manifest, invoice, proforma, receipt and customer-code formats all have competing candidates. See `contradictions-register.md`. |
| **No secrets** | Credentials found in the archive are deliberately not recorded anywhere in this knowledge base. |

---

## 8. Status

| Phase | Description | Status |
|---|---|---|
| 1 | Source inventory | ✅ |
| 2 | Consolidated English employer statements | ✅ |
| 3 | Requirements analysis | ✅ |
| 4 | PDF document analysis | ✅ |
| 5 | Legacy Laravel analysis | ✅ |
| 6 | Evaluate prior AI analyses | ✅ |
| 7 | Resolve discovery questions | ✅ (catalogued; ~65 remain genuinely unanswered) |
| 8 | Current Next.js analysis + legacy-vs-current | ✅ |
| 9 | Customer-relationship hypotheses | ✅ |
| 10 | Directory structure, README, future-model instructions | ✅ |
| 11 | Documentation maintenance plan | ✅ |
| 12 | Source retention / cleanup plan | ✅ (classification only — **nothing deleted**) |
| 13 | Completeness audit | ✅ |
| 14 | Final report | ✅ |

Built **2026-10-10**. Documentation only — **no application source code was modified.**
