# e2e baseline — 2026-10-15

**Recorded 2026-10-15T14:32:08.890Z** by `pnpm test:e2e-baseline`.

A real E2E measurement (the historical `403/403` figure in `initial-roadmap.md:74` was unverified).

| Field | Value |
| --- | --- |
| Date | 2026-10-15 |
| Command | `pnpm --filter @shipping/api run test --json --outputFile=<temporary Jest results file>` |
| Database | `localhost:5432/duna_seed_test` |
| Suites | 3 failed, 26 passed, 29 total |
| Tests | 9 failed, 539 passed, 548 total |
| Time | 76.298 s, estimated 102 s |
| Wall clock | 78.1s |
| Exit code | 1 |

## Verdict

**Failures present** (exit code 1).

## Data

Suites write test fixtures to the configured database. Cleanup is best-effort;
no schema reset or migration is performed by this command. This run targeted
`localhost:5432/duna_seed_test`.

## Suite results (all suites)

- **FAILED** `apps/api/test/numbering.e2e-spec.ts` — 1 failed, 82 passed, 83 total
- **FAILED** `apps/api/test/vessel.e2e-spec.ts` — 1 failed, 14 passed, 15 total
- **FAILED** `apps/api/test/voucher.e2e-spec.ts` — 7 failed, 7 passed, 14 total
- **PASSED** `apps/api/test/inspection.e2e-spec.ts` — 0 failed, 27 passed, 27 total
- **PASSED** `apps/api/test/actual-loading.e2e-spec.ts` — 0 failed, 19 passed, 19 total
- **PASSED** `apps/api/test/delivery-release.e2e-spec.ts` — 0 failed, 19 passed, 19 total
- **PASSED** `apps/api/test/voyage.e2e-spec.ts` — 0 failed, 26 passed, 26 total
- **PASSED** `apps/api/test/party-masters.e2e-spec.ts` — 0 failed, 37 passed, 37 total
- **PASSED** `apps/api/test/auth.e2e-spec.ts` — 0 failed, 19 passed, 19 total
- **PASSED** `apps/api/test/bill.e2e-spec.ts` — 0 failed, 29 passed, 29 total
- **PASSED** `apps/api/test/proforma.e2e-spec.ts` — 0 failed, 9 passed, 9 total
- **PASSED** `apps/api/test/invoice.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/manifest.e2e-spec.ts` — 0 failed, 32 passed, 32 total
- **PASSED** `apps/api/test/invoice-phase3.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/discharge.e2e-spec.ts` — 0 failed, 22 passed, 22 total
- **PASSED** `apps/api/test/quotation.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/portal.e2e-spec.ts` — 0 failed, 14 passed, 14 total
- **PASSED** `apps/api/test/attachment-settings.e2e-spec.ts` — 0 failed, 18 passed, 18 total
- **PASSED** `apps/api/test/letter.e2e-spec.ts` — 0 failed, 15 passed, 15 total
- **PASSED** `apps/api/test/master-data.e2e-spec.ts` — 0 failed, 26 passed, 26 total
- **PASSED** `apps/api/test/job.e2e-spec.ts` — 0 failed, 14 passed, 14 total
- **PASSED** `apps/api/test/portal-agent-isolation.e2e-spec.ts` — 0 failed, 3 passed, 3 total
- **PASSED** `apps/api/test/portal-isolation-guard.e2e-spec.ts` — 0 failed, 3 passed, 3 total
- **PASSED** `apps/api/test/portal-documents-read.e2e-spec.ts` — 0 failed, 11 passed, 11 total
- **PASSED** `apps/api/test/delivery-release-cancellation.e2e-spec.ts` — 0 failed, 8 passed, 8 total
- **PASSED** `apps/api/test/salary.e2e-spec.ts` — 0 failed, 9 passed, 9 total
- **PASSED** `apps/api/test/party-cutover.e2e-spec.ts` — 0 failed, 5 passed, 5 total
- **PASSED** `apps/api/test/cargo-inventory.e2e-spec.ts` — 0 failed, 33 passed, 33 total
- **PASSED** `apps/api/test/app.e2e-spec.ts` — 0 failed, 5 passed, 5 total

## Failed tests and full error messages

### `apps/api/test/numbering.e2e-spec.ts`

**Document numbering (e2e) catalogue: every periodic document type has a unique sequence family**

```text
Error: expect(received).toHaveLength(expected)

Expected length: 12
Received length: 13
Received array:  ["INVOICE", "PROFORMA", "QUOTATION", "GENERAL_JOURNAL", "VOUCHER_RECEIPT", "VOUCHER_PAYMENT", "CARGO", "INSPECTION", "LOAD_LIST", "ACTUAL_LOADING", …]
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/numbering.e2e-spec.ts:63:18)
    at Promise.then.completed (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:298:28)
    at new Promise (<anonymous>)
    at callAsyncCircusFn (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/utils.js:231:10)
    at _callCircusTest (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:316:40)
    at _runTest (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:252:3)
    at _runTestsForDescribeBlock (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/jest-circus@29.7.0/node_modules/jest-circus/build/run.js:126:9)
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
  ● Document numbering (e2e) › catalogue: every periodic document type has a unique sequence family

    expect(received).toHaveLength(expected)

    Expected length: 12
    Received length: 13
    Received array:  ["INVOICE", "PROFORMA", "QUOTATION", "GENERAL_JOURNAL", "VOUCHER_RECEIPT", "VOUCHER_PAYMENT", "CARGO", "INSPECTION", "LOAD_LIST", "ACTUAL_LOADING", …]

      61 |     const families = KEYS.map((key) => PERIODIC_DOCUMENT_FORMATS[key].sequenceFamily);
      62 |     expect(new Set(families).size).toBe(KEYS.length);
    > 63 |     expect(KEYS).toHaveLength(12);
         |                  ^
      64 |   });
      65 |
      66 |   it.each(KEYS)('%s: request uses the printed code, period YYYYMM and five-digit padding', (key) => {

      at Object.<anonymous> (numbering.e2e-spec.ts:63:18)
```

### `apps/api/test/vessel.e2e-spec.ts`

**Vessel (e2e) rejects duplicate IMO (409) and invalid IMO format (400)**

```text
Error: expected 201 "Created", got 409 "Conflict"
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/vessel.e2e-spec.ts:218:8)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
----
    at Test._assertStatus (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:309:14)
    at /home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:365:13
    at Test._assertFunction (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:342:13)
    at Test.assert (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:195:23)
    at localAssert (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:138:14)
    at Server.<anonymous> (/home/duna/shipping-dashboard/new-erp/node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:152:11)
    at Server.wrapper (node:events:639:12)
    at Server.emit (node:events:514:20)
    at emitCloseNT (node:net:2879:8)
    at processTicksAndRejections (node:internal/process/task_queues:89:21)
```

**Complete suite-level Jest message (may repeat test errors):**

```text
  ● Vessel (e2e) › rejects duplicate IMO (409) and invalid IMO format (400)

    expected 201 "Created", got 409 "Conflict"

      216 |       .set(auth(adminToken))
      217 |       .send({ ...vesselBase(), code: `VES2-${tag}`, imo: '1234567' })
    > 218 |       .expect(201);
          |        ^
      219 |     createdVessels.push({ id: first.body.data.id });
      220 |
      221 |     await request(app.getHttpServer())

      at Object.<anonymous> (vessel.e2e-spec.ts:218:8)
      ----
      at Test._assertStatus (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:309:14)
      at ../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:365:13
      at Test._assertFunction (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:342:13)
      at Test.assert (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:195:23)
      at localAssert (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:138:14)
      at Server.<anonymous> (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:152:11)
```

### `apps/api/test/voucher.e2e-spec.ts`

**Vouchers & Ledger (e2e) creates a standalone RECEIPT (no invoice) — deposit with own number**

```text
Error: expect(received).toBeNull()

Received: "cmv9mztg1000m8slsmw70l6ek"
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:259:37)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Vouchers & Ledger (e2e) allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "25.00"
Received: "25"
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:283:65)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Vouchers & Ledger (e2e) creates a PAYMENT (refund) decreasing paidAmount; PMT numbering**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: 300
Received: 350
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:309:46)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Vouchers & Ledger (e2e) lists with type & invoice filters; detail returns serialized rows**

```text
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 1

  Array [
    "cmv9mzuas001h8slsqlbj897h",
+   "cmv9mzumb001p8slsdn543180",
    "cmv9mzv67002j8slsrf8dz11w",
  ]
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:322:18)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Vouchers & Ledger (e2e) freezes posted financial fields; explicit adjustment and reallocation leave audited history**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 450
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:354:46)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Vouchers & Ledger (e2e) cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: 500
Received: 550
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:373:46)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Vouchers & Ledger (e2e) delete: neither POSTED nor CANCELLED financial history may be erased**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: 500
Received: 550
    at Object.<anonymous> (/home/duna/shipping-dashboard/new-erp/apps/api/test/voucher.e2e-spec.ts:386:46)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

**Complete suite-level Jest message (may repeat test errors):**

```text
  ● Vouchers & Ledger (e2e) › creates a standalone RECEIPT (no invoice) — deposit with own number

    expect(received).toBeNull()

    Received: "cmv9mztg1000m8slsmw70l6ek"

      257 |     standaloneId = res.body.data.id;
      258 |     expect(res.body.data.voucherNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    > 259 |     expect(res.body.data.invoiceId).toBeNull();
          |                                     ^
      260 |   });
      261 |
      262 |   it('allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:259:37)

  ● Vouchers & Ledger (e2e) › allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation

    expect(received).toBe(expected) // Object.is equality

    Expected: "25.00"
    Received: "25"

      281 |     expect(posted.body.data.unallocatedAmount).toBe('45.00');
      282 |     expect((await request(app.getHttpServer()).get(`/api/v1/invoices/${first}`)
    > 283 |       .set(auth(adminToken)).expect(200)).body.data.paidAmount).toBe('25.00');
          |                                                                 ^
      284 |     const reallocated = await request(app.getHttpServer())
      285 |       .post(`/api/v1/vouchers/${posted.body.data.id}/allocations`).set(auth(adminToken))
      286 |       .send({ reason: 'Correct fixture split', allocations: [

      at Object.<anonymous> (voucher.e2e-spec.ts:283:65)

  ● Vouchers & Ledger (e2e) › creates a PAYMENT (refund) decreasing paidAmount; PMT numbering

    expect(received).toBe(expected) // Object.is equality

    Expected: 300
    Received: 350

      307 |
      308 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 309 |     expect(Number(inv.body.data.paidAmount)).toBe(300);
          |                                              ^
      310 |   });
      311 |
      312 |   it('lists with type & invoice filters; detail returns serialized rows', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:309:46)

  ● Vouchers & Ledger (e2e) › lists with type & invoice filters; detail returns serialized rows

    expect(received).toEqual(expected) // deep equality

    - Expected  - 0
    + Received  + 1

      Array [
        "cmv9mzuas001h8slsqlbj897h",
    +   "cmv9mzumb001p8slsdn543180",
        "cmv9mzv67002j8slsrf8dz11w",
      ]

      320 |     const byInvoice = await request(app.getHttpServer()).get(`/api/v1/vouchers?invoiceId=${invoiceId}&pageSize=100`).set(auth(adminToken)).expect(200);
      321 |     const nums = byInvoice.body.data.data.map((v: { id: string }) => v.id).sort();
    > 322 |     expect(nums).toEqual([pmt1Id, rcp1Id].sort());
          |                  ^
      323 |
      324 |     const one = await request(app.getHttpServer()).get(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(200);
      325 |     expect(one.body.data.customer.name).toContain('VCH Co');

      at Object.<anonymous> (voucher.e2e-spec.ts:322:18)

  ● Vouchers & Ledger (e2e) › freezes posted financial fields; explicit adjustment and reallocation leave audited history

    expect(received).toBe(expected) // Object.is equality

    Expected: 400
    Received: 450

      352 |     expect(after.body.data.unallocatedAmount).toBe('0.00');
      353 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 354 |     expect(Number(inv.body.data.paidAmount)).toBe(400); // 500 receipt - 100 refund
          |                                              ^
      355 |   });
      356 |
      357 |   it('cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:354:46)

  ● Vouchers & Ledger (e2e) › cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 550

      371 |
      372 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 373 |     expect(Number(inv.body.data.paidAmount)).toBe(500);
          |                                              ^
      374 |
      375 |     await request(app.getHttpServer())
      376 |       .post(`/api/v1/vouchers/${pmt1Id}/cancel`)

      at Object.<anonymous> (voucher.e2e-spec.ts:373:46)

  ● Vouchers & Ledger (e2e) › delete: neither POSTED nor CANCELLED financial history may be erased

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 550

      384 |     await request(app.getHttpServer()).delete(`/api/v1/vouchers/${pmt1Id}`).set(auth(adminToken)).expect(409);
      385 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 386 |     expect(Number(inv.body.data.paidAmount)).toBe(500);
          |                                              ^
      387 |   });
      388 |
      389 |   it('ledger: statement with opening/running/closing balance (mixed currency summed)', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:386:46)
```

## Captured run output (complete, not a tail)

Standard output and standard error are captured separately; their interleaving is not preserved.

### Standard output

```text

> @shipping/api@0.1.0 test /home/duna/shipping-dashboard/new-erp/apps/api
> jest --config test/jest-e2e.cjs --json --outputFile\=/tmp/duna-e2e-Prryyt/jest-results.json

/home/duna/shipping-dashboard/new-erp/apps/api:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @shipping/api@0.1.0 test: `jest --config test/jest-e2e.cjs --json --outputFile\=/tmp/duna-e2e-Prryyt/jest-results.json`
Exit status 1
```

### Standard error

```text
FAIL test/numbering.e2e-spec.ts (23.937 s)
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

  ● Document numbering (e2e) › catalogue: every periodic document type has a unique sequence family

    expect(received).toHaveLength(expected)

    Expected length: 12
    Received length: 13
    Received array:  ["INVOICE", "PROFORMA", "QUOTATION", "GENERAL_JOURNAL", "VOUCHER_RECEIPT", "VOUCHER_PAYMENT", "CARGO", "INSPECTION", "LOAD_LIST", "ACTUAL_LOADING", …]

      61 |     const families = KEYS.map((key) => PERIODIC_DOCUMENT_FORMATS[key].sequenceFamily);
      62 |     expect(new Set(families).size).toBe(KEYS.length);
    > 63 |     expect(KEYS).toHaveLength(12);
         |                  ^
      64 |   });
      65 |
      66 |   it.each(KEYS)('%s: request uses the printed code, period YYYYMM and five-digit padding', (key) => {

      at Object.<anonymous> (numbering.e2e-spec.ts:63:18)

FAIL test/vessel.e2e-spec.ts (28.579 s)
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
      at Object.<anonymous> (vessel.e2e-spec.ts:4:1)

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

  ● Vessel (e2e) › rejects duplicate IMO (409) and invalid IMO format (400)

    expected 201 "Created", got 409 "Conflict"

      216 |       .set(auth(adminToken))
      217 |       .send({ ...vesselBase(), code: `VES2-${tag}`, imo: '1234567' })
    > 218 |       .expect(201);
          |        ^
      219 |     createdVessels.push({ id: first.body.data.id });
      220 |
      221 |     await request(app.getHttpServer())

      at Object.<anonymous> (vessel.e2e-spec.ts:218:8)
      ----
      at Test._assertStatus (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:309:14)
      at ../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:365:13
      at Test._assertFunction (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:342:13)
      at Test.assert (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:195:23)
      at localAssert (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:138:14)
      at Server.<anonymous> (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:152:11)

FAIL test/voucher.e2e-spec.ts (30.946 s)
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
      at Object.<anonymous> (voucher.e2e-spec.ts:4:1)

  ● Vouchers & Ledger (e2e) › creates a standalone RECEIPT (no invoice) — deposit with own number

    expect(received).toBeNull()

    Received: "cmv9mztg1000m8slsmw70l6ek"

      257 |     standaloneId = res.body.data.id;
      258 |     expect(res.body.data.voucherNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    > 259 |     expect(res.body.data.invoiceId).toBeNull();
          |                                     ^
      260 |   });
      261 |
      262 |   it('allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:259:37)

  ● Vouchers & Ledger (e2e) › allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation

    expect(received).toBe(expected) // Object.is equality

    Expected: "25.00"
    Received: "25"

      281 |     expect(posted.body.data.unallocatedAmount).toBe('45.00');
      282 |     expect((await request(app.getHttpServer()).get(`/api/v1/invoices/${first}`)
    > 283 |       .set(auth(adminToken)).expect(200)).body.data.paidAmount).toBe('25.00');
          |                                                                 ^
      284 |     const reallocated = await request(app.getHttpServer())
      285 |       .post(`/api/v1/vouchers/${posted.body.data.id}/allocations`).set(auth(adminToken))
      286 |       .send({ reason: 'Correct fixture split', allocations: [

      at Object.<anonymous> (voucher.e2e-spec.ts:283:65)

  ● Vouchers & Ledger (e2e) › creates a PAYMENT (refund) decreasing paidAmount; PMT numbering

    expect(received).toBe(expected) // Object.is equality

    Expected: 300
    Received: 350

      307 |
      308 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 309 |     expect(Number(inv.body.data.paidAmount)).toBe(300);
          |                                              ^
      310 |   });
      311 |
      312 |   it('lists with type & invoice filters; detail returns serialized rows', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:309:46)

  ● Vouchers & Ledger (e2e) › lists with type & invoice filters; detail returns serialized rows

    expect(received).toEqual(expected) // deep equality

    - Expected  - 0
    + Received  + 1

      Array [
        "cmv9mzuas001h8slsqlbj897h",
    +   "cmv9mzumb001p8slsdn543180",
        "cmv9mzv67002j8slsrf8dz11w",
      ]

      320 |     const byInvoice = await request(app.getHttpServer()).get(`/api/v1/vouchers?invoiceId=${invoiceId}&pageSize=100`).set(auth(adminToken)).expect(200);
      321 |     const nums = byInvoice.body.data.data.map((v: { id: string }) => v.id).sort();
    > 322 |     expect(nums).toEqual([pmt1Id, rcp1Id].sort());
          |                  ^
      323 |
      324 |     const one = await request(app.getHttpServer()).get(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(200);
      325 |     expect(one.body.data.customer.name).toContain('VCH Co');

      at Object.<anonymous> (voucher.e2e-spec.ts:322:18)

  ● Vouchers & Ledger (e2e) › freezes posted financial fields; explicit adjustment and reallocation leave audited history

    expect(received).toBe(expected) // Object.is equality

    Expected: 400
    Received: 450

      352 |     expect(after.body.data.unallocatedAmount).toBe('0.00');
      353 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 354 |     expect(Number(inv.body.data.paidAmount)).toBe(400); // 500 receipt - 100 refund
          |                                              ^
      355 |   });
      356 |
      357 |   it('cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:354:46)

  ● Vouchers & Ledger (e2e) › cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 550

      371 |
      372 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 373 |     expect(Number(inv.body.data.paidAmount)).toBe(500);
          |                                              ^
      374 |
      375 |     await request(app.getHttpServer())
      376 |       .post(`/api/v1/vouchers/${pmt1Id}/cancel`)

      at Object.<anonymous> (voucher.e2e-spec.ts:373:46)

  ● Vouchers & Ledger (e2e) › delete: neither POSTED nor CANCELLED financial history may be erased

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 550

      384 |     await request(app.getHttpServer()).delete(`/api/v1/vouchers/${pmt1Id}`).set(auth(adminToken)).expect(409);
      385 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 386 |     expect(Number(inv.body.data.paidAmount)).toBe(500);
          |                                              ^
      387 |   });
      388 |
      389 |   it('ledger: statement with opening/running/closing balance (mixed currency summed)', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:386:46)

PASS test/inspection.e2e-spec.ts (37.427 s)
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

PASS test/actual-loading.e2e-spec.ts (44.034 s)
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

PASS test/delivery-release.e2e-spec.ts (20.172 s)
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

PASS test/voyage.e2e-spec.ts (16.864 s)
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

PASS test/party-masters.e2e-spec.ts (12.315 s)
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
      [shippers] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/shippers/cmv9n07bb0058itrvtqa5xhfn","timestamp":"2026-10-15T14:31:39.614Z"},"meta":{"timestamp":"2026-10-15T14:31:39.614Z"}}

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
      [consignees] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/consignees/cmv9n08h4005bitrvsuz7nkim","timestamp":"2026-10-15T14:31:41.034Z"},"meta":{"timestamp":"2026-10-15T14:31:41.034Z"}}

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
      [agents] A7 PATCH {code} response: 400 {"success":false,"error":{"statusCode":400,"message":["property code should not exist"],"error":"Bad Request","path":"/api/v1/agents/cmv9n09h3005eitrvv5jb0jfw","timestamp":"2026-10-15T14:31:42.443Z"},"meta":{"timestamp":"2026-10-15T14:31:42.443Z"}}

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
      [B3] nonexistent portId response: 400 {"success":false,"error":{"statusCode":400,"message":"Database operation failed: P2003","error":"Database Error","path":"/api/v1/agents/cmv9n03lp004uitrvfxrx9aa2/destinations","timestamp":"2026-10-15T14:31:42.979Z","details":{"modelName":"AgentDestination","field_name":"agent_destinations_portId_fkey (index)"}},"meta":{"timestamp":"2026-10-15T14:31:42.979Z"}}

      at Object.<anonymous> (party-masters.e2e-spec.ts:642:17)

    console.log
      [party-masters] global counts pre-suite: {"shippers":5,"consignees":3,"agents":2,"ports":14,"destinations":2,"roles":56,"users":53}

      at Object.<anonymous> (party-masters.e2e-spec.ts:237:15)

    console.log
      [party-masters] global counts post-cleanup (context only): {"shippers":4,"consignees":3,"agents":2,"ports":7,"destinations":2,"roles":48,"users":44}

      at Object.<anonymous> (party-masters.e2e-spec.ts:238:15)

PASS test/auth.e2e-spec.ts (20.786 s)
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

PASS test/bill.e2e-spec.ts (53.894 s)
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

PASS test/proforma.e2e-spec.ts (12.132 s)
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

PASS test/invoice.e2e-spec.ts (13.479 s)
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

PASS test/manifest.e2e-spec.ts (60.576 s)
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

PASS test/invoice-phase3.e2e-spec.ts (11.938 s)
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

PASS test/discharge.e2e-spec.ts (18.206 s)
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

PASS test/quotation.e2e-spec.ts (12.758 s)
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

PASS test/portal.e2e-spec.ts (13.929 s)
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

PASS test/attachment-settings.e2e-spec.ts (8.534 s)
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

PASS test/letter.e2e-spec.ts (13.653 s)
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

PASS test/master-data.e2e-spec.ts (7.461 s)
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

PASS test/job.e2e-spec.ts (9.923 s)
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

PASS test/portal-agent-isolation.e2e-spec.ts
PASS test/portal-isolation-guard.e2e-spec.ts
PASS test/portal-documents-read.e2e-spec.ts
PASS test/delivery-release-cancellation.e2e-spec.ts
PASS test/salary.e2e-spec.ts (15.502 s)
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

PASS test/party-cutover.e2e-spec.ts (5.267 s)
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

PASS test/cargo-inventory.e2e-spec.ts (11.55 s)
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


Summary of all failing tests
FAIL ./numbering.e2e-spec.ts (23.937 s)
  ● Document numbering (e2e) › catalogue: every periodic document type has a unique sequence family

    expect(received).toHaveLength(expected)

    Expected length: 12
    Received length: 13
    Received array:  ["INVOICE", "PROFORMA", "QUOTATION", "GENERAL_JOURNAL", "VOUCHER_RECEIPT", "VOUCHER_PAYMENT", "CARGO", "INSPECTION", "LOAD_LIST", "ACTUAL_LOADING", …]

      61 |     const families = KEYS.map((key) => PERIODIC_DOCUMENT_FORMATS[key].sequenceFamily);
      62 |     expect(new Set(families).size).toBe(KEYS.length);
    > 63 |     expect(KEYS).toHaveLength(12);
         |                  ^
      64 |   });
      65 |
      66 |   it.each(KEYS)('%s: request uses the printed code, period YYYYMM and five-digit padding', (key) => {

      at Object.<anonymous> (numbering.e2e-spec.ts:63:18)

FAIL ./vessel.e2e-spec.ts (28.579 s)
  ● Vessel (e2e) › rejects duplicate IMO (409) and invalid IMO format (400)

    expected 201 "Created", got 409 "Conflict"

      216 |       .set(auth(adminToken))
      217 |       .send({ ...vesselBase(), code: `VES2-${tag}`, imo: '1234567' })
    > 218 |       .expect(201);
          |        ^
      219 |     createdVessels.push({ id: first.body.data.id });
      220 |
      221 |     await request(app.getHttpServer())

      at Object.<anonymous> (vessel.e2e-spec.ts:218:8)
      ----
      at Test._assertStatus (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:309:14)
      at ../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:365:13
      at Test._assertFunction (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:342:13)
      at Test.assert (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:195:23)
      at localAssert (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:138:14)
      at Server.<anonymous> (../../../node_modules/.pnpm/supertest@7.2.2/node_modules/supertest/lib/test.js:152:11)

FAIL ./voucher.e2e-spec.ts (30.946 s)
  ● Vouchers & Ledger (e2e) › creates a standalone RECEIPT (no invoice) — deposit with own number

    expect(received).toBeNull()

    Received: "cmv9mztg1000m8slsmw70l6ek"

      257 |     standaloneId = res.body.data.id;
      258 |     expect(res.body.data.voucherNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    > 259 |     expect(res.body.data.invoiceId).toBeNull();
          |                                     ^
      260 |   });
      261 |
      262 |   it('allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:259:37)

  ● Vouchers & Ledger (e2e) › allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation

    expect(received).toBe(expected) // Object.is equality

    Expected: "25.00"
    Received: "25"

      281 |     expect(posted.body.data.unallocatedAmount).toBe('45.00');
      282 |     expect((await request(app.getHttpServer()).get(`/api/v1/invoices/${first}`)
    > 283 |       .set(auth(adminToken)).expect(200)).body.data.paidAmount).toBe('25.00');
          |                                                                 ^
      284 |     const reallocated = await request(app.getHttpServer())
      285 |       .post(`/api/v1/vouchers/${posted.body.data.id}/allocations`).set(auth(adminToken))
      286 |       .send({ reason: 'Correct fixture split', allocations: [

      at Object.<anonymous> (voucher.e2e-spec.ts:283:65)

  ● Vouchers & Ledger (e2e) › creates a PAYMENT (refund) decreasing paidAmount; PMT numbering

    expect(received).toBe(expected) // Object.is equality

    Expected: 300
    Received: 350

      307 |
      308 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 309 |     expect(Number(inv.body.data.paidAmount)).toBe(300);
          |                                              ^
      310 |   });
      311 |
      312 |   it('lists with type & invoice filters; detail returns serialized rows', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:309:46)

  ● Vouchers & Ledger (e2e) › lists with type & invoice filters; detail returns serialized rows

    expect(received).toEqual(expected) // deep equality

    - Expected  - 0
    + Received  + 1

      Array [
        "cmv9mzuas001h8slsqlbj897h",
    +   "cmv9mzumb001p8slsdn543180",
        "cmv9mzv67002j8slsrf8dz11w",
      ]

      320 |     const byInvoice = await request(app.getHttpServer()).get(`/api/v1/vouchers?invoiceId=${invoiceId}&pageSize=100`).set(auth(adminToken)).expect(200);
      321 |     const nums = byInvoice.body.data.data.map((v: { id: string }) => v.id).sort();
    > 322 |     expect(nums).toEqual([pmt1Id, rcp1Id].sort());
          |                  ^
      323 |
      324 |     const one = await request(app.getHttpServer()).get(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(200);
      325 |     expect(one.body.data.customer.name).toContain('VCH Co');

      at Object.<anonymous> (voucher.e2e-spec.ts:322:18)

  ● Vouchers & Ledger (e2e) › freezes posted financial fields; explicit adjustment and reallocation leave audited history

    expect(received).toBe(expected) // Object.is equality

    Expected: 400
    Received: 450

      352 |     expect(after.body.data.unallocatedAmount).toBe('0.00');
      353 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 354 |     expect(Number(inv.body.data.paidAmount)).toBe(400); // 500 receipt - 100 refund
          |                                              ^
      355 |   });
      356 |
      357 |   it('cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:354:46)

  ● Vouchers & Ledger (e2e) › cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 550

      371 |
      372 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 373 |     expect(Number(inv.body.data.paidAmount)).toBe(500);
          |                                              ^
      374 |
      375 |     await request(app.getHttpServer())
      376 |       .post(`/api/v1/vouchers/${pmt1Id}/cancel`)

      at Object.<anonymous> (voucher.e2e-spec.ts:373:46)

  ● Vouchers & Ledger (e2e) › delete: neither POSTED nor CANCELLED financial history may be erased

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 550

      384 |     await request(app.getHttpServer()).delete(`/api/v1/vouchers/${pmt1Id}`).set(auth(adminToken)).expect(409);
      385 |     const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    > 386 |     expect(Number(inv.body.data.paidAmount)).toBe(500);
          |                                              ^
      387 |   });
      388 |
      389 |   it('ledger: statement with opening/running/closing balance (mixed currency summed)', async () => {

      at Object.<anonymous> (voucher.e2e-spec.ts:386:46)


Test Suites: 3 failed, 26 passed, 29 total
Tests:       9 failed, 539 passed, 548 total
Snapshots:   0 total
Time:        76.298 s, estimated 102 s
Ran all test suites.
Test results written to: ../../../../../../tmp/duna-e2e-Prryyt/jest-results.json
```

