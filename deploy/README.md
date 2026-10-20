# Deploying Duna ERP

This directory holds everything needed to run Duna ERP on a real server, plus
the GitHub Actions workflow that keeps it updated from the
`arena/5c597eb9-duna` branch.

```
deploy/
  install-server.sh        idempotent installer / updater / repair tool
  healthcheck.sh           read-only probe of a running instance
  systemd/duna-api.service NestJS unit (loopback :3101)
  systemd/duna-web.service Next.js unit (:3000)
  nginx/duna.conf          TLS reverse proxy to the dashboard
```

Nothing here re-implements the application. The installer calls the
repository's own commands — `pnpm install`, `pnpm db deploy`, `pnpm db seed`,
`pnpm build` — so the deployed result is exactly what the test suite verifies.

---

## 1. Server prerequisites

| Requirement | Why |
| --- | --- |
| Node.js ≥ 20 (22 tested) | The API and Next.js builds run on it |
| pnpm 9 (the installer installs it) | Workspace package manager |
| PostgreSQL 16 reachable on loopback | `prisma/migrations` targets PG16 |
| `git`, `curl`, `systemd`, `nginx` | Source, probes, services, TLS |
| Passwordless `sudo` for `systemctl` and writing `/etc/systemd/system` | The units run as services, not as the deploy user's shell |

The installer deliberately does **not** install Node.js itself: distribution
policy for that varies too much, and a deployment tool that silently rewrites
system packages is a worse problem than the one it solves.

## 2. One-time server setup

```bash
# as the deploy user, on the server
sudo mkdir -p /opt/duna && sudo chown "$USER" /opt/duna
git clone --branch arena/5c597eb9-duna https://github.com/arashalidadi/duna.git /opt/duna
cd /opt/duna

cp .env.production.example .env
chmod 600 .env
$EDITOR .env          # real DATABASE_URL, real JWT secrets, real admin account

mkdir -p apps/web && cp apps/web/.env.example apps/web/.env.local
chmod 600 apps/web/.env.local
```

`.env` must never be committed; only `.env.production.example` is tracked.

`apps/web/.env.local` keeps browser traffic same-origin:

```
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://127.0.0.1:3101
```

`NEXT_PUBLIC_API_URL` is inlined into the browser bundle at build time, so it
must be correct **before** `pnpm build` runs.

## 3. Install

```bash
export DUNA_ADMIN_DATABASE_URL='postgresql://postgres:…@127.0.0.1:5432/postgres'
bash deploy/install-server.sh --check     # read-only diagnosis first
bash deploy/install-server.sh --install
```

`--check` changes nothing and exits 1 if the host cannot be deployed to. It
verifies the toolchain, the source tree, the environment file (including that
no shipped placeholder survived), database reachability, both build artefacts,
and the running services.

`--install` then:

1. installs pnpm if it is missing or the wrong major version;
2. clones or hard-updates `$APP_DIR` to `arena/5c597eb9-duna`;
3. refuses to continue while `.env` still holds a placeholder secret;
4. creates the database if absent and applies `prisma/migrations`;
5. seeds **reference data only** — `SEED_DEMO_DATA=false` is forced, so no
   fabricated business records can reach production;
6. builds with `NODE_ENV` unset (see the build trap below);
7. installs and restarts both systemd units;
8. runs the health probe and fails the deployment if it does not pass.

Re-running `--install` on a healthy server is a normal update, not a reinstall.

### The build trap

`.env.example` ships `NODE_ENV=development`. If a build inherits it, Next.js
refuses to prerender `/404`, `/500` and `/_not-found` and the build fails with
an error that does not mention `NODE_ENV`. The installer sources the
environment file and then explicitly unsets `NODE_ENV` before building; the API
still reads the file at runtime.

### If the previous install failed

`--install` is written to repair rather than assume a clean host. It handles the
failures that actually occur:

| Symptom | What the installer does |
| --- | --- |
| Dirty tree or detached HEAD from an interrupted deploy | `checkout --force` + `reset --hard origin/<branch>`, preserving `.env` and `node_modules` |
| Missing `node_modules` after a failed `pnpm install` | reinstalls with `--frozen-lockfile` |
| Half-built `.next` | rebuilds |
| Orphan process holding :3000 or :3101 | the units own those ports; `systemctl restart` replaces them |
| Database provisioned from the pre-squash migration history | see below |

**Migration re-baselining.** The branch squashes 49 accumulated migrations into
a three-file baseline. A database provisioned *before* that squash still lists
all 49 names in `_prisma_migrations`, so `prisma migrate deploy` refuses to
apply the new baseline. This is the most likely cause of a failed re-install
over an existing database. The fix rewrites only that journal:

```bash
DUNA_ACK_REBASELINE=I_UNDERSTOOD_JOURNAL_ONLY \
  bash deploy/install-server.sh --install --rebaseline-migrations
```

No table data is touched. Without both the flag and the acknowledgement the
installer stops and explains why.

## 4. Services and proxy

- `duna-api` runs `node apps/api/dist/src/main.js` on `127.0.0.1:3101`. It runs
  the built entry point directly rather than `pnpm start-api`: that dispatcher
  path enforces the Phase 11 approved target (role `shipping_runtime_p11`,
  database `duna_seed_test`, loopback 5432), which is a sandbox constraint, not
  this deployment's database identity.
- `duna-web` runs `next start -H 0.0.0.0 -p 3000` with `NODE_ENV=production`.
  The process renames its own title to `next-server (vX)`; that is normal.
- `nginx` terminates TLS and proxies to `:3000` only. `/api/v1` reaches the API
  through the Next same-origin proxy, so `:3101` is never published and
  `API_CORS_ORIGINS` needs only the public origin.

Set `X-Forwarded-Proto $scheme` in nginx (the shipped config does) or the
application will not mark its cookies `Secure`.

## 5. Health

```bash
bash deploy/healthcheck.sh          # APP_DIR-relative, read-only
systemctl status duna-api duna-web
journalctl -u duna-api -u duna-web -n 100 --no-pager
```

The probe checks both listeners, `GET /api/v1/health`, the login page, the
same-origin proxy path, and — importantly — that an unauthenticated business
route is rejected with 401/403 rather than served.

## 6. The GitHub Actions workflow

`.github/workflows/deploy.yml` (workflow name: **deploy**) triggers on
`push` to `arena/5c597eb9-duna` and on `workflow_dispatch`.

Three jobs:

1. **changes** — `dorny/paths-filter` decides whether the push touched anything
   the running application depends on (`apps/`, `packages/`, `prisma/`,
   `scripts/`, `deploy/`, `docker/`, `package.json`, `pnpm-lock.yaml`,
   `pnpm-workspace.yaml`, the env examples, `tsconfig*.json`, the workflow
   itself). A documentation-only push stops here, so docs work never restarts
   production.
2. **verify** — always runs: install, `prisma generate`, `pnpm typecheck`,
   `pnpm lint`, `pnpm test`, `pnpm build` with `NODE_ENV` emptied, then asserts
   `apps/api/dist/src/main.js` and `apps/web/.next` exist.
3. **deploy** — only when `changes.runtime == 'true'` (or a forced dispatch)
   and `verify` passed. Installs the SSH deploy key, uploads `deploy/`, runs
   `deploy/install-server.sh --install` over SSH, then runs the health probe.
   A failed health check fails the run, so a broken deployment cannot pass
   silently.

`concurrency: deploy-${{ github.ref }}` with `cancel-in-progress: false`
serialises deployments instead of racing them.

### Required repository settings

These must be created in the GitHub UI; a workflow cannot create its own
secrets.

**Settings → Secrets and variables → Actions → Secrets**

| Name | Value |
| --- | --- |
| `DEPLOY_HOST` | server address |
| `DEPLOY_USER` | the deploy account |
| `DEPLOY_SSH_PRIVATE_KEY` | private key, no passphrase |
| `DEPLOY_SSH_KNOWN_HOSTS` | `ssh-keyscan <host>` output (optional; without it the first connection records the host key unverified) |
| `DUNA_ADMIN_DATABASE_URL` | administrative PostgreSQL URL for DDL |

**Settings → Secrets and variables → Actions → Variables**

| Name | Value |
| --- | --- |
| `DEPLOY_PATH` | `/opt/duna` |
| `DEPLOY_HOSTNAME` | public hostname, for the environment URL |

**Settings → Environments → New environment → `production`** — the `deploy` job
runs inside it, which is where required reviewers and deployment protection
rules belong.

**Deploy key:** generate a dedicated keypair, add the public half to the
repository as a read-only deploy key (or to the deploy account's
`~/.ssh/authorized_keys`), and store only the private half in
`DEPLOY_SSH_PRIVATE_KEY`. Do not reuse a personal key, and never paste a
password into a workflow, a secret, or a chat message.
