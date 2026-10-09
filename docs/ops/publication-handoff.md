# Publication and server deployment handoff — 2026-10-09

## Current instruction and scope

The user explicitly withdrew the Arena-preview login prerequisite. **Prepare publication now;
real login and database-backed acceptance will be tested on the user's configured server.**
Do not resume attempts to provision the Arena database, generate its Prisma engine, reset an
admin password or authenticate there. Historical login diagnostics describe environment limits,
not a current publication gate. No backend startup/login/DB repair was attempted in this turn.

Branch: `arena/fe92d85a-duna`. Intended PR base: **`ai-test`**. Never push directly to main,
force-push or merge the PR automatically. Publication is blocked here **only by the closed
session's GitHub restrictions**, not by the missing preview backend.

## Final local diff review

The complete baseline-relative file list was reviewed against the available shallow baseline
`da1ff0ee0ea138c26c22870a6c20cf37109248ae`; the initial cumulative diff contained 125 paths,
including prior documentation. All intended work is present:

- Public landing sections, brand assets, fonts, translations and auth/navigation links.
- All 33 operational dashboard routes, shared shell, dialogs, focus/typing corrections,
  mobile/RTL navigation, persistent themes, menus and localized EN/FA/AR presentation.
- Existing port-3010 configuration, runtime script fixes, guards and regression tests.
- Backend business/auth/user-management source and Prisma schema/seed unchanged from baseline.
  No admin account or authentication behavior is changed in this publication-preparation turn.

The sole baseline-relative deletion is `apps/web/src/components/home/icons.tsx`, replaced by
the retained landing icon/component structure. No operational route was deleted. Independent
AST comparison confirms API method/path calls match baseline on all 33 pages (not a proof of
payload or database semantics). The existing intentional UI reset-password improvement sends
an administrator-entered value to the unchanged authorized endpoint; it does not silently reset
an account or set a universal password.

Only `.env.example` and `apps/web/.env.example` are tracked environment files. No dependency,
build, test-result or recovery-archive directories are tracked. Fonts/images are intentional
landing assets, not accidental build output. Added lines were checked for private keys,
recognizable GitHub/AWS credentials and the inherited seed-default password; no new matches
were found. Existing example/test/default-password references in baseline history are not new
credentials and are not evidence the whole historical repository is secret-free. Neither the
user's supplied password nor real environment values are copied into new source/docs.

The actual remote `ai-test` comparison is **not available**: only cached origin/main and
origin/HEAD exist locally. Do not mistake the reviewed local baseline diff for a live PR diff
or assume already-merged landing changes need to be reapplied on GitHub.

## Fresh validation

| Check | Result |
| --- | --- |
| Web typecheck | Pass |
| Web lint | Pass, zero warnings/errors |
| Web production build | Pass, 108 generated static pages |
| Translation guard | Pass, 2,114 message leaves ×3 locales |
| Contract guard | Pass; existing BillStatus/DeliveryReleaseStatus skips and computed-tail limitation remain |
| Existing production-browser regression suite | **22/22 pass**, 3.0 minutes, against the fresh production build |
| Port/script checks | 7/7 pass |
| Config unit tests | 10/10 pass |
| Shared/config builds and typechecks | Pass |
| API method/path comparison | Pass, all 33 operational pages |
| Real auth/DB tests | Deferred to the user's server, intentionally not retried |

The web was stopped through its managed process only to avoid sharing `.next` during the build,
then the newly built production server was restarted on `0.0.0.0:3000`. Browser tests run against
that build with fixtures confined to the test runner. They do not claim real database acceptance.
An initial scratch audit script had an incorrect TypeScript import path; correcting the diagnostic
script resolved it and the method/path check passed. No application source changed to fix a test.

## Production environment (keep actual values outside Git)

**Do not overwrite the user's working environment with `.env.example`.** Preserve their existing
DB URL and JWT secrets. Examples are development placeholders, not production credentials.
Use a secret manager/service environment or protected ignored environment files.

### Nest API — repo-root `.env` or service environment

| Variable | Required deployment setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Existing approved PostgreSQL connection URL; preserve database/schema and provider TLS requirements |
| `AUTH_JWT_SECRET` | Existing strong secret; do not rotate as part of this UI deployment |
| `AUTH_JWT_REFRESH_SECRET` | Existing configured secret; required by the validator |
| `API_PORT` | `3010` default; retain an explicit working alternative if the proxy matches |
| `API_HOST` | Appropriate service bind address; use a private interface or container bind plus firewall/reverse proxy |
| `API_VERSION` | `1`, matching the existing `/api/v1` contract |
| `API_CORS_ORIGINS` | Explicit actual frontend origin allow-list; do not use `*` for authenticated traffic |
| `AUTH_JWT_EXPIRES_IN` / `AUTH_JWT_REFRESH_EXPIRES_IN` | Preserve existing settings; defaults are `15m` / `7d` |
| `APP_TIMEZONE` / `APP_DEFAULT_CURRENCY` | Preserve existing settings; defaults are `Asia/Dubai` / `USD` |

### Next web — `apps/web/.env.local` or web build/runtime environment

| Variable | Required deployment setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `/api/v1`, set during the web build; never a sandbox/browser localhost URL |
| `API_INTERNAL_URL` | Server-only API origin, normally `http://127.0.0.1:3010` for the same host; **no `/api/v1` suffix** |

For separate containers, replace loopback with the API service's internal hostname. If the API
continues to use 3001 or 3101, explicitly set API_PORT and the matching API_INTERNAL_URL together.
Both defaults and examples currently agree on 3010, with tests for overrides. Startup/status
scripts read the configured port; root Nest `.env` and Next's web `.env.local` are separate.
Restart affected services after environment changes; rebuild after changing `NEXT_PUBLIC_*`.

### Build and server acceptance

On an approved build/server environment with the existing configuration and matching Prisma
native engine available:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @shipping/shared build
pnpm --filter @shipping/config build
pnpm --filter @shipping/api build
pnpm --filter @shipping/web build
```

Use the server's existing service manager/deployment process to restart API/web. The baseline API
lint/build issues reported in older audits are not asserted fixed here; investigate failures on
the real configured build environment rather than bypassing validation. No schema migrations were
introduced by this work: do not reset, reseed or alter an existing admin account for a frontend
rollout. Review any genuinely pending migrations through the normal deployment procedure.

After deployment verify direct API health, same-origin proxied health, actual admin login,
`/auth/me`, authorized dashboard pages, EN/FA/AR direction/themes, and approved database workflows.
Those server checks are acceptance work for the user, **not a prerequisite for publishing this
branch for review**. Protect the database and take the normal deployment backup first.

## Exact publication steps — NEW GitHub-enabled session only

The commands below were **not executed against GitHub in this closed session**. Start a session
on the intended branch, recover the archive first if necessary, and preserve any new local work.
Do not run the push block until the ancestry/diff review succeeds. Stop on command failure.

```sh
set -e
# 1. Verify local state; do not clean/reset/switch away from valuable changes.
test "$(git branch --show-current)" = "arena/fe92d85a-duna"
test -z "$(git status --porcelain)"
git log -5 --oneline
git remote -v

# 2. Obtain actual remote history. This repository was shallow in Arena.
if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
  git fetch --unshallow origin
else
  git fetch origin
fi
git fetch origin \
  refs/heads/ai-test:refs/remotes/origin/ai-test \
  refs/heads/arena/fe92d85a-duna:refs/remotes/origin/arena/fe92d85a-duna

# 3. Inspect both sides and require a fast-forward path before pushing.
git log --left-right --graph --oneline HEAD...origin/arena/fe92d85a-duna
git merge-base --is-ancestor origin/arena/fe92d85a-duna HEAD
# If this exits nonzero, STOP for reviewed reconciliation. Never force-push.

git diff --name-status origin/ai-test...HEAD
git diff --stat origin/ai-test...HEAD
git diff --check origin/ai-test...HEAD
git diff origin/ai-test...HEAD
# Review the full actual PR diff: landing parity, deletions, auth/ports,
# credentials/env files, unrelated content and generated artifacts.
```

If a remote ref is absent, fetching/deepening fails or histories diverge, stop and inspect the
actual remote situation. Do not invent ancestry, overwrite newer remote commits, blindly
cherry-pick the cumulative restoration checkpoint, or assume a missing ref is permission to
replace it. Resolve divergence with a reviewed, non-rewriting plan that preserves remote work.

Only after the preceding review is complete:

```sh
set -e
test "$(git branch --show-current)" = "arena/fe92d85a-duna"
test -z "$(git status --porcelain)"
git merge-base --is-ancestor origin/arena/fe92d85a-duna HEAD
# 4. Publish this branch only, without --force or --force-with-lease.
git push origin arena/fe92d85a-duna

# 5. Verify the remote tip equals the intended local tip.
git rev-parse HEAD
git ls-remote --heads origin refs/heads/arena/fe92d85a-duna

# 6. Reuse an existing PR if present; do not create duplicates.
gh pr list --state open --base ai-test --head arena/fe92d85a-duna
# If no matching PR exists:
gh pr create --base ai-test --head arena/fe92d85a-duna \
  --title "Preserve landing redesign and refine localized dashboard" \
  --body-file docs/ui/pr-ai-test.md
```

Record the actual remote commit and PR URL after success. **Do not merge** the PR or push directly
to `main`/`ai-test`. The user reviews, decides when to merge and tests on their server.

## Recovery handoff

All intended changes are committed locally; the final commit/archive name is in the session
report and archive README. Preserve older archives. The latest archive contains the final branch
bundle, reachable shallow-boundary metadata, checksums, PR body, deployment/publication guide
and safe restore instructions. It is stored under ignored `.handoff/`, not published as source.
A bundle alone is insufficient for this shallow checkout; retain the archive's `shallow` file.
Download an independent copy. Restore into a new directory and verify the commit/tree before
importing into any existing checkout; never overwrite an unrelated repository's shallow metadata.
