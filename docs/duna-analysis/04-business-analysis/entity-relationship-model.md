# Entity–Relationship Model

> Three views of the same domain:
> 1. **§2 — the target model** (what the business needs, per the employer)
> 2. **§3 — the current system's model** (what `prisma/schema.prisma` actually has, 62 models / 25 enums)
> 3. **§4 — the legacy model** (what the Laravel system had, 23 models)
>
> Then §5 maps them and §6 lists what is still missing.

---

## 1. How to read this file

| Symbol | Meaning |
|---|---|
| ✅ | Entity exists in that system |
| ⚠️ | Exists but wrong / partial / defective |
| ❌ | Does not exist |

---

## 2. Target model (from the employer's requirements)

```
                       ┌──────────────┐
                       │    Port      │  name, city, country, abbreviation
                       └──────┬───────┘
                              │ 1..n
                       ┌──────▼───────┐
                       │     Yard     │  port-scoped storage location
                       └──────┬───────┘
                              │
┌──────────────┐       ┌──────▼───────────────────────────────────┐
│   Customer   │ 1..n  │              Cargo                       │
│  name only   ├──────►│  chassis no., qty, description,          │
│  mandatory   │       │  net/gross weight, measurement,          │
└──────┬───────┘       │  arrival date, loading date              │
       │               │  inspection status · loading status      │
       │               └───┬───────────┬──────────┬───────────────┘
       │                   │           │          │
       │           ┌───────▼──┐  ┌─────▼─────┐  ┌─▼──────────────┐
       │           │  Cargo   │  │Inspection │  │  LoadListItem  │
       │           │Comment   │  │ booked /  │  │  (selection)   │
       │           │ (→ acct) │  │ paid /    │  └───┬────────────┘
       │           └──────────┘  │ result    │      │
       │                         └───────────┘  ┌───▼────────────┐
       │                                        │   LoadList     │
       │                                        │ (per voyage)   │
       │                                        └───┬────────────┘
       │                                            │
       │   ┌──────────┐      ┌──────────┐      ┌─────▼──────────┐
       │   │  Vessel  │ 1..n │  Voyage  │ 1..1 │    Manifest    │
       │   │ barge +  ├─────►│  nn/yy   ├──────►│  consolidation│
       │   │ tug      │      └──────────┘      └─────▲──────────┘
       │   └──────────┘                              │
       │                                        ┌────┴──────────┐
       │                                        │ BillOfLading  │
       │   ┌──────────┐  ┌──────────┐           │ draft → final │
       ├───┤  Shipper ├─►│Consignee │◄──────────┤ released?     │
       │   └──────────┘  └──────────┘           └────┬──────────┘
       │   ┌──────────┐                              │
       └───┤  Agent   │ (destination-scoped)         │
           └──────────┘                              │
       ┌───────────────┐   ┌──────────────┐     ┌─────▼──────────┐
       │  Job / Job    │   │   Invoice    │◄────┤  (invoice may  │
       │  CostItem     │◄──┤ line items,  │     │  span several  │
       └───────────────┘   │ VAT per line │     │  B/Ls)         │
                           └──────┬───────┘     └────────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │   Ledger / Vouchers      │
                     │  invoice · receipt ·     │
                     │  payment · journal       │
                     │  → Balance = Dr − Cr     │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │  Release Order (via Agent)│
                     │  Delivery Order           │
                     └───────────────────────────┘
```

### 2.1 Parties

| Entity | Cardinality vs Cargo | Notes |
|---|---|---|
| Customer | 1..n | **Name is the only mandatory field** (`REQ-011`) |
| Shipper | 1..n on B/L | Name + address block |
| Consignee | 1..n on B/L | Name + address block |
| Notify Party | on B/L | Often "SAME AS CONSIGNEE" |
| Agent | per destination | Needs destination-scoped portal access (`REQ-187`) |

### 2.2 Key cardinality decisions (from the employer, not inferred)

| Relationship | Cardinality | Requirement |
|---|---|---|
| Customer → Cargo | 1 : n | `REQ-011` |
| Cargo → B/L | n : 1 (a B/L can cover several cargos) | `REQ-100` |
| B/L → Manifest | n : 1, **after** the B/L is issued | `EMP-024`–`EMP-027` |
| Manifest → Voyage | 1 : 1 | `REQ-110` |
| Vessel → Voyage | 1 : n | `REQ-040` |
| Invoice → B/L | **1 : n** (one invoice may cover several B/Ls) | `REQ-141` |
| Manifest → Customer | **1 : n** (a manifest can carry several customers) | `REQ-115` |
| Manifest → Shipper/Consignee | 1 : n | `REQ-116` |
| Job → Invoice | 1 : n | `REQ-134` |
| Agent → Destination | n : n | `REQ-187` |

---

## 3. Current system model (`prisma/schema.prisma`)

62 models, 25 enums. Grouped:

### 3.1 Identity & access
`User`, `RefreshToken`, `Role`, `Permission`, `RolePermission`, `UserRole`, `CompanySettings`, `Currency`

### 3.2 Master data
`Port`, `Vard`→`Yard`, `Customer`, `Shipper`, `Consignee`, `Agent`, `AgentDestination`, `Vessel`, `Voyage`, `VoyageDestination`

### 3.3 Operations
`Cargo`, `YardInventory`, `Inspection`, `LoadList`, `LoadListItem`, `ActualLoading`, `ActualLoadingItem`, `Discharge`, `DischargeItem`, `BookingRequest`

### 3.4 Documents
`Manifest`, `ManifestItem`, `BillOfLading`, `BillOfLadingRevision`, `BillOfLadingItem`, `Invoice`, `InvoiceItem`, `Proforma`, `ProformaItem`, `Quotation`, `QuotationItem`, `DeliveryOrder`, `ReleaseOrder`, `Letter`

### 3.5 Finance
`Job`, `JobCostItem`, `Voucher`, `Employee`, `SalaryRecord`

### 3.6 Platform
`NumberingSequence`, `AuditLog`, `FileAttachment`, `DocumentTemplate`, `DocumentTemplateVersion`

### 3.7 Notable enums
`CargoStatus`, `CargoType`, `InspectionStatus`, `LoadingStatus`, `WeightUnit`, `InventoryStatus`, `LoadListItemSelectionStatus`, `VesselType`, `VoyageStatus`, `LoadListStatus`, `ActualLoadingStatus`, `DischargeStatus`, `DischargeResult`, `BookingStatus`, `LoadingResult`, `ManifestStatus`, `BlStatus`, `BlType`, `FreightTerms`, `InvoiceStatus`, `ProformaStatus`, `QuotationStatus`, `EmployeeStatus`, `SalaryStatus`, `VoucherType`, `VoucherMethod`, `VoucherStatus`, `DeliveryOrderStatus`, `LetterDirection`, `LetterStatus`, `JobStatus`, `JobItemKind`

### 3.8 ⚠️ What the current schema appears to lack

| Missing | Employer requirement |
|---|---|
| **A `Ledger` / `LedgerEntry` model** | `REQ-160`–`REQ-167`. Only `Voucher` exists — vouchers are the *inputs*; there is no running ledger/account entity. **This needs verification in Phase 8** |
| **Cargo Comment** | `REQ-065`–`REQ-067` |
| **General Journal** | `REQ-166` |

> These three are flagged for verification, not asserted. Phase 8 checks whether they are modelled
> another way (e.g. `Voucher` with a journal type, or a view).

---

## 4. Legacy model (23 Eloquent models)

| Legacy model | Target equivalent | Verdict |
|---|---|---|
| `User` (level Admin/User) | `User` + `Customer` | ⚠️ **Customers were users** — the single worst legacy modelling decision |
| `Role`, `Permission`, `HasRole` | `Role`, `Permission`, `RolePermission`, `UserRole` | ✅ |
| `KeyValue` | `CompanySettings` | ✅ |
| `Port` | `Port` | ⚠️ one string instead of name/city/country |
| `Yard` | `Yard` | ✅ |
| `Loading` | `Cargo` | ⚠️ plus a legacy-only `admin_status` |
| `Doc` | (attachment) | ⚠️ ad-hoc |
| `Loadinglist` | `LoadList` | ✅ |
| `Manifest`, `Item` | `Manifest`, `ManifestItem` | ⚠️ inverted creation order |
| `Bl` | `BillOfLading` | ⚠️ no draft/final, no release |
| `Shipper`, `Consignee`, `Agent` | same | ✅ |
| `Portshipper` | `Voyage` counter | ❌ wrong keying (defect **D12**) |
| `Invoice`, `InvoiceItem`(inline) | `Invoice`, `InvoiceItem` | ⚠️ wrong arithmetic |
| `Fin` | `Voucher` / Ledger | ⚠️ exists but is not double-entry |
| `Offer`, `Quotation` | `Quotation` | ⚠️ free-text, no line items |
| `Performa`, `Performa_item` | `Proforma`, `ProformaItem` | ✅ best-modelled legacy document |

**Legacy has no equivalent of:** `Job`, `JobCostItem`, `Vessel`, `Voyage`, `DeliveryOrder`,
`ReleaseOrder`, `Letter`, `Employee`, `SalaryRecord`, `NumberingSequence`, `AuditLog`,
`FileAttachment`, `DocumentTemplate`, `Inspection` (as an entity), `ActualLoading`, `Discharge`,
`BookingRequest`, `AgentDestination`, `VoyageDestination`, `Currency`.

---

## 5. Legacy → current mapping

| Legacy | Current | Change |
|---|---|---|
| `users` (both staff and customers) | `User` + `Customer` | ✅ **Split** — the most important correction |
| `ports.title` | `Port` (name, city, country) | ✅ Split into three fields (`REQ-030`) |
| `loadings` | `Cargo` + `YardInventory` + `Inspection` | ✅ Decomposed into three first-class concepts |
| `loadings.loading_status` | `LoadingStatus` + `ActualLoading` | ✅ Actual loading is now its own record |
| `loadinglists` | `LoadList` + `LoadListItem` | ✅ |
| `manifests` / `items` | `Manifest` / `ManifestItem` | ✅ plus `ManifestStatus` |
| `bls` | `BillOfLading` + `BillOfLadingItem` + `BillOfLadingRevision` | ✅ Revisions are now first-class |
| `bls.status` (PENDING only) | `BlStatus` enum | ✅ |
| `Portshipper` voyage counter | `Voyage` + `NumberingSequence` | ✅ Fixed keying |
| `invoices` | `Invoice` + `InvoiceItem` | ⚠️ Arithmetic must not be ported |
| `fins` | `Voucher` | ⚠️ No ledger entity — see §3.8 |
| `offers` | *(dropped)* | Offer and Quotation were merged |
| `quotations` (free text) | `Quotation` + `QuotationItem` | ✅ Now line-item based |
| `performas` / `performa_items` | `Proforma` + `ProformaItem` | ✅ |
| `key_values` | `CompanySettings` | ✅ Typed columns instead of a KV bag |
| *(none)* | `DocumentTemplate` + `DocumentTemplateVersion` | ✅ New |
| *(none)* | `NumberingSequence` | ✅ New — replaces random generators |
| *(none)* | `AuditLog`, `FileAttachment` | ✅ New |
| *(none)* | `Job`, `JobCostItem`, `Employee`, `SalaryRecord` | ✅ New |
| *(none)* | `DeliveryOrder`, `ReleaseOrder`, `Letter` | ✅ New |
| *(none)* | `AgentDestination`, `VoyageDestination` | ✅ New — enables agent scoping |
| *(none)* | `Discharge`, `DischargeItem`, `BookingRequest` | ✅ New — Phase 10+ scope |

---

## 6. Open modelling questions

| # | Question | Blocks |
|---|---|---|
| E1 | Is there a ledger entity, or is the ledger derived from vouchers? | Finance module |
| E2 | Is cargo comment modelled? (`REQ-065`–`REQ-067`) | Cargo module |
| E3 | Is there a general journal? (`REQ-166`) | Finance module |
| E4 | One cargo per B/L, or several cargos per B/L? | B/L module |
| E5 | Does `Job` map 1:1 to `Voyage`, or is it independent? | Job costing |
| E6 | How is the two-business split (freight vs resale, §2 of the consolidated model) represented? | Sales documents |

See [`../07-traceability/`](../07-traceability/) once written, and Phase 8 in
[`../05-current-project/`](../05-current-project/).
