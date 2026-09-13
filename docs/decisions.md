# Architectural Decisions (ADRs)

> Short ADRs covering the significant decisions in each phase. Append, don't rewrite.

## ADR-001: pnpm workspaces monorepo

**Status:** Accepted (Phase 1)

We use a pnpm monorepo with `apps/` and `packages/`. pnpm provides fast, disk-efficient installs with
strict dependency isolation, which suits a large long-lived ERP. The monorepo keeps the API and web app
in one repository with shared packages, atomic cross-stack changes, and one CI pipeline.

Trade-offs: initial complexity of workspace linking (handled), and strict node_modules isolation means
each package declares its own deps explicitly — a feature for correctness.

## ADR-002: NestJS for the backend

**Status:** Accepted (Phase 1)

Requirements (transactions, business rules, RBAC guards, inter-module services, file/document generation,
reporting) map directly to NestJS: DI, modularity, decorators, interceptors, guards, pipes, and first-class
testing. A flat Express app would require re-deriving this structure manually.

Trade-offs: NestJS adds opinions and boilerplate; the long-term maintainability for a full ERP outweighs this.

## ADR-003: Next.js (App Router) + React + TypeScript + Tailwind

**Status:** Accepted (Phase 1)

Next.js gives SSR/SSG, routing, and a strong build pipeline. App Router and RSC support the future module
pages well. Tailwind keeps the design system cohesive and configurable without a runtime CSS-in-JS cost.
A dense, desktop-first operational UI is achievable with a small component set.

## ADR-004: Prisma + PostgreSQL

**Status:** Accepted (Phase 1)

PostgreSQL for relational integrity, transactions, and advanced queries. Prisma for type-safe schema,
declarative migrations, and a client that matches TypeScript strict mode. `prisma migrate` gives us
versioned SQL migrations and `deploy` for CI.

## ADR-005: cuid() string IDs instead of UUID v4

**Status:** Accepted (Phase 1)

`cuid()` ids are URL-safe, sortable, and index-friendly (avoiding the random-order write amplification of
UUID v4 B-trees), while remaining globally unique and collision-resistant across a distributed setup.
UUID columns were the alternative; comments in schema record the decision. IDs are opaque strings to the
application layer regardless.

## ADR-006: Centralized validated configuration (`@shipping/config`)

**Status:** Accepted (Phase 1)

All env-driven configuration goes through one package. Required variables are validated at startup and
fail fast with a clear `ConfigError`. This prevents sporadic misconfiguration in production. Env examples
are committed; real secrets are never committed.

## ADR-007: Consistent API envelope and versioning

**Status:** Accepted (Phase 1)

`/api/v{n}` versioning. One success envelope and one error envelope shared between API and frontend via
`@shipping/shared`. Frontend consumes the API through a single typed client. Standardizes pagination,
filtering, and error handling for every future module.

## ADR-008: Configurable numbering architecture

**Status:** Accepted (design, implementation Phase 4+)

Future documents/records (Customer Code, Job, Voyage, Manifest, B/L, Invoice, Payment, Release,
Delivery Order) need configurable numbering like `CUS-001`, `JOB-2026-00125`.

Design: a `NumberingSequence` table keyed by document type, with prefix, year/period mask, zero-padding
width, next-sequential value, and company context. Generation runs inside a database transaction with
row locking to guarantee uniqueness. No format is hard-coded in modules — services request a number from
the numbering service. Example formats above are illustrative only.

## ADR-009: Configurable document templates

**Status:** Accepted (design)

Documents (Load List, Manifest, B/L, Invoice, Payment Voucher, Release Order, Delivery Order) use
configurable templates supplied later by the company. Business logic must never depend on a fixed PDF
layout. Design: a `DocumentTemplate` registry keyed by document type; a document service renders
document data through a template engine (PDF/A layout layer), fully decoupled from domain services.
Domain services produce structured data; the template layer owns presentation.

## ADR-010: Audit architecture

**Status:** Accepted (design, implementation Phase 3+)

Immutable audit records for tracked events. Record: `user`, `action`, `entity`, `entityId`, `timestamp`,
`previousState`, `newState`. Implemented as an append-only `AuditLog` table written in the same
transaction as the mutation (no post-hoc capture). Sensitive fields redacted; states stored as JSON.
Filtered by entity + time range for the audit UI.

## ADR-011: Shared packages build to CommonJS

**Status:** Accepted (Phase 1)

NestJS (CommonJS) and Next.js (bundler) both consume `@shipping/config` and `@shipping/shared`.
Building these packages to CommonJS with an `exports` map that includes `require` and `import`
conditions keeps interop simple in the monorepo while remaining bundler-friendly for the web app.

## ADR-012: pnpm build approvals in sandbox

**Status:** Accepted (Phase 1, environment note)

pnpm (v10+) blocks dependency postinstall scripts by default. This repo declares an explicit
`onlyBuiltDependencies` allow-list in `pnpm-workspace.yaml` (prisma, prisma engines, esbuild, nest, and
their build scripts). This is reproducible and does not rely on `dangerouslyAllowAllBuilds`.

## ADR-013: Development PostgreSQL in Docker (with local fallback)

**Status:** Accepted (Phase 1)

A `docker-compose.dev.yml` provides a canonical dev database. Because some developer environments may
not have Docker available, `DATABASE_URL` is env-swappable so a locally-run PostgreSQL works identically.
CI and future test databases follow the same pattern (dedicated test database planned).

## ADR-014: JWT access token + opaque DB-backed rotation refresh token

**Status:** Accepted (Phase 2)

- **Access token:** short-lived stateless JWT (~15m) carrying `sub` (userId) only. Secret from
  `config.auth.jwtSecret`. Authorization data is **never** baked into the JWT; permissions are resolved
  from the database on every request (`resolvePermissions`) so role/permission changes take effect
  immediately with no token cache invalidations.
- **Refresh token:** opaque 48-byte random value returned to the client. Server stores a **SHA-256
  `lookupKey`** (unique, indexed, O(1) lookup) plus a **bcrypt hash** of the raw value. Never stored or
  logged in plaintext.
- **Rotation & reuse detection:** refresh tokens are single-use. On every refresh the presented token is
  consumed; a new token is issued. If a token is presented twice (reuse/replay), the whole token family
  is revoked. This is the standard OAuth refresh-token-rotation hardening.
- **Revocation:** logout, password change, and user deactivation revoke issued refresh tokens.
- **Passwords:** bcrypt, cost 12.
- **Guards:** global `JwtAuthGuard` (secure-by-default; every handler requires a valid JWT unless
  `@Public()`) then `PermissionsGuard` (AND default, `match: 'OR'` supported). Permissions re-read per
  request — a documented tradeoff of an extra query per request for immediate-revocation semantics and
  low operational module volume.

## ADR-015: Role active/inactive via soft-delete, not an `isActive` column

**Status:** Accepted (Phase 2)

Roles follow the repository's soft-delete convention: a role is **active** when `deletedAt IS NULL`,
**inactive** when `deletedAt` is set. This avoids a second boolean status column and keeps
activation/deactivation symmetric with reference-data handling. System roles (e.g. `ADMIN`) cannot be
deactivated. Users keep an explicit `isActive` boolean because login read paths and the auth flow need a
direct, indexed flag.

## ADR-016: Permissions are a read-only seeded registry

**Status:** Accepted (Phase 2)

`Permission` rows are a fixed, view-only registry seeded by the seed script — permission codes cannot be
created/edited from the UI to keep the permission vocabulary authoritative (a deliberate role/security
control). RBAC administration is limited to creating roles, naming them, and binding them to existing
permissions. Permissions are loaded via `/permissions` (read) endpoints and the admin UI.

## ADR-017: Boolean query-string filters are typed as `string`, not `boolean`

**Status:** Accepted (Phase 3)

Nest's global `ValidationPipe` uses `enableImplicitConversion: true`, which coerces the query string
`"false"` into `Boolean('false') === true` — so a naive `isActive?: boolean` query param made
`?isActive=false` behave as `true`. Rather than drop implicit conversion (which many `page`/`pageSize`
numeric DTOs depend on) or fight transform-ordering, list query DTOs type boolean filters as
`string` with `@IsIn(['true','false'])` and services convert via `parseBooleanFilter`. This is explicit,
validation-safe (a stray value such as `?isActive=maybe` is rejected with 400), and independent of
decorator ordering.

## ADR-018: Master-data lifecycle uses `PATCH /:id/active` mapped to `:update`

**Status:** Accepted (Phase 3)

Customers, Ports and Yards get an explicit activate/deactivate endpoint `PATCH /:id/active` bound to the
existing `:update` permission — no new permission codes (`no :view` / `:deactivate` variants) were added,
staying consistent with the existing `DELETE → :update` mapping. Business rules are enforced in services,
not controllers: a port cannot be deactivated while it has active yards (409 Conflict) and cannot be
deleted while it has any non-deleted yards; a yard cannot be created/moved under a missing or soft-deleted
port (404). Soft-delete (`deletedAt`) remains the deletion convention for retention-sensitive records.

## ADR-019: Cargo lifecycle state machine

**Status:** Accepted (Phase 4)

Cargo has an explicit, server-enforced lifecycle:

```
REGISTERED → AT_YARD → READY → LOADED → DELIVERED
     └───────────────┴──────┴───────────────┘ → CANCELLED (terminal)
```

Rules enforced in the service (a `TRANSITIONS` table), not the controller:

- `REGISTERED → CANCELLED` — a registered but not-yet-in-a-yard cargo may be cancelled.
- `AT_YARD → REGISTERED` — undoing a placement (driven by Yard-Inventory removal) or moving a cargo out.
- `AT_YARD → READY` — **requires `inspectionStatus = APPROVED`** (set by the Inspections module, Phase 5);
  otherwise a 409 is returned.
- `READY → LOADED`, `LOADED → DELIVERED` — forward-compatible states driven by Actual Loading (Phase 8);
  they are not reachable through Phase 4/5 endpoints alone.
- `CANCELLED` is terminal — a cancelled cargo cannot be edited or placed in a yard.

`status` is driven by the Cargo/Yard-Inventory workflows; `inspectionStatus`
(`PENDING|APPROVED|REJECTED`, default PENDING) is the single authoritative current readiness state driven
by the Inspections module (ADR-024); `loadingStatus` (`NOT_LOADED|LOADED`, default NOT_LOADED) and
`manifestNumber` (nullable) remain readiness scaffolding for later-phase workflows.

## ADR-020: One current yard-inventory record per cargo

**Status:** Accepted (Phase 4)

`YardInventory.cargoId` is `@@unique`, so a cargo has **at most one** current record. This mirrors the
operational reality of current yard stock while keeping queries simple:

- **Place** (POST /yard-inventory) — transactionally creates an `IN_YARD` record (portId mirrored from the
  yard's port) and, if the cargo was `REGISTERED`, moves it to `AT_YARD`. A second place for the same cargo
  fails with 409 (guarded both by a service check and the unique constraint as the concurrency backstop);
  cancelled cargo, an inactive yard, an inactive port, or a non-existent cargo are rejected.
- **Move/Update** (PATCH) — changes yard (re-mirroring portId), status `IN_YARD ↔ RESERVED`, location
  label or notes; cargo stays `AT_YARD`.
- **Remove** (DELETE) — transactionally deletes the record and, if the cargo was `AT_YARD`, reverts it to
  `REGISTERED`.

Full placement **history** (a timeline of where a cargo was when) is explicitly deferred to a later phase;
for now only the current record is persisted.

## ADR-021: Cargo deletion and active-inventory guard

**Status:** Accepted (Phase 4)

Cargo records are **soft-deleted** (`deletedAt`) for audit/retention. A cargo that has an active yard
inventory record cannot be hard-deleted: `DELETE /cargo/:id` returns 409 ("remove from the yard first").
This preserves referential integrity and prevents silent loss of the physical-stock link. Cancelled cargo
is not an exception — its inventory must still be removed first.

## ADR-022: CargoType enum

**Status:** Accepted (Phase 4)

`CargoType` is a closed enum — `GENERAL | VEHICLE | HEAVY_LIFT | CONTAINER | BULK | PROJECT` — matching the
operations the shipping company must support. Shares the enum across Prisma (`@prisma/client`) and the
shared contract (`@shipping/shared`) so both sides stay in lockstep.

## ADR-023: Decimal money/value serialized as string over the API

**Status:** Accepted (Phase 4)

Prisma returns `Decimal` objects that are not JSON-safe (a float `12.5` becomes `12.5` with implicit float
rounding). Cargo's `weight` is `Decimal(18,2)` with `WeightUnit KG | MT`. The Cargo service normalizes the
value to a string (e.g. `"12.5"`) before the envelope interceptor serializes it, so the API never emits a
floating-point number that could incur precision loss on the wire. `@shipping/shared` types `weight` as
`string | null`.

## ADR-024: Inspection ledger + authoritative cargo readiness

**Status:** Accepted (Phase 5)

Inspection history and the cargo's current inspection-readiness are modelled as two things that are updated
**in one database transaction** so they can never diverge:

- **`Inspection` rows** are the *traceable history* — one row per inspection attempt, with findings,
  condition, verification notes, remark, inspector, and the approval/rejection record (`approvedBy/At`,
  `rejectedBy/At`, `rejectionReason`).
- **`Cargo.inspectionStatus`** (`PENDING|APPROVED|REJECTED`, Phase 4 field) is the single authoritative
  *current* readiness state, read by load planning and the `READY` transition guard.

`approve`/`reject` call `$transaction([updateInspection, updateCargo])`; `create` sets the cargo to
`PENDING` in the same transaction. There is no separate readiness table — the cargo field is source of
truth, the inspection table is the audit/history ledger.

Lifecycle: `PENDING → APPROVED | REJECTED` (both timestamped and terminal for that inspection row). Same-state
and illegal transitions → 409 (`TRANSITIONS` map in the service). Reinspection is a **new** inspection
record for the same cargo, so history is never overwritten.

Readiness contract: `InspectionService.isCargoInspectionApproved(cargoId)` reads
`Cargo.inspectionStatus === 'APPROVED'` server-side (see `CargoLoadReadiness`), authoritative for future
Load Planning (Phase 7).

## ADR-025: Duplicate-pending inspection guard (service + partial unique index)

**Status:** Accepted (Phase 5)

To prevent two simultaneous open inspections for the same cargo ("double-booked" inspection), a `PENDING`
inspection is exclusive per cargo:

- **Service check** — `create` rejects if the cargo already has a `PENDING` inspection (409).
- **Concurrency backstop** — partial unique index
  `Inspection_one_pending_per_cargo_idx ON "Inspection"(cargo_id) WHERE status='PENDING'` added to the
  migration (Prisma doesn't model partial indexes, so it's written directly in SQL). A race that slips past
  the service check is translated to 409 via the `P2002` handler.

Decision: `PENDING` pending-exclusivity is enforced; approved/rejected history is unlimited (a cargo may be
re-inspected many times over its life). `REINSPECTION_REQUIRED` was deliberately **not** added as a status
(the Phase 4 `InspectionStatus` enum stays as `PENDING|APPROVED|REJECTED`); a needed re-check is expressed
by creating a new `PENDING` inspection for the cargo, which preserves the audit trail.

## ADR-026: Voyage state machine + reference lifecycle

**Status:** Accepted (Phase 6)

Operational voyages are driven through an explicit, server-enforced lifecycle rather than an arbitrary
mutable status field. Dedicated business operations proxy transitions:

- `DRAFT` → `SCHEDULED` (`POST /voyages/:id/schedule`, requires planned departure + arrival (ETA), both
  ordered and in UTC)
- `DRAFT` → `CANCELLED`, `SCHEDULED` → `CANCELLED` (`POST /voyages/:id/cancel`, requires `cancelReason`)
- `SCHEDULED` → `IN_PROGRESS` (`POST /voyages/:id/start`)
- `IN_PROGRESS` → `COMPLETED` (`POST /voyages/:id/complete`)
- `COMPLETED` / `CANCELLED` are terminal historical states; no outgoing transitions.

The service enforces these via a `TRANSITIONS` map (`assertTransition`) and returns **409** for illegal
transitions. `schedule`/`start`/`complete`/`cancel` return HTTP **200** (`@HttpCode(HttpStatus.OK)`),
consistent with the Auth/Inspection action-POST convention.

Editing rules: a `DRAFT` voyage may be re-targeted (vessel/ports) and edited; once `SCHEDULED` the route
(vessel/ports) becomes read-only and only `notes` may change; `IN_PROGRESS`/`COMPLETED`/`CANCELLED` are
read-only. Voyage numbers are auto-generated `VOY-YYMM-####` via `generateReference()` (same pattern as
Inspection `INS-…`/Cargo `CRG-…`). No cargo assignment in Phase 6 — that is Phase 7 (Load Planning).

## ADR-027: Single-vessel no-overlap scheduling rule + vessel lifecycle guard

**Status:** Accepted (Phase 6)

A vessel runs one route at a time: `schedule` rejects (409) any window
`[plannedDepartureAt, plannedArrivalAt]` that overlaps an existing **unfinished**
(`DRAFT`/`SCHEDULED`/`IN_PROGRESS`) voyage of the same vessel (ADR-026). The guard runs in the service
inside the schedule operation (`assertNoOverlap`, exchangeable in a later `$transaction`); `DRAFT` voyages
have no window and so never conflict; `COMPLETED`/`CANCELLED` (historical) voyages never block new ones.

Companion rule — vessel lifecycle: a vessel with any unfinished voyage cannot be **deactivated** (409);
completed historical voyages do **not** block deactivation and remain readable. A vessel referenced by any
voyage (historical or not) is **not hard-deleted** (`remove` → 409; the frontend deactivates instead).
This preserves operational history while preventing a vessel from being taken out of service mid-voyage.

Rationale: a separate physical vessel does run two schedules, but a **single vessel** represents the same
tonnage; allowing two simultaneous unfinished voyages on one vessel would silently double-count capacity
in Phase 7 load planning. No cross-vessel constraint applies.

## ADR-028: Actual Loading — server-enforced lifecycle, one-per-load-list, loadout integration

**Status:** Accepted (Phase 8)

Actual Loading records what was physically loaded against a Load List. It is the transition to the cargo
`LOADED` state and the point at which cargo leaves the yard.

- **Lifecycle (server-enforced via `ACTUAL_LOADING_TRANSITIONS`):** `NOT_STARTED` → `IN_PROGRESS`
  (`POST /actual-loading/:id/start`) → `COMPLETED` (`POST /actual-loading/:id/complete`); `CANCELLED`
  (`POST /actual-loading/:id/cancel`) is reachable only from `NOT_STARTED`/`IN_PROGRESS` and **requires a
  `cancelReason`**. `COMPLETED`/`CANCELLED` are terminal and immutable (`update`/`updateItem` → 409).
  Action POSTs return **200** (`@HttpCode(HttpStatus.OK)`), matching the Auth/Inspection/Voyage convention.
- **One Actual Loading per Load List:** `ActualLoading.loadListId` has `@@unique`, so re-running loading
  for the same list is a unique-violation → **409** (a cancelled run can be superseded only by a fresh
  Load List). Creation additionally requires the Load List to be **FINALIZED** (409 otherwise) and to have
  ≥1 item (400 otherwise); soft-deleted lists are rejected.
- **Quantity semantics:** `actualQuantity` is per Load List item (unique), never negative (`@Min(0)` + DTO;
  bulk path re-validates in service), and never exceeds `plannedQuantity` (400). Per-item `result` is
  derived on write: `0 → NOT_LOADED`, `≥ planned → FULL`, else `PARTIAL`.
- **The frontend must not be the integrity boundary:** `updateItem`/`updateItemsBulk` re-query each Load
  List item's cargo and reject CANCELLED cargo and non-`APPROVED` inspection (409/Conflict). `complete`
  re-validates **all** items against current cargo state (419-proof) before committing.
- **Cargo leaves the yard only on completion:** in the same `$transaction` that sets `status = COMPLETED`,
  items with `result = FULL` get `cargo.loadingStatus = LOADED` and their `YardInventory` record is deleted
  (ADR-020 current-inventory model) — cargo has left the yard. `PARTIAL`/`NOT_LOADED` cargo stays in the
  yard and remains eligible for later planning.

Core validation: `ActualLoading.items[].loadListItemId` must belong to the Actual Loading's own Load List
(404/NotFound otherwise).

## ADR-029 — Manifest lifecycle, one-per-voyage at application level, actual-quantity snapshots

**Status:** accepted (Phase 9, 2026-09-12)

- Lifecycle `DRAFT → SUBMITTED → APPROVED`; `DRAFT|SUBMITTED → CANCELLED` with mandatory
  `cancelReason`; APPROVED/CANCELLED terminal. Header/items editable in DRAFT only.
- One LIVE manifest per voyage is enforced by the service (`findFirst(voyageId, deletedAt: null)`),
  NOT by a DB constraint: `@@unique(voyageId)` conflicts with soft-delete (a deleted draft would
  hold the voyage slot forever — recreate after soft-delete failed with 409 in e2e). Schema keeps
  `@@index(voyageId)`.
- Eligible cargo = cargo present in a COMPLETED Actual Loading for the voyage (not already on the
  manifest). Item `quantity` snapshots `actualLoadingItem.actualQuantity ?? cargo.quantity` —
  the manifest reflects what was actually loaded.
- Totals (`totalWeight/totalQuantity/totalPackages`) recomputed server-side from item snapshots on
  every write.
- Cost fields accept strings from the UI via `@Transform` coercion; `number | null` union types
  break `emitDecoratorMetadata` implicit conversion (documented pitfall).

## ADR-030 — B/L issued against APPROVED manifest; one live bill per manifest line

**Status:** accepted (Phase 10, 2026-09-12)

- Legacy duna order is `B/L → Manifest`; the new model issues B/Ls against an APPROVED Manifest
  (modernized chain: Actual Loading → Manifest → B/L → Invoice). Rationale: the new domain's
  manifest lines are the authoritative record of what was actually loaded, so documents are cut
  from them; the legacy `ManifestItem.blNumber` column becomes the link written by `issue`.
- Lifecycle `DRAFT → ISSUED`; `DRAFT|ISSUED → CANCELLED` (reason mandatory). ISSUED is frozen
  (cancel only). DRAFT-only header/item edits and soft delete.
- A manifest line may belong to at most one LIVE (non-cancelled, non-deleted) B/L. Enforced at
  application level with the same soft-delete rationale as ADR-029; cancellation and soft-delete
  release the line back to `eligible-items`.
- `issue` stamps `ManifestItem.blNumber = billNumber` for its lines in one transaction;
  `cancel` clears the stamp only on rows still stamped with this bill's number.
- Line snapshots default from the manifest line + cargo (packages/packageType/grossWeight;
  cargo.specification → goodsDescription, serialNumber → marksAndNumbers) with per-line overrides;
  totals recomputed server-side from the frozen snapshots.
---

## ADR-031: Invoice line model — quantity x unitPrice with server-maintained amount

**Date:** 2026-09-12 | **Status:** Accepted

**Context.** Legacy `duna` InvoiceItem had only `description + amount` — no quantity/unit price. Real invoices need qty x price; naive `amount`-only lines lose audit fidelity and make price changes unauditable.

**Decision.** InvoiceItem stores `description`, `quantity` (int, >=1), `unitPrice` Decimal(18,2) and `amount` (= quantity x unitPrice, maintained server-side on every line write). Header stores `subtotal` (SUM(amount)), `taxRate`, `discountAmount`, `taxAmount` (= (subtotal - discount) x taxRate%), `totalAmount` (= subtotal - discount + tax) — recomputed atomically in one service helper after any header or line mutation. Clients never send totals.

**Consequences.** (1) SUM(amount) is a single-column aggregate — cheap reporting. (2) Header totals are derived data; a future recalculation job can rebuild them from lines. (3) `paidAmount` is owned by Phase 12 (receipt/payment vouchers) — Invoice service only reads it; `unpaid`/`overdue` are derived filters, not stored states.


---

## ADR-032: Vouchers recompute-focused; ledger derived, no table

**Date:** 2026-09-12 | **Status:** Accepted

**Context.** Legacy Fin was a single payment table (invoice_id NOT NULL, Payment/Received types) with paid amounts inferred; the "ledger" was a separate report page. Questions: real column vs computed paidAmount, and whether the ledger needs its own table.

**Decision.**
1. `Voucher` carries `type: RECEIPT | PAYMENT` and a nullable `invoiceId` (deposits/advances without invoice allowed). Linking requires an ISSUED invoice in the same currency (409 otherwise).
2. `Invoice.paidAmount` is a cache column **recomputed from the sum of live (non-cancelled) linked vouchers** on every create/update/cancel/delete — never incremented; edits and cancellations self-correct.
3. **No ledger table:** the customer statement is derived by merging ISSUED invoices (debit) and POSTED vouchers (credit) with opening/running/closing balances, ordered by date, with currency/window/kind filters.
4. POSTED vouchers stay editable (common cash-entry fixes), unlike frozen ISSUED invoices; cancel (with reason) is the only exit from POSTED; delete only after cancel — audit first.
5. Numbering split by type: RCP-YYMM-##### / PMT-YYMM-#####.

**Consequences.** Financial truth lives in the vouchers; paidAmount can always be rebuilt from source. The ledger needs no migration and can never disagree with documents. Editing a voucher triggers a single recompute per affected invoice. ADR-031's invoice totals remain the charge side of every statement.

---

## ADR-033: Delivery/Release Orders issued directly; release holds on unpaid invoices

**Date:** 2026-09-12 | **Status:** Accepted

**Context.** Legacy DeliveryOrder/ReleaseOrder were thin rows off a B/L with no lifecycle and no tie to money. For the rebuild two questions arose: do these documents need a DRAFT stage, and should cargo release require settlement?

**Decision.**
1. D/O and R/O are two models in one module (`delivery-release`), **issued directly** — no DRAFT: the only transition is `ISSUED -> CANCELLED` (reason required, rows kept for audit; delete only after cancel).
2. **One active D/O (resp. R/O) per B/L**, enforced at service level (409) — a cancelled row frees the B/L for a fresh document.
3. D/O requires the B/L to be **ISSUED** (409 otherwise); numbering `DO-YYMM-#####` / `RO-YYMM-#####` shared sequence shape with the rest of the suite.
4. **"No money, no cargo" (R/O):** every ISSUED invoice anchored to the B/L must be fully paid (`paidAmount >= totalAmount`); a B/L with zero invoices releases freely. Breach -> 409 naming the outstanding total.
5. Authorized escape hatch: `release:override` permission + mandatory `overrideReason` stamps `financialOverride = true` and keeps the reason on the row for audit. Permission violation -> **403** (not 409); missing reason with force -> 400.
6. `GET /release-orders/eligibility?billOfLadingId=` exposes canRelease / needsOverride / billed / paid / outstanding so the UI can warn before submit — the create dialog shows the settlement card and reveals the force+reason flow only when blocked.

**Consequences.** The ops chain (Manifest -> B/L -> Invoice -> Vouchers -> Release) is closed end-to-end on one rule: cargo leaves only against settled invoices or a recorded, permission-checked exception. D/O stays purely operational (no financial rule). Deleting requires cancel-first everywhere, keeping the audit trail intact.

---

## ADR-034: Proforma mirrors Invoice math; one-time conversion via linkedInvoiceId

**Date:** 2026-09-13 | **Status:** Accepted

**Context.** The roadmap adds proforma invoices (quotes) with no legacy counterpart. Two questions: repeat the Invoice line/totals model or simplify, and how a quote becomes a real invoice without double-charging.

**Decision.**
1. `Proforma` + `ProformaItem` mirror the Invoice header/line structure (same `quantity × unitPrice` lines, same subtotal/tax/discount/total math, same PRF-YYMM-##### numbering) — quotes and bills stay visually and mathematically consistent.
2. Zero financial effect: no paidAmount column, vouchers cannot link to a proforma, ledger ignores it entirely.
3. `validUntil` replaces `dueDate` — a quote expires; a bill falls due.
4. **One-time conversion:** `POST /proformas/:id/convert` (permission `proforma:convert`) copies header + items into a new DRAFT invoice (its own INV number, totals recomputed server-side) and stamps `proforma.linkedInvoiceId` (unique index = the guard; a second convert 409s). Allowed from DRAFT or ISSUED; never from CANCELLED.
5. The created invoice is a normal DRAFT invoice — the standard edit/issue/voucher chain applies to it unchanged; the proforma stays ISSUED as the quote of record (both numbers visible in each UI).

**Consequences.** Conversion is auditable from both sides (proforma.linkedInvoiceId ⇄ invoice.convertedProforma). The money pipeline (vouchers, ledger, release hold) only ever sees real invoices — quotes cannot leak into accounting. One migration, no changes to existing tables beyond a nullable unique FK.


## ADR-035: Quotation lifecycle with one-time conversion into Proforma

**Date:** 2026-09-13 | **Status:** Accepted

**Context.** The commercial chain needs a front stage before the proforma: the customer asks for a price, sales sends a quote, the customer accepts or rejects. ADR-034 already made Proforma→Invoice a one-time conversion. Open questions: whether a quote converts straight to an invoice (skipping the proforma), and whether a quote needs more states than the proforma's DRAFT/ISSUED pair.

**Decision.**
1. `Quotation` + `QuotationItem` mirror the proforma header/line structure (same totals math, same currency handling, `validUntil` = quote validity). Numbering `QT-YYMM-#####`.
2. Five states instead of three: DRAFT → SENT → ACCEPTED | REJECTED, with CANCELLED reachable from DRAFT/SENT. SENT freezes content (a quote must not change after the customer received it); ACCEPTED/REJECTED stamp actor + timestamp; reject and cancel require a reason; delete stays DRAFT-only.
3. **Conversion goes to Proforma only:** `POST /quotations/:id/convert` (permission `quotation:convert`) is allowed only from ACCEPTED and creates a fresh DRAFT proforma copying header + lines; the unique `linkedProformaId` FK makes it one-time (second attempt 409). A quote never becomes an invoice directly — ADR-034 remains the only invoicing path.
4. Zero financial effect: quotations (like proformas) cannot receive vouchers, never touch the ledger, and are invisible to the R/O release hold.

**Consequences.** The chain Quote → Proforma → Invoice gives each negotiation stage its own document and number, auditable both ways (`quotation.linkedProformaId` ⇔ `proforma.quotation`). Rejected/expired quotes stay queryable for win-rate reporting. The per-stage permission gates (sales sends, ops accepts, finance converts) add two endpoints over the proforma design but keep every hand-off explicit.

---

## ADR-036: Salaries are self-contained documents; no voucher/ledger posting on pay()

**Date:** 2026-09-13
**Status:** Accepted
**Context:** Phase 16 (Employees & Payroll). A natural expectation was that paying a payslip posts an expense voucher into the ledger, mirroring how invoice payments create receipt vouchers (ADR-032/034).
**Decision.**
1. `SalaryRecord.pay` records only the payment fact on the payslip itself: `paymentMethod` (CASH/BANK_TRANSFER/CHEQUE/OTHER), optional `paymentRef`, and `paidBy/At` audit stamps. No `Voucher` row is created and no customer ledger entry is touched.
2. The reason is structural, not cosmetic: `Voucher` requires a `customerId` — it is a **customer-centric** instrument by design (ADR-032), so posting payroll through it would mix employee payments into customer receivables, corrupting aging and release-hold logic (ADR-033).
3. Payslips therefore carry their own audit trail end-to-end, and the payroll list stays a complete money record (`base + additions − deductions = net`, server-computed, frozen on APPROVED).
**Consequences.** Real expense accounting for salaries (supplier/expenses module with debit vouchers, cash/bank accounts, and month-end payroll journal) is deferred to a dedicated future phase; when it lands, it will link to payslips by `paymentRef`-style FKs rather than reusing `Voucher.customerId`. A `@@unique(employeeId, year, month)` prevents double-paying a period, and cancel preserves the reason for audit while DRAFT-only delete keeps drafts disposable.

---

## ADR-037: Correspondence register with direction-driven lifecycle and one-click threaded replies

**Date:** 2026-09-13
**Status:** Accepted
**Context:** Phase 17 (Letters). Business correspondence — customs notices, agent claims, port-control requests — must be registered and retrievable for audit, with replies linked to their trigger letter.
**Decision.**
1. Direction drives the lifecycle, not a generic state machine: INCOMING letters are created directly as RECEIVED (an arrived letter is a fact, never a draft); OUTGOING letters follow DRAFT → SENT. Both reach terminal ARCHIVED from their active state. Content edits and deletes are DRAFT-only — a sent letter is immutable, mirroring the quotation freeze rule (ADR-035).
2. Threading is a plain self-relation (`replyToId`): any letter may spawn multiple replies; no tree walk is needed for the UI (list shows ↩ indicator + repliesCount, detail links the single parent). One-click `POST /letters/:id/reply` mirrors contacts and prefixes `Re: ` so clerks never retype headers.
3. Contacts are free-text (`fromContact`/`toContact`), with an optional customer FK for correspondence tied to accounts — most counterparties (customs, port control) are not customers, so a required customer link was rejected.
4. No attachments in v1: the register holds the text and reference numbers; file storage is deferred with the templates phase.
**Consequences.** The register is cheap to keep (single table + self-FK) and gives the Letters module an auditable, immutable record of what was sent and when. Replies are ordinary letters, so filters and the future Agent Portal (Phase 20) treat them uniformly; the cost is that multi-level threads are only visible through the parent link, which is acceptable for a small operation.
