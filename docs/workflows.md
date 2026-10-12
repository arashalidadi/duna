# Planned Business Workflows

> Documentation of the intended business workflows. These describe how modules will connect;
> they are design intent, not yet-implemented features — validation happens per phase.

> ## ⚠️ Read this before using the document (added 2026-10-11)
>
> Several sections below are **stale**: they describe work that has since been implemented, and two enum
> values no longer match `prisma/schema.prisma`. Corrections have been applied **in place** at each
> affected section and are dated, so the original intent remains readable.
>
> | Section | Was | Now |
> | --- | --- | --- |
> | §1 Cargo lifecycle | `READY`; transitions "not yet present" | `READY_FOR_LOADING`; transitions implemented |
> | §1c Inspection | `PENDING → APPROVED \| REJECTED` | `PENDING → BOOKED → DONE \| FAILED`, plus `NEEDS_REINSPECTION` |
> | §2 Load planning / Load List / Actual Loading / Manifest | all `[PHASE 7]` (unbuilt) | all **implemented** |
>
> **Current vs target.** "IMPLEMENTED" here means the code exists. It does **not** mean the feature is
> complete against the target design in `docs/duna-analysis/09-audit/`. Notably: B/L lifecycle *labels*
> are placeholders pending an owner answer (OQ-05); document output/templates do not exist (P8); and the
> financial workflows in §4–§5 remain **target design only** — there is no general ledger, no allocation
> and no rate history.
>
> For the authoritative current-state assessment see `09-audit/implementation-gap-analysis.md`; for the
> target design see `09-audit/target-domain-and-finance.md`.

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
| `AT_YARD`   | `READY_FOR_LOADING` | **requires an inspection in state `DONE`** (driven by Inspections; otherwise 409) |
| `READY_FOR_LOADING` | `LOADED` | Actual Loading — **now implemented** (`actual-loading` module) |
| `LOADED`    | `DELIVERED` | Delivery / Discharge — **now implemented** (`discharge` module) |

> **Verified 2026-10-11 (audit correction — AUD-020).** Two values in this section no longer matched
> `prisma/schema.prisma`:
>
> 1. **`CargoStatus`** — this document used `READY`. The enum in the schema is
>    `REGISTERED · AT_YARD · READY_FOR_LOADING · LOADED · DELIVERED · CANCELLED` (6 values). `READY`
>    does not exist.
> 2. **`InspectionStatus`** — this document used `PENDING|APPROVED|REJECTED`. The enum in the schema is
>    `PENDING · BOOKED · DONE · FAILED · NEEDS_REINSPECTION` (5 values). `APPROVED` and `REJECTED`
>    **do not exist**; the equivalent of "approved" is **`DONE`**, and of "rejected" is **`FAILED`**.
>
> Both transitions marked "endpoint not yet present" are now implemented. Corrections applied in place;
> the original phrasing is retained in the notes below where it still explains intent.

`inspectionStatus` (**`PENDING|BOOKED|DONE|FAILED|NEEDS_REINSPECTION`** — *corrected*; this document
previously said `PENDING|APPROVED|REJECTED`) is the single authoritative **current** readiness state
and is driven by the Inspections module; `loadingStatus` (`NOT_LOADED|LOADED`) is readiness
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

> **Corrected 2026-10-11.** This document previously showed `PENDING → APPROVED | REJECTED`. The enum in
> `prisma/schema.prisma` is `PENDING · BOOKED · DONE · FAILED · NEEDS_REINSPECTION`. The state machine
> below is the corrected one; the legacy names are mapped so historical references still resolve.

```
PENDING → BOOKED → DONE | FAILED        (DONE and FAILED are terminal for that inspection row)
              └──→ NEEDS_REINSPECTION   (a rejected/review case → a NEW Inspection row is created)
```

**Legacy-name mapping:** "APPROVED" in earlier notes = **`DONE`** · "REJECTED" in earlier notes =
**`FAILED`** or **`NEEDS_REINSPECTION`** depending on whether a re-inspection is required.

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
`Cargo.inspectionStatus === 'DONE'` (`CargoLoadReadiness`).

> **Corrected 2026-10-11.** This line previously read `=== 'APPROVED'`. Verified in code: the gate is
> `=== 'DONE'` — see `actual-loading.service.ts:401,515,711`, `cargo.service.ts:292` and
> `inspection.service.ts:414`. A stale comment at `cargo.service.ts:12` still says `APPROVED`; it is a
> source-code comment and is **out of scope** for this documentation-only change, but it should be
> corrected during implementation.

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
  → Load Planning: assign planned cargo/containers to voyage slots  [IMPLEMENTED — module `load-planning`]
  → Load List: published planned document (template-based)         [IMPLEMENTED — module `load-planning`; template output still P8]
  → Actual Loading: executed record; discrepancies flagged         [IMPLEMENTED — module `actual-loading`]
  → Manifest: finalized summary of shipped cargo                   [IMPLEMENTED — module `manifest`]
```

- A voyage has capacity constraints (slots / tons) — Load Planning (Phase 7) will consume
  `Vessel.capacityTeu` (declared master data) and the voyage/vessel references created in Phase 6.
- Manifest is finalized once and then immutable; finalization writes an audit event.

> **Status corrected 2026-10-11.** All four steps above were marked `[PHASE 7]` (i.e. not built). They are
> now implemented. **Verified behaviour:** a cargo only enters a load list when its inspection is `DONE`
> (`load-planning.service.ts:381,556`); a B/L is created from a `COMPLETED` Actual Loading with
> `actualQuantity > 0` (`bill.service.ts:304,589-601,918-920`); a manifest consolidates `APPROVED` B/Ls
> (`manifest.service.ts:293-347`). **What is still open:** the *status labels* used for the B/L lifecycle
> are placeholders, not official company names (open question **OQ-05**), and no document output/template
> rendering exists yet (roadmap **P8**).

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

> **Correction 2026-10-12 (additive).** The Agent Portal is implemented: module `apps/api/src/modules/portal`, route `/portal`, permission `portal:access`, and the end-to-end suite `portal.e2e-spec.ts` (see `progress.md`, Phase 20). The text below is the original design and is kept as recorded; the current permission model is in `permissions.md`.

- Agents submit bookings / track status with a restricted role; read-mostly with scoped write
  permissions (e.g. `agent:booking:create`).
