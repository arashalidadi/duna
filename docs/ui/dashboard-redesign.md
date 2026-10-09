# Dashboard redesign — implementation and verification

> **Latest resumption:** see [backend/port/publication audit](../ops/backend-connection-audit.md).
> Current defaults are now **3010**, not the historical 3101 below. Prior local commit objects and
> external bundles were absent on restore; replacement preservation and a shallow-aware recovery
> archive are documented there. Historical verification and Git statements below are not current proof.

## Scope and preservation

The 33 existing operational routes remain in place. The data-fetching architecture is still the typed REST client plus page-local React state and AuthProvider. Existing API paths, request payloads, permission checks, database schema and business workflows are preserved. The one deliberate payload improvement is the users password-reset form: it sends an administrator-entered password instead of a universal hard-coded password to the same authorized endpoint.

On the 2026-10-09 resumption, the actual checkout was `arena/fe92d85a-duna` at `da1ff0e`, with 66 modified and 44 untracked files containing the restored landing/dashboard work. Nothing was staged. Historical hashes `b9e9018`, `104ba1f`, `0965762` and `431ed57` are **absent from the current object database**; earlier conversational reports do not establish their present branch containment or remote availability. After review, all 110 intended files were preserved in local checkpoint `ba48f28869cb5607847ba195420151f3fca3297b`. A complete-history Git bundle was independently verified at `/home/user/duna-checkpoint-ba48f28.bundle`. No resets, cleans, branch switches, force pushes or remote operations were used during this resumption.

## Shared design language

- Semantic maritime-blue primary, warm brass in the brand/authentication panel, legible neutral surfaces; soft surface elevation and restrained motion.
- Shared Card, Button, Input, Dialog, Sheet, FormField, TableScroll, pagination and state components. Native select controls remain for business forms; the preferences use keyboard-accessible popovers.
- Light/dark/system appearance stored in `duna-theme`; a small pre-paint script avoids an initial theme flash. Self-hosted Inter, Vazirmatn and IBM Plex Sans Arabic remain unchanged.
- Sidebar sections are collapsible accordions, permission-filtered with active-route expansion. Desktop icon-only state is persisted. Mobile navigation uses an inert-background, focus-contained drawer, closes on navigation/breakpoint changes and opens from the correct side for both RTL locales.
- Search in the sidebar is functional module search. The former nonfunctional global search and fake notification indicator were removed, not replaced with invented data.
- Dashboard overview uses live API health plus the actual permission-filtered module registry. No fabricated revenue, shipment counts, trends or charts.
- Operational tables retain all columns with keyboard/touch horizontal scrolling rather than squeezing them on mobile. Numeric column alignment uses logical `text-end`. Mobile dialog fields stack and input font sizes avoid iOS zoom.

## Confirmed defects addressed

1. **Typing/focus:** old Dialog's effect depended on `onOpenChange`. Inline parent callbacks changed after each keystroke, causing cleanup/focus restoration and first-field focus again. Opening/focus now depends only on `open`; native dialogs plus an explicit Tab boundary preserve field focus, background inertness, Escape and trigger restoration.
2. **Recursive component:** Shippers defined `Search` by returning `<Search>` itself. It now imports the real Lucide icon.
3. **Form labels:** three duplicated FormField implementations left labels unassociated. A shared stable-ID field component pairs each label with its actual control.
4. **Confirmation failures:** existing action errors are now surfaced inside confirmation dialogs instead of being hidden behind them.
5. **Translations:** hundreds of hard-coded UI strings extracted into `legacyUi`, with semantic keys; status/type display through `domainLabels`; missing keys fixed in invoices, quotations, bookings, discharges, jobs and common actions. Persian copy accidentally present in Arabic login/system/navigation messages corrected. Dates/numbers in previously English-only helpers now receive the locale. No API enum values or business record names are translated.
6. **RTL:** Arabic drawer side, breadcrumb locale routing/arrows, pagination arrows, table/action alignment, form alignment and menu anchoring corrected.
7. **Themes:** the existing dark palette is now functional, with corrected dark primary hover and semantic colors replacing isolated fixed status colors. Invalid `/12` badge opacity utilities replaced by supported `/10`.
8. **Auth restoration:** failed `/auth/me` no longer leaves an unhandled promise and permanent spinner. Transient upstream failures preserve tokens and offer recovery. Concurrent restoration calls share a promise to avoid double rotation of refresh tokens in StrictMode.
9. **Search:** older registry search inputs stay immediate while their list requests are debounced. Search changes reset pagination.
10. **Password reset:** removed the universal password and inaccurate first-login forced-change claim (no corresponding workflow exists). Existing sessions are still revoked by the unchanged server endpoint.

## Preview authentication: diagnosis and required setup

The restored runtime initially had no application listeners or installed dependencies. After a frozen-lockfile install and safe server startup, Next.js renders on `0.0.0.0:3000`; nothing listens on API port 3101 or PostgreSQL port 5432. No real root `.env` or web `.env.local` is present. Direct upstream health is connection-refused; the real same-origin `/api/v1/health` returns structured **502 / UPSTREAM_UNAVAILABLE**. The earlier report of an initial 500 is historical, not the current result. The exact historical stack behind the user's generic error screen is unavailable; the current reproducible blocker is the absent API, not established credential/cookie failure.

The auth protocol is bearer access + rotating refresh tokens in localStorage, **not cookie authentication**. The same-origin proxy already exists. It now returns a structured, non-sensitive 502 on connection failure/timeout; login distinguishes bad credentials (401), rate limits (429) and service failure. API timeout is 15 seconds; no token or internal hostname is included in the error. Production CORS, JWT validation, hashing, role checks and database behavior have not been weakened.

To enable actual preview login:

1. Provision an isolated PostgreSQL database and Nest API with the project's migrations/reference data, or a deliberately approved reachable non-production backend containing authorized accounts. A sandbox does not contain production users automatically.
2. Provide `DATABASE_URL`, `AUTH_JWT_SECRET`, `AUTH_JWT_REFRESH_SECRET` through the environment's secret/configuration facilities, not chat or Git.
3. Set backend `API_PORT=3101`, or match the server-only `API_INTERNAL_URL` in `apps/web/.env.local` to the actual backend port. `apps/web/.env.example` documents this. Browser `NEXT_PUBLIC_API_URL` must remain `/api/v1`, not localhost or a sandbox-specific hostname.
4. Generate Prisma, build the API and apply migrations against that isolated database using the project's existing deployment commands. Then start the API and restart/rebuild Next.js if its environment changed.
5. Verify `/api/v1/health`, then sign in with an account that exists in that database.

In this sandbox, Prisma engine downloads from `binaries.prisma.sh` are blocked by the outbound-host allow-list. Even `prisma generate --no-engine` tried to fetch a checksum and failed. Consequently API typecheck/build and database-backed integration tests cannot be validated here. No remote production backend was probed and no real password was requested, embedded or bypassed.

## Test commands and boundaries

```sh
pnpm --filter @shipping/web typecheck
pnpm --filter @shipping/web lint
pnpm --filter @shipping/web test        # API contract + i18n guards
pnpm --filter @shipping/web build
pnpm --filter @shipping/config test
# Start Next.js separately before browser tests:
pnpm --filter @shipping/web dev --hostname 0.0.0.0
pnpm --filter @shipping/web test:ui
```

Playwright normally uses an installed Chromium (`pnpm exec playwright install chromium`). A provisioned executable can be supplied with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. This restricted sandbox used a Chromium binary and supporting libraries from npm **outside the repository**; no browser binaries were committed. Screenshots/traces/test-results are ignored.

The browser suite isolates UI contracts using clearly labeled network fixtures in the test runner only. The application itself has no test login, mock-data route, bypass flag or fake business data. It checks all 33 route entry views in en/fa/ar, dialog continuous typing/Tab/Escape/focus restoration, desktop collapse, mobile drawer direction, phone/tablet overflow, persisted dark mode, language-switch route/query preservation, and auth outage recovery. Additional creation-dialog tests cover 24 modules on phone-width screens. These are not evidence of successful real credential login, record mutation, or every populated workflow.

Remaining validation requires a configured backend: real login/refresh/logout, database-backed create/edit/delete transitions, populated large tables and full role combinations. Detailed server-generated business validation messages still come from the API verbatim; translating every such dynamic message requires a stable server error-code catalog rather than discarding useful business explanations. The frontend catalogs and static translation calls are checked, but this does not claim every possible dynamic backend string is translated.

### Historical reported verification (superseded by the fresh audit below)

- Web typecheck, lint (no warnings), production build (108 static pages) and contract guard: passed.
- I18n guard: 2,113 message leaves across three locales; static calls and ICU variables/formatting passed.
- Chromium browser suite against the production build: 12 tests passed. Covers 99 localized route entries plus focused interaction and mobile creation-dialog checks.
- Config package: 6 unit tests passed; shared/config packages build successfully.
- AST comparison: API method/path call sequences on all 33 dashboard pages match the preserved pre-redesign baseline. The authorized password-reset payload value is the deliberate exception to payload preservation, as documented above.
- Reviewed desktop light login/dashboard, Arabic dark dashboard, and phone-width screenshots using isolated test fixtures.
- Preview-host header check: Arabic login returns 200. Actual unconfigured API health returns the intended structured 502, not a fabricated healthy status.
- API typecheck is blocked by the missing generated Prisma client; Prisma generation is network-blocked. Database-backed integration testing and real credential login remain unverified.


## Fresh continuation audit — 2026-10-09

### Findings and changes after preservation

- Re-read the current shell, AuthProvider, native Dialog/Sheet lifecycle, navigation registry, catalogs, proxy, Shippers implementation and admin password-reset form rather than assuming old reports were proof.
- Fixed preference-menu ArrowDown/ArrowUp opening and initial focus, Home/End navigation, wraparound, focus return and menu-item tab order. Tests exercise both selectors in all three locales.
- Avoid applying the default system theme before the stored preference has been read; explicit light/dark and device-driven system changes are tested.
- Localized the shared notification-close label and address placeholders; made the notification close spacing logical for RTL. Metadata descriptions now use the selected locale.
- Fixed displayed invoice amounts and remaining date displays in jobs, letters, bookings and portal. **Date input/edit payload values remain ISO YYYY-MM-DD**, not localized strings.
- A settled-state axe audit caught insufficient contrast for login error text in light and dark modes. Adjusted semantic danger/info/warning colors and made tinted alert copy use readable foreground text. Initial animation-frame contrast findings were distinguished from persistent failures by waiting for fonts and using reduced motion.
- Expanded browser coverage from 12 to 22 tests: added keyboard preference menus, administrator-chosen reset payloads and empty-on-reopen password fields, populated mobile user tables, permission-filtered controls, rejected/rotated sessions and system-theme changes. Creation-dialog tests now assert that each of the 24 expected creation controls exists instead of silently skipping missing controls.
- No `apps/api`, Prisma schema/migration, shared business type, dependency or lockfile changes in this follow-up. API and Prisma directories also match restored baseline `da1ff0e` exactly.

### Current results (executed, not inherited)

| Check | Result |
| --- | --- |
| Web typecheck / lint | **PASS**; no lint warnings |
| Web production build | **PASS**, 108 generated static pages |
| Shared/config typecheck and builds | **PASS** |
| Config unit tests | **PASS**, 6/6 |
| i18n guard | **PASS**, 2,114 message leaves × 3 locales; ICU/static calls checked |
| Contract guard | **PASS**, 18 shared unions; 87 web POST routes against 95 controller POST routes; documented BillStatus/DeliveryReleaseStatus skips and computed-tail limitation remain |
| Independent AST method/path comparison | **PASS**, all 33 operational pages match `da1ff0e`; not a payload/business-semantics proof |
| Production Chromium UI suite | **PASS**, 22/22 in 3.2 minutes; runner-only auth/API fixtures |
| Unmocked login/outage browser checks | **PASS**, EN/FA/AR × light/dark: HTTP 200, correct direction, no page exceptions or 320px overflow, localized service error, anonymous redirect, stale tokens retained on real 502 |
| Settled login + outage axe WCAG A/AA audit | **PASS**, no reported violations in those views across three locales/two themes; not a whole-application accessibility certification |
| Preview-host header smoke | **PASS**, landing/login HTTP 200 in all three locales |
| Real API health | **UNAVAILABLE**, structured 502; direct upstream connection refused |
| Prisma generation | **BLOCKED/failed**, TLS download to disallowed `binaries.prisma.sh` |
| API typecheck/build | **FAILED/BLOCKED**, missing generated Prisma types/client (build reports 930 cascading errors); do not infer all API issues disappear after provisioning |
| API E2E | **BLOCKED/failed before test execution**, 22 suites fail to initialize, **0 tests executed**; missing Prisma client and required environment/database |
| API lint | **FAIL**, existing `prefer-const` at `voucher.service.ts:333`, plus 33 warnings; confirmed API source unchanged from `da1ff0e` |
| Live authorized login, DB CRUD, server RBAC/status transitions | **NOT VERIFIED**, no configured backend/database/authorized accounts |

Chromium initially could not launch because `libnspr4`/NSS libraries were missing. Sandbox-only npm-provided supporting libraries fixed the runner; the final 22/22 result is after that correction. No browser binaries or validation artifacts were added to Git. Current sandbox logs/screenshots are outside the repository in `/home/user/duna-validation/`.

The final preview is the **production build**, not an authentication bypass. To reproduce browser tests with this sandbox's provisioned executable:

```sh
LD_LIBRARY_PATH=/tmp/al2023/lib FONTCONFIG_PATH=/tmp/fonts \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/chromium \
  pnpm --filter @shipping/web test:ui
```

### Completion boundary and handoff

The preserved frontend redesign and this follow-up's scoped defects are implemented and locally tested. This is **not full end-to-end acceptance**: real auth/refresh/logout, every populated workflow, all roles and database writes still need a configured isolated backend. Browser network fixtures verify client behavior only. Server-generated business error messages remain verbatim; no claim is made that every dynamic backend string is translated. A source scan found no remaining authored English prose in the audited dashboard/login JSX literals; retained literals are brand/product names, technical acronyms, ISO currency codes, a unit symbol and email examples. Arabic's only Persian-letter catalog match is the intentional Persian language autonym (`فارسی`), not Persian navigation prose. Neither scan proves linguistic perfection.

This coding session is closed for remote GitHub operations. **No fetch, push or GitHub verification was attempted.** The configured origin and cached `origin/main` ref are not live evidence. Final commits are local only. To publish, start a new coding session, recover the preserved branch/history from the Git bundle if needed, fetch and inspect the real remote ancestry, and only perform a permitted non-force push of `arena/fe92d85a-duna`. Do not overwrite a divergent remote, merge main/ai-test, or create an unintended PR. The final local hash and final bundle path are given in the session handoff.
