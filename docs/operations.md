# Operations runbook

Runtime, login, port, connectivity and handoff records for running this system.

> Merged from 8 files on 2026-10-20. Every original document appears below in full, under a heading naming its former path.

---

## ops/admin-login-verification.md

# Real admin login verification — 2026-10-09

> Historical diagnostic from the withdrawn, incorrect-port configuration. Required API port is now
> **3101**; references to 3010 below record old observations only, not current configuration.
> See [port-correction audit](api-port-correction.md); publication is on hold for user review.
> The user has withdrawn the Arena login-first gate. Do not retry
> preview provisioning/authentication. Defer real-data acceptance to their server and wait for
> explicit publication approval; [current handoff](publication-handoff.md) supersedes earlier conditions.

## Outcome: login did not succeed; failure occurs before authentication

A real Chromium browser submitted the user-supplied admin credentials through the existing
`/en/login` form. No request interception, mock backend, auth bypass, preloaded session or
successful-login fixture was used in this diagnostic. Credentials were supplied only to the
short-lived diagnostic process, not written into source, requests logs, screenshots, traces,
storage-state files or this report.

Observed request/response:

```text
GET  /en/login            -> 200
POST /api/v1/auth/login   -> 502
error.code               = UPSTREAM_UNAVAILABLE
error.message            = API service unavailable
Dashboard reached        = no
Browser page exceptions  = none
```

The visible error is the reported service-unavailable message. This is **not** a 401 password
rejection. The API was absent, so neither admin lookup nor bcrypt password comparison ran.
Whether the supplied credentials are valid on the user's existing server remains unknown.

## Historical failure chain (observed before the required-port correction)

1. **Then-configured port, no active override:** the live Next process has no `API_INTERNAL_URL` or
   `NEXT_PUBLIC_API_URL` override. The then-current source and compiled route handler both targeted
   `http://127.0.0.1:3010`; the browser posts to same-origin `/api/v1/auth/login`.
2. **API absent:** no listener on 3010. Direct health is connection-refused; proxied health is
   structured 502. The production web listener remains available on `0.0.0.0:3000`.
3. **Actual startup attempted:** `pnpm --filter @shipping/api start` exits with status 1 before
   listening. The startup log selects API port 3010, then throws:
   `ConfigError: Missing required environment variable: DATABASE_URL`.
4. **Required configuration absent:** no real root `.env` or web `.env.local`; `DATABASE_URL`,
   `AUTH_JWT_SECRET` and `AUTH_JWT_REFRESH_SECRET` are unset. Environment inspection reported
   presence/absence only, not secret values. Both token-secret variables must be configured
   before the existing configuration validator can complete.
5. **Database unavailable:** no PostgreSQL listener, installation or Docker service/cluster;
   no approved external database URL is configured. The user's server/database is not
   automatically present inside the Arena preview environment.
6. **Independent Prisma blocker:** importing `@prisma/client` fails because
   `.prisma/client/default` is absent. Fresh `pnpm db:generate` again fails at the checksum
   download for the matching native engine on restricted `binaries.prisma.sh`. A port change
   cannot resolve this generation dependency.

The old check established consistency only within the then-configured port; it did not establish
the correct project port. The current correction requires **3101**, including the proxy. Missing
services, configuration and generated client remain separate requirements for the user’s server. The
startup attempt used existing build output only for diagnosis, not as a claim that the API
build is valid; the previously reported API build failure remains unresolved.

## Admin account and password safety

- No database was connected, so account existence, activity/lock state, stored password hash,
  assigned roles and password validity **could not be checked**.
- No password reset, account edit, migration, seed or guessed credential was used.
- Backend auth/user-management code and Prisma schema/seed match baseline `da1ff0e` exactly.
  This establishes no repository-side changes there, not the state of an unreachable server.
- The seed creates a default admin only when absent. Its existing-user update changes profile,
  active and lock fields; therefore **do not run the seed to diagnose or repair an existing
  admin login**. An authorized read-only account check and normal authentication should come first.
- The supplied password matches a pre-existing sample/default literal in seed, demo and test
  files. It was not newly added to tracked files. Its presence in source does not prove it is
  the current database password. This inherited public-default exposure deserves a separate,
  explicitly approved security review if that password is used on a deployed server; it is not
  a reason to reset anything automatically or to attribute this 502 to an invalid password.

## Preservation, sensitive-data review and tests

This time the expected checkpoint `3aa1f1b15f54e68c49451f670785617a5fa93507` and final commit
`ec8fd51d510c36b1b393f5bf7b15378f4c4cd121` were present, with a clean tree at the start. No
replacement checkpoint was needed. The existing recovery archive and its internal checksums
passed; the isolated recovered bare repository passed `git fsck --full` and matched that tip.
The previous archive is retained. A new shallow-aware recovery archive includes this report.

The complete local baseline-relative file list and sensitive auth/proxy/env changes were reviewed.
The sole removed file remains the obsolete landing icon module, replaced by the existing landing
components. No new non-example `.env` files, private keys or recognizable GitHub/AWS key patterns
were found in tracked changes. Baseline-relative additions contain no occurrence of the existing
seed default password. Diagnostic artifacts remain ignored under `.handoff/`; no secrets or
business data are added to Git. Pattern checks do not certify every historical repository file
as secret-free, particularly the inherited sample-password references noted above.

Fresh checks in this continuation:

| Check | Result |
| --- | --- |
| Unmocked admin login | **Failed/blocked**, real 502; dashboard not reached |
| API startup | **Failed**, missing DATABASE_URL; no API listener created |
| Direct/proxied health | **Unavailable**, connection refused / 502 |
| Prisma generation / module import | **Blocked**, engine download / generated client absent |
| Web typecheck + lint | **Pass**, no lint warnings |
| Web contract + i18n checks | **Pass**, 2,114 messages ×3; existing contract skips unchanged |
| Browser regression suite | **22/22 pass**, 4.8 minutes; separate runner-only API/auth fixtures |
| Config unit tests | **10/10 pass** |
| API-port/script tests | **7/7 pass** |
| Frontend production build | Not rerun this turn: source/dependencies unchanged; previously validated build stays live |
| Real dashboard data, DB workflows, server RBAC | **Not verified**, real login never completed |

The passing mocked UI suite does not change the failed real-login result. No application code
was changed in this continuation; only evidence and handoff documentation were updated.

## Real-server acceptance (no longer a publication prerequisite)

Provide an approved backend/runtime and its database through secure environment configuration,
not credentials in source: database connectivity, both JWT secrets, matching generated Prisma
Client/native engine, and an existing authorized account. Alternatively, provide an approved
reachable non-production API origin in `API_INTERNAL_URL`; the current outbound restrictions
must allow that service. An admin email/password alone supplies none of those infrastructure
prerequisites. Do not substitute a freshly seeded database as evidence about the existing server.

Once provisioned, obtain healthy direct and proxied API responses; check the existing account
read-only; repeat the actual login; verify `/auth/me`, permission-filtered dashboard pages and
approved real-data workflows. Only then report real login as fixed. Publication preparation no longer waits for preview login.

GitHub operations remain disabled in this closed session. No remote fetch, push, ancestry check
or PR creation occurred, and no branch was merged. `origin/ai-test` and the working remote branch
are not cached locally. In a new GitHub-enabled session, preserve/import the recovery archive,
obtain actual remote history, inspect divergence and the complete `ai-test` diff, then use a
non-force push and a PR targeting `ai-test`; real login will be tested on the user's server.
The prepared PR body is documentation, not an existing GitHub PR.

---

## ops/api-port-correction.md

# Required API port correction — 2026-10-09

## Decision and publication hold

**The required backend API port is 3101. The frontend remains on 3000.**
The previous request for 3010 was a mistake; no active default, example, script, test fixture or
current deployment instruction uses it. Do **not** push, create a PR or merge anything until the
user has reviewed this correction and explicitly authorizes publication. Real server acceptance
remains with the user; do not resume Arena backend provisioning or login experiments.

The original project default was 3001. A conflict on that port led to 3101 as a workaround;
**3101 is now the required project default**, not a recommendation to restore 3001. Explicit
deployment overrides remain supported as requested, with both API and proxy configured together.
Historical default/override tests are explicitly labeled and are not active deployment settings.

```dotenv
# Backend service environment / protected repo-root .env
API_PORT=3101

# Next web environment / protected apps/web/.env.local
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://127.0.0.1:3101
```

The internal URL is an origin without `/api/v1`; the Next route adds that prefix. For separate
containers, retain the proper API service hostname rather than container-local loopback. Do not
change frontend port 3000, PostgreSQL port 5432 or CORS origins (which identify the frontend).
Retain real database/JWT secret configuration securely on the user's server; never copy sample
credentials over it. No admin, password, authentication, schema or business-rule change was made.

## Preservation before editing

On this restore, the branch was `arena/fe92d85a-duna` at shallow baseline `da1ff0e`, with the prior
work surviving as uncommitted files. Reported commit `4cdf7ec2b520981ee9e38ed118ad900df0e6f561`
and the reported recovery archive were absent.
All 126 intended restored file changes were reviewed and preserved first in checkpoint
**`74ffdaf0a240d702b6feb281e17e845e4c663862`**. Those are preserved earlier changes, not a new
redesign. The restored obsolete `components/home/icons.tsx` deletion remains intentional: its
landing component replacement and all assets survived. No work was discarded or history rewritten.

The following table lists **every file changed by this port correction relative to that checkpoint**.
The final archive additionally includes `PRESERVED-FILES.tsv`, enumerating each file preserved
by the checkpoint, and `CORRECTED-FILES.tsv`, enumerating the correction itself. The final
commit hash and recovery archive path are in the session report and archive README.

## File-by-file changes (20 files)

| File | Reason/change |
| --- | --- |
| `.env.example` | Correct API_PORT and server-only upstream example to 3101; leave frontend CORS origins and DB settings alone. |
| `apps/web/.env.example` | Correct API_INTERNAL_URL to loopback:3101; retain browser `/api/v1`. |
| `packages/config/src/load-config.ts` | Change Nest API port fallback to 3101; keep explicit environment precedence. |
| `apps/web/src/app/api/v1/[...path]/route.ts` | Correct server proxy fallback origin to port 3101; preserve forwarding, auth headers and status/error behavior. |
| `scripts/dev-api-port.mjs` | Correct absent/empty-port resolver fallback to 3101; retain dotenv parsing and validation. |
| `scripts/start-dev.sh` | Correct its default-port comment; actual startup checks already resolve the shared helper. |
| `packages/config/test/load-config.spec.ts` | Make normal fixture/default/empty expectations 3101; test historical 3001 and generic 4242 only as explicit overrides. |
| `scripts/test-api-port.mjs` | Correct all default assertions, use distinct override values, remove mistaken-port fixtures; add CLI, start/status/stop helper and unchanged web/DB-port guards (10 tests total). |
| `CLAUDE.md` | Correct project-wide default, proxy and development command instructions. |
| `README.md` | Correct API/Swagger URLs and examples; explain original 3001/workaround history and required 3101. |
| `docs/api.md` | Correct same-origin connectivity guidance and backend default. |
| `docs-gap/00-GAP-ANALYSIS.md` | Correct the runnable `pnpm dev` port annotation; do not recommend the obsolete default. |
| `docs/operations.md` | Correct current default, service table and request-path diagram. |
| `docs/operations.md` | Correct deployment environment matrix and port references; explicitly hold publication and mark commands as future/approval-only. |
| `docs/ui.md` | Correct the prepared PR description to 3101, update port-test count and state that no PR should be submitted yet. |
| `docs/ui/dashboard-redesign.md` | Replace the incorrect current-default banner with 3101 and link to this audit. |
| `docs/operations.md` | Correct deployable examples, fallback and startup guidance; retain earlier measurements as clearly historical, withdrawn-port evidence. |
| `docs/operations.md` | Label previous observed requests/logs as historical, remove the claim that the mistaken port was the correct project choice, and point to 3101 without fabricating a new login result. |
| `docs/progress.md` | Record the corrected port and publication hold; mark interim statements as superseded and clarify the original 3001 history. |
| `docs/operations.md` | New authoritative audit: decision, classification, complete changed-file manifest, checks, limitations and recovery rules. |

## Audited and intentionally unchanged

- `scripts/status-dev.sh` and `scripts/stop-dev.sh` obtain API_PORT from the corrected helper;
  no hard-coded incorrect port remains. Shell syntax and helper wiring are tested. No stop script
  was executed against user services.
- `scripts/verify-proxy.mjs` already describes a 3101 API and calls web:3000 `/api/v1`.
  The demo/seed scripts already target 3101. None were executed or used to alter an admin/DB.
- `apps/api/src/main.ts` reads `config.api.port`; its dotenv/config factory preserves environment
  overrides. API/workspace start commands delegate to this configuration, with no hidden CLI port.
- `apps/web/src/lib/api/client.ts`, Next configuration, web package scripts and Playwright config
  retain same-origin browser calls and frontend port 3000. Browser tests intercept `/api/v1`
  in the runner only; they do not need a hard-coded backend-port change.
- Backend integration tests instantiate Nest/Supertest instead of targeting the mistaken port.
  No API integration-test port reference required editing.
- The only deployment container file, `docker/docker-compose.dev.yml`, defines PostgreSQL 16,
  mapping 5432:5432. No API container/mapping, Dockerfile or CI workflow defining an API port was
  found in the repository. Do not invent new deployment infrastructure just to change this port.
- CORS examples contain web origins on 3000 (plus existing hostnames), not the API listener port;
  no CORS/auth weakening or unrelated service-port replacement is needed.
- Existing historical implementation logs with 3101, the documentation of an unrelated process
  on 3001, and the migration ID `20260903010012_phase5_inspection_management` remain unchanged.
  The migration's embedded digit sequence is **not** an API port.

## Repository-wide search classification

The initial search included tracked/restored-untracked source and hidden configuration, not just
`git grep` on the old baseline. Every occurrence of the three requested digit strings was reviewed.
Final source scans exclude Git object storage, dependency/build caches and ignored historical
backup/validation files; those are not editable active project configuration. The freshly built
Next route and compiled config package are checked separately for their actual default.

Allowed residual references to the **withdrawn port 3010** are limited to:

1. This audit's explanation of the error, never a setup command/default.
2. `docs/operations.md`: the withdrawn request in its historical table/banner.
3. `docs/operations.md`: clearly historical observed requests/startup logs. These
   were not relabeled to 3101, which would falsely claim a test that was not performed.
4. `docs/progress.md`: explicitly superseded interim observations and the unrelated migration ID.

There are **zero 3010 matches in active application/config/script/test source**, the environment
examples, README, CLAUDE instructions, runnable gap-analysis command or current API/runtime/PR/
deployment instructions. Preserved Git history/pre-correction bundles naturally contain earlier
versions; they are not deployment instructions and must not be rewritten or mistaken for the
latest archive's branch tip. Latest archive README/restore/deployment examples specify 3101.

Residual **3001** occurrences are only historical explanations and explicit-override test cases,
not a default or runnable recommendation. Use **3101** for this project. Generic container/host
and explicit port override capability remains supported without recommending another default.

## Validation of the corrected work

| Check | Current result |
| --- | --- |
| Config unit tests | **10/10 pass**: normal, absent/empty fallback 3101; explicit overrides preserved |
| Port/script tests | **10/10 pass**: loader/proxy/examples parity, precedence, quoting, validation, CLI, script wiring, web/DB ports |
| Shell syntax / read-only status | **Pass** for start/status/stop syntax; status selects 3101 by default and honors explicit 4242 |
| Shared/config builds and typechecks | **Pass** |
| Compiled config fallback | **3101**, verified in generated package output |
| Frontend typecheck / lint | **Pass**, zero lint warnings/errors |
| Translation/contract checks | **Pass**, 2,114 leaves ×3 locales; documented contract exclusions unchanged |
| Frontend production build | **Pass**, 108 generated static pages |
| Compiled Next proxy origin | **http://127.0.0.1:3101**, no withdrawn-port string in that route bundle |
| Browser regression suite | **22/22 pass**, 2.6 minutes, against the corrected production build (runner-only network fixtures) |
| Landing/login rendering / preview Host header | **200** for all six EN/FA/AR pages; no real login credentials submitted |
| Real API/DB/admin authentication | **Unavailable/unverified**, not retried or fabricated |
| GitHub push / PR / merge | **Not attempted**, explicitly prohibited by the user |

The frontend production server is on `0.0.0.0:3000`. No API/database process, dummy auth session,
fake business data, migration or seed is introduced. Existing environment/Prisma constraints are
reported separately from these passing frontend/config tests, not treated as reasons to undo the
port correction. Backend business logic, schemas and admin credentials are unchanged.

## Recovery and subsequent review

The latest ignored recovery archive contains the final branch bundle, reachable shallow-boundary
metadata, exact restore instructions, checksums, this file-by-file audit, corrected deployment/PR
documents and preserved/corrected file inventories. Import into a **new** bare repository with its
saved shallow metadata, then verify commit and tree equality plus `git fsck --full`. A bundle alone
is not sufficient for this restored shallow checkout. Keep an independent downloaded copy.

Current instructions must say 3101. A pre-correction checkpoint is retained only for preservation,
not as the deployment tip. **No publication now**: review the correction first. Even in a later
GitHub-enabled session, wait for explicit approval before fetching/reconciling for publication,
non-force pushing this branch or opening a PR to `ai-test`. Never force-push or auto-merge.

---

## ops/arena-sandbox-run-2026-10-19.md

# Arena sandbox run record — 2026-10-19

> **خلاصهٔ فارسی:** رکورد اجرای واقعی تست‌ها در سندباکس Arena در تاریخ ۲۰۲۶-۱۰-۱۹ روی
> کامیت `c181402`. نتیجه: هر ۳۴ سوئیت e2e و ۵۹۰ تست API با موتور **native** پریزما و
> PostgreSQL 16.14 موفق بودند؛ typecheck و lint و گاردهای وب هم پاک بودند. تنها مورد
> اجرا‌نشده، تست‌های سطح مرورگر (Playwright) است چون مرورگری در سندباکس موجود نیست.

**Environment.** Base commit `c181402` · Node 22.22.3 · pnpm 9.15.9 · PostgreSQL 16.14
(npm `@embedded-postgres/linux-x64@16.14.0-beta.17`) · Prisma 5.22.0 with the **native**
`libquery_engine-debian-openssl-3.0.x.so.node` served by the local mirror
(`PRISMA_ENGINES_MIRROR=http://127.0.0.1:4555`) — *not* the WASM substitute used in the
2026-10-12 record. Bring-up procedure: [`arena-sandbox-runtime.md`](arena-sandbox-runtime.md).

**What this record is.** A dated record of what was executed here. It is not a server
baseline; nothing on an owner server was touched and no production database was accessed.

---

## 1 · Services verified live

| Probe | Result |
| --- | --- |
| `http://127.0.0.1:4555/all_commits` (engine mirror) | HTTP 404 as expected for a non-existent engine path; the server answers |
| `http://127.0.0.1:3101/api/v1/health` | HTTP 200, `status: ok`, `database.status: up` |
| `http://127.0.0.1:3101/docs` (Swagger) | HTTP 200 |
| `http://127.0.0.1:3000/en/login` | HTTP 200 |
| `http://127.0.0.1:3000/api/v1/health` (same-origin proxy) | HTTP 200 |
| `POST /api/v1/auth/login` through the proxy (`admin@shipping.local`) | HTTP 200, `accessToken` 193 chars, 209 permissions |
| `POST /api/v1/auth/login` through the proxy (`agent@portal.local`, demo seed) | HTTP 200, role `PORTAL_AGENT` |
| `GET /fa/dashboard` | HTTP 200, 186,401 bytes, 15 `/_next/static/chunks/*.js`; chunk fetch HTTP 200 |

Authenticated reads through the proxy on the demo-seeded database (`duna_seed_test`):
`/ports` 2 · `/vessels` 2 · `/voyages` 3 · `/cargo` 3 · `/customers` 3 · `/inspections` 2 ·
`/load-lists` 1 · `/bills` 4 · `/invoices` 1 · `/manifests` 2 · `/release-orders` 3 ·
`/delivery-orders` 1 · `/agents` 2 · `/users` 3 · `/roles` 4 · `/permissions` 214 (paged, 25).

Database/schema state: **49 migrations** applied with `prisma migrate deploy` (schema engine
18,802,864 bytes from the mirror), core seed + opt-in demo seed, 93+ public tables.

## 2 · API e2e suites — 34/34 suites, 590/590 tests

| Run | Command scope | Result |
| --- | --- | --- |
| 1 | `pnpm --filter @shipping/api test` (all 34 suites) on `duna_arena_e2e` | **31 suites / 563 tests passed**; 3 suites failed *before any test ran* because their environment gates were not satisfied (27 blocked tests) |
| 2 | `attachment-settings` + `portal-agent-isolation` with the gates satisfied | **2 suites / 21 tests passed** |
| 3 | `phase11-security` against `duna_phase11_arena` | **1 suite / 6 tests passed** |

Gates that had to be satisfied (all are deliberate fail-closed guards in the suites, not
product defects):

| Suite | Gate | How it was satisfied |
| --- | --- | --- |
| `attachment-settings` | `ATTACHMENT_STORAGE_DIR` absolute + `ATTACHMENT_URL_SECRET` ≥ 32 + `ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true` + a `RetentionPolicy` row for `IDENTITY_DOCUMENT` | Sandbox `.env` values, plus one fixture row in the disposable database (`minimumDays` 30, `secureDeleteAfterDays` 365, authority/lawfulBasis marked as a test fixture). `archiveAfterDays` must stay NULL for that scope — the `RetentionPolicy_archive_check` constraint only allows it for `LETTER`. |
| `portal-agent-isolation` | `PORTAL_ISOLATION_TEST_DATABASE_URL/_NAME` (name must contain `test`) + `PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB` | Dedicated `duna_arena_test` database (migrated + core-seeded) |
| `phase11-security` | `PHASE11_ISOLATED_TEST_DB_NAME` matching `^duna_phase11_[a-z0-9_]+$`, runtime role ≠ table owner, non-superuser, both audit triggers enabled, no `UPDATE`/`DELETE` on `AuditLog` | `scripts/arena/phase11-isolated-db.sh` → `duna_phase11_arena`, migrated as owner `shipping_owner_p11`, runtime `shipping_runtime_p11` left with `SELECT`/`INSERT` only. Verified state: `{"owner":"shipping_owner_p11","can_select":true,"can_insert":true,"can_update":false,"can_delete":false,"triggers":2}` |

The `prisma:error … permission denied for table AuditLog` (SQLSTATE `42501`) lines inside
run 3 are the assertions working, not failures.

## 3 · Other checks

| Check | Command | Result |
| --- | --- | --- |
| `packages/config` unit tests | `pnpm --filter @shipping/config test` | **10/10 passed**, exit 0 |
| Web guards | `pnpm --filter @shipping/web test` | exit 0 — contract guard OK (19 shared status unions ⊆ Prisma enums; 128 web `api.post` routes ⊆ 143 controller `@Post` routes), navigation guard OK (48 items / 44 implemented, Agent Portal intact), page-size guard OK, i18n guard OK (2817 messages, 3 locales), portal landing 4/4, `node --test` **8/8** |
| Typecheck | `pnpm typecheck` | exit 0 — `packages/config`, `packages/shared`, `apps/api`, `apps/web` |
| Lint | `pnpm lint` | exit 0 — **0 errors, 24 warnings** (the `prefer-const` error recorded on 2026-10-12 is not present at this base commit) |
| API build | `pnpm build:api` | `API build verified: apps/api/dist/src/main.js, 242 compiled modules.` |
| Web build | `pnpm build:web` | exit 0, all `[locale]` routes emitted plus `ƒ /api/v1/[...path]` proxy |
| Bring-up idempotency | `bash scripts/arena/prepare.sh` (second, full run) | exit 0 end-to-end; existing `.env`/`.env.local` left untouched |

## 4 · Not executed, with reason

| Item | Reason |
| --- | --- |
| Browser-level UI tests (`pnpm --filter @shipping/web test:ui`) | `@playwright/test` is installed but no browser binary exists in the sandbox and the Playwright download hosts are outside the outbound allow-list. UI behaviour was verified through the same-origin proxy (the exact requests the browser makes) and by SSR/asset probes. |
| Server baseline on the owner's infrastructure | No owner-server access from this sandbox. |
| Backup/restore rehearsal (`pg_dump`/`pg_restore`) | Those client tools do not ship in `@embedded-postgres/linux-x64` (only `postgres`, `initdb`, `pg_ctl`). |
| Notification e-mail delivery | No SMTP transport configured in the sandbox; in-app rules only. |

## 5 · Failures found and fixed during bring-up

| # | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| 1 | `prisma generate` / `migrate deploy` fail: `binaries.prisma.sh … socket disconnected` | Host outside the allow-list | `scripts/arena/engine-mirror.mjs` + `PRISMA_ENGINES_MIRROR` |
| 2 | `scripts/start-api.sh` exits 1: `STOP: owner confirmed duna_seed_test` | Phase 11 preflight requires `PHASE11_APPROVED_DB_NAME` and the `shipping_runtime_p11@…/duna_seed_test` target | Sandbox `.env` generated with exactly that target; the guard is satisfied, not bypassed |
| 3 | Migration `20260929164932_voyage_destination_legs` fails: `could not access file "$libdir/plpgsql"` | The PostgreSQL server had been started from a directory that was later moved, so the resolved `PKGLIBDIR`/`SHAREDIR` pointed at the old path | Restart the server from its final location; `scripts/arena/db.mjs` keeps binaries and `pgdata` together under `.arena-tools/` |
| 4 | Same `plpgsql` error on a freshly created database | `create database … template template0` — `template0` has no `plpgsql` | `scripts/arena/db.mjs provision` creates databases from the default template |
| 5 | `scripts/arena/db.mjs provision` failed with `syntax error at or near "$1"` | `CREATE ROLE … PASSWORD $1` — DDL cannot be parameterized | Inlined as a quoted literal with single quotes doubled |
| 6 | In the hosted preview: login works but every dashboard section shows `Unable to load this view / Authentication required` | `JwtAuthGuard` throws that exact message only when **no bearer header arrives**. The preview tunnel does not pass the browser's `Authorization` header, so only unauthenticated calls (`/health`) and login (credentials in the body) succeeded | Cookie bridge in the same-origin proxy (`duna_at` / `duna_rt`, httpOnly) that re-attaches the bearer only when the browser sent none, supplies the rotating refresh token for `auth/refresh`/`auth/logout`, and clears both on logout; `AuthProvider` retries `/auth/me` without a local token |

Verification of fix 6 (same-origin proxy, `127.0.0.1:3000`): login → `duna_at` + `duna_rt` set;
`/auth/me`, `/voyages`, `/cargo`, `/bills`, `/permissions` all `200` with the cookie **and no
`Authorization` header**; bearer-only requests still `200`; anonymous still `401`;
`auth/refresh` with an empty body and only the cookie returns a rotated pair; logout returns
`200` (refresh token taken from the cookie, so the API revokes it) and a following `/voyages`
is `401`. Driven by a Node `fetch` client with an RFC-6265 cookie store; `pnpm --filter
@shipping/web test` (8/8) and `typecheck`/`lint` remain clean.

---

## ops/arena-sandbox-runtime.md

# Arena sandbox runtime — how this repository is brought up inside an Arena agent sandbox

> **خلاصهٔ فارسی:** این سند نحوهٔ اجرای کامل پروژه در سندباکس Arena را توضیح می‌دهد:
> آینهٔ محلی موتورهای Prisma، راه‌اندازی PostgreSQL 16 از بستهٔ npm، ساخت پایگاه‌داده،
> اجرای migration/seed، ساخت API و Web و در نهایت تست‌ها. تمام ابزارها در
> `scripts/arena/` قرار دارند و داده‌ها در `.arena-tools/` (خارج از Git) نگه‌داری می‌شوند.

**Date of this record:** 2026-10-19 · **Base commit:** `c181402` · **Node:** 22.22.3 · **pnpm:** 9.15.9

This documents a *disposable sandbox* bring-up. It is not a production deployment path and it
does not replace [`fresh-server-install.md`](../fresh-server-install.md) or
[`publication-handoff.md`](publication-handoff.md).

---

## 1 · Why the documented paths do not work in the sandbox

| Blocker | Observed | Resolution used here |
| --- | --- | --- |
| Prisma engine download | `prisma generate` / `prisma migrate deploy` fail with `request to https://binaries.prisma.sh/... failed, reason: Client network socket disconnected before secure TLS connection was established`. `binaries.prisma.sh` and `objects.githubusercontent.com` are outside the outbound allow-list (`HTTP 000`). | `scripts/arena/engine-mirror.mjs` serves a local copy of the exact engine build (`all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/debian-openssl-3.0.x/…`, cloned from the public GitHub mirror `owengretzinger/prisma-engines-mirror`, which *is* reachable) and the CLI is pointed at it with `PRISMA_ENGINES_MIRROR`. The upstream `.sha256` files are served alongside, so Prisma still verifies checksums. **The native engine is used — not the WASM substitute.** |
| No Docker Engine, no PostgreSQL packages | `docker` is absent; Debian repositories are unreachable. | `scripts/arena/db.mjs` runs real PostgreSQL **16.14** from the npm package `@embedded-postgres/linux-x64` (`initdb` + `pg_ctl`), listening on `127.0.0.1:5432`. |
| No `psql`/`createdb` in that package | Only `postgres`, `initdb`, `pg_ctl` ship in it. | Role/database provisioning is done with the `pg` client (`node scripts/arena/db.mjs provision`). |
| `scripts/start-api.sh` preflight | `scripts/check-phase11-api-target.mjs` refuses to start unless `PHASE11_APPROVED_DB_NAME=duna_seed_test` **and** `DATABASE_URL` is `shipping_runtime_p11@127.0.0.1:5432/duna_seed_test`. | The sandbox `.env` is generated with exactly that target, and `PHASE11_APPROVED_DB_NAME` is exported when the API starts. The guard is satisfied, not bypassed. |

Two sandbox-specific PostgreSQL facts worth keeping:

1. **Do not move the engine package after installing it.** PostgreSQL resolves `$libdir`
   (`PKGLIBDIR`) and `SHAREDIR` at server start from the executable's location. After the
   package had been installed elsewhere and moved, `plpgsql` stopped loading
   (`could not access file "$libdir/plpgsql"`) and migration `20260929164932` failed.
   Restarting the server from the final location fixed it.
2. **Create databases from the default template, not `template0`.** `template0` has no
   `plpgsql`, and this schema's triggers/functions are written in `plpgsql`.

---

## 2 · Services

| Service | Bind | Started with |
| --- | --- | --- |
| Prisma engine mirror | `127.0.0.1:4555` | `node scripts/arena/engine-mirror.mjs` |
| PostgreSQL 16.14 | `127.0.0.1:5432` | `node scripts/arena/db.mjs start` |
| NestJS API | `0.0.0.0:3101` (live preview; `ARENA_API_HOST=127.0.0.1` keeps it internal) | `PHASE11_APPROVED_DB_NAME=duna_seed_test bash scripts/start-api.sh` |
| Next.js web | `0.0.0.0:3000` (live preview) | `cd apps/web && npx next start -H 0.0.0.0 -p 3000` |

The browser still reaches the API through the existing same-origin `/api/v1/[...path]` proxy;
the API's own `3101` preview exposes `/api/v1` and Swagger (`/docs`) directly. Set
`ARENA_API_HOST=127.0.0.1` before `prepare.sh` if only the web preview should be public.

### Cookie bridge for hosted previews

Sandbox preview tunnels can drop the browser's `Authorization` header, and third-party-iframe
storage can be unavailable. The API then answers every authenticated call with
`401 Authentication required` (that exact message means *no bearer header arrived*) while login
itself still works, so the dashboard shell renders and every section fails.

The proxy in `apps/web/src/app/api/v1/[...path]/route.ts` therefore mirrors the tokens it
already sees in the `auth/login` / `auth/refresh` response bodies into httpOnly cookies
(`duna_at`, `duna_rt`) and re-attaches them as the bearer header **only when the browser sent
none**. It also supplies the rotating refresh token from `duna_rt` for `auth/refresh` and
`auth/logout`, and clears both cookies on logout. An explicit bearer header always wins, so API
clients, the e2e suites and normal deployments are unaffected. `AuthProvider` now calls
`/auth/me` once even without a locally stored token, so a preview reload restores the session
instead of forcing a re-login.

Cookie attributes adapt to the transport: `Secure; SameSite=None; Partitioned` over HTTPS,
`SameSite=Lax` for plain local development (`WEB_ACCESS_COOKIE_TTL_SECONDS` defaults to 900 s,
`WEB_REFRESH_COOKIE_TTL_SECONDS` to 604800 s).

### Opening a preview URL directly in a browser

E2B sandbox URLs may require an `e2b-traffic-access-token` header; a plain browser request then
gets `403 Forbidden — Missing traffic access token`. That is a platform setting
(`allowPublicTraffic`) fixed when the sandbox was created, it cannot be changed from inside the
sandbox, and a browser address bar cannot send that header. Use the Arena preview panel, which
supplies the token.

Databases (all disposable, all on the sandbox cluster):

| Database | Purpose |
| --- | --- |
| `duna_seed_test` | Dashboard database; role `shipping_runtime_p11`; required seed **+ opt-in demo seed** |
| `duna_arena_e2e` | API e2e suites |
| `duna_arena_test` | `portal-agent-isolation` suite (`PORTAL_ISOLATION_TEST_DATABASE_*`) |
| `duna_phase11_arena` | `phase11-security` suite; owned by `shipping_owner_p11`, runtime role is append-only on `AuditLog` |

---

## 3 · Bring-up

```bash
# 1. one-shot, idempotent: env files, mirror check, PostgreSQL, generate/migrate/seed, builds
node scripts/arena/engine-mirror.mjs &        # or start it with the process tools
bash scripts/arena/prepare.sh                 # add --with-demo for sample business records

# 2. start the services (process tools in Arena, so they appear as live previews)
PHASE11_APPROVED_DB_NAME=duna_seed_test bash scripts/start-api.sh
(cd apps/web && npx next start -H 0.0.0.0 -p 3000)

# 3. status / probes
bash scripts/arena/status.sh
```

`prepare.sh` writes `.env` and `apps/web/.env.local` **only if they are missing**; both are
gitignored. Secrets are generated with `openssl rand`, the database password is kept in
`.arena-tools/runtime-db-password` (mode 0600) and reused on later runs.

Sandbox login (seed defaults): `admin@shipping.local` / `ChangeMe123!`.
With `--with-demo` (or `pnpm db:seed:demo`), the documented portal accounts also exist:
`agent@portal.local` and `agent2@portal.local`, both `ChangeMe123!`.

Everything below the repository (`.arena-tools/`) is disposable and gitignored: engine
binaries, `pgdata`, logs, generated passwords.

---

## 4 · Tests in the sandbox

```bash
# 34 API e2e suites — the three gated ones need explicit, disposable fixtures:
export DATABASE_URL="postgresql://shipping_runtime_p11:$(cat .arena-tools/runtime-db-password)@127.0.0.1:5432/duna_arena_e2e?schema=public"
export ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true
export PORTAL_ISOLATION_TEST_DATABASE_URL="postgresql://shipping_runtime_p11:$(cat .arena-tools/runtime-db-password)@127.0.0.1:5432/duna_arena_test?schema=public"
export PORTAL_ISOLATION_TEST_DATABASE_NAME=duna_arena_test
export PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB
pnpm --filter @shipping/api test

# the phase11 suite additionally needs the role-separated append-only database:
bash scripts/arena/phase11-isolated-db.sh
PHASE11_ISOLATED_TEST_DB_NAME=duna_phase11_arena \
DATABASE_URL="postgresql://shipping_runtime_p11:$(cat .arena-tools/runtime-db-password)@127.0.0.1:5432/duna_phase11_arena?schema=public" \
  pnpm --filter @shipping/api exec jest --config test/jest-e2e.cjs test/phase11-security.e2e-spec.ts
```

Test-environment prerequisites that the suites enforce (they fail closed on purpose):

| Suite | Requirement |
| --- | --- |
| `attachment-settings` | `ATTACHMENT_STORAGE_DIR` (absolute, outside the repo), `ATTACHMENT_URL_SECRET` ≥ 32 chars, `ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true`, and a `RetentionPolicy` row for `IDENTITY_DOCUMENT` with `minimumDays`, `authority` and `lawfulBasis` |
| `portal-agent-isolation` | `PORTAL_ISOLATION_TEST_DATABASE_URL`, `PORTAL_ISOLATION_TEST_DATABASE_NAME` (must contain `test`) and `PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB` |
| `phase11-security` | `PHASE11_ISOLATED_TEST_DB_NAME` matching `^duna_phase11_[a-z0-9_]+$`, runtime role ≠ table owner, non-superuser, both audit triggers enabled, no `UPDATE`/`DELETE` on `AuditLog` |

`RetentionPolicy` rows cannot be deleted (trigger `phase12_protect_retention_policy`), so the
fixture row belongs in a throwaway database only.

Not runnable here: **browser-level UI tests**. `@playwright/test` is installed but no browser
binary is available and the Playwright/CDN hosts are outside the allow-list. UI behaviour is
therefore verified through the same-origin proxy (the exact requests the browser makes), plus
`pnpm --filter @shipping/web test` guards.

---

## 5 · After a sandbox recycle

Processes do not survive it; `.arena-tools/` may or may not survive. Re-running
`bash scripts/arena/prepare.sh` is enough in both cases: it reinstalls the PostgreSQL package
and re-clones the engine mirror when they are missing, and it is a no-op for parts that are
already in place. Then start the three services again (section 3, step 2).

---

## ops/backend-connection-audit.md

# Backend connection and publication handoff — 2026-10-09

> Historical diagnostics, with deployment examples corrected to the required API port **3101**.
> The earlier request for 3010 was erroneous and has been withdrawn; it is retained below only
> in explicitly historical evidence, never as an active recommendation. Current validation and
> file-by-file changes: [port-correction audit](api-port-correction.md). **Do not publish yet.**

## Preservation and Git facts

The resumption started on `arena/fe92d85a-duna` at shallow baseline
`da1ff0ee0ea138c26c22870a6c20cf37109248ae`. All restored landing/dashboard changes
were again unstaged/untracked, not in the reported local history. These exact objects are absent:

- Reported checkpoint `ba48f28869cb5607847ba195420151f3fca3297b`
- Reported final commit `20ca01cd2b2151beccdd1a80bde49b45d05f0f93`
- User-supplied landing commit `c3b5c5360c730ec4ee0bd6157e6d6552cc6035a`

The previously reported external bundles also were not present. After checking paths,
source/config diffs, deletion references, artifacts and recognizable credential patterns,
111 intended file changes were preserved in **`3aa1f1b15f54e68c49451f670785617a5fa93507`**.
No existing source changes were discarded, no branch was switched and no history was rewritten.
The only baseline-relative deletion is the obsolete `components/home/icons.tsx`; the replacement
landing components/icons and their assets are included and all pages build successfully.

The landing page's sections, translated catalogs, images, self-hosted fonts and auth links are
present. This is a file-level finding, **not verification that the user-supplied landing commit
is an ancestor or that the files match current GitHub**. The current follow-up leaves all preserved
frontend design/components/tests unchanged; its only web runtime changes are the proxy's port
fallback and web environment example.

Configured origin: `https://github.com/arashalidadi/duna.git`. Only cached `origin/main` and
`origin/HEAD` exist locally, both at `1875ed576a98765bfe0560361c4eb2328c3cf53f`.
There are no cached `origin/ai-test` or `origin/arena/fe92d85a-duna` refs. Remote operations
are disabled in this closed coding session: **no GitHub fetch, push or PR creation was attempted**.
Thus a complete diff against **actual** `ai-test`, remote ancestry and safe-push eligibility remain
unverified. The reviewed local baseline diff is not a substitute for that comparison.

### Backup caveat and correction

`git rev-parse --is-shallow-repository` is true. A plain bundle passed `git bundle verify`, but
an isolated import failed because the parent of the shallow boundary is absent. This disproves
any assumption that bundle verification alone establishes a self-contained full-history backup.
An isolated bare import with the saved, reachable shallow boundary succeeded, passed `git fsck
--full`, and reproduced the checkpoint tree hash exactly. The final recovery archive similarly
contains a bundle **and** its required shallow-boundary metadata with restoration instructions.
It preserves the available local history; it does not invent or replace missing remote ancestors.

Backups/evidence live in ignored `.handoff/`, not in source commits. Download the final archive
from the session deliverable and keep an independent copy: prior workspace restores lost both
Git objects and backups outside the repository. The final commit hash/archive path are reported
in the final handoff and recorded in the archive's README. Do not publish backup binaries to Git.

## Port diagnosis — a combination of inconsistent defaults and absent services

Historical state before the earlier, now-superseded change:

| Location | Port/configuration |
| --- | --- |
| `packages/config/src/load-config.ts` fallback | 3001 |
| Root `.env.example` | 3101 |
| Next proxy fallback + web `.env.example` | 3101 |
| Detached start/status/stop scripts | hard-coded 3101, even with an API_PORT override |
| Recent historical workstation docs | 3101, a workaround for another service using 3001 |
| Earlier mistaken request (withdrawn) | 3010, not configured in that checkout; required project port is 3101 |
| Historical API listener observation | none on the then-inspected ports; no backend availability is claimed |

**3101 is the required project API port and the aligned default.** The original 3001 default
was superseded by the 3101 workaround, now the required setting. Explicit deployment overrides
remain supported when both API and proxy agree; no endpoints, auth checks or business rules change.

```dotenv
# Backend: repo-root .env or environment supplied to Nest
API_HOST=0.0.0.0
API_PORT=3101

# Web: apps/web/.env.local or environment supplied to Next
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://127.0.0.1:3101
```

`API_INTERNAL_URL` is an origin, without `/api/v1`; the proxy adds that prefix. It is server-only.
For an explicitly different backend port, update **both** `API_PORT` and `API_INTERNAL_URL`.
The detached scripts now resolve their API checks from exported `API_PORT`, then repo `.env`,
then 3101. They no longer execute `.env` as shell code or let it silently overwrite an exported
API port. Root `.env` remains loaded by the existing Nest config factory. Next separately reads
its web environment file. Restart affected services after changes; rebuild after `NEXT_PUBLIC_*`
changes. For separate containers, use the API's service hostname rather than loopback.

No browser code calls sandbox localhost. Same-origin forwarding, bearer headers, refresh-token
contracts, timeout behavior, structured outage 502 and upstream status forwarding are unchanged.
Historical logs and old demo-seeding scripts already reference 3101 consistently. Those demo
scripts were neither run nor rewritten; they are not a way to repair an existing admin account.

## Database and startup prerequisites

The Docker Compose development file provides **PostgreSQL 16 on 5432 only**, with a named volume;
there is no API service/port mapping in that file. The standalone database script is an alternative
for a previously provisioned workstation. It refers to `/home/arash/shipping-erp/pgdata` and
`/tmp/opencode/pgroot`; neither exists here. An external PostgreSQL service is also supported via
`DATABASE_URL`, but none is configured/approved in this workspace.

Current checks found:

- No Docker executable or socket; no postgres, pg_ctl or psql executable; no local cluster/listener.
- No real root `.env` or web `.env.local` (examples only).
- `DATABASE_URL`, `AUTH_JWT_SECRET`, `AUTH_JWT_REFRESH_SECRET`, `API_PORT` and
  `API_INTERNAL_URL` initially unset. Only presence/absence was inspected; no secret values printed.
- No supplied authorized database account/application login.

Consequently neither API nor database was started. No migrations, seeds, DB resets, production
connections, guessed credentials or backend responses were used to manufacture a working login.
No existing services were stopped: the restored runtime initially had none of the app services.
The web's production preview has now been restored on `0.0.0.0:3000`.

## Prisma failure, independently diagnosed

A fresh `pnpm db:generate` fails before generation when downloading the checksum for
`libquery_engine.so.node` from `binaries.prisma.sh`, with a TLS connection-disconnected error.
This host is outside this environment's outbound allow-list. Dependencies were installed with a
frozen lockfile and scripts disabled, then generation was explicitly attempted so the failure was
visible rather than hidden in install hooks.

- Prisma CLI and client both resolve to **5.22.0**; no version mismatch was found.
- Node **22**, Debian **12**, OpenSSL **3.0.20** are present.
- Prisma detects **debian-openssl-3.0.x**, matching the engine being requested.
- Schema uses the standard `prisma-client-js` generator and PostgreSQL `DATABASE_URL` datasource,
  with no custom engine mirror/binary path configured.

The immediate failure is the restricted engine download, **not the API port**. No missing OpenSSL
or wrong target is evidenced at this stage; engine execution cannot be tested until it is obtained.
API build currently fails on missing generated Prisma types/client (930 cascading diagnostics).
No schema/client upgrades, TLS-disable flags or fake generated client were introduced.

To unblock: use an approved build/runtime environment able to obtain the matching Prisma engine;
provision isolated PostgreSQL (or an approved reachable non-production service); supply DB URL
and unique JWT secrets through secret configuration; generate Prisma and build the API; apply
reviewed migrations and reference seed only to that approved database. Start Nest on 3101 (or a
matched explicit override), verify direct **and proxied** health, then use an authorized account
for real login/refresh/logout, server RBAC and database workflow tests. Existing accounts or
approved account provisioning are required; example/default passwords are not verified credentials.

## Historical validation from the earlier resumption (not current correction results)

| Check | Result |
| --- | --- |
| Config unit tests | **10/10 pass**, including then-current default/empty-port and explicit-override cases |
| `node scripts/test-api-port.mjs` | **7/7 pass**, defaults/examples/proxy parity, dotenv precedence, quoting, invalid ports and safe script failure |
| Shell syntax; status with default and 3101 override | **Pass**, reads actual configured API port; does not start/stop services |
| Shared/config builds + typechecks | **Pass** |
| Web typecheck + lint | **Pass**, no lint warnings |
| Web contract + i18n checks | **Pass**, 2,114 messages ×3; existing documented contract-check exclusions remain |
| Production build | **Pass**, 108 generated static pages |
| Existing Chromium UI regression suite | **22/22 pass**, 4.7 minutes, runner-only network fixtures |
| Landing/login via preview Host header | **200** in EN/FA/AR |
| Real proxied `/api/v1/health` | **502 UPSTREAM_UNAVAILABLE**, not a healthy API |
| Direct API ports examined in that earlier session | connection refused; historical observation only |
| Prisma generation / API build | **Blocked/fail** as detailed above |
| Real authorized login / database workflows / server RBAC | **Not verified**; required services/config/accounts absent |

The UI test command exceeded the tool's first 240-second wait; the existing test process was
allowed to finish without starting a duplicate run. Its final report is 22 passed. API E2E was not
rerun against an absent database. Earlier API lint failures and backend test reports remain historical;
this change does not claim to fix them. Backend business source and Prisma schema/migrations are
unchanged. The only backend configuration change is the default API port plus regression tests.

## Safe GitHub publication — next session only

PR body is prepared in `docs/ui.md`; no PR exists from this resumption.
In a new GitHub-enabled session on the intended branch:

1. Verify the recovery archive, local status and local commits first. Preserve any new work.
2. Fetch the actual `ai-test` and `arena/fe92d85a-duna` refs; deepen/unshallow as needed before
   relying on merge-base/ancestry. Do not treat this checkout's cached main ref as remote truth.
3. Inspect `HEAD...origin/arena/fe92d85a-duna` in both directions and require the existing remote
   branch to be an ancestor of the proposed local tip before a fast-forward push. If it diverges,
   stop for a reviewed reconciliation that preserves remote commits—never force-push.
4. Review the actual three-dot PR diff `origin/ai-test...HEAD`: source, file deletions, landing
   sections/assets, generated files, environments and secrets. Check the user's landing commit
   using fetched objects; avoid duplicating already-merged landing content.
5. Only after those checks, perform `git push origin arena/fe92d85a-duna` (non-force).
6. Check for an existing PR before creating one. If needed, create with **base `ai-test`** and
   **head `arena/fe92d85a-duna`**, using the prepared body. Record actual remote commit/PR URLs.
7. Do not merge automatically into `ai-test` or `main`; the user will review and approve.

No remote comparison or publication was possible here, so no GitHub commit or PR URL is asserted
as evidence. Branch/compare URLs alone are navigation aids, not proof that this work is published.

---

## ops/https-dashboard.3ree.eu.cc.md

# HTTPS vhost proposal for dashboard.3ree.eu.cc (APPLY WITH ROOT / SUDO)

Diagnosis date: 2026-09-04.

## Root cause (verified)

- DNS for `dashboard.3ree.eu.cc` is proxied through Cloudflare (orange cloud):
  A `188.114.96.3` / `188.114.97.3`, AAAA `2a06:98c1:3120::3` / `2a06:98c1:3121::3`.
- Cloudflare terminates the viewer TLS with the valid wildcard cert
  `*.3ree.eu.cc` (Let's Encrypt, `CN=3ree.eu.cc`, valid 2026-08-08 .. 2026-11-06).
  So the browser's TLS handshake succeeds and "connects".
- Cloudflare SSL mode is **Full** -> it reaches the ORIGIN on **:443**.
- The origin nginx has **no server block for `dashboard.3ree.eu.cc` on :443**
  (the existing `dashboard.3ree.eu.cc` block only listens on :80).
  The :443 listener matches the panel/default server (expired
  `CN=panel.3ree.eu.cc` cert) and serves nginx's default
  `/var/www/html/index.html` "Welcome to nginx!" page.

Therefore:
- http://dashboard.3ree.eu.cc/           -> app  (works)
- https://dashboard.3ree.eu.cc/          -> "Welcome to nginx!" (wrong site)
- https://dashboard.3ree.eu.cc/api/v1/health -> nginx welcome page, NOT the API

## Fix

Add a `listen 443 ssl` server block for `dashboard.3ree.eu.cc` REUSING the
existing Let's Encrypt **wildcard** certificate that already covers this
hostname (`*.3ree.eu.cc`, in `/etc/letsencrypt/live/3ree.eu.cc/`). Same upstream
and proxy headers as the working :80 block. This is the smallest safe change:
it adds a vhost and does not touch the `3ree.eu.cc` / panel configuration.

### Proposed `/etc/nginx/sites-available/dashboard.3ree.eu.cc`

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name dashboard.3ree.eu.cc;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;

    server_name dashboard.3ree.eu.cc;

    ssl_certificate     /etc/letsencrypt/live/3ree.eu.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/3ree.eu.cc/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!eNULL:!MD5:!RC4:!ADH:!SSLv3:!EXP:!PSK:!DSS;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

CAUTION: the wildcard private key at
`/etc/letsencrypt/live/3ree.eu.cc/privkey.pem` is the SAME key already used by
the `3ree.eu.cc` server block (port 8443). Reusing the same key for a new vhost
of the same wildcard domain is safe and does NOT break the panel.

## Apply (requires sudo / root)

```bash
sudo cp /etc/nginx/sites-available/dashboard.3ree.eu.cc \
        /etc/nginx/sites-available/dashboard.3ree.eu.cc.bak.$(date +%s)   # backup (rollback)
# edit /etc/nginx/sites-available/dashboard.3ree.eu.cc with the content above
sudo nginx -t                                                              # MUST pass
sudo systemctl reload nginx
```

## Verify (sudo not needed for these)

```bash
sudo ss -lntp | grep ':443'                                  # nginx listens on 443
openssl s_client -connect 127.0.0.1:443 -servername dashboard.3ree.eu.cc \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
curl -I https://dashboard.3ree.eu.cc/                        # expect X-Powered-By: Next.js (app), 200
curl -sS https://dashboard.3ree.eu.cc/api/v1/health          # expect {"success":true,...}
curl -sS -X POST https://dashboard.3ree.eu.cc/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@shipping.local","password":"<redacted>"}'   # expect success:true
curl -I http://dashboard.3ree.eu.cc/                         # HTTP still works (or 301 if redirect added)
curl -skI https://panel1.3ree.eu.cc/LHv4xQI456Th/            # panel unchanged
```

## Optional: http->https

Only AFTER the :443 vhost is verified, if desired add `return 301 https://$host$request_uri;`
in the :80 server block. Do NOT add it in the same edit as the :443 block to avoid a redirect
loop before HTTPS is confirmed.

## Certificate renewal

`certbot` is installed with an automated **`certbot.timer`** (systemd;
next run seen 2026-09-04 16:05 +0330) and renewal config
`/etc/letsencrypt/renewal/3ree.eu.cc.conf`. The wildcard cert automatically
renews; because the new vhost references the SAME `/etc/letsencrypt/live/...`
symlinks, no renewal action is needed.

---

## ops/local-dev-runtime.md

# ERP Local Development — Runtime & Persistence

> Current API default: **3101**. The startup/status scripts honor exported `API_PORT`, then
> repo-root `.env`, then this default. Set the matching server-only `API_INTERNAL_URL` in
> `apps/web/.env.local`; keep `NEXT_PUBLIC_API_URL=/api/v1`.
>
> The machine-specific PostgreSQL paths and persistence notes below describe a **historical
> workstation**, not provisioned services in a fresh Arena workspace. Check binaries, cluster,
> credentials and listeners first. Do not execute install/init/reset against an existing DB
> merely to repair a preview. See [current audit](backend-connection-audit.md).

## Quick start

```bash
cd /home/arash/Downloads/ai/opencode

# Start everything (idempotent, detached):
./scripts/start-dev.sh

# Check status:
./scripts/status-dev.sh

# Stop everything:
./scripts/stop-dev.sh
```

Services are launched with `setsid`+`nohup` and are detached from the calling shell.
Closing OpenCode does NOT stop them.

## Services

| Service  | Port  | URL                              |
|----------|-------|----------------------------------|
| Web      | 3000  | http://127.0.0.1:3000           |
| API      | 3101  | http://127.0.0.1:3101/api/v1    |
| PostgreSQL | 5432 | postgresql://shipping:***@127.0.0.1:5432/shipping_erp |

## PostgreSQL data persistence

**Data directory:** `/home/arash/shipping-erp/pgdata`

- On root filesystem `/dev/vda2` (NOT tmpfs, NOT under `/tmp`)
- Survives reboot and shell/terminal closure
- Not subject to systemd-tmpfiles 30-day cleanup
- Managed by `infra/standalone-db/manage.sh` (PG_HOME default updated)

**Before:** data was at `/tmp/opencode/pg/pgdata` — subject to `/tmp` 30-day cleanup
via systemd-tmpfiles-clean (`D /tmp 1777 root root 30d`). Relocated to durable
home directory. All data preserved byte-for-byte (rsync while stopped, no dump/restore).

## Architecture

```
Browser → http://127.0.0.1:3000 (Next.js dev)
              ↓ (same-origin /api/v1 proxy)
           http://127.0.0.1:3101 (NestJS API)
              ↓
           http://127.0.0.1:5432 (PostgreSQL, durable data)
```

- Docker is NOT used (socket denied). Standalone PG 16 (extracted from Ubuntu .debs).
- PG binaries: `/tmp/opencode/pgroot/usr/lib/postgresql/16/bin/` (not relocated, no persistence risk).
- Socket: `/home/arash/shipping-erp/socket` (durable).

## Logs

```
logs/api.log          — API output
logs/web.log          — Next.js dev output  
logs/pg-start.log     — PostgreSQL start output
/home/arash/shipping-erp/pg.log — PostgreSQL server log
```

## After reboot

Run `./scripts/start-dev.sh` — it will start PG from durable data, then API, then Web.
No manual intervention required.

## Troubleshooting

**Port 3000 in use:** Run `./scripts/stop-dev.sh` first, or identify and stop the conflicting process.

**API unavailable:** Check `logs/api.log`. Ensure PostgreSQL is up first (`./scripts/status-dev.sh`).

**Database unavailable:** Check `logs/pg-start.log`. Ensure `/home/arash/shipping-erp/pgdata/PG_VERSION` exists.
If missing, data was lost — restore from backup.

**Web process lingers after stop:** Run `pkill -f "next dev -p 3000"` and `pkill -f "next-server"`.

---

## ops/publication-handoff.md

# Publication and server deployment handoff — 2026-10-09

## Current instruction and scope

**Publication is on hold while the user reviews the required API-port correction. Do not push,
create a PR or merge.** The API must use **3101** by default; the web remains on **3000**.
Real login and database-backed acceptance will be tested on the user's configured server, not
used as a reason to resume preview backend troubleshooting. See [port audit](api-port-correction.md).
Do not resume attempts to provision the Arena database, generate its Prisma engine, reset an
admin password or authenticate there. Historical login diagnostics describe environment limits,
not a current publication gate. No backend startup/login/DB repair was attempted in this turn.

Branch: `arena/fe92d85a-duna`. Intended PR base: **`ai-test`**. Never push directly to main,
force-push or merge the PR automatically. Publication is withheld by the user's explicit instruction and this closed
session's GitHub restrictions, not by the missing preview backend.

## Final local diff review

The complete baseline-relative file list was reviewed against the available shallow baseline
`da1ff0ee0ea138c26c22870a6c20cf37109248ae`; the initial cumulative diff contained 125 paths,
including prior documentation. All intended work is present:

- Public landing sections, brand assets, fonts, translations and auth/navigation links.
- All 33 operational dashboard routes, shared shell, dialogs, focus/typing corrections,
  mobile/RTL navigation, persistent themes, menus and localized EN/FA/AR presentation.
- Existing port-3101 configuration, runtime script fixes, guards and regression tests.
- Backend business/auth/user-management source and Prisma schema/seed unchanged from baseline.
  No admin account or authentication behavior is changed in this publication-preparation turn.

The sole baseline-relative deletion is `apps/web/src/components/home/icons.tsx`, replaced by
the retained landing icon/component structure. No operational route was deleted. Independent
AST comparison confirms API method/path calls match baseline on all 33 pages (not a proof of
payload or database semantics). The existing intentional UI reset-password improvement sends
an administrator-entered value to the unchanged authorized endpoint; it does not silently reset
an account or set a universal password.

Only `.env.example` and `apps/web/.env.example` are tracked environment files. No dependency,
build, test-result or recovery-archive directories are tracked. Fonts/images are intentional
landing assets, not accidental build output. Added lines were checked for private keys,
recognizable GitHub/AWS credentials and the inherited seed-default password; no new matches
were found. Existing example/test/default-password references in baseline history are not new
credentials and are not evidence the whole historical repository is secret-free. Neither the
user's supplied password nor real environment values are copied into new source/docs.

The actual remote `ai-test` comparison is **not available**: only cached origin/main and
origin/HEAD exist locally. Do not mistake the reviewed local baseline diff for a live PR diff
or assume already-merged landing changes need to be reapplied on GitHub.

## Previous publication-pass validation (current port-correction results in the port audit)

| Check | Result |
| --- | --- |
| Web typecheck | Pass |
| Web lint | Pass, zero warnings/errors |
| Web production build | Pass, 108 generated static pages |
| Translation guard | Pass, 2,114 message leaves ×3 locales |
| Contract guard | Pass; existing BillStatus/DeliveryReleaseStatus skips and computed-tail limitation remain |
| Existing production-browser regression suite | **22/22 pass**, 3.0 minutes, against the fresh production build |
| Port/script checks | 7/7 pass |
| Config unit tests | 10/10 pass |
| Shared/config builds and typechecks | Pass |
| API method/path comparison | Pass, all 33 operational pages |
| Real auth/DB tests | Deferred to the user's server, intentionally not retried |

The web was stopped through its managed process only to avoid sharing `.next` during the build,
then the newly built production server was restarted on `0.0.0.0:3000`. Browser tests run against
that build with fixtures confined to the test runner. They do not claim real database acceptance.
An initial scratch audit script had an incorrect TypeScript import path; correcting the diagnostic
script resolved it and the method/path check passed. No application source changed to fix a test.

## Production environment (keep actual values outside Git)

**Do not overwrite the user's working environment with `.env.example`.** Preserve their existing
DB URL and JWT secrets. Examples are development placeholders, not production credentials.
Use a secret manager/service environment or protected ignored environment files.

### Nest API — repo-root `.env` or service environment

| Variable | Required deployment setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Existing approved PostgreSQL connection URL; preserve database/schema and provider TLS requirements |
| `AUTH_JWT_SECRET` | Existing strong secret; do not rotate as part of this UI deployment |
| `AUTH_JWT_REFRESH_SECRET` | Existing configured secret; required by the validator |
| `API_PORT` | `3101` default; retain an explicit working alternative if the proxy matches |
| `API_HOST` | Appropriate service bind address; use a private interface or container bind plus firewall/reverse proxy |
| `API_VERSION` | `1`, matching the existing `/api/v1` contract |
| `API_CORS_ORIGINS` | Explicit actual frontend origin allow-list; do not use `*` for authenticated traffic |
| `AUTH_JWT_EXPIRES_IN` / `AUTH_JWT_REFRESH_EXPIRES_IN` | Preserve existing settings; defaults are `15m` / `7d` |
| `APP_TIMEZONE` / `APP_DEFAULT_CURRENCY` | Preserve existing settings; defaults are `Asia/Dubai` / `USD` |

### Next web — `apps/web/.env.local` or web build/runtime environment

| Variable | Required deployment setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `/api/v1`, set during the web build; never a sandbox/browser localhost URL |
| `API_INTERNAL_URL` | Server-only API origin, normally `http://127.0.0.1:3101` for the same host; **no `/api/v1` suffix** |

For separate containers, replace loopback with the API service's internal hostname. For an explicitly required deployment override,
set API_PORT and the matching API_INTERNAL_URL together; do not change the project default.
Both defaults and examples currently agree on 3101, with tests for overrides. Startup/status
scripts read the configured port; root Nest `.env` and Next's web `.env.local` are separate.
Restart affected services after environment changes; rebuild after changing `NEXT_PUBLIC_*`.

### Build and server acceptance

On an approved build/server environment with the existing configuration and matching Prisma
native engine available:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @shipping/shared build
pnpm --filter @shipping/config build
pnpm --filter @shipping/api build
pnpm --filter @shipping/web build
```

Use the server's existing service manager/deployment process to restart API/web. The baseline API
lint/build issues reported in older audits are not asserted fixed here; investigate failures on
the real configured build environment rather than bypassing validation. No schema migrations were
introduced by this work: do not reset, reseed or alter an existing admin account for a frontend
rollout. Review any genuinely pending migrations through the normal deployment procedure.

After deployment verify direct API health, same-origin proxied health, actual admin login,
`/auth/me`, authorized dashboard pages, EN/FA/AR direction/themes, and approved database workflows.
Those server checks are acceptance work for the user, **not a prerequisite for publishing this
branch for review**. Protect the database and take the normal deployment backup first.

## Future publication steps — only after user approval in a NEW GitHub-enabled session

The commands below are **on hold and were not executed**. The user must first approve publication. Start a session
on the intended branch, recover the archive first if necessary, and preserve any new local work.
Do not run the push block until the ancestry/diff review succeeds. Stop on command failure.

```sh
set -e
# 1. Verify local state; do not clean/reset/switch away from valuable changes.
test "$(git branch --show-current)" = "arena/fe92d85a-duna"
test -z "$(git status --porcelain)"
git log -5 --oneline
git remote -v

# 2. Obtain actual remote history. This repository was shallow in Arena.
if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
  git fetch --unshallow origin
else
  git fetch origin
fi
git fetch origin \
  refs/heads/ai-test:refs/remotes/origin/ai-test \
  refs/heads/arena/fe92d85a-duna:refs/remotes/origin/arena/fe92d85a-duna

# 3. Inspect both sides and require a fast-forward path before pushing.
git log --left-right --graph --oneline HEAD...origin/arena/fe92d85a-duna
git merge-base --is-ancestor origin/arena/fe92d85a-duna HEAD
# If this exits nonzero, STOP for reviewed reconciliation. Never force-push.

git diff --name-status origin/ai-test...HEAD
git diff --stat origin/ai-test...HEAD
git diff --check origin/ai-test...HEAD
git diff origin/ai-test...HEAD
# Review the full actual PR diff: landing parity, deletions, auth/ports,
# credentials/env files, unrelated content and generated artifacts.
```

If a remote ref is absent, fetching/deepening fails or histories diverge, stop and inspect the
actual remote situation. Do not invent ancestry, overwrite newer remote commits, blindly
cherry-pick the cumulative restoration checkpoint, or assume a missing ref is permission to
replace it. Resolve divergence with a reviewed, non-rewriting plan that preserves remote work.

Only after new explicit user approval and the preceding review are both complete:

```sh
set -e
test "$(git branch --show-current)" = "arena/fe92d85a-duna"
test -z "$(git status --porcelain)"
git merge-base --is-ancestor origin/arena/fe92d85a-duna HEAD
# 4. Publish this branch only, without --force or --force-with-lease.
git push origin arena/fe92d85a-duna

# 5. Verify the remote tip equals the intended local tip.
git rev-parse HEAD
git ls-remote --heads origin refs/heads/arena/fe92d85a-duna

# 6. Reuse an existing PR if present; do not create duplicates.
gh pr list --state open --base ai-test --head arena/fe92d85a-duna
# If no matching PR exists:
gh pr create --base ai-test --head arena/fe92d85a-duna \
  --title "Preserve landing redesign and refine localized dashboard" \
  --body-file docs/ui.md
```

Record the actual remote commit and PR URL after success. **Do not merge** the PR or push directly
to `main`/`ai-test`. The user reviews, decides when to merge and tests on their server.

## Recovery handoff

All intended changes are committed locally; the final commit/archive name is in the session
report and archive README. Preserve older archives. The latest archive contains the final branch
bundle, reachable shallow-boundary metadata, checksums, PR body, deployment/publication guide
and safe restore instructions. It is stored under ignored `.handoff/`, not published as source.
A bundle alone is insufficient for this shallow checkout; retain the archive's `shallow` file.
Download an independent copy. Restore into a new directory and verify the commit/tree before
importing into any existing checkout; never overwrite an unrelated repository's shallow metadata.

