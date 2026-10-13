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

## 6. Next step

Owner answers §4. Then Phase 5 implementation proceeds under the usual workflow: explicit-path commits, `tsc`/ESLint, a doc update, and a stop for approval after the phase.
