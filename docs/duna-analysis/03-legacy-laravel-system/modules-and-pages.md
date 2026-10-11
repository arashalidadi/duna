# Legacy Laravel — Modules & Pages

> Inventory of every screen the legacy system has, what it does, and the permission that gates it.
> Derived from `routes/web.php`, the 15 controllers and the 68 Blade views.

---

## 1. Back office (`/admin/*`, gated by `AdminMiddleware`)

### 1.1 Dashboard

| Page | Route | Content |
|---|---|---|
| Dashboard | `/admin/dashboard` | Six counts: B/Ls, Manifests, Invoices, Loadings, Customers (`level='User'`), Offers. (A Quotation count is computed but not passed to the view.) |

### 1.2 Loading (cargo intake + load lists)

| Page | Route | Permission | Content |
|---|---|---|---|
| All loading | `/admin/loading-list` | `loadings.show` | Filterable list: user, inspection status, loading status, POD, POL, admin status. Columns: id, customer, POL, POD, yard, chassis no., **No. Days**, admin status, inspection status, loading status. Row actions: edit, upload documents, delete, "More Details" drawer |
| Loading detail drawer | (inline) | | Read-only view of every Loading field |
| Management review | `/admin/loading-list/change/{id}` | `loadings.adminapprove` | Set `admin_status` (`PENDING`/`APPROVED`) — a **legacy-only** gate the employer never asked for |
| Add new loading | `/admin/loading-list/new` | `loadings.new` | POL, POD, Yard, Customer, Showroom, CH.No., QTY, QTY Description, Net weight, Gross weight, Measurement, Loading status, Inspection status, Arrival date, Loading date, Description, Note |
| Loading List | `/admin/loading-list/list` | `loadinglist.show` | Create / edit / preview a load list |
| Loading List preview | `/admin/loading-list/list/preview/{id}` | `loadinglist.show` | Printable list: NO, CUSTOMER, SHOWROOM, DESCRIPTION (CHNO), QTY, YARD, DATE ARRIVAL, INSP. STATUS, DATE OF LOAD, **NO OF DAYS** |
| Yards | `/admin/loading-list/yards` | `loadings.yards` | Yard CRUD (port + name) |
| Ports | `/admin/loading-list/ports` | `loadings.ports` | Port CRUD (title + abbreviation) |
| Upload documents | `/admin/loading-list/{id}/docs` | `loadings.new` | File upload against a Loading record |

### 1.3 Manifest / B/L

| Page | Route | Permission | Content |
|---|---|---|---|
| All Manifest | `/admin/manifests` | `manifest.show` | Manifest list |
| Create Manifest | `/admin/manifests/create` | `manifest.create` | New manifest |
| Manifest preview | `/admin/manifests/preview/{id}` | `manifest.show` | Printable manifest (see [`reports-and-documents.md`](reports-and-documents.md)) |
| All BL | `/admin/manifests/bl` | `manifest.show` | B/L list |
| New BL | `/admin/manifests/bl/create` | `bl.new` | New B/L |
| BL preview | `/admin/manifests/bl/preview/{id}` | `manifest.show` | Printable B/L |
| Edit BL | `/admin/manifests/bl/edit/{id}` | | Edit B/L |
| Delete BL | `/admin/manifests/bl/delete/{id}` | `bl.delete` | Delete B/L |
| Shipper | `/admin/manifests/shipper` | `manifest.shipper` | Shipper master |
| Agent | `/admin/manifests/agents` | `manifest.agents.show` | Agent master |
| Consignee | `/admin/manifests/consignee` | `manifest.consignee.show` | Consignee master |

### 1.4 Accounting

| Page | Route | Permission | Content |
|---|---|---|---|
| Ledger | `/admin/ledger` | `ledger.show` | All ledger rows, filterable by customer and date range. Columns: id, customer, date, status, description, ref (invoice code), debit, credit, note |
| Submit payment | `/admin/ledger/submit-payment` | `ledger.payment` | Customer, description, amount, note, **ID-card upload** |
| Submit receipt | `/admin/ledger/submit-reciept` | `ledger.reciept` | Customer, description, amount, note (**no** ID-card field) |
| Ledger preview / statement | `/admin/ledger/preview` | `ledger.show` | Date-ranged ledger account (see [`calculations.md`](calculations.md) §3) |
| Voucher view | `/admin/ledger/{id}` | | Payment/Receipt voucher print |
| Ledger edit / delete | `/admin/ledger/edit/{id}`, `/admin/ledger/delete/{id}` | `ledger.edit`, `ledger.delete` | Only for `payment`/`reciept` rows |
| All Invoices | `/admin/invoices` | `invoice.show` | Filter by customer and status. Columns: code, title, customer, total, total VAT, status, created date |
| New Invoice | `/admin/invoices/create` | `invoice.create` | Title, customer, B/L picker, line items |
| Invoice preview | `/admin/invoices/view/{id}` | `invoice.show` | Printable tax invoice |
| Edit / delete invoice | `/admin/invoices/edit/{id}`, `/admin/invoices/delete/{id}` | `invoice.edit`, `invoice.delete` | |
| Change payment status | `/admin/invoices/change-payment/{id}` | `invoice.payment` | Toggle `PAID` / `UNPAID` |
| Manifest Report | `/admin/manifest-report` | `manifest.report` | Voyage P&L (see [`calculations.md`](calculations.md) §5) |
| Release Manager | `/admin/release-manager` | `release.manager` | Filterable B/L list with a Release status badge. **Has no action to change release status** — only Delete (defect **D1**) |
| Offers | `/admin/offers` | `offer.show` | Free-text body documents |
| Quotations | `/admin/quotations` | `quotation.show` | Free-text body documents |
| Proforma | `/admin/proforma` | `performa.show` | Structured Proforma with line items |

### 1.5 Users & access

| Page | Route | Permission | Content |
|---|---|---|---|
| All Users | `/admin/users` | `user.index` | User list |
| New User | `/admin/users/create` | `user.create` | Back-office user with validation |
| View / edit user | `/admin/users/view/{id}`, `/admin/users/edit/{id}` | `user.index` | |
| **New Customer** | `/admin/new-customer` | `users.newcustomer` | A **second, simpler** customer-creation path with no validation — a shorter form that creates a `level='User'` record directly |
| Permissions | `/admin/permissions` | `permission.index` | Permission CRUD |
| Roles | `/admin/roles` | `role.index` | Role CRUD with permission multi-select |

### 1.6 Settings

| Page | Route | Permission | Content |
|---|---|---|---|
| General Settings | `/admin/settings/general` | `setting.general` | Key/value settings incl. logo, letterhead, signature, watermark, address, tel, email, default role |

---

## 2. Customer portal (`/profile/*`, gated by `UserMiddleware`)

`ProfileController` provides a self-service view for `level='User'` accounts:

| Page | Route | Content |
|---|---|---|
| Portal dashboard | `/profile/dash` | Counts of the customer's B/Ls and invoices |
| My invoices | `/profile/invoices` | The customer's invoices, filterable by code/title and status |
| My B/Ls | `/profile/bls` | The customer's B/Ls, with a `SURRENDERED` badge |
| Ledger / fins | `/profile/fins` | The customer's ledger rows |
| Offers / Quotations / Performas | | The customer's pre-sales documents |
| Edit profile | `/profile/edit-profile` | Name, mobile, avatar, password |
| Logout | `/profile/logout` | |

**Portal limitations versus the employer's agent-portal requirement (`REQ-187`):**
- It is scoped to **one customer**, not to a **destination / agent**.
- Agents have no separate concept — an agent would have to be a customer.
- There is no release-order view, so the employer's goal ("agents stop calling to ask whether a B/L
  was released", `EMP-159`) is not met.

---

## 3. Authentication

| Route | Purpose |
|---|---|
| `/auth/admin-controlpanel/login` | Admin login (redirect target of `AdminMiddleware`) |
| `/users/login` | Customer login (redirect target of `UserMiddleware`) |

Password rules: minimum 6 characters, `confirmed` (Laravel's `password_confirmation` convention).
Registration is **not** self-service — customers are created by staff through
`/admin/users/create` or `/admin/new-customer`.

---

## 4. Two customer-creation paths — a design smell

The system has **two** ways to create a customer:

| Path | Validation | Notes |
|---|---|---|
| `/admin/users/create` | Full: name, mobile uniqueness, email format/uniqueness, password rules | The "proper" path |
| `/admin/new-customer` | **None** | A shortcut that writes a `level='User'` record straight from the request |

The shortcut means a customer can be created with no mobile, no email, and with a `user_code`
generated from a raw id. This is consistent with the employer's "Name is the only mandatory field"
(`REQ-011`) but it is accidental, not designed — the form simply has no validation at all.

---

## 5. What has no page at all

| Employer requirement | Page exists? |
|---|---|
| Jobs / Job costing (`REQ-130`) | ❌ |
| Delivery Order (`REQ-185`) | ❌ |
| Salary / Salary Slip (`REQ-169`) | ❌ |
| Agent portal, destination-scoped (`REQ-187`) | ❌ (only an unscoped customer portal) |
| Reports beyond the manifest P&L (`REQ-190`–`REQ-194`) | ❌ |
| Document templates (`REQ-124`) | ❌ (only global image settings) |
| Notifications / alerts (`REQ-154`, `REQ-184`) | ❌ |
| Company Archive (EMP-713) | ❌ |
