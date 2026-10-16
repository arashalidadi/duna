# Phase 11 — Audit dashboard, export route and post-switch acceptance

**Status (2026-10-16): Phase 11 code is locally verified; live acceptance is NOT complete. Phase 12 is on hold pending this report and the owner's separate explicit approval.** This report supplements the earlier [inspect/apply/verify runbook](phase11-live-server-inspect-apply-verify-2026-10-16.md); it does not authorize re-running Stage 2 or any database-changing step.

## What was actually found

- **Missing dashboard page/menu: confirmed product omission.** Before this change there was no `apps/web/src/app/[locale]/(dashboard)/audit/page.tsx`, no `/audit` entry in `NAV_SECTIONS`, and no Audit translations. The sidebar/overview only render configured navigation items the user may read. A direct dashboard Audit URL therefore had no page; an owner could browse the API but could not find a corresponding screen.
- **API route and authorization in source:** `AuditController` is registered in `AppModule`, with `GET /api/v1/audit` requiring `audit:read` and `GET /api/v1/audit/export` requiring **both** `audit:read` and `audit:export`. The global JWT guard returns 401 without a session; a valid ordinary user lacking a required permission receives 403. The primary administrator's `isPrimaryAdmin` flag bypasses permission-row lookup for both routes. The ordinary ADMIN role can receive `audit:read` but is **not** automatically given `audit:export`; the dedicated `AUDIT_EXPORTER` dashboard role must be explicitly assigned by the owner. Those application roles are distinct from the PostgreSQL connection roles.
- **The reported ordinary-user export 404 is not a successful permission denial.** The owner reported direct API health, both `/auth/me` requests and owner browse as 200, but ordinary export as **404** instead of **403**. The 404's live root cause is **not yet established**: deployed build/route registration, request target and runtime process still require comparison. No backend source permission relaxation or speculative route rename was made. Source assertions and the isolated prior API E2E exercise the intended 403/owner 200 behavior; neither proves which binary is running on the owner's server.
- **Web proxy contract gap:** the Next proxy forwarded CSV bodies and content type but dropped `X-Audit-Export-Has-More` and `X-Audit-Export-Next-Offset`. It now forwards those headers **only** for `GET /api/v1/audit/export`. Without them a UI could silently mistake a bounded 500-row page for the whole history. The download client refuses a successful CSV with missing pagination metadata rather than claiming it is complete.

## Delivered UI and precise routes

| Surface | Route | Who sees it / behavior |
| --- | --- | --- |
| Dashboard Audit page (default Persian locale) | **`/fa/audit`** | Owner or any user with `audit:read`; read-only, filterable, 25 events/page. |
| Dashboard Audit page (English / Arabic) | **`/en/audit`**, **`/ar/audit`** | Same policy; translated labels; Arabic/Persian RTL. |
| Sidebar and dashboard quick access | **`/audit`** locale-aware link in **Insight & Control** | Shown only when `hasPermission('audit:read')`; the owner has implicit authority. |
| Browse API | **`GET /api/v1/audit`** | `audit:read`; filters action, entity type/ID, actor ID, local-time range converted to UTC, limit/offset. |
| Export API | **`GET /api/v1/audit/export`** | `audit:read` **AND** `audit:export`; explicit past UTC from/to window (max 31 days), 500 rows/file and next-offset headers. |
| Browser transport | **`/api/v1/[...path]`** on the web origin | Forwards auth header and path/query to the internal API; CSV is downloaded as a blob, not parsed by the JSON client. No token in the URL. |

The UI hides export from ordinary readers without `audit:export`, does not fetch audit rows for a direct visitor lacking `audit:read`, and surfaces an export **404 as a route/build problem**, not as a denial. The API remains the authority: hiding a button is not authorization. Download is user-triggered, never automatic; each successful export creates a legitimate `audit.export` event. For more than 500 matching rows the user must deliberately request the next page; changing filters/time window resets that offset.

**Changed paths:** the new `apps/web/src/app/[locale]/(dashboard)/audit/page.tsx`; `apps/web/src/lib/api/audit-{query,download}.ts`; web `nav.ts`, `messages/{en,fa,ar}.json` and binary-safe proxy `src/app/api/v1/[...path]/route.ts`; focused web/Nest/route/process diagnostic tests and test scripts; the generic workspace UI fixture for the new audit response; this handoff. The existing API audit controller, permission guard, database schema, grants and seed were **not** changed.

## Evidence and limitations

Owner-reported earlier workflow evidence from `b69c8e4`: Stage 1 reviewed digest `84bc296d6a8a50d9c4303f90698475c6ee4feaee9d307c2c12eff6519c9ed060`, Stage 2 `STAGE_2_COMPLETE`, Stage 3 `READY_FOR_API_SWITCH`. Those are **pre-switch** markers, not post-switch DB identity, export-authorization or final acceptance evidence. Do not repeat Stage 2 for this UI/route issue.

| Check (local workspace only unless noted) | Result |
| --- | --- |
| Config/shared builds; web typecheck and production build | Passed; build lists **`/fa/audit`**, **`/en/audit`**, **`/ar/audit`** and the dynamic `/api/v1/[...path]` proxy. |
| `pnpm --filter @shipping/web test` (contract/navigation/page-size/i18n + portal + new Audit query/download/proxy tests) | Passed; new Audit unit/proxy tests **5/5**, existing guards passed. |
| `pnpm test:phase11:audit:unit` (read-only source/route diagnostic, process-env redaction, actual PermissionsGuard) | **9/9** across two suites (7 Node tests and 2 Nest guard tests); no DB connection. |
| `pnpm check:phase11:authz` | **402 handlers: 394 permission-gated, 3 authenticated-self, 5 public; zero gaps.** |
| `pnpm test:phase11:server:unit` | **15/15**; no live database. |
| Mocked Playwright `tests/ui/audit.spec.ts` | **7/7**: implicit owner access, ordinary read-only vs explicitly delegated export, no-read direct URL, Arabic RTL/mobile, empty shape, pagination and honest 404 feedback. Fixtures intercept every API request; this is **not** a live-server authorization test. |
| Broader workspace UI smoke, 3 locales (attempted) | **3 failed** at unchanged `/accounting` *before reaching* `/audit`: `expect(locator('#workspace-main h1')).toBeVisible()` timed out (10 s), ErrorBoundary displayed “Unable to load this view.” The generic fixture supplies a paginated `{data,meta}` for `/ledger/accounts`, but `AccountingPage` expects an array and calls `accounts.map`. Its accounting implementation and generic mock behavior for this endpoint were not changed; the Audit-specific fixture was added. This out-of-scope fixture mismatch does **not** establish an Audit regression or prove full-suite success. |
| Live owner server | **Not accessible here**. Owner reported PID `906928`, port `3101` and cwd `/home/duna/shipping-dashboard/new-erp/apps/api` at the time of testing; health 200, owner/ordinary `/auth/me` 200, owner browse 200, ordinary export **404**. The reported PID can change on restart. Owner export, loaded DB role, post-restart log review and new web deployment are **not verified**. |

No migration, seed, grant, role change, destructive test, owner export or production DB write was run from this workspace. Do not run E2E against `duna_seed_test`; an isolated test database is required for any writing test. The local API typecheck/native-engine limitation recorded in the earlier runbook has not been reclassified as a successful API build.

## Owner-server follow-up — inspect first; no database-changing repeats

Work only in `~/shipping-dashboard/new-erp` on `arena/be9b4e5b-duna`. Review and deploy the commit in this report via the existing approved deployment procedure, preserving local edits. **Do not** run Stage 2, migrate, seed, grant, reset or restart PostgreSQL. The repository's `scripts/start-api.sh` contains a hard-coded `/home/arash/...` path; the owner-reported API cwd is `/home/duna/...`. Do **not** invoke that launcher on this host without verifying/correcting its actual manager/path. `scripts/restart-apps-only.sh --check` is a non-stopping preflight, not authority to restart an unmanaged API.

1. **Before restarting or making an authenticated export:** identify the actual listener/PID without printing process arguments or environment, then run the anonymous, no-export-window route probe:

   ```sh
   cd ~/shipping-dashboard/new-erp
   git branch --show-current && git rev-parse HEAD && git status --short
   ss -ltnp '( sport = :3101 )'  # identify the listener PID; do not print its environment
   node scripts/check-phase11-audit-routes.mjs 3101
   ```

   Expected: health **200**, anonymous browse **401**, anonymous export **401**. An export **404** before authentication is a **deployed route gap** (not an ordinary-user denial). Compare the process PID/cwd, actual built `apps/api/dist/src/common/infrastructure/audit/audit.controller.js`, build time and source; rebuild **only as necessary** (`pnpm build:api` generates a Prisma client but does not migrate data), restart **only with the confirmed existing manager**, then run the same anonymous probe once more. If the probe is 401 but an ordinary user's exact direct API URL still returns 404, check routing/rewrites, process target and sanitized response status; stop rather than inventing a policy success. Deploy the new web build with the web's actual manager (`pnpm build:web` for a production Next build). Do not blindly restart both services just for this test.

2. **Independent effective DB identity, without exposing URLs/passwords:** after establishing the current API PID from port 3101, `node scripts/check-phase11-process-db-identity.mjs <API_PID>` compares the **process-start environment** against only the reviewed `shipping_runtime_p11 @ 127.0.0.1:5432/duna_seed_test (public)` identity and never prints credentials. `EXPECTED STARTUP ENV` is stronger than inspecting today's `.env`, but still **not** proof of the active Prisma connection; `UNPROVEN` or `MISMATCH` must not be accepted. A DBA with an already approved, private PostgreSQL read-only session can correlate the API PID's established local TCP **source port** from `ss -Htnp state established '( dport = :5432 )'` with `pg_stat_activity.client_port`, and check `usename`, `datname`, `client_addr` and `backend_type`. For example, inside that authorized SQL session (replace the integer with a port actually observed for the API PID):

   ```sql
   SELECT client_port, usename, datname, client_addr, backend_type
   FROM pg_stat_activity
   WHERE client_port = <observed_api_source_port>;
   ```

   If Docker NAT remaps ports, permissions hide a PID/session, or the pool has no matching socket, **mark the result inconclusive** and get DBA-assisted, process-to-session evidence; do not change privileges or infer success from `.env` or a standalone `psql current_user` for a different process. Never share raw `DATABASE_URL`, `/proc/<pid>/environ`, bearer tokens or log lines containing secrets.

3. **Only after the live anonymous export route returns 401 and the running target is identified:** use the owner's already-authorized, non-exporting ordinary account for **one** direct GET to `/api/v1/audit/export` with a valid bounded past UTC window. Expected **403**, not 404; do not repeat if still 404. Then make **one** authorized owner export GET (expected **200**, `text/csv`, pagination headers and one new `audit.export` event); discard CSV content privately, do not post rows or tokens. The ordinary check must happen first, and the owner's CSV GET must not be retried reflexively. No second owner browse is needed just to replay the earlier 200.

4. Inspect the **actual** API/web process-manager logs privately from the restart window for startup failures, route-not-found, permission denials vs 500s, DB grant/auth errors and whether the single export was recorded. Share **sanitized conclusions/statuses only**. If role, route, or logs are wrong, stop and use the owner's reviewed API-only rollback process; do not alter DB ownership or target. Once the owner reports the independent DB connection identity, anonymous 401, ordinary 403, one owner 200 CSV/event, web page/menu rendering and clean post-restart logs, review this Phase 11 report for signoff.

**Phase 12 must not begin until the owner separately and explicitly approves it after reviewing the Phase 11 final report.**
