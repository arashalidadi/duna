# Duna — Shipping Operations & Accounting ERP

Production-grade operations and accounting ERP for a UAE-based international shipping company:
customers, cargo, yard inventory, inspections, ports, yards, vessels, voyages, load planning,
load lists, actual loading, manifests, bills of lading, jobs, job costing, invoices, payments,
release orders, delivery orders, discharge, agent portal, reports, voyage P&L, document
templates, configuration, archive/retention, audit logs and RBAC.

**Twelve commands run the whole repository.** Everything else is a sub-command of one of them.

```
pnpm setup        install on a server: dependencies, PostgreSQL, schema, grants, seed, builds
pnpm start        bring the dashboard up (API on :3101, web on :3000)
pnpm status       read-only service/build status
pnpm test         every fast test
pnpm check        every static contract check
```

## Getting started

```bash
pnpm setup        # one command: deps + database + schema + seed + builds
pnpm start        # API on http://127.0.0.1:3101, dashboard on http://127.0.0.1:3000
pnpm status       # confirm both are managed and verified
```

Then open `http://127.0.0.1:3000` and sign in with the development accounts
`admin@shipping.local` / `ChangeMe123!` (staff) or `agent@portal.local` / `ChangeMe123!`
(portal agent). Those credentials exist only in the development seed; change them before any
non-development deployment.

`pnpm setup` is the whole server install. It provisions PostgreSQL 16, applies the committed
migrations, creates the runtime database role and its grants, seeds reference data, and builds
the API and the web app. Add `--with-demo` to also write the opt-in demonstration records —
**development databases only**, because once written they are indistinguishable from real data.

## The twelve commands

| Command | What it does |
| --- | --- |
| `pnpm setup` | Install everything: dependencies, database, schema, grants, seed, builds. Flags: `--status`, `--health`, `--integration`, `--sandbox` |
| `pnpm build` | Build the Prisma client, shared packages, API and web app |
| `pnpm start` | Start API and the production web build, detached and PID-tracked |
| `pnpm dev` | Start API and the Next development server |
| `pnpm stop` | Stop API and web. Never touches PostgreSQL |
| `pnpm status` | Read-only PID, listener and build-attestation status |
| `pnpm test` | Every fast test: unit contracts, provisioning contracts, workflow contracts, web guards, API service/finance/document contracts |
| `pnpm test:e2e` | The API Jest end-to-end suite (extra Jest arguments are passed through) |
| `pnpm check` | Every static contract check: API build attestation, seed safety, authorization inventory, audit routes, process/database identity, web contracts |
| `pnpm db` | Database operations — see below |
| `pnpm lint` | Lint every workspace |
| `pnpm typecheck` | Typecheck every workspace |

### Sub-commands

Operations that did not earn a top-level name live under three of them, so the surface stays
small without losing anything:

```bash
pnpm db generate | migrate | deploy | status | reset | resolve | diff | studio
pnpm db seed | seed:demo | seed:reference | preflight | reconcile | migration:test

pnpm setup --status | --health | --integration | --sandbox

node scripts/duna.mjs phase11 roles | seed | server | server:unit | audit:unit | authorized
node scripts/duna.mjs phase12 apply | test
node scripts/duna.mjs e2e-baseline [record]
node scripts/duna.mjs preflight | restart | start-api | help
```

`scripts/duna.mjs` is the single dispatcher behind every command. It routes to the modules that
already existed; nothing is re-implemented there, and `node scripts/duna.mjs help` lists all of it.

## Layout

```
apps/
  api/            NestJS backend. REST under /api/v1, Swagger at /docs
    scripts/      Deployment and operational entries (seeding, privileges, workflows)
    test/         Jest end-to-end and unit specs
  web/            Next.js App Router frontend
    scripts/      Contract guards (API surface, i18n, navigation, page size) and UI tests
packages/
  config/         Validated application configuration
  shared/         Shared types, constants and route contracts
prisma/
  schema.prisma   94 models, 44 enums
  migrations/     3 committed migrations (the squashed baseline)
  seed/           Reference-data seeders
scripts/          Operational tooling: the dispatcher, checks, provisioning, Phase 11/12 workflows
  arena/          Sandbox bring-up (engine mirror, PostgreSQL, environment)
  fresh/          Isolated fresh-install installer and its contracts
  phase12/        Archive/retention deployment workflow and its contracts
docker/           Fresh-install image
docs/             Documentation — start at docs/README.md
```

Source code (`apps/`, `packages/`, `prisma/`) is separated from operational scaffolding
(`scripts/`, `docker/`). Nothing under `scripts/` is imported by the applications at runtime.

## Runtime topology

| Component | Address |
| --- | --- |
| Web (Next.js) | `http://127.0.0.1:3000` |
| API (NestJS) | `http://127.0.0.1:3101`, Swagger at `/docs` |
| PostgreSQL | `127.0.0.1:5432` |

The browser only ever calls its own origin. `apps/web/src/app/api/v1/[...path]/route.ts` proxies
`/api/v1` to the server-only `API_INTERNAL_URL`, so a hosted browser never needs to reach the
API host directly. Keep `NEXT_PUBLIC_API_URL=/api/v1` in `apps/web/.env.local` and make
`API_INTERNAL_URL` agree with `API_PORT`. CORS is an environment-driven allow-list
(`API_CORS_ORIGINS`); never `*` alongside authentication.

Root `.env` is loaded by Nest; Next reads `apps/web/.env.local`. Never commit either — only
`.env.example`. Rebuild the frontend after changing any `NEXT_PUBLIC_*` variable.

## Verifying a change

```bash
pnpm test        # fast suite
pnpm check       # static contracts
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e    # full API end-to-end suite
```

`pnpm test` and `pnpm check` are safe against a running system: `check`'s process/database
identity step discovers the running API's PID and says so when nothing is running, rather than
turning that into a failure.

## Documentation

Start at [`docs/README.md`](docs/README.md). The set is 25 documents: architecture, business
requirements, database schema, permissions, API, workflows, design system, decisions, progress,
the fresh-install runbook, the operations runbook, the phase specifications, the plan, the
implementation log, the audit record, and the source material the specification was derived from.

## Prerequisites

- Node.js >= 20 (developed on 22)
- pnpm >= 9
- PostgreSQL 16 — `pnpm setup` provisions it; only bring your own if you already run one
