# Vessels — Page Override

Read `../MASTER.md` first. This file pins the Vessel register conventions to the **implemented**
Phase 6 UI (`apps/web/src/app/(dashboard)/vessels/page.tsx`). Nothing here overrides global rules; it
codifies the master-data lifecycle semantics and the live-data rule.

## Data truth rule

- The register and detail dialogs come exclusively from the typed API client (`lib/api/client.ts`)
  against `/vessels*`. No placeholder vessels, IMO numbers, or capacity figures may be hard-coded.
- Until loaded → `PageLoader`; on failure → `ErrorState` (offers retry).

## Page layout (implemented)

```
space-y-4
├── Header               Breadcrumbs → title "Vessels" + 1-line description (left)
│                        "New vessel" Button (vessel:create)                   (right)
├── Vessel register      Card
│   ├── Filters bar      search Input (code/name/flag/IMO) + native <select>s:
│   │                    vessel type · status (Active/Inactive)
│   └── <table>          Vessel (name + code) · IMO · Flag · Type · Capacity (TEU)
│                        · Status · Actions
│                        + Pagination footer when totalPages > 1
```

## Lifecycle semantics

- Status Badge uses `success`/`neutral`, labelled **Active / Inactive** — colour is never the sole
  signal; the label is the source of truth. The activate toggle is a plain `ghost` `Power` icon-button;
  intent is confirmed in a `ConfirmDialog` (`destructive` only when deactivating).
- **Deactivating a vessel fails (inline `role="alert"` error, API 409) when it still has unfinished
  voyages**; completed historical voyages do not block deactivation and remain readable. Wording of the
  deactivate confirm dialog states this.
- Actions are permission-gated: view (`vessel:read`), edit (`vessel:update`), activate/deactivate
  (`vessel:activate`).
- Create/edit dialog: `code` is immutable once assigned (voyage references display it); `imo` is a
  7-digit IMO number (digits only, max 7, stored `NULL` when cleared); `capacityTeu` is declared master
  data only (no allocation/utilization in Phase 6).