# Phase 10 — Notifications, master data and data hygiene

This is a **staged, data-preserving application release**, not a declaration that the owner's populated database has passed acceptance. It follows Phase 9 (`20261016010000_phase9_configuration`). Do not start Phase 11 from this guide. The revised audit's DEC-117 supersedes the old eight-port instruction: **seven** canonical ports, with Rajaee as a Bandar Abbas alias, not an eighth row.

## Delivered boundary

- Administrator-managed notification rules: allowlisted overdue invoice, pending approval (workflow/invoice correction), Job status, unpaid Release Order and pending Cargo paperwork triggers; recipient users/roles; configurable conditions, delays, repeats, per-record/per-day limits, escalation and in-app/email channels. No rules or monetary thresholds are seeded. Job status transitions enqueue in the business transaction; the database-backed worker polls the other sources and claims due events/emails. Office/source permissions, Agent Portal isolation, source rechecks before queued email, audits, delivery states and sanitized error codes are retained. SMTP requires `NOTIFICATION_SMTP_URL` and `NOTIFICATION_FROM_EMAIL` in the server's private environment. The worker is enabled unless `NOTIFICATION_WORKER_ENABLED=false`. Do not enable EMAIL rules until SMTP has been checked by the operator; email contains only a generic sign-in prompt.
- Ports: editable official/display names, aliases, country, city/region and verified abbreviation; seven-port explicit reference seed. Existing Port rows and their references are not renamed/merged/deleted. Incomplete new reference rows remain inactive. Existing rows missing city/abbreviation remain nullable and marked for review; previously active incomplete rows can remain selectable until an operator resolves them, so the global mandatory-field acceptance is not claimed. New API-created ports require both. The default core seed no longer writes operator-managed ports or yards. The demo seed remains **opt-in only**, and must not be run on owner data.
- Customer commercial-role type, short name, tax/TRN and currency fields are removed from the live master/API; non-null historical values are copied and compared in `CustomerLegacyAttribute` before column removal. The optional, independent natural/legal-person classification is available for new and existing rows. Customer, Shipper, Consignee and Agent remain separate masters with their own contacts.
- Cargo old chassis/serial/comment/units values are copied to `CargoLegacyAttribute`; empty canonical fields are backfilled, conflicts keep both versions, and reads/writes use canonical fields. Original **physical Cargo columns are deliberately retained** pending populated-data review and a separately authorized contraction. Only the evidenced intake names (Export Paper, Import Paper, Export Certificate, R.D.A.) and EXID/BCC/LOCAL_TRANSFER status are accepted, without inventing acronym meanings or a validity policy.
- ADR-041: application Load List transitions remain DRAFT/FINALIZED/CANCELLED; all six historical enum values and rows remain readable but intermediate states are sealed. No unverified historical mapping or enum contraction is applied.
- Exceptional archival, deactivation and cancellation paths have dependency/retention checks and transactional audit in the touched masters, draft salary/quotation records, Yard masters and yard-placement flows; completed loading audits the exit of fully loaded inventory. Existing inactive references survive edits, whereas new selections require active masters. Optional vessel IMO was already supported; ownership and per-voyage use are nullable with OTHER, and the existing sidebar accordion is retained.

## Owner-server deployment

Commands below are for `~/shipping-dashboard/new-erp`. The identified owner test database is `duna_seed_test`; portal isolation has its own `duna_portal_isolation_test`. **No production database was identified.** Confirm the configured target, current branch, schema history, available backup/recovery procedure and any operator-managed Port rows before any write. This repository does not embed DB credentials. Never use `db push`, `migrate dev`, reset, forced migration marking, or the demo seed as a shortcut. If any inspection, migration or seed refuses, stop and investigate rather than bypassing it.

### Mandatory: pull, install and read-only inspection

```bash
cd ~/shipping-dashboard/new-erp
git branch --show-current                       # must be arena/be9b4e5b-duna
git pull --ff-only origin arena/be9b4e5b-duna
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
corepack pnpm exec prisma migrate status       # inspect: Phase 9 applied; only intended Phase 10 pending
corepack pnpm db:phase10:preflight              # read-only row/column/status counts; no URL or row values printed
```

Do not ignore a nonzero `migrate status` when Phase 10 is pending; read its output and confirm that no **other** migration is unexpectedly pending/failed. The preflight must pass. A standalone Rajaee Port, unexpected canonical code/name conflict, or contradictory owner Port data requires owner review: do not merge or relabel automatically. Use the operator's established, restorable backup procedure before schema-changing work; this guide does not invent a backup service or server-specific credentials.

### Mandatory: controlled apply, permissions and reference data

Only after the above inspection is satisfactory and the operator has reviewed the seven reference names/codes:

```bash
cd ~/shipping-dashboard/new-erp
corepack pnpm db:migrate:deploy
corepack pnpm db:seed:phase10:permissions     # only notification permissions and ADMIN grants
corepack pnpm db:seed:phase10:ports           # atomic, aborts instead of merging conflicting owner rows
corepack pnpm db:phase10:postflight           # checks archived Cargo copies and Rajaee alias
corepack pnpm --filter @shipping/config build
corepack pnpm --filter @shipping/shared build
corepack pnpm --filter @shipping/api build
corepack pnpm --filter @shipping/web build
./scripts/restart-apps-only.sh --check
./scripts/restart-apps-only.sh
corepack pnpm exec prisma migrate status
```

The port seed **does not** claim to know missing abbreviations or cities: review and complete them through the controlled Port UI before activating incomplete rows. If the seed aborts, do not report postflight or deployment success. Do not use `./scripts/stop-dev.sh`: it stops PostgreSQL. The app-only restart script touches just repository-managed API/web processes; if it rejects unmanaged PID/ports, restart **only those two apps** using the owner's existing process manager, never guessed unit names. Inspect `logs/api.log` and `logs/web.log` where repository-managed. No general `db:seed` or demo data is necessary for this upgrade; ordinary-user grants must be assigned explicitly through the permission model.

### Optional, database-free checks (safe on this checkout)

```bash
cd ~/shipping-dashboard/new-erp
corepack pnpm check:seed-safety
corepack pnpm test:phase10:migration
corepack pnpm --filter @shipping/api typecheck
corepack pnpm --filter @shipping/api lint
corepack pnpm --filter @shipping/api exec jest --config test/jest-e2e.cjs --testRegex 'phase10.*unit-spec\.ts$' --runInBand --verbose
corepack pnpm --filter @shipping/web test
corepack pnpm --filter @shipping/web typecheck
```

The PGlite fixture and mocked Jest tests are **not** populated-owner-PostgreSQL or live-SMTP acceptance. Do not run database-writing API E2E or the seed-safety mutation suite on `duna_seed_test`. Run them only on a separately reviewed isolated database; retain the Agent Portal suite's explicit `duna_portal_isolation_test` gate. After deployment, have an authorized user review active/inactive master options, rule enable/disable, in-app delivery and a verified SMTP test delivery (including audit/retry) in the browser.

## Outstanding verification / deliberate deferrals

1. Owner-server preflight, migration, postflight and populated-data UI flows have **not** been run here. A synthetic migration fixture proves only the included examples. Test the application against the real PostgreSQL schema and report any migration/preflight conflict without masking it.
2. No live SMTP transport or delivery has been exercised. In-app/EMAIL status logic has database-free mocked tests only. External email is at-least-once across crashes; message identifiers are stable but remote SMTP exactly-once cannot be promised.
3. Cargo old physical columns cannot be dropped until historical originals and conflicts are inspected row by row. Load List legacy states cannot be mapped/contracted without a verified owner mapping. Incomplete Port rows cannot be made NOT NULL or activated with invented values.
4. The edited database-backed E2E suites, vessel ownership/browser paths and actual PostgreSQL transaction behavior require isolated/owner-authorized acceptance. No report here asserts a broad E2E pass, final legal retention period, official terminology beyond the confirmed decisions or Phase 11 work.
5. Existing item-level DRAFT/OPEN editing flows (for example quotation, proforma, Job cost, Manifest and Load List items) still have guarded hard-delete operations. This release protects the master/lifecycle routes listed above; it does **not** establish a system-wide proof that every old item-deletion path meets the unresolved retention policy. Review those flows and required correction/audit behavior with the owner before calling the deletion-policy acceptance complete. The legacy portal-demo script remains opt-in and is not part of the owner-server deployment.
