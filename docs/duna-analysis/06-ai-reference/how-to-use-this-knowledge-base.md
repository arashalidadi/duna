# How to Use This Knowledge Base

> Phase 10. Instructions for a future AI model (or human) working on the Duna dashboard.
>
> **Read this before you write a line of code.** It will save you from re-deriving the business and
> from repeating the three mistakes that prior analyses made.

---

## 1. The 60-second orientation

**Duna Shipping LLC** moves heavy machinery by barge and tug from UAE ports (Hamriyah, Jebel Ali) to
Iranian and Gulf destinations (Khorramshahr, Bushehr, Bandar Abbas). It runs **two businesses**:
freight forwarding, and buying machinery and reselling it.

The operational spine:

```
Customer → Job → Cargo → Yard → Inspection → Load List → Vessel/Voyage
        → B/L → Manifest → Invoice → Ledger → Payment → Release (via Agent)
```

**B/L first, Manifest second.** The Manifest consolidates issued B/Ls.

The money rule:

```
Invoice → Debit ·  Receipt → Credit ·  Payment → Debit ·  Balance = Debit − Credit
```

---

## 2. Where to start, by task

| Task | Read first | Then |
|---|---|---|
| **Add a feature** | `01-employer-statements/requirements-catalog.md` (find the REQ) | `07-traceability/requirements-traceability.md` (is it met?) → `05-current-project/implemented-capabilities.md` |
| **Fix a money bug** | `02-business-documents/invoices.md` (correct arithmetic) | `03-legacy-laravel-system/calculations.md` (what the old system got wrong) |
| **Build a document output** | `02-business-documents/document-catalog.md` (the 7 real specimens) | `07-traceability/requirements-traceability.md` REQ-120–REQ-125 |
| **Work on B/L or Manifest** | `05-current-project/legacy-vs-current-comparison.md` §3.1 | ADR-045, ADR-046, ADR-047 in `docs/decisions.md` |
| **Work on the agent portal** | `04-business-analysis/customer-relationship-hypotheses.md` | `REQ-187`, `REQ-188`; ADR-040 |
| **Answer "why is it like this?"** | `04-business-analysis/consolidated-business-model.md` | `03-legacy-laravel-system/` for the history |
| **Resolve a conflict** | `04-business-analysis/contradictions-register.md` | Escalate to the employer — do not pick a side |
| **Understand a Persian term** | `01-employer-statements/terminology-glossary.md` | — |

---

## 3. The seven rules

### Rule 1 — Legacy is evidence, not specification
The old Laravel system tells you **what the company used to do**. It does **not** tell you what it
should do now.

- ❌ Do not plan to replace the current dashboard with the legacy one.
- ❌ Do not delete a current feature merely because the old system lacked it.
- ✅ Do use it when the employer is silent and you need to know what was normal.

### Rule 2 — Never invent a business rule
If the employer did not say it, it is not a rule. Record it as a question.

Check `01-employer-statements/open-questions.md` first — if the question is already there, do not
answer it yourself.

### Rule 3 — Never silently resolve a contradiction
22 are catalogued in `04-business-analysis/contradictions-register.md`. Each has a *provisional*
reading, clearly labelled. Use the provisional reading if you must ship something, and mark it
provisional in code and in the UI.

### Rule 4 — Respect the classification of every requirement
Every `REQ-*` row carries one of: **EXPLICIT** · **INFERRED** · **UNRESOLVED** · **CONTRADICTED**.

- Only **EXPLICIT** may become a hard business rule.
- **INFERRED** may become a default, documented as such.
- **UNRESOLVED** must stay open.
- **CONTRADICTED** must be escalated.

### Rule 5 — Verify prior analyses
`existing-analysis/` and `docs-legacy/` are prior AI output. Three recurring error patterns were
found in them:

1. Assuming the legacy system implements what it merely **declares**. (`RELEASED` is a constant that
   is never written. "PDF-ready" means browser print. "Sequential" invoice codes are random.)
2. Reporting "missing" for "not modelled the way I would model it." (The ledger **exists**.)
3. Stating the employer's desired flow as if it were the legacy flow. (B/L-before-Manifest.)

### Rule 6 — Preserve the employer's original sequence
`01-employer-statements/employer-original-statements.en.md` keeps his statements **in the order he
said them**, including repetitions, self-corrections and contradictions. Do not regroup it by topic —
the sequence is evidence.

### Rule 7 — Documentation only, unless told otherwise
This knowledge base was built under an explicit instruction: **do not modify application source
code, UI, routing, API, DB, config/env files, or add dependencies.** That instruction governed its
construction. If you are asked to change the system, work in the application repo and follow
`docs/current-plan/10-phase-execution-protocol.md`.

---

## 4. The three mistakes to avoid

| Mistake | Why it happens | How to avoid it |
|---|---|---|
| **Porting a legacy defect** | The legacy code looks authoritative — it is real, running code | Check `03-legacy-laravel-system/system-overview.md` §7 (D1–D14) before reusing any legacy logic |
| **Trusting a prior analysis** | It is fluent and well-formatted | Check `04-business-analysis/prior-analysis-review.md` for its verified verdict |
| **Normalising the source documents** | Typos look like extraction errors | `LAODING`, `SHIFITNG`, `KHORAMSHHAHR`, `700,00.00`, and the manifest footer `VESSEL = DUNA SHIPPING LLC` are **real artefacts**. Record them; do not silently fix them |

---

## 5. Two requirements that feel like bugs

| Requirement | What it says | Why your intuition is wrong |
|---|---|---|
| `REQ-122` | **Print must strip** stamps, marks and signature | You will want to "fix" the missing stamp on print. Don't. The PDF carries the stamp; the printed page is stamped by hand afterwards |
| `REQ-165` | **An unallocated payment must NOT raise an error** | You will want to add validation requiring an invoice. Don't. Advances and deposits post to the ledger with no invoice |

---

## 6. Searching this knowledge base

| Looking for | Grep for |
|---|---|
| A requirement | `REQ-142` |
| What the employer said | `EMP-` |
| A legacy defect | `D4`, or "defect" |
| A contradiction | `C-08`, or "CONTRADICTED" |
| A contradicted requirement | `| CONTRADICTED |` |
| A Persian term | the Persian word, or `terminology-glossary.md` |
| Everything about invoices | `invoice` (case-insensitive) across `02-business-documents/` |
| What is unknown | `open-questions.md` |

**Every requirement ID is stable and citable.** If you refer to a requirement, use its ID.

---

## 7. What is NOT in here

Be honest about the limits when you report:

| Not covered | Why |
|---|---|
| The complete transcript set | `/home/duna/dunaData/transcripts/` is absent (**SRC-01**) |
| Legacy runtime behaviour | The archive has no `/vendor` and no DB dump; analysis was static |
| A line-by-line read of all current application code | 62 models, 33 modules, 35 pages — surveyed via schema, ADRs and state docs |
| Salary process detail | The employer mentioned it and moved on |
| Letters process detail | Almost no employer input |
| Company Archive | One passing mention |
| The employer's own document templates | Only 7 rendered PDFs exist (**SRC-07**) |
| Answers to Q01–Q160 | Unanswered; ~65 of 160 have no answer anywhere |

---

## 8. If you learn something new

Update in this order — **all four, not one**:

1. `01-employer-statements/requirements-catalog.md` — the authoritative `REQ` row and its
   classification.
2. `01-employer-statements/open-questions.md` — close the question, or add a new one.
3. `07-traceability/requirements-traceability.md` — the Documents / Legacy / Current columns.
4. `04-business-analysis/contradictions-register.md` — resolve or create the contradiction.

Then, if the change affects the business model, also update
`04-business-analysis/consolidated-business-model.md`.

See [`documentation-maintenance-plan.md`](documentation-maintenance-plan.md).

---

## 9. Quick reference card

```
Company        Duna Shipping LLC · Al Nokhitha Bldg, Hamriya Port, Dubai, UAE
TRN            100353243700003
Currency       AED
Base ports     Hamriyah, Jebel Ali (load) → Khorramshahr, Bushehr, Bandar Abbas (discharge)
Vessels        Barge + Tug (e.g. "BARGE MEHDI 11 / TUG LAYAN GULF") or Landing Craft
Voyage         nn/yy, per vessel + destination + year
B/L            <DEST>/<yy>-<seq3>   e.g. KHS/26-110
Manifest       DSMAN/<DEST>-<yy>-<seq3>   e.g. DSMAN/KHO-26-006
Invoice        DSINV/<yy>-<seq3>    e.g. DSINV/26-172
Proforma       DSPRO/<yy>-<seq3>    e.g. DSPRO/26-001
Quotation      DSQUO/<yy>-<seq3>    e.g. DSQUO/25-017
Receipt        plain sequential number        e.g. 477      (CORRECTED — was DSR/<yy>-<seq3>, fabricated)
Balance        Debit − Credit
Invoice maths  lineAmount = unit×qty × (1 + vat%) · Sub Total = Σ lineAmount · Total = Sub Total
Release        "no money, no cargo" — B/L releases only when its invoices are fully paid
Parties        Customer ≠ Shipper ≠ Consignee ≠ Agent ≠ User
Order          B/L first, Manifest consolidates issued B/Ls
```
