# 08 — Original Sources

> **Nothing has been moved here.** The standing instruction was: *do not delete, move or rewrite
> existing project docs; preserve originals.* This directory therefore contains **only a pointer**.

## Where the originals actually live

| Original | Location | Files | Size |
|---|---|---|---|
| Persian employer transcripts | [`../requirements/`](../requirements/) | 20 `.txt` | 94 KB |
| Real company documents | [`../documents/`](../documents/) | 7 `.pdf` | 1.9 MB |
| Legacy Laravel archive | [`../legacy-source/duna-clean.zip`](../legacy-source/duna-clean.zip) | 1 | 16.9 MB |
| Legacy prior analysis | [`../legacy-source/docs-legacy/`](../legacy-source/docs-legacy/) | 5 `.md` | — |
| Prior AI analyses | [`../existing-analysis/`](../existing-analysis/) | 3 `.md` | 78 KB |
| Source-pack summary | [`../docs-summary.md`](../docs-summary.md) | 1 | 55.8 KB |

## Why they were not consolidated into one directory

1. Moving them would break every existing reference in the repository.
2. Their current locations are already cited by `docs/current-plan/` and by this knowledge base.
3. The instruction was to preserve originals, not relocate them.

## Classification for future cleanup

| Location | Class | Rationale |
|---|---|---|
| `../requirements/` | **KEEP** | Irreplaceable primary evidence |
| `../documents/` | **KEEP** | Irreplaceable primary evidence |
| `../legacy-source/duna-clean.zip` | **KEEP** | 16.9 MB; the only record of the legacy system. Recommend **Git LFS** if clone size matters |
| `../legacy-source/docs-legacy/` | **REVIEW** | Prior analysis, demonstrably wrong in places |
| `../existing-analysis/` | **REVIEW** | Prior analysis. `duna_client_discovery_questions_v2.md` holds the only copy of the Q01–Q160 ID space — **never delete** |
| `../docs-summary.md` | **KEEP-DERIVED** | Superseded in depth, cheap to keep |

Full detail: [`../06-ai-reference/source-retention-plan.md`](../06-ai-reference/source-retention-plan.md).
