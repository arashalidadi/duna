# Phase 12 delivery and validation — two-command correction (2026-10-17)

**Status:** implemented and exercised with local mocks/static builds only. **NOT DEPLOYED OR TESTED ON THE OWNER SERVER.** The previously pushed feature baseline was `42a0cb2e25a581a51ef5c2826c0857532505304b`; this correction adds `pnpm phase12:apply` and `pnpm phase12:test` on the *same* `arena/be9b4e5b-duna` branch. The final corrected commit/push hash is reported with the handoff, not inferred from this document. Phase 11 remains owner-approved; there is no Phase 13 work. Only `duna_seed_test` on PostgreSQL 16 in `erp-postgres` is approved.

## Root cause and corrective design

The API deliberately runs as restricted `shipping_runtime_p11`. Running Prisma migration commands through that role's `DATABASE_URL` produces `_prisma_migrations` permission errors; **granting the runtime migration privileges or overwriting its URL would undo Phase 11 security**. The owner-server workflow instead discovers a separate existing `shipping` migration connection, checks actual host backend/container identity, migration-journal owner/history/checksums, authenticates/read-probes the restricted runtime credential, and checks Phase 11/12 catalog/ACLs before any write. The owner secret/passfile/approval is removed from API, Web and offline-test child environments. The workflow grants minimum journal SELECT/INSERT/UPDATE **only to `shipping` and only if needed** when the journal is `postgres`-owned. Then it conditionally deploys only the reviewed Phase 12 migration and seven-code incremental seed. It verifies the restricted runtime separately. Unknown history, checksum drift, unsafe ACLs, partial state, missing pre-change recovered backup, unapproved manager or unavailable owner/DBA access stop before DB writes. The true owner-host journal owner, credentials, and migration state have **not** been observed here; the diagnosed cause is based on the reported error and Phase 11's role design, not a claim of live verification.

`phase12:apply` consolidates the offline build/tests, DB inspection, restore attestation, conditional migration/seed, read-only postflight and affected API/Web restart/routes into one command. `phase12:test` independently repeats complete non-destructive source/build/authz/DB/route/schedule checks; SQL checks run read-only, Web build uses isolated `apps/web/build`, and the only migration fixture is in-memory PGlite. Neither path invokes the demo seed or installs/enables schedules, backup, physical deletion or PostgreSQL restart. Reserved `archive:delete`, `backup:manage`, `backup:restore` role grants remain absent by default. See `phase12-operations-runbook.md` for two-command host instructions and explicit prerequisites.

## Exact files in this correction

| File | Change |
| --- | --- |
| `package.json` | Primary `phase12:apply` and independent `phase12:test` entries. |
| `scripts/phase12/server-workflow.cjs` | Ordered redacted PASS/FAIL orchestration, backup prerequisite, approved app-only manager/restart, offline tests, isolated Web build, live route and schedule probes. |
| `scripts/phase12/server-workflow.test.cjs` | Mocked ordering, no DB write on test, credential isolation, manager fail-closed behavior, manifest/live unauthenticated GET tests. |
| `scripts/phase12/server-target.cjs` | Separate credential discovery, Docker/PG16 target/backend correlation, read-only journal inspection and narrowly guarded owner-only journal grant. |
| `scripts/phase12/server-target.test.cjs` | Target/credential/correlation/grant-scope mocks. |
| `scripts/phase12/db-policy.cjs` | Exact migration/checksum/catalog/trigger/role/permission policies; PostgreSQL timestamp typmod checks. |
| `scripts/phase12/db-policy.test.cjs` | Fail-closed policy fixtures and SQL/catalog typmod regression. |
| `apps/api/scripts/phase12-db-deploy.ts` | Owner-only inspect/apply/verify, conditional journal grant, targeted seed, read-only runtime probe and redacted error/summary markers. |
| `apps/web/next.config.mjs` | Opt-in isolated test build directory; normal app output unchanged. |
| `apps/web/tsconfig.json` | Includes isolated generated Next types once so repeated test builds do not rewrite tracked configuration. |
| `docs/duna-analysis/09-audit/phase12-operations-runbook.md` | Replaces obsolete Corepack/provision-new-env/manual deployment steps with the two commands and owner prerequisites. |
| `docs/duna-analysis/09-audit/phase12-validation-report.md` | This corrected evidence/limitations report. |

The earlier committed Phase 12 migration, API archive/backup code, UI and incremental seed files are **not** rewritten by this correction. No unrelated file is intentionally changed, staged or discarded.

## Executed validation — sandbox only

The sandbox has **no** owner Docker host, live database, application listeners or protected credentials. It uses Corepack only as a *local* pnpm runner; the owner server has pnpm `9.15.9` directly and no Corepack. The local Prisma 5.22 native-engine download previously failed via TLS; `prisma generate --no-engine` produced **types for compilation only**, never a deployable DB engine. Consequently no successful `pnpm phase12:apply` or `pnpm phase12:test` live run is asserted.

| Executed command or group | Observed result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile --ignore-scripts`; engine-free `corepack pnpm exec prisma generate --no-engine` | PASS locally, lockfile unchanged; no real Prisma DB engine installed here. |
| `DATABASE_URL=<approved-shape placeholder> corepack pnpm exec prisma validate` | PASS, schema valid; no DB connection. |
| `node --test scripts/phase12/*.test.cjs scripts/phase12/*.test.mjs` | PASS **31/31** including policy, target, command ordering, read-only/route and fail-closed contracts. |
| `corepack pnpm exec tsc --noEmit --module commonjs --target ES2021 --moduleResolution node --esModuleInterop --skipLibCheck --strict --strictPropertyInitialization false --experimentalDecorators --emitDecoratorMetadata apps/api/scripts/phase12-db-deploy.ts apps/api/scripts/seed-phase12-permissions.ts apps/api/scripts/run-phase12-archive.ts` | PASS, standalone operation-script types. |
| `corepack pnpm --filter @shipping/api typecheck`; `corepack pnpm --filter @shipping/api build`; `corepack pnpm check:api:build` | PASS, API canonical artifact reports **242 modules**. |
| `corepack pnpm --filter @shipping/web typecheck`; `corepack pnpm --filter @shipping/web test`; ordinary and `PHASE12_NEXT_ISOLATED_BUILD=1 corepack pnpm --filter @shipping/web build` | PASS, **5/5** Web tests; both App Router manifests map `/[locale]/archive` for `en`, `fa`, `ar`. Isolated rebuild preserved the production `.next` manifest hash; tracked tsconfig stable on repeated builds. |
| `TSX_TSCONFIG_PATH=apps/api/tsconfig.json corepack pnpm exec tsx --test apps/api/scripts/test-phase12-archive.ts apps/api/scripts/test-phase12-http.ts` | PASS **11/11**, DB-free service + in-process Nest HTTP/guard checks. |
| `corepack pnpm --filter @shipping/api exec jest --config test/jest-e2e.cjs --testRegex '.*\.unit-spec\.ts$' --runInBand` | PASS **41/41**, three DB-free Phase 10/11 regression suites. |
| `corepack pnpm test:phase10:migration`; `corepack pnpm test:phase11:audit:unit`; `corepack pnpm test:phase11:server:unit` | PASS, isolated in-memory Phase 10 fixture, audit mocks **8+2**, Phase 11 grant contracts **15/15**. |
| `corepack pnpm check:phase11:authz`; `corepack pnpm check:seed-safety`; `git diff --check` | PASS, **408 handlers** (400 permission/3 self/5 public, zero missing/unseeded); zero demo-business models in required seed; no whitespace errors. |
| `PATH=<temporary Corepack-backed local pnpm shim>:$PATH corepack pnpm phase12:test` and `... phase12:apply` | Both **FAIL safely at stage 2**, after toolchain PASS: `Cannot inspect running erp-postgres Docker container`. Expected in this sandbox; no owner DB, backup, service or other stage ran. The shim is sandbox-only; the owner server uses installed pnpm directly. |

**Failures investigated (not counted as passed):** first standalone TypeScript check caught an `unknown` exception-property access (corrected and recompiled). The first isolated Next build changed tracked `tsconfig.json`; adding its generated type path once made subsequent builds stable. An initial archive-route proof incorrectly looked only in `prerender-manifest.json`; Next App Router routes actually appear in `app-path-routes-manifest.json` (corrected and verified against the build output). A policy test exposed a PostgreSQL catalog typmod mistake: `TIMESTAMP(3)` has `atttypmod=7`, not 3; corrected with an explicit migration/typmod regression. An attempted standalone `check:phase11:audit:routes` returned `fetch failed` because the sandbox has no running API; the two-command workflow probes that protected route **after** the deployed API restart. A scratch run of the DB inspection while source edits were uncommitted stopped at the reviewed-source guard **before Docker or database access**, as designed. No assertion was weakened to mask these failures.

## Missing owner-server gates and acceptance boundary

- **NOT RUN:** actual PostgreSQL 16 host/container/backend correlation, real `shipping`/`shipping_runtime_p11` credentials and migration-journal ownership/ACL, migration history/checksums, live migration/seed, trigger execution, real Prisma-engine/runtime query, app manager restart, API PID/socket/DB-session proof, route GET, or authenticated office/portal browser checks. The local sandbox lacks the owner server and Docker; these can only be recorded after the operator runs the delivered commands there.
- **NOT RUN:** approved recoverable pre-change backup attestation, encrypted off-server backup, independent isolated restore/receipt with assets and cluster roles, notification delivery, schedule/monitoring acceptance, physical-delete safeguards under an authorized fixture, or full RPO/RTO recovery rehearsal. A signed ciphertext alone does not establish recoverability. No production business records or policies were created in this correction.
- **Separate owner inputs:** legally approved retention authority/lawful basis and period/automatic archive criterion (none invented or seeded), DBA approval for any privileged connection and cluster-role dump, protected storage/keys, authorized isolated destructive tests and authenticated user roles. Tests cannot prove retroactively that someone did not previously run a demo seed. A passing unauthenticated 401 establishes route registration/guard, not bearer-token or portal isolation end-to-end. Do not call full Phase 12/DR acceptance complete until those separate live gates are recorded.
