# Phase 1 — database migration & deployment runbook

**Created 2026-10-12.** Applies to the `User.isPrimaryAdmin` fix (DEC-116) and to
any future migration deployed to the existing server database.

Audience: whoever runs the server. Every command below was validated against a
local PostgreSQL 16 instance seeded to reproduce the production state; the
results are in §7.

---

## 1 · What is being fixed

| Thing | State in Git | State on the server |
| --- | --- | --- |
| `User.isPrimaryAdmin` column | present since commit `66628c3`; migration `20261012000000_primary_administrator` committed | **absent** |
| API code that reads it | in every Users query and in `resolvePermissions()` | deployed |

`UsersService.userSelect` spreads `isPrimaryAdmin` into **every** user query, and
`AuthService.resolvePermissions()` — which `JwtAuthGuard` calls on **every
authenticated request** — selects it too. A database missing that column
therefore fails with:

```
ERROR: column "isPrimaryAdmin" does not exist   (SQLSTATE 42703)
```

This is not a Users-only fault: login, refresh, and every authenticated endpoint
depend on `resolvePermissions()`. The column is missing because the migration was
committed to Git but never applied to the database.

**Nothing else is wrong with the Users module.** No application code change is
required to fix it; the database must be brought up to the committed schema.

---

## 2 · Pre-flight — READ ONLY, run before changing anything

`cd` to the application directory (e.g. `/home/arash/shipping-erp`) so that
`prisma/` and `.env` resolve. All four steps are read-only.

```bash
# 2.1  Which migrations does the server believe are applied?
npx prisma migrate status
```

Expected output: all committed migrations reported as applied except
`20261012000000_primary_administrator` (pending). `migrate status` also reports
divergence — read it carefully:

- **"Following migrations have not yet been applied"** listing only
  `20261012000000_primary_administrator` → proceed to §3.
- **"applied to the database but missing from the local migrations directory"**
  naming the four `20260921*` migrations → **expected, ignore it**, see §6.
- **any message that a migration "was modified after it was applied"** → STOP.
  The local file's checksum differs from the server's. Do not run `deploy`;
  report this before continuing.

```bash
# 2.2  Confirm the column really is absent (expect: 0 rows).
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns
  WHERE table_name='User' AND column_name='isPrimaryAdmin';"

# 2.3  Confirm how many users exist and whether an owner is already marked.
psql "$DATABASE_URL" -c "SELECT count(*) AS users FROM \"User\" WHERE \"deletedAt\" IS NULL;"

# 2.4  Confirm the out-of-band history (expect: exactly 4 rows).
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\"
  WHERE migration_name LIKE '20260921%' ORDER BY migration_name;"
```

### Record the baseline before you touch anything

```bash
pg_dump "$DATABASE_URL" --format=custom --file="backup-before-isprimaryadmin-$(date +%F-%H%M).dump"
```

A `--format=custom` dump is restorable with `pg_restore`. Do not skip this: it is
the only way back if anything unexpected happens.

---

## 3 · Apply the migration

```bash
npx prisma migrate deploy
```

`migrate deploy` applies pending migrations in order, in a transaction each, and
does **not** reset the database, does **not** use a shadow database, and does
**not** fail because the database records migrations that are absent from the
local directory. On this database it will apply **exactly one** migration.

### After the deploy succeeded

```bash
# 3.1  The column exists, is NOT NULL, and defaults to false.
psql "$DATABASE_URL" -c "SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns WHERE table_name='User' AND column_name='isPrimaryAdmin';"

# 3.2  The partial unique index exists (at most one owner).
psql "$DATABASE_URL" -c "SELECT indexdef FROM pg_indexes
  WHERE tablename='User' AND indexname='User_isPrimaryAdmin_key';"

# 3.3  Every existing user inherited the default; nobody was silently promoted.
psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE \"isPrimaryAdmin\") AS owners,
  count(*) AS users FROM \"User\";"
```

`owners` must be **0** until the seed or a deliberate transfer designates one.
A non-zero value on a database that never had the column would mean something is
wrong — investigate before restarting the API.

```bash
npx prisma migrate status     # expect: "Database schema is up to date!"
```

---

## 4 · Designate the primary administrator

The column exists but no row is marked yet. To give the company owner the flag:

```bash
# Either re-run the seed (idempotent, and it will NOT create sample data):
pnpm db:seed

# …or set it directly for a specific account:
psql "$DATABASE_URL" -c "UPDATE \"User\" SET \"isPrimaryAdmin\" = true
  WHERE email = 'owner@example.com';"
```

The seed marks the `SEED_ADMIN_EMAIL` account **only when no owner exists yet**,
so re-running it can never create a second owner or overwrite the existing one.

---

## 5 · Restart and smoke-test

```bash
# Restart the API (adjust to however the service is managed on the server).
pnpm --filter @shipping/api build
# then restart the process/service that runs `node dist/src/main.js`
```

Smoke tests, in order — see the manual checklist in §8 of the delivery report:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3101/api/v1/health   # expect 200
```

Then sign in to `https://dashboard.3ree.eu.cc` and open the **Users** screen.

---

## 6 · The four migrations that exist only in the server's history

The server's `_prisma_migrations` table records four migrations whose
directories do **not** exist in Git:

```
20260921012713_phase1_infrastructure
20260921032600_phase2_master_data_party_model
20260921120000_phase3_cargo_inspection_loading_lifecycle
20260921130000_phase3a_cargo_pol_pod
```

**Leave them alone.** They are harmless, and deleting the rows is not necessary
and is not recommended.

Their content was superseded by the committed migration
`20260930180000_replay_completeness`, which recreates every object they would
have created using `CREATE TABLE IF NOT EXISTS` (AuditLog, NumberingSequence,
FileAttachment, DocumentTemplate, DocumentTemplateVersion) and replays the
`CargoStatus` enum change. This was verified, not assumed: a database built from
the 37 committed migrations alone contains all five tables, and a database
carrying all four out-of-band records **plus** the new migration matches
`prisma/schema.prisma` byte-for-byte across 764 columns and 121 enum values (§7).

Consequences of leaving them:

- `prisma migrate deploy` ignores them. Verified.
- `prisma migrate status` reports them as "applied to the database but missing
  from the local migrations directory" — informational.
- `prisma migrate dev` (development only) would want to reconcile them. **Never
  run `migrate dev`, `migrate reset` or `db push` against the server.**

If you later want the histories to agree exactly, that is a separate, deliberate
piece of work with its own backup and rollback plan — not part of this fix.

---

## 7 · What was actually verified, and where

Reproduced with a real PostgreSQL 16 server in an isolated environment.

| # | Check | Result |
| --- | --- | --- |
| 1 | Apply all 38 committed migrations to an empty database | **38 applied, 0 failures** |
| 2 | Compare that database to `schema.prisma` (DMMF): 52 models, 32 enums | **MATCH — 764 columns, 121 enum values, 0 missing, 0 extra** |
| 3 | Build a database reproducing the server: 37 committed + the 4 out-of-band records | reproduced; `isPrimaryAdmin` absent |
| 4 | Run the failing query (`SELECT … "isPrimaryAdmin" …`) | **`42703 column "isPrimaryAdmin" does not exist`** — incident reproduced |
| 5 | Migration status on that database | 41 recorded, 4 DB-only, **1 pending** |
| 6 | Apply the pending migration | **applied = 1, skipped = 37** — the four were ignored |
| 7 | Post-deploy column / index / defaults | boolean NOT NULL default false; partial unique index present; all existing rows got `false` |
| 8 | Insert a second `isPrimaryAdmin = true` row | **rejected: duplicate key … `User_isPrimaryAdmin_key` (23505)** |
| 9 | Schema comparison again, after step 6 | **MATCH** |

Not verified here, and therefore listed as open in the delivery report: the
migration has never been executed by the Prisma CLI itself (its engine download
is blocked in the build environment), and the API has never been run against a
migrated database. Steps 3 and 5 of this runbook are the server-side equivalents.

---

## 8 · Rollback

The migration is purely additive (`ADD COLUMN` + `CREATE … INDEX`); it destroys
nothing. To reverse it manually:

```sql
DROP INDEX "User_isPrimaryAdmin_key";
ALTER TABLE "User" DROP COLUMN "isPrimaryAdmin";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261012000000_primary_administrator';
```

Do this **only** together with a rollback of the application code, because the
deployed code reads that column.

---

## 9 · What not to do

- Do **not** run `prisma migrate reset` — it drops the database.
- Do **not** run `prisma db push` — it bypasses migration history.
- Do **not** delete rows from `_prisma_migrations` to silence a warning.
- Do **not** run `prisma migrate resolve --applied 20261012000000_primary_administrator`.
  It would mark the migration as applied *without running it*, leaving the column
  missing and the fault in place.
- Do **not** run `pnpm db:seed` with `SEED_DEMO_DATA=true` on production; see
  [`phase-1-audit-2026-10-12.md`](phase-1-audit-2026-10-12.md) and the seed-safety
  guard (`pnpm check:seed-safety`).
