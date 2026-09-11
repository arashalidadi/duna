# Voyages — Page Override

Read `../MASTER.md` first. This file pins the Voyage schedule conventions to the **implemented**
Phase 6 UI (`apps/web/src/app/(dashboard)/voyages/page.tsx`). Nothing here overrides global rules; it
codifies the server-enforced lifecycle semantics, the overlap rule and the live-data rule.

## Data truth rule

- The voyage schedule and detail dialogs come exclusively from the typed API client (`lib/api/client.ts`)
  against `/voyages*`. No placeholder voyages, vessels, ports, or dates may be hard-coded.
- Vessel/port selects for the create form are live data (`/vessels`, `/ports`) and degrade gracefully
  (reload/refresh) when the actor lacks those read permissions — never stale mock lists.
- Until loaded → `PageLoader`; on failure → `ErrorState` (offers retry).

## Page layout (implemented)

```
space-y-4
├── Header               Breadcrumbs → title "Voyages" + 1-line description (left)
│                        "New voyage" Button (voyage:create)                   (right)
├── Voyage schedule      Card
│   ├── Filters bar      search Input (no./vessel/ports) + native <select>s:
│   │                    status · vessel
│   └── <table>          Voyage No. · Vessel (name + code) · Route (origin → dest)
│                        · Departure · Arrival (ETA) · Status · Actions
│                        + Pagination footer when totalPages > 1
```

## Lifecycle & status semantics (ADR-026 / ADR-027)

- Status Badge uses `success`/`warning`/`neutral` with `dot`, labelled **Draft / Scheduled /
  In progress / Completed / Cancelled** — colour is never the sole signal; the label is the source of
  truth. The state machine `DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED` (+ `CANCELLED` from DRAFT /
  SCHEDULED) is server-enforced; the UI only offers the legal next step per row:
  - DRAFT → **Schedule** (`voyage:schedule`) opens a `Dialog` requiring planned **departure** +
    **arrival (ETA)** (`datetime-local`) — required to leave DRAFT.
  - SCHEDULED → **Start** (`voyage:start`) via `ConfirmDialog`.
  - IN_PROGRESS → **Complete** (`voyage:complete`) via `ConfirmDialog`.
  - DRAFT/SCHEDULED → **Cancel** (`voyage:cancel`) via `Dialog` requiring a mandatory `cancelReason`
    (empty → inline `role="alert"` error; the API also rejects with 400).
- Actions are permission-gated (view `voyage:read`; each transition has its own permission). An illegal
  action is never rendered; if the API still rejects (e.g. an overlap 409, concurrent update), the error
  surfaces as an inline `role="alert"` message.
- **Overlap rule (ADR-027):** scheduling that overlaps an unfinished voyage on the same vessel fails with
  409; the schedule dialog wording and error text signal this rather than allowing a phantom booking.