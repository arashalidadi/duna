# Capability Gap Analysis

> For each capability area: **what the employer asked for → what the real documents prove → what the
> legacy system could do → what is therefore missing.**
>
> The "current system" column is deliberately **not** filled in here. Phase 8 assesses the current
> Next.js/NestJS system directly — see
> [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).

---

## 0. Requirement baseline

| Metric | Value |
|---|---|
| Requirement IDs (`REQ-*`) | **127** |
| Sections | 16 |
| EXPLICIT | 120 |
| INFERRED | 2 |
| UNRESOLVED | 3 |
| CONTRADICTED | 2 |

| # | Section | REQs |
|---|---|---|
| 1 | Navigation & information architecture | 4 |
| 2 | Master Data — Customer | 12 |
| 3 | Master Data — Port, Yard, Vessel | 12 |
| 4 | Master Data — Shipper, Consignee, Agent | 7 |
| 5 | Operations — Cargo registration | 12 |
| 6 | Operations — Inspection | 4 |
| 7 | Operations — Load List / Loading | 5 |
| 8 | Bill of Lading | 8 |
| 9 | Manifest | 5 |
| 10 | Output, printing and document templates | 6 |
| 11 | Jobs & job costing | 6 |
| 12 | Invoicing | 15 |
| 13 | Ledger, vouchers, salary | 13 |
| 14 | Release Order, Delivery Order, Agent portal | 9 |
| 15 | Reporting | 6 |
| 16 | Cross-cutting constraints | 3 |

---

## 1. Capability matrix

Legend: ✅ supported · ⚠️ partial / defective · ❌ absent

| # | Capability | REQs | Document evidence | Legacy | Gap |
|---|---|---|---|---|---|
| **1** | Six-section navigation (Overview, Operations, B/L & Manifest, Accounting, Master Data, Access Control) | 001–004 | — | ❌ (flat menu) | New |
| **2** | Customer master, name-only mandatory, auto code | 010–021 | SOA, Invoice | ⚠️ (two creation paths, one unvalidated) | Format unresolved (C-06) |
| **3** | Port master (name/city/country + abbreviation) | 030–036 | All docs | ⚠️ (one string + abbreviation) | Split into 3 fields |
| **4** | Yard master, port-scoped | 035, 036 | SOA narrations | ✅ | — |
| **5** | **Vessel master** (barge + tug) | 037, 038 | Manifest | ❌ (free text; template hard-codes the company name) | New entity |
| **6** | Shipper / Consignee / Agent masters | 044–055 | B/L, Manifest | ✅ | Cleaner separation needed |
| **7** | Cargo registration | 060–070 | Manifest rows | ✅ | Plus comment entity |
| **8** | Cargo **comments visible to accounting** | 065–067 | — | ❌ | New |
| **9** | Inspection: booked, paid, result recorded | 075–082 | — | ⚠️ (a status field only) | New entity |
| **10** | Inspection **hard-gates** the load list | 082 | — | ❌ (no check in code) | New validation |
| **11** | Load List per voyage, editable next day | 083–094 | Legacy print | ✅ | — |
| **12** | Load List uses the port **abbreviation** | 033 | — | ❌ | New |
| **13** | Days-in-port calculation | 070 | — | ⚠️ (present, with a "today" fallback) | Confirm fallback |
| **14** | B/L: draft → revision → final | 100–105 | B/L | ❌ (no draft state) | New |
| **15** | B/L numbering per destination | 102, 103 | `KHS/26-110` | ⚠️ (date-based, random) | Format unresolved (C-01) |
| **16** | **Co-loading / partner B/Ls on one manifest** | 107 | ✅ Proved (`NES260900266/7`) | ❌ | New |
| **17** | Manifest as a consolidation of B/Ls | 110–116 | Manifest | ❌ (**inverted**) | Structural change |
| **18** | Voyage numbering per vessel + destination | 040–042 | `02/26` | ❌ (port + shipper) | New (C-05) |
| **19** | Outputs: PDF / Print / Excel | 120 | — | ❌ (browser print only) | **New capability** |
| **20** | Print **without** stamp; PDF **with** stamp | 121, 122 | — | ❌ | New |
| **21** | Uploadable document templates, 9 types, versioned | 124 | All 7 PDFs | ❌ (global images only) | New |
| **22** | Job / job costing | 130–135 | — | ❌ | New |
| **23** | Invoice with line items, VAT per line | 140–144 | `DSINV/26-172` | ⚠️ (**VAT double-counted**) | Fix arithmetic |
| **24** | Invoice may span several B/Ls | 141 | Invoice refs | ⚠️ (optional single B/L link) | New |
| **25** | Partial payment state | 149 | — | ❌ (PAID/UNPAID only) | New |
| **26** | Ledger / running balance | 160–163 | SOA | ⚠️ (two display bugs) | Fix |
| **27** | Receipt & payment vouchers | 165–168 | Voucher **No. `477`** | ✅ | Add allocation; ID-card on both. *(Corrected 2026-10-11: was `DSR/26-190` — fabricated; see error E1.)* |
| **28** | Payments to a named person | 171, 172 | — | ⚠️ (free-text description) | New |
| **29** | General Journal | 166, 167 | — | ❌ | New |
| **30** | Salary / salary slip | 169, 170 | — | ❌ | New (process undescribed) |
| **31** | Release Order workflow | 180–184 | — | ❌ (**view-only screen**) | New |
| **32** | Delivery Order | 185, 186 | — | ❌ | New (process thin) |
| **33** | **Agent portal, destination-scoped** | 187, 188 | — | ❌ (unscoped customer portal) | New |
| **34** | Voyage P&L report | 190–194 | — | ⚠️ (manifest report exists, wrong keying) | Extend |
| **35** | Alerts (payment overdue, cargo stuck, inspection pending) | 154, 184 | — | ❌ | New |
| **36** | Company Archive | 004 (REQ-004, `EMP-713`) | — | ❌ | Undescribed |
| **37** | Audit trail | — | — | ❌ | New |
| **38** | Notifications | 154 | — | ❌ | New |

---

## 2. Gap classification

### 2.1 Category A — genuinely new capability (nothing to port)
No legacy code, no document evidence, no employer process detail:

| Capability | REQs | Risk |
|---|---|---|
| Job costing | 130–135 | **High** — the employer described cost types but not the lifecycle |
| Salary / payroll | 169, 170 | **High** — almost no employer input |
| General Journal | 166, 167 | Medium |
| Delivery Order | 185, 186 | Medium |
| Release Order workflow | 180–184 | Medium |
| Agent portal | 187, 188 | Medium |
| Alerts / notifications | 154, 184 | Medium |
| Company Archive | 004 | **High** — title only |
| Document templates | 124 | Medium — 7 real specimens available as the design basis |
| Audit trail | — | Low |
| PDF generation | 120 | Low — well-understood technology |

### 2.2 Category B — legacy has something, but it is wrong
The dangerous category: there *is* code, so it looks done, but it must not be ported.

| Capability | Legacy defect | Consequence of porting it |
|---|---|---|
| Invoice totals | VAT double-counted in the footer (**D4**) | Every VAT-bearing invoice overstates its total |
| Unit price column | Prints the line total (**D5**) | Column header lies |
| Ledger statement | Ordered `desc` while accumulating (**D8**) | Running balance is meaningless |
| Credit balances | Duplicated condition prints `0` (**D7**) | Every customer in credit shows zero |
| B/L release | `RELEASED` never written (**D1**) | Release appears implemented but does nothing |
| Voyage counter | Keyed on port + shipper (**D12**) | Voyage numbers collide across vessels |
| Number generation | Random components (**D13**) | Numbers are not reproducible or auditable |
| Manifest template | Hard-coded vessel name (**D11**) | Every manifest names the company as the vessel |
| Quotation | Free-text body (**D29-adjacent**) | Cannot reproduce the real line-item quotation |

### 2.3 Category C — structural inversions
Not bugs — deliberate legacy design that contradicts the employer.

| Legacy | Employer | Consequence |
|---|---|---|
| Manifest → B/L | B/L → Manifest | Blocks co-loading and per-B/L parties |
| Parties on manifest | Parties per B/L | Same |
| Customers are users | Customer is a commercial party | Blocks the whole party model |
| Port as one string | Port / City / Country | Breaks `REQ-030` |
| Voyage as a string on B/L | Voyage is an entity | Blocks voyage P&L |

### 2.4 Category D — confirmed correct in legacy, safe to carry forward

| Capability | Why it is safe |
|---|---|
| Days-in-port formula | Two independent sources (`REQ-070`, code) |
| `Balance = Debit − Credit` | Confirmed by the real SOA **and** the code |
| Invoice → debit, receipt → credit, payment → debit | Confirmed by the real SOA |
| Load list shape (`NO, CUSTOMER, SHOWROOM, DESCRIPTION, QTY, YARD, ARRIVAL, INSP, LOAD DATE, DAYS`) | Matches `REQ-085` |
| Inspection status values (`PENDING / DONE / LOCAL / NONEED`) | Matches `REQ-075` |
| Loading status values (`IN YARD / LOADED`) | Matches `REQ-093` |
| Voyage P&L = revenue − costs | Confirmed by employer and code |
| Receipt/payment as **separate** permissions | Good granularity worth preserving |
| Payment-status change as its own permission | Same |

---

## 3. Coverage by evidence layer

| Layer | Covers | Cannot cover |
|---|---|---|
| **Employer transcripts** (20 files) | Intent, process, rules, UI structure, statuses | Exact formats, exceptions, salary, letters, archive |
| **Real documents** (7 PDFs) | Actual formats, arithmetic, layout, party blocks, real names and values | Process, rules, future intent |
| **Legacy code** (199 files) | What was once attempted, data shapes, screen inventory | Anything never built (jobs, salary, DO, release, agent portal) |
| **Prior analyses** (8 files) | Framing, checklists, hypotheses | Verified fact (see [`prior-analysis-review.md`](prior-analysis-review.md)) |
| **Current system** | What exists today | — (Phase 8) |

### 3.1 The blind spot

**No source in this workspace answers questions about what the employer has not yet talked about.**
The 160-question questionnaire (Q01–Q160) is the best available map of that blind spot, and it is
**unanswered**.

---

## 4. Priority order for closing gaps

Derived from the employer's own emphasis and from how many downstream requirements each gap blocks.

| Priority | Gaps | Why |
|---|---|---|
| **P0** | Number formats (C-01…C-07) | Blocks every document; the employer will notice immediately |
| **P0** | Invoice arithmetic | Every invoice is wrong if VAT is non-zero |
| **P0** | Ledger balance correctness | Every customer balance is wrong |
| **P1** | B/L → Manifest ordering; per-B/L parties | Blocks co-loading, the single clearest document-proven requirement |
| **P1** | Vessel & Voyage masters | Blocks voyage P&L and voyage numbering |
| **P1** | Release workflow | The employer raised it repeatedly; the legacy screen is a dead end |
| **P2** | Job costing | Described but thin |
| **P2** | Document templates + PDF | Well-specified by the 7 specimens |
| **P2** | Agent portal | Clear intent, unclear scope |
| **P3** | Salary, Letters, Company Archive | Almost no employer input — **must not be built on inference alone** |

---

## 5. Explicit non-gaps

Recorded so nobody "fixes" them:

| Behaviour | Status |
|---|---|
| Legacy `admin_status` management-review gate | **Not required** — legacy-only |
| Legacy random number components | **Not required** — placeholder |
| Legacy `Offer` entity (separate from Quotation) | **Not required** — merged |
| Legacy hard-coded role id 8 on role deletion | **Not required** — a defect |
| Legacy two customer-creation paths | **Not required** — an artefact |
| Legacy SMS gateway integration | **Not mentioned** by the employer; scope unknown |
| Legacy customer "wallet" | **Not mentioned**; dead code |
