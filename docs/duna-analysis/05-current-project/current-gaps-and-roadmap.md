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

## 2. The roadmap (`docs/current-plan/09-final-implementation-roadmap.md`)

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

From `docs/current-plan/12-open-business-decisions.md`. **These are the same questions this knowledge
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
