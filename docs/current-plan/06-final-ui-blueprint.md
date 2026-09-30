# 06 Final UI Blueprint

## 1. Information architecture

### 1.1 Sidebar sections

- Overview
- Operations
- B/L and Manifest
- Accounting
- Master Data
- Access Control

### 1.2 Master Data sub-sections

- Customers
- Ports
- Yards
- Vessels
- Shippers
- Consignees
- Agents

### 1.3 Operations sub-sections

- Cargo
- Yard Inventory
- Inspection
- Load Lists
- Actual Loading
- Discharge

### 1.4 B/L and Manifest sub-sections

- Bills of Lading
- Manifests

### 1.5 Accounting sub-sections

- Jobs
- Invoices
- Proformas
- Quotations
- Vouchers
- Ledger
- General Journal
- Reports

### 1.6 Release/Delivery sub-sections

- Release Orders
- Delivery Orders

### 1.7 Additional sections

- Employees
- Salary
- Letters
- Customer 360
- Agent Portal
- Documents/Templates
- Audit
- Administration

## 2. Page patterns

### 2.1 List pages

- Search and filters.
- Status filters.
- Pagination.
- Clear status badges.
- actions: create, view, edit, delete where allowed.

### 2.2 Create/edit dialogs

- Validation on submit.
- Master-data selects where applicable.
- Port-to-Yard filtering.
- Inspection status checks where applicable.
- Customer-first flow for cargo and invoices.

### 2.3 Detail pages/dialogs

- Summary header.
- Related items.
- Status and timestamps.
- Actions allowed by permission and state.

## 3. Customer 360 UI

- Customer header: name, code, contact, status.
- Tabs or sections for: overview, jobs, cargo, B/Ls, invoices, payments, ledger/balance, comments/activity.
- Balance and payment status prominent.
- Recent activity and open items visible.

## 4. Operational UI

### 4.1 Cargo

- List with destination/port/yard/inspection filters.
- Create/edit with customer-first, then shipper, ports, yard, documents, comment.
- Comment visible and editable.

### 4.2 Inspection

- List by cargo/status.
- Book and result actions.
- Done gating shown in operational lists.

### 4.3 Load List

- Create from eligible cargo.
- Items table with selection.
- Print action.
- Progressive edit.
- Not-loaded handling shown.

### 4.4 Actual Loading

- List by LoadList/voyage.
- Item-level loaded/not-loaded results.
- Yard inventory effects visible.

### 4.5 Discharge

- List by actual loading/destination.
- Per-line discharge results.

## 5. Document UI

### 5.1 B/L

- List by status/voyage/destination.
- Create from eligible cargo.
- Draft/Final/Released states shown.
- Revision history.
- PDF/Excel download.

### 5.2 Manifest

- List by voyage/destination.
- Create from issued B/Ls.
- Multi-party rows shown.
- PDF/Excel download.

### 5.3 Invoice

- List by customer/status/payment.
- Create standalone or from B/L.
- Line VAT UI.
- Job link.
- PDF/Excel download.

### 5.4 Voucher

- List by customer/type/status.
- Create with customer, optional invoice/B/L, ID card, signature.
- Allocation UI for multi-invoice payments.

### 5.5 Ledger

- Customer statement view.
- Date range filter.
- General Journal entry form.

## 6. Release/Delivery UI

- ReleaseOrder list with payment status.
- Eligibility and override where applicable.
- DeliveryOrder list with customer/port.
- Print/stamp behavior.

## 7. Agent portal UI

- Agent login scoped to destination.
- B/L list for own destination.
- B/L detail.
- Release and payment status.
- Allowed document download.

## 8. Reporting UI

- P&L by voyage/vessel/manifest.
- VAT periodic report.
- Manifest/cost summaries.
- Dashboard KPIs.
- Export where applicable.

## 9. Responsive/mobile behavior

- Collapsible sidebar.
- Responsive tables and cards.
- Touch-friendly actions.
- Status indicators readable on small screens.

## 10. Status presentation

- Clear color/semantic badges for statuses.
- Draft, Final, Issued, Released, Paid, Partial, Unpaid, Pending, Done, and similar states must be visually distinct.
- Overdue/partial payment warnings should be visible where relevant.

## 11. Permission-aware UI

- Actions hidden/disabled when not permitted.
- Scope-limited views for agent portal.
- Audit-sensitive actions clearly labeled.
