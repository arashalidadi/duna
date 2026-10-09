# Shipping Operations & Accounting ERP

Production-grade Shipping Operations & Accounting ERP for a UAE-based international shipping company.

> **Current status: PHASE 6 — Vessels & Voyages**

This monorepo is the foundation for a full operations & accounting ERP covering Customers, Cargo, Yard
Inventory, Inspections, Ports, Yards, Vessels, Voyages, Load Planning, Load Lists, Actual Loading, Manifest,
Bill of Lading, Jobs, Job Costing, Invoices, Payments, Release Orders, Delivery Orders, Discharge, Agent
Portal, Reports, Voyage Profit & Loss, Document Templates, Audit Logs, RBAC, and accounting workflows.

Implemented so far: Phase 1 foundation, Phase 2 authentication & RBAC, Phase 3 master data
(Customers / Ports / Yards), **Phase 4 Cargo & Yard Inventory**, **Phase 5 Inspections**, and
**Phase 6 Vessels & Voyages**. Business
modules beyond these are intentionally not implemented yet — see [docs/progress.md](docs/progress.md).

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn-style component system
- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Validation**: class-validator (API), Zod-ready (frontend)
- **Config**: centralized environment validation (`@shipping/config`)
- **Tests**: Jest (unit + API e2e)
- **Code quality**: ESLint, Prettier, strict TypeScript

## Repository layout

```
apps/
  api/                NestJS backend (REST API, /api/v1)
  web/                Next.js frontend (application shell)
packages/
  config/             Shared, validated application configuration
  shared/             Shared types & constants
prisma/
  schema.prisma       Database schema (foundation entities)
  migrations/         Prisma migrations
  seed.ts             Database seed
docker/               Development Docker compose (PostgreSQL)
docs/                 Architecture & project documentation
```

## Prerequisites

- Node.js >= 20 (tested on 20/26)
- pnpm >= 9
- PostgreSQL 16 (local, or via Docker)

## Quick start

### Option A — Start/Stop (detached, survives shell closure)

```bash
# Start all services (PostgreSQL + API + Web), detached from terminal:
./scripts/start-dev.sh

# Check status:
./scripts/status-dev.sh

# Stop everything:
./scripts/stop-dev.sh
```

Services run with `setsid`+`nohup` and reparent to systemd (PPID=1). Closing
OpenCode or your terminal does NOT stop them.

- Web: http://127.0.0.1:3000
- API: http://127.0.0.1:3010/api/v1
- PostgreSQL: 127.0.0.1:5432

### Option B — Foreground (for development)

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env          # supply your DB URL and unique JWT secrets
cp apps/web/.env.example apps/web/.env.local  # same-origin browser API, server upstream

# 3. Start PostgreSQL (standalone or Docker)
# Standalone (only if binaries and a cluster have actually been provisioned):
./infra/standalone-db/manage.sh start
# OR Docker (if available):
pnpm docker:db

# 4. Generate Prisma, then apply migrations and seed ONLY an approved development DB
pnpm db:generate
pnpm db:migrate               # prisma migrate dev
pnpm db:seed                  # seed reference data + admin user

# 5. Run the API (port 3010 by default)
pnpm dev:api                # http://localhost:3010/api/v1  (Swagger at /docs)
# To use another port, set API_PORT in .env AND the matching API_INTERNAL_URL in apps/web/.env.local

# 6. Run the web app (port 3000)
pnpm dev:web                # http://localhost:3000
```

`pnpm dev` runs both (foreground, requires open terminal).

### Frontend ↔ API connectivity

- Keep `NEXT_PUBLIC_API_URL=/api/v1` in `apps/web/.env.local`. A hosted browser must never
  call localhost to reach the sandbox API; requests go through the existing same-origin Next proxy.
- Set server-only `API_INTERNAL_URL=http://127.0.0.1:3010` to match backend `API_PORT=3010`.
  Explicit alternatives such as 3001/3101 still work when **both** values agree. For separate
  containers, use the API service's internal hostname instead of loopback.
- The API's CORS allow-list remains environment-driven via `API_CORS_ORIGINS`; do not disable auth
  or allow every origin to work around a missing service.
- Restart the affected service after changing environment; rebuild the frontend after changing
  `NEXT_PUBLIC_*` variables. Root `.env` is loaded by Nest, while Next reads `apps/web/.env.local`.
- A 502 means the proxy cannot reach its upstream; changing a port cannot supply a missing API,
  PostgreSQL, generated Prisma client or required secrets. See
  [backend connection audit](docs/ops/backend-connection-audit.md).
- The legacy detached scripts require a provisioned standalone database. In Arena, use managed
  preview processes bound to `0.0.0.0` rather than those detached scripts.

For the production environment matrix, recovery instructions and exact non-force push/PR steps,
see [publication handoff](docs/ops/publication-handoff.md). Arena preview authentication is not a
publication prerequisite; real API/database acceptance will be tested on the configured server.

## Database

Foundation entities: `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `CompanySettings`,
`Currency`, `Port`, `Yard`, `Customer`.

Operational (Phase 4): `Cargo` and `YardInventory` (one current placement per cargo).

Operational (Phase 5): `Inspection` — the traceable history of inspection attempts; current readiness is
`Cargo.inspectionStatus` (`PENDING|APPROVED|REJECTED`), set transactionally by the Inspections module.

Naval (Phase 6): `Vessel` (master-data registry: unique code, IMO, flag, type, declared TEU capacity,
activate lifecycle) and `Voyage` (operational sailing: auto `VOY-…`, vessel + origin/destination ports,
planned dates, and a server-enforced `DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED` / `CANCELLED` state
machine with a single-vessel no-overlap scheduling rule).

Detailed domain entities (Invoice, Manifest, B/L, Load Planning, etc.) are designed but will be added
in later phases. Conventions (cuid ids, UTC timestamps, soft delete, audit fields) are documented in
[docs/database-schema.md](docs/database-schema.md).

## API

Versioned under `/api/v1` with a consistent response envelope, validation, and error format.
See [docs/api.md](docs/api.md) and the Swagger UI at `http://localhost:3010/docs`.

## Documentation

- [docs/architecture.md](docs/architecture.md) — architecture, decisions, module boundaries
- [docs/database-schema.md](docs/database-schema.md) — schema & conventions
- [docs/api.md](docs/api.md) — API conventions & endpoints
- [docs/workflows.md](docs/workflows.md) — planned business workflows
- [docs/permissions.md](docs/permissions.md) — RBAC model
- [docs/decisions.md](docs/decisions.md) — ADRs
- [docs/progress.md](docs/progress.md) — status & roadmap
- [CLAUDE.md](CLAUDE.md) — agent instruction file

## Scripts

| Script            | Description                    |
| ----------------- | ------------------------------ |
| `./scripts/start-dev.sh` | Start all services detached (survives shell closure) |
| `./scripts/stop-dev.sh`  | Stop all services gracefully |
| `./scripts/status-dev.sh` | Check service status |
| `pnpm dev`        | Run web + api in dev mode      |
| `pnpm build`      | Build all workspaces           |
| `pnpm start`      | Start built apps               |
| `pnpm lint`       | Lint all workspaces            |
| `pnpm format`     | Prettier format                |
| `pnpm test`       | Run all tests                  |
| `pnpm test:watch` | Run tests in watch mode        |
| `pnpm db:migrate` | Create/apply Prisma migration  |
| `pnpm db:seed`    | Seed reference data            |
| `pnpm db:studio`  | Open Prisma Studio             |
| `pnpm docker:db`  | Start dev PostgreSQL container |
