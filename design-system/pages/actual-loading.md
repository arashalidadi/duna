# Actual Loading — Page Override

Read `../MASTER.md` first. This file pins the Actual Loading (Phase 8) conventions to the
implemented UI (`apps/web/src/app/(dashboard)/actual-loading/page.tsx`). Nothing here overrides
global rules; it codifies the server-enforced lifecycle, the planned/actual quantity semantics
and the live-data rule.

## Data truth rule

- The Actual Loading register, its items and the available sources (load lists, their items)
  come exclusively from the typed API client (`lib/api/client.ts`) against `/actual-loading*`.
  No placeholder records, quantities, or references may be hard-coded.
- Load-list lookup for the create flow is live data (`/load-lists?status=FINALIZED`);
  it degrades gracefully when the actor lacks the read permission.
- Until loaded → `PageLoader`; on failure → `ErrorState` (offers retry); empty list →
  `EmptyState` (offers "New actual loading" when permission allows).

## Page layout (implemented)

```
space-y-4
├── Header               Breadcrumbs → title "Actual Loading" + 1-line description (left)
│                        "New actual loading" Button (actual_loading:create)      (right)
├── Register             Card
│   ├── Filters bar      search Input (no./load list no./voyage no.) + native <select>s:
│   │                    status · voyage · created-from/to date inputs
│   └── <table>          No. · Load List · Voyage · Vessel · Status · Items · Created · Actions
│                        + Pagination footer when totalPages > 1
└── Detail dialog        Drawer/Dialog with the item grid (planned / actual / remaining / result)
```

## Lifecycle & status semantics (Phase 8 state machine)

- Status Badge uses the Master mapping: `NOT_STARTED`=`neutral`, `IN_PROGRESS`=`info`,
  `COMPLETED`=`success`, `CANCELLED`=`neutral` — with `dot`. The label is the source of truth;
  colour never sole signal.
- Transitions are server-enforced: `NOT_STARTED → IN_PROGRESS → COMPLETED`; `CANCELLED` from
  `NOT_STARTED/IN_PROGRESS` with a mandatory `cancelReason`. The UI only renders the legal next
  step per row:
  - NOT_STARTED → **Start loading** (`actual_loading:update`) via `ConfirmDialog`.
  - NOT_STARTED/IN_PROGRESS → **Update quantities** (inline item editor; requires
    `actual_loading:update`).
  - IN_PROGRESS → **Complete** (`actual_loading:complete`) via `ConfirmDialog`.
  - NOT_STARTED/IN_PROGRESS → **Cancel** (`actual_loading:cancel`) via `Dialog` with mandatory
    `cancelReason` (empty → inline `role="alert"` error; API rejects with 400).
- Actions are permission-gated per the Master rules. An illegal action is never rendered; if the
  API still rejects (409/400), the error surfaces inline as `role="alert"`.

## Quantity semantics (planned vs actual)

- `plannedQuantity` comes from the Load List item; `actualQuantity` is what was physically loaded.
- Result badge per item: `FULL`=`success`, `PARTIAL`=`warning`, `NOT_LOADED`=`neutral` — always
  labelled, never colour alone.
- Remaining = `planned − actual` (>=0); shown as `tabular-nums` right-aligned.
- Actual quantity input rejects negative values and values above planned on the client inline,
  and the API re-validates (400) server-side.