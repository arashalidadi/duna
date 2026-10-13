# Phase 4 — Company settings, attachments and sensitive assets

Branch `arena/be9b4e5b-duna`. Scope from `initial-roadmap.md` ~L142–160. Requirements: DEC-087…092, AUD-006/008 (settings half), REQ-146/147/168/170.

**Status:** built and type-checked in the sandbox. The e2e spec is written but has **not been run** (no database in the sandbox). The web UI has **not been run in a browser**. Technical defaults in §3 are proposals pending owner confirmation.

---

## 1. What changed

| Area | Files | Change |
|---|---|---|
| Company settings API | `apps/api/src/modules/company-settings/*` (new) | `GET` and `PATCH /api/v1/company-settings`. Permissions `settings:read` and `settings:update`. Edits the existing `CompanySettings` row. TRN is the existing `taxNumber` column, so no new column. Validates currencies against the `Currency` table. Audits `company_settings.update` with before and after. |
| Document-layer reader | `company-settings.service.ts` → `getDocumentIdentity()` | Returns TRN, legal name, registration number, address, city, country, phone, email and default currency. Invoices still read `taxNumber` directly (Phase 3 `companyTrn()`); they were not changed. |
| Attachment policy | `apps/api/src/common/infrastructure/attachment/attachment-policy.ts` (new) | Entity types (`VOUCHER`, `SALARY_RECORD`), identity categories (`ID_FRONT`, `ID_BACK`, `SIGNATURE`), MIME allow-list, magic-byte check, size cap, filename sanitising. |
| Signed download links | `attachment-url.ts` (new) | HMAC-SHA256 tokens bound to attachment id, user id and expiry. Constant-time comparison. |
| Attachment service and API | `attachment.service.ts`, `attachment.controller.ts`, `dto/attachment.dto.ts`, `attachment.types.ts` (rewritten) | `POST /attachments` (multipart), `GET /attachments`, `GET /attachments/:id`, `POST /attachments/:id/url`, `GET /attachments/download?token=` (public, token-only), `DELETE /attachments/:id`. |
| Storage adapter | `common/infrastructure/storage/local-storage.service.ts` (rewritten) | Real filesystem writes under `ATTACHMENT_STORAGE_DIR`. Random UUID keys. Fails closed (503) when not configured. |
| Permissions | `prisma/seed/core.ts`, `docs/permissions.md` | Six new codes: `settings:read`, `settings:update`, `attachment:read`, `attachment:create`, `attachment:delete`, `attachment:identity`. ADMIN receives them through the catalogue loop. |
| Module wiring | `apps/api/src/app.module.ts` | Imports `CompanySettingsModule`. |
| Web: settings page | `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` (new) | Editable company identity and currency selection. Read-only without `settings:update`. |
| Web: identity panel | `apps/web/src/components/attachments/identity-attachments-panel.tsx` (new) | Lists, opens (signed link), uploads and deletes identity documents. Mounted in the voucher and salary-record detail dialogs. |
| Web: client and nav | `apps/web/src/lib/api/client.ts` (`postForm`, FormData-safe headers), `apps/web/src/lib/navigation/nav.ts` | Settings nav item changed from a `planned` placeholder to an implemented route gated by `settings:read`. |
| i18n | `apps/web/messages/{en,ar,fa}.json` | Namespaces `identityAttachments` and `companySettings`. Additions only. Arabic and Persian need native review. |
| Env template | `.env.example` | Four `ATTACHMENT_*` variables, commented out, no values. |
| Tests | `apps/api/test/attachment-settings.e2e-spec.ts` (new) | 18 cases. Not run. See §7. |
| Docs | this file; `docs/duna-analysis/09-audit/phase-3-invoice-tax-correction.md` §9 | |

**No database migration.** `CompanySettings` and `FileAttachment` already contain every needed column. `prisma migrate status` was not run (no database here).

---

## 2. Review findings in existing code (corrected in this phase)

1. **Attachment API was unprotected.** `AttachmentController` had no `@RequirePermissions` on any route. The global guard passes routes without metadata, so any authenticated user could list, read metadata, read full file content as base64 (`GET :id/content`), or soft-delete any attachment. **Replaced.** Every route now requires a permission, and identity categories also require `attachment:identity`. The base64 content route is removed. Downloads now need a signed token.
2. **Wrong mount path.** The controller used `@Controller('api/v1/attachments')` under the global prefix `api/v1`, so it was served at `/api/v1/api/v1/attachments`. **Fixed** to `attachments`. No caller existed, so nothing depended on the old path.
3. **Wrong id validation.** The old routes used `ParseUUIDPipe`. Attachment and voucher ids are `cuid` strings, so every request would have been rejected. **Removed**.
4. **Storage was a placeholder.** `LocalStorageService.saveFile` returned a fake key without writing, and `getFile` threw. **Replaced** with a real adapter.
5. **Unused placeholder methods removed.** `getByCategory`, `getByEntity`, `deleteWithStorage`, `readFile` and `getFileStream` had no callers. `deleteWithStorage` also performed physical deletion, which conflicts with the retention decision (§5).
6. **Seed comment was wrong.** The Phase 3 comment in `prisma/seed/core.ts` said invoice correction codes were "Explicit grant only". The code (and the note at `EXPLICIT_GRANT_ONLY`) says ADMIN receives them. The comment is corrected. No permission behaviour changed.
7. **Settings nav entry was a placeholder** (`status: 'planned'`, no route). It now links to the new page.

---

## 3. Technical defaults — proposed, owner to confirm

| Item | Proposed value | Source / reason |
|---|---|---|
| MIME allow-list | `application/pdf`, `image/jpeg`, `image/png` | No value in the decisions. Content is checked against magic bytes, not only the declared type. |
| Size cap | 10 MiB per file (`ATTACHMENT_MAX_BYTES` can lower it) | No value in the decisions. |
| Signed-URL lifetime | 300 s default, 900 s maximum (`ATTACHMENT_URL_TTL_SECONDS`) | No value in the decisions. DEC-090 requires short-lived signed URLs. |
| Storage location | `ATTACHMENT_STORAGE_DIR`, absolute, outside the repository; no default | DEC-090 technical consequence; S3-shaped adapter later. |
| Identity categories | `ID_FRONT`, `ID_BACK`, `SIGNATURE` | DEC-092 evidence (§2.15): recipient ID front and back plus signature on vouchers; employee ID front and back plus signature on salary slips. The code names are proposals. |
| Entity types | `VOUCHER`, `SALARY_RECORD` | DEC-092 scope. This phase reads "salary slip" as `SalaryRecord`. Owner to confirm. |
| Permission for identity | `attachment:identity`, held by ADMIN through the catalogue loop, not in `EXPLICIT_GRANT_ONLY` | DEC-089 and DEC-092: permission-restricted. ADMIN has full application privileges (turn-24 instruction). |
| Primary administrator | Full access, implicit (DEC-116) | Same as every other permission check. |
| Delete | Soft delete only (`deletedAt`); file kept | DEC-091: retention and secure deletion are not decided (OQ-12). Physical deletion is not implemented. |
| Production capture gate | `ATTACHMENT_IDENTITY_CAPTURE_ENABLED`, default **off**; uploads return 403 while off | Constraint: production ID capture stays disabled until retention periods and the lawful basis are recorded. |
| Settings TRN format | Not validated (free text, max 100 characters) | No format is given in the decisions. Do not invent one. |

---

## 4. Roadmap acceptance against evidence

| Acceptance / exit item | Evidence | Status |
|---|---|---|
| TRN and company address editable | `PATCH /company-settings`; settings page | Sandbox harness passes (39 checks, incl. round-trip). Server e2e not run. Browser not run. |
| TRN and address readable by the document layer | `getDocumentIdentity()`; harness check | Service-level only. Invoices keep their own read of `taxNumber` (unchanged). |
| Identity document attached to a voucher | `POST /attachments` with `entityType=VOUCHER` | Harness passes. Server e2e not run. |
| Retrieved only by an authorised user | Permission checks on list, metadata and URL issue; token re-checks user at download | Harness passes for no-permission, revoked and inactive users. Server e2e not run. |
| MIME and size rejection | 415, 400 (magic mismatch), 413 | Harness passes. Server e2e not run. |
| Settings editable; attachments end to end; asset permissions enforced | API and UI present; permission checks server-side | API verified by the owner's e2e run. UI not run in a browser. The owner has not confirmed that the identity panel appears on the live server. |
| Testing list: settings round-trip, upload/retrieve/delete, MIME and size rejection, identity permissions, URL expiry | `attachment-settings.e2e-spec.ts` covers all five | **Passed on the owner's test database (owner report, 2026-10-13; pass count not supplied).** Not run in this sandbox (no PostgreSQL, no Prisma engine). |

---

## 5. Not in scope (deliberate)

- Retention periods, secure-deletion rules and physical file removal (DEC-091, OQ-12). Owner input required.
- Lawful-basis record for identity capture (OQ-12). Required before enabling capture.
- Company assets such as letterheads, logos, stamps and signatures for templates (DEC-087/088; Phase 8 and 12). No categories were added for them.
- Inclusion of identity documents in reports and notifications: none are generated (DEC-090 invariant holds).
- S3 adapter. The interface is S3-shaped.
- Malware scanning of uploads. **Residual risk**: content is checked for type only.
- Audited: create, URL issue, download and delete. Plain list and metadata reads are not audited.

---

## 6. Server actions required (NOT executed; owner authorization needed)

1. **Deploy the code.** No database migration is part of this phase.
2. **Run the normal seed** (`pnpm db:seed`, with `SEED_DEMO_DATA` unset). It only adds the six new permission codes and grants them to ADMIN. It does not revoke anything. Note: the seed's admin upsert also reactivates the seeded admin account and clears its lockout on each run. This existing behaviour is unchanged.
3. **Configure the server environment** (values must not be committed):
   - `ATTACHMENT_STORAGE_DIR`: an absolute directory outside the repository, owned by the API user, mode `0700`.
   - `ATTACHMENT_URL_SECRET`: at least 32 characters, generated with `openssl rand -base64 48`.
   - `ATTACHMENT_IDENTITY_CAPTURE_ENABLED`: `false` in production. Owner decision (2026-10-13): set it to `true` **only on the owner's test database**, for the e2e run in §7.
   - Restart the API after changing these.
4. **Assign `attachment:identity` deliberately.** Only the owner decides which roles receive it.
5. **Run the Phase 4 e2e spec on the owner's test database only.** It creates a customer, a voucher, two roles, two users and one uploaded file there, and soft-deletes the file. It must not run on the live database (the Phase 3 spec's test records already on the live database are a separate open item; see the Phase 3 doc §9).
6. **Verify with read-only checks** before any use: that the six permission codes exist, and that ADMIN holds them (`GET /api/v1/permissions/all`, `GET /api/v1/auth/me`).

---

## 7. Tests

**E2E spec:** `apps/api/test/attachment-settings.e2e-spec.ts`. Run from `apps/api` with `pnpm test -- attachment-settings`.

- **Prerequisites:** a migrated database seeded with the Phase 4 codes; `ATTACHMENT_STORAGE_DIR` (absolute, writable); `ATTACHMENT_URL_SECRET` (at least 32 characters); `ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true`. The spec throws at start if any is missing.
- **Test database required.** Do not run this against production data.
- **Data touched:** creates one customer, one RECEIPT voucher, two roles and two users (tagged with a random suffix). Uploads one file and soft-deletes it. Temporarily changes `CompanySettings` TRN and address, and restores the previous values in `afterAll`. The spec never runs the seed and never resets or cleans the database.
- **Cases:** settings read, round-trip, permission and currency validation; upload with and without identity permission; MIME 415; magic mismatch 400; size 413; entity scope 400; metadata and list denied to basic user; signed-URL download; tampered token 401; expired token 401; capture-disabled 403; soft delete and 404 afterwards.

**Sandbox harnesses** (in `/tmp`, not committed):
- Pure policy and signing: 14 checks, all passed. Covers the MIME allow-list, magic bytes, size default, filename sanitising, identity categories, token verify and expiry, tamper and malformed rejection, local-storage round-trip, path-traversal rejection, delete idempotency, and fail-closed config.
- HTTP layer (real controller, guards, validation pipe, exception filter and transform interceptor; in-memory Prisma and audit; real temporary storage directory), run through the repository's Jest e2e config as a temporary file, since removed: **16 checks, all passed**. Covers multipart upload, 403 for missing identity and missing base permission, multer 413, MIME 415, magic 400, DTO scope 400, guarded metadata, list and URL, the public signed download (exact bytes and `Content-Type`, `Cache-Control: no-store`, `nosniff`, RFC 5987 filename for non-ASCII names), expired, wrong-secret and missing tokens, delete, and removal of the old content and double-prefix routes.
- Service with in-memory Prisma and audit, against a real temporary directory: 39 checks, all passed. Covers upload gates and order, identity permission, DB failure cleanup, list, metadata, URL issue and audit, download with token, expiry, forged, revoked and inactive-user tokens, soft delete, settings validation and round-trip, DTO validation, and audit before and after.

---

## 8. Checks run in this sandbox

| Check | Command (working dir) | Result |
|---|---|---|
| Dependencies | `pnpm install --frozen-lockfile --ignore-scripts` (repo root) | Exit 0 |
| Prisma client types | `prisma generate` with placeholder engine env (apps/api) | Exit 0 (types only; no engine) |
| API type check | `tsc --noEmit -p tsconfig.json` (apps/api) | Exit 0 |
| Web type check | `tsc --noEmit -p tsconfig.json` (apps/web) | Exit 0 |
| ESLint, API changed paths | `npx --no-install eslint …` (apps/api) | Exit 0 |
| ESLint, web changed files | `npx --no-install eslint …` (apps/web) | Exit 0 (after one `react-hooks` fix) |
| Seed safety | `node scripts/check-seed-safety.mjs` (repo root) | "SEED SAFETY OK", exit 0 |
| Pure harness | `tsx` with apps/api tsconfig | 14/14 pass |
| Service harness | `tsx` with apps/api tsconfig | 39/39 pass |
| HTTP harness (temporary Jest file, removed) | `npx jest --config test/jest-e2e.cjs --testRegex …` (apps/api) | 16/16 pass |
| E2E `attachment-settings.e2e-spec.ts` | `pnpm test` | **Not run.** No database in sandbox. |
| Prisma migration status | — | **Not run.** No database. |
| Browser check of settings and identity panel | — | **Not run.** |
| Web production build | — | **Not run.** |

Harness results come from code executed here with in-memory fakes. They are not evidence of database behaviour, Prisma query shape against a real database, or the HTTP layer.

---

## 9. Owner decisions and residual risks

**Decisions needed before enabling identity capture in production:**
1. Confirm or change the technical defaults in §3 (MIME allow-list, 10 MiB cap, 300 s TTL, storage location).
2. Confirm the identity category names and that "salary slip" means `SalaryRecord`.
3. Record the retention period and lawful basis (OQ-12). Until then, keep `ATTACHMENT_IDENTITY_CAPTURE_ENABLED=false`.
4. Decide whether deletion must be physical (DEC-091). Currently soft delete only, with the file kept.
5. Confirm which roles should hold `attachment:identity`, besides ADMIN.
6. Confirm whether CANCELLED vouchers may still receive identity documents. The code does not block this.

**Owner answers recorded 2026-10-13:** the §3 technical defaults are accepted as proposed. Identity capture stays off in production and is enabled only on the owner's test database for the e2e run. Items 1 and 5 above are therefore closed for the defaults. Items 2, 3, 4 and 6 remain open.

**Close-out check (2026-10-13, sandbox):**
- Repository at `3b7e4f3`. The Phase 4 commit `4f2f4e4` is an ancestor. No application file was deleted or changed after it.
- `tsc` passes for the API and the web app. `next build` for the web app passes. It includes `/[locale]/settings` and the identity panel.
- The identity panel appears only inside the voucher and salary-record detail dialogs. It is not on the Settings page. It is hidden unless the user has both `attachment:read` and `attachment:identity`.
- Open item for the owner: confirm the panel on the live server after the seed has written the `attachment:*` and `settings:*` codes and granted them to ADMIN.

**Residual risks:**
- **Download token in the URL.** Tokens may appear in web-server access logs. The short TTL limits exposure. Logs should not be shared.
- **No malware scanning.** Only type and size are checked.
- **Single-server local storage.** Backups of `ATTACHMENT_STORAGE_DIR` must follow the retention decision.
- **Native review of Arabic and Persian strings** is needed.
- **Browser behaviour untested.** Upload, the signed-link popup (`window.open` may be blocked by the browser) and the settings form are untested.
- **Settings create path.** The UI disables save when no `CompanySettings` row exists. The seed creates one, so this only matters on a fresh database.
- **Old path removed.** Anything calling `/api/v1/api/v1/attachments` or `GET :id/content` would break. A repository search found no caller.
