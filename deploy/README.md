# Deploying Duna — one standard install path

## The standard path

There is exactly one supported way to install Duna on a server: the **isolated
fresh install**, implemented by the repository's own installer
(`scripts/fresh/setup.cjs`, run as `pnpm setup`), orchestrated from start to
finish by GitHub Actions (`.github/workflows/install.yml`).

What the workflow does, without any manual steps on the server:

1. **Verify** — installs dependencies, generates the Prisma client, runs
   typecheck, lint, the unit/contract test suite and the API + web builds,
   and asserts the built artefacts exist.
2. **Install over SSH** — clones/updates the repository on the target server,
   writes the private fresh-install configuration (mode 0600, deploy user
   only) from GitHub Secrets, then runs `pnpm setup`, which:
   - provisions an isolated PostgreSQL 16 (Docker Compose project owned by
     the install, no host port published),
   - creates the database, the database users/roles and their passwords
     (schema owner, runtime API role, NOLOGIN audit-export role),
   - applies every committed migration with checksum verification and the
     append-only audit triggers,
   - runs the structural, non-demo seed (currencies, permissions, roles,
     company settings, initial primary administrator — no fabricated
     business data),
   - applies the reviewed per-table/runtime grants,
   - builds and starts the API and dashboard services, and
   - runs the final smoke checks: public pages, database-backed API health,
     initial-admin login, authenticated account and permission reads through
     the web proxy.
3. **Confirm** — `pnpm setup --health` reports the installed state.

The operator never creates a database, never writes an `.env` file on the
server, and never runs install steps by hand.

## What the operator provides on the target server

| Item | Requirement |
| --- | --- |
| OS user | a deploy user able to `git clone`, run `pnpm`/`docker` and write to the deploy path |
| Node.js | ≥ 20 (installed by the operator; the installer does not touch OS packages) |
| pnpm | 9.x (bootstrapped automatically if missing or the wrong major version) |
| Docker | Engine with Compose plugin v2.20+, daemon enabled at boot (`systemctl is-enabled docker` = enabled) |
| Network | outbound to GitHub, the npm registry, Docker image registries; the Prisma client is generated inside the isolated build image |
| Port | `127.0.0.1:3000` free (the dashboard is published only on loopback) |
| Target | a new, empty server/database; the installer refuses to adopt an existing database |

The installer checks all of the above and stops before creating anything if a
check fails. A reverse proxy/TLS, mail delivery, backups and externally
accessible hosting are separate operator decisions and are not part of this
path.

## Required GitHub configuration

Create these in **Settings → Secrets and variables → Actions** (repository
level). Real values are generated locally with a password manager and are
never committed, logged or documented here.

### Secrets

| Secret | Description | Generated per install with |
| --- | --- | --- |
| `DEPLOY_HOST` | target server address | — |
| `DEPLOY_USER` | deploy account on the server | — |
| `DEPLOY_SSH_PRIVATE_KEY` | passphraseless deploy key (public half installed on the server) | `ssh-keygen -t ed25519` |
| `DEPLOY_SSH_KNOWN_HOSTS` | `ssh-keyscan -H <host>` output (optional) | — |
| `FRESH_INSTANCE_ID` | unique lowercase install id, 4–20 chars | `openssl rand -hex 6` |
| `FRESH_DATABASE_NAME` | dedicated `duna_fresh_` + 3–24 lowercase alphanumerics | chosen by operator |
| `FRESH_NEW_SERVER_ACK` | `NEW_EMPTY_SERVER:<FRESH_DATABASE_NAME>` | derived from the database name |
| `FRESH_DB_SUPER_PASSWORD` | PostgreSQL bootstrap password (≥32 chars) | `openssl rand -base64 48` |
| `FRESH_DB_OWNER_PASSWORD` | schema owner role password (≥32 chars) | `openssl rand -base64 48` |
| `FRESH_DB_RUNTIME_PASSWORD` | API runtime role password (≥32 chars) | `openssl rand -base64 48` |
| `FRESH_ADMIN_EMAIL` | initial administrator email (lowercase) | — |
| `FRESH_ADMIN_PASSWORD` | initial administrator password (≥16 chars) | `openssl rand -base64 24` |
| `FRESH_AUTH_JWT_SECRET` | access-token signing secret (≥32 chars) | `openssl rand -base64 48` |
| `FRESH_AUTH_REFRESH_SECRET` | refresh-token signing secret (≥32 chars) | `openssl rand -base64 48` |
| `FRESH_ATTACHMENT_URL_SECRET` | download-link signing secret (≥32 chars) | `openssl rand -base64 48` |

All `FRESH_*` values are distinct from one another (the installer enforces
this). Every secret is written only to the server's private
`.env.fresh.local` (mode 0600, owned by the deploy user) and is never
printed by the workflow or the installer.

### Variables

| Variable | Description | Example |
| --- | --- | --- |
| `DEPLOY_PATH` | install directory on the server | `/opt/duna` |
| `DEPLOY_HOSTNAME` | public hostname (informational only) | `duna.example.com` |

### Workflow triggers

- Push to `arena/8f399c78-duna` installs when deploy-relevant files changed
  (`apps/`, `packages/`, `prisma/`, `scripts/`, `deploy/`, `docker/`,
  lockfiles, env examples, tsconfig files, the workflow itself).
- `workflow_dispatch` with `force = true` installs regardless of changed
  paths.

## Retired

The previous `deploy.yml` workflow (which targeted the `arena/5c597eb9-duna`
branch, expected a host-provisioned PostgreSQL and a manually written
`.env`) and `deploy/install-server.sh` are retired from the standard path.
`deploy/install-server.sh` is retained only as a reference tool for existing
host-PostgreSQL installations; new installations use the path above.

## Sandbox validation (this session, 2026-10-20)

The complete install core was executed for real in the sandbox (embedded
PostgreSQL 16 cluster, sandbox-only Prisma engine mirror since
binaries.prisma.sh is unreachable from the sandbox):

| Stage | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | passed |
| `pnpm db generate` | passed |
| `pnpm db deploy` (migrations on PG16) | passed |
| `pnpm db seed` (structural, non-demo, primary admin) | passed |
| `pnpm typecheck` (all workspaces) | passed |
| `pnpm lint` | passed (0 errors) |
| `pnpm test` (full fast suite) | passed |
| `pnpm build` (API + web, 141 pages) | passed |
| API health (`/api/v1/health`, database up) | passed, direct and via web proxy |
| Web login page (`/fa/login`) | passed, HTTP 200 |
| Admin login via web proxy → `/auth/me` → `/permissions/all` | passed; primary admin, `audit:read` present |
| Unauthenticated dashboard access | served the login page; no business data leaked |

Not executable in this sandbox and therefore **not** executed here: the
Docker-based fresh installer (`pnpm setup`), systemd service installation,
host PostgreSQL provisioning, and the GitHub Actions workflow run itself.
The verify-job equivalent above ran locally and passed; the install job runs
the identical repository commands on the target server.

## Running it

Push to `arena/8f399c78-duna`, or trigger `workflow_dispatch` from the
GitHub Actions "Install" workflow. After a successful run, sign in at
`https://<DEPLOY_HOSTNAME>/fa/login` (or `http://<DEPLOY_HOST>:3000/fa/login`
on loopback) with `FRESH_ADMIN_EMAIL` / `FRESH_ADMIN_PASSWORD`.
