# Phase 1 — test record and instructions

**Created 2026-10-12.** Companion to
[`phase-1-audit-2026-10-12.md`](phase-1-audit-2026-10-12.md) and
[`phase-1-deployment-runbook.md`](phase-1-deployment-runbook.md).

This file applies the project's testing policy: every phase separates what was
**actually executed and passed**, what **failed**, and what could **not run** with
the reason — and, where the build environment lacks a prerequisite, ships a
reproducible test for the server instead.

Nothing here is reported as passing unless it produced the stated output.
Everything in §1 was run in the build environment on 2026-10-12.

---

## 1 · Executed and passed

| # | Test | Command | Result |
| --- | --- | --- | --- |
| 1 | API typecheck | `pnpm --filter @shipping/api typecheck` | **0 errors** (exit 0) |
| 2 | API build | `pnpm --filter @shipping/api build` | **exit 0**, `dist/src/main.js` emitted |
| 3 | Web typecheck | `pnpm --filter @shipping/web typecheck` | **0 errors** (exit 0) |
| 4 | Web build | `pnpm --filter @shipping/web build` | **exit 0**, 108/108 static pages |
| 5 | Web lint | `pnpm --filter @shipping/web lint` | **no warnings or errors** |
| 6 | Contract guard | part of `pnpm --filter @shipping/web test` | OK — 18 status unions ⊆ Prisma enums; 87 web `api.post` routes ⊆ 96 controller `@Post` routes |
| 7 | **Navigation guard** (new) | `node apps/web/scripts/check-navigation.mjs` | OK — 39 items, 6 planned, no dead entries, Agent Portal intact |
| 8 | Page-size guard | part of `pnpm --filter @shipping/web test` | OK — 70 request sites, none above the API limit of 100 |
| 9 | i18n guard | part of `pnpm --filter @shipping/web test` | OK — 2,114 messages, 3 locales |
| 10 | **Pagination behavioural tests** | `pnpm test:pagination` | **10 passed, 0 failed** |
| 11 | Static seed-safety guard | `pnpm check:seed-safety` | OK — required seed touches only reference data; opt-in gate present |
| 12 | Seed-split integrity | line comparison vs previous `seed.ts` | **0 of 618 body lines lost** |
| 13 | Seed-dependency inventory | inspection of all 22 suites | **0 suites depend on demonstration data** |
| 14 | New scripts typecheck | `tsc --noEmit --strict … scripts/*.ts` | **0 errors** |
| 15 | Prerequisite refusal paths | `pnpm test:seed-safety`, `pnpm test:e2e-baseline` with no environment | both refuse with instructions — **exit 2**, no false pass |

### Guard effectiveness — proved by reintroducing the defect

A guard that cannot fail is not a test. Both new guards were run against the
defect they exist to catch:

| Guard | Defect reintroduced | Observed |
| --- | --- | --- |
| `check-navigation.mjs` | the stale `planned` "Agent portal" entry | **FAILED — 3 problems**, naming the dead entry, the duplicate `agents` key and the stale "Agent portal" description. Restored → passes again. |
| `check-page-size.mjs` | `/customers?pageSize=200` | **FAILED — 1 problem** naming the offending file and line. Restored → passes again. *(Phase 0 fix, re-verified.)* |

---

## 2 · Executed and failed

| Test | Failure | Cause | Resolution |
| --- | --- | --- | --- |
| `pnpm test:seed-safety` (first run) | `SyntaxError: The requested module '@prisma/client' does not provide an export named 'PrismaClient'` — exit 1, prerequisite message never printed | Two causes: (a) the build environment's Prisma client is a **type-only stub** (the real client needs the query engine, which cannot be downloaded here) so it has no runtime exports; (b) the script imported Prisma *before* validating its prerequisites, so a missing prerequisite produced a module-load error instead of instructions | Moved the prerequisite check **above** the Prisma import and switched to a dynamic import. Re-run → **exit 2 with setup instructions**, which is the intended behaviour. The import style matches `prisma/seed.ts`, which uses the same specifier. |

No other test failed. No test is reported as passing that did not run.

---

## 3 · Not executed — and why

| Test | Reason it could not run | Reproducible on the server? |
| --- | --- | --- |
| **22 API e2e suites** | Need a live database and a repository-root `.env`; without it every suite aborts at load with `ConfigError: Missing required environment variable`. Additionally the Prisma query engine cannot be obtained in the build environment (`binaries.prisma.sh` unreachable; no npm-distributed engine for 5.22). **0 of 22 have ever executed here.** | ✅ `pnpm test:e2e-baseline` — see §4 |
| **Seed runtime behaviour (acceptance A3)** | Same engine blocker: the seed uses `PrismaClient`. | ✅ `pnpm test:seed-safety` — see §4 |
| **Browser / UI verification** | No browser and no reachable deployment. `dashboard.3ree.eu.cc` resolves but is blocked by the build environment's egress allow-list, which permits only GitHub and the package registries. | ⚠️ Manual — see §5 |
| **`prisma migrate` / seed idempotency in this environment** | Prisma CLI cannot start without its engine. | ✅ Covered by §4 |

### The engine blocker was investigated, not assumed

Before accepting this limitation, alternative routes to run the real seed offline
were tried:

- **driver-adapter mode** — regenerate the client with
  `previewFeatures = ["driverAdapters"]` (which uses a bundled WASM engine rather
  than the native binary). **Attempted; it failed**: `prisma generate` still
  requests `libquery_engine.so.node.gz` and aborts.
- **An npm-distributed engine** — `@prisma/engines` ships only postinstall
  scripts, no binary; there is no `@prisma/query-engine-linux` package. The
  engine is downloaded from `binaries.prisma.sh` only.
- **Committing a schema change to enable it** — rejected: the schema is a
  production artifact and must not change for testing convenience.

No stand-in or simulation was used, because a simulated seed would not be evidence
about the real seed.

---

## 4 · Tests to run on the server

Both are new, both are committed, and both refuse to run without their
prerequisites rather than producing a misleading result.

### 4.1 · `pnpm test:seed-safety` — acceptance A3, idempotency, admin setup

**What it proves:** the default seed creates **zero** cargo, customers, vessels,
voyages and load lists (A3); running it twice changes nothing (idempotency); and
the administrator account, its `ADMIN` role and exactly one primary administrator
survive both runs.

**Prerequisites:** a **disposable** database of its own, with the schema applied.
It is passed as `SEED_TEST_DATABASE_URL`, not `DATABASE_URL`, so production cannot
be targeted by mistake.

**Modifies data:** yes — it writes exactly what the seed writes (reference data
and the admin account). It **deletes nothing** and never drops the schema.

```bash
cd ~/shipping-dashboard/new-erp
createdb duna_seed_test
DATABASE_URL=postgresql://localhost:5432/duna_seed_test npx prisma migrate deploy
DATABASE_URL=postgresql://localhost:5432/duna_seed_test npx prisma generate

SEED_TEST_DATABASE_URL=postgresql://localhost:5432/duna_seed_test pnpm test:seed-safety
```

**Expected result:** a `before / after1 / after2` table for each model, then

```
SEED-SAFETY RUNTIME TEST PASSED — default seed created no
cargo/customers/vessels/voyages/load lists, is idempotent, and kept the
administrator setup.
```

Exit code 0. A failure prints the specific violated assertion (e.g. `A3 VIOLATED:
'cargo' went from 0 to 3 rows`) and exits 1. Exit 2 means a prerequisite is
missing.

### 4.2 · `pnpm test:e2e-baseline` — the dated P0/P1 figure

**What it proves:** produces the "dated, real pass/fail figure" that
`initial-roadmap.md:74` requires, replacing the unverified `403/403`, and records
the P1 baseline that acceptance A4 compares against.

**Prerequisites:** Postgres with the schema applied; a repository-root `.env`
(copy `.env.example`); the required seed applied, because the suites log in as the
administrator.

**Modifies data:** the suites create rows through the HTTP API and delete them in
their own `afterAll` hooks. They do not drop the schema, but a crash mid-suite can
leave rows behind. **Use a development/test database.**

```bash
cd ~/shipping-dashboard/new-erp
cp .env.example .env      # then fill in DATABASE_URL, AUTH_JWT_SECRET, …
npx prisma migrate deploy
npx prisma generate
pnpm db:seed              # required seed only — no demonstration data

pnpm test:e2e-baseline
```

**Expected result:** the Jest summary, then a figure, then

```
E2E BASELINE RECORDED.
```

It writes `docs/duna-analysis/09-audit/e2e-baseline-<date>.md` containing the
date, command, database, suite/test counts and the failing-suite list. Commit that
file — it is the baseline A4 refers to.

If it exits 2, a prerequisite is missing. If Jest reports no summary, the suites
failed at load (almost always a missing `.env` variable) — the script says so
rather than recording a figure.

---

## 5 · Manual browser verification

Automated coverage cannot replace this, and it is not claimed to. After deploying,
confirm in the browser:

| # | Check | Expected |
| --- | --- | --- |
| 1 | Sidebar, signed in as the owner | **No** "Agent portal" entry appears twice; the **Agent Portal** entry in the Agent/portal section opens `/portal`; **Agents** under master data opens `/agents` |
| 2 | Sidebar, any user | No dead "soon" item is presented as an Agent portal |
| 3 | Users section | Loads (the pagination fix, re-confirm) |
| 4 | Any screen that lists records | Pagination still works; changing page loads the next page |
| 5 | Agents screen | Port picker populated |
| 6 | Bookings screen | Customer filter populated |

The Agent Portal specifically must remain fully functional — Phase 1 removed a
dead duplicate nav entry and nothing else. No route, page or permission changed.

---

## 6 · Known findings recorded, deliberately not fixed

| Finding | Detail | Why left |
| --- | --- | --- |
| **Second dead nav entry: `jobs`** | `nav.ts` has a `planned` "Job costing" entry sharing the `jobs` key with the implemented `/jobs` register, so `sidebar.tsx` suppresses it — the same defect class as the removed Agent portal entry. | The roadmap's Phase 1 task names **only** the Agent portal entry. Removing this one is a product decision (it may be intended as a marker for a future Job Costing screen). Reported by `check-navigation.mjs` as a **known finding**, not silently ignored. One line to remove on your instruction. |
| **`discharge` vs `discharges`** | `nav.ts` has a `planned` "Discharge operations" entry (`discharge`) alongside the implemented "Record unloading at destination" (`discharges`). These are *different* keys, so **both render** — the planned one appears as a "soon" item. | Not obviously a defect: it may be an intentional marker for a richer planned screen. Flagged for the owner; out of Phase 1 scope. |
| **REQ-001 six-vs-ten sections** | The sidebar does not have the employer's six top-level sections. Recorded as a documented deviation. | Deferred to Phase 9 by the roadmap (`requirements-traceability.md:134`). |
