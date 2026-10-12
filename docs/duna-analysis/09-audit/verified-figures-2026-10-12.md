# Verified figures — measured from source, 2026-10-12

**Created 2026-10-12** (Phase 1, correction items E2–E4 and E7 in
[`README.md`](README.md) §5). Each figure below was measured from the repository on the date shown,
with the command used, so that any document can be checked against it. Other documents keep the figures
they recorded at their own date; a figure marked *as of* a date is not claimed for another date.

| Figure | Verified value | Command (run from the repository root) | As of |
| --- | --- | --- | --- |
| Prisma models | **52** | `grep -c '^model ' prisma/schema.prisma` | 2026-10-12 |
| Prisma enums | **32** | `grep -c '^enum ' prisma/schema.prisma` | 2026-10-12 |
| Feature modules under `apps/api/src/modules/` | **32** | `ls -d apps/api/src/modules/*/ \| wc -l` | 2026-10-12 |
| NestJS `@Module` classes (feature + infrastructure + app + Prisma) | **38** | `grep -rl '@Module(' apps/api/src \| wc -l` | 2026-10-12 |
| Controller files | **39** | `find apps/api/src -name '*.controller.ts' \| wc -l` | 2026-10-12 |
| Service files | **38** | `find apps/api/src -name '*.service.ts' \| wc -l` | 2026-10-12 |
| Web pages | **35** | `find apps/web/src/app -name 'page.tsx' \| wc -l` | 2026-10-12 |
| Seeded permission codes | **161** | unique `code:` entries in the `permissionSeed` array of `prisma/seed/core.ts` | 2026-10-12 |
| Distinct permission module values | **34** | distinct `module:` values in the same array | 2026-10-12 |
| Navigation top-level sections | **10** | `NAV_SECTION_ORDER` in `apps/web/src/lib/navigation/nav.ts` | 2026-10-12 |
| Navigation items | **39** | `labelKey` entries per section, excluding comment lines | 2026-10-12 |
| API e2e suite files | **22** | `ls apps/api/test/*.e2e-spec.ts \| wc -l` | 2026-10-12 |
| Knowledge-base files / lines (E7) | 45 files / 11,536 lines | as recorded in [`README.md`](README.md) §5 | 2026-10-11 (not re-measured) |

## Notes on the figures

- **161 codes / 34 modules.** The figure "160 codes / 33 modules" was correct on 2026-10-11. The `audit`
  permission module was added in commit `66628c3` on 2026-10-12, which made it 161 / 34. Both statements
  are dated, and neither is an error.
- **32 feature modules vs 38 `@Module` classes.** "32 API modules" counts the feature directories. The
  38 `@Module` classes also include the app module, five infrastructure modules (attachment, audit,
  numbering, storage, document templates), the Prisma module and the health module.
- **Reference data seeded without demonstration data:** the required seed creates only settings,
  currencies, permissions, roles, ports, yards and the administrator (`prisma/seed/core.ts`). Cargo,
  customers, vessels, voyages, load lists and inspections are written only by `prisma/seed/demo.ts`,
  which runs only when `SEED_DEMO_DATA` is exactly `true`.
- **E6 (paragraph-index drift, 720 paragraphs vs 725 cited indices):** not corrected in place. The employer
  evidence file is not edited to fit an index, because recorded evidence is never silently overwritten. The
  drift stays recorded in [`README.md`](README.md) §5 with its original wording. Its effect on any
  requirement has not been assessed.
