# 05 Final API Blueprint

## 1. Design principles

- REST under `/api/v1`.
- Permission-based authorization per module/action.
- Backend-enforced scope for sensitive flows, especially agent destination scoping.
- Consistent envelope for success and error.
- Pagination with metadata.
- DTO validation on create/update.
- Decimal money values serialized as strings.

## 2. Resource groups

### 2.1 Master data

- Customers
- Ports
- Yards
- Vessels
- Shippers
- Consignees
- Agents
- AgentDestinations

### 2.2 Operations

- Cargo
- YardInventory
- Inspection
- LoadLists
- LoadListItems
- ActualLoadings
- ActualLoadingItems
- Discharges
- DischargeItems

### 2.3 Documents

- BillsOfLading
- BillOfLadingItems
- Manifests
- ManifestItems

### 2.4 Commercial

- Jobs
- JobCostItems
- Invoices
- InvoiceItems
- Proformas
- ProformaItems
- Quotations
- QuotationItems

### 2.5 Accounting

- Vouchers
- VoucherAllocations
- Ledger
- GeneralJournal
- JournalEntries
- JournalLines

### 2.6 Release/Delivery

- ReleaseOrders
- DeliveryOrders

### 2.7 Agent portal

- Portal me
- Portal bookings
- Portal B/L visibility
- Portal release/payment status
- Portal document download

### 2.8 Customer 360

- Customer 360 aggregate endpoint

### 2.9 Reports

- Voyage/Vessel/Manifest P&L
- VAT report
- Manifest report
- Cost report
- Dashboard KPIs

### 2.10 Documents and attachments

- DocumentTemplates
- DocumentTemplateVersions
- FileAttachments
- Document generation/download

### 2.11 Audit

- AuditLog query

## 3. Key endpoint behaviors

### 3.1 Customer

- CRUD.
- Customer 360 read endpoint.

### 3.2 Shipper/Consignee/Agent

- CRUD.
- Agent linked to destinations.

### 3.3 Cargo

- CRUD.
- Lifecycle transitions.
- Filters by port, yard, destination, inspection status, customer.
- Comment editable.

### 3.4 Inspection

- CRUD.
- Book, record result, mark Done.
- Done is prerequisite for Load List eligibility.

### 3.5 LoadList

- CRUD.
- Add items with inspection check.
- Edit progressively.
- Finalize.
- Reject not-done cargo.

### 3.6 ActualLoading

- CRUD.
- Record loaded quantities.
- Not-loaded items return to yard.

### 3.7 B/L

- Create from eligible cargo/loading, not from Manifest.
- Draft, finalize, release states.
- Revisions for corrections.
- Per-destination numbering.
- PDF/Excel generation endpoint.

### 3.8 Manifest

- Create from issued B/Ls.
- Consolidate multiple B/Ls.
- Per-destination numbering.
- PDF/Excel generation endpoint.

### 3.9 Invoice

- Create standalone or from B/L.
- Link to Job.
- Line VAT.
- Issue, cancel.
- PDF/Excel generation endpoint.

### 3.10 Voucher

- Create receipt/payment.
- Link to Customer.
- Optional invoice/B/L link.
- ID card and signature capture.
- Allocations to invoices.

### 3.11 Ledger

- Customer statement.
- General Journal entry create.
- Derived balance.

### 3.12 Release/Delivery

- ReleaseOrder with payment status.
- DeliveryOrder with customer/port.
- Eligibility checks.

### 3.13 Agent portal

- Me and summary.
- Bookings.
- Destination-scoped B/L list/detail.
- Release/payment status.
- Allowed document download.

### 3.14 Reports

- P&L by voyage/vessel/manifest.
- VAT aggregation.
- Manifest/cost summaries.
- KPIs.

## 4. Authorization notes

- Agent portal reads must be scoped server-side by destination.
- Release and payment-sensitive endpoints must enforce permissions.
- Audit-relevant mutations should write AuditLog.

## 5. Document output API

- Document generation should be available as download endpoints.
- Template selection should be configurable per document type.
- PDF and Excel outputs should be supported where applicable.
