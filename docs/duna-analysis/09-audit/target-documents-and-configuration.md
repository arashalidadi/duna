# Target System — Document Catalog, Workflows, Numbering and Configuration

**Status:** Canonical target specification. Documentation only.
**Created:** 2026-10-11. Cross-references: `confirmed-decisions.md` (DEC-*), `target-domain-and-finance.md`.

---

## 1 · Document catalog — 11 types (DEC-099)

The target catalog contains **eleven** document types. The nine-versus-eleven discrepancy between `REQ-124` and
source pack §2.12 is **documented and explained**, not silently resolved:

| # | Document type | Basis |
|---|---|---|
| 1 | **Loading List** | Explicit enumeration — EMP-722 |
| 2 | **Invoice** | Explicit enumeration — EMP-723 |
| 3 | **Delivery Order** | Explicit enumeration — EMP-723 |
| 4 | **Release Order** | Explicit enumeration — EMP-723 |
| 5 | **Salary Slip** | Explicit enumeration — EMP-723 |
| 6 | **Voucher** | Explicit enumeration — EMP-723 |
| 7 | **Payment** | Explicit enumeration — EMP-723 |
| 8 | **Receipt** | Explicit enumeration — EMP-723 |
| 9 | **Ledger** | Explicit enumeration — EMP-724 |
| 10 | **Bill of Lading** | Separately evidenced — **EMP-035**: *"it's a standard Bill of Lading whose formats we have, I'll send them to you"* |
| 11 | **Manifest** | Separately evidenced — **EMP-572**: *"we Upload that same Format that we have into the system"* |

**Resolution:** nine types are the employer's explicit enumeration (EMP-721-725, recorded as REQ-124). B/L and
Manifest are separately evidenced as also having company-specific formats. All eleven are in scope.
**Nothing is invented.** The two additional types are traceable to named `EMP-nnn` statements.

**Templates (REQ-125 / DEC-098):** the company's official template files are **not present** in the repository.
`docs/duna-analysis/documents/` holds seven real document **samples**, which are evidence of layout, not
templates. This limits **final template fidelity and validation only** — it does not block specification or any
other phase.

---

## 2 · Document lifecycles and workflows

### 2.1 Bill of Lading (DEC-061)

The B/L lifecycle must distinguish three phases:

```
Draft  ──▶  Customer review & correction  ──▶  Approval / Finalization  ──▶  Final issuance
(with DRAFT watermark, sent to customer)      (draft watermark removed)
```

- **Evidence:** source pack §2.11 — the B/L is first issued as a Draft carrying a `DRAFT` watermark, sent to the
  customer for review and correction; after approval/finalization the draft is removed and the final B/L is
  issued. **REQ-105 (EMP-564)** — customer-requested corrections are applied before finalization.
- **Creation source:** a B/L is created from a **COMPLETED Actual Loading with recorded quantity greater than
  zero** (ADR-029/042). Verified implemented at `bill.service.ts:304, 589-601, 918-920`.
- **Official status labels are NOT established.** `BlStatus` currently has six values
  (`DRAFT | FINAL | APPROVED | RELEASED | ISSUED | CANCELLED`) containing near-duplicate pairs
  (`FINAL`/`ISSUED`, `APPROVED`/`RELEASED`). Labels must remain configurable until verified (DEC-060/061).
- **Legacy provides no guidance.** Defect **D1**: `RELEASED` is defined but **never written**; `Bl.status` is
  only ever written as `PENDING`, and the legacy Release screen has no action to change it.

**Invariant (DEC-062):** a B/L status is **not** a release authorization.

### 2.2 Release Order — the release authorization (DEC-062)

Cargo release is authorized by the **Release Order**, not by a B/L status.

- **Evidence (EMP-685-690):** the release document records whether the customer *"paid in full, it's Paid"*,
  took the cargo *"on credit — it's Unpaid"*, or made a *"Partial Payment — they paid a part of it, and they must
  pay a part of it later."*
- **Normal rule (§2.16):** after the vessel arrives and the cargo is discharged, the Release Order is issued
  **if the customer has paid the invoice in full**.
- **Payment states (REQ-182):** **Paid / Partial / Unpaid (credit)** — all three evidenced.
- **Override:** approval authority and exception handling must be **configurable through controlled workflows**.
  No approver identity is invented (DEC-059/063).

**Verified gap:** `ReleaseOrder` has `status` (`ISSUED | CANCELLED`) and `financialOverride` / `overrideReason`
(ADR-033), but **no payment-state field**, and it is not exposed to agents.

### 2.3 Delivery Order (DEC-022)

- **Scenario (§2.17):** for cargo **discharged at the company's port/facility** and to be delivered to the
  customer or consignee.
- **Carries:** number, date, **Port**, and the company's standard information (REQ-186).
- **Legacy had none** (§4.2) — so there is no legacy behaviour to inherit or copy.

**Verified gap:** `DeliveryOrder` exists but has **no port field**, despite REQ-186 requiring one.

### 2.4 Manifest

- One manifest consolidates many **APPROVED** B/Ls for the same voyage (ADR-047). Verified implemented at
  `manifest.service.ts:293-347`.
- Header: Vessel, Voyage, Port of Loading, Port of Discharge, Manifest Number, Date (§2.11).
- Rows: numbered, carrying B/L Number, Description, Shipper, Consignee, Units/Packages, Gross Weight
  (REQ-111; confirmed by the real manifest's column set).
- Final page: **Total Units, Total Packages, Total Weight** (REQ-112).
- If one vessel carries several companies or forwarders, the Manifest is **one** document but the different
  companies' B/Ls may have different number formats (§2.11).

### 2.5 Invoice

Two production paths (EMP-607): linked to B/L/Manifest/Job, or standalone. B/L-linked invoices auto-draft for
matching against Job Numbers (EMP-608/609). See `target-domain-and-finance.md` §2.7.

### 2.6 Salary Slip

Requires employee ID-card front and back plus the employee's signature on the printed copy (§2.15, REQ-170).

### 2.7 Payment / Receipt Voucher

Requires recipient ID-card front and back (upload or camera) plus the recipient's signature (§2.15, REQ-168).
Scope is limited to **vouchers and salary slips** — not extended indiscriminately (DEC-092).

---

## 3 · Document numbering (DEC-024…028)

Administrators configure numbering **independently per document type**: prefix, suffix, year/period components,
sequential numbering, scope (branch, destination, year or other configured dimension), reset rules where
permitted, uniqueness constraints, and effective dates or configuration versions.

### 3.1 Verified real-world samples (seed reference, not confirmed rules)

| Document | Real sample | Source |
| --- | --- | --- |
| Bill of Lading | `KHS/26-110` | Real B/L §3.1; invoice reference `KHS/26-108`; manifest range `KHS/26-110`…`KHS/26-139` |
| Manifest | `DSMAN/KHO-26-006` | Real manifest §3.2 |
| Manifest (alternate) | `DSKHS-26-005` | Referenced on the tax invoice — **conflict preserved** |
| Tax Invoice | `DSINV/26-172` | Real invoice §3.5 |
| Proforma | `DSPRO/26-001` | Real proforma §3.6 |
| Quotation | `DSQUO/25-017` | Real quotation §3.7 |
| Receipt Voucher | **`477`** — plain numeric | Real voucher §3.3 |
| Voyage | `02/26` | Real B/L, manifest and invoice |

**Spoken examples that are NOT rules:** `KHS/26-2/2026` (EMP-544) and `RJS/26-10` (EMP-546) — these conflict
with each other **and** with the real documents. They must not be adopted.

**Corrected:** contradiction **C-07** claimed a receipt voucher `DSR/26-190`. That string is **fabricated** —
`DSR` appears in no extracted document, and the real voucher is **No. 477** (error E1, re-confirmed by source
pack §3.3).

### 3.2 B/L sequence semantics (DEC-028)

**EMP-547:** *"this 10 is the Bill of Lading that we issued in the year 2026 for Rajaee."*
→ the sequence counts B/Ls issued **per destination per year**. Real documents agree.

### 3.3 Current implementation state

| Aspect | State |
| --- | --- |
| `NumberingSequence` model | Present; supports prefix, format, padding, period, scopeType, scopeValue |
| Transactional allocation | `NumberingService.allocateNumber()` uses `SELECT … FOR UPDATE` — the safe pattern |
| Document types on the service | **3 of 14** — `bill`, `manifest`, `voyages` |
| Remaining 11 types | Hard-coded local `generateReference()` with fixed `XXX-YYMM-` prefixes and P2002 retry |
| Seeded sequences | **None** — rows are created on first use |
| Per-destination B/L/Manifest | **Already implemented** (`bill.service.ts:1642-1649`, `manifest.service.ts:1037-1045`) |
| Voyage `n/yy` per destination | **Already implemented** (`voyages.service.ts:278-288`); **vessel** component missing |

**Correction to prior work:** an earlier draft routed REQ-102 (per-destination B/L numbering) to Phase 2 as an
unimplemented gap. Per-destination scoping is already implemented; only the format string differs from the real
`KHS/26-110`. The correction is recorded in `question-reconciliation.md`.

### 3.4 Immutability (DEC-026)

Once a document number is issued, later configuration changes must **never** silently alter it. Duplicate
prevention and concurrent generation are addressed in technical design (DEC-027) — the standard pattern is the
existing `NumberingService`, and the 11 local generators should be migrated onto it.

---

## 4 · Configuration and extensibility

### 4.1 Custom fields (DEC-029…033)

Administrators extend supported records and document types **without code changes**. Configuration supports:
data type; required/optional; validation rules; display location and ordering; visibility rules; view and edit
permissions; filtering and search; reporting and export behaviour; applicable entity/document types; effective
dates or configuration versions.

**Managed option lists** support dropdowns and multi-selects; administrators may add, edit, deactivate and, where
safe, reactivate options (for example cities).

**Historical values survive (DEC-032):** renaming, deactivating or removing an option must **never** silently
rewrite historical record values.

**Verified gap:** no `CustomField` model exists.

### 4.2 Document types and workflows (DEC-034…036, DEC-059…063)

Administrators may add and deactivate document types and configure display name, category, required/optional
fields, custom fields, numbering pattern and scope, output templates, permissions, workflow and status
configuration, approval rules, document relationships, and reporting/search behaviour.

Workflows are configurable: statuses and display labels, allowed transitions, role-based permissions, conditions,
approval steps, exception handling, audit records.

**Versioning (DEC-035):** document-type configuration must be versioned or have a clear effective point so
historical documents retain their original interpretation and output.

**Invariants:**
- **DEC-036 / DEC-063 / DEC-114:** configuration must **never** bypass core financial, authorization,
  data-integrity, security or audit controls.
- **DEC-060:** official company status labels that are not established must **not** be invented.

**Verified gap:** no `DocumentType`, `WorkflowDefinition` or `Approval` model. Statuses are fixed Prisma enums.

### 4.3 Ports and reference data (DEC-064…067)

Administrator-managed ports with official name, display name, country, code or abbreviation, aliases, and
active/inactive status. Seeded initially from verified sources.

| Port | Evidence |
|---|---|
| Hamriyah | `HAM` (EMP-264-266); `HAMRIYA PORT, DUBAI, UAE` on real documents |
| Khorramshahr | `KHS`; `KHORRAM SHAHR, PERSIAN GULF, IRAN` |
| Bandar Abbas | `BANDAR ABBAS, PERSIAN GULF, IRAN`; 13 transcript mentions |
| Bushehr | `Bushehr, Persian Gulf, Iran` (§2.4); 11 mentions |
| Jebel Ali | 10 mentions; appears on the real invoice (transportation Jebel Ali → Hamriyah) |
| Rajaee | `RJS` (EMP-546); 4 mentions |
| Sohar | 2 mentions |
| Dubai | 12 mentions |

**Cautions:**
- Codes are preserved **only where meaning is verified** — HAM, KHS, RJS are evidenced; the rest are not.
- **Bandar Abbas and Rajaee may refer to the same port complex.** Not resolved by available evidence; recorded
  as open rather than guessed.
- **Khalifa Port** is currently seeded but appears in **zero** sources.
- Historical documents must retain the names and codes originally used (DEC-066).

**Verified gap:** schema `Port` has no display name and no aliases; `city` and `abbreviation` are **nullable**
despite REQ-031 requiring all four mandatory (AUD-012).

### 4.4 Notifications (DEC-056…058)

Administrator-configurable rules: trigger events and conditions, recipients and roles, timing and delay, repeat
intervals and frequency limits, escalation, delivery channels (**in-app and email**, future channels extensible),
enable/disable, and delivery status with audit information.

Use cases include overdue invoices, pending approvals, Job status changes and unpaid-release follow-ups.

**Historical thresholds are examples, not defaults:** one week unpaid (EMP-148), a month with 20% unpaid
(EMP-149), follow-up in one or two weeks (EMP-692). Administrators configure the actual conditions — none of
these may be hard-coded.

**Verified gap:** no notifications module, no scheduler, no `notification:*` permission codes.

---

## 5 · Document output and templates

### 5.1 Requirements (DEC-093…098)

- Every document type has independently configurable output templates.
- Administrators create, edit, version, preview, deactivate and assign templates **without code changes** for
  routine adjustments.
- Templates support: dynamic fields from system records; page size and orientation; margins and layout; fonts
  and text formatting; tables and repeating rows; page breaks and pagination; approved company assets; PDF
  generation and printing; versioning and controlled assignment.
- The **template version** and, where required, the **rendered historical output** are preserved. A later
  template change must not silently alter an already issued document's appearance.
- Template editing and approval are permission-controlled and audited.

### 5.2 Stamp behaviour (REQ-121 / REQ-122)

- **PDF output** includes stamps, marks and signature.
- **Print output strips** stamps, marks and signature so a live physical stamp can be applied.

This is counter-intuitive but stated three times (EMP-039/172/582/583). It must be supported as **two output
modes per document**, and must not be "corrected".

### 5.3 Company assets (DEC-087…092)

Securely managed assets: letterheads, logos, stamps, authorized signatures and other official document assets.
Secure upload, management, versioning, replacement, deactivation and template assignment by authorized users.
Access to view, download, replace and delete is permission-restricted and audited. **No unrestricted public
URLs.** Retention and secure deletion are configurable, preserving assets referenced by historical documents.

**Verified gap:** no rendering dependency exists anywhere (searched `pdfkit`, `puppeteer`, `exceljs`,
`handlebars`, `mustache`, `renderTemplate` → zero matches). `DocumentTemplate` is referenced 16×;
**`DocumentTemplateVersion` is orphaned** (0×). `FileAttachment` is referenced **once** — effectively unused.
`CompanySettings` is referenced once and has **no endpoint**, so the company name and TRN required on printed
documents cannot be maintained through the product.

---

## 6 · Cross-document traceability

The specification requires that any document be traceable to its related records:

| From | To | Basis |
| --- | --- | --- |
| Invoice | Job(s), B/L(s), Manifest | DEC-071, DEC-105 |
| Invoice | Correction / replacement / credit note | DEC-020/021 |
| Payment | Invoice(s), advance, accounting entries | DEC-015/017 |
| Release Order | B/L, payment state, approval | DEC-062, REQ-182 |
| Delivery Order | Cargo / B/L / consignee, port | REQ-186, §2.17 |
| Manifest | APPROVED B/Ls, voyage | ADR-047 |
| B/L | Actual Loading, voyage | ADR-029/042 |
| Job | Cargo, B/Ls, costs, invoices, payments | DEC-068 |

Every relationship above must be reconstructable **after** correction, cancellation or archive — that is the
practical test of the audit and historical-preservation requirements.
