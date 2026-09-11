# Dashboard — Page Override

Read `../MASTER.md` first. This file **overrides/violates nothing globally** — it pins dashboard-
specific conventions and the data-truth rule. Updated in Phase 1.75 to match the **implemented**
UI.

## Data truth rule (highest priority)

This page is the Phase 1 "Foundation dashboard" and MUST show live data only:

- API/app/database status come exclusively from `GET /api/v1/health` via `lib/api/client.ts`.
- "Implemented / Planned modules" counts are **derived** from `lib/navigation/nav.ts` (the module
  registry), never hard-coded.
- No fake operational business metrics (cargo counts, revenue, vessel positions) may appear.
- Until loaded → `PageLoader`; on failure → `ErrorState` with a classified title:
  `API unreachable` (network/CORS), `API error` (HTTP 4xx/5xx), `Database unavailable` (HTTP 503).

## Page layout (implemented)

```
space-y-6
├── PageHeader        Breadcrumbs → title "Dashboard" + 1-line description  (left)
│                     live health Badge (success/danger/neutral) + "updated HH:MM:SS"
│                     + Refresh button                                      (right)
├── Metric tiles      grid gap-4 sm:grid-cols-2 xl:grid-cols-4, each Card with
│                     top colour accent bar (h-0.5 bg-primary when "ok" tone, else bg-border),
│                     icon tile (9x9 rounded-md bg-primary/10 text-primary | bg-muted),
│                     micro-label, text-lg tabular value, optional status Badge
│                      · Application  → health.status (Operational/Issue Badge)
│                      · Database     → "PostgreSQL" (Connected/Down Badge)
│                      · Environment  → health.app.environment (text, no badge)
│                      · Uptime       → formatUptime(uptimeSeconds) (no badge)
├── Module Registry    Card; header title + description + implemented/planned Badges
│                     semantic <table>: thead micro-label uppercase, columns
│                     Module · Section · Status(Badge dot) · Description(lg+)
│                     row = each item in nav registry; hover:bg-muted/30; overflow-x-auto
└── Status + Scope     grid gap-4 lg:grid-cols-3
    ├── System Status  (lg:col-span-2) — 3 Stat tiles (API vX, Environment, Database w/ dot)
    └── Scope          — ROw list: API style · Timezone · Currencies · Modules count
```

## Component notes

- Header right group: live `Badge` must be `success`/`danger`/`neutral` with `dot`; the source of
  truth is the text label, never colour alone.
- Refresh re-fetches health; while loading the band shows `PageLoader`.
- Metric tile "value" for env is `capitalize`; numbers/uptime use `tabular-nums`.
- No decorative gradients/charts. All cards `shadow-sm rounded-lg border`.
