# 12 Open Business Decisions

> ## ⚠️ Superseded as the open-item register — cross-referenced 2026-10-11 (action **D5**)
>
> This file is retained as the record of an earlier planning round. **It is no longer the list of open
> questions.** Do not use it to decide what is still unresolved.
>
> | The authoritative open-item register | [../duna-analysis/09-audit/open-questions.md](../duna-analysis/09-audit/open-questions.md) |
> | --- | --- |
> | The master disposition of every question ID | [../duna-analysis/09-audit/question-reconciliation.md](../duna-analysis/09-audit/question-reconciliation.md) |
> | The settled product decisions | [../duna-analysis/09-audit/confirmed-decisions.md](../duna-analysis/09-audit/confirmed-decisions.md) |
>
> **Most items below have since been resolved** by confirmed design decisions. Nothing here has been deleted —
> the original text is preserved, with each item mapped to its current disposition.

### Disposition of §1.1–1.12 against the confirmed decisions

| § | Item | Disposition | Where |
| --- | --- | --- | --- |
| 1.1 | B/L lifecycle and release modelling | **Resolved**, except official status *names* | DEC-059…063 · remaining item **OQ-05** |
| 1.2 | Release Order approval and override policy | **Partially resolved** — three payment states confirmed; **approver identity still open** | Q-AUD-21 · remaining item **OQ-06** |
| 1.3 | Delivery Order eligibility rule | **Resolved** — discharged-at-facility scenario | Q-AUD-22 |
| 1.4 | Invoice auto-draft from B/L | **Resolved** — manual + configurable auto creation | Q-AUD-23 |
| 1.5 | Job creation trigger | **Resolved** — manual + configurable automatic | Q-AUD-23 · related **OQ-07** (ETOZ/ETDZ) |
| 1.6 | Party phone/email ownership | **Resolved** — per Shipper/Consignee/Agent | Q-AUD-24 · DEC-073…077 |
| 1.7 | VAT taxability, rates, report scope | **Partially resolved** — per-line VAT confirmed; **which services are taxable and at what rates still open** | Q-AUD-26 · DEC-100…104 |
| 1.8 | Invoice correction flow | **Resolved** — controlled correction workflows | Q-AUD-20 · DEC-019…023 |
| 1.9 | Notifications and alerts | **Resolved** — configurable triggers, in-app + email | Q-AUD-13/14 · DEC-056…058 |
| 1.10 | Archive retention and re-opening | **Resolved as design**; **retention periods still open** (compliance input) | Q-AUD-25 · remaining item **OQ-12** |
| 1.11 | Document template content and formats | **Still open** — official templates not supplied | Q-AUD-06 / SRC-07 · remaining item **OQ-08** |
| 1.12 | Agent extra capabilities | **Resolved** — portal is agents-only; destination-scoped B/L + Release visibility | Q-AUD-16 · DEC-073…077 |

**Note on §1.7 and §1.10.** Both are resolved *as architecture* but retain an open **business input**
(taxable services/rates; retention periods). They are configuration, not blockers: the mechanisms are built
with the values supplied later.

---

## 1. Decisions that affect implementation

### 1.1 B/L lifecycle and release modeling

Impact: B/L status fields, release field/concept, UI, and downstream ReleaseOrder integration.

Current state: target expects Draft, Final/Approved, and separate release permission, but exact status names and release modeling are not fully confirmed.

Can implementation proceed: yes, with configurable design and explicit decision record.

### 1.2 Release Order approval and override policy

Impact: ReleaseOrder eligibility, override fields, and audit trail.

Current state: no money, no cargo principle is confirmed; exact partial payment, credit, and approver rules are not confirmed.

Can implementation proceed: yes, with configurable eligibility and audit, without hard-coding final policy.

### 1.3 Delivery Order eligibility rule

Impact: DeliveryOrder creation rules.

Current state: not fully confirmed.

Can implementation proceed: yes, with independent eligibility design awaiting confirmation.

### 1.4 Invoice auto-draft from B/L

Impact: Invoice creation flow.

Current state: employer mentioned invoice from issued B/Ls, but exact automation level is not fully confirmed.

Can implementation proceed: yes, with manual and assisted flows supported.

### 1.5 Job creation trigger

Impact: when Jobs are created and by what event.

Current state: not fully confirmed.

Can implementation proceed: yes, with manual and optional automated creation.

### 1.6 Party phone/email ownership

Impact: Shipper/Consignee/Agent/Customer contact field design.

Current state: not fully confirmed.

Can implementation proceed: yes, with optional fields and no forced contact model.

### 1.7 VAT taxability, rates, and report scope

Impact: Invoice VAT defaults, VAT report scope.

Current state: per-line VAT is required; taxable services and rates are not confirmed.

Can implementation proceed: yes, with configurable VAT and no invented rates.

### 1.8 Invoice correction flow

Impact: invoice cancel/reissue vs credit note.

Current state: not confirmed.

Can implementation proceed: yes, with cancellation and audit trail, and a decision point for credit note later.

### 1.9 Notifications and alerts

Impact: alert system scope.

Current state: employer wants alerts for overdue and partial payment, but trigger list, channels, and templates are not confirmed.

Can implementation proceed: yes, with event hooks and minimal alerts, deferring full notification system.

### 1.10 Archive retention and re-opening

Impact: archive policy and immutability exceptions.

Current state: archive concept confirmed; retention and re-opening not confirmed.

Can implementation proceed: yes, with explicit archive metadata and configurable policy.

### 1.11 Document template content and formats

Impact: template upload and rendering.

Current state: company templates expected; exact content not confirmed.

Can implementation proceed: yes, with template support and no invented wording.

### 1.12 Agent extra capabilities

Impact: agent portal scope.

Current state: destination-scoped B/L and Release visibility confirmed; further capabilities not confirmed.

Can implementation proceed: yes, with locked minimum and explicit extension points.

## 2. Decisions that do not block Phase 2 start

- B/L/Manifest party cutover plan can be drafted without inventing final lifecycle wording.
- Voyage numbering approach can be finalized as per-destination with a technical format decision.
- Vessel type and tug/barge modeling can be implemented as a technical decision.

## 3. Decision record requirement

Every business decision that affects schema, API, or UI must be recorded in an implementation log or decision file before the affected work is marked complete.
