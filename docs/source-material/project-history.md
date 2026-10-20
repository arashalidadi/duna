# Project history and references — source material

State of the project as analysed, AI reference material, traceability, original sources, the analysis summary and the final report.

> Merged from 16 files on 2026-10-20. Every original document appears below in full, under a heading naming its former path.

---

## duna-analysis/05-current-project/current-gaps-and-roadmap.md

# Current Gaps & Roadmap

> Phase 8, part 4. Where the current system stands against the employer's 127 requirements, and what
> the project's own roadmap says comes next.
>
> This maps **employer requirement → current state**. The reverse view (requirement → legacy →
> document evidence) is in
> [`../04-business-analysis/capability-gap-analysis.md`](../04-business-analysis/capability-gap-analysis.md).

---

## 1. Requirement coverage

Legend: ✅ met · 🟡 partial / transitional · ❌ not met · ⏳ scheduled

| REQ range | Area | State | Notes |
|---|---|---|---|
| 001–004 | Navigation: six sections, accordion | 🟡 | The current nav is flat-ish; sidebar redesign is Phase 9. **Company Archive** (REQ-004) ❌ |
| 010–021 | Customer master | ✅ | Name-only mandatory, auto code. Code format unresolved (C-06) |
| 030–036 | Port / Yard masters | ✅ | Port = name/city/country + abbreviation ✅ |
| 037–038 | Vessel master (tug/barge) | ✅ | ADR-027 vessel type |
| 040–042 | Voyage master, per-destination numbering | ✅ | ADR-026/027. Numbering is per-destination **leg**, not per vessel+destination — worth confirming |
| 044–055 | Shipper / Consignee / Agent masters | ✅ | Masters active; `AgentDestination` enables scoping |
| 060–070 | Cargo registration | ✅ | Lifecycle, type, comments, days-in-port |
| 065–067 | **Cargo comments visible to accounting** | 🟡 | `comments` canonical, visible to `cargo:read` (ADR-044). Whether "accounting" specifically sees it needs confirmation |
| 075–082 | Inspection | ✅ | 5-state ledger, duplicate guard, gates readiness |
| 083–094 | Load list | ✅ | 3-state lifecycle, abbreviation, editable |
| 100–105 | B/L draft → final, revisions | ✅ | ADR-045/046 — revisions with frozen numbers, configurable state names |
| 102–103 | **B/L numbering per destination** | 🟡 | Mechanism ✅, **format** unresolved (C-01) |
| 107 | Co-loading / partner B/Ls | 🟡 | Per-item parties now exist; free-format partner numbers need confirmation |
| 110–116 | Manifest = consolidation of B/Ls | 🟡 | ADR-047 design accepted; **Phase 5 unit 5 pending** |
| 120–122 | PDF / Print / Excel, stamp vs no-stamp | ⏳ | **Phase 7.** Currently no output at all |
| 124 | Uploadable document templates, 9 types | ⏳ | Models exist; rendering is **Phase 7** |
| 130–135 | Job costing | ✅ | `Job` + `JobCostItem`, self-contained |
| 134 | **Invoice ↔ Job link** | ❌ | Explicitly listed as missing |
| 140–144 | Invoice lines, **VAT per line** | 🟡 | Lines ✅; **VAT is currently a header field, not per line** — contradicts `REQ-144` |
| 141 | Invoice may span several B/Ls | 🟡 | Optional single `billOfLadingId`; a true many-link is not present |
| 147 | Invoice due date | ❌ | `Invoice` has no due date; `Proforma` has `validUntil` |
| 149 | Partial payment state | ✅ | `paidAmount` cache + derived statement |
| 150 | Invoice auto-draft from issued B/Ls | ❌ | Open business decision §1.4 |
| 154, 184 | Alerts / notifications | ❌ | Not implemented |
| 160–163 | Ledger / running balance | ✅ | Derived statement |
| 165 | **Voucher allocation to several invoices** | ❌ | Single `invoiceId` FK; no `VoucherAllocation` |
| 166–167 | **General Journal** | ❌ | Explicitly listed as missing |
| 168 | ID-card capture | ❌ | `FileAttachment` exists but no ID-doc field on vouchers |
| 169–170 | Salary | ✅ | Self-contained; no ledger posting by design (ADR-036) |
| 171–172 | Payment to a named person | ❌ | Vouchers are customer-centric by design |
| 180–184 | Release workflow | 🟡 | `ReleaseOrder` + "no money, no cargo" ✅; **credit / partial / approver policy unconfirmed** (NBD §1.2) |
| 185–186 | Delivery order | ✅ | `DeliveryOrder`, issued directly |
| 187–188 | **Agent portal, destination-scoped** | 🟡 | Scoping foundation ✅ (ADR-040); **destination-scoped B/L/Release visibility is Phase 8** |
| 190–194 | Reports / voyage P&L | ⏳ | **Phase 8** |
| 004 | Company Archive | ❌ | Undescribed by the employer |

### 1.1 Counts

| State | Count |
|---|---|
| ✅ Met | 15 areas |
| 🟡 Partial / transitional | 10 areas |
| ❌ Not met | 12 areas |
| ⏳ Scheduled | 4 areas |

---

## 2. The roadmap (`docs/plan.md`)

| Phase | Objective | State |
|---|---|---|
| **2** | Master Data & Party Model Realignment | ✅ CLOSED |
| **3** | Operational Flow Reconciliation | ✅ CLOSED |
| **4** | B/L Rewrite | ✅ Complete (units 1–7) |
| **5** | Manifest Rewrite | 🟡 Units 1–4 of 5 |
| **6** | Commercial, Job & Accounting | ⬜ Not started |
| **7** | Document Engine, Templates, Attachments & Archive | ⬜ Not started |
| **8** | Customer 360, Agent Portal & Reporting | ⬜ Not started |
| **9** | UX Stabilization, E2E Hardening & UAT Readiness | ⬜ Not started |

### 2.1 What Phase 6 must deliver (per the roadmap)

Commercial, job and accounting reconciliation — this is where most of the ❌ items above live:

- Invoice ↔ Job link
- Per-line VAT (replacing header VAT)
- `VoucherAllocation` (a voucher split across several invoices)
- `GeneralJournal` / `JournalLine`
- Invoice correction flow (cancel/reissue vs credit note — open decision §1.8)

### 2.2 What Phase 7 must deliver

- Document engine with uploaded templates (`DocumentTemplate` + versions)
- Stamp / no-stamp behaviour (`REQ-121`, `REQ-122`)
- PDF and Excel output (`REQ-120`)
- Attachments
- Archive

### 2.3 What Phase 8 must deliver

- Customer 360 page and endpoint
- Destination-scoped agent portal (`REQ-187`, `REQ-188`)
- Full reporting, including voyage P&L (`REQ-190`–`REQ-194`)

---

## 3. Open business decisions carried by the project

From `docs/plan.md`. **These are the same questions this knowledge
base flags independently** — which is a useful cross-check: two independent analyses of the same
transcripts reached the same unknowns.

| # | Decision | Impact | Status here |
|---|---|---|---|
| 1.1 | B/L lifecycle status names and release modelling | B/L statuses, release field, UI | CLOSED by **ADR-046** (four states; `RELEASED` = enum + `bill:release` + audit) |
| 1.2 | Release Order approval and override policy | ReleaseOrder eligibility, audit | **Still open** — "no money, no cargo" confirmed; partial/credit/approver rules not |
| 1.3 | Delivery Order eligibility rule | DO creation | **Still open** |
| 1.4 | Invoice auto-draft from B/L | Invoice creation flow | **Still open** (`REQ-150`) |
| 1.5 | Job creation trigger | When jobs are created | **Still open** |
| 1.6 | Party phone/email ownership | Contact field design | **Still open** |
| 1.7 | VAT taxability, rates, report scope | Invoice VAT defaults | **Still open** (`REQ-144`) |
| 1.8 | Invoice correction flow | Cancel/reissue vs credit note | **Still open** |
| 1.9 | Notifications and alerts | Alert scope | **Still open** (`REQ-154`) |
| 1.10 | Archive retention and re-opening | Archive policy | **Still open** (`REQ-004`) |
| 1.11 | Document template content and formats | Template upload | **Still open** (`REQ-124`) — but 7 real specimens now exist as the design basis |
| 1.12 | Agent extra capabilities | Agent portal scope | **Still open** (`REQ-187`) |

Plus one carried from ADR-044: **cargo comment — single mutable field vs append-only comment/activity
log.**

### 3.1 Where this knowledge base can help

| Open decision | Evidence now available here |
|---|---|
| 1.2 Release policy | `REQ-180`–`REQ-183`; legacy Release Manager was view-only |
| 1.4 Invoice auto-draft | `REQ-141`, `REQ-150` |
| 1.7 VAT | [`../02-business-documents/invoices.md`](../02-business-documents/invoices.md) — the real specimen has **VAT 0.00** and per-line VAT columns |
| 1.11 Templates | [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md) — 7 real specimens, field-by-field |
| 1.12 Agent portal | `REQ-187`, `REQ-188`, `EMP-159` |
| Archive (1.10) | Only `EMP-713` — still thin |
| Cargo comment (ADR-044 d) | `REQ-065`–`REQ-067` |

---

## 4. Risks in the current system

| # | Risk | Evidence |
|---|---|---|
| R1 | **No web test harness.** `apps/web` has no tests. The API suite cannot see web defects | A shipped Inspections-page defect (dead endpoints + status-vocabulary crash) was found by hand, not by CI |
| R2 | **No PDF/print at all today.** The legacy system could print nine document types; the current system can print none | Phase 7 is the only thing closing `REQ-120`–`REQ-122` |
| R3 | **Number formats do not match reality** | Every current format (`BOL-…`, `MAN-…`, `INV-…`) differs from the real documents. Cheap to fix (ADR-008 makes them data), but **someone must ask the employer** |
| R4 | **Finance gaps cluster.** Per-line VAT, voucher allocation, general journal, invoice↔job link are all missing, and all land in one phase | Phase 6 is the highest-business-risk phase in the roadmap |
| R5 | **The authoritative transcript set is absent** (`SRC-01`) | `docs/current-plan/` was written against `/home/duna/dunaData/transcripts/`, which is not in this workspace |
| R6 | **Three pre-existing `tsc` errors in `apps/web`** | Baseline, but they will hide new ones |
| R7 | **Frozen demo data loss incident** — a cleanup script cascade-deleted LoadListItems; a DB backup exists at `/home/duna/backups/shipping_erp_20260926_112141.dump` | Recorded in `11-implementation-state.md` |

---

## 5. Recommended order for a future agent

1. **Ask the employer the format questions.** C-01…C-07 are cheap to answer and block every
   document. The current system is built to accept the answer without code changes.
2. **Confirm the VAT question** (per-line vs header) before Phase 6 touches the invoice.
3. **Do not start Phase 7 design until the 7 real specimens have been read.** They are the template
   spec.
4. **Add a web test harness** before Phase 9 — R1 has already cost one shipped defect.
5. **Treat `docs/current-plan/` as the authority for *how*, and this knowledge base as the authority
   for *what and why*.**

---

## duna-analysis/05-current-project/documentation-map.md

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
| `../operations.md` | How to run the stack locally |
| `../operations.md`, `../operations.md` | API connectivity |
| `../operations.md` | Login verification |
| `../operations.md`, `../operations.md` | Deployment |
| `../ui.md` | UI redesign notes |

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

`docs/plan.md` gives the rules. Extended with this knowledge base:

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

---

## duna-analysis/05-current-project/implemented-capabilities.md

# Current System — Implemented Capabilities

> Phase 8, part 2. What the current system **already does**, module by module, with the ADR that
> governs each behaviour.
>
> State as of **2026-10-06**: Phase 5 unit 4 complete; **403/403** API tests green; 37 migrations up
> to date.
>
> **Update 2026-10-12 (Phase 1 review, additive).** On 2026-10-12 the 22 API e2e suites were executed in a sandbox against a fresh, disposable database with only the required seed: **22/22 suites and 403/403 tests passed**, and a second run on the same database also passed. This used a sandbox-only WASM Prisma engine and a test-only Jest mapping, not the production native engine, so it is evidence about the code under that harness. The native-engine baseline on the owner's server is still pending (acceptance A4). See [`../09-audit/e2e-sandbox-run-2026-10-12.md`](../09-audit/e2e-sandbox-run-2026-10-12.md).

---

## 1. Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation / infrastructure | ✅ Complete |
| 1.5 | API connectivity verification | ✅ Complete |
| 1.75 | Professional UI/UX redesign | ✅ Complete |
| 2 | Master Data & Party Model Realignment | ✅ **CLOSED** (4/4 acceptance, 4/4 tests) |
| 3 | Operational Flow Reconciliation (units 1–6) | ✅ **CLOSED** (3/3 acceptance, 4/4 tests) |
| 4 | **B/L Rewrite** (units 1–7) | ✅ Complete — lifecycle, decoupling, per-destination numbering, revisions, release separation, UI + document hooks |
| 5 | **Manifest Rewrite** (units 1–4 of 5) | 🟡 Unit 4 complete; **U5 (UI consolidation flow + document hook) pending** |
| 6 | Commercial, Job & Accounting | ⬜ Not started |
| 7 | Document Engine, Templates, Attachments & Archive | ⬜ Not started |
| 8 | Customer 360, Agent Portal & Reporting | ⬜ Not started |
| 9 | UX Stabilization, E2E Hardening & UAT Readiness | ⬜ Not started |
| 14 | Proforma Invoices | ✅ Complete (older numbering) |
| 16 | Employees & Payroll | ✅ Complete |
| 17 | Letters | ✅ Complete |
| 18 | Jobs & Job Costing | ✅ Complete |
| 20 | Agent Portal (bookings-focused) | 🟡 Partial |

---

## 2. Identity & access

| Capability | Notes | ADR |
|---|---|---|
| Auth, JWT + rotating refresh | Opaque DB-backed refresh tokens | 014 |
| RBAC, 105 permissions / 12 resources | Seeded read-only registry | 016 |
| User roles, soft-deleted roles | No `isActive` column | 015 |
| Company settings, currencies | Typed tables (replaces legacy `key_values`) | — |
| Audit log | Append-only, same-transaction | 010 |

---

## 3. Master data

| Entity | Capability | ADR |
|---|---|---|
| **Customer** | Name-only mandatory, auto code, active/inactive | 018 |
| **Port** | name / city / country / **abbreviation** (abbreviation used in load lists) | — |
| **Yard** | Port-scoped | — |
| **Vessel** | Type + **tug/barge** modelling | — |
| **Voyage** | State machine, **per-destination leg numbering** | 026, 027 |
| **Shipper / Consignee / Agent** | Masters, now the **active** party model on B/L and Manifest | — |
| **AgentDestination** | Destination-scoped agent linking (enables agent scoping) | 040 |

**Single-vessel no-overlap scheduling** is enforced, with a vessel lifecycle guard (ADR-027).

---

## 4. Operations

| Entity | Capability | ADR |
|---|---|---|
| **Cargo** | Lifecycle state machine; `CargoType`; **comments** canonical and visible to `cargo:read` | 019, 021, 022, 044 |
| **YardInventory** | One current record per cargo | 020 |
| **Inspection** | **Ledger** model: `PENDING → BOOKED → DONE \| FAILED → NEEDS_REINSPECTION`; duplicate-pending guard; authoritative cargo readiness | 024, 025 |
| **LoadList** | 3-state: `DRAFT → FINALIZED (→ CANCELLED)` | 041 |
| **ActualLoading** | Server-enforced lifecycle, one per load list, lines **materialized at create**, manifest eligibility = `actualQuantity > 0` | 028, 042, 043 |
| **Discharge** | Mirror of Actual Loading; expected-from-loaded; `DELIVERED` on full lines | 039 |
| **BookingRequest** | Agent portal bookings | — |

**Key behaviours already correct:**

- Inspection **hard-gates** cargo readiness (`REQ-082`) — implemented, unlike the legacy system.
- Cargo not loaded **returns to the yard** and stays eligible for later planning (ADR-043).
- Not-loaded lines are excluded from downstream documents (`actualQuantity > 0`).

---

## 5. Documents

| Entity | Capability | ADR |
|---|---|---|
| **BillOfLading** | Source of truth = **voyage + actually-loaded cargo** (Manifest decoupled to nullable legacy); lifecycle `DRAFT → ... → RELEASED` with configurable state names; release as a separate `bill:release` transition; snapshot revisions with frozen bill numbers; per-destination numbering `BOL-{DEST}-YYMM-#####` | 030 (partly superseded), **045**, **046** |
| **Manifest** | **Downstream consolidation of APPROVED B/Ls**; per-item parties; `ManifestItem → BillOfLadingItem` reference; per-destination numbering `MAN-{DEST}-YYMM-#####`; no drops, no charges | 029, **047** |
| **Invoice** | Line model `quantity × unitPrice`, server-maintained `amount` | 031 |
| **Proforma** | Mirrors invoice math; one-time conversion to invoice via `linkedInvoiceId`; zero financial effect; `validUntil` instead of `dueDate` | 034 |
| **Quotation** | `DRAFT → SENT → ACCEPTED \| REJECTED` (+CANCELLED); SENT freezes content; converts to **Proforma only** | 035 |
| **DeliveryOrder / ReleaseOrder** | Issued directly (no draft); one active per B/L; **"no money, no cargo"** release hold; `release:override` permission + mandatory reason; eligibility endpoint | 033 |
| **Letter** | Direction-driven lifecycle (INCOMING → RECEIVED; OUTGOING DRAFT → SENT → ARCHIVED); threaded replies via `replyToId` | 037 |

### 5.1 The B/L release rule (ADR-033, ADR-046)

```
Release order allowed if EVERY issued invoice anchored to the B/L is fully paid
  (paidAmount >= totalAmount).
A B/L with zero invoices releases freely.
Breach  -> 409 naming the outstanding total.
Escape  -> `release:override` permission + mandatory overrideReason
           stamps financialOverride = true, reason kept for audit.
Permission violation -> 403. Missing reason with force -> 400.
```

This is the **"no money, no cargo"** principle the employer confirmed, implemented with an audited
exception path rather than hard-coded policy.

---

## 6. Finance

| Entity | Capability | ADR |
|---|---|---|
| **Voucher** | `RECEIPT \| PAYMENT`, nullable `invoiceId` (advances allowed); `RCP-YYMM-#####` / `PMT-YYMM-#####`; POSTED stays editable, cancel-with-reason is the only exit, delete only after cancel | 032 |
| **Invoice.paidAmount** | A **cache** recomputed from live non-cancelled vouchers on every mutation — never incremented | 032 |
| **Ledger** | **No table.** Derived by merging ISSUED invoices (debit) + POSTED vouchers (credit), with opening/running/closing balances, ordered by date, filterable by currency/window/kind | 032 |
| **Job / JobCostItem** | Self-contained cost sheet, `INCOME \| COST` lines, lifecycle-frozen on COMPLETED, **read-time totals**, no accounting coupling | 038 |
| **SalaryRecord** | Self-contained; `pay()` posts **no** voucher and **no** ledger entry (Voucher is customer-centric by design); `@@unique(employeeId, year, month)` prevents double pay | 036 |

### 6.1 What this means for `REQ-160`–`REQ-167`

| Requirement | Current state |
|---|---|
| Ledger / running balance | ✅ Derived statement exists — no table needed |
| General Journal (`REQ-166`) | ❌ **Not implemented** — explicitly listed as missing in `09-final-implementation-roadmap.md` §2.2 |
| Voucher allocation (`REQ-165`) | ❌ **Not implemented** — `Voucher` has a **single** `invoiceId` FK; no `VoucherAllocation` table |
| Job link on invoice | ❌ Not present (roadmap §2.2) |
| Header VAT on invoice | ⚠️ Present — but the employer asks for **per-line** VAT |
| Salary | ✅ Implemented, self-contained |

---

## 7. Portal

| Capability | State |
|---|---|
| Agent portal, server-side company scoping via unique user→customer link (ADR-040) | ✅ Foundation |
| Destination-scoped B/L / Release visibility | ❌ **Pending** (Phase 8) |
| Customer 360 page / endpoint | ❌ **Pending** (Phase 8) |
| Portal bookings | ✅ (`BookingRequest`) |

---

## 8. Platform

| Capability | State |
|---|---|
| `NumberingSequence` + `NumberingService` with `FOR UPDATE` locking | ✅ |
| `AuditLog` | ✅ |
| `FileAttachment` | ✅ model exists; attachments deferred (ADR-037 defers letters) |
| `DocumentTemplate` + `DocumentTemplateVersion` | ✅ models exist; **rendering pipeline is Phase 7** |
| PDF output | ❌ **Not implemented** — Phase 7 |
| Stamp / no-stamp print | ❌ **Not implemented** — Phase 7 |
| Notifications / alerts | ❌ **Not implemented** |
| Reports | ❌ Only seeds; Phase 8 |

---

## 9. What is already *better* than the legacy system

| Legacy defect | Current state |
|---|---|
| **D1** B/L `RELEASED` never written | ✅ `RELEASED` is a real state with a `bill:release` transition and audit |
| **D3** invoice reads wrong column | N/A — rewritten |
| **D4** VAT double-counted | ✅ Server-maintained amounts (ADR-031) |
| **D7** credit balances print 0 | N/A — ledger derived, no legacy code |
| **D8** statement ordered wrong | ✅ Ordered by date ascending |
| **D10** hard-coded role id 8 | ✅ Soft-delete roles, seeded registry |
| **D11** hard-coded vessel on manifest | ✅ Vessel master + voyage snapshot |
| **D12** voyage keyed on port+shipper | ✅ Per-destination leg numbering on the Voyage entity |
| **D13** random number components | ✅ `NumberingSequence` with locking |
| **D14** `'CUST00'.(id+1)` | ✅ Configurable numbering |
| Customers were users | ✅ Customer is its own entity |
| `@can` only hid buttons | ✅ Server-side enforcement |
| No audit trail | ✅ `AuditLog` |
| No vessel / voyage masters | ✅ Both exist |
| No job costing | ✅ `Job` + `JobCostItem` |
| No delivery / release orders | ✅ Both exist |
| Free-text quotation | ✅ `Quotation` + `QuotationItem` with a 5-state lifecycle |
| No PDF | ⏳ Phase 7 |
| No document templates | ⏳ Phase 7 |
| No agent portal scoping | ⏳ Phase 8 |
| No general journal | ⏳ Not yet scheduled |
| No voucher allocation | ⏳ Not yet scheduled |

---

## 10. Known open items in the current system

Recorded in `docs/plan.md` — **not** re-derived here, but the ones
that matter for future business work:

| Item | State |
|---|---|
| `portalManifestScopeIds` still ORs the legacy `portalCustomerId` shim | Transitional; awaits cleanup decision |
| Invoice header VAT instead of per-line | Contradicts `REQ-144` |
| Voucher single-invoice FK | Contradicts `REQ-165` |
| No `GeneralJournal` / `VoucherAllocation` | Contradicts `REQ-166` |
| No job link on invoice | Contradicts `REQ-134` |
| Agent portal not destination-scoped | Contradicts `REQ-187` |
| No Customer 360 | Phase 8 |
| No complete document output pipeline | Phase 7 |
| No full reporting | Phase 8 |
| `tsc` web has 3 pre-existing errors in `[locale]/page.tsx` | Baseline, not a regression |
| **No web test harness at all** | Structural risk |

See [`current-gaps-and-roadmap.md`](current-gaps-and-roadmap.md) for the mapping to employer
requirements.

---

## duna-analysis/05-current-project/legacy-vs-current-comparison.md

# Legacy vs Current — Comparison

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> ⚠️ **Read the standing rule first:**
>
> **Legacy Laravel behaviour is historical evidence, NOT the specification.**
> The current system is **not** a port of the legacy system, and the legacy system must **not** be
> used to decide what the current system should do. Where the two differ, the **employer's
> statements** decide — and where the employer is silent, the current system's own ADRs decide.
>
> **Do not delete a current feature merely because the old system lacked it.**
> **Do not plan to replace the current dashboard with the legacy one.**

---

## 1. At a glance

| Dimension | Legacy Laravel | Current Next.js / NestJS |
|---|---|---|
| Framework | Laravel 10, PHP 8.1, Blade, jQuery, Bootstrap | NestJS + Next.js App Router, React, TypeScript, Tailwind |
| Files / LOC | 199 files, 22,833 PHP + 15,409 Blade | 33 API modules / 38 controllers / 35 web pages; Prisma schema 93.8 KB |
| Models | 23 Eloquent | 62 Prisma models, 25+ enums |
| Migrations | **4** (all stock; schema un-migrated) | **38** |
| Tests | **4 stock scaffolds; no real tests** | **22 e2e suites, 403 tests, 0 failing**; **no web tests** |
| API | None usable (one stock Sanctum route) | Full REST at `/api/v1`, 38 controllers |
| Auth | Session + `level` string | JWT + rotating DB-backed refresh token |
| Permissions | ~35, enforced in **Blade only** | 105 across 12 resources, enforced **server-side** |
| Documents | Browser print only | Models + registry ready; **rendering is Phase 7** |
| Numbering | Random components | `NumberingSequence` with `FOR UPDATE` locking |
| Audit | None | `AuditLog`, same-transaction |
| Multi-tenancy / scoping | None | Port/agent/destination scoping, server-enforced |
| Customer portal | Unscoped `/profile` | `/portal` with server-side company scoping |

---

## 2. Entity-by-entity

| Legacy | Current | Verdict |
|---|---|---|
| `users` (**staff and customers together**) | `User` + `Customer` | ✅ **Fixed** — the single most important correction |
| `roles`, `permissions`, `has_role` | `Role`, `Permission`, `RolePermission`, `UserRole` | ✅ |
| `key_values` (18 keys) | `CompanySettings` + `Currency` | ✅ Typed instead of a KV bag |
| `ports` (`title`, `abbreviation`) | `Port` (name, city, country, code, abbreviation) | ✅ Matches `REQ-030` |
| `yards` | `Yard` | ✅ |
| — | **Vessel** (`VesselType`, tug/barge) | ✅ **New** |
| `portshippers` (voyage counter) | **Voyage** + `VoyageDestination` | ✅ **New**, correctly keyed |
| `shippers`, `consignees`, `agents` | `Shipper`, `Consignee`, `Agent`, **`AgentDestination`** | ✅ Party masters are now **active** |
| `loadings` | `Cargo` + `YardInventory` + `Inspection` | ✅ Decomposed |
| `docs` (ad-hoc uploads) | `FileAttachment` | ✅ Generalised |
| `loadinglists` | `LoadList`, `LoadListItem` | ✅ |
| — | **ActualLoading**, `ActualLoadingItem` | ✅ **New** — "what was really loaded" |
| — | **Discharge**, `DischargeItem` | ✅ **New** |
| `manifests`, `items` | `Manifest`, `ManifestItem` | ✅ **Inverted in the right direction** |
| `bls` | `BillOfLading`, `BillOfLadingItem`, **`BillOfLadingRevision`** | ✅ Revisions are first-class |
| `invoices` (inline items) | `Invoice`, `InvoiceItem` | ✅ Correct arithmetic |
| `fins` | `Voucher` + **derived ledger** | ✅ No table, cannot disagree |
| `offers` | *(merged into Quotation)* | ✅ Simplification |
| `quotations` (free text) | `Quotation`, `QuotationItem` | ✅ Line items, 5-state lifecycle |
| `performas`, `performa_items` | `Proforma`, `ProformaItem` | ✅ + conversion to invoice |
| — | **DeliveryOrder**, **ReleaseOrder** | ✅ **New** |
| — | **Job**, `JobCostItem` | ✅ **New** |
| — | **Employee**, `SalaryRecord` | ✅ **New** |
| — | **Letter** | ✅ **New** |
| — | **BookingRequest** (portal) | ✅ **New** |
| — | **NumberingSequence** | ✅ **New** |
| — | **AuditLog** | ✅ **New** |
| — | **FileAttachment** | ✅ **New** |
| — | **DocumentTemplate**, `DocumentTemplateVersion` | ✅ **New** (rendering pending) |

---

## 3. Behaviour comparison

### 3.1 Process order

| | Legacy | Current | Employer |
|---|---|---|---|
| Manifest ↔ B/L | Manifest **first**; B/Ls created against it | B/L **first**; Manifest consolidates APPROVED B/Ls (`ADR-047`) | ✅ B/L first |

**The current system is right and the legacy system was wrong.**

### 3.2 Party ownership

| | Legacy | Current |
|---|---|---|
| Shipper / Consignee / Notify | Set on the **manifest**, defaulted onto B/Ls | Set **per B/L** (and per manifest item) |

The current model is what makes `REQ-107` (partner B/Ls on one manifest) implementable.

### 3.3 Status machines

| Concept | Legacy | Current |
|---|---|---|
| Cargo | `admin_status` (PENDING/APPROVED), `inspection_status` (4 values), `loading_status` (2 values) | `CargoStatus`, `InspectionStatus` (5 values), `LoadingStatus` — plus `ActualLoading`/`Discharge` lifecycles |
| B/L | `status` = `PENDING` (never `RELEASED`), `bl_status` = `-`/`SURRENDERED` | `DRAFT → … → RELEASED` with configurable names, `bill:release` transition, revisions |
| Invoice | `PAID` / `UNPAID` | `InvoiceStatus` + `paidAmount` cache + derived statement |
| Manifest | none | `ManifestStatus` |
| Load list | none (a record, not a lifecycle) | `DRAFT → FINALIZED (→ CANCELLED)` |
| Quotation | none | `DRAFT → SENT → ACCEPTED \| REJECTED (+CANCELLED)` |
| Proforma | none | mirrors invoice |

### 3.4 Money

| Behaviour | Legacy | Current |
|---|---|---|
| Invoice → customer | `Fin` row, `type='invoice'`, `debit` | ISSUED invoice is the debit side of the derived statement |
| Receipt | `Fin` row, `type='reciept'`, `credit` | `Voucher` `RECEIPT`, POSTED |
| Payment | `Fin` row, `type='payment'`, `debit`, ID-doc | `Voucher` `PAYMENT`, POSTED |
| Balance | `users.debit` / `users.credit` columns, recomputed | **Derived** from invoices + vouchers |
| Partial payment | ❌ (PAID/UNPAID only) | ✅ `paidAmount` |
| Advance / unallocated | ✅ by omission | ✅ `invoiceId` nullable by design |
| Allocation to several invoices | ❌ | ❌ **Still single-invoice FK** — gap vs `REQ-165` |
| General journal | ❌ | ❌ — gap vs `REQ-166` |
| ID-card capture | Payment form only | ❌ Not present (`FileAttachment` exists) |
| Multi-currency | Free-text field | ✅ `Currency` entity |

### 3.5 Numbering

| Document | Legacy | Current | Real documents |
|---|---|---|---|
| B/L | `{port.abb}/{yymmdd}` | `BOL-{DEST}-YYMM-#####` | `KHS/26-110` |
| Manifest | `{port.abb}/{rand6}{ddmmyyyy}` | `MAN-{DEST}-YYMM-#####` | `DSMAN/KHO-26-006` |
| Invoice | `DSAED/{rand6}` | `INV-YYMM-#####` | `DSINV/26-172` |
| Proforma | `SDPRO/…` (transposed) | `PRF-YYMM-#####` | `DSPRO/26-001` |
| Quotation | random | `QT-YYMM-#####` | `DSQUO/25-017` |
| Receipt | 3-series scheme | `RCP-YYMM-#####` | **`477`** (plain numeric — *corrected 2026-10-11; was `DSR/26-190`*, fabricated) |
| Payment | 3-series scheme | `PMT-YYMM-#####` | — |
| Voyage | counter on `Portshipper` (port+shipper) | per-destination leg numbers | `02/26` |
| Customer | `CUST00{id+1}` | configurable sequence | `CUST …` (format unresolved) |

**Neither legacy nor current matches the real documents.** The current system is *closer in spirit*
(destination-scoped, sequential, locked) and — critically — the format is **data**, so it can be
changed without code (ADR-008).

### 3.6 Document output

| | Legacy | Current |
|---|---|---|
| Mechanism | Blade + jQuery `printPreview` | Models + registry exist; **no renderer yet** |
| PDF | ❌ | ⏳ Phase 7 |
| Excel | ❌ (declared, class missing) | ⏳ Phase 7 |
| Print without stamp | ✅ (only mode) | ⏳ Phase 7 |
| Print/PDF with stamp | ❌ | ⏳ Phase 7 |
| Uploadable templates | ❌ (global images only) | ⏳ Phase 7 |

> **This is the one area where the legacy system is currently ahead.** It could print all nine
> document types; the current system cannot print any. That is a **phase-7 scheduling fact**, not a
> reason to port the legacy renderer.

### 3.7 Access control

| | Legacy | Current |
|---|---|---|
| Tier check | `level == 'Admin'` / `'User'` | JWT + roles |
| Permission check | `@can` in Blade — **UI only** | Server-side guards |
| Count | ~35, uneven | 105 across 12 resources |
| Granularity flag | — | `roleGranularPermissions` |
| Portal scoping | None | Server-side, company-scoped; destination scoping pending |

---

## 4. Where the legacy system was right and the current system should check itself

A short list, because it is genuinely short — but it should not be zero, and these are worth
verifying rather than assuming the new system is better:

| Legacy behaviour | Why it may matter |
|---|---|
| **Days-in-port** computed and shown on the cargo list | Confirm the current system surfaces it (`REQ-070`) |
| **Inspection status on the cargo row** in the load list | Confirm the current load list shows it (`REQ-085`) |
| **Load list uses the port abbreviation** | Legacy did **not** do this — but confirm the current one does (`REQ-033`) |
| **ID-card upload on the payment form** | The current `Voucher` has no ID-doc field; `REQ-168` asks for one |
| **Payment and receipt as separate permissions** | Good granularity; confirm the current permission set keeps them separate |
| **Invoice payment status as its own permission** | Same |
| **The real shape of the load list** (`NO, CUSTOMER, SHOWROOM, DESCRIPTION, QTY, YARD, ARRIVAL, INSP, LOAD DATE, DAYS`) | Matches `REQ-085`; confirm the current load list matches |

---

## 5. What must NOT be carried over

| Legacy behaviour | Why not |
|---|---|
| Manifest-first B/L creation | Contradicts the employer (`EMP-024`–`EMP-027`) |
| Parties defaulted from the manifest | Blocks co-loading |
| `admin_status` management review | Legacy-only; the employer never asked for it |
| Random number components | Non-reproducible, non-auditable |
| `'CUST00'.(lastId+1)` | No configurability |
| Hard-coded role id 8 on role deletion | An accident |
| Two customer-creation paths | An accident |
| `Offer` as a separate entity from `Quotation` | Merged, deliberately |
| Free-text quotation body | Cannot reproduce the real `DSQUO/25-017` |
| VAT added to a VAT-inclusive subtotal | Arithmetic error |
| `reciept` / `compayname` / `measurment` misspellings | Do not recreate them as identifiers |
| SMS gateway, wallet, `State`/`City`, `UsersExport` | Dead code from a forked e-commerce project |

---

## 6. Feature-presence matrix (legacy had it → current has it?)

| Legacy screen / capability | Current equivalent | State |
|---|---|---|
| Dashboard counts | `dashboard` page | ✅ Better |
| Cargo list + filters | `cargo` page | ✅ |
| Cargo detail drawer | cargo detail | ✅ |
| Cargo document upload | `FileAttachment` | ✅ |
| Management review | — | ❌ **Deliberately dropped** (legacy-only) |
| Yards CRUD | `yards` page | ✅ |
| Ports CRUD | `ports` page | ✅ + abbreviation |
| Load list create / preview | `load-lists` page | ✅ + 3-state lifecycle |
| Load list print | — | ⏳ Phase 7 |
| Manifest list / create / preview | `manifest` page | ✅ (rewrite in progress) |
| Manifest print | — | ⏳ Phase 7 |
| B/L list / create / preview | `bills` page | ✅ Much better |
| B/L print | — | ⏳ Phase 7 |
| B/L release manager | `release-orders` page + eligibility endpoint | ✅ Actually works now |
| Shipper / Consignee / Agent masters | `shippers`, `consignees`, `agents` pages | ✅ |
| Invoice list / create / print | `invoices` page | ✅ Better arithmetic |
| Invoice print | — | ⏳ Phase 7 |
| Ledger list / statement | `ledger` page | ✅ Derived, correct order |
| Voucher print | — | ⏳ Phase 7 |
| Payment / receipt forms | `vouchers` page | ✅ |
| Proforma | `proformas` page | ✅ + conversion |
| Quotation | `quotations` page | ✅ Much better |
| Offer | *(merged)* | ✅ Deliberate |
| Manifest P&L report | — | ⏳ Phase 8 |
| Users / roles / permissions | `users`, `roles`, `permissions` pages | ✅ Much better |
| Settings | Company settings | ✅ |
| Customer portal | `portal` | ✅ Scoped |
| SMS | — | ❌ Not carried (scope unknown) |
| Wallet | — | ❌ Dead code, not carried |

---

## 7. Summary judgement

| | Legacy | Current |
|---|---|---|
| Business coverage | Broader in **documents you can print**, narrower in everything else | Broader in **domain depth and correctness**, narrower in output |
| Correctness | 14 catalogued defects, several of them money-affecting | 403 tests green; no known money-affecting defect |
| Structural fit to the employer's description | Poor — inverted the core B/L/manifest relationship | Good — matches it |
| Auditability | None | `AuditLog`, revisions, frozen documents |
| Extensibility | Hard-coded formats and templates | Configurable numbering + templates |

**The correct posture for a future agent:**

1. Use the legacy system to answer *"what did the company used to do?"* — especially where the
   employer is silent.
2. Use the employer's statements to answer *"what should it do?"*
3. Use the current system's ADRs to answer *"how has it been decided to build it?"*
4. Never use the legacy system to answer (2) or (3).

---

## duna-analysis/05-current-project/system-overview.md

# Current System — Overview

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> Phase 8, part 1. The **current** Duna Shipping dashboard: what it is, how it is built, and the
> conventions a future agent must follow.
>
> ⚠️ **Read-only reference.** Nothing here is a proposal. To change the system, work in the repo and
> follow `docs/plan.md`.

---

## 1. Stack

| Layer | Choice | ADR |
|---|---|---|
| Repo | **pnpm workspaces monorepo** | ADR-001 |
| API | **NestJS**, mounted at `/api/v1` | ADR-002 |
| Web | **Next.js App Router** + React + TypeScript + Tailwind | ADR-003 |
| ORM / DB | **Prisma + PostgreSQL** | ADR-004 |
| IDs | **cuid() strings**, not UUID v4 | ADR-005 |
| Config | Centralised validated config in `@shipping/config` | ADR-006 |
| API responses | Consistent envelope + versioning | ADR-007 |
| Auth | **JWT access token** + opaque DB-backed rotating refresh token | ADR-014 |
| Money | `Decimal`, serialised as **string** over the API | ADR-023 |
| Packages | `@shipping/config`, `@shipping/shared` built to **CommonJS** | ADR-011 |
| Dev DB | PostgreSQL in Docker (with local fallback) | ADR-013 |

---

## 2. Shape of the repository

```
apps/api/          NestJS — 33 modules, 38 controllers, 38 services
apps/web/          Next.js — 35 pages under src/app/[locale]/(dashboard)
packages/config/   shared, validated configuration
packages/shared/   shared TypeScript types & enums (CommonJS build)
prisma/
  schema.prisma    93.8 KB — 62 models, 25+ enums
  seed.ts
  migrations/      38 migrations (through phase13, plus phase 4/5 additive ones)
docker/            dev PostgreSQL
scripts/
docs/              the project's own documentation (13 top-level files + 4 directories)
```

### 2.1 API modules (`apps/api/src/modules/`)

```
actual-loading   agents        auth           bill           cargo
consignees       currencies    customers     delivery-release  discharge
health           inspections   invoice       jobs           ledger
letters          load-planning manifest      permissions    portal
ports            proforma      quotation     roles          salary
shippers         users         vessels       voucher        voyages
yard-inventory   yards
```

### 2.2 Web pages (`apps/web/src/app/[locale]/(dashboard)/`)

```
dashboard      cargo          yard-inventory  inspections   load-lists
actual-loading discharges     bookings        manifest      bills
invoices       proformas      quotations      vouchers      ledger
jobs           salary-records employees       letters       delivery-orders
release-orders customers      shippers        consignees    agents
ports          yards          vessels         voyages       users
roles          permissions    portal
```

---

## 3. Cross-cutting architecture decisions

These are the ones that most affect how a new feature must be written.

### 3.1 Configurable numbering (ADR-008)
`NumberingSequence` replaces hard-coded generators. Numbers are allocated through a
`NumberingService` with `SELECT … FOR UPDATE` locking, scoped by `scopeType` / `scopeValue`.

| Document | Format | Scope |
|---|---|---|
| B/L | `BOL-{DEST}-YYMM-#####` | destination port, per month |
| Manifest | `MAN-{DEST}-YYMM-#####` | destination port, per month |
| Voyage | per-destination leg numbers | `DESTINATION` / `destinationPortId` |
| Invoice | `INV-YYMM-#####` | — |
| Proforma | `PRF-YYMM-#####` | — |
| Quotation | `QT-YYMM-#####` | — |
| Receipt voucher | `RCP-YYMM-#####` | — |
| Payment voucher | `PMT-YYMM-#####` | — |
| Delivery order | `DO-YYMM-#####` | — |
| Release order | `RO-YYMM-#####` | — |
| Job | `JOB-YYMM-#####` | — |

> ⚠️ **These are not the employer's real formats.** The real documents use `KHS/26-110`,
> `DSMAN/KHO-26-006`, `DSINV/26-172`, `DSQUO/25-017`, `DSPRO/26-001`, and receipt voucher **No. `477`**
> (plain numeric). The current formats are a configurable placeholder pending employer confirmation — see
> [`../04-business-analysis/contradictions-register.md`](../04-business-analysis/contradictions-register.md)
> C-01…C-07. This is exactly why ADR-008 exists: the format is data, not code.
>
> **Corrected 2026-10-11.** A `DSR/26-190` receipt-voucher number was listed here. That string is
> **fabricated** — it appears in no extracted document, transcript or legacy source (error **E1**). The
> verified receipt voucher is **No. `477`** (dated `6-Aug-26`, `AED 1,600.00`, allocation references
> `1517`, `1526`, `Advance 477`). Contradiction **C-07**, which was built on the fabricated number, has
> been withdrawn in the register.

### 3.2 Configurable document templates (ADR-009)
A `DocumentTemplate` registry keyed by document type, with `DocumentTemplateVersion`. Domain
services produce **structured data**; the template layer owns presentation. Business logic must never
depend on a fixed PDF layout.

### 3.3 Audit (ADR-010)
Append-only `AuditLog` (`user`, `action`, `entity`, `entityId`, `timestamp`, `previousState`,
`newState`) written **in the same transaction** as the mutation. Sensitive fields redacted; states
stored as JSON.

### 3.4 Money (ADR-023)
`Decimal` in the DB, **string** over the wire. Never a JS float.

### 3.5 Permissions (ADR-016)
Permissions are a **read-only seeded registry** — 105 permissions across 12 resources:
`users`, `roles`, `permissions`, `bl`, `manifest`, `invoice`, `vesselVoyage`, `cargo`, `job`,
`loadingList`, `ledger`, `settings`. Enforced **server-side** (contrast the legacy system, where
`@can` only hid buttons). A `roleGranularPermissions` feature flag controls granularity.

### 3.6 Master-data lifecycle (ADR-018)
Activate/deactivate via `PATCH /:id/active` mapped to the `:update` permission — not a separate
endpoint or a delete.

### 3.7 Boolean query filters (ADR-017)
Typed as `string`, not `boolean`, and parsed by the DTO.

### 3.8 Soft delete for roles (ADR-015)
Role active/inactive is a soft delete, **not** an `isActive` column.

---

## 4. Testing & quality gates

| Gate | Current state |
|---|---|
| API e2e suites | **22** files, **403 tests, 0 failing** (as of 2026-10-06, Phase 5 unit 4) |
| Web unit tests | **None** — `apps/web` has `"test": "echo 'No web unit tests yet'"` |
| Contract guard | `apps/web/scripts/check-contract.mjs` — proves route parity between web and API |
| TypeScript | `tsc` API 0 errors; web has **3 pre-existing** errors in `[locale]/page.tsx` |
| Migrations | `prisma migrate status` — 37–38 up to date, shadow DB clean |

> ⚠️ **The web layer has no test harness.** This has already caused a shipped defect: the
> Inspections page called dead `/approve` and `/reject` endpoints and crashed on the `DONE` status,
> because no API test can see the web layer. See
> [`../04-business-analysis/prior-analysis-review.md`](../04-business-analysis/prior-analysis-review.md)
> and the defect record in `docs/plan.md`.

---

## 5. Documentation generations

The repo contains **three generations** of planning, explicitly ranked by
`docs/plan.md`:

| Gen | Location | Status |
|---|---|---|
| **1** | `docs/`, `docs-gap/`, older ADRs, `docs/progress.md` | Historical. Some ideas still valid; some phase numbers obsolete. **Not the current spec** |
| **2** | `docs/ai-audit/` (14 files, 4,586 lines) + `docs-legacy/` | Previous expert analysis. Valuable but re-audited |
| **3** | `docs/current-plan/` (17 files, 3,073 lines) | **Current plan** |

**Conflict rule (from `00-project-authority.md`):**
1. Raw employer evidence beats derived analysis.
2. `docs/current-plan/` beats older planning directories.
3. Current implementation reality beats stale progress documents.
4. Where employer evidence is ambiguous, record an **open business decision** — do not invent.

---

## 6. ⚠️ A coverage gap that affects everything

`00-project-authority.md` names **`/home/duna/dunaData/`** (especially `transcripts/`) as the
**highest authority** for employer evidence.

**That path does not exist in this workspace** (source gap **SRC-01**).

The transcripts available here are the 20 files under
`docs/duna-analysis/requirements/` (18 timestamped + 2 undated). They are substantial — 113 KB of
consolidated English statements — but they may not be the **complete** transcript set that
`docs/current-plan/` was written against.

> **Consequence:** every conclusion in this knowledge base is **provisional with respect to the
> missing transcript set.** If a statement here conflicts with `docs/current-plan/`, do not assume
> this knowledge base is wrong — but do not assume it is right either. Verify.

---

## 7. Conventions a future agent must follow

From `CLAUDE.md`, `README.md` and `docs/plan.md`:

1. **Do not invent business rules.** Where the employer is ambiguous, raise an open business decision.
2. **Preserve historical document numbers** — never renumber existing rows.
3. **Enforce sensitive scope server-side** — never rely on UI gating.
4. **Separate document data readiness from rendering polish.**
5. **Redesign UI late.**
6. Migrations must be **additive** unless a decision record explicitly authorises a drop.
7. Every business decision that affects schema, API or UI is recorded **before** the work is marked
   complete.
8. Design-first units: record the ADR before writing code.

---

## duna-analysis/06-ai-reference/README.md

# 06 — AI Reference

> How to use, maintain and audit this knowledge base.

| File | Purpose |
|---|---|
| [`how-to-use-this-knowledge-base.md`](how-to-use-this-knowledge-base.md) | **Read this first.** Orientation, the seven rules, the three mistakes to avoid, the quick-reference card |
| [`documentation-maintenance-plan.md`](documentation-maintenance-plan.md) | The four-place update rule, triggers, stability guarantees, review cadence |
| [`source-retention-plan.md`](source-retention-plan.md) | Classification of every source for future cleanup — **nothing has been deleted** |
| [`completeness-audit.md`](completeness-audit.md) | Honest coverage assessment: what is covered, partially covered, and not covered |

**Top-level entry point:** [`../README.md`](../README.md)
**Final report:** [`../FINAL-REPORT.md`](../FINAL-REPORT.md)

---

## duna-analysis/06-ai-reference/completeness-audit.md

# Completeness Audit

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> Phase 13. An honest assessment of **what this knowledge base covers, what it covers partially, and
> what it does not cover at all.**
>
> Do not claim complete coverage of unanalysed material. Where coverage is partial, this file says so.

---

## 1. Source coverage

| Source | Units | Analysed | Coverage | Notes |
|---|---|---|---|---|
| Employer transcripts | 20 files | **20** | **100%** | Every file read; every statement given an `EMP-*` ID |
| Real company documents | 7 PDFs | **7** | **100%** | All text-extracted; 2 required OCR |
| Legacy Laravel archive | 199 non-asset files | **199** | **High** | All PHP and Blade read. **Static only** — never executed |
| Prior analyses (existing-analysis) | 3 files | **3** | **100%** | Reviewed, verdict per claim |
| Prior analyses (docs-legacy) | 5 files | **5** | **100%** | Reviewed, presence claims verified against code |
| Current project: `docs/decisions.md` | 47 ADRs | **All indexed**; ~12 read in full | **Medium-high** | Every ADR title and decision summary captured; not every line read |
| Current project: `prisma/schema.prisma` | 62 models | **All models + enums enumerated** | **Medium** | Structure read; not every field and relation traced |
| Current project: `docs/current-plan/` | 17 files | **5 in depth, all surveyed** | **Medium-high** | `11-implementation-state.md`, `12-open-business-decisions.md`, `09-roadmap`, `08-traceability` (surveyed), `00-authority` read closely |
| Current project: `docs/ai-audit/` | 14 files | **Surveyed** | **Low-medium** | Titles and structure; not line-by-line |
| Current project: application code | 33 modules / 38 controllers / 35 pages | **Surveyed** | **Low-medium** | Directory and module inventory; not a line-by-line read |
| **Missing: `/home/duna/dunaData/`** | Unknown | **0** | **0%** | **SRC-01** — named as the highest authority, absent from this workspace |

---

## 2. Requirement coverage

| Metric | Value |
|---|---|
| Requirements catalogued | **127** |
| EXPLICIT | 120 |
| INFERRED | 2 |
| UNRESOLVED | 3 |
| CONTRADICTED | 2 |
| Traced across all four evidence layers | **127 / 127 (100%)** |
| Met by the current system | 68 |
| Partial / transitional | 23 |
| Not met | 19 |
| Scheduled | 15 |
| n/a | 2 |

---

## 3. Topic coverage

| Topic | Coverage | Gaps |
|---|---|---|
| Company facts | 🟢 Complete | — |
| Two business lines | 🟡 Inferred from documents, never stated by the employer | Confirm |
| Master data (all 7 registers) | 🟢 Complete | Customer code format unresolved |
| Cargo intake | 🟢 Complete | "Nagle", EXID/BCC/R.D.A. undefined |
| Inspection | 🟢 Complete | — |
| Load list | 🟢 Complete | — |
| B/L | 🟢 Complete | Number format unresolved |
| Manifest | 🟢 Complete | Number format unresolved; `DSKHS-26-005` vs `DSMAN/KHO-26-006` unexplained |
| Invoice | 🟢 Complete | Default VAT rate unknown; header-vs-line VAT conflict |
| Proforma / Quotation | 🟢 Complete | — |
| Ledger / vouchers | 🟢 Complete | — |
| General journal | 🟡 Requirement clear, process thin | — |
| Release order | 🟡 Requirement clear, policy thin | Partial / credit / approver |
| Delivery order | 🟡 Requirement clear, process thin | Eligibility rule |
| Agent portal | 🟡 Requirement clear, scope thin | Extra capabilities |
| Job costing | 🟢 Complete | ETOZ/ETDZ undefined |
| Salary | 🔴 **Thin** | Mentioned only. Q148–Q152 unanswered |
| Letters | 🔴 **Thin** | No employer input found |
| Company Archive | 🔴 **Thin** | One mention (`EMP-713`) |
| Reporting | 🟢 Complete | Cost allocation unexplained |
| Alerts | 🟡 Two alerts named | Full trigger list unknown |
| Document outputs / templates | 🟡 Requirements clear; templates absent | **SRC-07** |
| Access control | 🔴 **Thin** | Only "Access Control" as a sidebar section |

Legend: 🟢 well covered · 🟡 partial · 🔴 barely covered

---

## 4. Phase coverage

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Source inventory | ✅ `07-traceability/source-inventory.md` |
| 2 | Consolidated English employer statements | ✅ `01-employer-statements/employer-original-statements.en.md` (113 KB, sequence preserved) |
| 3 | Requirements analysis | ✅ `requirements-catalog.md`, `business-rules.md`, `business-processes.md`, `open-questions.md`, `terminology-glossary.md`, `employer-requirements-analysis.md` |
| 4 | PDF document analysis | ✅ `document-catalog.md`, `document-analysis.md`, `invoices.md`, `quotations.md`, `receipt-vouchers.md`, `statements-of-account.md` |
| 5 | Legacy Laravel analysis | ✅ 11 files, 2,161 lines, D1–D14 |
| 6 | Evaluate prior AI analyses | ✅ `04-business-analysis/prior-analysis-review.md` |
| 7 | Resolve discovery questions | ✅ Catalogued. **~65 of 160 remain unanswered** — genuinely unanswerable from the repository |
| 8 | Current Next.js analysis + legacy-vs-current | ✅ 5 files, 958 lines |
| 9 | Customer-relationship hypotheses | ✅ `04-business-analysis/customer-relationship-hypotheses.md` (H1–H18) |
| 10 | Structure, README, future-model instructions | ✅ `README.md`, `06-ai-reference/how-to-use-this-knowledge-base.md` |
| 11 | Maintenance plan | ✅ `documentation-maintenance-plan.md` |
| 12 | Source retention plan | ✅ `source-retention-plan.md` — **classification only, nothing deleted** |
| 13 | Completeness audit | ✅ This file |
| 14 | Final report | ✅ `../FINAL-REPORT.md` |

---

## 5. Known gaps — stated plainly

### 5.1 Structural gaps

| # | Gap | Severity | Mitigation |
|---|---|---|---|
| **SRC-01** | `/home/duna/dunaData/transcripts/` — the highest-authority source — is absent | **Critical** | Flagged everywhere. **If it becomes available, re-audit every `EMP-*` claim** |
| **SRC-03** | No legacy database dump; the schema is a reconstruction | Medium | Confidence levels recorded in `03-legacy-laravel-system/database-schema.md` |
| **SRC-04** | No `/vendor` in the legacy archive; it was never executed | Medium | Runtime-only behaviour (queues, events, schedulers) unverified |
| **SRC-06** | The discovery questionnaire is unanswered | **High** | ~65 questions with no answer anywhere |
| **SRC-07** | The company's own document templates are absent; only 7 rendered PDFs exist | Medium | The 7 PDFs are the design basis for Phase 7 |

### 5.2 Analytical gaps

| # | Gap | Why |
|---|---|---|
| A1 | The current system's application code was **surveyed, not read line by line** | 62 models, 33 modules, 35 pages. The analysis rests on the schema, the ADRs and the project's own state docs |
| A2 | Only ~12 of 47 ADRs were read in full | The remainder were indexed by title and decision summary |
| A3 | `docs/ai-audit/` (14 files, 4,586 lines) was surveyed, not read in depth | It is Generation-2 documentation, superseded by `docs/current-plan/` |
| A4 | `docs/progress.md` (91 KB) was sampled, not read in full | Historical build log |
| A5 | The legacy archive's 199 files were read, but **no runtime verification** was possible | No `/vendor`, no DB |
| A6 | Two of the seven PDFs required OCR | Per-line confidence recorded for the receipt voucher; the SOA is clean but small |

### 5.3 Business gaps

| # | Gap | Why it persists |
|---|---|---|
| B1 | Number formats unresolved (7 of them) | Three competing candidate sources for each; only the employer can settle it |
| B2 | Salary process undescribed | The employer mentioned it and moved on |
| B3 | Letters process undescribed | No employer input found |
| B4 | Company Archive undescribed | One mention |
| B5 | "Nagle" / EXID / BCC / R.D.A. / ETOZ undefined | Persian terms with no expansion in the transcripts or documents |
| B6 | Default VAT rate and taxability unknown | The one real invoice has VAT 0.00 |
| B7 | Release policy for partial / credit | "No money, no cargo" confirmed; the exceptions are not |

---

## 6. What can be asserted with confidence

Despite the gaps, the following are supported by **two or more independent sources** and can be
treated as settled:

| Assertion | Sources |
|---|---|
| Balance = Debit − Credit | Real SOA + legacy `CalculateDebitCredit()` |
| Invoice → Debit; Receipt → Credit; Payment → Debit | Real SOA + legacy `Fin` types + `REQ-150/151` |
| Voyage P&L = Σ invoice revenue − Σ voyage costs | Employer (`REQ-192`) + legacy `manifest/report.blade.php` |
| Days in port = loading date − arrival date | Employer (`REQ-070`) + legacy view |
| Inspection statuses `PENDING / DONE / LOCAL / NONEED` | Employer + legacy column |
| Loading statuses `IN YARD / LOADED` | Employer + legacy column |
| The load list column set | Employer (`REQ-091`) + legacy preview + real print |
| B/L comes before Manifest | Employer (`EMP-024`–`EMP-027`) + current ADR-047 |
| A manifest can carry several customers / shippers / consignees | Employer (`REQ-115/116`) + the real 45-row manifest |
| Partner B/Ls with different formats can sit on one manifest | Employer (`REQ-107`) + the real manifest (`NES260900266/7`) |
| Customer is not Shipper/Consignee | Employer (`REQ-018`, `REQ-020`) + the real B/L |
| Per-line VAT with a percentage field | Employer (`REQ-144`) + legacy `invoiceitems.vat` + the real invoice's VAT columns |
| `Total = Sub Total` when VAT is zero | The real invoice `DSINV/26-172` |
| The legacy system has 14 catalogued defects | Direct code reading |

---

## 7. Confidence levels used throughout

| Level | Meaning |
|---|---|
| **EXPLICIT** | The employer stated it directly |
| **Verified** | Confirmed by reading the code or the document |
| **INFERRED** | Derived from what the employer said; reasonable, not stated |
| **Provisional** | A reading adopted so work can continue, clearly labelled |
| **UNRESOLVED** | Raised but not settled |
| **CONTRADICTED** | Sources disagree; not resolved |

---

## 8. Verdict

**This knowledge base is fit for its purpose** — to let a future agent improve the current dashboard
without re-deriving the business — **with three caveats that must be stated whenever it is used:**

1. **It is provisional with respect to the missing transcript set (SRC-01).** If those transcripts
   surface, re-audit.
2. **The current-system analysis is a survey, not an exhaustive code read.** For implementation
   detail, go to the code and the ADRs.
3. **~65 discovery questions remain genuinely unanswerable** from anything in this repository. They
   need the employer.

What is *not* provisional: the employer's statements, the seven real documents, and the legacy code
findings. Those are complete and directly evidenced.

---

## duna-analysis/06-ai-reference/documentation-maintenance-plan.md

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

---

## duna-analysis/06-ai-reference/how-to-use-this-knowledge-base.md

# How to Use This Knowledge Base

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> Phase 10. Instructions for a future AI model (or human) working on the Duna dashboard.
>
> **Read this before you write a line of code.** It will save you from re-deriving the business and
> from repeating the three mistakes that prior analyses made.

---

## 1. The 60-second orientation

**Duna Shipping LLC** moves heavy machinery by barge and tug from UAE ports (Hamriyah, Jebel Ali) to
Iranian and Gulf destinations (Khorramshahr, Bushehr, Bandar Abbas). It runs **two businesses**:
freight forwarding, and buying machinery and reselling it.

The operational spine:

```
Customer → Job → Cargo → Yard → Inspection → Load List → Vessel/Voyage
        → B/L → Manifest → Invoice → Ledger → Payment → Release (via Agent)
```

**B/L first, Manifest second.** The Manifest consolidates issued B/Ls.

The money rule:

```
Invoice → Debit ·  Receipt → Credit ·  Payment → Debit ·  Balance = Debit − Credit
```

---

## 2. Where to start, by task

| Task | Read first | Then |
|---|---|---|
| **Add a feature** | `01-employer-statements/requirements-catalog.md` (find the REQ) | `07-traceability/requirements-traceability.md` (is it met?) → `05-current-project/implemented-capabilities.md` |
| **Fix a money bug** | `02-business-documents/invoices.md` (correct arithmetic) | `03-legacy-laravel-system/calculations.md` (what the old system got wrong) |
| **Build a document output** | `02-business-documents/document-catalog.md` (the 7 real specimens) | `07-traceability/requirements-traceability.md` REQ-120–REQ-125 |
| **Work on B/L or Manifest** | `05-current-project/legacy-vs-current-comparison.md` §3.1 | ADR-045, ADR-046, ADR-047 in `docs/decisions.md` |
| **Work on the agent portal** | `04-business-analysis/customer-relationship-hypotheses.md` | `REQ-187`, `REQ-188`; ADR-040 |
| **Answer "why is it like this?"** | `04-business-analysis/consolidated-business-model.md` | `03-legacy-laravel-system/` for the history |
| **Resolve a conflict** | `04-business-analysis/contradictions-register.md` | Escalate to the employer — do not pick a side |
| **Understand a Persian term** | `01-employer-statements/terminology-glossary.md` | — |

---

## 3. The seven rules

### Rule 1 — Legacy is evidence, not specification
The old Laravel system tells you **what the company used to do**. It does **not** tell you what it
should do now.

- ❌ Do not plan to replace the current dashboard with the legacy one.
- ❌ Do not delete a current feature merely because the old system lacked it.
- ✅ Do use it when the employer is silent and you need to know what was normal.

### Rule 2 — Never invent a business rule
If the employer did not say it, it is not a rule. Record it as a question.

Check `01-employer-statements/open-questions.md` first — if the question is already there, do not
answer it yourself.

### Rule 3 — Never silently resolve a contradiction
22 are catalogued in `04-business-analysis/contradictions-register.md`. Each has a *provisional*
reading, clearly labelled. Use the provisional reading if you must ship something, and mark it
provisional in code and in the UI.

### Rule 4 — Respect the classification of every requirement
Every `REQ-*` row carries one of: **EXPLICIT** · **INFERRED** · **UNRESOLVED** · **CONTRADICTED**.

- Only **EXPLICIT** may become a hard business rule.
- **INFERRED** may become a default, documented as such.
- **UNRESOLVED** must stay open.
- **CONTRADICTED** must be escalated.

### Rule 5 — Verify prior analyses
`existing-analysis/` and `docs-legacy/` are prior AI output. Three recurring error patterns were
found in them:

1. Assuming the legacy system implements what it merely **declares**. (`RELEASED` is a constant that
   is never written. "PDF-ready" means browser print. "Sequential" invoice codes are random.)
2. Reporting "missing" for "not modelled the way I would model it." (The ledger **exists**.)
3. Stating the employer's desired flow as if it were the legacy flow. (B/L-before-Manifest.)

### Rule 6 — Preserve the employer's original sequence
`01-employer-statements/employer-original-statements.en.md` keeps his statements **in the order he
said them**, including repetitions, self-corrections and contradictions. Do not regroup it by topic —
the sequence is evidence.

### Rule 7 — Documentation only, unless told otherwise
This knowledge base was built under an explicit instruction: **do not modify application source
code, UI, routing, API, DB, config/env files, or add dependencies.** That instruction governed its
construction. If you are asked to change the system, work in the application repo and follow
`docs/plan.md`.

---

## 4. The three mistakes to avoid

| Mistake | Why it happens | How to avoid it |
|---|---|---|
| **Porting a legacy defect** | The legacy code looks authoritative — it is real, running code | Check `03-legacy-laravel-system/system-overview.md` §7 (D1–D14) before reusing any legacy logic |
| **Trusting a prior analysis** | It is fluent and well-formatted | Check `04-business-analysis/prior-analysis-review.md` for its verified verdict |
| **Normalising the source documents** | Typos look like extraction errors | `LAODING`, `SHIFITNG`, `KHORAMSHHAHR`, `700,00.00`, and the manifest footer `VESSEL = DUNA SHIPPING LLC` are **real artefacts**. Record them; do not silently fix them |

---

## 5. Two requirements that feel like bugs

| Requirement | What it says | Why your intuition is wrong |
|---|---|---|
| `REQ-122` | **Print must strip** stamps, marks and signature | You will want to "fix" the missing stamp on print. Don't. The PDF carries the stamp; the printed page is stamped by hand afterwards |
| `REQ-165` | **An unallocated payment must NOT raise an error** | You will want to add validation requiring an invoice. Don't. Advances and deposits post to the ledger with no invoice |

---

## 6. Searching this knowledge base

| Looking for | Grep for |
|---|---|
| A requirement | `REQ-142` |
| What the employer said | `EMP-` |
| A legacy defect | `D4`, or "defect" |
| A contradiction | `C-08`, or "CONTRADICTED" |
| A contradicted requirement | `| CONTRADICTED |` |
| A Persian term | the Persian word, or `terminology-glossary.md` |
| Everything about invoices | `invoice` (case-insensitive) across `02-business-documents/` |
| What is unknown | `open-questions.md` |

**Every requirement ID is stable and citable.** If you refer to a requirement, use its ID.

---

## 7. What is NOT in here

Be honest about the limits when you report:

| Not covered | Why |
|---|---|
| The complete transcript set | `/home/duna/dunaData/transcripts/` is absent (**SRC-01**) |
| Legacy runtime behaviour | The archive has no `/vendor` and no DB dump; analysis was static |
| A line-by-line read of all current application code | 62 models, 33 modules, 35 pages — surveyed via schema, ADRs and state docs |
| Salary process detail | The employer mentioned it and moved on |
| Letters process detail | Almost no employer input |
| Company Archive | One passing mention |
| The employer's own document templates | Only 7 rendered PDFs exist (**SRC-07**) |
| Answers to Q01–Q160 | Unanswered; ~65 of 160 have no answer anywhere |

---

## 8. If you learn something new

Update in this order — **all four, not one**:

1. `01-employer-statements/requirements-catalog.md` — the authoritative `REQ` row and its
   classification.
2. `01-employer-statements/open-questions.md` — close the question, or add a new one.
3. `07-traceability/requirements-traceability.md` — the Documents / Legacy / Current columns.
4. `04-business-analysis/contradictions-register.md` — resolve or create the contradiction.

Then, if the change affects the business model, also update
`04-business-analysis/consolidated-business-model.md`.

See [`documentation-maintenance-plan.md`](documentation-maintenance-plan.md).

---

## 9. Quick reference card

```
Company        Duna Shipping LLC · Al Nokhitha Bldg, Hamriya Port, Dubai, UAE
TRN            100353243700003
Currency       AED
Base ports     Hamriyah, Jebel Ali (load) → Khorramshahr, Bushehr, Bandar Abbas (discharge)
Vessels        Barge + Tug (e.g. "BARGE MEHDI 11 / TUG LAYAN GULF") or Landing Craft
Voyage         nn/yy, per vessel + destination + year
B/L            <DEST>/<yy>-<seq3>   e.g. KHS/26-110
Manifest       DSMAN/<DEST>-<yy>-<seq3>   e.g. DSMAN/KHO-26-006
Invoice        DSINV/<yy>-<seq3>    e.g. DSINV/26-172
Proforma       DSPRO/<yy>-<seq3>    e.g. DSPRO/26-001
Quotation      DSQUO/<yy>-<seq3>    e.g. DSQUO/25-017
Receipt        plain sequential number        e.g. 477      (CORRECTED 2026-10-11 — was DSR/<yy>-<seq3>, fabricated)
Balance        Debit − Credit
Invoice maths  lineAmount = unit×qty × (1 + vat%) · Sub Total = Σ lineAmount · Total = Sub Total
Release        "no money, no cargo" — B/L releases only when its invoices are fully paid
Parties        Customer ≠ Shipper ≠ Consignee ≠ Agent ≠ User
Order          B/L first, Manifest consolidates issued B/Ls
```

---

## duna-analysis/06-ai-reference/source-retention-plan.md

# Source Retention & Cleanup Plan

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> Phase 12. **Classification only — nothing has been deleted, moved or rewritten.**
>
> Per the standing instruction: *do not delete/move/rewrite existing project docs; preserve originals;
> only classify for future cleanup, never delete without approval.*

---

## 1. What exists today

| Path | Files | Size | Nature |
|---|---|---|---|
| `requirements/` | 20 `.txt` | 94 KB | Persian transcripts — **primary source** |
| `documents/` | 7 `.pdf` | 1.9 MB | Real company documents — **primary source** |
| `legacy-source/duna-clean.zip` | 1 | 16.9 MB | Legacy Laravel application — **primary source** |
| `legacy-source/docs-legacy/` | 5 `.md` | — | Prior analysis of the legacy system |
| `existing-analysis/` | 3 `.md` | 78 KB | Prior AI analyses |
| `docs-summary.md` | 1 | 55.8 KB | Summary shipped with the source pack |
| **Analysis written for this knowledge base** | 46 `.md` | ~16,000 lines | Derived |
| **Total** | **83 files** | **19 MB** | |

---

## 2. Classification

| Class | Meaning | Disposition |
|---|---|---|
| **KEEP** | Primary evidence. Irreplaceable. | Keep in the repo permanently |
| **KEEP-DERIVED** | Our own analysis. Regenerable from KEEP, but expensive to regenerate. | Keep |
| **REVIEW** | Prior analysis of unknown reliability. | Keep, but mark as unverified |
| **ARCHIVE-CANDIDATE** | Superseded and no longer load-bearing. | **Proposal only** — needs approval |
| **EXCLUDE** | Must never be committed | N/A — nothing here |

### 2.1 Detailed classification

| Path | Class | Rationale |
|---|---|---|
| `requirements/*.txt` (20) | **KEEP** | The employer's own words. Irreplaceable. Everything in `01-employer-statements/` cites `EMP-*` IDs that only make sense against these files |
| `documents/*.pdf` (7) | **KEEP** | The only real company documents available (**SRC-07** means the original templates are missing). Every format claim traces to these |
| `legacy-source/duna-clean.zip` | **KEEP** | 16.9 MB. The only record of what the company actually used. **Never executed** — a future agent with `/vendor` could run it |
| `legacy-source/docs-legacy/*.md` (5) | **REVIEW** | Prior analysis, demonstrably wrong in places (see `04-business-analysis/prior-analysis-review.md` §4.1). Keep as a cross-check, mark unverified |
| `existing-analysis/*.md` (3) | **REVIEW** | Prior analyses. `duna_client_discovery_questions_v2.md` is the **only** copy of the Q01–Q160 ID space — irreplaceable for that reason alone |
| `docs-summary.md` | **KEEP-DERIVED** | 55.8 KB summary; superseded in depth by this knowledge base but cheap to keep |
| `01-employer-statements/*.md` (7) | **KEEP-DERIVED** | Includes the 113 KB verbatim statement file — the English record of the transcripts. Regenerable only by re-translating 20 Persian files |
| `02-business-documents/*.md` (6) | **KEEP-DERIVED** | Regenerable only by re-extracting the PDFs (which needed PyMuPDF + OCR) |
| `03-legacy-laravel-system/*.md` (11) | **KEEP-DERIVED** | 2,161 lines. Regenerable only by re-reading 199 PHP/Blade files |
| `04-business-analysis/*.md` (6) | **KEEP-DERIVED** | The synthesis. The contradictions register is the hardest part to recreate |
| `05-current-project/*.md` (5) | **KEEP-DERIVED** | Will go stale; see §4 |
| `06-ai-reference/*.md` | **KEEP-DERIVED** | Small |
| `07-traceability/*.md` (2) | **KEEP-DERIVED** | The traceability matrix is the index to everything |

### 2.2 Nothing is classified EXCLUDE

No file in `docs/duna-analysis/` contains secrets. Credentials found in the legacy archive
(`.env` references, SMS gateway settings) were **deliberately not recorded** anywhere in this
knowledge base.

---

## 3. Size considerations

| Concern | Assessment |
|---|---|
| **19 MB total** | Acceptable for a documentation directory |
| **`duna-clean.zip` at 16.9 MB is 89% of it** | The single meaningful size decision |
| Git history | Binary ZIPs do not delta-compress. If this repo is cloned frequently, consider Git LFS |

### 3.1 Options for the ZIP (all require approval)

| Option | Pros | Cons |
|---|---|---|
| **A. Keep as-is** (recommended) | Simple, self-contained, reproducible | 16.9 MB in every clone |
| **B. Git LFS** | Keeps the working tree light | Requires LFS on every machine; changes the clone workflow |
| **C. Move to external storage, keep a pointer + checksum** | Lightest | Breaks self-containment; the analysis could not be re-verified without fetching |
| **D. Delete** | Lightest | ❌ **Not recommended and not approved.** The archive is the only record of what the company actually used, and it has never been executed — a future agent may need to run it |

**Recommendation: Option A.** 16.9 MB is a small price for keeping the evidence verifiable.

---

## 4. What will go stale, and how to handle it

| File | Staleness risk | Mitigation |
|---|---|---|
| `05-current-project/*` | **High** — the project ships a phase every few days | Date-stamped; tied to ADR numbers, not line numbers. Re-verify at each phase close |
| `07-traceability/requirements-traceability.md` (Current column) | **High** | Update at each phase close (maintenance plan §3) |
| `03-legacy-laravel-system/*` | **None** — the legacy system is frozen | — |
| `01-employer-statements/*`, `02-business-documents/*` | **Low** — only change if new evidence arrives | — |
| `04-business-analysis/consolidated-business-model.md` | **Medium** — changes if the employer clarifies | Update per maintenance plan §2 |

---

## 5. Rules for any future cleanup

1. **Never delete a primary source** (`requirements/`, `documents/`, `duna-clean.zip`).
2. **Never delete `existing-analysis/duna_client_discovery_questions_v2.md`** — it holds the only
   copy of the Q01–Q160 ID space.
3. **Never rewrite a prior analysis** to make it correct. Mark it superseded and point to the
   correction.
4. **Never delete a superseded analysis** — append a "superseded by" note.
5. **Before deleting anything**, check `07-traceability/source-inventory.md`: if a file is cited
   there, it is load-bearing.
6. **Ask first.** No deletion without explicit approval.

---

## 6. If the sources must move

If a future cleanup relocates `docs/duna-analysis/`, update:

- Every relative link in the 46 analysis files (they use `../0N-*` relative paths).
- `README.md` §2 (directory map).
- `07-traceability/source-inventory.md` (source locations).
- The greppable ID spaces are path-independent and will survive.

**Keeping the directory where it is is strongly preferred.**

---

## duna-analysis/07-traceability/requirements-traceability.md

# Requirements Traceability Matrix

> **Correction (2026-10-12, Phase 1 review — additive; the original row is retained as recorded).**
> The REQ-001 row's *Current* value "❌ flat menu" is **contradicted by the source**. The dashboard
> sidebar renders each navigation section as a collapsible accordion
> (`apps/web/src/components/layout/sidebar.tsx`, `NavGroup`, with `aria-expanded` and a `titleKey`).
> The true gap is different: the sidebar has **10** top-level sections where REQ-001 requires **6**
> (39 items in total). The status 🟡 Phase 9 is unchanged. The discrepancy is recorded in
> [`documented-deviations.md`](../09-audit/documented-deviations.md) as D-NAV-01.

> Every `REQ-*` requirement traced across all four evidence layers:
> **employer statement → real documents → legacy system → current system**.
>
> Generated from [`../01-employer-statements/requirements-catalog.md`](../01-employer-statements/requirements-catalog.md) (the authoritative `REQ` list).
>
> **Legend — Documents:** the real PDF that proves or informs it.
> **Legend — Legacy:** ✅ supported · ⚠️ partial/defective · ❌ absent · n/a not applicable.
> **Legend — Current:** ✅ met · 🟡 partial/transitional · ❌ not met · ⏳ scheduled · n/a not applicable.
>
> ⚠️ **Legacy status is evidence, not a target.** See
> [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).

---

> ## ⚠️ Provenance legend — read before trusting a row (added 2026-10-11, action **D6**)
>
> **This matrix predates the 2026-10-11 audit.** It was generated from the requirements catalogue and has not
> been re-verified row by row against the running system. Treat it as the **requirements** view, not as the
> current-state view.
>
> | For… | Use instead |
> | --- | --- |
> | Verified current-state classification | [`../09-audit/implementation-gap-analysis.md`](../09-audit/implementation-gap-analysis.md) |
> | Target design for finance, documents, security, reporting | [`../09-audit/target-domain-and-finance.md`](../09-audit/target-domain-and-finance.md) · [`target-documents-and-configuration.md`](../09-audit/target-documents-and-configuration.md) · [`target-security-audit-reporting.md`](../09-audit/target-security-audit-reporting.md) |
> | Which phase a requirement lands in | [`../09-audit/initial-roadmap.md`](../09-audit/initial-roadmap.md) |
>
> **Specifically revised by the audit.** Rows whose disposition depends on the **financial spine** or on
> **reporting** were assessed before the confirmed decisions (`DEC-001`–`DEC-114`) existed, and a number of
> them are therefore optimistic. Affected areas include:
>
> - multi-currency and exchange-rate behaviour (no `CurrencyRate` model exists — roadmap **P6**);
> - general-ledger, allocation and advance handling (no posting model exists — **P6**);
> - reporting and P&L (no reports module exists — **P7**);
> - document output and templates (no rendering capability exists — **P8**);
> - per-line VAT (`InvoiceItem` has no per-line tax fields — **P3**).
>
> **A ✅ here means the requirement is addressed by *some* implemented capability.** It does **not** mean the
> capability is complete against the target design, and it does **not** mean it has been tested — the suite
> was never executed in the audit environment, so every claim in this document is **unverified** in the sense
> defined in [`../09-audit/README.md`](../09-audit/README.md) §4.
>
> **Coverage status.** Of the **57 rows that are not ✅**, the audit verified and routed **24** into roadmap
> phases; **33 remain unverified** and are enumerated with provisional phase routing in
> [`../09-audit/initial-roadmap.md`](../09-audit/initial-roadmap.md) §4.

---

## 0. Summary

| Current-system disposition | Count |
|---|---|
| ✅ Met | 68 |
| 🟡 Partial / transitional | 23 |
| ❌ Not met | 19 |
| ⏳ Scheduled | 15 |
| n/a | 2 |
| **Total** | **127** |

| Legacy disposition | Count |
|---|---|
| ✅ Supported | 32 |
| ⚠️ Partial / defective | 28 |
| ❌ Absent | 63 |
| n/a | 4 |
| **Total** | **127** |

**How to read the two dispositions together:**

- **Legacy ⚠️/❌ and Current ✅** — the current system fixed a real legacy defect.
- **Legacy ✅ and Current ❌** — a regression risk. Check it before shipping.
- **Both ❌** — genuinely new capability the employer asked for and nobody has built yet.

| Requirement class | Count |
|---|---|
| EXPLICIT | 120 |
| INFERRED | 2 |
| UNRESOLVED | 3 |
| CONTRADICTED | 2 |
| **Total** | **127** |

> **Maintaining this file.** If a requirement changes, update in this order:
>
> 1. `01-employer-statements/requirements-catalog.md` (the authoritative `REQ` row)
> 2. `01-employer-statements/open-questions.md` (if a question opens or closes)
> 3. this matrix (the Documents / Legacy / Current columns)
> 4. `04-business-analysis/contradictions-register.md` (if a contradiction is created or resolved)
>
> Do not edit only one of the four.


### 0.1 Regression watchlist — legacy had it, current does not fully

| REQ | Requirement | Legacy | Current |
|---|---|---|---|
| REQ-091 | Load List columns: loading port, destination port, Description, Chassis Number, Serial Number,… | ✅ | 🟡 confirm columns |
| REQ-111 | Manifest rows are numbered 1, 2, 3… and each row carries a B/L number, goods description, Ship… | ✅ | 🟡 |
| REQ-112 | The last manifest page prints **Total units, Total packages, Total weight**. | ✅ | 🟡 |
| REQ-144 | VAT is entered **per line** as a percentage. | ✅ per line | ❌ header VAT — contradicts |

### 0.2 Genuinely new capability — neither system has it

| Count | 16 requirements |
|---|---|

> These are the employer's requirements that **nothing in this repository implements**. They are the real work.

| REQ | Requirement |
|---|---|
| REQ-004 | A **Company Archive** area exists (title "Company Archive"). |
| REQ-038 | Vessel may carry an optional **IMO Number**; absence must not block saving. |
| REQ-039 | Vessels are either owned by Duna, chartered per trip (voyage charter), or time-chartered for a… |
| REQ-052 | National ID and TRN may be recorded in one field separated by a slash; whichever exists is ent… |
| REQ-063 | **Document Status** records the paperwork the cargo entered the port with. Named values: **EXI… |
| REQ-064 | Other document types referenced in the business narrative: Export Paper, Import Paper, Export… |
| REQ-131 | A Job is created for **ETOZ / ETDZ** work: end-to-end handling where Duna collects the goods a… |
| REQ-134 | The invoice is prepared by checking / matching the draft against the related Job Numbers. |
| REQ-145 | Some invoices carry VAT and some do not; the system must separate them so a **quarterly VAT re… |
| REQ-147 | The Invoice header carries **Invoice Number, Invoice Date, payment due date (maximum payment d… |
| REQ-154 | Overdue invoices should raise an **alarm or report** so the team can follow up on how long a c… |
| REQ-164 | A voucher first selects the **Customer**, then optionally allocates to a specific **Invoice**… |
| REQ-166 | A **General Journal** capability allows posting directly onto a customer ledger outside invoic… |
| REQ-167 | The Ledger is **not** only for customers: daily expenses, office expenses and company running… |
| REQ-170 | **Salary Slips also require ID-card capture** (front and back, upload or camera) printed with… |
| REQ-184 | An **alert / notice** is raised when a released document remains unpaid — the employer's examp… |

---

## 1. Navigation & information architecture

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-001 | The dashboard sidebar has exactly **six** top-level sections, in this order: Overview, Operations, B/L & Mani… | EXPLICIT | EMP-185, EMP-186 | — | ❌ flat menu | 🟡 Phase 9 |
| REQ-002 | Each sidebar section expands as an accordion / drop-down to reveal its sub-items. | EXPLICIT | EMP-187 | — | ⚠️ partial | 🟡 Phase 9 |
| REQ-003 | Master data is defined **before** operations in the employer's own walk-through order. | EXPLICIT | EMP-188 | — | ⚠️ | n/a (explanation order) |
| REQ-004 | A **Company Archive** area exists (title "Company Archive"). | UNRESOLVED | EMP-713 | — | ❌ | ❌ |

---

## 2. Master Data — Customer

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-010 | Master Data contains exactly these seven registers: **Customers, Ports, Yards, Vessels, Shippers, Consignees,… | EXPLICIT | EMP-194 | — | ⚠️ customers = users | ✅ |
| REQ-011 | Customer Name is the **only mandatory** field. | EXPLICIT | EMP-209, EMP-219, EMP-356 | — | ⚠️ accidental (no validation at all) | ✅ |
| REQ-012 | Customer has optional Contact Number, Email, Address. | EXPLICIT | EMP-204, EMP-221, EMP-229 | — | ✅ | ✅ |
| REQ-013 | The system generates the Customer **code** automatically; the user does not type it. | EXPLICIT | EMP-205, EMP-220, EMP-231 | — | ⚠️ `CUST00{id+1}` | ✅ |
| REQ-014 | The Customer code carries a `CUST` prefix and increments sequentially per new customer. | EXPLICIT | EMP-207, EMP-213, EMP-216, EMP-222, EMP-233 | — | ⚠️ | ✅ |
| REQ-015 | **Exact Customer code format is unresolved.** The employer gave three different examples in one clip. | CONTRADICTED | EMP-207 vs EMP-213/EMP-216 vs EMP-222 vs EMP-233 | — | n/a | 🟡 format unresolved C-06 |
| REQ-016 | Customer list rows support Edit, Delete and a Status indicator. | EXPLICIT | EMP-224, EMP-236 | — | ✅ | ✅ |
| REQ-017 | Customer record must **not** carry Type, Currency, TRN Number or Short Name fields. | EXPLICIT | EMP-225, EMP-237 | — | ❌ has extra fields | ✅ |
| REQ-018 | A Customer is an **internal commercial counterparty**: the party Duna invoices and whose ledger Duna maintain… | EXPLICIT | EMP-198, EMP-199, EMP-384 – EMP-393, EMP-430, EMP-431 | B/L, Manifest | ❌ | ✅ |
| REQ-019 | A Customer may be a natural person or a legal entity. | EXPLICIT | EMP-199, EMP-201, EMP-356 | Tax Invoice (person) | ⚠️ | ✅ |
| REQ-020 | The worked example: a customer in Australia buys a machine; Duna moves it Australia → Jebel Ali (clearance) →… | EXPLICIT | EMP-394 – EMP-408 | — | ❌ | ✅ |
| REQ-021 | Customers must be selectable by name or by code with a search. | EXPLICIT | EMP-449 | — | ✅ | ✅ |

---

## 3. Master Data — Port, Yard, Vessel

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-030 | Port is recorded as **Port name, City, Country** — three parts, comma-separated. | EXPLICIT | EMP-241 – EMP-255 | All (Port, City, Country) | ❌ one string | ✅ |
| REQ-031 | Port Name, City, Country and Abbreviation are all **mandatory**. | EXPLICIT | EMP-268 | — | ⚠️ | ✅ |
| REQ-032 | A Port has a mandatory short **abbreviation** (e.g. `HAM` for Hamriyah). | EXPLICIT | EMP-256, EMP-264 – EMP-266 | — | ✅ | ✅ |
| REQ-033 | The abbreviation is used instead of the full port name inside the Load List, to save horizontal space. | EXPLICIT | EMP-257 – EMP-259 | Load List | ❌ | ✅ |
| REQ-034 | Ports referenced in practice: Hamriyah, Jebel Ali, Port Rashid (UAE, loading side); Khorramshahr, Bushehr, Ba… | EXPLICIT | EMP-002, EMP-010, EMP-242 – EMP-255, EMP-501, EMP-502 | B/L, Manifest, Invoice, Proforma | ✅ | ✅ |
| REQ-035 | A Yard records only **which Port it belongs to** plus a **Yard name**. | EXPLICIT | EMP-276 – EMP-279 | — | ✅ | ✅ |
| REQ-036 | Selecting a Port of Loading filters the Yard picker to that port's yards only. | EXPLICIT | EMP-280 – EMP-289, EMP-466, EMP-467 | — | ✅ | ✅ |
| REQ-037 | Vessel falls into two shapes: **Tug & Barge** (two names) or **Vessel / Landing Craft** (one name). | EXPLICIT | EMP-293, EMP-297 – EMP-301, EMP-336 – EMP-341 | Manifest (barge + tug) | ❌ free text | ✅ (VesselType) |
| REQ-038 | Vessel may carry an optional **IMO Number**; absence must not block saving. | EXPLICIT | EMP-295, EMP-342 – EMP-344 | — | ❌ | ❌ |
| REQ-039 | Vessels are either owned by Duna, chartered per trip (voyage charter), or time-chartered for a period. | EXPLICIT | EMP-003 | — | ❌ | ❌ |
| REQ-040 | **Voyage number** is `n/yy` (e.g. `1/26`, `5/26`) and counts trips **per vessel + per destination + per year*… | EXPLICIT | EMP-315 – EMP-331 | Manifest, Invoice (`02/26`) | ❌ voyage = string | 🟡 per-destination leg |
| REQ-041 | The system derives the voyage number automatically when the vessel is selected for a given destination. | EXPLICIT | EMP-320, EMP-329, EMP-330, EMP-552 | Manifest, Invoice | ❌ keyed on port+shipper (D12) | ✅ |

---

## 4. Master Data — Shipper, Consignee, Agent

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-050 | Shipper fields: Name (mandatory), National ID / TRN Number, Address, Contact Number, Email (all optional). | EXPLICIT | EMP-347 – EMP-356 | B/L, Manifest | ✅ | ✅ |
| REQ-051 | Consignee fields are identical to Shipper fields. | EXPLICIT | EMP-362 – EMP-372 | B/L, Manifest | ✅ | ✅ |
| REQ-052 | National ID and TRN may be recorded in one field separated by a slash; whichever exists is entered. | EXPLICIT | EMP-365 – EMP-367 | — | ❌ | ❌ |
| REQ-053 | Shipper is the **first** party entered on a Bill of Lading and is also a Manifest column. | EXPLICIT | EMP-346, EMP-359 – EMP-361 | B/L, Manifest | ⚠️ at manifest level | ✅ per B/L (ADR-047) |
| REQ-054 | Consignee is chosen by the customer/destination party, not by Duna. | EXPLICIT | EMP-391, EMP-417 – EMP-420 | — | ❌ | n/a (business fact) |
| REQ-055 | Agent fields: Name, Address, Contact Number, Email. | EXPLICIT | EMP-374 – EMP-378 | B/L (destination agent) | ✅ | ✅ |
| REQ-056 | Agent details are printed on the Bill of Lading, and the Agent used depends on the **destination**. | EXPLICIT | EMP-379 – EMP-381 | B/L, Manifest | ❌ | 🟡 needs confirmation |

---

## 5. Operations — Cargo registration

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-060 | Cargo registration ("New Cargo") begins with **Customer** selection — it is the first field. | EXPLICIT | EMP-439 – EMP-449, EMP-005 | — | ✅ | ✅ |
| REQ-061 | Cargo fields, in the employer's stated order: Customer, Shipper Name, Port of Loading, Port of Destination, D… | EXPLICIT | EMP-450 – EMP-482 | Manifest rows | ✅ | ✅ |
| REQ-062 | Weight carries a **weight unit**, mainly Kilogram. | EXPLICIT | EMP-463 | Manifest (KGS) | ❌ | ✅ WeightUnit |
| REQ-063 | **Document Status** records the paperwork the cargo entered the port with. Named values: **EXID**, **BCC**, *… | EXPLICIT | EMP-468 – EMP-471 | — | ❌ | ❌ |
| REQ-064 | Other document types referenced in the business narrative: Export Paper, Import Paper, Export Certificate, R.… | UNRESOLVED | EMP-011 | — | ❌ | ❌ CRG-01 |
| REQ-065 | Cargo carries a **Comment** field. The employer repeated this requirement in both transcript groups and three… | EXPLICIT | EMP-079 – EMP-088, EMP-482 – EMP-493 | — | ❌ | ✅ ADR-044 |
| REQ-066 | The Comment records ad-hoc costs and handling facts (transport paid, customs paid, repairs done in port). | EXPLICIT | EMP-083 – EMP-085, EMP-488 – EMP-490 | SOA narrations | ❌ | ✅ |
| REQ-067 | Operations staff write the Comment; **accounting staff must be able to read it** when preparing the customer'… | EXPLICIT | EMP-081, EMP-082, EMP-086, EMP-486, EMP-487, EMP-491 | — | ❌ | 🟡 `cargo:read` only — confirm accounting |
| REQ-068 | Comment edits and deletions are permitted (implied by "writes it in that Comment" + "editable" phrasing acros… | INFERRED | EMP-085, EMP-490 | — | ❌ | ✅ ADR-044 |
| REQ-069 | Cargo registration captures arrival date, discharge yard and discharge date so that **days in port** can be c… | EXPLICIT | EMP-018 – EMP-021, EMP-464, EMP-480, EMP-481 | — | ✅ | ✅ |
| REQ-070 | **Days in port = loading date − arrival date**, used to compute storage/warehousing charges payable to the po… | EXPLICIT | EMP-019 – EMP-021, EMP-481 | — | ⚠️ with "today" fallback | ✅ |
| REQ-071 | "Nagle" (نقل) means accompanying loose pieces that are **not** complete machines. Units and Packages are coun… | EXPLICIT | EMP-030, EMP-031, EMP-459 – EMP-461, EMP-598, EMP-599 | Manifest ("32 UNITS AND 79 PKGS") | ❌ | 🟡 CRG-01 / "Nagle" undefined |

---

## 6. Operations — Inspection

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-080 | Inspection is **booked** (a slot and a fee) with Dubai customs, then performed. | EXPLICIT | EMP-473 – EMP-477 | — | ❌ status field only | ✅ ADR-024 |
| REQ-081 | Inspection has at least two states: **Pending** and **Done**. | EXPLICIT | EMP-077, EMP-478, EMP-506, EMP-516 | — | ✅ | ✅ 5 states |
| REQ-082 | **Inspection Done is a hard precondition** for a cargo to enter a Load List. Attempting to select an uninspec… | EXPLICIT | EMP-078, EMP-508, EMP-512 – EMP-516 | — | ❌ no check in code | ✅ hard gate |
| REQ-083 | Pending inspection should be visually highlighted (employer suggests red) in the yard inventory / load status… | EXPLICIT | EMP-479 | — | ⚠️ | 🟡 confirm |

---

## 7. Operations — Load List / Loading

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-090 | A Load List is produced **per vessel** and printed for the loading operators. | EXPLICIT | EMP-014, EMP-306 – EMP-311, EMP-510, EMP-511 | — | ✅ | ✅ |
| REQ-091 | Load List columns: loading port, destination port, Description, Chassis Number, Serial Number, number of mach… | EXPLICIT | EMP-523, EMP-524 | — | ✅ | 🟡 confirm columns |
| REQ-092 | The Load List is **editable after creation** so that cargo inspected later the same night / next day can be a… | EXPLICIT | EMP-528 – EMP-533 | — | ✅ | ✅ |
| REQ-093 | Cargo that was on the Load List but **not loaded** returns to Yard Inventory and remains available for a late… | EXPLICIT | EMP-016, EMP-017, EMP-022, EMP-049, EMP-534 – EMP-537 | — | ✅ | ✅ ADR-043 |
| REQ-094 | Yard Inventory supports **filters by destination** so management can decide which destination to assign a ves… | EXPLICIT | EMP-042 – EMP-046, EMP-094 – EMP-097, EMP-499 – EMP-503 | — | ✅ | ✅ |

---

## 8. Bill of Lading

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-100 | Every loaded cargo item receives its own Bill of Lading. | EXPLICIT | EMP-034 – EMP-036 | B/L | ✅ | ✅ |
| REQ-101 | B/L content includes Shipper, Consignee, Notify Party, B/L number, vessel name, voyage, loading port, destina… | EXPLICIT | EMP-035, EMP-540 – EMP-561 | B/L | ✅ | ✅ |
| REQ-102 | **B/L numbering is per destination.** Examples: `KHS/26-2/2026` (Khorramshahr), `RJS/26-10` (Rajaee). | EXPLICIT | EMP-542 – EMP-547 | B/L `KHS/26-110`; Invoice `KHS/26-108` | ❌ date-based | 🟡 mechanism ✅, format C-01 |
| REQ-103 | **Exact B/L number format is unresolved.** `KHS/26-2/2026` (destination abbrev / yy-seq / yyyy) and `RJS/26-1… | CONTRADICTED | EMP-544 vs EMP-546 | see C-01 | n/a | 🟡 C-01 |
| REQ-104 | A B/L is first issued as **Draft** with a `DRAFT` watermark, sent to the customer for review, then finalised/… | EXPLICIT | EMP-562 – EMP-565 | — | ❌ | ✅ ADR-045/046 |
| REQ-105 | Corrections requested by the customer on the draft B/L are applied before finalisation. | EXPLICIT | EMP-564 | — | ❌ | ✅ revisions |
| REQ-106 | The B/L is sent to the customer as a finished document. | EXPLICIT | EMP-036, EMP-051, EMP-584 | — | ✅ print | ⏳ Phase 7 |
| REQ-107 | The manifest must be able to include **partner / forwarder Bills of Lading** whose number format and layout d… | EXPLICIT | EMP-068 – EMP-074 | Manifest (`NES260900266/7`) | ❌ | 🟡 per-item parties ✅, partner numbers confirm |

---

## 9. Manifest

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-110 | Manifest header: vessel name (Tug & Barge or Landing Craft), Voyage, port of loading, port of discharge, Mani… | EXPLICIT | EMP-025, EMP-569, EMP-570, EMP-588 | Manifest | ⚠️ parties at manifest level | 🟡 ADR-047, Phase 5 U5 pending |
| REQ-111 | Manifest rows are numbered 1, 2, 3… and each row carries a B/L number, goods description, Shipper, Consignee,… | EXPLICIT | EMP-026 – EMP-029, EMP-591 – EMP-599 | Manifest | ✅ | 🟡 |
| REQ-112 | The last manifest page prints **Total units, Total packages, Total weight**. | EXPLICIT | EMP-029 – EMP-032, EMP-574, EMP-600 | Manifest totals | ✅ | 🟡 |
| REQ-113 | The Manifest is printed and physically stamped for the captain; a PDF copy is sent to the destination Agent. | EXPLICIT | EMP-033, EMP-585, EMP-586 | — | ⚠️ print only | ⏳ Phase 7 |
| REQ-114 | Manifest numbers are system-generated in a company-defined format. | EXPLICIT | EMP-589 | `DSMAN/KHO-26-006`, `DSKHS-26-005` | ❌ random | 🟡 format C-02 |

---

## 10. Output, printing and document templates

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-120 | Every document screen must offer **PDF output**, **Excel output** and **Print**. | EXPLICIT | EMP-037, EMP-169, EMP-575 – EMP-579, EMP-721 | — | ❌ browser print only | ⏳ Phase 7 |
| REQ-121 | **PDF output must include stamps, marks and signature.** | EXPLICIT | EMP-040, EMP-171, EMP-580, EMP-581 | — | ❌ | ⏳ Phase 7 |
| REQ-122 | **Print must strip stamps, marks and signature** so a live physical stamp can be applied to the printed sheet… | EXPLICIT | EMP-039, EMP-172, EMP-582, EMP-583 | — | ❌ | ⏳ Phase 7 |
| REQ-123 | Excel output is wanted so staff can make manual corrections before issuing. | EXPLICIT | EMP-037, EMP-169 | — | ❌ (declared, missing) | ⏳ Phase 7 |
| REQ-124 | The company has **its own output templates** per document type and wants to upload them. Named types: Loading… | EXPLICIT | EMP-035, EMP-572, EMP-721 – EMP-725 | All 7 PDFs are the design basis | ❌ global images only | ⏳ Phase 7 (models exist) |
| REQ-125 | The uploaded templates are **not present in this repository**. | UNRESOLVED | EMP-035, EMP-107, EMP-119, EMP-572, EMP-722, EMP-725 | SRC-07 | n/a | ❌ SRC-07 |

---

## 11. Jobs & job costing

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-130 | A **Job** (Job Number) is a running cost note attached to a single machine / cargo / shipment, opened when wo… | EXPLICIT | EMP-060, EMP-061, EMP-067, EMP-411 – EMP-414, EMP-603 – EMP… | — | ❌ | ✅ Job + JobCostItem |
| REQ-131 | A Job is created for **ETOZ / ETDZ** work: end-to-end handling where Duna collects the goods abroad, clears i… | EXPLICIT | EMP-054 – EMP-059, EMP-403 – EMP-408, EMP-605 | — | ❌ | ❌ ETOZ undefined |
| REQ-132 | Job cost categories named by the employer: repair, freight, customs clearance, low-bed transport, crane/loadi… | EXPLICIT | EMP-104, EMP-410, EMP-414, EMP-696 | SOA narrations | ⚠️ 5 fixed columns | ✅ JobItemKind |
| REQ-133 | Expenses accrue over weeks or months and are not entered daily; the accountant must be able to see **stage-by… | EXPLICIT | EMP-064, EMP-065, EMP-176 – EMP-178 | — | ❌ | ✅ |
| REQ-134 | The invoice is prepared by checking / matching the draft against the related Job Numbers. | EXPLICIT | EMP-099, EMP-609, EMP-625 | — | ❌ | ❌ invoice↔job link missing |
| REQ-135 | Job Number carries a Customer. | EXPLICIT | EMP-605 | — | ❌ | ✅ |

---

## 12. Invoicing

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-140 | An Invoice can be produced in **two ways**: (a) auto-drafted from issued Bills of Lading, or (b) created stan… | EXPLICIT | EMP-607, EMP-608, EMP-623 – EMP-628 | — | ⚠️ manual only | 🟡 NBD §1.4 |
| REQ-141 | The B/L-generated invoice arrives in **Draft** state and is then matched against Job Numbers before issue. | EXPLICIT | EMP-608, EMP-609, EMP-624, EMP-625 | Tax Invoice refs B/L + Manifest | ⚠️ optional single B/L | 🟡 single B/L FK |
| REQ-142 | Invoice line columns: **Description, Rate (Fee), Quantity (QTY), VAT %, VAT amount, Amount (incl. VAT)**. | EXPLICIT | EMP-112 – EMP-118, EMP-611 | Tax Invoice | ⚠️ unit-price column prints total (D5) | ✅ |
| REQ-143 | Invoice totals block: **Subtotal, VAT, Total Amount**. | EXPLICIT | EMP-612 – EMP-614 | Tax Invoice | ❌ VAT double-counted (D4) | 🟡 header VAT, not per line |
| REQ-144 | VAT is entered **per line** as a percentage. | EXPLICIT | EMP-114, EMP-115, EMP-611 | Tax Invoice (VAT 0.00) | ✅ per line | ❌ header VAT — contradicts |
| REQ-145 | Some invoices carry VAT and some do not; the system must separate them so a **quarterly VAT report** can be p… | EXPLICIT | EMP-617 – EMP-622 | — | ❌ | ❌ |
| REQ-146 | The printed document is a **Tax Invoice** (UAE legal requirement) and carries the customer's Address, mobile/… | EXPLICIT | EMP-106 | Tax Invoice | ⚠️ | ✅ |
| REQ-147 | The Invoice header carries **Invoice Number, Invoice Date, payment due date (maximum payment deadline), TRN N… | EXPLICIT | EMP-108, EMP-109, EMP-635 – EMP-641 | — | ❌ no due date | ❌ no due date |
| REQ-148 | Invoice records which **B/L and which Manifest** it relates to. | EXPLICIT | EMP-638, EMP-639 | Tax Invoice | ⚠️ | ✅ |
| REQ-149 | Invoice payment status is one of **Paid / Partial (Partial Payment) / Unpaid**. | EXPLICIT | EMP-428, EMP-642, EMP-687 – EMP-689 | — | ❌ PAID/UNPAID only | ✅ paidAmount |
| REQ-150 | Issuing an Invoice posts it to the customer's ledger as **Debit** (under "Sales"). | EXPLICIT | EMP-120 – EMP-123, EMP-630, EMP-631 | SOA (Sales = debit) | ✅ | ✅ |
| REQ-151 | Payment received posts to the customer's ledger as **Credit**. | EXPLICIT | EMP-132, EMP-632 | SOA | ✅ | ✅ |
| REQ-152 | A **Proforma Invoice** document type exists. | EXPLICIT | EMP-643, EMP-644 | Proforma `DSPRO/26-001` | ✅ | ✅ ADR-034 |
| REQ-153 | A **Quotation** document type exists. | EXPLICIT | EMP-645 | Quotation `DSQUO/25-017` | ⚠️ free text | ✅ ADR-035 |
| REQ-154 | Overdue invoices should raise an **alarm or report** so the team can follow up on how long a customer takes t… | EXPLICIT | EMP-135 – EMP-137 | — | ❌ | ❌ |

---

## 13. Ledger, vouchers, salary

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-160 | Each customer has a **Ledger / profile** showing invoices issued, payments received, debit, credit, balance,… | EXPLICIT | EMP-130 – EMP-134, EMP-421 – EMP-429 | SOA | ⚠️ | ✅ derived statement |
| REQ-161 | Balance = Debit − Credit; it must show how much the customer owes, how much is owed to them, or zero. | EXPLICIT | EMP-133, EMP-134 | SOA (`683.50 Dr`) | ⚠️ display bug (D7) | ✅ |
| REQ-162 | A **Ledger Statement** can be produced for a customer over an arbitrary **date range**. | EXPLICIT | EMP-662 – EMP-664 | SOA (1-Jul-26 → 7-Sep-26) | ⚠️ ordered desc (D8) | ✅ |
| REQ-163 | There are two voucher types: **Payment Voucher** and **Receipt Voucher**. | EXPLICIT | EMP-181, EMP-654, EMP-655 | Receipt Voucher | ✅ | ✅ |
| REQ-164 | A voucher first selects the **Customer**, then optionally allocates to a specific **Invoice** or **B/L number… | EXPLICIT | EMP-656 – EMP-659 | Receipt Voucher (Advance 477) | ❌ no allocation | ❌ single-invoice FK |
| REQ-165 | **An unallocated payment must NOT raise an error** — it posts to the customer ledger as Credit. | EXPLICIT | EMP-660 | — | ✅ by omission | ✅ nullable invoiceId |
| REQ-166 | A **General Journal** capability allows posting directly onto a customer ledger outside invoicing (e.g. loans… | EXPLICIT | EMP-714 – EMP-719 | — | ❌ | ❌ no GeneralJournal |
| REQ-167 | The Ledger is **not** only for customers: daily expenses, office expenses and company running costs must also… | EXPLICIT | EMP-647 – EMP-650, EMP-720 | — | ❌ | ❌ |
| REQ-168 | **Payment Vouchers require ID-card capture** (front and back) of the recipient — by upload or by camera — plu… | EXPLICIT | EMP-703 – EMP-707 | — | ⚠️ payment form only | ❌ |
| REQ-169 | Salary: employees are defined, and a **Salary Slip** is issued for each month. | EXPLICIT | EMP-651 – EMP-653 | — | ❌ | ✅ Employee + SalaryRecord |
| REQ-170 | **Salary Slips also require ID-card capture** (front and back, upload or camera) printed with the employee's… | EXPLICIT | EMP-708 – EMP-712 | — | ❌ | ❌ no ID-card |
| REQ-171 | Salary slips are prepared one or two days before the end of each month. | EXPLICIT | EMP-709 | — | ❌ | ✅ |
| REQ-172 | Salary is self-contained (no voucher/ledger posting implied by the employer). | INFERRED | EMP-651 – EMP-653 | — | n/a | ✅ ADR-036 |

---

## 14. Release Order, Delivery Order, Agent portal

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-180 | A **Release Order** is issued when the customer's cargo has reached the destination, been discharged, and Dun… | EXPLICIT | EMP-138, EMP-674, EMP-675 | — | ❌ | ✅ ReleaseOrder |
| REQ-181 | Release Order rows show B/L number, Consignee, goods description and a Released status marker. | EXPLICIT | EMP-681 – EMP-683 | — | ❌ | 🟡 |
| REQ-182 | Release Order records the **payment condition** at release: fully Paid, Partial Payment, or Unpaid (released… | EXPLICIT | EMP-142 – EMP-145, EMP-685 – EMP-689 | — | ❌ | 🟡 NBD §1.2 |
| REQ-183 | A **Release Report** shows, per B/L / Manifest, which items were Released+Paid, Released+Partial, Released+Un… | EXPLICIT | EMP-146, EMP-147 | — | ❌ | ⏳ Phase 8 |
| REQ-184 | An **alert / notice** is raised when a released document remains unpaid — the employer's example thresholds a… | EXPLICIT | EMP-148, EMP-149, EMP-692 | — | ❌ | ❌ |
| REQ-185 | A **Delivery Order** is issued when Duna has discharged inbound cargo at its own port and hands the documents… | EXPLICIT | EMP-162, EMP-163, EMP-666, EMP-667 | — | ❌ | ✅ DeliveryOrder |
| REQ-186 | Delivery Order carries a number, a date, a Customer and a **Port**, and is printed and stamped. | EXPLICIT | EMP-669 – EMP-672 | — | ❌ | 🟡 NBD §1.3 |
| REQ-187 | Agents get their own **login** and see only their own destination's data — "Khorramshahr only sees Khorramsha… | EXPLICIT | EMP-153 – EMP-159, EMP-676 – EMP-680 | — | ❌ unscoped portal | 🟡 foundation ✅, destination scope ⏳ Phase 8 |
| REQ-188 | The Agent portal exists so that agents stop telephoning Duna to ask whether a B/L has been released. | EXPLICIT | EMP-153, EMP-156, EMP-159 | — | ❌ | ⏳ Phase 8 |

---

## 15. Reporting

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-190 | For every Manifest (i.e. every vessel trip to a destination) the system computes a **P&L**: cost vs income, a… | EXPLICIT | EMP-126 – EMP-129, EMP-693 – EMP-701 | — | ⚠️ manifest P&L exists | ⏳ Phase 8 |
| REQ-191 | Voyage / manifest **cost categories** named by the employer: vessel charter, Port Use, Handling, Lashing, and… | EXPLICIT | EMP-696 | — | ⚠️ 5 fixed columns | ⏳ Phase 8 |
| REQ-192 | Voyage / manifest **income** = the sum of the invoices (statements) issued against that manifest's Bills of L… | EXPLICIT | EMP-698 | — | ✅ | ⏳ Phase 8 |
| REQ-193 | The annual tax P&L must be obtainable by applying **filters** over the per-manifest P&L results. | EXPLICIT | EMP-702 | — | ❌ | ⏳ Phase 8 |
| REQ-194 | A **quarterly VAT report** (VAT collected vs VAT paid) is required. | EXPLICIT | EMP-617 – EMP-622 | Tax Invoice (VAT column) | ❌ | ⏳ Phase 8 |
| REQ-195 | Office / daily expenses must feed the annual tax computation. | EXPLICIT | EMP-720 | — | ❌ | ⏳ Phase 8 |

---

## 16. Cross-cutting constraints

| REQ | Requirement | Class | Evidence (EMP) | Documents | Legacy | Current |
|---|---|---|---|---|---|---|
| REQ-200 | Optional fields must never block saving: "if we have it we enter it; if we don't have it, it shouldn't give a… | EXPLICIT | EMP-209, EMP-344, EMP-355, EMP-660 | — | ⚠️ | ✅ |
| REQ-201 | Master data is entered once and re-used by selection, to prevent operators re-typing it and making mistakes. | EXPLICIT | EMP-189, EMP-190, EMP-383 | — | ✅ | ✅ |
| REQ-202 | Data captured at intake must be recorded at intake time, not retrospectively ("from the moment we take delive… | EXPLICIT | EMP-075, EMP-076 | — | ⚠️ | ✅ |

---

## duna-analysis/07-traceability/source-inventory.md

# Source Inventory

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](../09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> Phase 1. Every source used to build this knowledge base, with its location, size, provenance,
> authority, and **exactly what it was used for**.
>
> Nothing has been deleted, moved or rewritten. See
> [`../06-ai-reference/source-retention-plan.md`](../06-ai-reference/source-retention-plan.md) for the
> *classification* of each source for future cleanup (Phase 12) — classification is a proposal only.

---

## 1. Summary

| Family | Files | Size | Authority | Status |
|---|---|---|---|---|
| Employer voice transcripts (Persian) | 20 | 94 KB | **Highest** | ✅ All read |
| Real company documents (PDF) | 7 | 1.9 MB | **Highest** for formats & values | ✅ All extracted and analysed |
| Legacy Laravel archive | 1 ZIP (199 files) + 5 md | 16.9 MB | Evidence of past behaviour | ✅ Statically analysed; **never executed** |
| Prior AI analyses | 3 + 5 | 150 KB | Low — verify first | ✅ Reviewed (Phase 6) |
| Current project docs | 13 + 34 | ~300 KB | High for the current system | ✅ Surveyed (Phase 8) |
| Current system code | — | — | High for current reality | ✅ Surveyed read-only |
| **Missing** | — | — | **Highest** | ❌ `/home/duna/dunaData/` — see §7 |

---

## 2. Employer voice transcripts — `requirements/`

**20 files, all in Persian, all read.**

### 2.1 Session A — 18 timestamped files (reliable chronological order)

| # | File | Size | Notes |
|---|---|---|---|
| 1 | `audio_2026-09-14_04-57-33.txt` | 6,369 B | Opens the session |
| 2 | `audio_2026-09-14_04-59-40.txt` | 3,606 B | |
| 3 | `audio_2026-09-14_05-00-18.txt` | 877 B | |
| 4 | `audio_2026-09-14_05-00-51.txt` | 1,208 B | |
| 5 | `audio_2026-09-14_05-01-56.txt` | 4,487 B | |
| 6 | `audio_2026-09-14_05-02-13.txt` | 798 B | |
| 7 | `audio_2026-09-14_05-02-40.txt` | 367 B | |
| 8 | `audio_2026-09-14_05-02-53.txt` | 660 B | |
| 9 | `audio_2026-09-14_05-03-16.txt` | 932 B | |
| 10 | `audio_2026-09-14_05-03-32.txt` | 5,567 B | |
| 11 | `audio_2026-09-14_05-05-14.txt` | **19,707 B** | Largest in session A |
| 12 | `audio_2026-09-14_05-05-37.txt` | 1,803 B | |
| 13 | `audio_2026-09-14_05-06-35.txt` | 12,003 B | |
| 14 | `audio_2026-09-14_05-06-46.txt` | 760 B | |
| 15 | `audio_2026-09-14_05-07-11.txt` | 773 B | |
| 16 | `audio_2026-09-14_05-07-29.txt` | **38 B** | Smallest — a fragment |
| 17 | `audio_2026-09-14_05-07-41.txt` | 1,385 B | |
| 18 | `audio_2026-09-14_05-07-52.txt` | 939 B | Closes the session |

### 2.2 Session B — 2 undated files (a separate, longer session)

| # | File | Size | Notes |
|---|---|---|---|
| 19 | `part1_0-15.txt` | 17,180 B | First 15 minutes of a longer recording |
| 20 | `part2_15-end.txt` | 16,199 B | From minute 15 to the end |

⚠️ **The two files are named as one continuous session, but the naming gives no date.** They were
analysed **after** Session A. Whether Session B is before or after Session A **cannot be determined
from the workspace**. Where the two sessions disagree, both readings are preserved in
[`../01-employer-statements/employer-original-statements.en.md`](../01-employer-statements/employer-original-statements.en.md).

### 2.3 What the transcripts cover

| Topic | Session A | Session B |
|---|---|---|
| Company overview, two business lines | ✅ | ✅ |
| Master data: Customer, Port, Yard, Vessel | ✅ | — |
| Master data: Shipper, Consignee, Agent | ✅ | — |
| Cargo intake, inspection, load list | ✅ | — |
| B/L lifecycle, numbering, release | ✅ | ✅ |
| Manifest, co-loading | ✅ | ✅ |
| Invoice, VAT, job costing | ✅ | ✅ |
| Ledger, vouchers, salary | ✅ | ✅ |
| Release order, delivery order, agent portal | ✅ | ✅ |
| Reports, outputs, templates | ✅ | ✅ |
| Letters, archive | — | partial |
| **Salary detail** | mention only | mention only |
| **Company archive** | one mention (`EMP-713`) | — |

---

## 3. Real company documents — `documents/`

**7 PDFs, 1.9 MB, all text-extracted and analysed.**

| # | File | Pages | Type | Document number | Date | Size |
|---|---|---|---|---|---|---|
| 1 | `BL-1X D155A CH NO 8308-1.pdf` | 1 | Bill of Lading | `KHS/26-110` | 29-Aug-26 | 643 KB |
| 2 | `MAN-MEHDI 11 KHO-26-006.pdf` | 3 | Cargo Manifest | `DSMAN/KHO-26-006` | 05-Sep-26 | 420 KB |
| 3 | `INV-GRAND CRANE USED TRUCK CRANE +1 PKG CH.NO 0127-1.pdf` | 1 | Tax Invoice | `DSINV/26-172` | 06-Aug-26 | 204 KB |
| 4 | `PRO-MEHDI BAGHSIAH 1X R340L, 1X BREAKER, 1X QUICK QOUPLER.pdf` | 1 | Proforma Invoice | `DSPRO/26-001` | 22-Aug-26 | 329 KB |
| 5 | `QUO-SHADMAN MEABADI 1X FINISHER-1.pdf` | 1 | Quotation | `DSQUO/25-017` | 20-Nov-25 | 318 KB |
| 6 | `DUNA  SHIPPING  -  RECEIPT  VOUCHER.pdf` | 1 | Receipt Voucher | **No. `477`** | — | 26 KB |
| 7 | `DUNA  SHIPPING SOA.pdf` | 1 | Statement of Account | — | 1-Jul-26 → 7-Sep-26 | 2.5 KB |

### 3.1 Extraction method and its limits

| Document | Method | Confidence |
|---|---|---|
| 1–5 | **Native PDF text extraction** (PyMuPDF 1.28.2) | **High** — digital text layer |
| 6 | **OCR** (rapidocr-onnxruntime 1.4.4 @ 200 dpi) | **Medium** — per-line confidence recorded in [`../02-business-documents/receipt-vouchers.md`](../02-business-documents/receipt-vouchers.md) |
| 7 | **OCR** (rendered at 200 dpi) | **Medium-high** — a TallyPrime ledger export; small but clean |

> **Typo policy:** typos in the source documents (`LAODING`, `SHIFITNG`, `KHORAMSHHAHR`, `700,00.00`,
> the manifest footer `VESSEL = DUNA SHIPPING LLC`) are **real artefacts, not extraction errors**.
> They are recorded, not normalised.

### 3.2 What each document proved

| Document | Proved |
|---|---|
| B/L | Party blocks; vessel `MEHDI 11`; voyage `02/26`; number format `KHS/26-110`; `FREIGHT PREPAID`; 1 original; "on deck" |
| Manifest | Tug **and** barge convention; 45 rows; **partner B/Ls `NES260900266/7` alongside `KHS/26-nnn`** (proves `REQ-107`); totals `32 UNITS AND 79 PKGS`, `991,886 KGS` |
| Tax Invoice | `DSINV/26-172`; per-line VAT columns; **VAT 0.00**; `Sub Total = Total = 27,370.00`; TRN `100353243700003`; references `KHS/26-108` + `DSKHS-26-005` |
| Proforma | **The second business line** (sale of goods, AED 690,000, FOB India → Bandar Abbas → Maku Free Zone); `100% ADVANCE PAYMENT` |
| Quotation | `DSQUO/25-017`; **line-item table**, not free text; AED 7,700 |
| Receipt Voucher | **Voucher No. `477`**; allocation references `1517`, `1526`, `Advance 477`; cash; AED 1,600. *(Corrected 2026-10-11: a `DSR/26-190` number was previously cited here and is fabricated — error E1.)* |
| Statement of Account | **TallyPrime is the book of record**; closing `683.50 Dr`; debit/credit columns; running balance; shared voucher series |

---

## 4. Legacy Laravel archive — `legacy-source/`

| Item | Size | Contents |
|---|---|---|
| `duna-clean.zip` | **16.9 MB** | The legacy Laravel 10 application |
| `docs-legacy/` | 5 md | `00-OVERVIEW.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS.md`, `03-UI-PAGES.md`, `04-DATA-DICTIONARY.md` |

### 4.1 Archive contents (199 non-asset files analysed)

| Metric | Value |
|---|---|
| PHP files | 78 — **22,833 LOC** |
| Blade files | 68 — **15,409 LOC** |
| Eloquent models | 23 |
| Controllers | 15 |
| Migrations | **4** (all stock Laravel) |
| Seeders | 1 (empty) |
| Tests | 4 (all stock scaffolding) |
| Config files | 17 |

### 4.2 Analysis method and its limits

| | |
|---|---|
| Method | **Static analysis only** — the code was read, never executed |
| `/vendor` and `/node_modules` | **Not present** in the archive, so the app cannot be run without `composer install` |
| Database | **No dump included** — the schema was **reconstructed** from models, controllers and views |
| Consequence | [`../03-legacy-laravel-system/database-schema.md`](../03-legacy-laravel-system/database-schema.md) carries **explicit confidence levels**; runtime-only behaviours (queue jobs, event listeners, scheduled tasks) could not be verified |

### 4.3 What the legacy archive proved

- What the company **actually used**, day to day, for years.
- The **shape** of the load list, manifest, B/L and invoice.
- The **ledger conventions** (debit/credit direction, balance formula) — independently confirming the
  SOA document.
- **14 catalogued defects (D1–D14)** — see
  [`../03-legacy-laravel-system/system-overview.md`](../03-legacy-laravel-system/system-overview.md) §7.
- What was **never** built: jobs, salary, delivery order, release workflow, agent portal, general
  journal, audit trail, document templates, PDF.

---

## 5. Prior AI analyses

### 5.1 `existing-analysis/` (3 files, Persian, 1,967 lines)

| File | Lines | Size |
|---|---|---|
| `duna_business_analysis.md` | 513 | 17.9 KB |
| `duna_client_discovery_questions_v2.md` | 885 | 34.2 KB |
| `duna_source_pack.md` | 569 | 25.6 KB |

### 5.2 `legacy-source/docs-legacy/` (5 files, English)

`00-OVERVIEW.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS.md`, `03-UI-PAGES.md`, `04-DATA-DICTIONARY.md`

### 5.3 Verdict

Reviewed in detail in
[`../04-business-analysis/prior-analysis-review.md`](../04-business-analysis/prior-analysis-review.md).
**Net: good framing, unreliable specifics.** Three recurring error patterns were found:

1. Assuming the legacy system implements what it merely declares.
2. Reporting "missing" for "not modelled the way I would model it."
3. Stating the employer's desired flow as if it were the legacy flow.

---

## 6. Current system (read-only survey)

| Source | What was used |
|---|---|
| `prisma/schema.prisma` (93.8 KB) | 62 models, 25+ enums, 38 migrations |
| `apps/api/src/modules/` | 33 modules, 38 controllers, 38 services |
| `apps/web/src/app/[locale]/(dashboard)/` | 35 pages |
| `docs/decisions.md` (86 KB) | 47 ADRs |
| `docs/progress.md` (91 KB) | Build history |
| `docs/current-plan/` (17 files) | Current plan, implementation state, open business decisions |
| `docs/ai-audit/` (14 files) | Previous audit |
| `docs/permissions.md` | 105 permissions / 12 resources |
| `docs/architecture.md`, `database-schema.md`, `workflows.md`, `api.md` | Current system |

**Read-only.** No application source code was modified at any point.

---

## 7. ⚠️ Missing sources

| ID | Source | Why it matters | Impact |
|---|---|---|---|
| **SRC-01** | **`/home/duna/dunaData/`** — named by `docs/plan.md` as the **highest authority**, especially `transcripts/` | The current plan was written against this transcript set | **Every conclusion in this knowledge base is provisional with respect to it.** The 20 transcripts here may be a subset |
| SRC-02 | `shipping_documents_detailed_reference.md` — named as secondary employer evidence | More document evidence | More specimens may exist |
| SRC-03 | A database dump of the legacy system | The legacy schema had to be reconstructed | Legacy schema carries confidence caveats |
| SRC-04 | `/vendor` in the legacy archive | The app cannot be executed | Static analysis only |
| SRC-05 | A database dump of the **current** system | Current data shapes | Current analysis is schema-based, not data-based |
| SRC-06 | Answers to the **160-question** discovery questionnaire | Would close most open questions | ~40 questions remain materially unanswered |
| SRC-07 | The employer's actual document templates (Word/Excel originals) | `REQ-124` | Only 7 rendered PDFs are available |
| SRC-08 | `/home/duna/backups/shipping_erp_20260926_112141.dump` | Referenced after a data-loss incident | Not present in this workspace |

---

## 8. Provenance of every statement

| ID space | Meaning | Defined in |
|---|---|---|
| `EMP-nnn` | A numbered segment of the employer's original statements | `01-employer-statements/employer-original-statements.en.md` |
| `REQ-nnn` | A numbered requirement derived from the statements | `01-employer-statements/requirements-catalog.md` |
| `Rn.n` | A business rule derived from requirements | `01-employer-statements/business-rules.md` |
| `Dn` | A legacy system defect | `03-legacy-laravel-system/system-overview.md` §7 |
| `Ln` | A legacy business rule as implemented | `03-legacy-laravel-system/business-rules.md` |
| `Gn` | A legacy enforcement gap | `03-legacy-laravel-system/business-rules.md` §2 |
| `C-nn` | A contradiction between sources | `04-business-analysis/contradictions-register.md` |
| `Qnn` | A discovery question from the prior questionnaire | `existing-analysis/duna_client_discovery_questions_v2.md` |
| `SRC-nn` | A missing source | This file, §7 |
| `ADR-nnn` | An architecture decision on the current system | `docs/decisions.md` |

---

## duna-analysis/08-original-sources/README.md

# 08 — Original Sources

> **Nothing has been moved here.** The standing instruction was: *do not delete, move or rewrite
> existing project docs; preserve originals.* This directory therefore contains **only a pointer**.

## Where the originals actually live

| Original | Location | Files | Size |
|---|---|---|---|
| Persian employer transcripts | [`../requirements/`](../requirements/) | 20 `.txt` | 94 KB |
| Real company documents | [`../documents/`](../documents/) | 7 `.pdf` | 1.9 MB |
| Legacy Laravel archive | [`../legacy-source/duna-clean.zip`](../legacy-source/duna-clean.zip) | 1 | 16.9 MB |
| Legacy prior analysis | [`../legacy-source/docs-legacy/`](../legacy-source/docs-legacy/) | 5 `.md` | — |
| Prior AI analyses | [`../existing-analysis/`](../existing-analysis/) | 3 `.md` | 78 KB |
| Source-pack summary | [`../docs-summary.md`](../docs-summary.md) | 1 | 55.8 KB |

## Why they were not consolidated into one directory

1. Moving them would break every existing reference in the repository.
2. Their current locations are already cited by `docs/current-plan/` and by this knowledge base.
3. The instruction was to preserve originals, not relocate them.

## Classification for future cleanup

| Location | Class | Rationale |
|---|---|---|
| `../requirements/` | **KEEP** | Irreplaceable primary evidence |
| `../documents/` | **KEEP** | Irreplaceable primary evidence |
| `../legacy-source/duna-clean.zip` | **KEEP** | 16.9 MB; the only record of the legacy system. Recommend **Git LFS** if clone size matters |
| `../legacy-source/docs-legacy/` | **REVIEW** | Prior analysis, demonstrably wrong in places |
| `../existing-analysis/` | **REVIEW** | Prior analysis. `duna_client_discovery_questions_v2.md` holds the only copy of the Q01–Q160 ID space — **never delete** |
| `../docs-summary.md` | **KEEP-DERIVED** | Superseded in depth, cheap to keep |

Full detail: [`../06-ai-reference/source-retention-plan.md`](../06-ai-reference/source-retention-plan.md).

---

## duna-analysis/FINAL-REPORT.md

# Final Report — Duna Business Knowledge Base

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

**Built:** 2026-10-10
**Location:** `docs/duna-analysis/`
**Scope:** Documentation only. **No application source code, UI, routing, API, database, config or
environment file was modified, and no dependency was added.**

---

## 1. What was built

A structured, searchable **English** business knowledge base for Duna Shipping LLC.

| Metric | Value |
|---|---|
| Analysis files written | **46** |
| Lines | **~16,000** |
| Total directory size | **19 MB** (mostly the 16.9 MB legacy ZIP) |
| Requirement IDs (`REQ-*`) | **127** |
| Employer statement IDs (`EMP-*`) | **700+** |
| Legacy defects catalogued | **14** (D1–D14) |
| Contradictions catalogued | **22** (C-01…C-22) |
| Customer-relationship hypotheses tested | **18** (H1–H18) |
| Sources inventoried | **35 + 8 missing** |
| Phases completed | **14 of 14** |

---

## 2. Structure

```
docs/duna-analysis/
├── README.md                        ← entry point
├── FINAL-REPORT.md                  ← this file
├── 01-employer-statements/    (7)   ← the employer's own words, in English, in original sequence
├── 02-business-documents/     (6)   ← the 7 real PDFs, field by field
├── 03-legacy-laravel-system/ (11)   ← the old Laravel system, incl. 14 defects
├── 04-business-analysis/      (6)   ← consolidated model, contradictions, gaps, hypotheses
├── 05-current-project/        (5)   ← the current system + legacy-vs-current comparison
├── 06-ai-reference/           (4)   ← how to use, maintain, retain, audit
├── 07-traceability/           (2)   ← source inventory + 127-row traceability matrix
├── requirements/             (20)   ← Persian transcripts (originals, untouched)
├── documents/                 (7)   ← PDFs (originals, untouched)
├── existing-analysis/         (3)   ← prior AI analyses (originals, untouched)
├── legacy-source/             (6)   ← duna-clean.zip + docs-legacy/ (originals, untouched)
└── docs-summary.md                  ← summary shipped with the source pack
```

**Nothing was deleted, moved or rewritten.** All 35 original sources remain in place.

---

## 3. What each phase produced

| Phase | Deliverable | Headline result |
|---|---|---|
| **1** | Source inventory | 35 sources inventoried, 8 gaps identified (**SRC-01**…SRC-08) |
| **2** | Consolidated English employer statements | 113 KB, **original sequence preserved**, every statement citable as `EMP-nnn` |
| **3** | Requirements analysis | **127 requirements**, classified EXPLICIT / INFERRED / UNRESOLVED / CONTRADICTED |
| **4** | PDF document analysis | All 7 documents analysed; 2 needed OCR; the two-business-line split discovered |
| **5** | Legacy Laravel analysis | 199 files, 22,833 PHP LOC + 15,409 Blade LOC; **14 defects**; the ledger-arithmetic and numbering problems found |
| **6** | Prior-analysis review | 8 prior analyses evaluated; **3 recurring error patterns** identified; `00-OVERVIEW.md`'s "Ledger is missing" claim disproved |
| **7** | Discovery questions | Q01–Q160 mapped to evidence; **~55 answered, ~40 partial, ~65 unanswered** |
| **8** | Current system + comparison | 62 models, 33 modules, 47 ADRs surveyed; **127-row traceability matrix** |
| **9** | Customer-relationship hypotheses | **H1–H18** tested; 13 accepted/rejected, 5 unresolved |
| **10** | Structure, README, AI instructions | `README.md` + `how-to-use-this-knowledge-base.md` with 7 rules and a quick-reference card |
| **11** | Maintenance plan | The four-place update rule; append-only ID guarantees |
| **12** | Source retention plan | Every source classified KEEP / KEEP-DERIVED / REVIEW — **no deletions** |
| **13** | Completeness audit | Honest coverage table; 6 structural, 6 analytical, 7 business gaps |
| **14** | Final report | This file |

---

## 4. The ten most consequential findings

1. **The legacy system inverted the core relationship.** It created the Manifest first and B/Ls
   against it. The employer says B/L first, Manifest consolidates issued B/Ls. The current system has
   already restored the employer's order (ADR-047). *Do not re-import the legacy nesting.*

2. **The legacy system's `RELEASED` B/L state is never written.** `RELEASED` is a declared constant;
   no code path assigns it. The Release Manager screen has **no release action** — only Delete. Prior
   analyses described the intended lifecycle as if it were implemented. (Defect **D1**.)

3. **The legacy invoice double-counts VAT.** The footer renders `vatamount + subtotal`, but `subtotal`
   already includes VAT. Correct arithmetic: `Total = Sub Total`; the footer VAT figure is a memo.
   (Defect **D4**.)

4. **Every legacy number generator has a random component** except the voyage counter — and the
   voyage counter is keyed on **port + shipper** instead of **vessel + destination**. (Defects
   **D12**, **D13**.)

5. **The legacy manifest template hard-codes the vessel as `VESSEL = DUNA SHIPPING LLC`.** It could
   never have produced a correct manifest. The real document shows `BARGE MEHDI 11 / TUG LAYAN GULF`.
   (Defect **D11**.)

6. **The legacy ledger statement is ordered newest-first while accumulating a running balance from the
   top**, and a duplicated condition makes credit-side balances print `0`. Both are confirmed wrong
   against the real TallyPrime Statement of Account. (Defects **D7**, **D8**.)

7. **Duna runs two businesses, not one.** Freight forwarding, **and** buying and reselling machinery.
   The Proforma `DSPRO/26-001` sells a Hyundai excavator for AED 690,000, FOB India — a sale of goods,
   with no B/L or voyage. **The employer never said this; it is inferred from the documents.**

8. **The real manifest proves co-loading.** Rows `NES260900266` and `NES260900267` (a partner's
   numbering) sit alongside Duna's `KHS/26-nnn`. That is `REQ-107`, and the legacy model cannot
   express it.

9. **The current system meets 68 of 127 requirements**; 23 are partial, 19 unmet, 15 scheduled. The
   unmet cluster is concentrated in **finance** (per-line VAT, voucher allocation, general journal,
   invoice↔job link) and lands in **Phase 6** — the highest-business-risk phase in the roadmap.

10. **The authoritative transcript set is absent.** `docs/plan.md` names
    `/home/duna/dunaData/transcripts/` as the highest authority. **It does not exist in this
    workspace** (**SRC-01**). Every conclusion here is provisional with respect to it.

---

## 5. What was deliberately NOT done

| Not done | Why |
|---|---|
| No application code changed | Explicit instruction: documentation only |
| No source deleted, moved or rewritten | Explicit instruction: preserve originals |
| No contradiction silently resolved | Explicit instruction: record, don't resolve |
| No business rule invented | Explicit instruction: don't fabricate |
| No secret recorded | Credentials in the archive were deliberately omitted |
| No Git commit or push | Explicit instruction |
| No claim of complete coverage of unanalysed material | The completeness audit says otherwise |

---

## 6. The three error patterns found in prior analyses

Recorded because they will recur:

1. **Assuming the legacy system implements what it merely declares.** `RELEASED` is a constant;
   "PDF-ready" means browser print; "sequential" invoice codes are random.
2. **Reporting "missing" for "not modelled the way I would model it."** `docs-legacy/00-OVERVIEW.md`
   marks Ledger as ❌ Missing — but `docs-legacy/03-UI-PAGES.md`, in the same document set, lists
   `admin/fins/ledger`. The ledger exists; it is merely inadequate.
3. **Stating the employer's desired flow as if it were the legacy flow.** The manifest/B-L inversion.

> **Rule adopted:** when a prior analysis says a legacy behaviour *exists*, find the line of code that
> performs it. When it says a behaviour is *missing*, find the screen that would have hosted it. Both
> directions have been wrong in this repository.

---

## 7. What a future agent should do next

### 7.1 Before writing code

1. Read [`06-ai-reference/how-to-use-this-knowledge-base.md`](06-ai-reference/how-to-use-this-knowledge-base.md).
2. Find the requirement in [`07-traceability/requirements-traceability.md`](07-traceability/requirements-traceability.md).
3. Check the contradictions register before assuming a format.

### 7.2 Ask the employer these seven questions

They block the most work for the least effort, and the current system is built to accept the answers
as **data**, not code changes (ADR-008):

| # | Question | Blocks |
|---|---|---|
| 1 | Is the B/L number `KHS/26-110` (from the real document) or one of your spoken examples? | B/L numbering |
| 2 | Are `DSMAN/KHO-26-006` and `DSKHS-26-005` the same series? | Manifest numbering |
| 3 | Confirm `DSINV/26-172`, `DSPRO/26-001`, `DSQUO/25-017`, and receipt voucher **No. `477`** | All commercial numbering. *(Corrected 2026-10-11: `DSR/26-190` was listed here and is fabricated — error E1.)* |
| 4 | What is the exact customer code format? (four incompatible examples given) | Customer numbering |
| 5 | VAT is per line — what is the default rate, and which services are taxable? | Invoice, VAT report |
| 6 | On release: what happens with partial payment, and on credit? Who approves an override? | Release workflow |
| 7 | Do you really run two businesses — freight, and buying and reselling machinery? | Sales documents, jobs |

### 7.3 Then

- **Phase 6** is the highest-risk phase: per-line VAT, voucher allocation, general journal,
  invoice↔job link all land there, and all four contradict current implementation.
- **Phase 7** should not be designed until the 7 real specimens have been read — they *are* the
  template specification.
- **Add a web test harness.** `apps/web` has no tests at all, and that gap has already shipped one
  defect (dead inspection endpoints + a status-vocabulary crash).

---

## 8. Honest limitations

| Limitation | Impact |
|---|---|
| The authoritative transcript set is missing (**SRC-01**) | Everything is provisional with respect to it |
| The legacy system was never executed | No runtime verification; the schema is a reconstruction |
| The current system was surveyed, not read line by line | ~12 of 47 ADRs read in full |
| ~65 of 160 discovery questions remain unanswered | They need the employer |
| Salary, Letters and Company Archive are barely described | Must not be built on inference |
| Two of seven PDFs required OCR | Per-line confidence recorded for the receipt voucher |

---

## 9. Verdict

The knowledge base is **fit for its purpose**: a future AI agent can now understand what Duna Shipping
does, what the employer asked for, what the old system did, what the current system does, and where
the three disagree — **without re-deriving any of it**.

What is **not** provisional: the employer's own statements, the seven real documents, and the legacy
code findings. Those are complete and directly evidenced.

What **is** provisional: every number format, everything about salary, letters and archive, and every
conclusion that depends on the missing transcript set.

---

## duna-analysis/README.md

# Duna Business Knowledge Base

> **Correction note (2026-10-12, Phase 1 — additive).** Figures in this file are kept as recorded. Verified values measured from source on 2026-10-12 (see [`verified-figures`](09-audit/verified-figures-2026-10-12.md)): **52 Prisma models · 32 enums · 32 feature modules** (38 `@Module` classes including app, infrastructure and Prisma) · 39 controller files · 38 service files · 35 web pages · **161 seeded permission codes across 34 module values** (161/34 includes the `audit` permission added in commit `66628c3` on 2026-10-12; 160/33 was correct on 2026-10-11). Where this file says `62 models` or `25 enums`, the verified figures are 52 and 32 (correction E2). Where it says `46 files, ~16,000 lines`, the recorded correction is 45 files / 11,536 lines (E7, measured 2026-10-11).

> A structured, searchable **English** business knowledge base for **Duna Shipping LLC**, built so
> that a future AI agent can improve the current Next.js dashboard **without re-deriving the business**.
>
> **Start here.** If you read only one file in this directory, read this one and then
> [`06-ai-reference/how-to-use-this-knowledge-base.md`](06-ai-reference/how-to-use-this-knowledge-base.md).

---

## 1. What this is

Everything known about **how Duna Shipping actually works**, distilled from five kinds of source:

| Source | What it tells you |
|---|---|
| 20 Persian voice transcripts from the employer | **Intent** — what he wants, in his own words |
| 7 real company documents (PDF) | **Fact** — the formats, values and layouts the company really uses |
| A legacy Laravel system (199 files) | **History** — what the company actually did for years |
| 8 prior AI analyses | **Framing** — useful, but verify everything |
| The current Next.js / NestJS system | **Reality** — what exists today |

**46 files, ~16,000 lines, 19 MB.**

---

## 2. Directory map

| Directory | Phase | Contents |
|---|---|---|
| [`01-employer-statements/`](01-employer-statements/) | 2, 3 | The employer's own words, in English, **in original sequence**; the 127-requirement catalogue; business rules; processes; glossary; open questions |
| [`02-business-documents/`](02-business-documents/) | 4 | The 7 real PDFs analysed field by field, plus a cross-document synthesis |
| [`03-legacy-laravel-system/`](03-legacy-laravel-system/) | 5 | The old Laravel system: architecture, schema, calculations, workflows, documents, permissions, source map, and **14 catalogued defects (D1–D14)** |
| [`04-business-analysis/`](04-business-analysis/) | 6, 9 | The consolidated business model, ER model, contradictions register, capability gaps, customer-relationship hypotheses, and a review of the prior analyses |
| [`05-current-project/`](05-current-project/) | 8 | The current Next.js/NestJS system, and the **legacy-vs-current comparison** |
| [`06-ai-reference/`](06-ai-reference/) | 10–13 | **How to use this knowledge base**, the maintenance plan, the source-retention plan, and the completeness audit |
| [`07-traceability/`](07-traceability/) | 1, 7 | Source inventory and the **requirements traceability matrix** (all 127 requirements × 4 evidence layers) |
| `requirements/` | — | The 20 Persian transcripts (**originals, untouched**) |
| `documents/` | — | The 7 PDFs (**originals, untouched**) |
| `existing-analysis/` | — | The 3 prior AI analyses (**originals, untouched**) |
| `legacy-source/` | — | `duna-clean.zip` + `docs-legacy/` (**originals, untouched**) |
| `docs-summary.md` | — | The 55.8 KB summary shipped with the source pack |

---

## 3. The five things you must know before touching anything

1. **Legacy Laravel behaviour is historical evidence, NOT the specification.** Do not plan to
   replace the current dashboard with it. Do not delete a current feature merely because the old
   system lacked it.
2. **Do not invent business rules.** Where the employer is ambiguous, the question is recorded in
   `01-employer-statements/open-questions.md`. Raise it; do not answer it.
3. **Do not silently resolve contradictions.** There are 22 catalogued in
   `04-business-analysis/contradictions-register.md`.
4. **Customer ≠ Shipper ≠ Consignee ≠ Agent ≠ User.** The legacy system merged Customers with Users.
   That was its single worst decision. See `04-business-analysis/customer-relationship-hypotheses.md`.
5. **B/L comes first; the Manifest consolidates issued B/Ls.** The legacy system inverted this. The
   current system has it right.

---

## 4. Two requirements that feel like bugs but are not

Recorded prominently because intuition points the wrong way:

| Requirement | What it says | Why it feels wrong |
|---|---|---|
| `REQ-122` | **Print must strip** stamps, marks and signature | It looks like a rendering bug. It is deliberate: the PDF carries the stamp, the printed page is stamped physically by hand afterwards |
| `REQ-165` | **An unallocated payment must NOT raise an error** | It looks like missing validation. It is deliberate: advances and deposits post to the customer ledger with no invoice |

---

## 5. Where to go for a specific question

| You want to know… | Go to |
|---|---|
| What did the employer actually say? | `01-employer-statements/employer-original-statements.en.md` |
| What is required, with a citable ID? | `01-employer-statements/requirements-catalog.md` |
| What does a real invoice / B/L / manifest look like? | `02-business-documents/document-catalog.md` |
| How did the old system do it? | `03-legacy-laravel-system/` |
| What did the old system get wrong? | `03-legacy-laravel-system/system-overview.md` §7 (D1–D14) |
| What does the business actually do, end to end? | `04-business-analysis/consolidated-business-model.md` |
| Two sources disagree — who wins? | `04-business-analysis/contradictions-register.md` |
| What does the current system do? | `05-current-project/implemented-capabilities.md` |
| Old vs new — what changed? | `05-current-project/legacy-vs-current-comparison.md` |
| Is requirement X met today? | `07-traceability/requirements-traceability.md` |
| What is still unknown? | `01-employer-statements/open-questions.md` |
| What is a Persian term in English? | `01-employer-statements/terminology-glossary.md` |

---

## 6. ID conventions

| ID | Meaning |
|---|---|
| `EMP-nnn` | A numbered segment of the employer's original statements |
| `REQ-nnn` | A numbered requirement |
| `Rn.n` | A business rule derived from requirements |
| `Dn` | A legacy system defect (D1–D14) |
| `Ln` / `Gn` | A legacy rule as implemented / a legacy enforcement gap |
| `C-nn` | A contradiction between sources |
| `Qnn` | A discovery question from the pre-existing Persian questionnaire |
| `SRC-nn` | A missing source |
| `ADR-nnn` | An architecture decision on the current system (in `docs/decisions.md`) |

---

## 7. ⚠️ Known limits — read before trusting anything

| Limit | Detail |
|---|---|
| **The authoritative transcript set is missing** | `docs/plan.md` names `/home/duna/dunaData/transcripts/` as the highest authority. **That path does not exist in this workspace** (gap **SRC-01**). The 20 transcripts here may be a subset. **Every conclusion here is provisional with respect to it.** |
| **The legacy system was never executed** | No `/vendor`, no database dump. The schema is a reconstruction with explicit confidence levels. |
| **The current system was surveyed, not exhaustively read** | 62 Prisma models, 33 API modules, 35 pages. The analysis is based on the schema, the ADRs and the project's own state documents — not a line-by-line read of all application code. |
| **The discovery questionnaire is unanswered** | Q01–Q160 exists but the employer never answered it. Roughly 65 of 160 questions have no answer anywhere in the repository. |
| **Salary, Letters and Company Archive are barely described** | The employer mentioned them and moved on. Do not build them on inference. |
| **Some document numbers remain unresolved** | B/L, manifest, invoice, proforma, receipt and customer-code formats all have competing candidates. See `contradictions-register.md`. |
| **No secrets** | Credentials found in the archive are deliberately not recorded anywhere in this knowledge base. |

---

## 8. Status

| Phase | Description | Status |
|---|---|---|
| 1 | Source inventory | ✅ |
| 2 | Consolidated English employer statements | ✅ |
| 3 | Requirements analysis | ✅ |
| 4 | PDF document analysis | ✅ |
| 5 | Legacy Laravel analysis | ✅ |
| 6 | Evaluate prior AI analyses | ✅ |
| 7 | Resolve discovery questions | ✅ (catalogued; ~65 remain genuinely unanswered) |
| 8 | Current Next.js analysis + legacy-vs-current | ✅ |
| 9 | Customer-relationship hypotheses | ✅ |
| 10 | Directory structure, README, future-model instructions | ✅ |
| 11 | Documentation maintenance plan | ✅ |
| 12 | Source retention / cleanup plan | ✅ (classification only — **nothing deleted**) |
| 13 | Completeness audit | ✅ |
| 14 | Final report | ✅ |

Built **2026-10-10**. Documentation only — **no application source code was modified.**

---

## duna-analysis/docs-summary.md

# Shipping Document Reference & Data Model Specification

## Source: `ilovepdf_merged.pdf`

> **Purpose:** This document is a machine-readable,
> implementation-oriented specification of the sample shipping documents
> in the source PDF. It describes the document types, every visible data
> field, the relationships between fields, repeated structures, example
> values, layout semantics, and implementation guidance so that an AI
> model or software developer can understand the documents without
> needing the original PDF.
>
> **Important:** The source PDF is **9 pages**, not 8: 1. Bill of Lading
> (B/L) 2--4. One Manifest (`DSMAN/KHO-26-006`) spanning three pages 5.
> Tax Invoice 6. Proforma Invoice 7. Quotation 8. Ledger Account 9.
> Receipt Voucher
>
> The source text extraction exposes pages 1--8; page 9 is image-based,
> so its voucher content was transcribed from the rendered page. Stamps,
> signatures and logos are treated as visual placeholders rather than
> business-data fields.

------------------------------------------------------------------------

# 1. Document Set Overview

The PDF is a collection of related shipping/accounting documents:

  ----------------------------------------------------------------------------
  PDF page(s)       Document          Business role        Main data
  ----------------- ----------------- -------------------- -------------------
  1                 Bill of Lading    Transport/shipping   Shipper, consignee,
                                      document             notify party,
                                                           vessel, voyage,
                                                           ports, cargo,
                                                           weight, B/L number,
                                                           freight, issue data

  2--4              Manifest          Consolidated cargo   Manifest
                                      list                 number/date,
                                                           vessel/barge/tug,
                                                           loading/discharge
                                                           ports, many
                                                           B/L/cargo records

  5                 Tax Invoice       Commercial/tax       Customer, invoice
                                      billing              number/date,
                                                           voyage, shipment
                                                           references, charge
                                                           lines, VAT, totals

  6                 Proforma Invoice  Preliminary          Seller, buyer, PI
                                      commercial invoice   number/date,
                                                           origin,
                                                           delivery/payment
                                                           terms, cargo lines,
                                                           weights, prices,
                                                           total

  7                 Quotation         Price offer          Quotation
                                                           number/date,
                                                           customer, cargo
                                                           description,
                                                           service/charge
                                                           lines, subtotal,
                                                           other charges,
                                                           grand total

  8                 Ledger Account    Account statement    Date, particulars,
                                                           voucher
                                                           type/number, debit,
                                                           credit, running
                                                           balance, closing
                                                           balance

  9                 Receipt Voucher   Accounting receipt   Voucher
                                                           number/date,
                                                           account,
                                                           references, amount,
                                                           payment method,
                                                           description, amount
                                                           in words, signature
  ----------------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Global Modeling Principles

The documents should **not** be modeled as one giant flat object. They
are different document types with shared entities.

Recommended core entities:

``` text
Company
Party / Customer / Supplier
Shipment
Vessel
Voyage
Port
CargoItem
BillOfLading
Manifest
Invoice
InvoiceLine
ProformaInvoice
ProformaInvoiceLine
Quotation
QuotationLine
LedgerAccount
LedgerEntry
ReceiptVoucher
DocumentAttachment
DocumentApproval
```

A single real shipment may connect several documents:

``` text
Shipment
  ├── Bill of Lading
  ├── Manifest
  │     ├── Manifest Cargo Item 1
  │     ├── Manifest Cargo Item 2
  │     └── ...
  ├── Tax Invoice
  ├── Proforma Invoice
  └── Quotation

Accounting side:
  ├── Ledger Entries
  └── Receipt Vouchers
```

Do not assume that every number appearing in one document is the same
type of identifier. Examples include:

-   B/L number: `KHS/26-110`
-   Manifest number: `DSMAN/KHO-26-006`
-   Invoice number: `DSINV/26-172`
-   Proforma number: `DSPRO/26-001`
-   Quotation number: `DSQUO/25-017`
-   Ledger voucher number: e.g. `1380`, `2026/446`, `1517`
-   Receipt voucher number: `477`

------------------------------------------------------------------------

# 3. BILL OF LADING (B/L)

## 3.1 Purpose

The first page is a **BILL OF LADING**. It is a transport document
describing one shipment/cargo record and the parties and voyage
involved.

The sample B/L is for B/L number `KHS/26-110`.

Source example: - Shipper: `RAS AL KHAIMAH MACHINERIES LLC` - Consignee:
`JOINT MECHANIC CO` - Destination agent:
`BADBAN ARVAND ROOD SHIPPING CO` - Vessel: `MEHDI 11` - Voyage:
`02/26` - Loading port: `HAMRIYA PORT, DUBAI, UAE` - Discharge port:
`KHORRAM SHAHR, PERSIAN GULF, IRAN` - Cargo: one used Komatsu D155A
bulldozer - Gross weight: `42,000 KGS` - Freight: `FREIGHT PREPAID` -
Issue place: `DUBAI` - Issue date: `29-AUG-26` - Originals: `1`

These fields and values are visible in the first page of the source.
fileciteturn0file0L2-L59

------------------------------------------------------------------------

## 3.2 B/L Header

### Document title

``` text
BILL OF LADING
```

### Shipper block

Fields:

``` yaml
shipper:
  name: "RAS AL KHAIMAH MACHINERIES LLC"
  location: "DUBAI, UAE"
  address: "AL NOKHITHA BUILDING, HAMRIYA PORT, DUBAI, UAE"
  contact_phone: "+97142527707"
  mobile_numbers:
    - "+971503003596"
    - "+971506445868"
  emails:
    - "info@dunashipping.com"
    - "dunashipping@yahoo.com"
  website: "www.dunashipping.com"
```

The source visually places the company/contact information in the upper
area of the B/L. Some contact/address data is visually associated with
the document issuer/agent block rather than being semantically part of
the shipper identity. For implementation, keep `party` data separate
from `document_issuer/contact`.

### B/L number

``` yaml
bl_number: "KHS/26-110"
```

This is the primary identifier for this B/L.

### Consignee

``` yaml
consignee:
  name: "JOINT MECHANIC CO"
  national_id: "10100670462"
```

### Notify party

``` yaml
notify_party:
  name: "SAME AS CONSIGNEE"
```

This means the notify party is not a separate party in this sample.

### Destination agent

``` yaml
destination_agent:
  name: "BADBAN ARVAND ROOD SHIPPING CO"
  city_country: "KHORRAM SHAHR, IRAN"
  contact: "+98 9365855027"
  email: "a.mahmoodiani_bar@yahoo.com"
```

------------------------------------------------------------------------

## 3.3 Voyage / Routing

``` yaml
vessel:
  name: "MEHDI 11"

voyage:
  number: "02/26"

port_of_loading:
  name: "HAMRIYA PORT, DUBAI, UAE"

port_of_discharge:
  name: "KHORRAM SHAHR, PERSIAN GULF, IRAN"
```

The source also contains the company contact block around the
voyage/port area. fileciteturn0file0L22-L29

------------------------------------------------------------------------

## 3.4 B/L Cargo Table

The cargo table has these conceptual columns:

``` text
MARKS & NUMBERS
QTY
DESCRIPTION OF GOODS
GROSS WEIGHT (KGS)
MESUREMENT (CBM)
```

The sample cargo is:

``` yaml
quantity: 1
unit: "UNIT"
description:
  - "USED KOMATSU D155A BULLDOZER"
  - "CH.NO: KMT0D105EMC088308"
  - "(ON DECK)"
gross_weight_kg: 42000
measurement_cbm: null
```

Important: `CH.NO` is a chassis/serial-like equipment identifier and
should be stored separately from the free-text description when
possible.

The source explicitly shows the cargo description, chassis number,
on-deck notation and 42,000 kg weight. fileciteturn0file0L30-L42

------------------------------------------------------------------------

## 3.5 B/L Totals

``` yaml
total_packages_units:
  quantity: 1
  unit: "UNIT"

total_gross_weight_kg: 42000
```

------------------------------------------------------------------------

## 3.6 B/L Legal / Carriage Clause

The lower body contains a long standard carriage declaration beginning
with:

``` text
SHIPPED on board on apparent good order and condition...
```

The clause states, among other things, that: - weight, measure, marks,
numbers, quality, contents and value are accepted as unknown; - cargo is
carried to the port of discharge or as near as the vessel can safely
reach; - consignee receives the cargo subject to freight and other
applicable charges; - the merchant accepts the B/L stipulations; - one
original B/L must be surrendered for goods/delivery order; - the master
signs the stated number of originals.

This should be represented as a configurable `legal_text` /
`terms_and_conditions` field rather than hard-coded into application
logic. The complete sample clause is visible on the B/L.
fileciteturn0file0L43-L49

------------------------------------------------------------------------

## 3.7 B/L Issue / Freight Block

``` yaml
place_of_bl_issue: "DUBAI"
date_of_bl_issue: "29-AUG-26"
freight_charge: "FREIGHT PREPAID"
number_of_original_bl: 1
```

The bottom-right visual area contains:

``` text
STAMP & SIGNATURE
AS AGENT
```

For a digital system:

``` yaml
stamp:
  type: "company_stamp"
  placeholder: true

signature:
  type: "authorized_agent_signature"
  placeholder: true
```

Do not treat the visual stamp itself as business text. Store it as an
image/signature attachment or placeholder.

------------------------------------------------------------------------

# 4. MANIFEST

## 4.1 Purpose

Pages 2, 3 and 4 are **one manifest**, not three separate manifests.

Manifest identifier:

``` yaml
manifest_number: "DSMAN/KHO-26-006"
date: "05-Sep-26"
voyage: "02/26"
barge: "MEHDI 11"
tug: "LAYAN GULF"
port_of_loading: "HAMRIYA, DUBAI, UAE"
port_of_discharge: "KHORRAM SHAHR, PERSIAN GULF, IRAN"
```

The same manifest header is repeated on each page because the cargo
table continues across pages. fileciteturn0file0L61-L65

------------------------------------------------------------------------

## 4.2 Manifest Table Schema

The main columns are:

``` text
#
BL
DESCRIPTION OF GOODS
CONSIGNEE
SHIPPER
UNIT/PKGS
GROSS WEIGHT (KGS)
```

Each row is a cargo/manifest item linked to a B/L number.

Recommended normalized model:

``` yaml
manifest_item:
  sequence_no: integer
  bl_number: string
  description: string
  serial_or_chassis_no: string|null
  type: string|null
  capacity: string|null
  tariff_no: string|null
  hs_code: string|null
  consignee: string
  shipper: string
  unit_or_packages: number
  gross_weight_kg: number
```

Do not force every row to have `type`, `capacity`, `HS code`, or serial
number. Different cargo rows contain different subsets of these fields.

------------------------------------------------------------------------

# 5. MANIFEST SAMPLE DATA --- ROWS 1--14

The following records preserve the visible sample data.

### Row 1

``` yaml
sequence: 1
bl_number: "KHS/26-110"
description: "USED KOMATSU D155A-6 BULLDOZER"
chassis_no: "KMT0D105EMC088308"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 2

``` yaml
sequence: 2
bl_number: "KHS/26-111"
description: "USED KOMATSU D155-6 BULLDOZER"
chassis_no: "KMT0D105CNC088926"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 3

``` yaml
sequence: 3
bl_number: "KHS/26-112"
description: "USED KOMATSU D155-6 BULLDOZER"
chassis_no: "KMT0D105ANC088919"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 4

``` yaml
sequence: 4
bl_number: "KHS/26-113"
description: "USED KOMATSU D155-6 BULLDOZER"
chassis_no: "KMT0D105HMC088498"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 5

``` yaml
sequence: 5
bl_number: "KHS/26-114"
description: "USED KOMATSU WA470 WHEEL LOADER"
chassis_no: "KMTWA114CRA015704"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 23000
```

### Row 6

``` yaml
sequence: 6
bl_number: "KHS/26-115"
description: "USED KOMATSU WA380-6 WHEEL LOADER"
chassis_no: "KMTWA095HSA070060"
consignee: "JOINT MECHANIC CO"
shipper: "GALADARI TRUCKS & HEAVY EQUIPMENTS CO"
units_packages: 1
gross_weight_kg: 17000
```

### Row 7

``` yaml
sequence: 7
bl_number: "KHS/26-116"
description: "USED KOMATSU D155A-2 BULLDOZER"
chassis_no: "KMT0D038P02072324"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 38000
```

### Row 8

``` yaml
sequence: 8
bl_number: "KHS/26-117"
description: "USED KOMATSU D155A-2 BULLDOZER"
chassis_no: "KMT0D038A02072735"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 38000
```

### Row 9

``` yaml
sequence: 9
bl_number: "KHS/26-118"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019T01024398"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 10

``` yaml
sequence: 10
bl_number: "KHS/26-119"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019C01025413"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 11

``` yaml
sequence: 11
bl_number: "KHS/26-120"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019K01025585"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 12

``` yaml
sequence: 12
bl_number: "KHS/26-121"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019C01025436"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 13

``` yaml
sequence: 13
bl_number: "KHS/26-122"
description: "ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)"
chassis_no: "K354-B00179"
type: "NK400-E"
capacity: "40 TONS"
tariff_no: "87051010"
consignee: "BANDAR RAHE CASPIAN CO"
shipper: "GRAND CRANE TRADING LLC"
units_packages: 1
gross_weight_kg: 38000
```

### Row 14

``` yaml
sequence: 14
bl_number: "KHS/26-123"
description: "ONE UNIT OF USED TEREX DEMAG ALL TERRAIN CRANE (TWO CABINS) + 5 PKGS"
chassis_no: "WMG5312604Z000059"
type: "AC200-1"
capacity: "200 TONS"
tariff_no: "87051010"
consignee: "SEDAGHAT TEJARAT ARVANDAN COMPANY"
shipper: "GRAND CRANE TRADING LLC"
units_packages: 6
gross_weight_kg: 75000
```

Rows 1--14 appear across the first manifest pages.
fileciteturn0file0L68-L113

------------------------------------------------------------------------

# 6. MANIFEST SAMPLE DATA --- ROWS 15--30

### Row 15

``` yaml
sequence: 15
bl_number: "KHS/26-124"
description: "ONE UNIT OF USED FORKLIFT KOMATSU"
ch_no: "M180-2337"
type: "FD200-7"
capacity: "20 TONS"
tariff_no: "84272012"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 1
gross_weight_kg: 29600
```

### Row 16

``` yaml
sequence: 16
bl_number: "KHS/26-125"
description: "ONE UNIT OF USED FORKLIFT KOMATSU"
ch_no: "M156-5736"
type: "FD100-7"
capacity: "10 TONS"
tariff_no: "84272012"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 1
gross_weight_kg: 16460
```

### Row 17

``` yaml
sequence: 17
bl_number: "KHS/26-126"
description: "ONE UNIT OF USED FORKLIFT KOMATSU"
ch_no: "M247-8352"
type: "FD150E-8"
capacity: "15 TONS"
tariff_no: "84272012"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 1
gross_weight_kg: 18600
```

### Row 18

``` yaml
sequence: 18
bl_number: "KHS/26-127"
description: "ONE UNIT OF USED KATO ROUGH TERRAIN CRANE (ONE CABIN) + 2 PKGS"
ch_no: "KR512-1279"
type: "KR50H"
capacity: "50 TONS"
tariff_no: "84264100"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 3
gross_weight_kg: 38500
```

### Row 19

``` yaml
sequence: 19
bl_number: "KHS/26-128"
description: "USED WIRTGEN TCM TEXTURE CURING MACHINE FOR CONCRETE PAVEMENT"
ch_no: "02BA090C120180017"
hs_code: "84791029"
consignee: "KANDOVAN PARS CONSTRUCTION CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 10000
```

### Row 20

``` yaml
sequence: 20
bl_number: "KHS/26-129"
description: "USED WIRTGEN SP BETON PAVER + 38 PKGS"
ch_no: "05SP090119530034"
hs_code: "84791029"
consignee: "KANDOVAN PARS CONSTRUCTION CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 39
gross_weight_kg: 38000
```

### Row 21

``` yaml
sequence: 21
bl_number: "KHS/26-130"
description: "USED WIRTGEN W200 ASPHALT PLANER"
ch_no: "0620140072860545"
hs_code: "84791090"
consignee: "MR. JALAL AMIRI SHAKIBA"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 29000
```

### Row 22

``` yaml
sequence: 22
bl_number: "KHS/26-131"
description: "ONE UNIT OF USED TADANO ROUGH TERRAIN CRANE (ONE CABIN)"
ch_no: "TR351-0112"
type: "TR350M"
capacity: "35 TONS"
tariff_no: "84264100"
consignee: "MR. SHAHROKH SHAHVARAEI"
shipper: "GRAND CRANE TRADING LLC"
units_packages: 1
gross_weight_kg: 32000
```

### Row 23

``` yaml
sequence: 23
bl_number: "KHS/26-132"
description: "USED KOMATSU PC450-8 EXCAVATOR"
ch_no: "KMTPC192CGSCZ1093"
consignee: "KARIZ SHAHR MINES COMPANY (KASHCO)"
shipper: "ROSE MINE GENERAL TRADING LLC"
units_packages: 1
gross_weight_kg: 45000
```

### Row 24

``` yaml
sequence: 24
bl_number: "KHS/26-133"
description: "BRAND NEW MITSUBISHI OUTLANDER CAR"
ch_no: "JE4M4W186TZ713097"
consignee: "MR. IMAN BAYMANI NEZHAD"
shipper: "NEW AUTO FZCO"
units_packages: 1
gross_weight_kg: 1690
```

### Row 25

``` yaml
sequence: 25
bl_number: "KHS/26-134"
description: "BRAND NEW MITSUBISHI OUTLANDER CAR"
ch_no: "JE4MW182TZ713095"
consignee: "MR. SEYED ALI MOHAMMAD POUR"
shipper: "NEW AUTO FZCO"
units_packages: 1
gross_weight_kg: 1690
```

### Row 26

``` yaml
sequence: 26
bl_number: "KHS/26-135"
description: "USED KOMATSU PC400-8R EXCAVATOR"
ch_no: "KMTPC192PRMBK0526"
consignee: "KARIZ SHAHR MINES COMPANY (KASHCO)"
shipper: "ROSE MINE GENERAL TRADING LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 27

``` yaml
sequence: 27
bl_number: "KHS/26-136"
description: "USED TADANO TR350 CRANE"
ch_no: "T0010013"
consignee: "KEYHAN TEJARAT MEHVAR ARVAND CO"
shipper: "MARINO USED HEAVY EQUIPMENT AND MACHINERY TRADING LLC"
units_packages: 1
gross_weight_kg: 30000
```

### Row 28

``` yaml
sequence: 28
bl_number: "KHS/26-137"
description: "NOV HYDRA RIG TRUCK MOUNTED NITROGEN PUMPING UNIT"
serial_no: "2H9NC3FA15C070159"
hs_code: "84135090"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 74750
```

### Row 29

``` yaml
sequence: 29
bl_number: "KHS/26-138"
description: "UNUSED CATERPILLAR 3412 GENERATOR + 4 PKGS"
serial_no: "CAT00000JRTY04568"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 5
gross_weight_kg: 15000
```

### Row 30

``` yaml
sequence: 30
bl_number: "KHS/26-138"
description: "UNUSED CATERPILLAR 3412 GENERATOR"
serial_no: "CAT00000VRTY04573"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 15000
```

These records are shown on manifest pages 3 and the beginning of page 4.
fileciteturn0file0L136-L201

**Important implementation detail:** B/L number `KHS/26-138` appears on
multiple manifest rows. Therefore `BL number` is not necessarily a
unique cargo-row identifier. A manifest must support multiple line items
belonging to one B/L.

------------------------------------------------------------------------

# 7. MANIFEST SAMPLE DATA --- ROWS 31--45

### Row 31

``` yaml
sequence: 31
bl_number: "KHS/26-139"
description: "CUMMINS 300 KVA GENERATOR"
serial_no: "0022"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 32

``` yaml
sequence: 32
bl_number: "KHS/26-139"
description: "CAT 3508 ENGINE"
serial_no: "0376"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 5000
```

### Row 33

``` yaml
sequence: 33
bl_number: "KHS/26-139"
description: "CUMMINS QSK60 ENGINE"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 5000
```

### Row 34

``` yaml
sequence: 34
bl_number: "KHS/26-139"
description: "LEROY ALTERNATOR ENGINE"
serial_no: "1364"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 35

``` yaml
sequence: 35
bl_number: "KHS/26-139"
description: "PEKINS 200 KVA GENERATOR"
serial_no: "2200"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 36

``` yaml
sequence: 36
bl_number: "KHS/26-139"
description: "CUMMINS 200 KVA GENERATOR"
serial_no: "0017"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 37

``` yaml
sequence: 37
bl_number: "KHS/26-139"
description: "ATLAS COPCO GA132 ELECTRIC AIR COMPRESSOR"
serial_no: "9527"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 3000
```

### Row 38

``` yaml
sequence: 38
bl_number: "KHS/26-139"
description: "PALLETS INCLUDING 24 PCS NTN BALL BEARING"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 6
gross_weight_kg: 1500
```

### Row 39

``` yaml
sequence: 39
bl_number: "KHS/26-139"
description: "PCS UNUSED ELECTRODE AND WIRES"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 12
gross_weight_kg: 8000
```

### Row 40

``` yaml
sequence: 40
bl_number: "KHS/26-139"
description: "PALLET INCLUDING 8 PCS AIR HOSE"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 500
```

### Row 41

``` yaml
sequence: 41
bl_number: "KHS/26-139"
description: "PALLET INCLUDING 8 PCS CONVEYANCING HOSE AND REDUCER HOSE"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 100
```

### Row 42

``` yaml
sequence: 42
bl_number: "KHS/26-139"
description: "WOODEN BOX INCLUDING CLAMP COUPLING, CLEARING BALL, VBALL VALVE,"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 150
```

### Row 43

``` yaml
sequence: 43
bl_number: "KHS/26-139"
description: "WOODEN BOX INCLUDING PUMP(HUSKY 3300P)"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 2
gross_weight_kg: 106
```

### Row 44

``` yaml
sequence: 44
bl_number: "NES260900266"
description: "1 UNIT KOMATSU WA380-6 WHEEL LOADER"
ch_no: "KMTWA095TTA070114"
consignee: "NIKAN SERAJ ARJANR ARVAND"
shipper: "ALDA CONSTRUCTION EQUIPMENT & MACHINERY TRADING LLC"
units_packages: 1
gross_weight_kg: 17520
```

### Row 45

``` yaml
sequence: 45
bl_number: "NES260900267"
description: "1 UNIT KOMATSU WA380-6 WHEEL LOADER"
ch_no: "KMTWA095PTA070115"
consignee: "NIKAN SERAJ ARJANR ARVAND"
shipper: "ALDA CONSTRUCTION EQUIPMENT & MACHINERY TRADING LLC"
units_packages: 1
gross_weight_kg: 17520
```

The final manifest rows and total are visible on page 4.
fileciteturn0file0L217-L238

------------------------------------------------------------------------

## 7.1 Manifest Totals

The document prints:

``` text
TOTAL 32 UNITS AND 79 PKGS
111 991,886
```

The exact visual arrangement suggests: - total cargo quantity:
`32 UNITS AND 79 PKGS` - total line count / item count: `111` - total
gross weight: `991,886` kg

Because the PDF extraction compresses the table footer, the application
should store totals as explicit typed fields rather than relying on text
positioning.

------------------------------------------------------------------------

## 7.2 Manifest Pagination

The three pages are one logical document.

Recommended implementation:

``` yaml
manifest:
  id: ...
  manifest_number: "DSMAN/KHO-26-006"
  pages:
    - page_number: 1
      items: [...]
    - page_number: 2
      items: [...]
    - page_number: 3
      items: [...]
```

However, the database should normally store one manifest and many items.
Page numbers should be generated during PDF rendering, not treated as
separate database documents.

------------------------------------------------------------------------

# 8. TAX INVOICE

## 8.1 Purpose

Page 5 is a **TAX INVOICE** for shipping-related charges.

Visible header fields include:

``` yaml
document_type: "TAX INVOICE"
invoice_number: "DSINV/26-172"
date: "6-Aug-26"
customer: "MR. SHAHOKH SHAHVARAEI"
boe_dec_bl: "KHS/26-108"
manifest_number: "DSKHS-26-005"
vessel: "DAHAR 10"
voyage: "02/26"
loading_port: "HAMRIYA"
discharge_port: "KHORRAM SHAHR"
currency: "AED"
```

The source also has fields labelled `BILL TO`, `TRN/ID`, `Address`,
`E-mail`, `Contact`, `Customer ID`, `Currency`, and `TRN No.`. Some are
blank in the sample. fileciteturn0file0L240-L268

------------------------------------------------------------------------

## 8.2 Tax Invoice Customer Block

Conceptual schema:

``` yaml
bill_to:
  name: "MR. SHAHOKH SHAHVARAEI"
  trn_id: null
  address: null
  email: null
  contact: null
  customer_id: null
  trn_no: null
```

Do not remove empty fields from the schema. They are legitimate document
fields even when the sample does not populate them.

------------------------------------------------------------------------

## 8.3 Tax Invoice Shipment Reference Block

``` yaml
shipment_reference:
  boe_dec_bl: "KHS/26-108"
  manifest_number: "DSKHS-26-005"
  vessel: "DAHAR 10"
  voyage: "02/26"
  loading_port: "HAMRIYA"
  discharge_port: "KHORRAM SHAHR"
```

------------------------------------------------------------------------

## 8.4 Tax Invoice Cargo Description

``` yaml
goods:
  description: "USED TRUCK CRANE + 1 PKG"
  chassis_no: "KG54W00127"
  hs_code: "87051010"
```

Source shows this description block on page 5.
fileciteturn0file0L270-L279

------------------------------------------------------------------------

## 8.5 Tax Invoice Charge Lines

Visible charge lines:

  ----------------------------------------------------------------------------------
  \#       Description             Qty  Unit Price      VAT % VAT Amount      Amount
                                               AED                       
  -------- ---------------- ---------- ----------- ---------- ---------- -----------
  1        FREIGHT CHARGE            1   22,020.00          0       0.00   22,020.00

  2        STORAGE CHARGE            1      650.00          0       0.00      650.00

  3        CUSTOMS                   1      200.00          0       0.00      200.00
           DOCUMENTATION                                                 

  4        TRANSPORTATION            1    4,500.00          0       0.00    4,500.00
           CHARGE FROM                                                   
           JEBEL ALI TO                                                  
           HAMRIYA                                                       
  ----------------------------------------------------------------------------------

The extracted PDF text places the lines in a non-linear order because of
table positioning, but the rendered page shows the four charge concepts
and the final total of AED 27,370.00.

Recommended data model:

``` yaml
invoice_lines:
  - line_no: 1
    description: "FREIGHT CHARGE"
    quantity: 1
    unit_price: 22020.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 22020.00

  - line_no: 2
    description: "STORAGE CHARGE"
    quantity: 1
    unit_price: 650.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 650.00

  - line_no: 3
    description: "CUSTOMS DOCUMENTATION"
    quantity: 1
    unit_price: 200.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 200.00

  - line_no: 4
    description: "TRANSPORTATION CHARGE FROM JEBEL ALI TO HAMRIYA"
    quantity: 1
    unit_price: 4500.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 4500.00
```

Totals:

``` yaml
subtotal: 27370.00
vat: 0.00
total_amount: 27370.00
currency: "AED"
```

The page also contains the note:

``` text
If any discrepancy is noticed in the invoice, kindly inform us in writing within 7 days; otherwise the above amount will be considered as correct.
```

Keep this as configurable invoice footer/legal text, not application
logic. fileciteturn0file0L256-L262

------------------------------------------------------------------------

## 8.6 Tax Invoice Signature

The document has:

``` text
Authorised Signatory
```

This should be an approval/signature placeholder.

------------------------------------------------------------------------

# 9. PROFORMA INVOICE

## 9.1 Purpose

Page 6 is a **PROFORMA INVOICE**. It is structurally more detailed than
the tax invoice because it describes seller/buyer, trade terms,
origin/destination and individual goods.

------------------------------------------------------------------------

## 9.2 Seller

``` yaml
seller:
  name: "DUNA SHIPPING LLC"
  address: "OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE"
  po_box: "63088"
  telephone: "0097142527707"
  mobile: "00971506445868"
  email: "info@dunashipping.com"
```

------------------------------------------------------------------------

## 9.3 Proforma Identification

``` yaml
proforma_invoice_number: "DSPRO/26-001"
proforma_invoice_date: "22-AUG-26"
validity: "1 MONTH"
country_of_beneficiary: "UAE"
```

------------------------------------------------------------------------

## 9.4 Buyer

``` yaml
buyer:
  name: "MR. RAMIN AHMADABADI"
```

------------------------------------------------------------------------

## 9.5 Trade / Commercial Information

``` yaml
country_of_origin: "INDIA"
terms_of_delivery: "FOB"
terms_of_payment: "100% ADVANCE PAYMENT"
transaction_currency: "AED"

freight_forwarder:
  name: "DUNA SHIPPING LLC"
  address: "DUBAI, UAE"

partial_shipment_allowed: true

port_of_discharge:
  name: "BANDAR ABBAS, PERSIAN GULF, IRAN"

final_delivery_place: "MAKU FREE ZONE"
```

These fields are visible in the proforma page.
fileciteturn0file0L281-L307

------------------------------------------------------------------------

# 10. PROFORMA INVOICE CARGO TABLE

## 10.1 Columns

The visible table conceptually contains:

``` text
No
Description
QTY
Net Wt (KGS)
G.Wt (KGS)
T.G Wt (KGS)
Unit Price (AED)
Amount (AED)
```

The extraction shows the quantity and weight columns spatially
separated, so the data model should keep each numeric value in a named
field rather than attempting to reconstruct columns from raw PDF text.

------------------------------------------------------------------------

## 10.2 Cargo Line 1

``` yaml
line_no: 1
description: "BRAND NEW HYUNDAI R340L EXCAVATOR"
year_made: 2026
quantity: 1
net_weight_kg: 9
gross_weight_kg: 9
total_gross_weight_kg: 9
unit_price_aed: 520000.00
amount_aed: 520000.00
```

## 10.3 Cargo Line 2

``` yaml
line_no: 2
description: "BRAND NEW HYDRAULIC BREAKER"
quantity: 1
net_weight_kg: 1000
gross_weight_kg: 1000
total_gross_weight_kg: 1000
unit_price_aed: 125000.00
amount_aed: 125000.00
```

## 10.4 Cargo Line 3

``` yaml
line_no: 3
description: "BRAND NEW QUICK QOUPLER"
quantity: 1
net_weight_kg: 1000
gross_weight_kg: 1000
total_gross_weight_kg: 1000
unit_price_aed: 45000.00
amount_aed: 45000.00
```

The source displays these three cargo descriptions and corresponding
quantities, weights and AED prices. fileciteturn0file0L308-L345

------------------------------------------------------------------------

## 10.5 Proforma Totals

``` yaml
subtotal_amount_aed: 690000.00
freight_charges_aed: 0.00
grand_total_aed: 690000.00
```

Source explicitly shows the subtotal, freight charge and grand total.
fileciteturn0file0L346-L351

------------------------------------------------------------------------

## 10.6 Proforma Certification

The bottom contains:

``` text
SEAL AND SIGNATURE:
MOHAMMAD KAZEM JOWKAR
```

and a certification statement that the proforma invoice shows the actual
price of the described goods, that no other proforma invoice has
been/will be issued, and that the particulars are true and correct.
fileciteturn0file0L352-L355

Model:

``` yaml
certification:
  text: "..."
  signer_name: "MOHAMMAD KAZEM JOWKAR"
  seal_placeholder: true
  signature_placeholder: true
```

------------------------------------------------------------------------

# 11. QUOTATION

## 11.1 Purpose

Page 7 is a **QUOTATION**, representing a price offer for
shipping/transport operations.

Header:

``` yaml
document_type: "QUOTATION"
quotation_number: "DSQUO/25-017"
date: "20-NOV-25"
customer:
  name: "MR. SHADMAN MEABADI"
```

Source confirms these fields. fileciteturn0file0L357-L364

------------------------------------------------------------------------

## 11.2 Quotation Introduction

The quotation contains a polite introductory text:

``` text
Dear Sir/ Madam

Thank you for your enquiry. We are pleased to enclose the applicable charges about 1 UNIT USED VOLVO FINISHER (as per packing list) for your consideration.

Kindly note that we are able to provide the following operations and rate.
```

This is not merely decoration: it communicates the commercial purpose
and cargo context. It should be modeled as editable template content if
quotations are generated by software.

------------------------------------------------------------------------

## 11.3 Quotation Table

Columns:

``` text
#
DESCRIPTION
YEAR
QTY
UNIT PRICE (AED)
AMOUNT (AED)
```

Sample lines:

### Line 1

``` yaml
line_no: 1
description: "LAND TRANSPORT CHARGE FROM DESIGNATED SHOWROOM TO DUBAI HAMRIYA PORT"
year: null
quantity: 1
unit_price_aed: 700.00
amount_aed: 700.00
```

### Line 2

``` yaml
line_no: 2
description: "FREIGHT CHARGE FROM HAMRIYA TO BUSHEHR"
year: null
quantity: 1
unit_price_aed: 6500.00
amount_aed: 6500.00
```

### Line 3

``` yaml
line_no: 3
description: "DOCUMENTATION AND EXIT CHARGE"
year: null
quantity: 1
unit_price_aed: 500.00
amount_aed: 500.00
```

Source shows the three service lines and their amounts.
fileciteturn0file0L366-L377

------------------------------------------------------------------------

## 11.4 Quotation Totals

``` yaml
subtotal_aed: 7700.00
other_charges_aed: 0.00
grand_total_aed: 7700.00
currency: "AED"
```

The document closes with:

``` text
FOR DUNA SHIPPING LLC
```

and a company stamp placeholder.

------------------------------------------------------------------------

# 12. LEDGER ACCOUNT

## 12.1 Purpose

Page 8 is a **Ledger Account** statement from:

``` text
RUKN ALHMREYA TRANSPORTL.L.C
AL NOKITA CUSTOMS BUILDING
DUBAI
Emirate : Dubai
TRN : 104652986100003

DUNA SHIPPING
Ledger Account
```

Period:

``` text
1-Jul-26 to 7-Sep-26
```

The account statement and date range are visible in the source.
fileciteturn0file0L381-L390

------------------------------------------------------------------------

## 12.2 Ledger Columns

``` text
Date
Particulars
Vch Type
Vch No.
Debit
Credit
Balance
```

Recommended schema:

``` yaml
ledger_entry:
  date: date
  particulars: string
  voucher_type: string
  voucher_number: string
  debit: decimal
  credit: decimal
  balance: decimal
  balance_side: "Dr" | "Cr"
```

------------------------------------------------------------------------

# 13. LEDGER SAMPLE ENTRIES

## Entry 1

``` yaml
date: "4-Jul-26"
particulars: |
  TRAILER & FORKLIFT WORK RECORDED FOR
  LAODING 1 TRAILER
  COUNTERWEIGHT & 4 TYRES IN ZAM ZAM BARGE
voucher_type: "Sales"
voucher_no: "1380"
debit: 115.50
credit: null
balance: 115.50
balance_side: "Dr"
```

## Entry 2

``` yaml
date: "25-Jul-26"
particulars: |
  CASH RECEIVED FROM DUNA SHIPPING AGT INV 1380
voucher_type: "Receipt"
voucher_no: "2026/446"
debit: null
credit: 120.00
balance: 4.50
balance_side: "Cr"
```

## Entry 3

``` yaml
date: "28-Jul-26"
particulars: |
  LOWBED CHARGES FOR SHIFTING 3 TRIP LOWBED
  WITH KOMATSU EXCAVATOR & 3 TRUCK SHIFTING
  TO DAHARA 10 SHIP
voucher_type: "Sales"
voucher_no: "1517"
debit: 1102.50
credit: null
balance: 1098.00
balance_side: "Dr"
```

## Entry 4

``` yaml
date: "30-Jul-26"
particulars: |
  TRAILER CHARGES FOR SHIFTING 2 TRAILER
  HEAVY MACHINERY PKGS - BARGE DAHAR 10
voucher_type: "Sales"
voucher_no: "1526"
debit: 420.00
credit: null
balance: 1518.00
balance_side: "Dr"
```

## Entry 5

``` yaml
date: "6-Aug-26"
particulars: |
  CASH RECEIVED FROM DUNA SHIPPING AGT
  INV 1517, 1526
voucher_type: "Receipt"
voucher_no: "2026/477"
debit: null
credit: 1600.00
balance: 82.00
balance_side: "Cr"
```

## Entry 6

``` yaml
date: "2-Sep-26"
particulars: |
  LOWBED CHARGES FOR SHIFTING 6 KOMATSU EXCAVATOR
  & 2 PC EXCAVATOR FROM A09 YRD TO KHORAMSHAHR 1051
voucher_type: "Sales"
voucher_no: "1703"
debit: 2100.00
credit: null
balance: 2018.00
balance_side: "Dr"
```

## Entry 7

``` yaml
date: "3-Sep-26"
particulars: |
  TRAILER & FORKLIFT CHARGES FOR LOADING & SHIFTING
  CARGO TO KHORAMSHAHR BARGE
voucher_type: "Sales"
voucher_no: "1708"
debit: 630.00
credit: null
balance: 2648.00
balance_side: "Dr"
```

## Entry 8

``` yaml
date: "4-Sep-26"
particulars: |
  TRAILER CHARGES FOR SHIFITNG 3 TRAILER PKGS
  ON KHORAMSHHAHR BARGE 1051 & 1 TRAILER
  MACHINERY LOAD ON MEHDI 11
voucher_type: "Sales"
voucher_no: "1717"
debit: 535.50
credit: null
balance: 3183.50
balance_side: "Dr"
```

## Entry 9

``` yaml
date: "7-Sep-26"
particulars: |
  CASH RECEIVED FROM DUNA SHIPPING
voucher_type: "Receipt"
voucher_no: "2026/532"
debit: null
credit: 2500.00
balance: 683.50
balance_side: "Dr"
```

The complete ledger sequence and closing balance are visible in the
source. fileciteturn0file0L391-L444

------------------------------------------------------------------------

## 13.1 Ledger Totals

The statement footer shows:

``` yaml
total_debit: 4903.50
total_credit: 4220.00
closing_balance: 683.50
closing_balance_side: "Dr"
```

The arithmetic relationship is:

``` text
4,903.50 - 4,220.00 = 683.50
```

------------------------------------------------------------------------

# 14. RECEIPT VOUCHER

## 14.1 Important PDF Detail

The last page is an **image-based receipt voucher** and did not expose
normal text in the PDF text layer. The rendered page shows a receipt
voucher from:

``` text
RUKN ALHMREYA TRANSPORTL.L.C
AL NOKITA CUSTOMS BUILDING
DUBAI
Emirate: Dubai
```

This page should therefore be treated as a separate document type and
not assumed to be missing merely because ordinary text extraction
returns no text.

------------------------------------------------------------------------

## 14.2 Voucher Header

Visible concepts:

``` yaml
document_type: "Receipt Voucher"
voucher_number: "477"
date: "6-Aug-26"
```

The page title area visually reads `Receipt 2026 Voucher`.

------------------------------------------------------------------------

## 14.3 Account and Amount

``` yaml
account: "DUNA SHIPPING"
amount: 1600.00
currency: "AED"
```

The amount appears as:

``` text
AED 1,600.00
```

------------------------------------------------------------------------

## 14.4 Applied References

The voucher breaks the receipt into references:

``` yaml
applications:
  - reference: "1517"
    amount: 1102.50
    side: "Cr"

  - reference: "1526"
    amount: 420.00
    side: "Cr"

  - reference: "477"
    label: "Advance"
    amount: 77.50
    side: "Cr"
```

Total:

``` text
1102.50 + 420.00 + 77.50 = 1600.00
```

This relationship is important for accounting software: a receipt can be
allocated across multiple invoices/vouchers plus an advance.

------------------------------------------------------------------------

## 14.5 Payment Method

The voucher shows:

``` yaml
through:
  method: "Cash"
```

------------------------------------------------------------------------

## 14.6 On Account Of

The visible description is approximately:

``` text
CASH RECEIVED FROM DUNA SHIPPING AGT
INV 1517, 1526
```

Recommended structured representation:

``` yaml
on_account_of:
  text: "CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526"
  related_references:
    - "1517"
    - "1526"
```

------------------------------------------------------------------------

## 14.7 Amount in Words

The voucher contains:

``` text
DIRHAMS One Thousand Six Hundred Only
```

Recommended field:

``` yaml
amount_in_words: "DIRHAMS One Thousand Six Hundred Only"
```

------------------------------------------------------------------------

## 14.8 Approval

Bottom area contains:

``` text
Authorised Signatory
```

plus a handwritten/signature visual and a stamp.

Model:

``` yaml
approval:
  authorized_signatory_placeholder: true
  signature_image: true
  company_stamp_image: true
```

The actual signature/stamp should be treated as an image attachment or
visual placeholder, not OCR business data.

------------------------------------------------------------------------

# 15. SHARED COMPANY / PARTY DATA

Several documents repeat Duna Shipping information.

A reusable company record should contain:

``` yaml
company:
  name: "DUNA SHIPPING LLC"
  office:
    address: "OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE"
    po_box: "63088"
  telephone: "0097142527707"
  mobile: "00971506445868"
  email: "info@dunashipping.com"
  website: "www.dunashipping.com"
```

Another issuer appears on the ledger/voucher:

``` yaml
company:
  name: "RUKN ALHMREYA TRANSPORTL.L.C"
  address: "AL NOKITA CUSTOMS BUILDING, DUBAI"
  emirate: "Dubai"
  trn: "104652986100003"
```

Do not merge these into one company record merely because they appear in
the same PDF.

------------------------------------------------------------------------

# 16. FIELD TYPES AND NORMALIZATION

For a robust ERP, use typed fields.

## Identifiers

Use `string`, not integer:

``` text
KHS/26-110
DSMAN/KHO-26-006
DSINV/26-172
DSPRO/26-001
DSQUO/25-017
NES260900266
```

Identifiers can contain letters, `/`, `-`, and leading zeros.

## Money

Use fixed decimal numeric types:

``` text
DECIMAL(18,2)
```

Examples:

``` text
22020.00
4500.00
27370.00
690000.00
7700.00
```

Never store monetary values as display-formatted strings.

## Weight

Use decimal:

``` text
DECIMAL(18,3)
```

with explicit unit:

``` text
kg
```

## Quantity

Use decimal or integer depending on business requirements because
packages may be non-integer in future systems, although all sample
quantities are whole numbers.

## Dates

Store actual date values and render them in document-specific formats:

``` text
2026-08-29 -> 29-AUG-26
2026-09-05 -> 05-Sep-26
```

Do not store the formatted string as the primary date.

------------------------------------------------------------------------

# 17. CARGO DESCRIPTION PARSING

Cargo descriptions in the source are semi-structured.

Examples:

``` text
USED KOMATSU D155A-6 BULLDOZER
CH.NO: KMT0D105EMC088308

ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)
CH.NO: K354-B00179
TYPE: NK400-E
CAPACITY: 40 TONS
TARIFF NO: 87051010
```

Therefore, a good internal representation is:

``` yaml
cargo:
  condition: "USED"
  brand: "KOMATSU"
  model: "D155A-6"
  category: "BULLDOZER"
  serial_or_chassis_no: "KMT0D105EMC088308"
  type: null
  capacity_tons: null
  hs_code: null
  tariff_no: null
  free_text_description: "USED KOMATSU D155A-6 BULLDOZER"
```

For the crane:

``` yaml
cargo:
  condition: "USED"
  brand: null
  model: null
  category: "HYDRAULIC TRUCK CRANE"
  cabin_count: 2
  serial_or_chassis_no: "K354-B00179"
  type: "NK400-E"
  capacity_tons: 40
  tariff_no: "87051010"
  free_text_description: "ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)"
```

However, **do not force parsing when the source does not provide enough
information**. Preserve the original description as `raw_description`
even when structured fields are extracted.

------------------------------------------------------------------------

# 18. DOCUMENT RELATIONSHIPS

A useful ERP relationship graph is:

``` text
PARTIES
  ├── Shipper
  ├── Consignee
  ├── Notify Party
  ├── Destination Agent
  ├── Buyer
  └── Seller

SHIPMENT
  ├── Vessel
  ├── Voyage
  ├── Loading Port
  ├── Discharge Port
  └── Cargo

DOCUMENTS
  ├── B/L
  │    └── Cargo
  ├── Manifest
  │    └── Manifest Items -> B/L
  ├── Tax Invoice
  │    ├── Shipment references
  │    └── Charge Lines
  ├── Proforma Invoice
  │    ├── Buyer/Seller
  │    └── Goods Lines
  ├── Quotation
  │    └── Service Lines
  ├── Ledger Entries
  └── Receipt Voucher
       └── Allocations -> Ledger/Invoice/Voucher references
```

------------------------------------------------------------------------

# 19. WHAT SHOULD BE STORED AS DATA VS. VISUAL ASSETS

## Store as real structured data

-   Document number
-   Document date
-   Party names
-   Addresses
-   Contact information
-   Vessel
-   Voyage
-   Loading port
-   Discharge port
-   Cargo descriptions
-   Serial/chassis numbers
-   HS/tariff codes
-   Quantity
-   Packages
-   Gross/net weight
-   Unit price
-   Amount
-   VAT
-   Currency
-   Totals
-   Payment terms
-   Delivery terms
-   Country of origin
-   Final delivery place
-   Invoice references
-   Voucher references
-   Ledger debit/credit
-   Running balance
-   Legal/footer text
-   Amount in words
-   Signatory name

## Store as image/file attachments or placeholders

-   Company logo
-   Round company stamp
-   Handwritten signature
-   Seal/signature graphic
-   Decorative watermark
-   Visual letterhead background

For the implementation, a document can have:

``` yaml
visual_assets:
  - type: "logo"
    required: true
  - type: "stamp"
    required: false
  - type: "signature"
    required: false
  - type: "watermark"
    required: false
```

The system should not depend on OCR text from a stamp or signature.

------------------------------------------------------------------------

# 20. DOCUMENT TEMPLATING RECOMMENDATION

The PDF examples should be treated as **reference templates**, not as
rigid pixel-level requirements.

For example, a B/L can be implemented as:

``` text
Header
  ├── Shipper
  ├── B/L number
  ├── Consignee
  ├── Notify party
  └── Agent

Routing
  ├── Vessel
  ├── Voyage
  ├── Port of loading
  └── Port of discharge

Cargo
  └── Dynamic cargo table

Totals
Legal terms
Issue/freight block
Approval/stamp
```

A manifest:

``` text
Header
Dynamic multi-row cargo table
Automatic pagination
Totals
Stamp/footer
```

A tax invoice:

``` text
Billing party
Invoice metadata
Shipment references
Goods description
Charge lines
Subtotal/VAT/total
Terms note
Signature
```

A proforma invoice:

``` text
Seller / Buyer
Commercial terms
Shipping terms
Goods table
Subtotal/freight/grand total
Certification
Seal/signature
```

A quotation:

``` text
Customer
Introduction
Service-price table
Subtotal
Other charges
Grand total
Company approval
```

A ledger:

``` text
Account header
Period
Transaction table
Running balance
Closing balance
```

A receipt voucher:

``` text
Voucher header
Account
Allocation/reference rows
Payment method
Narrative
Amount in words
Total
Signature/stamp
```

------------------------------------------------------------------------

# 21. IMPORTANT EDGE CASES REVEALED BY THE SAMPLE

## 21.1 One B/L can have multiple manifest rows

`KHS/26-139` is repeated for rows 31--43.

Therefore:

``` text
B/L 1 -> many manifest items
```

not:

``` text
B/L 1 -> exactly one manifest item
```

## 21.2 A manifest can contain multiple package types

Examples include:

``` text
1 unit
+ 5 packages
+ 38 packages
+ 2 packages
```

The application should distinguish:

``` yaml
unit_quantity: 1
package_quantity: 5
```

where needed rather than storing everything as one ambiguous integer.

## 21.3 Cargo identifiers vary

The sample uses:

``` text
CH.NO
CH NO
CH.NO.
CH. NO.
S.NO
```

These should normalize to a common conceptual field such as:

``` text
serial_or_chassis_no
```

while preserving the original label if exact reproduction is required.

## 21.4 HS Code and Tariff No are not always present

Do not require either field on every cargo line.

## 21.5 Some party names contain people and companies

Examples:

``` text
MR. HOJAT NASSIR
MR. JALAL AMIRI SHAKIBA
JOINT MECHANIC CO
DUNA SHIPPING LLC
```

A party model should support both individual and organization names.

## 21.6 Some document fields are intentionally blank

For example, the tax invoice has labels for TRN, address, email, contact
and customer ID, but the sample does not populate all of them.

Blank source fields should remain representable.

------------------------------------------------------------------------

# 22. AI / LLM EXTRACTION CONTRACT

If an AI model receives a document image/PDF, it should extract
according to this rule:

1.  Identify the document type first.
2.  Identify the document number.
3.  Identify header metadata.
4.  Identify parties and roles.
5.  Identify shipment/voyage information.
6.  Identify cargo/service lines.
7.  Preserve exact original text.
8.  Extract structured values where unambiguous.
9.  Preserve unknown/blank values as `null`.
10. Never invent missing information.
11. Keep stamps/signatures/logos as visual assets/placeholders.
12. Keep repeated records as separate line items.
13. Keep references between documents.
14. Preserve original number formatting in a `raw_value` field when
    exact display matters.
15. Preserve page and line-item order where possible.

Recommended extraction shape:

``` yaml
document:
  type: "bill_of_lading"
  document_number: "KHS/26-110"
  date: "2026-08-29"

parties:
  shipper: {...}
  consignee: {...}
  notify_party: {...}
  destination_agent: {...}

shipment:
  vessel: "MEHDI 11"
  voyage: "02/26"
  port_of_loading: "HAMRIYA PORT, DUBAI, UAE"
  port_of_discharge: "KHORRAM SHAHR, PERSIAN GULF, IRAN"

cargo_items:
  - ...

totals:
  ...

terms:
  ...

visual_assets:
  - ...
```

------------------------------------------------------------------------

# 23. EXACT-VALUE PRESERVATION RULE

For financial and identifier fields, a production system should ideally
preserve both normalized and display values:

``` yaml
amount:
  value: 27370.00
  currency: "AED"
  display: "AED 27,370.00"
```

For identifiers:

``` yaml
bl_number:
  value: "KHS/26-110"
  display: "KHS/26-110"
```

For dates:

``` yaml
date:
  iso: "2026-08-29"
  display: "29-AUG-26"
```

This makes it possible to: - search accurately, - calculate
accurately, - regenerate the document, - preserve the source
appearance, - and allow an AI model to understand both meaning and
original presentation.

------------------------------------------------------------------------

# 24. FINAL IMPLEMENTATION CHECKLIST

A system implementing these samples should support:

-   [ ] B/L creation
-   [ ] B/L multiple cargo items
-   [ ] B/L shipper/consignee/notify/agent
-   [ ] B/L vessel/voyage/ports
-   [ ] B/L legal text
-   [ ] B/L freight status
-   [ ] B/L originals count
-   [ ] Manifest creation
-   [ ] Manifest spanning multiple PDF pages
-   [ ] Manifest many-to-one relation to B/L
-   [ ] Manifest serial/chassis numbers
-   [ ] Manifest HS/tariff codes
-   [ ] Manifest units/packages
-   [ ] Manifest total weight
-   [ ] Tax invoice
-   [ ] VAT rate and amount
-   [ ] Tax invoice shipment references
-   [ ] Proforma invoice
-   [ ] Seller/buyer
-   [ ] Country of origin
-   [ ] Delivery/payment terms
-   [ ] Freight and final delivery
-   [ ] Proforma cargo weights and values
-   [ ] Quotation
-   [ ] Quotation service lines
-   [ ] Ledger account
-   [ ] Running balance
-   [ ] Receipt voucher
-   [ ] Receipt allocation across multiple references
-   [ ] Cash/bank payment method
-   [ ] Amount in words
-   [ ] Signatures
-   [ ] Stamps
-   [ ] Logos
-   [ ] Blank optional fields
-   [ ] Original raw text preservation
-   [ ] Structured normalized data
-   [ ] PDF regeneration
-   [ ] AI-readable JSON representation
-   [ ] Document-to-document references

------------------------------------------------------------------------

# 25. Canonical Document Type Names

For software/database use, use stable machine names:

``` text
bill_of_lading
manifest
tax_invoice
proforma_invoice
quotation
ledger_account
receipt_voucher
```

Human-readable labels:

``` text
Bill of Lading
Manifest
Tax Invoice
Proforma Invoice
Quotation
Ledger Account
Receipt Voucher
```

------------------------------------------------------------------------

# 26. Source Fidelity Note

This specification is derived from the supplied PDF. It is intentionally
focused on **what the sample documents actually contain** and how those
fields can be represented in a flexible software model.

Where the source contains a stamp, handwritten signature, logo or
decorative graphic, this document identifies the existence and role of
that visual element rather than attempting to convert it into ordinary
business text.

Where a source field is blank, it is represented as `null`/empty instead
of being invented.

Where PDF text extraction loses table geometry, the semantic table
structure is described explicitly so an implementation or AI model does
not mistake reading order for business-field order.

The objective is that a developer or AI model can use this Markdown as a
reference specification and understand the **document type, field
structure, data relationships, sample values, optional fields, repeated
rows, financial structures, pagination and visual-only elements**
without needing to infer the entire business structure from raw PDF text
alone.

