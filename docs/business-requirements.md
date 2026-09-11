# Business Requirements

> Overview of the business domain for the Shipping Operations & Accounting ERP.
> Detailed module requirements will be captured during each implementation phase.

## Company Context

- UAE-based shipping/forwarding company working with international shipping.
- Multi-currency operations, at minimum USD and AED.
- Operates through ports and yards.
- Timezone handling must be explicit; company timezone is `Asia/Dubai`, data stored in UTC.

## Core domain flow

The operational core of the business:

```
Customer
  → Cargo
  → Yard (inventory & inspections)
  → Voyage / Load Planning
  → Load List
  → Actual Loading
  → Manifest
  → Bill of Lading
  → Shipment / Delivery
  → Release Order
  → Delivery Order
  → Discharge
```

And the commercial/financial core:

```
Job (cost centre)
  → Expenses
  → Revenue (linked to invoices)
  → Profit / Loss
  → Invoice
  → Payment / Customer Ledger
```

## High-level module requirements (future phases)

### Customers

- Customer master data; types (shipper, consignee, agent, freight forwarder).
- Unique customer code via configurable numbering.
- Credit limits, currency preferences.

### Cargo

- Cargo records linked to customer and eventually to yards/ports/voyages.
- Status lifecycle (registered → at yard → ready → loaded → delivered, terminal cancelled).
- Measurement/weight/units, commodity, packaging.
- **Phase 4 (implemented):** `Cargo` records with auto `CRG-<YYMM>-<seq5>` reference, `CargoType` enum,
  `Decimal` weight + `WeightUnit`, status lifecycle state machine (ADR-019), search/filter/pagination,
  RBAC-gated CRUD + transition + guarded delete.

### Yard inventory

- Stocking locations per yard; stock movements; location history.
- Yard capacity relative to load plans.
- **Phase 4 (implemented):** single current `YardInventory` per cargo (place / move / remove, ADR-020),
  transactional status mirroring with cargo.

### Inspections

- Inspections against cargo; results, status.
- **Planned (Phase 5):** drives `inspectionStatus` `PENDING → APPROVED/REJECTED`, unblocking cargo `READY`.

### Vessels / Voyages

- Vessel registry; voyages with ports of call, dates, capacity.
- Voyage status lifecycle.

### Load Planning / Load Lists / Actual Loading

- Planned stowage against voyage slots; the Load List as the planned document;
  Actual Loading as the executed record; discrepancies flagged.

### Manifest / Bill of Lading

- Manifest derives from final cargo loading.
- B/L issued per cargo/consignment with configurable numbering and template.

### Jobs & Job costing

- Job as cost/profit container; expenses and revenue line items; P&L computation.

### Invoicing & Accounting workflows

- Invoices with configurable numbering; customer ledger; payments; allocations; reversals.
- Multi-currency support.

### Release / Delivery / Discharge

- Release orders approving cargo release; delivery orders; discharge tracking.

### Agent portal

- Agent-facing workflows for bookings/status without full system access.

### Reporting

- Operational reports plus Voyage P&L; financial statements.

### Documents & templates

- Configurable documents: Load List, Manifest, B/L, Invoice, Payment Voucher, Release Order, Delivery Order.
- Company templates are supplied later; business logic must not depend on a fixed layout.

### Numbering

- Configurable numbering for Customer Code, Job, Voyage, Manifest, B/L, Invoice, Payment, Release,
  Delivery Order numbers (e.g. `CUS-001`, `JOB-2026-00125`). See decisions.md.

### Auditability & RBAC

- Immutable audit trail for key events; role-based access control across modules.

## Non-functional requirements

- Professional, dense, desktop-first UI for operational users; fast navigation; clear status visualization.
- Relational integrity and transactional correctness for financial & operations data.
- No fake/static business data in the UI — only real, live data.
