# INCIDENT · `User.isPrimaryAdmin` missing column breaks the Users section

**Date recorded:** 2026-10-12
**Status:** 🟡 **RESOLVED (symptom)** · 🔴 **NOT FULLY VERIFIED (module)**
**Severity:** HIGH — the Users section was unusable
**Branch:** `arena/be9b4e5b-duna`

---

## 1 · Summary

The deployed API threw `The column User.isPrimaryAdmin does not exist` on every request that read a user,
making the dashboard's Users section fail to load.

The schema field and the code that selects it were committed in this branch, but the accompanying migration
was never applied to the database. The gap between *schema + code* and *database* is the whole of the fault.

The migration SQL was applied manually and the migration was then recorded as applied with
`prisma migrate resolve --applied`. The dashboard subsequently loaded.

**This document records the incident. It does not certify the Users module as working** — see §6.

---

## 2 · Chain of causation (verified from the repository)

| # | Fact | Evidence |
|---|---|---|
| F1 | `User.isPrimaryAdmin` added to `prisma/schema.prisma` | commit `66628c3` — the only schema change on this branch: `git diff c997624 HEAD -- prisma/schema.prisma` returns 6 added lines, all this field and its comment |
| F2 | `isPrimaryAdmin: true` added to the shared `userSelect` in `users.service.ts` | commit `0130f2b`; `git log -S "isPrimaryAdmin: true"` returns that commit only |
| F3 | The field is **absent** at base `c997624` | `git show c997624:apps/api/src/modules/users/users.service.ts \| grep isPrimaryAdmin` → no match |
| F4 | The field exists on **no other branch** | checked `main`, `ai-test`, `duna-analysis`, `arena/fe92d85a-duna`, `transfer/duna-recovered-20261009` — 0 schema hits, 0 migration directories each |
| F5 | `userSelect` is used by **every** user read | `users.service.ts` lines 98, 111, 155, 201, 237, 280 — list, findById, update, and others all spread `...userSelect` |
| F6 | Migration `20261012000000_primary_administrator` was on disk but **not applied** | the only migration directory added since base; reported unapplied by `prisma migrate status` |

**Because F5, a single missing column failed *all* user reads**, not just some of them. That is why the symptom
presented as "the Users section is broken" rather than as one failing field.

### Conclusion on causation

For the code as deployed from this branch, the missing column is a **complete and sufficient** explanation of
the failure. No second cause is needed to account for it.

---

## 3 · Was there an *earlier*, separate Users error?

The owner reported that a database-related error on the Users section existed **before** these changes. That
cannot be reconciled with F3 and F4: the field did not exist in the code until this branch introduced it, so
the `isPrimaryAdmin` error **cannot predate** this branch's deployment.

The only previously documented failure is different in kind:

| Date | Documented failure | Failure mode |
|---|---|---|
| 2026-10-09 | [`ops/admin-login-verification.md`](../../ops/admin-login-verification.md) | `POST /api/v1/auth/login` → **502 UPSTREAM_UNAVAILABLE**, "API service unavailable", "Dashboard reached = no" |

A 502 means the API process was not reachable at all — an infrastructure/routing fault, not a Users-module
query error. It would have affected **every** section, not Users specifically.

**Assessment:** two distinct failures are being remembered as one. The 2026-10-09 event was the API being down;
the 2026-10-12 event was the missing column. They are not the same fault and the second did not cause the first.

**Not verifiable here:** whether some *third* fault also affects Users. This audit has no database or server
access, so no server-side log could be inspected. If the owner observed a Users error while the API was
healthy and before this branch was deployed, that observation needs its own evidence (see §6 for how to capture it).

---

## 4 · Remediation applied

```sql
BEGIN;
ALTER TABLE "User" ADD COLUMN "isPrimaryAdmin" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_isPrimaryAdmin_key"
  ON "User"("isPrimaryAdmin")
  WHERE "isPrimaryAdmin" = true;
COMMIT;
```

Then, **after** the SQL was confirmed applied:

```bash
pnpm exec prisma migrate resolve --applied 20261012000000_primary_administrator \
  --schema=prisma/schema.prisma
```

Why `resolve --applied` is correct and not a falsification: the migration **was** applied — by hand. The command
records that fact. Running it *without* the SQL would have been the false marking. It inserts one row and
modifies none; it did not touch the four reconciled-elsewhere migrations.

The migration is purely additive — verified to contain no `DROP`, `DELETE`, `TRUNCATE`, `ALTER COLUMN` or
`ALTER TYPE`.

---

## 5 · Contributing cause — build path did not generate the client

A separate defect made this class of failure more likely. `prisma generate` was wired into **no** build or
start script; the only automatic trigger was `@prisma/client`'s `postinstall`, which runs solely during
`pnpm install` and exits **0** even when generation fails.

Fixed in commit `31c1550` by running `pnpm db:generate` ahead of compilation:

```json
"build":     "pnpm db:generate && pnpm run build -r",
"build:api": "pnpm db:generate && pnpm --filter @shipping/api build"
```

This closes the *client-generation* gap only. **It does not apply migrations.** The deployment sequence still
needs an explicit `prisma migrate deploy` (or equivalent) step — that remains the deeper process gap that
produced this incident and must be closed separately.

---

## 6 · What is still NOT verified

The dashboard opening proves the listing query succeeds. It does **not** prove the module works.

| Area | Status | Why |
|---|---|---|
| Users list | ✅ Observed working | owner confirmed the dashboard loaded |
| Users create / update / delete | ❌ Not verified | no runtime exercise since remediation |
| Role assignment via Users UI | ❌ Not verified | `setRoles` audit path changed in `0130f2b` and was never run against a database |
| `POST /users/primary-admin/transfer` | ❌ Not verified | new endpoint, no test, no UI |
| Primary-administrator designation | ❌ Not verified | no row is yet flagged; the owner has not been designated |
| `GET /audit*` endpoints | ❌ Not verified | new endpoints, gated by `audit:read`, no UI consumes them |
| `release:override` enforcement | ❌ Not verified | no runtime evidence |
| 22 e2e suites | ❌ Never executed | require a live database (see the Phase 1 audit) |

**Recommended verification** (owner-side, read-only where possible):

```sql
-- confirm the column and index
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name='User' AND column_name='isPrimaryAdmin';

SELECT indexname, indexdef FROM pg_indexes
WHERE tablename='User' AND indexname='User_isPrimaryAdmin_key';

-- confirm the migration is recorded, and that nothing is in a failed state
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations" WHERE migration_name LIKE '20261012%';

SELECT migration_name FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;   -- must return 0 rows
```

Then exercise create / edit / role-change / deactivate on **one non-production user** and confirm the audit
trail records each action.

---

## 7 · Follow-up actions

| # | Action | Owner | Blocking? |
|---|---|---|---|
| A1 | Add an explicit migration step to the deployment sequence | owner | Yes — prevents recurrence |
| A2 | Verify the column, index and migration record (§6 queries) | owner | No |
| A3 | Exercise Users write paths on a test user | owner | No |
| A4 | Designate the primary administrator (runs **once**) | owner | Blocks release-exception features |
| A5 | Reconcile the four migrations recorded in the DB but absent locally | owner decision | Independent — see `migration-safety-report.md` |

---

## 8 · Non-actions

Nothing in this incident was handled by resetting the database, running `migrate dev`, running `db push`,
deleting or rewriting any `_prisma_migrations` row, or editing an existing migration file.
