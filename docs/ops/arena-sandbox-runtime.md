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
