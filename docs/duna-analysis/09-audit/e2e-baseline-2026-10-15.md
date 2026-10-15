# e2e baseline — 2026-10-15

**Recorded 2026-10-15T13:04:39.781Z** by `pnpm test:e2e-baseline`.

This replaces the unverified `403/403` figure that `initial-roadmap.md:74` records
as UNVERIFIED. It is a real measurement from a real run.

| Field | Value |
| --- | --- |
| Date | 2026-10-15 |
| Command | `pnpm --filter @shipping/api test` |
| Database | `localhost:5432/duna_seed_test` |
| Suites | 3 failed, 26 passed, 29 total |
| Tests | 9 failed, 539 passed, 548 total |
| Time | 111.034 s |
| Wall clock | 113.1s |
| Exit code | 1 |

## Verdict

**Failures present** (exit code 1).

## Failing suites

- test/numbering.e2e-spec.ts (45.947 s)
- test/vessel.e2e-spec.ts (50.468 s)
- test/voucher.e2e-spec.ts (54 s)
- ./numbering.e2e-spec.ts (45.947 s)
- ./vessel.e2e-spec.ts (50.468 s)
- ./voucher.e2e-spec.ts (54 s)

## Passing suites

- test/portal-documents-read.e2e-spec.ts
- test/inspection.e2e-spec.ts (59.986 s)
- test/salary.e2e-spec.ts (14.235 s)
- test/actual-loading.e2e-spec.ts (67.039 s)
- test/discharge.e2e-spec.ts (18.766 s)
- test/delivery-release.e2e-spec.ts (23.185 s)
- test/auth.e2e-spec.ts (20.9 s)
- test/voyage.e2e-spec.ts (20.926 s)
- test/bill.e2e-spec.ts (81.364 s)
- test/party-masters.e2e-spec.ts (19.83 s)
- test/portal.e2e-spec.ts (17.755 s)
- test/manifest.e2e-spec.ts (90.991 s)
- test/invoice.e2e-spec.ts (19.243 s)
- test/invoice-phase3.e2e-spec.ts (18.297 s)
- test/quotation.e2e-spec.ts (18.236 s)
- test/proforma.e2e-spec.ts (18.404 s)
- test/job.e2e-spec.ts (12.082 s)
- test/letter.e2e-spec.ts (16.242 s)
- test/attachment-settings.e2e-spec.ts (12.497 s)
- test/portal-isolation-guard.e2e-spec.ts
- test/delivery-release-cancellation.e2e-spec.ts
- test/app.e2e-spec.ts (5.687 s)
- test/portal-agent-isolation.e2e-spec.ts (5.75 s)
- test/party-cutover.e2e-spec.ts (6.579 s)
- test/master-data.e2e-spec.ts (7.913 s)
- test/cargo-inventory.e2e-spec.ts (12.375 s)

## Data

The suites create rows through the HTTP API and delete them in their own
`afterAll` hooks. They do not drop the schema. This run targeted
`localhost:5432/duna_seed_test`.

## Raw tail of the run

```

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
Time:        111.034 s
Ran all test suites.
```
