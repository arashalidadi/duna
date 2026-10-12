# Documentation index

**Added 2026-10-11** (consolidation action **D4**). This file is a pointer only — it adds no new content and
supersedes nothing.

Verified counts at the time of writing: **32 API modules · 52 Prisma models · 32 enums · 35 web pages ·
161 seeded permission codes across 34 modules · 22 e2e suites (not executed)**.

---

## 1 · Start here, depending on what you need

| If you want… | Read |
| --- | --- |
| **The plan** | [`duna-analysis/09-audit/initial-roadmap.md`](duna-analysis/09-audit/initial-roadmap.md) — phases P0–P12. **This is the only roadmap that is followed.** |
| **What the system does today** | [`duna-analysis/09-audit/implementation-gap-analysis.md`](duna-analysis/09-audit/implementation-gap-analysis.md) |
| **What the business requires** | [`duna-analysis/01-employer-statements/requirements-catalog.md`](duna-analysis/01-employer-statements/requirements-catalog.md) (REQ-nnn) |
| **What has been decided** | [`decisions.md`](decisions.md) (ADR-001–047) **and** [`duna-analysis/09-audit/confirmed-decisions.md`](duna-analysis/09-audit/confirmed-decisions.md) (DEC-001–114) |
| **What is still open** | [`duna-analysis/09-audit/open-questions.md`](duna-analysis/09-audit/open-questions.md) |
| **Phase 1 status** | [`duna-analysis/09-audit/phase-1-audit-2026-10-12.md`](duna-analysis/09-audit/phase-1-audit-2026-10-12.md) — 🔶 PARTIALLY COMPLETE (docs done, seed work not started) |
| **Incidents** | [`duna-analysis/09-audit/INCIDENT-2026-10-12-isprimaryadmin.md`](duna-analysis/09-audit/INCIDENT-2026-10-12-isprimaryadmin.md) — missing `User.isPrimaryAdmin` column |
| **Structure and request/response conventions** | [`architecture.md`](architecture.md), [`api.md`](api.md) |
| **Data model** | [`database-schema.md`](database-schema.md) |
| **Access control** | [`permissions.md`](permissions.md) |

---

## 2 · The four layers

The documentation is deliberately split into an **authoritative** layer and an **evidence** layer. Evidence is
never deleted; it is *labelled*, so a reader knows whether to follow it.

| Layer | Location | How to treat it |
| --- | --- | --- |
| **Requirements** (authoritative) | `duna-analysis/01-employer-statements/`, `duna-analysis/07-traceability/` | Primary business reference. Do not edit the verbatim statements. |
| **Audit & target design** (authoritative) | `duna-analysis/09-audit/` | Current-state assessment, confirmed decisions, target specification, roadmap. |
| **Implementation reference** (authoritative for code) | `architecture.md`, `database-schema.md`, `permissions.md`, `workflows.md`, `api.md`, `decisions.md` | Corrected 2026-10-11 against source. Verify any count or enum against `prisma/schema.prisma` or `apps/api/src`. |
| **Historical evidence** (do not follow) | `current-plan/`, `ai-audit/`, `duna-analysis/03-legacy-laravel-system/`, `ops/`, `ui/` | Explains *why* things look the way they do. Superseded documents carry a 🗄️ HISTORICAL banner. |

---

## 3 · Superseded — do not use for planning

| Document | Why superseded |
| --- | --- |
| [`current-plan/09-final-implementation-roadmap.md`](current-plan/09-final-implementation-roadmap.md) | 🗄️ HISTORICAL. Lists four items as open that are now implemented. Predates the confirmed decisions. |
| [`ai-audit/07-final-implementation-roadmap.md`](ai-audit/07-final-implementation-roadmap.md) | 🗄️ HISTORICAL. A 9-phase roadmap from an earlier audit round. |
| [`duna-analysis/09-audit/audit-findings.md`](duna-analysis/09-audit/audit-findings.md) | Superseded **in part**. Retained as the original evidence record; 18 findings carry inline dated status updates. |

---

## 4 · Reading rules

1. **Trust evidence over summaries.** Earlier AI-generated documents (including anything under
   `ai-audit/` and older analysis notes) are indexes and interpretations, not authority. Where a conflict
   exists, the conflict is **recorded**, not silently resolved.
2. **Legacy behaviour is not the specification.** `duna-analysis/03-legacy-laravel-system/` documents what the
   old system *did*. Where it conflicts with an explicit employer requirement, report the conflict.
3. **Numbers and enum values must be verified against source.** Several counts in older documents were wrong
   (a permission count of 49 against an actual 160; `CargoStatus.READY` against an actual
   `READY_FOR_LOADING`). Prefer pointing at the schema over restating it.
4. **The suite has not been executed in the audit environment.** Any "tests green" figure is **unverified**
   until Phase 0 measures it. Do not claim tests pass without running them.
5. 🔴 **Security incident R-01 — credentials already published.** The archive
   `duna-analysis/legacy-source/duna-clean.zip` contains a **live production `.env`**, and it is **already
   committed, pushed, and the repository is public**. The credentials must be treated as compromised; see
   [`duna-analysis/09-audit/SECURITY-INCIDENT-R01.md`](duna-analysis/09-audit/SECURITY-INCIDENT-R01.md).
   Separately, and notwithstanding that, **never run `git add -A`, `git add .` or `git add docs/`** — use
   explicit paths, per [`duna-analysis/09-audit/README.md`](duna-analysis/09-audit/README.md) §7.1.

---

## 5 · Known defects in the documentation set

Recorded so they are not re-discovered. Full detail in
[`duna-analysis/09-audit/README.md`](duna-analysis/09-audit/README.md) §5.

| ID | Defect | Status |
| --- | --- | --- |
| **E1** | A fabricated receipt-voucher number `DSR/26-190` propagated through 9 files. The real voucher is **No. 477**. | **Corrected 2026-10-11** in all 9 files; correction noted in place. |
| **E2** | "62 models / 25 enums" | Actual **52 / 32** |
| **E3** | "33 API modules" | Actual **32** |
| **E4** | "105 permissions / 12 resources"; later "160 codes / 35 modules" | At correction time: **160 codes / 33 modules** (the "35" conflated 35 web pages with permission modules). **Current: 161 codes / 34 modules** — `audit:read` was added 2026-10-12 |
| **E5** | Contradiction C-17 framed as a source conflict | Re-framed as a legacy defect; finding unchanged |
| **E6** | `¶n` paragraph-index drift (720 paragraphs vs 725 cited) | Content complete; labels inconsistent |
| **E7** | Self-reported "46 files, ~16,000 lines" | Actual **45 files / 11,536 lines** |
| **E8** | "Phase 1" is ambiguous: `ai-audit/00-audit-state.md` marks Phase 1 ✅ COMPLETE, but that is the **superseded 9-phase** roadmap ("safety & infrastructure"). The authoritative roadmap's Phase 1 ("documentation truth, seed safety") is 🔶 **PARTIALLY COMPLETE**. | Recorded 2026-10-12 in [`phase-1-audit-2026-10-12.md`](duna-analysis/09-audit/phase-1-audit-2026-10-12.md) §1. The old record was **not** edited — corrections are additive. |
| **E9** | `ai-audit/phase-1-implementation-log.md` records 28 unit tests (`numbering` 9, `audit` 9, `attachment` 10). Those files **do not exist and were never committed** on any branch. | Recorded 2026-10-12, same file §7. The infrastructure modules themselves **do** exist and are registered. |
