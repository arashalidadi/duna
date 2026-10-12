# Seed-dependency inventory

> **Correction (2026-10-12, Phase 1 review — additive; the original text below is retained as recorded).**
> The result in §2 — "Suites depending on **demonstration** rows: **0**" and "No suite depends on
> demonstration data" — is **wrong**. Three suites did depend on demonstration rows, and an earlier
> version of this inventory missed them:
>
> | Suite | Demonstration dependency found | Status after Phase 1 review |
> | --- | --- | --- |
> | `test/portal.e2e-spec.ts` | `beforeAll` took `prisma.voyage.findFirst()`; a fresh required-seed DB has no voyage, so 14 tests failed | Creates its own vessel `PFV-<tag>` and voyage `VOY-PF<tag>`; deletes them in `afterAll` |
> | `test/bill.e2e-spec.ts` | Asserted on seeded `BOL-2609-00001` / `-00002`; the legacy-format test relied on the paged list | Creates its own fixture vessel, voyage and bills; the legacy-format assertion is now a direct DB check; cleans up in `finally` |
> | `test/voyage.e2e-spec.ts` | Backfill test expected legacy `VOY-24*` voyages | Creates its own vessel and voyage, runs the migration step against that voyage only, cleans up in `finally` |
>
> Evidence: on a fresh DB with only the required seed, the pre-fix suites produced 17 failed tests
> (`jest-full.log`, sandbox). After the fixes, all 22 suites pass on a fresh DB with only the required
> seed, and again on a second run on the same DB (see `e2e-sandbox-run-2026-10-12.md`).
>
> Also corrected: `vessel.e2e-spec.ts` (the one suite the original text describes as fixed in commit
> `6f09493`) is not the only one. The count of suites that depend on the **required** seed (admin and
> permission catalogue) is still 22: all 22 suites reference the seeded admin account
> (`SEED_ADMIN_EMAIL`, default `admin@shipping.local`, checked by grep 2026-10-12).

**Created 2026-10-12** (Phase 1). This is the P0 deliverable *"the seed-dependency
list is written down"* (`initial-roadmap.md:74`), which Phase 1 lists as its
prerequisite. It was missing from the record until now.

Question it answers: **which of the 22 API e2e suites depend on rows that the seed
creates?** That determines which suites need their own fixtures before
demonstration data can be gated behind an opt-in.

---

## 1 · The two layers of seed data

Phase 1 split `prisma/seed.ts` into two modules with different guarantees:

| Layer | File | Runs when | Contents |
| --- | --- | --- | --- |
| **Required** | `prisma/seed/core.ts` | always — `pnpm db:seed` | Currencies (USD, AED) · the permission catalogue · roles `ADMIN` and `OPERATIONS` · ports `JEBALI`, `KHALIFA` · yards `JEBALI-Y1`, `KHALIFA-Y1` · company settings · the administrator account, its `ADMIN` role link and the primary-administrator designation |
| **Demonstration** | `prisma/seed/demo.ts` | only when `SEED_DEMO_DATA === 'true'` | Vessel `MV-HORIZON` · voyage `VOY-2401-00001` · customers `CUS-GLOBAL`, `CUS-AUTO` · cargo `CRG-2401-APPROVED`, `CRG-2401-PENDING`, `CRG-2401-REJECTED` · inspections `INS-2401-00002`, `INS-2401-00003` · load list `LL-2401-00001` · agent `AGT-001` · manifest `MAN-2609-00004` · portal user `agent@portal.local` |

A suite that depends on the **required** layer is safe: that layer always runs and
contains no fabricated business records. A suite that depends on the
**demonstration** layer is a defect — it would fail on any database seeded without
the opt-in, which is every production database.

---

## 2 · Result

All 22 suites were inspected for every demonstration identifier.

| | Count |
| --- | --- |
| Suites inspected | **22** |
| Suites depending on **demonstration** rows | **0** |
| Suites depending on the **required** seed (admin account + permission catalogue) | **22** |

**No suite depends on demonstration data.** The one that did —
`vessel.e2e-spec.ts`, which asserted on the seeded `MV-HORIZON` row — was given its
own fixture in Phase 1 (commit `6f09493`). It now creates the "pre-existing" vessel
it asserts on and registers it for cleanup in `afterAll`.

### Per-suite detail

Every suite logs in as the seeded administrator
(`POST /api/v1/auth/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) and
creates the business rows it needs through the HTTP API, so each one exercises the
real write path and cleans up after itself.

| Suite | Depends on required seed | Depends on demonstration data | Creates its own data |
| --- | --- | --- | --- |
| `actual-loading` | yes | **no** | yes (HTTP) |
| `app` | yes | **no** | — |
| `auth` | yes | **no** | yes (HTTP) |
| `bill` | yes | **no** | yes |
| `cargo-inventory` | yes | **no** | yes |
| `delivery-release` | yes | **no** | yes |
| `discharge` | yes | **no** | yes (HTTP) |
| `inspection` | yes | **no** | yes (HTTP) |
| `invoice` | yes | **no** | yes (HTTP) |
| `job` | yes | **no** | yes (HTTP) |
| `letter` | yes | **no** | yes (HTTP) |
| `manifest` | yes | **no** | yes |
| `master-data` | yes | **no** | yes (HTTP) |
| `party-cutover` | yes | **no** | yes (HTTP) |
| `party-masters` | yes | **no** | yes (HTTP) |
| `portal` | yes | **no** | yes |
| `proforma` | yes | **no** | yes (HTTP) |
| `quotation` | yes | **no** | yes (HTTP) |
| `salary` | yes | **no** | yes (HTTP) |
| `vessel` | yes | **no** | yes (HTTP + its own fixture) |
| `voucher` | yes | **no** | yes (HTTP) |
| `voyage` | yes | **no** | yes (HTTP) |

---

## 3 · Consequences

1. **The demonstration gate is safe to leave off.** No suite breaks when
   `SEED_DEMO_DATA` is unset, which is the default.
2. **Every suite still requires the required seed.** They authenticate as
   `SEED_ADMIN_EMAIL`. Before running the suite, `pnpm db:seed` must have run
   against the target database — with the opt-in unset.
3. **A suite that grows a dependency on demonstration data is a regression.** The
   guard `pnpm check:seed-safety` enforces the module boundary statically; this
   inventory is the corresponding record for the suites.
4. This inventory does **not** cover manual/browser testing. A person may still
   want sample data on a development database, which is exactly what
   `SEED_DEMO_DATA=true` is for.
