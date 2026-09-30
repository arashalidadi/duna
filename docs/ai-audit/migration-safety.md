# Migration Safety Guide

**Audience:** developers performing database migrations for this ERP.
**Scope:** local development, staging, and production migration workflows.
**Rule:** migrations are the only supported schema-change mechanism. `prisma db push` is not a substitute for migration history in this project.

---

## 1. Current migration setup

- Prisma schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/*`
- Migration lock: `prisma/migrations/migration_lock.toml`
- DB client: `@prisma/client` generated into `node_modules`
- Dev database: PostgreSQL, `DATABASE_URL` from repo-root `.env`
- Migration commands are run from the monorepo root so Prisma picks up the workspace `prisma/` directory.

Local commands:

```bash
pnpm db:migrate        # prisma migrate dev  (creates + applies migration, regenerates client)
pnpm db:migrate:deploy # prisma migrate deploy (applies pending migrations, no dev bypass)
pnpm db:generate       # prisma generate (client only, no migration)
pnpm db:seed           # tsx prisma/seed.ts (idempotent seed)
```

---

## 2. Development workflow

1. Make schema changes in `prisma/schema.prisma`.
2. Run `pnpm db:migrate` from the repo root.
   - This opens a dev migration wizard only if interactive input is available. In non-interactive environments, create the migration with `prisma migrate dev --create-only` and apply separately.
3. Review the generated SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`.
4. Apply with `pnpm db:migrate` or `prisma migrate deploy` depending on environment.
5. Regenerate the client if needed: `pnpm db:generate`.
6. Run the seed if reference data changed: `pnpm db:seed`.
7. Run tests after applying: `pnpm test`.

Do not edit an already-applied migration file. If a migration is wrong, create a new migration that fixes it.

---

## 3. Backup-before-migration requirement

**Every migration in any environment must be preceded by a backup.**

### Local development

Backup the current dev database before applying a new migration:

```bash
# From repo root; adjusts to your local postgres invocation.
# Example for a locally running PostgreSQL:
pg_dump -h localhost -U shipping -d shipping_erp -f backup-before-$(date +%Y%m%d-%H%M%S).sql
```

If `pg_dump` is not on PATH, use the Docker exec form when the database is in Docker:

```bash
docker exec -t <db_container> pg_dump -U shipping shipping_erp > backup-before-$(date +%Y%m%d-%H%M%S).sql
```

Keep the backup file until the new migration is verified.

### Staging and production

- Take an explicit database dump before applying migrations.
- Store the dump outside the application container, with a timestamp and environment label.
- The project does not assume any specific cloud storage for backups. Use whatever backup storage the deployment environment provides, but the dump must exist before migration.

Minimum backup metadata to record:

- environment
- database name
- timestamp
- backup file location
- migration(s) about to be applied
- operator

---

## 4. Rollback strategy

### Safe rollback for additive changes

If a migration only adds tables/columns/indexes and does not drop or rewrite data:

- Rollback can often be performed by reverting the application code to the previous release and leaving the schema as-is, if the older code tolerates the new columns/tables (usually yes for additive changes).
- If the older code cannot start against the new schema, apply a reversing migration that drops the added objects.

### Unsafe changes

If a migration drops columns/tables, changes types, or rewrites data:

- Do not rely on `prisma migrate resolve` or deploy tricks as the only rollback.
- Prepare a forward-fix migration if possible.
- If data was rewritten, restore from the pre-migration backup if the change is unacceptable.

### General rule

- Prefer forward fixes over backward rollbacks when data has been mutated.
- Never assume a migration is reversible without testing the reverse path on a copy of the database.

---

## 5. Data verification strategy

After applying a migration:

1. Confirm migration status:
   ```bash
   pnpm db:migrate:deploy -- --check  # or equivalent status check
   ```
   or inspect `prisma migrate status`.
2. Confirm the new tables/columns exist and have expected types.
3. Confirm existing data is intact:
   - row counts for major tables before and after
   - spot-check critical rows by primary key
   - confirm no unexpected NULLs in previously required fields
4. Run the seed only if intended; otherwise ensure existing seed-derived data is still valid.
5. Run the test suite.
6. If the migration touches customer-facing documents, verify that historical document numbers were not renamed or regenerated.

Record verification results in the migration log or deployment note.

---

## 6. Constraints for this project

- Do not drop or destroy existing tables.
- Do not rewrite historical data unless explicitly required by a phase.
- Use nullable/new fields where appropriate to preserve compatibility.
- Do not rename or regenerate historical existing document numbers during migration.
- New infrastructure tables must be additive until a later phase explicitly changes them.
- Phase 1 must not migrate old Customer party data; it only documents the future compatibility strategy.

---

## 7. Migration review checklist

Before applying:

- [ ] Schema change is intentional and matches the phase scope.
- [ ] Migration SQL reviewed, especially `ALTER TABLE`, `DROP`, `TYPE` changes.
- [ ] Backup created and stored.
- [ ] Rollback plan identified.
- [ ] Affected modules and API behavior considered.
- [ ] Historical data impact assessed.

After applying:

- [ ] Migration status shows applied.
- [ ] New schema objects exist.
- [ ] Existing data intact.
- [ ] Tests pass.
- [ ] No unintended renumbering or data rewrite occurred.

---

## 8. Non-interactive migration notes

Some environments cannot run interactive Prisma prompts. In those environments:

- Create the migration with `prisma migrate dev --create-only` or `prisma migrate diff` + manual SQL as appropriate.
- Apply with `prisma migrate deploy`.
- Do not use `prisma db push` to bypass migration history.

For this repo, the safe non-interactive path is:

1. Edit `prisma/schema.prisma`.
2. `pnpm db:generate` if client types need updating.
3. Create migration: `npx prisma migrate dev --create-only --name <snake_case_name>`
4. Review SQL.
5. Apply: `pnpm db:migrate:deploy`

If `migrate dev --create-only` is not suitable for the current step, use `prisma migrate diff` to produce SQL from schema diff and place it under `prisma/migrations/<timestamp>_<name>/migration.sql`, then `migrate deploy`.

---

## 8.1 Practical Phase 1 migration command sequence

For Phase 1 infrastructure tables, the following sequence is used:

```bash
# 1. Backup first
pg_dump -h localhost -U shipping -d shipping_erp \
  -f prisma/backups/backup-before-phase1-$(date +%Y%m%d-%H%M%S).sql

# 2. Ensure schema includes Phase 1 models
# (schema edit already done before this step)

# 3. Create migration
npx prisma migrate dev --create-only --name phase1_infrastructure

# 4. Review migration SQL
less prisma/migrations/*phase1_infrastructure*/migration.sql

# 5. Apply
pnpm db:migrate:deploy

# 6. Regenerate client
pnpm db:generate

# 7. Verify
pnpm db:migrate status
pnpm test
```

---

## 9. Reference

- Prisma migrations: https://pris.ly/migrations
- This guide is part of the audit/implementation documents under `docs/ai-audit/`.
