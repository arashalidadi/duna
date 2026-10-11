# Repository Documentation Map

> Where to find things in **this repository**, outside `docs/duna-analysis/`.
>
> Everything listed here is authoritative for the **current** system. Everything under
> `docs/duna-analysis/` is the business knowledge base.

---

## 1. `docs/` — the project's own documentation

| File | Size | What it is | Use it for |
|---|---|---|---|
| `decisions.md` | 86 KB | **47 ADRs** (ADR-001 … ADR-047) | **The single most valuable file.** Every architectural and business-rule decision, with context, decision and consequences |
| `progress.md` | 91 KB | Phase-by-phase build log | Historical build narrative, test-count history |
| `architecture.md` | — | Current architecture | Stack, layers, module layout |
| `database-schema.md` | — | Current schema narrative | Complements `prisma/schema.prisma` |
| `permissions.md` | — | 105 permissions, 12 resources | Permission names and role mapping |
| `workflows.md` | — | Current workflows | Step-by-step current behaviour |
| `api.md` | — | API surface | Endpoint inventory |
| `business-requirements.md` | 3.9 KB | Requirements | ⚠️ **Thin** — superseded by `01-employer-statements/requirements-catalog.md` |
| `design-system.md` | — | UI conventions | Colours, components, layout |
| `CLAUDE.md` (root) | — | Agent instructions | Repo conventions |
| `README.md` (root) | — | Getting started | Setup commands |

### 1.1 `docs/decisions.md` — ADR index

| Range | Topic |
|---|---|
| 001–013 | Monorepo, stack, Prisma, IDs, config, API envelope, numbering, templates, audit, packages, Docker |
| 014–018 | Auth, roles, permissions registry, query typing, master-data `PATCH /:id/active` |
| 019–025 | Cargo lifecycle, yard inventory, cargo deletion, `CargoType`, decimal-as-string, **inspection ledger**, duplicate-inspection guard |
| 026–028 | Voyage state machine, vessel scheduling, Actual Loading |
| 029–030 | Manifest lifecycle, B/L issued against APPROVED manifest |
| 031–039 | Invoice lines, **vouchers + derived ledger**, delivery/release orders, proforma, quotation, salaries, letters, job costing, discharge |
| 040–044 | Agent portal scoping, LoadList 3-state, ActualLoading materialization, two business rulings, **cargo comments** |
| 045–047 | **B/L rewrite**, three Phase-4 rulings, **Manifest rewrite** |

---

## 2. `docs/current-plan/` — Generation 3 (the current plan)

| File | Lines | What it is |
|---|---|---|
| `00-project-authority.md` | 102 | **Source-of-truth rules.** Three generations ranked; conflict rules; interpretation rules |
| `01-final-requirements.md` | 317 | Consolidated requirements |
| `02-target-system-blueprint.md` | 340 | Target architecture |
| `03-final-workflows.md` | 158 | Target workflows |
| `04-final-data-model.md` | 214 | Target data model |
| `05-final-api-blueprint.md` | 208 | Target API |
| `06-final-ui-blueprint.md` | 207 | Target UI |
| `07-document-and-reporting-blueprint.md` | 110 | Documents & reports |
| `08-requirement-traceability.md` | 903 | **Requirement traceability** — the project's own traceability matrix |
| `09-final-implementation-roadmap.md` | 473 | **Phases 2–9**, with scope, acceptance and tests per phase |
| `10-phase-execution-protocol.md` | 93 | How to execute a phase/unit |
| `11-implementation-state.md` | 180 | **Current live state** — phase, unit, test counts, defect record |
| `12-open-business-decisions.md` | 109 | **12 open business decisions** |
| `party-cutover-plan.md`, `party-cutover-evidence-pack.md` | 529 | The Shipper/Consignee/Agent cutover |
| `implementation-log/` | — | Per-unit execution logs (dated `2026-09-*` … `2026-10-06-*`) |

**Read these three first:** `00-project-authority.md`, `11-implementation-state.md`,
`12-open-business-decisions.md`.

---

## 3. `docs/ai-audit/` — Generation 2 (previous expert audit)

| File | Lines | Value |
|---|---|---|
| `01-employer-requirements-analysis.md` | 234 | Earlier requirements analysis |
| `02-business-document-evidence.md` | 558 | Earlier document analysis |
| `03-current-project-analysis.md` | 353 | Earlier current-system analysis |
| `04-requirement-traceability.md` | 736 | Earlier traceability |
| `05-existing-project-work-and-prior-plans-audit.md` | 898 | Audit of prior plans |
| `06-final-gap-analysis.md` | 389 | Earlier gap analysis |
| `06.5-technical-decision-lock.md` | 600 | Locked technical decisions |
| `07-final-implementation-roadmap.md` | 667 | Earlier roadmap |
| `migration-safety.md`, `migration-safety-report.md` | 692 | Migration safety |
| `phase-1/2-implementation-log.md` | 239 | Build logs |
| `00-audit-state.md` | 97 | Audit state |

**Status per `00-project-authority.md`:** valuable, but **re-audited** against raw employer evidence
and current code. Where correct, preserved; where inconsistent, corrected by `docs/current-plan/`.

---

## 4. `docs/ops/`, `docs/ui/`

| File | What it is |
|---|---|
| `ops/local-dev-runtime.md` | How to run the stack locally |
| `ops/backend-connection-audit.md`, `ops/api-port-correction.md` | API connectivity |
| `ops/admin-login-verification.md` | Login verification |
| `ops/publication-handoff.md`, `ops/https-dashboard.3ree.eu.cc.md` | Deployment |
| `ui/dashboard-redesign.md` | UI redesign notes |

---

## 5. `docs/duna-analysis/` — this knowledge base

| Directory | Phase | Contents |
|---|---|---|
| `01-employer-statements/` | 2, 3 | Verbatim English statements, requirements catalogue, business rules, processes, glossary, open questions |
| `02-business-documents/` | 4 | The 7 real PDFs, field by field, plus cross-document synthesis |
| `03-legacy-laravel-system/` | 5 | The legacy Laravel system: 11 files, D1–D14 defects |
| `04-business-analysis/` | 6 | Prior-analysis review, consolidated business model, ER model, contradictions register, capability gaps |
| `05-current-project/` | 8 | Current system: overview, capabilities, **legacy vs current**, gaps & roadmap, this map |
| `06-ai-reference/` | 10 | How a future AI should use this knowledge base |
| `07-traceability/` | 1, 7 | Source inventory, ID crosswalks, coverage matrices |
| `08-original-sources/` | — | (reserved — see Phase 12 retention plan) |
| `requirements/` | — | The 20 Persian transcripts (originals) |
| `documents/` | — | The 7 PDFs (originals) |
| `existing-analysis/` | — | The 3 prior AI analyses (originals) |
| `legacy-source/` | — | `duna-clean.zip` + `docs-legacy/` (originals) |
| `docs-summary.md` | — | 55.8 KB summary shipped with the source pack |

---

## 6. Which document wins?

`docs/current-plan/00-project-authority.md` gives the rules. Extended with this knowledge base:

```
1.  Raw employer evidence                          (docs/duna-analysis/requirements/*.txt)
2.  The consolidated English statements            (01-employer-statements/employer-original-statements.en.md)
3.  Real company documents                         (02-business-documents/)
4.  Current implementation reality                 (the code, prisma/schema.prisma)
5.  Current plan                                   (docs/current-plan/)
6.  Locked technical decisions                     (docs/decisions.md ADRs)
7.  Current project docs                           (docs/*.md)
8.  Previous audit                                 (docs/ai-audit/)
9.  Legacy system behaviour                        (03-legacy-laravel-system/)   ← evidence, not spec
10. Prior AI analyses                              (existing-analysis/, docs-legacy/)  ← verify first
```

**Note the position of 9 and 10.** The legacy system and the prior analyses are the *weakest*
sources. They are included because they are the only evidence for some questions — but they must
always be verified.
