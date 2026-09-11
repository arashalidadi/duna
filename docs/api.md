# API

## Conventions

- Base path: `/api/v1` (versioned).
- JSON only. All timestamps ISO-8601 UTC.
- Characterization of successful vs error responses:

### Success envelope

```jsonc
{
  "success": true,
  "data": {/* resource or list */},
  "meta": { "timestamp": "2026-09-01T10:00:00.000Z" },
}
```

### Error envelope

```jsonc
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "string | string[]",
    "error": "Bad Request",
    "path": "/api/v1/customers",
    "timestamp": "2026-09-01T10:00:00.000Z",
    "details": {}, // optional, never in production for 5xx
  },
  "meta": { "timestamp": "…" },
}
```

## HTTP status conventions

| Status | Meaning                                                            |
| ------ | ------------------------------------------------------------------ |
| 200    | OK (successful read/update)                                        |
| 201    | Created                                                            |
| 204    | Deleted (soft delete) — not yet final; PATCH/GET semantics planned |
| 400    | Validation failure / malformed input                               |
| 401    | Unauthenticated (missing/invalid token)                            |
| 403    | Forbidden (RBAC — valid token, insufficient permission)            |
| 404    | Not found                                                          |
| 409    | Conflict (unique constraint, e.g. duplicate code; business rule — e.g. deactivating a port with active yards) |
| 422    | Business-rule violation (planned)                             |
| 500    | Internal error (generic message in production)                     |

## Pagination

- Query: `?page=1&pageSize=25` (defaults page=1, pageSize=25; pageSize capped at 100).
- List responses:

```jsonc
{
  "data": [ … ],
  "meta": { "page": 1, "pageSize": 25, "totalItems": 42, "totalPages": 2 }
}
```

## Filtering & sorting

- `search` performs a case-insensitive contains across sensible text fields per resource.
- Resource-specific filters: e.g. `?portId=` on `/yards`, `?type=` on `/customers`.
- Sorting: deterministic default order per resource (e.g. `code asc`). Explicit
  `?sort=field&order=asc|desc` is planned and will be implemented centrally via a shared sort pipe.

## Endpoints (master data — Phase 1 + Phase 3 increment)

| Method | Path                    | Description                               |
| ------ | ----------------------- | ----------------------------------------- |
| GET    | `/api/v1`               | API metadata                              |
| GET    | `/api/v1/health`        | App + database status (used by dashboard) |
| GET    | `/api/v1/currencies`    | List active currencies                    |
| GET    | `/api/v1/ports`         | Paginated ports (search; filter `country`, `isActive`) |
| POST   | `/api/v1/ports`         | Create port                               |
| GET    | `/api/v1/ports/:id`     | Get port (**includes related `yards`**)   |
| PATCH  | `/api/v1/ports/:id`     | Update port                               |
| PATCH  | `/api/v1/ports/:id/active` | Activate/deactivate port (`:update`; 409 while it has active yards) |
| DELETE | `/api/v1/ports/:id`     | Soft-delete port (`:update`; 409 while it has yards) |
| GET    | `/api/v1/yards`         | Paginated yards (filter `portId`, `isActive`) |
| POST   | `/api/v1/yards`         | Create yard (404 if port is missing/soft-deleted) |
| GET    | `/api/v1/yards/:id`     | Get yard                                  |
| PATCH  | `/api/v1/yards/:id`     | Update yard (404 on invalid `portId`)     |
| PATCH  | `/api/v1/yards/:id/active` | Activate/deactivate yard (`:update`)   |
| DELETE | `/api/v1/yards/:id`     | Soft-delete yard (`:update`)              |
| GET    | `/api/v1/customers`     | Paginated customers (search incl. phone; filter `type`, `isActive`) |
| POST   | `/api/v1/customers`     | Create customer                           |
| GET    | `/api/v1/customers/:id` | Get customer                              |
| PATCH  | `/api/v1/customers/:id` | Update customer                           |
| PATCH  | `/api/v1/customers/:id/active` | Activate/deactivate customer (`:update`) |
| DELETE | `/api/v1/customers/:id` | Soft-delete customer (`:update`)          |

## Endpoints (operations — Cargo & Yard Inventory, Phase 4)

| Method | Path                            | Description                                | Permission |
| ------ | ------------------------------- | ------------------------------------------ | ---------- |
| GET    | `/api/v1/cargo`                 | Paginated cargos (search `reference`/`arrivalReference`/VIN/…; filters `status`, `type`, `customerId`, `portId`, `yardId`, `destinationPortId`, `inYard`) | `cargo:read` |
| POST   | `/api/v1/cargo`                 | Create cargo (auto reference `CRG-YYMM-seq5`) | `cargo:create` |
| GET    | `/api/v1/cargo/:id`             | Get cargo (includes `customer`, `port`, `yard`, `destinationPort`, `inventory`) | `cargo:read` |
| PATCH  | `/api/v1/cargo/:id`             | Update cargo fields (`clearYard`/`clearDestination` behavior) | `cargo:update` |
| PATCH  | `/api/v1/cargo/:id/status`      | Transition cargo status (guarded state machine, ADR-019) | `cargo:transition` |
| DELETE | `/api/v1/cargo/:id`             | Soft-delete cargo (409 while it has active inventory) | `cargo:delete` |
| GET    | `/api/v1/yard-inventory`        | Paginated inventory (search/filter `yardId`, `status`, `cargoStatus`) | `yard-inventory:read` |
| POST   | `/api/v1/yard-inventory`        | Place cargo in a yard (transactional; AT_YARD; 409 on duplicate) | `yard-inventory:create` |
| PATCH  | `/api/v1/yard-inventory/:id`    | Move / update (yard, portId mirror, status `IN_YARD\|RESERVED`, location label) | `yard-inventory:update` |
| DELETE | `/api/v1/yard-inventory/:id`    | Remove from yard (reverts cargo to REGISTERED) | `yard-inventory:remove` |

Notes (Cargo):

- `inYard` is a **server-only** query filter (`?inYard=false` lists cargos with no active inventory record).
  In the list rows, derive presence from the `inventory` relation.
- `weight` is `Decimal(18,2)` serialized as a string over the API (ADR-023); `weightUnit` ∈ `KG|MT`.
- Cancelled cargo cannot be edited or placed in a yard. `READY` requires `inspectionStatus = APPROVED`
  (409 otherwise; unblocked by the future Inspections module).

Notes (Yard Inventory):

- Create consumes `cargoId`, `yardId`, optional `locationLabel`/`notes`; `portId` is mirrored from the yard.
- Move re-mirrors `portId` from the destination yard; the unique `cargoId` constraint forbids a second
  current record (409).

## Endpoints (operations — Inspections, Phase 5)

| Method | Path                               | Description                                                        | Permission |
| ------ | ---------------------------------- | ------------------------------------------------------------------ | ---------- |
| GET    | `/api/v1/inspections`              | Paginated inspections (search `inspectionNumber`/`inspectorName`/serial/VIN/customer; filters `status`, `cargoId`, `customerId`, `yardId`, `inspectionFrom`, `inspectionTo`; sort `inspectionNumber\|inspectionDate\|createdAt`, order `asc\|desc`) | `inspection:read` |
| POST   | `/api/v1/inspections`              | Create inspection (auto reference `INS-YYMM-seq5`; sets cargo to `PENDING`) | `inspection:create` |
| GET    | `/api/v1/inspections/cargo/:cargoId/history` | Inspection history for a cargo, newest first                     | `inspection:read` |
| GET    | `/api/v1/inspections/:id`          | Inspection detail (includes cargo + actor refs + rejection reason) | `inspection:read` |
| PATCH  | `/api/v1/inspections/:id`          | Update a `PENDING` inspection (409 once finalized)               | `inspection:update` |
| POST   | `/api/v1/inspections/:id/approve`  | Approve (200; transactional: cargo → `APPROVED`, eligible for load planning) | `inspection:approve` |
| POST   | `/api/v1/inspections/:id/reject`   | Reject (200; `rejectionReason` required, 400 without; transactional: cargo → `REJECTED`) | `inspection:reject` |

Notes (Inspections):

- `Inspection` rows are the **traceable history** ledger; `Cargo.inspectionStatus` (Phase 4) is the single
  authoritative **current** readiness state. Lifecycle: `PENDING → APPROVED | REJECTED` (ADR-024).
- `approve`/`reject` update the inspection **and** `Cargo.inspectionStatus` in one transaction so they can
  never diverge. Reinspection is a NEW inspection record for the same cargo (history preserved).
- A duplicate `PENDING` inspection for the same cargo is blocked (409; service check + partial unique index).
- `reject` returns 400 if `rejectionReason` is missing. Once finalized, an inspection cannot be
  re-approved/rejected or re-edited (409).
- Readiness contract for future Load Planning: `InspectionService.isCargoInspectionApproved(cargoId)`
  reads `Cargo.inspectionStatus === 'APPROVED'` (server-side authoritative; see `CargoLoadReadiness`).

## Endpoints (operations — Vessels & Voyages, Phase 6)

Vessels are operational master / registry data; Voyages are operational sailings. Voyage lifecycle is a
server-enforced state machine (ADR-026); a single vessel cannot run two overlapping unfinished voyages
(ADR-027).

### Vessels

| Method | Path                        | Description                                                              | Permission |
| ------ | --------------------------- | ------------------------------------------------------------------------ | ---------- |
| GET    | `/api/v1/vessels`           | Paginated vessels (search `code`/`name`/`flag`/`imo`; filters `isActive`, `vesselType`, `flag`; sort `code` asc) | `vessel:read` |
| GET    | `/api/v1/vessels/:id`       | Vessel detail (adds `notes`)                                          | `vessel:read` |
| POST   | `/api/v1/vessels`           | Create vessel (unique `code`; optional 7-digit `imo`; 409 on duplicate code/IMO) | `vessel:create` |
| PATCH  | `/api/v1/vessels/:id`       | Update vessel master fields (name/imo/flag/vesselType/capacityTeu/notes; `code` immutable) | `vessel:update` |
| PATCH  | `/api/v1/vessels/:id/active` | Activate/deactivate (409 if unfinished voyages; completed history preserved) | `vessel:activate` |
| DELETE | `/api/v1/vessels/:id`       | Soft-delete (409 if referenced by any voyage — deactivate instead)     | `vessel:update` |

Notes (Vessels):

- `capacityTeu` is declared master-data stowage capacity (informational only; no slot allocation/utilization
  in Phase 6 — that is Load Planning, Phase 7).
- `imo` is validated as exactly 7 digits when supplied; an empty string is stored as `NULL`.

### Voyages

| Method | Path                          | Description                                                                                    | Permission |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| GET    | `/api/v1/voyages`             | Paginated voyages (search `voyageNumber`/vessel/ports; filters `status`, `vesselId`, `originPortId`, `destinationPortId`, `departureFrom`, `departureTo`; sort `voyageNumber\|status\|plannedDepartureAt\|plannedArrivalAt\|createdAt`, order `asc\|desc`) | `voyage:read` |
| POST   | `/api/v1/voyages`             | Create voyage in `DRAFT` (auto `VOY-YYMM-seq5`; requires active vessel + 2 active ports; 409 for inactive master) | `voyage:create` |
| GET    | `/api/v1/voyages/:id`         | Voyage detail (vessel + origin/destination port refs, cancel reason, notes, createdBy)          | `voyage:read` |
| PATCH  | `/api/v1/voyages/:id`         | Edit a `DRAFT` voyage route/notes; a `SCHEDULED` voyage is frozen except `notes` (409 otherwise) | `voyage:update` |
| POST   | `/api/v1/voyages/:id/schedule`| `DRAFT→SCHEDULED` (200; requires ordered `plannedDepartureAt`/`plannedArrivalAt` in UTC; 409 on overlap with an unfinished voyage of the same vessel) | `voyage:schedule` |
| POST   | `/api/v1/voyages/:id/start`   | `SCHEDULED→IN_PROGRESS` (200)                                                                  | `voyage:start` |
| POST   | `/api/v1/voyages/:id/complete`| `IN_PROGRESS→COMPLETED` (200)                                                                  | `voyage:complete` |
| POST   | `/api/v1/voyages/:id/cancel`  | `DRAFT\|SCHEDULED→CANCELLED` (200; `cancelReason` required, 400 without)                        | `voyage:cancel` |

Notes (Voyages):

- State machine (ADR-026): `DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED`, plus `CANCELLED` from
  `DRAFT`/`SCHEDULED`. Illegal transitions → 409. `COMPLETED`/`CANCELLED` are terminal.
- No cargo assignment in Phase 6 — cargo↔voyage linking, load lists and manifest are later phases.
- Overlap rule (ADR-027): `schedule` returns 409 if the window overlaps an unfinished same-vessel voyage;
  historical (COMPLETED/CANCELLED) voyages never block new schedules.

Boolean filters (`isActive`) accept the literal strings `true`/`false` and are validated (`@IsIn`); an
invalid value such as `?isActive=maybe` returns 400 (see ADR-017).

Docs: Swagger UI is mounted at `/docs`.

## CORS (frontend connectivity)

- CORS origins are environment-driven via `API_CORS_ORIGINS` (comma-separated list in `.env` / `.env.example`).
- Development allow-list includes both forms of the web origin: `http://localhost:3000` and
  `http://127.0.0.1:3000`, so the browser can call the API whether the site is opened via `localhost`
  or `127.0.0.1`. Only explicit origins are allowed (`credentials: true`); `origin: "*"` is not used.
- The frontend calls the API using `NEXT_PUBLIC_API_URL` (set in `apps/web/.env.local`, must include the
  `/api/v1` prefix, prefer `127.0.0.1` over `localhost`). It is a browser-side variable and is inlined
  into the bundle at build time — change it, then rebuild/restart the frontend.
- A terminal `curl` succeeding is not sufficient proof of browser connectivity: the browser also enforces
  the CORS preflight. Verify with OPTIONS requests carrying the appropriate `Origin` header (see
  Phase 1.5 in progress.md).

## Data validation

- Request bodies are validated with class-validator DTOs.
- `whitelist: true` strips unknown properties; `forbidNonWhitelisted: true` rejects them.
- Query parameters are implicitly converted (numbers, booleans) and validated.
- Invalid DTO → 400 with an array of messages.

## Auth (Phase 2 — implemented)

Authentication uses a short-lived JWT access token plus an opaque, rotation-semantics refresh token
(see [decisions.md](decisions.md) ADR-014). All endpoints except those marked `@Public()` require an
`Authorization: Bearer <accessToken>` header.

### Auth endpoints

| Method | Path                     | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | `/api/v1/auth/login`     | Email + password → `{ accessToken, refreshToken, user, permissions }` |
| POST   | `/api/v1/auth/refresh`   | Rotate a refresh token → new access + refresh (reuse detection revokes family) |
| POST   | `/api/v1/auth/logout`    | Revoke the presented refresh token                 |
| GET    | `/api/v1/auth/me`        | `{ user, permissions }` for the current principal  |

### Guarded endpoints (RBAC)

| Method | Path                                  | Permission            |
| ------ | ------------------------------------- | --------------------- |
| GET    | `/api/v1/users`                       | `user:read`           |
| POST   | `/api/v1/users`                       | `user:create`         |
| PATCH  | `/api/v1/users/:id/roles`             | `user:roles`          |
| PATCH  | `/api/v1/users/:id/active`            | `user:activate`       |
| POST   | `/api/v1/users/:id/reset-password`    | `user:update`         |
| PATCH  | `/api/v1/users/me/password`           | authenticated (self)  |
| GET    | `/api/v1/roles`                       | `role:read`           |
| GET    | `/api/v1/roles/active`                | `role:read`           |
| POST   | `/api/v1/roles`                       | `role:create`         |
| PATCH  | `/api/v1/roles/:id`                   | `role:update`         |
| PATCH  | `/api/v1/roles/:id/active`            | `role:activate`       |
| PATCH  | `/api/v1/roles/:id/permissions`       | `role:permissions`    |
| GET    | `/api/v1/permissions`                 | `permission:read`     |
| GET    | `/api/v1/permissions/all`             | `permission:read`     |
| GET    | `/api/v1/permissions/modules`         | `permission:read`     |
| PUT    | `/api/v1/users/me/password`           | authenticated (self)  |

Reference-data modules are guarded (`port:*`, `yard:*`, `customer:*`, `currency:read`); `GET /health` and
`GET /api/v1` are `@Public()`. Legacy `DELETE /ports/:id` etc. are soft-deletes routed through the
`:update` permission.

### Error statuses

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| 400    | Invalid credentials / malformed input        |
| 401    | Missing/invalid/expired token (no principal) |
| 403    | Valid token, insufficient permission         |
| 404    | User/role/refresh not found                  |
| 409    | Duplicate login / resource conflict          |

## Rate limiting & observability

- Rate limiting, request-id headers, and structured access logs are planned (Phase 3 hardening).
