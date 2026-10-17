# Phase 11 — Audit dashboard, export route and post-switch acceptance

**Status (2026-10-16): Phase 11 code is locally verified; live acceptance is NOT complete. Phase 12 is on hold pending this report and the owner's separate explicit approval.** This report supplements the earlier [inspect/apply/verify runbook](phase11-live-server-inspect-apply-verify-2026-10-16.md); it does not authorize re-running Stage 2 or any database-changing step.

**2026-10-17 supersession:** the build/output-path cause of the owner-reported export 404 is now reproduced. The historical results below remain historical; use the new [root-cause status report](phase11-root-cause-fix-2026-10-17.md) and [ordered operations runbook](phase11-operations-runbook.md). The 2026-10-16 follow-up commands are withdrawn because they predate the now-resolved database-name discrepancy and guarded launcher. No live post-fix acceptance has occurred.

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

## Superseding owner-server follow-up (2026-10-17)

**Do not execute the previous 2026-10-16 follow-up steps.** The launcher no longer contains a hard-coded home path or shell-sources `.env`; root `pnpm build:api` retains its explicit client generation step (not a migration); the owner has now confirmed `duna_seed_test` but actual server identity must still be verified *before* any API switch/DB-backed check; and the authentic anonymous 200/401/401 check belongs *after* active DB-session proof. Follow the [current operations runbook](phase11-operations-runbook.md) in its stated order. Historical 200/401/404 remains an unresolved owner-runtime failure until independently rechecked after the repair.

**Phase 12 must not begin until the owner separately and explicitly approves it after reviewing the Phase 11 final report and live evidence.**
