# 00 Project Authority

## Purpose

Establish the rules by which every future implementation decision is evaluated.

## Three generations kept separate

### Generation 1 — original dashboard planning/implementation

Location: `docs/`, `docs-gap/`, older ADRs, `docs/progress.md`.

Status: historical. Some ideas are still valid. Some phase numbers are obsolete.
This generation must not be treated as the current specification.

### Generation 2 — legacy employer dashboard

Location: `docs-legacy/` and legacy code index.

Status: auxiliary business evidence only. Useful for understanding what the company previously had and what behavior existed in practice. Not the target system.

### Generation 3 — latest AI audit

Location: `docs/ai-audit/`.

Status: previous expert analysis. Valuable, but re-audited here against raw employer evidence and current code. Where it is correct, this plan preserves it. Where it is incomplete or inconsistent with the locked technical decisions or employer evidence, this plan corrects it.

## Source of truth

Highest authority: employer evidence under `/home/duna/dunaData/`, especially the full transcript set under `transcripts/`.

Secondary employer evidence: `shipping_documents_detailed_reference.md`.

Current reality: the live codebase and schema of `shipping-erp-new`.

Lower authority: derived analysis files such as `duna_business_analysis.md`, `duna_source_pack.md`, prior gap analyses, prior phase logs.

## Interpretations allowed

The employer is not a software engineer. When the employer describes a screen, field, or behavior, this plan distinguishes:

- the underlying business need
- the requested business behavior
- the employer's informal UI suggestion

This plan implements the business intent in a technically sound way. It does not blindly copy naive UI suggestions. It does not invent business rules that the employer never stated.

## Conflict rule

1. Raw employer evidence beats derived analysis.
2. This planning directory beats older planning directories.
3. Current implementation reality beats stale progress documents.
4. Where employer evidence is ambiguous, the item is recorded as an open business decision, not invented.

## Language of record

The authoritative planning record is written in English. Persian employer evidence is preserved through tagged quotes and summarized requirements.

## Previous audit and plan reconciliation

This section classifies the prior planning material under `docs/ai-audit/` against raw employer evidence and current code. It does not delete that material; it states where it still stands and where this plan departs from it.

### Still correct

- The core business model in the ai-audit requirements analysis is broadly consistent with the employer transcripts: Customer is the internal commercial counterparty and is separate from Shipper/Consignee/Agent; Port/Yard structure; Vessel/Voyage per-destination numbering; Cargo intake fields; Inspection gating; Load List and Actual Loading with not-loaded yard return; B/L before Manifest; Manifest consolidation of issued B/Ls; multi-party manifests; Invoice from B/L and independently; per-line VAT; Voucher types with ID card/signature; Release Order after discharge; Delivery Order; Agent destination-scoped visibility; Customer 360; document templates and output; Salary slip with ID card/signature.
- The general direction that master data and operational modules are largely implemented is consistent with the current Prisma schema and codebase.
- The ai-audit gap analysis correctly flags that B/L/Manifest ordering, party model, invoice VAT, voucher allocation, General Journal, B/L release status, B/L revisions, and ManifestItem→B/L item reference are still issues.

### Correct but incomplete

- The ai-audit work is correct as far as it goes, but it does not replace the need for a single authoritative planning set that is explicitly tied to the complete transcript set. That is the purpose of this directory.
- The ai-audit roadmap's phase numbering is valuable history, but this plan re-establishes the roadmap from the target system and current code reality rather than continuing the old numbering by default.

### Outdated

- Older phase-numbering claims in `docs/progress.md` and similar historical documents are outdated for current planning purposes. They are preserved as history but are not the current phase reference. The current phase reference lives in `11-implementation-state.md` and `09-final-implementation-roadmap.md`.
- Any prior statement implying that the current B/L/Manifest implementation already matches the employer flow is outdated. Current code still shows Manifest-first B/L creation and Customer-FK party usage in critical paths.

### Technically incorrect or contradicted by current code

- The idea that B/L and Manifest already derive from the correct employer flow is contradicted by current code. B/L is still created against Manifest in current service logic, and party references still rely on Customer FKs in key areas.
- The idea that Invoice already has per-line VAT and a Job link is contradicted by the current schema.
- The idea that Voucher already supports multi-invoice allocation is contradicted by the current single FK design.

### Contradicted by employer evidence

- No employer-evidence contradiction was found in the ai-audit core requirements model. Where the ai-audit is weaker, this plan strengthens it with explicit transcript coverage and explicit open-business-decisions handling.
- No item in the ai-audit that is grounded in employer evidence was rejected here on the basis of code alone. Code gaps are treated as implementation gaps, not employer-evidence reversals.

### What this plan preserves from the ai-audit

- The business-domain understanding.
- The ordering of the major corrective work.
- The caution about not inventing business rules.
- The importance of server-side enforcement for sensitive scope.

### What this plan changes

- It makes the employer evidence basis explicit and file-by-file.
- It sets a single authoritative planning source for future work.
- It tightens the current-vs-target comparison against the live schema and service code.
- It explicitly marks Phase 3A as not yet complete in the target sense.
