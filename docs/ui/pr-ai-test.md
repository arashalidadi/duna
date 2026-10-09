# Dashboard refinement, preserved landing page, and consistent API port configuration

**Prepared locally; not submitted.** Intended base: `ai-test`. Compare: `arena/fe92d85a-duna`.
Verify actual remote ancestry and the complete PR diff before using this body. Landing changes
may already be in `ai-test`; do not reintroduce duplicates or overwrite newer remote work.

## Publication scope and environment limits

The user explicitly requested publication for testing on their own configured server.
Arena-preview authentication is **not a publication prerequisite**. Do not spend further time
provisioning the preview or retrying real login there. Its missing backend/database/Prisma
configuration remains a disclosed environment limitation, not a reason to withhold this PR.
Real authentication and DB acceptance will be performed on the user's server. No password/account
changes, mock backend or authentication bypass were introduced. GitHub publication still requires
actual remote ancestry/diff review in a GitHub-enabled session; do not merge automatically.

## Summary

- Preserve the existing landing page and responsive EN/FA/AR dashboard redesign, shared dialog
  focus fix, RTL navigation, persistent themes, accessible preference menus and localized UI.
- Retain routes/API contracts and existing auth/RBAC/business behavior. No fake business data or
  authentication bypass; admin password reset uses an administrator-entered value.
- Align API default, environment examples, Next server proxy and local runtime scripts on **3010**.
  Explicit alternative ports remain supported when API_PORT and API_INTERNAL_URL match.
- Read the configured API port in startup/status scripts without executing `.env` as shell code.
- Document the missing backend/database/Prisma-engine prerequisites honestly.

## Verification

- Web typecheck, lint, production build (108 static pages), contract and i18n guards pass.
- Existing production-browser regression suite: **22/22 pass**, with runner-only network fixtures.
- Config unit tests **10/10**, port/script regression tests **7/7**; shared/config build/typecheck pass.
- Landing/login return HTTP 200 in all three locales. Actual API health returns structured 502
  because no API is running; this is not successful backend verification.

## Remaining validation and review

- Prisma engine checksum download is network-blocked; API build lacks generated client/types.
- PostgreSQL, required environment/secrets and authorized accounts are absent in the sandbox.
- Real login/refresh/logout, server-side permissions and DB workflows must be tested on an approved
  backend. Browser fixtures do not prove them. Detailed server-generated errors remain verbatim.
- Inspect the real GitHub diff for remote-only changes before publishing; current local Git is shallow.
- Backend business logic/schema/migrations are not changed. Do not merge automatically: the user
  will review and test through `ai-test` first.

See `docs/ops/publication-handoff.md` for current deployment variables, fresh validation, recovery
and exact publication steps. Previous login diagnostics are historical context only.
