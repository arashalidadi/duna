# Inspections — Page Override

Read `../MASTER.md` first. This file pins the Inspection screen conventions to the **implemented**
Phase 5 UI (`apps/web/src/app/(dashboard)/inspections/page.tsx`). Nothing here overrides global rules;
it codifies the status/decision semantics and the live-data rule.

## Data truth rule

- The register and detail dialogs come exclusively from the typed API client (`lib/api/client.ts`)
  against `/inspections*`. No placeholder inspection data, findings, or readiness badges may be
  hard-coded.
- Readiness ("Eligible for load planning" / "Ineligible — rejected" / "Pending review") is derived from
  the live `Cargo.inspectionStatus`, never from static text.
- Until loaded → `PageLoader`; on failure → `ErrorState`.

## Page layout (implemented)

```
space-y-4
├── Header               Breadcrumbs → title "Inspections" + 1-line description (left)
│                        "New inspection" Button (inspection:create)            (right)
├── Inspection register  Card
│   ├── Filters bar      search Input (min-w, flex-1) + native <select>s:
│   │                    status · customer · yard
│   └── <table>          Inspection No. · Cargo No. · Customer · Destination (port code)
│                        · Yard · Inspector · Inspection date · Status · Actions
│                        + Pagination footer when totalPages > 1
```

## Status & decision semantics

- Status Badge uses `success`/`warning`/`neutral` with `dot`, labelled **Approved / Rejected /
  Pending** — colour is never the sole signal; the label is the source of truth. Raw palettes are not
  used in components. Approve/reject icons are plain `ghost` buttons; intent is confirmed in the dialog
  wording, not colour.
- Actions are permission-gated: view (`inspection:read`), approve (`inspection:approve`),
  reject (`inspection:reject`) — shown only on a `PENDING` row.
- **Approve** is a `ConfirmDialog` (confirm split per MASTER); **Reject** is a `Dialog` requiring a
  mandatory `rejectionReason` textarea (empty → inline `role="alert"` error; the API also rejects with 400).

## Create dialog

- Cargo is a native `<select>` of live cargos (label `REFERENCE — CUSTOMER NAME`).
- On selection, a read-only cargo panel shows cargo type, customer, destination port, yard, serial/VIN,
  and current inspection Badge — sourced from the live cargo row.
- Optional free-text fields: inspection date, inspector, findings, physical condition, verification
  notes, remarks. Only non-empty values are sent.

## Detail dialog

- Cargo panel (reference, type, customer, destination, serial/VIN, cargo status, yard/location + inventory
  status, readiness derived from `inspectionStatus`).
- Findings block (findings / condition / verification / remarks, `whitespace-pre-wrap`).
- Rejection box (destructive-tinted border, reason shown) only when `REJECTED`.
- Inspection history list, newest first; the current row is marked "Current".
- Footer: Approve / Reject (PENDING-only, permission-gated) + Close.

## Repetition / notes

- No global toast; errors are inline `role="alert"` paragraphs.
- Inspectors default to the acting user, never fabricated.