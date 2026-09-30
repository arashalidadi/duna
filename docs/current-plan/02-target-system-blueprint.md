# 02 Target System Blueprint

## 1. Overview

The target system is a shipping operations and accounting ERP for a UAE-based international shipping company. It supports:

- Master data for parties, geography, vessels.
- Cargo intake, yard inventory, inspection, load planning, actual loading.
- Bill of Lading and Manifest as separate but linked document flows.
- Job/ETOZ cost tracking.
- Invoice, Proforma, Quotation, Payment/Receipt, Ledger, General Journal.
- Release Order, Delivery Order.
- Employee, Salary, Correspondence.
- Customer 360.
- Destination-scoped agent portal.
- Document generation, templates, attachments, archive.
- Reports including Voyage/Vessel/Manifest P&L and VAT.

## 2. Module-by-module target

### 2.1 Overview / Dashboard

Purpose: entry point and business snapshot.

Main screens:
- KPI cards: open invoices, overdue items, cargo in yard, ready for loading, pending inspections, recent releases, balance due.
- Recent activity feed.
- quick navigation.

Roles: all authenticated users with appropriate permissions.

Dependencies: cargo, inspection, loading, invoice, voucher, release modules.

### 2.2 Master Data

Purpose: maintain reusable reference data.

Submodules:
- Customers
- Ports
- Yards
- Vessels
- Shippers
- Consignees
- Agents

Customers:
- Fields: Name mandatory, Contact Number, Email, Address, auto code, status.
- Actions: create, edit, delete, status.
- UI: list with search and status; create/edit dialog.

Ports:
- Fields: Name, City, Country, abbreviation.
- Actions: create, edit, delete.
- UI: list and form.

Yards:
- Fields: name, parent Port.
- Port selection filters yards.
- Actions: create, edit, delete.

Vessels:
- Fields: Name, IMO optional, vessel type, tug/barge name pair optional.
- Actions: create, edit, activate/deactivate.

Shippers:
- Fields: Name mandatory, National ID/TRN, Address, Contact Number, Email.
- Name mandatory; others optional without error.

Consignees:
- Same pattern as Shipper.

Agents:
- Fields: Name, Address, Contact Number, Email, destination associations.
- Destination-scoped.

### 2.3 Operations

Purpose: operational handling of cargo from receipt to loading.

Submodules:
- Cargo
- Yard Inventory
- Inspection
- Load Lists
- Actual Loading
- Discharge

Cargo:
- Fields: Customer, Shipper, Port of Loading, Port of Destination, Description, Chassis Number, Serial Number, Units, Packages, Weight, Weight Unit, Arrival Date, Yard, Document Status, Inspection status, Loading Date/Time, Comment.
- Comment is editable and deletable.
- Filters by destination, port, yard, status, inspection status.
- UI: list, create/edit dialog, detail.

Yard Inventory:
- Current physical location of cargo in a yard.
- One current record per cargo.
- Actions: place, move, remove.
- Return-to-yard on not-loaded cargo.

Inspection:
- Book inspection, record result, mark Done.
- Done is prerequisite for Load List eligibility.
- Status: Pending, Booked, Done.
- UI: list, create, update, result actions.

Load Lists:
- Plan cargo for a vessel/voyage.
- Progressive creation and editing.
- Print for operators.
- Per-item selection.
- Rejects cargo without Done inspection.
- Partial loading supported.
- Not-loaded items return to yard.

Actual Loading:
- Record actual loaded quantities.
- Results: loaded, partially loaded, not loaded.
- Updates cargo status and yard inventory atomically.

Discharge:
- Mirror of actual loading at destination.
- Records what is discharged.

### 2.4 B/L and Manifest

Purpose: transport document and consolidation flow.

Submodules:
- Bill of Lading
- Manifest

Bill of Lading:
- Created from finalized/eligible cargo/loading.
- Fields: Shipper, Consignee, Notify Party, B/L number, Vessel, Voyage, POL, POD, cargo lines, net weight, gross weight, CBM, totals, place of issue, freight terms, date, stamp.
- Lifecycle: Draft, Final/Approved, Released/Unreleased.
- Draft watermark.
- Revisions for customer review corrections.
- Per-destination numbering.
- PDF/Excel output with template support.
- Auto stamp on PDF; live stamp removal for print.

Manifest:
- Created from issued B/Ls.
- Fields: vessel name, tug/barge or landing craft, voyage, manifest number, date, POL, POD, company info, B/L rows, shippers, consignees, quantities, weights, totals.
- Supports multiple shippers and consignees.
- Supports external partner B/Ls with their own numbering.
- PDF/Excel output with uploaded templates.
- Print and stamp behavior.

### 2.5 Job / ETOZ

Purpose: track total cost of a cargo/shipment from start to delivery.

Fields:
- Job Number, Customer, title, related cargo/shipment, costs.

Actions:
- Create Job.
- Add cost/income lines.
- Reference Job when invoicing.

Lifecycle:
- Costs accumulate over time.
- Accountant uses Job when issuing invoices.

### 2.6 Accounting

Purpose: financial documents, ledger, and reporting foundation.

Submodules:
- Invoice
- Proforma
- Quotation
- Voucher
- Ledger
- General Journal

Invoice:
- Issued to Customer.
- Optional link to B/L and/or Manifest.
- Linked to Job Number.
- Lines with description, rate, quantity, VAT percent, VAT amount, amount.
- Subtotal, VAT, total.
- Issue date, due date, payment status.
- Auto-appears in Customer ledger as Debit.
- Independent invoice creation supported.
- PDF/Excel output with templates.

Proforma:
- Pre-invoice quote document.
- Similar line math.
- Conversion to invoice supported.

Quotation:
- Price offer to customer.
- Conversion to proforma supported.

Voucher:
- Payment Voucher and Receipt Voucher.
- Customer identification.
- Optional invoice/B/L reference.
- If not linked, still posts to ledger as Credit.
- ID Card image front/back.
- Recipient signature.
- Partial payment support.

Ledger:
- Customer statement: invoices, payments, balance, date range.
- General Journal entries for non-invoice transactions and company expenses.
- Debit/Credit model.

General Journal:
- Manual entries outside the invoice flow.
- Supports company expenses and other transactions.
- Feeds VAT and annual reporting.

### 2.7 Release and Delivery

Purpose: document hand-over control at destination.

Release Order:
- Issued after discharge.
- Shows B/L status, payment status, release status.
- Payment statuses: Paid, Partial, Unpaid/credit.
- Reports: released, paid, partially paid, unpaid.
- Alerts for overdue or partial payment.
- Agent can view for own destination.

Delivery Order:
- For cargo discharged at company port.
- Customer and Port identified.
- Printed and stamped.
- Handed to customer with other documents.

### 2.8 Agent Portal

Purpose: destination-scoped self-service for agents.

Fields/access:
- Agent logged in for a destination.
- Sees B/Ls and Release information for that destination only.
- Sees payment status and release status.
- Can download/view allowed documents.

Enforcement:
- Destination scope enforced server-side.

### 2.9 Customer 360

Purpose: unified view of the customer relationship.

Content:
- Customer overview.
- Invoices.
- Payments/vouchers.
- Ledger/balance.
- Jobs.
- Cargo/shipment history.
- B/L history where relevant.
- Comments/activity.
- Status and recent behavior.

Implementation:
- Aggregate/read model, not a duplicate data master.

### 2.10 Documents, Templates, Attachments, Archive

Purpose: document output and record management.

Capabilities:
- Uploaded company templates.
- PDF and Excel output.
- Auto stamp on PDF.
- Live stamp removal for print.
- Digital stamp/signature support in generation layer.
- Attachments for inspections, payments, B/Ls, source documents.
- Archive metadata for final documents.
- Final documents become immutable.

### 2.11 Reports

Purpose: management and tax reporting.

Reports:
- Voyage/Vessel/Manifest P&L.
- Manifest report.
- Cost report.
- VAT report, periodic.
- Tax/year reporting.
- Customer statement.
- Dashboard KPIs.

### 2.12 HR and Correspondence

Purpose: employees, payroll, letters.

Submodules:
- Employees
- Salary
- Letters

Employees:
- Fields: code, name, national ID, position, contact, hire date, base salary, currency, status.

Salary:
- Salary Slip per employee per month.
- ID Card front/back images.
- Employee signature.
- Printable.

Letters:
- Correspondence register.
- Incoming/Outgoing.
- Threading.

### 2.13 Access Control

Purpose: users, roles, permissions.

Capabilities:
- User management.
- Role management.
- Permission assignment.
- Agent portal access control.
- Backend enforcement of sensitive scopes.
- Audit history for sensitive actions.

## 3. Cross-module relationships

- Customer is the commercial center.
- Cargo belongs to Customer and references Shipper/Consignee.
- Job links to Customer and is referenced by Invoice and Cargo.
- Invoice links to Customer, optional B/L/Manifest, optional Job.
- Voucher links to Customer and optionally to Invoice.
- Ledger derives from Invoice and Voucher and General Journal.
- B/L links to Shipper, Consignee, Vessel, Voyage, cargo lines.
- Manifest links to Voyage and consolidates B/Ls.
- Release Order links to B/L.
- Delivery Order links to B/L.
