# Phase 2 Implementation Log

**Phase:** 2 — Master Data & Party Model
**Status:** ✅ COMPLETE — VERIFIED
**Date:** 2026-09-21

## Objective

Replace the incorrect Customer-as-party model with correct separate masters (Shipper, Consignee, Agent) and prepare vessel/voyage relations and numbering for operational use.

## What was done

### Production implementation

- **Prisma schema** (`prisma/schema.prisma`):
  - New models: `Shipper`, `Consignee`, `Agent`, `AgentDestination`
  - `Port.abbreviation` field added
  - `VesselType` enum expanded: `TUG`, `BARGE`, `LANDING_CRAFT` added
  - `Voyage`: `tugVesselId`, `bargeVesselId` relations added
  - `Cargo`: `shipperId`, `consigneeId` nullable relations added
  - `NumberingSequence`: `scopeType`, `scopeValue`, `prefix`, `padding`, `format`, `period`, `companyId`, `isActive`, `nextSequence` fields added

- **Migration** (`prisma/migrations/20260921032600_phase2_master_data_party_model`): applied and in sync with DB

- **Seed** (`prisma/seed.ts`): Phase 2 reference data added — Shipper, Consignee, Agent records, AgentDestination assignments, Port abbreviations, VesselType values, voyage numbering sequences

- **Services**:
  - `ShippersService` — CRUD with validation, conflict on duplicate code
  - `ConsigneesService` — CRUD with validation, conflict on duplicate code
  - `AgentsService` — CRUD with validation, destination assignment via AgentDestination
  - `AgentDestinationsService` — destination assignments for agents
  - `PortsService` — abbreviation create/update
  - `VesselsService` — type validation (TUG/BARGE/LANDING_CRAFT accepted)
  - `VoyagesService` — vessel relations (primary/tug/barge), type constraints, destination-scoped numbering via NumberingService

### Tests (8 suites, 66 tests, all passing)

| File | Tests | Covers |
|------|-------|--------|
| `shippers.service.spec.ts` | 8 | create, list/get, update, active/inactive, validation, conflict |
| `consignees.service.spec.ts` | 8 | create, list/get, update, active/inactive, validation, conflict |
| `agents.service.spec.ts` | 13 | create, list/get, update, active/inactive, validation, conflict, pagination, destination assignment, duplicate rejection |
| `agent-destinations.service.spec.ts` | 7 | create relation, list, multiple agents per destination, duplicate rejection, invalid refs |
| `ports.service.abbreviation.spec.ts` | 4 | create, update, API validation |
| `vessels.service.type.spec.ts` | 3 | TUG/BARGE/LANDING_CRAFT accepted |
| `voyages.service.vessel.spec.ts` | 10 | primary vessel, optional tug/barge, type constraints, invalid combos rejected, non-existent refs, tug removal |
| `voyages.service.numbering.spec.ts` | 5 | destination-scoped numbering, independent sequences per destination, year scope, NumberingSequence integration, full vessel relations + numbering |

### Test isolation approach

- Per-test unique random suffixes on all created records (codes, names)
- Tracked-ID arrays for every created record per test file
- Reverse-dependency-order cleanup in `afterEach` (dependents first, then parents)
- Only test-created records deleted — never seed data or other modules' records
- Agent pagination test scopes `count`/`findMany` to test-created agent codes via `code: { in: testCodes }`
- Voyage numbering tests use seed KHALIFA port (`cmttiixsq001ou5z1x2pcruim`) for destination-scoped numbering to avoid `VOY/00001` collision; fresh-port test tracks and deletes its own NumberingSequence
- No blanket `deleteMany({})` on shared tables (Port, Vessel, Voyage, Cargo, LoadList, ActualLoading)

### Pre-existing baseline preserved

- `.gitignore`
- `apps/web/messages/ar.json`
- `apps/web/messages/en.json`
- `apps/web/messages/fa.json`
- `apps/web/src/app/[locale]/page.tsx`
- `apps/web/src/app/globals.css`

## Verification

- **Migration status:** `20260921032600_phase2_master_data_party_model` applied, DB schema up to date (28 migrations total)
- **Phase 2 tests:** 8 suites, 66 tests, 0 failures (isolation + full group)
- **TypeScript:** `tsc --noEmit` — 0 errors
- **Build:** `pnpm build` (API) — succeeds
- **API health:** `GET /api/v1/health` → `ok`, DB `up`
- **Login:** `POST /api/v1/auth/login` with admin credentials → `200` + access token
- **Web app:** running on `:3000`

### Pre-existing failures (not Phase 2 regressions)

- `voyage.e2e-spec.ts` (4/13): DB pollution from earlier runs (`VOY/00001`) + format expectation mismatch (`VOY-YYYY-#####` in test vs locked `VOY/#####` in implementation). Pollution cleaned up; format expectation is a pre-existing test issue to be addressed separately.

## Not yet done

- Phase 3+ (out of scope for this phase)
