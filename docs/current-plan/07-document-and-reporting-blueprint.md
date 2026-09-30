# 07 Document and Reporting Blueprint

## 1. Document types

- Loading List
- Bill of Lading
- Manifest
- Invoice
- Proforma
- Quotation
- Receipt Voucher
- Payment Voucher
- Ledger statement
- Release Order
- Delivery Order
- Salary Slip
- Letters

## 2. Document sources

- Loading List from eligible cargo and LoadList.
- B/L from finalized/eligible cargo/loading.
- Manifest from issued B/Ls.
- Invoice from Customer, optional B/L/Manifest/Job.
- Proforma/Quotation from Customer.
- Voucher from Customer, optional invoice/B/L.
- ReleaseOrder from B/L.
- DeliveryOrder from B/L.
- Salary Slip from Employee.
- Letters from correspondence workflow.

## 3. Numbering

- B/L: per destination, configurable, for example `KHS/26-2/2026`.
- Manifest: per destination, configurable, for example `DSMAN/KHO-26-006`.
- Voyage: per destination sequence.
- Invoice/Proforma/Quotation: configurable numbering default.
- Voucher: configurable numbering by type.
- Customer code: auto sequential.
- Jobs, LoadLists, ActualLoadings, Discharges, D/O, R/O, Salary, Letters: configurable numbering per module.

## 4. Revisions and finalization

- B/L supports Draft, review corrections, Final/Approved, and release permission.
- Revisions preserve historical finalized versions.
- Final documents become immutable.
- Archive metadata recorded for final/archived documents.

## 5. Output formats

- PDF via HTML/CSS + Playwright rendering.
- Excel via XLSX + ExcelJS.
- PDF auto stamp where applicable.
- Print removes live stamp for physical stamping.
- Digital stamp/signature supported in the generation layer.

## 6. Templates

- Company uploads templates per document type.
- Templates are versioned.
- Active template selected per document type.
- Template content and wording are business decisions, not invented by the system.

## 7. Attachments

- Inspection photos.
- Payment ID documents.
- Signatures.
- Source documents.
- B/L attachments.
- Other business documents.
- Common FileAttachment infrastructure with entityType/entityId/category.

## 8. Archive

- Final/archived documents carry archive metadata.
- Archived records remain viewable/searchable by permissions.
- Retention and re-opening policy are business decisions.

## 9. Reporting

### 9.1 Dashboard KPIs

- Open invoices.
- Overdue invoices.
- Cargo in yard.
- Ready for loading.
- Pending inspections.
- Recent releases.
- Balance due.

### 9.2 P&L

- Voyage/Vessel/Manifest P&L.
- Costs: vessel charter, Port Use, Handling, Lashing, miscellaneous.
- Revenue: sum of invoices for relevant B/Ls.
- Result: profit or loss.

### 9.3 VAT

- Periodic VAT report.
- Taxable invoices, VAT amounts, VAT collected, VAT paid.
- Supports quarterly and other periodic views.

### 9.4 Other reports

- Manifest report.
- Cost report.
- Customer statement.
- Tax/year reporting with filters.
