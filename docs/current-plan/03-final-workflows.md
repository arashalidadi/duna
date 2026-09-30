# 03 Final Workflows

## 1. Customer and commercial flow

### 1.1 Customer registration

1. Office creates a Customer.
2. Name is mandatory; contact details optional.
3. System assigns an auto sequential code.
4. Customer becomes the commercial counterparty for invoices and ledger.

### 1.2 Customer 360 usage

1. User opens Customer profile.
2. System shows overview, invoices, payments, ledger, balance, jobs, cargo history, B/L history where relevant, comments/activity.
3. User can see paid/partial/unpaid status and balance.

## 2. Operational flow

### 2.1 Cargo intake

1. Office receives cargo at a port.
2. Office creates Cargo record.
3. User selects Customer.
4. User enters Shipper, Port of Loading, Port of Destination, description, chassis, serial, units, packages, weight, weight unit, arrival date, documents, comment.
5. Selecting Port of Loading filters Yards.
6. User assigns Yard.
7. Office adds Comment for operational notes.

### 2.2 Inspection

1. Inspection is booked for cargo.
2. Inspection fee and time may be recorded.
3. Inspection is performed.
4. Inspection status moves to Done.
5. Cargo without Done inspection cannot enter Load List.

### 2.3 Load List

1. User selects a vessel/voyage.
2. User builds Load List from eligible cargo.
3. Cargo without Done inspection is rejected.
4. Load List is printed for operators.
5. Load List can be edited and extended over time.
6. Operators load cargo.
7. Not-loaded cargo is removed from Load List and returns to Yard Inventory.
8. Loaded cargo is recorded with loading date/time.

### 2.4 Actual loading

1. Actual Loading is recorded against the Load List.
2. Loaded quantity, not-loaded items, and reasons are captured.
3. Loaded cargo leaves Yard Inventory.
4. Not-loaded cargo returns to Yard Inventory.

### 2.5 Discharge

1. At destination, discharge is recorded.
2. Discharge mirrors actual loading.
3. Partial discharge is supported.
4. Fully discharged cargo is marked delivered where applicable.

## 3. Document flow

### 3.1 Bill of Lading

1. After loading is finalized, B/L is prepared from eligible cargo/loading data.
2. B/L is created in Draft.
3. Draft carries Draft watermark.
4. B/L is sent to Customer for review.
5. Customer may request corrections.
6. B/L is revised if needed.
7. B/L is finalized/approved and issued.
8. B/L number is per destination.
9. B/L status includes Released/Unreleased as a separate permission concept.
10. B/L is output as PDF/Excel with template and stamp support.

### 3.2 Manifest

1. After B/Ls are issued, Manifest is created from those B/Ls.
2. Manifest header includes vessel, tug/barge or landing craft, voyage, manifest number, date, POL, POD, company info.
3. Manifest rows are built from issued B/Ls.
4. Manifest shows multiple shippers/consignees.
5. External partner B/Ls can be included.
6. Manifest is output as PDF/Excel with templates.
7. Print and stamp behaviors are supported.

### 3.3 Job/ETOZ

1. When work on a cargo/shipment starts, a Job Number is assigned.
2. Costs are recorded against the Job over time.
3. Accountant references Job Number when issuing invoices.

### 3.4 Invoice

1. Invoice is created for a Customer.
2. Invoice may be generated from issued B/Ls.
3. Invoice is linked to Job Number.
4. Invoice lines include description, rate, quantity, VAT percent, VAT amount, amount.
5. Invoice shows subtotal, VAT, total.
6. Invoice shows issue date, due date, payment status.
7. Invoice appears in Customer ledger as Debit.
8. Independent invoices can be created outside the B/L flow.

### 3.5 Payment and voucher

1. Customer pays or customer is paid.
2. Payment Voucher or Receipt Voucher is created.
3. Voucher identifies Customer.
4. Voucher may reference invoice and/or B/L.
5. ID Card image and signature are captured.
6. If voucher is not linked to an invoice, it still posts to ledger as Credit.
7. Partial payments are supported.

### 3.6 Ledger

1. Invoices post as Debit.
2. Payments post as Credit.
3. General Journal entries can be added directly.
4. Customer statement shows invoices, payments, balance for a date range.

### 3.7 Release Order

1. After vessel arrival and discharge, Release Order is issued.
2. Release Order shows B/L and payment status.
3. Office can see which documents are released, paid, partially paid, unpaid.
4. Alerts highlight overdue or partially paid items.
5. Agent sees Release status and B/L status for own destination.

### 3.8 Delivery Order

1. For cargo discharged at company port, Delivery Order is issued.
2. Delivery Order identifies Customer and Port.
3. Delivery Order is printed and stamped.
4. Delivery Order is handed to customer with other documents.

## 4. Agent flow

1. Agent logs in.
2. Agent sees only own destination's B/Ls and Release information.
3. Agent checks B/L status and Release status.
4. Agent does not need to call the office for routine checks.

## 5. Reporting flow

1. Voyage/Vessel/Manifest costs are recorded.
2. Invoice revenue for the relevant B/Ls is aggregated.
3. P&L is derived: revenue minus costs.
4. VAT report aggregates taxable invoices and VAT amounts.
5. Reports support filtered periodic and annual views.

## 6. Document/template flow

1. Company uploads templates for relevant document types.
2. Documents are generated from templates.
3. PDF includes auto stamp.
4. Print removes live stamp for physical stamping.
5. Final documents become immutable and are archived with metadata.
