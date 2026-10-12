# Target System — Security, Audit, Historical Preservation and Reporting

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

**Status:** Canonical target specification. Documentation only.
**Created:** 2026-10-11. Cross-references: `confirmed-decisions.md` (DEC-*), `risk-register.md` (R-*).

---

## 1 · Security model

### 1.1 Principles (DEC-106…114)

| Principle | Requirement |
| --- | --- |
| **Least privilege** | Access granted by default-deny; permissions granted for the task, not the person |
| **Independent agent access** | Destination agents authenticate independently and are destination-scoped |
| **Role-based + record-level** | Role permissions where sufficient; record-level scoping where data must be partitioned (agent destination) |
| **Restricted financial rights** | Financial posting, correction and approval are separately permissioned |
| **Sensitive asset protection** | Identity documents, signatures and company assets are permission-restricted and audited |
| **Audit protection** | Audit records resist alteration or deletion by ordinary users **and administrators** |
| **Secure backup** | Backup access and restoration are restricted, monitored and audited |
| **Historical integrity** | Historical records are preserved against silent change |
| **Credential hygiene** | Credentials and environment secrets are handled securely |

### 1.2 The configurability boundary (DEC-036, DEC-063, DEC-114)

The target system is highly administrator-configurable — custom fields, option lists, document types, workflows,
statuses, numbering, templates and notifications. **This must never mean unrestricted access or the ability to
disable fundamental controls.**

Core invariants that configuration cannot override:
1. Financial postings and corrections remain permission-controlled and audited.
2. Accounting entries cannot be deleted or edited in place.
3. Audit records remain append-only and tamper-resistant.
4. Permission checks are enforced server-side, never only in the UI.
5. Historical documents, numbers and rendered outputs remain stable.
6. Sensitive assets remain access-controlled.
7. Retention and dependency checks cannot be bypassed by archiving.

### 1.3 Current state summary

- **160 permission codes across 33 modules** are seeded (`prisma/seed.ts`). This contradicts
  `docs/permissions.md:16`, which states "Seeded permissions (49)" (AUD-020).
- **No `report:*`, `document:*`, `notification:*`, `settings:*` or `backup:*` permission codes exist** — because
  those capabilities do not exist.
- Permission enforcement is decorator-based (`RequirePermissions`) on controllers; navigation items carry
  `requiredPermission`. Server-side enforcement was **not** exhaustively verified (see `implementation-gap-analysis.md`).

---

## 2 · Audit logging

### 2.1 Required event coverage (DEC-045)

At minimum, evaluate and document logging for:

| Domain | Events |
| --- | --- |
| Records | Creation and modification of significant records |
| Financial | Postings and corrections |
| Payments | Allocation and reallocation |
| B/L | Changes and finalization |
| Documents | Cancellation and reissue |
| Exchange rates | Creation, changes and overrides |
| Release | Decisions and exceptions |
| Approvals | Outcomes |
| Security | Permission and role changes |
| Configuration | Custom-field and option-list changes |
| Configuration | Document-type, numbering and template changes |
| Lifecycle | Archive, reopen, deletion and deactivation |
| Sensitive assets | Access to, replacement of, or deletion of sensitive documents and company assets |

### 2.2 Record content (DEC-046)

Where relevant, capture: **actor**; **timestamp**; **affected record**; **previous and new values** (or an
equivalent reliable change representation); **reason**; **approval decision and approver**; **related document or
workflow reference**.

### 2.3 Tamper resistance (DEC-047)

Audit records must be protected against casual alteration or deletion by ordinary users **and administrators**.

**Technical recommendation (to be settled in P11 architecture, not presented as company policy):**
1. Enforce append-only at the database layer — revoke `UPDATE` and `DELETE` on the audit table from the
   application's database role.
2. Provide a separate, separately-permissioned role for audit export.
3. Consider periodic hash-chaining if a stronger guarantee is required.
4. Route audit export through a permissioned, logged action.

### 2.4 Corrections create events (DEC-048)

Corrections must create **new traceable events**, never erase the historical record. This applies to financial
corrections, allocation changes, configuration changes and document reissue alike.

### 2.5 Current state

`AuditLog` exists with `timestamp, actorId, actorEmail, action, entityType, entityId, beforeData, afterData,
metadata, ipAddress, userAgent` — approximately 10 code references. **Coverage breadth against DEC-045 is not
verified.** No append-only enforcement was observed at the database layer.

---

## 3 · Deletion, deactivation and historical preservation

### 3.1 Hard deletion is exceptional (DEC-049)

Permitted only where the record has **no** important historical significance, dependencies, accounting
consequences or retention obligations. Otherwise: deactivation, cancellation, archival, or a controlled
correction workflow (DEC-050).

### 3.2 Required behaviours (DEC-051, DEC-052)

- Inactive options cannot be selected for new transactions unless reactivated.
- Existing records referencing an inactive item are **preserved**.
- Deletion, deactivation and reactivation are **audited**.
- Dependency and retention checks are **enforced**.
- Deletion must not silently break accounting, document relationships or audit history.

### 3.3 Archive, retention and reopening (DEC-082…086)

| Capability | Requirement |
| --- | --- |
| Archiving | Manual **and** automatic (DEC-082) |
| Retention | Administrator-configurable, **subject to legal, accounting, security and dependency constraints** (DEC-083) |
| Visibility | Archived records remain searchable or visible in relevant reports according to permissions (DEC-084) |
| Reopening | Requires authorization; reason and action history recorded; subsequent edits remain subject to permissions, approvals and audit (DEC-085) |
| Permanent deletion | Respects retention, dependencies, accounting significance and audit obligations; archive status is not a bypass (DEC-086) |

**No retention period is invented here.** Legal and accounting retention periods are a compliance input to be
obtained (recorded as open in `open-questions.md`).

**Scope note:** the employer raised a "Company Archive" concept and explicitly deferred its details to a later
source that was never supplied (§2.20). The confirmed design above supersedes that gap for specification
purposes; the specific periods remain open.

---

## 4 · Sensitive identity documents, signatures and company assets

### 4.1 Scope (DEC-092)

Identity documents and signatures are required for **payment vouchers** and **salary slips** — the two cases
supported by evidence (§2.15; REQ-168 EMP-703-707; REQ-170 EMP-708-712). These requirements must **not** be
extended indiscriminately to unrelated documents.

### 4.2 Asset classes (DEC-087)

Sensitive employee/manager identity documents and signatures, plus approved company assets used in business
documents: **letterheads, logos, stamps, authorized signatures and other official document assets**.

### 4.3 Controls (DEC-088…091)

- Secure upload, management, versioning, replacement, deactivation and assignment to templates by authorized
  users.
- Restrict access, viewing, downloading, replacement and deletion by permission.
- Audit sensitive asset operations.
- **No unrestricted public URLs** — use signed, short-lived URLs.
- No sensitive information in ordinary reports or notifications.
- Retention and secure deletion configurable within legal, accounting, business-retention and dependency
  requirements; preserve assets referenced by historical documents where needed to reproduce or verify previously
  issued outputs.

### 4.4 Current state and a live risk

- `FileAttachment` exists but is referenced **once** across all application code — effectively unused.
- No upload endpoint, no storage adapter, no MIME/size controls, no asset permissions.
- **🔴 LIVE SECURITY RISK (R-01 — corrected 2026-10-11, reclassified CRITICAL):** the repository contains the
  archive `docs/duna-analysis/legacy-source/duna-clean.zip` (16.1 MB committed) which contains
  `duna-clean/duna/.env` — a legacy Laravel environment file with **real production credentials**.
  **It is not untracked.** It is tracked, present in commit `c997624`, pushed to the remote, and the repository
  `arashalidadi/duna` is **public** — so the credentials are already publicly retrievable and must be treated as
  **compromised**. **No credential values are reproduced in any documentation in this repository.** See
  `SECURITY-INCIDENT-R01.md`. The responsible owner must **rotate the exposed credentials**; this documentation
  set neither opens, deletes nor alters the archive.

---

## 5 · Backup, disaster recovery and restoration

### 5.1 Requirements (DEC-053)

Scheduled **and** manual backups with:
- configurable retention;
- secure storage **separate from the primary server**;
- access controls and audit logging;
- monitoring and failure notifications;
- **periodic restoration tests**;
- a documented recovery procedure;
- coverage for database, uploaded files, generated documents, templates and sensitive assets;
- integrity verification;
- preserved access controls during recovery.

### 5.2 RPO and RTO are not invented (DEC-054)

Recovery-point and recovery-time objectives are decisions to establish during infrastructure design. No
unsupported business commitment is made here.

### 5.3 A backup is not proven until restored (DEC-055)

Existence of a backup job is insufficient. Restoration must be **tested and documented**. Phase 0 already
requires a verified restore before any other work proceeds.

**Current state:** no backup capability exists in the application. This is infrastructure work.

---

## 6 · Reporting specification

### 6.1 Reporting is core (DEC-037)

Reporting is a core system capability, not a later cosmetic enhancement.

### 6.2 Standard report coverage (DEC-038)

| Area | Reports |
| --- | --- |
| Customer operations | Customer operations and Jobs |
| Financial documents | Customer invoices and other financial documents |
| Payments | Payments, receipts, advances, credit, debts, balances |
| Customer history | Customer documents and operational history |
| Accounting | Financial transactions and accounting entries; general ledger and financial summaries |
| Voyage | Voyage costs and income |
| Operations | Jobs and operations |
| Documents | B/Ls; manifests; document and workflow statuses |

### 6.3 Custom reporting (DEC-039, DEC-040)

Authorized users build, save, reuse and export custom reports with configurable columns and metrics, filters,
grouping and sorting, date ranges, relevant relationships and supported calculated values. **Excel and PDF**
export where appropriate.

### 6.4 Controls (DEC-041, DEC-042, DEC-043)

- Reports respect user permissions and protect sensitive fields.
- Financial figures trace to underlying business transactions, allocation records, exchange rates and accounting
  entries.
- **Customer balance summaries never substitute for the accounting ledger.**

### 6.5 Report categories in detail

**Customer statement / ledger (REQ-160-162):** invoices issued, payments received, debit, credit, balance, and
time since the last statement; producible over an arbitrary date range.
*Current state:* derived ledger implemented via `GET /ledger/customers` with `fromDate`/`toDate`, `currencyCode`
and an `invoice|voucher|all` filter (`voucher.dto.ts:137-160`). Adequate for balances; **not** accounting.

**Voyage / manifest P&L (REQ-190-193):** costs (Vessel Hire, Port Use, Port Handling, Lashing, other) versus
income (sum of invoices against that voyage's B/Ls); annual tax P&L by filtering per-manifest results.

**Quarterly VAT report (REQ-194):** VAT collected versus VAT paid. Depends on per-line VAT (DEC-101) landing in
P3, and on tax configuration.

**Release report (REQ-183):** per B/L / Manifest, which items were released and under what payment condition.

**Overdue / unpaid report (REQ-154, REQ-184):** overdue invoices and released-but-unpaid documents.

### 6.6 Traceability test

A report qualifies as an **accounting report** only if, for any figure, the system can show: the original
transaction in its original currency; the rate applied and its source and effective date; the accounting entries
produced; the allocation and any reallocation; and any correction with its before/after values. A figure that
cannot be traced back is a **summary** and must be labelled as such.

---

## 7 · Permissions required by new capabilities

Capability areas introduced by the confirmed decisions will each need permission codes following the existing
`module:action` convention. None exist today:

| Area | Indicative codes |
| --- | --- |
| Reporting | `report:read`, `report:design`, `report:export` |
| Accounting | `journal:create`, `journal:post`, `journal:reverse`, `account:read` |
| Allocation | `allocation:create`, `allocation:reallocate` |
| Corrections | `correction:create`, `correction:approve` |
| Exchange rates | `fxrate:read`, `fxrate:manage`, `fxrate:override` |
| Configuration | `customfield:manage`, `optionlist:manage`, `documenttype:manage`, `numbering:manage` |
| Templates | `template:read`, `template:manage`, `template:approve` |
| Notifications | `notification:read`, `notification:manage` |
| Archive | `archive:create`, `archive:reopen`, `archive:delete` |
| Sensitive assets | `asset:manage`, `identitydoc:read`, `identitydoc:manage` |
| Audit | `audit:read`, `audit:export` |
| Backup | `backup:manage`, `backup:restore` |
| Settings | `settings:read`, `settings:manage` |

These are **proposed** code names following the existing convention, to be finalised during implementation. They
are listed because the permission model must be designed with these capabilities in mind, not retrofitted.
