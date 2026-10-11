# Terminology Glossary

> **Purpose:** Map the employer's vocabulary — including words that are his own, mis-heard, or used
> in a company-specific sense — to the domain concepts and, where one exists, to the current
> system's entity or field.
>
> Two warnings for future agents:
> 1. The employer is **not** describing a data model. He is describing a business. Words like
>    "Cargo", "Shipment", "Job" and "goods" are used interchangeably in places.
> 2. Several terms below (Nagle, ETOZ, EXID, BCC, R.D.A.) have **no standard expansion** and must not
>    be "corrected" into a guess.

---

## 1. Parties — the four-way distinction

| Term (as spoken) | Meaning in Duna's business | Appears on documents? | Current system entity |
|---|---|---|---|
| **Customer** | Duna's internal commercial counterparty: the party Duna invoices and whose ledger Duna keeps. May be a natural person or a company. Usually **not** the Shipper or the Consignee. | Usually **no** | `Customer` |
| **Shipper** | The documentary shipper on the Bill of Lading — in Duna's words, "that selling company". Chosen by the customer. | Yes | `Shipper` |
| **Consignee** | The documentary consignee on the B/L — whoever the destination party nominates. | Yes | `Consignee` |
| **Agent** | Duna's representative at a **destination** port. Holds the documents until release. Gets a portal login scoped to their own destination. | Yes (as "Carrier's Agent") | `Agent` + `AgentDestination` |
| **Notify Party** | Standard B/L notify party. | Yes | `BillOfLading.notifyParty`, `Manifest.notifyParty` |
| **Forwarder / partner company** | Another company whose cargo is co-loaded onto a Duna vessel and whose B/L (different format, different numbering) must still go on Duna's single manifest. | Yes | *No dedicated entity — see `open-questions.md` and `../04-business-analysis/`* |

> The single most important sentence in the transcripts:
> *"Customer is an Internal thing — meaning it is internal, and it is only for us."* (EMP-431)

---

## 2. Cargo and units

| Term | Meaning | Notes |
|---|---|---|
| **Cargo** | A registered unit of goods — typically a machine, but can be a container or general goods. The employer also says "goods", "commodity", "Shipment", "machine" for the same thing. | Current entity: `Cargo` |
| **Nagle** (نقل) | Loose / accompanying pieces that are **not** complete machines — pallets, boxes, bundles, spare parts. Counted **separately** from machines. | "1 machine plus 2 Nagle". Current fields: `Cargo.packages` (comment says "package / naggle count"), `Cargo.packageType` (comment: "e.g. NAGGLE, BUNDLE, LOOSE"). |
| **Units** | Count of complete machines. | `Cargo.quantity` / `units` |
| **Packages** | Count of Nagle / packages. | `Cargo.packages` |
| **Chassis Number** | Machine chassis/serial identifier; the employer's primary physical identifier for a machine. | `Cargo.chassisNumber` (note: `Cargo.chassis` also exists — see §6) |
| **Serial Number** | Secondary machine identifier, distinct from chassis in the employer's field list. | `Cargo.serialNumber` |
| **CBM** | Cubic measurement / volume on the B/L. | `BillOfLading.totalVolume` |
| **Weight Unit** | Mainly Kilogram. | `Cargo.weightUnit` (`KG` / `MT`) |

---

## 3. Places and assets

| Term | Meaning | Notes |
|---|---|---|
| **Port** | A seaport, recorded as Port name, City, Country + a mandatory abbreviation. | `Port` |
| **Abbreviation / Code** | Short port code (`HAM` for Hamriyah) used in space-constrained views like the Load List. | `Port.abbreviation` |
| **Yard** | A storage area inside a port. Defined only by "which port" + "name". | `Yard` |
| **Yard Inventory / warehouse inventory** | The live list of cargo sitting in yards awaiting loading. | `YardInventory` |
| **Vessel** | A ship. Two shapes: **Tug & Barge** (a tug plus a barge, two names) or **Vessel / Landing Craft** (one name). | `Vessel`, `VesselType` (TUG / BARGE / LANDING_CRAFT) |
| **IMO Number** | International Maritime Organization number; optional. | `Vessel.imoNumber`, `Manifest.vesselImo`, `BillOfLading.vesselImo` |
| **Charter types** | Owned, voyage charter (per trip), time charter (per period). | Background only; not modelled. |
| **Operator** | The yard crew who physically load the vessel. They receive the printed Load List and report back what actually got loaded. | Not a system role in the transcripts. |
| **Berth** | Where the vessel ties up inside the port. | Mentioned once (EMP-504). |
| **Low-bed / low-bed trailer** | The trailer used to move machinery overland between ports (e.g. Jebel Ali → Hamriyah). | A cost category (REQ-132). |

---

## 4. Movements and documents

| Term | Meaning | Notes |
|---|---|---|
| **ETOZ / ETDZ** | End-to-end handling: Duna collects the goods at origin, clears customs, moves it, and delivers it. Spelled two different ways in the transcripts. The employer never expands the acronym. | Costed by a Job Number (REQ-131). |
| **Job / Job Number** | A running cost note for one machine / cargo / shipment, opened when work starts and accumulating every expense until delivery. | `Job` + `JobCostItem` |
| **Load List / Loading List** | The per-vessel pick list printed for the operators; also used by the employer to mean the yard inventory itself. **Two senses — check context.** | `LoadList` |
| **Inspection** | Customs inspection of the cargo, booked and paid for in advance. **Done** is a hard gate for Load List inclusion. | `Inspection` |
| **Bill of Lading (B/L)** | Standard marine B/L, one per loaded cargo item. Draft (watermarked) → Final. | `BillOfLading` |
| **DRAFT watermark** | The visual mark on a draft B/L. | `BillOfLading.status = DRAFT` |
| **Manifest** | The voyage cargo list Duna issues to the captain and to the destination agent. Consolidates the issued B/Ls. **Only one per voyage, and it must also carry partner/forwarder B/Ls.** | `Manifest` + `ManifestItem` |
| **Invoice** | In Duna's usage, always a **Tax Invoice** (UAE legal form), issued to the Customer. | `Invoice` |
| **Statement** | The employer uses "statement" (صورتحساب) to mean **the invoice document itself**, not a statement of account. This is a recurring translation trap. | See also "Ledger Statement" below. |
| **Proforma Invoice (PI)** | A proforma document. | `Proforma` |
| **Quotation** | A price quotation. | `Quotation` |
| **Release Order (R/O)** | Duna's authorisation to the destination agent to hand over the documents, issued after discharge. Records Paid / Partial / Unpaid. | `ReleaseOrder` |
| **Delivery Order (D/O)** | Issued to the customer after Duna discharges inbound cargo at its own port, so the consignee can clear and collect. | `DeliveryOrder` |
| **Payment Voucher** | Records money Duna **pays out**. Requires ID-card capture + recipient signature. | `Voucher` (`type = PAYMENT`) |
| **Receipt Voucher** | Records money Duna **receives**. | `Voucher` (`type = RECEIPT`) |
| **Ledger / Sub Customer / Customer Ledger** | The running Debit/Credit account for a party. | Derived; `Voucher` + `Invoice` feed it |
| **Ledger Statement** | A date-ranged statement of a customer's ledger — this *is* a statement of account. | Derived from `Ledger` |
| **General Journal** | Direct postings onto a party's ledger that are not invoices or vouchers (e.g. loans). | *Not currently modelled as such* |
| **Salary Slip** | The monthly payslip, carrying ID-card images and an employee signature. | `SalaryRecord` |
| **Warehouse receipt** | Issued at the destination when cargo is discharged; documents stay with the agent until release. | Mentioned once (EMP-675); not modelled. |
| **Company Archive** | A UI title dictated by the employer with no further detail. | *Not modelled* — see `open-questions.md` ARCH-01 |

---

## 5. Money, status and control words

| Term | Meaning |
|---|---|
| **Debit** | What the customer **owes** Duna. An issued invoice posts as Debit. |
| **Credit** | What Duna **owes** the customer, or what the customer has paid. A payment posts as Credit. |
| **Balance** | Debit − Credit. |
| **Sales** | The label the employer uses for the invoice side of the ledger. |
| **Paid / Partial Payment / Unpaid** | Invoice payment status. Also used for the release condition. |
| **Credit (as in "on credit")** | Released without payment — the customer pays later. **Do not confuse with the accounting "Credit".** The employer uses one word for both senses. |
| **Advance** | Money received before it is allocated — the real Receipt Voucher shows an "Advance" line. |
| **VAT / Value Added Tax** | Captured **per invoice line** as a percentage. |
| **TRN** | Tax Registration Number. Appears on the Tax Invoice header. The employer explicitly does **not** want it on Customer. |
| **Subtotal / VAT / Total Amount** | The three invoice totals. |
| **Alarm / Notice** | The employer's word for an alert. Two are requested: overdue invoice, unpaid release. |
| **Filter** | Used both for list filtering and for selecting report ranges ("using a few Filters we can bring out that P&L"). |
| **Starred** | The employer's word for a mandatory field. |
| **Option** | The employer's word for a field, a form control, or a feature — context-dependent. |
| **Status** | Used for cargo document status, invoice status, release status and customer status — four different concepts. |

---

## 6. Translation traps — read before translating anything

| Persian / spoken | Literal rendering | Correct rendering |
|---|---|---|
| صورتحساب | "statement" | **Invoice** (the document). "Ledger Statement" (گردش حساب) is the statement of account. |
| بارنامه | "waybill" | **Bill of Lading** |
| مانیفست | — | **Manifest** |
| نقل | "transfer / confectionery" | **Nagle — loose accompanying pieces.** Never translate it as "transfer". |
| انبار | "warehouse" | **Yard** in Duna's usage (an open storage area inside a port). |
| موجودی انبار | "warehouse stock" | **Yard Inventory** |
| لیست بارگیری | "loading list" | **Load List** — but the employer also uses it to mean the yard inventory itself. Check context. |
| کار / شماره کار | "work / work number" | **Job / Job Number** |
| صورتجلسه / بازرسی | — | **Inspection** |
| ترخیص | "clearance" | **Customs clearance** |
| حواله / ترخیصیه | — | **Delivery Order** |
| آزادسازی | "releasing" | **Release (Order)** |
| قبض پرداخت / قبض دریافت | "payment receipt / receipt" | **Payment Voucher / Receipt Voucher** |
| دفتر کل / دفتر معین | "general ledger / subsidiary ledger" | **Ledger**; the employer uses both for the same customer account. |
| روزنامه | "journal/newspaper" | **Journal** (General Journal) |
| حقوق / فیش حقوقی | "salary" | **Salary / Salary Slip** |
| مهر | "stamp/seal" | **Stamp** — and note the rule that Print must *omit* it. |
| فرمت | "format" | **Template** in most usages. |
| ستاره‌دار | "starred" | **Mandatory** |

---

## 7. Abbreviations seen in the real documents

See [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md)
for the evidence.

| Abbrev | Expansion | Source |
|---|---|---|
| `KHS` | Khorramshahr | B/L numbers `KHS/26-` |
| `RJS` | Rajaee (Bandar Abbas) | Employer example `RJS/26-` |
| `HAM` | Hamriyah | Employer example |
| `DSINV` | Duna Shipping Invoice | Tax Invoice `DSINV/26-172` |
| `DSMAN` | Duna Shipping Manifest | Manifest `DSMAN/KHO-26-006` |
| `DSKHS` | Duna Shipping, Khorramshahr | Manifest reference on the Tax Invoice |
| `DSPRO` | Duna Shipping Proforma | Proforma `DSPRO/26-001` |
| `DSQUO` | Duna Shipping Quotation | Quotation `DSQUO/25-017` |
| `TRN` | Tax Registration Number | Tax Invoice header |
| `POD` | Port of Discharge / proof of delivery — **ambiguous** | Shipment docs |
| `POL` | Port of Loading | Shipment docs |
| `CBM` | Cubic metre | B/L / Manifest |
| `IMO` | International Maritime Organization (number) | Vessel |
