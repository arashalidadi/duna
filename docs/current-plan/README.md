# docs/current-plan/ — CURRENT AUTHORITATIVE PLANNING SET

This directory is the single source of truth for future implementation decisions on the Duna Shipping ERP.

## Authority hierarchy (highest to lowest)

1. Raw employer evidence under `/home/duna/dunaData/`, especially the complete transcript set under `transcripts/`.
2. Employer document reference `dunaData/shipping_documents_detailed_reference.md`.
3. Current implementation reality of `shipping-erp-new` (source code, Prisma schema, runtime behavior, test results).
4. Previous audit and planning documents under `docs/ai-audit/`, `docs/`, `docs-gap/`.
5. Legacy dashboard analysis under `docs-legacy/` as auxiliary historical/reference evidence only.

## What this directory contains

- `00-project-authority.md` — document hierarchy, source-of-truth rules, generation separation.
- `01-final-requirements.md` — reconciled employer requirements, classified confirmed/inferred/open.
- `02-target-system-blueprint.md` — target ERP/dashboard structure module by module.
- `03-final-workflows.md` — end-to-end operational/commercial/document/control workflows.
- `04-final-data-model.md` — target conceptual data model vs current Prisma schema.
- `05-final-api-blueprint.md` — target API structure and actions.
- `06-final-ui-blueprint.md` — target dashboard UI/information architecture.
- `07-document-and-reporting-blueprint.md` — documents, templates, output, archive, reports.
- `08-requirement-traceability.md` — employer evidence → requirement → target → phase.
- `09-final-implementation-roadmap.md` — authoritative implementation phases.
- `10-phase-execution-protocol.md` — how future Hermes execution sessions are selected, run, and reported.
- `11-implementation-state.md` — current phase, completed work, blockers, next approved task.
- `12-open-business-decisions.md` — unresolved employer questions and impact.

## Historical material (preserved, NOT authoritative for future work)

- `docs/` — earlier planning/implementation docs including old progress numbering.
- `docs-gap/` — earlier gap analysis.
- `docs-legacy/` — legacy employer dashboard analysis (reference only).
- `docs/ai-audit/` — previous reconciliation (valuable, but re-audited here).

## Rule

If there is a conflict between this directory and older planning documents, this directory wins. If there is a conflict between this directory and raw employer evidence, raw employer evidence wins.
