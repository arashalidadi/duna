# Party-Model Cutover Evidence Pack (READ-ONLY)

**Task:** Phase 2 / B/L–Manifest party cutover — pre-planning evidence step
**Type:** read-only inventory — no code, schema, migration, API, UI or test changes
**Captured:** 2026-09-29, repo HEAD `2b89e38`, live DB `shipping_erp@127.0.0.1:5432`
**Method:** file reads with line numbers (`schema.prisma`, services/DTOs/controllers, pages, tests),
migration SQL greps, and read-only `information_schema` / `SELECT count(*)` queries via throwaway
Prisma scripts (scripts deleted afterwards; `git status` unchanged vs baseline).
**Citation format:** `path:line` (schema = `prisma/schema.prisma`), or "query" + verbatim result.
Every claim below is one of those two forms. No recommendations are included.

---

## 1. Schema inventory

### 1.1 Party master models (FK targets)

| Model | Table | Key fields | soft-delete | Citation |
|---|---|---|---|---|
| Customer | `Customer` (no `@@map`) | `code @unique`, `name`, `type String?` ("e.g. SHIPPER, CONSIGNEE, AGENT, FREIGHT_FORWARDER"), `taxId String?` | `deletedAt DateTime?` | schema `260-298` (type 265, taxId 271, deletedAt 278) |
| Shipper | `shippers` | `code @unique`, `name`, `taxId String?`, `isActive` | `deletedAt` | schema `306-326` (deletedAt 318, `@@map("shippers")` 323, `cargos Cargo[]` 325) |
| Consignee | `consignees` | same shape as Shipper | `deletedAt` | schema `328-348` (deletedAt 340, `@@map` 345, `cargos` 347) |
| Agent | `agents` | same shape + `destinations AgentDestination[]` | `deletedAt` | schema `350-370` (deletedAt 362, `@@map` 369) |
| AgentDestination | `agent_destinations` | `agentId`, `portId`, `@@unique([agentId, portId])` | `deletedAt` | schema `372-389` (FKs `onDelete: Cascade` 381-382) |

Schema comment defining the split: `Customer.type is deprecated for representing these external
parties` — schema `300-304`.

### 1.2 The 8 scope models — every party field

| Model (schema lines) | Party field | Type / nullability | Referenced model (relation line) |
|---|---|---|---|
| **Cargo** (`407-486`) | `customerId` | `String` — **required** (410) | `Customer` (451) |
| | `shipperId` | `String?` — nullable (418), comment "Phase 2: nullable party master refs" (416-417) | `Shipper?` (457) |
| | `consigneeId` | `String?` — nullable (419) | `Consignee?` (458) |
| | — | Cargo has **no** `agentId` / `notifyParty` | — |
| **Manifest** (`1092-1167`, `@@map("manifests")` 1166) | `shipperId` | `String?` — nullable (1105) | `Customer?` `@relation("ManifestShipper")` (1143) |
| | `consigneeId` | `String?` — nullable (1106) | `Customer?` (1144) |
| | `agentId` | `String?` — nullable (1107) | `Customer?` (1145) |
| | `notifyParty` | `String?` — **free text**, not an FK (1109) | — |
| | party comment | "Parties (legacy shipper/consignee/agent models -> unified Customer CRM)" | (1104) |
| **ManifestItem** (`1169-1197`) | **none** | — | — |
| **BillOfLading** (`1225-1297`, `@@map("bills_of_lading")` 1296) | `shipperId` | `String?` — nullable (1238) | `Customer?` `@relation("BillShipper")` (1275) |
| | `consigneeId` | `String?` — nullable (1239) | `Customer?` (1276) |
| | `notifyParty` | `String?` — free text (1240) | — |
| | party comment | "Parties (defaulted from the manifest, overridable per document)" | (1237) |
| | — | B/L has **no** `agentId` | — |
| **BillOfLadingItem** (`1299-1325`) | **none** | — | — |
| **LoadList** (`837-869`) | **none** | — | — |
| **ActualLoading** (`935-966`) | **none** | — | — |
| **Discharge** (`991-1017`) | **none** | — | — |

Item models also have no party fields: `LoadListItem` (`870`), `ActualLoadingItem` (`967`),
`DischargeItem` (`1018`) — awk block scan of those 6 model bodies for
`customer|shipper|consignee|agentId|notify` returned **0 matches** (query).

### 1.3 `deletedAt` / soft-delete interaction with those FKs

Columns present:

- Party parents carry `deletedAt`: Customer 278, Shipper 318, Consignee 340, Agent 362.
- Child scope models carrying `deletedAt`: Cargo 449, Manifest 1138, BillOfLading 1271,
  LoadList 850, ActualLoading 948, Discharge 1004 (schema line numbers).
- **No** `deletedAt` on `ManifestItem`, `BillOfLadingItem`, `LoadListItem`,
  `ActualLoadingItem`, `DischargeItem` (schema 1169-1197, 1299-1325; query on
  `information_schema.columns` for those 5 tables returned `(none)`).
- `Cargo` soft-deletes are child-side only; party FK values are unaffected by it.

FK delete rules (live `information_schema` query, verbatim):

```
Cargo.consigneeId -> consignees [ON DELETE SET NULL]
Cargo.customerId -> Customer [ON DELETE RESTRICT]
Cargo.shipperId -> shippers [ON DELETE SET NULL]
bills_of_lading.consigneeId -> Customer [ON DELETE SET NULL]
bills_of_lading.shipperId -> Customer [ON DELETE SET NULL]
manifests.agentId -> Customer [ON DELETE SET NULL]
manifests.consigneeId -> Customer [ON DELETE SET NULL]
manifests.shipperId -> Customer [ON DELETE SET NULL]
delivery_orders.recipientId -> Customer [ON DELETE SET NULL]
```

Consequence visible in the artifacts: **`SET NULL` fires only on hard `DELETE`** — soft-deleting a
Customer (`deletedAt`) does not clear any party FK. Code-side manifestations:

- `cargo.service.ts:321-326` — `validateRelations()` loads `customer.findUnique(...)` and throws
  `NotFound` when `!customer || customer.deletedAt` (write-time guard for the **required**
  `customerId` only; **no** equivalent check exists for `shipperId`/`consigneeId` — grep for
  `shipper|consignee` in `cargo.service.ts` returns only lines 66, 67, 182, 183, 242, 243).
- `delivery-release.service.ts:180-181` and `208-209` — recipient Customer checked
  `deletedAt: null` on create and update.
- Manifest/B/L relation reads have **no** `deletedAt` filter on the party relation:
  `manifest.service.ts:85-87` and `bill.service.ts:85-86` select
  `{ id, code, name, shortName }` unconditionally, so a soft-deleted Customer would still
  serialize its name.
- Child queries filter child-side `deletedAt`: `manifest.service.ts:156` (`deletedAt: null`),
  `bill.service.ts:144`, `cargo.service.ts:86`.

### 1.4 Migration/DB drift observed for Cargo party FKs

- `grep 'REFERENCES "shippers"|"consignees"|"agents"' prisma/migrations/*/migration.sql` →
  **no matches**; `grep 'shipperId|consigneeId' prisma/migrations/*/migration.sql` returns only
  `manifests`/`bills_of_lading` columns + FKs
  (`20260911224819_phase9_manifest/migration.sql:14,15,79,82,118,121,124`,
  `20260912130959_phase10_bills_of_lading/migration.sql:20,21,81,84,108,111`).
- Yet schema declares `Cargo.shipperId/consigneeId` (418-419, 457-458) and the **live DB has the
  columns + FKs** (query in §1.3 and §4.A). So `Cargo`'s master FKs exist in schema + live DB but
  in no migration file.

### 1.5 Related party references (context, outside the 8 models)

- `Customer` back-relations list the other consumers: `Invoice` 285, `Proforma` 286,
  `Quotation` 287, `Letter` 288, `Job` 289, `DeliveryOrder` 290, `Voucher` 291,
  `BookingRequest` (`@relation("BookingAgent")`) 292, portal `User[]` 293 (schema lines).
- Live FK query additionally returned: `invoices.customerId / proformas.customerId /
  quotations.customerId / vouchers.customerId / booking_requests.customerId` → Customer
  `ON DELETE RESTRICT`; `jobs.customerId / letters.customerId` → `ON DELETE SET NULL`.
- `delivery_orders.recipient` is `NOT NULL` free text; `delivery_orders.recipientId` nullable
  FK → Customer (information_schema query).

---

## 2. Code inventory

All party-field reads/writes found by `grep -rn 'shipperId|consigneeId|agentId|notifyParty'`
over `apps/api/src` (18 + 18 + 20 + 12 hits; agents-module hits are unrelated
`AgentDestination.agentId`). Grouped by module, with the value source stated.

### 2.1 Cargo (`apps/api/src/modules/cargo/`)

| File:line | Op | Who sets the value |
|---|---|---|
| `cargo.service.ts:60` | read — selects `customer {id,code,name,shortName}` | derived relation |
| `cargo.service.ts:66-67` | read — selects `shipperId`, `consigneeId` scalars in list+detail `select` | stored columns |
| `cargo.service.ts:116-117` | read — search OR-branches on `customer.name` / `customer.code` only (no shipper/consignee search) | query filter |
| `cargo.service.ts:182-183` | **write** — create: `shipperId: dto.shipperId ?? null`, `consigneeId: dto.consigneeId ?? null` | request payload, default `null` |
| `cargo.service.ts:210` + `321-341` | validate — `validateRelations(portId, customerId, yardId, destinationPortId)` on create/update; validates customer/port/yard/destination `deletedAt` (325, 332, 341); **no shipper/consignee validation** | derived from payload + `existing` |
| `cargo.service.ts:242-243` | **write** — update: `dto.shipperId ?? existing.shipperId` (same for consignee) | request payload, else previous value |
| `cargo.dto.ts:138-147` | DTO create: `shipperId?/consigneeId?: string`, `@IsOptional @IsString @MaxLength(40)` | — |
| `cargo.dto.ts:299-308` | DTO update: same shape | — |
| `cargo.controller.ts:31-33` / `43-45` | entry: `POST /cargo`, `PATCH /cargo/:id` pass DTO untouched | — |

### 2.2 Manifest (`apps/api/src/modules/manifest/`)

| File:line | Op | Who sets the value |
|---|---|---|
| `manifest.service.ts:56-59` | read — select scalars `shipperId/consigneeId/agentId/notifyParty` (list) | stored columns |
| `manifest.service.ts:85-87` | read — select relations `shipper/consignee/agent {id,code,name,shortName}` (list + detail) | derived relation |
| `manifest.service.ts:156` | read — list `where deletedAt: null` | — |
| `manifest.service.ts:259-262` | **write** — create: `shipperId/consigneeId/agentId/notifyParty` straight from `dto` | request payload (no default) |
| `manifest.service.ts:294-297` | **write** — update: `dto.X !== undefined ? { X: dto.X || null } : {}` (`''` clears to null) | request payload |
| `manifest.service.ts:318-324` | soft-delete: sets `deletedAt: new Date()` | — |
| `manifest.dto.ts:35-48` | DTO create: `@IsOptional @IsString`, descriptions "Shipper customer ID (legacy shipper)", "Consignee customer ID (legacy consignee)", "Agent customer ID (legacy agent)" | — |
| `manifest.dto.ts:50-54` | DTO create `notifyParty`: `@IsString @MaxLength(255)` "free text, legacy notify_party" | — |
| `manifest.dto.ts:105-125` | DTO update: `string \| null`, "null to clear" | — |
| `manifest.controller.ts:57-59` / `63-65` | entry: `POST /manifests`, `PATCH /manifests/:id` | — |

No existence check for shipper/consignee/agent IDs anywhere in this module: grep for
`customer.findUnique|shipper.findUnique|consignee.findUnique|agent.findUnique` in
manifest/bill/cargo returned only `cargo.service.ts:321` (customer).

### 2.3 Bill of Lading (`apps/api/src/modules/bill/`)

| File:line | Op | Who sets the value |
|---|---|---|
| `bill.service.ts:58-60` | read — select scalars (list) | stored columns |
| `bill.service.ts:85-86` | read — select relations `shipper/consignee {id,code,name,shortName}` | derived relation |
| `bill.service.ts:149-150` | read — list filters `query.shipperId ? { shipperId: ... }` and same for consignee | query params |
| `bill.service.ts:165` | read — search OR-branch `notifyParty contains` (case-insensitive) | query param |
| `bill.service.ts:219-221` | read — create fetches manifest with `shipperId/consigneeId/notifyParty` | source for derivation |
| `bill.service.ts:244-246` | **write** — create: `shipperId: dto.shipperId ?? manifest.shipperId`, `consigneeId: dto.consigneeId ?? manifest.consigneeId`, `notifyParty: dto.notifyParty ?? manifest.notifyParty` | **derived from the manifest**, overridable by payload |
| `bill.service.ts:286-288` | **write** — update (DRAFT only, `assertEditable` 280): `dto.X !== undefined ? { X: dto.X \|\| null } : {}` | request payload |
| `bill.dto.ts:43-57` | DTO create: descriptions "defaults from the manifest"; `notifyParty @MaxLength(255)` "free text on the printed document" | — |
| `bill.dto.ts:127-142` | DTO update: `string \| null`, "null to clear" | — |
| `bill.dto.ts:343-352` | List filters `shipperId?`, `consigneeId?` | — |
| `bill.controller.ts:54-56` / `60-62` | entry: `POST /bills`, `PATCH /bills/:id` | — |

Error mapping for bad IDs: `manifest.service.ts:270-275` and `bill.service.ts:261-268` catch
`P2002 || P2018` → `409` with message "duplicate reference"; the global filter maps
`P2003/P2014/P2018 → 400` (`http-exception.filter.ts:76-88`).

### 2.4 Related modules touched by party values

| File:line | Op | Who sets the value |
|---|---|---|
| `delivery-release.service.ts:174` | D/O create DTO: `recipient: string; recipientId?: string` | request payload |
| `delivery-release.service.ts:179-188` | create: validates `recipientId` Customer `deletedAt: null` (180-181) → writes `recipient` text + `recipientId ?? null` | payload |
| `delivery-release.service.ts:199-211` | update: same re-validation (208-209), `disconnect`/`connect` for `recipientCustomer` (211) | payload |
| `delivery-release.service.ts:112,119-130` | serialize: `recipient` + `recipientCustomer {id,name}` | derived |
| `portal.service.ts:142` | read — count manifests `where agentId: customerId` | derived from JWT portal customer |
| `portal.service.ts:288-292` | read — list manifests `where agentId: customerId`, `customerId = await this.portalCustomerIdOf(actor)` (288) | **derived from actor**, not payload |

`load-planning`, `actual-loading`, `discharge` modules: grep for
`shipperId|consigneeId|agentId|notifyParty` across their services+DTOs → **ALL ZERO** (query).

### 2.5 Modules exposing the new masters

`apps/api/src/modules/shippers/`, `consignees/`, `agents/` exist (directory listing) with
`agents.service.ts` performing CRUD on `AgentDestination` (lines 159-230, `agentId` scoping).
Neither `manifest`, `bill` nor `cargo` imports/references these modules (no hits in §2.1-2.3).

---

## 3. Document inventory (party names in generated documents/reports)

**No dedicated template/PDF files exist.** `find apps/web/src -name '*.tsx' | grep -iE
'bill|manifest|delivery|release|print|document'` → only the 4 page files below;
`grep -rln 'window.print|@media print' apps/web/src` → only `ledger/page.tsx` (unrelated to
parties). Documents are therefore rendered as on-screen detail/list views:

| View | Field source | Citation |
|---|---|---|
| **B/L list** — column header `fields.consignee`; cell renders `b.consignee?.name ?? b.notifyParty ?? '—'` | API `bill.service.ts:85-86` (Customer relation) with free-text fallback | `apps/web/src/app/[locale]/(dashboard)/bills/page.tsx:507`, `:535` |
| **B/L create form** — party input = `notifyParty` free text only (`fields.notifyParty`); payload sends `notifyParty` only | payload `bills/page.tsx:228`; input `:698-701` | — |
| **B/L detail header editor** — editable `notifyParty`; **no shipper/consignee/agent editor** | PATCH payload `bills/page.tsx:291`; inputs `:882-887`; grep for shipper display in this file returns no display row (only `shipperCost`-free hits at 507/535 for consignee) | — |
| **Manifest detail dialog** — `detail.shipper?.name ?? '—'`, `detail.consignee?.name ?? '—'`, `detail.agent?.name ?? '—'`, `detail.notifyParty ?? '—'` | API `manifest.service.ts:85-87` | `manifest/page.tsx:939`, `:963`, `:987`, `:1004` |
| **Manifest create form payload** | `manifest/page.tsx:212-215` (`shipperId/consigneeId/agentId/notifyParty` from form) | inputs `:718-730`, `:736-748`, `:754-764`, `:770-775` |
| **Manifest header editor (DRAFT)** | PATCH payload `manifest/page.tsx:285-288` | selects `:926-930`, `:950-954`, `:974-978`; notify `:992-1000` |
| **Manifest list** — party columns absent: headers are No/Voyage/Route/Status/Items/TotalWeight/Created/Actions | — | `manifest/page.tsx:576-583` |
| **D/O list cell + detail** — `d.recipient` / `detail.recipient` (free text) | API `delivery-release.service.ts:119,130` | `delivery-orders/page.tsx:219`, `:268-270`, `:293-294` |
| **R/O page** — no recipient/party rendering (grep `recipient` → empty) | — | `release-orders/page.tsx` |

Note (factual): `shipperCost` at `manifest/page.tsx:1015` is a **cost** label, not a party.

---

## 4. Data inventory (live DB, 2026-09-29)

### 4.1 Scope tables: party columns present (information_schema query)

```
Cargo.consigneeId / Cargo.customerId / Cargo.shipperId
bills_of_lading.consigneeId / bills_of_lading.notifyParty / bills_of_lading.shipperId
manifests.agentId / manifests.consigneeId / manifests.notifyParty / manifests.shipperId
```
Only `deletedAt` (no party column) on: `ActualLoading`, `Discharge`, `LoadList`, `Customer`
(+ masters `agents/consignees/shippers`). Live table names: `Cargo`, `LoadList`,
`ActualLoading`, `Discharge`, `manifests`, `manifest_items`, `bills_of_lading`,
`bills_of_lading_items` (information_schema query) — `LoadList/ActualLoading/Discharge` and all
item tables contain **zero** party columns.

### 4.2 Counts of non-null party references (SQL `count(*)` per table)

| Table | rows | shipperId | consigneeId | agentId | notifyParty | customerId |
|---|---|---|---|---|---|---|
| `Cargo` | 33 | **0** | **0** | n/a | n/a | 33 |
| `manifests` | 4 | **4** | **3** | **1** | **2** | n/a |
| `bills_of_lading` | 2 | **2** | **2** | n/a (no column) | **2** | n/a |

Row-level detail (query):

```
MAN-2609-00001 shipper=cmtxnljlw… (AL Co 1ek25e) consignee=cmtxnbsrv… (AL Co 46tyen) agent=null notify="Bushehr Cargo Agency"
MAN-2609-00002 shipper=same                          consignee=same                  agent=null notify="Khalifa Shipping Co"
MAN-2609-00003 shipper=same                          consignee=null                  agent=null notify=null
MAN-2609-00004 shipper=same                          consignee=same                  agent=cmu0hfma… (Meridian Freight Co. (Portal Demo)) notify=null
BOL-2609-00001 shipper=same consignee=same notify="Bushehr Cargo Agency"
BOL-2609-00002 shipper=same consignee=same notify="Bushehr Cargo Agency"
```
All 6 rows: `deletedAt IS NULL`. Soft-deleted counts: `Cargo 0/33`, `manifests 0/4`,
`bills_of_lading 0/2` (query).

### 4.3 Match rate against the new masters — heuristic stated

**Heuristic (stated as required):** primary = normalized **name** equality
`lower(trim(master.name)) = lower(trim(Customer.name))`; fallback = **taxId** equality when both
sides non-null; additionally checked = **code-suffix** equality (segment after the last `-`).
Master side restricted to `deletedAt IS NULL`.

SQL shape used (per pair):
`JOIN "Customer" c ON c.id = t."<col>" LEFT JOIN "<master>" m ON m."deletedAt" IS NULL AND lower(trim(m.name))=lower(trim(c.name)) …`

| Reference | refs | matched by name | matched by taxId only |
|---|---|---|---|
| `manifests.shipperId` → Shipper | 4 | **0** | 0 |
| `manifests.consigneeId` → Consignee | 3 | **0** | 0 |
| `manifests.agentId` → Agent | 1 | **0** | 0 |
| `bills_of_lading.shipperId` → Shipper | 2 | **0** | 0 |
| `bills_of_lading.consigneeId` → Consignee | 2 | **0** | 0 |

- **taxId fallback is unobservable:** `SELECT count("taxId") FROM "Customer"` →
  `{total: 30, live: 29, with_taxid: 0}` — no Customer carries a taxId.
- **Code-suffix check:** only `Customer T3A-001` ↔ `Agent AGT-001` matched, and `T3A-001` is
  **not** among the 3 referenced parties (query).
- Distinct Customers actually referenced by manifest/B-L parties: **3** (query):
  `AL Co 46tyen` (code `ALCUS-46TYEN`, type `SHIPPER`),
  `AL Co 1ek25e` (code `ALCUS-1EK25E`, type `CONSIGNEE`),
  `Meridian Freight Co. (Portal Demo)` (code `AGT-P20DEMO`, type `AGENT`) — all `taxId=null`,
  all live.
- Customer type distribution (live): `SHIPPER 26, AGENT 1, CONSIGNEE 1, FORWARDER 1`
  (`SELECT type, count(*) FROM "Customer" WHERE "deletedAt" IS NULL GROUP BY type`).

### 4.4 Reverse orphans (masters ↔ references)

Master inventory (query):

| Master | total | live | soft-deleted | referenced by any `Cargo` row |
|---|---|---|---|---|
| `shippers` | **0** | 0 | 0 | 0 |
| `consignees` | **0** | 0 | 0 | 0 |
| `agents` | **1** | 1 | 0 | **0** |

- The single Agent master is `AGT-001 "Arash alidadi"`, `taxId 34234234234`, active.
- Every `Cargo.shipperId/consigneeId` is NULL (§4.2), so **no** master row is referenced by any
  document — the 1 Agent master is an unreferenced (reverse-orphan) record.
- Name overlap between masters and Customer (dedup candidates):
  `shippers ∩ consignees = (none)`, `shippers ∩ Customer = (none)` (INTERSECT queries).
- Zero party FKs point at a soft-deleted parent today:
  `live manifests → soft-deleted Customer shipper: 0`,
  `live bills → soft-deleted Customer consignee: 0` (query).
- `notifyParty` free-text values in use: `"Khalifa Shipping Co"`, `"Bushehr Cargo Agency"`
  (DISTINCT query) — neither matches any master (masters: 0 shippers/consignees, agent name
  `Arash alidadi`).

### 4.5 Migration-vs-DB note for Cargo FKs

See §1.4: `Cargo.shipperId/consigneeId` columns + FKs exist live (query) but no file under
`prisma/migrations/` creates them (grep, zero matches for `REFERENCES "shippers"|"consignees"`).

---

## 5. UI inventory (form fields writing party references)

| Page | Field(s) writing party refs | Option source | Citation |
|---|---|---|---|
| **Manifest** create dialog | `mf-shipper` select → `createForm.shipperId`; `mf-consignee` → `consigneeId`; `mf-agent` → `agentId`; notify-party text input | **`customers`** — `api.get('/customers?pageSize=100')`; all three selects `customers.map((c) => …)`, placeholder option text `create.selectCustomer` | fetch `manifest/page.tsx:186`; selects `:718-730`, `:736-748`, `:754-764` (placeholder `:724`, `:742`, `:760`); payload `:212-215` |
| **Manifest** header editor (DRAFT) | `headerDraft.shipperId/consigneeId/agentId/notifyParty` → `PATCH /manifests/:id` | same `customers` state (no other party endpoint is fetched on this page) | values `:926`, `:950`, `:974`, `:998`; payload `:285-288` |
| **B/L** create dialog | **no party select** — only `notifyParty` free-text `Input` | n/a | input `bills/page.tsx:698-703`; payload `:228` sends only `notifyParty` |
| **B/L** header editor | `notifyParty` only — no shipper/consignee/agent editor | n/a | `:882-887`; payload `:291` |
| **B/L** list | renders `b.consignee?.name ?? b.notifyParty` (read-only) | API-derived | `:507`, `:535` |
| **Cargo** create/edit | **no shipper/consignee field at all** | n/a | grep `shipperId\|consigneeId\|/shippers\|/consignees` in `cargo/page.tsx` → only `:189` (`/customers`, i.e. the required `customerId`) |
| **Delivery Orders** | `recipient` free-text `Input` (required client-side) — no `recipientId`/Customer select | n/a | `delivery-orders/page.tsx:268-270`, validation `:102`, payload `:108` |

Cross-checks:

- None of the three pages (`manifest`, `bills`, `cargo`) fetches `/shippers`, `/consignees` or
  `/agents` (their only party endpoint is `/customers`, at `manifest:186`, `bills:194`,
  `cargo:189`).
- `bills/page.tsx` declares `customers` state (`:129`) and fetches it (`:194`) but never renders
  it — grep `customers` returns only those 2 lines.
- Master CRUD pages exist in the tree as untracked dirs:
  `apps/web/src/app/[locale]/(dashboard)/{shippers,consignees,agents}/` (git status) — not
  referenced by the B/L, Manifest or Cargo pages (grep above).

---

## 6. Test inventory (tests asserting current party behaviour)

### 6.1 Tests that pass **Customer** IDs into party fields (directly encode current wiring)

| Test | Line(s) | Assertion / action |
|---|---|---|
| `apps/api/test/manifest.e2e-spec.ts` | `510-523` | `it('update (header) works in DRAFT only; shipper/consignee set; unknown manifest 404')` — sends `shipperId: customerId` (`:515`), asserts `upd.body.data.shipperId === customerId` (`:522`), `notifyParty === 'MF Notify'` (`:523`) |
| `apps/api/test/bill.e2e-spec.ts` | `322` | fixture manifest created with `shipperId: customerId` |
| `apps/api/test/bill.e2e-spec.ts` | `502-503` | comment "Parties default from the manifest"; `expect(created.shipperId).toBe(customerId)` |
| `apps/api/test/bill.e2e-spec.ts` | `645-657` | header PATCH with `notifyParty: 'BL Notify'` (free text round-trip) |
| `apps/api/test/delivery-release.e2e-spec.ts` | `151-153` | fixture manifest `shipperId: customerId` |
| `apps/api/test/portal.e2e-spec.ts` | `83`, `97`, `109` | manifest fixtures with `agentId: custA.id / custB.id` (Customer IDs); comment "only the agentId scoping matters here" (`:83`) |

### 6.2 Tests that already use the **new masters** (encode the target wiring for Cargo)

| Test | Line(s) | Assertion / action |
|---|---|---|
| `apps/api/test/cargo-inventory.e2e-spec.ts` | `27-30` | comment: "Cargo.shipperId / Cargo.consigneeId are FKs to the Phase 2 party masters (shippers / consignees tables), NOT to Customer." |
| same | `85-102` | fixture `shipper.create` / `consignee.create` **via PrismaClient**; comment `:85-88` claims `POST /shippers` returns 403 because shipper:* permissions are missing — **stale claim**: `SELECT code FROM Permission WHERE code LIKE 'shipper:%'` → `shipper:read, shipper:create, shipper:update, shipper:delete` (likewise `consignee:*`, `agent:*` exist; seeded by `scripts/seed-phase2-permissions.cjs`, file present) |
| same | `146-149` | cleanup deletes created shippers/consignees |
| same | `330-331` | create cargo with `shipperId/consigneeId` = master IDs |
| same | `349-350` | `expect(d.shipperId).toBe(createdShippers[0].id)` / consignee same |
| same | `357-369` | `it('returns null for omitted Phase 3A party/financial fields')` — `shipperId/consigneeId` null when omitted |
| same | `401-409` | update cargo with master IDs → echoed back |

### 6.3 Test coverage gaps (facts)

- No web/UI tests at all: `find apps/web -name '*.test.*' -o -name '*.spec.*'` → empty.
- No dedicated e2e file for the new masters: `ls apps/api/test | grep -iE
  'shipper|consignee|agent|party'` → empty.
- `manifest.e2e-spec.ts` sets party IDs only on **update** (`:515`), never on create — grep for
  `shipperId|consigneeId|agentId` in that file returns only `:515` and `:522`.
- B/L party derivation is asserted only for `shipperId` (`bill.e2e-spec.ts:502-503`); no
  assertion covers `consigneeId` derivation (grep for `consigneeId` in `bill.e2e-spec.ts` → no
  hits).

### 6.4 Which assertions encode the Customer→party wiring (would be touched by a cutover)

Facts only, grouped by what they pin:

- **Manifest.shipperId = Customer**: `manifest.e2e-spec.ts:515,522`.
- **Manifest/B-L shipper derived through Customer**: `bill.e2e-spec.ts:322,502-503`,
  `delivery-release.e2e-spec.ts:151-153`.
- **Manifest.agentId = Customer (portal scoping)**: `portal.e2e-spec.ts:83,97,109`.
- **Cargo.shipperId/consigneeId = masters**: `cargo-inventory.e2e-spec.ts:330-331,349-350,
  357-369,401-409` (these already target the masters and would be unaffected by a
  Manifest/B-L-side retargeting).
- **Free-text notifyParty/recipient** (no FK): `bill.e2e-spec.ts:645-657`,
  `manifest.e2e-spec.ts:516,523`, D/O recipient input `delivery-orders/page.tsx:102,108`.

---

## Appendix — reproduction queries

Run read-only via `PrismaClient.$queryRawUnsafe` against `shipping_erp` (scripts deleted after use):

1. Party FK map: `information_schema.table_constraints` ⋈ `key_column_usage` ⋈
   `constraint_column_usage` ⋈ `referential_constraints` filtered on
   `column_name IN ('shipperId','consigneeId','agentId','customerId','recipientId')`.
2. Nullability: `information_schema.columns` for the same columns.
3. Counts: `SELECT count(*), count("shipperId"), … FROM "<table>"` per table (§4.2).
4. Match heuristic: `JOIN "Customer" c ON c.id=t."<col>" LEFT JOIN "<master>" m ON
   m."deletedAt" IS NULL AND lower(trim(m.name))=lower(trim(c.name))` (+ `m2` taxId join +
   `split_part(code,'-',…)` suffix join).
5. Orphans: `count(*) FILTER (WHERE "deletedAt" IS NULL)` per master +
   `EXISTS (SELECT 1 FROM "Cargo" c WHERE c."shipperId" = m.id)`.
