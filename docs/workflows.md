# Planned Business Workflows

> Documentation of the intended business workflows. These describe how modules will connect;
> they are design intent, not yet-implemented features — validation happens per phase.

## 1. Cargo lifecycle

**Implemented state machine (Phase 4, ADR-019)** — server-enforced via a `TRANSITIONS` table:

```
REGISTERED → AT_YARD → READY → LOADED → DELIVERED
     └───────────────┬───────────────────────┘ → CANCELLED (terminal)
                     └ (REGISTERED ↔ any failure path)
```

Allowed transitions (enforced in the service):

| From        | To          | Guard / trigger                                    |
| ----------- | ----------- | -------------------------------------------------- |
| `REGISTERED`| `AT_YARD`   | Yard-Inventory *place* (transactional)             |
| `REGISTERED`| `CANCELLED` | cancel                                             |
| `AT_YARD`   | `REGISTERED`| Yard-Inventory *remove* (reverts)                  |
| `AT_YARD`   | `READY`     | **requires `inspectionStatus = APPROVED`** (driven by Inspections, Phase 5; otherwise 409) |
| `READY`     | `LOADED`    | Actual Loading (Phase 8) — endpoint not yet present |
| `LOADED`    | `DELIVERED` | Delivery / Discharge (Phase 16) — not yet present  |

`inspectionStatus` (`PENDING|APPROVED|REJECTED`) is the single authoritative **current** readiness state
and is driven by the Inspections module (Phase 5); `loadingStatus` (`NOT_LOADED|LOADED`) is readiness
scaffolding not yet driven by business workflows. Rules:

- Cargo belongs to a Customer; `reference` auto-generated `CRG-<YYMM>-<seq5>` (configurable numbering is
  the longer-term goal, ADR-008).
- Cancelled cargo is terminal: it cannot be edited or placed in a yard.
- `READY → LOADED → DELIVERED` are forward-compatible states driven by later-phase endpoints.

## 1b. Yard Inventory (Phase 4, ADR-020)

A cargo has **one current** `YardInventory` record (`cargoId` unique):

- **Place** — create `IN_YARD` (portId mirrored from the yard's port); cargo `REGISTERED → AT_YARD`.
  A second place → 409; cancelled cargo / inactive yard / inactive port / missing cargo rejected.
- **Move/Update** — change yard (portId re-mirrored), status `IN_YARD ↔ RESERVED`, location label, notes.
- **Remove** — delete record; cargo `AT_YARD → REGISTERED`.

Full placement history is deferred to a later phase.

## 1c. Inspection (Phase 5, ADR-024)

**Implemented state machine** for a single inspection:

```
PENDING → APPROVED | REJECTED   (both terminal for that inspection row)
```

Each `Inspection` row is a **traceable inspection attempt**. `Cargo.inspectionStatus` is the single
authoritative **current** readiness state; both are updated in one transaction (ADR-024).

- **Create** — a new inspection for a cargo (auto reference `INS-<YYMM>-<seq5>`); sets
  `Cargo.inspectionStatus` → `PENDING`. Cargo must exist, not be soft-deleted or `CANCELLED` (409).
  Duplicate simultaneous **pending** inspections for a cargo are blocked (service check + partial unique
  index) → 409.
- **Update** — edit fields while `PENDING` (`inspection:update`); once finalized → 409.
- **Approve** (`inspection:approve`) — `PENDING → APPROVED`; cargo → `APPROVED`, now **eligible for Load
  Planning** (Phase 7). 200.
- **Reject** (`inspection:reject`) — `PENDING → REJECTED` **with a required `rejectionReason`**
  (400 without); cargo → `REJECTED`, ineligible for Load Planning. 200.
- **Reinspection** — a cargo that was rejected (or needs review) gets a **new** `Inspection` record;
  history is preserved, never overwritten.
- A `PENDING` cargo that reached `READY` requires `inspectionStatus = APPROVED` (rejected → 409, enforced
  in the Cargo service).

Readiness contract for future phases: `InspectionService.isCargoInspectionApproved(cargoId)` reads
`Cargo.inspectionStatus === 'APPROVED'` (`CargoLoadReadiness`).

## 1d. Vessel & Voyage (Phase 6, ADR-026 / ADR-027)

```
Create Vessel (active master: unique code, IMO, flag, type, capacity)
  → Create Voyage (DRAFT; active vessel + 2 active ports; no cargo yet)
  → Schedule (DRAFT→SCHEDULED; sets planned departure + arrival ETA; rejects overlap)
  → Start (SCHEDULED→IN_PROGRESS)
  → Complete (IN_PROGRESS→COMPLETED)
  → Cancel (DRAFT|SCHEDULED→CANCELLED, reason required) — terminal
```

- **Voyage state machine (ADR-026):** `DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED`, plus `CANCELLED`
  from `DRAFT`/`SCHEDULED`. Transitions are dedicated operations (schedule/start/complete/cancel), each
  gated by its own permission; illegal transitions → 409. `COMPLETED`/`CANCELLED` are terminal.
- **Overlap rule (ADR-027):** a single vessel cannot run two overlapping **unfinished** (`DRAFT`/
  `SCHEDULED`/`IN_PROGRESS`) voyages; `schedule` returns 409 on overlap. Historical (`COMPLETED`/
  `CANCELLED`) voyages never block new schedules.
- **Vessel lifecycle:** a vessel with unfinished voyages cannot be deactivated (409); completed history
  does not block deactivation and remains readable. A vessel referenced by any voyage is never hard-deleted.
- No cargo assignment / capacity allocation in Phase 6 — that is Load Planning (Phase 7). `capacityTeu`
  is declared master data only.

## 2. Voyage & load planning

```
Vessel schedules a Voyage (implemented Phase 6, see 1d)
  → Ports of call & dates (implemented Phase 6)
  → Load Planning: assign planned cargo/containers to voyage slots  [PHASE 7]
  → Load List: published planned document (template-based)         [PHASE 7]
  → Actual Loading: executed record; discrepancies flagged         [PHASE 7]
  → Manifest: finalized summary of shipped cargo (locked after finalization) [PHASE 7]
```

- A voyage has capacity constraints (slots / tons) — Load Planning (Phase 7) will consume
  `Vessel.capacityTeu` (declared master data) and the voyage/vessel references created in Phase 6.
- Manifest is finalized once and then immutable; finalization writes an audit event.

## 3. Bill of Lading

- B/L issued per consignment from the manifest/shipped cargo set.
- Configurable numbering and template.
- Once finalized, B/L is immutable; amendments record a new version + audit event.

## 4. Jobs, costing & P&L

```
Job created (cost centre, linked to voyage/cargo/customer as applicable)
  → expense lines (bunkers, port costs, stevedoring, agency, overheads)
  → revenue lines (freight, demurrage, ancillary)
  → P&L = revenue − expenses, computed from posted lines
```

- Invoicing references revenue lines and generates Invoice documents.
- Payments allocate against invoices; allocations update the customer ledger.

## 5. Invoicing, payments & ledger

```
Raise Invoice (configurable numbering, VAT/tax fields, multi-currency)
  → Invoice finalized → document generated → ledger posting
  → Payment received → allocate to invoice(s)
  → Customer ledger shows open balances; ageing reports later
  → Reversal / credit note paths for corrections (audited)
```

## 6. Release / Delivery / Discharge

```
Release Order approved (guarded by RBAC + audit)
  → Delivery Order issued (template-based)
  → Cargo discharged and delivered; status updates propagate to inventory
```

## 7. Audit events (planned)

Immutable audit records for events such as: cargo status changed, invoice created/edited,
payment created/reversed, release approved/cancelled, B/L finalized, manifest finalized,
user role changed. Record: user, action, entity, entityId, timestamp, previousState, newState
(see decisions.md).

## 8. Agent portal (future)

- Agents submit bookings / track status with a restricted role; read-mostly with scoped write
  permissions (e.g. `agent:booking:create`).
