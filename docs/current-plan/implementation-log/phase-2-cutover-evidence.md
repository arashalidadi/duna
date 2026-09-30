# Phase 2 — Party-model cutover evidence pack — implementation log

**Task ID:** phase-2-cutover-evidence
**Roadmap:** Phase 2 / B/L–Manifest party cutover (pre-planning evidence step)
**Type:** READ-ONLY. No code, schema, migration, API, UI, test or translation changes.

## Deliverables

- `docs/current-plan/party-cutover-evidence-pack.md` — six sections, every claim cited to
  `file:line` or a verbatim query result:
  1. Schema inventory (8 scope models; FK targets; nullability; `deletedAt` interplay; migration-vs-DB drift note for `Cargo.shipperId/consigneeId` — present in schema + live DB, absent from every migration file).
  2. Code inventory (Cargo/Manifest/Bill services + DTOs + controllers, value source per line: payload / derived-from-manifest / derived-from-JWT; related modules: delivery-release, portal; zero hits in load-planning/actual-loading/discharge).
  3. Document inventory (no PDF/print template files exist; party names rendered in `bills`, `manifest`, `delivery-orders` pages; field sources traced to API selects).
  4. Data inventory (live DB): Cargo 0/33 party refs; manifests 4/3/1 shipper/consignee/agent; bills 2/2; 3 distinct Customers referenced; **0/12 references match any new master** (heuristic: normalized name, taxId fallback, code suffix — taxId unusable because 0 Customers have one); masters nearly empty (0 shippers, 0 consignees, 1 unreferenced Agent); 0 soft-deleted parents referenced.
  5. UI inventory (Manifest selects load `/customers` only; B/L has free-text `notifyParty` only; Cargo has no party field; D/O recipient free text).
  6. Test inventory (6 tests pin Customer→party wiring, 8 assertions pin Cargo→masters; no web tests; no master-module e2e; stale permission comment at `cargo-inventory.e2e-spec.ts:85-88` documented).

## Method / evidence handling

- Baseline captured before work: `git status --porcelain` = 54 lines at HEAD `2b89e38`, saved to `/tmp/git_before_evidence.txt`.
- Read-only probes: file reads with line numbers, `grep`/`awk` scans, migration SQL greps, and read-only `information_schema` + aggregate `SELECT` queries via throwaway `scripts/tmp-ev-*.cjs` scripts.
- All probe scripts deleted after use (`no tmp scripts left`); mid-task `git status` diff against baseline → `NO CHANGE vs baseline`.
- Final verification: `git status --porcelain` diff vs baseline shows **only the two new docs** (evidence pack + this log) added as untracked files; zero modifications to source, schema, migrations, tests, translations.

## Notes

- No doc-consultation or design decisions were required (evidence task only).
- One stale in-repo claim recorded as a fact in §6.2: `cargo-inventory.e2e-spec.ts:85-88` says `shipper:*` permissions are absent; live `Permission` table contains `shipper:read/create/update/delete` (and `consignee:*`, `agent:*`).

---

```
EXECUTION_STATUS: COMPLETE
TASK: phase-2-cutover-evidence
PHASE: Phase 2 / B/L–Manifest party cutover (evidence step)
DB_MIGRATION_STATUS: none
UI_GATE: NOT APPLICABLE — read-only task, no UI component
SCHEMA_CHANGES: none
CODE_CHANGES: none
TEST_CHANGES: none
TRANSLATION_CHANGES: none
DELIVERABLE: docs/current-plan/party-cutover-evidence-pack.md (6 sections, all claims cited)
GIT_VERIFICATION: only the two new docs added; no modified tracked files vs baseline (54-line baseline diff)
NEEDS_BUSINESS_DECISION: none (evidence only)
BLOCKED: none
HANDOFF_TO: decision-maker (cutover plan drafting)
```
