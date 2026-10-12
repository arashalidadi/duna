# 09 — Audit: documentation vs. actual code

**Status:** Canonical audit section. Last updated 2026-10-11.
**Scope of permitted change:** corrections and consolidation of **documentation only**. No application source,
schema, migration, configuration or test file has been created, modified, moved or deleted.

---

## 1 · What this folder is

This is the audit and target-specification layer of the Duna knowledge base. It reconciles what the documentation
*says* the system does with what the code *actually* does, records the confirmed design decisions for the target
system, and turns the difference into an implementation roadmap.

It sits inside `docs/duna-analysis/` deliberately — the existing analysis knowledge base — rather than in a new
top-level planning folder.

| File | Purpose |
| --- | --- |
| `README.md` | Method, evidence hierarchy, verification status, evidence inventory (this file) |
| `confirmed-decisions.md` | **Canonical** confirmed product/system design decisions, `DEC-001`–`DEC-114` |
| `question-reconciliation.md` | **Canonical** disposition of every `Q-AUD-*`, `SRC-*` and evidence correction |
| `target-domain-and-finance.md` | Target domain model, relationships, financial and tax specification |
| `target-documents-and-configuration.md` | Document catalog, lifecycles, numbering, configuration, output |
| `target-security-audit-reporting.md` | Security, audit, retention, sensitive assets, reporting |
| `implementation-gap-analysis.md` | Current application state vs target requirements |
| `audit-findings.md` | Capability classification and gap register, `AUD-001`–`AUD-023` |
| `initial-roadmap.md` | Implementation roadmap, phases P0–P12 |
| `open-questions.md` | Only **genuinely** unresolved matters |
| `risk-register.md` | Risks, dependencies and prerequisite ordering |
| `doc-consolidation-proposal.md` | Documentation structure proposal and commit plan |
| **`SECURITY-INCIDENT-R01.md`** | 🔴 **OPEN** — committed and published production credentials: findings, corrections and remediation |

---

## 2 · Evidence hierarchy

Applied when sources conflict. Higher tiers override lower ones.

1. **Explicit, confirmed business-owner decisions** recorded during the requirements discussion — see
   `confirmed-decisions.md`.
2. **Direct employer statements and transcript evidence** — `EMP-nnn` references in
   `01-employer-statements/employer-original-statements.en.md`, sourced from `requirements/`.
3. **Actual company document samples** — `docs/duna-analysis/documents/` and the extracted evidence in
   `existing-analysis/duna_source_pack.md` §3 and `docs-summary.md` §8.
4. **Verified behaviour in the legacy Laravel implementation** — evidence of *historical* behaviour, **not**
   automatically binding on the target system.
5. **The current application's code, schema, UI and tests** — evidence of *present implementation state*, which
   may be a gap rather than a requirement.
6. **Earlier AI-generated analysis, assumptions, inferred descriptions and proposed solutions** — useful indexes,
   **not** authoritative.

**This hierarchy does not make code irrelevant.** It means an old implementation must not silently override a
confirmed product decision.

### 2.1 Classification labels used throughout

Every requirement statement carries one of:

| Label | Meaning |
| --- | --- |
| **Confirmed business requirement** | Established by employer statement or real document |
| **Confirmed product-design decision** | Settled by the business owner for the target system (`DEC-*`) |
| **Directly evidenced existing behaviour** | Observed in code or a real document |
| **Inferred behaviour** | Reasoned, not evidenced — never presented as policy |
| **Proposed technical implementation** | A recommendation to be settled in architecture |
| **Unresolved business decision** | In `open-questions.md` |
| **Missing source evidence** | Named specific item, verified unavailable |
| **Existing implementation gap** | Required but not built (see `implementation-gap-analysis.md`) |
| **Verification pending** | Present in code, not executed |

---

## 3 · Evidence inventory (verified 2026-10-11)

The historical reference `/home/duna/dunaData/` was **relocated** into the repository. Its contents are present
under new paths (see `question-reconciliation.md` SRC-01). Verified:

| Category | Count | Location |
| --- | --- | --- |
| Transcripts | **20** | `docs/duna-analysis/requirements/` |
| — `audio_*.txt` | 18 | same |
| — `part1_0-15.txt`, `part2_15-end.txt` | 2 | same |
| Real document PDFs | **7** | `docs/duna-analysis/documents/` |

The seven documents match the source-pack inventory exactly:

1. Bill of Lading — `BL-1X D155A CH NO 8308-1.pdf` → B/L No `KHS/26-110`
2. Manifest — `MAN-MEHDI 11 KHO-26-006.pdf` → Manifest No `DSMAN/KHO-26-006`
3. Receipt Voucher — `DUNA  SHIPPING  -  RECEIPT  VOUCHER.pdf` → Voucher No **`477`**
4. Ledger / SOA — `DUNA  SHIPPING SOA.pdf` → closing balance `683.50 Dr`
5. Tax Invoice — `INV-GRAND CRANE USED TRUCK CRANE +1 PKG CH.NO 0127-1.pdf` → `DSINV/26-172`
6. Proforma Invoice — `PRO-MEHDI BAGHSIAH 1X R340L...pdf` → `DSPRO/26-001`
7. Quotation — `QUO-SHADMAN MEABADI 1X FINISHER-1.pdf` → `DSQUO/25-017`

### 3.1 Verified evidence limitations

| Limitation | Effect |
| --- | --- |
| **Original audio files absent** (transcripts survive) | The source pack marks unclear passages `[نامفهوم/نیازمند تطبیق با صوت]`; these cannot be resolved. Affects wording, not substance. |
| **Company output templates absent** (REQ-125) | Affects **template fidelity and validation in P8 only**. Does not block specification or any other phase (DEC-098). |
| **Legal/accounting retention periods absent** | Affects configuration of retention (P12), not the design. Not inventible. |
| **ETOZ / ETDZ undefined** | Recorded as requiring evidence (DEC-072). Not invented. |
| **Manifest filename discrepancy** | The owner's written reference is `AN-MEHDI 11 KHO-26-006.pdf`; the file on disk is **`MAN-MEHDI 11 KHO-26-006.pdf`** (leading `M`). Treated as an unconfirmed **transcription truncation**, **not** as a different document. **No file has been renamed, moved or substituted on the basis of an assumption.** The `MAN-` form is used consistently across `duna_source_pack.md`, `document-catalog.md`, `source-inventory.md` and this README. See change-log row 19. |

---

## 4 · Verification status — read before trusting any "implemented" label

**The test suite was not executed during this audit.** The environment has:

- no `node_modules` (root, `apps/api`, `apps/web`) → nothing can be compiled or run;
- no PostgreSQL (nothing listening on 5432) → the 22 e2e suites cannot run;
- no `.env` (only `.env.example`).

Consequences, stated plainly:

- **No capability carries "implemented + verified by execution."** The maximum classification from static
  inspection is **"present in code, unverified."**
- **"403/403 tests green" is UNVERIFIED.** It is cited from `docs/current-plan/11-implementation-state.md` and was
  not reproduced.
- **The runtime was never started.** Conclusions about behaviour come from reading code, not observing it.
- Static inspection cannot catch runtime misconfiguration, N+1 or performance problems, concurrency behaviour
  under real load, or defects that appear only at production data volumes.

Phase 0 of the roadmap exists to fix exactly this.

---

## 5 · Knowledge-base errors found in earlier work (E1–E7)

Recorded so the roadmap does not inherit them. Corrections are scheduled in **P1** and itemised in
`doc-consolidation-proposal.md`.

| ID | Error | Actual |
| --- | --- | --- |
| **E1** | `DSR/26-190` cited as a receipt-voucher number | **Fabricated.** `DSR` appears in no extracted document. The real voucher is **No. 477**, plain numeric. **Re-confirmed** by source pack §3.3. **Contradiction C-07 corrected in place 2026-10-11**; 8 further files / 9 occurrences remain (see §5.2) |
| **E2** | "62 models / 25 enums" | **52 / 32** |
| **E3** | "33 API modules" | **32** |
| **E4** | "105 permissions / 12 resources", later recorded as "160 codes / 35 modules" | Seed defines **160 codes / 33 modules**. The "35" was itself an error — it conflated the **35 web pages** with permission modules. Corrected 2026-10-11 |
| **E5** | C-17 framed as a contradiction | **Re-framed, finding unchanged.** It is a **legacy defect** (hard-coded `VESSEL = DUNA SHIPPING LLC`) correctly identified as defect D11 — a defect to report, not a source conflict to reconcile. No change to the finding |
| **E6** | `¶n` paragraph-index drift | 720 source paragraphs vs 725 cited indices; content complete, labels inconsistent |
| **E7** | Self-reported "46 files, ~16,000 lines" | **45 files / 11,536 lines** |

### 5.1 Additional corrections made during reconciliation

| Correction | Detail |
| --- | --- |
| **SRC-01 withdrawn** | `/home/duna/dunaData/` is a historical path. Employer materials are present under `requirements/` and `documents/`. Not a blocker. |
| **SRC-02 downgraded** | No file of that name, but its function is covered by source pack §3 and `02-business-documents/`. Partial coverage; nothing blocks. |
| **REQ-102 corrected** | Per-destination B/L numbering is **already implemented** (`bill.service.ts:1642-1649`). Only the format string differs. |
| **REQ-040 corrected** | Implemented as destination + year (`voyages.service.ts:278-288`), matching the real `02/26`. The **vessel** component is missing. |
| **Currency claim withdrawn** | A prior draft said "the employer says Dirham". A word-boundary search returns **zero** AED/Dirham/USD/Dollar matches in the statements. AED is evidenced by 5/5 document samples only, and is **not** a universal policy (DEC-003). |
| **Q-AUD-02 over-confidence withdrawn** | A prior draft called it "answerable from one sample". The source pack (§5 item 10) explicitly defers it; now resolved by design decision (DEC-105). |
| **9 vs 11 document types explained** | REQ-124's nine are the explicit enumeration (EMP-721-725); B/L and Manifest are separately evidenced (EMP-035, EMP-572). All eleven in scope; nothing invented. |
| **Dangling decision IDs removed** | `confirmed-decisions.md` previously cross-referenced `DEC-118`, `DEC-120` and `DEC-121`, which were never defined. Retargeted onto `DEC-044`…`DEC-048` and `DEC-023`. **The ID space is `DEC-001`…`DEC-114`, with no gaps.** |

### 5.2 E1 — residual occurrences of the fabricated voucher number

The C-07 entry in the contradictions register has been corrected. The original error spanned **9 files / 10
occurrences**; **8 files / 9 occurrences** remain, gated on approval (action **D3** in
`doc-consolidation-proposal.md`). Occurrences inside `09-audit/` are deliberate — they record the error.

| File | Line |
| --- | --- |
| `03-legacy-laravel-system/reports-and-documents.md` | 38 |
| `04-business-analysis/capability-gap-analysis.md` | 76 |
| `04-business-analysis/consolidated-business-model.md` | 232 |
| `05-current-project/legacy-vs-current-comparison.md` | 125 |
| `05-current-project/system-overview.md` | 94 |
| `06-ai-reference/how-to-use-this-knowledge-base.md` | 183 |
| `07-traceability/source-inventory.md` | 96, 120 |
| `FINAL-REPORT.md` | 166 |

---

## 6 · Requirements coverage

- **127 requirements** in `07-traceability/requirements-traceability.md`: ✅ 68 · 🟡 23 · ❌ 19 · ⏳ 15 · n/a 2.
- Of the **57 not ✅**, this audit verified and routed **24** into roadmap phases.
- **33 remain unverified** — enumerated with provisional phase routing in `initial-roadmap.md` §7.
- Phases **P2, P3, P7, P8 and P10** should be treated as **incomplete in detail** until those rows are checked
  against code.

---

## 7 · Git state and commit plan

Recorded so the audit's footprint is auditable.

- Branch: `arena/be9b4e5b-duna` · HEAD `c997624` ("docs: add Duna business analysis source pack")
- Base branch: `duna-analysis`, remote tip is the **identical commit** → **0 commits ahead, 0 commits made**
- **Not pushed** — no upstream configured; `git ls-remote --heads origin arena/be9b4e5b-duna` returns no match
- Working tree: 0 tracked files modified · 0 deleted · 0 staged
- Untracked: the `docs/duna-analysis/` knowledge base plus this section

### 7.1 🔴 Security incident R-01 — read before any commit or push

**Corrected 2026-10-11.** This section previously stated that the archive
`docs/duna-analysis/legacy-source/duna-clean.zip` was **untracked**. **That was wrong.** Verified state:

- The archive is **tracked** and present in commit **`c997624`** (HEAD, base of this branch).
- That commit is **on the remote** as `refs/heads/duna-analysis`.
- The repository **`arashalidadi/duna` is public**.
- The archive contains **`duna-clean/duna/.env` with real production credentials**.

**The credentials are already publicly downloadable and must be treated as compromised.** Full incident record
and remediation steps: [`SECURITY-INCIDENT-R01.md`](SECURITY-INCIDENT-R01.md). Risk **R-01** in
`risk-register.md` is reclassified **CRITICAL** and remains **OPEN**.

**Still mandatory even though it no longer mitigates R-01:** never run `git add -A`, `git add .` or
`git add docs/` in this repository. Any commit must use **explicit file paths**. No credential value appears
anywhere in this documentation set, and the archive was neither opened, deleted nor altered.

Intended commands (not yet executed — awaiting approval):

```
git add docs/duna-analysis/04-business-analysis/contradictions-register.md \
        docs/duna-analysis/09-audit/README.md \
        docs/duna-analysis/09-audit/confirmed-decisions.md \
        docs/duna-analysis/09-audit/question-reconciliation.md \
        docs/duna-analysis/09-audit/target-domain-and-finance.md \
        docs/duna-analysis/09-audit/target-documents-and-configuration.md \
        docs/duna-analysis/09-audit/target-security-audit-reporting.md \
        docs/duna-analysis/09-audit/implementation-gap-analysis.md \
        docs/duna-analysis/09-audit/audit-findings.md \
        docs/duna-analysis/09-audit/initial-roadmap.md \
        docs/duna-analysis/09-audit/open-questions.md \
        docs/duna-analysis/09-audit/risk-register.md \
        docs/duna-analysis/09-audit/doc-consolidation-proposal.md
git commit -m "docs(audit): reconcile requirements, record confirmed design decisions, revise roadmap"
git push -u origin arena/be9b4e5b-duna
```

No commit, push or pull request has been created.

---

## 8 · Change log — this audit round

Applied 2026-10-11. **All documentation; no application source, schema, migration, configuration, test or Git
change.**

| # | Change | File |
| --- | --- | --- |
| 1 | Created the canonical confirmed-decision register, `DEC-001`…`DEC-114` | `confirmed-decisions.md` (new) |
| 2 | Created the master disposition of every `Q-AUD-*`, `SRC-*` and evidence correction | `question-reconciliation.md` (new) |
| 3 | Created the target domain model and financial/tax specification | `target-domain-and-finance.md` (new) |
| 4 | Created the 11-type document catalog, lifecycles, numbering, configuration and output spec | `target-documents-and-configuration.md` (new) |
| 5 | Created the security, audit, retention, sensitive-asset and reporting specification | `target-security-audit-reporting.md` (new) |
| 6 | Created the 60-capability current-vs-target assessment | `implementation-gap-analysis.md` (new) |
| 7 | Created the risk register with prerequisite ordering | `risk-register.md` (new) |
| 8 | Rewrote the index: evidence hierarchy, inventory, verification status, E1–E7, Git discipline | `README.md` (rewritten) |
| 9 | Added the superseded-in-part banner and 18 inline status updates | `audit-findings.md` (updated in place) |
| 10 | Revised the roadmap from 11 to 13 phases, P0–P12, with prerequisites, security, acceptance and exit criteria per phase | `initial-roadmap.md` (revised) |
| 11 | Reduced the open list from 41 items to the **12** genuinely unresolved ones | `open-questions.md` (revised) |
| 12 | Updated the consolidation proposal with E1–E7 status, new canonical files, and actions D10–D11 | `doc-consolidation-proposal.md` (updated) |
| 13 | **Withdrew contradiction C-07** (fabricated `DSR/26-190`), re-framed C-17, resolved C-22/SRC-01, adjusted the severity table | `04-business-analysis/contradictions-register.md` (corrected) |
| 14 | Applied consolidation actions **D1–D6** (four top-level docs corrected; two roadmaps marked historical; 9 fabricated `DSR` references corrected; `docs/README.md` index added; open-business-decisions cross-referenced; traceability legend added) | 13 files across `docs/` and `docs/duna-analysis/` |
| 15 | Corrected the "160 codes / 35 modules" figure to **33 modules** in 6 files | `README.md`, `audit-findings.md`, `doc-consolidation-proposal.md`, `confirmed-decisions.md`, `target-security-audit-reporting.md`, `implementation-gap-analysis.md` |
| 16 | **Reclassified R-01 from HIGH to CRITICAL** — the credential-bearing archive is tracked, committed, pushed and the repo is public | `SECURITY-INCIDENT-R01.md` (new), `risk-register.md`, `README.md` §7.1, `docs/README.md` |
| 17 | Added a **Risks** row to all 13 phases and a §5 revalidation record | `initial-roadmap.md` |
| 18 | Reconciled the open-item register: the two documents each listed 12 items **but not the same 12**; merged to **15** | `open-questions.md`, `question-reconciliation.md` |

| 19 | **Recorded the manifest filename discrepancy** (`AN-` in the owner's written reference vs `MAN-` on disk) as an unconfirmed transcription truncation. **No file renamed, moved or substituted** | `README.md` §3.1 |
| 20 | Corrected the reconciliation classification: an earlier draft double-counted OQ-08 and made the totals unverifiable. Every OQ now appears **exactly once**; **6 + 3 + 4 + 2 = 15** | `question-reconciliation.md` (new Closure statement) |
| 21 | Corrected **OQ-02** (premise was a misreading — `DSKHS-26-005` is on a different document and voyage, 0 occurrences in the Manifest), **OQ-08** (re-framed: samples and a rendering spec exist; only *editable source files* are absent), and **OQ-13** (all 4 sampled invoice lines are 0% VAT; 5% appears once as a spoken example) | `open-questions.md` |
| 22 | Reclassified contradiction **C-02 from B (blocks implementation) to L (low)** after the premise correction; original text retained. Severity table updated: B 3 → 2, L 1 → 2 | `04-business-analysis/contradictions-register.md` |
| 23 | Added **DEC-115…DEC-118** (§8 Owner decisions): customer codes, release-exception authority and the primary administrator, Rajaee/Bandar Abbas as one port, retention policy. Register total **114 → 118**. Added cross-refs from DEC-024, DEC-062, DEC-065, DEC-083 | `confirmed-decisions.md` |
| 24 | Added §8 recording the **owner's stated position on R-01** (credentials of no importance; must not hold up progress) with explicit evidentiary limits. **R-01 remains 🔴 OPEN** | `SECURITY-INCIDENT-R01.md` |

> **Correction to the note that previously ended this table.** An earlier draft listed D1–D6 as "not approved
> and not executed". That was **stale and wrong**: D1, D2, D5 and D6 were applied (change-log row 14) and are
> present in the working tree. The residual item is **D3** (fabricated `DSR` references — partially applied;
> row 14 records 9 corrected) and the **consolidation/cleanup proposal** in `doc-consolidation-proposal.md`,
> which remains **unapproved**. **No file has been deleted** at any point in this audit round.
