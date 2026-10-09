# Backend connection and publication handoff — 2026-10-09

> Historical diagnostics, with deployment examples corrected to the required API port **3101**.
> The earlier request for 3010 was erroneous and has been withdrawn; it is retained below only
> in explicitly historical evidence, never as an active recommendation. Current validation and
> file-by-file changes: [port-correction audit](api-port-correction.md). **Do not publish yet.**

## Preservation and Git facts

The resumption started on `arena/fe92d85a-duna` at shallow baseline
`da1ff0ee0ea138c26c22870a6c20cf37109248ae`. All restored landing/dashboard changes
were again unstaged/untracked, not in the reported local history. These exact objects are absent:

- Reported checkpoint `ba48f28869cb5607847ba195420151f3fca3297b`
- Reported final commit `20ca01cd2b2151beccdd1a80bde49b45d05f0f93`
- User-supplied landing commit `c3b5c5360c730ec4ee0bd6157e6d6552cc6035a`

The previously reported external bundles also were not present. After checking paths,
source/config diffs, deletion references, artifacts and recognizable credential patterns,
111 intended file changes were preserved in **`3aa1f1b15f54e68c49451f670785617a5fa93507`**.
No existing source changes were discarded, no branch was switched and no history was rewritten.
The only baseline-relative deletion is the obsolete `components/home/icons.tsx`; the replacement
landing components/icons and their assets are included and all pages build successfully.

The landing page's sections, translated catalogs, images, self-hosted fonts and auth links are
present. This is a file-level finding, **not verification that the user-supplied landing commit
is an ancestor or that the files match current GitHub**. The current follow-up leaves all preserved
frontend design/components/tests unchanged; its only web runtime changes are the proxy's port
fallback and web environment example.

Configured origin: `https://github.com/arashalidadi/duna.git`. Only cached `origin/main` and
`origin/HEAD` exist locally, both at `1875ed576a98765bfe0560361c4eb2328c3cf53f`.
There are no cached `origin/ai-test` or `origin/arena/fe92d85a-duna` refs. Remote operations
are disabled in this closed coding session: **no GitHub fetch, push or PR creation was attempted**.
Thus a complete diff against **actual** `ai-test`, remote ancestry and safe-push eligibility remain
unverified. The reviewed local baseline diff is not a substitute for that comparison.

### Backup caveat and correction

`git rev-parse --is-shallow-repository` is true. A plain bundle passed `git bundle verify`, but
an isolated import failed because the parent of the shallow boundary is absent. This disproves
any assumption that bundle verification alone establishes a self-contained full-history backup.
An isolated bare import with the saved, reachable shallow boundary succeeded, passed `git fsck
--full`, and reproduced the checkpoint tree hash exactly. The final recovery archive similarly
contains a bundle **and** its required shallow-boundary metadata with restoration instructions.
It preserves the available local history; it does not invent or replace missing remote ancestors.

Backups/evidence live in ignored `.handoff/`, not in source commits. Download the final archive
from the session deliverable and keep an independent copy: prior workspace restores lost both
Git objects and backups outside the repository. The final commit hash/archive path are reported
in the final handoff and recorded in the archive's README. Do not publish backup binaries to Git.

## Port diagnosis — a combination of inconsistent defaults and absent services

Historical state before the earlier, now-superseded change:

| Location | Port/configuration |
| --- | --- |
| `packages/config/src/load-config.ts` fallback | 3001 |
| Root `.env.example` | 3101 |
| Next proxy fallback + web `.env.example` | 3101 |
| Detached start/status/stop scripts | hard-coded 3101, even with an API_PORT override |
| Recent historical workstation docs | 3101, a workaround for another service using 3001 |
| Earlier mistaken request (withdrawn) | 3010, not configured in that checkout; required project port is 3101 |
| Historical API listener observation | none on the then-inspected ports; no backend availability is claimed |

**3101 is the required project API port and the aligned default.** The original 3001 default
was superseded by the 3101 workaround, now the required setting. Explicit deployment overrides
remain supported when both API and proxy agree; no endpoints, auth checks or business rules change.

```dotenv
# Backend: repo-root .env or environment supplied to Nest
API_HOST=0.0.0.0
API_PORT=3101

# Web: apps/web/.env.local or environment supplied to Next
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://127.0.0.1:3101
```

`API_INTERNAL_URL` is an origin, without `/api/v1`; the proxy adds that prefix. It is server-only.
For an explicitly different backend port, update **both** `API_PORT` and `API_INTERNAL_URL`.
The detached scripts now resolve their API checks from exported `API_PORT`, then repo `.env`,
then 3101. They no longer execute `.env` as shell code or let it silently overwrite an exported
API port. Root `.env` remains loaded by the existing Nest config factory. Next separately reads
its web environment file. Restart affected services after changes; rebuild after `NEXT_PUBLIC_*`
changes. For separate containers, use the API's service hostname rather than loopback.

No browser code calls sandbox localhost. Same-origin forwarding, bearer headers, refresh-token
contracts, timeout behavior, structured outage 502 and upstream status forwarding are unchanged.
Historical logs and old demo-seeding scripts already reference 3101 consistently. Those demo
scripts were neither run nor rewritten; they are not a way to repair an existing admin account.

## Database and startup prerequisites

The Docker Compose development file provides **PostgreSQL 16 on 5432 only**, with a named volume;
there is no API service/port mapping in that file. The standalone database script is an alternative
for a previously provisioned workstation. It refers to `/home/arash/shipping-erp/pgdata` and
`/tmp/opencode/pgroot`; neither exists here. An external PostgreSQL service is also supported via
`DATABASE_URL`, but none is configured/approved in this workspace.

Current checks found:

- No Docker executable or socket; no postgres, pg_ctl or psql executable; no local cluster/listener.
- No real root `.env` or web `.env.local` (examples only).
- `DATABASE_URL`, `AUTH_JWT_SECRET`, `AUTH_JWT_REFRESH_SECRET`, `API_PORT` and
  `API_INTERNAL_URL` initially unset. Only presence/absence was inspected; no secret values printed.
- No supplied authorized database account/application login.

Consequently neither API nor database was started. No migrations, seeds, DB resets, production
connections, guessed credentials or backend responses were used to manufacture a working login.
No existing services were stopped: the restored runtime initially had none of the app services.
The web's production preview has now been restored on `0.0.0.0:3000`.

## Prisma failure, independently diagnosed

A fresh `pnpm db:generate` fails before generation when downloading the checksum for
`libquery_engine.so.node` from `binaries.prisma.sh`, with a TLS connection-disconnected error.
This host is outside this environment's outbound allow-list. Dependencies were installed with a
frozen lockfile and scripts disabled, then generation was explicitly attempted so the failure was
visible rather than hidden in install hooks.

- Prisma CLI and client both resolve to **5.22.0**; no version mismatch was found.
- Node **22**, Debian **12**, OpenSSL **3.0.20** are present.
- Prisma detects **debian-openssl-3.0.x**, matching the engine being requested.
- Schema uses the standard `prisma-client-js` generator and PostgreSQL `DATABASE_URL` datasource,
  with no custom engine mirror/binary path configured.

The immediate failure is the restricted engine download, **not the API port**. No missing OpenSSL
or wrong target is evidenced at this stage; engine execution cannot be tested until it is obtained.
API build currently fails on missing generated Prisma types/client (930 cascading diagnostics).
No schema/client upgrades, TLS-disable flags or fake generated client were introduced.

To unblock: use an approved build/runtime environment able to obtain the matching Prisma engine;
provision isolated PostgreSQL (or an approved reachable non-production service); supply DB URL
and unique JWT secrets through secret configuration; generate Prisma and build the API; apply
reviewed migrations and reference seed only to that approved database. Start Nest on 3101 (or a
matched explicit override), verify direct **and proxied** health, then use an authorized account
for real login/refresh/logout, server RBAC and database workflow tests. Existing accounts or
approved account provisioning are required; example/default passwords are not verified credentials.

## Historical validation from the earlier resumption (not current correction results)

| Check | Result |
| --- | --- |
| Config unit tests | **10/10 pass**, including then-current default/empty-port and explicit-override cases |
| `node scripts/test-api-port.mjs` | **7/7 pass**, defaults/examples/proxy parity, dotenv precedence, quoting, invalid ports and safe script failure |
| Shell syntax; status with default and 3101 override | **Pass**, reads actual configured API port; does not start/stop services |
| Shared/config builds + typechecks | **Pass** |
| Web typecheck + lint | **Pass**, no lint warnings |
| Web contract + i18n checks | **Pass**, 2,114 messages ×3; existing documented contract-check exclusions remain |
| Production build | **Pass**, 108 generated static pages |
| Existing Chromium UI regression suite | **22/22 pass**, 4.7 minutes, runner-only network fixtures |
| Landing/login via preview Host header | **200** in EN/FA/AR |
| Real proxied `/api/v1/health` | **502 UPSTREAM_UNAVAILABLE**, not a healthy API |
| Direct API ports examined in that earlier session | connection refused; historical observation only |
| Prisma generation / API build | **Blocked/fail** as detailed above |
| Real authorized login / database workflows / server RBAC | **Not verified**; required services/config/accounts absent |

The UI test command exceeded the tool's first 240-second wait; the existing test process was
allowed to finish without starting a duplicate run. Its final report is 22 passed. API E2E was not
rerun against an absent database. Earlier API lint failures and backend test reports remain historical;
this change does not claim to fix them. Backend business source and Prisma schema/migrations are
unchanged. The only backend configuration change is the default API port plus regression tests.

## Safe GitHub publication — next session only

PR body is prepared in `docs/ui/pr-ai-test.md`; no PR exists from this resumption.
In a new GitHub-enabled session on the intended branch:

1. Verify the recovery archive, local status and local commits first. Preserve any new work.
2. Fetch the actual `ai-test` and `arena/fe92d85a-duna` refs; deepen/unshallow as needed before
   relying on merge-base/ancestry. Do not treat this checkout's cached main ref as remote truth.
3. Inspect `HEAD...origin/arena/fe92d85a-duna` in both directions and require the existing remote
   branch to be an ancestor of the proposed local tip before a fast-forward push. If it diverges,
   stop for a reviewed reconciliation that preserves remote commits—never force-push.
4. Review the actual three-dot PR diff `origin/ai-test...HEAD`: source, file deletions, landing
   sections/assets, generated files, environments and secrets. Check the user's landing commit
   using fetched objects; avoid duplicating already-merged landing content.
5. Only after those checks, perform `git push origin arena/fe92d85a-duna` (non-force).
6. Check for an existing PR before creating one. If needed, create with **base `ai-test`** and
   **head `arena/fe92d85a-duna`**, using the prepared body. Record actual remote commit/PR URLs.
7. Do not merge automatically into `ai-test` or `main`; the user will review and approve.

No remote comparison or publication was possible here, so no GitHub commit or PR URL is asserted
as evidence. Branch/compare URLs alone are navigation aids, not proof that this work is published.
