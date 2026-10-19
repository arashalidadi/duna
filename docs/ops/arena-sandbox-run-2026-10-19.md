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
