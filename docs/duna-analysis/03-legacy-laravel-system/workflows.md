# Legacy Laravel — Workflows

> How the business process actually runs **in the legacy code**, step by step.
>
> ⚠️ **Read [`../01-employer-statements/business-processes.md`](../01-employer-statements/business-processes.md)
> alongside this file.** The legacy flow and the employer's described flow differ in one important
> respect — see §2.

---

## 1. End-to-end legacy flow

```
 1. Port created                 /admin/loading-list/ports      (title + abbreviation)
 2. Yard created                 /admin/loading-list/yards      (port + name)
 3. Shipper / Consignee / Agent  /admin/manifests/{shipper|consignee|agents}
 4. Customer created             /admin/users/create | /admin/new-customer
        └─ user_code = 'CUST00' . (lastId+1)
 5. CARGO INTAKE                 /admin/loading-list/new
        fields: POL, POD, Yard, Customer, Showroom, CH.No, QTY, QTY Descr,
                Net, Gross, Measurement, Loading status, Inspection status,
                Arrival date, Loading date, Description, Note
 6. MANAGEMENT REVIEW            admin_status: PENDING → APPROVED
        (a legacy-only gate the employer never asked for)
 7. INSPECTION                   inspection_status: PENDING → DONE | LOCAL | NONEED
 8. LOAD LIST                    /admin/loading-list/list  → preview → print
 9. LOADING OUTCOME              loading_status: INYARD → LOADED
        not-loaded cargo stays INYARD, i.e. returns to inventory
10. MANIFEST CREATED             /admin/manifests/create
        ├─ vessel + voyage are free-text strings
        ├─ voyage counter comes from the Portshipper record
        ├─ parties (shipper/consignee/agent) are set at MANIFEST level
        └─ cost columns: gas, lashing, shipper, pod, pol
11. CARGO ATTACHED TO MANIFEST   Loading.manifest_id set
12. B/L CREATED                  /admin/manifests/bl/create
        ├─ created AGAINST a manifest (ManifestController@createbl)
        ├─ vessel/voyage copied from the manifest
        ├─ parties defaulted from the manifest
        ├─ status := PENDING   (never becomes RELEASED — defect D1)
        └─ bl_status := '-' | 'SURRENDERED'
13. B/L PREVIEW / PRINT          /admin/manifests/bl/preview/{id}
14. MANIFEST PREVIEW / PRINT     /admin/manifests/preview/{id}
15. INVOICE CREATED              /admin/invoices/create
        ├─ picks a customer and optionally a B/L
        ├─ lines posted as "qty~~descr~~unit~~vat" strings
        └─ status := UNPAID
16. INVOICE ATTACHED TO B/L      attachBLManifest() propagates manifest_id
                                 from the B/L to its invoices
17. LEDGER ROW WRITTEN           Fin row, type='invoice', debit = total
18. PAYMENT RECEIVED             /admin/ledger/submit-reciept
        └─ Fin row, type='reciept', credit = amount
19. PAYMENT MADE                 /admin/ledger/submit-payment
        └─ Fin row, type='payment', debit = amount, ID_doc uploaded
20. BALANCE RECOMPUTED           CalculateDebitCredit() → users.debit / users.credit
21. LEDGER STATEMENT             /admin/ledger/preview  (date range)
22. RELEASE MANAGER              /admin/release-manager — VIEW ONLY (defect D1)
23. MANIFEST REPORT (P&L)        /admin/manifest-report
```

---

## 2. The one structural divergence from the employer's description

| | Employer's flow | Legacy flow |
|---|---|---|
| Order | **B/L first**, then the Manifest consolidates issued B/Ls (`EMP-024`–`EMP-027`, `EMP-567`, `EMP-568`) | **Manifest first**, then B/Ls are created against the manifest (`ManifestController@createbl`) |
| Parties | Set per B/L; the manifest inherits them | Set at **manifest level**; B/Ls default from the manifest |
| Consequence | A manifest is a *downstream consolidation* | A manifest is an *upstream container* |

This matters because:
- The employer's co-loading requirement (`REQ-107` — partner B/Ls with different formats on one
  manifest) is much harder in the legacy shape: a B/L cannot exist without a manifest, and its
  parties are inherited.
- The legacy shape also makes "one manifest per voyage" a container relationship rather than a
  consolidation result.

The current system has already reversed this: `ADR-045` / `ADR-047` establish that the Manifest is a
downstream consolidation of **approved** B/Ls — i.e. the employer's order.

---

## 3. Status machines actually implemented

### 3.1 Loading (cargo)

| Field | Values | Transitions seen in code |
|---|---|---|
| `admin_status` | `PENDING` → `APPROVED` | Management review (`loadings.adminapprove`) |
| `inspection_status` | `PENDING` → `DONE` \| `LOCAL` \| `NONEED` | Set on the intake form / edit form |
| `loading_status` | `INYARD` → `LOADED` | Set on the intake form / edit form |

**Two of the three are set by a plain form field, not a workflow action.** There is no "book
inspection" step, no inspection record, and no inspection history — just a status value on the cargo
row. Contrast `REQ-080` (inspection is booked and paid for) and the new system's `Inspection` ledger
model with `PENDING → BOOKED → DONE → FAILED → NEEDS_REINSPECTION`.

### 3.2 Bill of Lading

| Field | Values | Transitions |
|---|---|---|
| `status` | `PENDING` | **Only ever set to PENDING.** `RELEASED` is defined but never written |
| `bl_status` | `-` \| `SURRENDERED` | Set on the create/edit form |

The Release Manager screen displays `status` and offers **no action to change it**. Release is
therefore a **display-only** concept in the legacy system.

### 3.3 Invoice

| Field | Values |
|---|---|
| `status` | `UNPAID` → `PAID` (toggled manually via `change-payment`) |

No `PARTIAL` state — so partial payments cannot be represented on an invoice, only as a credit on the
ledger (`REQ-149` is unsatisfied).

### 3.4 Manifest

No status machine. A manifest exists or it does not; there is no draft/issued/approved lifecycle.

---

## 4. Propagation and side effects

| Trigger | Side effect |
|---|---|
| Create B/L against manifest | Copies `vessel`, `voyage`, parties from the manifest |
| Attach B/L to manifest (`attachBLManifest`) | Propagates `manifest_id` from the B/L to **its invoices** |
| Detach (`detachManifest`) | Reverses the propagation |
| Any ledger write | `CalculateDebitCredit()` recomputes `users.debit` / `users.credit` |
| Any manifest write | `total_unit` / `total_weight` recomputed from items |
| Any invoice write | `total`, `totalvat`, `btotal` recomputed from lines |
| Delete manifest | Cascades to B/Ls and their items |
| Delete role | Reassigns its users to the hard-coded role id 8 |

---

## 5. What the legacy workflow cannot express

| Employer requirement | Why the legacy flow cannot do it |
|---|---|
| `REQ-082` inspection gates the load list | The load-list selection code does not check `inspection_status` at all |
| `REQ-092` load list edited next day | Load lists can be edited, but there is no "append and re-print" flow as described |
| `REQ-105` draft B/L with DRAFT watermark | No draft state; `bl_status` has no `DRAFT` value |
| `REQ-107` partner B/Ls on one manifest | B/Ls must belong to a manifest and inherit its parties |
| `REQ-130` job costing | No Job entity |
| `REQ-141` invoice auto-drafted from issued B/Ls | Invoices are created manually; the B/L link is optional |
| `REQ-165` unallocated payment | Supported by accident — the ledger form simply does not require an allocation |
| `REQ-168` ID-card capture | Only on the **payment** ledger form (`Fin.ID_doc`); not on receipts, not on salary |
| `REQ-180`–`REQ-184` release workflow | Release Manager is view-only |
| `REQ-185` delivery order | No such document |
| `REQ-187` agent portal | Only an unscoped customer portal |

---

## 6. Legacy-only behaviours (not employer requirements)

Recorded so they are not mistaken for business rules:

| Behaviour | Assessment |
|---|---|
| `admin_status` management review gate on cargo | **Legacy only.** The employer never asked for a management approval step on cargo intake |
| Two customer-creation paths | **Legacy only.** An artefact of a shortcut form |
| Voyage counter keyed on port + shipper | **Legacy only.** Consequence of having no Vessel master |
| Random number components | **Legacy only.** Placeholder implementation |
| Five fixed manifest cost columns | Possibly a genuine legacy convention; the employer named a different set (`REQ-191`) |
