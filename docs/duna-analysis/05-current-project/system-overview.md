# Current System — Overview

> Phase 8, part 1. The **current** Duna Shipping dashboard: what it is, how it is built, and the
> conventions a future agent must follow.
>
> ⚠️ **Read-only reference.** Nothing here is a proposal. To change the system, work in the repo and
> follow `docs/current-plan/10-phase-execution-protocol.md`.

---

## 1. Stack

| Layer | Choice | ADR |
|---|---|---|
| Repo | **pnpm workspaces monorepo** | ADR-001 |
| API | **NestJS**, mounted at `/api/v1` | ADR-002 |
| Web | **Next.js App Router** + React + TypeScript + Tailwind | ADR-003 |
| ORM / DB | **Prisma + PostgreSQL** | ADR-004 |
| IDs | **cuid() strings**, not UUID v4 | ADR-005 |
| Config | Centralised validated config in `@shipping/config` | ADR-006 |
| API responses | Consistent envelope + versioning | ADR-007 |
| Auth | **JWT access token** + opaque DB-backed rotating refresh token | ADR-014 |
| Money | `Decimal`, serialised as **string** over the API | ADR-023 |
| Packages | `@shipping/config`, `@shipping/shared` built to **CommonJS** | ADR-011 |
| Dev DB | PostgreSQL in Docker (with local fallback) | ADR-013 |

---

## 2. Shape of the repository

```
apps/api/          NestJS — 33 modules, 38 controllers, 38 services
apps/web/          Next.js — 35 pages under src/app/[locale]/(dashboard)
packages/config/   shared, validated configuration
packages/shared/   shared TypeScript types & enums (CommonJS build)
prisma/
  schema.prisma    93.8 KB — 62 models, 25+ enums
  seed.ts
  migrations/      38 migrations (through phase13, plus phase 4/5 additive ones)
docker/            dev PostgreSQL
scripts/
docs/              the project's own documentation (13 top-level files + 4 directories)
```

### 2.1 API modules (`apps/api/src/modules/`)

```
actual-loading   agents        auth           bill           cargo
consignees       currencies    customers     delivery-release  discharge
health           inspections   invoice       jobs           ledger
letters          load-planning manifest      permissions    portal
ports            proforma      quotation     roles          salary
shippers         users         vessels       voucher        voyages
yard-inventory   yards
```

### 2.2 Web pages (`apps/web/src/app/[locale]/(dashboard)/`)

```
dashboard      cargo          yard-inventory  inspections   load-lists
actual-loading discharges     bookings        manifest      bills
invoices       proformas      quotations      vouchers      ledger
jobs           salary-records employees       letters       delivery-orders
release-orders customers      shippers        consignees    agents
ports          yards          vessels         voyages       users
roles          permissions    portal
```

---

## 3. Cross-cutting architecture decisions

These are the ones that most affect how a new feature must be written.

### 3.1 Configurable numbering (ADR-008)
`NumberingSequence` replaces hard-coded generators. Numbers are allocated through a
`NumberingService` with `SELECT … FOR UPDATE` locking, scoped by `scopeType` / `scopeValue`.

| Document | Format | Scope |
|---|---|---|
| B/L | `BOL-{DEST}-YYMM-#####` | destination port, per month |
| Manifest | `MAN-{DEST}-YYMM-#####` | destination port, per month |
| Voyage | per-destination leg numbers | `DESTINATION` / `destinationPortId` |
| Invoice | `INV-YYMM-#####` | — |
| Proforma | `PRF-YYMM-#####` | — |
| Quotation | `QT-YYMM-#####` | — |
| Receipt voucher | `RCP-YYMM-#####` | — |
| Payment voucher | `PMT-YYMM-#####` | — |
| Delivery order | `DO-YYMM-#####` | — |
| Release order | `RO-YYMM-#####` | — |
| Job | `JOB-YYMM-#####` | — |

> ⚠️ **These are not the employer's real formats.** The real documents use `KHS/26-110`,
> `DSMAN/KHO-26-006`, `DSINV/26-172`, `DSQUO/25-017`, `DSPRO/26-001`, and receipt voucher **No. `477`**
> (plain numeric). The current formats are a configurable placeholder pending employer confirmation — see
> [`../04-business-analysis/contradictions-register.md`](../04-business-analysis/contradictions-register.md)
> C-01…C-07. This is exactly why ADR-008 exists: the format is data, not code.
>
> **Corrected 2026-10-11.** A `DSR/26-190` receipt-voucher number was listed here. That string is
> **fabricated** — it appears in no extracted document, transcript or legacy source (error **E1**). The
> verified receipt voucher is **No. `477`** (dated `6-Aug-26`, `AED 1,600.00`, allocation references
> `1517`, `1526`, `Advance 477`). Contradiction **C-07**, which was built on the fabricated number, has
> been withdrawn in the register.

### 3.2 Configurable document templates (ADR-009)
A `DocumentTemplate` registry keyed by document type, with `DocumentTemplateVersion`. Domain
services produce **structured data**; the template layer owns presentation. Business logic must never
depend on a fixed PDF layout.

### 3.3 Audit (ADR-010)
Append-only `AuditLog` (`user`, `action`, `entity`, `entityId`, `timestamp`, `previousState`,
`newState`) written **in the same transaction** as the mutation. Sensitive fields redacted; states
stored as JSON.

### 3.4 Money (ADR-023)
`Decimal` in the DB, **string** over the wire. Never a JS float.

### 3.5 Permissions (ADR-016)
Permissions are a **read-only seeded registry** — 105 permissions across 12 resources:
`users`, `roles`, `permissions`, `bl`, `manifest`, `invoice`, `vesselVoyage`, `cargo`, `job`,
`loadingList`, `ledger`, `settings`. Enforced **server-side** (contrast the legacy system, where
`@can` only hid buttons). A `roleGranularPermissions` feature flag controls granularity.

### 3.6 Master-data lifecycle (ADR-018)
Activate/deactivate via `PATCH /:id/active` mapped to the `:update` permission — not a separate
endpoint or a delete.

### 3.7 Boolean query filters (ADR-017)
Typed as `string`, not `boolean`, and parsed by the DTO.

### 3.8 Soft delete for roles (ADR-015)
Role active/inactive is a soft delete, **not** an `isActive` column.

---

## 4. Testing & quality gates

| Gate | Current state |
|---|---|
| API e2e suites | **22** files, **403 tests, 0 failing** (as of 2026-10-06, Phase 5 unit 4) |
| Web unit tests | **None** — `apps/web` has `"test": "echo 'No web unit tests yet'"` |
| Contract guard | `apps/web/scripts/check-contract.mjs` — proves route parity between web and API |
| TypeScript | `tsc` API 0 errors; web has **3 pre-existing** errors in `[locale]/page.tsx` |
| Migrations | `prisma migrate status` — 37–38 up to date, shadow DB clean |

> ⚠️ **The web layer has no test harness.** This has already caused a shipped defect: the
> Inspections page called dead `/approve` and `/reject` endpoints and crashed on the `DONE` status,
> because no API test can see the web layer. See
> [`../04-business-analysis/prior-analysis-review.md`](../04-business-analysis/prior-analysis-review.md)
> and the defect record in `docs/current-plan/11-implementation-state.md`.

---

## 5. Documentation generations

The repo contains **three generations** of planning, explicitly ranked by
`docs/current-plan/00-project-authority.md`:

| Gen | Location | Status |
|---|---|---|
| **1** | `docs/`, `docs-gap/`, older ADRs, `docs/progress.md` | Historical. Some ideas still valid; some phase numbers obsolete. **Not the current spec** |
| **2** | `docs/ai-audit/` (14 files, 4,586 lines) + `docs-legacy/` | Previous expert analysis. Valuable but re-audited |
| **3** | `docs/current-plan/` (17 files, 3,073 lines) | **Current plan** |

**Conflict rule (from `00-project-authority.md`):**
1. Raw employer evidence beats derived analysis.
2. `docs/current-plan/` beats older planning directories.
3. Current implementation reality beats stale progress documents.
4. Where employer evidence is ambiguous, record an **open business decision** — do not invent.

---

## 6. ⚠️ A coverage gap that affects everything

`00-project-authority.md` names **`/home/duna/dunaData/`** (especially `transcripts/`) as the
**highest authority** for employer evidence.

**That path does not exist in this workspace** (source gap **SRC-01**).

The transcripts available here are the 20 files under
`docs/duna-analysis/requirements/` (18 timestamped + 2 undated). They are substantial — 113 KB of
consolidated English statements — but they may not be the **complete** transcript set that
`docs/current-plan/` was written against.

> **Consequence:** every conclusion in this knowledge base is **provisional with respect to the
> missing transcript set.** If a statement here conflicts with `docs/current-plan/`, do not assume
> this knowledge base is wrong — but do not assume it is right either. Verify.

---

## 7. Conventions a future agent must follow

From `CLAUDE.md`, `README.md` and `docs/current-plan/10-phase-execution-protocol.md`:

1. **Do not invent business rules.** Where the employer is ambiguous, raise an open business decision.
2. **Preserve historical document numbers** — never renumber existing rows.
3. **Enforce sensitive scope server-side** — never rely on UI gating.
4. **Separate document data readiness from rendering polish.**
5. **Redesign UI late.**
6. Migrations must be **additive** unless a decision record explicitly authorises a drop.
7. Every business decision that affects schema, API or UI is recorded **before** the work is marked
   complete.
8. Design-first units: record the ADR before writing code.
