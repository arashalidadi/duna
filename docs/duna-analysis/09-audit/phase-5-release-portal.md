# Phase 5 — Documents: release/delivery, B/L lifecycle, agent portal

**Status:** scoping only (2026-10-13). No Phase 5 code has been written. Implementation waits for the owner's answers in §4.

Source: `initial-roadmap.md` Phase 5 (~L161–179). Requirements: DEC-059…063, DEC-073…077, AUD-010, AUD-019, AUD-022, REQ-105, REQ-181/182/183, REQ-186, REQ-187/188.

---

## 1. What exists today (verified in the repository at `3b7e4f3`)

| Area | Current state | Evidence |
|---|---|---|
| Release Order | Has `status`, `financialOverride`, `overrideReason`, cancel fields. **No payment-state field.** | `prisma/schema.prisma` `model ReleaseOrder` |
| Delivery Order | Has `recipient`, optional `recipientId` (customer link), `vehiclePlate`. **No port field.** | `model DeliveryOrder` |
| Release approval | **No general approval framework.** Only the invoice-correction approval flag (Phase 3, DEC-022). The roadmap says the P9 framework is needed for release exceptions. | `grep` for approval models: none |
| Portal (agent scope) | Agent scoping through `portalAgentId` exists. Endpoints today: `GET /portal/me`, `/portal/bookings`, `/portal/shipments`, `/portal/ports`, `/portal/statement`, `/bookings/:id`. **No B/L, Manifest or Release Order endpoint for agents.** | `apps/api/src/modules/portal/*.controller.ts` |
| Portal web | Only the dashboard layout and login page exist under `apps/web/src/app/[locale]/`. No portal page for B/L or release status. | directory listing |
| Release/B/L labels | B/L lifecycle labels are not in the code as configurable values. Official labels are unconfirmed (DEC-060, roadmap known blocker). | roadmap §Known blockers |

## 2. Requirement evidence

- **Payment state (REQ-182, EMP-685–689).** The employer asked for a Payment section on the release with three values: **Paid** (invoice paid in full), **Partial Payment**, and **Unpaid** (released on credit). The source says the condition is recorded *at release*. It does not say the system must compute it from invoice payments. Automatic derivation needs the payment allocation in Phase 6.
- **Delivery Order port (REQ-186, EMP-669–672).** The employer wants the DO to state the port. The Ports master exists (`Port`, with the canonical record and aliases decided earlier).
- **Approval (DEC-063, R-09).** A configurable approval must fail closed and must not bypass the financial-override audit. Approver identity is configuration (roadmap). The Phase 3 rule (requester ≠ approver, primary administrator exempt under DEC-116) is the only approval precedent in the code.
- **Labels (DEC-059/060/061).** Labels must be configurable. Official labels must not be invented.

## 3. Proposed scope if the defaults in §4 are accepted

1. `ReleaseOrder.paymentState` (enum `PAID | PARTIAL | UNPAID`), recorded by the user at release, required, with audit. No automatic derivation.
2. `DeliveryOrder.portId` (nullable FK to `Port`) plus a snapshot of the port name, so later port renames do not rewrite issued documents. Existing rows stay null. Migration additive only.
3. Release exceptions (`financialOverride`): keep the current audited path. Do **not** build a new approval framework. Fail closed where a required approval would be missing.
4. B/L lifecycle labels: a configurable table keyed by the existing `BlStatus` values (`DRAFT`, `FINAL`, `APPROVED`, `RELEASED`, `ISSUED`, `CANCELLED`), with the display label defaulting to the code until the owner supplies the official wording. An earlier draft of this document listed `CORRECTION` and `APPROVAL` as codes; those are not `BlStatus` values and are withdrawn.
5. Agent portal: read-only endpoints `GET /portal/bills-of-lading`, `GET /portal/manifests`, `GET /portal/release-orders`. Each is scoped to the caller's `portalAgentId`. Each returns an explicit empty state, never a silent blank. A portal page shows B/L and release status.
6. Customer-linked portal path: explicit empty state with a reason, not a silent blank.
7. Tests: cross-destination isolation (mandatory, agent D vs agent E), release-state transitions, approval/override audit, unauthenticated and denied access.

**Migrations:** additive only (new enum, nullable column, new config table). No destructive change. The owner runs `migrate deploy` on the test database first.

## 4. Decisions needed from the owner before implementation

1. **Payment state** (REQ-182): record a user-selected value at release (recommended), or derive it from invoices now (not possible before Phase 6)?
2. **Release approval:** defer the configurable approval step to Phase 9, keeping the current audited override path with fail-closed behaviour (recommended), or build a minimal configurable approval now (approver = role or permission chosen by the owner)?
3. **Delivery Order port:** choose from the existing Ports master (recommended), or free text?
4. **B/L labels:** use neutral internal codes until the owner supplies the official wording (recommended), or supply the wording now?

**Owner answers (2026-10-13):** all four recommended defaults accepted: (1) payment state recorded by the user at release; (2) configurable approval deferred to Phase 9, with the current audited override path and fail-closed behaviour; (3) DO port selected from the Ports master, with a name snapshot; (4) neutral internal B/L label codes until the owner supplies official wording.

## 5. Risks

- **R-09:** a configurable approval must not become a bypass. Fail closed.
- **Cross-destination leakage** in the agent portal is the principal security risk. The isolation tests must run against a real database on the test environment.
- **R-15:** do not copy legacy release defects.
- Sandbox limit: no PostgreSQL and no Prisma engine. Isolation tests can be written here but cannot run here. The owner runs them on the test database.

## 5a. Agent scope (verified in schema)

- An agent's destinations are `AgentDestination` rows (`agentId`, `portId`, `isActive`, `deletedAt`).
- A B/L carries `destinationPortId` (the denormalised destination).
- Proposed rule: an agent sees B/Ls whose `destinationPortId` is in the agent's active destinations, and whose status is not `DRAFT`. Excluding `DRAFT` fails closed. The owner should confirm this rule.
- A release order is visible when its B/L is visible.
- Manifests keep the existing `portalAgentId` scoping.

## 5b. Proposed slices (each committed, checked and stopped for approval)

1. **Data model:** `ReleasePaymentState` enum; `ReleaseOrder.paymentState` (nullable for existing rows); `DeliveryOrder.portId` (nullable FK to `Port`) and `portName` snapshot; `BlLifecycleLabel` table seeded add-only. One additive migration.
2. **Release and delivery services:** payment state required for new releases; port selected for new delivery orders; existing rows unchanged. The web forms and en/ar/fa strings are updated in the same slice so the UI never sends an invalid payload.
3. **Agent portal read API:** `GET /portal/bills-of-lading`, `GET /portal/release-orders`, `GET /portal/manifests` (agent scope), plus `GET /portal/bl-labels`. Explicit empty state and reason for customer-only accounts.
4. **Portal web page:** B/L and release status for the agent.
5. **Isolation tests:** `portal-agent-isolation.e2e-spec.ts` (agents D and E, no leakage, unauthenticated and denied access, release-state transitions). Not runnable in this sandbox; the owner runs it on the test database.

## 5c. Slice 1 — data model and migration (implemented 2026-10-13)

**Changed:**
- `prisma/schema.prisma`: enum `ReleasePaymentState` (`PAID`, `PARTIAL`, `UNPAID`); `ReleaseOrder.paymentState` (nullable); `DeliveryOrder.portId` (nullable, FK to `Port`, `SetNull` on delete) and `DeliveryOrder.portName` (snapshot, nullable); index on `delivery_orders.portId`; `Port.deliveryOrders` back-relation; model `BlLifecycleLabel` (`bl_lifecycle_labels`, PK `code` = `BlStatus`, `label`, `sortOrder`).
- `prisma/migrations/20261013150000_phase5_release_payment_port_labels/migration.sql`: additive and guarded. No existing column, row or status is changed.
- `prisma/seed/core.ts`: label rows for `DRAFT, FINAL, APPROVED, RELEASED, ISSUED, CANCELLED`, written add-only (`update: {}`) with label = code.
- `scripts/check-seed-safety.mjs`: `blLifecycleLabel` added to the core (configuration) model allow-list. The first run of the check flagged it. It is configuration, not a business record, so the check's purpose is unchanged.

**Verified here:**
- `prisma validate` passes. `prisma generate` passes (placeholder engine).
- All 41 migrations in `prisma/migrations` apply in order to an empty PGlite database (PostgreSQL-compatible WASM). The Phase 5 migration also replays a second time without error.
- The resulting columns, enum values, foreign key (`ON DELETE SET NULL ON UPDATE CASCADE`), index and primary key match the schema.
- API `tsc` passes. Web `tsc` passes. `prisma/seed/core.ts` passes `tsc --strict`.
- `check-seed-safety.mjs` passes ("SEED SAFETY OK").

**Not verified here:**
- Prisma's own drift check (`migrate diff`). The schema engine binary is not available in this sandbox, so Prisma's generated SQL could not be compared with the hand-written migration.
- The migration on a real PostgreSQL server or the owner's test database.
- `scripts/test-seed-safety.ts` needs a disposable seed database (`SEED_TEST_DATABASE_URL`). It was not run.

**Owner steps for the test database (not run here):** `prisma migrate deploy` against the test database only, then `pnpm db:seed` (add-only). Then confirm the new columns and the six label rows. Do not run this against the live database until the test-database result is accepted.

---

## 5d. Slice 2 — release and delivery services and web forms (implemented 2026-10-13)

**Changed (no existing row is written by a migration or a seed):**
- `apps/api/src/modules/delivery-release/dto/delivery-release.dto.ts`: `CreateDeliveryOrderDto.portId` (required); `CreateReleaseOrderDto.paymentState` (required, one of `PAID`, `PARTIAL`, `UNPAID`).
- `apps/api/src/modules/delivery-release/delivery-release.service.ts`: `createDelivery` looks up the port (`deletedAt: null`, `isActive: true`), returns 404 `port not found or inactive` before the B/L check, and stores `portId` and a `portName` snapshot. `createRelease` stores `paymentState`. Both serializers return the new fields (`null` on legacy rows). The port is not editable after issue, so `updateDelivery` is unchanged.
- `packages/shared/src/delivery-release.ts` and `index.ts`: `ReleasePaymentState`; `portId`/`portName` on `DeliveryOrder`; `paymentState` on `ReleaseOrder` and `CreateReleaseOrderDto`; `portId` on `CreateDeliveryOrderDto`.
- `apps/api/test/delivery-release.e2e-spec.ts`: existing create calls now send `portId` (9 delivery-order creates) and `paymentState` (6 release-order creates, `UNPAID` for the forced-override cases, `PAID` otherwise). No existing assertion was removed. Four Slice 2 tests were added: missing and unknown port; port name snapshot survives a rename; missing or invalid payment state; payment state serialized, and a legacy delivery order without a port reads back `null` (inserted through Prisma, cleaned up by the existing `afterAll`).
- `apps/web/src/app/[locale]/(dashboard)/release-orders/page.tsx`: required payment-state select, with a validation message, and detail display (empty for legacy rows).
- `apps/web/src/app/[locale]/(dashboard)/delivery-orders/page.tsx`: port select from `GET /ports?pageSize=100&isActive=true`, required, sent as `portId`; detail shows `portName` (empty for legacy rows).
- `apps/web/messages/{en,ar,fa}.json`: additive keys under `releaseOrder` and `deliveryOrder` (`fields.paymentState`, `paymentState.{PAID,PARTIAL,UNPAID}`, `create.selectPaymentState`, `create.errors.paymentStateRequired`, `fields.port`, `create.selectPort`, `create.errors.portRequired`). The `ar` and `fa` strings have not been reviewed by a native speaker and need that review.

**Verified here:**
- `pnpm --filter @shipping/shared run build` passes. API `tsc --noEmit` passes (includes `test/**`, so the spec type-checks). Web `tsc --noEmit` passes.
- ESLint on the web pages passes. ESLint on the API files shows the same `no-var-requires` and `no-explicit-any` findings as `HEAD`, plus one more `no-var-requires` at the new legacy-row test. That test follows the file's existing `require('@prisma/client')` pattern (five existing instances). No new rule was disabled.
- Sandbox-only harness (not committed, stubbed Prisma client, real `DeliveryReleaseService`): unknown port returns 404 and the B/L is not read; inactive port returns 404; draft B/L with a valid port returns 409; a valid port is stored with `portId` and the `portName` snapshot.
- Locale keys: every new key exists in `en`, `ar` and `fa`. The existing `ar` file has 19 keys that `en` lacks; this was already present at `HEAD` and is not changed here.

**Not verified here:**
- The Nest e2e suite (`delivery-release.e2e-spec.ts`). It needs PostgreSQL and a real Prisma engine, which the sandbox does not have. The owner runs it on the test database.
- The migrations. No new migration in this slice. Slice 1's migration is unchanged.
- Browser behaviour of the two forms.

**Owner steps (not run here):** run `pnpm test:e2e -- delivery-release` against the test database only (it writes test records). Check the two forms in `en`, `ar` and `fa`.

---

## 6. Next step

Slice 2 is implemented and verified as far as this sandbox allows. Stop for owner approval before Slice 3 (agent portal read API). Slice 3 has not started.
