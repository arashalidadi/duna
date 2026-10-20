# Documentation

One curated set: 25 markdown documents (20 here plus 5 volumes of source material)
and 8 binary source files, grouped by what you need them for.
Nothing here is generated and nothing here is a scratch note: if a document
stopped being true, it was rewritten or removed rather than left behind.

The former 200-file tree was consolidated on 2026-10-20. No text was deleted —
176 documents were merged into the ten volumes listed below, each keeping its
former path as a `##` heading, so `grep -rn "<old filename>" docs/` still finds
it. The binary source material (client PDFs, the legacy archive) was moved, not
merged.

## Start here

| Document | What it answers |
| --- | --- |
| [`architecture.md`](architecture.md) | How the system is built: modules, boundaries, runtime topology |
| [`business-requirements.md`](business-requirements.md) | What the business actually requires, as a specification |
| [`database-schema.md`](database-schema.md) | Every table, column, enum, index and constraint |
| [`permissions.md`](permissions.md) | The permission catalogue, roles and who may do what |
| [`api.md`](api.md) | The HTTP surface: endpoints, envelopes, auth |
| [`workflows.md`](workflows.md) | The operational flows the software implements |
| [`design-system.md`](design-system.md) | UI conventions, components and layout rules |
| [`decisions.md`](decisions.md) | Architecture decision records, with their reasoning |
| [`progress.md`](progress.md) | What is finished, what is in flight, what is known-broken |

## Running and deploying it

| Document | What it answers |
| --- | --- |
| [`fresh-server-install.md`](fresh-server-install.md) | Installing on an empty server, end to end |
| [`operations.md`](operations.md) | Runbook: runtime, login, ports, connectivity, handoffs |
| [`phase10-deployment.md`](phase10-deployment.md) | Deployment specifics for the configuration phase |
| [`repository-audit-and-portability-plan-2026-10-18.md`](repository-audit-and-portability-plan-2026-10-18.md) | Portability audit and the plan that came out of it |

## Phase specifications

| Document | What it answers |
| --- | --- |
| [`phase8-document-output.md`](phase8-document-output.md) | Document projections, issuance, output formats |
| [`phase9-configuration.md`](phase9-configuration.md) | Option lists, field definitions, workflows, approvals |

## Plan, log and audit

| Document | What it answers |
| --- | --- |
| [`plan.md`](plan.md) | The thirteen authoritative blueprints: requirements, target system, data model, API, UI, roadmap, execution protocol |
| [`implementation-log.md`](implementation-log.md) | Every dated phase/unit implementation record, plus the party-cutover evidence |
| [`ai-audit.md`](ai-audit.md) | The independent audit trail, in its original numbered order |
| [`ui.md`](ui.md) | Dashboard redesign notes and the UI test record |

## Source material (evidence, not specification)

`source-material/` holds what the specification was *derived from*. Read it to
check a decision, not to learn the system.

| Document | What it holds |
| --- | --- |
| [`source-material/employer-requirements.md`](source-material/employer-requirements.md) | The employer's own statements, verbatim meeting transcripts, requirements catalogue, glossary, open questions |
| [`source-material/business-analysis.md`](source-material/business-analysis.md) | Document-by-document analysis, consolidated business model, ER model, contradictions register |
| [`source-material/legacy-laravel-system.md`](source-material/legacy-laravel-system.md) | Everything recorded about the legacy system: schema, data dictionary, calculations, permissions, modules |
| [`source-material/project-audit.md`](source-material/project-audit.md) | Phase-by-phase audit of the implementation, including Phase 11/12 and end-to-end target audits |
| [`source-material/project-history.md`](source-material/project-history.md) | Project state as analysed, AI reference material, traceability, original sources, final report |
| `source-material/documents/` | Seven client PDFs (bills of lading, invoices, manifests, quotations, statements) — the physical documents the software reproduces |
| `source-material/legacy/duna-clean.zip` | Archive of the legacy Laravel codebase |

## Conventions

- **Specification vs evidence.** `business-requirements.md`, `plan.md` and the
  phase documents say what must be true. `source-material/` says what was said.
  When they disagree, the specification wins and the contradiction is recorded
  in `source-material/business-analysis.md`.
- **Phase documents describe shipped work only.** Nothing here documents a
  phase that has not been built.
- **Dates are in the filenames and headings**, ISO-8601, so records stay
  orderable after a merge.
