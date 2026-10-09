# Duna Shipping Dashboard — Deep Business & Product Analysis

> هدف این سند تبدیل صحبت‌های کارفرما + اسناد واقعی + شواهد Legacy به یک مدل روشن از کسب‌وکار است. این سند **طراحی فنی یا Schema نهایی** نیست؛ تصمیم‌های فنی باید بعد از کامل شدن Discovery و تأیید قواعد کسب‌وکار انجام شوند.

---

# 1. Executive Summary

Duna در اصل یک شرکت Shipping / Maritime Logistics است که کالاهای عمدتاً سنگین، ماشین‌آلات، تجهیزات و Cargo را از بندر مبدأ تحویل می‌گیرد، در Yard نگهداری و آماده‌سازی می‌کند، پس از اسناد و Inspection در Loading List قرار می‌دهد، با Vessel/Voyage مشخص بارگیری می‌کند، B/L و Manifest صادر می‌کند، سپس هزینه‌ها و درآمدهای مرتبط را در Accounting مدیریت می‌کند و در مقصد با Agent، Release Order و گاهی Delivery Order فرآیند تحویل را کنترل می‌کند.

مرکز واقعی سیستم فقط «بارگیری» نیست. سیستم باید چهار جریان به‌هم‌پیوسته را کنترل کند:

1. **Operational Flow** — Cargo → Yard → Inspection → Loading → Vessel → B/L → Manifest → Destination
2. **Commercial Flow** — Customer → Shipment/Job → Invoice → Receivable → Payment/Balance
3. **Document Flow** — Source Documents → B/L / Manifest / Invoice / Release / Delivery / Vouchers → Archive
4. **Control Flow** — Roles → Approvals → Agent access → Statuses → Audit/History → Reports

نقطه کلیدی مدل جدید، جدا نگه داشتن مفاهیم زیر است:

- Customer: طرف تجاری/داخلی که شرکت با او رابطه دارد و معمولاً Invoice برای او صادر می‌شود.
- Shipper: طرف فرستنده/صاحب بار در سند حمل.
- Consignee: گیرنده مقصد در سند حمل.
- Agent: نماینده مقصد یا Port.
- Cargo: واحد عملیاتی/کالایی که تحویل گرفته شده.
- Shipment/Job: پرونده عملیاتی/تجاری یک کار که ممکن است چند هفته یا ماه طول بکشد.
- B/L: سند حمل برای محموله/کالا.
- Manifest: تجمیع B/Lهای یک Vessel/Voyage.
- Invoice: طلب مالی از Customer یا سند تجاری مستقل.
- Ledger: تاریخچه مالی و مانده حساب.
- Release Order: مجوز آزادسازی اسناد/کالا پس از احراز شرایط پرداخت.
- Delivery Order: سند تحویل کالا در جریان‌های ورودی/تخلیه.

---

# 2. Business Model Inferred from the Sources

## 2.1 دو جریان اصلی کسب‌وکار

### A. Export / Outbound-like Maritime Flow

`Customer/Cargo → Origin Port → Yard → Inspection → Loading List → Vessel/Voyage → B/L → Manifest → Invoice → Payment → Release → Destination Agent`

### B. Inbound / Discharge-at-own-port Flow

`Cargo Arrival → Port/Yard → Documentation/Inspection → Delivery Order → Customer/Consignee Release → Delivery`

در حالت دوم باید مشخص شود دقیقاً چه تفاوتی با جریان اول دارد و آیا در همان Inventory model قرار می‌گیرد یا Workflow جدا دارد.

---

# 3. Core Domain Concepts

## 3.1 Customer

Customer یک موجودیت داخلی و تجاری است و نباید با Shipper/Consignee ادغام شود.

Customer باید یک «360-degree profile» داشته باشد:

- مشخصات تماس
- Cargoها و Shipmentها
- Job Numberها
- Invoiceها
- Payment/Receiptها
- Debit/Credit
- Balance
- Release/Delivery history
- اسناد/Commentهای مرتبط
- تاریخچه فعالیت

این Profile احتمالاً یکی از مهم‌ترین صفحات مدیریتی سیستم جدید خواهد بود.

## 3.2 Cargo

Cargo واحد اصلی عملیات است.

یک Cargo حداقل باید بتواند به Customer، Shipper، Consignee، Port، Yard، Destination، Shipment/Job و بعداً Loading/B/L/Manifest متصل شود.

از منظر کسب‌وکار، Cargo از لحظه تحویل تا تحویل نهایی یک «ردپای کامل» دارد.

## 3.3 Shipment / Job

Job از Cargo مهم‌تر یا وسیع‌تر است؛ چون هزینه‌های چندمرحله‌ای را در طول زمان جمع می‌کند.

احتمالاً باید یک ساختار Parent/Case برای کار داشته باشیم که چند Cargo، چند هزینه و چند سند را پوشش دهد.

این مورد یکی از مهم‌ترین موضوعات Discovery است.

## 3.4 Vessel / Voyage

Vessel دارایی/وسیله حمل است؛ Voyage رویداد یا سفر مشخص آن Vessel برای یک مقصد/مسیر مشخص است.

این دو نباید یکی باشند.

## 3.5 Manifest

Manifest واحد تجمیع سفر است و به یک Vessel/Voyage و مسیر متصل است.

هر Manifest چند B/L می‌تواند داشته باشد.

## 3.6 B/L

B/L سند حمل است و باید Lifecycle داشته باشد:

`Draft → Review → Approved/Final → Released` 

جزئیات دقیق Release باید جداگانه تعریف شود.

---

# 4. Operational Workflow پیشنهادی

## Stage 1 — Cargo Intake

کاربر Cargo را ثبت می‌کند:

- Customer
- Shipper / Consignee
- Description
- Chassis / Serial
- Units / Packages
- Weight
- Port of Loading
- Destination
- Yard
- Arrival Date
- Documents
- Comment

### Business Rule
با انتخاب Port، فقط Yardهای مرتبط قابل انتخاب باشند.

---

## Stage 2 — Document & Inspection

- اسناد بررسی می‌شوند.
- Inspection Book می‌شود.
- Inspection Status از Pending به Done می‌رود.
- فقط Cargoهای واجد شرایط اجازه ورود به Loading List دارند.

### Business Rule
`Inspection = Done` یک prerequisite برای Loading List است.

---

## Stage 3 — Vessel Assignment

مدیریت بر اساس Destination و Inventory تصمیم می‌گیرد چه Cargoهایی روی چه Vessel/Voyage قرار بگیرند.

Dashboard باید امکان دیدن Inventory بر اساس:
- Port
- Yard
- Destination
- Customer
- Inspection Status
- Age / Days in Port

داشته باشد.

---

## Stage 4 — Loading List

Loading List مجموعه‌ای از Cargoهای انتخاب‌شده برای یک Vessel/Voyage است.

باید:
- Create شود
- Edit شود
- Cargo اضافه/حذف شود
- Print/PDF شود
- Finalize شود
- وضعیت بارگیری هر مورد را ثبت کند

### وضعیت پیشنهادی کسب‌وکاری
`Draft → In Progress → Partially Loaded → Completed → Finalized`

و در سطح هر Cargo:
`Selected → Loaded / Not Loaded → Returned to Yard`

این وضعیت‌ها نیاز به تأیید کارفرما دارند.

---

# 5. B/L and Manifest Workflow

## B/L

B/L از Loading/Cargoهای نهایی‌شده ساخته می‌شود.

فرایند:

`Prepare → Draft → Send to Customer → Revision (if needed) → Approved → Final`

و سپس در مقصد:

`Released / Unreleased`

### نکته
Draft و Released دو مفهوم متفاوت‌اند:
- Draft/Final = وضعیت تولید سند
- Released/Unreleased = وضعیت آزادسازی سند/کالا

در طراحی جدید نباید این دو در یک Status ساده ادغام شوند.

## Manifest

Manifest باید از B/Lهای مرتبط با Vessel/Voyage ساخته شود.

Totalها از B/Lها Aggregate می‌شوند.

همچنین باید به‌صورت Snapshot نگه داشته شود که در زمان Finalization چه B/Lهایی داخل Manifest بوده‌اند.

---

# 6. Accounting Model

Accounting بزرگ‌ترین Gap Legacy است و نباید با مدل Fin قدیمی حل شود.

## 6.1 Commercial Accounting

`Customer → Invoice → Debit`

`Customer → Payment/Receipt → Credit`

`Debit - Credit = Balance`

## 6.2 Job Costing

`Job → Cost Entries`

هزینه‌ها می‌توانند:
- Transport
- Customs
- Repair
- Crane
- Vessel
- Port Handling
- Port Use
- Lashing
- Storage
- سایر هزینه‌ها

باشند.

## 6.3 Voyage Profitability

`Voyage Revenue = Sum of relevant Invoice revenue`

`Voyage Costs = Sum of relevant Voyage-linked expenses`

`Voyage P&L = Revenue - Costs`

ولی باید مشخص شود کدام هزینه‌ها مستقیم، غیرمستقیم و مشترک هستند.

## 6.4 General Journal

برای مبالغی که در مسیر استاندارد Invoice/Shipment نیستند، Journal Entry لازم است.

این مورد احتمالاً باید از Customer Ledger جدا ولی به آن قابل اتصال باشد.

---

# 7. Document Architecture

اسناد واقعی نشان می‌دهند که سیستم باید Template-driven باشد، اما Template فقط «تصویر» نیست؛ باید Placeholderهای دیتا داشته باشد.

هر Template باید قابلیت تعیین موارد زیر را داشته باشد:

- Header
- Footer
- Table Columns
- Logo
- Company Info
- Dynamic Fields
- Numbering
- Stamp
- Signature
- Watermark
- Print version
- PDF version

برای بعضی اسناد، PDF و Print نباید خروجی یکسان داشته باشند؛ Print ممکن است Stamp دیجیتال را نداشته باشد و مهر زنده بخورد.

---

# 8. Agent Portal

Agent یک User عادی نیست.

Agent به یک Destination/Port محدود است.

مثلاً:

`Agent Khoramshahr → Khoramshahr documents only`

Agent باید بتواند وضعیت:
- B/L
- Release Order
- شاید Manifest
- شاید Delivery Order

را ببیند.

باید مشخص شود آیا Agent اجازه Download، Print، Upload Document یا ثبت Comment هم دارد.

---

# 9. Search / Filtering / Management Dashboard

مدیریت برای تصمیم‌گیری باید بتواند سریع پاسخ دهد:

- الان چند Cargo در هر Port داریم؟
- چند Cargo در هر Yard داریم؟
- چند Cargo برای هر Destination داریم؟
- چند مورد Inspection Done/Pending است؟
- چند مورد آماده Loading هستند؟
- چند مورد Loaded شده؟
- چند مورد در Yard مانده‌اند؟
- چند روز در Port مانده‌اند؟
- کدام Vessel/Voyage چه Cargoهایی دارد؟
- کدام B/Lها Draft هستند؟
- کدام Invoiceها Unpaid/Partial هستند؟
- کدام Releaseها صادر شده ولی پرداخت کامل نشده‌اند؟
- سود/زیان هر Voyage چیست؟

این‌ها باید ورودی اصلی Dashboard Management باشند.

---

# 10. Status Architecture

یکی از مهم‌ترین اصلاحات نسبت به Legacy، تفکیک Statusهاست.

به‌جای یک Status واحد، احتمالاً چند محور لازم است:

### Cargo Operational Status
`Received → In Yard → Ready for Loading → Selected → Loaded → Delivered`

### Inspection Status
`Pending → Booked → Done → Failed/Need Reinspection`

### Document Status
`Pending → Submitted → Verified → Missing/Rejected`

### B/L Document Status
`Draft → Review → Approved → Final`

### Payment Status
`Unpaid → Partial → Paid`

### Release Status
`Not Released → Released`

### Loading List Status
`Draft → In Progress → Finalized`

همه این‌ها باید با تأیید کارفرما نهایی شوند.

---

# 11. Major Gaps / Unanswered Business Questions

1. Customer دقیقاً چیست و Unit اصلی قرارداد با Customer چیست؟ Cargo، Shipment یا Job؟
2. یک Customer می‌تواند چند Shipment و چند Job داشته باشد؟
3. یک Job می‌تواند چند Cargo و چند B/L داشته باشد؟
4. Invoice به Customer، Job، B/L یا ترکیبی از این‌ها تعلق دارد؟
5. هزینه‌ها دقیقاً در چه سطحی ثبت می‌شوند؟
6. یک Expense می‌تواند هم به Job و هم به Voyage مربوط باشد؟
7. یک Vessel می‌تواند چند Voyage همزمان/متوالی داشته باشد؟
8. Voyage بر چه مبنایی شماره می‌گیرد؟ Vessel+Destination+Year؟
9. یک Manifest دقیقاً معادل یک Voyage است؟
10. آیا یک Manifest می‌تواند چند Customer داشته باشد؟
11. آیا یک B/L می‌تواند چند Cargo داشته باشد؟
12. آیا یک Cargo می‌تواند در چند B/L قرار گیرد؟
13. Release بر اساس B/L است یا Cargo یا Invoice؟
14. Partial Payment دقیقاً چه اثری بر Release دارد؟
15. آیا Credit Customer به سقف اعتبار و تاریخ سررسید وابسته است؟
16. Delivery Order فقط برای Inbound است یا در Outbound هم استفاده می‌شود؟
17. Agent چه عملیات دیگری می‌تواند انجام دهد؟
18. Archive باید فقط File Storage باشد یا سندمحور و Searchable هم باشد؟
19. Audit Trail لازم است یا فقط آخرین وضعیت کافی است؟
20. چه کسی می‌تواند رکورد را Delete کند و آیا Hard Delete مجاز است؟

---

# 12. Recommended Product Direction

بدون ورود به تکنولوژی، منطق محصول بهتر است حول 6 بخش اصلی بماند:

1. **Overview**
2. **Operations**
3. **B/L & Manifest**
4. **Accounting**
5. **Master Data**
6. **Access Control**

ولی در زیر این 6 بخش، مدل واقعی باید بر پایه یک زنجیره واحد باشد:

`Customer → Job/Shipment → Cargo → Yard/Inspection → Loading → Vessel/Voyage → B/L → Manifest → Invoice → Payment → Release/Delivery → Ledger/Reports`

این زنجیره باید از هر نقطه قابل مشاهده باشد.

مثلاً از Customer Profile باید بتوان به Job، Cargo، B/L، Invoice و Ledger رسید.

از B/L باید بتوان به Cargo، Manifest، Customer، Invoice و Release رسید.

از Voyage باید بتوان به Cargo، B/L، Manifest، Revenue و Cost رسید.

---

# 13. High-Value Dashboard Views

## Management Overview

Cards / KPIs:
- Cargo in Yard
- Ready for Loading
- Pending Inspection
- Active Voyages
- Draft B/Ls
- Unpaid Invoices
- Partial Payments
- Released but Unpaid
- Customer Receivables
- Voyage Profitability

## Operations View

- Inventory by Port/Yard/Destination
- Days in Port
- Inspection queue
- Ready to load
- Loading progress
- Not loaded / returned to Yard

## Finance View

- Receivables aging
- Paid / Partial / Unpaid
- VAT summary
- Customer balances
- Job cost
- Voyage P&L

---

# 14. Priority of Discovery

### P0 — باید قبل از مدل‌سازی نهایی روشن شود
- Customer / Job / Cargo relationship
- Shipment definition
- B/L ↔ Cargo cardinality
- Manifest ↔ Voyage definition
- Invoice ↔ Customer / Job / B/L
- Payment / Release rule
- Cost attribution
- Statuses

### P1
- Agent permissions
- Document versions
- Template rules
- VAT rules
- Numbering rules
- Delivery Order
- Archive

### P2
- Advanced reporting
- Customer portal details
- Notifications
- Automation
- Additional dashboard KPIs

---

# 15. What Should NOT Be Done Yet

تا وقتی جواب‌های Discovery نیامده:

- Schema نهایی را قطعی نکنیم.
- Legacy modelها را Copy نکنیم.
- Customer را با User یا Shipper یکی نکنیم.
- Invoice را فقط به B/L وابسته نکنیم.
- Release را فقط یک Status روی B/L فرض نکنیم.
- Voyage را فقط یک String روی Vessel فرض نکنیم.
- Ledger را صرفاً یک جدول گزارش فرض نکنیم.
- Comment را بدون Audit Trail طراحی نکنیم.

---

# 16. Definition of Success

وقتی Discovery کامل شود، باید بتوانیم برای هر Cargo این سؤال را بدون ابهام جواب دهیم:

> «این کالا مال چه Customerی است، از کجا آمده، در کدام Port/Yard است، چه اسنادی دارد، Inspection شده یا نه، برای کدام Vessel/Voyage انتخاب شده، در کدام B/L و Manifest قرار گرفته، چه هزینه‌هایی داشته، چه Invoiceهایی برایش صادر شده، چقدر پرداخت شده، Released شده یا نه، و در نهایت چه نتیجه مالی برای Customer و Voyage ایجاد کرده است؟»

اگر سیستم بتواند این زنجیره را بدون شکستن Context دنبال کند، هسته اصلی کسب‌وکار Duna مدل شده است.

---

# 17. Recommended Next Step

گام بعدی باید یک **Business Discovery Questionnaire** باشد که فقط از کارفرما اطلاعات کسب‌وکار بگیرد؛ نه اطلاعات فنی.

هر سؤال باید:
- یک موضوع مشخص داشته باشد.
- با زبان ساده نوشته شود.
- مثال داشته باشد.
- از کارفرما بخواهد فرآیند واقعی را توضیح دهد.
- در صورت امکان نمونه سند/فایل/ویس بخواهد.

پرسشنامه باید به شکلی طراحی شود که کارفرما بتواند با Voice Answer پاسخ دهد و پاسخ‌ها بعداً قابل تبدیل به Requirement قابل اتکا باشند.
