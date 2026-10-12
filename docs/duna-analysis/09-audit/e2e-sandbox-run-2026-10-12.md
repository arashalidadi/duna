# Phase 1 review — sandbox test record, 2026-10-12

**What this is.** A dated record of what was actually executed in the build sandbox during the Phase 1
review, what passed, what failed and why, and what could not run. It separates evidence that is
reproducible here from evidence that still needs the owner's server.

**What this is not.** It is not the server baseline required by acceptance A4. That figure comes only
from `pnpm test:e2e-baseline` on the owner's server (see [`phase-1-testing.md`](phase-1-testing.md) §4.2).

---

## 1 · Environment (sandbox, not production)

| Item | Value |
| --- | --- |
| Repository state | Base commit `b0e2682`, plus the Phase 1 review changes committed on `arena/be9b4e5b-duna` |
| Database | Local, disposable PostgreSQL 16.14 (`duna_e2e`, `duna_seed_test`, `duna_demo_check`). No production data. |
| Migrations | Applied with a sandbox substitute script (`apply-migrations.cjs`), **not** `prisma migrate deploy`. Parity with the Prisma CLI is not independently verified. |
| Prisma engine | **WASM** query engine through `@prisma/adapter-pg`. The native engine could not be used: `binaries.prisma.sh` returned no response (`HTTP 000`) and the native library file in `node_modules` is a placeholder (`file too short`). |
| Node / pnpm | Node 22.22.3. pnpm 12.11.2 in the sandbox; the repo declares `pnpm >=9`. |
| Jest | Repo config `apps/api/test/jest-e2e.cjs`, extended by a **sandbox-only** config (`/tmp/duna-testenv/jest-e2e-wasm.cjs`, not committed). It maps `@prisma/client` to the WASM shim and needs `NODE_OPTIONS=--experimental-vm-modules`. The repo's Jest config was **not** changed. |
| Seed | `pnpm db:seed` with `SEED_DEMO_DATA` unset (required seed only), exit 0. |

**Caveat.** Results from the WASM engine are evidence about the code, the seed logic and the SQL. They
are not evidence about the production native engine.

---

## 2 · Executed and passed

| # | Test | Command / harness | Result |
| --- | --- | --- | --- |
| 1 | **All 22 API e2e suites, fresh DB, required seed only** | sandbox Jest config, `jest` on `apps/api/test` | **22/22 suites, 403/403 tests, exit 0**, 151.9 s |
| 2 | **Same suites, second run on the same DB** (re-runnable check) | same | **22/22 suites, 403/403 tests, exit 0**, 147.0 s |
| 3 | **Seed-safety runtime test** (A3) | `pnpm test:seed-safety` on `duna_seed_test`, final tree | **PASSED, exit 0**. Cargo, customer, vessel, voyage and load list were 0 before, after run 1 and after run 2. Permissions 161, roles 2, ports 2, yards 2, users 1, primary admins 1 (stable). Admin `admin@shipping.local` active, primary, role ADMIN. |
| 4 | **Positive control: demo gate is real** | `SEED_DEMO_DATA=true pnpm db:seed` on `duna_demo_check` (earlier turn) | Created Cargo 3, Customer 2, Vessel 1, Voyage 1, LoadList 1 with the loud demo warning printed. The same seed without the flag created none (test 3). |
| 5 | **Root `pnpm test` chain — packages and web guards** | `pnpm test` (root, after the script fix in §4) | `packages/config`: **10/10 tests passed**. `apps/web` guards: **contract OK**, **navigation OK** (39 items parsed; Agent Portal intact), **page-size OK**, **i18n OK** (2114 messages, 3 locales). |
| 6 | **Root `pnpm typecheck`** | `pnpm typecheck` | **exit 0**: `packages/config`, `packages/shared`, `apps/api` (includes `test/**`), `apps/web`. |
| 7 | Typecheck of the edited API test files | included in row 6 (`apps/api/tsconfig` includes `test/**/*.ts`) and by ts-jest during rows 1–2 | passed |

---

## 3 · Executed and failed (with cause and resolution)

### 3a · Fixture dependencies on demonstration rows (fixed)

On a fresh DB with **only the required seed**, the earlier suite code failed:

| Run | Suites | Tests | Failing | Cause |
| --- | --- | --- | --- | --- |
| Before fixture fix (`jest-full.log`) | 19 / 22 | 386 / 403 | 17 | `portal` (14 tests) needed `prisma.voyage.findFirst()`; `bill` (2) expected seeded `BOL-2609-00001/-00002`; `voyage` (1, backfill) expected legacy `VOY-24*` voyages. All three depended on demonstration rows. |
| After fixture fix (rows 1–2) | 22 / 22 | 403 / 403 | 0 | — |

Resolution: each of the three suites now creates its own fixture rows and removes them in
`afterAll` / `finally`. The `bill` legacy-format check asserts directly in the database instead of through
the paged list, because the list does not reliably include the fixture rows. The API create call and the
format check are kept. The related seed-dependency record is corrected in
[`seed-dependency-inventory.md`](seed-dependency-inventory.md).

### 3b · Harness failures (not product failures)

| Attempt | Result | Cause | Resolution |
| --- | --- | --- | --- |
| `pnpm test:e2e-baseline`, run 1 | 0 suites ran | `@shipping/config` and `@shipping/shared` `dist/` missing | root `pretest` script builds them |
| `pnpm test:e2e-baseline`, run 3 | 403 / 403 failed | native Prisma engine placeholder under Jest | sandbox-only WASM config; not a product failure |
| `app.e2e-spec` without the VM flag | 5 / 5 failed | `A dynamic import callback was invoked without --experimental-vm-modules` | run with `NODE_OPTIONS=--experimental-vm-modules` |

The two invalid baseline artifacts these runs produced were deleted. The recorder script was changed to
refuse a run that executes zero tests (exit 3, nothing written). It does **not** refuse a run where tests
fail. See §5.

### 3c · Root `pnpm test` — recursion bug in the repo (fixed)

The root script `"test": "pnpm run test -r"` calls itself. Each level appends another `-r`, so the command
never finishes. The same pattern is in `typecheck` and `lint`. I reproduced it under pnpm 12.11.2 and under
pnpm 9.15.9 (the declared minimum): under pnpm 9 it reached 118 levels in 30 seconds. Because of this, the
P0 criterion "`pnpm test` completes from a clean checkout" was **not** met before this review.

Fix (package.json): `test`, `typecheck` and `lint` changed to `pnpm -r run <script>`. This runs each
workspace package's script, which is the behaviour the old line intended. After the fix there were zero
recursion markers in the log.

Not changed in this review (same defect, outside the verified path): `build`, `start`, `test:watch`. The owner
should decide whether to apply the same one-line change.

### 3d · Root `pnpm test` — API part (not executed here)

After the fix, the root `pnpm test` completes. `packages/config` and the web guards pass. `apps/api` fails
at load because the Prisma native engine is a placeholder in this sandbox
(`PrismaClientInitializationError … file too short`). **No API e2e test was executed by this command.**
The API e2e tests were executed through the sandbox WASM harness (rows 1–2).

### 3e · Root `pnpm lint` — one pre-existing error (not fixed)

`pnpm lint` exits 1 with **1 error** and 34 warnings. The error is `prefer-const` at
`apps/api/src/modules/voyages/voyages.service.ts:333`. That code is unchanged since the base commit
`c997624`, and no file under `apps/api/src` or `apps/web/src` changed in this review. It is outside the Phase 1
scope, so it is reported rather than fixed.

### 3f · "Console" entries in Jest output (not failures)

Jest prints `● Console` blocks for `console.warn` output. These come from the config loader: it reports
that `APP_DEFAULT_CURRENCY` is not set and falls back to `"USD"`. The sandbox environment does not set that
variable. These entries are not failing tests.

---

## 4 · Residue after the suites

The suites clean up their business data. Counts measured after run 1 and after run 2:

| Table | After run 1 | After run 2 | Note |
| --- | --- | --- | --- |
| Vessel, Voyage, VoyageDestination, Cargo, Customer, bills_of_lading, LoadList, LoadListItem | 0 | 0 | business data removed |
| AuditLog | 268 | 536 | **not removed by the suites** |
| RefreshToken | 34 | 68 | **not removed by the suites** |
| NumberingSequence | 26 | 51 | **not removed by the suites** |
| Seed rows (Permission 161, Role 2, RolePermission 160, Port 2, Yard 2, User 1, UserRole 1, CompanySettings 1, Currency 2) | unchanged | unchanged | expected |

**Consequence:** the suites must run only against a disposable test database. Repeated runs add audit and
token rows that cannot be cleaned up by the suites themselves.

---

## 5 · Known limitation of the recorder

`scripts/record-e2e-baseline.ts` writes its artifact whenever Jest executes at least one test, **including
when tests fail**, so that the failures are recorded. Do not commit an artifact from a run you do not intend
to keep as the baseline. The zero-tests guard (exit 3) only protects against a run that executes nothing.

---

## 6 · Not executed, with reason

| Item | Reason | Where it can run |
| --- | --- | --- |
| Server baseline `pnpm test:e2e-baseline` on the owner's engine (A4) | No owner-server access from this sandbox. Native engine unavailable (`binaries.prisma.sh` no response). | Owner server, disposable test DB — see [`phase-1-testing.md`](phase-1-testing.md) §4.2 |
| `pnpm test:seed-safety` on the owner's server (A3, server copy) | As above. | Owner server, disposable test DB — see `phase-1-testing.md` §4.1 |
| Verified backup **and** restore (P0) | The PostgreSQL client tools (`pg_dump`, `pg_restore`) are not available in the sandbox, and there is no production DB access. Not claimed. | Owner server, with a dump of a disposable copy — see `phase-1-deployment-runbook.md` |
| API e2e through the **native** engine | Engine binary unavailable in the sandbox | Owner server |
| Browser / UI checks | No browser or reachable deployment. `dashboard.3ree.eu.cc` resolves in DNS but the HTTPS request returned no response from the sandbox (checked 2026-10-12). | Manual, after deployment — `phase-1-testing.md` §5 |
| Root `pnpm lint` passing | One pre-existing error (§3e) | Owner decision |
| `pnpm --filter @shipping/web test` run alone | Covered: it ran inside the root `pnpm test` (§2 row 5) | — |

---

## 7 · Files changed in this review (for the record)

Code and scripts: `package.json` (`pretest`, `test:seed-safety`, `test:e2e-baseline`, and the `test` /
`typecheck` / `lint` recursion fix), `scripts/record-e2e-baseline.ts`, `scripts/test-seed-safety.ts`,
`apps/api/test/portal.e2e-spec.ts`, `apps/api/test/voyage.e2e-spec.ts`, `apps/api/test/bill.e2e-spec.ts`.

Documentation (additive, dated): this file, `documented-deviations.md`, `seed-dependency-inventory.md`,
`phase-1-testing.md`, `phase-1-audit-2026-10-12.md`, `open-questions.md`, `question-reconciliation.md`,
`requirements-traceability.md`, and related dated notes listed in `phase-1-testing.md` §7.

Not committed (sandbox-only): `/tmp/duna-testenv/` (Prisma shim, WASM Jest config, environment files with
generated secrets, logs).
