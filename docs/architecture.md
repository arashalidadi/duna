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

Modules are split by bounded context, matching future deliverable phases:

| Module                                                       | Status  |
| ------------------------------------------------------------ | ------- |
| Foundation (users, roles, ports, yards, customers, settings) | Phase 1 |
| Cargo / Yard Inventory (operational records + current yard placement) | Phase 4 |
| Inspection (drives `inspectionStatus`; history ledger + approve/reject) | Phase 5 |
| Vessel / Voyage (registry + operational sailing; state machine + overlap guard) | Phase 6 |
| Load Planning / Load Lists / Actual Loading                            | Planned |
| Manifest / Bill of Lading                                    | Planned |
| Job / Job Costing / Invoices / Payments                      | Planned |
| Release / Delivery / Discharge                               | Planned |
| Reports / Voyage P&L / Documents / Audit / Agent Portal      | Planned |

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
