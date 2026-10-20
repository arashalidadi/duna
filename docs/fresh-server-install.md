# Fresh server: one-command P0–P12 installation (not an upgrade)

This path is for a **new Linux server and a new empty database only**. It does not
connect to the existing owner PostgreSQL cluster, `duna_seed_test`, or
`duna_seed_test1`; it does not run the Phase 11/12 owner-targeted scripts. The
installer creates an isolated Docker Compose project with its own PG16 volume,
API, and Web service. Only Web is published, at **http://127.0.0.1:3000/**.
Host PostgreSQL/API ports are never mapped. No demo business data is installed.

## Prerequisites and private configuration

1. Install Node.js >=20 and pnpm 9 on the host, Docker Engine with Compose
   plugin **v2.20+**, and systemd; enable the Docker daemon at boot. The installer
   _checks_ these prerequisites but does not install/enable OS packages or modify
   system services for you. Allow outbound access to Docker image registries,
   npm, and the Prisma engine download endpoint for the image build. Provide
   enough disk/RAM for a Node/Next build and a separate, temporary PG16 test
   database. Reserve host loopback port 3000; no reverse proxy/TLS is installed.
2. Check out the reviewed application sources on this **new** host. Do **not**
   use the existing owner machine's `.env` or its database. From the repository
   root, create a private config: `cp .env.fresh.example .env.fresh.local` then
   `chmod 600 .env.fresh.local`. Edit it locally with a private editor/password
   manager (no `source`, shell-history passwords, or committed secrets). It
   must be owned by the installing OS user, not a symlink. Use plain `KEY=value`
   lines without quotes, shell expansion or inline comments.
3. Set a unique lowercase `FRESH_INSTANCE_ID` (4–20 chars) and choose a
   **new** `FRESH_DATABASE_NAME` of form `duna_fresh_` plus 3–24 lowercase
   letters/digits. After checking the host/database really are new, explicitly
   enter `FRESH_NEW_SERVER_ACK=NEW_EMPTY_SERVER:<that exact database name>`.
   Supply a lowercase admin email; store its private password (>=16 chars) in
   the manager as the initial sign-in credential. Set the six other distinct,
   randomly generated secrets (>=32 chars): PG bootstrap, PG migrator, PG
   runtime, JWT access, JWT refresh and attachment signing. The sample contains
   **no** usable secrets or default password. Retain the config privately for
   diagnostics; never paste it into a ticket or terminal transcript.

## Install

```sh
pnpm run setup:fresh
```

The command does all of the following, in order, and stops on any failure:

1. Validates config ownership/mode, target acknowledgement, the reviewed
   94-model privilege inventory, Compose/daemon/boot state, unused project
   resources/image tag, and port 3000 **before creating any database**.
   Writes a private `.fresh-setup/<instance>.json` marker (ignored by Git).
2. Builds a Node image: frozen pnpm dependency installation, Prisma generate
   and schema validation, shared/config builds, fast offline contracts, type
   checks, API build provenance, and Web build. Runs **isolated integration E2E**
   against an unexposed PG16 `test-db` on tmpfs; this fixture is stopped/removed
   after the test. It never points a fixture-writing Jest test at the app DB.
3. Provisions and waits for the private `postgres:16-alpine` service. Verifies
   the actual PG16 version, new DB name, absence of tables/roles, and initial
   postgres ownership. Creates separate non-superuser `shipping` _migrator_
   and `shipping_runtime_p11` _API_ logins, plus an unassigned, non-login
   `shipping_audit_export_p11` DB role. Credentials are sent via private
   process environment/psql stdin, not command arguments or logs.
4. Runs `prisma migrate deploy` with the **migrator** URL (never `migrate dev`,
   reset, or shadow-DB tricks); verifies every committed migration name/checksum
   and the append-only audit triggers. Runs the existing core seed under the
   migrator with `DUNA_FRESH_SEED=1`, an explicit admin and demo mode off.
   Verifies reference data/primary admin and absence of sample business rows
   and an automatically configured retention policy. Operator-managed ports
   are deliberately **not** invented; the Phase 10 verified-port reference
   seed remains a separate explicitly reviewed action.
5. Grants only the source-reviewed per-table API privileges and needed sequence
   usage, then proves the API login is restricted, reads real model data, cannot
   update/delete audit history or read the migration journal. The migrator
   credential stays in the one-shot container; the durable API has only the
   restricted URL. PostgreSQL, API and Web all have health checks; durable
   services use Docker `restart: unless-stopped` and a boot-enabled daemon.
6. Checks Web HTML, the Web-proxied **database-backed** API health, and (only
   during fresh setup) a real initial-admin login, authenticated `/auth/me`
   and a permissions read through Web. This login creates normal audit/refresh
   records on the **new** application DB; it is never replayed by the read-only
   health command. A `FRESH_SETUP_PASS ... url=http://127.0.0.1:3000/` marker
   appears **only** after these probes pass.

The root URL is the public landing page; sign in with the saved admin credential
at `/fa/login` to reach the permitted dashboard. Authentication is **not**
bypassed just to render dashboard widgets. A reverse proxy/TLS, mail delivery,
identity-document retention authority, backup/recovery drills and externally
accessible hosting require separate owner decisions/operations; this command
neither claims nor schedules them. Identity capture is disabled.

## Test and inspect (high-level commands)

- `pnpm run test:fast` — offline new-installer/Phase 11 unit contracts,
  **all 48 committed migrations replayed in in-memory PG16**, seed safety and
  Web contracts. No external DB. On a host, first install pnpm dependencies
  and build shared/config; the fresh image build does both automatically.
- `pnpm run test:integration` — **only after a complete fresh install**,
  a separate PG16 `test-db` tmpfs fixture, committed migrations/core seed, and
  selected Auth/RBAC + master-data API Jest E2E suites. It writes only to the
  disposable test DB. It does not run all 34 historical suites or touch the
  application database.
- `pnpm run test:e2e:health` — **after install**, read-only checks of this
  project's healthy containers, Web HTML, Web proxy and live DB-backed API
  `SELECT 1`. It does not log in or write a fixture, so it is not a substitute
  for the install-time authenticated probe.
- `pnpm run setup:fresh --status` — reads the private install marker and this
  project's Compose states, even after a partial install. No migration, seed,
  restart or DB write.

The historical `pnpm test`, legacy API E2E suites, Phase 11 role audit and
`pnpm phase12:test` remain available with their **existing** target and safety
requirements; this consolidation does not remove or redefine them. A fast
contract pass is not proof of the complete live stack.

### Verification recorded in this workspace (2026-10-18)

`pnpm run test:fast` passed (24 Node cases including isolated in-memory PG16
migration/grant replay; Web contracts and 8 proxy/client tests); the static
seed-safety and 408-handler authorization inventories passed. Web typecheck
and the 141-page Next production build passed. The separate Phase 12 in-memory
PG16 catalog test also passed. Host Prisma generation **could not complete**
because this sandbox cannot reach the Prisma engine download host. Docker and
`psql` are absent here, and no authorized new-server target was provided:
**the image build, containerized PG16 integration, fresh install, and live
API/Web/admin acceptance have not been run**. A capable new server must verify
those stages and emit its own `FRESH_SETUP_PASS`. These limits do not overturn
the owner's previously reported 27-stage Phase 12 PASS.

## GitHub Actions orchestration

This same fresh-install path is the single standard installation path and is
orchestrated on real servers by `.github/workflows/install.yml`: the workflow
verifies the branch (install, generate, typecheck, lint, tests, build), then
connects to the target server over SSH, writes the private
`.env.fresh.local` (mode 0600) from GitHub Secrets, runs `pnpm setup` and
confirms the result with `pnpm setup --health`. The operator provides only
the server connection details and server-specific secrets in GitHub Settings
→ Secrets and variables → Actions; no database, `.env` file or install step
is created manually. Required secrets and variables are listed in
deploy/README.md.

## Failure, upgrade and recovery boundary

A failure prints `FRESH_SETUP_STOP`, suppresses third-party output that might
contain credentials, and leaves the state marker at `preparing`. It **never**
auto-reuses a populated volume, retries a partial migration/seed, prunes a
container/volume, resets or restores a DB, modifies the owner installation or
silently reports success. Run `pnpm run setup:fresh --status` to identify which
services are up; review the last named stage, source/migration inventory and
private Docker/Prisma logs locally without publishing secrets. Check image
registry/Prisma downloads if the build failed, configuration and Docker boot
if preflight failed, migration checksum/identity if the DB stage failed, and
restricted grants/health or admin credential if smoke failed. **Do not** rerun
`setup:fresh` against a partial or completed install. Have a DBA/operator
review and explicitly authorize a recovery from known evidence; no recovery
or successful restore is implied by the existence of tooling.

For an **existing installation**, use its separately approved, target-verified
runbooks, e.g. [Phase 11 operations]source-material/project-audit.md)
and [Phase 12 operations]source-material/project-audit.md).
`pnpm phase12:apply` is an owner-guarded Phase 12 operation, **not** a generic
upgrade command; `prisma migrate deploy`/`db:seed` must not be applied blindly
to an existing business database. The prior owner-reported Phase 12 27-stage
PASS is historical evidence, not a fresh-install acceptance result. No existing
roles, timers, recovery policies, credentials or service managers are changed
by this workflow unless an operator explicitly invokes it on a new target.
