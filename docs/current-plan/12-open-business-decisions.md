# 12 Open Business Decisions

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
