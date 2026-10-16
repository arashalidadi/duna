# Phase 10 E2E failure investigation — 2026-10-16

## Scope and evidence boundary

The owner reported **33 suites / 580 tests: 31 passed and 2 failed suites; 574 passed and 6 failed tests** on their prepared `duna_phase10_e2e_isolated` database. The six reported failures were the two Cargo Phase 3A legacy-field assertions and four Manifest numbering assertions. The cited `e2e-baseline-2026-10-16.md` is **not in this checkout**; the owner's count and excerpt are reported evidence, not a run performed here. This investigation independently reproduced all six failures, then ran focused and full suites on **separate sandbox-owned PostgreSQL databases**, not on the owner's server. No Phase 11 work was started.

Starting branch/commit: `arena/be9b4e5b-duna` / `5cfc19c8bb7e1d2c8a817f546b6b005cc9f9b256`. No application service, DTO, shared contract, schema, migration, seed, permission, or production setting was changed. Three **E2E fixture/spec files** were changed. The owner's audit reports (including `e2e-baseline-2026-10-15.md`) were not edited, overwritten, or removed; the unavailable 2026-10-16 report was not fabricated. The dated baseline runner was not invoked because it would write the same-date report path. Jest JSON and console logs for these local runs are stored outside Git under `/home/user/phase10-pg/` with unique names.

## Root causes and changes

| Failure | Confirmed cause (before edits) | Change and preserved behavior |
| --- | --- | --- |
| Cargo Phase 3A create | The spec sent/asserted `chassis`, `serial`, `units`, `comment`; the current DTO and `CargoService` write/select `chassisNumber`, `serialNumber`, `quantity`, `comments`. The E2E `ValidationPipe({ whitelist: true })` silently discarded the old request keys, so `d.chassis` was `undefined`. The Phase 10 migration archives historical values in `CargoLegacyAttribute`; old physical columns are `@ignore` in Prisma, not new writable API fields. ADR-044 designates plural `comments` as canonical. | Send/assert the four canonical fields on create, and re-read the row to prove persistence (including `legacyAttributes: null` for a new cargo). Track its ID **before** assertions so a future failure cannot strand this fixture and block teardown of its related masters. No compatibility alias or archive rewrite was introduced. |
| Cargo Phase 3A update | Same obsolete keys and response assertions; re-running with the prerequisite cargo reproduced `d.chassis === undefined`. | PATCH canonical fields, assert the response and a fresh GET; use `quantity` in the adjacent canonical-comment fixture and assert its round-trip. Keep existing party, finance, permissions and lifecycle checks. |
| Manifest abbreviation | `PortsService.create()` uppercases abbreviations. The test submitted `MAB${randomTag}` but asserted lowercase; the persisted/returned segment was `MAB${tag}`. | Assert uppercase normalized abbreviation and `MAN-MAB${tag}-YYMM-#####`; still verifies the abbreviation branch. |
| Manifest code fallback | The shared `destPortId` fixture now has `T02${tag}` after Phase 10 requires complete **new** Ports. It cannot exercise a null abbreviation. The schema deliberately permits incomplete **historical** Ports; the allocator uses `port.abbreviation || port.code`. | Create a **separate, suite-owned historical Port** with `abbreviation: null` through Prisma (not the new-Port API), verify its GET returns null and the expected code, create a voyage to it, and assert the returned number starts `MAN-{code}-`. Track it for scoped teardown without mutating the shared destination. |
| Manifest collision retry | The test blocker used the Port's code, while the allocator used its `T06...` abbreviation. The two numbers differed; **no collision was created**, so the returned `-00001` never tested the retry. | Construct the blocker from the actual normalized abbreviation and assert the expected segment. The original exact `-00002` check now exercises the real unique-key collision and a fresh retry (passed locally). |
| Manifest abandoned allocation | The rejected DRAFT B/L **did burn** `-00001` and the next manifest received `-00002`, but the expectation interpolated the Port code rather than the `T07...` abbreviation. | Assert the actual normalized segment while retaining the strict `-00002` gap/no-reuse assertion. |

**Additional fresh-core-seed fixture issue discovered by the requested full suite:** `portal.e2e-spec.ts` created its own vessel/voyage but used `prisma.port.findFirst()` for the Port. The core seed creates no Ports; all **14 Agent Portal tests** failed in `beforeAll` when none existed (first full run: 32/33 suites, 566/580 tests). A previously populated database hid the dependency. The suite now creates a complete, tagged Port of its own and deletes it by exact ID after its bookings/manifests/voyage. Agent/customer isolation, ordinary-user denials, booking permissions and the separate portal isolation gate are unchanged; a targeted portal run subsequently passed 14/14.

These were **outdated assertions and an incorrectly shared test fixture**, not evidence that the Cargo/Port/Manifest production behavior should be reverted. The correction **strengthens** Cargo storage verification and the collision test instead of weakening checks.

## Verified local database and test runtime

- Sandbox PostgreSQL **16.14**, initialized in a new directory outside the repository and listening only on `127.0.0.1:55431` as local role `phase10_local`. Catalog inspection before creation showed only `postgres`, `template0`, `template1`; neither `duna_seed_test` nor `duna_seed_test1` was present. This cluster cannot be mistaken for the owner's server `localhost:5432`.
- Fresh local databases: `duna_phase10_e2e_isolated` (individual pre-fix reproductions), `duna_phase10_e2e_validation_test` (focused rechecks), `duna_phase10_e2e_full_test` (first full run), `duna_phase10_e2e_final_test` (final fresh full run and repeat), plus **independent** `duna_portal_isolation_test` (portal rollback-only fixture). Identity/port/name checks were made before each write. All **46 checked-in SQL migration files** were applied, in order, to each new empty database; 93 public tables were verified. The main test databases received **only the core seed** (206 permissions, one admin, zero Port/Cargo rows; no demo seed). These are local fixture migrations, **not** a migration deploy, schema push, reset, history marking, or server change.
- The environment cannot reach `binaries.prisma.sh`, so the standard Prisma 5.22 native engine was unavailable. `DATABASE_URL=postgresql://phase10_local@127.0.0.1:55431/postgres corepack pnpm exec prisma generate --no-engine` initially **failed**, attempting to fetch `libquery_engine.so.node.sha256` from that blocked host. For this **sandbox run only**, a generated client in ignored `node_modules` used Prisma **5.22's bundled PostgreSQL WASM query engine**, `@prisma/adapter-pg@5.22.0`, and a strict local-DB connection guard. The successful generation command was `env DATABASE_URL=postgresql://phase10_local@127.0.0.1:55431/postgres PRISMA_QUERY_ENGINE_LIBRARY=/home/user/duna/node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm PRISMA_SCHEMA_ENGINE_BINARY=/usr/bin/true PRISMA_CLIENT_FORCE_WASM=1 corepack pnpm exec prisma generate --schema /home/user/phase10-pg/schema.prisma` (temporary generator schema, outside Git). Initial Cargo probes failed in fixture setup until the ignored generated client injected the adapter and removed Prisma's incompatible duplicate `datasources` option. The first portal isolation probe failed **3/3** because PrismaPg 5.22 could not deserialize PostgreSQL's `name` OID; an **outside-repository** adapter mapping of OID 19 to Text made the unmodified `current_database()` safety check pass **3/3** on re-run. No harness changes were committed. Results are real PostgreSQL HTTP E2E checks of the application, **but not a native-engine or owner-server verification**.
- `ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true` and an outside-repository storage directory were set **only** for this disposable E2E fixture, as required by the existing attachment suite; the separate portal DB gate used its exact URL/name and `YES_ISOLATED_TEST_DB` confirmation. `NOTIFICATION_WORKER_ENABLED=false` avoided an unrelated background poller. The owner's environment, database URL/password, reports and seed databases were untouched.

## Commands and measured results

All Jest commands below were executed with the local database identified above and local-only JWT configuration. Full-suite commands additionally had the attachment fixture settings and explicit `PORTAL_ISOLATION_TEST_DATABASE_URL` / `_NAME` / `_DB_CONFIRMED` gate. Secret *values* are intentionally not reproduced in this report. The Jest argv and output paths below are exact; all paths under `/home/user/phase10-pg/` are sandbox-only artifacts, not committed audit reports.

1. Provision/build: `corepack pnpm install --frozen-lockfile --ignore-scripts`; `corepack pnpm --filter @shipping/config --filter @shipping/shared run build`; temporary `prisma generate --schema /home/user/phase10-pg/schema.prisma` with `PRISMA_CLIENT_FORCE_WASM=1`, a local WASM engine path and a local-only schema-engine override; `node /home/user/phase10-pg/apply-local-migrations.cjs`; `SEED_DEMO_DATA=false corepack pnpm db:seed` on each newly verified main fixture. There was **no** owner migration or seed run.
2. Individual pre-fix reproduction: `corepack pnpm --filter @shipping/api run test --runInBand test/cargo-inventory.e2e-spec.ts --testNamePattern='creates cargo with all Phase 3A fields and returns them' --json --outputFile=/home/user/phase10-pg/baseline-cargo-create-run3.json` (1 failed); the same cargo file with `--testNamePattern='creates a cargo with an auto reference|updates Phase 3A pol/pod/description/chassis/serial/units/comment fields' --json --outputFile=/home/user/phase10-pg/baseline-cargo-update.json` (1 passed prerequisite, 1 failed). Four separate Manifest commands used `test/manifest.e2e-spec.ts` and `--testNamePattern` values `numbering: legacy path issues`, `numbering: port without abbreviation falls back`, `numbering: consolidation retries a manifestNumber collision`, `numbering: an abandoned allocation leaves a gap`; their respective `--outputFile` paths were `/home/user/phase10-pg/baseline-manifest-{abbr,fallback,retry,gap}.json`. **All six reported assertions independently failed as described**. See complete local Jest messages below.
3. After the two primary spec fixes, `corepack pnpm --filter @shipping/api run test --runInBand test/cargo-inventory.e2e-spec.ts test/manifest.e2e-spec.ts --json --outputFile=/home/user/phase10-pg/focused-pass1.json` and the same argv with `focused-pass2.json` on the same validation DB: **2/2 suites, 65/65 tests passed on each run**. Ports, Cargo, Customer, Voyage, Vessel and Manifest fixtures from those two suites were removed; Manifest-scoped sequence rows were 0. Other flows retain global or per-fixture BILL/VOYAGE numbering rows by existing design/cleanup, so a database is **not** literally reset between runs.
4. Full suite before the additional Portal fixture correction, on fresh `duna_phase10_e2e_full_test`: `corepack pnpm --filter @shipping/api run test --runInBand --json --outputFile=/home/user/phase10-pg/full-e2e-first.json` → **32/33 suites, 566/580 tests passed; 14 failures in the one Agent Portal suite**, all due to the missing Port in its `beforeAll` (full errors below). Targeted `test/portal.e2e-spec.ts --runInBand` on core-seeded validation DB after correction → **1/1 suite, 14/14 passed**. Separate portal isolation `test/portal-agent-isolation.e2e-spec.ts --runInBand` → **1/1 suite, 3/3 passed**, with the sandbox-only adapter mapping noted above.
5. Fresh `duna_phase10_e2e_final_test` preflight: database identity and 93-table schema confirmed; core seed counted `User=1, Port=0, Cargo=0, NumberingSequence=0`. `corepack pnpm --filter @shipping/api run test --runInBand --json --outputFile=/home/user/phase10-pg/full-e2e-final.json` → **33/33 suites, 580/580 tests passed**. Repeating on **that same database** with only `--outputFile=/home/user/phase10-pg/full-e2e-repeat.json` changed → **33/33 suites, 580/580 tests passed again**. All passed suites and their per-suite counts are listed below; no full-suite result is inferred from a subset.
6. `corepack pnpm --filter @shipping/api run typecheck` passed after the final edits. `corepack pnpm test:e2e-baseline:unit` passed **3/3** report-format tests. `git diff --check` passed. No web/production deployment or native-engine server run is claimed.

**Repeat-run hygiene / residual risk:** after the first full run on the final DB, Port/Cargo/Voyage/Vessel were still **0**, portal isolation remained entirely **0**, and Manifest sequences were **0**; however, unrelated pre-existing fixture policies left 2 Customers, 5 extra Users, 5 extra Roles, and 40 NumberingSequence rows beyond the original core seed. After the second full run those became 4 Customers, 10 extra Users, 10 extra Roles and 67 NumberingSequence rows, while Port/Cargo/Voyage/Vessel and portal-isolation counts stayed 0. No pre-existing or residual data was deleted to make the counts look clean. The repeat **passed despite this accumulation**; the broader suite is not wholly self-cleaning, and non-Manifest per-fixture sequence cleanup deserves a separate scoped review if the owner wants it. Jest also warned once per run that it did not exit within one second, although both final commands returned exit 0; the local WASM/driver-adapter harness may contribute to lingering handles, but that attribution was not established.

## Follow-up and acceptance boundary

Re-run the full suite with the **native Prisma engine** against the owner's independently verified, prepared `duna_phase10_e2e_isolated` on `~/shipping-dashboard/new-erp` before treating this as server acceptance. Use a **unique** Jest `--outputFile` or a separately named new audit report; do **not** overwrite an existing dated baseline. E2E suites write best-effort fixtures and should not target either `duna_seed_test` database. No production database/environment was identified here. Preserve Cargo legacy archives and unreconciled Phase 10 policies; **await explicit approval before Phase 11**.

## Complete suite summaries (all 33, first full run / final fresh run / repeat)

| Suite | First full run | Final fresh run | Repeat on same DB |
| --- | --- | --- | --- |
| `apps/api/test/actual-loading.e2e-spec.ts` | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) |
| `apps/api/test/app.e2e-spec.ts` | passed (5 passed / 0 failed / 5 total) | passed (5 passed / 0 failed / 5 total) | passed (5 passed / 0 failed / 5 total) |
| `apps/api/test/attachment-settings.e2e-spec.ts` | passed (18 passed / 0 failed / 18 total) | passed (18 passed / 0 failed / 18 total) | passed (18 passed / 0 failed / 18 total) |
| `apps/api/test/auth.e2e-spec.ts` | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) |
| `apps/api/test/bill.e2e-spec.ts` | passed (29 passed / 0 failed / 29 total) | passed (29 passed / 0 failed / 29 total) | passed (29 passed / 0 failed / 29 total) |
| `apps/api/test/cargo-inventory.e2e-spec.ts` | passed (33 passed / 0 failed / 33 total) | passed (33 passed / 0 failed / 33 total) | passed (33 passed / 0 failed / 33 total) |
| `apps/api/test/configuration-integration.e2e-spec.ts` | passed (4 passed / 0 failed / 4 total) | passed (4 passed / 0 failed / 4 total) | passed (4 passed / 0 failed / 4 total) |
| `apps/api/test/configuration.e2e-spec.ts` | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) |
| `apps/api/test/configured-document.e2e-spec.ts` | passed (7 passed / 0 failed / 7 total) | passed (7 passed / 0 failed / 7 total) | passed (7 passed / 0 failed / 7 total) |
| `apps/api/test/delivery-release-cancellation.e2e-spec.ts` | passed (8 passed / 0 failed / 8 total) | passed (8 passed / 0 failed / 8 total) | passed (8 passed / 0 failed / 8 total) |
| `apps/api/test/delivery-release.e2e-spec.ts` | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) | passed (19 passed / 0 failed / 19 total) |
| `apps/api/test/discharge.e2e-spec.ts` | passed (22 passed / 0 failed / 22 total) | passed (22 passed / 0 failed / 22 total) | passed (22 passed / 0 failed / 22 total) |
| `apps/api/test/document-output-http.e2e-spec.ts` | passed (2 passed / 0 failed / 2 total) | passed (2 passed / 0 failed / 2 total) | passed (2 passed / 0 failed / 2 total) |
| `apps/api/test/inspection.e2e-spec.ts` | passed (27 passed / 0 failed / 27 total) | passed (27 passed / 0 failed / 27 total) | passed (27 passed / 0 failed / 27 total) |
| `apps/api/test/invoice-phase3.e2e-spec.ts` | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) |
| `apps/api/test/invoice.e2e-spec.ts` | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) |
| `apps/api/test/job.e2e-spec.ts` | passed (14 passed / 0 failed / 14 total) | passed (14 passed / 0 failed / 14 total) | passed (14 passed / 0 failed / 14 total) |
| `apps/api/test/letter.e2e-spec.ts` | passed (15 passed / 0 failed / 15 total) | passed (15 passed / 0 failed / 15 total) | passed (15 passed / 0 failed / 15 total) |
| `apps/api/test/manifest.e2e-spec.ts` | passed (32 passed / 0 failed / 32 total) | passed (32 passed / 0 failed / 32 total) | passed (32 passed / 0 failed / 32 total) |
| `apps/api/test/master-data.e2e-spec.ts` | passed (26 passed / 0 failed / 26 total) | passed (26 passed / 0 failed / 26 total) | passed (26 passed / 0 failed / 26 total) |
| `apps/api/test/numbering.e2e-spec.ts` | passed (83 passed / 0 failed / 83 total) | passed (83 passed / 0 failed / 83 total) | passed (83 passed / 0 failed / 83 total) |
| `apps/api/test/party-cutover.e2e-spec.ts` | passed (5 passed / 0 failed / 5 total) | passed (5 passed / 0 failed / 5 total) | passed (5 passed / 0 failed / 5 total) |
| `apps/api/test/party-masters.e2e-spec.ts` | passed (37 passed / 0 failed / 37 total) | passed (37 passed / 0 failed / 37 total) | passed (37 passed / 0 failed / 37 total) |
| `apps/api/test/portal-agent-isolation.e2e-spec.ts` | passed (3 passed / 0 failed / 3 total) | passed (3 passed / 0 failed / 3 total) | passed (3 passed / 0 failed / 3 total) |
| `apps/api/test/portal-documents-read.e2e-spec.ts` | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) |
| `apps/api/test/portal-isolation-guard.e2e-spec.ts` | passed (3 passed / 0 failed / 3 total) | passed (3 passed / 0 failed / 3 total) | passed (3 passed / 0 failed / 3 total) |
| `apps/api/test/portal.e2e-spec.ts` | failed (0 passed / 14 failed / 14 total) | passed (14 passed / 0 failed / 14 total) | passed (14 passed / 0 failed / 14 total) |
| `apps/api/test/proforma.e2e-spec.ts` | passed (9 passed / 0 failed / 9 total) | passed (9 passed / 0 failed / 9 total) | passed (9 passed / 0 failed / 9 total) |
| `apps/api/test/quotation.e2e-spec.ts` | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) | passed (11 passed / 0 failed / 11 total) |
| `apps/api/test/salary.e2e-spec.ts` | passed (9 passed / 0 failed / 9 total) | passed (9 passed / 0 failed / 9 total) | passed (9 passed / 0 failed / 9 total) |
| `apps/api/test/vessel.e2e-spec.ts` | passed (15 passed / 0 failed / 15 total) | passed (15 passed / 0 failed / 15 total) | passed (15 passed / 0 failed / 15 total) |
| `apps/api/test/voucher.e2e-spec.ts` | passed (14 passed / 0 failed / 14 total) | passed (14 passed / 0 failed / 14 total) | passed (14 passed / 0 failed / 14 total) |
| `apps/api/test/voyage.e2e-spec.ts` | passed (26 passed / 0 failed / 26 total) | passed (26 passed / 0 failed / 26 total) | passed (26 passed / 0 failed / 26 total) |

## Six original failures independently reproduced before editing (full messages)

### baseline-cargo-create-run3

Target `apps/api/test/cargo-inventory.e2e-spec.ts`; Jest: 0 passed, 1 failed, 32 skipped.

**Failed test:** Cargo & Yard Inventory (e2e) Cargo creates cargo with all Phase 3A fields and returns them

**Full assertion error:**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "CH-3A"
Received: undefined
    at Object.<anonymous> (/home/user/duna/apps/api/test/cargo-inventory.e2e-spec.ts:401:25)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message:**

```text
  ● Cargo & Yard Inventory (e2e) › Cargo › creates cargo with all Phase 3A fields and returns them

    expect(received).toBe(expected) // Object.is equality

    Expected: "CH-3A"
    Received: undefined

      399 |       expect(d.pod).toBe('POD-PHASE3A');
      400 |       expect(d.description).toBe('Phase 3A full field test');
    > 401 |       expect(d.chassis).toBe('CH-3A');
          |                         ^
      402 |       expect(d.serial).toBe('SER-3A');
      403 |       expect(d.units).toBe(10);
      404 |       expect(d.comment).toBe('Phase 3A comment');

      at Object.<anonymous> (cargo-inventory.e2e-spec.ts:401:25)
```

### baseline-cargo-update

Target `apps/api/test/cargo-inventory.e2e-spec.ts`; Jest: 1 passed, 1 failed, 31 skipped.

**Failed test:** Cargo & Yard Inventory (e2e) Cargo updates Phase 3A pol/pod/description/chassis/serial/units/comment fields

**Full assertion error:**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "CH-UPDATED"
Received: undefined
    at Object.<anonymous> (/home/user/duna/apps/api/test/cargo-inventory.e2e-spec.ts:445:37)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message:**

```text
  ● Cargo & Yard Inventory (e2e) › Cargo › updates Phase 3A pol/pod/description/chassis/serial/units/comment fields

    expect(received).toBe(expected) // Object.is equality

    Expected: "CH-UPDATED"
    Received: undefined

      443 |       expect(res.body.data.pod).toBe('POD-UPDATED');
      444 |       expect(res.body.data.description).toBe('Updated description');
    > 445 |       expect(res.body.data.chassis).toBe('CH-UPDATED');
          |                                     ^
      446 |       expect(res.body.data.serial).toBe('SER-UPDATED');
      447 |       expect(res.body.data.units).toBe(99);
      448 |       expect(res.body.data.comment).toBe('Updated comment');

      at Object.<anonymous> (cargo-inventory.e2e-spec.ts:445:37)
```

### baseline-manifest-abbr

Target `apps/api/test/manifest.e2e-spec.ts`; Jest: 0 passed, 1 failed, 31 skipped.

**Failed test:** Manifest (e2e) numbering: legacy path issues MAN-{DEST}-YYMM-##### using the port abbreviation (Test 4 / Acceptance 3)

**Full assertion error:**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "MABexjyhh"
Received: "MABEXJYHH"
    at Object.<anonymous> (/home/user/duna/apps/api/test/manifest.e2e-spec.ts:1516:45)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message:**

```text
  ● Manifest (e2e) › numbering: legacy path issues MAN-{DEST}-YYMM-##### using the port abbreviation (Test 4 / Acceptance 3)

    expect(received).toBe(expected) // Object.is equality

    Expected: "MABexjyhh"
    Received: "MABEXJYHH"

      1514 |     extraPortIds.push(destWithAbbr);
      1515 |     createdPorts.push({ id: destWithAbbr });
    > 1516 |     expect(abbrPort.body.data.abbreviation).toBe(`MAB${randomTag}`);
           |                                             ^
      1517 |
      1518 |     const voy = await request(app.getHttpServer())
      1519 |       .post('/api/v1/voyages')

      at Object.<anonymous> (manifest.e2e-spec.ts:1516:45)
```

### baseline-manifest-fallback

Target `apps/api/test/manifest.e2e-spec.ts`; Jest: 0 passed, 1 failed, 31 skipped.

**Failed test:** Manifest (e2e) numbering: port without abbreviation falls back to code for {DEST}

**Full assertion error:**

```text
Error: expect(received).toBeNull()

Received: "T02E57JHC"
    at Object.<anonymous> (/home/user/duna/apps/api/test/manifest.e2e-spec.ts:1554:45)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message:**

```text
  ● Manifest (e2e) › numbering: port without abbreviation falls back to code for {DEST}

    expect(received).toBeNull()

    Received: "T02E57JHC"

      1552 |       .set(auth(adminToken))
      1553 |       .expect(200);
    > 1554 |     expect(destPort.body.data.abbreviation).toBeNull();
           |                                             ^
      1555 |     expect(num.startsWith(`MAN-${destPort.body.data.code}-`)).toBe(true);
      1556 |     trackManifestSeq(num, destPortId);
      1557 |   });

      at Object.<anonymous> (manifest.e2e-spec.ts:1554:45)
```

### baseline-manifest-retry

Target `apps/api/test/manifest.e2e-spec.ts`; Jest: 0 passed, 1 failed, 31 skipped.

**Failed test:** Manifest (e2e) numbering: consolidation retries a manifestNumber collision with a fresh number (P5-U4 nested-transaction retry)

**Full assertion error:**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "MAN-MFRETRY-MNDY5M-2610-00002"
Received: "MAN-T06MNDY5M-2610-00001"
    at Object.<anonymous> (/home/user/duna/apps/api/test/manifest.e2e-spec.ts:1696:42)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message:**

```text
  ● Manifest (e2e) › numbering: consolidation retries a manifestNumber collision with a fresh number (P5-U4 nested-transaction retry)

    expect(received).toBe(expected) // Object.is equality

    Expected: "MAN-MFRETRY-MNDY5M-2610-00002"
    Received: "MAN-T06MNDY5M-2610-00001"

      1694 |       .expect(201);
      1695 |     // First attempt consumed 00001 (collision) -> the retry allocated 00002.
    > 1696 |     expect(res.body.data.manifestNumber).toBe(`MAN-${segment}-${yymm}-00002`);
           |                                          ^
      1697 |     trackManifestSeq(res.body.data.manifestNumber as string, destRetryId);
      1698 |   });
      1699 |

      at Object.<anonymous> (manifest.e2e-spec.ts:1696:42)
```

### baseline-manifest-gap

Target `apps/api/test/manifest.e2e-spec.ts`; Jest: 0 passed, 1 failed, 31 skipped.

**Failed test:** Manifest (e2e) numbering: an abandoned allocation leaves a gap, never a reuse (P5-U4 correctness property)

**Full assertion error:**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "MAN-MFGAP-QU60VA-2610-00002"
Received: "MAN-T07QU60VA-2610-00002"
    at Object.<anonymous> (/home/user/duna/apps/api/test/manifest.e2e-spec.ts:1747:42)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message:**

```text
  ● Manifest (e2e) › numbering: an abandoned allocation leaves a gap, never a reuse (P5-U4 correctness property)

    expect(received).toBe(expected) // Object.is equality

    Expected: "MAN-MFGAP-QU60VA-2610-00002"
    Received: "MAN-T07QU60VA-2610-00002"

      1745 |       String(now.getUTCMonth() + 1).padStart(2, '0');
      1746 |     // 00001 was burned by the failed attempt -> the successful one starts at 00002.
    > 1747 |     expect(res.body.data.manifestNumber).toBe(`MAN-${segment}-${yymm}-00002`);
           |                                          ^
      1748 |     trackManifestSeq(res.body.data.manifestNumber as string, destGapId);
      1749 |   });
      1750 |   });

      at Object.<anonymous> (manifest.e2e-spec.ts:1747:42)
```

## First full run: Agent Portal shared-fixture failure (full messages)

The sole failed suite was `apps/api/test/portal.e2e-spec.ts` (0 passed / 14 failed / 14 total). All 14 failed tests are listed with untruncated assertion errors below.

**Failed test:** Agent Portal (e2e) 401 without token; office user (no portal:access) 403

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) portal:access but NOT linked to a company -> 403

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) linked agent -> 200 me with company + summary counts

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) customer-only portal user -> 200 me with 0 manifests, empty shipments (no 403)

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) create: agentC without booking:create -> 403; agentB -> 201 BRK + PENDING

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) create with unknown port -> 400

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) GET /portal/ports: agent list for booking form; RBAC via booking:create

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) list scoping: each company sees ONLY its own bookings

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) cancel: cross-company 404; own PENDING -> CANCELLED; again -> 409

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) shipments: agent A sees only its manifest, not B-s

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) statement: 200 with summary + entries (server-side company scope)

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) office list: sees all companies; status filter excludes cancelled

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) office detail: 200 for known id; 404 for unknown

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Failed test:** Agent Portal (e2e) respond: 403 without booking:respond; ACCEPTED + stamps; second -> 409; DECLINED on other

```text
Error: expect(received).not.toBeNull()

Received: null
    at Object.<anonymous> (/home/user/duna/apps/api/test/portal.e2e-spec.ts:110:22)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

**Complete suite-level Jest message (includes all 14 failures):**

```text
  ● Agent Portal (e2e) › 401 without token; office user (no portal:access) 403

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › portal:access but NOT linked to a company -> 403

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › linked agent -> 200 me with company + summary counts

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › customer-only portal user -> 200 me with 0 manifests, empty shipments (no 403)

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › create: agentC without booking:create -> 403; agentB -> 201 BRK + PENDING

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › create with unknown port -> 400

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › GET /portal/ports: agent list for booking form; RBAC via booking:create

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › list scoping: each company sees ONLY its own bookings

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › cancel: cross-company 404; own PENDING -> CANCELLED; again -> 409

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › shipments: agent A sees only its manifest, not B-s

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › statement: 200 with summary + entries (server-side company scope)

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › office list: sees all companies; status filter excludes cancelled

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › office detail: 200 for known id; 404 for unknown

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)

  ● Agent Portal (e2e) › respond: 403 without booking:respond; ACCEPTED + stamps; second -> 409; DECLINED on other

    expect(received).not.toBeNull()

    Received: null

      108 |     // happened to leave in the database — a required-seed-only database has none.
      109 |     const port = await prisma.port.findFirst({ select: { id: true } });
    > 110 |     expect(port).not.toBeNull();
          |                      ^
      111 |     portId = port!.id;
      112 |     const fxVessel = await prisma.vessel.create({
      113 |       data: { code: `PFV-${tag}`, name: `Portal Fixture Vessel ${randomTag}`, flag: 'AE', vesselType: 'CONTAINER' },

      at Object.<anonymous> (portal.e2e-spec.ts:110:22)
```

## Final/repeat suite-level Jest failures

None; Jest reported 33/33 passing suites and 580/580 passing tests in both final runs. Full local stdout/stderr and structured Jest JSON remain under `/home/user/phase10-pg/` with the filenames shown above; they were not substituted for, or written over, the owner's dated baseline.
