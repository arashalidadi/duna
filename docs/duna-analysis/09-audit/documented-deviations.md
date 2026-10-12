# Documented deviations

**Created 2026-10-12** (Phase 1). `initial-roadmap.md` requires the REQ-001 six-vs-ten navigation
discrepancy to be recorded as a documented deviation, with no deletion. This file is that record.

A *documented deviation* is a place where the verified implementation differs from an explicit
requirement. It records the measured facts, the decision taken and its status. Recording a deviation
does **not** change the implementation.

---

## D-NAV-01 · Navigation has ten top-level sections where REQ-001 requires six

| | |
| --- | --- |
| **Requirement** | REQ-001 (source EMP-185; `requirements-catalog.md` line 26): "The dashboard sidebar has exactly **six** top-level sections, in this order: Overview, Operations, B/L & Manifest, Accounting, Master Data, Access Control." |
| **Measured implementation** | **10** top-level sections and **39** navigation items, measured 2026-10-12 on commit `b0e2682` from `apps/web/src/lib/navigation/nav.ts`. `NAV_SECTION_ORDER` lists the same 10 keys. |
| **Decision** | **Preserve the discrepancy and document it. Do not delete existing navigation.** Recorded as a design decision in `question-reconciliation.md` Q-AUD-15 and `audit-findings.md` AUD-021. |
| **Status** | **Documented deviation, not resolved.** Traceability status 🟡 Phase 9 (`requirements-traceability.md` line 134). |
| **Implementation fact** | The sidebar renders each section as a collapsible accordion (`apps/web/src/components/layout/sidebar.tsx`, `NavGroup`, `aria-expanded`). It is not a flat menu. |

### Required sections against implemented sections

| Required (REQ-001) | Implemented section | Items (current) |
| --- | --- | --- |
| Overview | `overview` ✅ | 1 (`dashboard`) |
| Operations | `operations` ✅ | 15 |
| B/L & Manifest | none with this name ❌ | `manifest` and `billOfLading` sit inside `operations` |
| Accounting | none with this name ❌ | `invoices`, `vouchers` and `ledger` sit inside `commercial` |
| Master Data | `masterData` ✅ | 6 |
| Access Control | `accessControl` ✅ | 3 |

### Implemented sections beyond the six

| Section | Items | Basis recorded in the audit |
| --- | --- | --- |
| `commercial` | 8 | Not named in REQ-001. Q-AUD-15 does not give a separate basis. |
| `people` | 2 | Q-AUD-15 cites the employer's request for Salary. |
| `correspondence` | 1 | Q-AUD-15 cites the employer's request for Letters. |
| `portal` | 1 | Q-AUD-15 cites the employer's request for the Agent Portal. |
| `administration` | 1 | Not named in REQ-001. Q-AUD-15 does not give a separate basis. |
| `insightControl` | 1 | Q-AUD-15 cites the employer's request for Reports. |

### Corrections to the earlier record (additive, 2026-10-12)

- `question-reconciliation.md` Q-AUD-15 lists `accessControl` among the sections *added* beyond
  REQ-001. That is incorrect. `accessControl` is one of the six required sections (Access Control).
  The count of extra sections is six, not seven.
- Q-AUD-15 gives a basis only for four of the six extra sections. The basis for `commercial` and
  `administration` is not recorded anywhere in the audit and is not invented here.
- The stale `planned` "Agent portal" entry that Q-AUD-15 says should be removed was removed in
  Phase 1 (commit `b0e2682`). The `portal` section still holds the implemented `/portal` entry.

### Consequences

1. **No implementation change is made or required by this record.** Merging or removing sections is a
   product decision for the owner, not a Phase 1 correction.
2. Reconciling the deviation, for example by restructuring the sidebar to the six named sections, is a
   UI change. It belongs to the owner's decision in Phase 9.

### How this was measured (reproducible)

- Section count: `grep -c "titleKey:" apps/web/src/lib/navigation/nav.ts` returns 11. One match is the
  type declaration `titleKey: string;` on line 51, so the real count is **10**.
- Per-section item counts: count `labelKey:` entries between consecutive `titleKey:` entries, excluding
  `//` comment lines. Result: overview 1, accessControl 3, administration 1, operations 15,
  commercial 8, people 2, correspondence 1, portal 1, masterData 6, insightControl 1 = **39**.
