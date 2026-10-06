# Phase 5 — Unit 2: Manifest rewrite — consolidation core

**Date:** 2026-10-05 (finished 2026-10-06)
**Unit:** phase5-unit2-manifest-rewrite-core
**Roadmap:** `docs/current-plan/09-final-implementation-roadmap.md` §3 · **ADR:** ADR-047
**Baseline:** HEAD 0fcf339 (Phase 5 Unit 1, 385 tests, 22 suites)
**Scope:** ADR-047 d1 consolidation create path + ADR-047 d3 B/L-item reference/backfill +
ADR-047 d4 per-item party columns. Additive only — legacy cargo path untouched, UI untouched,
numbering untouched, charges untouched (d9).

## Delivered

- `prisma/migrations/20261005130000_manifest_bl_reference/` — one additive diff-generated
  migration, status **36 → 37**, shadow re-diff **"No difference detected."**:
  - `manifests.manifestDate TIMESTAMP(3)` (nullable; ADR-047 d6, technical default from
    `voyage.plannedDepartureAt`)
  - `manifest_items.billOfLadingItemId TEXT` + `shipperId` + `consigneeId`, all
    `ON DELETE SET NULL` (3 FKs) + 3 plain indexes; no drops, no enum changes
  - ADR-047 d3 backfill SQL (verbatim, idempotent, guarded by `IS NULL`) restoring the
    two-way reference for legacy stamped lines
- `apps/api/src/modules/manifest/dto/manifest.dto.ts` — optional `billIds?: string[]`
  (`@IsArray` + `@IsString({each:true})` + `@ArrayNotEmpty`); `UpdateManifestDto.manifestDate`
- `apps/api/src/modules/manifest/manifest.service.ts` — consolidation create path: validates
  all billIds APPROVED + same voyage → claim guard → generateReference() (U4 swaps later) →
  one `manifest_items` row per B/L item with `billOfLadingItemId` + per-item parties copied
  mechanically from the B/L (d2+d4); legacy cargo path unchanged
- `packages/shared/src/manifest.ts` — `ManifestItem.billOfLadingItemId/shipperId/consigneeId`,
  `Manifest.manifestDate`, `CreateManifestDto.billIds`, `UpdateManifestDto.manifestDate`
- `apps/api/test/manifest.e2e-spec.ts` — U2 suite (self-cleaning, explicit-id sweeps)

## Claim guard rewrite (RULING 1 — real bug fixed, no ADR change)

The shipped guard read `tx.billOfLadingItem.findMany({ billOfLadingId ∈ billIds, select:
manifestItemId })` — the **Phase-4 stamp column**, which the consolidation path never writes
(the `manifestItem.create` block sets `billOfLadingItemId` only). `alreadyClaimed` was always
empty on exactly the rows it guards = dead no-op. Second latent bug in the same block:
`ownerManifests` did `where: { id: { in: alreadyClaimed } }` — filtered **MANIFEST ids with
MANIFEST-ITEM ids** (dead today, wrong the moment it fires).

Rewritten to query the new column through a live owner manifest:

```ts
const claimed = await tx.manifestItem.findMany({
  where: { billOfLadingItem: { billOfLadingId: { in: billIds } }, manifest: { deletedAt: null } },
  select: { manifest: { select: { manifestNumber: true } } },
});
if (claimed.length > 0) {
  const ownerNumbers = [...new Set(claimed.map((c) => c.manifest.manifestNumber))];
  throw new ConflictException(`One or more B/Ls are already consolidated onto manifests: ${ownerNumbers.join(', ')}`);
}
```

Owner-manifest numbers now come from the same query (bug 2 fixed). `manifest: { deletedAt: null }`
carries ADR-047 d3: **a soft-deleted manifest frees its claims** (the reason there is no
DB-level `@unique` on `billOfLadingItemId`).

## Claim-guard reachability (RULING 2 — honest finding, not a defect)

Proven against source: (a) the qualification query forces `bill.voyageId === dto.voyageId`;
(b) any live claiming manifest therefore sits on that same voyage; (c) `UpdateBillDto` has no
`voyageId`, so a manifest's voyage is immutable post-create. Consequently the pre-transaction
one-manifest-per-voyage check (`manifest.service` create, `where: { voyageId, deletedAt: null }`,
**status-blind**) **always fires before** the in-transaction claim guard. Conclusion: the 409
claim-guard path is **API-unreachable (0 via API)**.

Why the guard is kept anyway: it is the item-level invariant backing ADR-047 d3. It survives if
the voyage rule is ever relaxed, or if a second creation path appears; and a wrong-direction
guard would silently violate the invariant while *looking* protected (the exact failure mode this
rewrite fixed). The reachable direction — soft-delete frees the claim — IS reachable and is
asserted by the test below.

## Test redesign (RULING 3 — counts: deleted 1, replaced with soft-delete pair)

Three failures diagnosed (all test-setup bugs, not product bugs) and fixed:

1. **"bill on wrong voyage → 400" got 409** — posted to `voyage1Id`, which already carries live
   `manifest1Id` (APPROVED), so the one-manifest-per-voyage rule fired first. Fixed with two
   fresh voyages: bill APPROVED on `voyA`, `POST { voyageId: voyB, billIds: [billA] }` where
   `voyB` has no live manifest → the qualification 400 is reached.
2. **"claim guard → 409" got 400** — `voy2` ≠ the bill's voyage, so qualification failed first;
   and per the reachability analysis the 409 is unreachable anyway. **Deleted**: asserting an
   unreachable state cannot pass, faking it proves nothing.
3. **"soft-delete-aware" got 400** — same second-voyage setup bug; the bill's voyage is the
   constraint, so the re-consolidation must target the *same* voyage.

Replaced with the soft-delete pair (reachable, meaningful):

- **"consolidation soft-delete frees the claim"** — create APPROVED bill on fresh voyage V →
  consolidate onto M1 (201) → soft-delete M1 → `POST { voyageId: V, billIds: [A] }` → **201**
  (M2, different id). Load-bearing assertion: M1's `ManifestItem` rows **still exist**
  (`findMany({ where: { manifestId: mf1Id } })`, explicit id filter, count > 0 and
  `billOfLadingItemId` non-null) — proving the 201 came from the guard correctly *ignoring* the
  soft-deleted owner, not from the claim being erased. Without it the test would pass either way.

## Tests

- manifest suite: **23 → 22** (deleted 1 unreachable; the soft-delete pair is one test carrying
  the re-consolidation + surviving-items assertions). U2 coverage: happy path (2 APPROVED B/Ls →
  201, one line per B/L item, `billOfLadingItemId` + per-item parties read back) · non-APPROVED
  400 · wrong-voyage 400 · empty `billIds` 400 (`@ArrayNotEmpty` message) · soft-delete frees
  claim · backfill idempotent re-run = 0 rows · SET NULL on B/L-item hard-delete · legacy cargo
  path regression unchanged.
- Full battery: `pnpm --filter api test` → **393 passed / 393, 22 suites** (22/22 suites,
  baseline 385 → **393**; manifest suite 22/22). Re-ran twice — no flakes.
- `npx tsc -p apps/api/tsconfig.json --noEmit` = **0**.
- `apps/web` tsc = **exactly the 3 pre-existing** `[locale]/page.tsx` TS7053 errors (services /
  capabilities / coverage index) — unchanged by U2.
- `pnpm --filter @shipping/shared build` = **0**.
- `npx prisma migrate status` = **37 migrations, "Database schema is up to date!"**;
  shadow re-diff = **"No difference detected."**
- Health: `curl :3101/api/v1/health` = **200**; `curl -sL :3000` = **200**. Servers untouched
  (never started/stopped/restarted).

## Backfill + live data

Live counts **before → after** U2:

| table | before | after | Δ |
|---|---|---|---|
| manifests | 4 | 4 | 0 |
| manifest_items | 4 | 4 | 0 |
| bills_of_lading | 14 | 24 | +10 (fixture bills, swept by explicit id in afterAll) |
| NumberingSequence (documentType MANIFEST) | 0 | 0 | 0 — no numbering change in U2 |

The 4 legacy manifests + 3 legacy B/Ls received only the new nullable columns. **Backfill row
count: 0** — no `bills_of_lading_items.manifestItemId` rows exist to backfill, so the guarded
UPDATE matched 0 rows on the live DB (verified by the idempotency test's first execution: it
populated 0 rows, second run 0). The migration's backfill clause is inert-but-correct here and
idempotent on re-run. Fixture hygiene held: deletions by explicit `id` filters only (U2 incident
rule); `MANIFEST` sequence rows did not grow.

## Porcelain

- migration dir `prisma/migrations/20261005130000_manifest_bl_reference/`
- `prisma/schema.prisma`
- manifest module: `dto/manifest.dto.ts`, `manifest.service.ts`
- `apps/api/test/manifest.e2e-spec.ts`
- `packages/shared/src/manifest.ts`
- this log
- ledger `docs/current-plan/11-implementation-state.md` — U2 status + Next line

`docs/decisions.md` **untouched** — the decision was always right, only the code wasn't.
`apps/web` **0 changes** (UI_GATE NOT APPLICABLE). No UI dependency for U2.

## Boundaries recorded

- Per-item parties are a **mechanical copy** (d4); DTO validation + distinct summary = **U3**.
- `manifestNumber` still from `generateReference()` (U4 swaps later); no numbering change in U2.
- No `blNumber` stamp on the new path — the manifest reads the bill number through the reference.
- Legacy approve-stamp path untouched; `billOfLadingItemId` is nullable so legacy rows stay valid.

## Next

Phase 5 Unit 3 (per ADR-047): DTO validation for per-item parties + distinct-party summary on
the manifest header; then U4 numbering swap.
