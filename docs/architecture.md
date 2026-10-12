# Architecture

## 1. Chosen Stack

| Layer      | Choice                    | Rationale                                                    |
| ---------- | ------------------------- | ------------------------------------------------------------ |
| Monorepo   | pnpm workspaces           | Single source of truth, shared packages, atomic commits      |
| Frontend   | Next.js 14 (App Router)   | Mature React framework, SSR/ISR ready, strong conventions    |
| UI         | React 18 + TypeScript     | Industry standard, strict typing                             |
| Styling    | Tailwind CSS + CSS vars   | Design system tokens, fast iteration, no runtime cost        |
| Backend    | NestJS 10                 | Modular DI architecture, guards/interceptors/pipes, testable |
| Database   | PostgreSQL 16             | Relational integrity, advanced queries, JSONB where needed   |
| ORM        | Prisma 5                  | Type-safe schema, migrations, excellent DX                   |
| Validation | class-validator / DTOs    | Decorator-based, native NestJS integration                   |
| Config     | @shipping/config (custom) | Single validated source of truth for web + api               |
| Testing    | Jest + ts-jest            | Unit tests + supertest e2e                                   |
| Auth (Ph2) | JWT (refresh) — planned   | Stateless API auth; implemented in Phase 2                   |

## 2. Repository structure

```
apps/
  api/        NestJS API — REST, versioned /api/v1
  web/        Next.js frontend — application shell + dashboard
packages/
  config/     Validated configuration loader (env-based)
  shared/     Shared types, constants, currency/format helpers
prisma/       Schema, migrations, seed
docker/       Development infrastructure (PostgreSQL)
docs/         Documentation
```

### apps/api (NestJS)

```
src/
  main.ts                     Bootstrap (helmet, CORS, pipes, swagger)
  app.module.ts               Root module
  config/                     Config wiring (validated via @shipping/config)
  prisma/                     PrismaService (global provider)
  common/
    auth/
      guards/                   JwtAuthGuard (global, secure-by-default) + PermissionsGuard
      decorators/               @Public(), @RequirePermissions(...), @CurrentUser()
      types.ts                  Request principal + required-permission metadata
    filters/                  Global exception filter → consistent error envelope
    interceptors/             Global transform interceptor → consistent success envelope
    utils/pagination.util.ts  Shared pagination parsing
  modules/
    health/                   Health endpoint (app + db status) — @Public()
    auth/                     Login/refresh/logout/me, token rotation + reuse detection (global)
    users/  roles/  permissions/   Access-control modules (RBAC)
    ports/  yards/  customers/  currencies/   Reference-data modules
    cargo/          Cargo operational records + lifecycle state machine
    yard-inventory/ Current yard placement per cargo (place / move / remove)
    inspections/    Inspection ledger + approve/reject (drives cargo readiness)
    vessels/        Vessel master data / registry + activate lifecycle (unfinished-voyage guard)
    voyages/        Voyage operational record + state machine (schedule/start/complete/cancel; overlap guard)
```

Each feature module follows `controller → service → prisma` with DTOs in `dto/`. Business rules live
in services, never controllers or UI.

### apps/web (Next.js)

```
src/
  app/
    login/page.tsx            Public sign-in page
    (dashboard)/              Route group hosting the application shell
      layout.tsx              Auth-gated AppShell (sidebar, topbar, mobile nav); redirects to /login
      dashboard/page.tsx      Foundation dashboard (real health data, no fake metrics)
      users/page.tsx          User administration (create, roles, activate, reset password)
      roles/page.tsx          Role administration (create, active, permissions binding)
      permissions/page.tsx    Permission catalogue (read-only registry)
  components/
    layout/                   Sidebar (permission-filtered), Topbar, AppShell
    ui/                       Design-system components (button, badge, card, dialog, input, ...)
  lib/
    api/client.ts             Typed API client (envelope + bearer injection, refresh hooks)
    auth/AuthProvider.tsx     Auth context (login/logout, hasPermission, silent refresh)
    navigation/nav.ts         Sidebar module registry (permission-aware, implemented/planned)
  app/(dashboard)/
    cargo/page.tsx            Cargo list + create/edit/detail + status/cancel/delete
    yard-inventory/page.tsx   Yard inventory list + place/move/remove + detail
    inspections/page.tsx      Inspections list + create/detail + approve/reject
    vessels/page.tsx          Vessel registry list + create/edit/detail + activate
    voyages/page.tsx          Voyage schedule/list + create + detail + lifecycle actions
```

Business logic is deliberately excluded from UI components. The UI consumes the API through a typed
client using shared types from `@shipping/shared`.

### packages

- `@shipping/config`: reads `process.env`, validates, and exposes a typed `Config`. Fails fast with a
  clear `ConfigError` when required variables are missing. Used by the API; the web app reads a small
  subset via its own `.env` (Next convention).
- `@shipping/shared`: framework-agnostic types (`ApiResponse`, `HealthStatus`, currencies, formatters).
  Builds to CommonJS so both NestJS (CJS) and Next.js (bundler) can consume it.

## 3. Module boundaries

> **Verified 2026-10-11 (audit correction).** The table below previously marked Load Planning, Manifest,
> Bill of Lading, Jobs, Invoices, Release/Delivery/Discharge and Agent Portal as "Planned". All of those
> now exist as modules under `apps/api/src/modules/`. The table has been corrected to distinguish
> **current implementation** from **target design**.
>
> - **IMPLEMENTED (unverified)** means the code exists and the paths were read, but the test suite could
>   not be executed in this environment — see `docs/duna-analysis/09-audit/README.md` §4.
> - **NOT IMPLEMENTED** means no module directory exists under `apps/api/src/modules/`.
>
> Verified counts: **32 API modules**, **52 Prisma models**, **32 enums**, **35 web pages**,
> **161 seeded permission codes** across **34 modules** (the `audit` module was added 2026-10-12
> for DEC-044…048 / DEC-116 audit review).

> **Update 2026-10-12 (Phase 1, additive).** The suites were executed in a sandbox on 2026-10-12: 22/22 suites and 403/403 tests on a fresh database with the required seed (sandbox WASM engine, not the native engine). "IMPLEMENTED (unverified)" remains accurate for the native-engine server run, which is still pending. See [`duna-analysis/09-audit/e2e-sandbox-run-2026-10-12.md`](duna-analysis/09-audit/e2e-sandbox-run-2026-10-12.md).

| Bounded context | Modules on disk | Current status |
| --- | --- | --- |
| Foundation | `auth`, `users`, `roles`, `permissions`, `health` | IMPLEMENTED (unverified) |
| Reference data | `ports`, `yards`, `currencies`, `customers`, `agents`, `shippers`, `consignees` | IMPLEMENTED (unverified) |
| Cargo / Yard Inventory | `cargo`, `yard-inventory` | IMPLEMENTED (unverified) |
| Inspection | `inspections` | IMPLEMENTED (unverified) |
| Vessel / Voyage | `vessels`, `voyages` | IMPLEMENTED (unverified) |
| Load Planning / Load Lists / Actual Loading | `load-planning`, `actual-loading` | IMPLEMENTED (unverified) |
| Manifest / Bill of Lading | `manifest`, `bill` | IMPLEMENTED (unverified) |
| Jobs / Invoicing / Payments | `jobs`, `invoice`, `voucher`, `proforma`, `quotation`, `salary` | IMPLEMENTED (unverified) |
| Release / Delivery / Discharge | `delivery-release`, `discharge` | IMPLEMENTED (unverified) |
| Agent portal | `portal` | IMPLEMENTED (unverified) |
| Letters | `letters` | IMPLEMENTED (unverified) |
| Derived customer ledger | `ledger` | **PARTIAL** — a read-only derived statement (`ledger.controller.ts`). It is **not** a general ledger: there is no posting model, no `LedgerEntry` and no accounting entries. A real GL is required — see `09-audit/target-domain-and-finance.md` and DEC-078…081 |
| Reports / Voyage P&L | — | **NOT IMPLEMENTED** (roadmap P7) |
| Documents / templates / output | — | **NOT IMPLEMENTED** (roadmap P8) |
| Notifications | — | **NOT IMPLEMENTED** (roadmap P10) |
| Company settings endpoint | — | **NOT IMPLEMENTED** — the `CompanySettings` model exists but has no API surface, so TRN/company identity are not maintainable (roadmap P4) |
| Audit browsing | — | **NOT IMPLEMENTED** — the `AuditLog` model exists; there is no audit module or viewer (roadmap P11) |
| Configurability (custom fields, workflows) | — | **NOT IMPLEMENTED** (roadmap P9) |

**Current vs target.** Everything marked IMPLEMENTED above is the *current* system. The *target* system
additionally requires the financial spine (dated exchange rates, accounting entries, allocation,
controlled correction), document output, reporting and configuration — none of which exist yet. Those are
specified in `docs/duna-analysis/09-audit/` and sequenced in `09-audit/initial-roadmap.md` (P0–P12).
Do not read "IMPLEMENTED" as "complete against the target design".

Rules of thumb:

- One NestJS module per bounded context.
- Domain invariants live in application services, not in controllers or Prisma calls scattered across UI.
- Document/numbering/template concerns are behind services so layouts can change without touching
  business logic (see [decisions.md](decisions.md) for template & numbering decisions).

## 4. Database architecture

See [database-schema.md](database-schema.md) for the full model. Foundation conventions:

- `cuid()` string ids (URL-safe, unordered-safe, distributed-friendly) via Prisma `@default(cuid())`.
- `createdAt` / `updatedAt` on every entity.
- Optional `deletedAt` for soft deletion where business data must be retained (customers, ports, yards,
  cargo). Yard-inventory records are hard-deleted on `remove` (transient physical-stock link).
- Active inventory blocks cargo hard-delete (409) to preserve referential integrity.
- All timestamps UTC; application timezone (`Asia/Dubai`) applied only at presentation.
- Explicit status fields for domain lifecycles.
- UUID-primary-key alternative was considered; cuid chosen for id ordering in DB indexes (see decisions).
- Multiple currencies supported from day one; currency code stored as ISO 4217 string, never hard-coded.

## 5. Authentication strategy (Phase 2 — implemented)

- Access + refresh tokens. JWT access token ~15m (stateless, carries only `sub`). Refresh token opaque
  (48-byte random), server-stored as SHA-256 `lookupKey` (unique indexed, O(1) lookup) + bcrypt hash.
- Refresh tokens are single-use with rotation and reuse-detection (family revocation), and are revoked
  on logout / password change / user deactivation. See ADR-014.
- Passwords hashed via bcrypt (cost 12).
- Global `JwtAuthGuard` (secure-by-default; every handler requires a valid JWT unless `@Public()`).
- Web client stores tokens in `localStorage` and injects `Authorization: Bearer` via the typed API client,
  with a silent refresh on 401 via `/auth/refresh`.

## 6. Authorization strategy (Phase 2 — implemented)

- RBAC: `Permission` (module+action) → `Role` via `RolePermission`, `User` → `Role` via `UserRole`.
- `PermissionsGuard` reads `@RequirePermissions('module:action', ...)` from handlers (AND default,
  `match: 'OR'` supported).
- Effective permissions resolved from the DB per request (`resolvePermissions`) — no caching, so role
  changes apply immediately (ADR-014 tradeoff).
- Permission codes follow `module:action` (e.g. `user:create`); `Permission` is a read-only seeded
  registry (ADR-016). `ADMIN` is a system role (soft-delete = active/inactive, ADR-015).

## 7. API strategy

- Versioned prefix `/api/v{n}`.
- Consistent envelope:
  - Success: `{ success: true, data, meta: { timestamp } }`
  - Error: `{ success: false, error: { statusCode, message, error, path, timestamp, details? }, meta }`
- Validation via DTOs (whitelist + forbidNonWhitelisted + transform with implicit conversion).
- Pagination: `?page=1&pageSize=25` (max 100). Response includes `{ data, meta: { page, pageSize, totalItems, totalPages } }`.
- Filtering via query params (`search`, and entity-specific filters like `type` and `portId`). Sorting conventions:
  default per-resource; explicit `?sort=field` / `?order=asc|desc` planned.
- Errors use standard HTTP status codes; internal details are never leaked in production.
- Swagger UI mounted at `/docs`.
- CORS origin allow-list is environment-driven (`API_CORS_ORIGINS`); the browser bundle reaches the API
  through `NEXT_PUBLIC_API_URL` (a `NEXT_PUBLIC_*` variable because it is needed by client components).
  Both values are centralized in `.env` / `apps/web/.env.local`.

## 8. Testing strategy

- **Unit tests**: pure services & utilities. Foundation covered by `@shipping/config` tests
  (config validation behavior).
- **API e2e tests**: supertest against a bootstrapped Nest application using the real PostgreSQL dev
  database. Tests assert envelope shape, health, and reference endpoints.
- **Test database**: currently the dev database is reused (read-only assertions). A dedicated test DB
  (`shipping_erp_test`) is planned — see Known Issues in progress.md.
- Future phases add Playwright for critical user journeys.

## 9. Deployment strategy

- Container images: web (standalone Next), api (Nest build), plus managed PostgreSQL.
- CI: run typecheck → lint → test → build per workspace; migrations applied via `prisma migrate deploy`.
- Secret management: env only; secrets never committed (`.env` is gitignored, examples provide placeholders).
- Reversible, monotonic migrations; seeds are idempotent.

## 10. Scalability considerations

- Stateless API → horizontal scaling behind LB.
- Prisma connection pooling for the API; PostgreSQL scales vertically first, read replicas later.
- Compute-heavy report/P&L queries isolated in dedicated report services (future).
- Document generation in background queues where volume requires (future).
- Monorepo packages keep web/api independent so each can deploy on its own cadence.
