# Phase 12 — owner-server installation, recovery and independent acceptance

**Scope:** this is the ordered continuation of the owner-approved Phase 11 installation, not a new Phase 11 acceptance. It applies ONLY to the approved `duna_seed_test` PostgreSQL 16 database in the existing externally managed `erp-postgres` container, exposed at `127.0.0.1:5432`, and the existing API/web services. The repo/session branch is `arena/be9b4e5b-duna`. Never run this against `dna_seed_test`, `duna_seed_test1`, another database, or a replacement container. Do not restart PostgreSQL. Do not infer compliance periods, backup calendars, role membership, legal authority, mail routing, or the off-server storage location. No step here authorizes a new DB/container, ownership/privilege transfer, test data, offsite deletion, or unrelated infrastructure changes. Phase 11 remains owner-approved; do not repeat its acceptance campaign.

**Current execution status:** implementation and offline checks only; NOT run on the owner server. No owner DB migration/seed, first backup, isolated restore, live route/identity proof, timer enablement, or service restart is represented by this document. Run the following stages sequentially *on the owner hosts*, record command exit codes and independent evidence. `PASS` requires every mandatory stage including recovery/monitoring. `FAIL` or an unavailable prerequisite means STOP; do not report successful deployment. Optional items are labelled **OPTIONAL**. Run commands from a protected interactive session; do not paste tokens, secrets, `.env`/CSV contents or signed backup files into tickets or transcripts. Store the protected evidence in the owner operations register.

## 0. Authorise change window and review the exact checkout (MANDATORY)

Owner supplies an absolute, already-deployed checkout path in `PHASE12_CHECKOUT`, the final SHA reported with this delivery, approved code deployment into that checkout, an independent *pre-change* recoverable backup under the existing approved method, approved DBA and security contacts, legal/compliance policy inputs, documented **RPO and RTO objectives** (and a rehearsal method for measuring full recovery), and planned application-only restart. If RPO/RTO are still undecided, infrastructure design/acceptance is outstanding; this repo invents neither. If the checkout is not at the reviewed commit, arrange an approved deployment separately; **do not pull, merge, reset, stash or overwrite the owner's work**. Review diffs first. On the owner API host:

```bash
set -Eeuo pipefail
: "${PHASE12_CHECKOUT:?Set the existing reviewed absolute checkout path}"
cd "$PHASE12_CHECKOUT"
test "$(git branch --show-current)" = arena/be9b4e5b-duna
git status --short
# Review with the delivered final SHA, not just a branch name:
export PHASE12_DEPLOY_COMMIT="$(git rev-parse HEAD)"
printf 'REVIEWED CHECKOUT: %s\n' "$PHASE12_DEPLOY_COMMIT"
test -z "$(git status --porcelain)"
node --version; corepack pnpm --version
command -v psql; command -v pg_dump; command -v pg_dumpall
psql --version; pg_dump --version; pg_dumpall --version
```

**PASS 0**: clean checkout on the exact delivered commit, authorized pre-change backup *already demonstrated recoverable* and change window approved; all PostgreSQL client tools are major 16. Otherwise **FAIL/STOP**. A code checkout SHA by itself is not recovery evidence. A separate security change approval is required before altering cluster role privileges or connecting a privileged backup login.

## 1. Inspect configuration and independently identify the actual DB destination (MANDATORY, before any DB write)

Provision `/etc/duna/phase12-db.env` with existing approved owner `DATABASE_URL`, effective running API `RUNTIME_DATABASE_URL`, and `PHASE11_APPROVED_DB_NAME=duna_seed_test`. This file must be a protected shell/EnvironmentFile-readable file, readable only by its authorized operator; do not print it. The two URLs must each resolve to the existing container/host/port and approved database, with owner login `shipping` and runtime login `shipping_runtime_p11` respectively. No credentials are changed. The existing API process environment, connection pools and Docker port mapping must be independently inspected by the DBA, not just the file. In a protected shell:

```bash
set -Eeuo pipefail
cd "$PHASE12_CHECKOUT"
test "$(stat -c %a /etc/duna/phase12-db.env)" = 600
set -a; . /etc/duna/phase12-db.env; set +a
export PHASE12_EXPECTED_DB=duna_seed_test
: "${DATABASE_URL:?Approved owner URL missing}"
: "${RUNTIME_DATABASE_URL:?Existing API runtime URL missing}"
test "$PHASE11_APPROVED_DB_NAME" = duna_seed_test
test "$(docker inspect --format '{{.State.Running}}' erp-postgres)" = true
docker port erp-postgres 5432/tcp
ss -H -ltnp '( sport = :5432 )'
DATABASE_URL="$RUNTIME_DATABASE_URL" node scripts/check-phase11-api-target.mjs
# Mandatory source/connection/role/owner/Phase-11-ACL and pending-plan inspection:
corepack pnpm exec tsx apps/api/scripts/phase12-db-deploy.ts inspect
```

**DBA independent observation (MANDATORY, not a substitute for `inspect`):** in a separate protected DBA session use the existing approved credential source and `psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U shipping -d duna_seed_test -c 'SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();'` (no password in argv). Compare `docker port`, listening socket, `pg_stat_activity` for the live API process/client connection and approved database/user, and the checked runtime process environment. Before the backup record the primary database-level ACL and owner with `psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U shipping -d duna_seed_test -c "SELECT pg_get_userbyid(datdba) AS owner, coalesce(datacl::text, '<default>') AS acl FROM pg_database WHERE datname = current_database();"` (credentials supplied by the existing protected mechanism). The DBA records actual backend PID/client address/port and the API PID/socket correlation; verify this is **the actual destination** of *both* the existing API and the proposed migration login. The process DB check in §5 repeats this *after* restart. Do not infer a match from URL strings alone. No screenshot or report may contain secrets. If the process connection cannot be correlated, port points elsewhere, credentials lack approved rights, migration inventory differs, checksum has drift, or non-Phase-12 migrations are pending, **FAIL/STOP**. `inspect` has no DB write and prints `PHASE12_REVIEWED_PLAN_SHA256`; save it privately. **PASS 1** requires both the tool inspection and independently correlated DBA evidence.

## 2. Local build and offline regression gates on reviewed code (MANDATORY)

Use the ordinary Prisma client with its **real** query engine on the owner server, not the engine-free local CI compilation fallback. Fail if engine generation is unavailable; do not use `/bin/true` as a deployment engine. These commands do not seed or migrate. Only the approved checkout is built:

```bash
cd "$PHASE12_CHECKOUT"
corepack pnpm install --frozen-lockfile
corepack pnpm exec prisma generate
corepack pnpm exec prisma validate
corepack pnpm --filter @shipping/shared build
corepack pnpm --filter @shipping/config build
corepack pnpm --filter @shipping/api typecheck
corepack pnpm build:api
corepack pnpm check:api:build
corepack pnpm --filter @shipping/web typecheck
corepack pnpm --filter @shipping/web test
corepack pnpm --filter @shipping/web build
node --test scripts/phase12/*.test.cjs scripts/phase12/*.test.mjs
TSX_TSCONFIG_PATH=apps/api/tsconfig.json corepack pnpm exec tsx --test apps/api/scripts/test-phase12-archive.ts apps/api/scripts/test-phase12-http.ts
corepack pnpm --filter @shipping/api exec jest --config test/jest-e2e.cjs --testRegex '.*\.unit-spec\.ts$' --runInBand
corepack pnpm check:phase11:authz
corepack pnpm check:seed-safety
corepack pnpm test:phase11:server:unit
```

**PASS 2:** every command returns zero, API/web artifacts correspond to the reviewed commit, and no hidden engine-free runtime artifact is deployed. Tests run here are mocks/static contracts, **not** evidence of a live DB, route protection, durable backup or restore. If normal codegen cannot fetch the query engine, **FAIL/STOP**, provision the approved engine through normal operations and rerun; do not bypass.

## 3. Execute only the inspected Phase 12 migration and guarded incremental seed (MANDATORY)

Before any Phase 12 DB write, DBA attests the §1 *actual* destination and §0 pre-change recoverable backup in the protected operations register. **No `db push`, `migrate reset`, blanket seed, SQL console changes, target swap or new container.** `inspect` again immediately before the change; if its plan SHA changes, obtain a fresh review/approval. Copy the exact 64-hex digest from the newly displayed `PHASE12_REVIEWED_PLAN_SHA256`, not a guessed value:

```bash
cd "$PHASE12_CHECKOUT"
corepack pnpm exec tsx apps/api/scripts/phase12-db-deploy.ts inspect
read -r -p 'Paste newly reviewed PHASE12_REVIEWED_PLAN_SHA256: ' PHASE12_REVIEWED_PLAN_SHA256
export PHASE12_REVIEWED_PLAN_SHA256
export PHASE12_MIGRATION_APPROVAL=I_APPROVE_ADDITIVE_PHASE12_MIGRATION
export PHASE12_PRECHANGE_BACKUP_ATTESTED=I_HAVE_RESTORED_PRECHANGE_BACKUP
corepack pnpm exec tsx apps/api/scripts/phase12-db-deploy.ts apply
corepack pnpm exec tsx apps/api/scripts/phase12-db-deploy.ts verify
```

The `apply` gate re-inspects, requires exact digest, targets `duna_seed_test` only, runs Prisma `migrate deploy` for the *single* allowed migration, runs the conflict-aware Phase 12 permission seed, then verifies migration checksum, exact seven new permissions (including reserved, ungranted `archive:delete`), retention table/two immutable-floor triggers, letter deletion guard, Phase 11 audit protections, restricted runtime grants and absence of new backup permission grants to default ADMIN. `verify` repeats postflight and fresh read-only probes for forbidden runtime privileges. If any operation fails, **FAIL/STOP**; retain the backup and have the DBA examine `_prisma_migrations`, ACLs and application logs before a reviewed correction. Do not rerun `apply` against a different plan or repair migrations manually. Do not set legal retention numbers in this step; none are seeded. **PASS 3** requires both `apply` and independent `verify` exit zero and DBA comparison of actual database/role.

## 4. Bring up only changed application services, then independently check them (MANDATORY)

DB is still externally managed: **no PostgreSQL restart**. Use the existing approved application manager. Inspect `./scripts/restart-apps-only.sh --check apps`, current API/web unit identities and process env without displaying secret values; compare with approved runtime settings and ports. Restart only API and web, never `all`/PostgreSQL/other services:

```bash
cd "$PHASE12_CHECKOUT"
./scripts/restart-apps-only.sh --check apps
./scripts/restart-apps-only.sh apps
./scripts/status-dev.sh
: "${API_PID:?Set the independently identified new API process PID}"
: "${API_PORT:?Set the already approved local API listener port}"
node scripts/check-api-runtime.mjs "$API_PID"
corepack pnpm check:phase11:process-db "$API_PID"
node scripts/phase12/check-routes.mjs "$API_PORT"
```

An alternate approved application manager may be used *only* if this checkout's script is not the owner's actual manager; record its exact API/web-only commands and proof of affected service names. From a separate DBA session repeat the §1 PID/socket/`pg_stat_activity` correlation for the **new** live API, actual `duna_seed_test` DB and `shipping_runtime_p11`. The anonymous route probe requires healthy listener, `/archive/letters` registered but unauthorized, the read/history/policy routes protected, archive/reopen denied without auth, and identity-capture route protected; it performs no writes. It cannot prove a bearer token's role or business transitions. **PASS 4:** all commands zero, only affected services restarted, same approved DB destination independently correlated, and no health/auth regression. A `fetch failed` without a listener is **FAIL/not verified**, not a successful route check.

## 5. Explicitly authorised live lifecycle and role checks (MANDATORY; controlled test data)

An owner-approved **synthetic** office letter is required to demonstrate live create → send → archive → search → reasoned history → reopen → deletion refusal, and a second office account with `letter:read` but **without** `archive:reopen` to demonstrate 403. The test intentionally leaves the synthetic SENT letter and audit history in `duna_seed_test`; **do not delete it**. No portal identity image, financial record, customer CSV, or real correspondence is used. Obtain the two distinct tokens through the owner's approved authentication flow (do not put tokens in argv, shell history or reports). The gate refuses to run until both the owner authorises test data and the DBA has compared the new API's live DB session as in §4. In a protected terminal (not a recorded shell session):

```bash
cd "$PHASE12_CHECKOUT"
read -rs -p 'Owner office access token (not echoed): ' PHASE12_OWNER_TOKEN; printf '\n'
read -rs -p 'Reader office access token, no reopen grant (not echoed): ' PHASE12_READER_TOKEN; printf '\n'
export PHASE12_OWNER_TOKEN PHASE12_READER_TOKEN
export PHASE12_LIVE_DB_ATTESTED=I_MATCHED_API_PID_AND_DB_SESSION
export PHASE12_LIFECYCLE_TEST_APPROVED=I_AUTHORIZE_SYNTHETIC_LETTER
node scripts/phase12/check-authenticated.mjs
unset PHASE12_OWNER_TOKEN PHASE12_READER_TOKEN
```

The script emits only test record ID and pass/fail, not token/body; it checks owner policy GET and reader archive GET, 403 for no-grant reopen, 400 for invalid reason, archive status, search, reasoned audit events, reopen to previous status and 409 for deletion of a previously archived letter. On failure it may leave the synthetic record at an intermediate status; DBA must inspect it, do **not** cover up the failure with a delete. **PASS 5:** script exit zero and DBA/auditor independently verifies the archived/reopened audit entries and test ID in the approved DB. If owner declines synthetic data, mark this stage **NOT PERFORMED/FAIL for full deployment acceptance**, not PASS.

Automatic archiving requires an independently approved `LETTER.archiveAfterDays` criterion and actual SENT/RECEIVED eligibility; policy/history and permission boundaries must be reviewed by the compliance owner. Set the criterion via `PATCH /api/v1/archive/policies/LETTER` with protected admin credentials (never direct SQL); input includes owner-supplied `authority`, `minimumDays` if legally required, `lawfulBasis` where appropriate, and `archiveAfterDays`. Lowering an existing minimum is rejected by both API and DB. `IDENTITY_DOCUMENT` requires separately approved `minimumDays`, `authority` and `lawfulBasis` **plus** the existing capture flag; do not enable capture before approval. No default retention period or date is supplied by this repo. With no approved criterion, the automatic job must no-op; record that it is **not live-verified** until a genuinely eligible, separately authorised test-only letter has been processed and the audit/history checked. Do not age real letters or lower policy floors just to make a test pass. Identity capture must be checked with authorised test consent and the already-approved policy; otherwise mark that subcheck unperformed, not a permission to invent policy.

## 6. Configure encrypted off-server backup and test incident delivery (MANDATORY)

The backup schedule/retention settings are owner inputs, not legal defaults. Provision a **pre-existing, restricted, genuine off-server NFS/CIFS mount** and a dedicated operator-approved service account with read rights to the existing attachment storage and *pre-existing approved DBA backup login* (no grant/role changes in this runbook). PG major 16 client tools, Node, `age`, OpenSSL with Ed25519, tar, findmnt, flock and logger must be installed and approved. `pg_dumpall --roles-only` preserves role authentication and includes cluster role metadata: DBA must explicitly approve its scope and existing backup login (`pg_authid` SELECT privilege); if the cluster has unrelated roles or the login lacks this privilege, **STOP and redesign/review** rather than copy unrelated secrets, add a superuser grant or pretend the backup is complete. Restrict both signing keys, the age private key on the *isolated host only*, and `.pgpass` to mode 0600 and the right account. Use distinct Ed25519 keys for backup-manifest signing and isolated restore-receipt signing; distribute **only public keys** to the opposite host via the owner's approved secret-management channel. Encryption recipient is the separately approved recovery operator. Verify offsite mount identity, host identity, capacity, access restrictions, key escrow, alert delivery and real restore credentials outside this repo. No plaintext backup is written to disk; ciphertext stream and signed manifest are written offsite.

Provision protected `/etc/duna/phase12-backup.env` (mode 0600) with:

- `PHASE12_BACKUP_ROOT` existing protected directory **beneath** (not equal to) the absolute remote mount target; `PHASE12_EXPECTED_SOURCE` exact `findmnt` source; `ATTACHMENT_STORAGE_DIR` existing attachment root (the same effective path as the API); `PHASE12_AGE_RECIPIENT` authorised public recipient. Backup account must own its mount directory, attachment directory and each referenced attachment with mode 0700/0600 respectively; otherwise stop, never relax existing storage permissions.
- `PHASE12_MANIFEST_SIGN_KEY`, `PHASE12_MANIFEST_PUBLIC_KEY`, `PHASE12_RESTORE_PUBLIC_KEY` absolute protected key paths; `PHASE12_PGPASSFILE`, `PHASE12_PGUSER` approved **existing** DBA backup account; `PHASE12_ALERT_COMMAND` absolute reviewed notifier file **owned by the executing account** (the provided `scripts/phase12/alert-mail.sh` only works when that account owns it); `PHASE12_ALERT_RECIPIENT` real independently monitored mailbox (the notifier uses local `sendmail`). The protected `.pgpass` must cover any pre-existing local cluster DB to which `pg_dumpall --roles-only` legitimately connects.
- `PHASE12_MAX_AGE_HOURS` actual backup freshness objective, `PHASE12_RESTORE_INTERVAL_DAYS` actual rehearsal objective, `PHASE12_BACKUP_RETENTION_DAYS` approved offsite retention, `PHASE12_JOB_TIMEOUT_MINUTES` approved process watchdog. All must be positive and chosen by the owner, never generated by us. `PHASE12_PRUNE_APPROVAL` must be deliberately set to `I_APPROVE_OFFSITE_RETENTION` only after owner approves actual deletion under this retention; without it pruning is dry-run and automatic timer installation is blocked.

```bash
cd "$PHASE12_CHECKOUT"
test "$(stat -c %a /etc/duna/phase12-backup.env)" = 600
set -a; . /etc/duna/phase12-backup.env; set +a
: "${PHASE12_BACKUP_ROOT:?No off-server mount}"
findmnt -T "$PHASE12_BACKUP_ROOT" -o TARGET,SOURCE,FSTYPE
: "${PHASE12_RPO_HOURS:?Document and export owner-approved RPO hours}"
: "${PHASE12_RTO_MINUTES:?Document and export owner-approved RTO minutes}"
export PHASE12_RPO_HOURS PHASE12_RTO_MINUTES
node -e 'const r=Number(process.env.PHASE12_RPO_HOURS),m=Number(process.env.PHASE12_MAX_AGE_HOURS),t=Number(process.env.PHASE12_RTO_MINUTES); if (![r,m,t].every(n=>Number.isSafeInteger(n)&&n>0)||m>r) process.exit(1)'
node scripts/phase12/backup.cjs preflight
node scripts/phase12/backup.cjs alert-test
# Independently confirm message receipt at the remote mailbox; exit 0 alone is insufficient.
```

Preflight compares actual PG session to approved DB/server/user, checks storage tree against live attachment paths, **rejects any non-local attachment/template storage adapter** (an approved object-store-specific backup procedure would be required), checks keys, offsite mount/source and tools, and fails closed if access to role authentication hashes is inadequate. `alert-test` sends a benign synthetic message through the real notifier; owner must confirm arrival and on-call escalation. **PASS 6:** protected owner records independent mount/keys/role/notification evidence, an actual schedule whose worst-case backup age is within the signed RPO, a recovery exercise plan for the RTO, and both commands exit zero; test email received. If RPO/RTO inputs, alerting or key escrow are missing, **FAIL/STOP**.

## 7. Produce, verify and independently restore the first encrypted copy (MANDATORY)

On the primary, after §3 and §6 pass, with the backup env still loaded:

```bash
cd "$PHASE12_CHECKOUT"
node scripts/phase12/backup.cjs backup
# Transcribe the BACKUP_COMPLETE ID (format UTC timestamp + random suffix):
read -r -p 'Reviewed BACKUP_COMPLETE ID: ' PHASE12_BACKUP_ID
node scripts/phase12/backup.cjs verify "$PHASE12_BACKUP_ID"
# Do NOT prune until an independently signed isolated-restore receipt exists.
```

Backup streams pg_dump custom format, scoped storage tar, and cluster roles/globals through age, signs a SHA-256 manifest with business/finance/audit/asset row counts, public-schema object (tables, sequences, routines and schema) ownership/ACL digest and encrypted file hashes, and atomically publishes under the mounted root. It refuses symlinked assets, incomplete manifests, local-only root, wrong DB and mismatched live attachment references. `verify` checks ciphertext/hash/signature without decryption; **it is not a restore test**. Do not prune before reviewing selections or signing deletion approval.

On a **different isolated host** under separate recovery ownership: owner provisions PG16 **already running** isolated cluster with a **pre-created EMPTY** `PHASE12_RESTORE_DB` (different name from `duna_seed_test`), an existing *distinct* isolated DBA account capable of globals restore, EMPTY isolated `PHASE12_RESTORE_STORAGE_DIR`, the same restricted offsite share (read access to signed ciphertext **and** narrowly approved write access to `restore-receipts`), age *private* identity, manifest *public* key, receipt *private* signing key and existing approved protected PG passfile. The existing script's strict 0700/0600 owner checks require the **same dedicated numeric backup UID** on both hosts for the offsite tree; operational recovery ownership and secret custody remain separate. A different UID/ACL layout requires security-reviewed code changes, not relaxed permissions or a false PASS. Independently managed immutable snapshots/object lock of the offsite filesystem are recommended because a writable mount alone is not ransomware protection. Set `/etc/duna/phase12-restore.env` mode 0600 with `PHASE12_BACKUP_ROOT`, `PHASE12_EXPECTED_SOURCE`, `PHASE12_MANIFEST_PUBLIC_KEY`, `PHASE12_RESTORE_PUBLIC_KEY`, `PHASE12_RESTORE_SIGN_KEY`, `PHASE12_RESTORE_PGPASSFILE`, `PHASE12_RESTORE_PGUSER` (existing isolated superuser), `PHASE12_RESTORE_DB`, `PHASE12_RESTORE_STORAGE_DIR`, `PHASE12_AGE_IDENTITY_FILE`, `PHASE12_JOB_TIMEOUT_MINUTES`. The isolated database must have **zero** existing public objects; the isolated cluster must not already contain any of the app roles (including `shipping`, runtime, exporter), and its administrative role must not conflict with any role in the encrypted global dump. It must **not** have the primary DB/host identity. The restore script neither creates a DB nor drops/overwrites existing data. Do not run the following on the primary. In the isolated checkout of the same reviewed commit:

```bash
set -Eeuo pipefail
cd "$PHASE12_CHECKOUT"
set -a; . /etc/duna/phase12-restore.env; set +a
read -r -p 'Transcribe verified primary BACKUP_COMPLETE ID: ' PHASE12_BACKUP_ID
export PHASE12_RESTORE_APPROVAL=I_AUTHORIZE_ISOLATED_RESTORE
export PHASE12_GLOBALS_APPROVAL=I_AUTHORIZE_RESTORING_ROLES
PHASE12_RESTORE_START_UTC="$(date -u +%s)"
node scripts/phase12/backup.cjs restore "$PHASE12_BACKUP_ID"
PHASE12_RESTORE_END_UTC="$(date -u +%s)"
printf 'Restore-script seconds (not full RTO): %s\n' "$((PHASE12_RESTORE_END_UTC - PHASE12_RESTORE_START_UTC))"
PGHOST=127.0.0.1 PGPORT=5432 PGUSER="$PHASE12_RESTORE_PGUSER" \
  PGPASSFILE="$PHASE12_RESTORE_PGPASSFILE" PGDATABASE="$PHASE12_RESTORE_DB" \
  psql -X -v ON_ERROR_STOP=1 --no-password -c \
  "SELECT pg_get_userbyid(datdba) AS owner, coalesce(datacl::text, '<default>') AS acl FROM pg_database WHERE datname = current_database();"
```

DBA must independently compare this isolated DB-level owner/ACL with the primary observation from §1, then verify effective runtime database CONNECT/CREATE permissions and any additional roles. **The restore script does not alter database ownership or database-level grants.** If they differ, this stage is **FAIL** pending an explicitly authorized isolated-target remediation and a fresh isolated rehearsal; never silently transfer ownership or alter the production DB. The signed receipt and primary freshness check cover the objects they verify, not this separate DBA attestation.

The isolated restore refuses primary name/host/port, non-empty target, storage inside the backup mount, and non-empty asset dir; it decrypts globals to *isolated* PostgreSQL, restores DB and assets, then verifies signed row counts for 14 representative business, finance, audit and asset tables; public-schema object (including routines/sequences) ownership/ACL digest; audit/retention/letter-deletion triggers; runtime privilege limits; existence of every DB-referenced private asset; DB-stored SHA-256 of each historical company artwork asset; and signed ciphertext/archive checksums. It does not independently compute per-attachment source-content hashes (most attachment rows have none), nor reconstruct the owner DB's database-level owner/ACL on the isolated target; those require separate DBA review and explicit authorization, never an implicit ownership transfer. A separately signed receipt is committed to the offsite share. If globals restore fails (e.g. pre-existing role conflicts), do **not** remove/recreate roles on primary or skip checks; treat it as a failed rehearsal and arrange an approved isolated-target remediation. The restore is not evidence for the production DB unless its signed receipt is independently retrieved and validated there. On the primary, after the isolated host reports success:

```bash
cd "$PHASE12_CHECKOUT"
node scripts/phase12/backup.cjs status
node scripts/phase12/backup.cjs prune  # review dry-run selection first
```

**PASS 7:** backup + ciphertext verification + independent isolated restore + signed receipt + primary freshness/status all exit zero, checksums/counts/ACLs/role access match and DBA signs off recovery evidence. Compare the backup's age at simulated loss to the approved RPO, and the **entire disaster recovery exercise** (provisioning, credentials, restore, app start and health) to the approved RTO. The timed restore-script subset above alone does *not* prove full RTO; if no full exercise was authorised/performed, mark RTO **UNVERIFIED** and do not claim the recovery objective met. If private key, isolated DB, offsite share or receipt is unavailable, **FAIL/STOP**; a signed ciphertext alone is not recoverability. Offsite pruning keeps newest copy and most recently restored copy, preserves historical signed restore receipts and refuses unknown entries or deletion without explicit approval. Each later restore requires its own independent authorisation and empty isolated target.

## 8. Install ONLY new Phase 12 schedules and prove monitoring (MANDATORY)

Only after §7 and explicit owner-approved calendar/retention/alert decisions, set `PHASE12_PRUNE_APPROVAL=I_APPROVE_OFFSITE_RETENTION` in the protected backup env, re-source it, and run an approved manual `prune` after reviewing its dry-run output. This may delete expired, independently reviewed offsite copies; it never deletes the newest or latest independently restored one. The backup unit calls guarded pruning **after** a successful backup, so disabling approval makes pruning dry-run; do not claim enforced retention in that state. `PHASE12_SERVICE_USER` must be the account with approved read access to live assets and protected backup files; if worker/API privileges differ, stop and obtain a reviewed service split rather than expand existing privileges. Owner supplies `PHASE12_BACKUP_CALENDAR`, `PHASE12_ARCHIVE_CALENDAR`, `PHASE12_MONITOR_CALENDAR` (systemd `OnCalendar` expressions), the existing full API runtime env file for archive worker, and the approved application-side Node executable. Configure archive worker's `PHASE12_EXPECTED_DB=duna_seed_test`, `PHASE11_APPROVED_DB_NAME=duna_seed_test` and existing runtime `DATABASE_URL`, but do not change the API's DB target. Inspect generated units before installing; never enable them with unknown calendars or without verified restore/alerting.

```bash
cd "$PHASE12_CHECKOUT"
set -a; . /etc/duna/phase12-backup.env; set +a
export PHASE12_CHECKOUT PHASE12_SERVICE_USER
export PHASE12_BACKUP_ENV_FILE=/etc/duna/phase12-backup.env
: "${PHASE12_ARCHIVE_ENV_FILE:?Existing protected API runtime env file required}"
export PHASE12_ARCHIVE_ENV_FILE
export PHASE12_NODE_BIN="$(readlink -f "$(command -v node)")"
export PHASE12_COREPACK_BIN="$(readlink -f "$(command -v corepack)")"
: "${PHASE12_BACKUP_CALENDAR:?Owner-approved calendar required}"
: "${PHASE12_ARCHIVE_CALENDAR:?Owner-approved calendar required}"
: "${PHASE12_MONITOR_CALENDAR:?Owner-approved calendar required}"
: "${PHASE12_SERVICE_USER:?Approved service account required}"
export PHASE12_BACKUP_CALENDAR PHASE12_ARCHIVE_CALENDAR PHASE12_MONITOR_CALENDAR
test "$PHASE12_PRUNE_APPROVAL" = I_APPROVE_OFFSITE_RETENTION
node scripts/phase12/backup.cjs status
node scripts/phase12/backup.cjs prune
export PHASE12_UNIT_STAGING_DIR="$(mktemp -d /tmp/duna-phase12-units.XXXXXX)"
node scripts/phase12/render-units.cjs
# Review the seven newly rendered Phase 12 units, their exact paths/User/env/calendars.
ls -l "$PHASE12_UNIT_STAGING_DIR"
systemd-analyze verify "$PHASE12_UNIT_STAGING_DIR"/*.service "$PHASE12_UNIT_STAGING_DIR"/*.timer
sudo install -m 0644 "$PHASE12_UNIT_STAGING_DIR"/duna-phase12-*.service /etc/systemd/system/
sudo install -m 0644 "$PHASE12_UNIT_STAGING_DIR"/duna-phase12-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start duna-phase12-monitor.service
test "$(systemctl show -p Result --value duna-phase12-monitor.service)" = success
sudo systemctl enable --now duna-phase12-backup.timer duna-phase12-archive.timer duna-phase12-monitor.timer
systemctl list-timers --all 'duna-phase12-*'
```

The three jobs are: encrypted backup + approved pruning; bounded automatic archive (no criterion => no-op); and backup/restore freshness monitor. Each service has `OnFailure` to the dedicated alert unit using the owner's verified notifier. After enablement, inspect real execution history via `journalctl -u duna-phase12-backup.service -u duna-phase12-archive.service -u duna-phase12-monitor.service --since today --no-pager` (check logs for accidental sensitive output before sharing). Execute each service only with owner approval of its effect; a manual archive service start *can archive eligible real letters*. Simulate a service failure in an approved nonproduction context and confirm on-call notification, or obtain independent verified failure-path delivery evidence. Check that calendar progression, alert delivery, backup age and restore cadence match owner settings. **PASS 8:** rendered unit inspection, monitor start, enabled three timers, observed execution/alert evidence, and owner-approved retention/criterion inputs; otherwise **FAIL/STOP**. Do not install duplicate legacy backup/archive schedulers.

## 9. Independent acceptance ledger and recovery decision (MANDATORY)

Record separate **PASS/FAIL/NOT PERFORMED** with timestamp, reviewer and redacted evidence for stages 0–8: exact commit; checked Phase 11 baseline and pre-change recovery; actual owner AND API DB destination; migration/seed and triggers/grants; changed-services-only restart; unauthenticated route and authenticated lifecycle/portal-vs-office checks; legal policy and identity gate; backup/encryption/mount/receipt; independent restore with assets/roles/ACL/counts; alert/timer execution and freshness. Explicitly verify `/[locale]/archive` in English, Persian and Arabic for approved office staff and ensure portal cannot see/use the page or APIs. Finance and attachment reads must still obey established permission and tenant/portal guards. Check configured identity document policy rejects capture without authority/lawful basis and never claim legal approval merely from a passing code test. Confirm automatic archive by authorised eligible synthetic or independently approved eligible letter *after* real policy configuration; otherwise record it not live-verified. **Do not announce deployed success until every mandatory item and any legally required live subcheck passes.** A missing live policy input, isolated restore, notification receipt or DBA session correlation is an explicit outstanding blocker, not a passed stage.

**OPTIONAL, isolated environments only:** full DB-backed e2e suite with an existing approved test-only identity policy, automated browser regression, recovery-time measurement under disaster simulation, performance sampling on larger data and quarterly repeated restore drills. Do not point fixture-creating tests at the approved production-like owner DB without separately approved test-data authorisation. These checks add confidence but cannot replace the mandatory independent receipt, live DB identity and no-leak protections.
