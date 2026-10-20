# Fresh install and deployment (GitHub Actions)

## One supported production path

Use `.github/workflows/install.yml` for both a first installation and all
subsequent deployments. A push to `arena/8f399c78-duna` and a manual
`workflow_dispatch` run the same verify-then-deploy path. Do not run the
fresh installer manually on a production host, and do not use the retired
`deploy/install-server.sh` for new installs.

Exact GitHub Actions settings and preparation instructions are in
[`deploy/README.md`](../deploy/README.md). The workflow skips SSH entirely
unless all settings exist and the explicit `DEPLOY_ENABLED=true` opt-in is set.
The public `DEPLOY_HOSTNAME` must resolve to the server, and the provider
firewall must permit inbound TCP 80/443 for ACME and dashboard access (UFW is
opened by bootstrap when active). Once
configured, the operator does not create a DB, write a host `.env`, install
Docker/Node, run migrations, or start services by hand.

## First install

The workflow first installs dependencies, generates Prisma, runs typecheck,
lint, tests, and builds the API and dashboard on GitHub Actions. Only if every
check passes does it:

1. Verify the server host key against the pinned `DEPLOY_SSH_KNOWN_HOSTS` value
   and connect with the dedicated SSH key.
2. Transfer the exact verified commit archive and the private fresh config over
   SSH without putting secret values into shell commands or script text.
3. Bootstrap Debian/Ubuntu host requirements as needed: Docker Engine and
   Compose from Docker's fingerprint-pinned APT key, Node.js >=20 (Node 22 if
   missing), pnpm 9, Nginx and Certbot. A non-root SSH user needs
   non-interactive sudo and Docker-group access; Docker access is root-equivalent.
4. Run `pnpm setup`. The repository's guarded installer refuses a non-empty
   deploy path, an existing project volume, or a populated database. It then
   builds/tests the isolated image, provisions its private PG16 volume and
   roles, applies migrations and the structural seed with initial admin,
   configures grants, starts API and Web, and runs authenticated smoke tests.
5. Configure the managed Nginx HTTPS ingress, issue/renew the hostname TLS
   certificate with Certbot, and verify the externally reachable login page and
   database-backed API health. Run read-only `pnpm setup --health` and `--status`
   and report the exact deployed commit.

No prior database is adopted or initialized over. If the target is not truly a
new, empty install target, setup stops without resetting or deleting it.

## Subsequent updates

On a complete install, Actions invokes `pnpm setup --upgrade`, not the fresh
installer. It confirms existing service/DB health, builds and tests the
candidate first, and checks every pending migration for `DROP TABLE`, `DROP
COLUMN`, `DROP SCHEMA`, `TRUNCATE`, or `DELETE FROM`. Any such migration is
blocked for separate review. Before applying allowed migrations, it creates a
private PostgreSQL custom-format backup under `.fresh-setup/backups/`; it never
runs fresh seed, `migrate reset`, `compose down`, volume prune or DB recreation.
Then it applies `migrate deploy`, verifies migration checksums and runtime
grants, starts the API/dashboard, and checks live health. Incomplete installs,
changed deployment identity, and implicit secret rotation are refused.

Backups are not automatically pruned or copied off-host. Configure off-host
backup retention and restore drills as a separate operational requirement;
the workflow's pre-migration dump does not replace a disaster-recovery plan.

## Secret transport and SSH identity

The workflow uses GitHub Secrets as environment variables, constructs the
private installer file in a mode-0600 runner temporary file, then streams it
through SSH stdin to a mode-0600 host file. Values are never inserted into the
SSH command line or remote script, and all secret settings must be stable
between routine updates. The key used for SSH is stored mode 0600 on the
ephemeral runner. `StrictHostKeyChecking=yes` and a required known-hosts pin
are used; there is no `ssh-keyscan` trust-on-first-use fallback. Obtain the
server key fingerprint from the provider console or another independent
trusted channel and compare it before saving its known-hosts entry.

## Validation boundaries

The repository's unit/contract tests, typecheck, lint, build and prior sandbox
API/Web acceptance are documented in `deploy/README.md`. The sandbox has no
Docker daemon or real server, so it cannot validate host bootstrap, the actual
containerized first install, a production DB backup/restore, or a GitHub deploy
run. Do not treat these as passed. The first real install remains pending the
operator's GitHub settings and its own green Actions deployment/health result.
