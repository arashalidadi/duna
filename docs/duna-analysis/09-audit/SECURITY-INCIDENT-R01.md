# SECURITY INCIDENT R-01 · Production credentials committed and published

**Status:** 🔴 **OPEN — NOT RESOLVED.** Reassessed and reclassified 2026-10-11.

**Classification:** Credential exposure · **Severity: CRITICAL** (reclassified upward from HIGH)

> **This document contains no credential values and must never contain any.**
> It records the location and the remediation path only. Do not paste secrets into this file, into an issue,
> into a commit message, or into any chat or log.

---

## 1 · Summary

An archive containing a **live production `.env` file** is committed to this repository and has been **pushed
to a public GitHub repository**. The credentials are publicly retrievable.

This was previously recorded as a *prospective* risk — the concern being that a broad `git add` might commit
the file in future. **Reassessment on 2026-10-11 established that this is wrong: the exposure has already
happened.** The risk is not hypothetical and is not mitigated by commit discipline.

---

## 2 · Findings (verified 2026-10-11)

| # | Finding | Verification |
| --- | --- | --- |
| F1 | The archive `docs/duna-analysis/legacy-source/duna-clean.zip` is **tracked in Git** | `git ls-files -s` → `100644 b2b99a8d…` |
| F2 | It is present in **commit `c997624`** ("docs: add Duna business analysis source pack"), which is HEAD and the base commit of this branch | `git cat-file -e HEAD:<path>` → exists |
| F3 | Committed size is **16.1 MB** (2,489 entries) | `git cat-file -s` |
| F4 | The archive contains a **production `.env`** at `duna-clean/duna/.env` | Archive index inspected — **entry name only; contents never opened, read or copied** |
| F5 | Commit `c997624` is **present on the remote** as `refs/heads/duna-analysis` | `git ls-remote --heads origin` |
| F6 | The repository `arashalidadi/duna` is **PUBLIC** (`isPrivate: false`) | `gh repo view --json isPrivate` |

**Consequence of F5 + F6:** the credentials are not merely in local history — they are **publicly
downloadable** by anyone, and have been since the commit was pushed. They must be treated as **fully
compromised**.

---

## 3 · What this invalidates in earlier documentation

The following statements were recorded in earlier audit documents and are **incorrect**. They are corrected
here rather than silently edited, because the correction changes the severity of the finding.

| Earlier statement | Correction |
| --- | --- |
| "The repository contains an **untracked** archive … Never run `git add -A`" | The archive is **tracked and committed** (F1, F2). Avoiding `git add -A` remains good hygiene but **does not mitigate this incident** — the exposure already occurred. |
| Risk severity **HIGH** | **CRITICAL** — public exposure, not local-only. |
| Mitigation: "use explicit paths when committing" | Insufficient. Explicit-path discipline prevents *future* secrets being added; it cannot retract one already pushed. |

**Files corrected:** `09-audit/README.md` §7.1 · `docs/README.md` §4 rule 5 · `09-audit/risk-register.md` R-01.

---

## 4 · Why this was not resolved as part of this task

Each possible remediation was considered and **rejected as out of scope or unsafe without authorization**:

| Option | Why not taken |
| --- | --- |
| Delete the archive | Expressly forbidden without authorization, and — because the commit is already public — **deleting the file now does not remove it from history or from the remote**. |
| Rewrite history (`filter-repo`, `rebase`) | Forbidden: no Git history modification. Also **ineffective**: the commit is public, may be forked, cached or cloned. Rotation is the only reliable remedy. |
| Force-push a cleaned branch | Forbidden, and would not retract already-cloned copies. |
| Scrub the values from the file | Would require opening and handling the credentials, which is expressly forbidden. |

**Therefore the only correct remaining action is rotation by the owner**, and this document exists to enable
that.

---

## 5 · Required remediation — owner-led

> **Assume the credentials are already known to third parties.** Rotation is not precautionary; it is
> necessary. Ordering matters: **rotate first, then clean up.**

### Step 1 — Rotate (immediate, highest priority)

1. **Treat every secret in `duna-clean/duna/.env` as compromised** — database credentials, app keys, mail
   credentials, API tokens, and any third-party service keys.
2. **Rotate each one at its provider**, not just in the file:
   - change the database password on the database server;
   - regenerate the application key/secret (**note: rotating an app key invalidates existing sessions and may
     invalidate encrypted data — plan for that, but do not let it delay rotation**);
   - revoke and reissue every API token and third-party credential.
3. **Review access logs** on every affected service for use that is not attributable to the company.
4. Do this **before** any cleanup. Cleaning the repository first creates a false sense of resolution while the
   live credentials still work.

### Step 2 — Contain

5. Decide whether the repository should remain public. If it must stay public, ensure no branch contains the
   archive.
6. Check for **forks and clones** — history rewriting cannot reach them.
7. Enable GitHub **secret scanning** and **push protection** on the repository.

### Step 3 — Clean up (after rotation)

8. Remove the archive from the working tree and purge it from history using a tool designed for the purpose
   (`git filter-repo` or BFG), then force-push and ask GitHub Support to expire cached views.
9. **Only after step 8**, confirm the object is no longer reachable — and still treat the old credentials as
   burned.
10. Add `*.zip` under `legacy-source/` and `.env` patterns to `.gitignore`, and add a pre-commit secret
    scanner so this cannot recur.

### Step 4 — Prevent recurrence

11. Pre-commit secret scanning (for example `gitleaks` or `trufflehog`) in CI and locally.
12. Never archive a directory containing `.env` into a file destined for a repository. If legacy source must be
    retained, **strip environment files first** and keep them in a secret store instead.

---

## 6 · Explicit non-actions (deliberate)

Recorded so nobody assumes they were overlooked:

- ❌ The archive was **not opened, extracted, read or copied** beyond listing entry names to confirm the
  `.env` filename.
- ❌ **No credential value** appears in this document or anywhere else in the documentation set.
- ❌ The archive was **not deleted**.
- ❌ Git history was **not modified**.
- ❌ Nothing was **committed or pushed**.

---

## 7 · Status and verification

| | |
| --- | --- |
| **Status** | 🔴 **OPEN** |
| **Resolved?** | **No.** Rotation has not been performed and cannot be performed by the implementation team. |
| **Mitigated by commit discipline?** | **No** — the exposure is already public. |
| **Reported to** | Documented here for the repository owner |
| **Blocking?** | It does **not** block planning or the start of P0. It **does** block any deployment that reuses the exposed credentials, and it should take priority over feature work. |

> ⚠️ **Do not treat this incident as closed on the basis that the credentials have not been committed *again*.**
> It closes only when the exposed credentials have been rotated at their providers and confirmed revoked.
