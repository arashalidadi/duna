# Database Schema

## Conventions

- **IDs**: `cuid()` string primary keys (via Prisma `@default(cuid())`). Ordered, URL-safe, and
  distributed-friendly. See [decisions.md](decisions.md) for rationale.
- **Timestamps**: every entity has `createdAt` and `updatedAt`. All timestamps are stored in UTC.
  The company timezone (`Asia/Dubai`, configurable via `CompanySettings.timezone`) is applied only at
  presentation time.
- **Soft deletion**: entities whose records must be retained for legal/operational reasons have a
  nullable `deletedAt`. Hard deletes used only for pure relationships (join tables).
- **Status**: domain entities carry explicit status fields that evolve through defined lifecycles
  rather than being inferred from other columns.
- **Money**: monetary values use `Decimal` (`@db.Decimal(18, 2)`) — never float.
- **Currency**: ISO 4217 code stored as string (`currency` columns / `Currency.code`). Multiple
  currencies are supported; no currency logic is hard-coded into modules.
- **Auditability**: every entity carries audit timestamps; a dedicated immutable `AuditLog` table is
  planned for Phase 3+ (see [decisions.md](decisions.md) — Audit architecture).

## ER model (foundation — Phase 1)

```
User ──< UserRole >── Role ──< RolePermission >── Permission

User ──< RefreshToken

CompanySettings   (singleton)

Currency

Port ──< Yard ──< YardInventory >── Cargo

Customer ──< Cargo

Cargo has destinationPort (FK → Port) and port (FK → Port)
```

### Identity & Access

| Table            | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `User`           | System users, credentials, active flag         |
| `Role`           | Named roles (`ADMIN`, `OPERATIONS`, …)         |
| `Permission`     | Claims `module:action` (e.g. `invoice:create`) |
| `RolePermission` | M:N role → permissions (composite PK)          |
| `UserRole`       | M:N user → roles (composite PK)                |
| `RefreshToken`   | Opaque rotation refresh tokens (Phase 2)       |

### RefreshToken (Phase 2)

| Column              | Notes                                                        |
| ------------------- | ------------------------------------------------------------ |
| `userId`            | FK → User; cascade                                           |
| `tokenHash`         | bcrypt hash of the raw refresh value; unique                 |
| `lookupKey`         | SHA-256 of the raw value; unique, indexed → O(1) lookup      |
| `expiresAt`         | UTC expiration (default 7d)                                  |
| `revokedAt`         | null while valid; set on logout/revocation                   |
| `replacedByTokenId` | points to the successor token on rotation (link for family revocation) |

### Company & money

| Table             | Purpose                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `CompanySettings` | Singleton company profile: name, tax/reg numbers, timezone, default currency, supported currencies (JSON) |
| `Currency`        | Reference list of currencies (code, name, symbol, active, sort order)                                     |

### Geography

| Table  | Purpose                                              |
| ------ | ---------------------------------------------------- |
| `Port` | Reference: code (e.g. `JEBALI`), name, country, city |
| `Yard` | Belongs to a port; code, name, address               |

### Operations — Cargo & Yard Inventory (Phase 4) & Inspections (Phase 5)

`Cargo` is the operational cargo record; `YardInventory` holds the single current yard placement;
`Inspection` is the traceable history of inspection attempts against a cargo.

| Table           | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `Cargo`         | Operational cargo: reference, type, identifiers, weight, status lifecycle |
| `YardInventory` | One current record per cargo (`cargoId @@unique`): yard, port, status     |
| `Inspection`    | Inspection history ledger; plus current readiness on `Cargo.inspectionStatus` |

**`Cargo` columns** (key ones): `reference` (unique, auto `CRG-<YYMM>-<seq5>`), `customerId`, `portId`,
`yardId`, `destinationPortId`, `cargoType`, `specification`, `serialNumber`, `chassisNumber`, `vin`,
`weight` (`Decimal(18,2)`), `weightUnit` (`KG|MT`), `quantity`, `packages`, `packageType`,
`arrivalDate`, `arrivalReference`, `manifestNumber`, `inspectionStatus` (`PENDING|APPROVED|REJECTED`,
default PENDING), `loadingStatus` (`NOT_LOADED|LOADED`, default NOT_LOADED), `status`
(`REGISTERED|AT_YARD|READY|LOADED|DELIVERED|CANCELLED`, default REGISTERED), `comments`, `deletedAt`
(soft-delete).

**`YardInventory` columns**: `cargoId` (`@@unique`), `yardId`, `portId` (mirrored from the yard's port),
`status` (`IN_YARD|RESERVED`, default IN_YARD), `enteredAt`, `locationLabel`, `notes`, `createdById`,
`updatedById`.

**`Inspection` columns**: `id`, `inspectionNumber` (unique, auto `INS-<YYMM>-<seq5>`), `cargoId`
(ref → Cargo), `status` (`PENDING|APPROVED|REJECTED`, default PENDING), `inspectionDate` (UTC),
`inspectorId` / `inspectorName`, `findings`, `condition`, `verificationNotes`, `remarks`,
`rejectionReason`, `approvedById`/`approvedAt`, `rejectedById`/`rejectedAt`, `createdById`,
`createdAt`, `updatedAt`. Unique: `inspectionNumber`. Partial unique index
`Inspection_one_pending_per_cargo_idx (cargoId) WHERE status='PENDING'` forbids two simultaneous open
inspections for a cargo. Indexes on `cargoId`, `status`, `inspectionDate`, `inspectorId`, `createdById`.

**Readiness model (ADR-024):** `Inspection` rows keep inspection history; `Cargo.inspectionStatus` is the
single authoritative **current** readiness state. `approve`/`reject` update both in one transaction.

Lifecycle and the single-current-record model are documented in ADR-019 / ADR-020, inspection
lifecycle in ADR-024 / ADR-025.

### Operations — Vessels & Voyages (Phase 6)

`Vessel` is the operational master / registry record; `Voyage` is an operational sailing of a vessel
between an origin and a destination port. No cargo assignment in Phase 6 (that is Load Planning, Phase 7).

| Table    | Purpose                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `Vessel` | Vessel registry: unique `code`, IMO (unique, nullable), flag, type, declared TEU capacity, active lifecycle |
| `Voyage` | Operational sailing: unique `voyageNumber`, vessel + origin/destination ports, planned dates, lifecycle status |

**`Vessel` columns**: `id`, `code` (`@unique`, master-data convention — immutable after create),
`name`, `imo` (`@unique` when supplied, validated 7-digit), `flag` (plain country string, consistent with
`Port.country`), `vesselType` (`CONTAINER|BULK|TANKER|RORO|GENERAL|PROJECT|OTHER`, default none — required),
`capacityTeu` (`Int?` — declared master-data stowage capacity, informational only), `isActive`
(`Boolean @default(true)`), `notes`, `createdAt`, `updatedAt`, `deletedAt` (soft-delete, blocked while any
voyage references the vessel — deactivate instead, ADR-027). Indexes on `code`, `name`, `flag`,
`vesselType`, `isActive`; unique on `code` and `imo`.

**`Voyage` columns**: `id`, `voyageNumber` (`@unique`, auto `VOY-<YYMM>-<seq5>`), `vesselId` (ref →
Vessel, `ON DELETE RESTRICT`), `status` (`DRAFT|SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED`, default DRAFT),
`originPortId` (ref → Port), `destinationPortId` (ref → Port), `plannedDepartureAt` (`DateTime?` UTC,
required to schedule), `plannedArrivalAt` (`DateTime?` UTC — ETA, required to schedule; must be ≥ departure),
`cancelReason`, `notes`, `createdById` (ref → User, `ON DELETE SET NULL`), `createdAt`, `updatedAt`.
Indexes on `voyageNumber`, `vesselId`, `status`, `originPortId`, `destinationPortId`,
`plannedDepartureAt`, `plannedArrivalAt`, `createdAt`.

**State machine (ADR-026):** `DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED`, plus `CANCELLED` from
`DRAFT`/`SCHEDULED`. Status changes are dedicated operations (schedule/start/complete/cancel), never an
arbitrary PATCH. A vessel cannot run two overlapping unfinished voyages (service-enforced at schedule,
ADR-027); a vessel with unfinished voyages cannot be deactivated and a referenced vessel is never
hard-deleted.

### Commercial

| Table      | Purpose                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| `Customer` | Master data: unique `code`, name, type, contacts, credit limit, currency, taxes.   |
|            | `Customer → Cargo` and `Customer → Job/Invoice/…` relations added in later phases. |

## Planned major entities (later phases)

These are designed but **not yet implemented**. Listed to make future schema extensions predictable.

```
Vessel and Voyage (Phase 6) are implemented (see above).

Port / Yard / Customer / Cargo / YardInventory / Inspection / Vessel / Voyage are implemented (see above).

LoadPlan / LoadList   (planned ↔ actual loading of containers/cargo onto a voyage)
ActualLoading
Manifest            (finalized summary, locked + audited)
BillOfLading        (issued documents, configurable numbering, template refs)

Job                 (cost centre)
JobLine             (expenses and revenue)
Invoice
InvoiceLine
Payment
LedgerEntry         (customer ledger; posting-based)
CurrencyRate        (exchange rates for multi-currency accounting)

ReleaseOrder
DeliveryOrder
Discharge

NumberingSequence   (configurable numbering per document type)
DocumentTemplate    (configurable templates; company templates supplied later)

AuditLog            (immutable audit records)
```

These will be added incrementally in subsequent phases using the conventions above. No architectural
changes to the foundation are expected when they land: they attach to existing roots
(`Customer`, `Port`, `Yard`, `User`, `Currency`) via foreign keys and standard lifecycle fields.

## Indexes & constraints

- Unique constraints: `User.email`, `Role.code`, `Permission.code`, `Currency.code`, `Port.code`,
  `Yard.code`, `Customer.code`, `RefreshToken.tokenHash`, `RefreshToken.lookupKey`, `Cargo.reference`,
  `YardInventory.cargoId`, `Inspection.inspectionNumber`.
- Phase 5 adds a partial unique index `Inspection_one_pending_per_cargo_idx (cargoId) WHERE status='PENDING'`
  (duplicate simultaneous open inspections blocked) and B-tree indexes on `Inspection.cargoId`, `status`,
  `inspectionDate`, `inspectorId`, `createdById`.
- Composite unique PKs on `RolePermission` and `UserRole` prevent duplicate grants.
- B-tree indexes added on common lookup fields (`isActive`, `name`/`code` text searches, `type`).
- Phase 3 added `Port.country` index (migration `20260902225307_phase3_master_data_indexes`) to support
  the exact-match country filter. Boolean query filters are typed `string` with `@IsIn(['true','false'])`
  and converted in services (see ADR-017) because `enableImplicitConversion` coerces `"false"` → `true`.
- Text search uses `contains ... mode: insensitive` for reference lists; large-scale NOCASE indexes
  or trigram indexes (pg_trgm) can be added when module volumes demand it.
- Phase 4 added filters for common lookup fields on `Cargo` (status, type, `inYard` derived from the
  `YardInventory` relation) and `YardInventory` (status, yard); text search on `reference`,
  `arrivalReference`, and serial/VIN fields uses `contains ... mode: insensitive`.
