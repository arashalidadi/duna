# Phase 11 — Audit export 404: build, process and owner acceptance runbook

**2026-10-17. Status: code repair prepared locally; owner-server deployment and acceptance NOT performed.** This supersedes the API build/start instructions in the 2026-10-16 [live-server runbook](phase11-live-server-inspect-apply-verify-2026-10-16.md), **not** its historical Stage 1/2/3 evidence. Do not repeat Stage 2 or begin Phase 12. Run the blocks below in order, stopping at every gate; commands are for Linux with Node, pnpm, `ss` and readable `/proc`. The worktree here is `/home/user/duna`; the _different_ owner checkout was previously reported as `~/shipping-dashboard/new-erp` and is **not mounted here**.

## Approved database and hard stop before any service switch

**Owner clarification in this conversation (2026-10-17): `duna_seed_test` is the approved existing Phase 11 target; the newer `dna_seed_test` spelling does not supersede it.** The guard now accepts **only an explicit `PHASE11_APPROVED_DB_NAME=duna_seed_test`** and refuses either `dna_seed_test` or `duna_seed_test1`. This clarification is **not evidence of what the current server's API actually uses**. Before any service switch or DB-backed health/auth check, the owner/DBA must independently confirm the existing `erp-postgres` / PostgreSQL 16 / `127.0.0.1:5432` inventory, runtime role and actual API session. Never rename, migrate, create, seed, grant, reset, transfer ownership, or switch a database as a 404 workaround. The pre-start guard has **no default** and refuses a mismatched `DATABASE_URL` without displaying it; the explicit name is an operator assertion, not active-session proof. If role/host/port differs from the reviewed `shipping_runtime_p11 @ 127.0.0.1:5432`, STOP for fresh owner approval rather than loosening the check.

The existing PostgreSQL 16 `erp-postgres` is **externally managed**. `start-dev.sh`, `stop-dev.sh` and `restart-apps-only.sh` never control it. No destructive E2E, migration, seed, grants, new container or raw export body is part of this repair. Do not delete `.next`, `dist`, `.tsbuildinfo` or generated client data to make a build appear fresh. A prior `READY_FOR_API_SWITCH` was only a pre-switch gate, not live route/DB/authorization acceptance.

| Gate / state effect                                                                                  | Pass condition / stop and recovery                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source/build checks below: **no DB connection**, emit only ignored build artifacts                   | API build exits **0**, `pnpm check:api:build` exits **0**, Web build exits **0** independently. A failed Nest emit is **not** deployable even if `dist/src/main.js` exists. Fix the missing generated Prisma client/engine through the owner's approved **code-generation-only** procedure, then rebuild; never run a migration/seed as a build workaround. |
| Owner Git inventory / listener inspection: **read-only**                                             | Only the authorized branch and exact reviewed code; identify the listener PID, cwd, executable, loaded entry and its _actual manager_ before any stop. Unmanaged or ambiguous PID/port means STOP.                                                                                                                                                          |
| Target preflight: **reads environment/.env only**, no DB access                                      | Explicit approved name, runtime role and address match. Does not prove a live session. If mismatch, stop and resolve privately; do not print URLs.                                                                                                                                                                                                          |
| API-only switch: **one API process changes**                                                         | Only after build, target and manager gates. Repo-managed PID may be stopped with SIGTERM **only after** matching its exact entry, cwd, listener and start time. External-manager API must be switched by its identified approved manager, **never** by these PID-file scripts. Web and PostgreSQL remain untouched.                                         |
| Runtime + DB proof: **read-only inspection/queries**                                                 | New API PID/listener/build marker matches, then approved DBA proves its socket maps to `pg_stat_activity` on the approved database and role. A URL or `/proc` startup environment alone is insufficient. If unprovable, stop before health/export.                                                                                                          |
| HTTP/authorization: reads except **one intentional owner export**, which appends **one audit event** | Real health/browse/export anonymous **200/401/401**; approved ordinary audit reader **200 browse / 403 export**; primary owner **200 CSV**, bounded page and sanitized headers; exactly one matching `audit.export` event. No repeated owner export on error.                                                                                               |

## A. Inspect, build and test the reviewed source (workstation; no DB)

Working directory **`/home/user/duna`** in this sandbox, or the owner's reviewed checkout after code has been safely applied. These steps do not start services. `pnpm` must be on `PATH` (a Corepack shim is acceptable). Review the complete diff and untracked paths; preserve unrelated changes. On the owner machine, first verify its _actual_ path and branch rather than assuming the reported path still exists.

```sh
cd /home/user/duna
test "$(git branch --show-current)" = arena/be9b4e5b-duna || exit 1
git status --short
git diff --check
git diff --stat
```

```sh
: "${PHASE11_PRISMA_CODEGEN_APPROVED:?STOP: owner must approve client code generation before build:api}"
test "$PHASE11_PRISMA_CODEGEN_APPROVED" = I_APPROVE_CLIENT_CODEGEN_ONLY || exit 1
pnpm build:api
pnpm check:api:build
pnpm build:web
pnpm test:phase11:audit:unit
pnpm test:phase11:server:unit
pnpm check:phase11:authz
node --test scripts/check-api-build.test.mjs scripts/check-phase11-api-target.test.mjs scripts/phase11-apps.test.mjs scripts/check-phase11-authorized.test.mjs scripts/test-api-port.mjs
pnpm --filter @shipping/web test
```

Run each command separately; record its exit code. **Stop deployment** on any API build or attestation failure, but run independent Web/unit checks for diagnosis. Root `build:api` **retains the existing explicit `pnpm db:generate` code-generation step**, then builds config/shared and Nest; the filtered API build alone does not generate a client. Obtain the owner's code-generation approval and a working Prisma engine before running `build:api`: generation writes client files, **not** database schema or data, and must not be confused with migration/seed. If generation is not approved, STOP that build path rather than working around it by copying/deleting generated output. In this sandbox `pnpm --filter @shipping/api build` failed because the client was absent; although the corrected config emitted `apps/api/dist/src/main.js`, the attestation stayed **incomplete**. Do not run `node scripts/check-api-build.mjs finish` manually after a failed compiler. Old `apps/api/dist/apps/api/src/main.js` may remain on disk; it is never a supported entry and must not be copied or deleted as a workaround. `apps/api/tsconfig.build.json` excludes tests/seed imports and incremental emit; `apps/api/nest-cli.json` selects it. Supported `pnpm --filter @shipping/api start` and `scripts/start-api.sh` both foreground-exec the attested `dist/src/main.js`.

**Git release gate (operator approval required):** inspect the exact explicit path list in `git status`; stage only Phase 11 files with `git add -- <reviewed paths>`, then `git diff --cached --check` and `git diff --cached`. Only after authorization may the operator commit and `git push origin arena/be9b4e5b-duna`. No `git add -A`, reset, stash, discard, force push, branch switch, merge, rebase or pull. No commit/push is implied by this runbook. On the owner server, inspect `git status --short`, `git rev-parse HEAD`, and (read-only) `git fetch origin arena/be9b4e5b-duna`; apply the exact reviewed commit using the owner's approved deployment procedure **only if it preserves local changes and stays on this branch**. If no safe procedure exists, STOP; do not improvise a checkout/reset/merge. A workstation build does not deploy code to the owner server.

## B. Owner-server inspect and API-only switch (after A + verified existing inventory)

**Working directory:** the owner-verified checkout (previously `~/shipping-dashboard/new-erp`), on `arena/be9b4e5b-duna`. The owner must confirm the deployed commit and dependencies. The snippets here are not permission to run them from this sandbox. Set the non-secret, owner-confirmed `PHASE11_APPROVED_DB_NAME` to exactly `duna_seed_test` in the effective service-manager environment too. Do not paste a database URL/password into commands, Git, chat or logs.

```sh
cd ~/shipping-dashboard/new-erp
test "$(git branch --show-current)" = arena/be9b4e5b-duna || exit 1
git status --short
git rev-parse HEAD
export PHASE11_APPROVED_DB_NAME=duna_seed_test
pnpm check:api:build
node scripts/check-phase11-api-target.mjs
```

`check-phase11-api-target.mjs` mimics API config precedence (`process.env`, then `apps/api/.env`, then root `.env`); it redacts credentials and **does not connect**. It must run in the **same effective environment** as the eventual service manager; a shell preflight cannot attest different systemd/PM2-injected variables. For an external manager, review its environment source privately and put this guard in the approved launch path (`scripts/start-api.sh`); preserve the existing credentials and service account. If API and Web need rebuilding _in this server checkout_, run the separate A builds there before continuing. Never claim a stale server checkout is fixed because this sandbox built successfully.

Read-only process inventory, **before stopping anything** (port may be overridden in the effective API config):

```sh
./scripts/status-dev.sh
API_PORT="$(node scripts/dev-api-port.mjs)"
ss -H -ltnp "( sport = :$API_PORT )"
ss -H -ltnp '( sport = :3000 )'
ss -H -ltnp '( sport = :5432 )'
```

`status-dev.sh` prints managed/free/unmanaged, listener PIDs and build state; it **never queries PostgreSQL or prints credentials**. Nonzero exit means STOP, not a reason to force-kill. Record the actual API PID from `ss` and check `readlink -f "/proc/$API_PID/exe"` and `readlink -f "/proc/$API_PID/cwd"` locally; do not dump `/proc/$API_PID/environ`, passwords or raw command lines. Inspect the **real** process manager (systemd/PM2/etc.) and service definition without publishing secrets. A PID file alone, an open port alone, or a historic PID is not ownership proof. If PID is not readable or listener attribution is hidden, STOP for an operator with appropriate access.

If the API is **repo-PID-file managed**, run the non-mutating preflight, then the API-only switch **once** after explicit approval. No Web/DB restart:

```sh
./scripts/restart-apps-only.sh --check api
./scripts/restart-apps-only.sh api
./scripts/status-dev.sh
```

If API is down with a _free port and no stale PID file_, use `./scripts/start-dev.sh api` instead of restart. If managed API needs an approved stop without restart, `./scripts/stop-dev.sh api` checks its identity again and sends SIGTERM to exactly one PID; no SIGKILL/group kill or PostgreSQL operation. Default `apps` mode affects Web too: **never use it for an API-only incident**. `clean-stale` is permitted only for a proven-dead repo PID and free port: `node scripts/phase11-apps.mjs clean-stale api`; it removes **only** that stale PID file, not build output. A malformed/PENDING PID file or surviving listener needs manual investigation; do not delete it or guess a PID.

If the existing API listener has **no verified repo PID file**, these scripts deliberately refuse to restart/stop it. Locate its actual approved service manager; review its configured `ExecStart`/cwd/credentials privately, update only the API launch to use `scripts/start-api.sh` and the **already approved target**, and restart **only that identified API unit** using its own documented manager. Do not guess a systemd unit name or replace an unknown PID-file owner. `start-api.sh` refuses the wrong target and failed build, then `exec node` runs `apps/api/dist/src/main.js` with a non-secret build fingerprint in its startup environment. If the manager cannot apply that reviewed entry or cannot show its new listener, STOP; do not fall back to direct `node dist/...`, `pkill`, Docker or copied JS. Web remains on its existing manager; PostgreSQL remains untouched.

## C. Prove the _new_ runtime and actual database, then perform live HTTP checks

**Working directory:** same owner server checkout. First capture the **new** API listener PID from `ss` again (do not reuse an old PID). The following read-only code/runtime checks are mandatory even when a restart command returned zero:

```sh
API_PORT="$(node scripts/dev-api-port.mjs)"
ss -H -ltnp "( sport = :$API_PORT )"
: "${API_PID:?Set API_PID to the new exact listener PID from ss after inspection}"
node scripts/check-api-runtime.mjs "$API_PID"
pnpm check:phase11:process-db "$API_PID"
```

`check-api-runtime` checks the **listener PID**, Node executable, cwd, canonical entry and fingerprint against the present attested output; it works for an external manager without adopting/killing its process. `check:phase11:process-db` needs the explicitly approved `duna_seed_test` name and reads only the process's **initial** environment. `EXPECTED STARTUP ENV` is not proof of a live session; `UNPROVEN` (e.g. dotenv loaded after exec), mismatch, unreadable `/proc` or an absent password require independent DBA proof before HTTP. A real `UNPROVEN` result is recorded as such, not relabeled as a pass even if the DBA separately establishes the session. Do not infer the DB from a checked-in `.env` or guess the DB role from dashboard `ADMIN`/`AUDIT_EXPORTER` roles. A DBA with approved access must independently correlate the API's **client socket/ephemeral port** with `pg_stat_activity` on the existing PostgreSQL 16 service. **Only after confirming the owner-approved `duna_seed_test` inventory**, a DBA who already has read access to the existing `postgres` maintenance database may use the following read-only example; `APPROVED_DBA_ROLE` is the DBA-approved login (no password in the command or output). Compare the API PID/source port in `ss` to `client_port`, as well as exact role/database; a row with just the right name is not sufficient:

```sh
: "${APPROVED_DBA_ROLE:?Use an already-approved DBA login; do not grant a new role}"
ss -ntp '( dport = :5432 )'
psql -X -v ON_ERROR_STOP=1 -v approved_db="$PHASE11_APPROVED_DB_NAME" \
  -h 127.0.0.1 -p 5432 -U "$APPROVED_DBA_ROLE" -d postgres <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT pid, usename, datname, client_addr, client_port, backend_start
FROM pg_stat_activity
WHERE usename = 'shipping_runtime_p11' AND datname = :'approved_db'
ORDER BY backend_start DESC;
ROLLBACK;
SQL
```

If the DBA cannot view an attributable live connection, obtain approved evidence before proceeding; **do not run Stage 2 again**. The DBA should privately verify HBA/password evidence and the existing migration/trigger/least-privilege regression inventory from the earlier Stage 3 runbook. If the owner approves another **read-only** regression inventory and has the already approved private migrator/runtime credentials and HBA attestations configured, run `pnpm db:phase11:server verify` against the confirmed `duna_seed_test` target; record exit code and sanitized output. This is a supplemental catalog/privilege/trigger check, **not** a post-switch API route or owner-export acceptance marker. On failure STOP; do not apply/migrate/seed/grant speculatively. Neither a build nor the process-environment check proves these properties.

Only after actual session/role/database proof, set the **non-secret attestation** below. This is an operator assertion, not script proof:

```sh
export PHASE11_DB_IDENTITY_ATTESTED=I_VERIFIED_ACTIVE_SESSION
pnpm check:phase11:audit:routes
```

This is the **real** unchanged route probe against `127.0.0.1:$API_PORT`, not a source assertion or mock: `GET /api/v1/health` **200**, anonymous `GET /api/v1/audit` **401**, anonymous `GET /api/v1/audit/export` **401**. A 404 is a missing runtime route, **not** 403 authorization. If any status differs, STOP: inspect the new PID/build, actual port/prefix/manager and safe logs; do not weaken the expected 200/401/401 or repeatedly switch services. Do not declare deployment complete merely because Nest/Web compiled or ports are listening.

With owner-approved **existing** test accounts and their short-lived access tokens, run **once** from a private interactive terminal. The wrapper silently reads tokens through `/dev/tty`, passes them only on stdin, holds no CSV file and prints only sanitized status/header/event summaries. No login, password, token or CSV body appears in shell history, argv or report:

```sh
./scripts/check-phase11-authorized.sh
```

It first proves distinct ordinary `audit:read`/no `audit:export` and implicit primary-owner identities through `/auth/me`; ordinary browse **200** and ordinary export **403** must pass _before_ any owner export. One bounded owner CSV request then must be **200** with `text/csv`, attachment, `no-store` and valid export pagination headers; it checks the fixed CSV header without printing rows. Read-only Audit browse before/after proves exactly one `audit.export` event for the owner, selected UTC window, row count and pagination metadata. An export can append its legitimate audit row **even if later header/event checks fail**. Never repeat it blindly; investigate the audit log and sanitized server logs first. Verify Web `/fa/audit` and proxy/download independently under approved browser sessions **only after** API acceptance; Web was not restarted by the API-only switch.

**Failure/recovery:** record the exact command, exit code, sanitized `ss`/PID/build status and HTTP status, not credentials or CSV. If the new API fails or targets the wrong DB, STOP, leave PostgreSQL/Web untouched, and have the owner restore the prior approved API environment/build via its identified service manager and reviewed rollback procedure. Recheck DB identity and routes after _any_ rollback. Do not reset/stash the worktree, wipe generated directories, blind-rerun Stage 2, grant privileges, or silently switch databases. Acceptance is **pending** until owner provides the real runtime/DB/403/200/event evidence; only then report and request separate explicit Phase 12 approval.
