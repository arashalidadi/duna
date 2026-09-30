# 04 Final Data Model

## 1. Target conceptual model

### 1.1 Parties

- Customer
  - id, code auto sequential, name mandatory, contactNumber, email, address, status, timestamps.
  - One Customer has many Cargo, Invoice, Voucher, Job, B/L references, Ledger entries.

- Shipper
  - id, code, name mandatory, nationalIdTrn optional, address, contactNumber, email, timestamps.
  - One Shipper appears on many B/Ls and Manifest rows.

- Consignee
  - id, code, name mandatory, nationalIdTrn optional, address, contactNumber, email, timestamps.
  - One Consignee appears on many B/Ls and Manifest rows.

- Agent
  - id, code, name, address, contactNumber, email, timestamps.
  - Many-to-many with Port/destination via AgentDestination.
  - One Agent is linked to portal users for a destination scope.

- AgentDestination
  - agentId, portId, timestamps.

### 1.2 Geography

- Port
  - id, code, name, city, country, abbreviation, timestamps.
  - One Port has many Yards.

- Yard
  - id, code, name, portId, timestamps.
  - Yard belongs to one Port.

### 1.3 Vessels and voyages

- Vessel
  - id, code, name, imo optional, vesselType, tugBargeNamePair optional, timestamps.
  - One Vessel has many Voyages.

- Voyage
  - id, vesselId, destinationPortId, voyageNumber per destination, planned dates, status, timestamps.
  - One Voyage has many LoadLists, B/Ls, Manifest, Invoices, Jobs.

### 1.4 Cargo and yard

- Cargo
  - id, reference, customerId, shipperId, consigneeId, portOfLoadingId, destinationPortId, description, chassisNumber, serialNumber, units, packages, weight, weightUnit, arrivalDate, yardId, documentStatus, inspectionStatus, loadingDate, comment, jobId optional, timestamps.
  - One Cargo has one current YardInventory.

- YardInventory
  - id, cargoId unique current, yardId, portId, status, enteredAt, timestamps.

- Inspection
  - id, cargoId, status pending/booked/done, inspectionDate, notes, timestamps.

### 1.5 Loading

- LoadList
  - id, voyageId, loadListNumber, status, timestamps.
  - One LoadList has many LoadListItems.

- LoadListItem
  - id, loadListId, cargoId, plannedQuantity, selectionStatus, timestamps.

- ActualLoading
  - id, loadListId unique, actualLoadingNumber, status, timestamps.
  - One ActualLoading has many ActualLoadingItems.

- ActualLoadingItem
  - id, actualLoadingId, loadListItemId unique, cargoId, actualQuantity, result, timestamps.

- Discharge
  - id, actualLoadingId unique, dischargeNumber, status, timestamps.
  - One Discharge has many DischargeItems.

### 1.6 B/L and Manifest

- BillOfLading
  - id, billNumber per destination, shipperId, consigneeId, notifyParty, vesselName, voyageId, polPortId, podPortId, freightTerms, placeOfIssue, dateOfIssue, status, releaseStatus, stamp, timestamps.
  - One B/L has many B/L items.
  - One B/L may link to many Invoices.

- BillOfLadingItem
  - id, billOfLadingId, cargoId, sequence, description, marksAndNumbers, quantity, netWeight, grossWeight, cbm, timestamps.

- Manifest
  - id, manifestNumber per destination, voyageId, vesselName, tugBargeInfo, manifestDate, polPortId, podPortId, companyInfo, timestamps.
  - One Manifest has many ManifestItems.

- ManifestItem
  - id, manifestId, billOfLadingId, sequence, blNumber, description, consigneeId, shipperId, quantity, weight, timestamps.

### 1.7 Job

- Job
  - id, jobNumber, customerId optional, title, related cargo/shipment refs, status, timestamps.
  - One Job has many JobCostItems.
  - One Job has many Invoices.
  - One Job has many Cargo.

- JobCostItem
  - id, jobId, kind, category, description, amount, date, timestamps.

### 1.8 Commercial documents

- Invoice
  - id, invoiceNumber, customerId, jobId optional, billOfLadingId optional, manifestId optional, issueDate, dueDate, status, paymentStatus, timestamps.
  - One Invoice has many InvoiceItems.

- InvoiceItem
  - id, invoiceId, sequence, description, rate, quantity, vatPercent, vatAmount, amount, timestamps.

- Proforma
  - id, proformaNumber, customerId, lines, totals, issueDate, validUntil, status, timestamps.

- Quotation
  - id, quotationNumber, customerId, lines, totals, issueDate, validUntil, status, timestamps.

### 1.9 Payments and ledger

- Voucher
  - id, voucherNumber, type receipt/payment, customerId, invoiceId optional, billOfLadingId optional, amount, currency, method, voucherDate, idCardImage, signature, timestamps.
  - One Voucher may allocate to many Invoices.

- VoucherAllocation
  - id, voucherId, invoiceId, allocatedAmount, timestamps.

- LedgerEntry
  - id, customerId optional, type, debit, credit, description, related invoice/voucher/journal ref, timestamps.

- GeneralJournal
  - id, entryNumber, date, description, entries, timestamps.

- JournalLine
  - id, journalEntryId, account, debit, credit, description, timestamps.

### 1.10 Release and Delivery

- ReleaseOrder
  - id, releaseNumber, billOfLadingId, status, paymentStatus, releaseDate, timestamps.

- DeliveryOrder
  - id, deliveryNumber, billOfLadingId, customerId, portId, issueDate, status, timestamps.

### 1.11 HR and correspondence

- Employee
  - id, code, name, nationalId, position, phone, email, hireDate, baseSalary, currency, status, timestamps.

- SalaryRecord
  - id, salaryNumber, employeeId, month, year, status, base, additions, deductions, net, idCardFront, idCardBack, signature, timestamps.

- Letter
  - id, letterNumber, direction, status, date, subject, body, refNumber, fromContact, toContact, customerId optional, replyToId, timestamps.

### 1.12 Documents and audit

- DocumentTemplate
  - id, documentType, name, format, storage reference, active version, timestamps.

- DocumentTemplateVersion
  - id, templateId, version, storageKey, timestamps.

- FileAttachment
  - id, entityType, entityId, category, storageKey, filename, mimeType, size, uploadedBy, timestamps.

- AuditLog
  - id, timestamp, actorId, action, entityType, entityId, metadata, timestamps.

## 2. Comparison with current Prisma schema

### 2.1 Already aligned

- Customer, Port, Yard, Vessel, Voyage, Cargo, YardInventory, Inspection, LoadList, LoadListItem, ActualLoading, ActualLoadingItem, Discharge, Invoice, InvoiceItem, Proforma, ProformaItem, Quotation, QuotationItem, Voucher, DeliveryOrder, ReleaseOrder, Employee, SalaryRecord, Letter, Job, JobCostItem.
- Phase 1 infrastructure: NumberingSequence, AuditLog, FileAttachment, DocumentTemplate, DocumentTemplateVersion.

### 2.2 Only partially aligned

- Shipper, Consignee, Agent tables exist but must be used as the real masters instead of Customer.type.
- B/L and Manifest still wrongly depend on Customer FKs for shipper/consignee/agent in current code.
- B/L still created against Manifest in current code; target is B/L first, then Manifest.
- Manifest still created from Actual Loading in current code; target is from issued B/Ls.
- Voucher still has single invoiceId FK in current schema; target is VoucherAllocation.
- Invoice still has header taxRate; target is per-line VAT.
- Invoice still lacks Job link; target includes jobId.
- Ledger is derived only; target also supports General Journal entries.
- Agent portal still bookings-focused; target is destination-scoped B/L/Release/document visibility.

### 2.3 Still missing in schema

- GeneralJournal and JournalLine tables.
- VoucherAllocation table.
- B/L release status as a distinct field/concept.
- B/L revision/versioning model for customer review corrections.
- ManifestItem direct reference to BillOfLadingItem.
- ManifestDate field.
- Invoice payment status tracking beyond paidAmount.
- Customer 360 read model is an API/view concern, not necessarily a new table.

## 3. Key model decisions

- Customer remains the commercial counterparty.
- Shipper, Consignee, Agent are separate masters.
- B/L precedes Manifest.
- ManifestItem should ultimately reference BillOfLadingItem, not only Cargo.
- Invoice VAT is per line.
- Voucher supports multi-invoice allocation.
- Ledger supports General Journal.
- Agent portal enforces destination scope server-side.
- Customer 360 is an aggregate view.
- Numbering for B/L, Manifest, Voyage is per destination and configurable.
