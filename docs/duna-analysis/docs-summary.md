# Shipping Document Reference & Data Model Specification

## Source: `ilovepdf_merged.pdf`

> **Purpose:** This document is a machine-readable,
> implementation-oriented specification of the sample shipping documents
> in the source PDF. It describes the document types, every visible data
> field, the relationships between fields, repeated structures, example
> values, layout semantics, and implementation guidance so that an AI
> model or software developer can understand the documents without
> needing the original PDF.
>
> **Important:** The source PDF is **9 pages**, not 8: 1. Bill of Lading
> (B/L) 2--4. One Manifest (`DSMAN/KHO-26-006`) spanning three pages 5.
> Tax Invoice 6. Proforma Invoice 7. Quotation 8. Ledger Account 9.
> Receipt Voucher
>
> The source text extraction exposes pages 1--8; page 9 is image-based,
> so its voucher content was transcribed from the rendered page. Stamps,
> signatures and logos are treated as visual placeholders rather than
> business-data fields.

------------------------------------------------------------------------

# 1. Document Set Overview

The PDF is a collection of related shipping/accounting documents:

  ----------------------------------------------------------------------------
  PDF page(s)       Document          Business role        Main data
  ----------------- ----------------- -------------------- -------------------
  1                 Bill of Lading    Transport/shipping   Shipper, consignee,
                                      document             notify party,
                                                           vessel, voyage,
                                                           ports, cargo,
                                                           weight, B/L number,
                                                           freight, issue data

  2--4              Manifest          Consolidated cargo   Manifest
                                      list                 number/date,
                                                           vessel/barge/tug,
                                                           loading/discharge
                                                           ports, many
                                                           B/L/cargo records

  5                 Tax Invoice       Commercial/tax       Customer, invoice
                                      billing              number/date,
                                                           voyage, shipment
                                                           references, charge
                                                           lines, VAT, totals

  6                 Proforma Invoice  Preliminary          Seller, buyer, PI
                                      commercial invoice   number/date,
                                                           origin,
                                                           delivery/payment
                                                           terms, cargo lines,
                                                           weights, prices,
                                                           total

  7                 Quotation         Price offer          Quotation
                                                           number/date,
                                                           customer, cargo
                                                           description,
                                                           service/charge
                                                           lines, subtotal,
                                                           other charges,
                                                           grand total

  8                 Ledger Account    Account statement    Date, particulars,
                                                           voucher
                                                           type/number, debit,
                                                           credit, running
                                                           balance, closing
                                                           balance

  9                 Receipt Voucher   Accounting receipt   Voucher
                                                           number/date,
                                                           account,
                                                           references, amount,
                                                           payment method,
                                                           description, amount
                                                           in words, signature
  ----------------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Global Modeling Principles

The documents should **not** be modeled as one giant flat object. They
are different document types with shared entities.

Recommended core entities:

``` text
Company
Party / Customer / Supplier
Shipment
Vessel
Voyage
Port
CargoItem
BillOfLading
Manifest
Invoice
InvoiceLine
ProformaInvoice
ProformaInvoiceLine
Quotation
QuotationLine
LedgerAccount
LedgerEntry
ReceiptVoucher
DocumentAttachment
DocumentApproval
```

A single real shipment may connect several documents:

``` text
Shipment
  ├── Bill of Lading
  ├── Manifest
  │     ├── Manifest Cargo Item 1
  │     ├── Manifest Cargo Item 2
  │     └── ...
  ├── Tax Invoice
  ├── Proforma Invoice
  └── Quotation

Accounting side:
  ├── Ledger Entries
  └── Receipt Vouchers
```

Do not assume that every number appearing in one document is the same
type of identifier. Examples include:

-   B/L number: `KHS/26-110`
-   Manifest number: `DSMAN/KHO-26-006`
-   Invoice number: `DSINV/26-172`
-   Proforma number: `DSPRO/26-001`
-   Quotation number: `DSQUO/25-017`
-   Ledger voucher number: e.g. `1380`, `2026/446`, `1517`
-   Receipt voucher number: `477`

------------------------------------------------------------------------

# 3. BILL OF LADING (B/L)

## 3.1 Purpose

The first page is a **BILL OF LADING**. It is a transport document
describing one shipment/cargo record and the parties and voyage
involved.

The sample B/L is for B/L number `KHS/26-110`.

Source example: - Shipper: `RAS AL KHAIMAH MACHINERIES LLC` - Consignee:
`JOINT MECHANIC CO` - Destination agent:
`BADBAN ARVAND ROOD SHIPPING CO` - Vessel: `MEHDI 11` - Voyage:
`02/26` - Loading port: `HAMRIYA PORT, DUBAI, UAE` - Discharge port:
`KHORRAM SHAHR, PERSIAN GULF, IRAN` - Cargo: one used Komatsu D155A
bulldozer - Gross weight: `42,000 KGS` - Freight: `FREIGHT PREPAID` -
Issue place: `DUBAI` - Issue date: `29-AUG-26` - Originals: `1`

These fields and values are visible in the first page of the source.
fileciteturn0file0L2-L59

------------------------------------------------------------------------

## 3.2 B/L Header

### Document title

``` text
BILL OF LADING
```

### Shipper block

Fields:

``` yaml
shipper:
  name: "RAS AL KHAIMAH MACHINERIES LLC"
  location: "DUBAI, UAE"
  address: "AL NOKHITHA BUILDING, HAMRIYA PORT, DUBAI, UAE"
  contact_phone: "+97142527707"
  mobile_numbers:
    - "+971503003596"
    - "+971506445868"
  emails:
    - "info@dunashipping.com"
    - "dunashipping@yahoo.com"
  website: "www.dunashipping.com"
```

The source visually places the company/contact information in the upper
area of the B/L. Some contact/address data is visually associated with
the document issuer/agent block rather than being semantically part of
the shipper identity. For implementation, keep `party` data separate
from `document_issuer/contact`.

### B/L number

``` yaml
bl_number: "KHS/26-110"
```

This is the primary identifier for this B/L.

### Consignee

``` yaml
consignee:
  name: "JOINT MECHANIC CO"
  national_id: "10100670462"
```

### Notify party

``` yaml
notify_party:
  name: "SAME AS CONSIGNEE"
```

This means the notify party is not a separate party in this sample.

### Destination agent

``` yaml
destination_agent:
  name: "BADBAN ARVAND ROOD SHIPPING CO"
  city_country: "KHORRAM SHAHR, IRAN"
  contact: "+98 9365855027"
  email: "a.mahmoodiani_bar@yahoo.com"
```

------------------------------------------------------------------------

## 3.3 Voyage / Routing

``` yaml
vessel:
  name: "MEHDI 11"

voyage:
  number: "02/26"

port_of_loading:
  name: "HAMRIYA PORT, DUBAI, UAE"

port_of_discharge:
  name: "KHORRAM SHAHR, PERSIAN GULF, IRAN"
```

The source also contains the company contact block around the
voyage/port area. fileciteturn0file0L22-L29

------------------------------------------------------------------------

## 3.4 B/L Cargo Table

The cargo table has these conceptual columns:

``` text
MARKS & NUMBERS
QTY
DESCRIPTION OF GOODS
GROSS WEIGHT (KGS)
MESUREMENT (CBM)
```

The sample cargo is:

``` yaml
quantity: 1
unit: "UNIT"
description:
  - "USED KOMATSU D155A BULLDOZER"
  - "CH.NO: KMT0D105EMC088308"
  - "(ON DECK)"
gross_weight_kg: 42000
measurement_cbm: null
```

Important: `CH.NO` is a chassis/serial-like equipment identifier and
should be stored separately from the free-text description when
possible.

The source explicitly shows the cargo description, chassis number,
on-deck notation and 42,000 kg weight. fileciteturn0file0L30-L42

------------------------------------------------------------------------

## 3.5 B/L Totals

``` yaml
total_packages_units:
  quantity: 1
  unit: "UNIT"

total_gross_weight_kg: 42000
```

------------------------------------------------------------------------

## 3.6 B/L Legal / Carriage Clause

The lower body contains a long standard carriage declaration beginning
with:

``` text
SHIPPED on board on apparent good order and condition...
```

The clause states, among other things, that: - weight, measure, marks,
numbers, quality, contents and value are accepted as unknown; - cargo is
carried to the port of discharge or as near as the vessel can safely
reach; - consignee receives the cargo subject to freight and other
applicable charges; - the merchant accepts the B/L stipulations; - one
original B/L must be surrendered for goods/delivery order; - the master
signs the stated number of originals.

This should be represented as a configurable `legal_text` /
`terms_and_conditions` field rather than hard-coded into application
logic. The complete sample clause is visible on the B/L.
fileciteturn0file0L43-L49

------------------------------------------------------------------------

## 3.7 B/L Issue / Freight Block

``` yaml
place_of_bl_issue: "DUBAI"
date_of_bl_issue: "29-AUG-26"
freight_charge: "FREIGHT PREPAID"
number_of_original_bl: 1
```

The bottom-right visual area contains:

``` text
STAMP & SIGNATURE
AS AGENT
```

For a digital system:

``` yaml
stamp:
  type: "company_stamp"
  placeholder: true

signature:
  type: "authorized_agent_signature"
  placeholder: true
```

Do not treat the visual stamp itself as business text. Store it as an
image/signature attachment or placeholder.

------------------------------------------------------------------------

# 4. MANIFEST

## 4.1 Purpose

Pages 2, 3 and 4 are **one manifest**, not three separate manifests.

Manifest identifier:

``` yaml
manifest_number: "DSMAN/KHO-26-006"
date: "05-Sep-26"
voyage: "02/26"
barge: "MEHDI 11"
tug: "LAYAN GULF"
port_of_loading: "HAMRIYA, DUBAI, UAE"
port_of_discharge: "KHORRAM SHAHR, PERSIAN GULF, IRAN"
```

The same manifest header is repeated on each page because the cargo
table continues across pages. fileciteturn0file0L61-L65

------------------------------------------------------------------------

## 4.2 Manifest Table Schema

The main columns are:

``` text
#
BL
DESCRIPTION OF GOODS
CONSIGNEE
SHIPPER
UNIT/PKGS
GROSS WEIGHT (KGS)
```

Each row is a cargo/manifest item linked to a B/L number.

Recommended normalized model:

``` yaml
manifest_item:
  sequence_no: integer
  bl_number: string
  description: string
  serial_or_chassis_no: string|null
  type: string|null
  capacity: string|null
  tariff_no: string|null
  hs_code: string|null
  consignee: string
  shipper: string
  unit_or_packages: number
  gross_weight_kg: number
```

Do not force every row to have `type`, `capacity`, `HS code`, or serial
number. Different cargo rows contain different subsets of these fields.

------------------------------------------------------------------------

# 5. MANIFEST SAMPLE DATA --- ROWS 1--14

The following records preserve the visible sample data.

### Row 1

``` yaml
sequence: 1
bl_number: "KHS/26-110"
description: "USED KOMATSU D155A-6 BULLDOZER"
chassis_no: "KMT0D105EMC088308"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 2

``` yaml
sequence: 2
bl_number: "KHS/26-111"
description: "USED KOMATSU D155-6 BULLDOZER"
chassis_no: "KMT0D105CNC088926"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 3

``` yaml
sequence: 3
bl_number: "KHS/26-112"
description: "USED KOMATSU D155-6 BULLDOZER"
chassis_no: "KMT0D105ANC088919"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 4

``` yaml
sequence: 4
bl_number: "KHS/26-113"
description: "USED KOMATSU D155-6 BULLDOZER"
chassis_no: "KMT0D105HMC088498"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 5

``` yaml
sequence: 5
bl_number: "KHS/26-114"
description: "USED KOMATSU WA470 WHEEL LOADER"
chassis_no: "KMTWA114CRA015704"
consignee: "JOINT MECHANIC CO"
shipper: "RAS AL KHAIMAH MACHINERIES LLC"
units_packages: 1
gross_weight_kg: 23000
```

### Row 6

``` yaml
sequence: 6
bl_number: "KHS/26-115"
description: "USED KOMATSU WA380-6 WHEEL LOADER"
chassis_no: "KMTWA095HSA070060"
consignee: "JOINT MECHANIC CO"
shipper: "GALADARI TRUCKS & HEAVY EQUIPMENTS CO"
units_packages: 1
gross_weight_kg: 17000
```

### Row 7

``` yaml
sequence: 7
bl_number: "KHS/26-116"
description: "USED KOMATSU D155A-2 BULLDOZER"
chassis_no: "KMT0D038P02072324"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 38000
```

### Row 8

``` yaml
sequence: 8
bl_number: "KHS/26-117"
description: "USED KOMATSU D155A-2 BULLDOZER"
chassis_no: "KMT0D038A02072735"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 38000
```

### Row 9

``` yaml
sequence: 9
bl_number: "KHS/26-118"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019T01024398"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 10

``` yaml
sequence: 10
bl_number: "KHS/26-119"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019C01025413"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 11

``` yaml
sequence: 11
bl_number: "KHS/26-120"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019K01025585"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 12

``` yaml
sequence: 12
bl_number: "KHS/26-121"
description: "USED KOMATSU GD705A-4 GRADER"
chassis_no: "KMTGD019C01025436"
consignee: "BADBAN ARVAND ROOD SHIPPING CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 22800
```

### Row 13

``` yaml
sequence: 13
bl_number: "KHS/26-122"
description: "ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)"
chassis_no: "K354-B00179"
type: "NK400-E"
capacity: "40 TONS"
tariff_no: "87051010"
consignee: "BANDAR RAHE CASPIAN CO"
shipper: "GRAND CRANE TRADING LLC"
units_packages: 1
gross_weight_kg: 38000
```

### Row 14

``` yaml
sequence: 14
bl_number: "KHS/26-123"
description: "ONE UNIT OF USED TEREX DEMAG ALL TERRAIN CRANE (TWO CABINS) + 5 PKGS"
chassis_no: "WMG5312604Z000059"
type: "AC200-1"
capacity: "200 TONS"
tariff_no: "87051010"
consignee: "SEDAGHAT TEJARAT ARVANDAN COMPANY"
shipper: "GRAND CRANE TRADING LLC"
units_packages: 6
gross_weight_kg: 75000
```

Rows 1--14 appear across the first manifest pages.
fileciteturn0file0L68-L113

------------------------------------------------------------------------

# 6. MANIFEST SAMPLE DATA --- ROWS 15--30

### Row 15

``` yaml
sequence: 15
bl_number: "KHS/26-124"
description: "ONE UNIT OF USED FORKLIFT KOMATSU"
ch_no: "M180-2337"
type: "FD200-7"
capacity: "20 TONS"
tariff_no: "84272012"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 1
gross_weight_kg: 29600
```

### Row 16

``` yaml
sequence: 16
bl_number: "KHS/26-125"
description: "ONE UNIT OF USED FORKLIFT KOMATSU"
ch_no: "M156-5736"
type: "FD100-7"
capacity: "10 TONS"
tariff_no: "84272012"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 1
gross_weight_kg: 16460
```

### Row 17

``` yaml
sequence: 17
bl_number: "KHS/26-126"
description: "ONE UNIT OF USED FORKLIFT KOMATSU"
ch_no: "M247-8352"
type: "FD150E-8"
capacity: "15 TONS"
tariff_no: "84272012"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 1
gross_weight_kg: 18600
```

### Row 18

``` yaml
sequence: 18
bl_number: "KHS/26-127"
description: "ONE UNIT OF USED KATO ROUGH TERRAIN CRANE (ONE CABIN) + 2 PKGS"
ch_no: "KR512-1279"
type: "KR50H"
capacity: "50 TONS"
tariff_no: "84264100"
consignee: "MR. HOJAT NASSIR"
shipper: "SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ"
units_packages: 3
gross_weight_kg: 38500
```

### Row 19

``` yaml
sequence: 19
bl_number: "KHS/26-128"
description: "USED WIRTGEN TCM TEXTURE CURING MACHINE FOR CONCRETE PAVEMENT"
ch_no: "02BA090C120180017"
hs_code: "84791029"
consignee: "KANDOVAN PARS CONSTRUCTION CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 10000
```

### Row 20

``` yaml
sequence: 20
bl_number: "KHS/26-129"
description: "USED WIRTGEN SP BETON PAVER + 38 PKGS"
ch_no: "05SP090119530034"
hs_code: "84791029"
consignee: "KANDOVAN PARS CONSTRUCTION CO"
shipper: "DUNA SHIPPING LLC"
units_packages: 39
gross_weight_kg: 38000
```

### Row 21

``` yaml
sequence: 21
bl_number: "KHS/26-130"
description: "USED WIRTGEN W200 ASPHALT PLANER"
ch_no: "0620140072860545"
hs_code: "84791090"
consignee: "MR. JALAL AMIRI SHAKIBA"
shipper: "DUNA SHIPPING LLC"
units_packages: 1
gross_weight_kg: 29000
```

### Row 22

``` yaml
sequence: 22
bl_number: "KHS/26-131"
description: "ONE UNIT OF USED TADANO ROUGH TERRAIN CRANE (ONE CABIN)"
ch_no: "TR351-0112"
type: "TR350M"
capacity: "35 TONS"
tariff_no: "84264100"
consignee: "MR. SHAHROKH SHAHVARAEI"
shipper: "GRAND CRANE TRADING LLC"
units_packages: 1
gross_weight_kg: 32000
```

### Row 23

``` yaml
sequence: 23
bl_number: "KHS/26-132"
description: "USED KOMATSU PC450-8 EXCAVATOR"
ch_no: "KMTPC192CGSCZ1093"
consignee: "KARIZ SHAHR MINES COMPANY (KASHCO)"
shipper: "ROSE MINE GENERAL TRADING LLC"
units_packages: 1
gross_weight_kg: 45000
```

### Row 24

``` yaml
sequence: 24
bl_number: "KHS/26-133"
description: "BRAND NEW MITSUBISHI OUTLANDER CAR"
ch_no: "JE4M4W186TZ713097"
consignee: "MR. IMAN BAYMANI NEZHAD"
shipper: "NEW AUTO FZCO"
units_packages: 1
gross_weight_kg: 1690
```

### Row 25

``` yaml
sequence: 25
bl_number: "KHS/26-134"
description: "BRAND NEW MITSUBISHI OUTLANDER CAR"
ch_no: "JE4MW182TZ713095"
consignee: "MR. SEYED ALI MOHAMMAD POUR"
shipper: "NEW AUTO FZCO"
units_packages: 1
gross_weight_kg: 1690
```

### Row 26

``` yaml
sequence: 26
bl_number: "KHS/26-135"
description: "USED KOMATSU PC400-8R EXCAVATOR"
ch_no: "KMTPC192PRMBK0526"
consignee: "KARIZ SHAHR MINES COMPANY (KASHCO)"
shipper: "ROSE MINE GENERAL TRADING LLC"
units_packages: 1
gross_weight_kg: 42000
```

### Row 27

``` yaml
sequence: 27
bl_number: "KHS/26-136"
description: "USED TADANO TR350 CRANE"
ch_no: "T0010013"
consignee: "KEYHAN TEJARAT MEHVAR ARVAND CO"
shipper: "MARINO USED HEAVY EQUIPMENT AND MACHINERY TRADING LLC"
units_packages: 1
gross_weight_kg: 30000
```

### Row 28

``` yaml
sequence: 28
bl_number: "KHS/26-137"
description: "NOV HYDRA RIG TRUCK MOUNTED NITROGEN PUMPING UNIT"
serial_no: "2H9NC3FA15C070159"
hs_code: "84135090"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 74750
```

### Row 29

``` yaml
sequence: 29
bl_number: "KHS/26-138"
description: "UNUSED CATERPILLAR 3412 GENERATOR + 4 PKGS"
serial_no: "CAT00000JRTY04568"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 5
gross_weight_kg: 15000
```

### Row 30

``` yaml
sequence: 30
bl_number: "KHS/26-138"
description: "UNUSED CATERPILLAR 3412 GENERATOR"
serial_no: "CAT00000VRTY04573"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 15000
```

These records are shown on manifest pages 3 and the beginning of page 4.
fileciteturn0file0L136-L201

**Important implementation detail:** B/L number `KHS/26-138` appears on
multiple manifest rows. Therefore `BL number` is not necessarily a
unique cargo-row identifier. A manifest must support multiple line items
belonging to one B/L.

------------------------------------------------------------------------

# 7. MANIFEST SAMPLE DATA --- ROWS 31--45

### Row 31

``` yaml
sequence: 31
bl_number: "KHS/26-139"
description: "CUMMINS 300 KVA GENERATOR"
serial_no: "0022"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 32

``` yaml
sequence: 32
bl_number: "KHS/26-139"
description: "CAT 3508 ENGINE"
serial_no: "0376"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 5000
```

### Row 33

``` yaml
sequence: 33
bl_number: "KHS/26-139"
description: "CUMMINS QSK60 ENGINE"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 5000
```

### Row 34

``` yaml
sequence: 34
bl_number: "KHS/26-139"
description: "LEROY ALTERNATOR ENGINE"
serial_no: "1364"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 35

``` yaml
sequence: 35
bl_number: "KHS/26-139"
description: "PEKINS 200 KVA GENERATOR"
serial_no: "2200"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 36

``` yaml
sequence: 36
bl_number: "KHS/26-139"
description: "CUMMINS 200 KVA GENERATOR"
serial_no: "0017"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 2000
```

### Row 37

``` yaml
sequence: 37
bl_number: "KHS/26-139"
description: "ATLAS COPCO GA132 ELECTRIC AIR COMPRESSOR"
serial_no: "9527"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 3000
```

### Row 38

``` yaml
sequence: 38
bl_number: "KHS/26-139"
description: "PALLETS INCLUDING 24 PCS NTN BALL BEARING"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 6
gross_weight_kg: 1500
```

### Row 39

``` yaml
sequence: 39
bl_number: "KHS/26-139"
description: "PCS UNUSED ELECTRODE AND WIRES"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 12
gross_weight_kg: 8000
```

### Row 40

``` yaml
sequence: 40
bl_number: "KHS/26-139"
description: "PALLET INCLUDING 8 PCS AIR HOSE"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 500
```

### Row 41

``` yaml
sequence: 41
bl_number: "KHS/26-139"
description: "PALLET INCLUDING 8 PCS CONVEYANCING HOSE AND REDUCER HOSE"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 100
```

### Row 42

``` yaml
sequence: 42
bl_number: "KHS/26-139"
description: "WOODEN BOX INCLUDING CLAMP COUPLING, CLEARING BALL, VBALL VALVE,"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 1
gross_weight_kg: 150
```

### Row 43

``` yaml
sequence: 43
bl_number: "KHS/26-139"
description: "WOODEN BOX INCLUDING PUMP(HUSKY 3300P)"
consignee: "TAHA POUYESH KISH"
shipper: "EHSAN INTERNATIONAL"
units_packages: 2
gross_weight_kg: 106
```

### Row 44

``` yaml
sequence: 44
bl_number: "NES260900266"
description: "1 UNIT KOMATSU WA380-6 WHEEL LOADER"
ch_no: "KMTWA095TTA070114"
consignee: "NIKAN SERAJ ARJANR ARVAND"
shipper: "ALDA CONSTRUCTION EQUIPMENT & MACHINERY TRADING LLC"
units_packages: 1
gross_weight_kg: 17520
```

### Row 45

``` yaml
sequence: 45
bl_number: "NES260900267"
description: "1 UNIT KOMATSU WA380-6 WHEEL LOADER"
ch_no: "KMTWA095PTA070115"
consignee: "NIKAN SERAJ ARJANR ARVAND"
shipper: "ALDA CONSTRUCTION EQUIPMENT & MACHINERY TRADING LLC"
units_packages: 1
gross_weight_kg: 17520
```

The final manifest rows and total are visible on page 4.
fileciteturn0file0L217-L238

------------------------------------------------------------------------

## 7.1 Manifest Totals

The document prints:

``` text
TOTAL 32 UNITS AND 79 PKGS
111 991,886
```

The exact visual arrangement suggests: - total cargo quantity:
`32 UNITS AND 79 PKGS` - total line count / item count: `111` - total
gross weight: `991,886` kg

Because the PDF extraction compresses the table footer, the application
should store totals as explicit typed fields rather than relying on text
positioning.

------------------------------------------------------------------------

## 7.2 Manifest Pagination

The three pages are one logical document.

Recommended implementation:

``` yaml
manifest:
  id: ...
  manifest_number: "DSMAN/KHO-26-006"
  pages:
    - page_number: 1
      items: [...]
    - page_number: 2
      items: [...]
    - page_number: 3
      items: [...]
```

However, the database should normally store one manifest and many items.
Page numbers should be generated during PDF rendering, not treated as
separate database documents.

------------------------------------------------------------------------

# 8. TAX INVOICE

## 8.1 Purpose

Page 5 is a **TAX INVOICE** for shipping-related charges.

Visible header fields include:

``` yaml
document_type: "TAX INVOICE"
invoice_number: "DSINV/26-172"
date: "6-Aug-26"
customer: "MR. SHAHOKH SHAHVARAEI"
boe_dec_bl: "KHS/26-108"
manifest_number: "DSKHS-26-005"
vessel: "DAHAR 10"
voyage: "02/26"
loading_port: "HAMRIYA"
discharge_port: "KHORRAM SHAHR"
currency: "AED"
```

The source also has fields labelled `BILL TO`, `TRN/ID`, `Address`,
`E-mail`, `Contact`, `Customer ID`, `Currency`, and `TRN No.`. Some are
blank in the sample. fileciteturn0file0L240-L268

------------------------------------------------------------------------

## 8.2 Tax Invoice Customer Block

Conceptual schema:

``` yaml
bill_to:
  name: "MR. SHAHOKH SHAHVARAEI"
  trn_id: null
  address: null
  email: null
  contact: null
  customer_id: null
  trn_no: null
```

Do not remove empty fields from the schema. They are legitimate document
fields even when the sample does not populate them.

------------------------------------------------------------------------

## 8.3 Tax Invoice Shipment Reference Block

``` yaml
shipment_reference:
  boe_dec_bl: "KHS/26-108"
  manifest_number: "DSKHS-26-005"
  vessel: "DAHAR 10"
  voyage: "02/26"
  loading_port: "HAMRIYA"
  discharge_port: "KHORRAM SHAHR"
```

------------------------------------------------------------------------

## 8.4 Tax Invoice Cargo Description

``` yaml
goods:
  description: "USED TRUCK CRANE + 1 PKG"
  chassis_no: "KG54W00127"
  hs_code: "87051010"
```

Source shows this description block on page 5.
fileciteturn0file0L270-L279

------------------------------------------------------------------------

## 8.5 Tax Invoice Charge Lines

Visible charge lines:

  ----------------------------------------------------------------------------------
  \#       Description             Qty  Unit Price      VAT % VAT Amount      Amount
                                               AED                       
  -------- ---------------- ---------- ----------- ---------- ---------- -----------
  1        FREIGHT CHARGE            1   22,020.00          0       0.00   22,020.00

  2        STORAGE CHARGE            1      650.00          0       0.00      650.00

  3        CUSTOMS                   1      200.00          0       0.00      200.00
           DOCUMENTATION                                                 

  4        TRANSPORTATION            1    4,500.00          0       0.00    4,500.00
           CHARGE FROM                                                   
           JEBEL ALI TO                                                  
           HAMRIYA                                                       
  ----------------------------------------------------------------------------------

The extracted PDF text places the lines in a non-linear order because of
table positioning, but the rendered page shows the four charge concepts
and the final total of AED 27,370.00.

Recommended data model:

``` yaml
invoice_lines:
  - line_no: 1
    description: "FREIGHT CHARGE"
    quantity: 1
    unit_price: 22020.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 22020.00

  - line_no: 2
    description: "STORAGE CHARGE"
    quantity: 1
    unit_price: 650.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 650.00

  - line_no: 3
    description: "CUSTOMS DOCUMENTATION"
    quantity: 1
    unit_price: 200.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 200.00

  - line_no: 4
    description: "TRANSPORTATION CHARGE FROM JEBEL ALI TO HAMRIYA"
    quantity: 1
    unit_price: 4500.00
    vat_rate: 0
    vat_amount: 0.00
    line_total: 4500.00
```

Totals:

``` yaml
subtotal: 27370.00
vat: 0.00
total_amount: 27370.00
currency: "AED"
```

The page also contains the note:

``` text
If any discrepancy is noticed in the invoice, kindly inform us in writing within 7 days; otherwise the above amount will be considered as correct.
```

Keep this as configurable invoice footer/legal text, not application
logic. fileciteturn0file0L256-L262

------------------------------------------------------------------------

## 8.6 Tax Invoice Signature

The document has:

``` text
Authorised Signatory
```

This should be an approval/signature placeholder.

------------------------------------------------------------------------

# 9. PROFORMA INVOICE

## 9.1 Purpose

Page 6 is a **PROFORMA INVOICE**. It is structurally more detailed than
the tax invoice because it describes seller/buyer, trade terms,
origin/destination and individual goods.

------------------------------------------------------------------------

## 9.2 Seller

``` yaml
seller:
  name: "DUNA SHIPPING LLC"
  address: "OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE"
  po_box: "63088"
  telephone: "0097142527707"
  mobile: "00971506445868"
  email: "info@dunashipping.com"
```

------------------------------------------------------------------------

## 9.3 Proforma Identification

``` yaml
proforma_invoice_number: "DSPRO/26-001"
proforma_invoice_date: "22-AUG-26"
validity: "1 MONTH"
country_of_beneficiary: "UAE"
```

------------------------------------------------------------------------

## 9.4 Buyer

``` yaml
buyer:
  name: "MR. RAMIN AHMADABADI"
```

------------------------------------------------------------------------

## 9.5 Trade / Commercial Information

``` yaml
country_of_origin: "INDIA"
terms_of_delivery: "FOB"
terms_of_payment: "100% ADVANCE PAYMENT"
transaction_currency: "AED"

freight_forwarder:
  name: "DUNA SHIPPING LLC"
  address: "DUBAI, UAE"

partial_shipment_allowed: true

port_of_discharge:
  name: "BANDAR ABBAS, PERSIAN GULF, IRAN"

final_delivery_place: "MAKU FREE ZONE"
```

These fields are visible in the proforma page.
fileciteturn0file0L281-L307

------------------------------------------------------------------------

# 10. PROFORMA INVOICE CARGO TABLE

## 10.1 Columns

The visible table conceptually contains:

``` text
No
Description
QTY
Net Wt (KGS)
G.Wt (KGS)
T.G Wt (KGS)
Unit Price (AED)
Amount (AED)
```

The extraction shows the quantity and weight columns spatially
separated, so the data model should keep each numeric value in a named
field rather than attempting to reconstruct columns from raw PDF text.

------------------------------------------------------------------------

## 10.2 Cargo Line 1

``` yaml
line_no: 1
description: "BRAND NEW HYUNDAI R340L EXCAVATOR"
year_made: 2026
quantity: 1
net_weight_kg: 9
gross_weight_kg: 9
total_gross_weight_kg: 9
unit_price_aed: 520000.00
amount_aed: 520000.00
```

## 10.3 Cargo Line 2

``` yaml
line_no: 2
description: "BRAND NEW HYDRAULIC BREAKER"
quantity: 1
net_weight_kg: 1000
gross_weight_kg: 1000
total_gross_weight_kg: 1000
unit_price_aed: 125000.00
amount_aed: 125000.00
```

## 10.4 Cargo Line 3

``` yaml
line_no: 3
description: "BRAND NEW QUICK QOUPLER"
quantity: 1
net_weight_kg: 1000
gross_weight_kg: 1000
total_gross_weight_kg: 1000
unit_price_aed: 45000.00
amount_aed: 45000.00
```

The source displays these three cargo descriptions and corresponding
quantities, weights and AED prices. fileciteturn0file0L308-L345

------------------------------------------------------------------------

## 10.5 Proforma Totals

``` yaml
subtotal_amount_aed: 690000.00
freight_charges_aed: 0.00
grand_total_aed: 690000.00
```

Source explicitly shows the subtotal, freight charge and grand total.
fileciteturn0file0L346-L351

------------------------------------------------------------------------

## 10.6 Proforma Certification

The bottom contains:

``` text
SEAL AND SIGNATURE:
MOHAMMAD KAZEM JOWKAR
```

and a certification statement that the proforma invoice shows the actual
price of the described goods, that no other proforma invoice has
been/will be issued, and that the particulars are true and correct.
fileciteturn0file0L352-L355

Model:

``` yaml
certification:
  text: "..."
  signer_name: "MOHAMMAD KAZEM JOWKAR"
  seal_placeholder: true
  signature_placeholder: true
```

------------------------------------------------------------------------

# 11. QUOTATION

## 11.1 Purpose

Page 7 is a **QUOTATION**, representing a price offer for
shipping/transport operations.

Header:

``` yaml
document_type: "QUOTATION"
quotation_number: "DSQUO/25-017"
date: "20-NOV-25"
customer:
  name: "MR. SHADMAN MEABADI"
```

Source confirms these fields. fileciteturn0file0L357-L364

------------------------------------------------------------------------

## 11.2 Quotation Introduction

The quotation contains a polite introductory text:

``` text
Dear Sir/ Madam

Thank you for your enquiry. We are pleased to enclose the applicable charges about 1 UNIT USED VOLVO FINISHER (as per packing list) for your consideration.

Kindly note that we are able to provide the following operations and rate.
```

This is not merely decoration: it communicates the commercial purpose
and cargo context. It should be modeled as editable template content if
quotations are generated by software.

------------------------------------------------------------------------

## 11.3 Quotation Table

Columns:

``` text
#
DESCRIPTION
YEAR
QTY
UNIT PRICE (AED)
AMOUNT (AED)
```

Sample lines:

### Line 1

``` yaml
line_no: 1
description: "LAND TRANSPORT CHARGE FROM DESIGNATED SHOWROOM TO DUBAI HAMRIYA PORT"
year: null
quantity: 1
unit_price_aed: 700.00
amount_aed: 700.00
```

### Line 2

``` yaml
line_no: 2
description: "FREIGHT CHARGE FROM HAMRIYA TO BUSHEHR"
year: null
quantity: 1
unit_price_aed: 6500.00
amount_aed: 6500.00
```

### Line 3

``` yaml
line_no: 3
description: "DOCUMENTATION AND EXIT CHARGE"
year: null
quantity: 1
unit_price_aed: 500.00
amount_aed: 500.00
```

Source shows the three service lines and their amounts.
fileciteturn0file0L366-L377

------------------------------------------------------------------------

## 11.4 Quotation Totals

``` yaml
subtotal_aed: 7700.00
other_charges_aed: 0.00
grand_total_aed: 7700.00
currency: "AED"
```

The document closes with:

``` text
FOR DUNA SHIPPING LLC
```

and a company stamp placeholder.

------------------------------------------------------------------------

# 12. LEDGER ACCOUNT

## 12.1 Purpose

Page 8 is a **Ledger Account** statement from:

``` text
RUKN ALHMREYA TRANSPORTL.L.C
AL NOKITA CUSTOMS BUILDING
DUBAI
Emirate : Dubai
TRN : 104652986100003

DUNA SHIPPING
Ledger Account
```

Period:

``` text
1-Jul-26 to 7-Sep-26
```

The account statement and date range are visible in the source.
fileciteturn0file0L381-L390

------------------------------------------------------------------------

## 12.2 Ledger Columns

``` text
Date
Particulars
Vch Type
Vch No.
Debit
Credit
Balance
```

Recommended schema:

``` yaml
ledger_entry:
  date: date
  particulars: string
  voucher_type: string
  voucher_number: string
  debit: decimal
  credit: decimal
  balance: decimal
  balance_side: "Dr" | "Cr"
```

------------------------------------------------------------------------

# 13. LEDGER SAMPLE ENTRIES

## Entry 1

``` yaml
date: "4-Jul-26"
particulars: |
  TRAILER & FORKLIFT WORK RECORDED FOR
  LAODING 1 TRAILER
  COUNTERWEIGHT & 4 TYRES IN ZAM ZAM BARGE
voucher_type: "Sales"
voucher_no: "1380"
debit: 115.50
credit: null
balance: 115.50
balance_side: "Dr"
```

## Entry 2

``` yaml
date: "25-Jul-26"
particulars: |
  CASH RECEIVED FROM DUNA SHIPPING AGT INV 1380
voucher_type: "Receipt"
voucher_no: "2026/446"
debit: null
credit: 120.00
balance: 4.50
balance_side: "Cr"
```

## Entry 3

``` yaml
date: "28-Jul-26"
particulars: |
  LOWBED CHARGES FOR SHIFTING 3 TRIP LOWBED
  WITH KOMATSU EXCAVATOR & 3 TRUCK SHIFTING
  TO DAHARA 10 SHIP
voucher_type: "Sales"
voucher_no: "1517"
debit: 1102.50
credit: null
balance: 1098.00
balance_side: "Dr"
```

## Entry 4

``` yaml
date: "30-Jul-26"
particulars: |
  TRAILER CHARGES FOR SHIFTING 2 TRAILER
  HEAVY MACHINERY PKGS - BARGE DAHAR 10
voucher_type: "Sales"
voucher_no: "1526"
debit: 420.00
credit: null
balance: 1518.00
balance_side: "Dr"
```

## Entry 5

``` yaml
date: "6-Aug-26"
particulars: |
  CASH RECEIVED FROM DUNA SHIPPING AGT
  INV 1517, 1526
voucher_type: "Receipt"
voucher_no: "2026/477"
debit: null
credit: 1600.00
balance: 82.00
balance_side: "Cr"
```

## Entry 6

``` yaml
date: "2-Sep-26"
particulars: |
  LOWBED CHARGES FOR SHIFTING 6 KOMATSU EXCAVATOR
  & 2 PC EXCAVATOR FROM A09 YRD TO KHORAMSHAHR 1051
voucher_type: "Sales"
voucher_no: "1703"
debit: 2100.00
credit: null
balance: 2018.00
balance_side: "Dr"
```

## Entry 7

``` yaml
date: "3-Sep-26"
particulars: |
  TRAILER & FORKLIFT CHARGES FOR LOADING & SHIFTING
  CARGO TO KHORAMSHAHR BARGE
voucher_type: "Sales"
voucher_no: "1708"
debit: 630.00
credit: null
balance: 2648.00
balance_side: "Dr"
```

## Entry 8

``` yaml
date: "4-Sep-26"
particulars: |
  TRAILER CHARGES FOR SHIFITNG 3 TRAILER PKGS
  ON KHORAMSHHAHR BARGE 1051 & 1 TRAILER
  MACHINERY LOAD ON MEHDI 11
voucher_type: "Sales"
voucher_no: "1717"
debit: 535.50
credit: null
balance: 3183.50
balance_side: "Dr"
```

## Entry 9

``` yaml
date: "7-Sep-26"
particulars: |
  CASH RECEIVED FROM DUNA SHIPPING
voucher_type: "Receipt"
voucher_no: "2026/532"
debit: null
credit: 2500.00
balance: 683.50
balance_side: "Dr"
```

The complete ledger sequence and closing balance are visible in the
source. fileciteturn0file0L391-L444

------------------------------------------------------------------------

## 13.1 Ledger Totals

The statement footer shows:

``` yaml
total_debit: 4903.50
total_credit: 4220.00
closing_balance: 683.50
closing_balance_side: "Dr"
```

The arithmetic relationship is:

``` text
4,903.50 - 4,220.00 = 683.50
```

------------------------------------------------------------------------

# 14. RECEIPT VOUCHER

## 14.1 Important PDF Detail

The last page is an **image-based receipt voucher** and did not expose
normal text in the PDF text layer. The rendered page shows a receipt
voucher from:

``` text
RUKN ALHMREYA TRANSPORTL.L.C
AL NOKITA CUSTOMS BUILDING
DUBAI
Emirate: Dubai
```

This page should therefore be treated as a separate document type and
not assumed to be missing merely because ordinary text extraction
returns no text.

------------------------------------------------------------------------

## 14.2 Voucher Header

Visible concepts:

``` yaml
document_type: "Receipt Voucher"
voucher_number: "477"
date: "6-Aug-26"
```

The page title area visually reads `Receipt 2026 Voucher`.

------------------------------------------------------------------------

## 14.3 Account and Amount

``` yaml
account: "DUNA SHIPPING"
amount: 1600.00
currency: "AED"
```

The amount appears as:

``` text
AED 1,600.00
```

------------------------------------------------------------------------

## 14.4 Applied References

The voucher breaks the receipt into references:

``` yaml
applications:
  - reference: "1517"
    amount: 1102.50
    side: "Cr"

  - reference: "1526"
    amount: 420.00
    side: "Cr"

  - reference: "477"
    label: "Advance"
    amount: 77.50
    side: "Cr"
```

Total:

``` text
1102.50 + 420.00 + 77.50 = 1600.00
```

This relationship is important for accounting software: a receipt can be
allocated across multiple invoices/vouchers plus an advance.

------------------------------------------------------------------------

## 14.5 Payment Method

The voucher shows:

``` yaml
through:
  method: "Cash"
```

------------------------------------------------------------------------

## 14.6 On Account Of

The visible description is approximately:

``` text
CASH RECEIVED FROM DUNA SHIPPING AGT
INV 1517, 1526
```

Recommended structured representation:

``` yaml
on_account_of:
  text: "CASH RECEIVED FROM DUNA SHIPPING AGT INV 1517, 1526"
  related_references:
    - "1517"
    - "1526"
```

------------------------------------------------------------------------

## 14.7 Amount in Words

The voucher contains:

``` text
DIRHAMS One Thousand Six Hundred Only
```

Recommended field:

``` yaml
amount_in_words: "DIRHAMS One Thousand Six Hundred Only"
```

------------------------------------------------------------------------

## 14.8 Approval

Bottom area contains:

``` text
Authorised Signatory
```

plus a handwritten/signature visual and a stamp.

Model:

``` yaml
approval:
  authorized_signatory_placeholder: true
  signature_image: true
  company_stamp_image: true
```

The actual signature/stamp should be treated as an image attachment or
visual placeholder, not OCR business data.

------------------------------------------------------------------------

# 15. SHARED COMPANY / PARTY DATA

Several documents repeat Duna Shipping information.

A reusable company record should contain:

``` yaml
company:
  name: "DUNA SHIPPING LLC"
  office:
    address: "OFFICE NO 203, AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE"
    po_box: "63088"
  telephone: "0097142527707"
  mobile: "00971506445868"
  email: "info@dunashipping.com"
  website: "www.dunashipping.com"
```

Another issuer appears on the ledger/voucher:

``` yaml
company:
  name: "RUKN ALHMREYA TRANSPORTL.L.C"
  address: "AL NOKITA CUSTOMS BUILDING, DUBAI"
  emirate: "Dubai"
  trn: "104652986100003"
```

Do not merge these into one company record merely because they appear in
the same PDF.

------------------------------------------------------------------------

# 16. FIELD TYPES AND NORMALIZATION

For a robust ERP, use typed fields.

## Identifiers

Use `string`, not integer:

``` text
KHS/26-110
DSMAN/KHO-26-006
DSINV/26-172
DSPRO/26-001
DSQUO/25-017
NES260900266
```

Identifiers can contain letters, `/`, `-`, and leading zeros.

## Money

Use fixed decimal numeric types:

``` text
DECIMAL(18,2)
```

Examples:

``` text
22020.00
4500.00
27370.00
690000.00
7700.00
```

Never store monetary values as display-formatted strings.

## Weight

Use decimal:

``` text
DECIMAL(18,3)
```

with explicit unit:

``` text
kg
```

## Quantity

Use decimal or integer depending on business requirements because
packages may be non-integer in future systems, although all sample
quantities are whole numbers.

## Dates

Store actual date values and render them in document-specific formats:

``` text
2026-08-29 -> 29-AUG-26
2026-09-05 -> 05-Sep-26
```

Do not store the formatted string as the primary date.

------------------------------------------------------------------------

# 17. CARGO DESCRIPTION PARSING

Cargo descriptions in the source are semi-structured.

Examples:

``` text
USED KOMATSU D155A-6 BULLDOZER
CH.NO: KMT0D105EMC088308

ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)
CH.NO: K354-B00179
TYPE: NK400-E
CAPACITY: 40 TONS
TARIFF NO: 87051010
```

Therefore, a good internal representation is:

``` yaml
cargo:
  condition: "USED"
  brand: "KOMATSU"
  model: "D155A-6"
  category: "BULLDOZER"
  serial_or_chassis_no: "KMT0D105EMC088308"
  type: null
  capacity_tons: null
  hs_code: null
  tariff_no: null
  free_text_description: "USED KOMATSU D155A-6 BULLDOZER"
```

For the crane:

``` yaml
cargo:
  condition: "USED"
  brand: null
  model: null
  category: "HYDRAULIC TRUCK CRANE"
  cabin_count: 2
  serial_or_chassis_no: "K354-B00179"
  type: "NK400-E"
  capacity_tons: 40
  tariff_no: "87051010"
  free_text_description: "ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)"
```

However, **do not force parsing when the source does not provide enough
information**. Preserve the original description as `raw_description`
even when structured fields are extracted.

------------------------------------------------------------------------

# 18. DOCUMENT RELATIONSHIPS

A useful ERP relationship graph is:

``` text
PARTIES
  ├── Shipper
  ├── Consignee
  ├── Notify Party
  ├── Destination Agent
  ├── Buyer
  └── Seller

SHIPMENT
  ├── Vessel
  ├── Voyage
  ├── Loading Port
  ├── Discharge Port
  └── Cargo

DOCUMENTS
  ├── B/L
  │    └── Cargo
  ├── Manifest
  │    └── Manifest Items -> B/L
  ├── Tax Invoice
  │    ├── Shipment references
  │    └── Charge Lines
  ├── Proforma Invoice
  │    ├── Buyer/Seller
  │    └── Goods Lines
  ├── Quotation
  │    └── Service Lines
  ├── Ledger Entries
  └── Receipt Voucher
       └── Allocations -> Ledger/Invoice/Voucher references
```

------------------------------------------------------------------------

# 19. WHAT SHOULD BE STORED AS DATA VS. VISUAL ASSETS

## Store as real structured data

-   Document number
-   Document date
-   Party names
-   Addresses
-   Contact information
-   Vessel
-   Voyage
-   Loading port
-   Discharge port
-   Cargo descriptions
-   Serial/chassis numbers
-   HS/tariff codes
-   Quantity
-   Packages
-   Gross/net weight
-   Unit price
-   Amount
-   VAT
-   Currency
-   Totals
-   Payment terms
-   Delivery terms
-   Country of origin
-   Final delivery place
-   Invoice references
-   Voucher references
-   Ledger debit/credit
-   Running balance
-   Legal/footer text
-   Amount in words
-   Signatory name

## Store as image/file attachments or placeholders

-   Company logo
-   Round company stamp
-   Handwritten signature
-   Seal/signature graphic
-   Decorative watermark
-   Visual letterhead background

For the implementation, a document can have:

``` yaml
visual_assets:
  - type: "logo"
    required: true
  - type: "stamp"
    required: false
  - type: "signature"
    required: false
  - type: "watermark"
    required: false
```

The system should not depend on OCR text from a stamp or signature.

------------------------------------------------------------------------

# 20. DOCUMENT TEMPLATING RECOMMENDATION

The PDF examples should be treated as **reference templates**, not as
rigid pixel-level requirements.

For example, a B/L can be implemented as:

``` text
Header
  ├── Shipper
  ├── B/L number
  ├── Consignee
  ├── Notify party
  └── Agent

Routing
  ├── Vessel
  ├── Voyage
  ├── Port of loading
  └── Port of discharge

Cargo
  └── Dynamic cargo table

Totals
Legal terms
Issue/freight block
Approval/stamp
```

A manifest:

``` text
Header
Dynamic multi-row cargo table
Automatic pagination
Totals
Stamp/footer
```

A tax invoice:

``` text
Billing party
Invoice metadata
Shipment references
Goods description
Charge lines
Subtotal/VAT/total
Terms note
Signature
```

A proforma invoice:

``` text
Seller / Buyer
Commercial terms
Shipping terms
Goods table
Subtotal/freight/grand total
Certification
Seal/signature
```

A quotation:

``` text
Customer
Introduction
Service-price table
Subtotal
Other charges
Grand total
Company approval
```

A ledger:

``` text
Account header
Period
Transaction table
Running balance
Closing balance
```

A receipt voucher:

``` text
Voucher header
Account
Allocation/reference rows
Payment method
Narrative
Amount in words
Total
Signature/stamp
```

------------------------------------------------------------------------

# 21. IMPORTANT EDGE CASES REVEALED BY THE SAMPLE

## 21.1 One B/L can have multiple manifest rows

`KHS/26-139` is repeated for rows 31--43.

Therefore:

``` text
B/L 1 -> many manifest items
```

not:

``` text
B/L 1 -> exactly one manifest item
```

## 21.2 A manifest can contain multiple package types

Examples include:

``` text
1 unit
+ 5 packages
+ 38 packages
+ 2 packages
```

The application should distinguish:

``` yaml
unit_quantity: 1
package_quantity: 5
```

where needed rather than storing everything as one ambiguous integer.

## 21.3 Cargo identifiers vary

The sample uses:

``` text
CH.NO
CH NO
CH.NO.
CH. NO.
S.NO
```

These should normalize to a common conceptual field such as:

``` text
serial_or_chassis_no
```

while preserving the original label if exact reproduction is required.

## 21.4 HS Code and Tariff No are not always present

Do not require either field on every cargo line.

## 21.5 Some party names contain people and companies

Examples:

``` text
MR. HOJAT NASSIR
MR. JALAL AMIRI SHAKIBA
JOINT MECHANIC CO
DUNA SHIPPING LLC
```

A party model should support both individual and organization names.

## 21.6 Some document fields are intentionally blank

For example, the tax invoice has labels for TRN, address, email, contact
and customer ID, but the sample does not populate all of them.

Blank source fields should remain representable.

------------------------------------------------------------------------

# 22. AI / LLM EXTRACTION CONTRACT

If an AI model receives a document image/PDF, it should extract
according to this rule:

1.  Identify the document type first.
2.  Identify the document number.
3.  Identify header metadata.
4.  Identify parties and roles.
5.  Identify shipment/voyage information.
6.  Identify cargo/service lines.
7.  Preserve exact original text.
8.  Extract structured values where unambiguous.
9.  Preserve unknown/blank values as `null`.
10. Never invent missing information.
11. Keep stamps/signatures/logos as visual assets/placeholders.
12. Keep repeated records as separate line items.
13. Keep references between documents.
14. Preserve original number formatting in a `raw_value` field when
    exact display matters.
15. Preserve page and line-item order where possible.

Recommended extraction shape:

``` yaml
document:
  type: "bill_of_lading"
  document_number: "KHS/26-110"
  date: "2026-08-29"

parties:
  shipper: {...}
  consignee: {...}
  notify_party: {...}
  destination_agent: {...}

shipment:
  vessel: "MEHDI 11"
  voyage: "02/26"
  port_of_loading: "HAMRIYA PORT, DUBAI, UAE"
  port_of_discharge: "KHORRAM SHAHR, PERSIAN GULF, IRAN"

cargo_items:
  - ...

totals:
  ...

terms:
  ...

visual_assets:
  - ...
```

------------------------------------------------------------------------

# 23. EXACT-VALUE PRESERVATION RULE

For financial and identifier fields, a production system should ideally
preserve both normalized and display values:

``` yaml
amount:
  value: 27370.00
  currency: "AED"
  display: "AED 27,370.00"
```

For identifiers:

``` yaml
bl_number:
  value: "KHS/26-110"
  display: "KHS/26-110"
```

For dates:

``` yaml
date:
  iso: "2026-08-29"
  display: "29-AUG-26"
```

This makes it possible to: - search accurately, - calculate
accurately, - regenerate the document, - preserve the source
appearance, - and allow an AI model to understand both meaning and
original presentation.

------------------------------------------------------------------------

# 24. FINAL IMPLEMENTATION CHECKLIST

A system implementing these samples should support:

-   [ ] B/L creation
-   [ ] B/L multiple cargo items
-   [ ] B/L shipper/consignee/notify/agent
-   [ ] B/L vessel/voyage/ports
-   [ ] B/L legal text
-   [ ] B/L freight status
-   [ ] B/L originals count
-   [ ] Manifest creation
-   [ ] Manifest spanning multiple PDF pages
-   [ ] Manifest many-to-one relation to B/L
-   [ ] Manifest serial/chassis numbers
-   [ ] Manifest HS/tariff codes
-   [ ] Manifest units/packages
-   [ ] Manifest total weight
-   [ ] Tax invoice
-   [ ] VAT rate and amount
-   [ ] Tax invoice shipment references
-   [ ] Proforma invoice
-   [ ] Seller/buyer
-   [ ] Country of origin
-   [ ] Delivery/payment terms
-   [ ] Freight and final delivery
-   [ ] Proforma cargo weights and values
-   [ ] Quotation
-   [ ] Quotation service lines
-   [ ] Ledger account
-   [ ] Running balance
-   [ ] Receipt voucher
-   [ ] Receipt allocation across multiple references
-   [ ] Cash/bank payment method
-   [ ] Amount in words
-   [ ] Signatures
-   [ ] Stamps
-   [ ] Logos
-   [ ] Blank optional fields
-   [ ] Original raw text preservation
-   [ ] Structured normalized data
-   [ ] PDF regeneration
-   [ ] AI-readable JSON representation
-   [ ] Document-to-document references

------------------------------------------------------------------------

# 25. Canonical Document Type Names

For software/database use, use stable machine names:

``` text
bill_of_lading
manifest
tax_invoice
proforma_invoice
quotation
ledger_account
receipt_voucher
```

Human-readable labels:

``` text
Bill of Lading
Manifest
Tax Invoice
Proforma Invoice
Quotation
Ledger Account
Receipt Voucher
```

------------------------------------------------------------------------

# 26. Source Fidelity Note

This specification is derived from the supplied PDF. It is intentionally
focused on **what the sample documents actually contain** and how those
fields can be represented in a flexible software model.

Where the source contains a stamp, handwritten signature, logo or
decorative graphic, this document identifies the existence and role of
that visual element rather than attempting to convert it into ordinary
business text.

Where a source field is blank, it is represented as `null`/empty instead
of being invented.

Where PDF text extraction loses table geometry, the semantic table
structure is described explicitly so an implementation or AI model does
not mistake reading order for business-field order.

The objective is that a developer or AI model can use this Markdown as a
reference specification and understand the **document type, field
structure, data relationships, sample values, optional fields, repeated
rows, financial structures, pagination and visual-only elements**
without needing to infer the entire business structure from raw PDF text
alone.
