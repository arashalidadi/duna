# Contradictions Register

> Every place where two or more sources disagree.
>
> **Rule: contradictions are recorded, never silently resolved.** Each entry states the competing
> claims, the evidence for each, a *provisional* reading (clearly labelled as such), and the question
> that must be put to the employer.
>
> Severity key: **B** = blocks implementation · **H** = high (visible wrong behaviour) ·
> **M** = medium · **L** = low / cosmetic.

---

> ## ⚠️ Corrections applied 2026-10-11 (see `09-audit/README.md` §5)
>
> Three entries have changed status. The affected entries carry an inline note; the summary table below
> has been adjusted to match.
>
> | Entry | Change |
> |---|---|
> | **C-07** | **WITHDRAWN** — the claimed real voucher `DSR/26-190` is **fabricated**; it appears in no extracted document, transcript or legacy source. The real receipt voucher is **No. 477**, plain numeric (allocation references `1517`, `1526`, `Advance 477`). There is therefore no `DSR` series to reconcile against the legacy three-series scheme. This is error **E1**; the same string propagated into 8 further files. |
> | **C-17** | **RE-FRAMED** — not a contradiction between two sources. It is a **legacy defect** (hard-coded `VESSEL = DUNA SHIPPING LLC`), correctly identified. The analysis text was right; only its severity framing as a *source conflict* was misleading. No change to the finding. |
> | **C-22** | **RESOLVED** — `/home/duna/dunaData/` is a **stale historical path**. Employer materials are present at `docs/duna-analysis/requirements/` (20 `.txt` transcripts). Source gap **SRC-01 is withdrawn**; it never blocked verification because the inventory reconciles to present files. |
>
> **Note on counts.** The severity table below is retained as originally published; its totals were
> already internally inconsistent (the **H** row listed 10 IDs while claiming 12). Corrected totals, with
> C-07 withdrawn: **B** = 3, **H** = 12, **M** = 7, **L** = 1. The authoritative per-entry dispositions are
> in `09-audit/question-reconciliation.md`.

---

## 1. Numbering

### C-01 · B/L number format — **B**
| Source | Claim |
|---|---|
| Employer (spoken, `EMP-544`) | `KHS/26-2/2026` — destination abbrev / yy-seq / yyyy |
| Employer (spoken, `EMP-546`) | `RJS/26-10` — destination abbrev / yy-seq |
| Real document (`BL-1X D155A …pdf`) | `KHS/26-110` |
| Real manifest (`DSMAN/KHO-26-006`) | carries `KHS/26-110` … `KHS/26-139` — a **3-digit** sequence |
| Real invoice (`DSINV/26-172`) | references `KHS/26-108` |
| Legacy code (`generateBLNumber`) | `{port.abb}/{yy}{mm}{dd}` → e.g. `KHS/20261104` |

**Analysis.** Four shapes. The real documents are the strongest evidence and they agree with each
other: `<DEST>/<yy>-<seq3>`. The employer's spoken examples are probably improvised (he produced
three different customer-code examples in one breath too — see C-11). The legacy format is
date-based and unrelated.

**Provisional reading (INFERRED, not confirmed):** `<DEST-ABBREV>/<yy>-<seq>`, sequence per
destination per year, zero-padded to 3 digits. Matches `REQ-102`.

**Question for the employer:** show him `KHS/26-110` and `KHS/26-108` and ask whether these are his
numbers and what the sequence resets on.

---

### C-02 · Manifest number format — **B**
| Source | Claim |
|---|---|
| Real manifest | `DSMAN/KHO-26-006` |
| Real invoice reference | `DSKHS-26-005` |
| Legacy code (`generateManifestNumber`) | `{port.abb}/{rand6}{dd}{mm}{yyyy}` → e.g. `KHO/4829132026` — **random** |

**Analysis.** Two real formats differ from each other in prefix shape (`DSMAN/KHO-` vs `DSKHS-`),
which suggests either two series or an inconsistency in the company's own documents. The legacy
format is random and shares nothing with either.

**Provisional reading:** at least one manifest series exists of the form
`DSMAN/<DEST>-<yy>-<seq3>`. `DSKHS-26-005` is either an older series or a typo. **Unresolved.**

**Question:** is `DSKHS-26-005` the same series as `DSMAN/KHO-26-006`?

---

### C-03 · Invoice number — **H**
| Source | Claim |
|---|---|
| Real invoice | `DSINV/26-172` |
| Legacy code (`getinvoiceCode`) | `DSAED/{rand6}` — random, wrong prefix |
| Prior analysis (`duna_source_pack.md` §4.4) | "Invoice code sequential" |

**Analysis.** The prior analysis is simply wrong about the legacy code — the generator uses
`rand(111111, 999999)`. The real prefix is `DSINV`, not `DSAED`.

**Provisional reading:** `DSINV/<yy>-<seq3>`. **Do not port the legacy format.**

---

### C-04 · Proforma prefix — **M**
| Source | Claim |
|---|---|
| Real proforma | `DSPRO/26-001` |
| Legacy code (`getPerformaNumber`) | `SDPRO/…` — the first two letters are **transposed** |

**Provisional reading:** `DSPRO/<yy>-<seq3>`. The legacy transposition is a typo in the generator.

---

### C-05 · Voyage counter keying — **H**
| Source | Claim |
|---|---|
| Employer (`REQ-041`) | Voyage is numbered per **vessel + destination** |
| Legacy code (`generateVoyage($shipper,$port)`) | Voyage counter keyed on **port + shipper** |

**Analysis.** Direct contradiction. The legacy keying is defect **D12**.

**Provisional reading:** follow the employer — vessel + destination.

---

### C-06 · Customer code format — **M**
| Source | Claim |
|---|---|
| Employer, one breath (`EMP-207`…`EMP-233`) | `CUST 3-3-1`, `CUST 3SF-2`, `CUST 2SF-1 / 3SF-1…N`, `CUST 3.1 / 3.2 / 3.3` |
| Legacy code | `CUST00{id+1}` |

**Analysis.** Four incompatible examples from the employer in a single explanation. The substantive
requirement is clear: a system-generated, sequential, prefixed code (`REQ-014`). Only the **string
format** is open. The legacy format is unrelated.

**Provisional reading:** keep the format in a seeded `NumberingSequence` so it can be changed without
code. **Do not hard-code any of the four.**

---

### C-07 · ~~Receipt voucher series~~ — **WITHDRAWN (2026-10-11)**
| Source | Claim |
|---|---|
| Real voucher | ~~`DSR/26-190`~~ → **corrected: Voucher No. `477`, plain numeric** |
| Legacy code | a three-series scheme; the receipt series in our specimen is `DSAO/26-097` |

**Analysis — CORRECTED.** The string `DSR/26-190` is **fabricated**. It appears in no extracted document, in no
transcript, and in no legacy source. The real receipt voucher in the sample set is **No. 477**, a plain
sequential number, and its allocation references are `1517`, `1526` and `Advance 477`. This entry was derived
from that false premise and is therefore **withdrawn as a contradiction**: there is no `DSR` series to
reconcile against the legacy three-series scheme.

**Residual open item.** That the voucher series is plain numeric is confirmed by one specimen. The format is
configurable data, so a wider sample can be adopted without migration.

**Correction scope.** The same fabricated string propagated into 8 further files. See
`09-audit/README.md` §5 (error **E1**) for the authoritative correction list; `09-audit/target-documents-and-configuration.md` §3 for the verified numbering samples.

---

## 2. Process order and structure

### C-08 · Manifest vs B/L creation order — **B**
| Source | Claim |
|---|---|
| Employer (`EMP-024`–`EMP-027`, `EMP-567`, `EMP-568`) | **B/L first**; the manifest is a consolidation of issued B/Ls |
| Legacy code (`ManifestController@createbl`) | **Manifest first**; B/Ls are created *against* a manifest and inherit vessel, voyage and parties |
| Current project (`ADR-045`, `ADR-047`) | Manifest is a downstream consolidation of **approved** B/Ls — i.e. the employer's order |

**Analysis.** This is the single most consequential structural contradiction in the whole knowledge
base. The employer and the current project agree; the legacy system disagrees.

**Provisional reading:** the employer is right, and the current project has already adopted his
order. **Do not re-import the legacy nesting.**

---

### C-09 · Party ownership on B/L vs Manifest — **H**
| Source | Claim |
|---|---|
| Employer | Parties are per B/L |
| Legacy code | Parties are set at **manifest** level and default onto B/Ls |
| Real manifest | Rows carry **both** shipper and consignee per B/L row — so parties are effectively per B/L |

**Analysis.** The real document supports the employer. Legacy inheritance is a convenience that
breaks the co-loading case.

**Provisional reading:** parties per B/L. This is what makes the partner-B/L requirement
(`REQ-107`) implementable.

---

### C-10 · Management approval gate on cargo — **M**
| Source | Claim |
|---|---|
| Legacy code | `admin_status: PENDING → APPROVED`, with its own permission `loadings.adminapprove` |
| Employer | **Never mentioned** any approval step on cargo intake |

**Analysis.** Legacy-only behaviour. The employer's flow goes straight from intake to inspection.

**Provisional reading:** **legacy-only.** Do not carry it into the new system unless the employer
asks for it. Note that the current project *does* have an approval concept for B/Ls before manifest
consolidation (`ADR-047`) — that is a different gate and is consistent with the employer's
draft→final B/L lifecycle.

---

## 3. Financial

### C-11 · Invoice VAT arithmetic — **H**
| Source | Claim |
|---|---|
| Legacy code (`invoices/view.blade.php`) | Footer renders `vatamount + subtotal` |
| `invoiceitems` semantics | `subtotal` **already includes** VAT (each line's VAT is added into the line amount) |
| Real invoice `DSINV/26-172` | Sub Total 27,370.00 · VAT 0.00 · Total 27,370.00 |
| Employer (`REQ-144`) | VAT is a percentage per line |

**Analysis.** The legacy footer **double-counts** VAT whenever VAT is non-zero. The specimen cannot
disprove it because its VAT is zero — but the specimen *does* prove that `Total = Sub Total` when
VAT is zero, which is the double-count's degenerate case.

**Provisional reading (verified arithmetic):**
```
lineNet    = unit × qty
lineVat    = lineNet × vat% / 100
lineAmount = lineNet + lineVat
Sub Total  = Σ lineAmount      ← already VAT-inclusive
footer VAT = memo only
Total      = Sub Total
```

**Question:** confirm with the employer that the footer VAT figure is a memo and is **not** added
again.

---

### C-12 · "UNIT PRICE" column contents — **M**
| Source | Claim |
|---|---|
| Legacy invoice template | Header `UNIT PRICE (AED)`; cell prints the **line total** |
| Real invoice | Shows `UNIT PRICE` and `AMOUNT (AED)` as separate columns |

**Analysis.** A legacy rendering bug (defect **D5**), not a business rule.

---

### C-13 · Invoice payment status granularity — **H**
| Source | Claim |
|---|---|
| Legacy code | `PAID` / `UNPAID` — two states only |
| Employer (`REQ-149`) | Partial payment must be representable |

**Analysis.** Not a contradiction in the strict sense — the legacy system simply cannot express what
the employer wants.

**Provisional reading:** implement `UNPAID / PARTIAL / PAID`.

---

### C-14 · Direction of the ledger statement — **M**
| Source | Claim |
|---|---|
| Legacy code (`FinController@preview`) | Rows ordered **descending**, running balance accumulated from the top |
| Real TallyPrime SOA | Rows **ascending** by date, running balance accumulates forwards |

**Analysis.** The legacy ordering is a bug (defect **D8**) that makes the running balance
meaningless. Two independent sources (the real SOA and basic accounting practice) agree that
ascending is correct.

---

### C-15 · Debit/credit balance display — **H**
| Source | Claim |
|---|---|
| Legacy code (`CalculateDebitCredit` + views) | A duplicated `$debit > $credit` condition means credit-side balances print `0` |
| Real SOA | Closing balance shown as `683.50 Dr` — a **labelled** balance with a Dr/Cr suffix |

**Analysis.** The legacy display is a bug (defect **D7**). The real SOA shows the correct
presentation: a magnitude plus a `Dr`/`Cr` marker.

---

## 4. Document shape

### C-16 · Quotation structure — **H**
| Source | Claim |
|---|---|
| Legacy code | Quotation is a single **free-text HTML body** |
| Real quotation `DSQUO/25-017` | A **line-item table** (description, qty, rate, amount) with a grand total |

**Analysis.** The legacy Quotation/Offer models cannot reproduce the real document. By contrast the
legacy **Proforma** *is* line-item based — so the two pre-sales document families were modelled
differently in the legacy system even though the real documents are structurally similar.

**Provisional reading:** both Quotation and Proforma need line items. See
[`../02-business-documents/quotations.md`](../02-business-documents/quotations.md).

---

### C-17 · Vessel printed on the manifest — **H**
| Source | Claim |
|---|---|
| Legacy template (`manifest/preview.blade.php`) | Hard-coded `VESSEL = DUNA SHIPPING LLC` |
| Real manifest | `VESSEL: BARGE MEHDI 11 / TUG LAYAN GULF` |

**Analysis.** The legacy template could never have produced a correct manifest (defect **D11**).
The real document also shows the **tug and barge** convention, which the legacy data model does not
capture.

> **STATUS UPDATE (2026-10-11) — RE-FRAMED, finding unchanged.** This is **not** a contradiction
> between two sources; it is a **legacy defect**, correctly identified as defect **D11**. The two lines
> above stand as written. Only the classification was misleading — legacy is evidence of previous
> behaviour, not the specification, so a hard-coded value in a legacy template is a defect to report,
> not a conflict to reconcile. No change to the finding; no action beyond keeping it as a recorded
> legacy defect.

---

### C-18 · Co-loading / partner B/Ls — **H**
| Source | Claim |
|---|---|
| Employer (`REQ-107`) | Partner B/Ls with different formats must be able to sit on one manifest |
| Legacy code | B/Ls must belong to a manifest and inherit its parties; number format is generated, not free |
| Real manifest | ✅ Confirms the employer — rows `NES260900266`, `NES260900267` sit alongside `KHS/26-nnn` |

**Analysis.** The employer is right and the real document proves it. The legacy model cannot do this.

---

## 5. Prior-analysis contradictions

### C-19 · Is there a Ledger in the legacy system? — **M**
| Source | Claim |
|---|---|
| `docs-legacy/00-OVERVIEW.md` line 34 | "Accounting → Ledger — Not found as separate model — ❌ Missing" |
| `docs-legacy/03-UI-PAGES.md` lines 61–62 | `admin/fins/ledger`, `admin/fins/showledger` — **listed as existing** |
| Verified code | `Fin` model, `FinController` (215 lines, 11 methods), 4 Blade views |

**Analysis.** `00-OVERVIEW.md` is **wrong**, and the same document set contradicts itself. The
correct statement is that the legacy ledger is *inadequate* (no double entry, no general journal, no
accounts), not *absent*.

---

### C-20 · Is the legacy invoice code sequential? — **L**
| Source | Claim |
|---|---|
| `duna_source_pack.md` §4.4 | "Invoice code sequential" |
| Verified code (`getinvoiceCode()`) | `DSAED/` . `rand(111111,999999)` — random |

**Analysis.** The prior analysis is wrong. Treat prior analyses as hypotheses.

---

### C-21 · Legacy B/L release states — **M**
| Source | Claim |
|---|---|
| `duna_business_analysis.md` §4.3 and `duna_source_pack.md` §4.3 | "Legacy B/L: `PENDING → RELEASED`" |
| Verified code | `RELEASED` is a declared constant; **no code path ever writes it**. `ReleaseController` has no release action — only Delete |

**Analysis.** Both prior analyses describe the *intended* lifecycle as if it were implemented
(defect **D1**).

---

## 6. Workspace / source contradictions

### C-22 · The highest-authority source is absent — **H**
| Source | Claim |
|---|---|
| `docs/current-plan/00-project-authority.md` | Names `/home/duna/dunaData/` as the highest-authority source |
| This workspace | `/home/duna/dunaData/` **does not exist** |

**Analysis.** Recorded as source gap **SRC-01**. Nothing in this knowledge base has been verified
against it. **Any conclusion here is provisional with respect to that missing source.**

> **STATUS UPDATE (2026-10-11) — RESOLVED, source gap WITHDRAWN.** `/home/duna/dunaData/` is a **stale
> historical path**, not a missing source. Employer materials are present and complete at
> `docs/duna-analysis/requirements/` (20 `.txt` transcripts, all listed in source pack §3). The source
> inventory reconciles fully to present files, so **SRC-01 is withdrawn** — it never hindered
> verification. The only genuinely absent materials are: the original **audio** recordings, the Company
> Archive "next file" alluded to in the transcripts, and the company's official **output templates**.
> Those three are recorded separately (the templates as scoped limitation, `09-audit/README.md` §3.4).

---

## 7. Summary by severity

| Severity | Count | IDs |
|---|---|---|
| **B** — blocks implementation | 3 | C-01, C-02, C-08 |
| **H** — high | 12 | C-03, C-05, C-09, C-11, C-13, C-15, C-16, C-17, C-18, C-22 |
| **M** — medium | 8 → **7** | C-04, C-06, ~~C-07~~, C-10, C-12, C-14, C-19, C-21 — **C-07 withdrawn** |
| **L** — low | 1 | C-20 |

### 7.1 The pattern

Almost every contradiction falls into one of three shapes:

1. **The legacy system does not implement what it declares** (C-03, C-11, C-12, C-14, C-15, C-17,
   C-20, C-21). ⟹ Treat legacy code as evidence of *attempted* behaviour, and always look for the
   executing line.
2. **The employer improvises examples** (C-01, C-02, C-06). ⟹ Trust real documents over spoken
   examples for *formats*; trust the employer over documents for *rules*.
3. **A prior analysis asserts without verifying** (C-19, C-20, C-21). ⟹ Verify against code.

### 7.2 Contradictions that are NOT contradictions

Recorded so they are not re-opened:

| Apparent conflict | Why it is not one |
|---|---|
| "Journal entries are debits" vs "payments are debits" | Both true. Journal entries and payments are **both** money-out representations in this system's convention (`REQ-166`) |
| One B/L per cargo vs several cargos per B/L | Not settled by the employer, but the real B/L shows one machine with one chassis number. Currently **unresolved**, not contradicted |
| `DSMAN/KHO-26-006` vs `DSKHS-26-005` | Two different voyages/manifests in the evidence set. Not necessarily a contradiction — see C-02 |
