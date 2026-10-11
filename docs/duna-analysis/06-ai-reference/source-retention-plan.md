# Source Retention & Cleanup Plan

> Phase 12. **Classification only — nothing has been deleted, moved or rewritten.**
>
> Per the standing instruction: *do not delete/move/rewrite existing project docs; preserve originals;
> only classify for future cleanup, never delete without approval.*

---

## 1. What exists today

| Path | Files | Size | Nature |
|---|---|---|---|
| `requirements/` | 20 `.txt` | 94 KB | Persian transcripts — **primary source** |
| `documents/` | 7 `.pdf` | 1.9 MB | Real company documents — **primary source** |
| `legacy-source/duna-clean.zip` | 1 | 16.9 MB | Legacy Laravel application — **primary source** |
| `legacy-source/docs-legacy/` | 5 `.md` | — | Prior analysis of the legacy system |
| `existing-analysis/` | 3 `.md` | 78 KB | Prior AI analyses |
| `docs-summary.md` | 1 | 55.8 KB | Summary shipped with the source pack |
| **Analysis written for this knowledge base** | 46 `.md` | ~16,000 lines | Derived |
| **Total** | **83 files** | **19 MB** | |

---

## 2. Classification

| Class | Meaning | Disposition |
|---|---|---|
| **KEEP** | Primary evidence. Irreplaceable. | Keep in the repo permanently |
| **KEEP-DERIVED** | Our own analysis. Regenerable from KEEP, but expensive to regenerate. | Keep |
| **REVIEW** | Prior analysis of unknown reliability. | Keep, but mark as unverified |
| **ARCHIVE-CANDIDATE** | Superseded and no longer load-bearing. | **Proposal only** — needs approval |
| **EXCLUDE** | Must never be committed | N/A — nothing here |

### 2.1 Detailed classification

| Path | Class | Rationale |
|---|---|---|
| `requirements/*.txt` (20) | **KEEP** | The employer's own words. Irreplaceable. Everything in `01-employer-statements/` cites `EMP-*` IDs that only make sense against these files |
| `documents/*.pdf` (7) | **KEEP** | The only real company documents available (**SRC-07** means the original templates are missing). Every format claim traces to these |
| `legacy-source/duna-clean.zip` | **KEEP** | 16.9 MB. The only record of what the company actually used. **Never executed** — a future agent with `/vendor` could run it |
| `legacy-source/docs-legacy/*.md` (5) | **REVIEW** | Prior analysis, demonstrably wrong in places (see `04-business-analysis/prior-analysis-review.md` §4.1). Keep as a cross-check, mark unverified |
| `existing-analysis/*.md` (3) | **REVIEW** | Prior analyses. `duna_client_discovery_questions_v2.md` is the **only** copy of the Q01–Q160 ID space — irreplaceable for that reason alone |
| `docs-summary.md` | **KEEP-DERIVED** | 55.8 KB summary; superseded in depth by this knowledge base but cheap to keep |
| `01-employer-statements/*.md` (7) | **KEEP-DERIVED** | Includes the 113 KB verbatim statement file — the English record of the transcripts. Regenerable only by re-translating 20 Persian files |
| `02-business-documents/*.md` (6) | **KEEP-DERIVED** | Regenerable only by re-extracting the PDFs (which needed PyMuPDF + OCR) |
| `03-legacy-laravel-system/*.md` (11) | **KEEP-DERIVED** | 2,161 lines. Regenerable only by re-reading 199 PHP/Blade files |
| `04-business-analysis/*.md` (6) | **KEEP-DERIVED** | The synthesis. The contradictions register is the hardest part to recreate |
| `05-current-project/*.md` (5) | **KEEP-DERIVED** | Will go stale; see §4 |
| `06-ai-reference/*.md` | **KEEP-DERIVED** | Small |
| `07-traceability/*.md` (2) | **KEEP-DERIVED** | The traceability matrix is the index to everything |

### 2.2 Nothing is classified EXCLUDE

No file in `docs/duna-analysis/` contains secrets. Credentials found in the legacy archive
(`.env` references, SMS gateway settings) were **deliberately not recorded** anywhere in this
knowledge base.

---

## 3. Size considerations

| Concern | Assessment |
|---|---|
| **19 MB total** | Acceptable for a documentation directory |
| **`duna-clean.zip` at 16.9 MB is 89% of it** | The single meaningful size decision |
| Git history | Binary ZIPs do not delta-compress. If this repo is cloned frequently, consider Git LFS |

### 3.1 Options for the ZIP (all require approval)

| Option | Pros | Cons |
|---|---|---|
| **A. Keep as-is** (recommended) | Simple, self-contained, reproducible | 16.9 MB in every clone |
| **B. Git LFS** | Keeps the working tree light | Requires LFS on every machine; changes the clone workflow |
| **C. Move to external storage, keep a pointer + checksum** | Lightest | Breaks self-containment; the analysis could not be re-verified without fetching |
| **D. Delete** | Lightest | ❌ **Not recommended and not approved.** The archive is the only record of what the company actually used, and it has never been executed — a future agent may need to run it |

**Recommendation: Option A.** 16.9 MB is a small price for keeping the evidence verifiable.

---

## 4. What will go stale, and how to handle it

| File | Staleness risk | Mitigation |
|---|---|---|
| `05-current-project/*` | **High** — the project ships a phase every few days | Date-stamped; tied to ADR numbers, not line numbers. Re-verify at each phase close |
| `07-traceability/requirements-traceability.md` (Current column) | **High** | Update at each phase close (maintenance plan §3) |
| `03-legacy-laravel-system/*` | **None** — the legacy system is frozen | — |
| `01-employer-statements/*`, `02-business-documents/*` | **Low** — only change if new evidence arrives | — |
| `04-business-analysis/consolidated-business-model.md` | **Medium** — changes if the employer clarifies | Update per maintenance plan §2 |

---

## 5. Rules for any future cleanup

1. **Never delete a primary source** (`requirements/`, `documents/`, `duna-clean.zip`).
2. **Never delete `existing-analysis/duna_client_discovery_questions_v2.md`** — it holds the only
   copy of the Q01–Q160 ID space.
3. **Never rewrite a prior analysis** to make it correct. Mark it superseded and point to the
   correction.
4. **Never delete a superseded analysis** — append a "superseded by" note.
5. **Before deleting anything**, check `07-traceability/source-inventory.md`: if a file is cited
   there, it is load-bearing.
6. **Ask first.** No deletion without explicit approval.

---

## 6. If the sources must move

If a future cleanup relocates `docs/duna-analysis/`, update:

- Every relative link in the 46 analysis files (they use `../0N-*` relative paths).
- `README.md` §2 (directory map).
- `07-traceability/source-inventory.md` (source locations).
- The greppable ID spaces are path-independent and will survive.

**Keeping the directory where it is is strongly preferred.**
