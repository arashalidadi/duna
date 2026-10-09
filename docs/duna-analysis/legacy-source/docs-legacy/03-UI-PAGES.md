# Duna Legacy Dashboard — UI Pages Inventory

## Layouts
| Layout | Used For |
|---|---|
| `layouts/admin.blade.php` | Admin panel (AdminLTE-style, sidebar, RTL) |
| `layouts/profile.blade.php` | Customer portal (level=User) |
| `layouts/login.blade.php` | Auth pages |

## Admin Pages (72 Blade views total)

### Dashboard
- `/admin/dashboard` — `admin/dashboard.blade.php` (stats + CKEditor image upload)

### Operations → Loading (بارگیری)
| Page | Route | View |
|---|---|---|
| Loadings list | GET /admin/loading-list | admin/loading/index |
| New loading | GET/POST /admin/loading-list/new | admin/loading/new |
| Edit loading | GET/POST /admin/loading-list/edit/{id} | admin/loading/edit |
| Yards management | GET /admin/loading-list/yards | admin/loading/yard |
| Ports management | GET /admin/loading-list/ports | admin/loading/port |
| Docs per loading | GET /admin/loading-list/{id}/docs | admin/loading/docs |
| Loading preview | GET /admin/loading-list/preview/{id} | admin/loading/preview |

### Operations → Loading List (لیست بار)
| Page | Route | View |
|---|---|---|
| Loading lists | GET /admin/loading-list/list | admin/loading/loadinglist |
| New list | GET/POST /admin/loading-list/list/new | admin/loading/newloadinglist |
| Edit list | GET/POST /admin/loading-list/list/edit/{id} | admin/loading/editloadinglist |
| Preview list | GET /admin/loading-list/list/preview/{id} | admin/loading/preview |

### Manifest & B/L
| Page | Route | View |
|---|---|---|
| Manifests list | GET /admin/manifests | admin/manifest/index |
| Create manifest | GET/POST /admin/manifests/create | admin/manifest/create |
| Edit manifest | GET/POST /admin/manifests/edit/{id} | admin/manifest/edit |
| Manifest preview (print) | GET /admin/manifests/preview/{id} | admin/manifest/preview |
| Manifest report | GET /admin/manifests/report | admin/manifest/report |
| B/L list | GET /admin/manifests/bl | admin/manifest/bl/index |
| B/L create | GET/POST /admin/manifests/bl/create | admin/manifest/bl/create |
| B/L edit | GET/POST /admin/manifests/bl/edit/{id} | admin/manifest/bl/edit |
| B/L preview (print) | GET /admin/manifests/bl/preview/{id} | admin/manifest/bl/preview |
| Shippers CRUD | GET /admin/manifests/shipper | admin/manifest/shipper |
| Agents CRUD | GET /admin/manifests/agents | admin/manifest/agent |
| Consignees CRUD | GET /admin/manifests/consignee | admin/manifest/consignee |

### Accounting → Invoices
| Page | Route | View |
|---|---|---|
| Invoices list (filter: user/status/search) | GET /admin/invoices | admin/invoices/index |
| Create invoice | GET/POST /admin/invoices/create | admin/invoices/create |
| Edit invoice | GET/POST /admin/invoices/edit/{id} | admin/invoices/edit |
| Invoice view (print, 2111 lines!) | GET /admin/invoices/view/{id} | admin/invoices/view |

### Accounting → Fin (Vouchers / Ledger)
| Page | Route | View |
|---|---|---|
| Ledger (date-range filter) | admin/fins/ledger |
| Show ledger | admin/fins/showledger |
| Release | admin/fins/release |
| Fin preview | admin/fins/preview |

### Accounting → Performa (پیش‌فاکتور)
| Page | Route | View |
|---|---|---|
| List / Create / Edit / Preview | /admin/performa* | admin/performa/* |
| Form fields: pi, buyer, currency, origin, finalplace, termdelivery, termpayment, insurance, forwarder, partial, benefit, notes | | |

### Accounting → Quotation & Offer
| Page | Route | View |
|---|---|---|
| Quotations list/create/edit/view | /admin/quotation* | admin/quotation/* |
| Offers list/create/edit/view | /admin/offer* | admin/offer/* |

### Users & RBAC
| Page | Route | View |
|---|---|---|
| Users list | /admin/users | admin/users/index |
| New user | admin/users/new |
| New customer | admin/users/newcustomer |
| Edit user | admin/users/edit |
| View user | admin/users/view |
| Roles CRUD | admin/roles/* |
| Permissions index | admin/permissions/index |
| Settings (KeyValue) | admin/settings/general |

## Customer Portal (profile/*)
| Page | Route | Purpose |
|---|---|---|
| Dashboard | profile/dash | Customer home |
| My B/Ls | profile/bls | List own bills of lading |
| B/L preview | profile/previewbl | Printable |
| My invoices | profile/invoices | List + pay status |
| Invoice view | profile/viewinv | Printable |
| Ledger | profile/ledger | Own account statement |
| Edit account | profile/editacc | Profile settings |

## UI Patterns Observed
1. **Print/preview pages** for B/L, Manifest, Invoice, Loading list — PDF-ready HTML (customer-facing docs)
2. **AJAX selects**: `/ajax/get-loading-list` (BL create → only APPROVED loadings), `/ajax/get-bl-list` (manifest create → BLs)
3. **CKEditor** for rich text (letters/notes) with image upload
4. **Persian RTL** interface with Persian stopword search
5. **Pagination** via shared partial (admin_paginate_number from KeyValue settings)
6. **Status badges** colored by state (PENDING/APPROVED/PAID...)