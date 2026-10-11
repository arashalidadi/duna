# Open Questions & Unresolved Decisions

> **Purpose:** Everything a future agent must **not** invent an answer to. Each item records what is
> known, what is missing, and why it matters.
>
> Two sources feed this document:
> 1. **Q01–Q160** — the pre-existing Persian discovery questionnaire at
>    `docs/duna-analysis/existing-analysis/duna_client_discovery_questions_v2.md`
>    (28 topic sections). This document does **not** reprint them; it states, per section, how far
>    the available evidence already answers them.
> 2. **Own findings** — ambiguities found while building this knowledge base (IDs below).

---

## 0. Status summary

| Disposition | Count | Meaning |
|---|---|---|
| **Answered by evidence** | ~55 of 160 | The transcripts and/or the 7 real documents settle it. |
| **Partially answered** | ~40 of 160 | Direction is clear; the exact value/threshold/format is not. |
| **Not answered at all** | ~65 of 160 | Nothing in the repository addresses it. Must go back to the employer. |

> The counts are approximate. They are derived from the coverage tables in §2, which are
> reproducible against the transcript set.

---

## 1. Own findings — ambiguity register

| ID | Area | Question | What is known | Blocker / risk |
|---|---|---|---|---|
| **CUST-01** | Customer code | What is the exact customer code format? | Prefix `CUST`, system-generated, sequential (REQ-014). Four incompatible examples given: `CUST 3-3-1`, `CUST 3SF-2`, `CUST 2SF-1/3SF-1…N`, `CUST 3.1/3.2/3.3`. | Cosmetic, but the employer will notice. The current system's `NumberingSequence` model can express any of them — only the seeded format string is missing. |
| **CUST-02** | Customer | Does a customer ever have a credit limit or currency? | The employer explicitly **removed** Type / Currency / TRN / Short Name from Customer (REQ-017). But he asked for multi-currency handling elsewhere in accounting (Q85). | If multi-currency is real, the currency has to live somewhere — most likely the Invoice, not the Customer. |
| **BL-01** | B/L number | Exact B/L number format? | Per-destination numbering confirmed. Real samples show `KHS/26-110`, `KHS/26-108`. Employer's spoken examples `KHS/26-2/2026` and `RJS/26-10` do not match each other or the samples. | Blocks number-generation seeding. |
| **MAN-01** | Manifest number | Exact manifest number format? | Real samples: `DSMAN/KHO-26-006`, `DSKHS-26-005`. Employer gave no format; legacy code generated `{port.abb}/{rand6}{year}` — **random**, not sequential. | Random generation (legacy) contradicts "numbered in order" expectations and makes numbers non-reproducible. |
| **VOY-01** | Voyage number | Is the voyage counter per vessel+per destination+per year (employer) or per Port+Shipper (legacy `generateVoyage`)? | Employer: per vessel + per destination + per year (REQ-040). Legacy: per `Portshipper` record. | These are different keys. The employer's rule is the requirement; legacy is only evidence of an older implementation. |
| **CRG-01** | Cargo docs | What are **EXID**, **BCC**, **R.D.A.**? | EXID, BCC, Local Transfer are the three named Document Status values (REQ-063). Export Paper, Import Paper, Export Certificate, R.D.A. are named as intake documents (REQ-064). | No expansion anywhere. The real PDFs do not use these terms. |
| **CRG-02** | Cargo comment | Is the comment field editable and deletable after entry, and is a comment mandatory at cargo creation? | The employer only said operations "write it in that Comment" and accounting reads it (REQ-065 – REQ-067). | Editability is **inferred**, not stated. Mandatoriness is **not stated at all**. |
| **CRG-03** | Cargo ↔ Job | Is the Job ↔ Cargo link 1:1 or 1:many? | The employer speaks of "one machine / one shipment" having a Job Number, and of a Job belonging to a Customer. | Not stated. Affects schema cardinality. |
| **INV-01** | VAT | What is the default VAT rate, and which services are VAT-able vs not? | Lines carry a VAT % typed by the user (REQ-144). The one real Tax Invoice in the pack shows **VAT 0%** on all lines. | The employer's 5% figure is only an *example* ("if I write five"). Default is unknown. |
| **INV-02** | Invoice | Is there a correction / re-issue flow for an issued invoice? | Draft B/L has a correction flow (REQ-105); no equivalent is stated for invoices. | Not stated. |
| **FIN-01** | Ledger | Is there a formal **double-entry** chart of accounts, or is the "ledger" purely a per-customer running balance? | The employer describes Debit/Credit per customer (REQ-150/151) plus a "General Journal" (REQ-166) plus office expenses in the same ledger (REQ-167). | He never says "chart of accounts" or "double entry". Prior AI analyses proposed full double-entry; that is an **inference**, not employer evidence. |
| **FIN-02** | Voucher | Can one payment settle **several** invoices at once? | The employer says allocation is to "a specific Invoice" or "a specific B/L number" (REQ-164) — singular each time. The real Receipt Voucher settles **two** invoices at once. | Evidence conflicts with the phrasing. Multi-invoice allocation is **required by the real document** but not stated by the employer. |
| **FIN-03** | Voucher | Is overpayment (payment > invoice) allowed, and how is the surplus held? | Unallocated payment must not error (REQ-165) — this covers the surplus case implicitly. | Explicit overpayment policy is absent. |
| **FIN-04** | Alerts | What is the overdue threshold that triggers the "customer hasn't paid" alarm? | The employer asks for an alarm (REQ-154) but gives no number. | Threshold must come from the employer. |
| **RLS-01** | Release | What is the alert window for a credit release? | "one or two weeks" for follow-up (REQ-184); illustrative examples of "one week unpaid" and "one month, 20% unpaid". | The illustrative numbers are not a policy. |
| **RLS-02** | Release | Who is authorised to release on credit, and is there a limit? | Not stated. | Policy gap. |
| **DO-01** | Delivery Order | What exactly makes a cargo eligible for a Delivery Order? | Issued after Duna discharges inbound cargo at its own port (REQ-185). | Precise eligibility rule absent. |
| **AGT-01** | Agent portal | Beyond viewing B/Ls / Manifests / Release Orders, may an agent **submit bookings** or upload documents? | Only viewing is stated (REQ-187, EMP-681). | Any write capability would be an invention. |
| **AGT-02** | Agent portal | Is the agent scoped to a **port** or to a **destination** — and can an agent cover several destinations? | "Their own port"; one agent per destination (EMP-380, EMP-677). | Singular in the transcripts; real business may have multi-destination agents. |
| **RPT-01** | Reports | Are voyage costs **stored** on the manifest, or computed from source documents? | The employer lists cost categories to be "considered" on the manifest (REQ-191); legacy stores five cost columns on the manifest. | Not settled. |
| **RPT-02** | Reports | Is income measured gross or net of VAT? | "Sum of the Invoice amounts". The employer's Invoice block separates Subtotal / VAT / Total. | Which of the three feeds the P&L income figure is unspecified. |
| **SAL-01** | Salary | Does paying salary post to any ledger or voucher? | Not stated; nothing in the transcripts implies it. | See REQ-172 (inferred). |
| **SAL-02** | Salary | What are the salary components (basic, allowance, overtime, deductions)? | Not stated beyond "Salary Slip". | Full payroll schema would be invention. |
| **ARCH-01** | Archive | What is the "Company Archive" (EMP-713)? | Title only. | Zero detail. Do not design it from the title. |
| **SRC-01** | Sources | Where is the full transcript set? | `docs/current-plan/00-project-authority.md` names `/home/duna/dunaData/transcripts/` as the highest authority. **That path does not exist in this repository.** Only the 20 files under `docs/duna-analysis/requirements/` are available. | There may be employer statements that are simply not represented anywhere in this knowledge base. |
| **SRC-02** | Sources | Where are the company's own document templates? | The employer promises them six times (REQ-125). Not supplied. | Any template design would be invented. |
| **SRC-03** | Sources | One PDF (the Receipt Voucher) is a **scan**, not a digital document. | Its content was recovered by OCR in this analysis with high confidence (see `../02-business-documents/receipt-vouchers.md`). | OCR-derived figures should be treated as near-certain but not as a signed source. |

---

## 2. Coverage of the pre-existing questionnaire (Q01–Q160)

The questionnaire lives at
`docs/duna-analysis/existing-analysis/duna_client_discovery_questions_v2.md` (Persian, 28 sections).
Below, each section is assessed against the evidence now available. "Answered" means a future agent
can act on it without further input; "Partial" means the direction is known but a value/threshold/
format is missing; "Open" means nothing in the repository addresses it.

| # | Section (translated) | Q range | Disposition | Where the evidence is |
|---|---|---|---|---|
| 1 | Overall business structure & how a job starts | Q01–Q04 | **Answered** | EMP-001 – EMP-005; REQ-060, REQ-130 |
| 2 | Customer and relationship to other parties | Q05–Q10 | **Answered** (Q09 status, Q10 credit → Partial) | REQ-018 – REQ-020; CUST-02 |
| 3 | Cargo & cargo information | Q11–Q16 | **Partial** | REQ-061 – REQ-064, REQ-071; CRG-01, CRG-03 |
| 4 | Cargo route & storage location | Q17–Q21 | **Partial** (Q20 internal yard transfer → Open; Q21 dates → Answered) | REQ-030 – REQ-036, REQ-069, REQ-070 |
| 5 | Documents & document status | Q22–Q26 | **Partial** (Q24 validity date, Q25 multiple files, Q26 versions → Open) | REQ-063, REQ-064; CRG-01 |
| 6 | Inspection | Q27–Q31 | **Partial** (Q28 result values, Q29 evidence doc, Q30 multiple inspections → Open) | REQ-080 – REQ-083 |
| 7 | Loading List & loading | Q32–Q38 | **Partial** (Q34 multi-stage, Q37 operator real data, Q38 proof of loading → Open) | REQ-090 – REQ-094 |
| 8 | Vessel & Voyage | Q39–Q43 | **Partial** (Q43 voyage change → Open) | REQ-037 – REQ-041; VOY-01 |
| 9 | Bill of Lading | Q44–Q51 | **Partial** (Q47 post-final amendment, Q49 originals count, Q50 surrender/release, Q51 freight → Open/Partial) | REQ-100 – REQ-107; BL-01 |
| 10 | Manifest | Q52–Q58 | **Partial** (Q54 revised manifest, Q56 totals, Q57 ownership, Q58 co-loading → Partial) | REQ-110 – REQ-114 |
| 11 | Customer / Shipper / Consignee / Agent distinction | Q59–Q63 | **Answered** | REQ-018, REQ-050 – REQ-056 |
| 12 | Invoice & revenue | Q64–Q72 | **Partial** (Q71 credit terms, Q72 corrective invoice → Open) | REQ-140 – REQ-154; INV-01, INV-02 |
| 13 | Job & costs | Q73–Q79 | **Partial** (Q76 direct vs indirect, Q77 cost without job, Q78 timing, Q79 correction → Partial) | REQ-130 – REQ-135 |
| 14 | Ledger & accounting | Q80–Q87 | **Partial** (Q80 main account, Q82 general journal model, Q85 multi-currency, Q86 balance definition → Partial) | REQ-160 – REQ-167; FIN-01 |
| 15 | Payment & Receipt Voucher | Q88–Q96 | **Partial** (Q94 partial payment, Q95 advance, Q96 overpayment → Partial) | REQ-163 – REQ-165; FIN-02, FIN-03 |
| 16 | Release Order | Q97–Q101 | **Partial** (Q99 release approval, Q100 multiple releases, Q101 history → Open) | REQ-180 – REQ-184; RLS-01, RLS-02 |
| 17 | Agent portal / agent access | Q102–Q106 | **Partial** (Q105 agent operations, Q106 several agents per port → Open) | REQ-187, REQ-188; AGT-01, AGT-02 |
| 18 | Delivery Order | Q107–Q110 | **Partial** (Q108 eligibility, Q109 relation to release, Q110 delivery confirmation → Open) | REQ-185, REQ-186; DO-01 |
| 19 | Proforma & Quotation | Q111–Q115 | **Partial** (Q112 PI↔customer/job, Q113 validity, Q115 revised versions → Open) | REQ-152, REQ-153; real PDFs `DSPRO/26-001`, `DSQUO/25-017` |
| 20 | Reporting | Q116–Q123 | **Partial** (Q122 cost allocation, Q123 tax report → Partial) | REQ-190 – REQ-195; RPT-01, RPT-02 |
| 21 | Alerts & follow-up | Q124–Q128 | **Open** (only two alerts are stated at all: overdue invoice, unpaid release) | REQ-154, REQ-184; FIN-04, RLS-01 |
| 22 | Archive | Q129–Q133 | **Open** | ARCH-01 |
| 23 | Letters & correspondence | Q134–Q137 | **Open** | No transcript mentions letters. (The current system has a Letters module — see `../05-current-project/`.) |
| 24 | Users, roles & security | Q138–Q141 | **Partial** (Q138/Q139 real roles and their access → Open; Q140/Q141 activity log & change history → Open) | Only "Access Control" as a sidebar section is stated (REQ-001). |
| 25 | Outputs & templates | Q142–Q147 | **Partial** (Q143 existing templates, Q147 copy count → Open) | REQ-120 – REQ-125; SRC-02 |
| 26 | Salary | Q148–Q152 | **Partial** (Q149 components, Q152 correction → Open) | REQ-169 – REQ-171; SAL-01, SAL-02 |
| 27 | Special & exceptional cases | Q153–Q159 | **Open** (cancellation, re-open, returned goods, destination change, vessel change, partial loading, lost/damaged) | Only "partial loading → return to yard" is covered (REQ-093). |
| 28 | Most important final request | Q160 | **Open** | By definition — it asks for what was *not* said. |

---

## 3. Standing rules for future agents

1. **Never promote an INFERRED row to a business rule.** Record it as inferred.
2. **Never silently pick a side in a CONTRADICTED row.** Surface it here and, if a decision is
   unavoidable, mark the implementation as provisional.
3. **Two items in this register are safety-critical because intuition points the wrong way:**
   - `REQ-122` — print must *strip* stamps (it feels like a bug; it is a requirement).
   - `REQ-165` — unallocated payment must *not* error (it feels like missing validation; it is a
     requirement).
4. **If the employer answers any item in §1**, update this file, then update the corresponding
   `REQ-*` row's classification, then update
   [`../07-traceability/requirements-traceability.md`](../07-traceability/requirements-traceability.md).
   Do not edit only one of the three.
