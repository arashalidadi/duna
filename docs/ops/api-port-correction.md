# Required API port correction — 2026-10-09

## Decision and publication hold

**The required backend API port is 3101. The frontend remains on 3000.**
The previous request for 3010 was a mistake; no active default, example, script, test fixture or
current deployment instruction uses it. Do **not** push, create a PR or merge anything until the
user has reviewed this correction and explicitly authorizes publication. Real server acceptance
remains with the user; do not resume Arena backend provisioning or login experiments.

The original project default was 3001. A conflict on that port led to 3101 as a workaround;
**3101 is now the required project default**, not a recommendation to restore 3001. Explicit
deployment overrides remain supported as requested, with both API and proxy configured together.
Historical default/override tests are explicitly labeled and are not active deployment settings.

```dotenv
# Backend service environment / protected repo-root .env
API_PORT=3101

# Next web environment / protected apps/web/.env.local
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://127.0.0.1:3101
```

The internal URL is an origin without `/api/v1`; the Next route adds that prefix. For separate
containers, retain the proper API service hostname rather than container-local loopback. Do not
change frontend port 3000, PostgreSQL port 5432 or CORS origins (which identify the frontend).
Retain real database/JWT secret configuration securely on the user's server; never copy sample
credentials over it. No admin, password, authentication, schema or business-rule change was made.

## Preservation before editing

On this restore, the branch was `arena/fe92d85a-duna` at shallow baseline `da1ff0e`, with the prior
work surviving as uncommitted files. Reported commit `4cdf7ec2b520981ee9e38ed118ad900df0e6f561`
and the reported recovery archive were absent.
All 126 intended restored file changes were reviewed and preserved first in checkpoint
**`74ffdaf0a240d702b6feb281e17e845e4c663862`**. Those are preserved earlier changes, not a new
redesign. The restored obsolete `components/home/icons.tsx` deletion remains intentional: its
landing component replacement and all assets survived. No work was discarded or history rewritten.

The following table lists **every file changed by this port correction relative to that checkpoint**.
The final archive additionally includes `PRESERVED-FILES.tsv`, enumerating each file preserved
by the checkpoint, and `CORRECTED-FILES.tsv`, enumerating the correction itself. The final
commit hash and recovery archive path are in the session report and archive README.

## File-by-file changes (20 files)

| File | Reason/change |
| --- | --- |
| `.env.example` | Correct API_PORT and server-only upstream example to 3101; leave frontend CORS origins and DB settings alone. |
| `apps/web/.env.example` | Correct API_INTERNAL_URL to loopback:3101; retain browser `/api/v1`. |
| `packages/config/src/load-config.ts` | Change Nest API port fallback to 3101; keep explicit environment precedence. |
| `apps/web/src/app/api/v1/[...path]/route.ts` | Correct server proxy fallback origin to port 3101; preserve forwarding, auth headers and status/error behavior. |
| `scripts/dev-api-port.mjs` | Correct absent/empty-port resolver fallback to 3101; retain dotenv parsing and validation. |
| `scripts/start-dev.sh` | Correct its default-port comment; actual startup checks already resolve the shared helper. |
| `packages/config/test/load-config.spec.ts` | Make normal fixture/default/empty expectations 3101; test historical 3001 and generic 4242 only as explicit overrides. |
| `scripts/test-api-port.mjs` | Correct all default assertions, use distinct override values, remove mistaken-port fixtures; add CLI, start/status/stop helper and unchanged web/DB-port guards (10 tests total). |
| `CLAUDE.md` | Correct project-wide default, proxy and development command instructions. |
| `README.md` | Correct API/Swagger URLs and examples; explain original 3001/workaround history and required 3101. |
| `docs/api.md` | Correct same-origin connectivity guidance and backend default. |
| `docs-gap/00-GAP-ANALYSIS.md` | Correct the runnable `pnpm dev` port annotation; do not recommend the obsolete default. |
| `docs/ops/local-dev-runtime.md` | Correct current default, service table and request-path diagram. |
| `docs/ops/publication-handoff.md` | Correct deployment environment matrix and port references; explicitly hold publication and mark commands as future/approval-only. |
| `docs/ui/pr-ai-test.md` | Correct the prepared PR description to 3101, update port-test count and state that no PR should be submitted yet. |
| `docs/ui/dashboard-redesign.md` | Replace the incorrect current-default banner with 3101 and link to this audit. |
| `docs/ops/backend-connection-audit.md` | Correct deployable examples, fallback and startup guidance; retain earlier measurements as clearly historical, withdrawn-port evidence. |
| `docs/ops/admin-login-verification.md` | Label previous observed requests/logs as historical, remove the claim that the mistaken port was the correct project choice, and point to 3101 without fabricating a new login result. |
| `docs/progress.md` | Record the corrected port and publication hold; mark interim statements as superseded and clarify the original 3001 history. |
| `docs/ops/api-port-correction.md` | New authoritative audit: decision, classification, complete changed-file manifest, checks, limitations and recovery rules. |

## Audited and intentionally unchanged

- `scripts/status-dev.sh` and `scripts/stop-dev.sh` obtain API_PORT from the corrected helper;
  no hard-coded incorrect port remains. Shell syntax and helper wiring are tested. No stop script
  was executed against user services.
- `scripts/verify-proxy.mjs` already describes a 3101 API and calls web:3000 `/api/v1`.
  The demo/seed scripts already target 3101. None were executed or used to alter an admin/DB.
- `apps/api/src/main.ts` reads `config.api.port`; its dotenv/config factory preserves environment
  overrides. API/workspace start commands delegate to this configuration, with no hidden CLI port.
- `apps/web/src/lib/api/client.ts`, Next configuration, web package scripts and Playwright config
  retain same-origin browser calls and frontend port 3000. Browser tests intercept `/api/v1`
  in the runner only; they do not need a hard-coded backend-port change.
- Backend integration tests instantiate Nest/Supertest instead of targeting the mistaken port.
  No API integration-test port reference required editing.
- The only deployment container file, `docker/docker-compose.dev.yml`, defines PostgreSQL 16,
  mapping 5432:5432. No API container/mapping, Dockerfile or CI workflow defining an API port was
  found in the repository. Do not invent new deployment infrastructure just to change this port.
- CORS examples contain web origins on 3000 (plus existing hostnames), not the API listener port;
  no CORS/auth weakening or unrelated service-port replacement is needed.
- Existing historical implementation logs with 3101, the documentation of an unrelated process
  on 3001, and the migration ID `20260903010012_phase5_inspection_management` remain unchanged.
  The migration's embedded digit sequence is **not** an API port.

## Repository-wide search classification

The initial search included tracked/restored-untracked source and hidden configuration, not just
`git grep` on the old baseline. Every occurrence of the three requested digit strings was reviewed.
Final source scans exclude Git object storage, dependency/build caches and ignored historical
backup/validation files; those are not editable active project configuration. The freshly built
Next route and compiled config package are checked separately for their actual default.

Allowed residual references to the **withdrawn port 3010** are limited to:

1. This audit's explanation of the error, never a setup command/default.
2. `docs/ops/backend-connection-audit.md`: the withdrawn request in its historical table/banner.
3. `docs/ops/admin-login-verification.md`: clearly historical observed requests/startup logs. These
   were not relabeled to 3101, which would falsely claim a test that was not performed.
4. `docs/progress.md`: explicitly superseded interim observations and the unrelated migration ID.

There are **zero 3010 matches in active application/config/script/test source**, the environment
examples, README, CLAUDE instructions, runnable gap-analysis command or current API/runtime/PR/
deployment instructions. Preserved Git history/pre-correction bundles naturally contain earlier
versions; they are not deployment instructions and must not be rewritten or mistaken for the
latest archive's branch tip. Latest archive README/restore/deployment examples specify 3101.

Residual **3001** occurrences are only historical explanations and explicit-override test cases,
not a default or runnable recommendation. Use **3101** for this project. Generic container/host
and explicit port override capability remains supported without recommending another default.

## Validation of the corrected work

| Check | Current result |
| --- | --- |
| Config unit tests | **10/10 pass**: normal, absent/empty fallback 3101; explicit overrides preserved |
| Port/script tests | **10/10 pass**: loader/proxy/examples parity, precedence, quoting, validation, CLI, script wiring, web/DB ports |
| Shell syntax / read-only status | **Pass** for start/status/stop syntax; status selects 3101 by default and honors explicit 4242 |
| Shared/config builds and typechecks | **Pass** |
| Compiled config fallback | **3101**, verified in generated package output |
| Frontend typecheck / lint | **Pass**, zero lint warnings/errors |
| Translation/contract checks | **Pass**, 2,114 leaves ×3 locales; documented contract exclusions unchanged |
| Frontend production build | **Pass**, 108 generated static pages |
| Compiled Next proxy origin | **http://127.0.0.1:3101**, no withdrawn-port string in that route bundle |
| Browser regression suite | **22/22 pass**, 2.6 minutes, against the corrected production build (runner-only network fixtures) |
| Landing/login rendering / preview Host header | **200** for all six EN/FA/AR pages; no real login credentials submitted |
| Real API/DB/admin authentication | **Unavailable/unverified**, not retried or fabricated |
| GitHub push / PR / merge | **Not attempted**, explicitly prohibited by the user |

The frontend production server is on `0.0.0.0:3000`. No API/database process, dummy auth session,
fake business data, migration or seed is introduced. Existing environment/Prisma constraints are
reported separately from these passing frontend/config tests, not treated as reasons to undo the
port correction. Backend business logic, schemas and admin credentials are unchanged.

## Recovery and subsequent review

The latest ignored recovery archive contains the final branch bundle, reachable shallow-boundary
metadata, exact restore instructions, checksums, this file-by-file audit, corrected deployment/PR
documents and preserved/corrected file inventories. Import into a **new** bare repository with its
saved shallow metadata, then verify commit and tree equality plus `git fsck --full`. A bundle alone
is not sufficient for this restored shallow checkout. Keep an independent downloaded copy.

Current instructions must say 3101. A pre-correction checkpoint is retained only for preservation,
not as the deployment tip. **No publication now**: review the correction first. Even in a later
GitHub-enabled session, wait for explicit approval before fetching/reconciling for publication,
non-force pushing this branch or opening a PR to `ai-test`. Never force-push or auto-merge.
