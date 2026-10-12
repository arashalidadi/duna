# Phase 1 audit — 2026-10-12

**Audited against:** [`initial-roadmap.md`](initial-roadmap.md) §2, Phase 1 — *Documentation truth, seed safety,
knowledge-base corrections*. This is the **only** roadmap followed.
**Verdict:** 🔶 **PARTIALLY COMPLETE** — documentation half complete and verified; implementation half not started.

---

## 1 · ⚠️ Two different "Phase 1"s — do not confuse them

| Roadmap | Phase 1 means | Status |
|---|---|---|
| **Authoritative** — `09-audit/initial-roadmap.md` (P0–P12) | Documentation truth, seed safety, knowledge-base corrections | 🔶 **PARTIALLY COMPLETE** (this audit) |
| **Superseded** — `ai-audit/07` (9-phase, 🗄️ HISTORICAL) | Safety, shared infrastructure & migration foundation | Recorded ✅ COMPLETE 2026-09-21 |

`ai-audit/00-audit-state.md` still shows "Phase 1 … ✅ COMPLETE". That refers to the **superseded** roadmap and
must not be read as clearing the current Phase 1. Left in place unedited; noted here instead — corrections in
this project are additive and dated, never silent overwrites.

### Counts corrected against source

| Owner recollection | Source | Actual |
|---|---|---|
| "23 findings" | `09-audit/audit-findings.md` | ✅ **23** — `AUD-001`…`AUD-023` |
| "19 open questions + 1 follow-up" | `09-audit/open-questions.md` | ❌ **15** — `OQ-01`…`OQ-15`. The file's own history: an initial **41**-question list → a **12**-item revision → **15** now. The separate `01-employer-statements/open-questions.md` uses a different `Qnnn` scheme (91 distinct) |
| "11-phase roadmap" | `09-audit/initial-roadmap.md` | ❌ **13 phases** — `P0`…`P12` |

---

## 2 · Phase 1 completion matrix

**Legend** — ✅ Complete · 🔶 Partial · ⬜ Not started · ⛔ Blocked

| Requirement / task | Status | Evidence | Remaining work |
|---|---|---|---|
| **D1** — correct `architecture.md`, `database-schema.md`, `permissions.md`, `workflows.md` against source | ✅ | Applied 2026-10-11; "35 modules" figure corrected to 33 | — |
| **D2** — mark superseded roadmaps 🗄️ HISTORICAL | ✅ | Banners present in `current-plan/09` and `ai-audit/07` (verified this audit) | — |
| **D3** — correct fabricated `DSR/26-190` → voucher **No. 477** | ✅ | Every surviving occurrence carries a dated correction note (verified: `contradictions-register.md`, `capability-gap-analysis.md`, `consolidated-business-model.md`, `legacy-vs-current-comparison.md`, `03-legacy-laravel-system/reports-and-documents.md`, `docs/README.md`) | — |
| **D4** — add `docs/README.md` index | ✅ | File present, 5,957 bytes | — |
| **D5** — cross-reference `current-plan/12-open-business-decisions.md` | ✅ | Applied 2026-10-11 | — |
| **D6** — provenance legend in `07-traceability/requirements-traceability.md` | ✅ | Line 17: "Provenance legend … (added 2026-10-11, action **D6**)" | — |
| **Split `prisma/seed.ts` into structural vs demonstration** | ⬜ | `prisma/seed.ts` is a **single 668-line file**; no split exists | Create the split; move demonstration rows out |
| **Gate demonstration data behind explicit opt-in + loud warning** | ⬜ | Only env vars in the file are `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. No demo/opt-in flag of any kind | Add the flag and the warning |
| **Give any dependent suite its own fixtures** | ⬜ | 0 unit specs exist in `apps/api`; all 22 suites are `.e2e-spec.ts` requiring a live DB | Create fixtures when the split lands |
| **Remove the stale `planned` "Agent portal" nav entry** | ⬜ | `apps/web/src/lib/navigation/nav.ts:288` still present: `{ labelKey: 'agents', icon: UserCircle, status: 'planned', description: 'Agent portal' }` | Delete that one entry (see §3) |
| **Record the REQ-001 six-vs-ten nav discrepancy** | ✅ | `question-reconciliation.md:236`, `open-questions.md:511` ("discrepancy **preserved**, not resolved"), `audit-findings.md:888` | — |
| **A1** — no top-level doc contradicts verified source | ✅ | D1–D6 verified above | — |
| **A2** — no uncorrected `DSR` reference survives | ✅ | All remaining occurrences carry dated notes | — |
| **A3** — `pnpm db:seed` on a fresh DB creates **zero** cargo, customers, vessels, voyages, load lists | ❌ **NOT MET** | `seed.ts` unconditionally upserts: `vessel` (l.387), `voyage` (l.393), `customer` ×2 (l.433, 439), `cargo` ×3 (l.446, 476, 506), `loadList` (l.589) | Implement the split and gate |
| **A4** — test status unchanged from the P0 baseline | ⛔ **BLOCKED** | No P0 baseline exists. 0 of 22 e2e suites have ever executed | Complete P0 first |
| **T1/T2/T3** — seed idempotency, seeded-row assertion, suites still pass | ⛔ **BLOCKED** | All require a database; none run | Requires a provisioned DB |

### Verdict

**Phase 1 is NOT complete.** Its documentation half is complete and independently verified. Its implementation
half — the seed split, the demonstration-data gate, and the stale nav entry — has **not been started**, and
acceptance criterion **A3 is demonstrably not met**.

---

## 2b · Phase 1 completion update — 2026-10-12 (later the same day)

> The matrix above is the state at audit time and is left unedited. This section
> records what changed afterwards. Commits: `6f09493` (seed + users), `a140fd3`
> (pagination), and the Phase 1 completion commit that carries this note.

| Task | Was | Now | Evidence |
| --- | --- | --- | --- |
| **Split `prisma/seed.ts`** | ⬜ | ✅ **Complete** | `prisma/seed.ts` is now an orchestrator; `prisma/seed/core.ts` (required) and `prisma/seed/demo.ts` (demonstration) hold the data. The split is mechanical: a line comparison against the previous file shows **0 of 618 body lines lost**. |
| **Gate demonstration data behind opt-in + loud warning** | ⬜ | ✅ **Complete** | `SEED_DEMO_DATA === 'true'`, exact string match, never inferred from `NODE_ENV`; a boxed `console.warn` banner; `pnpm db:seed:demo` as the explicit opt-in path. Documented in `.env.example`. |
| **Give any dependent suite its own fixtures** | ⬜ | ✅ **Complete** | `vessel.e2e-spec.ts` no longer asserts on the seeded `MV-HORIZON` row; it creates its own. Inventory of all 22 suites: **0 depend on demonstration data** — see [`seed-dependency-inventory.md`](seed-dependency-inventory.md). |
| **Remove the stale `planned` "Agent portal" nav entry** | ⬜ | ✅ **Complete — but see §3 correction** | Entry removed from `nav.ts`. It was **dead code that never rendered**, not a visible defect. |
| **Record the REQ-001 six-vs-ten nav discrepancy** | ✅ | ✅ Unchanged | — |
| **A1** — no top-level doc contradicts verified source | ✅ | ✅ Met | D1–D6 verified |
| **A2** — no uncorrected `DSR` reference survives | ✅ | ✅ Met | — |
| **A3** — default seed creates zero cargo, customers, vessels, voyages, load lists | ❌ | 🟡 **Met in code; runtime test prepared, not yet executed** | `pnpm check:seed-safety` passes (static, executed here). `pnpm test:seed-safety` runs the seed twice against a disposable database and asserts it — **could not be executed in the build environment** (the Prisma query engine cannot be downloaded: `binaries.prisma.sh` is unreachable, and `driverAdapters` mode still requires the native engine). Run it on the server. |
| **A4** — test status unchanged from the P0 baseline | ⛔ | ⛔ **Still blocked** | No baseline figure exists anywhere in the repository. `pnpm test:e2e-baseline` now produces it; **0 of 22 suites have ever executed here** because they need a live database. |
| **T1/T2/T3** — idempotency, seeded-row assertion, suites still pass | ⛔ | 🟡 **T1/T2 prepared; T3 prepared** | `pnpm test:seed-safety` (T1, T2) and `pnpm test:e2e-baseline` (T3). None executed here. See [`phase-1-testing.md`](phase-1-testing.md). |

**Phase 1 status after this update: implementation complete; two acceptance criteria
await server-side execution.** A3 is enforced and statically verified but its runtime
proof requires a database; A4 requires the P0 baseline figure, which the same server
run produces. Nothing in Phase 1 remains unimplemented.

---

## 3 · The stale nav entry is user-visible, not cosmetic

> ## ⚠️ CORRECTION — 2026-10-12 (Phase 1)
>
> **The conclusion below is WRONG.** The stale entry was **never rendered**.
>
> `sidebar.tsx:149-152` builds `implementedLabels` from **every** item that has an
> `href` — not from the Agent Portal entry alone. `nav.ts` contains a **second**
> `labelKey: 'agents'` entry: Agent *master data*, `href: '/agents'`, status
> `implemented` (now line 358). So `'agents'` **is** in `implementedLabels`, the
> filter `(item.href || !implementedLabels.has(item.labelKey))` evaluates to
> `false`, and the stale entry is suppressed.
>
> The error was reading `'agents'` as belonging only to the stale entry and
> comparing it against the Agent Portal's `'agentPortal'` key. The Agent *master
> data* entry shares the key and had been overlooked.
>
> Corrected consequences:
> - Removing the entry (Phase 1, commit `a140fd3`) is **correct hygiene but had no
>   user-visible effect**. It was dead code, not a visible "soon" badge.
> - The audit's severity statement below — "user-visible", "visible to every user",
>   "directly alongside a working Agent Portal item" — is **withdrawn**.
> - The same defect class has a **second instance**: `nav.ts` still contains a
>   `planned` "Job costing" entry sharing the `jobs` key with the implemented
>   `/jobs` register. It is likewise dead. It is **not** Phase 1 scope (the roadmap
>   names only the Agent portal entry), so it is left in place, reported by
>   `apps/web/scripts/check-navigation.mjs` and recorded in
>   [`phase-1-testing.md`](phase-1-testing.md). Removing it needs a product
>   decision, not a silent deletion.
> - `apps/web/scripts/check-navigation.mjs` now enforces the real invariant.
>
> The original text is retained below, unedited, per the project's rule that
> corrections are additive and dated, never silent overwrites.

`nav.ts:288` is **not** filtered out of the sidebar. `sidebar.tsx:155-158` keeps an item when
`item.href || !implementedLabels.has(item.labelKey)`. The stale entry has no `href`, and its `labelKey` is
`'agents'` — whereas the real, working entry is `'agentPortal'` (line 329, `href: '/portal'`). Because the
keys differ, `'agents'` is **not** in `implementedLabels`, so the stale item **renders**.

It renders as a disabled button with a **"soon"** badge at 50 % opacity (`sidebar.tsx:50-62`), carrying no
`requiredPermission` and therefore visible to every user — directly alongside a working Agent Portal item
elsewhere in the same sidebar.


---

## 4 · P0 is the blocker (prerequisite, not complete)

Phase 1 declares P0 as its prerequisite. P0's acceptance requires a **dated, real** pass/fail figure replacing
the unverified "403/403", plus a verified backup **and** verified restore.

| P0 requirement | Status | Evidence |
|---|---|---|
| `pnpm install` from clean checkout | ✅ | runs clean (12.6 s, exit 0) |
| `prisma migrate deploy` | ⛔ | Cannot complete here — the engine download from `binaries.prisma.sh` is blocked. **Unproven against the real DB** |
| Run the 22 e2e suites; record a real figure | ⛔ | **0 of 22 executed.** `test/auth.e2e-spec.ts` fails at config load: `ConfigError: Missing required environment variable` — no `.env` exists (only `.env.example`) |
| Verified backup **and** verified restore | ⛔ | No production database access from this environment |
| Seed-dependency inventory | ⬜ | Not written |

The "403/403" figure remains unverified, exactly as `initial-roadmap.md:74` states.

---

## 5 · Change inventory on this branch (`c997624` → `31c1550`)

**86 files changed, 18,123 insertions, 73 deletions.**

| Area | Files | Nature |
|---|---|---|
| **Documentation** | **66** | Audit deliverables, corrections, this audit, the incident record |
| **API (backend)** | **15** | Primary-administrator identity, audit read surface, release-override gating |
| **Database** | **3** | `schema.prisma` (one field), 1 new migration, `seed.ts` |
| **Build config** | **2** | `package.json` (generate-before-build), `pnpm-workspace.yaml` |
| **Web / frontend** | **0** | **none** |

### API files changed (15)

```
app.module.ts                                        register AuditController
common/auth/guards/jwt-auth.guard.ts                 primary-admin implicit authority
common/auth/guards/permissions.guard.ts              permission evaluation
common/auth/types.ts                                 ACTX + authorizationBasis
common/infrastructure/audit/audit.controller.ts      NEW — read-only audit surface
common/infrastructure/audit/audit.service.ts         + query()
common/infrastructure/audit/dto/audit-query.dto.ts   NEW
modules/auth/auth.service.ts                         primary-admin identity
modules/delivery-release/delivery-release.service.ts canOverride (primary admin OR release:override)
modules/delivery-release/release-order.controller.ts release-exception gating
modules/roles/roles.controller.ts                    audit on role/permission mutation
modules/roles/roles.service.ts                       audit + EXPLICIT_GRANT_ONLY
modules/users/dto/users.dto.ts                       transfer DTO
modules/users/users.controller.ts                    POST primary-admin/transfer
modules/users/users.service.ts                       owner protections, audit, role/permission guards
```

### New endpoints (4) — all backend-only, none surfaced in the UI

| Endpoint | Gate | Visible in dashboard? |
|---|---|---|
| `GET /api/v1/audit` | `audit:read` | No — no UI consumes it |
| `GET /api/v1/audit/entity/:entityType/:entityId` | `audit:read` | No |
| `GET /api/v1/audit/actor/:actorId` | `audit:read` | No |
| `POST /api/v1/users/primary-admin/transfer` | `user:roles` | No |

---

## 6 · Visible dashboard changes: **none**

**There are zero frontend changes on this branch.** `git diff --name-only c997624 HEAD -- apps/web` returns
**0 files**.

The work here is backend, database, documentation and build configuration. Nothing altered a page, component,
control, style, layout or workflow in the dashboard. **No visual redesign occurred and none should be looked for.**

What *is* different at runtime, and how it could be perceived:

| Change | User-perceptible? |
|---|---|
| `User.isPrimaryAdmin` column + partial unique index | No — schema only |
| Primary administrator gains implicit full authority | Only for the one designated user, once designated. No row is flagged yet |
| `release:override` no longer auto-granted to managers | A manager who previously could approve a release exception may now be refused — a **behavioural** change, not a visual one |
| Audit records written on role/permission/user changes | No — rows only |
| 4 new endpoints | No — no UI |
| Stale "Agents — soon" nav item | **Visible today, and still present** (§3) — pre-existing, not introduced here |

The one thing that would look different to a user is a **permission refusal** where none happened before. Everything
else is invisible.

---

## 7 · Tests actually executed — real results

| Check | Command | Result |
|---|---|---|
| API type-check | `npx tsc --noEmit -p tsconfig.json` | ✅ **0 errors** |
| API build | `pnpm --filter @shipping/api build` | ✅ **exit 0**, `dist/src/main.js` produced |
| Web type-check | `npx tsc --noEmit` | ✅ **exit 0** |
| Web contract guard | `pnpm --filter @shipping/web test` | ✅ OK — 18 unions ⊆ Prisma enums; 87 routes ⊆ 96 `@Post` |
| Web i18n guard | (same command) | ✅ OK — 2,114 messages, 3 locales |
| `packages/config` build | `npx tsc -p tsconfig.json` | ✅ exit 0 |
| `packages/shared` build | `npx tsc -p tsconfig.json` | ✅ exit 0 |

### Not executed — and not claimed

| Suite | Result |
|---|---|
| **22 e2e suites** | ⛔ **0 executed.** `auth.e2e-spec.ts` fails at load: `ConfigError: Missing required environment variable` (no `.env`). Requires a live database |
| Unit tests | ⛔ **None exist.** `find apps/api -name "*.spec.ts"` → **0 files** |
| `prisma migrate deploy` | ⛔ Engine download blocked; unproven against the real database |
| Seed idempotency | ⛔ Requires a database |

### ⚠️ The Phase 1 (superseded) log claims 28 unit tests that do not exist

`ai-audit/phase-1-implementation-log.md` records `numbering.service.spec.ts` (9), `audit.service.spec.ts` (9)
and `attachment.service.spec.ts` (10). **None of these files exist**, and `git log --all --diff-filter=A` shows
they were **never committed on any branch**.

The infrastructure modules they would have tested **do** exist, are tracked, and are registered in
`app.module.ts` (storage 7 files, numbering 4, audit 5, attachment 5, templates 5). Only the test files are
absent — the same pattern as the four migrations recorded in the database but missing from the repository:
work performed outside the repository and never committed.

---

## 8 · Migration consistency (read-only findings)

The four migrations recorded in the database but absent from `prisma/migrations/` are analysed in
[`migration-safety-report.md`](../../ai-audit/migration-safety-report.md). Confirmed this audit:

1. **Correct name of the fourth:** `20260921130000_phase3a_cargo_pol_pod` — per `migration-safety-report.md:90`
   and `current-plan/implementation-log/phase-2-port-abbreviation.md:67`. An earlier note in this session
   recorded it as `phase3a_cargo_loading_lifecycle`; that was wrong.
2. **None of the four ever existed in Git** — verified again across all branches and full history.
3. `20260921012713_phase1_infrastructure` has `applied_steps_count=1`; the other three have `0`, yet their
   schema effects are present in the live database.

### New finding this audit — the schema is reproducible without them

The five tables attributed to the missing `phase1_infrastructure` migration **are** created by an on-disk
migration: `20260930180000_replay_completeness` contains `CREATE TABLE IF NOT EXISTS` for `NumberingSequence`,
`AuditLog`, `FileAttachment`, `DocumentTemplate` and `DocumentTemplateVersion` (lines 152, 171, 189, 209, 226).

Building a clean database from the **37 committed migrations alone** therefore yields a complete schema:

```
migrations applied 1 → 37, failures: 0
tables = 52   enums = 32
DMMF models vs reference tables: 52 ↔ 52, zero missing, zero extra
```

The `Cargo.status` column flagged CRITICAL in the earlier report is also present in the current schema, and
`replay_completeness` performs the `CargoStatus` enum migration (`READY` → `READY_FOR_LOADING`) including
`ALTER TABLE "Cargo" ALTER COLUMN "status"`.

**This does not declare the four redundant.** It shows a fresh database can be built correctly without them.
Whether the *live* database matches that reference remains unproven — the comparison needs a backup of the
production database, which this environment cannot take.

No migration was applied, resolved, reset or rewritten during this audit.

---

## 9 · Recommendation — remaining Phase 1 work, priority order

| # | Task | Why | Blocked by |
|---|---|---|---|
| 1 | Add an explicit migration step to deployment; close the process gap that caused the incident | Prevents recurrence of the `isPrimaryAdmin` class of failure | — |
| 2 | Verify column, index and migration record; exercise Users write paths | Confirms the incident is closed rather than merely silent | Owner's database |
| 3 | Complete P0 — provision a DB, run the 22 e2e suites, record a dated real figure | Phase 1's prerequisite; unlocks A4 and T1–T3 | Environment / database access |
| 4 | Split `prisma/seed.ts`; gate demonstration data behind opt-in | Acceptance **A3** is unmet | A seed run needs a DB (task 3) |
| 5 | Give dependent suites their own fixtures | Required alongside the split | Task 4 |
| 6 | Remove the stale `planned` "Agent portal" nav entry | One-line deletion; user-visible defect | — |
| 7 | Reconcile the four migrations (separate decision) | History integrity; not required to make progress | Owner decision |

**Phase 1 should not be declared complete.** Items 4–6 are outstanding and A3 is demonstrably unmet; A4 cannot
be satisfied until P0 is complete.

---

## 10 · Non-actions during this audit

No database was modified. No migration was applied, resolved, reset or rewritten. No `db push`, `migrate dev`
or `db seed` was run. No branch was switched, merged or rebased; no history rewritten. No unrelated code was
changed, and no Phase 2 work was started.
