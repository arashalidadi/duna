# Risk and Dependency Register

**Status:** Canonical. Documentation only.
**Created:** 2026-10-11. Cross-references: `confirmed-decisions.md` (DEC-*), `implementation-gap-analysis.md`.

Severity: **HIGH** (can cause financial misstatement, data loss, or security breach) ·
**MEDIUM** (can cause rework, delay, or incorrect behaviour) · **LOW** (contained, recoverable).

---

## R-01 · Production credentials committed and published — 🔴 **CRITICAL (security)**

> **Reassessed 2026-10-11 and reclassified upward from HIGH.** This entry previously described the exposure as
> *prospective* ("an untracked archive that must never be committed"). **That was wrong.** See the correction
> note below. Full incident record: [`SECURITY-INCIDENT-R01.md`](SECURITY-INCIDENT-R01.md).

**Risk.** `docs/duna-analysis/legacy-source/duna-clean.zip` (16.1 MB committed; 2,489 entries) contains
`duna-clean/duna/.env` — a legacy Laravel environment file holding **real production credentials**.

**Status — 🔴 OPEN. The exposure has already occurred.**

| Verified | Finding |
| --- | --- |
| Tracked in Git | **Yes** (`git ls-files -s` → `100644 b2b99a8d…`) |
| Present in commit `c997624` (HEAD, base of this branch) | **Yes** |
| Present on the remote (`refs/heads/duna-analysis`) | **Yes** |
| Repository `arashalidadi/duna` is public | **Yes** (`isPrivate: false`) |

**The credentials are publicly downloadable and must be treated as fully compromised.**

**Correction to the previous entry.** The earlier "untracked … never been committed" statement was incorrect,
and its mitigation — avoid `git add -A` — cannot remediate an exposure that has already been pushed. Explicit
path discipline remains correct hygiene for the *future*; it does not close this incident.

**Controls applied in this documentation set.**
- No credential value is quoted, printed, copied or referenced anywhere in this repository's documentation.
- The archive was not opened or extracted beyond listing entry names to confirm the `.env` filename.
- The archive was **not** deleted; Git history was **not** modified; nothing was committed or pushed.

**Required action (owner, not this task) — in this order:**
1. **Rotate every credential in that `.env` at its provider** — database password, application key/secret, mail
   credentials, and all API tokens. Treat them as already known to third parties. Rotation is necessary, not
   precautionary, and must precede any cleanup.
2. Review access logs on every affected service for unattributable use.
3. Decide whether the repository should remain public; check for forks and clones, which history rewriting
   cannot reach.
4. **Only after rotation**, purge the archive from history (`git filter-repo`/BFG), force-push, and ask GitHub
   Support to expire cached views.
5. Add `*.zip` under `legacy-source/` plus `.env` patterns to `.gitignore`, and enable secret scanning, push
   protection and a pre-commit scanner.
6. Never archive a directory containing `.env` into a file destined for a repository.

> ⚠️ **Do not treat R-01 as closed because no credential has been committed *again*.** It closes only when the
> exposed credentials are rotated and confirmed revoked.

---

## R-02 · Financial correctness during ledger migration — **HIGH**

**Risk.** Introducing a real general ledger (DEC-078) changes how every financial figure can be computed. A
big-bang replacement risks silently restating historical balances.

**Mitigation.** DEC-081 — **additive migration**: introduce the accounting-entry model alongside the existing
derived ledger, run both, reconcile, and only then consider switching the read path.

**Invariant.** No historical balance may move without an explicit, logged adjustment (DEC-018, DEC-023, DEC-079).

---

## R-03 · Historical-data integrity on configuration change — **HIGH**

**Risk.** A highly configurable system (numbering, templates, custom fields, option lists, document types) can
silently rewrite history: renumbering issued documents, re-rendering issued outputs, or rewriting values whose
option was renamed.

**Controls.** DEC-026 (issued numbers immutable) · DEC-032 (historical values survive option changes) ·
DEC-066 (historical port names immutable) · DEC-096 (template version and rendered output preserved) ·
DEC-102 (applied tax preserved) · DEC-006 (no silent recalculation on rate change).

**Test.** Every configuration change requires a before/after equivalence check on issued documents.

---

## R-04 · Currency conversion silently mixing currencies — **HIGH**

**Risk.** Reporting that sums amounts across currencies without an explicit conversion rule produces plausible,
wrong numbers.

**Controls.** DEC-004 (preserve original amount and currency) · DEC-005 (record rate, date, source, base
equivalent) · DEC-009 (no mixing without an explicit rule) · DEC-012 (historical explainability).

**Dependency.** A dated `CurrencyRate` model must land in P6 **before** P7 reporting (AUD-023).

---

## R-05 · Test suite not executed; no verified baseline — **MEDIUM**

**Risk.** Every "implemented" classification is static-inspection-based. Runtime defects, misconfiguration and
concurrency issues are undetected. The cited "403/403 green" is unverified.

**Mitigation.** Phase 0 is explicitly dedicated to installing dependencies, provisioning PostgreSQL, creating
`.env`, running migrations, executing the suite, and recording the **real** figure.

**Standing limitation.** Until Phase 0 completes, no claim of runtime correctness may be made.

---

## R-06 · Seed ships demo business data — **MEDIUM (operational)**

**Risk.** `prisma/seed.ts` writes fabricated business rows (vessel, voyage, customers, cargo, inspections, load
list) with **no environment guard**. Running it against a production database injects fake transactions,
contradicting REQ-198 and AUD-014.

**Mitigation.** Split structural from demonstration data; gate demonstration behind an explicit opt-in; provide
separate dev fixtures (see `initial-roadmap.md` P1).

**Dependency.** P0 must first measure whether any e2e suite depends on the seeded rows (Q-AUD-11).

---

## R-07 · Missing official templates blocks only fidelity — **MEDIUM (scoped)**

**Risk.** Company output templates are absent (REQ-125). Rendering cannot be validated for fidelity.

**Scope control (DEC-098).** This affects **final template fidelity and validation in P8 only**. It must not
block specification or any other phase. Template collection is tracked separately.

---

## R-08 · Audit log not tamper-resistant — **MEDIUM (compliance)**

**Risk.** `AuditLog` exists but no append-only enforcement was observed at the database layer. Administrators
could alter or delete audit records, undermining DEC-047.

**Mitigation.** P11 — revoke `UPDATE`/`DELETE` on the audit table from the application role; separate export
role; consider hash-chaining.

---

## R-09 · Configuration could bypass core controls — **MEDIUM**

**Risk.** Administrator-configurable workflows, document types and statuses (DEC-034, DEC-059) might be used to
bypass financial, authorization, integrity or audit rules.

**Mitigation.** DEC-036, DEC-063, DEC-114 — core invariants are non-overridable by configuration. Enforced
server-side and covered by tests in P9.

---

## R-10 · Sensitive identity documents without a retention policy — **MEDIUM (compliance)**

**Risk.** ID-card capture is required for vouchers and salary slips (REQ-168/170). No retention, access or
privacy policy exists in **any** source.

**Controls decided.** DEC-089…091 — permission-restricted access, audited operations, no public URLs,
configurable retention and secure deletion.

**Still open.** Specific retention **periods** are a legal/accounting compliance input, not inventible
(`open-questions.md`). P4 must not enable production ID capture until that input exists.

---

## R-11 · Data migration on enum/field changes — **MEDIUM**

**Risk.** Aligning `LoadListStatus`/`ActualLoadingStatus` to ADR-041 (6 states → 3), removing `Customer`
prohibited fields, and resolving duplicate `Cargo` columns all require migrating **real rows**.

**Controls.** DEC-049 (hard deletion exceptional) · expand/contract migrations · verified mapping required before
any migration (Q-AUD-12) · backfill → verify → constrain, never one-shot (AUD-012, AUD-015).

---

## R-12 · Insurance of scope: reconciliation may not cover every requirement — **MEDIUM**

**Risk.** Of 127 requirements in the traceability matrix, 57 are not ✅. This audit verified and routed 24 of
them into phases; **33 remain unverified** (`initial-roadmap.md` §7). Several are field-level or print-layout
requirements that will surface during P8/P10 rather than being decided up front.

**Mitigation.** §7 enumerates all 33 with provisional phase routing. Phases P2, P3, P7, P8 and P10 should be
treated as **incomplete in detail** until those rows are checked against code.

---

## R-13 · Backup untested — **MEDIUM**

**Risk.** No backup capability exists. Per DEC-055, a backup job existing is not proof; restoration must be
tested and documented.

**Mitigation.** P0 requires a verified restore before other work. P12 implements the full capability with
periodic restoration tests.

---

## R-14 · Numbering concurrency — **LOW**

**Risk.** 11 of 14 document types use read-then-write generators with P2002 retry instead of the transactional
`NumberingService`. Under concurrency these are weaker than the row-locking path.

**Mitigation.** P2 migrates all types onto `NumberingService` (DEC-027); concurrency tests per type.

---

## R-15 · Legacy behaviour mistaken for requirement — **LOW**

**Risk.** The legacy system may be read as a specification. It is evidence only.

**Notable legacy defects already identified:** **D1** (`RELEASED` defined but never written) ·
**D12** (voyage counter keyed on port + shipper, contradicting REQ-040) · **D13** (`mt_rand()` in number
generators) · **D4** (an invoice view rendering `vatamount + subtotal`).
**Legacy also entirely lacked:** a ledger, Delivery Order, Release Order workflow, Salary, and financial reports
(§4.2) — so it cannot inform those requirements at all.

---

## Dependency summary — what must land before what

| Prerequisite | Required before | Reason |
|---|---|---|
| Dated `CurrencyRate` model (P6) | **P7 reporting** | Cross-currency figures need recorded rates (AUD-023, DEC-004/006) |
| Per-line VAT (P3) | **P7 VAT report** | REQ-194 depends on line-level tax (DEC-101) |
| Invoice↔B/L and Invoice↔Job links (P3) | **P7 income rollup** | REQ-192 income = invoices against a voyage's B/Ls |
| Accounting entries (P6) | **P7 expense side / P&L** | REQ-190/191 need posted costs (DEC-078) |
| Attachments + permissions (P4) | **P8 templates** | Company assets must be managed before templates consume them (DEC-087) |
| Company-settings endpoint (P4) | **P8 document output** | TRN and company name are needed on printed tax invoices (REQ-146/147) |
| Verified restore (P0) | **everything** | No schema work without a restore point (DEC-055) |
| Test dependency measurement (P0) | **P1 seed split** | Removing demo rows must not break suites (Q-AUD-11) |
| Workflow/approval framework (P9) | **P5 release exceptions** | Configurable approval authority (DEC-059, Q-AUD-21) |
