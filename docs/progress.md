# Progress

## Completed
### Phase 20 — Agent Portal (completed)

- **Model:** `BookingRequest` (auto `BRK-YYMM-#####`, customer link, cargo description ≤255, optional origin/destination ports, requested ship date, containers, weightKg, notes, status PENDING/ACCEPTED/DECLINED/CANCELLED, responseNote + handledBy/At stamps, soft delete) + `User.portalCustomerId` (nullable **unique** FK → one portal login per company) + `Customer.portalUsers` back-relation. Migration `20260913210526_phase20_agent_portal` (diff→deploy recipe).
- **Lifecycle (ADR-040):** agent submits → PENDING; office `POST /bookings/:id/respond` ACCEPTED|DECLINED (single-shot 409, responseNote); agent `POST /portal/bookings/:id/cancel` PENDING-only (409 after), cross-company 404. No edit route — corrections are cancel + resubmit. No auto-conversion to jobs/invoices in v1.
- **API:** `/portal` (class `portal:access`): GET me (company + summary: bookingsTotal/pending/approvedManifests/balanceDue), GET/POST bookings (`booking:create` on POST, BRK numbering), POST cancel (`@HttpCode(200)`), GET shipments (manifests where `agentId` = company, voyage ETD/ETA), GET statement (existing derived ledger passed through), GET ports (booking-form dropdown; `/ports` needs `port:read` which portal roles must not carry). Office desk `/bookings`: list (search/status/company filters) + detail + respond (`booking:read`/`booking:respond`). All portal reads resolve the company **server-side from the JWT** — no customerId is ever accepted from the request (IDOR-proof). 4 permissions seeded (147 total), ADMIN auto-grant.
- **E2E:** `portal.e2e-spec.ts` 13 tests (RBAC matrix + missing booking:create guard, unlinked 403, me/summary, BRK numbering, unknown port 400, company-scoped lists, cross-company cancel 404 + 409, shipments scoping, statement passthrough, ports dropdown source, office desk list/detail/respond + stamps + single-shot 409, filters). Portal 13/13 green.
- **Shared:** `packages/shared/src/portal.ts` — BookingStatus, BookingRequest (incl. customerId + port/customer refs), BookingListResult, PortalMe/PortalCustomer/PortalSummary, PortalShipment (voyage ETD/ETA + timeline), PortalStatement; `auth.ts` UserListItem += portalCustomerId/portalCustomer.
- **Web:** `/portal` (agent self-service: company header + 4 summary cards, tabs bookings/shipments/statement, create dialog with port dropdown + ≤255 validation, cancel while PENDING; gated by `useAuth().user.permissions`); `/bookings` office desk (filters, respond dialog ACCEPTED/DECLINED + note, detail with route/timeline). Nav: **bookings** in operations (CalendarCheck, `booking:read`) + new **portal** group (Globe, `portal:access`). Users page: portal-company select in create/edit dialogs (link/unlink). i18n `portal`/`bookings`/`booking` namespaces (~99 keys) ×3 via `scripts/merge-portal-i18n.py`; web tsc clean.
- **Demo seed:** `scripts/seed-portal-demo.mjs` — AGT-P20DEMO agent company, PORTAL-AGENT role, `agent@portal.local` linked login, 4 bookings in every state via the real API, DRAFT manifest re-agented (shipments tab), one ISSUED invoice (statement tab); idempotent guard.
- **Smoke:** fa/en/ar `/portal` + `/bookings` 200, zero raw keys; API RBAC verified (401 anonymous / 403 without portal:access).

### Phase 19 — Discharge (unloading at destination, mirror of Actual Loading) (completed)

- **Model:** `Discharge` (auto `DIS-YYMM-#####`, `@@unique([actualLoadingId])` — one per completed loading, status NOT_STARTED/IN_PROGRESS/COMPLETED/CANCELLED, actor+time stamps for complete/cancel, notes, soft delete) + `DischargeItem` (`@@unique([dischargeId, actualLoadingItemId])`, cargoId, `expectedQuantity` snapshot from the recorded loading, `dischargeQuantity`, result NOT_DISCHARGED/FULL/PARTIAL, notes). Migration `20260913200811_phase19_discharge`.
- **Lifecycle (ADR-039):** create only from a **COMPLETED Actual Loading** (409 otherwise); what was actually loaded is what should arrive — lines pre-populate with `expectedQuantity` = loaded quantity (NOT_LOADED lines are excluded; empty loading → 400). NOT_STARTED → start → IN_PROGRESS → complete (FULL lines flip `cargo.status → DELIVERED`, the documented LOADED→DELIVERED edge; shortfall lines stay put and remain visible as PARTIAL/NOT_DISCHARGED). CANCELLED requires a reason; terminal states freeze lines (update 409). Quantity above expected → 400.
- **API:** `/discharges` CRUD + start/complete/cancel + per-line `PUT items/:itemId`; list filters search (discharge/AL/voyage/vessel/destination-port) + status + voyageId + customerId + createdFrom/To; list rows carry computed expectedTotal/dischargedTotal/partialCount; 6 permissions `discharge:*` seeded, ADMIN auto-grant.
- **E2E:** `discharge.e2e-spec.ts` 21 tests (RBAC matrix, source gating, pre-population + totals, one-per-loading unique, over-quantity 400, start-first complete guard, DELIVERED flip on FULL lines, PARTIAL keeps prior status, cancel freeze, second-discharge-after-terminal re-create guard, filters, detail, tagged cleanup). 21/21 green.
- **Web:** `/discharges` — filters, list with expected/discharged/partial column + status badge, create dialog picking a COMPLETED loading not yet discharged, detail dialog with per-line quantity editor (clamped to expected), start/complete/cancel/delete actions, totals strip, audit stamps. nav **Operations** group, PackageMinus icon, `discharge:read` gate. i18n `discharge` (55 keys) + nav ×3 via `scripts/merge-discharge-i18n.py`; web tsc clean.
- **Demo seed:** `scripts/seed-discharge-demo.mjs` — 3 discharges over the demo loadings: full discharge to DELIVERED (2 lines), completed shortfall (7 of 8 → PARTIAL), fresh NOT_STARTED (IN_YARD cargo untouched); idempotent guard.
- **Smoke:** fa/en/ar `/discharges` all 200, zero raw keys.

### Phase 18 — Jobs & Job Costing (completed)

- **Model:** `Job` (auto `JOB-YYMM-#####`, title, jobType free-text VarChar(60), optional customer/voyage links, currencyCode default USD, status DRAFT/OPEN/COMPLETED/CANCELLED, openingDate, completedBy/At, cancelledBy/At + cancelReason, notes, soft delete) + `JobCostItem` (kind INCOME|COST, category, description, amount Decimal, itemDate, notes). Migrations `phase18_jobs` + jobType add-column.
- **Lifecycle (ADR-038):** DRAFT → `start` → OPEN → `complete` → COMPLETED; `cancel` (mandatory `cancelReason`) from DRAFT|OPEN; delete DRAFT-only. Header edits DRAFT-only; cost lines editable DRAFT|OPEN, frozen after completion.
- **API:** CRUD + item sub-resource (add/update/remove, `@HttpCode(200)` on item routes, create 201) + start/complete/cancel; totals `totalIncome`/`totalCost`/`profit` computed read-time in flatten; list filters search (number/title/customer) + status + customerId + jobType + voyageId + sort; 7 permissions (`job:*`) seeded, ADMIN auto-grant.
- **E2E:** `job.e2e-spec.ts` 14 tests (RBAC matrix, numbering, inline items + totals, item CRUD with recalc, DRAFT-only header edit, start/complete freeze, cancel gating + reason, DRAFT-only delete, filters). Jobs 14/14 green.
- **Shared:** `packages/shared/src/job.ts` — Job, JobItem, JobStatusValues, JobKindValues, JobListResult, JobCustomerRef, JobVoyageRef (`voyageNumber`, nested `vessel.name` matching service select).
- **Web:** `/jobs` — search + status filter, list with per-job income/cost/profit (colored, currency-tagged), create/edit dialog (type/currency/customer/voyage selects), detail dialog with costing-lines table (add/edit/remove while DRAFT|OPEN), lifecycle actions (Open/Complete/Cancel-with-reason/Delete), audit stamps. Nav: **jobs** item in operations group (Briefcase icon). i18n `jobs` (80 keys) + nav ×3 via `scripts/merge-jobs-i18n.py`; web tsc clean.
- **Demo seed:** `scripts/seed-jobs-demo.mjs` — IMPORT_CLEARANCE DRAFT (negative-WIP demo), EXPORT OPEN (post-open cost line), TRANSIT COMPLETED (profitable), CUSTOMS CANCELLED (reason); idempotent guard.
- **Smoke:** fa/en/ar `/jobs` all 200, zero raw keys.

### Phase 17 — Letters / Correspondence register (completed)

- **Model:** `Letter` (auto `LET-YYMM-#####`, direction INCOMING/OUTGOING, status DRAFT→SENT / RECEIVED / ARCHIVED, letterDate, subject, body, refNumber, from/to contacts, optional customer link, replyToId threading, notes, soft delete). Migration `20260913040329_phase17_letters`.
- **Lifecycle (ADR-037):** INCOMING letters are a fact — created directly as RECEIVED; OUTGOING start DRAFT → `send` stamps actor+time and freezes content (edit/delete DRAFT-only). SENT|RECEIVED → `archive` (terminal). `POST /letters/:id/reply` one-click reply: OUTGOING DRAFT with `Re:` subject, mirrored contacts, threaded replyToId.
- **API:** CRUD + send/reply/archive; list filters search (number/subject/ref/contacts/customer) + status + direction + replyToId + customerId; 6 permissions (`letter:read/create/update/delete/send/archive`) seeded, ADMIN auto-grant.
- **E2E:** `letter.e2e-spec.ts` 15 tests (RBAC matrix, numbering, forced RECEIVED, freeze-after-send, transitions, reply threading + repliesCount, filters, delete gating, tag-scoped hard cleanup). Letters 15/15 green.
- **Web:** `/letters` — filters, list with direction icons + thread indicator + repliesCount, create/edit/reply dialog, detail dialog with reply-thread box + audit stamps, DRAFT edit/send/delete and active-state archive actions. New **Correspondence** nav group (Mail icon). i18n `letters` (43 keys) + nav ×3 via `scripts/merge-letters-i18n.py`; web tsc clean.
- **Demo seed:** `scripts/seed-letters-demo.mjs` — arrival notice (INCOMING→RECEIVED, threaded), doc release request (SENT), one-click reply on the arrival notice (Re:, SENT), fresh detention-waiver DRAFT, archived rate-amendment notice; idempotent guard.
- **Smoke:** fa/en/ar `/letters` all 200, zero raw keys, sidebar group renders.

### Phase 16 — Employees & Salary/Payroll (completed)

- **Employee master data:** `Employee` model (code auto `EMP-#####`, nationalId unique-optional, position, contact, hireDate, baseSalary + currency default, status ACTIVE/INACTIVE, soft delete). Deleting an employee with payslips is blocked 409.
- **Payslip lifecycle:** `SalaryRecord` (number `SAL-YYMM-#####`, `@@unique(employeeId, year, month)` → duplicate period 409). `DRAFT → APPROVED (approve) → PAID (pay with paymentMethod CASH/BANK_TRANSFER/CHEQUE/OTHER + optional paymentRef)`; `DRAFT|APPROVED → CANCELLED` with required reason; PAID terminal; delete DRAFT-only. All transitions stamp actor+time (`approvedBy/At`, `paidBy/At`, `cancelledBy/At`).
- **Math server-computed:** `net = base + additions − deductions`; base prefilled from the employee's baseSalary when a payslip is created with the employee's period empty; negative net rejected 400.
- **Self-contained payout (ADR-036):** pay() records the payment fact on the payslip only — no voucher/ledger posting, because `Voucher.customerId` is customer-centric (ADR-032) and posting salaries to the customer ledger would contaminate receivables and break multi-currency aggregation. `paymentMethod`/`paymentRef`/`paidAt` carry the audit trail; voucher integration deferred.
- **Shared types:** `Employee/ListResult`, `SalaryRecord/ListResult` with `employee` nested ref and `createdByName`.
- **API:** `/employees` (CRUD, list filters search/status) + `/salary-records` (list filters search/status/year/month/employeeId + approve/pay/cancel lifecycle). 11 new permissions (`employee:*` 4, `salary:*` 7) seeded; role grants via matrix.
- **E2E:** `salary.e2e-spec.ts` 9 tests (auto-code, 422, duplicate period 409, approve/pay audit + method, cancel-with-reason + audit, employee delete guard, filters, pagination cap). **Full suite 16 suites, 213/213 green.**
- **Web:** `/employees` (list + create/edit dialog + delete guard messaging, status filter, pagination) and `/salary-records` (filters search/status/year/month/employee; approve/pay-with-method/cancel-with-reason/delete actions; create dialog with employee select prefilling base+currency and live net card; detail dialog with math breakdown + audit timestamps). New nav group **People & Payroll**. i18n `employee` (33 keys) + `salary` (63 keys) + 3 nav keys × fa/en/ar via `scripts/merge-salary-i18n.py`.
- **Demo seed:** `scripts/seed-salary-demo.mjs` — 3 employees (USD/IRR) + 6 payslips spanning DRAFT/APPROVED/PAID/CANCELLED incl. additions/deductions math; idempotent.
- **Typechecks:** api/web tsc 0 errors; smoke fa/en/ar both routes 200 with translated nav/page titles, zero raw keys.


### Phase 15 — Quotations (completed)

**Objective met:** full-stack quotation module — price quotes sent to customers with a
5-state lifecycle (DRAFT→SENT→ACCEPTED/REJECTED/CANCELLED) and one-time conversion of an
accepted quote into a proforma, closing the commercial chain Quote → Proforma → Invoice.

- Prisma: `Quotation`, `QuotationItem` (+ `QuotationStatus`), migration `20260913005121_phase15_quotations`; `linkedProformaId` unique FK to proformas (one-time conversion guard); full audit actor columns (sentBy/acceptedBy/rejectedBy/cancelledBy + timestamps + reasons); 9 permissions (`quotation:read/create/update/delete/send/accept/reject/cancel/convert`)
- Same money math as Invoice/Proforma (subtotal = SUM(items), tax = (subtotal − discount) × rate, recomputed server-side on every write)
- Lifecycle guards: send needs ≥1 line and freezes the document; accept/reject only from SENT; cancel from DRAFT|SENT; reject/cancel require a reason; delete hard-removes DRAFT only (other rows keep the audit trail)
- **Convert (ADR-035):** `POST /quotations/:id/convert` requires ACCEPTED + `quotation:convert`; copies header + lines into a fresh DRAFT proforma (own PRF number, totals recomputed) and stamps `linkedProformaId` (second attempt 409); list filter `?convertible=true`
- NestJS: `modules/quotation` (dto/service/controller/module); API typecheck clean; item routes return the full quotation row (totals visible) with @HttpCode(200)
- e2e: 11 tests — RBAC matrix, create with inline items + totals math, line CRUD recompute, send guards/freeze/terminal 409s, accept+reject perms and reason gating, convert 403/409/400 guards + copied totals verified via GET /proformas/:id, re-convert 409 + convertible filter, DRAFT-only delete; tag-scoped Prisma cleanup in afterAll; **full suite 15 suites, 204/204 green**
- Web: `/quotations` page (fa/en/ar, RTL) — status + convertible filters, create dialog with inline line editor and live totals, detail with lines table, per-status row actions (send/accept/reject/convert/cancel), reject/cancel reason dialogs, convert result dialog; nav `quotations` activated
- i18n: `quotation` namespace 72 leaves × 3 locales (`scripts/merge-quotation-i18n.py`)
- Demo: `scripts/seed-quotation-demo.mjs` — QT-2609-00001 full chain SENT→ACCEPTED→converted to PRF-2609-00004, QT-2609-00002 SENT past validUntil, QT-2609-00003 REJECTED with reason, QT-2609-00004 DRAFT IRR
- Smoke: `/quotations` 200 in fa/en/ar, SSR translations render, zero raw-key leaks

## Phase 14 — Proforma Invoices (completed)

**Objective met:** full-stack quote module — proforma documents with the same
line/totals math as Invoice but zero financial effect, and one-time conversion
into a real DRAFT invoice.

- Prisma: `Proforma`, `ProformaItem` (+ `ProformaStatus`), migration `20260912233657_phase14_proforma`; `linkedInvoiceId` unique FK to invoices (one-time conversion guard); 7 permissions (`proforma:read/create/update/delete/issue/cancel/convert`)
- Same money math as Invoice: `subtotal = SUM(items.amount)`, `taxAmount = (subtotal − discount) × taxRate/100`, `totalAmount = subtotal − discount + taxAmount` — recomputed on every write; `validUntil` quote expiry (proforma-specific)
- Lifecycle `DRAFT → ISSUED | CANCELLED` (cancel requires reason, terminal); DRAFT-only header/line edits + delete; issue freezes the document
- **Convert (ADR-034):** `POST /proformas/:id/convert` — allowed from DRAFT or ISSUED, never CANCELLED; copies header + items into a new DRAFT invoice with its own `INV-YYMM-#####` number and recomputed totals; stamps `linkedInvoiceId` (second attempt 409)
- Endpoints mirror Invoice: list (search/status/customer/unconverted filters), CRUD, item add/update/remove, issue, cancel, convert
- NestJS: `modules/proforma` (dto/service/controller/module); API typecheck clean
- e2e: 9 tests — RBAC rows, inline-items create + totals math, line CRUD recompute, issue + frozen-after-issue, convert (403 w/o perm, copied lines/totals verified), re-convert 409, unconverted filter, cancel terminal, empty-issue 400, delete perm gating; tag-scoped Prisma cleanup in afterAll (no leaked roles/users/customers — the Phase 12 leak lesson); **full suite 14 suites, 193/193 green**
- Web: `/proformas` page (fa/en/ar, RTL) — list + filters + unconverted toggle, create dialog with inline line editor + live totals card, detail with lines table, issue/convert/cancel flows, convert result dialog; nav `proformas` activated
- i18n: `proforma` namespace 63 leaves x 3 locales (`scripts/merge-proforma-i18n.py`)
- Demo: `scripts/seed-proforma-demo.mjs` — PRF-2609-00001 ISSUED → converted to INV-2609-00008 (DRAFT), PRF-2609-00002 ISSUED unconverted, PRF-2609-00003 DRAFT AED; purge utility run to clear earlier e2e residue
- Smoke: `/proformas` 200 in fa/en/ar with SSR translations

### Phase 13 — Delivery Orders & Release Orders (completed)

**Objective met:** the cargo hand-over chain closer — D/O (who physically receives cargo) and
R/O (permission to leave the yard/port) against ISSUED B/Ls, with the "no money, no cargo" hold.

- Prisma: `DeliveryOrder`, `ReleaseOrder` (+ `DeliveryOrderStatus`), migration `phase13_delivery_release_orders`; 12 permissions (`delivery:read/create/update/delete/cancel`, `release:read/create/update/delete/cancel`, `release:override`)
- Both documents issued directly (no DRAFT: `ISSUED → CANCELLED` only, cancel requires reason; delete only after cancel); numbering `DO-YYMM-#####` / `RO-YYMM-#####`; one active D/O (or R/O) per B/L enforced app-level (409)
- R/O money rule (ADR-033): all ISSUED invoices on the B/L must be fully paid; zero invoices = allowed; breach = 409 listing outstanding. Authorized override (`release:override` perm + mandatory reason) stamps `financialOverride` + reason for audit
- Endpoints: D/O + R/O CRUD/cancel + `GET /release-orders/eligibility?billOfLadingId=` (live canRelease / needsOverride / billed / paid / outstanding used by the create dialog)
- NestJS: `modules/delivery-release` (2 controllers, 1 service, 1 module); API typecheck clean
- e2e: 10 tests (`delivery-release.e2e-spec.ts`) — full fixture chain to ISSUED B/L + invoice, RBAC rows, DRAFT-B/L 409, duplicate-active 409, money-rule 409 + override-reason 403/409 paths, override success, settle-then-release, cancel/delete gating; **full suite 13 suites, 184/184 green**
- Web: `/delivery-orders` + `/release-orders` (fa/en/ar, RTL) — create dialog with live eligibility card, force+reason override flow, cancel-with-reason, delete-after-cancel; nav `delivery` + `release` activated
- i18n: `deliveryOrder` (35 leaves) + `releaseOrder` (45 leaves) namespaces x 3 locales (`scripts/merge-delivery-release-i18n.py`)
- Demo: `scripts/seed-delivery-release-demo.mjs` — happy path (DO-2609-00001 + RO-2609-00001 settled on BOL-2609-00001) + override path (BOL-2609-00002 issued, blocked 409 outstanding 2189.25, RO-2609-00002 force+reason, DO-2609-00002); 2 D/O + 2 R/O
- Smoke: all 6 locale/page combinations 200 with SSR translations

### Phase 12 — Vouchers & Ledger (completed)

**Objective met:** the finance settlement chain — receipts/payments against invoices + derived customer statements.

- Prisma: `Voucher` (+ `VoucherType`, `VoucherMethod`), migration `20260912190203_phase12_vouchers`; 6 permissions (`voucher:read/create/update/delete/cancel`, `ledger:read`)
- Model: RECEIPT (+) / PAYMENT (−, refund); optional ISSUED-invoice link with same-currency guard; standalone deposits allowed; per-type numbering `RCP-YYMM-#####` / `PMT-YYMM-#####`
- `Invoice.paidAmount` recomputed from live vouchers on every create/update/cancel/delete — never incremented blindly; cancel = reversal with reason (POSTED->CANCELLED terminal), delete only after cancel
- Ledger = derived (no table): `GET /ledger/customers` — customer statement (ISSUED invoices = debit, POSTED vouchers = credit) with opening/running/closing balance, currency + date-window + kind filters
- NestJS: `modules/voucher` + `modules/ledger`; API typecheck clean
- e2e: 13 tests (`voucher.e2e-spec.ts`) — RBAC, settlement, DRAFT-invoice 409, currency mismatch 409, standalone numbering, filters, amount-edit recompute, cancel/second-cancel 409, delete gating, statement math, window/opening collapse
- Web: `/vouchers` (list + filters + create + detail + cancel-with-reason + delete) and `/ledger` (customer statement with debit/credit/balance columns) — fa/en/ar, nav `vouchers` + `ledger` activated
- i18n: `voucher` (47 leaves) + `ledger` (30 leaves) namespaces x 3 locales (`scripts/merge-voucher-i18n.py`)
- Demo: `scripts/seed-voucher-demo.mjs` — 4 vouchers (2 receipts 60%+20% incl. backdated cheque, 1 refund, 1 standalone cash deposit); invoice paid 135/294; statement closing 1,898.25 USD
- Side-fix: purged 30 leaked AL* test roles/users from failed e2e runs (had pushed OPERATIONS off page 1 of role list); auth spec hardened with `?pageSize=100`

### Phase 11 — Invoice (completed)

**Objective met:** full-stack customer billing documents — the accounting chain entry point.

- Prisma: `InvoiceStatus`, `Invoice`, `InvoiceItem` (+ 3 micro-migrations: `phase11_invoices`, `phase11_invoice_totals`, `phase11_invoice_voyage`); title nullable, denormalized voyageId for ops cross-listing
- Shared types `packages/shared/src/invoice.ts`
- NestJS `invoice` module: 6 permissions seeded; INV-YYMM-##### numbering; lifecycle DRAFT -> ISSUED -> CANCELLED (ISSUED frozen, cancel reason kept for audit)
- Line model: description x quantity x unitPrice -> amount maintained server-side; header subtotal / taxRate / taxAmount / discountAmount / totalAmount recomputed on every write
- Filters: `unpaid` (paidAmount < totalAmount on ISSUED), `overdue` (ISSUED + past dueDate + unpaid); optional anchors: customer (required), manifest / billOfLading (optional)
- `/invoices` page (fa/en/ar, RTL): list + status/payment/due filters, create, detail with header edit + line CRUD, totals card, issue/cancel/delete
- Demo seed `scripts/seed-invoice-demo.mjs`: INV-2609-00001 ISSUED (3 lines, B/L anchor, tax+discount), INV-2609-00002 ISSUED overdue, INV-2609-00003 DRAFT
- Tests: 11 new e2e; **full suite 161/161 green**; smoke: filters + detail + 3 locales 200 via proxy
- Note: `paidAmount` stays 0 until Phase 12 (receipt/payment vouchers) writes it

### Phase 10 — Bill of Lading (completed)

**Objective met:** full-stack B/L document module — issue transport documents against APPROVED
Manifests, group a subset of manifest lines per document, freeze line snapshots, and stamp
`ManifestItem.blNumber` on issue (the link the manifest UI already shows). Continues the legacy
duna chain `Loading → Manifest → B/L → Invoice` on the new domain model (B/L after manifest —
deliberate modernization, see ADR-030).

**Design decisions:**

- **ADR-030 — B/L lifecycle + one-live-bill-per-manifest-line.** Server-enforced
  `DRAFT → ISSUED | CANCELLED` and `ISSUED → CANCELLED` (cancel requires `cancelReason`). B/Ls
  can only be created against an **APPROVED** manifest (409 otherwise). A manifest line may
  belong to at most one LIVE (non-cancelled, non-deleted) B/L — enforced at application level
  (soft-delete + cancel release the line; a DB `@@unique` would block release, same pattern as
  Manifest.voyageId). `issue` requires ≥1 line, sets `issuedAt/By`, defaults `dateOfIssue`,
  and stamps `ManifestItem.blNumber = billNumber` in one transaction; `cancel` clears that
  stamp (only rows still stamped with this bill's number).
- Totals (`totalPackages/totalGrossWeight/totalVolume`) recomputed server-side from line
  snapshots on every item write. Line snapshots default from the manifest line (packages,
  packageType, grossWeight) and cargo (`specification` → goodsDescription, `serialNumber` →
  marksAndNumbers) with per-line overrides.

**DB/migration:** `prisma/migrations/20260912130959_phase10_bills_of_lading` — `BlStatus`,
`BlType`, `FreightTerms` enums; `BillOfLading` (unique `billNumber BOL-YYMM-#####`, voyage/party
snapshot refs, freight fields, soft-delete + audit refs) and `BillOfLadingItem` (manifest-item +
cargo refs, frozen document snapshots). Applied; `prisma generate` fresh.

**Permissions (+6):** `bill:read/:create/:update/:delete/:issue/:cancel` — seed idempotent,
ADMIN auto-granted.

**Shared:** `packages/shared/src/bill.ts` — `BillStatus/BillType/FreightTerms`, `BillOfLading(?)`,
`BillOfLadingDetail`, DTOs, `BillEligibleManifestItem`, `BillApiResult`; exported from `index.ts`.

**Backend:** `apps/api/src/modules/bill/` (dto/service/controller/module) registered in
`app.module.ts` — `list` (search + status/billType/manifestId/voyageId/shipper/consignee/date
filters, whitelisted sort), `findById`, `create` (manifest APPROVED guard, snapshot vessel +
default parties from manifest), `update` (DRAFT-only header, string→number coercion for
decimal fields), `remove` (soft-delete DRAFT-only, returns detail), items `add/update/remove`
(DRAFT-only; foreign-line 409, duplicate-live-line 409, totals recompute), `eligible-items`
(manifest lines not on any live bill), lifecycle `issue`/`cancel` (200 POSTs).

**Frontend:** nav B/L flipped `planned` → `implemented` (`/bills`, `bill:read`). New page
`/bills`: list (search/status filters, pagination), create dialog (APPROVED manifest picker +
freight fields), detail dialog (DRAFT-editable header, items table with add/remove,
totals panel, issue/cancel/delete with confirm + reason). Full i18n `bill` namespace
(fa/en/ar — 87 leaves each; ar translated from en, never from fa). Permission-gated.

**Tests:** `apps/api/test/bill.e2e-spec.ts` (13 tests): 401/403 RBAC, create guards (reader 403,
unknown 404, non-APPROVED 409), number format + snapshot, eligible-items, addItem (reader 403,
foreign line 409, duplicate live line 409, snapshot defaults + totals), updateItem/removeItem
recompute, header update coercion, issue (permission 403, empty 400, stamps manifest
`blNumber`, locks editing 409s), cancel (empty reason 400, ISSUED→CANCELLED releases line +
clears stamp, eligible again, terminal 409s), delete (writer 403, soft-delete, list exclusion,
re-create), list filters (status/billType/search).
**Full e2e suite green: 10 suites, 150/150 tests.**

**Verification:** api/web/shared typechecks clean; live smoke via web proxy green
(`/fa/bills` 200, login + `/bills` list through `:3000` proxy); 2 demo bills seeded
(`BOL-2609-00001` ISSUED, `BOL-2609-00002` DRAFT) via `scripts/seed-bill-demo.mjs`.

### Phase 9 — Manifest (completed)

**Objective met:** full-stack Manifest module — the official cargo list per voyage built from
COMPLETED Actual Loading, preserving legacy duna manifest semantics (one per voyage, vessel
snapshot, shipper/consignee/agent parties, cost breakdown, server-computed totals).

**Design decisions:**

- **ADR-029 — Manifest lifecycle + one-per-voyage (application-level).** `DRAFT → SUBMITTED →
  APPROVED`, `DRAFT|SUBMITTED → CANCELLED` (reason required); APPROVED/CANCELLED terminal.
  One LIVE manifest per voyage enforced via `findFirst(voyageId, deletedAt: null)` — DB
  `@@unique(voyageId)` would conflict with soft-delete (deleted draft would hold the voyage
  slot forever); `@@index(voyageId)` + service guard is authoritative.
- Only cargo from a COMPLETED Actual Loading on the manifest's voyage is eligible
  (`eligible-cargo` endpoint); item `quantity` snapshots the ACTUAL loaded quantity
  (`actualQuantity ?? cargo.quantity`), not the nominal cargo quantity.
- Totals recomputed server-side from item snapshots on every write; costs validated with
  string→number `@Transform` coercion (union `number | null` breaks `emitDecoratorMetadata`
  implicit conversion).

**DB/migrations:** `20260911224819_phase9_manifest` (tables) + `20260912002614_manifest_voyage_
unique_softdelete` (`@@unique(voyageId)` → `@@index(voyageId)`). Permissions (+7):
`manifest:read/:create/:update/:delete/:submit/:approve/:cancel`.

**Shared:** `packages/shared/src/manifest.ts` (177 lines) + exports. **Backend:**
`apps/api/src/modules/manifest/` (dto 257 / service 650 / controller / module) registered in
`app.module.ts`; `eligible-cargo` returns flat `{...cargo, actualLoadingItemId}` matching the
shared type; delete endpoints return 200+body (client `api.del` throws on empty body).

**Frontend:** nav Manifest → `implemented` (`/manifest`, `manifest:read`); page `/manifest`
(list/search/filters/pagination, create dialog, detail dialog with items + costs + lifecycle
buttons); i18n `manifest` namespace fa/en/ar (104 leaves each). **Tests:** 13 e2e tests; full
suite green at time of delivery. Demo: 3 manifests (`MAN-2609-00001..3`) via
`scripts/seed-manifest-demo.mjs` (full chain cargo→inspection→load list→actual loading).

**Ops fix:** apps/api config factory now searches upward for the repo-root `.env`
(`nest start --watch` runs with cwd=apps/api) — root `pnpm dev` reliably starts both web and
api now (was the root cause of the "ApiError: Request failed" dashboard outage).
Also fixed: `Cargo.normalize` now returns derived `inYard` (inventory relation) mirroring the
`inYard` list filter — contract bug surfaced by the demo data (cargo-inventory e2e).

### Phase 7 — Load Planning / Load Lists (completed)

**Objective met:** full-stack Load Planning — stowage of approved cargo onto a voyage through DRAFT →
FINALIZED | CANCELLED Load Lists, with server-enforced eligibility (APPROVED inspection, not cancelled,
not already assigned to the voyage), RBAC and the `/load-lists` frontend. Consumed the Phase 5 readiness
contract and the Phase 6 vessel/voyage references. Actual Loading (Phase 8) builds on Finalized lists.

- **Backend** `apps/api/src/modules/load-planning/` — Load List list (search + status/voyageId/
  createdFrom/createdTo filters + whitelisted sort incl. `finalizedAt`), eligible-cargo endpoint
  (APPROVED + not-yet-assigned), create (voyage DRAFT/SCHEDULED only), update, soft-delete, add /
  bulk-add items (planned quantity ≤ cargo quantity, cargo eligibility), finalize, cancel (reason
  required). `LoadListStatus` DRAFT → FINALIZED | CANCELLED; FINALIZED terminal.
- **Schema/permissions:** `LoadList`/`LoadListItem` models (Phase 7 migration applied);
  `load_list:read/:create/:update/:delete/:finalize/:cancel` seeded (55 total at the time).
- **Frontend:** `/load-lists` (list + detail + eligible-cargo selector + add/finalize/cancel +
  planned-quantity entry), nav flipped to `implemented`.
- **Note (Phase 8 audit):** several `/load-lists/${…}` strings in the load-lists page were written with
  single quotes (no interpolation) — a pre-existing Phase 7 defect flagged during the Phase 8 handover;
  left in place per the Phase-7-freeze rule, still to be fixed in a Phase 7 patch.

### Phase 8 — Actual Loading (completed)

**Objective met:** full-stack Actual Loading execution — record actual loaded quantities against a
finalized Load List, drive per-item FULL/PARTIAL/NOT_LOADED results, and transition the operation through
a server-enforced `NOT_STARTED → IN_PROGRESS → COMPLETED | CANCELLED` lifecycle, with RBAC, e2e tests and
documentation. This is the cargo-loading execution counterpart to Phase 7 load planning and drives cargo
`LOADED` + yard departure (ADR-028). Hard-stopped before Phase 9 (Manifest / Bill of Lading). No DB reset,
no admin-credential change, no weakening of auth/RBAC; CORS remains a scoped allow-list.

**Design decisions:**

- **ADR-028 — Actual Loading lifecycle + one-per-load-list + loadout integration.** Server-enforced
  `NOT_STARTED → IN_PROGRESS → COMPLETED` (`start`/`complete` action POSTs, 200) plus `CANCELLED` from
  `NOT_STARTED`/`IN_PROGRESS` with mandatory `cancelReason`. `ActualLoading.loadListId @@unique` (one run
  per Load List → duplicate 409); create requires the Load List **FINALIZED** + non-empty (409/400).
  `actualQuantity` is per-item unique, non-negative, ≤ `plannedQuantity`; result derived
  (`0→NOT_LOADED`, `≥planned→FULL`, else `PARTIAL`). Server re-validates cargo inspection (must be
  APPROVED) and non-cancelled state on every item write and on complete. Completing sets `cargo
  loadingStatus = LOADED` and deletes the `YardInventory` record for FULL items in one transaction
  (ADR-020 model); PARTIAL/NOT_LOADED cargo stays in the yard.

**DB/migration:** `prisma/migrations/20260909030420_phase8_actual_loading` creates `ActualLoadingStatus`
and `LoadingResult` enums, `ActualLoading` (unique `actualLoadingNumber`, `@@unique(loadListId)`,
status/completedAt/cancelledAt/soft-delete + audit user refs) and `ActualLoadingItem` (unique
`loadListItemId`, `@@unique(actualLoadingId, loadListItemId)`, `result` default `NOT_LOADED`). Applied on
`migrate deploy`; `migrate status` up to date (9 migrations); `prisma validate` valid. Client regenerated.

**Permissions (61, +6):** `actual_loading:read/:create/:update/:delete/:complete/:cancel` added to the
seed; ADMIN binds them automatically. Idempotent seed re-run logs `Permissions seeded: 61`.

**Shared:** `packages/shared/src/actual-loading.ts` — `ActualLoadingStatus`, `LoadingResult`,
`ActualLoading`, `ActualLoadingItem` (with nested `loadListItem` planned/sequence + `cargo`),
`ActualLoadingDetail`, `PaginatedActualLoadingResult`, DTOs + `ActualLoadingApiResult`; re-exported from
`index.ts`; `_count`/`loadListItem` added to list/item shapes.

**Backend:** `apps/api/src/modules/actual-loading/` (controller/service/dto/module) — `list`
(search + status/loadListId/voyageId/createdFrom/createdTo filters, whitelisted `sort`
`actualLoadingNumber|status|createdAt|completedAt` + `order`), `findById`, `create` (auto `AL-YYMM-#####`,
FINALIZED + non-empty + one-per-list guards), `update` (notes, editable-only), `remove` (soft-delete,
editable-only), `updateItem` (upsert keyed by `loadListItemId`, cargo-inspection + quantity guards),
`updateItemsBulk` (transactional, all-or-nothing, per-item failure reasons), `removeItem`, and lifecycle
`start`/`complete`/`cancel` (200 POSTs). Registered in `app.module.ts`.

**Frontend:** nav Actual Loading flipped `planned` → `implemented` (`/actual-loading`,
`actual_loading:read`). New self-contained page `/actual-loading`: register (search + status/voyage/
created-from/to filters, pagination), create dialog (live FINALIZED load-list select), detail dialog with
per-item planned/actual/remaining/result editor (FULL/PARTIAL/NOT_LOADED badges, client-side non-negative
+ ≤planned checks, server re-validates), start (ConfirmDialog), complete (ConfirmDialog + note),
cancel (dialog with mandatory reason). Permission-gated throughout; inline `role="alert"` errors; live
data only; fragments of an earlier load-lists page bug (single-quoted `/load-lists/${…}` templates)
documented but not modified (Phase 7 scope).

**Tests:** new `apps/api/test/actual-loading.e2e-spec.ts` (10 tests): 401/403 RBAC (throwaway no-read /
read-only / create-update / complete / cancel users), create-guards (403 reader, DRAFT list 409,
unknown list 404, duplicate 409), auto-reference `AL-YYMM-#####`, detail, updateItem (403, negative 400,
over-planned 400, foreign item 404), FULL/PARTIAL/NOT_LOADED result derivation, lifecycle
`NOT_STARTED→IN_PROGRESS→COMPLETED` + cargo `loadingStatus = LOADED`, terminal-state 409s, cancel
reason 400 → CANCELLED + terminal 409s, complete-from-NOT_STARTED 409, unknown 404, list filters/sort.
**Full e2e suite green: 8 suites, 124/124 tests** (10 actual-loading). Config unit 6/6.

**Verification (all green):** api/web/shared typecheck clean; lint clean (api `src/**/*.ts`, web `next
lint`); full e2e suite 124/124; `prisma validate` valid + `migrate status` up to date; seed idempotent
(61 permissions). Canonical API `http://127.0.0.1:3101/api/v1` (web client uses same-origin `/api/v1`
proxy to the API); PostgreSQL `:5432` up.

### Phase 5 — Inspections (completed)

**Objective met:** real, persisted cargo Inspections (PostgreSQL/Prisma/NestJS/Next.js/TS) with RBAC,
a server-enforced `PENDING → APPROVED | REJECTED` lifecycle, transactional approve/reject, inspection
history, a cargo readiness contract (authoritative for future Load Planning) and documentation. This is
the third module named in the original Phase 3 remainder, fully implementing Inspection workflows and
unblocking cargo `READY` (`inspectionStatus = APPROVED`). Hard-stopped before Phase 6 (Vessels / Voyages
/ Load Planning / Load Lists / Actual Loading / Manifest / B/L / Accounting). No DB reset, no
admin-credential change, no weakening of auth/RBAC; CORS remains a scoped allow-list.

**Design decisions (new ADRs):**

- **ADR-024 — Inspection ledger + authoritative cargo readiness.** `Inspection` rows are the traceable
  history ledger; `Cargo.inspectionStatus` is the single authoritative *current* readiness state. `approve`
  /`reject` update both in one `$transaction` so they never diverge. Reinspection = a new `Inspection`
  record for the same cargo.
- **ADR-025 — Duplicate-pending guard.** A cargo can have only one open (`PENDING`) inspection: service
  check + partial unique index `Inspection_one_pending_per_cargo_idx (cargoId) WHERE status='PENDING'`.
  `REINSPECTION_REQUIRED` deliberately not added (Phase 4 enum fixed); a re-check is a new `PENDING`.

**Backend:**

- **Prisma schema** (`prisma/schema.prisma`): `Inspection` model (id, `inspectionNumber @unique`,
  cargoId, status `PENDING|APPROVED|REJECTED` default PENDING, `inspectionDate`, `inspectorId`/
  `inspectorName`, `findings`, `condition`, `verificationNotes`, `remarks`, `rejectionReason`,
  `approvedById/At`, `rejectedById/At`, `createdById`, timestamps; relations to Cargo + named
  User refs `InspectorCreated/Approved/Rejected`). Indexes: cargoId, status, inspectionDate,
  inspectorId, createdById.
- **Migration** `20260903010012_phase5_inspection_management` applied (6 total); partial unique index
  appended via manual SQL (Prisma cannot model partial indexes). `migrate status` up-to-date; `prisma
  generate` clean. Chosen path: `migrate dev --create-only` → edit SQL → `migrate deploy`.
- **Seed** adds 5 permissions (`inspection:read/create/update/approve/reject`) → **38 total**, idempotent
  (verified twice); admin + master data preserved.
- **Inspection module** `apps/api/src/modules/inspections/`: `list` (search across inspectionNumber/
  inspectorName/serial/chassis/vin/customer + filters `status`/`cargoId`/`customerId`/`yardId`/
  `inspectionFrom`/`inspectionTo`; sort allow-list), `create` (auto reference `INS-<YYMM>-<seq5>`,
  validates cargo exists/not deleted/not CANCELLED, duplicate-pending → 409, transactional cargo →
  PENDING), `update` (PENDING-only, 409 if finalized), `approve`/`reject` (200; transactional cargo
  sync; reject requires `rejectionReason` 400), `historyByCargo` (newest first), `findById`.
  Registered `InspectionsModule` in `app.module.ts`. `approve`/`reject` use `@HttpCode(200)` (action
  POSTs, matching auth convention).

**Shared:** `packages/shared/src/inspection.ts` (`InspectionStatus` imported from `./cargo`;
`InspectionUserRef`, `InspectionCargoRef`, `CargoLoadReadiness`, `InspectionListItem`,
`InspectionDetail`); `MODULE_IMPLEMENTED_COUNT` 11 → 12.

**Frontend:**

- **Nav** — Inspection (`/inspections`, `inspection:read`) flipped from `planned` → `implemented`.
- **Inspection page** `/inspections`: search + status/customer/yard filters, pagination, create dialog
  (live cargo select w/ cargo-identity + current-readiness panel), view-detail dialog (cargo, findings,
  history, rejection reason), approve (ConfirmDialog) + reject (reason textarea) with permission-gated
  actions. Self-contained `'use client'` page; inline `role="alert"` errors; no global toast.

**Tests:** new `apps/api/test/inspection.e2e-spec.ts` (21 tests): 401/403 RBAC (throwaway no-read and
read-only users), IDOR boundaries, create/auto-reference/validate cargo/P2002 409/cancelled-cargo 409,
edit pending + finalized-409, approve → cargo APPROVED + `READY` eligible, reject requires reason + cargo
REJECTED + `READY` blocked, double-action 409, state machine approved-cannot-reject 409, history
newest-first, pagination meta, status/cargoId/search/customer/yard filters, invalid sort 400.

**Verification (all green):** typecheck clean (api/web/shared/config); lint clean (api `src/**/*.ts`,
web `next lint`); **test suite green — inspection 21/21** (+ cargo/inventory 24, master-data 21, auth 24,
config 6/6); `pnpm --filter @shipping/web build` exit 0 with `/inspections` route; API + web restarted
fresh; live HTTP verified: create inspection `INS-2609-00001` → PENDING, duplicate-pending 409, reject
no-reason 400, reject w/reason → cargo REJECTED, re-approve rejected 409, 2nd inspection approve → cargo
APPROVED, history newest-first, status/search filters, approve/reject return **200**. Cargo `READY`
transition unblocked after approved inspection + at-yard.

**Caveats (documented honestly):** no browser-based E2E (Playwright not enabled); full e2e suite run with
`--runInBand` (pre-existing parallel-worker env-load race, not a code defect).

### Phase 6 — Vessels & Voyages (completed)

**Objective met:** real, persisted Vessel master data + Voyage operational sailings
(PostgreSQL/Prisma/NestJS/Next.js/TS) with RBAC and a server-enforced Voyage state machine
(`DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED`, plus `CANCELLED`), single-vessel no-overlap scheduling,
and vessel lifecycle guards. This is the first phase in the "Vessels / Voyages" family and deliberately
excludes cargo assignment / load planning (Phase 7). No DB reset, no admin-credential change, no weakening
of auth/RBAC; CORS remains a scoped allow-list.

- **ADR-026 — Voyage state machine + reference lifecycle.** Dedicated operations own transitions:
  `schedule` (`DRAFT→SCHEDULED`, sets ordered planned departure + arrival ETA in UTC), `start`
  (`SCHEDULED→IN_PROGRESS`), `complete` (`IN_PROGRESS→COMPLETED`), and `cancel` (`DRAFT|SCHEDULED→CANCELLED`,
  reason required, 400 without). Illegal transitions → 409 via a `TRANSITIONS` map. `COMPLETED`/`CANCELLED`
  are terminal. Editing rules: `DRAFT` re-targetable; `SCHEDULED` route frozen (notes only); later states
  read-only.
- **ADR-027 — Single-vessel no-overlap scheduling + vessel lifecycle guard.** `schedule` returns 409 if the
  window overlaps an unfinished same-vessel voyage; historical voyages never block. A vessel with unfinished
  voyages cannot be deactivated (409); a vessel referenced by any voyage is never hard-deleted (deactivate
  instead).

**DB/migration:** new `prisma/migrations/20260903043000_phase6_vessel_voyage` creates `VesselType` and
`VoyageStatus` enums, `Vessel` and `Voyage` tables, all FKs (Voyage→Vessel/Ports RESTRICT, →User SET NULL)
and indexes. Applied via `prisma migrate deploy` (the `migrate dev` shadow-DB replay has a pre-existing
ordering quirk from Phase 4/5 enum ordering, so migrations are diff-generated from the live DB and applied
with `deploy` — the live DB is otherwise clean and `migrate status` is up to date). Regenerated Prisma client.

**Permissions (49, +11):** `vessel:read/:create/:update/:activate` and
`voyage:read/:create/:update/:schedule/:start/:complete/:cancel` added to the seed; ADMIN binds them
automatically (bind-all loop). Idempotent seed re-run logs `Permissions seeded: 49`.

**Shared:** `packages/shared/src/vessel.ts` (`VesselType`, `VesselListItem`, `VesselDetail`, `VesselRef`) and
`voyage.ts` (`VoyageStatus`, `VoyageListItem`, `VoyageDetail`); re-exported from `index.ts`;
`MODULE_IMPLEMENTED_COUNT` 12 → 14.

**Backend:** `apps/api/src/modules/vessels/` (controller/service/dto/module: list w/ search + `isActive`/
`vesselType`/`flag` filters, get, create, update, `PATCH /:id/active → vessel:activate`, soft-delete guarded
by voyage reference) and `apps/api/src/modules/voyages/` (controller/service/dto/module: list w/ search +
status/vessel/ports/date filters + whitelisted sort, create, update, and lifecycle actions
`schedule`/`start`/`complete`/`cancel` each returning 200 via `@HttpCode`). Registered in `app.module.ts`.
No cargo assignment (Phase 7).

**Frontend:** nav flipped Vessels (`/vessels`, `vessel:read`) and Voyages (`/voyages`, `voyage:read`) from
`planned` → `implemented`. New self-contained pages: `/vessels` (registry list w/ type/status filters,
create/edit (code immutable, IMO 7-digit, capacity), activate/deactivate confirm, detail) and `/voyages`
(voyage list w/ status + vessel filters, create DRAFT w/ vessel + origin/destination selects, detail,
schedule dialog w/ departure + ETA, start/complete confirms, cancel dialog w/ reason). Permission-gated
throughout; inline `role="alert"` errors; no global toast.

**Tests:** new `apps/api/test/vessel.e2e-spec.ts` (11) + `apps/api/test/voyage.e2e-spec.ts` (13): 401/403
RBAC (throwaway no-read/read-only users), IDOR, create/validate/auto-reference, duplicate code/IMO 409,
IMO + empty-name 400, activate-deactivate permission + guard, guarded delete, inactive vessel/port 409,
missing port 404, schedule permission + ordered-date 400 + overlap 409 (ADR-027), full
`DRAFT→SCHEDULED→IN_PROGRESS→COMPLETED` + subsequent-transition 409, cancel reason 400-to-200, start-form-DRAFT
409, DRAFT-edit vs frozen SCHEDULED edit, list filters + sort + 404 unknown. **Full e2e suite green:
7 suites, 114/114 tests** (+11 vessel, +13 voyage). Config unit tests 6/6.

**Verification (all green):** api/web/shared/config typecheck clean; lint clean (api `src/**/*.ts`, web
`next lint`); `apps/api` build clean; web build exit 0 with `/vessels` + `/voyages` routes (17 static
pages); API + web restarted fresh from repo root; live HTTP verified: login → create vessel, create voyage
`VOY-2609-00001` DRAFT → schedule 200 → start → complete → IN_PROGRESS/COMPLETED; overlap of an unfinished
voyage → 409; cancel of COMPLETED → 409; no-token → 401; dashboard + `/vessels` + `/voyages` → 200; CORS
preflight → 204; Phase 3/4/5 endpoints reachable (ports/cargo/inspections list 200). Live test rows created
during verification were cleaned up (DB returns to seed-only state).

**Caveats (documented honestly):** no browser-based E2E (Playwright not enabled); full e2e suite run with
`--runInBand` (pre-existing parallel-worker env-load race, not a code defect); the `migrate dev` shadow-DB
replay quirk noted above means new migrations are diff-generated + `deploy`ed (documented in ADR-004 caveats).

### Phase 4 — Cargo & Yard Inventory (completed)

**Objective met:** real, persisted Cargo operational records and real persisted Yard Inventory
(PostgreSQL/Prisma/NestJS/Next.js/TS) with RBAC, server-enforced lifecycle state machines, validations,
e2e tests and documentation. Implements the Cargo / Yard Inventory portion of the original Phase 3
remainder (Cargo, Yard Inventory & Inspections). Inspection workflows remain future work (Phase 5).
Hard-stopped before any later phase (Load Planning / Load Lists / Actual Loading / Manifest / B/L /
Invoices / Agent Portal / Delivery / Discharge). No DB reset, no admin-credential change, no weakening
of auth/RBAC; CORS remains a scoped allow-list.

### Design decisions (new ADRs)

- **ADR-019 — Cargo lifecycle state machine.** `REGISTERED → AT_YARD → READY → LOADED → DELIVERED` with
  `CANCELLED` terminal. Server-enforced transitions: `READY` requires `inspectionStatus = APPROVED`;
  `LOADED`/`DELIVERED` are forward-compatible (driven in later phases by Actual Loading). `@nopermissions`.
- **ADR-020 — One current inventory record per cargo.** `YardInventory.cargoId` is `@@unique`, so a cargo
  has at most one current record. **Place** creates (IN_YARD) + sets cargo `AT_YARD`; **Move/Update**
  changes yard/status/location; **Remove/Delete** deletes the record and reverts cargo
  `AT_YARD → REGISTERED`. Full movement history is deferred to a later phase.
- **ADR-021 — Cargo is hard-deleted only outside active inventory.** Soft-delete (deletedAt) for cargo;
  a cargo with an active inventory record returns 409 ("remove from yard first").
- **ADR-022 — CargoType enum.** `GENERAL | VEHICLE | HEAVY_LIFT | CONTAINER | BULK | PROJECT`.
- **ADR-023 — Decimal money/value serialized as string over the API.** `Cargo.weight` is
  `Decimal(18,2)` with `WeightUnit` `KG | MT`; the service converts Decimal → string so JSON never
  carries a float precision loss.

### Backend

- **Prisma schema** (`prisma/schema.prisma`): `Cargo`, `YardInventory` models + enums `CargoStatus`,
  `CargoType`, `InspectionStatus`, `LoadingStatus`, `WeightUnit`, `InventoryStatus`; relations
  (customer/port/yard/destinationPort/inventory/cargo) + indexes. `Cargo.reference @unique`.
- **Migration** `20260903032524_phase4_cargo_yard_inventory` applied; `migrate status` up-to-date
  (5 migrations). The 4 prior migrations were baselined via `migrate resolve --applied` (no
  `_prisma_migrations` table existed from Phase 1–3 manual DDL); the Phase 4 migration applied via
  `migrate deploy`. Migration SQL generated with `migrate diff --from-migrations ... --shadow-database-url`.
- **Seed** adds 9 permissions (`cargo:read/create/update/transition/delete`,
  `yard-inventory:read/create/update/remove`) → 33 total, idempotent; admin + master data preserved.
- **Cargo module** `apps/api/src/modules/cargo/`: list (search + filters: customerId/portId/yardId/
  destinationPortId/cargoType/status/inspectionStatus/loadingStatus/arrivalFrom/arrivalTo/inYard, via
  `buildPaginated`/`parsePagination`/`parseBooleanFilter`), findById, create (auto reference
  `CRG-<YYMM>-<seq5>`, validated relations incl. active yard + port match), update (clearYard/
  clearDestination), `transition` (TRANSITIONS table, guards), remove (soft-delete, 409 if active
  inventory). Decimal weight → string in `normalize`.
- **YardInventory module** `apps/api/src/modules/yard-inventory/`: `place` (transactional: create
  IN_YARD + set cargo AT_YARD; rejects already-in-yard via `@@unique` guard → 409; rejects CANCELLED
  cargo, inactive/foreign yard or inactive port), `update` (move yard + portId mirror, status
  IN_YARD|RESERVED, location/notes), `remove` (transactional delete + revert AT_YARD→REGISTERED),
  list (search + yardId/portId/customerId/destinationPortId/status/cargoStatus filters + pagination).
- **Registered** `CargoModule` + `YardInventoryModule` in `app.module.ts`.

### Frontend

- **Nav** — Operations section: **Cargo** (`/cargo`, `cargo:read`) and **Yard Inventory**
  (`/yard-inventory`, `yard-inventory:read`) now implemented + permission-aware; Inspection/Load/etc.
  remain planned.
- **Cargo page** `/cargo`: search + status/type/in-yard filters, pagination, create/edit dialog
  (live customer/port/yard/destination selects, yard filtered by selected port), view-detail dialog,
  cancel (ConfirmDialog) + soft-delete (ConfirmDialog), status badges/lifecycle-aware actions,
  permission-gated create/update/transition/delete. Self-contained `'use client'` page following the
  Ports template. No global toast; inline `role="alert"` errors.
- **Yard Inventory page** `/yard-inventory`: search + yard-inventory-status/cargo-status filters,
  pagination, place-cargo dialog (live not-in-yard cargo + yard selects), move/update dialog
  (yard/status/location/notes), view-detail dialog, remove (ConfirmDialog), permission-gated
  create/update/remove. Place drives cargo to At yard; remove returns it to Registered.
- Shared `packages/shared/src/cargo.ts`: `CargoStatus`, `CargoType`, `InspectionStatus`,
  `LoadingStatus`, `WeightUnit`, `InventoryStatus`, `CargoListItem` (now includes `inventory`),
  `CargoDetail`, `CargoInventoryRef`, `InventoryListItem`, `InventoryDetail`; `MODULE_IMPLEMENTED_COUNT`
  6 → 11.

### Tests

- New `apps/api/test/cargo-inventory.e2e-spec.ts` (24 tests): per-module 401/403 RBAC (throwaway
  `cargo:read`-only and `yard-inventory:read`-only users), cargo auto-reference + stringified weight,
  invalid relations/inactive master data → 404/409, search/filters/inYard, cargo lifecycle guard
  (`READY` requires APPROVED inspection → 409), ability to CANCELLED; inventory place→AT_YARD,
  duplicate place → 409, move + portId mirror, cargo stays AT_YARD, remove→REGISTERED, cancelled-cargo
  place → 409, active-inventory hard-delete → 409, IDOR boundaries (reader cannot write). Self-cleaning.

### Verification (all green)

- Typecheck (`tsc --noEmit`) clean across `apps/api`, `apps/web`, `packages/shared`, `packages/config`.
- Lint: API `eslint "src/**/*.ts"` clean; web `eslint` clean.
- Tests: API e2e **69/69** (24 Phase 2 + 21 master-data + 24 cargo/inventory) via `--runInBand`; config
  unit **6/6**.
- `prisma validate` valid; `migrate status` up-to-date (5 migrations); `pnpm db:seed` idempotent.
- Builds: `nest build` exit 0; `pnpm --filter @shipping/web build` exit 0 (14 routes incl. `/cargo`,
  `/yard-inventory`).
- Servers restarted fresh: API `:3101`, web `:3000` (new PID — resolves the earlier stale-`next dev`
  dashboard regression). Live HTTP verified: cargo create (`CRG-2609-00001`, weight as string),
  place→AT_YARD, duplicate→409, move→KHALIFA port-mirror, remove→REGISTERED, READY-without-APPROVED→409,
  CANCELLED terminal, active-inventory delete→409, 401 without token, CORS scoped. Swagger shows
  cargo/yard-inventory controllers.

### Caveats (documented honestly)

- `READY`/`LOADED`/`DELIVERED` were unreachable via Phase 4 endpoints because they depend on Inspection
  (`inspectionStatus=APPROVED`, Phase 5) and Actual Loading (Phase 8) workflows. Phase 5 now drives
  `READY` (approved + at-yard); `LOADED`/`DELIVERED` remain Phase 8/16 scaffolding.
- No browser-based E2E (Playwright not enabled); UI verified via `next build` + live endpoint checks,
  consistent with prior phases.
- The full e2e suite is run with `--runInBand`: running all suites in parallel occasionally trips a
  pre-existing env-load race in the jest workers (all suites pass sequentially; the suites share the
  live dev DB). Not a code defect.

### Phase 1 — Architecture & Project Bootstrap

- ✅ Monorepo scaffolded with pnpm workspaces (`apps/`, `packages/`).
- ✅ Frontend foundation: Next.js 14 (App Router) + React + TypeScript + Tailwind + CSS-variable design tokens.
- ✅ Backend foundation: NestJS with modular structure, versioned API (`/api/v1`).
- ✅ Shared packages: `@shipping/config` (validated env config), `@shipping/shared` (types/constants).
- ✅ PostgreSQL + Prisma: schema with foundational entities, initial migration applied, idempotent seed.
- ✅ Application shell: sidebar (module registry with implemented vs planned), topbar, user menu, mobile nav,
  breadcrumbs, page container, loading/error/empty states.
- ✅ Foundation dashboard with real application/database status — no fake business metrics.
- ✅ Design system components: Button, Badge, Card, Alert, Dialog, ConfirmDialog, Sheet, Breadcrumbs,
  Loading, EmptyState, ErrorState.
- ✅ Security foundation: helmet, CORS allow-list, safe logging, no secrets, production-safe error responses.
- ✅ Environment validation at startup (fails fast on missing config).
- ✅ Testing foundation: config unit tests + API e2e tests (supertest) — all passing.
- ✅ Docker compose for development PostgreSQL.
- ✅ Lint (ESLint) and format (Prettier) configured; both apps lint clean.
- ✅ Documentation (README + docs/ + CLAUDE.md).

## Current Phase

**PHASE 8 — Actual Loading (completed, see above)** — full-stack actual loading execution with a
server-enforced lifecycle, per-item FULL/PARTIAL/NOT_LOADED results and cargo loadout (LOADED + yard exit).

## Next Phase

**PHASE 9 — Manifest / Bill of Lading** — post-loading shipping documents derived from the completed
actual loading (per-voyage Manifest and B/L from the loaded cargo). Do not implement until Phase 9 begins.

## Phase 2 — Authentication & RBAC (completed)

**Objective met:** production-quality authentication + RBAC, backend complete, frontend complete,
verified, and hard-stopped before Phase 3. No business modules, accounting, invoicing, numbering,
documents, or PDF work was introduced.

### Backend

- **Auth module (global):** login, refresh (rotation + reuse-detection → family revocation), logout,
  `/me` (returns `{ user, permissions }`), O(1) refresh lookup via SHA-256 `lookupKey`, bcrypt-hashed
  opaque refresh tokens, bcrypt(12) passwords, account lockout (`MAX_AUTH_ATTEMPTS`, config).
- **Guards:** global `JwtAuthGuard` (secure-by-default; `@Public()` opt-out) + `PermissionsGuard`
  (AND default, `match: 'OR'` supported). Permissions re-resolved from DB per request (no caching).
- **Users module:** list (search + pagination, roles, last login), create, self/own password change,
  assign roles, activate/deactivate, reset password. Password hashes never returned.
- **Roles module:** list, list-active, create, update, soft-delete activate/deactivate (ADMIN system role
  protected), transactional permission binding.
- **Permissions module:** read-only catalogue (list, all, modules).
- **Reference modules protected:** ports/yards/customers require `*:read/*:create/*:update`; currencies
  `currency:read`; health + API metadata `@Public()`.
- **Migration** `20260903004915_phase2_refresh_lookup` (RefreshToken `lookupKey` unique idx) applied;
  seed now seeds 24 permissions + ADMIN/OPERATIONS roles, idempotent.
- **API e2e (24 tests, 2 suites):** login happy/sad + anti-enumeration, `/me`, 401 without token,
  RBAC 401 vs 403, low-privilege user forbidden, refresh rotation + reuse rejection, logout revocation,
  roles/permissions listing, privilege escalation, self-service password change. Tests now clean up
  their throwaway roles/users (`afterAll`) so the dev DB does not accumulate artifacts.

### Frontend

- **API client** (`lib/api/client.ts`): GET/POST/PATCH/PUT/DEL, bearer injection, `setAccessToken` /
  `onAccessTokenChange`, `ApiError` with status, `cache:'no-store'`.
- **AuthProvider** (`lib/auth/AuthProvider.tsx`): `useAuth()` → status, user, permissions, login/logout,
  `hasPermission`/`hasAnyPermission`, silent refresh, token persistence in `localStorage`.
- **Route protection:** login page at `/login`; root `/` redirects authed→`/dashboard`, else→`/login`;
  `(dashboard)/layout.tsx` gates on auth.
- **UI primitives:** `Input`, `Label`, `Pagination`; reused existing Button/Badge/Card/Dialog/ConfirmDialog.
- **Permission-aware** sidebar (filters nav sections), topbar (real identity + logout).
- **Screens:** Permissions catalogue (read-only, filterable), Roles (create, activate/deactivate,
  permission binding), Users (create, role assignment, activate/deactivate, reset password). All gates
  `user:read` / `role:read` / `permission:read`; writes gated by the respective `:create`/`:update`/
  `:activate`/`:roles`/`:permissions` permissions.

### Verification (all green)

- Typecheck (`tsc --noEmit`) clean across `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- Lint: `next lint` 0 errors; API `eslint` clean.
- Tests: config unit 6/6; API e2e 24/24 (suites clean up after themselves).
- `prisma validate` valid; `migrate status` up-to-date (3 migrations); `pnpm db:seed` idempotent (run twice).
- `pnpm web build` + `next build` exit 0 (all 6 routes); `nest build` exit 0.
- Servers restarted on new builds: API `:3101` (`/auth/login`, `/auth/me` → `{user, permissions}`),
  web `:3000` (`/login`, `/dashboard` 200). CORS preflight `204` from web origin; roles/permissions
  endpoints return real seeded data through an authenticated principal.
- Docs updated: permissions matrix, auth flow, API endpoints, schema (RefreshToken), ADRs 014–016,
  README status.

### Post-implementation real login verification (auth check)

A genuine end-to-end check was performed against the running API and database (no static inspection
only). Summary:

- **Real admin user** `admin@shipping.local` confirmed in PostgreSQL: `isActive=true`, role `ADMIN`,
  retained (not recreated, not reset).
- **Credential source is authoritative:** `prisma/seed.ts` uses `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` env vars, but those are **commented out** in `.env`/`.env.example`, so the
  seed default applies. The stored password hash verifies (`bcrypt.compare`) against the seed default
  password — `.env` placeholders are inert, resolving the "two different passwords" confusion.
- **"Account is temporarily locked" root cause:** a legitimate security lockout (`MAX_FAILED_ATTEMPTS=5`
  → `LOCK_DURATION_MS=15min`, `auth.service.ts`), triggered by prior failed sign-ins against the real
  seeded account. This is **expected lockout behaviour (option A), not a bug**. The stored hash was
  correct all along.
- **Recovery (no DB writes, no weakened security):** waited for the 15-minute lockout to expire
  naturally, then login succeeded. Production lockout protection is untouched.
- **Verified live:** login → 200/success envelope, tokens issued (no `passwordHash` in any payload);
  `/auth/me` returns the admin identity, `ADMIN` role, 24 permissions; protected API (`/users`,
  `/roles`) returns **401 without a token** and **200 with the token**; **RBAC 403** demonstrated with a
  throwaway low-privilege user (no `user:read`) while the same user reached a permitted
  (`currency:read`) endpoint 200; **logout** revoked the refresh token (subsequent `refresh` → 401);
  CORS preflight 204 from both web origins (`Access-Control-Allow-Origin` explicit, `credentials: true`,
  no `*`); `.env` gitignored. Throwaway RBAC test user/role were cleaned up afterwards; the dev DB now
  contains only seeded reference data and the admin user.

## Phase 3 (increment) — Master Data Productionization (completed)

**Objective met:** Customers, Ports and Yards were productionized to master-data grade (backend
enhancements, frontend screens, tests, docs) and hard-stopped. No Cargo / Yard Inventory /
Inspection / business modules were introduced in this increment. Existing Phase 1/2 functionality was
reused and only extended where the increment required it. All APIs remain under the existing
`*:read` / `*:create` / `*:update` permission convention (no new `:view`/`:deactivate` variants).

### Backend

- **Boolean query filters fixed:** the global `ValidationPipe` uses `enableImplicitConversion`, which
  coerces the query string `"false"` to `Boolean('false') === true`. List DTOs now type `isActive` as
  `string` (`@IsIn(['true','false'])`) and services convert via `parseBooleanFilter`
  (`common/utils/query-filter.util.ts`). `?isActive=false` now works correctly.
- **Lifecycle endpoints:** `PATCH /:id/active` on customers, ports and yards (mapped to the existing
  `:update` permission, consistent with the existing `DELETE → :update` mapping).
- **Customers:** list search now includes phone; added `isActive` filter. `setActive` lifecycle.
- **Ports:** list added `country` + `isActive` filters; `findById` now returns related `yards`;
  business rule — a port **cannot be deactivated** while it has active yards (409 Conflict), and
  **cannot be deleted** while it has any non-deleted yards.
- **Yards:** list added `isActive` filter + port filter; create/update enforce referential integrity
  (`ensurePortExists` → 404 for a missing/soft-deleted port); `setActive` lifecycle.
- **Migration** `20260902225307_phase3_master_data_indexes` (`Port.country` index) applied;
  `prisma migrate status` up-to-date (4 migrations).
- **HttpExceptionFilter** already maps Prisma `P2002` → 409 Conflict (confirmed) and `P2003` → 400,
  so duplicate-code conflicts return 409 without leaking meta.

### Shared

- `packages/shared/src/master-data.ts`: `CustomerListItem`/`CustomerDetail`, `PortListItem`/
  `PortYardRef`/`PortDetail`, `YardPortRef`/`YardListItem`/`YardDetail`; re-exported from `index.ts`.

### Frontend

- New **Master Data** nav section (permission-aware on `customer:read` / `port:read` / `yard:read`).
- **Customers** `/customers`, **Ports** `/ports`, **Yards** `/yards` — all mirroring the Users screen
  pattern: search + filters (type/country/status/port), pagination, create/edit dialog, view-detail
  (ports list their yards), activate/deactivate via `ConfirmDialog`, permission-aware actions. The
  Yards form's Port selector is populated live from `GET /ports`. No business logic in components;
  everything flows through the typed API client.

### Tests

- New `apps/api/test/master-data.e2e-spec.ts` (21 tests): per-module 401/403 RBAC (a throwaway
  `yard:read`-only user), CRUD, duplicate-code → 409, invalid payload → 400, phone search, `isActive` /
  `country` / `portId` filters, port-detail-yards, orphan-yard → 404, port-deactivation guard → 409,
  activate/deactivate lifecycle, and self-cleanup in `afterAll`.

### Verification (all green)

- Typecheck clean across `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- Lint: `next lint` 0 warnings/errors; API `eslint` clean.
- Tests: API e2e **45/45** (24 Phase 2 auth + 21 master-data + app); config unit **6/6**.
- `prisma validate` valid; `migrate status` up-to-date; `pnpm db:seed` idempotent (run twice — no
  fabricated customers added; only reference ports/yards/currencies/roles/permissions).
- Builds: `nest build` exit 0; `next build` exit 0 (routes include `/customers`, `/ports`, `/yards`).
- Live HTTP verification against the restarted API (`:3101`): 201 create / 409 duplicate / 409
  deactivate-port-with-active-yard / 404 orphan-yard / 200 lifecycle toggles / port detail lists yards /
  401 without token on all three modules; `?isActive=false` returns empty while `?isActive=true`
  returns both seeded ports (proves the boolean filter fix). CORS allow-list enforced
  (`Access-Control-Allow-Origin` present for `localhost`/`127.0.0.1`, absent for a disallowed origin).
- Web routes `/customers`, `/ports`, `/yards` serve 200.

### Caveats (documented honestly)

- No browser-based E2E was executed (Playwright not enabled); UI verified via `next build` + live
  endpoint checks, consistent with prior phases.
- Ships/ports/yards show only live data; no placeholder or fabricated customer records exist.

## Phase 1.5 — API Connectivity Verification

**Root cause (exact):** The dashboard's `fetch()` was failing at the browser level due to **CORS origin
mismatch** — not a network or port problem. The site was opened as `http://127.0.0.1:3000`, but the API's
`API_CORS_ORIGINS` allow-list contained only `http://localhost:3000`. The browser's CORS preflight
(`OPTIONS` with `Origin: http://127.0.0.1:3000`) returned `204` **without** an
`Access-Control-Allow-Origin` header, so the browser blocked the response and `fetch` rejected → the
dashboard displayed "API unreachable / Unable to reach the API". Terminal `curl` (no `Origin` header)
succeeded, which is why the backend appeared fine.

**Secondary risk fixed:** the frontend pointed at `http://localhost:3101/api/v1`. `localhost` can resolve
to `::1` (IPv6) in browsers while the API listens on IPv4 `0.0.0.0`, which would also fail browser-only.
Aligned to `http://127.0.0.1:3101/api/v1`.

**Changes:**

- `.env` + `.env.example`: `API_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`.
- `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:3101/api/v1` (was `localhost:3101`).
- `apps/web/src/lib/api/client.ts`: corrected centralized fallback to `http://127.0.0.1:3101/api/v1`.
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`: health indicator now distinguishes
  **API unreachable** (network/CORS failure) vs **API error** (HTTP 4xx/5xx) vs **database unavailable**
  (HTTP 503 from the health endpoint).

**Verification (no changes to backend contract):**

- Preflight `OPTIONS` from `Origin: http://127.0.0.1:3000` → `204` with `Access-Control-Allow-Origin:
http://127.0.0.1:3000`. Same for `http://localhost:3000`.
- `GET /api/v1/health` with browser origin → `200`, `status: ok`, `database: up`.
- `GET /api/v1/yards` with browser origin → `200`, real DB data, `totalItems: 2` (`JEBALI-Y1`,
  `KHALIFA-Y1`).
- Built browser bundle contains `http://127.0.0.1:3101/api/v1` (verified in compiled chunk).
- Dashboard HTTP 200; both servers restarted; tests/build/lint/typecheck all green (6 unit + 5 e2e).
- Ports unchanged: API `3101`, web `3000`, unrelated process on `3001` untouched.

## Phase 1.75 — Professional UI/UX Redesign (completed)

**Objective met:** a real, visibly redesigned frontend delivered with the installed
`ui-ux-pro-max` skill as the methodology — not just tokens/doc updates. Live data only; **hard stop
before Phase 2** (no Auth/RBAC/JWT/sessions, no business modules).

**Skill direction used** (from `ui-ux-pro-max/scripts/search.py`): Minimalism & Swiss Style +
Data-Dense Dashboard; density 8/10, motion 2/10, variance 3/10; **operational tracking-blue primary
`#2563EB`** (blue-600), cool-neutral canvas, high-contrast status set; status never conveyed by
colour alone; semantic `<table>` markup for data.

**Files changed (frontend only):**

- `apps/web/src/app/globals.css` — rewritten token set (tracking-blue primary + `primary-hover`,
  status colours, cool neutral canvas), new `.micro-label`, `.panel`, `tabular-nums`/`.nums` utilities,
  reduced-motion guard, `scrollbar-thin`.
- `apps/web/tailwind.config.ts` — added `primary.hover` colour entry.
- `apps/web/src/components/layout/sidebar.tsx` — blue brand tile (`Ship` on `bg-primary`), active row
  `bg-primary/10 text-primary` + left indicator bar, `micro-label` section headers, density h-8 rows,
  **live System-Operational footer** (polls `GET /api/v1/health`, green/red + "checked HH:MM"),
  real sidebar now renders in the desktop layout (fixes previously empty mobile Sheet), static user block.
- `apps/web/src/components/layout/topbar.tsx` — workspace label ("Foundation"), global search input
  (disabled until search phase), notification bell with `bg-destructive` dot, user avatar chip
  (`bg-primary` "A") + "Active" status with `bg-success` dot.
- `apps/web/src/components/layout/app-shell.tsx` — max-width (`max-w-[1600px]`) page container with
  consistent `space-y-6`/`p-4 lg:p-6`.
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — redesigned: page header (Breadcrumbs + title +
  live health `Badge` "System operational"/"Issue"/"Checking…" + `updated HH:MM:SS` + Refresh);
  **4 metric tiles** (Application / Database / Environment / Uptime) each with top colour accent bar,
  icon tile, micro-label, `tabular-nums` value and status Badge; **Module Registry semantic
  `<table>`** (Module · Section · Status Badge · Description) derived from `lib/navigation/nav.ts`;
  System Status + Scope panels. All real data; keeps `classifyError`, `formatUptime`, `NAV_SECTIONS`
  derivation.
- `apps/web/src/components/ui/card.tsx` — tightened header (`px-4`, title 15px), border divider.
- `apps/web/src/components/ui/button.tsx` — primary hover uses new `primary-hover` token.
- `design-system/MASTER.md` + `design-system/pages/dashboard.md` + `docs/design-system.md` — updated
  to the implemented blue operational design.

**Verification (all green):**

- Typecheck (`tsc --noEmit`) OK across `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- Lint: `next lint` 0 errors/warnings; API `eslint` clean.
- Prettier `--check` clean on changed files (after `--write`).
- Tests: config unit 6/6; API e2e 5/5 (incl. `GET /api/v1/health returns ok status` against live PG).
- `pnpm --filter @shipping/web build` (exit 0); fresh `next start -p 3000` serves `/dashboard` 200.
- End-to-end data: browser bundle contains `http://127.0.0.1:3101/api/v1` (no stale localhost);
  `GET /api/v1/health` → `status: ok`, `database: up`; web log clean; SSR HTML shows redesigned
  sidebar (`Main navigation`), topbar (`Search…`), brand (`Shipping ERP`), loading state; module
  table present in the served client bundle.
- Servers up: web `:3000`, API `:3101`, standalone PostgreSQL `:5432`.

## Public Deployment Connectivity (http://dashboard.3ree.eu.cc)

**Root cause of public login failure:** the browser bundle's `NEXT_PUBLIC_API_URL` was baked as the
local development URL `http://127.0.0.1:3101/api/v1`. A remote browser therefore POSTed `/auth/login`
to *its own* localhost — connection refused → "Unable to sign in." Separately, the public origin's
nginx (`/etc/nginx/sites-available/dashboard.3ree.eu.cc`) proxied **only** `/` → `http://127.0.0.1:3000`
(Next.js), so `dashboard.3ree.eu.cc/api/v1/*` had no route to the NestJS API (`127.0.0.1:3101`) and
returned a Next 404. The API CORS `connect-src`/`Access-Control-Allow-Origin` allow-list also excluded
the public origin.

**Fix (same-origin, no CORS needed, no auth change):**
- Added `apps/web/src/app/api/v1/[...path]/route.ts`, a Next.js route handler that forwards `/api/v1/*`
  to the API service, internally resolved from `API_INTERNAL_URL` (default `http://127.0.0.1:3101`).
- Changed the client base to a **relative same-origin** URL: `NEXT_PUBLIC_API_URL=/api/v1` (and the
  `client.ts` fallback default). The browser now calls the origin it is served from for everything, so
  both local (`127.0.0.1:3000/api/v1`) and public (`dashboard.3ree.eu.cc/api/v1`) reach the API through
  the same path. No `127.0.0.1:3101`/`localhost:3101` remains in any served browser chunk.

Flow:
```
browser (dashboard.3ree.eu.cc) ─▶ nginx ─▶ Next route handler ─▶ API (127.0.0.1:3101)
browser (http://127.0.0.1:3000) ─────────▶ Next route handler ─▶ API (127.0.0.1:3101)
```

**Verified end-to-end (real requests):** public + local `POST /api/v1/auth/login` success
(`admin@shipping.local`); `GET /auth/me` success; protected `GET /users` 200; wrong password 401;
`dashboard.3ree.eu.cc/dashboard` 200; all 14 routes 200; `pnpm --filter @shipping/web build` OK
(route handler compiles as `ƒ /api/v1/[...path]`); web `tsc --noEmit` + `next lint` clean.
HTTPS is available at the edge (Cloudflare, Let's Encrypt CN=3ree.eu.cc); the origin only terminates
HTTP on :80 and HTTPS is terminated at Cloudflare.

**Files changed:** `apps/web/src/app/api/v1/[...path]/route.ts` (new), `apps/web/src/lib/api/client.ts`
(default base → `/api/v1`), `apps/web/.env.local` (`NEXT_PUBLIC_API_URL=/api/v1`).
**Services restarted:** web dev only. API process and DB untouched. No schema/credentials/secret change.

### HTTPS for dashboard.3ree.eu.cc — DIAGNOSED (pending root-required nginx change)

`https://dashboard.3ree.eu.cc/` connects at the Cloudflare edge (valid wildcard
`*.3ree.eu.cc` Let's Encrypt cert) but serves the **nginx default "Welcome to
nginx!" page**, not the app. Root cause (verified): Cloudflare SSL mode is
**Full**, so it reaches the ORIGIN on **:443**; the origin nginx has **no :443
server block for `dashboard.3ree.eu.cc`** (its block only listens on :80:
`/etc/nginx/sites-available/dashboard.3ree.eu.cc`), so :443 falls to the panel/
default server (expired `CN=panel.3ree.eu.cc` cert) and returns the static
default page. HTTP on :80 (→ `127.0.0.1:3000`) correctly serves the app.

Fix (requires sudo — not available in this session): add a `listen 443 ssl`
vhost for `dashboard.3ree.eu.cc` reusing the wildcard cert at
`/etc/letsencrypt/live/3ree.eu.cc/` (already trusted, auto-renewed via the
systemd `certbot.timer`), same upstream/proxy headers as :80. Ready-to-apply
patch + commands: `docs/ops/https-dashboard.3ree.eu.cc.md`. Optional later:
HTTP→HTTPS 301. No app/auth/DB changes needed. Panel untouched.

## Pre-Phase 7 — Runtime & Database Persistence

**Problem identified:** PostgreSQL data was at `/tmp/opencode/pg/pgdata`, subject to systemd
tmpfiles 30-day cleanup (`D /tmp 1777 root root 30d`). All services were started from OpenCode
shells and died when sessions closed (no process manager). Docker socket denied (no Docker).

**Fix applied (no Phase 7):**
- Relocated PG data to durable `/home/arash/shipping-erp/pgdata` (on `/dev/vda2` root
  filesystem, outside `/tmp` cleanup path). Data preserved via `rsync` while stopped (no
  dump/restore, no deletion, zero data loss).
- Updated `infra/standalone-db/manage.sh` default `PG_HOME` to `/home/arash/shipping-erp`
  so `manage.sh start/stop/status` use the durable path.
- Created `scripts/start-dev.sh` (idempotent: PG → API → Web, all detached via `setsid`
  + `nohup`), `scripts/stop-dev.sh` (graceful stop), `scripts/status-dev.sh`.
- Added `logs/` and `*.pid` to `.gitignore`.
- Updated `postgresql.conf` `unix_socket_directories` to `/home/arash/shipping-erp/socket`
  (durable path).

**Verified:** full stop→restart cycle (data preserved: 1 user, 49 perms, 1 customer, 2 ports,
3 yards, 1 vessel, 1 voyage). All routes 200, API health ok, auth works (login/me/protected),
wrong password 401. Process ancestry: all services PPID=1 (systemd), session-leader detached —
closing OpenCode does NOT stop the ERP.

**Pre-existing test note:** `vessel.e2e-spec.ts` "rejects duplicate IMO" fails because the
seed vessel has `imo='1234567'` and the test creates another with the same IMO → 409 conflict.
This is a pre-existing test isolation issue unrelated to runtime changes.
  in `afterAll`, so no artifacts accumulate). A dedicated `shipping_erp_test` database with isolated
  migration/seed per run is still planned for a hardening pass.
- **Sandbox port**: in the development sandbox, the API default port `3001` is occupied by an unrelated
  process; the local (gitignored) `.env` overrides to `3101`. `.env.example` keeps `3001` as the
  documented default.
- **ts-jest warnings**: harmless warnings compiled `.js` dist files of workspace packages (allowJs not set);
  cosmetic only.
- **pnpm build-script approval**: pnpm v11 prints a notice about ignored build scripts on first install;
  the repo ships an explicit `onlyBuiltDependencies` allow-list. If `pnpm install` ever reports an ignored
  build that matters, run `pnpm approve-builds` and commit the updated list.
- **No browser-based E2E**: Playwright is not enabled yet; UI is verified via `next build` + manual
  endpoint checks. Browser E2E is a future-phase item.

## Technical Decisions

- pnpm monorepo workspace (ADR-001)
- NestJS backend (ADR-002)
- Next.js + React + TS + Tailwind frontend (ADR-003)
- Prisma + PostgreSQL (ADR-004)
- cuid() ids (ADR-005)
- Centralized validated configuration (ADR-006)
- Consistent versioned API envelope (ADR-007)
- Configurable numbering architecture (design) (ADR-008)
- Configurable document templates (design) (ADR-009)
- Immutable audit architecture (design) (ADR-010)
- Shared packages as CommonJS (ADR-011)
- pnpm build approvals in sandbox (ADR-012)
- Dev PostgreSQL in Docker with local fallback (ADR-013)
- JWT access + opaque DB-backed rotation refresh token (ADR-014)
- Role active/inactive via soft-delete, not `isActive` column (ADR-015)
- Permissions are a read-only seeded registry (ADR-016)
- Boolean query-string filters typed as `string` (ADR-017)
- Master-data lifecycle `PATCH /:id/active` → `:update` (ADR-018)
- Cargo lifecycle state machine and server-enforced transitions (ADR-019)
- One current yard-inventory record per cargo; place/move/remove (ADR-020)
- Cargo soft-delete; active inventory blocks hard-delete (ADR-021)
- `CargoType` enum (ADR-022)
- `Decimal` money/value serialized as string over the API (ADR-023)
- Inspection ledger + authoritative cargo readiness (ADR-024)
- Duplicate-pending inspection guard (ADR-025)
- Voyage state machine + reference lifecycle (ADR-026)
- Single-vessel no-overlap scheduling + vessel lifecycle guard (ADR-027)
- Actual Loading lifecycle + one-per-load-list + loadout integration (ADR-028)
- Manifest lifecycle + one-per-voyage app-level + actual-quantity snapshot (ADR-029)
- B/L lifecycle + one-live-bill-per-manifest-line + blNumber stamping (ADR-030)
- Voucher-recomputed paidAmount; derived ledger, no table (ADR-032)
- D/O+R/O issued directly; release holds on unpaid invoices, override permission (ADR-033)
- Proforma mirrors Invoice math; one-time convert stamps linkedInvoiceId (ADR-034)

## Pending Requirements

- Load Planning / Load Lists (Phase 7) — complete (see above). Actual Loading (Phase 8) — complete (see
  above). Cargo `READY` (approved + at-yard) is driven by Inspection; `LOADED`/`DELIVERED` are now driven
  by Actual Loading completion (LOADED) and Delivery (future).
- Manifest, Bill of Lading (Phase 9).
- Jobs, Job Costing, Invoices, Payments, Customer Ledger.
- Discharge, Agent Portal.
- Reports, Voyage P&L.
- Configurable numbering service and document templates.
- Audit log implementation.
- Playwright browser E2E.
- Dedicated test database.
