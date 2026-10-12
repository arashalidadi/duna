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
