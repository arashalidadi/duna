# Phase 2 — approved follow-ups (i18n / portal shim / replay completeness) — implementation log

**Task ID:** phase-2-followups (post-cutover, decision-maker approved 2026-09-30)
**Preceded by:** `phase-2-party-cutover.md` (EXECUTION_STATUS: COMPLETE, UI_GATE: PASS) and the
decision-maker's approval of all three optional follow-ups plus the commit.
**Ordering decision (made by Hermes, not referred back):** commit the verified 67-line Phase 2 tree
FIRST as its own checkpoint (`4a39653`), then do the three follow-ups as a second commit. Rationale:
the cutover work was independently verified green, so it should be recoverable on its own; mixing
unverified follow-up edits into it would make a regression hard to attribute and would also mean the
migration history in the checkpoint did not match the verified DB state.

## Follow-up 1 — i18n gaps

**Scope:** `bill.*`, `nav.shippers`, `nav.consignees`, `topbar.switchToArabic` (all three locales).

- Key inventory was done mechanically, not from the report: namespace-aware scan of every
  `useTranslations('<ns>')` + `t('…')` pair in `apps/web/src`, plus dynamic template keys
  (`status.${…}`, `billType.${…}`, `freightTerms.${…}`) expanded against `BillStatus`/`BillType`/
  `FreightTerms` in `packages/shared/src/bill.ts`, plus the dynamic `t(item.labelKey)` path in
  `sidebar.tsx` against the 40 `labelKey`s in `lib/navigation/nav.ts`.
- Result: **84 `bill.*` keys** + `nav.shippers` + `nav.consignees` + `topbar.switchToArabic` = **87
  keys per locale**, missing in ALL of en/fa/ar (verified `bill` namespace absent entirely;
  `nav.shippers/consignees` absent; `topbar.switchToArabic` absent while its two siblings existed).
- Wording mirrored the sibling namespaces that share the same page shape (`invoice`, `discharge`,
  `manifest`) so terminology stays consistent — e.g. `list.empty.*`, `confirm.delete.*`,
  `detail.saving`, `Notify party` = `طرف اطلاع‌رسانی` / `الجهة المُخطَرة`. The 3 ICU strings keep
  their exact placeholders: `list.description {count}`, `create.manifestInfo {items}`+`{weight}`,
  `detail.issuedOn {date}`.
- Scripted insert (throwaway, deleted) preserved file encoding and ordering: round-trip proof that
  `json.dumps(..., ensure_ascii=False, indent=2) + '\n'` reproduced each file byte-for-byte BEFORE
  the edit; diff afterwards is **125 added lines / 0 deleted per locale** (pure addition).
- Verified: 84/84 `bill` keys match the source-of-truth dict in all 3 locales; `bill` and `topbar`
  fully key-parity across locales; the 19 pre-existing `ar`-only keys are all absent at HEAD too
  (zero new asymmetry introduced by this change).

## Follow-up 2 — portal fallback shim removal

**Scope:** remove the legacy `portalCustomerId` leg from manifest scoping.

Safety analysis before editing (why removal is now safe, and the one trap):
- `manifests.agentId` FKs `agents` (cutover migration) → a Customer id can never match a manifest
  agent; the Customer leg was dead code, not a safety net.
- Live proof: `portal users with portalCustomerId but no portalAgentId = 0`; `Customer.id ∩ Agent.id
  = 0 rows`; `manifests whose agentId points at a Customer = 0`.
- **The trap:** naively throwing "not linked" when `portalAgentId` is null would break `/portal/me`
  for a Customer-only portal user (403 instead of a legitimate empty manifest list) — bookings and
  the statement are Customer-scoped and must keep working. So the resolver keeps the 403 for a user
  linked to *neither* (same message as before) and returns an **empty scope** for customer-only.
- Code: `portalManifestScopeIds()` now returns `[portalAgentId]` or `[]`; the two call-site comments
  in `me()` and `shipments()` were rewritten (they still said "removed by the cutover unit", which
  the cutover did not do — deviation 1 of that log).
- Tests: 3 stale comments in `portal.e2e-spec.ts` corrected; **+1 regression test**
  (`customer-only portal user -> 200 me with 0 manifests, empty shipments (no 403)`) pinning exactly
  the trap above. Fixture name caught during writing: company C is `Agent Gamma`, not `Agent C`.
- Portal suite **14/14** (13 pre-existing + 1 new).

## Follow-up 3 — migration-replay completeness

**Reported scope:** `agent_destinations` exists in no migration. **Actual finding (wider):**

Authoritative check `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel
prisma/schema.prisma` against a throwaway shadow DB reported the replay gap as **6 missing tables**
(`agent_destinations`, `NumberingSequence`, `AuditLog`, `FileAttachment`, `DocumentTemplate`,
`DocumentTemplateVersion`), 4 enum mismatches, 9 `Cargo` columns, 1 `LoadListItem` column, and
model-name-vs-mapped-name constraint/index naming drift. The live DB has all 51 tables (it was
`db push`ed historically) — the gap is purely in migration *history*, which is what breaks a fresh
deploy.

- Migration `20260930180000_replay_completeness` — every statement guarded so it is a near no-op on
  this live DB but corrective on a fresh replay:
  - `CREATE TABLE/INDEX IF NOT EXISTS` for the 6 tables, DDL copied verbatim from `migrate diff`;
  - enum fixes that only run when the label set actually differs (pg_enum comparison, not
    best-effort): `LoadListItemSelectionStatus` created, `LoadListStatus` +3 values,
    `ActualLoadingStatus`/`CargoStatus`/`InspectionStatus` rebuilt with defaults dropped/restored;
  - `ADD COLUMN IF NOT EXISTS` for the 9 Cargo columns + `LoadListItem.selectionStatus`;
  - constraint/index renames `Agent_*`→`agents_*`, `Shipper_*`→`shippers_*`,
    `Consignee_*`→`consignees_*`, `AgentDestination_*`→`agent_destinations_*` (rename only when the
    legacy name exists and the canonical one does not);
  - `agent_destinations` FKs repaired to canonical names + `ON UPDATE CASCADE`; `Cargo` party FKs
    repaired to `ON UPDATE CASCADE` **only when the definition is actually wrong** (the cutover
    migration had copied the pre-existing live definition without it).
- **Self-found defect during verification:** first shadow replay failed with `42883 operator does
  not exist: "InspectionStatus_new" = "InspectionStatus"`. Root cause: the partial unique index
  `Inspection_one_pending_per_cargo_idx` (`WHERE status = 'PENDING'::"InspectionStatus"`) has to be
  rewritten during the type swap and cannot compare old enum to new. Fixed by dropping that index
  before the swap and recreating it after. This is precisely why the migration was replay-tested
  rather than only deployed.
- **Verification:**
  - fresh replay (`migrate deploy` onto an empty scratch DB): all 32 migrations apply cleanly;
  - `migrate diff --from-url <replay> --to-schema-datamodel prisma/schema.prisma` → **"This is an
    empty migration" (zero diff)** — a fresh replay now reproduces `schema.prisma` exactly;
  - live: `migrate status` **32 migrations, up to date**; `prisma validate` valid;
  - live drift vs schema shrank **99 → 15 lines**, and the remaining 15 are 5 `DROP INDEX` for
    pre-existing extra indexes (`Cargo_cargoValue_idx`, `Cargo_cargoValueCurrency_idx`,
    `Cargo_jobId_idx`, `LoadListItem_loadListId_selectionStatus_idx`,
    `LoadListItem_selectionStatus_idx`) that exist on live but are declared in no schema — left
    alone deliberately (dropping live indexes is not replay completeness and is not approved scope);
  - row counts after deploy unchanged: `agent_destinations 0`, `NumberingSequence 227`,
    manifests 4 / bills 2 / cargo 33 / masters 0/0/1.
- Shadow and scratch DBs dropped; all `scripts/tmp-*` deleted.

## Verification after all three follow-ups

- **e2e (full run, JSON):** 308 tests / **233 passed** / **75 failed** — vs baseline 307/232/75.
  Diff vs the recorded baseline failure set: **0 new failures, 0 baseline failures fixed, failing
  suite set identical** (actual-loading, bill, delivery-release, discharge, inspection, manifest —
  all the pre-existing `createRoleToken`/parallel-load ones). The +1 total and +1 passed are exactly
  the new portal regression test.
- `tsc --noEmit`: API **0** errors; web **3** (the pre-existing `[locale]/page.tsx` ones);
  `@shipping/shared` build exit 0.
- **UI gate re-run in the browser:**
  - `/en/bills` — renders real copy (`Bills of Lading`, columns `B/L NUMBER…CONSIGNEE`), **0 raw
    `bill.*` keys, 0 `MISSING_MESSAGE`, 0 console errors, 0 non-2xx**;
  - `/fa/bills` — `بارنامه‌ها`, columns `شماره بارنامه/وضعیت/نوع بارنامه/مانیفست/شناور/مسیر`, 0 raw keys;
  - `/ar/bills` — `بوالص الشحن`, columns `رقم البوليصة/الحالة/نوع البوليصة/…`, 2 rows, 0 raw keys;
  - sidebar shows `Shippers`/`Consignees` (no `nav.*` keys) in en and fa;
  - topbar language button title from `/en` = `العربية` (the `switchToArabic` key);
  - no `MISSING_MESSAGE` of any kind on any of the three pages.
- **Phase 2 original verification re-checked live:** `/shippers|/consignees|/agents?pageSize=100` →
  200; 4 manifests with `MAN-2609-00004.agentId = AGT-001` and all other party FKs null; unknown
  master id → **400** `Unknown shipperId: no live Shipper with id …` (all 3 fields, no row written,
  count stays 4); portal demo user → `/portal/me` 200 with `MAN-2609-00004` in shipments, admin →
  403; `migrate status` 32 up to date; `prisma validate` valid.
- Servers untouched by this work (still the user's own `pnpm dev`): API 200 / web 200.

```
EXECUTION_STATUS: COMPLETE
TASK: phase-2-followups (i18n gaps, portal shim removal, replay completeness)
PHASE: Phase 2 — follow-ups approved with the cutover review
DB_MIGRATION_STATUS: applied — 20260930180000_replay_completeness; migrate status 32 migrations, up to date;
  prisma validate valid; fresh replay of all 32 migrations reproduces schema.prisma with ZERO diff
  (verified against a scratch DB, since dropped); live drift vs schema 99 -> 15 lines (remaining =
  5 pre-existing live-only indexes, declared in no schema, deliberately untouched)
UI_GATE: PASS — /en|/fa|/ar/bills render real copy with 0 raw bill.* keys, 0 MISSING_MESSAGE, 0 console
  errors, 0 non-2xx; sidebar Shippers/Consignees labels resolve; topbar language title = العربية;
  /en/bills columns B/L NUMBER…CONSIGNEE; /fa بارنامه‌ها; /ar بوالص الشحن with 2 rows
SCHEMA_CHANGES: none (migration only — 6 tables + enums + columns + constraint/index naming brought
  into line with the EXISTING schema.prisma; no model edits)
CODE_CHANGES: portal.service.ts portalManifestScopeIds() drops the legacy portalCustomerId leg
  (keeps 403 for "linked to neither", empty scope for customer-only); 2 call-site comments rewritten;
  3 stale comments corrected in portal.e2e-spec.ts
TEST_CHANGES: +1 portal regression test (customer-only user -> 200 me with 0 manifests, empty
  shipments, no 403); full run 308 / 233 passed / 75 failed = baseline set with 0 new failures,
  0 fixed, identical failing suites
TRANSLATION_CHANGES: +87 keys per locale in en/fa/ar (84 bill.* + nav.shippers + nav.consignees +
  topbar.switchToArabic); 125 added lines per locale, 0 deleted; bill/topbar key parity across locales;
  no new asymmetry (the 19 pre-existing ar-only keys are all absent at HEAD too)
GIT_VERIFICATION: commit 1 = 4a39653 (verified 67-line Phase 2 tree, 132 files, code-graph cache
  excluded via .gitignore); commit 2 = this follow-up set (see report)
NEEDS_BUSINESS_DECISION: none
BLOCKED: none
REMAINING_NON_BLOCKING: (a) 5 live-only indexes declared in no schema (dropping them is a live-DB
  decision, out of scope); (b) 19 ar-only keys + 6 ar-only topbar/nav siblings pre-existing at HEAD;
  (c) `manifest.dto.ts:35` still reads "Shipper customer ID (legacy shipper)" (stale Swagger text);
  (d) 75 pre-existing e2e failures from the createRoleToken/inspection parallel-load root causes
HANDOFF_TO: decision-maker (review + commit confirmation)
```
