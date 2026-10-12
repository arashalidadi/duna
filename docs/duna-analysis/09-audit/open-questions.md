# Genuinely Unresolved Questions

**Status:** Revised 2026-10-11 (second revision). Supersedes the initial 41-question list and the first
12-item revision.

**Scope of this document.** This file contains **only** items that remain unresolved after the reconciliation
exercise. Questions answered, superseded by a confirmed design decision, or withdrawn are **not** repeated
here; their dispositions are in `question-reconciliation.md`, which is the master record.

**No role or person named below is invented.** Where a named individual would normally be required, the
responsibility is expressed as a **role**, because the company's actual post-holders have not been stated in
any source material.

---

## §0 · Resolution-type and blocking-scope keys

**Resolution type** — what kind of input closes the item:

| Key | Meaning |
| --- | --- |
| **OWNER** | A business-owner decision. Cannot be inferred safely. |
| **EVIDENCE** | Missing source evidence — a document, sample or export that exists somewhere in the company. |
| **COMPLIANCE** | Legal, statutory or accounting input. Must come from whoever owns compliance. **Never invented.** |
| **TECHNICAL** | An engineering investigation or measurement, not a business answer. |
| **IMPL-VERIFY** | Cannot be settled on paper; must be verified during implementation. |

**Blocking scope** — what is actually held up:

| Key | Meaning |
| --- | --- |
| **NONE** | Work proceeds; only a configuration value or display string is pending. |
| **CONFIG** | Blocks a *configuration* value being finalised. The mechanism can still be built. |
| **FEATURE** | Blocks one feature area. |
| **PHASE** | Blocks a whole roadmap phase. |
| **PROD-ENABLE** | Blocks *production enablement* only — the feature can be built, tested and staged. |
| **PROGRAMME** | Blocks everything. **No item below is at this level.** |

---

## §1 · The register

---

### OQ-01 · B/L number format — the meaning of `KHS/26-110` is unexplained

**Description.** The real B/L number is `KHS/26-110`. The destination code and a two-part number with an
annual reset are evident, but the meaning of each component has never been stated.

**Why still open.** The employer gave three different spoken examples (`KHS/26-2/2026`, `RJS/26-10`) that
contradict the real documents, so the spoken form cannot be trusted as the rule. Contradiction **C-01**.

**Resolution type:** **OWNER** (with a supporting **EVIDENCE** element — a wider sample would settle it).

**Blocks:** **CONFIG** — the content of the P2 seeding configuration only.

**Can work proceed?** **Yes.** The format is **data**, not code (`ADR-008`, `DEC-024`…`DEC-028`). P2 builds the
mechanism and seeds a best-supported format; a later answer is a configuration change with no migration.

**Recommended next action.** Ask the employer to explain one real B/L number component by component. Take the
answer against a **printed** B/L, not from memory. If a wider sample of B/Ls can be supplied, the pattern
becomes self-evident and no question is needed.

**Best positioned to resolve:** **Business owner**, with **Operations** supplying a sample of issued B/Ls.

---

### OQ-02 · Manifest numbering — two incompatible formats in one sample

> ⚠️ **PREMISE CORRECTED (2026-10-12) — this was a misreading, not a contradiction.**
> `DSKHS-26-005` occurs **zero times** in the Manifest PDF. It is a field on the **Tax Invoice**
> (`INV-GRAND CRANE ...0127-1.pdf`), which covers a **different voyage**: vessel **DAHAR 10**, B/L
> `KHS/26-108`. The Manifest covers barge **MEHDI 11** with B/Ls `KHS/26-110`...`KHS/26-139`.
> **Two documents, two voyages — there is no conflict within a single document.** Contradiction **C-02** and
> its "unresolved" verdict rest on this error and have been updated in `contradictions-register.md`.

**Description.** ~~The single manifest sample carries `DSMAN/KHO-26-006` (stamped on the page) **and**
`DSKHS-26-005` (in the table).~~ **Corrected:** the Manifest carries only `DSMAN/KHO-26-006`. `DSKHS-26-005`
belongs to a different document (the Tax Invoice) and a different voyage.

**Why still open.** ~~Two mutually exclusive readings of the same document.~~ **Corrected:** there is only one
reading of the Manifest. The cross-document comparison was invalid. Contradiction **C-02** is therefore
**weakened** — the "two manifest series in the evidence" reading is withdrawn; a residual "typo vs separate
series" reading survives only for `DSKHS` itself, which is a single occurrence on an unrelated document.

**Resolution type:** **OWNER**, supported by **EVIDENCE**.

**Blocks:** **CONFIG** — the P2 seeding configuration, as with OQ-01.

**Can work proceed?** **Yes.** Same reasoning as OQ-01: the format is data. The conflict itself is preserved as
a documented open item so that whoever configures it sees that both forms were observed.

**Recommended next action.** Ask which format is authoritative, and whether `DSKHS-26-005` was a one-off data
entry. Two or three further manifests would settle it without a decision.

**Best positioned to resolve:** **Business owner**, with **Operations** supplying further manifests.

---

### OQ-03 · Customer code format — unresolved at source

> ✅ **RESOLVED (2026-10-12) — by owner decision. Recorded as `DEC-115`.**
> Customer codes are **administrator-configurable**; the code is **unique**; and when the configured format
> changes, **existing codes are never silently or automatically rewritten**. No company-specific format is
> invented. The item is now configuration data, not an open question.
> *Blocking scope: none.*

**Description.** Customer code autogeneration is confirmed. The exact pattern is stated nowhere, and the
meaning of a trailing `01` seen in examples is unexplained.

**Why still open.** The employer produced several different customer-code examples in one breath, so no single
form can be treated as the rule. Contradiction **C-06**.

**Resolution type:** **OWNER**.

**Blocks:** **NONE** functionally — **CONFIG** only.

**Can work proceed?** **Yes.** The format is configurable data. A safe documented default can be seeded and
changed later without migration, because existing codes are never rewritten (`DEC-026`).

**Recommended next action.** Confirm when convenient. Do not guess — an incorrect guess would produce codes
that look authoritative and are wrong.

**Best positioned to resolve:** **Business owner**.

---

### OQ-04 · B/L number window — `DSKHS-26-005` inside a manifest dated `06/26`

**Description.** Consecutive numbering per manifest is standard and consecutive numbering across B/L types is
confirmed, yet this one B/L number sits oddly against the manifest's date.

**Why still open.** It is a single anomalous data point. It is much more likely a data-entry quirk in the
sample than a business rule, but that has not been confirmed.

**Resolution type:** **EVIDENCE** (a wider sample) — falling back to **OWNER** if it recurs.

**Blocks:** **NONE.** It does not gate any mechanism.

**Can work proceed?** **Yes.** Numbering is generated by the system (`NumberingService.allocateNumber()`,
`SELECT … FOR UPDATE`); this observation concerns the company's *historical* data, not system behaviour.

**Recommended next action.** Low priority. When next reviewing manifests with the employer, ask whether this
recurs. If it never recurs, close it as a sample artefact.

**Best positioned to resolve:** **Operations** (by supplying further samples), confirmed by **Business owner**.

---

### OQ-05 · Official B/L status labels — cosmetic only

**Description.** The lifecycle (draft → correction → approval/finalisation → issuance → printing) is confirmed
and implemented. The **names** used are invented placeholders, not official company status names.

**Why still open.** The employer never stated official status names; the current names were chosen by the
implementation team.

**Resolution type:** **OWNER**.

**Blocks:** **NONE.** Labels are configuration and are renameable with no schema change (`DEC-060`, `DEC-061`).

**Can work proceed?** **Yes**, comfortably. **Explicit constraint: do not treat the current labels as official
company terminology.** They are placeholders and must be presented to users as such until confirmed.

**Recommended next action.** Ask for the official status names at any point before go-live. Rename via
configuration when answered.

**Best positioned to resolve:** **Business owner**, with **Operations** (who use the statuses daily).

---

### OQ-06 · Release exceptions — who may approve?

> ✅ **RESOLVED (2026-10-12) — by owner decision. Recorded as `DEC-116`.**
> The **primary administrator (the company owner)** may approve a release exception **directly**, with no
> approval from any other user. A **manager or formally delegated representative** may approve one **only if
> the primary administrator has explicitly granted the relevant permission**. Ordinary managers and
> administrators **must not** inherit release-exception authority automatically.
> Every exception records **who approved it, when, the related transaction, and the decision**.
> *Provenance, not a second approval layer:* only the primary administrator may grant the permission, and every
> grant/revocation is audited — so a permission check is never taken on its own as proof of authority, and no
> authority is created above the owner.
> *Blocking scope: none.* The hard constraint below remains in force as **design guidance**: fail closed where
> no authorized approver or valid delegation is configured.

**Description.** The requirement for an approval step on release exceptions (releasing cargo where payment is
not complete) is **confirmed**. The **identity or role of the approver** is unstated.

**Why still open.** The employer confirmed the *principle* ("no money, no cargo", with exceptions) but never
said who authorises an exception. This is a delegation-of-authority question and cannot be inferred.
Question **Q-AUD-21**.

**Resolution type:** **OWNER.**

**Blocks:** **CONFIG** — it blocks *configuring* the release-approval workflow. It does **not** block building
it.

**Can work proceed?** **Yes — and must proceed on a configurable basis.** Build the approval mechanism with
**approver identity as configuration, not code**. The workflow engine (P9) supplies the approver step; the
specific role or person is bound at configuration time (`DEC-062`, `DEC-063`).

> ⚠️ **Hard constraint: do not invent company approval authority.** No named individual, job title or
> delegation limit may be assumed. Until the owner answers, the system must ship with **no default approver**
> and the release-exception path must **fail closed** (exception unavailable) rather than defaulting to
> "anyone may approve". Failing closed is the safe default; an invented approver is not.

**Recommended next action.** Ask the employer who authorises a release when payment is incomplete — and
whether there is a monetary threshold above which a different person must approve. Record the answer as
configuration, not as code.

**Best positioned to resolve:** **Business owner** (this is a delegation-of-authority decision made at owner
level), advised by **Finance**.

---

### OQ-07 · `ETOZ` / `ETDZ` abbreviations — unexplained

**Description.** The employer used these two abbreviations without defining them. They appear to be movement
or status markers. Nothing in the repository depends on them.

**Why still open.** Used once, never defined, and no other source expands them.

**Resolution type:** **OWNER** (a definition) — effectively a terminology question.

**Blocks:** **NONE.** Only the naming of a status or field.

**Can work proceed?** **Yes.** **Do not invent an expansion.** Until defined, the abbreviations may be used as
literal labels exactly as written, but must not be treated as meaning anything specific.

**Recommended next action.** Ask for the expansion when convenient; if the employer does not recognise a
formal definition, record them as informal shorthand and keep the literal strings.

**Best positioned to resolve:** **Business owner** or **Operations**.

---

### OQ-08 · Official document templates — not supplied

> ⚠️ **RE-FRAMED (2026-10-12) — "missing templates" was overstated.**
> The **official sample PDFs are present** and have been inspected: `MAN-MEHDI 11 KHO-26-006.pdf`,
> `BL-1X D155A CH NO 8308-1.pdf` and five others. A rendering **specification** also exists in
> `docs/duna-analysis/legacy-source/docs-summary.md`.
> What is genuinely absent is the **editable template source files** (letterhead, stamp, signature images, and
> the editable layout sources). That is a narrower gap than "templates not supplied".

**Description.** ~~No official company templates exist in the repository or the source pack.~~ **Corrected:**
official **sample outputs** and a rendering specification **do** exist; **editable template source files** do
not. The 7 sample PDFs are **produced output**, not reusable templates.

**Why still open.** The templates exist in the company but have never been provided. Source finding **SRC-07**
/ question **Q-AUD-06**.

**Resolution type:** **EVIDENCE.** The templates exist; they simply have not been collected.

**Blocks:** **PROD-ENABLE** for output fidelity only — see below.

**Can work proceed?** **Yes, and it is deliberately scheduled to.** This is the clearest case in the programme
of "do not block on a missing source".

> **What is NOT blocked:** the rendering capability, the template model, template versioning, template
> management and assignment, the output modes (PDF / Print / Excel), and the stamp-on-PDF / strip-on-Print
> behaviour (REQ-121/122). All of P8 can be built and tested against placeholder layouts.
>
> **What IS pending:** **official-template fidelity validation** — the assertion that system output matches
> the company's real documents. That single acceptance test cannot run until the templates arrive.
>
> **Safeguard:** P8's exit criteria must explicitly record fidelity as **PENDING VALIDATION**, not as passed.
> Shipping documents that merely *resemble* the company's, without having been checked against them, would be
> a silent failure — the output would look authoritative and be wrong.

**Recommended next action.** Request the templates now so they arrive during P8 rather than at its end. Ask
for the current live version of each of the 11 document types, plus the company letterhead, stamp and
authorised-signature images.

**Best positioned to resolve:** **Business owner** / **Operations** (who hold the current templates).

---

### OQ-09 · Bandar Abbas vs Bandar Rajaee — one port or two?

> ✅ **RESOLVED (2026-10-12) — by owner decision. Recorded as `DEC-117`.**
> **Bandar Abbas and Rajaee are two names for the same port**, not two ports. The system must support **one
> canonical port record with alternative names/aliases** and an **administrable port list**.
> Do **not** create two separate port records merely because both names occur in source documents. Preserve
> historical references (DEC-066) and avoid destructive merges.
> **This is a confirmed decision, not a conditional one.** Documentary evidence may still be recorded for data
> **provenance**, but it does **not** reopen the decision and does **not** gate implementation.
> *Blocking scope: none.*

**Description.** `IRBND` unambiguously means Bandar Abbas. Whether Bandar Abbas and Bandar Rajaee are the same
port under two names, or two distinct ports, is unresolved.

**Why still open.** The materials use both names without clarifying. Related to `DEC-065`.

**Resolution type:** **OWNER**, ideally confirmed against **EVIDENCE** (a port list or a real B/L).

**Blocks:** **CONFIG** — the final port master-data entry and the `NOT NULL` constraint step in P10.

**Can work proceed?** **Yes.** Seed the port, leave the alias question open, and treat any second name as an
**alias on the same port** (reversible) rather than creating two ports (harder to merge later).

**Recommended next action.** Confirm whether one port or two. This item is bundled with **OQ-14** below
(complete port list) — resolve them together.

**Best positioned to resolve:** **Operations** (who book the ports daily), confirmed by **Business owner**.

---

### OQ-10 · Jebel Ali English name — trivial

**Description.** The Persian name is known; the abbreviation `AEJEA` is fine; the preferred **English display
name** has not been confirmed.

**Why still open.** Never asked; never stated.

**Resolution type:** **OWNER** — trivial.

**Blocks:** **NONE.** A display string only.

**Can work proceed?** **Yes.** Seed the widely-used English form as a documented default and correct it on
answer.

**Recommended next action.** Ask whenever convenient. Lowest-priority item in the register.

**Best positioned to resolve:** **Operations** or any native-literate member of staff.

---

### OQ-11 · Deletion policy for cancelled Cargo rows

**Description.** Cargo records have no archival, financial, tax or reporting significance, and
interior-city-only rows have no operational use. Whether such rows may be **hard-deleted** or must be
**soft-deleted** is unconfirmed.

**Why still open.** It is a narrow operational preference that was never put to the employer.

**Resolution type:** **OWNER**, with a technical recommendation available.

**Blocks:** **NONE** — a single behaviour choice in P10, reversible either way.

**Can work proceed?** **Yes.** **Technical recommendation: soft delete.** There is no measurable benefit to
hard deletion, and soft deletion preserves referential integrity and the audit trail (`DEC-049`…`DEC-052`).
This is a recommendation, **not** a confirmed company policy — it must not be presented as one.

**Recommended next action.** Confirm which is preferred. If the employer has no preference, adopt the soft
delete recommendation and record it as a technical decision rather than a business rule.

**Best positioned to resolve:** **Business owner**, advised by the **technical lead** on the trade-off.

---

### OQ-12 · Sensitive-document retention — a compliance input

> ✅ **RESOLVED AS POLICY (2026-10-12) — by owner decision. Recorded as `DEC-118`.**
> The **policy** is confirmed: the design must support **configurable retention periods**, access restriction,
> audit trails and secure deletion.
> ⚠️ **The exact retention periods remain OUTSTANDING** as a **compliance/legal input**. They must **not** be
> invented, assumed, or presented as company policy or as a legal requirement.
> A pending input is **not** an open business decision.
> *Blocking scope: none.*

**Description.** The system will hold salary slips and identity documents for employees, crew and others. The
**retention period** for these is unknown.

**Why still open.** Retention is an **accounting, legal and statutory** input. It is not a technical preference
and must not be inferred from how similar systems usually behave. Source **Q-AUD-05b** / **Q-AUD-25**.

**Resolution type:** **COMPLIANCE.** This is the only item in the register that requires compliance input.

**Blocks:** **PROD-ENABLE** — it blocks enabling sensitive-document capture **in production**. It does **not**
block building the module.

**Can work proceed?** **Yes, for construction and testing.** P4 builds attachments, storage, permissions and
audit; P12 builds the retention mechanism. **Retention periods are configuration**, supplied later.

> ⚠️ **Hard constraint: do not invent legal retention periods.** No period may be assumed from general
> practice, from the legacy system's behaviour, or from what is convenient to implement.
>
> **Safeguards required BEFORE sensitive-document collection is enabled in production:**
>
> 1. A stated retention period per document class (identity documents, salary slips, employee records),
>    obtained from whoever owns compliance.
> 2. A recorded lawful basis and access-control model for holding identity documents at all.
> 3. Permission-restricted access, **signed short-lived URLs** and no public exposure.
> 4. Access to identity documents **logged** and excluded from ordinary reports and notifications.
> 5. A deletion/disposal path that honours the retention period and is itself audited.
> 6. Backup coverage that includes the documents, with the same access controls preserved on restore.
>
> Until 1 and 2 exist, the capability may be built and tested with **test data only**, and production capture
> must remain **disabled**.

**Recommended next action.** Obtain retention periods in writing from whoever owns compliance for this company.
Ask for the statutory basis, not just a number, so the value can be re-validated later.

**Best positioned to resolve:** **The company's compliance owner** — its external accountant, legal counsel, or
the owner acting on their advice. **Not** the implementation team.

---

## §1b · Recovered during reconciliation — previously missing from this register

> ## ⚠️ Discrepancy found and corrected 2026-10-11
>
> This register and `question-reconciliation.md` each listed **12** open items, but **they were not the same
> 12.** Three items present in the reconciliation were missing here (**OQ-13**, **OQ-14**, **OQ-15**), and
> three items present here were absent from the reconciliation's list (**OQ-04**, **OQ-10**, **OQ-11**).
>
> The two lists were authored from different frames, and the difference was not caught at the time. It is
> reported here rather than silently merged. **The register therefore contains 15 open items, not 12.**
>
> Both documents have been updated so they now agree.

### OQ-13 · Which services are taxable, and at what rates?

> ⚠️ **CORRECTED (2026-10-12).** An earlier reading claimed the invoice sample showed "both 0% and 5% lines".
> That is **wrong**. All **4** line items on the sampled Tax Invoice carry **0%** VAT (subtotal
> AED 27,370.00). The **5%** figure occurs **once**, as a *spoken example* in the employer statements
> (EMP-115); it is **not** evidenced on any invoice line.

**Description.** Per-line VAT is **confirmed** (`DEC-100`…`DEC-104`). Which specific services are taxable, and
the applicable rates, are **not** confirmed.

**Why still open.** The requirement is architectural and settled; the values are business configuration that
was never supplied. Question **Q-AUD-26**.

**Resolution type:** **OWNER**, advised by **COMPLIANCE** (tax treatment is a statutory matter).

**Blocks:** **CONFIG** — the P3 VAT configuration only. The mechanism (per-line `taxRate`/`taxAmount`,
historical preservation) is built either way.

**Can work proceed?** **Yes.** Build per-line VAT with **no default rates** and **no assumption of
taxability**. A wrong default would silently produce incorrect tax on real invoices.

**Recommended next action.** Ask which services are taxable and at what rate. Confirm whether more than one
rate applies. ~~the invoice sample shows both 0% and 5% lines, so assume a **multi-rate** model~~
**Corrected:** the sampled invoice shows **0% on all 4 lines**; 5% appears only as a spoken example
(EMP-115). Keep a **multi-rate** model — that remains sound design — but do **not** cite the sample invoice as
evidence for a 5% rate.

**Best positioned to resolve:** **Business owner**, with the **company's accountant** confirming the tax
treatment.

---

### OQ-14 · Complete port list and remaining port abbreviations

**Description.** Eight ports are evidenced. The employer's operations almost certainly use more. Several
abbreviations seen in documents remain unmatched.

**Why still open.** No complete port list has ever been supplied; the current list was derived from document
samples only. Question **Q-AUD-09**.

**Resolution type:** **EVIDENCE** — a list exists in the company; it has not been collected.

**Blocks:** **CONFIG** — the `NOT NULL` constraint step in P10. Seeding, display and alias handling proceed
regardless.

**Can work proceed?** **Yes.** Seed the eight evidenced ports now; add the rest when supplied. The constraint
step waits for completeness — applying `NOT NULL` before the list is complete would force fabrication.

**Recommended next action.** Request the complete port list with, for each port: full name, English name,
abbreviation, city and country. Resolve together with **OQ-09**.

**Best positioned to resolve:** **Operations**.

---

### OQ-15 · Unrealised foreign-exchange gain recognition policy

**Description.** Once dated exchange rates exist (P6), a question arises that does not exist today: how
unrealised FX gains and losses on foreign-currency balances are to be recognised.

**Why still open.** It is an accounting-policy question that only becomes live once rate history exists, and it
has never been discussed. Related to `DEC-010`.

**Resolution type:** **COMPLIANCE / TECHNICAL** — an accounting-policy decision with an architectural
consequence.

**Blocks:** **CONFIG** — the P6 architecture decision only. Multi-currency capture, rate history, allocation
and reporting all proceed without it.

**Can work proceed?** **Yes.** **Recommendation: defer to the P6 architecture step** rather than answering it
now. The system must record original amount and currency, applied rate, effective date/source and base
equivalent on every transaction (`DEC-001`…`DEC-012`) — which is exactly the data needed to apply **any**
recognition policy later. Recording the facts now, and deferring the policy, is the safe order; choosing a
policy prematurely is not.

**Recommended next action.** Raise during P6 design with the company's accountant present. Do not answer it in
the planning stage.

**Best positioned to resolve:** **The company's accountant**, with the **technical lead** on implementation.

---

## §2 · Items deliberately NOT open

These are settled and are **not** questions:

- **Document types** — 11 confirmed. The 9-vs-11 discrepancy is **explained**, not open.
- **Invoice↔B/L cardinality** — many-to-many confirmed.
- **Invoice↔Job cardinality** — many-to-many confirmed.
- **Payment allocation granularity** — per-reference amounts confirmed.
- **General ledger** — required; customer balances are not a substitute.
- **Reporting** — full reporting required; not deferred.
- **REQ-017** — stands as written.
- **Currency policy** — none proven; the invoice sample is labelled `Payment Currency: AED`, which is not a
  policy statement.
- **Release Order vs B/L status** — separate concerns confirmed.
- **Test coverage** — the real figure must be measured, not asserted.
- **Notifications** — configurable thresholds confirmed.
- **Six-vs-ten navigation** — discrepancy **preserved**, not resolved.
- **Agent portal** — agents only; not customers.
- **Voyage cost categories** — not the legacy columns.
- **Job definition** — a job is not a B/L, voyage, manifest, invoice or payment.

---

## §3 · Consolidated dependency summary

| Priority | ID | Item | Type | Status | Blocks | Gate |
|---|---|---|---|---|---|---|
| **Higher** | OQ-13 | Taxable services and rates | OWNER + COMPLIANCE | Open | CONFIG | Before invoicing goes live |
| Medium | OQ-08 | Editable template source files | EVIDENCE | Open | PROD-ENABLE (fidelity) | Before output sign-off |
| Medium | OQ-07 | ETOZ / ETDZ | OWNER | Open | NONE | Any time |
| Medium | OQ-15 | FX gain policy | COMPLIANCE + TECHNICAL | Open | CONFIG | During P6 design |
| Low | OQ-01 | B/L number format | OWNER + EVIDENCE | Open | CONFIG | Before P2 seeding |
| Low | OQ-14 | Complete port list | EVIDENCE | Open | CONFIG | Before P10 constraint |
| Low | OQ-04 | B/L number window | EVIDENCE | Open | NONE | Opportunistic |
| Low | OQ-11 | Cargo deletion policy | OWNER | Open | NONE | Before P10 |
| Low | OQ-10 | Jebel Ali English name | OWNER | Open | NONE | Trivial / any time |
| — | OQ-03 | Customer code format | OWNER | ✅ Resolved (DEC-115) | NONE | — |
| — | OQ-06 | Release-exception approver | OWNER | ✅ Resolved (DEC-116) | NONE | — |
| — | OQ-09 | Bandar Abbas vs Rajaee | OWNER | ✅ Resolved (DEC-117) | NONE | — |
| — | OQ-12 | Sensitive-document retention | OWNER + COMPLIANCE | ✅ Policy resolved (DEC-118); periods pending | NONE | — |
| — | OQ-02 | Manifest number "conflict" | EVIDENCE | ✅ Premise corrected (not a conflict) | NONE | — |
| — | OQ-05 | Official B/L status labels | OWNER | ✅ Resolved by employer statements | NONE | — |

**All 15 items (OQ-01…OQ-15) are accounted for above: 9 remain open as source/configuration inputs, 6 are
resolved. None of the 15 is an unanswered business decision.**

---

## §4 · Bottom line

**No item in this register blocks the programme start.**

- **Zero** items block at **PROGRAMME** level.
- **Zero** items block a whole **PHASE**.
- **Zero** items are unanswered **business decisions**. Following the owner decisions of 2026-10-12
  (**DEC-115** customer codes, **DEC-116** release-exception authority and the primary administrator,
  **DEC-117** Rajaee/Bandar Abbas as one port, **DEC-118** retention policy), no business decision remains open.
- **One** item (OQ-13, taxable services and rates) must be answered before **invoicing goes live** — the
  mechanism can be built now and configured on answer.
- **One** item (OQ-08, editable template source files) is a **production-enablement** gate for output
  fidelity: build and test proceed; production activation waits.
- The remaining open items are configuration detail, display strings, or deferred policy.

**Two hard constraints govern several of these items and must not be relaxed:**

1. **Do not invent company approval authority** (OQ-06 — now settled by **DEC-116**). The primary
   administrator approves directly; managers only on explicit grant. The fail-closed rule remains in force as
   design guidance where no authorized approver or valid delegation is configured.
2. **Do not invent legal retention periods** (OQ-12 — policy settled by **DEC-118**; periods still
   outstanding). Obtain the exact periods from the compliance owner.

Where a technical preference is genuinely available — OQ-11 (soft delete), OQ-15 (defer the policy) — it is
offered as a **recommendation**, clearly marked as such, and never presented as confirmed company policy.
