# CLAUDE.md — Project Instructions for Coding Agents

> Persistent instructions for AI coding agents working on this repository.
> (Kept because future agents — including non-Claude ones — rely on this file.)

## Project

Shipping Operations & Accounting ERP for a UAE-based international shipping company.
Phases 1–1.75 (bootstrap/connectivity/UI), Phase 2 (Auth+RBAC), the Phase 3 master-data increment
(Customers/Ports/Yards), Phase 4 (Cargo + Yard Inventory), Phase 5 (Inspections) and Phase 6
(Vessels & Voyages / House Schedules) are complete. Phase 7 (Load Planning) is next. See
`docs/progress.md`. ADRs 001-027.

## Enforced Go-Fast Rules

- **Do not implement future phases.** Phase targets are in `docs/progress.md`. Do not add business
  modules (Load Planning, Load Lists, Actual Loading, Manifest, B/L, Invoicing, Jobs,
  Payments, Release, Delivery, Discharge, Agent Portal) until their phase begins; Cargo + Yard Inventory
  (Phase 4), Inspections (Phase 5) and Vessels/Voyages (Phase 6) are already implemented.
- **Never commit `.env` or real secrets.** Only `.env.example` may be committed.
- **No fake/static business data.** Dashboards and UI must show live data only.

## Architecture (summary)

Monorepo (pnpm workspaces):

- `apps/api` — NestJS backend, REST under `/api/v1`.
- `apps/web` — Next.js 14 (App Router) frontend.
- `packages/config` — validated env configuration (`@shipping/config`).
- `packages/shared` — shared types/constants (`@shipping/shared`, CommonJS build).
- `prisma/` — schema, migrations, seed.
- `docs/` + `CLAUDE.md` — documentation and instructions.

See `docs/architecture.md`, `docs/decisions.md` (ADRs 001–025).

## Conventions

- TypeScript strict mode everywhere. Avoid `any` (justify if used).
- Backend: one NestJS module per bounded context; business rules in services, not controllers.
- Frontend: no business logic in UI components; use the typed API client (`apps/web/src/lib/api/client.ts`);
  reuse the design-system components in `apps/web/src/components/ui`.
- API: consistent success/error envelope, `/api/v1`, DTO validation (whitelist + forbidNonWhitelisted +
  implicit conversion), pagination via `{ data, meta: { page, pageSize, totalItems, totalPages } }`.
- Connectivity: browser bundle reads `NEXT_PUBLIC_API_URL` (`apps/web/.env.local`, inlined at build time,
  include the `/api/v1` prefix, prefer `127.0.0.1` over `localhost`); API CORS allow-list is env-driven via
  `API_CORS_ORIGINS` (dev: `http://localhost:3000,http://127.0.0.1:3000`; never `origin: "*"` when
  credentials/auth is used). After changing `NEXT_PUBLIC_*`, rebuild/restart the frontend.
- DB: cuid() ids, `createdAt`/`updatedAt`, UTC timestamps, soft delete via `deletedAt` where retention matters,
  explicit status fields, `Decimal(18,2)` for money, ISO 4217 currency codes.
- Seed must stay idempotent.

## Commands

```bash
pnpm install                # install (onlyBuiltDependencies allow-list is committed)
pnpm dev                    # web (3000) + api (3001) concurrently
pnpm build                  # build all workspaces
pnpm lint                   # lint all workspaces
pnpm test                   # tests (config unit + api e2e)
pnpm db:migrate             # prisma migrate dev
pnpm db:seed                # seed reference data
pnpm docker:db              # start dev PostgreSQL (docker compose)
```

Run database commands from the repo root. Test env loads the repo-root `.env`.
If `pnpm install` reports ignored builds, run `pnpm approve-builds` and commit the updated
`onlyBuiltDependencies` list.

## Verification before finishing a task

1. `pnpm typecheck` equivalent per package (tsc --noEmit).
2. `pnpm lint` clean.
3. `pnpm test` passing (config + api e2e).
4. `pnpm build` succeeds (both apps).
5. Migrations/seed applied against a running PostgreSQL before relying on DB features.
6. Update `docs/progress.md` and, when warranted, add/append ADRs to `docs/decisions.md`.
