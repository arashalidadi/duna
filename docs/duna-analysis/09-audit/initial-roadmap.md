# Implementation Roadmap (revised)

**Status:** Revised 2026-10-11. Supersedes the initial 11-phase version. **Documentation only — not yet approved,
and it authorises no code change.**

**Authority:** derived from `confirmed-decisions.md` (DEC-001…DEC-114) and `question-reconciliation.md`. Where the
initial roadmap and a confirmed decision conflict, the decision wins.

**What is settled vs. proposed.** The **scope** of each phase is settled by confirmed decisions. The **sequencing**
is a proposal based on dependency and risk. No delivery dates are given; none were requested and none are
invented.

---

## 1 · Dependency graph

```
P0  Runnable, verifiable baseline ─────────────────────────────────────────┐
                                                                            │
P1  Documentation truth · seed safety · KB corrections ────────────────────┤
                                                                            │
P2  Numbering configuration ───────────────────────────────────────────────┤ (independent of P3–P12)
                                                                            │
P3  Invoice correctness, tax, controlled correction ──────────┬─────────────┤
                                                              │             │
P4  Company settings · attachments · sensitive assets ────────┼─────────────┤
                                                              │             │
P5  Documents: release/delivery · B/L lifecycle · portal ─────┼─────────────┤
                                                              │             │
P6  Financial core: ledger · allocation · multi-currency ─────┴─────┬───────┤
                                                                    │       │
P7  Reporting ──────────────────────────────────────────────────────┴───────┤
                                                                            │
P8  Templates and document output ──────────────────────────────────────────┤
                                                                            │
P9  Configuration and extensibility ────────────────────────────────────────┤
                                                                            │
P10 Notifications · master data · data hygiene ─────────────────────────────┤
                                                                            │
P11 Security hardening and audit ───────────────────────────────────────────┤
                                                                            │
P12 Archive · retention · backup and recovery ──────────────────────────────┘
```

**Critical ordering constraints (from `risk-register.md`):**
- Dated exchange rates (P6) **before** P7 — cross-currency figures need recorded rates.
- Per-line VAT (P3) **before** the VAT report (P7).
- Invoice↔B/L and Invoice↔Job links (P3) **before** the income rollup (P7).
- Accounting entries (P6) **before** the expense side of P&L (P7).
- Company settings and assets (P4) **before** P8 — TRN and company assets are needed on printed output.
- Verified restore (P0) **before** any schema change.
- Seed-dependency measurement (P0) **before** the seed split (P1).

**Parallelisable:** P2 is fully independent. P3, P4 and P5 are independent of one another. P8 can overlap P6/P7
once its template dependency is resolved. P11 and P12 are largely independent of P7–P10.

---

## 2 · Phases

---

### Phase 0 — Runnable, verifiable baseline

| Field | Content |
|---|---|
| **Scope** | Establish that the system builds, migrates and tests, and record its **real** test status. No behaviour change. |
| **Prerequisites** | None |
| **Dependencies** | None — deliberately first |
| **Requirements** | DEC-055 (restore tested) · supports every later phase |
| **Deliverables** | Working dev environment; recorded test baseline; verified backup **and** verified restore; seed-dependency inventory |
| **Major tasks** | `pnpm install`; provision PostgreSQL 16; create `.env` from `.env.example`; `prisma migrate deploy` + `generate`; run the 22 e2e suites and record the real pass/fail figure; run `pnpm typecheck` and `pnpm lint`; inventory which suites depend on seeded demo rows; verify a restore from backup |
| **Security / integrity** | `.env` must never be committed. Backup must be stored off-server. No production data in the dev environment. |
| **Acceptance** | `pnpm install`, `prisma migrate deploy` and `pnpm test` each complete from a clean checkout. A **dated, real** pass/fail figure is recorded, replacing the unverified "403/403". A verified backup **and** a verified restore exist. The seed-dependency list is written down. |
| **Testing** | This phase *is* the test infrastructure. Deliverable is a measured baseline, not code. |
| **Risks** | **R-05** no verified baseline (this phase *is* the mitigation) · **R-13** backup untested · **R-01** credentials in the tree — do not commit broadly · Environment provisioning may fail outright; if it does, every downstream estimate is invalid |
| **Known blockers** | Network access for package installation; database provisioning |
| **Exit conditions** | Baseline recorded in the implementation log; restore proven |

---

### Phase 1 — Documentation truth, seed safety, knowledge-base corrections

| Field | Content |
|---|---|
| **Scope** | Stop documentation from misleading; stop the seed injecting fabricated business rows; correct the recorded evidence errors. |
| **Prerequisites** | P0 (seed-dependency inventory) |
| **Dependencies** | P0 |
| **Requirements** | AUD-014, AUD-020, AUD-021 · REQ-198 · errors E1–E7 · DEC-064/065 |
| **Deliverables** | Corrected top-level docs; corrected knowledge base; structural/demonstration seed split |
| **Major tasks** | Split `prisma/seed.ts`; gate demonstration data behind an explicit opt-in with a loud warning; give any dependent suite its own fixtures. Remove the stale `planned` "Agent portal" nav entry. Record the REQ-001 six-vs-ten navigation discrepancy as a documented deviation (no deletion). |
| **Documentation — DONE 2026-10-11** | All six consolidation actions **D1–D6 were applied** on that date, ahead of implementation: <br>• **D1** — `architecture.md` module status, `database-schema.md` "planned entities", `permissions.md` (49→160 codes / **33** modules), `workflows.md` enum values (`READY`→`READY_FOR_LOADING`; inspection states corrected) — all corrected against source, with originals preserved and dated.<br>• **D2** — `current-plan/09` and `ai-audit/07` marked 🗄️ HISTORICAL (headers only, no deletion).<br>• **D3** — the fabricated `DSR/26-190` corrected to voucher **No. 477** in **all 9 occurrences**; each retains a dated correction note.<br>• **D4** — `docs/README.md` index added.<br>• **D5** — `current-plan/12-open-business-decisions.md` cross-referenced to this folder, with a disposition table for §1.1–1.12.<br>• **D6** — provenance legend added to `07-traceability/requirements-traceability.md`.<br>**Also corrected:** the "35 modules" figure, which conflated 35 web pages with permission modules. Actual: **33**. |
| **Security / integrity** | No credentials in documentation anywhere. Seed must never write business rows without opt-in. |
| **Acceptance** | No top-level doc contradicts verified source. No uncorrected `DSR` reference survives. `pnpm db:seed` on a fresh database creates **zero** cargo, customers, vessels, voyages and load lists. Test status unchanged from the P0 baseline. |
| **Testing** | Seed idempotency (run twice); seeded-row assertion with the flag unset; existing suites still pass |
| **Risks** | **R-06** seed ships demo data · **R-11** enum/field migration could lose data · **R-15** legacy behaviour mistaken for a requirement · Rewriting history: corrections must be **additive and dated**, never silent overwrites |
| **Known blockers** | None — the documentation half can start immediately |
| **Exit conditions** | Corrections merged; seed split merged; suite green at baseline |

---

### Phase 2 — Numbering configuration

| Field | Content |
|---|---|
| **Scope** | Make every document number format configurable data rather than a hard-coded string in a service. |
| **Prerequisites** | P0 |
| **Dependencies** | P0 only — fully independent |
| **Requirements** | DEC-024…DEC-028 · AUD-013 · ADR-008 · REQ-102, REQ-040, REQ-103, REQ-114, C-01…C-07 |
| **Deliverables** | All 14 document types on `NumberingService`; seeded sequence rows; per-type tests |
| **Major tasks** | Migrate the 11 remaining types (`invoice`, `proforma`, `quotation`, `voucher`, `cargo`, `inspections`, `load-planning`, `actual-loading`, `discharge`, portal bookings, salary) one at a time. For each: record current output, seed a `NumberingSequence` reproducing it byte-for-byte, swap the local generator for `allocateNumber()`, verify before/after, delete the local generator. Then re-seed formats from verified real samples: B/L `KHS/26-110`, Manifest `DSMAN/KHO-26-006`, Invoice `DSINV/26-172`, Proforma `DSPRO/26-001`, Quotation `DSQUO/25-017`, Voyage `02/26`, Voucher **`477`** (plain numeric). Add the **vessel** component to the voyage scope key (REQ-040). Preserve the `DSMAN/…` vs `DSKHS-…` manifest conflict as a documented open item. |
| **Security / integrity** | Issued numbers must never be rewritten (DEC-026). Concurrency handled by `SELECT … FOR UPDATE`, not retry. |
| **Acceptance** | 14/14 types allocate through `NumberingService`. No local `generateReference()` remains. Generated numbers are format-indistinguishable from those generated before the change. Under concurrent allocation: no duplicate, no 409. |
| **Testing** | Per type: sequence continuity; concurrency (two simultaneous allocations); month/year rollover with a fixed clock; format match |
| **Risks** | **R-14** numbering concurrency/duplicates · **R-03** a format change must not rewrite issued numbers · Backfill risk: seeding the wrong format produces numbers that look authoritative and are wrong |
| **Known blockers** | Customer code format (C-06) unresolved — mitigated because the format is configurable |
| **Exit conditions** | 14/14 migrated; format and concurrency tests green |

---

### Phase 3 — Invoice correctness, tax, and controlled correction

| Field | Content |
|---|---|
| **Scope** | Per-line VAT; Invoice↔Job and Invoice↔B/L relationships; TRN on the invoice; controlled correction for invoices. |
| **Prerequisites** | P0 |
| **Dependencies** | P0. Independent of P4/P5. |
| **Requirements** | DEC-019…DEC-023, DEC-068…DEC-072, DEC-100…DEC-105 · AUD-001, AUD-002, AUD-003 · REQ-134, REQ-141, REQ-143/144/145/147 |
| **Deliverables** | Per-line VAT; `InvoiceJob` join; `InvoiceBill` join; TRN capture; invoice correction workflow |
| **Major tasks** | Add `taxRate`/`taxAmount` to `invoice_items`; recompute header VAT as the sum of line VAT; backfill issued invoices from the header rate so historical totals are **unchanged**. Add `InvoiceJob (invoiceId, jobId)` and `InvoiceBill (invoiceId, billOfLadingId)` joins. Add TRN to the invoice (sourced from company settings). Implement controlled invoice correction (credit note and/or cancellation-and-reissue) preserving the original record, reason, user, timestamp, approval and links. |
| **Security / integrity** | **An issued invoice's stored money fields must never be silently recomputed** (DEC-023, DEC-102). Correction requires permission and, where configured, manager approval. Tax configuration changes must not recalculate historical invoices. |
| **Acceptance** | An invoice with lines at 0% and 5% produces correct per-line VAT, header VAT equal to their sum, and an unchanged total formula. A previously issued invoice re-fetched after migration returns byte-identical money fields. An invoice lists the Jobs and B/Ls it covers; a Job lists the invoices billing it. A draft saves with optional fields empty (REQ-200). A correction preserves the original and permits before/after reconstruction. |
| **Testing** | Multi-rate invoice; historical invoice immutability; job and B/L linkage both directions; correction round-trip with audit |
| **Risks** | **R-03** historical invoices must not be silently recomputed (highest-consequence risk in this phase) · **R-02** correction paths could break existing balances · **R-11** adding per-line tax fields is a schema migration |
| **Known blockers** | None — all cardinalities are decided |
| **Exit conditions** | Per-line VAT live and tested; linkages implemented; correction workflow live; historical invoices provably unchanged |

---

### Phase 4 — Company settings, attachments and sensitive assets

| Field | Content |
|---|---|
| **Scope** | Make company identity maintainable; make file attachment actually work; establish sensitive-asset controls. |
| **Prerequisites** | P0 |
| **Dependencies** | P0. Independent of P3/P5. **Required before P8.** |
| **Requirements** | DEC-087…DEC-092 · AUD-006, AUD-008 (settings half) · REQ-146/147/168/170 |
| **Deliverables** | Company-settings module and UI; attachments module with storage adapter; asset permissions and audit |
| **Major tasks** | Settings module: read/update `CompanySettings` (company name, legal name, registration number, **TRN**, address, city, country, phone, email, default and supported currencies), admin-permissioned. Attachments: storage-adapter interface (local now, S3-shaped later), upload/download/delete endpoints, MIME allow-list, size cap, permission codes, **signed short-lived URLs — never public**. Bind `category` values for voucher and salary-slip identity documents. Record the retention and access decision **before enabling production ID capture**. |
| **Security / integrity** | Identity documents are permission-restricted and audited; no public URLs; not included in ordinary reports or notifications. Retention periods are a compliance input — do not invent. |
| **Acceptance** | TRN and company address editable in the product and readable by the document layer. An identity document can be attached to a voucher and retrieved **only** by an authorised user. MIME and size rejections enforce. |
| **Testing** | Settings round-trip; upload/retrieve/delete; MIME and size rejection; permission enforcement on identity documents; URL expiry |
| **Risks** | **R-10** sensitive documents without a retention policy · **R-01** no credentials in docs or storage config · Attachment storage leakage via public URLs |
| **Known blockers** | Retention periods (compliance input) block **production enablement** of ID capture only — not the build |
| **Exit conditions** | Settings editable; attachments working end to end; asset permissions enforced |

---

### Phase 5 — Documents: release/delivery, B/L lifecycle, agent portal

| Field | Content |
|---|---|
| **Scope** | Release Order as the release authorization; Delivery Order completeness; B/L lifecycle labels; agent portal visibility. |
| **Prerequisites** | P0 |
| **Dependencies** | P0. Independent of P3/P4. Approval workflow framework from P9 needed for release exceptions. |
| **Requirements** | DEC-059…DEC-063, DEC-073…DEC-077 · AUD-010, AUD-019, AUD-022 · REQ-105, REQ-181/182/183, REQ-186, REQ-187/188 |
| **Deliverables** | Release payment state; configurable release approval; Delivery Order port field; agent portal B/L + Manifest + Release views |
| **Major tasks** | Add payment state (**Paid / Partial / Unpaid-credit** per EMP-685-690) to `ReleaseOrder`. Add a configurable approval step for release exceptions (approver identity is configuration, not invented). Add the **port** field to `DeliveryOrder` (REQ-186). Expose agent-scoped B/L, Manifest and Release Order read endpoints using the existing `portalAgentId` scope, and a portal page showing release status. Keep B/L lifecycle **labels configurable** (draft → correction → approval/finalization → issuance). Clean up the customer-linked portal path so it reports an explicit, explained empty state rather than a silent blank. |
| **Security / integrity** | Agent scoping is a data-partition boundary — cross-destination leakage is the principal risk. Release approval must not bypass the financial-override audit. |
| **Acceptance** | An agent for destination D sees only D's documents; a second agent for E sees only E's; no endpoint leaks across destinations — **proven by test, not inspection**. An agent can answer "has my B/L been released?" from the portal. A Release Order records and reports its payment state. |
| **Testing** | Cross-destination isolation tests (mandatory); release-state transitions; approval audit; unauthenticated/denied access |
| **Risks** | **R-09** a configurable approval must not become a bypass (**fail closed**) · Cross-destination data leakage in the agent portal — the principal security risk in this phase · **R-15** do not copy legacy release defects |
| **Known blockers** | Official B/L status labels unconfirmed — mitigated because labels are configurable |
| **Exit conditions** | Release state live; portal visibility live; isolation tests green |

---

### Phase 6 — Financial core: ledger, allocation, multi-currency

| Field | Content |
|---|---|
| **Scope** | Accounting entries and general ledger; payment allocation and advances; multi-currency with dated rates. |
| **Prerequisites** | P0, P3 (invoice shape settled) |
| **Dependencies** | P3. **Must complete before P7.** Highest-risk phase. |
| **Requirements** | DEC-001…DEC-018, DEC-078…DEC-081 · AUD-004, AUD-005, AUD-007, AUD-023 · REQ-160…167, REQ-195 |
| **Deliverables** | Accounting-entry model; general journal; expense capture; `VoucherAllocation` with per-reference amounts; advances/credit; `CurrencyRate` with effective dates and sources |
| **Major tasks** | Introduce the accounting-entry model **additively** (DEC-081) — do not alter how existing invoices and vouchers compute the statement. Add journal posting (money out = debit, money in = credit per REQ-166). Add expense capture with categories for office/daily costs. Add `VoucherAllocation (voucherId, invoiceId?, billOfLadingId?, amount)` plus `Voucher.billOfLadingId`; support manual and configurable automatic allocation (oldest-first is an example policy, not a rule). Add advances and unallocated credit. Add `CurrencyRate` (currency, effective date, rate, source) with permission-controlled creation, override and audit. Preserve original amount/currency, applied rate, effective date/source and base equivalent on every transaction. |
| **Security / integrity** | Highest risk in the programme. **No historical balance may move without an explicit, logged adjustment.** Additive schema only. Dual-run with reconciliation before any read-path switch. Rate changes audited. REQ-165 must not regress. |
| **Acceptance** | A loan, an adjustment and an office expense can each be posted and seen in the ledger. A payment allocates across several invoices with per-reference amounts; a partially allocated payment leaves the remainder as credit; an **unallocated** payment posts without error. **For every customer that existed before this phase, the statement is numerically identical to the derived statement — proven by reconciliation, not assertion.** A historical transaction is unchanged after a rate change. |
| **Testing** | Journal posting both directions; allocation and reallocation; unallocated no-error regression test; **derived-vs-posted reconciliation across all pre-existing customers**; rate-change immutability; permission enforcement on posting and rate override |
| **Risks** | **R-02** financial correctness — the single highest risk in the programme · **R-04** currency mixing · **R-11** additive migration must not move a historical balance · **R-15** legacy had no ledger, so there is nothing to inherit |
| **Known blockers** | Unrealised-FX-gain policy is an accounting-policy question — recommend deferring to architecture |
| **Exit conditions** | Reconciliation proves no historical change; journal, allocation and rates live and tested |

---

### Phase 7 — Reporting

| Field | Content |
|---|---|
| **Scope** | Standard reports, voyage/manifest P&L, VAT report, custom report builder, exports, traceability. |
| **Prerequisites** | **P3, P6** (and therefore P0) |
| **Dependencies** | P3 (per-line VAT; B/L and Job links), P6 (expense side, rates, accounting entries) |
| **Requirements** | DEC-037…DEC-043 · AUD-009 · REQ-154, REQ-160…162, REQ-183, REQ-184, REQ-190…194 |
| **Deliverables** | `reports` module; standard report set; custom report builder with save/reuse/export; permission-aware field protection |
| **Major tasks** | Cost capture on voyage/manifest using the confirmed configurable categories (**Vessel Hire, Port Use, Port Handling, Lashing, other** — not the legacy columns). Income rollup from invoices against a voyage's B/Ls. Per-manifest P&L. Filterable annual view. Quarterly VAT report (VAT collected vs paid) using preserved line-level tax. Customer statements over arbitrary date ranges. Overdue and unpaid-release reports. Release report. Custom report builder with columns, filters, grouping, sorting, date ranges, relationships and calculated values; Excel and PDF export. |
| **Security / integrity** | Reports respect permissions and mask sensitive fields. Every financial figure must be traceable to transaction, allocation, rate and accounting entry. **A balance summary must never be presented as the ledger.** |
| **Acceptance** | Each report reconciles against a manually computed example — **a report that cannot be reconciled is not shipped**. Cross-currency figures state their conversion rule. Reports are permission-gated. A figure can be drilled back to its source entries. |
| **Testing** | Hand-computed P&L for one manifest reproduced exactly; VAT report reconciled to invoice and expense VAT; filtered total equals unfiltered total when no filter applied; permission enforcement on sensitive fields |
| **Risks** | **R-04** cross-currency figures without stated conversion rules · **R-02** a report that reconciles to nothing is worse than no report · **R-12** reporting scope may not cover every requirement |
| **Known blockers** | None, provided P3 and P6 are complete |
| **Exit conditions** | All standard reports reconcile against manual examples; builder live; exports working |

---

### Phase 8 — Templates and document output

| Field | Content |
|---|---|
| **Scope** | Template management and versioning; PDF/Excel/Print generation; historical output preservation; stamp behaviour. |
| **Prerequisites** | P4 (company settings and assets) |
| **Dependencies** | P4. Can overlap P6/P7. |
| **Requirements** | DEC-093…DEC-099 · AUD-008 · REQ-120…125, REQ-146/147 |
| **Deliverables** | Rendering capability; template CRUD, versioning, preview, assignment; PDF/Excel/Print per document type; rendered-output preservation |
| **Major tasks** | Choose the rendering stack (technical decision, informed by the samples). Wire `DocumentTemplateVersion` properly (currently orphaned). Build template upload, versioning, preview, deactivation and assignment. Support the two output modes per document: **PDF with stamps/marks/signature** and **Print without them** (REQ-122 — counter-intuitive but stated three times; do not "correct"). Support Excel output (REQ-123). Bind company assets (letterheads, logos, stamps, signatures). Preserve template version and, where required, rendered historical output so a later template change cannot alter an issued document's appearance. Cover all **11** catalog types. |
| **Security / integrity** | Template editing and approval are permission-controlled and audited. Company assets are not exposed via public URLs. Historical rendered output is immutable. |
| **Acceptance** | Every document screen offers PDF, Excel and Print. Company assets render. **Print output provably contains no stamp/signature layer; PDF provably does.** Excel opens and preserves data. Template version switching changes output; issued documents are unaffected by later template changes. |
| **Testing** | Each of the 11 types renders in all three modes; stamp presence/absence assertions; template version switching; issued-document immutability |
| **Risks** | **R-07** missing official templates — fidelity validation pending, not passed · **R-03** a template change must not alter an issued document · **R-15** do not reproduce legacy template defects (e.g. the hard-coded vessel name) |
| **Known blockers** | **Official templates missing (REQ-125)** — blocks final fidelity validation only; does not block the build |
| **Exit conditions** | All 11 types render in all three modes; versioning and preservation verified; templates collected and validated when available |

---

### Phase 9 — Configuration and extensibility

| Field | Content |
|---|---|
| **Scope** | Custom fields; managed option lists; configurable document types; configurable workflows, statuses and approvals. |
| **Prerequisites** | P0. Benefits from P5/P6 being settled. |
| **Dependencies** | Independent of P7/P8. Provides the approval framework used by P5 release exceptions and P6 corrections. |
| **Requirements** | DEC-029…DEC-036, DEC-059…DEC-063 · REQ-200 |
| **Deliverables** | `CustomField` and option-list management; `DocumentType` configuration; workflow/status/approval engine |
| **Major tasks** | Custom fields with data type, required/optional, validation, display location and ordering, visibility rules, view/edit permissions, filtering and search, reporting and export behaviour, applicable entity types, effective dating. Managed option lists with add/edit/deactivate/reactivate. Document-type configuration (display name, category, fields, numbering, templates, permissions, workflow, approvals, relationships, reporting). Workflow engine: statuses and labels, allowed transitions, role-based permissions, conditions, approval steps, exception handling, audit. **Ensure historical values survive option and field changes.** |
| **Security / integrity** | **Invariant (DEC-036, DEC-063, DEC-114): configuration must never bypass core financial, authorization, data-integrity or audit controls.** Enforced server-side and covered by tests. Official status labels are not invented (DEC-060). |
| **Acceptance** | An administrator can add a field and an option without code. Deactivating an option prevents new use but preserves existing records. A configured workflow enforces its transitions and approvals. Attempts to configure a bypass of a core control are rejected. |
| **Testing** | Field/option lifecycle; historical value preservation; transition enforcement; approval gating; **negative tests proving core controls cannot be configured away** |
| **Risks** | **R-09** configuration bypassing core controls — mitigated by explicit negative tests · **R-03** historical values must survive option and field changes · **R-15** do not invent official status labels |
| **Known blockers** | None |
| **Exit conditions** | Custom fields, option lists, document types and workflows all live; bypass tests pass |

---

### Phase 10 — Notifications, master data and data hygiene

| Field | Content |
|---|---|
| **Scope** | Configurable notifications; ports and party master-data conformance; resolution of duplicate columns and enum conflicts; deletion/deactivation policy. |
| **Prerequisites** | P0; P5/P6 for meaningful notification triggers |
| **Dependencies** | Independent of P7/P8. Uses the P9 workflow engine if available. |
| **Requirements** | DEC-049…DEC-058, DEC-064…DEC-067, DEC-073…DEC-076 · AUD-011, AUD-012, AUD-015, AUD-016, AUD-018 · REQ-017, REQ-030/031 |
| **Deliverables** | Notification engine with configurable rules; corrected master data; cleaned schema; deletion/deactivation policy |
| **Major tasks** | Notifications: rules with triggers, conditions, recipients/roles, timing, delay, repeat intervals and frequency limits, escalation, channels (in-app + email), enable/disable, delivery status and audit. **Thresholds are configurable — EMP-148/149/692 are examples and must not be hard-coded.** Ports: seed the 8 evidenced ports; add display name and aliases; backfill city and abbreviation; verify zero nulls; then apply `NOT NULL`. Customer: remove or repurpose `type` to the natural/legal distinction; remove `shortName`, `taxId`, `currency` (REQ-017). Cargo: resolve duplicate columns via expand/contract (confirm writers → backfill canonical → switch reads → drop later). Load list: align enum to ADR-041 with a **verified mapping**. Implement deletion/deactivation policy with dependency and retention checks. |
| **Security / integrity** | Hard deletion only where no significance, dependency, accounting consequence or retention obligation exists. Deletion/deactivation/reactivation audited. Master-data changes must not rewrite historical documents (DEC-066). |
| **Acceptance** | A notification rule can be created, scheduled, repeated and disabled; in-app and email both deliver. Ports conform to the required display format with mandatory fields. Customer no longer carries prohibited fields. No duplicate Cargo columns remain unexplained. No record can be hard-deleted where dependencies exist. |
| **Testing** | Notification rule lifecycle and channel delivery; port backfill and constraint application; Cargo before/after data equivalence; deletion dependency rejection; audit of deactivation |
| **Risks** | **R-11** data migration on enum/field changes (highest risk here) · **R-06** seed demo data · **R-03** master-data changes must not rewrite historical documents |
| **Known blockers** | Complete port list and remaining abbreviations; Bandar Abbas vs Rajaee disambiguation — both affect the constraint step only |
| **Exit conditions** | Notifications live; master data conformed; duplicates resolved; deletion policy enforced |

---

### Phase 11 — Security hardening and audit

| Field | Content |
|---|---|
| **Scope** | Complete the audit event coverage; make audit tamper-resistant; complete the permission model; least-privilege review. |
| **Prerequisites** | Most capability phases, so the full event surface is known |
| **Dependencies** | Benefits from P4, P6, P9, P10 |
| **Requirements** | DEC-044…DEC-048, DEC-106…DEC-114 |
| **Deliverables** | Full audit event coverage; append-only enforcement; completed permission codes; security review |
| **Major tasks** | Implement the DEC-045 event list (postings, corrections, allocation and reallocation, B/L changes and finalization, cancellation and reissue, rate changes and overrides, release decisions and exceptions, approval outcomes, permission and role changes, custom-field and option-list changes, document-type/numbering/template changes, archive/reopen/delete/deactivate, sensitive-asset access). Enforce append-only at the **database** layer: revoke `UPDATE`/`DELETE` on the audit table from the application role; add a separate export role; consider hash-chaining. Add the permission codes identified in `target-security-audit-reporting.md` §7. Review least-privilege across all roles. Verify server-side permission enforcement on every endpoint. |
| **Security / integrity** | Audit must resist alteration by ordinary users **and administrators**. Permissions enforced server-side, never only in the UI. |
| **Acceptance** | Every DEC-045 event is emitted and captured. An administrator **cannot** update or delete an audit row through the application. Audit export is separately permissioned and itself logged. No endpoint relies on UI-only enforcement. |
| **Testing** | Event coverage matrix; **negative tests: administrator update/delete on audit records is rejected**; permission enforcement per endpoint; privilege-escalation attempts |
| **Risks** | **R-08** audit log not tamper-resistant · **R-09** permission gaps leaving endpoints unguarded · Privilege escalation through incomplete server-side enforcement |
| **Known blockers** | None |
| **Exit conditions** | Audit coverage complete and tamper-resistant; permission model complete; review signed off |

---

### Phase 12 — Archive, retention, backup and recovery

| Field | Content |
|---|---|
| **Scope** | Manual and automatic archiving; configurable retention; controlled reopening; scheduled backups with tested restoration. |
| **Prerequisites** | P11 (so archive/reopen/delete actions are auditable) |
| **Dependencies** | P11 |
| **Requirements** | DEC-049…DEC-055, DEC-082…DEC-086, DEC-091 |
| **Deliverables** | Archive capability; retention configuration; reopening workflow; scheduled backups with restore testing; documented recovery procedure |
| **Major tasks** | Manual and automatic archiving with configurable criteria. Retention configuration **subject to legal, accounting, security and dependency constraints** — periods are an input, not invented. Archived records remain searchable per permissions. Reopening requires authorization and records reason and history; subsequent edits remain subject to permissions, approvals and audit. Backups: scheduled and manual, configurable retention, storage **separate from the primary server**, access-controlled and logged, monitored with failure notifications, periodic restoration tests, documented recovery procedure, coverage for database + uploaded files + generated documents + templates + sensitive assets, integrity verification, preserved access controls on recovery. Establish RPO/RTO during infrastructure design (DEC-054). |
| **Security / integrity** | Archive status must not become a bypass for retention, dependency, accounting or audit obligations (DEC-086). Backup access is restricted and audited. **A backup is not proven until restored (DEC-055).** |
| **Acceptance** | A record can be archived automatically and manually; an archived record remains findable by an authorised user; reopening requires authorization and is logged; deletion is refused where retention or dependencies apply. A backup completes, is stored off-server, and a **restore is executed successfully** from it. Recovery procedure documented. |
| **Testing** | Archive/reopen/delete lifecycle; retention enforcement; **full restore rehearsal on a schedule**; integrity verification; access-control preservation after restore |
| **Risks** | **R-13** backup untested until restored · **R-10** retention periods are a compliance input, not a technical choice · **R-03** archive must not become a bypass for retention or audit obligations |
| **Known blockers** | Legal/accounting retention periods (compliance input) affect configuration only |
| **Exit conditions** | Archiving and retention live; backups scheduled and **restore rehearsed and documented** |

---

## 3 · Requirements coverage check

Every confirmed decision group maps to at least one phase:

| Decision group | Phases |
| --- | --- |
| Multi-currency (DEC-001…012) | P6, P7 |
| Payments, advances, allocation (DEC-013…018) | P6 |
| Controlled financial corrections (DEC-019…023) | P3, P6, P11 |
| Document numbering (DEC-024…028) | P2 |
| Custom fields and option lists (DEC-029…033) | P9 |
| Document types and workflows (DEC-034…036, DEC-059…063) | P9, P5 |
| Reporting (DEC-037…043) | P7 |
| Audit logging (DEC-044…048) | P11 |
| Deletion and deactivation (DEC-049…052) | P10, P12 |
| Backup and recovery (DEC-053…055) | P0, P12 |
| Notifications (DEC-056…058) | P10 |
| Ports and reference data (DEC-064…067) | P10 |
| Job model (DEC-068…072) | P3 |
| Parties and contacts (DEC-073…077) | P5, P10 |
| General ledger (DEC-078…081) | P6 |
| Archive and retention (DEC-082…086) | P12 |
| Sensitive assets (DEC-087…092) | P4, P12 |
| Templates and output (DEC-093…099) | P8 |
| Documents and tax (DEC-099…105) | P3, P8 |
| Security (DEC-106…114) | P11, all |

---

## 4 · Unverified requirements carried into the roadmap

Of the 127 requirements in the traceability matrix, 57 are not ✅. This audit verified and routed 24 into
phases. **33 remain unverified** and are enumerated with provisional phase routing below. Phases P2, P3, P7, P8
and P10 must be treated as **incomplete in detail** until these rows are checked against code.

| Req | Status | Requirement (abridged) | Phase |
|---|---|---|---|
| REQ-002 | 🟡 | Sidebar sections expand as an accordion | P10 |
| REQ-004 | ❌ | A "Company Archive" area exists | P12 |
| REQ-015 | 🟡 | Exact Customer code format unresolved | P2 |
| REQ-038 | ❌ | Vessel carries optional IMO; absence must not block saving | P10 |
| REQ-039 | ❌ | Vessels are owned, chartered per trip, or other | P10 |
| REQ-040 | 🟡 | Voyage number `n/yy` per vessel + destination + year | P2 |
| REQ-052 | ❌ | National ID and TRN in one field separated by a slash | P10 |
| REQ-056 | 🟡 | Agent details printed on B/L, varying by destination | P8 |
| REQ-063 | ❌ | Document Status records the paperwork cargo entered with | P10 |
| REQ-064 | ❌ | Other document types: Export Paper and similar | P10 |
| REQ-067 | 🟡 | Operations write Comment; accounting must read it | P10 |
| REQ-071 | 🟡 | "Nagle" means accompanying loose pieces | P10 |
| REQ-083 | 🟡 | Pending inspection visually highlighted (e.g. red) | P10 |
| REQ-091 | 🟡 | Load List columns: loading port, destination, description, chassis, serial… | P8 |
| REQ-102 | 🟡 | B/L numbering per destination | P2 |
| REQ-103 | 🟡 | Exact B/L number format unresolved | P2 |
| REQ-106 | ⏳ | B/L sent to the customer as a finished document | P8 |
| REQ-107 | 🟡 | Manifest may include partner/forwarder B/Ls | P8 |
| REQ-110 | 🟡 | Manifest header: vessel, voyage, ports, manifest number, date | P8 |
| REQ-111 | 🟡 | Manifest rows numbered with B/L number, goods, weights | P8 |
| REQ-112 | 🟡 | Last manifest page prints total units, packages, weight | P8 |
| REQ-113 | ⏳ | Manifest printed and stamped; a PDF copy is sent | P8 |
| REQ-114 | 🟡 | Manifest numbers system-generated in a company-defined format | P2 |
| REQ-125 | ❌ | Uploaded templates are not present in the repository | P8 |
| REQ-131 | ❌ | Job for ETOZ/ETDZ work | P3 |
| REQ-140 | 🟡 | Invoice produced two ways | P3 |
| REQ-143 | 🟡 | Invoice totals block: Subtotal, VAT, Total Amount | P3 |
| REQ-145 | ❌ | Some invoices carry VAT and some do not; separate them | P3 |
| REQ-154 | ❌ | Overdue invoices raise an alarm or report | P7 |
| REQ-181 | 🟡 | Release Order rows show B/L, consignee, goods, released status | P8 |
| REQ-182 | 🟡 | Release Order records payment condition at release | P5 |
| REQ-183 | ⏳ | A Release Report shows what was released per B/L/Manifest | P7 |
| REQ-186 | 🟡 | Delivery Order carries number, date, Customer and Port | P5 |

**Corrections applied to this list:** REQ-102 is **already implemented** (per-destination scoping) — only the
format needs re-seeding. REQ-040 is **partially implemented** (destination + year; vessel component missing).
REQ-143 and REQ-145 are **confirmed by evidence** (EMP-612/614/617) and no longer open questions. REQ-182 is
**confirmed** by EMP-685-690.

---

## 5 · Revalidation record (2026-10-11)

This section records a formal re-read of P0–P12 against `confirmed-decisions.md`, the requirement IDs,
`implementation-gap-analysis.md` and `risk-register.md`. **Each check was executed, not assumed.**

### 5.1 Structural check — every phase carries every required field

Verified programmatically across all 13 phases:

| Field | Present in |
| --- | --- |
| Scope · Prerequisites · Dependencies · Requirements · Deliverables · Major tasks | **13/13** |
| Security / integrity · Acceptance · Testing · Known blockers · Exit conditions | **13/13** |
| **Risks** | **13/13** (row added 2026-10-11 — previously implied by "Known blockers") |

### 5.2 Decision coverage

| Check | Result |
| --- | --- |
| Decisions defined in `confirmed-decisions.md` | **114** (`DEC-001`–`DEC-114`, no gaps) |
| Cited by at least one phase (P0–P12) | **114 / 114** |
| Covered by the §3 decision-group table | **114 / 114** |
| Decisions cited but never defined (dangling) | **0** — three earlier dangling references (`DEC-118/120/121`) were retargeted onto real decisions |

### 5.3 Ordering constraints — each one traced to its evidence

| # | Constraint | Verified | Evidence |
| --- | --- | --- | --- |
| 1 | Currency-rate infrastructure precedes rate-history-dependent functionality | ✅ **P6 before P7** | No `CurrencyRate` model exists (verified: `grep` against `prisma/schema.prisma` = 0). Cross-currency reporting is impossible without recorded rates (`DEC-004/006`, AUD-023) |
| 2 | Per-line tax precedes dependent tax reporting | ✅ **P3 before P7** | `InvoiceItem` has no per-line tax fields; the VAT report (`REQ-194`) needs line-level tax (`DEC-101`) |
| 3 | Invoice↔Job and Invoice↔B/L precede income reporting | ✅ **P3 before P7** | Neither join model exists. Income rollup (`REQ-192`) = invoices against a voyage's B/Ls |
| 4 | Accounting entries precede financial statements | ✅ **P6 before P7** | No posting model exists (`LedgerEntry` absent by design). P&L expense side (`REQ-190/191`) needs posted costs (`DEC-078`) |
| 5 | Company settings and approved assets precede template work | ✅ **P4 before P8** | `CompanySettings` has **no API surface** (verified: no `settings` module), so TRN is unmaintainable; printed tax invoices need it (`REQ-146/147`). Company assets must be managed before templates consume them (`DEC-087`) |
| 6 | A verified, restorable backup exists before schema-changing work | ✅ **P0 gates everything** | `DEC-055`. P0's exit condition requires an **executed restore**, not merely a backup file |
| 7 | Sensitive-data restrictions explicitly represented | ✅ **P4 + P12 + OQ-12** | P4 requires signed short-lived URLs, permission-restricted access and audit; P12 holds retention. Production enablement is gated on a compliance input that must not be invented |
| 8 | Release-approval restrictions explicitly represented | ✅ **P5 + P9 + OQ-06** | P5 adds the three payment states and a **configurable** approval step; P9 supplies the workflow engine. **Fails closed — no default approver may be invented** |
| 9 | Workflow/approval framework precedes release exceptions | ✅ **P9 before P5's exception path** | Recorded in the risk-register dependency table |
| 10 | Seed-dependency measurement precedes the seed split | ✅ **P0 before P1** | Removing demo rows must not break suites (Q-AUD-11, R-05/R-06) |

### 5.4 No fabrication check

| Prohibited | Result |
| --- | --- |
| Delivery dates, durations, sprints or deadlines | **None present.** Sequenced by dependency only |
| Company policies presented as confirmed | **None.** Where a technical preference exists (OQ-11 soft delete; OQ-15 defer FX policy) it is labelled a **recommendation**, not company policy |
| Official document formats asserted | **None.** `KHS/26-110`, `DSMAN/KHO-26-006`, `DSINV/26-172`, `DSPRO/26-001`, `DSQUO/25-017`, voyage `02/26` and voucher **`477`** are all **verified samples**. Unverified formats remain open (OQ-01/02/03) |
| Legal retention periods | **None.** Explicitly a compliance input (OQ-12) |
| Approval authorities | **None.** Explicitly configuration (OQ-06) |
| Test results | **None.** The suite was never executed; `403/403` is recorded as **UNVERIFIED** and P0 exists to measure it |

### 5.5 Gaps found during revalidation

| # | Gap | Action taken |
| --- | --- | --- |
| 1 | Phases had no explicit **Risks** row | **Fixed** — added to all 13, cross-referenced to `risk-register.md` R-01…R-15 |
| 2 | P1's task list described documentation corrections as outstanding after they had been applied | **Fixed** — P1 now records D1–D6 as **done 2026-10-11** |
| 3 | "160 codes / 35 modules" was wrong (conflated 35 web pages with permission modules) | **Fixed** — corrected to **33 modules** in all 6 affected files |
| 4 | `open-questions.md` and `question-reconciliation.md` each listed 12 open items, **but not the same 12** | **Fixed** — merged to **15** items (`OQ-01`…`OQ-15`); discrepancy documented in both files |
| 5 | The 33 unverified requirements in §4 are routed to phases but **not verified against code** | **Open by design** — noted as a P0/P1 activity. Phases P2, P3, P7, P8 and P10 remain **incomplete in detail** until then |

### 5.6 Verdict

The roadmap is **internally consistent and correctly ordered**. All 114 confirmed decisions are mapped; all
ten ordering constraints hold against verified evidence; no dates, policies, formats or results are
fabricated.

**Two caveats stand, and are recorded rather than resolved:**

1. **Sequencing is a proposal, not an approved plan.** Dependencies constrain the order; the final order
   still requires owner sign-off.
2. **Detail in P2, P3, P7, P8 and P10 is provisional** until the 33 unverified requirements in §4 are checked
   against code. Do not treat those phases' task lists as complete.
