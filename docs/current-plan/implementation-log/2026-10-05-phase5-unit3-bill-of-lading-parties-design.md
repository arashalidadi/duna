# P5-U3 — bill-of-lading-parties (per-item parties end-to-end): COMPLETE (2026-10-06)

**Unit**: `phase5-unit3-bill-of-lading-parties-design`
**Authority**: ADR-047 d4 (`docs/decisions.md`) · roadmap §3 Phase 5 Tests 3 / Acceptance 2 (`docs/current-plan/09-final-implementation-roadmap.md`) · U1 unit plan (`2026-10-05-phase5-unit1-manifest-rewrite-design.md`, "P5-U3 | per-item shippers/consignees end-to-end (DTO validation, copy-from-B/L, distinct-parties summary in API) | Test 3 | Acceptance 2")
**Scope**: per-item parties + distinct summary + validation (DTO/service/e2e). NO new status · NO drops of any kind · additive only · NO UI (apps/web byte-identical) · NO numbering (U4) · NO charges (ADR-047 d9) · docs/decisions.md untouched.
**HEAD**: `31459a9` (U2) + this unit's changes. Reports: **393 → 397 tests**.

---

## 1. Migration reconciliation — why status stays 37 (no migration dir)

The unit brief expected `migrate status 38` / "migration: one, 37 → 38". Honest finding after
verification: **U3 requires no schema change**, because ADR-047's entire schema footprint already
shipped inside U2's migration `20261005130000_manifest_bl_reference` (status 37):

| ADR-047 decision | Schema piece | Where it shipped |
|---|---|---|
| d3 (B/L item reference) | `manifest_items.billOfLadingItemId` + FK (SET NULL) + index + idempotent backfill | migration **37** (U2) |
| d4 (multi-party rows) | `manifest_items.shipperId/consigneeId` + 2 FKs (SET NULL) + 2 indexes; `Shipper`/`Consignee` reverse relations | migration **37** (U2) |
| d6 (ManifestDate) | `manifests.manifestDate` | migration **37** (U2) |

Cross-checks performed for this unit:
- The decision-maker's own P5-U2 verification block (ledger `11-implementation-state.md`) explicitly
  lists "`manifestDate`, `billOfLadingItemId` + FK ON DELETE SET NULL, `shipperId`/`consigneeId` + FKs,
  3 indexes" inside migration 37 — i.e. d4's columns are already known-shipped.
- The U1 unit plan assigns exactly ONE Phase-5 migration, to **U2** ("additive migration (item FK +
  backfill…)") and gives **U3 no migration**; ADR-047 itself predicts only "status becomes 37".
- `prisma migrate diff --from-migrations --to-schema-datamodel` (shadow) = **"No difference detected"**
  before and after this unit — schema ≡ migrations ≡ live (verified live columns by querying
  `manifestItem.findMany({ select: { shipperId } })`).
- What U3 adds (per-row party objects, derived summary, DTO validation) is read/validate-side only:
  no DDL, no indexes (existing `manifest_items_shipperId_idx`/`_consigneeId_idx` cover the queries),
  and ADR-047 d4 explicitly forbids persisting the summary ("display-time distinct aggregation, not a
  schema group").

Conclusion: the migration the brief expected **is the d4 party-columns migration, which U2 already
consumed** (the consolidation copy could not exist without those columns, so U2 shipped them early).
`prisma/schema.prisma` is touched only by a P5-U3 annotation comment (no DDL effect; shadow stays
clean). If the decision-maker wants a migration anyway, the only honest candidates would be
invented schema with no ADR backing — not shipped, per "matching the roadmap design".

## 2. What shipped (code)

**`manifest.service.ts`**
1. `detailSelect.items` now also selects `shipper`/`consignee` relation objects
   (`id, code, name`) — the data ADR-047 d4 requires for per-row cells ("code + name,
   fallback to the manifest header when null"), alongside the existing scalar ids.
2. **`withPartySummary(row)` helper** (ADR-047 d4): derives
   `partySummary: { shippers: PartyRef[], consignees: PartyRef[] }`:
   - effective party of a row = `item.shipper ?? header.shipper` (and symmetric for consignees) —
     the exact fallback rule the items table uses for its cells, so the summary always matches what
     the table renders;
   - **rows govern**: a non-null row party is never overridden by the header; a null row resolves
     through the header; distinct by master id; insertion order = item sequence;
   - no rows → empty arrays (the summary is "the set … across rows"; an empty manifest has no rows
     to summarize — the header still renders in the header section);
   - consignees are symmetric; nothing is invented when neither side has a party.
3. All **11 detail-shaped returns** wrapped (`findById`, consolidation create, legacy create,
   `update`, `remove`, `addItem`, `updateItem`, `removeItem`, `submit`, `approve`, `cancel`) so every
   response carrying `detailSelect` has one consistent shape. `list()` is untouched (no items →
   no summary; ADR-047 d4 scopes it to the detail).
4. **DTO validation (create/consolidation)**: `billIds` is now computed first; if `billIds` is
   non-empty AND any header party field (`shipperId|consigneeId|agentId`) is supplied, the request
   is rejected with
   `"shipperId/consigneeId/agentId are not accepted when consolidating with billIds: each manifest line carries its own B/L parties (ADR-047 d4)"`.
   Rationale: the consolidation create writes header parties null (U2, verified), so those fields
   could never take effect — previously they were validated and then **silently dropped**; now the
   dead input is rejected at the boundary. Scope boundary: `description/notes/notifyParty` are still
   nulled-and-ignored on consolidation (U2's verified behavior, parties are out of U3's scope —
   recorded, not changed).

**`dto/manifest.dto.ts`** — follow-up **(b) closed**: stale Swagger text on the six party fields
("Shipper/Consignee/Agent customer ID (legacy …)" → "… master ID …"), plus the `billIds` description
now documents the header-party rejection. Descriptions only; runtime validation lives in the service.

**`packages/shared/src/manifest.ts`** — new exported `ManifestParty {id, code, name}`;
`ManifestItem.shipper?/consignee?: ManifestParty | null`; `Manifest.partySummary?`. Types only
(contract guard: no new `@Post` routes → 87 ⊆ 95 unchanged).

**`prisma/schema.prisma`** — annotation comment only (no DDL).

## 3. Tests (roadmap Test 3 / Acceptance 2) — 4 new, suite 22 → 26

1. `multi-party: consolidated lines carry distinct parties and partySummary lists them distinctly
   (Test 3 / Acceptance 2)` — two APPROVED B/Ls with *different* shipper/consignee masters →
   consolidation → header parties null (create response already carries the summary), per-row
   objects carry the right `code`/`name` per line, `partySummary` = exactly 2 distinct shippers and
   2 distinct consignees.
2. `multi-party summary dedupes: the same party on every line appears exactly once` — two B/Ls
   sharing one shipper + one consignee → 2 rows, summary length 1 each.
3. `partySummary rules: a row's own party governs; a row without parties falls back to the header
   (ADR-047 d4)` — consolidation row (Shipper 2) + legacy add-item row (no parties) on the same
   manifest, then header set via DRAFT PATCH → summary = {Shipper 2, header shipper} exactly;
   consignees = [] (nothing set anywhere); asserts BOTH directions: row priority and null→header
   fallback (each regression — header-override or ignored-header — fails this test).
4. `consolidation DTO validation: header party fields rejected with billIds; legacy path still
   validates them` — (a) `billIds + shipperId` → 400 with the exact new message (rejection fires
   before qualification, so no fixture B/L is needed), (b) legacy `shipperId: unknown` → 400
   `Unknown shipperId` (validatePartyRefs unchanged), (c) legacy valid party → 201 + empty
   `partySummary` — rejection is scoped to `billIds`, legacy path intact (also covers the legacy
   create-wrap).

Fixture support: `beforeAll` creates a 2nd Shipper + 2 Consignee masters (swept by explicit id in
`afterAll`); `mkVoyageModeBill(voyageId, shipperId?, consigneeId?)` now takes optional parties
(existing call sites unchanged) and records `cargoIdByBill` so a test can put the same voyage's
cargo on a manifest through the legacy add-item path.

## 4. Fixture incident + root cause of follow-up (i) — cleanup order fixed

The first instrumented full-suite run showed live counts **moving**: shippers +2, consignees +2,
bills +11 (56 vs 45). Root cause, verified in source: `afterAll`'s consolidation-fixture block
(bills → B/L items → audit) sat **LAST**, after cargo/voyage/master deletes. Deleting fixture cargo
/voyage while B/L items/bills still reference them violates their FKs; the failure is **swallowed
by the bottom `catch { /* best-effort */ }`, which silently aborts everything after it — including
the bill block itself**. That is the true mechanism behind follow-up (i) ("mkVoyageModeBill rows
untracked" was imprecise: the rows ARE pushed to `createdBillIds`; the sweep never ran because the
hook died earlier).

**Fix**: moved the bill block to the **top** of `afterAll` (bills first → B/L items cascade away,
manifest items NULL their `billOfLadingItemId`, then every later delete is unblocked). Verified:

| run | suite result | counts before → after |
|---|---|---|
| solo (post-fix) | 26/26 | 56/15/4 → 56/15/4 (static) |
| battery run 1 (post-fix) | 397/397 | 56/15/4 → 56/15/4 (static) |
| battery run 2 | 397/397 | 56/15/4 static |
| battery run 3 | 397/397 | 56/15/4 static |

**Master litter purged** (explicit CODE filter, U2 incident rule): `deleteMany(code startsWith
'MFSP')` + `('MFCN')` removed **12 shippers + 4 consignees** — every row named "Manifest Test
Shipper/Consignee …", i.e. fixture masters leaked by the broken hook across U2 runs, the
decision-maker's verification run, and this unit's pre-fix runs (Oct 2 → Oct 6). Seed baseline
restored: **shippers 3, consignees 0**. Bills→parties FKs are `ON DELETE SET NULL`
(`pg_constraint.confdeltype = 'n'` verified), so the purge only nulled refs on already-leaked bills.

**Bill litter stays parked as follow-up (i)** (56 rows, `BOL-MFP2-*` test fixtures incl. ~23 leaked
during this session's pre-fix runs) — not mass-deleted: the decision-maker explicitly parked it for
a cleanup unit, and the U2 incident rule forbids broad-pattern deletion of live tables. This unit's
contribution to (i): root cause identified + order fixed → the leak is **stopped** (three static
runs), not growing.

## 5. Battery (final, after all edits)

| check | result |
|---|---|
| `pnpm --filter api test` ×3 (triplet) | **397/397/0 (22/22)** each run |
| manifest suite (solo) | **26/26** |
| `npx tsc -p apps/api --noEmit` | **0 errors** |
| `npx tsc -p apps/web --noEmit` | **exactly 3** pre-existing `[locale]/page.tsx` errors (services/capabilities/coverage) |
| `pnpm --filter @shipping/shared build` | **exit 0** |
| CONTRACT GUARD | **OK — 87 web api.post ⊆ 95 controller @Post** (no new @Post routes) |
| `npx prisma migrate status` | **37 migrations, up to date** (see §1) |
| shadow diff (`migrations → schema`) | **No difference detected** |
| `curl :3101/api/v1/health` | **200** |
| `curl :3000` | **200** (follows locale redirect; never touched/restarted) |

## 6. Live counts (final)

| table | session start | after final battery | after fixture purge |
|---|---|---|---|
| manifests | 4 | 4 | 4 |
| manifest items | 4 | 4 | 4 |
| bills | ~34 (45 pre-purge incl. session leaks) | 56 static across triplet | 56 (litter → follow-up (i)) |
| MANIFEST NumberingSequence | 0 | 0 | 0 |
| `billOfLadingItemId` backfilled | 0 | 0 | 0 |
| shippers | 11 + fixture leaks | 15 static across triplet | **3 (seed)** |
| consignees | 0 + fixture leaks | 4 static across triplet | **0 (seed)** |

Legacy protection: the 4 legacy manifests / 3 legacy B/Ls were never modified (tests only assert on
them); MANIFEST numbering untouched (0 → 0).

## 7. Decisions & boundaries

1. **No migration** (§1) — evidence-based; no invented schema; docs/decisions.md untouched.
2. **Summary derivation**: item → header fallback, distinct by id, rows govern, empty when no rows.
   All four quadrants pinned by tests 1/3 (pinning regressions: header-override or ignored-header
   fails test 3).
3. **Rejection (not silent drop) of header parties + billIds** — narrowest change that closes the
   validation gap named by the U1 plan ("DTO validation"); legacy path semantics untouched
   (test 4b/4c).
4. **Follow-up (b) closed** (stale Swagger party descriptions). **Follow-up (i) root-caused + leak
   stopped** (bill litter itself stays parked). **(a), (c)–(h)** untouched, still parked.
5. **Ledger restoration**: an early `git checkout` in this session had reverted the decision-maker's
   uncommitted P5-U2 verification block + Next line from `11-implementation-state.md`; restored
   verbatim from their session edit before continuing (their text is included in this unit's commit).
6. **API groundwork for UI 1–3**: UI 1 (consolidate read) shipped in U2; UI 2 (multi-party row
   display) — data now shipped (per-row objects + summary); UI 3 (voyage/tug/barge) remains U5 per
   ADR-047 d11 (no web changes here).

## 8. Files changed (porcelain: exactly 6)

- `apps/api/src/modules/manifest/manifest.service.ts` (detailSelect + helper + 11 wraps + validation)
- `apps/api/src/modules/manifest/dto/manifest.dto.ts` (descriptions only — follow-up (b))
- `apps/api/test/manifest.e2e-spec.ts` (4 tests, 3 fixture helpers, afterAll reorder+consignee sweep)
- `packages/shared/src/manifest.ts` (ManifestParty, item relations, partySummary)
- `prisma/schema.prisma` (annotation comment only)
- `docs/current-plan/11-implementation-state.md` (decision-maker P5-U2 verification restored + this unit's block)
- apps/web: **0 changes**; docs/decisions.md: **untouched**; no migration dir (see §1).
