# Confirmed Product and System Design Decisions

**Status:** Canonical. These are **confirmed product-design decisions** for the target system.
**Created:** 2026-10-11. Documentation only — no application code was changed.

---

## How to read this document

Each decision carries a stable ID (`DEC-nnn`), a statement of required behaviour, its **classification**, its
**evidence**, and its **roadmap phase**. Four classifications are used and must never be blurred:

| Class | Meaning |
| --- | --- |
| **CONFIRMED DECISION** | Settled by the business owner for the target system. Not open for re-litigation unless a concrete contradiction makes implementation impossible or unsafe. |
| **BUSINESS REQUIREMENT (EVIDENCED)** | Established by employer statement (`EMP-nnn`) or real document sample. Independent of any design choice. |
| **TECHNICAL RECOMMENDATION** | Not yet settled; a proposal to be resolved during technical architecture. Must not be presented as company policy. |
| **OPEN** | Genuinely unresolved — carried in `open-questions.md`. |

**A confirmed decision does not become a statement about the company's existing practice.** Where this document
says "the system must support X", that is a target-system requirement, not a claim that Duna does X today.

**Notation:** phases refer to `initial-roadmap.md` (revised). `P0`–`P12`.

---

## 5.1 Multi-currency financial model

**DEC-001 — Supported currencies.** The system must support transactions in multiple currencies, including at
least **AED, USD, AUD, CNY (Chinese yuan), IRR (Iranian rial)**.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Evidence:* Owner decision (§5.1). **No employer statement in the transcripts mentions any currency** — a
word-boundary search of `employer-original-statements.en.md` returns **zero** hits for AED/Dirham/USD/Dollar. The
five real document samples are all denominated in AED (`docs-summary.md` §8.1; source pack §3.3–3.7).

**DEC-002 — Currency administration.** Authorized administrators must be able to add, edit, deactivate and manage
supported currencies, and choose the default/base reporting currency.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Implementation note:* `Currency` exists (`prisma/schema.prisma:199-210`) with `code, name, symbol, isActive,
sortOrder` — adequate as a reference list. There is **no rate history** (see DEC-006) and no admin endpoint.

**DEC-003 — No universal currency policy may be inferred from samples.**
*Class:* CONFIRMED DECISION (correction). *Phase:* — .
*Evidence:* All five samples are AED, but **this does not establish a universal rule**. Earlier drafts of this
analysis asserted AED as the default on the strength of the samples alone; that claim is **withdrawn**. The
default must be an administrator choice (DEC-002), seeded to AED as a *reference example*, not a hard rule.

**DEC-004 — Preserve original transaction amount and currency.** For every financial transaction, store the
original amount and its currency. Never convert in place.
*Class:* CONFIRMED DECISION. *Phase:* P6.

**DEC-005 — Record rate, effective date and base equivalent.** Record the exchange rate applied and, where
appropriate, its effective date and source; store the resulting base/reporting-currency equivalent.
*Class:* CONFIRMED DECISION. *Phase:* P6.

**DEC-006 — No silent recalculation of history.** Changing the default currency, or changing a current exchange
rate, must **never** silently recalculate historical transactions.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Implementation gap:* no `CurrencyRate`/`ExchangeRate` model exists (AUD-023). `Voucher.exchangeRate` exists in
isolation; `Invoice` has no rate field. Rate history is a **prerequisite** for P6 and must land **before** P7.

**DEC-007 — Centrally managed and transaction-specific rates.** Support centrally managed exchange rates and,
where permitted, transaction-specific overrides.
*Class:* CONFIRMED DECISION. *Phase:* P6.

**DEC-008 — Rate change control and audit.** Control who may create, edit, approve or override exchange rates;
audit rate changes and overrides.
*Class:* CONFIRMED DECISION. *Phase:* P6. *Cross-ref:* DEC-044…DEC-048 (audit event coverage).

**DEC-009 — Cross-currency balance reporting.** Support consistent reporting of balances across currencies;
prevent reporting logic from mixing currencies without an explicit conversion rule.
*Class:* CONFIRMED DECISION. *Phase:* P7.

**DEC-010 — FX gains and losses.** Account for realized and unrealized foreign-exchange gains/losses where
appropriate to the accounting model.
*Class:* CONFIRMED DECISION, with a **TECHNICAL RECOMMENDATION** deferred: whether the target model recognises
unrealised gains at period end is an accounting-policy question to be settled during P6 architecture. Not a
blocking business decision.

**DEC-011 — Rounding, precision and rate direction.** Define consistent handling for rounding, precision and rate
direction during technical design.
*Class:* TECHNICAL RECOMMENDATION. *Phase:* P6. Money should be stored at a defined precision (current schema uses
`Decimal(18,2)`; rates use `Decimal(10,4)` on `Voucher`) and rate direction (multiply vs divide) fixed and
documented once, then applied everywhere.

**DEC-012 — Historical explainability.** Historical financial reports must remain explainable and traceable to
original transaction values, recorded rates, accounting entries and applicable conversion logic.
*Class:* CONFIRMED DECISION. *Phase:* P7. *Cross-ref:* DEC-063 (report traceability).

---

## 5.2 Customer payments, advances and allocation

**DEC-013 — Payment reference cardinality.** A customer payment may reference one invoice, several invoices, other
relevant documents, or no document at all.
*Class:* BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION. *Phase:* P6.
*Evidence:* Real **Receipt Voucher No. 477** carries three references — `1517`, `1526`, `Advance 477`
(source pack §3.3). **REQ-165** (EMP-660): an unallocated payment **must not** raise an error. Legacy had no
allocation table, so legacy is silent here.

**DEC-014 — Allocation modes.** A payment may be: allocated to one invoice; allocated across multiple invoices;
allocated partly with the remainder unallocated; retained as a customer advance or general credit for future
allocation.
*Class:* CONFIRMED DECISION. *Phase:* P6. *Cross-ref:* AUD-005 (current model has a single optional
`Voucher.invoiceId` and no `VoucherAllocation`).

**DEC-015 — Per-reference allocation amounts.** Store allocations **per reference**, with amounts.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Evidence:* Resolves Q-AUD-04. Real voucher No. 477 evidences multi-reference; the decision settles that amounts
must be stored per reference, not merely a list of references.

**DEC-016 — Manual and automatic allocation.** Support manual allocation by authorized users **and** automatic
allocation according to a configurable policy (for example, oldest outstanding invoices first). Administrators
must be able to configure the default allocation policy.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Note:* "oldest first" is an **example policy**, not a company rule. The policy must be configurable.

**DEC-017 — Allocation reporting.** Preserve and report: total received; total allocated; unallocated amount;
remaining customer credit/advance; amount outstanding per invoice; allocation history and **reallocation**
history; and the related payment, invoice, advance and accounting-entry references.
*Class:* CONFIRMED DECISION. *Phase:* P6/P7.

**DEC-018 — Allocation auditability.** Allocation changes must be auditable. Never silently change historical
allocations, and never let customer balances become inconsistent with accounting records.
*Class:* CONFIRMED DECISION. *Phase:* P6. *Cross-ref:* DEC-045 (allocation events audited), DEC-023 (no silent
change to historical financial records).

---

## 5.3 Controlled financial corrections

**DEC-019 — Ordinary edits where legitimate.** Support ordinary edits for records that are legitimately editable
under the relevant permissions and lifecycle state.
*Class:* CONFIRMED DECISION. *Phase:* P3/P6.

**DEC-020 — Controlled correction for finalized records.** For finalized, posted or otherwise historically
significant financial transactions, use a controlled correction workflow. Available mechanisms may include
cancellation, reversal, correction entry, credit note, cancellation-and-reissue, or a linked replacement document.
*Class:* CONFIRMED DECISION. *Phase:* P3/P6.
*Note:* Resolves Q-AUD-20. The decision deliberately supports **more than one** mechanism; which mechanism applies
to which situation is configuration (DEC-022), not a single hard-coded rule.

**DEC-021 — Preserve the full correction history.** The system must preserve previous and corrected values,
original records, reasons, users, timestamps, approvals, and the relationships among documents and accounting
entries.
*Class:* CONFIRMED DECISION. *Phase:* P3/P6.

**DEC-022 — Manager approval where configured.** Manager approval must be available and required **where
configured or required by the applicable control policy**.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Important:* specific approval identities are **not** invented here. Who approves is configuration.

**DEC-023 — Never silently overwrite finalized history.** Corrections must preserve accounting integrity and
permit reconstruction of what happened before and after.
*Class:* CONFIRMED DECISION. *Phase:* P3/P6. *Cross-ref:* DEC-069 (no recomputation of issued documents).

---

## 5.4 Configurable document numbering

**DEC-024 — Per-document-type numbering configuration.** Authorized administrators must be able to configure
numbering independently for each document type: prefix, suffix, year/period components, sequential numbering,
scope (branch, destination, year or other configured dimension), reset rules where permitted, uniqueness
constraints, and effective dates or configuration versions.
*Class:* CONFIRMED DECISION. *Phase:* P2/P8.
*Implementation gap:* `NumberingSequence` exists and supports prefix/format/padding/period/scope, but only
**3 of 14** document types use it (`bill`, `manifest`, `voyages`); 11 use hard-coded local generators (AUD-013).
**No `NumberingSequence` rows are seeded** — the service creates them on first use.

**DEC-025 — Do not invent official numbering patterns.** Use verified samples as seed/reference examples and
distinguish examples from confirmed rules.
*Class:* CONFIRMED DECISION. *Phase:* P2.
*Verified samples (real documents):* B/L `KHS/26-110`; Manifest `DSMAN/KHO-26-006`; Invoice `DSINV/26-172`;
Proforma `DSPRO/26-001`; Quotation `DSQUO/25-017`; Receipt Voucher **`477`** (plain numeric).
*Spoken examples, NOT confirmed:* `KHS/26-2/2026` (EMP-544), `RJS/26-10` (EMP-546) — these **conflict with each
other and with the real documents** and must not be adopted as rules.

**DEC-026 — Issued numbers are immutable.** Once issued, later configuration changes must not silently alter a
historical document number.
*Class:* CONFIRMED DECISION. *Phase:* P2.

**DEC-027 — Concurrency and duplicate prevention.** Duplicate prevention and concurrent number generation must be
addressed in technical design.
*Class:* TECHNICAL RECOMMENDATION. *Phase:* P2.
*Note:* `NumberingService.allocateNumber()` uses `SELECT … FOR UPDATE` and is the safe pattern; the 11 local
generators use read-then-write with P2002 retry and should be migrated onto the service.

**DEC-028 — B/L sequence reset semantics.** Business evidence establishes that the B/L sequence counts B/Ls
issued **per destination per year**.
*Class:* BUSINESS REQUIREMENT (EVIDENCED). *Phase:* P2.
*Evidence:* **EMP-547** — *"this 10 is the Bill of Lading that we issued in the year 2026 for Rajaee"*; real
documents `KHS/26-110`, `KHS/26-108`. Per-destination scoping is **already implemented**
(`bill.service.ts:1642-1649`, `scopeType: 'DESTINATION'`); only the format string differs.

---

## 5.5 Extensible custom fields and managed option lists

**DEC-029 — Administrator-extensible fields.** Authorized administrators must be able to extend supported
business records and document types without code changes for each new field.
*Class:* CONFIRMED DECISION. *Phase:* P9.
*Implementation gap:* no `CustomField` model exists.

**DEC-030 — Custom field configuration surface.** Configuration must support data type; required/optional;
validation rules; display location and ordering; visibility rules; view and edit permissions; filtering and
search; reporting and export behaviour; applicable entity/document types; and effective dates or configuration
versions.
*Class:* CONFIRMED DECISION. *Phase:* P9.

**DEC-031 — Managed option lists.** Support managed option lists for dropdowns and multi-selects. Administrators
may add, edit, deactivate and, where safe, reactivate options (for example cities).
*Class:* CONFIRMED DECISION. *Phase:* P9.

**DEC-032 — Historical values survive option changes.** Historical records must preserve their original values
when field definitions or options change. Renaming, deactivating or removing an option must not silently rewrite
historical values.
*Class:* CONFIRMED DECISION. *Phase:* P9. *Cross-ref:* DEC-026, DEC-069, DEC-081.

**DEC-033 — Configuration auditing.** Configuration changes must be audited.
*Class:* CONFIRMED DECISION. *Phase:* P9. *Cross-ref:* DEC-046 (configuration changes audited).

---

## 5.6 Extensible document types and workflows

**DEC-034 — Administrator-configurable document types.** Authorized administrators must be able to add and
deactivate supported document types and configure display name, category, required/optional fields, custom
fields, numbering pattern and scope, output templates, permissions, workflow and status configuration, approval
rules, document relationships, and reporting/search behaviour.
*Class:* CONFIRMED DECISION. *Phase:* P9.
*Implementation gap:* no `DocumentType` model exists. `DocumentTemplate` exists but `DocumentTemplateVersion` is
**orphaned** (zero code references — AUD-008).

**DEC-035 — Versioning / effective point in time.** Document-type configuration must be versioned or have a clear
effective point so historical documents retain their original interpretation and output.
*Class:* CONFIRMED DECISION. *Phase:* P9.

**DEC-036 — Flexibility must not bypass core controls.** Configuration must never allow bypass of core financial,
authorization, data-integrity, security or audit controls.
*Class:* CONFIRMED DECISION (invariant). *Phase:* all. *Cross-ref:* §Security, DEC-100.

---

## 5.7 Comprehensive reporting and traceability

**DEC-037 — Reporting is core capability.** Reporting is a core system capability, not a later cosmetic
enhancement.
*Class:* CONFIRMED DECISION. *Phase:* P7.
*Implementation gap:* no `reports` module exists; the navigation `insightControl` section contains a single
`reports` item marked `status: 'planned'`; no `report:*` permission code is seeded.

**DEC-038 — Standard report coverage.** Provide standard reports covering customer operations and Jobs; customer
invoices and other financial documents; customer payments, receipts, advances, credit, debts and balances;
customer documents and operational history; financial transactions and accounting entries; general ledger and
financial summaries; voyage costs and income; Jobs and operations; B/Ls; manifests; and document/workflow
statuses.
*Class:* CONFIRMED DECISION. *Phase:* P7.

**DEC-039 — Custom report builder.** Authorized users must be able to build, save, reuse and export custom
reports with configurable columns and metrics, filters, grouping and sorting, date ranges, relevant
relationships, and supported calculated values.
*Class:* CONFIRMED DECISION. *Phase:* P7.

**DEC-040 — Export formats.** Support Excel and PDF export where appropriate.
*Class:* CONFIRMED DECISION. *Phase:* P7/P8.
*Cross-ref:* REQ-120 (PDF/Excel/Print on every document screen), REQ-123.

**DEC-041 — Permission-aware reporting.** Reports must respect user permissions and protect sensitive fields.
*Class:* CONFIRMED DECISION. *Phase:* P7. *Cross-ref:* DEC-109.

**DEC-042 — Report traceability.** Financial figures must be traceable to underlying business transactions,
allocation records, exchange rates and accounting entries.
*Class:* CONFIRMED DECISION. *Phase:* P7.

**DEC-043 — Balance summaries are not the ledger.** Customer balance summaries must never substitute for the
actual accounting ledger.
*Class:* CONFIRMED DECISION (invariant). *Phase:* P6/P7. *Cross-ref:* DEC-113.

---

## 5.8 Audit logging and accountability

**DEC-044 — Audit scope.** Maintain an auditable history of important financial, operational, document,
configuration and security events.
*Class:* CONFIRMED DECISION. *Phase:* P1/P11.
*Implementation status:* `AuditLog` model exists (`actorId, actorEmail, action, entityType, entityId, beforeData,
afterData, metadata, ipAddress, userAgent`) with ~10 code references. Coverage breadth is **not verified**.

**DEC-045 — Named audit events.** At minimum, evaluate and document logging for: creation and modification of
significant records; financial postings and corrections; payment allocation and reallocation; B/L changes and
finalization; document cancellation and reissue; exchange-rate creation, changes and overrides; release
decisions and exceptions; approval outcomes; permission and role changes; custom-field and option-list changes;
document-type, numbering and template changes; archive, reopen, deletion and deactivation actions; and access
to, replacement of, or deletion of sensitive documents and company assets.
*Class:* CONFIRMED DECISION. *Phase:* P11.

**DEC-046 — Audit record content.** Capture actor, timestamp, affected record, previous and new values (or an
equivalent reliable change representation), reason, approval decision and approver, and related document or
workflow reference.
*Class:* CONFIRMED DECISION. *Phase:* P11.

**DEC-047 — Tamper resistance.** Audit records must be protected against casual alteration or deletion by
ordinary users **and administrators**. Specify tamper-resistant controls at the application and database/server
levels, controlled audit access, and authorized export.
*Class:* CONFIRMED DECISION, implementation as TECHNICAL RECOMMENDATION. *Phase:* P11.
*Recommendation:* append-only enforcement at the database layer (revoke `UPDATE`/`DELETE` on the audit table from
the application role), separate privileged role for export, and periodic hash-chaining if a stronger guarantee is
wanted. To be settled in P11 architecture.

**DEC-048 — Corrections create events, not erasure.** Corrections must create new traceable events rather than
erase the historical record.
*Class:* CONFIRMED DECISION. *Phase:* P3/P6/P11.

---

## 5.9 Deletion, deactivation and historical preservation

**DEC-049 — Hard deletion is exceptional.** Hard deletion is permitted only where the record has no important
historical significance, dependencies, accounting consequences or retention obligations.
*Class:* CONFIRMED DECISION. *Phase:* P10.

**DEC-050 — Preferred alternatives.** Otherwise use deactivation, cancellation, archival or a controlled
correction workflow as appropriate.
*Class:* CONFIRMED DECISION. *Phase:* P10.

**DEC-051 — Inactive option behaviour.** Prevent inactive options from being selected for new transactions
unless reactivated; preserve existing records that reference an inactive item.
*Class:* CONFIRMED DECISION. *Phase:* P9/P10.

**DEC-052 — Deletion controls.** Audit deletion, deactivation and reactivation; enforce dependency and retention
checks; prevent deletion from silently breaking accounting, document relationships or audit history.
*Class:* CONFIRMED DECISION. *Phase:* P10.

---

## 5.10 Backup, disaster recovery and restoration

**DEC-053 — Backup capability.** Support scheduled and manual backups with configurable retention, secure storage
separate from the primary server, access controls and audit logging, monitoring and failure notifications,
periodic restoration tests, a documented recovery procedure, coverage for database plus uploaded files, generated
documents, templates and sensitive assets, and integrity verification with preserved access controls on recovery.
*Class:* CONFIRMED DECISION. *Phase:* P12.
*Implementation gap:* no backup capability exists in the application. This is infrastructure work, not
application logic.

**DEC-054 — RPO/RTO are not invented.** Recovery-point and recovery-time objectives are decisions to establish
during infrastructure design, not commitments invented here.
*Class:* CONFIRMED DECISION (scope limit). *Phase:* P12.

**DEC-055 — A backup is not proven until restored.** A backup is not sufficient merely because a backup job
exists; restoration must be tested and documented.
*Class:* CONFIRMED DECISION. *Phase:* P12. *Cross-ref:* P0 already requires a verified restore.

---

## 5.11 Configurable notifications and reminders

**DEC-056 — Configurable notification rules.** Support administrator-configurable rules covering trigger events
and conditions, recipients and roles, timing and delay, repeat intervals and frequency limits, escalation
conditions, delivery channels (in-app and email, with future channels extensible), enable/disable controls, and
delivery status with relevant audit information.
*Class:* CONFIRMED DECISION. *Phase:* P10.
*Resolves:* Q-AUD-13 and Q-AUD-14. Both are settled as **configurable**, not as specific values.

**DEC-057 — Use cases.** Include overdue invoices, pending approvals, Job status changes, unpaid-release
follow-ups and other relevant operational reminders.
*Class:* CONFIRMED DECISION. *Phase:* P10.

**DEC-058 — Historical thresholds are examples.** The evidence thresholds — follow-up after approximately one or
two weeks (EMP-692), a one-week unpaid alert (EMP-148), and a later reminder involving a 20% unpaid amount
(EMP-149) — are **examples, not universal hard-coded defaults**. Administrators must be able to configure actual
conditions and timing.
*Class:* CONFIRMED DECISION (scope limit). *Phase:* P10.
*Note:* explicitly prevents the earlier analysis from turning EMP-148/149 into a hard-coded rule.

---

## 5.12 Configurable statuses and approval workflows

**DEC-059 — Configurable workflows.** Support configurable document and operation workflows with statuses and
display labels, allowed transitions, role-based permissions, conditions, approval steps, exception handling and
audit records.
*Class:* CONFIRMED DECISION. *Phase:* P9.
*Implementation gap:* no `WorkflowDefinition`/`Approval` model exists; statuses are Prisma enums fixed in schema.

**DEC-060 — Do not invent official status labels.** Official company status labels that are not established must
not be invented.
*Class:* CONFIRMED DECISION (scope limit). *Phase:* P9.

**DEC-061 — B/L lifecycle shape.** The B/L lifecycle must distinguish draft/correction activity from
approval/finalization and final issuance. A draft may carry an appropriate draft watermark and be sent for
correction before finalization. **Exact official labels remain configurable until verified.**
*Class:* CONFIRMED DECISION (behaviour) + OPEN (labels). *Phase:* P5/P9.
*Evidence:* source pack §2.11 — B/L issued as Draft with a `DRAFT` watermark, sent to the customer for review and
correction; after approval/finalization the draft is removed and the final B/L issued. REQ-105 (EMP-564)
confirms corrections are applied before finalization.
*Known conflict:* `BlStatus` has six values — `DRAFT | FINAL | APPROVED | RELEASED | ISSUED | CANCELLED` — which
includes near-duplicate pairs (`FINAL`/`ISSUED`, `APPROVED`/`RELEASED`). ADR-046 describes four states.

**DEC-062 — Release Order is the release authorization.** A Release Order remains the business authorization for
releasing cargo. A B/L status alone must not be treated as a substitute for the required release authorization.
*Class:* CONFIRMED DECISION. *Phase:* P5.
*Resolves:* Q-AUD-07. *Evidence:* EMP-685-690 — the release document records whether the customer *"paid in
full, it's Paid"*, took it *"on credit — it's Unpaid"*, or made a *"Partial Payment"*.

**DEC-063 — Workflow flexibility must not bypass controls.** Workflow configuration must not bypass required
accounting, authorization, data-integrity or audit rules.
*Class:* CONFIRMED DECISION (invariant). *Phase:* P9.

---

## 5.13 Ports and operational reference data

**DEC-064 — Port fields.** Provide administrator-managed ports with official name, display name, country, code or
abbreviation, aliases, and active/inactive status.
*Class:* CONFIRMED DECISION. *Phase:* P10.
*Implementation gap:* schema `Port` has `code, name, country, city?, abbreviation?` — no display name, no aliases,
and `city`/`abbreviation` are **nullable** despite REQ-031 requiring all four mandatory (AUD-012).

**DEC-065 — Seed from verified documents.** Seed the initial list from verified sources: Hamriyah, Khorramshahr,
Bandar Abbas, Bushehr, Jebel Ali, Rajaee, Sohar, Dubai. Preserve documented codes/aliases such as **HAM**,
**KHS**, **RJS** **only where their meanings are verified**.
*Class:* CONFIRMED DECISION. *Phase:* P10.
*Evidence:* EMP-264-266 establishes HAM = Hamriyah. KHS and RJS are evidenced by real B/L numbers
(`KHS/26-110`) and by EMP-544/546 (`KHS`, `RJS` = Rajaee). Port names appear across transcripts: Hamriyah (28),
Khorramshahr (33), Bandar Abbas (13), Bushehr (11), Jebel Ali (10), Rajaee (4), Sohar (2), Dubai (12).
*Caution:* "Bandar Abbas" and "Rajaee" may refer to the same port complex (Bandar Abbas / Shahid Rajaee). **Not
resolved by available evidence** — recorded as OPEN (see `open-questions.md`).

**DEC-066 — Historical port names are immutable.** Historical documents must retain the names and codes
originally used; changing a port's current display name or status must not silently rewrite issued documents.
*Class:* CONFIRMED DECISION. *Phase:* P10.

**DEC-067 — Port display format.** The evidenced display format is three parts: name, city/region, country —
e.g. `HAMRIYA PORT, DUBAI, UAE`, `KHORRAM SHAHR, PERSIAN GULF, IRAN`, `BANDAR ABBAS, PERSIAN GULF, IRAN`.
*Class:* BUSINESS REQUIREMENT (EVIDENCED). *Phase:* P10.
*Evidence:* real B/L §3.1 and Manifest §3.2; REQ-030 (EMP-241-255); REQ-031 (EMP-268).
*Note:* Iranian ports record **"Persian Gulf"** in the city position — the city field is used loosely as a
region. Do not "correct" this.

---

## 5.14 Job and operational model

**DEC-068 — Job definition.** A Job represents the overall commercial order or operation in which a customer asks
the company to transport goods from an origin to a destination. A Job may involve multiple goods, B/Ls,
manifests, operational documents, costs, charges, invoices, receipts and payments over time.
*Class:* CONFIRMED DECISION. *Phase:* P3.
*Evidence (supporting):* source pack §2.10 — a Job Number acts as a cumulative case file so costs (Repairing,
Customs, Lowbed, Transport, Ship, Crane) accumulate on the same job; at invoicing the accountant must see the
related Job Numbers. EMP-609 — *"check it against the related Job Numbers — Match all of them."*

**DEC-069 — Job creation.** Support both manual Job creation and configurable automatic creation rules.
*Class:* CONFIRMED DECISION. *Phase:* P3. *Resolves:* Q-AUD-23 (creation trigger).
*Note:* the specific trigger event is configuration, not a fixed rule.

**DEC-070 — Job is distinct from other records.** The specification must distinguish the Job from individual
B/Ls, voyages, manifests, invoices and payments.
*Class:* CONFIRMED DECISION. *Phase:* P3.

**DEC-071 — Invoice-to-Job many-to-many.** Relationships must support the confirmed many-to-many invoice-to-Job
behaviour.
*Class:* CONFIRMED DECISION. *Phase:* P3. *Resolves:* Q-AUD-01.
*Implementation gap:* `Invoice` has no job reference at all (AUD-002).

**DEC-072 — ETOZ/ETDZ remain undefined.** Do not invent meanings for ETOZ, ETDZ or other unexplained company
abbreviations. Record them as requiring evidence if they become material.
*Class:* CONFIRMED DECISION (scope limit) + OPEN. *Phase:* — .
*Evidence:* source pack §5 item 8 lists ETOZ/ETDZ as requiring definition; REQ-131 records ETOZ/ETDZ work as
unverified.

---

## 5.15 Customer, Shipper, Consignee, Agent and contacts

**DEC-073 — Distinct concepts.** Customer, Shipper, Consignee and Agent are distinct business concepts and must
not be collapsed into a single role or entity merely for implementation convenience.
*Class:* BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION. *Phase:* P10.
*Evidence:* source pack §2.9 — *"Customer باید کاملاً جدا از Shipper و Consignee تعریف شود"* (Customer must be
defined completely separately from Shipper and Consignee). Worked example: goods bought in Australia, Australian
shipper, different consignee at destination, but the internal Customer is a named individual.

**DEC-074 — Customer may be natural or legal person.** A Customer may be a natural person or a legal entity.
*Class:* BUSINESS REQUIREMENT (EVIDENCED). *Phase:* P10.
*Evidence:* source pack §2.9 — *"Customer ممکن است شخصیت حقیقی یا حقوقی باشد"*.
*Implementation note:* the current `Customer.type` column is seeded with commercial-role values
(`SHIPPER/CONSIGNEE/AGENT/FREIGHT_FORWARDER`) — **different semantics** from the natural/legal distinction. See
DEC-075.

**DEC-075 — REQ-017 stands.** The fields prohibited by REQ-017 (Type, Currency, TRN Number, Short Name) must not
be introduced merely because they appear convenient. The Customer model must still support natural and legal
persons and remain distinct from commercial roles.
*Class:* CONFIRMED DECISION. *Phase:* P10. *Resolves:* Q-AUD-08.
*Consequence:* the existing `Customer.type` either carries the **wrong semantics** and should be removed or
repurposed to the natural/legal distinction, or should be removed outright. `shortName`, `taxId` and `currency`
have **no supporting evidence** in any source.

**DEC-076 — Contacts belong to parties.** Contacts must be associated with the appropriate Shipper, Consignee or
Agent, as applicable; the commercial customer must not be conflated with these roles.
*Class:* BUSINESS REQUIREMENT (EVIDENCED). *Phase:* P10. *Resolves:* Q-AUD-24.
*Evidence:* §2.6/2.7 — Shipper and Consignee each carry Name (mandatory), National ID/TRN, Address, Contact
Number, Email (optional). §2.8 — Agent carries Name, Address, Contact Number, Email.

**DEC-077 — Agents-only portal.** Support the agents-only external portal requirement for destination agents with
independent login/access. Do not introduce a customer portal as a confirmed requirement without new evidence.
*Class:* CONFIRMED DECISION. *Phase:* P5. *Resolves:* Q-AUD-16, Q-AUD-27.
*Evidence:* §2.18 — destination agents must have independent login and see only their own destination's data,
**especially B/L, Manifest and Release Order**, so they can answer customers without phoning head office
(REQ-187/188).

---

## 5.16 General ledger and accounting integrity

**DEC-078 — Real general ledger required.** Implement a proper, auditable accounting-entry structure and general
ledger. Customer balance screens and operational summaries are not a substitute for accounting entries.
*Class:* CONFIRMED DECISION. *Phase:* P6. *Resolves:* Q-AUD-03 (requirement side).
*Evidence:* §2.14 — General Journal capability required in addition to invoices and payments; office/daily
expenses must be recorded for year-end P&L. REQ-166, REQ-167, REQ-195.
*Implementation gap:* no `GeneralJournal`, `JournalLine`, `LedgerEntry` or `Account` model exists. The ledger is a
**derived view** over invoices and vouchers (ADR-032) — adequate for balances, **not** for accounting integrity.

**DEC-079 — Accounting requirements list.** The architecture and roadmap must address: accounting entries
associated with relevant business transactions; posting and correction controls; traceability from reports to
source transactions; reconciliation of customer balances with payments, allocations, advances, invoices and
accounting entries; multi-currency accounting with recorded exchange rates; consistent treatment of reversals
and corrections; General Journal and office-expense requirements; and financial reporting and auditability.
*Class:* CONFIRMED DECISION. *Phase:* P6.

**DEC-080 — Legacy accounting is insufficient.** Do not assume the legacy application's accounting structure is
sufficient; verify its actual behaviour and identify the gap.
*Class:* CONFIRMED DECISION. *Phase:* P6.
*Finding:* source pack §4.2 lists *"Ledger as independent accounting entity"* among the legacy **gaps** — the
legacy system had **no ledger at all**, and no Delivery Order, no Release Order workflow, no Salary, and no
financial reports. There is therefore no legacy accounting structure to inherit.

**DEC-081 — Additive migration, not big-bang.**
*Class:* TECHNICAL RECOMMENDATION (not a business decision). *Phase:* P6.
*Recommendation:* introduce the accounting-entry model **alongside** the existing derived ledger; run both;
reconcile; only then consider switching the read path. This avoids silently restating historical balances.

---

## 5.17 Archive, retention and reopening

**DEC-082 — Manual and automatic archiving.** Support both.
*Class:* CONFIRMED DECISION. *Phase:* P12.

**DEC-083 — Configurable retention.** Authorized administrators must be able to configure retention periods and
archive criteria, **subject to legal, accounting, security and dependency constraints**.
*Class:* CONFIRMED DECISION. *Phase:* P12. *Resolves:* Q-AUD-25.
*Important:* no specific retention period is invented. Legal/accounting retention is a compliance input to be
obtained, not assumed (see `open-questions.md`).

**DEC-084 — Archived records remain visible.** Archived records must remain searchable or visible in relevant
reports according to permissions.

**DEC-085 — Reopening is controlled.** Reopening an archived record must require appropriate authorization and
record the reason and action history; subsequent edits remain subject to permissions, approvals and audit rules.

**DEC-086 — Deletion respects constraints.** Permanent deletion must respect retention requirements,
dependencies, accounting significance and audit obligations. Archive status must not become a means of bypassing
these controls.

*Class for DEC-084/085/086:* CONFIRMED DECISION. *Phase:* P12.

---

## 5.18 Sensitive identity documents, signatures and company assets

**DEC-087 — Sensitive asset management.** Securely manage sensitive identity documents and signatures where
required, plus approved company assets used in business documents: letterheads, company logos, stamps, authorized
signatures and other official document assets.
*Class:* CONFIRMED DECISION. *Phase:* P4/P12.

**DEC-088 — Asset lifecycle.** Support secure upload, management, versioning, replacement, deactivation and
assignment to applicable templates by authorized users.
*Class:* CONFIRMED DECISION. *Phase:* P4/P8.

**DEC-089 — Access restriction and audit.** Restrict access, viewing, downloading, replacement and deletion
according to permissions; audit sensitive asset operations.
*Class:* CONFIRMED DECISION. *Phase:* P4/P11. *Resolves:* Q-AUD-05b (control side).

**DEC-090 — No unrestricted exposure.** Do not expose sensitive files through unrestricted public URLs or include
sensitive information in ordinary reports and notifications.
*Class:* CONFIRMED DECISION (invariant). *Phase:* P4.
*Technical consequence:* object storage with signed, short-lived URLs rather than public paths.

**DEC-091 — Retention and secure deletion configurable.** Retention and secure-deletion policies must be
configurable within applicable legal, accounting, business-retention and dependency requirements; preserve assets
referenced by historical documents where necessary to reproduce or verify previously issued outputs.
*Class:* CONFIRMED DECISION. *Phase:* P12.

**DEC-092 — Scope limit on ID capture.** Identity documents and signatures are required in relevant payment
vouchers and salary slips, as supported by existing evidence. Do **not** extend these requirements
indiscriminately to unrelated documents.
*Class:* CONFIRMED DECISION (scope limit). *Phase:* P4.
*Evidence:* §2.15 — payment vouchers require front-and-back ID card of the recipient plus the recipient's
signature; salary slips require the employee's ID card front and back plus the employee's signature on the
printed copy. REQ-168 (EMP-703-707), REQ-170 (EMP-708-712).
*Implementation gap:* `FileAttachment` exists but is referenced **once** in all application code — effectively
unused (AUD-006). No upload endpoint exists.

---

## 5.19 Configurable print and document-output templates

**DEC-093 — Per-document-type templates.** Every document type must be able to have independently configurable
output templates.
*Class:* CONFIRMED DECISION. *Phase:* P8.

**DEC-094 — Administrator template management.** Authorized administrators must be able to create, edit, version,
preview, deactivate and assign templates without application-code changes for routine adjustments.
*Class:* CONFIRMED DECISION. *Phase:* P8.
*Implementation gap:* `DocumentTemplate` exists; **`DocumentTemplateVersion` is orphaned** (0 references) — so
versioning is modelled but never used (AUD-008).

**DEC-095 — Template capabilities.** Templates must support dynamic fields populated from system records, page
size and orientation, margins and layout, fonts and text formatting, tables and repeating rows, page breaks and
pagination, approved company assets, PDF generation and printing, and versioning with controlled assignment.
*Class:* CONFIRMED DECISION. *Phase:* P8.

**DEC-096 — Preserve template version and rendered output.** Preserve the template version and, where required,
the rendered historical output for issued documents. A later template change must not silently alter an already
issued document's historical appearance.
*Class:* CONFIRMED DECISION. *Phase:* P8.

**DEC-097 — Template permissions and audit.** Control template-editing and approval permissions; audit changes.
*Class:* CONFIRMED DECISION. *Phase:* P8/P11.

**DEC-098 — Do not fabricate templates; do not block.** Official company templates are not available. Do not
fabricate them. Identify missing templates and plan for their collection. This limitation affects **final
template fidelity and validation only** — it must not prevent the rest of the system from being specified.
*Class:* CONFIRMED DECISION (scope limit). *Phase:* P8.
*Evidence:* REQ-125 — uploaded templates are not present in the repository. Verified: `documents/` holds 7 real
document **samples**, no templates.

---

## 6 · Business documents, tax and calculations

**DEC-099 — Document catalog (11 types).** The target document catalog comprises: Loading List, B/L, Manifest,
Invoice, Delivery Order, Release Order, Salary Slip, Voucher, Payment, Receipt, Ledger.
*Class:* CONFIRMED DECISION. *Phase:* P8.
*Reconciles the 9-vs-11 discrepancy:*
- **Nine** are explicitly enumerated by the employer: **EMP-721-725** — *"Loading List … Invoice … Delivery
  Order … Release Order … Salary Slip, Voucher, Payment, Receipt"* … *"the Ledger section"*. This is exactly
  REQ-124's list of nine.
- **B/L and Manifest** are the two additional types in source pack §2.12. They are **separately evidenced**:
  **EMP-035** — *"it's a standard Bill of Lading whose formats we have, I'll send them to you"*; **EMP-572** —
  *"we Upload that same Format that we have into the system."*
- **Resolution:** all eleven are in scope. The nine are the explicit enumeration; B/L and Manifest are
  separately evidenced. **Nothing is invented.** The discrepancy is documented, not silently resolved.

**DEC-100 — Tax configurability.** Tax/VAT must be configurable by authorized administrators, including
applicable tax types and rates.
*Class:* CONFIRMED DECISION. *Phase:* P3.

**DEC-101 — Line-level tax.** Support tax treatment at the **invoice-line** level. Do not impose one universal
tax rate.
*Class:* BUSINESS REQUIREMENT (EVIDENCED). *Phase:* P3.
*Evidence:* EMP-113/114/115/118 — each invoice row takes a VAT percentage; EMP-611 lists row columns as
*"Description, Rate, quantity, VAT and the total amount which includes VAT."*
*Implementation gap:* `Invoice.taxRate` is **header-level**; `InvoiceItem` has no tax column (AUD-001).

**DEC-102 — Preserve applied tax historically.** Each finalized invoice must preserve the tax treatment actually
applied, including rates and amounts, so later tax-configuration changes do not silently recalculate historical
invoices.
*Class:* CONFIRMED DECISION. *Phase:* P3.

**DEC-103 — Invoice calculation structure.** Calculations must distinguish Subtotal, applicable line-level taxes,
and Total; preserve historical tax amounts and the details needed to reproduce them.
*Class:* BUSINESS REQUIREMENT (EVIDENCED). *Phase:* P3.
*Evidence:* EMP-614 — *"Subtotal, VAT and Total Amount"*; EMP-612 — *"we write the total amount separately, the
VAT amount separately."*

**DEC-104 — No universal tax rate.** Evidence includes invoices with **zero** VAT (real tax invoice `DSINV/26-172`
shows `VAT: 0.00 AED` on `27,370.00 AED`) and a spoken example of 5% (EMP-115). These do **not** establish a
universal rate.
*Class:* CONFIRMED DECISION (scope limit). *Phase:* P3.
*Corroboration:* EMP-617 — *"There are a set of invoices that have VAT, and a set of invoices that don't have
VAT"* (REQ-145).

**DEC-105 — Invoice may cover one or multiple B/Ls.** Support both invoicing a single B/L and issuing an invoice
covering multiple B/Ls.
*Class:* CONFIRMED DECISION. *Phase:* P3. *Resolves:* Q-AUD-02.
*Evidence note:* all observed samples show a **single** B/L reference field (`BOE/DEC/BL#: KHS/26-108`) and
EMP-687 refers to *"the Invoice related to this Release Order"* (singular). The decision deliberately supports
**both** for flexibility. *Implementation gap:* `Invoice.billOfLadingId` is a single nullable column (AUD-003).

---

## 7 · Security and permissions

**DEC-106 — Coherent security model.** Cover users, roles, permissions, workflows, sensitive data, reporting,
document outputs, configuration and administration.
*Class:* CONFIRMED DECISION. *Phase:* P1/P11.
*Current state:* 160 seeded permission codes across **33** modules; no `report:*`, `document:*`, `notification:*`,
`settings:*` or `backup:*` codes exist.

**DEC-107 — Least privilege.** Apply least-privilege access throughout.
*Class:* CONFIRMED DECISION. *Phase:* P11.

**DEC-108 — Independent agent access.** Independent agent login/access where required.
*Class:* CONFIRMED DECISION. *Phase:* P5. *Cross-ref:* DEC-077.

**DEC-109 — Role-based and record-level permissions.** Support role-based and, where needed, record-level
permissions (for example, agent destination scoping).
*Class:* CONFIRMED DECISION. *Phase:* P11.

**DEC-110 — Restricted financial rights.** Restrict financial posting and correction rights; control approval
authority.
*Class:* CONFIRMED DECISION. *Phase:* P6/P11. *Cross-ref:* DEC-022.

**DEC-111 — Sensitive asset and audit protection.** Protect sensitive identity-document and asset access, and
protect the audit log.
*Class:* CONFIRMED DECISION. *Phase:* P4/P11. *Cross-ref:* DEC-047, DEC-089.

**DEC-112 — Secure backup and credentials.** Secure backup access and restoration; secure handling of credentials
and environment secrets.
*Class:* CONFIRMED DECISION. *Phase:* P12.
*🔴 Live security risk (corrected 2026-10-11):* see `risk-register.md` **R-01** and
`SECURITY-INCIDENT-R01.md`. The archive `docs/duna-analysis/legacy-source/duna-clean.zip` contains
`duna-clean/duna/.env` with **real production credentials**, and it is **already tracked, committed
(`c997624`), pushed, and the repository is public**. The credentials must be treated as **compromised**;
rotation by the owner is required. Values are not reproduced anywhere in this documentation.

**DEC-113 — Historical record integrity** and **DEC-114 — configuration cannot disable core controls.**
*Class:* CONFIRMED DECISION (invariants). *Phase:* all.

---

## Summary counts

| Group | Decisions |
| --- | --- |
| Multi-currency (5.1) | DEC-001…012 |
| Payments & allocation (5.2) | DEC-013…018 |
| Financial corrections (5.3) | DEC-019…023 |
| Numbering (5.4) | DEC-024…028 |
| Custom fields & lists (5.5) | DEC-029…033 |
| Document types & workflows (5.6) | DEC-034…036 |
| Reporting (5.7) | DEC-037…043 |
| Audit (5.8) | DEC-044…048 |
| Deletion & deactivation (5.9) | DEC-049…052 |
| Backup & recovery (5.10) | DEC-053…055 |
| Notifications (5.11) | DEC-056…058 |
| Statuses & approvals (5.12) | DEC-059…063 |
| Ports (5.13) | DEC-064…067 |
| Job model (5.14) | DEC-068…072 |
| Parties & contacts (5.15) | DEC-073…077 |
| General ledger (5.16) | DEC-078…081 |
| Archive & retention (5.17) | DEC-082…086 |
| Sensitive assets (5.18) | DEC-087…092 |
| Templates & output (5.19) | DEC-093…098 |
| Documents & tax (§6) | DEC-099…105 |
| Security (§7) | DEC-106…114 |

**Total: 114 confirmed decisions/requirements — the ID space is `DEC-001`…`DEC-114` with no gaps.** Every one is
mapped to a roadmap phase in `initial-roadmap.md` and traceable from `question-reconciliation.md`.

> **ID integrity note (2026-10-11).** An earlier draft of this file carried three cross-references to
> `DEC-118`, `DEC-120` and `DEC-121`, which were never defined. They have been retargeted onto the real audit
> decisions (`DEC-044`…`DEC-048`, `DEC-023`). **Any document citing a DEC number above 114 is citing a
> non-existent decision.**
