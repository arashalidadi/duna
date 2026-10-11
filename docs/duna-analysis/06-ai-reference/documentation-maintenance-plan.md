# Documentation Maintenance Plan

> Phase 11. How this knowledge base stays true after the person who built it is gone.

---

## 1. Principle

**A knowledge base that is not maintained becomes a liability faster than no knowledge base at all,**
because it is trusted. The single biggest risk to this one is that the employer answers a question and
nobody updates the four places it is recorded.

---

## 2. The four-place rule

Every fact in this knowledge base lives in **one** authoritative place and is **referenced** from up
to three others. When something changes, update them in this order:

| # | File | What is authoritative here |
|---|---|---|
| 1 | `01-employer-statements/requirements-catalog.md` | The `REQ-*` row: requirement text, classification, `EMP-*` evidence |
| 2 | `01-employer-statements/open-questions.md` | Whether a question is open or closed |
| 3 | `07-traceability/requirements-traceability.md` | The Documents / Legacy / Current columns |
| 4 | `04-business-analysis/contradictions-register.md` | Whether a contradiction is created or resolved |

**Do not edit only one of the four.**

If the change also alters the shape of the business, update:

| 5 | `04-business-analysis/consolidated-business-model.md` | The narrative model |
| 6 | `01-employer-statements/business-rules.md` | The derived rules (`R*.*`) |

---

## 3. Triggers

| Trigger | Action |
|---|---|
| **The employer answers a question** | Close it in `open-questions.md`; update the `REQ` classification (UNRESOLVED → EXPLICIT); update the traceability row; resolve the contradiction if any |
| **The employer contradicts himself** | Add a `C-nn` row. Do **not** pick a side |
| **A new real document arrives** | Add it to `02-business-documents/document-catalog.md`; re-check every format claim in `contradictions-register.md` |
| **A phase of the current project closes** | Update the Current column in `07-traceability/requirements-traceability.md` and `05-current-project/implemented-capabilities.md` |
| **A new ADR is added** | If it decides a business question, close the corresponding NBD in `05-current-project/current-gaps-and-roadmap.md` §3 |
| **The legacy archive is re-analysed** | Update `03-legacy-laravel-system/`; never delete the defect list — supersede it |
| **A defect is found in the legacy analysis** | Append to the defect list as D15, D16… Never renumber D1–D14 |
| **`/home/duna/dunaData/` becomes available** | **Highest priority.** Re-read the full transcript set, then audit every `EMP-*`-backed claim. Close **SRC-01** |
| **A requirement is dropped** | Mark its `REQ` row `SUPERSEDED`; do **not** delete the row or renumber |

---

## 4. Stability guarantees

| Guarantee | Rule |
|---|---|
| **`REQ-*` IDs are stable forever** | Never renumber. Mark `SUPERSEDED` instead of deleting |
| **`EMP-*` IDs are stable forever** | The statement file preserves original sequence; do not re-order or regroup |
| **Defect IDs are append-only** | D1–D14 exist; new ones are D15+ |
| **Contradiction IDs are append-only** | C-01…C-22 exist; new ones are C-23+ |
| **IDs are never reused** | If an entry is wrong, correct it in place and note the correction |

**Why this matters:** other documents, code comments and ADRs cite these IDs. Renumbering silently
breaks every citation.

---

## 5. Review cadence

| Frequency | Activity | Owner |
|---|---|---|
| **Per project phase** | Update the Current column in the traceability matrix | Whoever closes the phase |
| **Per employer conversation** | Update open questions, requirements, contradictions | Whoever spoke to him |
| **Quarterly** | Re-read `README.md` §7 (known limits) and check whether any limit has been lifted | Project lead |
| **On any contradiction resolution** | Update all four places | Whoever resolved it |
| **Annually** | Full completeness re-audit against [`completeness-audit.md`](completeness-audit.md) | Project lead |

---

## 6. Anti-patterns

| Anti-pattern | Why it is wrong |
|---|---|
| Editing only the traceability matrix | The requirement row still says UNRESOLVED, and someone will re-ask the question |
| Deleting a resolved question | The fact that it was ever open is evidence; mark it resolved with a date |
| Regrouping the employer's statements by topic | Destroys the sequence, which is itself evidence (corrections and repetitions are meaningful) |
| "Fixing" typos in the source documents | `LAODING`, `SHIFITNG`, `KHORAMSHHAHR` are real artefacts. Record them, don't normalise them |
| Promoting an INFERRED row without noting it | The classification column exists precisely to prevent this |
| Rewriting the legacy system's history to match the new system | The legacy analysis is historical evidence. Supersede, never rewrite |
| Deleting a source because it is "superseded" | See [`source-retention-plan.md`](source-retention-plan.md) — nothing is deleted without approval |

---

## 7. Ownership and review

| Artefact | Owner |
|---|---|
| `01-employer-statements/` | Whoever holds the employer relationship |
| `02-business-documents/` | Whoever receives company documents |
| `03-legacy-laravel-system/` | Historical — changes only if the archive is re-analysed |
| `04-business-analysis/` | Project lead |
| `05-current-project/` | Whoever closes project phases |
| `06-ai-reference/` | Project lead |
| `07-traceability/` | Project lead |

**Single rule that covers everything:** if you change a fact, change it everywhere it is recorded, in
the order in §2.
