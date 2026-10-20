# Duna: GitHub Actions install and deployment

`.github/workflows/install.yml` is the one standard path. A push to
`arena/8f399c78-duna` and a manual `workflow_dispatch` both run the same
pipeline:

1. Install locked dependencies; generate Prisma; typecheck, lint, test, and
   build the API and dashboard. **No SSH connection is opened until this job
   succeeds.**
2. The deploy job remains a hard skip before SSH unless the explicit
   `DEPLOY_ENABLED=true` opt-in is set and every required setting exists. This
   allows pushing and verifying the workflow before authorizing a real target.
3. Verify SSH host identity against the pinned `DEPLOY_SSH_KNOWN_HOSTS` entry;
   transfer the exact verified commit as a source archive and stream the private
   configuration over that authenticated SSH channel. Secret values are never
   interpolated into a shell script/command, printed, or put in GitHub outputs.
4. Provision Debian/Ubuntu host prerequisites as needed: Docker Engine and
   Compose from Docker's signed APT repository (key fingerprint pinned in the
   bootstrap script), Node.js 22 from the project's verified Docker image if
   Node >=20 is absent, pnpm 9, Nginx and Certbot. A non-root deploy account
   must have non-interactive sudo (root-equivalent authority) for this
   first-run setup; its next SSH connection receives Docker-group membership.
5. Select install vs update from the private installer state marker. A genuinely
   new install calls `pnpm setup`: it refuses a non-empty deploy path or any
   existing target volume, creates isolated PG16 and roles, applies migrations,
   seeds initial reference data/admin, builds and starts API/Web, then performs
   authenticated smoke tests. No existing database can be adopted.
6. Later pushes call `pnpm setup --upgrade`: build and offline/integration test
   first, refuse pending SQL that drops tables/columns/schema, truncates, or
   deletes rows, create a private full PostgreSQL dump under
   `.fresh-setup/backups/`, deploy migrations without reset or seed, apply
   reviewed grants, restart services, and check live health. Incomplete setups
   and implicit credential changes are refused. Data volumes and backup files
   are never pruned by this workflow.
7. Configure the repo-managed Nginx reverse proxy, obtain/renew TLS with
   Certbot, then verify `https://DEPLOY_HOSTNAME/fa/login` and the externally
   routed database-backed API health. Report the exact commit and health result.
   A failed verification job cannot change the server.

On a successful install, open `https://<DEPLOY_HOSTNAME>/fa/login` and sign in
with the initial `FRESH_ADMIN_EMAIL` and `FRESH_ADMIN_PASSWORD`.

No actual server is contacted by this repository change. On pushes made before
settings exist, the verify job can pass and the deploy job explicitly skips the
connection. After all settings are configured and `DEPLOY_ENABLED=true` is deliberately
set, manually dispatch the workflow once to install the first instance. GitHub
does not run an Actions job when a secret or variable is merely changed.

## GitHub Actions settings

Create the `production` environment under **Repository → Settings → Environments**
and place the following there. Leave required reviewers unset if fully automatic
rollout is desired. (Repository-level Actions secrets/variables also work, but
use one scope consistently.) Do not put real values in source, issues, chat, or
logs.

### Variables

| Name | Required | Value / preparation |
| --- | --- | --- |
| `DEPLOY_ENABLED` | Yes | Set exactly to `true` only after all server settings are reviewed. Missing/false is a hard skip before SSH, providing an explicit opt-in after setup. |
| `DEPLOY_PATH` | Yes | Absolute empty directory for a first install, e.g. `/opt/duna`. Do not point it at existing data or another application. |
| `DEPLOY_PORT` | No | SSH port; defaults to `22`. If changed, the pinned known-host entry must use `[host]:port`. |
| `DEPLOY_HOSTNAME` | Yes | Public fully qualified domain name with DNS A/AAAA records pointing to this server. Used for the dashboard URL and TLS certificate. |
| `TLS_EMAIL` | Yes | Valid email for Let's Encrypt certificate registration/expiry notices. This is a Variable, not a Secret. |

### Secrets

| Name | Value / preparation |
| --- | --- |
| `DEPLOY_HOST` | Server DNS name or IPv4 address. |
| `DEPLOY_USER` | SSH account name. It must be root or have non-interactive `sudo -n` rights to install host packages and add itself to the Docker group. Docker access is root-equivalent. Install the public half of the deploy SSH key in this account's `authorized_keys`. |
| `DEPLOY_SSH_PRIVATE_KEY` | Dedicated passphrase-free Ed25519 private deploy key. Generate locally with `ssh-keygen -t ed25519 -f duna-deploy`; put only the private half here. |
| `DEPLOY_SSH_KNOWN_HOSTS` | Required pinned `known_hosts` line(s), no TOFU fallback. Gather the public host key with `ssh-keyscan -p <port> -H <host>`, compare its fingerprint (`ssh-keygen -lf <file>`) with the fingerprint shown in the server provider console or obtained through another trusted channel, then store the matching line(s). For port 22 the host entry is `host`; for another port it is `[host]:port`. Never trust an unverified `ssh-keyscan` result. |
| `FRESH_INSTANCE_ID` | Unique lowercase 4–20 character id matching `[a-z][a-z0-9-]{3,19}`; e.g. generate with `openssl rand -hex 6` (prefix a letter if needed). Keep it unchanged for updates. |
| `FRESH_DATABASE_NAME` | New empty dedicated DB name: `duna_fresh_` + 3–24 lowercase letters/digits. Keep unchanged for updates. |
| `FRESH_NEW_SERVER_ACK` | Exact acknowledgement `NEW_EMPTY_SERVER:<FRESH_DATABASE_NAME>`; this is a guard, not proof. The host and project volume must genuinely be new/empty. |
| `FRESH_DB_SUPER_PASSWORD` | Unique bootstrap DB password, at least 32 characters; generate with `openssl rand -base64 48`. |
| `FRESH_DB_OWNER_PASSWORD` | Different unique schema-owner password, at least 32 characters; `openssl rand -base64 48`. |
| `FRESH_DB_RUNTIME_PASSWORD` | Different unique restricted API-role password, at least 32 characters; `openssl rand -base64 48`. |
| `FRESH_ADMIN_EMAIL` | Lowercase email address for the initial primary administrator. |
| `FRESH_ADMIN_PASSWORD` | Initial administrator password, at least 16 characters; use a password manager or `openssl rand -base64 24`. Keep this unchanged during routine updates. |
| `FRESH_AUTH_JWT_SECRET` | Unique access-token signing secret, at least 32 characters; `openssl rand -base64 48`. |
| `FRESH_AUTH_REFRESH_SECRET` | Different unique refresh-token signing secret, at least 32 characters; `openssl rand -base64 48`. |
| `FRESH_ATTACHMENT_URL_SECRET` | Different unique attachment-link signing secret, at least 32 characters; `openssl rand -base64 48`. |

The installer rejects repeated values, line breaks, unsafe settings, and a
non-matching new-server acknowledgement. Secret values must not begin with a
quote. Keep the same `FRESH_*` settings across updates; the workflow refuses to
replace `.env.fresh.local` if any setting differs. Credential rotation is a
separate operation and must not be smuggled into a routine deploy.

## Operator and GitHub permissions

- The target must be Debian or Ubuntu, reachable over SSH, with outbound access
  to GitHub, Docker's APT/image registries, npm, and the package sources used by
  the build. DNS for `DEPLOY_HOSTNAME` must resolve to the server, and inbound
  TCP ports 80/443 must be allowed by the provider firewall for ACME/browser
  access. Bootstrap opens those ports in UFW if UFW is installed and active. First-run bootstrap requires root or
  non-interactive sudo. The workflow installs Node, pnpm, Docker, Compose,
  Nginx and Certbot; no manual database setup is required.
- The deploy SSH public key must be authorized for `DEPLOY_USER`; the pinned
  server host key must be verified independently and stored as a secret.
- Actions must be enabled for the repository, and the `production` environment
  must be allowed for this branch. To dispatch or monitor a run through GitHub
  CLI/API, the connected GitHub identity needs repository Actions write access
  (the `workflow_dispatch` permission) and Actions read access to inspect run
  results. No additional token is stored in repository settings.
- GitHub's manual `workflow_dispatch` requires the workflow to exist on the
  repository's default branch. Push triggers work on this deployment branch;
  for manual dispatch to become available in GitHub before merge, the workflow
  must first be merged to the default branch. An Arena-triggered dispatch also
  needs the same Actions write permission. The workflow is already configured
  for both triggers; branch availability and GitHub permissions are external
  repository settings.

## Sandbox validation and limitations

Previously executed application tests/build and API/Web proxy acceptance are
recorded in the repository handoff. The Docker Fresh Installer, bootstrap on a
real Debian/Ubuntu host, database backup/restore, and GitHub-hosted deployment
cannot be executed in this sandbox because there is no Docker daemon or
authorized server target. They are intentionally not represented as passed.
The workflow has not been manually dispatched against a server. The first real
install must produce its own successful GitHub run and health markers.
