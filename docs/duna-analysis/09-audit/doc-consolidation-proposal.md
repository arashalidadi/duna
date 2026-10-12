# Documentation consolidation proposal

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

**Status:** ACTIONS D1–D6 APPLIED 2026-10-11. **Nothing has been deleted or moved.**

Under the instruction authorising safe, reversible corrections to analysis and requirements documentation,
**D1–D6 have now been applied** (see §5 for the disposition of each). Two earlier corrections had already been
made in place: **C-07 withdrawn** in `04-business-analysis/contradictions-register.md` (fabricated
`DSR/26-190` → real voucher **No. 477**), and the register's summary table adjusted.

**No file was deleted.** Every correction is either additive or an in-place replacement that retains the
original text or a dated note explaining the change. **D7–D9 (deletions) remain recommended against** and were
not executed.

Originally written 2026-10-10 under objective 7 of the audit brief.

---

## 1. The problem in one paragraph

The repository has **155 documentation files totalling 21 MB** spread across six areas, and at least four of the
top-level documents describe a system that no longer exists. A reader who trusts `docs/architecture.md` will
believe Bills of Lading and Manifests are unbuilt; a reader who trusts `docs/permissions.md` will under-count the
permission surface by 111 codes. Meanwhile three separate "final" roadmaps exist
(`docs/current-plan/09`, `docs/ai-audit/07`, and now `09-audit/initial-roadmap.md`), all claiming to be the plan.
The cost is not tidiness — it is that planning decisions get made against a false picture of the system.

---

## 2. File census

Verified 2026-10-10 with `find docs -type f`.

| Area | Files | Notes |
| --- | --- | --- |
| `docs/*.md` (top level) | 8 | architecture, business-requirements, database-schema, decisions (86 KB), permissions, progress (91 KB), workflows, api |
| `docs/duna-analysis/` | 82 | the knowledge base: 45 markdown files (11,536 lines), 7 PDFs, a 16.9 MB ZIP, 20 Persian transcripts |
| `docs/current-plan/` | 38 | 13 planning docs + 30 in `implementation-log/` + evidence packs |
| `docs/ai-audit/` | 14 | a complete earlier audit round (stages 0–7) including its own roadmap |
| `docs/ops/` | 6 | operational runbooks (login verification, API port, backend audit, HTTPS, local dev, handoff) |
| `docs/ui/` | 2 | dashboard redesign, PR test notes |
| **Total** | **155 files / 21 MB** | |

---

## 3. Classification of what exists

Four categories: **authoritative** (the current truth), **needs update** (right role, wrong content),
**historical evidence** (keep, but do not follow), **redundant** (candidate for removal — **only with approval**).

### 3.1 Top-level documents

| Document | Verdict | Why |
| --- | --- | --- |
| `decisions.md` | **AUTHORITATIVE** | 47 ADRs (`ADR-001`–`ADR-047`). These are the real record of what was decided and why. Keep as the single decision log. |
| `business-requirements.md` | **AUTHORITATIVE** | High-level domain scope; still accurate at the level it operates. |
| `api.md` | **AUTHORITATIVE (conventions)** | Documents envelope, status codes and pagination conventions. **Caveat:** it does not enumerate endpoints, so it cannot go stale in the way the others did — verify conventions against `apps/api` before relying on it. |
| `architecture.md` | **NEEDS UPDATE** | Module status table marks Load Planning, Manifest, B/L, Jobs, Invoices, Release/Delivery/Discharge and Agent Portal as "Planned". All implemented. (AUD-020) |
| `database-schema.md` | **NEEDS UPDATE** | §"Planned major entities (later phases)" lists 18 entities as "not yet implemented". **12 exist under those exact names, 3 more under different names** (`JobLine`→`JobCostItem`, `InvoiceLine`→`InvoiceItem`, `Payment`→`Voucher`), and only 3 have no equivalent — one of which (`LedgerEntry`) is absent deliberately. (AUD-020) |
| `permissions.md` | **CORRECTED 2026-10-11 (D1)** | Stated "Seeded permissions (49)". Actual: **160 codes / 33 modules**. Heading corrected, the original table retained and relabelled as the Phase-2 subset, and the full 33-module list added. (AUD-020) |
| `workflows.md` | **NEEDS UPDATE** | Describes `CargoStatus.READY` (actual: `READY_FOR_LOADING`) and inspection `PENDING/APPROVED/REJECTED` (actual: `PENDING/BOOKED/DONE/FAILED/NEEDS_REINSPECTION`); says two endpoints are "not yet present". (AUD-020) |
| `progress.md` | **NEEDS UPDATE / candidate for retirement** | 91 KB of chronological progress notes whose counts are stale. Superseded by `current-plan/11-implementation-state.md` and by the implementation log. See §4.3. |

### 3.2 `docs/duna-analysis/` — the knowledge base (this folder's parent)

| Content | Verdict | Why |
| --- | --- | --- |
| `01-employer-statements/employer-original-statements.en.md` | **AUTHORITATIVE — irreplaceable** | The verbatim employer statements (EMP-001–EMP-725). Preserves original sequence, repetitions, corrections and contradictions. **Never edit content.** |
| `01-employer-statements/requirements-catalog.md` | **AUTHORITATIVE** | The REQ-nnn catalogue; every row traced to EMP-nnn. This is the primary business reference. |
| `01-employer-statements/employer-requirements-analysis.md` | **AUTHORITATIVE** | Derivation from statements to requirements. |
| `07-traceability/requirements-traceability.md` | **AUTHORITATIVE (with corrections)** | 127 REQ rows with current/legacy status. Needs the E1–E7 corrections. |
| `03-legacy-laravel-system/` | **HISTORICAL EVIDENCE** | The legacy system. Evidence of prior behaviour; **not the specification**. `source-code-reference.md` is the efficient entry point instead of re-grepping the archive. |
| `02-business-documents/` | **HISTORICAL EVIDENCE (primary source)** | The actual business documents. High value — re-verify findings against these rather than against summaries. |
| `04-business-analysis/` | **PARTIALLY CORRECTED (2026-10-11)** | `contradictions-register.md` now carries the withdrawn **C-07**, the re-framed **C-17**, the resolved **C-22** and an adjusted severity table. **Still outstanding:** the fabricated `DSR/26-190` in `capability-gap-analysis.md:76` and `consolidated-business-model.md:232` (E1), and the stale counts (E2–E4). |
| `05-current-project/` | **NEEDS UPDATE** | Describes the current system with stale model/enum/module/permission counts (E2–E4). Also carries the fabricated `DSR/26-190` at `system-overview.md:94` and `legacy-vs-current-comparison.md:125`. |
| `06-ai-reference/` | **NEEDS UPDATE** | Repeats the fabricated `DSR` string at `how-to-use-this-knowledge-base.md:183`; otherwise useful orientation. |
| `08-original-sources/` | **KEEP (pointer only)** | Points at sources outside the repo. Do not delete — the pointer is the record of what should exist. |
| `existing-analysis/duna_client_discovery_questions_v2.md` | **KEEP — irreplaceable** | Sole holder of the Q01–Q160 ID space. **Never delete.** |
| `legacy-source/`, `documents/`, PDFs, ZIP, transcripts | **KEEP — irreplaceable** | Original sources. **Note:** the legacy ZIP contains `duna/.env` with real credentials. Never expose its contents in documentation. |
| `FINAL-REPORT.md` | **NEEDS UPDATE** | Contains E1 (`DSR/26-190` at line 166), E2, E3, E7. Superseded as a summary by `09-audit/README.md` for anything code-related. |
| `03-legacy-laravel-system/reports-and-documents.md` | **NEEDS UPDATE** | Carries the fabricated `DSR/26-190` at line 38. |
| `07-traceability/source-inventory.md` | **NEEDS UPDATE** | Carries the fabricated `DSR/26-190` at lines 96 and 120. |

### 3.3 `docs/current-plan/`

| Content | Verdict | Why |
| --- | --- | --- |
| `00-project-authority.md` | **AUTHORITATIVE** | Declares `dunaData/` the highest authority. Directly relevant: it is why every conclusion is provisional. |
| `11-implementation-state.md` | **AUTHORITATIVE (with caveat)** | Closest thing to a current-state record. **Caveat:** its "403/403 tests green" figure is UNVERIFIED here — the suite could not be run. |
| `implementation-log/` (30 files) | **HISTORICAL EVIDENCE — high value** | A genuine dated record of what was done, unit by unit, with rationale. This is the most useful execution record in the repo. Keep intact. |
| `09-final-implementation-roadmap.md` | **HISTORICAL EVIDENCE** | Superseded. §2.2 and §2.3 list as open four things that are done (manifest-first ordering, B/L revision model, ManifestItem→B/L item reference, Customer-FK parties). Should be marked historical, not deleted. |
| `01-final-requirements.md`, `02-target-system-blueprint.md`, `03-final-workflows.md`, `04-final-data-model.md`, `05-final-api-blueprint.md`, `06-final-ui-blueprint.md`, `07-document-and-reporting-blueprint.md` | **HISTORICAL EVIDENCE** | The Phase-planning blueprints. Superseded in detail by ADRs and by shipped code, but valuable as statements of intent — particularly `07-document-and-reporting-blueprint.md` for Phases 7 and 8. |
| `08-requirement-traceability.md` | **HISTORICAL EVIDENCE** | Superseded by `duna-analysis/07-traceability/`. |
| `10-phase-execution-protocol.md` | **AUTHORITATIVE (process)** | How phases are executed. Still the working process. |
| `12-open-business-decisions.md` | **AUTHORITATIVE** | Open business decisions. Should be cross-referenced with `09-audit/open-questions.md`. |
| `party-cutover-*.md` (2 files) | **HISTORICAL EVIDENCE** | Record of the party cutover. |

### 3.4 `docs/ai-audit/`

| Content | Verdict | Why |
| --- | --- | --- |
| Whole folder (14 files) | **HISTORICAL EVIDENCE — a complete earlier audit round** | Stages 0–7 including its own gap analysis, decision lock and 9-phase roadmap. Its Phase 1 (NumberingSequence + AuditLog) is now partially built (AUD-013). Do not follow it; do not delete it — it explains *why* the current plan looks the way it does. |
| `07-final-implementation-roadmap.md` | **HISTORICAL EVIDENCE** | Superseded. Mark as such. |

### 3.5 `docs/ops/` and `docs/ui/`

| Content | Verdict | Why |
| --- | --- | --- |
| `ops/local-dev-runtime.md` | **AUTHORITATIVE (operational)** | Directly relevant to Phase 0 (making the system runnable). |
| `ops/admin-login-verification.md`, `api-port-correction.md`, `backend-connection-audit.md`, `https-dashboard.3ree.eu.cc.md`, `publication-handoff.md` | **HISTORICAL OPERATIONAL EVIDENCE** | Deployment and connection records. Keep — they explain the environment. Check for credentials before quoting. |
| `ui/dashboard-redesign.md`, `ui/pr-ai-test.md` | **HISTORICAL EVIDENCE** | UI notes; low ongoing relevance but harmless. |

---

## 4. Proposed minimal structure

The principle: **one authoritative layer, one evidence layer.** Nothing is deleted; things are *labelled*.

### 4.1 Target layout

```
docs/
├── README.md                      ← NEW: 30-line index, points to the four entry points
│
├── architecture.md                ← updated (AUD-020)
├── database-schema.md             ← updated (AUD-020)
├── permissions.md                 ← updated (AUD-020)
├── workflows.md                   ← updated (AUD-020)
├── api.md                         ← keep (conventions)
├── business-requirements.md       ← keep
├── decisions.md                   ← AUTHORITATIVE decision log (47 ADRs)
│
├── duna-analysis/                 ← AUTHORITATIVE business knowledge
│   ├── 00…08                      ← existing sections (corrected for E1–E7)
│   └── 09-audit/                  ← NEW: this folder (12 files, canonical set)
│       ├── README.md                              index, evidence hierarchy, E1–E7, Git discipline
│       ├── confirmed-decisions.md                 DEC-001…114 — the settled product decisions
│       ├── question-reconciliation.md             Q-AUD-01…27 + 05b, SRC-01…08, C-*, E1–E7 dispositions
│       ├── target-domain-and-finance.md           domain model + financial/tax specification
│       ├── target-documents-and-configuration.md  11 document types, numbering, output, config
│       ├── target-security-audit-reporting.md     security, audit, retention, assets, reporting
│       ├── implementation-gap-analysis.md         60-capability classification
│       ├── risk-register.md                       R-01…R-15 + prerequisite ordering
│       ├── initial-roadmap.md             ← THE single planning entry point (P0–P12)
│       ├── open-questions.md                      the 12 genuinely unresolved items
│       ├── doc-consolidation-proposal.md          this file
│       └── audit-findings.md                      SUPERSEDED IN PART — retained as evidence record
│
├── current-plan/                  ← demoted to HISTORICAL (header added)
├── ai-audit/                      ← demoted to HISTORICAL (header added)
├── ops/                           ← operational records
└── ui/                            ← historical UI notes
```

### 4.2 Why the roadmap lives in `duna-analysis/09-audit/` and not in a new top-level folder

The brief asked to prefer updating existing documents over creating another independent planning folder. Putting
the roadmap inside the existing knowledge base — a numbered sibling of `07-traceability/` and `08-original-sources/`
— adds no new top-level structure. `docs/current-plan/` and `docs/ai-audit/` stay exactly where they are; they are
relabelled, not relocated, so no link breaks and no history is lost.

### 4.3 `progress.md` — the one retirement candidate

`progress.md` (91 KB) is a chronological log whose counts are stale and whose content is superseded by
`current-plan/11-implementation-state.md` plus the 30-file implementation log. Recommendation: **do not delete.**
Add a header pointing to `current-plan/11-implementation-state.md` and to `09-audit/README.md`, and leave it. It is
a dated narrative; that has value even when superseded. Deleting it is your call, not mine.

---

## 5. Proposed actions

Each action is gated. **Nothing below has been executed.**

| ID | Action | Files | Gate |
| --- | --- | --- | --- |
| **D1** | Fix the four stale top-level docs to match verified source: module status table, "planned entities" section, permission count 49→160, `CargoStatus`/`InspectionStatus` values | `architecture.md`, `database-schema.md`, `permissions.md`, `workflows.md` | **APPLIED 2026-10-11.** Verified against `prisma/schema.prisma` and `apps/api/src/modules/` before editing. Originals preserved; each correction dated. **Also corrected:** "35 modules" → **33** |
| **D2** | Add a "HISTORICAL — superseded" header to `current-plan/09` and `ai-audit/07` | 2 files | **APPLIED 2026-10-11.** Header-only; zero content removed |
| **D3** | Fix errors E1–E7 in the knowledge base. **E1 first** — correct the fabricated `DSR/26-190` to the real voucher **No. 477** | 9 files, 10 hits | **APPLIED 2026-10-11.** All 9 remaining occurrences corrected, each retaining a dated correction note so the error stays documented. **No file deleted.** E2 corrected to 52 models / 32 enums; E4 corrected to 160 codes / **33** modules; E5 re-framed; E6/E7 noted in the README |
| **D4** | Add a `docs/README.md` index | 1 new file | **APPLIED 2026-10-11.** Created: four entry points, the four-layer model, the superseded list, reading rules, and the E1–E7 defect register |
| **D5** | Cross-reference `current-plan/12-open-business-decisions.md` with `09-audit/open-questions.md` | 2 files | **APPLIED 2026-10-11.** Header added plus a disposition table mapping §1.1–1.12 to decisions and remaining open items (**OQ-05/06/07/08/12**) |
| **D6** | Add a provenance legend to `07-traceability/requirements-traceability.md` | 1 file | **APPLIED 2026-10-11.** Legend added: the matrix predates the audit, is unverified against the running system, and its finance/reporting rows are revised by the audit |
| **D7** | Delete `progress.md` | 1 file | **NOT RECOMMENDED.** Header-only alternative proposed instead |
| **D8** | Delete `docs/ai-audit/` (14 files) | 14 files | **NOT RECOMMENDED.** Historical evidence of a full prior audit round |
| **D9** | Delete `docs/current-plan/implementation-log/` (30 files) | 30 files | **NOT RECOMMENDED.** The best execution record in the repo |
| **D10** | Demote `09-audit/audit-findings.md` to evidence with a superseded header | 1 file | **DONE 2026-10-11.** Banner added plus 18 inline `STATUS UPDATE` blocks. No content deleted. |
| **D11** | Add the six canonical target-specification files under `09-audit/` | 6 new files | **DONE 2026-10-11** (`confirmed-decisions`, `question-reconciliation`, `target-domain-and-finance`, `target-documents-and-configuration`, `target-security-audit-reporting`, `implementation-gap-analysis`, `risk-register`). All additive; no existing file removed. |

**No deletion is proposed.** D7–D9 are listed only so the option is on the record and explicitly declined.

---

## 6. Rules for keeping this from happening again

Documentation drifted because nothing tied it to the code. Four cheap rules:

1. **Counts in docs must be generated or dated.** `permissions.md` said "49" because nobody re-counted after the
   seed grew to 160. Any number that can be counted from source should either be generated or carry the date it was
   last verified.
2. **A module marked "Planned" needs a re-check when its directory appears.** The drift in `architecture.md` was
   detectable automatically: `apps/api/src/modules/<name>/` existing while the doc says "Planned".
3. **Enum values belong in one place.** `workflows.md` duplicated state machines that live in
   `prisma/schema.prisma`. Where a doc restates a schema fact, it will drift. Prefer pointing at the schema.
4. **One roadmap.** Three "final" roadmaps is two too many. After approval, `09-audit/initial-roadmap.md` is the
   only one that is followed; the others become evidence.

---

## 7. What I need from you

1. **Approve, amend or decline D1–D9.** **D1 and the residual D3 are the ones that matter** — the rest are
   labelling. D10 and D11 are already done; D7–D9 are recommended against and are listed only so the option is
   on the record.
2. **Confirm the roadmap's home** (`docs/duna-analysis/09-audit/initial-roadmap.md`) as the single planning entry
   point, with `current-plan/09` and `ai-audit/07` relabelled historical.
3. **Confirm nothing is deleted.** I have assumed this; say so explicitly if you want `progress.md`, `ai-audit/`
   or anything else removed.

**Applied so far (2026-10-11), all additive or corrective, nothing deleted:** the C-07 withdrawal and severity
adjustment in `04-business-analysis/contradictions-register.md`; the superseded-in-part banner and 18 inline
status updates in `09-audit/audit-findings.md`; the seven new canonical files; and the revision of
`initial-roadmap.md`, `open-questions.md` and this proposal. **D1, D2 and the residual six hits of D3 await your
approval.**
