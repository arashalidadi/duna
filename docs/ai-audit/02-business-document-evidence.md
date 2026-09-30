# 02 Business Document Evidence

**Stage 2 complete.** Deep analysis of actual company documents from shipping_documents_detailed_reference.md, duna_source_pack.md, and related evidence.

---

## 1. Document Types in Evidence

| # | Document | Sample Number | Page |
|---|----------|---------------|------|
| 1 | Bill of Lading | KHS/26-110 | 1 |
| 2-4 | Manifest (one, 3 pages) | DSMAN/KHO-26-006 | 2-4 |
| 5 | Tax Invoice | DSINV/26-172 | 5 |
| 6 | Proforma Invoice | DSPRO/26-001 | 6 |
| 7 | Quotation | DSQUO/25-017 | 7 |
| 8 | Ledger Account | (period 1-Jul-26 to 7-Sep-26) | 8 |
| 9 | Receipt Voucher | 477 | 9 |

---

## 2. Bill of Lading — Full Field Analysis

### 2.1 Parties
- **Shipper:** RAS AL KHAIMAH MACHINERIES LLC (Dubai, UAE) — AL NOKHITHA BUILDING, HAMRIYA PORT
  - Contact: +971****7707, +971****3596, +971****5868
  - Email: info@dunashipping.com, dunashipping@yahoo.com
  - Website: www.dunashipping.com
- **Consignee:** JOINT MECHANIC CO — National ID: 10100670462
- **Notify Party:** SAME AS CONSIGNEE (not a separate party in this sample)
- **Destination Agent:** BADBAN ARVAND ROOD SHIPPING CO — Khorramshahr, Iran — +98 9365855027 — a.mahmoodiani_bar@yahoo.com

### 2.2 Voyage/Routing
- Vessel: MEHDI 11
- Voyage: 02/26
- POL: HAMRIYA PORT, DUBAI, UAE
- POD: KHORRAM SHAHR, PERSIAN GULF, IRAN

### 2.3 Cargo
- 1 unit, USED KOMATSU D155A BULLDOZER
- CH.NO: KMT0D105EMC088308
- (ON DECK) notation
- Gross weight: 42,000 KG
- Measurement: null (CBM not shown)

### 2.4 Issue/Freight
- Place of issue: DUBAI
- Date of issue: 29-AUG-26
- Freight: FREIGHT PREPAID
- Originals: 1

### 2.5 Legal
- Carriage clause: "SHIPPED on board on apparent good order and condition..."
- Weight/measure/marks accepted as unknown
- Consignee receives subject to freight and charges
- 1 original must be surrendered for goods/delivery order
- Master signs stated number of originals

### 2.6 Visual
- STAMP & SIGNATURE — AS AGENT (placeholder)

---

## 3. Manifest — Full Field Analysis

### 3.1 Header
- Manifest number: DSMAN/KHO-26-006
- Date: 05-Sep-26
- Voyage: 02/26
- **Barge: MEHDI 11** ← separate from vessel name
- **Tug: LAYAN GULF** ← separate entity, KEY evidence
- POL: HAMRIYA, DUBAI, UAE
- POD: KHORRAM SHAHR, PERSIAN GULF, IRAN

### 3.2 Table Columns
```
# | BL | DESCRIPTION OF GOODS | CONSIGNEE | SHIPPER | UNIT/PKGS | GROSS WEIGHT (KGS)
```

### 3.3 Row Data Model (varies per row)
Each row may have subset of:
- sequence_no (integer)
- bl_number (string)
- description (string)
- chassis_no / ch_no / serial_no (string, nullable)
- type (string, nullable) — e.g. NK400-E, AC200-1, FD200-7
- capacity (string, nullable) — e.g. 40 TONS, 200 TONS
- tariff_no (string, nullable) — HS code variant, e.g. 87051010
- hs_code (string, nullable) — e.g. 84791029
- consignee (string)
- shipper (string)
- units_packages (number)
- gross_weight_kg (number)

### 3.4 Key Manifest Evidence

**Multiple rows per B/L:** B/L number KHS/26-138 appears on rows 29 AND 30. KHS/26-139 appears on rows 31-43 (13 rows!). One B/L can have multiple manifest line items.

**Multiple shippers/consignees in one manifest:** At least 12 different parties across 45 rows:
- JOINT MECHANIC CO (consignee)
- BADBAN ARVAND ROOD SHIPPING CO (consignee + shipper)
- BANDAR RAHE CASPIAN CO (consignee)
- SEDAGHAT TEJARAT ARVANDAN COMPANY (consignee)
- MR. HOJAT NASSIR (consignee)
- KANDOVAN PARS CONSTRUCTION CO (consignee)
- MR. JALAL AMIRI SHAKIBA (consignee)
- MR. SHAHROKH SHAHVARAEI (consignee)
- KARIZ SHAHR MINES COMPANY (KASHCO) (consignee)
- MR. IMAN BAYMANI NEZHAD (consignee)
- MR. SEYED ALI MOHAMMAD POUR (consignee)
- TAHA POUYESH KISH (consignee)
- NIKAN SERAJ ARJANR ARVAND (consignee)

Shippers: DUNA SHIPPING LLC, GRAND CRANE TRADING LLC, GALADARI TRUCKS & HEAVY EQUIPMENTS CO, ROSE MINE GENERAL TRADING LLC, NEW AUTO FZCO, SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ, MARINO USED HEAVY EQUIPMENT AND MACHINERY TRADING LLC, EHSAN INTERNATIONAL, ALDA CONSTRUCTION EQUIPMENT & MACHINERY TRADING LLC

**Forwarder B/L numbers:** NES260900266 and NES260900267 appear in manifest rows 44-45 — these are NOT Duna Shipping B/Ls but forwarder B/Ls included in the manifest.

### 3.5 Manifest Totals (from rendered page)
- TOTAL: 32 UNITS AND 79 PKGS
- Total line count: 111
- Total gross weight: 991,886 kg

### 3.6 Implementation Implications
- Manifest item model must support nullable chassis_no, type, capacity, tariff_no, hs_code, serial_no
- Manifest is ONE per voyage (not per B/L)
- Manifest can contain B/Ls from multiple shippers/consignees AND forwarder B/Ls
- Totals must be computed server-side from line snapshots
- Page numbers generated at PDF render time, not stored in DB

---

## 4. Tax Invoice — Full Field Analysis

### 4.1 Header
- Document type: TAX INVOICE
- Invoice number: DSINV/26-172
- Date: 6-Aug-26
- Customer: MR. SHAHOKH SHAHVARAEI
- B/L ref: KHS/26-108
- Manifest ref: DSKHS-26-005
- Vessel: DAHAR 10
- Voyage: 02/26
- POL: HAMRIYA
- POD: KHORRAM SHAHR
- Currency: AED

### 4.2 Bill To Block
- Name: MR. SHAHOKH SHAHVARAEI
- TRN/ID: null
- Address: null
- Email: null
- Contact: null
- Customer ID: null
- TRN No: null

### 4.3 Charge Lines
| # | Description | Qty | Unit Price (AED) | VAT % | VAT Amount | Amount |
|---|-------------|-----|------------------|-------|------------|--------|
| 1 | FREIGHT CHARGE | 1 | 22,020.00 | 0 | 0.00 | 22,020.00 |
| 2 | STORAGE CHARGE | 1 | 650.00 | 0 | 0.00 | 650.00 |
| 3 | CUSTOMS DOCUMENTATION | 1 | 200.00 | 0 | 0.00 | 200.00 |
| 4 | TRANSPORTATION CHARGE FROM JEBEL ALI TO HAMRIYA | 1 | 4,500.00 | 0 | 0.00 | 4,500.00 |

### 4.4 Totals
- Subtotal: 27,370.00 AED
- VAT: 0.00
- Total: 27,370.00 AED

### 4.5 Footer
- "If any discrepancy is noticed in the invoice, kindly inform us in writing within 7 days; otherwise the above amount will be considered as correct."
- Authorised Signatory (placeholder)

### 4.6 Implementation Implications
- Invoice has BOTH B/L and Manifest references
- VAT is line-level (per-line VAT rate and amount)
- Some services have 0% VAT, some may have VAT — need rules
- Invoice footer text is configurable legal text
- Charge line descriptions are free text (not enum)

---

## 5. Proforma Invoice — Full Field Analysis

### 5.1 Seller
- DUNA SHIPPING LLC
- OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE
- PO Box: 63088
- Tel: 0097142527707
- Mobile: 00971506445868
- Email: info@dunashipping.com

### 5.2 Identification
- Proforma number: DSPRO/26-001
- Date: 22-AUG-26
- Validity: 1 MONTH
- Country of beneficiary: UAE

### 5.3 Buyer
- MR. RAMIN AHMADABADI

### 5.4 Trade Terms
- Country of origin: INDIA
- Terms of delivery: FOB
- Terms of payment: 100% ADVANCE PAYMENT
- Currency: AED
- Freight forwarder: DUNA SHIPPING LLC, Dubai, UAE
- Partial shipment allowed: true
- Port of discharge: BANDAR ABBAS, PERSIAN GULF, IRAN
- Final delivery place: MAKU FREE ZONE

### 5.5 Cargo Lines
| # | Description | Year | Qty | Net Wt (KG) | G.Wt (KG) | T.G Wt (KG) | Unit Price (AED) | Amount (AED) |
|---|-------------|------|-----|-------------|-----------|-------------|------------------|--------------|
| 1 | BRAND NEW HYUNDAI R340L EXCAVATOR | 2026 | 1 | 9 | 9 | 9 | 520,000.00 | 520,000.00 |
| 2 | BRAND NEW HYDRAULIC BREAKER | 1 | 1000 | 1000 | 1000 | 125,000.00 | 125,000.00 |
| 3 | BRAND NEW QUICK COUPLER | 1 | 1000 | 1000 | 1000 | 45,000.00 | 45,000.00 |

### 5.6 Totals
- Subtotal: 690,000.00 AED
- Freight charges: 0.00
- Grand total: 690,000.00 AED

### 5.7 Certification
- "SEAL AND SIGNATURE: MOHAMMAD KAZEM JOWKAR"
- Certification text: proforma shows actual price, no other proforma issued, particulars true and correct

### 5.8 Implementation Implications
- Proforma is a commercial offer document, structurally different from Tax Invoice
- Has seller/buyer, trade terms, origin/destination, validity
- Can be for goods sales (excavator sale) not just shipping services
- Has its own numbering: DSPRO/YY-NNN
- Validity period field
- Certification block with signer name

---

## 6. Quotation — Full Field Analysis

### 6.1 Header
- Document type: QUOTATION
- Quotation number: DSQUO/25-017
- Date: 20-NOV-25
- Customer: MR. SHADMAN MEABADI

### 6.2 Introduction Text
"Dear Sir/Madam, Thank you for your enquiry. We are pleased to enclose the applicable charges about 1 UNIT USED VOLVO FINISHER (as per packing list) for your consideration. Kindly note that we are able to provide the following operations and rate."

### 6.3 Charge Lines
| # | Description | Year | Qty | Unit Price (AED) | Amount (AED) |
|---|-------------|------|-----|------------------|--------------|
| 1 | LAND TRANSPORT CHARGE FROM DESIGNATED SHOWROOM TO DUBAI HAMRIYA PORT | 1 | 700.00 | 700.00 |
| 2 | FREIGHT CHARGE FROM HAMRIYA TO BUSHEHR | 1 | 6,500.00 | 6,500.00 |
| 3 | DOCUMENTATION AND EXIT CHARGE | 1 | 500.00 | 500.00 |

### 6.4 Totals
- Subtotal: 7,700.00 AED
- Other charges: 0.00
- Grand total: 7,700.00 AED
- Currency: AED

### 6.5 Footer
- "FOR DUNA SHIPPING LLC" + company stamp placeholder

### 6.6 Implementation Implications
- Quotation is a price offer, not a shipping document
- Has introduction text (editable template content)
- Charge lines are service descriptions (free text)
- Has subtotal + other charges + grand total (different from invoice tax model)
- Numbering: DSQUO/YY-NNN
- Can be converted to Proforma (per employer workflow)

---

## 7. Ledger Account — Full Field Analysis

### 7.1 Header
- Company: RUKN ALHMREYA TRANSPORTL.L.C, AL NOKITA CUSTOMS BUILDING, DUBAI, Emirate: Dubai, TRN: 104652986100003
- Statement title: DUNA SHIPPING Ledger Account
- Period: 1-Jul-26 to 7-Sep-26

### 7.2 Columns
Date | Particulars | Vch Type | Vch No. | Debit | Credit | Balance

### 7.3 Sample Entries

**Entry 1** — 4-Jul-26
- Particulars: "TRAILER & FORKLIFT WORK RECORDED FOR LOADING 1 TRAILER COUNTERWEIGHT & 4 TYRES IN ZAM ZAM BARGE"
- Vch Type: Sales
- Vch No: 1380
- Debit: 115.50
- Credit: null
- Balance: 115.50 (Dr)

**Entry 2** — 25-Jul-26
- Particulars: "CASH RECEIVED FROM DUNA SHIPPING AGT INV 1380"
- Vch Type: Receipt
- Vch No: 2026/446
- Debit: null
- Credit: 120.00
- Balance: 4.50 (Cr)

**Entry 3** — 28-Jul-26
- Particulars: "LOWBED CHARGES FOR SHIFTING 3 TRIP LOWBED WITH KOMATSU EXCAVATOR & 3 TRUCK SHIFTING TO DAHARA 10 SHIP"
- Vch Type: Sales
- Vch No: 1517
- Debit: 1,102.50
- Credit: null
- Balance: 1,098.00 (Dr)

**Entry 4** — 30-Jul-26
- Particulars: "TRAILER CHARGES FOR SHIFTING 2 TRAILER HEAVY MACHINERY PKGS - BARGE DAHAR 10"
- Vch Type: Sales
- Vch No: 1526
- Debit: 420.00
- Credit: null
- Balance: 1,518.00 (Dr)

**Entry 5** — 6-Aug-26
- Particulars: "CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526"
- Vch Type: Receipt
- Vch No: 2026/477
- Debit: null
- Credit: 1,600.00
- Balance: 82.00 (Cr)

**Entry 6** — 2-Sep-26
- Particulars: "LOWBED CHARGES FOR SHIFTING 6 KOMATSU EXCAVATOR & 2 PC EXCAVATOR FROM A09 YRD TO KHORAMSHAHR 1051"
- Vch Type: Sales
- Vch No: (continued...)

### 7.4 Ledger Analysis
- Voucher types: Sales (debit), Receipt (credit)
- Voucher numbers: 1380, 1517, 1526 (Sales) + 2026/446, 2026/477 (Receipts)
- Payments reference invoices: "INV 1380", "INV 1517, 1526" — multi-invoice payment allocation
- Running balance with Dr/Cr side indicator
- Entries are for operational charges (trailer, forklift, lowbed) not just invoice-based
- Cash received references multiple invoices in one payment

### 7.5 Implementation Implications
- Ledger is a running balance statement per customer
- Voucher types: Sales (debit-side charge), Receipt (credit-side payment)
- Multi-invoice payment allocation (one receipt can cover multiple invoices)
- Voucher numbers have different formats: sequential (1380) vs date-based (2026/446)
- Particulars are free-text descriptions
- Balance flips between Dr and Cr sides

---

## 8. Receipt Voucher — Full Field Analysis

### 8.1 Header
- Voucher number: 477
- Voucher date: (from ledger, 6-Aug-26)
- Account: (customer account)
- References: INV 1517, 1526
- Amount: 1,600.00
- Payment method: CASH (inferred from "CASH RECEIVED")
- Description: (particulars)
- Amount in words: (present on voucher)
- Signature: (present on voucher)

### 8.2 Implementation Implications
- Receipt voucher is a payment record
- References invoice numbers
- Has payment method
- Amount in words (for legal validity)
- Signature block

---

## 9. Master Data Requirements from Source Pack

### 9.1 Port
- Name, City, Country, **Abbreviation** (e.g. HAM for Hamriyah)
- Abbreviation used in Load List to save space

### 9.2 Yard
- Belongs to Port (only yards of selected port shown during cargo registration)
- Name (e.g. F15 for Hamriyah)

### 9.3 Vessel
- Vessel Name
- Types: Tug & Barge (separate names), Landing Craft, Vessel
- IMO Number (optional, not required)
- Used in: Loading List, B/L, Manifest

### 9.4 Voyage
- **Auto-generated per destination** — employer wants Voyage 1/26, 2/26 per destination
- Format: Voyage number + destination-based

### 9.5 Shipper (separate master data)
- Name (required), National ID/TRN (optional), Address, Contact, Email
- Used in B/L and Manifest

### 9.6 Consignee (separate master data)
- Same structure as Shipper: Name (required), National ID/TRN, Address, Contact, Email

### 9.7 Agent (separate master data)
- Name, Address, Contact, Email
- Per-destination: Agent Bandar Abbas for B/Ls to Bandar Abbas, Agent Bushehr for B/Ls to Bushehr

### 9.8 Customer (separate from all above)
- Can be individual (e.g. "Arash Alidadi") or corporate
- Commercial relationship — may not appear on B/L at all
- Invoice issued to Customer, not necessarily to Shipper/Consignee
- Code auto-generated (sequential like 332334)
- Customer profile shows: invoices, payments, balance, ledger, cargo history, B/L history

---

## 10. Operational Workflow Evidence

### 10.1 Cargo Registration
Fields: Customer, Shipper, Consignee, Description, Chassis/Serial, Units/Packages, Weight, Weight Unit, POL, POD, Yard (filtered by Port), Arrival Date, Documents, Comment
- Comment visible to accountant too
- Port → Yard filtering is required

### 10.2 Inspection
- Status: Pending → Done
- Rule: Only Inspection=Done cargo enters Loading List
- Open question: Failed/Recheck result? Report documentation?

### 10.3 Loading List
- Progressive completion (7 today, 13 tomorrow)
- Print for operators
- Unloaded cargo removed and returned to Yard Inventory automatically
- Fields for operator: Port of Loading, POD, Description, Chassis, Serial, Qty, Packages, Weight, Arrival Date, Yard, Inspection Status
- Lifecycle: Draft → In Progress → Partially Loaded → Completed → Finalized (NEEDS CONFIRMATION)
- Per-cargo: Selected → Loaded/Not Loaded → Returned to Yard (NEEDS CONFIRMATION)

### 10.4 B/L
- Draft with DRAFT watermark → send to customer → revision → Approved → Final
- Draft/Final = document production status
- Released/Unreleased = cargo/document release status
- These must NOT be merged into one status
- Fields: Shipper, Consignee, Notify Party, Vessel, Voyage, POL, POD, B/L Number, Description, Quantity, Marks & Numbers, Net/Gross Weight, CBM, Place of Issue, Date of Issue, Freight (Collect/Prepaid), Stamp/Signature
- Numbering per destination format

### 10.5 Manifest
- Built from ISSUED B/Ls (employer says B/L first, then Manifest — opposite of current code)
- Header: Vessel, Voyage, POL, POD, Manifest Number, Date
- Rows from B/Ls: B/L Number, Description, Shipper, Consignee, Units/Packages, Gross Weight
- Totals: Total Units, Total Packages, Total Weight
- Snapshot at finalization: which B/Ls were in the manifest

### 10.6 Invoice
Two types:
1. Invoice linked to B/L/Manifest/Job Number
2. Independent invoice (not linked to B/L/Job)

Linked invoice: after B/L issued, draft invoice created, accountant matches with Job Numbers
Fields: Invoice Number, Date, Customer, B/L/Manifest Reference, Description, Rate, Quantity, Amount, VAT, Subtotal, Total
- Some invoices have VAT, some don't
- VAT reports by time period/quarter/month
- Issued invoice → Customer Ledger as Debit

### 10.7 Payment/Receipt
- Ledger: Credit entry
- Multi-step payment: each installment separate
- Advance payments + allocation to multiple invoices
- ID document photo (back of ID) + recipient signature
- Field requirements TBD

### 10.8 Ledger/General Journal
- Customer Profile: full ledger with invoices, payments, debit/credit, balance, last invoice date, paid/unpaid/partial status
- General Journal: for transactions outside invoice cycle
- Company expenses: registered for year-end P&L

---

## 11. Document Output/Template Requirements

Templates needed for: Loading List, B/L, Manifest, Invoice, Delivery Order, Release Order, Salary Slip, Voucher, Payment, Receipt, Ledger
- Uploadable templates per company format
- PDF and/or Excel output per document
- PDF: digital stamp/signature/mark embedded
- Print: digital stamp MAY be removed for physical stamp
- Print version ≠ PDF version for some documents

---

## 12. Agent Portal Requirements

- Agent is NOT a regular user
- Agent scoped to one Destination/Port
- Example: Agent Khoramshahr → Khorramshahr documents only
- Agent sees: B/L status, Release Order status, maybe Manifest, maybe Delivery Order
- TBD: Download? Print? Upload document? Comment?
- TBD: One agent per destination or multiple?

---

## 13. Status Architecture (Proposed by Employer)

| Domain | Status Values |
|--------|---------------|
| Cargo Operational | Received → In Yard → Ready for Loading → Selected → Loaded → Delivered |
| Inspection | Pending → Booked → Done → Failed/Need Reinspection |
| Document | Pending → Submitted → Verified → Missing/Rejected |
| B/L Document | Draft → Review → Approved → Final |
| Payment | Unpaid → Partial → Paid |
| Release | Not Released → Released |
| Loading List | Draft → In Progress → Finalized |

ALL need employer confirmation.

---

## 14. Dashboard KPIs Required

- Cargo in Yard count
- Ready for Loading count
- Pending Inspection count
- Active Voyages count
- Draft B/Ls count
- Unpaid Invoices count
- Partial Payments count
- Released but Unpaid count
- Customer Receivables
- Voyage Profitability

Operational views:
- Inventory by Port/Yard/Destination
- Days in Port
- Inspection queue
- Ready to load
- Loading progress
- Not loaded/returned to Yard

Finance views:
- Receivables aging
- Paid/Partial/Unpaid
- VAT summary
- Customer balances
- Job cost
- Voyage P&L

---

## 15. Key Conflicts/Questions from Evidence

1. **B/L → Manifest order:** Employer says Manifest built from issued B/Ls. Current code: Manifest first, then B/L against manifest. CONFLICT.
2. **Numbering:** Employer wants per-destination (KHS/26-110). Current: global sequence (BOL-2609-00001). CONFLICT.
3. **Tug/Barge:** Evidence shows separate Tug (LAYAN GULF) and Barge (MEHDI 11). Current code: no Tug/Barge model. GAP.
4. **Port Abbreviation:** Employer wants HAM, etc. Current: no abbreviation field. GAP.
5. **Shipper/Consignee/Agent:** Separate master data needed. Current: all point to Customer. CONFLICT.
6. **Manifest parties:** One manifest has 12+ shippers/consignees. Current manifest model may force single shipper/consignee. POTENTIAL CONFLICT.
7. **Forwarder B/Ls in manifest:** NES260900266 appears. Current model: only Duna B/Ls. GAP.
8. **B/L number reuse in manifest:** KHS/26-138 and KHS/26-139 appear multiple times. Current: B/L number unique per line? Needs check.
9. **Proforma for goods sales:** DSPRO/26-001 is for excavator sale, not shipping service. Current proforma model may assume shipping only. GAP.
10. **Invoice VAT:** Sample shows 0% VAT on all lines, but employer says some invoices have VAT. Need rules.
11. **Multi-invoice payment:** Receipt 2026/477 covers INV 1517 AND 1526. Current voucher model: single invoice link? Needs check.
12. **Voucher number formats:** Mixed sequential (1380) and date-based (2026/446). Current: single format per type. POTENTIAL CONFLICT.
13. **Sales vouchers in ledger:** "Sales" voucher type with debit entries for operational charges (trailer, lowbed). Current: vouchers linked to invoices. GAP — these are standalone charges.
14. **General Journal:** Needed for non-invoice transactions. Current: no GJ model. GAP.

---

*Stage 2 of 8 — completed and persisted.*
