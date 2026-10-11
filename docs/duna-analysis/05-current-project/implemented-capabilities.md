# Current System — Implemented Capabilities

> Phase 8, part 2. What the current system **already does**, module by module, with the ADR that
> governs each behaviour.
>
> State as of **2026-10-06**: Phase 5 unit 4 complete; **403/403** API tests green; 37 migrations up
> to date.

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

Recorded in `docs/current-plan/11-implementation-state.md` — **not** re-derived here, but the ones
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
