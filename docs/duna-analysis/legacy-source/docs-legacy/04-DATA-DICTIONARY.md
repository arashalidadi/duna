# Duna Legacy Dashboard — Data Dictionary

## Complete Field Reference (Models + Blade Forms)

### User (users table)
| Column | Type | Nullable | Form/Input | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| fname | string | No | fname (profile/editacc) | First name |
| lname | string | No | lname (profile/editacc) | Last name |
| email | string unique | No | email (profile/editacc) | |
| password | string | No | password (profile/editacc) | Hashed |
| mobile | string | Yes | mobile (profile/editacc) | |
| level | enum(Admin,User) | No | — | Hardcoded in middleware |
| active | boolean | No | active (admin/users/new) | |
| role_id | FK → roles | Yes | role_id (admin/users/new) | RBAC |
| avatar | string | Yes | file upload (CKEditor) | uploads/avatars/ |
| created_at, updated_at | timestamp | | | |

### Role (roles)
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| name | string unique | No | Permission reference |
| label | string | No | Display name |

### Permission (permissions)
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| name | string unique | No | e.g., 'loadings.show' |
| label | string | No | |

### Shipper (shippers) — صاحب بار
| Column | Type | Nullable | Form | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| title | string | No | title | Company name |
| created_at, updated_at | timestamp | | | |

### Agent (agents) — نمایندگی
| Column | Type | Nullable | Form | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| title | string | No | title | Agency name |
| created_at, updated_at | timestamp | | | |

### Consignee (consignees) — گیرنده
| Column | Type | Nullable | Form | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| title | string | No | title | Company name |
| created_at, updated_at | timestamp | | | |

### Port (ports) — بندر
| Column | Type | Nullable | Form | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| title | string | No | title | Port name |
| created_at, updated_at | timestamp | | | |

### Yard (yards) — حیاط
| Column | Type | Nullable | Form | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| title | string | No | title | Yard name/location |
| created_at, updated_at | timestamp | | | |

### Loading (loadings) — بارگیری/محموله
| Column | Type | Nullable | Form Input | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| number | string | No | — | Auto? |
| user_id | FK → users | No | user_id (select) | Operator |
| pol_id | FK → ports | No | pol_id (select) | Port of loading |
| pod_id | FK → ports | No | pod_id (select) | Port of discharge |
| yard_id | FK → yards | No | yard_id (select) | Yard location |
| loading_date | date | Yes | loading_date | |
| arrival_date | date | Yes | arrival_date | |
| gross | decimal | Yes | gross | وزن برش |
| net | decimal | Yes | net | وزن خالص |
| measurment | string | Yes | measurment | ابعاد |
| chno | string | Yes | chno | Container number? |
| qty | integer | Yes | qty | تعداد |
| qty_descr | string | Yes | qty_descr | توضیح تعداد |
| description | text | Yes | description | |
| note | text | Yes | note | یادداشت |
| showroom | string | Yes | showroom | شوریوم |
| inspection_status | enum | Yes | inspection_status | |
| loading_status | enum | Yes | loading_status | |
| admin_status | enum(PENDING,APPROVED) | No | — | Admin gate |
| status | enum(LOADED,IN_YARD) | No | — | Physical |
| in_status | enum(PENDING,DONE,LOCAL ED,NO NEED) | No | — | Office state |
| total_weight | decimal | Yes | — | Aggregated |
| total_unit | integer | Yes | — | Aggregated |
| created_at, updated_at | timestamp | | | |

**Blade-only fields** (not in model $fillable but in form): inspection_status, loading_status, showroom, chno, qty, qty_descr, measurment, arrival_date, loading_date, gross, net

### Loadinglist (loadinglists) — لیست بار
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| created_at, updated_at | timestamp | | |

### Bl (bls) — بارنامه / Bill of Lading
| Column | Type | Nullable | Form Input | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| number | string | No | — | Auto? |
| vessel | string | No | vessel | Vessel name (string, not FK) |
| shipper_id | FK → shippers | No | shipper_id (select) | |
| agent_id | FK → agents | No | agent_id (select) | |
| consignee_id | FK → consignees | No | consignee_id (select) | |
| pol_id | FK → ports | No | pol_id (select) | Port of loading |
| pod_id | FK → ports | No | pod_id (select) | Port of discharge |
| manifest_id | FK → manifests | Yes | — | Optional |
| user_id | FK → users | No | user_id (select) | Creator |
| descr | text | Yes | descr | Description |
| notify_party | string | Yes | notify_party |notify party |
| similar_con | string | Yes | similar_con | مشابّه کنسا |
| bl_status | enum(PENDING,RELEASED) | No | bl_status (select) | |
| total_weight | decimal | Yes | — | |
| total_unit | integer | Yes | — | |
| created_at, updated_at | timestamp | | | |

**Note**: Search also uses `consignee` and `agent` as string columns (orWhere) — legacy denormalized fields?

### Manifest (manifests) — مانیفست
| Column | Type | Nullable | Form/Computed | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| number | string | No | auto: generateManifestNumber(pod_id) | Per-port sequence |
| vessel | string | No | vessel | |
| voyage | string | No | auto: generateVoyage(shipper_id, pod_id) | Shipper+dest combo |
| shipper_id | FK → shippers | No | shipper_id (select) | |
| user_id | FK → users | No | user_id (select) | |
| pol_id | FK → ports | No | pol_id (select) | |
| pod_id | FK → ports | No | pod_id (select) | |
| gas_cost | decimal | Yes | gas_cost | |
| lashing_cost | decimal | Yes | lashing_cost | |
| shipper_cost | decimal | Yes | shipper_cost | |
| pod_cost | decimal | Yes | pod_cost | |
| pol_cost | decimal | Yes | pol_cost | |
| total_weight | decimal | No | SUM of BLs | Computed |
| total_unit | integer | No | SUM of BLs | Computed |
| created_at, updated_at | timestamp | | | |

### Invoice (invoices) — فاکتور
| Column | Type | Nullable | Form Input | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| code | string | No | auto: getinvoiceCode() | Sequential |
| title | string | No | title | |
| todescr | text | Yes | todescr | To description |
| bl_id | FK → bls | Yes | bl_id (select) | Optional link |
| manifest_id | FK → manifests | Yes | — | Optional link |
| user_id | FK → users | No | user_id (select) | |
| status | enum(PAID,UNPAID) | No | — | Via Fin |
| created_at, updated_at | timestamp | | | |

### Item (items) — موارد فاکتور
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| invoice_id | FK → invoices | No | |
| description | string | Yes | Line description |
| amount | decimal | Yes | Line amount |

### Fin (fins) — قبض/دفع / Voucher
| Column | Type | Nullable | Form Input | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| invoice_id | FK → invoices | No | — | |
| user_id | FK → users | No | user_id (select) | |
| type | enum(Sales/Payment,Received) | No | — | PAYMENT vs RECEIVED |
| amount | decimal | No | amount | |
| descr | text | Yes | descr (ledger) | Description |
| note | text | Yes | note (ledger) | Note |
| fromdate / todate | date | Yes | (ledger filter) | Report range |
| created_at, updated_at | timestamp | | | |

### Performa (performas) — پیش‌فاکتور
| Column | Type | Nullable | Form Input | Notes |
|---|---|---|---|---|
| id | bigInteger PK | No | — | |
| user_id | FK → users | No | user_id (select) | |
| port_id | FK → ports | No | port_id (select) | |
| pi | string | Yes | pi | PI number |
| buyer | string | Yes | buyer | خریدار |
| currency | string | Yes | currency | ارز |
| origin | string | Yes | origin | مبدا |
| finalplace | string | Yes | finalplace | مقصد نهایی |
| termdelivery | string | Yes | termdelivery | شرط تحویل |
| termpayment | string | Yes | termpayment | شرط پرداخت |
| insurance | string | Yes | insurance | بیمه |
| forwarder | string | Yes | forwarder | فوروردر |
| partial | string | Yes | partial | جزئی |
| benefit | string | Yes | benefit | سود |
| notes | text | Yes | notes | یادداشت |
| created_at, updated_at | timestamp | | | |

### Performa_item (performa_items)
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| performa_id | FK → performas | No | |
| description | string | Yes | |
| amount | decimal | Yes | |

### Quotation (quotations) — اقتباس
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| user_id | FK → users | No | |
| created_at, updated_at | timestamp | | |

**Blade forms suggest more fields** (view/edit have rich UI) — model minimal.

### Offer (offers) — پیشنهاد
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| user_id | FK → users | No | |
| created_at, updated_at | timestamp | | |

### Doc (docs) — اسناد
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| loading_id | FK → loadings | No | |
| file_path | string | No | uploads/general/ |

### Portshipper (portshippers) — بندر-صاحب بار
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | bigInteger PK | No | |
| port_id | FK → ports | No | |
| shipper_id | FK → shippers | No | |

### KeyValue (keyvalues) — تنظیمات
| Column | Type | Nullable | Notes |
|---|---|---|---|
| key | string PK | No | e.g., admin_paginate_number |
| value | text | No | |
| context | string | Yes | |

---

## Missing Columns (Blade forms use but model doesn't declare $fillable)

| Model | Blade Field | Likely Column | Action |
|---|---|---|---|
| Loading | inspection_status | inspection_status | Add to $fillable |
| Loading | loading_status | loading_status | Add to $fillable |
| Loading | showroom | showroom | Add to $fillable |
| Loading | chno | chno | Add to $fillable |
| Loading | qty | qty | Add to $fillable |
| Loading | qty_descr | qty_descr | Add to $fillable |
| Loading | measurment | measurment | Add to $fillable |
| Loading | gross | gross | Add to $fillable |
| Loading | net | net | Add to $fillable |
| Loading | arrival_date | arrival_date | Add to $fillable |
| Loading | loading_date | loading_date | Add to $fillable |

**Recommendation**: For new dashboard, define all these in schema explicitly — legacy model uses `guarded = []` implicit or mass assignment works via controller direct assignment.

---

## KeyValue Settings Known
| Key | Value | Used In |
|---|---|---|
| admin_paginate_number | '30' | All paginated lists |

---

## Data Types for New Prisma Schema
| Legacy | Prisma | Notes |
|---|---|---|
| bigInteger PK | BigInt @id @default(autoincrement()) | |
| string (title, name) | String | @unique where needed |
| text | String @db.Text | |
| decimal | Decimal @db.Decimal(15,3) | weight/cost |
| integer | Int | count/units |
| enum | Enum | Define enums |
| timestamps | DateTime @default(now()) @updatedAt | |
| FK | Relation fields | |