# e2e baseline — 2026-10-15

**Recorded 2026-10-15T15:26:15.303Z** by `pnpm test:e2e-baseline`.

A real E2E measurement (the historical `403/403` figure in `initial-roadmap.md:74` was unverified).

| Field | Value |
| --- | --- |
| Date | 2026-10-15 |
| Command | `pnpm --filter @shipping/api run test --json --outputFile=<temporary Jest results file>` |
| Database | `localhost:5432/duna_seed_test` |
| Suites | 1 failed, 28 passed, 29 total |
| Tests | 3 failed, 545 passed, 548 total |
| Time | 76.67 s |
| Wall clock | 78.6s |
| Exit code | 1 |

## Verdict

**Failures present** (exit code 1).

## Data

Suites write test fixtures to the configured database. Cleanup is best-effort;
no schema reset or migration is performed by this command. This run targeted
`localhost:5432/duna_seed_test`.

## Suite results (all suites)

- **PASSED** `apps/api/test/voucher.e2e-spec.ts` — 0 failed, 14 passed, 14 total
- **PASSED** `apps/api/test/inspection.e2e-spec.ts` — 0 failed, 27 passed, 27 total
- **PASSED** `apps/api/test/delivery-release.e2e-spec.ts` — 0 failed, 19 passed, 19 total
- **PASSED** `apps/api/test/auth.e2e-spec.ts` — 0 failed, 19 passed, 19 total
- **PASSED** `apps/api/test/actual-loading.e2e-spec.ts` — 0 failed, 19 passed, 19 total
- **PASSED** `apps/api/test/discharge.e2e-spec.ts` — 0 failed, 22 passed, 22 total
- **PASSED** `apps/api/test/portal.e2e-spec.ts` — 0 failed, 14 passed, 14 total
- **PASSED** `apps/api/test/salary.e2e-spec.ts` — 0 failed, 9 passed, 9 total
- **PASSED** `apps/api/test/voyage.e2e-spec.ts` — 0 failed, 26 passed, 26 total
- **PASSED** `apps/api/test/bill.e2e-spec.ts` — 0 failed, 29 passed, 29 total
- **PASSED** `apps/api/test/letter.e2e-spec.ts` — 0 failed, 15 passed, 15 total
- **PASSED** `apps/api/test/manifest.e2e-spec.ts` — 0 failed, 32 passed, 32 total
- **PASSED** `apps/api/test/invoice.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/quotation.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/party-masters.e2e-spec.ts` — 0 failed, 37 passed, 37 total
- **PASSED** `apps/api/test/cargo-inventory.e2e-spec.ts` — 0 failed, 33 passed, 33 total
- **PASSED** `apps/api/test/proforma.e2e-spec.ts` — 0 failed, 9 passed, 9 total
- **PASSED** `apps/api/test/invoice-phase3.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **FAILED** `apps/api/test/portal-agent-isolation.e2e-spec.ts` — 3 failed, 0 passed, 3 total
- **PASSED** `apps/api/test/job.e2e-spec.ts` — 0 failed, 14 passed, 14 total
- **PASSED** `apps/api/test/portal-documents-read.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/delivery-release-cancellation.e2e-spec.ts` — 0 failed, 8 passed, 8 total
- **PASSED** `apps/api/test/portal-isolation-guard.e2e-spec.ts` — 0 failed, 3 passed, 3 total
- **PASSED** `apps/api/test/party-cutover.e2e-spec.ts` — 0 failed, 5 passed, 5 total
- **PASSED** `apps/api/test/master-data.e2e-spec.ts` — 0 failed, 26 passed, 26 total
- **PASSED** `apps/api/test/attachment-settings.e2e-spec.ts` — 0 failed, 18 passed, 18 total
- **PASSED** `apps/api/test/app.e2e-spec.ts` — 0 failed, 5 passed, 5 total
- **PASSED** `apps/api/test/numbering.e2e-spec.ts` — 0 failed, 83 passed, 83 total
- **PASSED** `apps/api/test/vessel.e2e-spec.ts` — 0 failed, 15 passed, 15 total

## Failed tests and full error messages

### `apps/api/test/portal-agent-isolation.e2e-spec.ts`

**Portal document isolation on an expressly confirmed real PostgreSQL test database separates D/E B/Ls, releases, manifests and counts through real relation filters**

```text
Error: Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened
    at portalIsolationTestDatabase (/home/duna/shipping-dashboard/new-erp/apps/api/test/support/portal-isolation-test-db.ts:13:11)
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/portal-agent-isolation.e2e-spec.ts:302:54)
    at Promise.then.completed (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:298:28)
    at new Promise (<anonymous>)
    at callAsyncCircusFn (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:231:10)
    at _callCircusHook (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:281:40)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:95:7)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:121:9)
    at run (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:71:3)
    at runAndTransformResultsToJestFormat (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)
    at jestAdapter (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)
    at runTestInternal (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/runTest.js:367:16)
    at runTest (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/runTest.js:444:34)
    at Object.worker (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/testWorker.js:106:12)
```

**Portal document isolation on an expressly confirmed real PostgreSQL test database denies anonymous, unpermitted, unlinked and inactive principals; customer-only is explicit**

```text
Error: Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened
    at portalIsolationTestDatabase (/home/duna/shipping-dashboard/new-erp/apps/api/test/support/portal-isolation-test-db.ts:13:11)
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/portal-agent-isolation.e2e-spec.ts:302:54)
    at Promise.then.completed (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:298:28)
    at new Promise (<anonymous>)
    at callAsyncCircusFn (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:231:10)
    at _callCircusHook (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:281:40)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:95:7)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:121:9)
    at run (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:71:3)
    at runAndTransformResultsToJestFormat (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)
    at jestAdapter (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)
    at runTestInternal (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/runTest.js:367:16)
    at runTest (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/runTest.js:444:34)
    at Object.worker (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/testWorker.js:106:12)
```

**Portal document isolation on an expressly confirmed real PostgreSQL test database refreshes destination visibility and active release state after fixture-only transitions**

```text
Error: Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened
    at portalIsolationTestDatabase (/home/duna/shipping-dashboard/new-erp/apps/api/test/support/portal-isolation-test-db.ts:13:11)
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/portal-agent-isolation.e2e-spec.ts:302:54)
    at Promise.then.completed (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:298:28)
    at new Promise (<anonymous>)
    at callAsyncCircusFn (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:231:10)
    at _callCircusHook (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:281:40)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:95:7)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:121:9)
    at run (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:71:3)
    at runAndTransformResultsToJestFormat (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)
    at jestAdapter (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)
    at runTestInternal (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/runTest.js:367:16)
    at runTest (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/runTest.js:444:34)
    at Object.worker (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-runner@29.7.0/node_modules/jest-runner/build/testWorker.js:106:12)
```

**Complete suite-level Jest message (may repeat test errors):**

```text
  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › separates D/E B/Ls, releases, manifests and counts through real relation filters

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › denies anonymous, unpermitted, unlinked and inactive principals; customer-only is explicit

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › refreshes destination visibility and active release state after fixture-only transitions

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)
```

## Captured run output (complete, not a tail)

Standard output and standard error are captured separately; their interleaving is not preserved.

### Standard output

```text

> @shipping/api@0.1.0 test /home/duna/shipping-dashboard/new-erp/apps/api
> jest --config test/jest-e2e.cjs --json --outputFile\=/tmp/duna-e2e-FK4tRd/jest-results.json

/home/duna/shipping-dashboard/new-erp/apps/api:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @shipping/api@0.1.0 test: `jest --config test/jest-e2e.cjs --json --outputFile\=/tmp/duna-e2e-FK4tRd/jest-results.json`
Exit status 1
```

### Standard error

```text
PASS test/voucher.e2e-spec.ts (31.328 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (voucher.e2e-spec.ts:5:1)

PASS test/inspection.e2e-spec.ts (37.185 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (inspection.e2e-spec.ts:4:1)

PASS test/delivery-release.e2e-spec.ts (38.508 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (delivery-release.e2e-spec.ts:4:1)

PASS test/auth.e2e-spec.ts (38.727 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (auth.e2e-spec.ts:4:1)

PASS test/actual-loading.e2e-spec.ts (43.719 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (actual-loading.e2e-spec.ts:4:1)

    console.log
      prisma:error 
      Invalid `tx.actualLoading.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/actual-loading/actual-loading.service.ts:283:33
      
        280 // number allocation and the nested items commit or roll back together. A loadListItemId
        281 // unique collision rolls the number back too and falls through to the 409 path.
        282 // Mirrors Discharge.create()'s nested `items: { create: [...] }` shape.
      → 283 return tx.actualLoading.create(
      Unique constraint failed on the fields: (`loadListId`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      prisma:error 
      Invalid `tx.actualLoading.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/actual-loading/actual-loading.service.ts:283:33
      
        280 // number allocation and the nested items commit or roll back together. A loadListItemId
        281 // unique collision rolls the number back too and falls through to the 409 path.
        282 // Mirrors Discharge.create()'s nested `items: { create: [...] }` shape.
      → 283 return tx.actualLoading.create(
      Unique constraint failed on the fields: (`loadListId`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

PASS test/discharge.e2e-spec.ts (18.031 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (discharge.e2e-spec.ts:4:1)

PASS test/portal.e2e-spec.ts (12.611 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (portal.e2e-spec.ts:4:1)

PASS test/salary.e2e-spec.ts (13.768 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (salary.e2e-spec.ts:4:1)

    console.log
      prisma:error 
      Invalid `this.prisma.employee.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/salary/employee.service.ts:95:50
      
        92 async create(dto: CreateEmployeeDto, actor?: AuthenticatedUser) {
        93   const code = dto.code?.trim() || (await this.generateCode());
        94   try {
      → 95     const created = await this.prisma.employee.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

PASS test/voyage.e2e-spec.ts (17.163 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (voyage.e2e-spec.ts:4:1)

PASS test/bill.e2e-spec.ts (55.151 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (bill.e2e-spec.ts:4:1)

PASS test/letter.e2e-spec.ts (11.665 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (letter.e2e-spec.ts:4:1)

PASS test/manifest.e2e-spec.ts (60.718 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (manifest.e2e-spec.ts:4:1)

    console.log
      prisma:error 
      Invalid `tx.manifest.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/manifest/manifest.service.ts:373:48
      
        370 // 3. Create the manifest with the per-destination number allocated above
        371 // (ADR-047 d7). A consolidated manifest has no header-level parties — each line
        372 // carries its own (ADR-047 d4; distinct summary + validation land in U3).
      → 373 const manifest = await tx.manifest.create(
      Unique constraint failed on the fields: (`manifestNumber`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

PASS test/invoice.e2e-spec.ts (14.822 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (invoice.e2e-spec.ts:4:1)

PASS test/quotation.e2e-spec.ts (14.123 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (quotation.e2e-spec.ts:4:1)

PASS test/party-masters.e2e-spec.ts (13.596 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (party-masters.e2e-spec.ts:4:1)

    console.log
      prisma:error 
      Invalid `this.prisma.shipper.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/shippers/shippers.service.ts:73:40
      
        70 
        71 async create(dto: CreateShipperDto) {
        72   try {
      → 73     return await this.prisma.shipper.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      [shippers] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/shippers/cmv9oy42p005u4q7iofd0rzbi","timestamp":"2026-10-15T15:26:01.308Z"},"meta":{"timestamp":"2026-10-15T15:26:01.308Z"}}

      at Object.<anonymous> (party-masters.e2e-spec.ts:504:19)

    console.log
      prisma:error 
      Invalid `this.prisma.consignee.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/consignees/consignees.service.ts:77:42
      
        74 
        75 async create(dto: CreateConsigneeDto) {
        76   try {
      → 77     return await this.prisma.consignee.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      [consignees] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/consignees/cmv9oy55p005x4q7i3fym97d3","timestamp":"2026-10-15T15:26:02.876Z"},"meta":{"timestamp":"2026-10-15T15:26:02.876Z"}}

      at Object.<anonymous> (party-masters.e2e-spec.ts:504:19)

    console.log
      prisma:error 
      Invalid `this.prisma.agent.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/agents/agents.service.ts:91:38
      
        88 
        89 async create(dto: CreateAgentDto) {
        90   try {
      → 91     return await this.prisma.agent.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      [agents] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/agents/cmv9oy6c500604q7ig664pyih","timestamp":"2026-10-15T15:26:04.310Z"},"meta":{"timestamp":"2026-10-15T15:26:04.310Z"}}

      at Object.<anonymous> (party-masters.e2e-spec.ts:504:19)

    console.log
      prisma:error 
      Invalid `this.prisma.agentDestination.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/agents/agents.service.ts:186:49
      
        183 async createDestination(agentId: string, dto: CreateAgentDestinationDto) {
        184   await this.findById(agentId);
        185   try {
      → 186     return await this.prisma.agentDestination.create(
      Unique constraint failed on the fields: (`agentId`,`portId`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      prisma:error 
      Invalid `this.prisma.agentDestination.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/agents/agents.service.ts:186:49
      
        183 async createDestination(agentId: string, dto: CreateAgentDestinationDto) {
        184   await this.findById(agentId);
        185   try {
      → 186     return await this.prisma.agentDestination.create(
      Foreign key constraint violated: `agent_destinations_portId_fkey (index)`

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      [B3] nonexistent portId response: 400 {"success":false,"error":{"statusCode":400,"message":"Database operation failed: P2003","error":"Database Error","path":"/api/v1/agents/cmv9oxzmk005g4q7iihy8vzqe/destinations","timestamp":"2026-10-15T15:26:04.954Z","details":{"modelName":"AgentDestination","field_name":"agent_destinations_portId_fkey (index)"}},"meta":{"timestamp":"2026-10-15T15:26:04.954Z"}}

      at Object.<anonymous> (party-masters.e2e-spec.ts:642:17)

    console.log
      [party-masters] global counts pre-suite: {"shippers":4,"consignees":3,"agents":2,"ports":8,"destinations":2,"roles":52,"users":49}

      at Object.<anonymous> (party-masters.e2e-spec.ts:237:15)

    console.log
      [party-masters] global counts post-cleanup (context only): {"shippers":1,"consignees":1,"agents":2,"ports":4,"destinations":2,"roles":44,"users":41}

      at Object.<anonymous> (party-masters.e2e-spec.ts:238:15)

PASS test/cargo-inventory.e2e-spec.ts (11.085 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (cargo-inventory.e2e-spec.ts:4:1)

    console.log
      prisma:error 
      Invalid `tx.yardInventory.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/yard-inventory/yard-inventory.service.ts:131:50
      
        128 return await this.prisma.$transaction(async (tx) => {
        129   // Re-check for an existing current record inside the transaction won't
        130   // protect against two inserts racing; the unique constraint is the guard.
      → 131   const createdId = await tx.yardInventory.create(
      Unique constraint failed on the fields: (`cargoId`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

PASS test/proforma.e2e-spec.ts (13.203 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (proforma.e2e-spec.ts:4:1)

PASS test/invoice-phase3.e2e-spec.ts (13.248 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (invoice-phase3.e2e-spec.ts:4:1)

FAIL test/portal-agent-isolation.e2e-spec.ts
  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › separates D/E B/Ls, releases, manifests and counts through real relation filters

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › denies anonymous, unpermitted, unlinked and inactive principals; customer-only is explicit

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › refreshes destination visibility and active release state after fixture-only transitions

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

PASS test/job.e2e-spec.ts (8.853 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (job.e2e-spec.ts:4:1)

PASS test/portal-documents-read.e2e-spec.ts
PASS test/delivery-release-cancellation.e2e-spec.ts
PASS test/portal-isolation-guard.e2e-spec.ts
PASS test/party-cutover.e2e-spec.ts
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (party-cutover.e2e-spec.ts:4:1)

PASS test/master-data.e2e-spec.ts (6.111 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (master-data.e2e-spec.ts:4:1)

    console.log
      prisma:error 
      Invalid `this.prisma.customer.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/customers/customers.service.ts:78:33
      
        75 }
        76 
        77 create(dto: CreateCustomerDto) {
      → 78   return this.prisma.customer.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      prisma:error 
      Invalid `this.prisma.port.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/ports/ports.service.ts:91:37
      
        88 
        89 async create(dto: CreatePortDto) {
        90   try {
      → 91     return await this.prisma.port.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      prisma:error 
      Invalid `this.prisma.port.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/ports/ports.service.ts:91:37
      
        88 
        89 async create(dto: CreatePortDto) {
        90   try {
      → 91     return await this.prisma.port.create(
      Unique constraint failed on the fields: (`abbreviation`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

PASS test/attachment-settings.e2e-spec.ts (6.791 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (attachment-settings.e2e-spec.ts:4:1)

PASS test/app.e2e-spec.ts
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (app.e2e-spec.ts:4:1)

PASS test/numbering.e2e-spec.ts (6.009 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (numbering.e2e-spec.ts:3:1)

PASS test/vessel.e2e-spec.ts (10.277 s)
  ● Console

    console.warn
      [config] Environment variable API_VERSION not set, using default "1"

      43 | const toNumberOptional = (value, fallback, name) => {
      44 |     if (value === undefined || value === '') {
    > 45 |         console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
         |                 ^
      46 |         return fallback;
      47 |     }
      48 |     const parsed = Number(value);

      at toNumberOptional (../../../packages/config/dist/load-config.js:45:17)
      at loadConfig (../../../packages/config/dist/load-config.js:92:25)
      at Object.<anonymous> (../src/config/config.factory.ts:27:26)
      at Object.<anonymous> (../src/app.module.ts:4:1)
      at Object.<anonymous> (vessel.e2e-spec.ts:5:1)

    console.log
      prisma:error 
      Invalid `this.prisma.vessel.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/vessels/vessels.service.ts:86:39
      
        83 
        84 async create(dto: CreateVesselDto) {
        85   try {
      → 86     return await this.prisma.vessel.create(
      Unique constraint failed on the fields: (`code`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)

    console.log
      prisma:error 
      Invalid `this.prisma.vessel.create()` invocation in
      /home/duna/shipping-dashboard/new-erp/apps/api/src/modules/vessels/vessels.service.ts:86:39
      
        83 
        84 async create(dto: CreateVesselDto) {
        85   try {
      → 86     return await this.prisma.vessel.create(
      Unique constraint failed on the fields: (`imo`)

      at Object.mc (../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/runtime/library.js:21:432)


Summary of all failing tests
FAIL ./portal-agent-isolation.e2e-spec.ts
  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › separates D/E B/Ls, releases, manifests and counts through real relation filters

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › denies anonymous, unpermitted, unlinked and inactive principals; customer-only is explicit

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)

  ● Portal document isolation on an expressly confirmed real PostgreSQL test database › refreshes destination visibility and active release state after fixture-only transitions

    Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, PORTAL_ISOLATION_TEST_DATABASE_NAME and PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened

      11 |
      12 |   if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    > 13 |     throw new Error(
         |           ^
      14 |       'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
      15 |         'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
      16 |         'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'

      at portalIsolationTestDatabase (support/portal-isolation-test-db.ts:13:11)
      at Object.<anonymous> (portal-agent-isolation.e2e-spec.ts:302:54)


Test Suites: 1 failed, 28 passed, 29 total
Tests:       3 failed, 545 passed, 548 total
Snapshots:   0 total
Time:        76.67 s
Ran all test suites.
Test results written to: ../../../../../../tmp/duna-e2e-FK4tRd/jest-results.json
```

