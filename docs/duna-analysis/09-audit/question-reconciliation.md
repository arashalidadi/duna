# Question and Source-Finding Reconciliation Matrix

**Status:** Canonical. Complete disposition of every question raised during the audit.
**Created:** 2026-10-11. Documentation only.

Every item records: (1) ID and original meaning · (2) original concern · (3) evidence and location ·
(4) confirmed answer or decision · (5) classification · (6) documentation correction required ·
(7) implementation status · (8) remaining work · (9) requirement IDs and phase · (10) final status.

**Final status values:** `RESOLVED` · `RESOLVED (DESIGN DECISION)` · `PARTIALLY RESOLVED` ·
`EVIDENCE MISSING` · `IMPLEMENTATION PENDING` · `GENUINELY OPEN`.

---

## Master disposition table

| ID | Subject | Final status | Phase |
|---|---|---|---|
| Q-AUD-01 | Invoice ↔ Job cardinality | RESOLVED — many-to-many | P3 |
| Q-AUD-02 | Invoice ↔ B/L cardinality | RESOLVED (DESIGN) — both single and multi | P3 |
| Q-AUD-03 | Derived vs posted ledger | RESOLVED (DESIGN) — real GL required, additive migration | P6 |
| Q-AUD-04 | Voucher multi-document allocation | RESOLVED (DESIGN) — allocations per reference | P6 |
| Q-AUD-05 | Attachment storage | RESOLVED (DESIGN) — abstracted adapter, local first | P4 |
| Q-AUD-05b | ID-document retention/access/security | RESOLVED (DESIGN) — controls confirmed; periods configurable | P4/P12 |
| Q-AUD-06 | Render approach + templates | PARTIALLY RESOLVED — approach decidable; templates missing | P8 |
| Q-AUD-07 | Which B/L status means "released" | RESOLVED — Release Order is the authorization | P5 |
| Q-AUD-08 | Is REQ-017 reversed? | RESOLVED — not reversed; requirement stands | P10 |
| Q-AUD-09 | Real port list | PARTIALLY RESOLVED — 8 ports, 3 codes; full list open | P10 |
| Q-AUD-10 | Ports/yards: seed or operator data? | RESOLVED (DESIGN) — operator-managed, seeded as reference | P10 |
| Q-AUD-11 | Do tests depend on demo seed rows? | IMPLEMENTATION PENDING | P0 |
| Q-AUD-12 | Load list: 3 states or 6? | IMPLEMENTATION PENDING (ADR-041 authoritative) | P10 |
| Q-AUD-13 | Unpaid-release threshold | RESOLVED (DESIGN) — configurable | P10 |
| Q-AUD-14 | Reminder delivery channel | RESOLVED (DESIGN) — configurable, in-app + email | P10 |
| Q-AUD-15 | Six nav sections or ten? | RESOLVED (DESIGN) — discrepancy preserved, no deletion | P1 |
| Q-AUD-16 | Portal: customers too? | RESOLVED — agents only | P5 |
| Q-AUD-17 | Manifest cost categories | RESOLVED — 5 named categories | P7 |
| Q-AUD-18 | Default currency | RESOLVED (DESIGN) — configurable; AED not universal | P6 |
| Q-AUD-19 | Multi-currency reporting required? | RESOLVED (DESIGN) — yes, at least 5 currencies | P6 |
| Q-AUD-20 | Invoice correction flow | RESOLVED (DESIGN) — controlled correction workflows | P3/P6 |
| Q-AUD-21 | Release override policy | PARTIALLY RESOLVED — states confirmed; approver configurable | P5 |
| Q-AUD-22 | Delivery Order eligibility | RESOLVED — discharged-at-facility scenario | P5 |
| Q-AUD-23 | Job creation trigger | RESOLVED (DESIGN) — manual + configurable auto | P3 |
| Q-AUD-24 | Contact ownership | RESOLVED — per Shipper/Consignee/Agent | P10 |
| Q-AUD-25 | Archive retention & reopening | RESOLVED (DESIGN) — configurable, periods not invented | P12 |
| Q-AUD-26 | VAT rates & applicability | PARTIALLY RESOLVED — per-line confirmed; rates open | P3 |
| Q-AUD-27 | Agent portal extra capabilities | RESOLVED — B/L, Manifest, Release Order minimum | P5 |
| SRC-01 | `/home/duna/dunaData/` missing | **WITHDRAWN** — materials present under new paths | — |
| SRC-02 | `shipping_documents_detailed_reference.md` | **DOWNGRADED** — partial coverage confirmed | — |
| SRC-03 | Legacy DB dump | EVIDENCE MISSING (non-blocking) | — |
| SRC-04 | Legacy `vendor/` | EVIDENCE MISSING (non-blocking) | — |
| SRC-05 | Current production DB dump | EVIDENCE MISSING (non-blocking) | — |
| SRC-06 | Q01–Q160 answers | SUPERSEDED — decisions now recorded | — |
| SRC-07 | Company output templates | EVIDENCE MISSING — blocks P8 validation only | P8 |
| SRC-08 | Production backup dump | EVIDENCE MISSING (non-blocking) | — |
| C-01 | B/L number format | RESOLVED — real samples authoritative | P2 |
| C-02 | Manifest number format | PARTIALLY RESOLVED — two shapes preserved as conflict | P2 |
| C-03 | Invoice number | RESOLVED — `DSINV/<yy>-<seq>` | P2 |
| C-04 | Proforma prefix | RESOLVED — `DSPRO/<yy>-<seq>` | P2 |
| C-05 | Voyage counter keying | RESOLVED — vessel + destination | P2 |
| C-06 | Customer code format | GENUINELY OPEN — four conflicting examples | P2 |
| C-07 | Receipt voucher series | **CORRECTED** — `DSR/26-190` fabricated; real = `477` | P2 |
| C-17 | Vessel naming contradiction | **WITHDRAWN** — not a contradiction | — |
| REQ-102 | B/L numbering per destination | RESOLVED — already implemented | P2 |
| REQ-040 | Voyage number `n/yy` | PARTIALLY RESOLVED — vessel component missing | P2 |
| REQ-103 | B/L number format | PARTIALLY RESOLVED — real format identified | P2 |
| REQ-114 | Manifest number format | PARTIALLY RESOLVED — conflict preserved | P2 |
| E1 | Fabricated `DSR/26-190` | CONFIRMED — correction required in 8 files | P1 |
| E2–E4 | Stale counts | CONFIRMED — correction required | P1 |
| E5 | C-17 mis-framed | CONFIRMED — withdraw | P1 |
| E6 | `¶n` index drift | CONFIRMED — known, cosmetic | P1 |
| E7 | Self-reported file counts | CONFIRMED — correction required | P1 |

---

## Detail — Q-AUD-01 … Q-AUD-27

### Q-AUD-01 · Invoice ↔ Job: one or many?
1. **Meaning.** Can one invoice bill several Jobs?
2. **Concern.** Determines a `jobId` column vs an `InvoiceJob` join table; wrong choice forces a migration over live financial records.
3. **Evidence.** `docs/duna-analysis/existing-analysis/duna_source_pack.md` §2.10 — the accountant *"must be able to see the related Job Numbers"* (plural). `01-employer-statements/employer-original-statements.en.md` **EMP-609** — *"So that then I come and check it against the related Job Numbers — Match all of them."* REQ-134 (EMP-099/609/625), REQ-141 (EMP-608/609/624/625).
4. **Answer.** **Many-to-many.** Use an `InvoiceJob` join table.
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) + confirmed decision (§4 required reconciliation).
6. **Doc correction.** `open-questions.md` — mark resolved. `audit-findings.md` AUD-002 — replace "missing" with the confirmed shape.
7. **Implementation status.** Not implemented. `Invoice` has no job reference; `Job` has no invoice reference.
8. **Remaining work.** Schema + API + UI in P3.
9. **REQ/phase.** REQ-134, REQ-141, DEC-071 · **P3**.
10. **Status.** `RESOLVED`.

### Q-AUD-02 · Invoice ↔ B/L: one or many?
1. **Meaning.** Can one invoice cover several B/Ls?
2. **Concern.** Same shape decision as Q-AUD-01; the two should share a migration.
3. **Evidence.** Real tax invoice `DSINV/26-172` carries a **single** field `BOE/DEC/BL#: KHS/26-108` (`docs-summary.md` §8.1). **EMP-687** refers to *"the Invoice related to this Release Order"* (singular). Source pack §5 item 10 explicitly lists this as requiring employer confirmation.
4. **Answer.** **Support both** — a single B/L and an invoice covering multiple B/Ls.
5. **Classification.** CONFIRMED DESIGN DECISION (§4 required reconciliation, DEC-105). *Correction to prior work:* an earlier draft of this analysis declared this "answerable from one sample"; that was over-confident and is **withdrawn** — the source pack itself defers it.
6. **Doc correction.** `initial-roadmap.md` §7 and `open-questions.md` — record as resolved by decision, noting observed evidence is single-reference.
7. **Implementation status.** `Invoice.billOfLadingId` is a single nullable column (AUD-003).
8. **Remaining work.** Join table + UI in P3.
9. **REQ/phase.** REQ-141, DEC-105 · **P3**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-03 · Derived vs posted ledger
1. **Meaning.** Keep a derived balance report, or build a real accounting ledger?
2. **Concern.** Largest architectural decision; affects every historical financial figure.
3. **Evidence.** Source pack §2.14 — General Journal required *"علاوه بر Invoice و Payment"* (in addition to invoices and payments); office expenses must feed year-end P&L. §4.2 lists *"Ledger as independent accounting entity"* among legacy **gaps** — the legacy system had none. REQ-166/167/195.
4. **Answer.** A **proper, auditable general ledger is required**. Balance summaries are not a substitute. Migration approach: **additive** — introduce accounting entries alongside the existing derived ledger, reconcile, then consider switching the read path.
5. **Classification.** Requirement = BUSINESS REQUIREMENT (EVIDENCED) + confirmed decision. Migration approach = TECHNICAL RECOMMENDATION, not a business question.
6. **Doc correction.** `open-questions.md` — remove from the blocking list; record the additive recommendation as an ADR candidate.
7. **Implementation status.** No `GeneralJournal`/`JournalLine`/`LedgerEntry`/`Account` model. Ledger is derived (ADR-032) via `apps/api/src/modules/ledger/ledger.controller.ts` (18 lines) → `VoucherService.ledger()`.
8. **Remaining work.** P6 — model, posting rules, reconciliation, dual-run.
9. **REQ/phase.** REQ-166/167/195, DEC-078…081 · **P6**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-04 · Voucher allocation across documents
1. **Meaning.** Can one payment settle several invoices?
2. **Concern.** One nullable column vs an allocation table with amounts.
3. **Evidence.** Real **Receipt Voucher No. 477** carries three references: `1517`, `1526`, `Advance 477` (source pack §3.3). REQ-164 (EMP-656-659); REQ-165 (EMP-660 — unallocated must not error).
4. **Answer.** **Yes.** A payment may reference multiple invoices, advances or other documents, and **allocations must be stored per reference with amounts**. Partial allocation and unallocated credit are both supported.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-013…018).
6. **Doc correction.** `open-questions.md` — resolved; `audit-findings.md` AUD-005 — update to the confirmed shape.
7. **Implementation status.** `Voucher.invoiceId` single nullable; no `VoucherAllocation` model.
8. **Remaining work.** P6.
9. **REQ/phase.** REQ-164/165, DEC-013…018 · **P6**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-05 and Q-AUD-05b · Attachments and identity documents
1. **Meaning.** Where are files stored, and what is the retention/access policy for ID documents?
2. **Concern.** Storage choice; and storing identity documents without a policy is a compliance exposure.
3. **Evidence.** §2.15 — payment vouchers require front-and-back ID card of the recipient plus signature; salary slips require employee ID front/back plus signature (REQ-168, REQ-170). No retention, access or privacy policy exists in **any** source checked: source pack, `12-open-business-decisions.md` §1.10, requirements catalogue, legacy documentation.
4. **Answer.** Storage: abstracted adapter, local first, signed URLs, no public exposure. ID documents: access restricted by permission, operations audited, retention and secure deletion **configurable** within legal/accounting/dependency constraints. Scope limited to payment vouchers and salary slips — **not** extended indiscriminately.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-087…092). Specific retention **periods** remain OPEN (legal/accounting input).
6. **Doc correction.** `open-questions.md` — 05b resolved for controls; retention *period* recorded as open.
7. **Implementation status.** `FileAttachment` model exists but is referenced **once** across all application code — effectively unused. No upload endpoint, no storage adapter, no permissions.
8. **Remaining work.** P4 (storage + controls), P12 (retention policy configuration).
9. **REQ/phase.** REQ-168/170, DEC-087…092 · **P4/P12**.
10. **Status.** `RESOLVED (DESIGN DECISION)` for controls; retention periods `GENUINELY OPEN`.

### Q-AUD-06 · Rendering approach and SRC-07 templates
1. **Meaning.** How should PDF/Excel/print be produced, and where are the company templates?
2. **Concern.** Choosing a stack before seeing templates risks a rewrite.
3. **Evidence.** No rendering dependency exists anywhere (searched `pdfkit`, `puppeteer`, `exceljs`, `handlebars`, `mustache`, `renderTemplate` → zero matches). REQ-125 — templates not present. Verified: `docs/duna-analysis/documents/` holds 7 real document **samples** and **no templates**.
4. **Answer.** Approach can be specified (template-driven, per document type, versioned, with/without stamp variants) **without** the template files. The templates themselves remain missing and are required for final fidelity and validation.
5. **Classification.** Approach = CONFIRMED DESIGN DECISION (DEC-093…098). Template files = EVIDENCE MISSING.
6. **Doc correction.** Record REQ-125 as a scoped limitation, not a project blocker.
7. **Implementation status.** No renderer. `DocumentTemplate` referenced 16×; `DocumentTemplateVersion` **orphaned** (0×).
8. **Remaining work.** P8; template collection tracked separately.
9. **REQ/phase.** REQ-120-125, DEC-093…098 · **P8**.
10. **Status.** `PARTIALLY RESOLVED`.

### Q-AUD-07 · Which B/L status means "released"?
1. **Meaning.** Which status tells an agent the cargo can be collected?
2. **Concern.** `BlStatus` has six values including near-duplicates (`FINAL`/`ISSUED`, `APPROVED`/`RELEASED`).
3. **Evidence.** **EMP-685-690** — the **Release Order** records whether the customer *"paid in full, it's Paid"*, took it *"on credit — it's Unpaid"*, or made a *"Partial Payment"*. Legacy provides **no** guidance: defect **D1** means `RELEASED` is defined but **never written** (`03-legacy-laravel-system/system-overview.md`, D1).
4. **Answer.** Cargo release authorization is represented by the **Release Order workflow**, not by a B/L lifecycle status. The B/L lifecycle is a separate document concern (draft → correction → approval/finalization → issuance).
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION (DEC-062).
6. **Doc correction.** `open-questions.md` — resolved. `audit-findings.md` AUD-010/019 — reframe: the portal must surface **Release Order** status, not a B/L status word.
7. **Implementation status.** `ReleaseOrder` exists with `status` (`ISSUED/CANCELLED`) and `financialOverride`/`overrideReason` (ADR-033), but no payment-state field and no portal exposure.
8. **Remaining work.** Add payment state to Release Order; expose to agents (P5). Official B/L status **labels** remain configurable (DEC-061).
9. **REQ/phase.** REQ-187/188, DEC-061/062 · **P5**.
10. **Status.** `RESOLVED`.

### Q-AUD-08 · Is REQ-017 reversed?
1. **Meaning.** Does the Customer record keep Type, Currency, TRN, Short Name?
2. **Concern.** Explicit requirement contradicted by the schema.
3. **Evidence.** REQ-017 (EMP-225, EMP-237) — explicit exclusion. §2.9 — the **only** Customer distinction stated is natural vs legal person (*"حقیقی یا حقوقی"*). No reversal found in any source. Schema `Customer` has all four; `type` is seeded with commercial-role values (`SHIPPER/CONSIGNEE/AGENT/FREIGHT_FORWARDER`) — **different semantics** from the evidence.
4. **Answer.** **REQ-017 stands.** The prohibited fields must not be introduced merely because they are convenient. The Customer model must still support natural and legal persons and remain distinct from commercial roles.
5. **Classification.** CONFIRMED DECISION (DEC-075).
6. **Doc correction.** `open-questions.md` — remove from the blocking list. `audit-findings.md` AUD-011 — record the decision and the semantic mismatch.
7. **Implementation status.** All four fields present; `type` is read by `portal.service.ts` `me()`.
8. **Remaining work.** P10 — remove or repurpose `type` to the natural/legal distinction; remove `shortName`, `taxId`, `currency`.
9. **REQ/phase.** REQ-017, DEC-074/075 · **P10**.
10. **Status.** `RESOLVED`.

### Q-AUD-09 · Real port list
1. **Meaning.** Which ports exist, with city, country and abbreviation?
2. **Concern.** Needed before `city` and `abbreviation` can be made mandatory (REQ-031).
3. **Evidence.** **EMP-264-266** — *"instead of it saying Hamriyah Port, Dubai… we defined an Abbreviation for it: HAM."* Ports named across transcripts: Hamriyah (28), Khorramshahr (33), Bandar Abbas (13), Bushehr (11), Jebel Ali (10), Rajaee (4), Sohar (2), Dubai (12). Real documents confirm the display format: `HAMRIYA PORT, DUBAI, UAE`; `KHORRAM SHAHR, PERSIAN GULF, IRAN`; `BANDAR ABBAS, PERSIAN GULF, IRAN`. Verified codes: HAM, KHS, RJS.
4. **Answer.** Seed the eight evidenced ports. Preserve verified codes only. Make remaining fields mandatory once the full list is confirmed.
5. **Classification.** PARTIALLY RESOLVED — list and 3 codes evidenced; **complete list and remaining codes open**.
6. **Doc correction.** `open-questions.md` — narrow to "complete list + remaining abbreviations".
7. **Implementation status.** `Port` has `code, name, country, city?, abbreviation?`; `city`/`abbreviation` nullable; no display name, no aliases. Seed creates Jebel Ali and Khalifa Port (**neither with an abbreviation**); Khalifa appears **0 times** in any source.
8. **Remaining work.** P10 — seed, add fields, backfill, then constrain.
9. **REQ/phase.** REQ-030/031, DEC-064…067 · **P10**.
10. **Status.** `PARTIALLY RESOLVED`.

### Q-AUD-10 · Ports/yards: seed data or operator data?
1. **Meaning.** Are ports part of the deployable baseline?
2. **Concern.** Determines what belongs in the structural seed.
3. **Evidence.** DEC-064/065 — administrator-managed operational reference data, seeded from verified documents as reference examples.
4. **Answer.** **Administrator-managed**, seeded initially from verified sources. Not hard-coded.
5. **Classification.** CONFIRMED DESIGN DECISION.
6. **Doc correction.** `open-questions.md` — resolved. Note the seed currently creates **Khalifa Port**, which appears in **no** source document.
7. **Implementation status.** `prisma/seed.ts` seeds 2 ports + 2 yards unconditionally.
8. **Remaining work.** P10 — move out of the structural seed.
9. **REQ/phase.** DEC-064/065 · **P10**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-11 · Do tests depend on demo seed rows?
1. **Meaning.** Would removing demo rows break automated tests?
2. **Concern.** REQ-198 forbids fake business data; the seed still writes it (AUD-014).
3. **Evidence.** 22 e2e suites exist under `apps/api`; 1 additional `.spec.ts` in `apps/api`; 1 test file in `apps/web`. **Not executed** — no `node_modules`, no PostgreSQL, no `.env` in this environment.
4. **Answer.** Not yet determined — this is a **code question**, not a business decision.
5. **Classification.** IMPLEMENTATION PENDING.
6. **Doc correction.** Remove from `open-questions.md` as a user question; keep as a P0 task.
7. **Implementation status.** Unknown. P0 step 6 measures it.
8. **Remaining work.** P0 — install, migrate, run the suite, record the **real** pass/fail figure. The previously cited "403/403 green" remains **UNVERIFIED**.
9. **REQ/phase.** REQ-198, AUD-014/022 · **P0/P1**.
10. **Status.** `IMPLEMENTATION PENDING`.

### Q-AUD-12 · Load list: 3 states or 6?
1. **Meaning.** How many states do Load List / Actual Loading have?
2. **Concern.** ADR-041 says 3; the enum has 6.
3. **Evidence.** ADR-041 (authoritative decision record) specifies `DRAFT → FINALIZED (→ CANCELLED)`. Schema has six: `DRAFT | IN_PROGRESS | PARTIALLY_LOADED | COMPLETED | FINALIZED | CANCELLED`. Legacy is **no guide** — §4.3 shows legacy used *parallel* status concepts (`admin_status`, `status`, `in_status`), not one state machine.
4. **Answer.** ADR-041 is authoritative; the schema should be aligned. **No data migration without a verified mapping.**
5. **Classification.** Implementation/documentation inconsistency, **not** a business question.
6. **Doc correction.** `open-questions.md` — reclassify from "blocking business decision" to implementation task.
7. **Implementation status.** Schema has 6; ADR-041 says 3.
8. **Remaining work.** P10 — confirm ADR-041 is not itself superseded; define the mapping; migrate.
9. **REQ/phase.** AUD-016, ADR-041 · **P10**.
10. **Status.** `IMPLEMENTATION PENDING`.

### Q-AUD-13 and Q-AUD-14 · Alert thresholds and channels
1. **Meaning.** When should unpaid-release alerts fire, and how are they delivered?
2. **Concern.** Hard-coding a threshold would be wrong for some cases.
3. **Evidence.** EMP-148 (one week unpaid), EMP-149 (a month ago, 20% unpaid), EMP-692 (one or two weeks). §2.16 confirms alerts for overdue debts but gives no threshold. **EMP-694-702** region covers reports/alerts.
4. **Answer.** Notification conditions, recipients, timing, repetition and delivery channels must be **configurable**. The historical figures are **examples, not universal defaults**.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-056…058).
6. **Doc correction.** `open-questions.md` — resolved. Explicitly record that EMP-148/149 must not become hard-coded rules.
7. **Implementation status.** No notifications module, no scheduler, no `notification:*` permission codes.
8. **Remaining work.** P10.
9. **REQ/phase.** REQ-184, DEC-056…058 · **P10**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-15 · Six navigation sections or ten?
1. **Meaning.** REQ-001 says six; the code has ten.
2. **Concern.** Reconciling an explicit requirement with working navigation.
3. **Evidence.** REQ-001 (EMP-185/186) — exactly six: Overview, Operations, B/L & Manifest, Accounting, Master Data, Access Control. `apps/web/src/lib/navigation/nav.ts` `NAV_SECTION_ORDER` has ten (adds commercial, people, correspondence, portal, accessControl, administration, insightControl).
4. **Answer.** **Preserve the discrepancy and document it.** Do not automatically delete existing navigation — every extra section corresponds to a feature the employer asked for (Salary, Letters, Agent portal, Reports).
5. **Classification.** CONFIRMED DECISION (§4 required reconciliation).
6. **Doc correction.** `open-questions.md` — reclassify to a documented deviation. Separately: the stale `planned` "Agent portal" nav entry (duplicating implemented `/portal` and `/agents`) should be removed — unambiguous.
7. **Implementation status.** 10 sections; one stale duplicate entry.
8. **Remaining work.** P1 — document the deviation; remove the stale entry.
9. **REQ/phase.** REQ-001, AUD-021 · **P1**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-16 · Portal: customers too?
1. **Meaning.** Should customers get portal logins?
2. **Concern.** Affects scoping model and permissions.
3. **Evidence.** §2.18 — **destination agents** must have independent login. No employer statement anywhere requests customer logins. Legacy had a "Customer Portal" (§4.1) but that is legacy behaviour, not a requirement.
4. **Answer.** **Agents only.** Do not invent a customer portal requirement.
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION (DEC-077).
6. **Doc correction.** `open-questions.md` — resolved; `audit-findings.md` AUD-010 — note that the "customer-linked user sees nothing" case is an implementation artifact, not a requirement.
7. **Implementation status.** Portal supports `portalAgentId` (manifests) and `portalCustomerId` (bookings/statement).
8. **Remaining work.** P5 — clean up the customer-linked path.
9. **REQ/phase.** REQ-187/188, DEC-077 · **P5**.
10. **Status.** `RESOLVED`.

### Q-AUD-17 · Manifest cost categories
1. **Meaning.** Which cost categories does the voyage P&L use?
2. **Concern.** Schema carries legacy columns that may not match the employer's categories.
3. **Evidence.** §2.19 — **Vessel Hire, Port Use, Port Handling, Lashing**, and other voyage-related costs; income = sum of invoices issued for that Manifest/Voyage's B/Ls. REQ-191 (EMP-696). Legacy columns: `gasCost, lashingCost, shipperCost, podCost, polCost`.
4. **Answer.** Use the employer's five named categories plus "other", as a **configurable** list. Legacy columns are historical artifacts — only `lashing` overlaps — and must not be treated as the specification.
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION.
6. **Doc correction.** `open-questions.md` — resolved. `audit-findings.md` AUD-009 — record the category list.
7. **Implementation status.** Legacy columns present in `Manifest`; required categories absent; no reports module.
8. **Remaining work.** P7.
9. **REQ/phase.** REQ-190-192, DEC-038 · **P7**.
10. **Status.** `RESOLVED`.

### Q-AUD-18 · Default currency
1. **Meaning.** Is USD the right default?
2. **Concern.** Silent wrongness — every new invoice inherits the default.
3. **Evidence.** All five real documents are **AED** (tax invoice `Currency: AED`; proforma AED; quotation `AED 7,700`; receipt voucher `AED 1,600`; SOA `683.50 Dr`). **A word-boundary search of the employer statements returns ZERO hits for AED, Dirham, USD or Dollar** — the employer never discussed currency.
4. **Answer.** Support **configurable multi-currency**. Do **not** assert a universal currency policy on the basis of AED-denominated samples. AED is a seed/reference default, not a rule.
5. **Classification.** CONFIRMED DECISION (DEC-001…003). *Correction:* an earlier draft claimed "the employer says Dirham" — that was a substring false-positive and is **withdrawn**.
6. **Doc correction.** `open-questions.md` — resolved. Correct the withdrawn claim.
7. **Implementation status.** `Invoice.currencyCode` and `CompanySettings.defaultCurrency` both default to `USD`; only USD and AED are seeded; no rate history.
8. **Remaining work.** P6.
9. **REQ/phase.** DEC-001…012 · **P6**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-19 · Multi-currency reporting required?
1. **Meaning.** Must reports work across currencies?
2. **Concern.** Determines whether a dated rate table is a prerequisite for reporting.
3. **Evidence.** Confirmed decision §5.1 — at least AED, USD, AUD, CNY, IRR.
4. **Answer.** **Yes.** Multi-currency is required; a dated rate table must land **before** P7.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-001…012).
6. **Doc correction.** `open-questions.md` — resolved; `audit-findings.md` AUD-023 — promote to a P6 prerequisite.
7. **Implementation status.** No `CurrencyRate` model; `Voucher.exchangeRate` only.
8. **Remaining work.** P6.
9. **REQ/phase.** AUD-023, DEC-006 · **P6** (before P7).
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-20 · Invoice correction flow
1. **Meaning.** Cancel-and-reissue, or credit note?
2. **Concern.** `InvoiceStatus` has no credit-note concept.
3. **Evidence.** No employer statement describes invoice correction. §2.11 describes **B/L** correction (draft → customer review → final), which is a different flow. REQ-105 (EMP-564) covers B/L corrections only.
4. **Answer.** Support **controlled correction after issuance**, including cancellation and reissue **and/or** credit-note workflows as appropriate, while preserving the original record and its links. Multiple mechanisms; which applies is configuration.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-019…023).
6. **Doc correction.** `open-questions.md` — resolved; add DEC-019…023.
7. **Implementation status.** `InvoiceStatus` = `DRAFT | ISSUED | CANCELLED`. No credit note, no linked replacement, no correction audit.
8. **Remaining work.** P3/P6.
9. **REQ/phase.** DEC-019…023 · **P3/P6**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-21 · Release override policy
1. **Meaning.** Who may approve a release when payment is not full?
2. **Concern.** "No money, no cargo" needs an exception path.
3. **Evidence.** **EMP-685-690** — three payment states: Paid (paid in full), Unpaid (taken on credit), Partial Payment (paid part, rest later). §2.16 corroborates, and adds that release normally follows full payment after discharge.
4. **Answer.** **Preserve the three states.** Approval authority and exception handling must be **configurable through controlled workflows** — not invented as fixed company policy.
5. **Classification.** States = BUSINESS REQUIREMENT (EVIDENCED). Approver identity = CONFIRMED DECISION that it is configuration.
6. **Doc correction.** `open-questions.md` — partially resolved; no approver identity is invented.
7. **Implementation status.** `ReleaseOrder` has `financialOverride`/`overrideReason` (ADR-033) but **no payment-state field**.
8. **Remaining work.** P5 — add payment state; P9 — configurable approval workflow.
9. **REQ/phase.** REQ-181/182/184, DEC-062 · **P5/P9**.
10. **Status.** `PARTIALLY RESOLVED` (states resolved; approver is configuration).

### Q-AUD-22 · Delivery Order eligibility
1. **Meaning.** When can a Delivery Order be created?
2. **Concern.** Creation rule unspecified.
3. **Evidence.** §2.17 — DO issued for cargo discharged at the company's port/facility, to be delivered to the customer/consignee; carries number, date, **Port** and standard company info. Legacy never had Delivery Orders (§4.2).
4. **Answer.** Preserve the documented scenario: discharged at the company facility, then delivered to customer or consignee. Preserve numbering, date and port information.
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION.
6. **Doc correction.** `open-questions.md` — resolved; add to the document catalog.
7. **Implementation status.** `DeliveryOrder` exists (`docNumber, billOfLadingId, status, issueDate, recipient, recipientId, vehiclePlate`) — **no port field**, despite REQ-186 requiring one.
8. **Remaining work.** P5/P8.
9. **REQ/phase.** REQ-186, DEC-099 · **P5/P8**.
10. **Status.** `RESOLVED`.

### Q-AUD-23 · Job creation trigger
1. **Meaning.** When is a Job created?
2. **Concern.** Needed for automatic creation.
3. **Evidence.** §2.10 — Job acts as a cumulative case file for costs over weeks/months (Repairing, Customs, Lowbed, Transport, Ship, Crane). **EMP-607-609** — invoices issued two ways; B/L-linked invoices auto-draft so the accountant can match related Job Numbers. ETOZ/ETDZ undefined (source pack §5 item 8; REQ-131).
4. **Answer.** A Job is the **overall customer commercial order/operation** transporting goods from origin to destination, spanning multiple goods, B/Ls, documents, charges, invoices and payments. Support **manual and configurable automatic** creation. ETOZ/ETDZ remain **undefined**.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-068…072).
6. **Doc correction.** `open-questions.md` — resolved; ETOZ/ETDZ recorded as an evidence gap, not invented.
7. **Implementation status.** `Job` + `JobCostItem` exist; no invoice link, no creation rules.
8. **Remaining work.** P3.
9. **REQ/phase.** REQ-131/134, DEC-068…072 · **P3**.
10. **Status.** `RESOLVED (DESIGN DECISION)`.

### Q-AUD-24 · Contact ownership
1. **Meaning.** Do phone/email belong to the Customer or to the parties?
2. **Concern.** Party field design.
3. **Evidence.** §2.6/2.7 — Shipper and Consignee each carry Name (mandatory), National ID/TRN, Address, Contact Number, Email (optional). §2.8 — Agent carries Name, Address, Contact Number, Email. §2.9 — Customer is entirely separate.
4. **Answer.** Contacts are associated with the appropriate **Shipper, Consignee or Agent**. Customer is a separate commercial entity and must not be conflated.
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) + CONFIRMED DECISION (DEC-076).
6. **Doc correction.** `open-questions.md` — resolved.
7. **Implementation status.** Shipper/Consignee/Agent models exist with contact fields; Customer carries its own contact fields (permitted — Customer is a separate entity, not a shipping party).
8. **Remaining work.** P10 — confirm field-level mapping during master-data work.
9. **REQ/phase.** DEC-073…077 · **P10**.
10. **Status.** `RESOLVED`.

### Q-AUD-25 · Archive retention and reopening
1. **Meaning.** How long are records kept, and can archived records be reopened?
2. **Concern.** No policy existed.
3. **Evidence.** §2.20 — the Company Archive concept was raised and details were explicitly deferred to a later file/source that was **never supplied**. `12-open-business-decisions.md` §1.10 — concept confirmed; retention and re-opening not confirmed.
4. **Answer.** Apply the confirmed design: manual and automatic archiving; administrator-configurable retention **subject to legal, accounting, security and dependency constraints**; archived records remain searchable per permissions; reopening requires authorization and is logged; permanent deletion respects retention, dependencies and audit obligations.
5. **Classification.** CONFIRMED DESIGN DECISION (DEC-082…086). Specific **periods** are a compliance input, not invented here.
6. **Doc correction.** `open-questions.md` — resolved for design; legal retention periods recorded as an open compliance input.
7. **Implementation status.** No archive, retention or reopening capability. Soft-delete (`deletedAt`) exists on several models.
8. **Remaining work.** P12.
9. **REQ/phase.** REQ-004, DEC-082…086 · **P12**.
10. **Status.** `RESOLVED (DESIGN DECISION)`; retention periods `GENUINELY OPEN` (compliance input).

### Q-AUD-26 · VAT rates and applicability
1. **Meaning.** Which services are taxable, and at what rate?
2. **Concern.** Inventing 5% would be wrong.
3. **Evidence.** **EMP-113/114/115/118** — each invoice row takes a VAT percentage; *"if in this row I write five for VAT, it means five percent."* **EMP-611** — row columns: *"Description of goods, Rate, quantity, VAT and the total amount which includes VAT."* **EMP-612/614** — totals show Subtotal, VAT, Total Amount separately. **EMP-617** — some invoices have VAT, some do not. Real tax invoice `DSINV/26-172`: `VAT: 0.00 AED` on `27,370.00 AED`.
4. **Answer.** **Per-line VAT is confirmed.** The applied rate and amount must be preserved historically. No universal rate is assumed — tax types and rates are administrator-configurable.
5. **Classification.** Per-line = BUSINESS REQUIREMENT (EVIDENCED). Rates/applicability = configurable, OPEN as to values.
6. **Doc correction.** `open-questions.md` — per-line resolved; rate values recorded as configuration, not a business question.
7. **Implementation status.** `Invoice.taxRate` is **header-level**; `InvoiceItem` has no tax column (AUD-001).
8. **Remaining work.** P3.
9. **REQ/phase.** REQ-143/144/145/194, DEC-100…104 · **P3**.
10. **Status.** `PARTIALLY RESOLVED`.

### Q-AUD-27 · Agent portal extra capabilities
1. **Meaning.** What else should agents see beyond B/L and Release?
2. **Concern.** Portal scope.
3. **Evidence.** §2.18 — agents see only their own destination's data, **especially B/L, Manifest and Release Order**; the goal is that the agent can answer the customer instead of phoning head office (REQ-187/188). §5 item 16 flags download/print permission as needing confirmation.
4. **Answer.** The **confirmed minimum** is B/L, Manifest and Release Order for the agent's own destination. Anything further (for example document download/print) is not confirmed and is not introduced as a requirement.
5. **Classification.** BUSINESS REQUIREMENT (EVIDENCED) for the minimum; extras not claimed.
6. **Doc correction.** `open-questions.md` — resolved for the minimum. `audit-findings.md` AUD-010 — the portal currently exposes `me`, bookings and statement only, and **no B/L or Release listing** — a confirmed gap.
7. **Implementation status.** No B/L or Release Order endpoints in the portal.
8. **Remaining work.** P5.
9. **REQ/phase.** REQ-187/188, DEC-077 · **P5**.
10. **Status.** `RESOLVED`.

---

## Detail — SRC findings

### SRC-01 · `/home/duna/dunaData/` — **WITHDRAWN**
**Original finding:** the highest-authority source directory was absent; every conclusion provisional.
**Reconciliation:** the path is **historical**. Contents were relocated into the repository. Verified present:
`docs/duna-analysis/requirements/` — **20 transcript files** (18 `audio_*.txt` + `part1_0-15.txt` +
`part2_15-end.txt`); `docs/duna-analysis/documents/` — **7 real document PDFs**, matching the source pack's
inventory exactly (B/L, Manifest, Receipt Voucher, Ledger/SOA, Tax Invoice, Proforma, Quotation).
**Answer:** **Withdrawn as a blocker.** The employer's original statements and requirements **are** available.
**Doc correction:** `README.md` §7, `open-questions.md` SRC-01 — replace with this reconciliation.
**Status:** `RESOLVED (WITHDRAWN)`.

### SRC-02 · `shipping_documents_detailed_reference.md` — **DOWNGRADED**
No file of that name exists. However its function is substantially covered by source pack §3 (field-level
evidence for all seven real documents) and `02-business-documents/`. **Nothing blocks on it.**
**Status:** `PARTIALLY RESOLVED — partial coverage`.

### SRC-03 / SRC-04 / SRC-05 / SRC-08 · Database dumps and legacy vendor
Legacy DB dump, legacy `vendor/`, current production dump, and
`/home/duna/backups/shipping_erp_20260926_112141.dump` are all absent. **None blocks the roadmap.** A production
dump would improve confidence in data-migration planning and would make "no fake data" checkable, but the
migration is not in the current roadmap.
**Status:** `EVIDENCE MISSING (non-blocking)`.

### SRC-06 · Answers to Q01–Q160
Superseded. The questions that mattered have been answered directly through the requirements discussion and are
recorded here and in `confirmed-decisions.md`. The questionnaire file
(`existing-analysis/duna_client_discovery_questions_v2.md`) must be **retained** — it is the sole holder of the
Q-ID space — but no roadmap item depends on completing it.
**Status:** `SUPERSEDED`.

### SRC-07 · Company output templates
**Genuinely missing.** `documents/` holds 7 real document **samples**; no template files. Affects **template
fidelity and validation in P8 only**. Does not block specification or any other phase.
**Status:** `EVIDENCE MISSING — blocks P8 validation only`.

---

## Detail — evidence corrections

### C-07 · Receipt voucher series — **CORRECTED**
**Claim:** *"Real voucher `DSR/26-190`"* with a provisional reading `DSR/<yy>-<seq3>`.
**Actual:** the real receipt voucher is **No. 477**, dated 6-Aug-26, company `RUKN ALHMREYA TRANSPORT L.L.C`,
Account `DUNA SHIPPING`, `AED 1,600.00`, Through `Cash`, references `1517`, `1526`, `Advance 477`
(source pack §3.3). It is a **plain number with no prefix and no year**.
**Consequence:** `DSR/26-190` is **fabricated** (error E1). The `DSR` string appears in no extracted document.
**Doc correction:** correct C-07; remove all `DSR/26-190` references (8 files, 10 hits); the voucher series is
plain numeric pending confirmation.
**Status:** `CORRECTION CONFIRMED`.

### C-01 · B/L number format
Real documents (`KHS/26-110`; `KHS/26-108` on the invoice; range `KHS/26-110`…`KHS/26-139` on the manifest)
agree with each other and with **neither** spoken example (`KHS/26-2/2026` EMP-544, `RJS/26-10` EMP-546).
Provisional reading `<DEST-ABBREV>/<yy>-<seq3>`, sequence per destination per year (**EMP-547**).
**Status:** `RESOLVED` for implementation seeding, pending employer confirmation of the exact company format.

### C-02 / REQ-114 · Manifest number format
Two real shapes: `DSMAN/KHO-26-006` (the manifest document) and `DSKHS-26-005` (referenced on the tax invoice as
the manifest number). **The conflict is preserved** — it is not resolved by choosing the one that matches current
code. **Status:** `PARTIALLY RESOLVED — conflict preserved`.

### C-03 / C-04 · Invoice and Proforma
`DSINV/26-172` and `DSPRO/26-001` from real documents. Legacy generators used random numbers (`DSAED/{rand6}`)
and a transposed prefix (`SDPRO/`). **Do not port legacy formats.**
**Status:** `RESOLVED`.

### C-05 · Voyage counter keying
Employer (REQ-041/EMP-320/329/330/552): per **vessel + destination**. Legacy: per **port + shipper** — defect
**D12**, contradicting REQ-040. Follow the employer.
**Status:** `RESOLVED`.

### C-06 · Customer code format — **GENUINELY OPEN**
Four incompatible examples given in one breath (EMP-207…EMP-233): `CUST 3-3-1`, `CUST 3SF-2`,
`CUST 2SF-1 / 3SF-1…N`, `CUST 3.1 / 3.2 / 3.3`. The substantive requirement (REQ-014 — a system-generated,
sequential, prefixed code) is clear; **only the string format is open**. Recommendation: keep the format in a
seeded `NumberingSequence` so it can be changed without code.
**Status:** `GENUINELY OPEN` (non-blocking — configurable by design).

### C-17 · Vessel naming — **WITHDRAWN**
Not a contradiction. The manifest header carries **both** `BARGE - MEHDI 11` / `TUG - LAYAN GULF` and the company
`DUNA SHIPPING LLC`. Confirms REQ-037 (tug & barge as two names).
**Status:** `WITHDRAWN`.

### REQ-102 · B/L numbering per destination — **CORRECTION TO PRIOR WORK**
An earlier draft routed this to P2 as an unimplemented gap. **Per-destination scoping is already implemented**:
`apps/api/src/modules/bill/bill.service.ts:1642-1649` — `scopeType: 'DESTINATION'`,
`scopeValue: destinationPortId`, prefix `BOL-${DEST}-${yymm}-`. Only the **format string** differs from the real
`KHS/26-110`. **Status:** `RESOLVED — implemented (scoping); format to be re-seeded in P2`.

### REQ-040 · Voyage number `n/yy` — **CORRECTION TO PRIOR WORK**
Substantially implemented: `apps/api/src/modules/voyages/voyages.service.ts:278-288` emits
`format: '{sequence}/{yy}'`, `period: 'YY'`, scoped per destination — matching the real `02/26` on the tax
invoice and B/L. A second call (lines 383-392) generates the system voyage number `VOY-YYMM-#####`.
**Missing:** the **vessel** component — REQ-040 requires per vessel + destination + year; the scope key is
destination + year only. **Status:** `PARTIALLY RESOLVED`.

### E1–E7 · Knowledge-base errors
E1 (fabricated `DSR/26-190`) — **confirmed and re-confirmed** by source pack §3.3. E2 (62/25 → 52/32 models/enums),
E3 (33 → 32 modules), E4 ("105 permissions" unsupported vs 160 seeded), E5 (C-17 mis-framed), E6 (`¶n` drift),
E7 (self-reported counts) — all confirmed. Corrections are scheduled in P1 and listed in
`doc-consolidation-proposal.md`.

---

## Detail — genuinely open after reconciliation

Only these remain. Everything else is settled or is an implementation task.

> **⚠️ Discrepancy found and corrected 2026-10-11.** This table and `open-questions.md` each listed **12** open
> items, but **not the same 12**. Three items appeared only here (port list, taxable services/rates, FX gain
> policy) and three appeared only there (B/L number window, Jebel Ali English name, Cargo deletion policy).
> The lists have been merged. **The register now contains 15 open items**, identified as `OQ-01`…`OQ-15` in
> `open-questions.md`, which is the authoritative open-item register. The three items recovered from this
> table are `OQ-13`, `OQ-14` and `OQ-15`.

| OQ | Source ID(s) | Remaining item | Type | Blocks |
|---|---|---|---|---|
| OQ-01 | C-01 / REQ-103 | Confirm the official B/L number format | Business confirmation | P2 seeding only |
| OQ-02 | C-02 / REQ-114 | Manifest number: one series or two? | Business confirmation | P2 seeding only |
| OQ-03 | C-06 | Customer code string format | Business decision | Nothing (configurable) |
| OQ-04 | — | B/L number window anomaly (`DSKHS-26-005`) | Missing sample evidence | Nothing |
| OQ-05 | DEC-061 | Official B/L status labels | Business confirmation | Nothing (configurable) |
| OQ-06 | Q-AUD-21 | Approver identity for release exceptions | Configuration | P5/P9 configuration only |
| OQ-07 | DEC-072 | ETOZ / ETDZ meanings | Unverified | Nothing unless material |
| OQ-08 | Q-AUD-06 / SRC-07 | Company output template files | Missing source | P8 validation only |
| OQ-09 | DEC-065 | Bandar Abbas vs Rajaee — same port or two? | Unverified | P10 seeding only |
| OQ-10 | — | Jebel Ali English display name | Business confirmation | Nothing (display string) |
| OQ-11 | — | Cargo deletion policy (soft vs hard) | Business decision | Nothing (reversible) |
| OQ-12 | Q-AUD-05b / Q-AUD-25 | Retention periods (legal/accounting) | Compliance input | Production enablement + P12 configuration |
| **OQ-13** | Q-AUD-26 | Which services are taxable; applicable rates | Business config + tax compliance | P3 configuration only |
| **OQ-14** | Q-AUD-09 | Complete port list + remaining abbreviations | Missing source | P10 constraint step only |
| **OQ-15** | DEC-010 | Unrealised FX gain recognition policy | Accounting policy | P6 architecture |

**Rows marked in bold were recovered from this table during reconciliation** — they were open in the master
disposition but had been omitted from `open-questions.md`.

---

## Closure statement (2026-10-12)

Following owner decisions on **OQ-03**, **OQ-06**, **OQ-09** and **OQ-12**, **no business-decision question
remains unanswered** from the 15-item register.

### Classification — every OQ appears exactly once (total 15)

| Category | Count | OQ IDs |
| --- | --- | --- |
| A · Resolved by employer evidence (EMP statements / official documents) | 6 | OQ-01, OQ-02, OQ-05, OQ-07, OQ-10, OQ-13 |
| B · Resolved by an existing confirmed decision (no new owner input) | 3 | OQ-11, OQ-14, OQ-15 |
| C · Resolved by owner decision (2026-10-12) | 4 | OQ-03, OQ-06, OQ-09, OQ-12 |
| D · Not a business decision (data/source item, no decision required) | 2 | OQ-04, OQ-08 |
| **Total** | **15** | **OQ-01 … OQ-15, each exactly once** |

**6 + 3 + 4 + 2 = 15.**

> **Correction note (2026-10-12).** An earlier draft of this classification placed OQ-08 in a category with an
> ambiguous parenthetical ("2 (OQ-02, 04, 08 → 3 incl. OQ-08)"), which made the arithmetic unverifiable and
> made OQ-08 appear in more than one place. **Each OQ now belongs to exactly one category.** The totals above
> are the authoritative counts.

### Basis per category

- **A — employer evidence.** Answered from the employer's own statements or from the official sample PDFs
  (per-OQ evidence is recorded in `open-questions.md`).
- **B — existing confirmed decision.** Settled by a pre-existing decision: DEC-049/050 (OQ-11),
  DEC-064/065 (OQ-14), DEC-010 (OQ-15). No new owner input was required.
- **C — owner decision.** Settled by owner decision on 2026-10-12 and recorded as DEC-115 (OQ-03),
  DEC-116 (OQ-06), DEC-117 (OQ-09), DEC-118 (OQ-12).
- **D — not a business decision.** No decision exists to be made: OQ-04 is a data anomaly in one sample;
  OQ-08 is the absence of **editable template source files** (official samples and a rendering specification
  are present).

### Outstanding inputs — none of these is a business decision

| Input | Type | Needed for | Blocking |
| --- | --- | --- | --- |
| Documentary confirmation of Rajaee ↔ Bandar Abbas | Data **provenance** (non-blocking, DEC-117) | Port record provenance | **No** — the decision is settled |
| Retention periods for identity documents / salary slips | Compliance / legal (DEC-118) | Production enablement of sensitive capture only | No |
| Editable template source files | Source | Visual-fidelity validation only (P8) | No |
| Complete port list | Data entry | P10 constraint step | No |
| Customer code format string | Configuration | P2 seeding | No |
| Taxable services and VAT rates | Business configuration + tax compliance | P3 invoicing configuration | No |

Phase P0 is **not** blocked by any open question.
