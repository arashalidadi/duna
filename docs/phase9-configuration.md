# Phase 9 — Configuration and extensibility

The implemented boundary follows `docs/duna-analysis/09-audit/initial-roadmap.md`, DEC-029…036 and DEC-059…063. Phase 10 notifications, port cleanup and data-hygiene work are **not** part of this change.

## Available capabilities

- Permission-controlled, audited option lists and stable options (add, relabel, deactivate/reactivate); inactive options cannot be newly chosen. Field definitions have effective dates, validation, scoped read/edit grants, visibility, version history, requiredness and searchable/filterable/reportable/exportable flags. Field-value revisions retain original field and option labels; old values are not backfilled or overwritten on a rename/deactivation. Sidecars appear on Customer, Cargo, Job, B/L, Invoice and Release Order records. R/O values can only be supplied when issuing a new R/O, in the original transaction. B/L finalization/approval and Invoice issuance check any active required fields **in addition to** their existing core checks. Ordinary readers need the original record-read grant, not the administration grant.
- Versioned custom **additional office** document types with names, categories, document-only numbering patterns, layouts, company-approved artwork, relationships and additional permission requirements. Custom documents have revision-checked updates, pinned definition/workflow versions, approval-gated issuance and a frozen issue-time snapshot. PDF, stamp-free Print and formula-safe XLSX use separately archived, SHA-256-checked immutable bytes, with access checked on every download. A conspicuous warning says custom documents are **not** financial or cargo-release authorizations. Core financial documents keep their existing numbering, templates and business logic.
- Reviewed workflow versions: statuses and display labels, permission-checked transitions, allowlisted conditions, distinct-person approval, reasoned custom-condition exceptions and audit history. B/L display labels are independently editable without rewriting its status enum, transitions, output bytes or Agent Portal DRAFT exclusion. Official company wording must be entered by the owner; technical codes are only fallback labels.
- Optional **additional** approval paths for P5 unpaid-release exceptions and P6 invoice corrections. Release overrides still require a real APPROVED B/L, outstanding-balance recheck, force, reason, original `release:override` grant/owner authority and an atomic `release:override` AuditLog. The primary administrator acts directly; delegates need their own approved, unconsumed, context-matching request when the workflow is active. Corrections still honour CompanySettings and original correction/approval permissions, invoice cancellation/reissue, and money/posting logic.

The API lives under `/api/v1/configuration`; the administration tabs are at `/{locale}/configuration`, and the custom-document desk is at `/{locale}/configured-documents`. All navigation labels have English, Farsi and Arabic text. Nothing is activated or populated automatically: a manager must configure/activate a type and its workflow deliberately. The client cannot use a configured document as an actual invoice, payment, ledger or Release Order.

## Server deployment (after pulling the authorized branch)

Run from `~/shipping-dashboard/new-erp`. This is the owner's **development/test** database `duna_seed_test`, not a claim about any production environment. **Do not** run `prisma db push`, `migrate dev`, reset, mark a migration applied, seed demo data, or run destructive E2E on this database. Inspect the target and migration history before writes; if it differs from expectations, stop and investigate rather than skipping migration errors.

### Mandatory preflight (read-only)

```bash
cd ~/shipping-dashboard/new-erp
pnpm install --frozen-lockfile
node - <<'NODE'
require('dotenv').config({ path: '.env' });
const raw = process.env.DATABASE_URL;
if (!raw) throw Error('DATABASE_URL is not configured');
const database = decodeURIComponent(new URL(raw).pathname.slice(1));
if (database !== 'duna_seed_test') throw Error(`Unexpected database: ${database}`);
console.log(`Confirmed database name: ${database}`); // never print the URL
NODE
pnpm exec prisma migrate status
```

Check the status output against the migration files. The expected new migration is `20261016010000_phase9_configuration` **only if all earlier migrations are already applied**. If another migration is pending/failed, or the target is not the known test DB, stop and review. `migrate status` can return nonzero when a migration is pending; do not hide that result. The Phase 9 migration creates new tables, indexes and triggers, plus one trigger on the existing Phase 8 archive table; it does not rewrite existing business records or financial data.

### Mandatory apply/build/restart (after a satisfactory preflight)

```bash
cd ~/shipping-dashboard/new-erp
pnpm db:migrate:deploy
pnpm db:generate
pnpm db:seed:phase9
pnpm --filter @shipping/config build
pnpm --filter @shipping/shared build
pnpm --filter @shipping/api build
pnpm --filter @shipping/web build
./scripts/restart-apps-only.sh --check
./scripts/restart-apps-only.sh
pnpm exec prisma migrate status
```

`db:seed:phase9` is an add-only, idempotent **permission-registry and ADMIN-grant** operation; unlike the general core seed, it does not upsert the administrator account, touch other reference/master records or create demo data. Any additional ordinary-user grants require the owner's explicit permission assignment through the existing roles interface. `release:override` is still an explicit owner-controlled grant; this seed does **not** grant it to ordinary staff.

The restart script verifies repository-managed API/web PID files or empty ports, stops/starts **only API and web**, and never stops/starts PostgreSQL. It refuses occupied ports with unmanaged processes; **if the preflight refuses**, use your already configured app process manager to restart those two services, or provide its unit names so exact manager-specific commands can be supplied. Do not use `scripts/stop-dev.sh` for a Phase 9 restart: it also stops PostgreSQL. Check application logs after restart: `logs/api.log`, `logs/web.log` when repository-managed.

### Optional non-database checks

These operate without connecting to or changing the owner's database:

```bash
cd ~/shipping-dashboard/new-erp
pnpm exec prisma validate --schema prisma/schema.prisma
pnpm --filter @shipping/api typecheck
pnpm --filter @shipping/web typecheck
pnpm --filter @shipping/api exec jest --config test/jest-e2e.cjs --runInBand --runTestsByPath test/configuration.e2e-spec.ts test/configured-document.e2e-spec.ts test/configuration-integration.e2e-spec.ts test/delivery-release-cancellation.e2e-spec.ts
pnpm --filter @shipping/web test
pnpm --filter @shipping/api test:documents:unit
```

The full database-backed API E2E suite requires a **separately reviewed isolated test database**; never point its destructive fixtures at `duna_seed_test`. The Agent Portal isolation suite retains its separate `duna_portal_isolation_test` gate. Browser verification: owner should verify B/L labels, option deactivation/history, one custom document DRAFT→review→separate approval→issue/archive in PDF/Print/XLSX, an unpaid release delegate request versus owner direct path, and corrections with original approval policy still enabled. Use only owner-authorized sample records; do not fabricate official labels, templates, financial thresholds or demo data.

**Outstanding external verification:** the migration must still be applied and inspected on the owner's PostgreSQL server, and the owner must validate browser flows and supply official labels/templates. Sandbox checks and PostgreSQL-WASM syntax/trigger tests are not a substitute for that review. The sandbox Prisma CLI `validate` command could not fetch its binary from the restricted engine host; the optional server command above rechecks the schema with the server's installed Prisma engines.
