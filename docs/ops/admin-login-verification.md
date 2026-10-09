# Real admin login verification — 2026-10-09

> Historical diagnostic. The user has since withdrawn the Arena login-first gate. Do not retry
> preview provisioning/authentication. Prepare publication now and defer real-data acceptance to
> their server; [current handoff](publication-handoff.md) supersedes the earlier publication conditions.

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

## Verified failure chain

1. **Correct port, no active override:** the live Next process has no `API_INTERNAL_URL` or
   `NEXT_PUBLIC_API_URL` override. The current source and compiled route handler both target
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

No new port or frontend change is justified by these results: 3010 already matches. Missing
services, configuration and generated client must be supplied in an approved runtime. The
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
