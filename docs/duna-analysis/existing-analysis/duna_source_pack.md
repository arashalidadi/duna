# Duna Shipping Dashboard — Consolidated Source Pack

> این فایل «منبع پایه پروژه» است و برای نگهداری یک‌جای اطلاعات جمع‌آوری‌شده از ویس‌های کارفرما، اسناد واقعی شرکت و مستندات Legacy Dashboard تهیه شده است.
>
> نکته: متن ویس‌ها در بخش‌های اصلاح‌شده، transcription را خواناتر کرده است اما **بازنویسی مفهومی نیست**. جاهایی که از روی متن به‌تنهایی قابل تشخیص نبوده‌اند با `[نامفهوم/نیازمند تطبیق با صوت]` مشخص شده‌اند. اسناد نیز تا حد امکان با همان محتوای ارسالی نگه داشته شده‌اند.

---

# 1. Source Index

## 1.1 Voice / Transcript Sources

### Voice Group A — Main operational/accounting explanation
- Part 1: معرفی کسب‌وکار، Customer، Cargo/Inventory، Loading، Manifest، B/L، Accounting، Release/Delivery، Agent، Reports و شرح چرخه عملیاتی.
- Part 2: Yards، انتخاب Yard وابسته به Port، Vessels و Voyage.
- Part 3: Overview / Operations / B/L & Manifest / Accounting / Master Data / Access Control، سپس Customer.
- Part 4: Shipper / Consignee / Agent و تمایز Customer با Shipper/Consignee.
- Part 5: Yard و انتخاب خودکار Yardهای مرتبط با Port.
- Additional: Accounting / Voucher / Salary Slip / General Journal / Template Upload / Customer Ledger.
- Additional: Cargo registration، Inspection، Loading List، B/L، Manifest و خروجی‌ها.
- Additional: Manifest structure، Accounting، Invoice، VAT، Ledger، Release Order، Delivery Order، Agent portal، Reports.

## 1.2 Real Company Documents

### Source Group 1 — Previous PDFs
1. Bill of Lading: `BL-1X D155A CH NO 8308-1`
2. Manifest: `MAN-MEHDI 11 KHO-26-006`

### Source Group 2 — Five Documents from merged DOCX
1. Receipt Voucher
2. Ledger Account / SOA
3. Tax Invoice
4. Proforma Invoice
5. Quotation

## 1.3 Legacy Dashboard Documentation
1. Overview / Project Summary / module mapping
2. Domain Model / ERD / 23 domain entities
3. Workflows / status machines / RBAC / business rules
4. UI Pages Inventory
5. Data Dictionary / fields / relations / legacy gaps

---

# 2. Corrected Voice Transcript — Consolidated

## 2.1 Business Overview and Main Flow

ما یه شرکت کشتیرانی هستیم که دفتر مرکزی‌مون توی دبی، امارات متحده عربیه. پورت حمریه، پورت دبی، بندر حمریه، پورت دبی.

به این صورتی که ما مثلاً کشتی‌ها یا مال خودمون هستن، یعنی تحت مالکیت خودمون هستن، یا این‌که مثلاً کشتی رو اجاره می‌کنیم. حالا یا سفری اجاره می‌کنیم یا Time Charter، برای یه مدت اجاره می‌کنیم.

در این بین ما یه سری کار داریم، مثل حمل‌ونقل ماشین‌آلات، مدنی، عمرانی، Shipping و هر چیزی؛ جابه‌جایی مثلاً از یه نقطه به یه نقطه دیگه دریایی.

وقتی یک دستگاه/Cargo را در Port تحویل می‌گیریم، اولین مسئله این است که بدانیم این دستگاه متعلق به کدام Customer است. Customer برای ما رکن اصلی است.

برای Customer اطلاعات پایه مثل Name، Contact Number، Email و Address نگهداری می‌شود و سیستم باید Code اختصاصی Customer را اتوماتیک ایجاد کند.

Customer با Shipper و Consignee یکی نیست؛ Customer طرف تجاری/داخلی ماست که با او در ارتباطیم و Invoice برای او صادر می‌کنیم. ممکن است نام Customer اصلاً در B/L یا Manifest نیاید.

کالا ممکن است متعلق به Customer باشد ولی Shipper شرکت فروشنده در مبدأ و Consignee طرف مقصد باشد.

---

## 2.2 Yard / Cargo / Inventory

برای هر Cargo باید بدانیم از کدام Port تحویل گرفته شده، در کدام Yard قرار گرفته، چه تاریخی وارد شده، مقصدش چیست و اسنادش چیست.

در Yard Master Data فقط لازم است Port و Yard Name تعریف شوند؛ مثلاً Port Hamriyah — Yard F15.

زمانی که در ثبت Cargo، Port را انتخاب می‌کنیم، فقط Yardهای مرتبط با همان Port باید در انتخاب Yard نمایش داده شوند.

برای Cargo اطلاعاتی مثل Customer، Shipper، Port of Loading، Port of Destination، Description، Chassis Number، Serial Number، Number of Units، Number of Packages، Weight، Weight Unit، Arrival Date، Yard و Document Status مورد نیاز است.

برای هر دستگاه/Cargo باید Comment داشته باشیم تا هزینه‌ها، عملیات، تعمیرات، جرثقیل، حمل و سایر اتفاقات فراموش نشوند. Comment باید بعداً برای Accounting هم قابل مشاهده باشد.

---

## 2.3 Inspection and Loading List

زمانی که اسناد آماده شد، برای کالا Inspection انجام می‌شود. باید وضعیت Inspection مشخص باشد، مثلاً Pending یا Done.

یکی از شروط ورود Cargo به Loading List این است که Inspection انجام شده و وضعیت آن Done باشد. اگر Inspection انجام نشده باشد، سیستم نباید اجازه دهد Cargo در Loading List انتخاب شود.

Loading List را می‌توان مرحله‌ای تکمیل کرد. مثلاً از 20 دستگاه ابتدا 7 دستگاه آماده باشند و وارد Loading List شوند؛ روز بعد 13 دستگاه دیگر اضافه شوند.

Loading List باید اطلاعات عملیاتی مورد نیاز Operator را داشته باشد، از جمله Port of Loading، Port of Destination، Description، Chassis Number، Serial Number، تعداد دستگاه، تعداد Package، Weight، تاریخ ورود، Yard و وضعیت Inspection.

بعد Loading List چاپ و به Operatorهای بارگیری تحویل می‌شود.

اگر از 20 دستگاه فقط 19 دستگاه بارگیری شد، دستگاه باقی‌مانده باید از Loading List حذف و دوباره به Yard Inventory برگردد تا برای Trip بعدی قابل استفاده باشد.

---

## 2.4 Port Master Data

برای Port، نام Port، شهر، کشور و یک Abbreviation لازم است.

فرمت نمایشی نمونه:

`Bandar Abbas, Persian Gulf, Iran`

یا:

`Bushehr, Persian Gulf, Iran`

برای استفاده در Load List، چون نام کامل Port فضای زیادی می‌گیرد، Abbreviation مثل `HAM` برای Hamriyah استفاده می‌شود.

در Data Entry اگر Port انتخاب شود، فقط Yardهای مرتبط با همان Port باید خودکار نمایش داده شوند.

---

## 2.5 Vessel Master Data

برای Vessel می‌توان Vessel Name را ثبت کرد.

کشتی‌ها ممکن است در قالب‌های مختلف باشند، مثل Tug & Barge، Landing Craft یا Vessel.

برای Tug & Barge نام Tug و Barge جدا باشد؛ برای Vessel یا Landing Craft، Vessel Name کافی است.

IMO Number نیز در صورت وجود قابل ثبت باشد و اجباری نباشد.

نام Vessel در Loading List، B/L و Manifest استفاده می‌شود.

Voyage باید برای هر مقصد به‌صورت خودکار تولید شود. در مثال کارفرما برای هر سفر و مقصد چیزی مانند `Voyage 1/26`, `Voyage 2/26` و ... مورد نظر است و این شماره باید توسط سیستم تولید شود.

---

## 2.6 Shipper Master Data

Shipper اولین اطلاعات مهم B/L است.

برای Shipper اطلاعاتی مانند:
- Name
- National ID / TRN Number
- Address
- Contact Number
- Email

لازم است.

فقط Name اجباری باشد و بقیه اختیاری باشند؛ اگر National ID وجود نداشت مثلاً TRN Number یا شناسه دیگر ثبت شود و سیستم Error ندهد.

Shipper در B/L و Manifest استفاده می‌شود.

---

## 2.7 Consignee Master Data

Consignee تقریباً همان ساختار Shipper را دارد:
- Name
- National ID / TRN Number
- Address
- Contact Number
- Email

Name اجباری و سایر فیلدها اختیاری باشند.

---

## 2.8 Agent Master Data

Agent نیز در Master Data تعریف می‌شود، با اطلاعات:
- Name
- Address
- Contact Number
- Email

Agent هر مقصد متفاوت است و باید در B/L مربوط به همان مقصد قید شود؛ مثلاً Agent بندرعباس برای B/Lهای بندرعباس و Agent بوشهر برای B/Lهای بوشهر.

---

## 2.9 Customer vs Shipper / Consignee

Customer باید کاملاً جدا از Shipper و Consignee تعریف شود.

Customer ممکن است شخصیت حقیقی یا حقوقی باشد و رابطه مستقیم و تجاری با شرکت داشته باشد، حتی اگر اسمش در B/L یا Manifest نیاید.

مثال کارفرما: Customer می‌تواند «آرش علیدادی» باشد؛ کالا ممکن است از استرالیا تهیه شده باشد، Shipper شرکت استرالیایی باشد و Consignee در مقصد شرکت دیگری باشد. در سیستم داخلی، کالا و عملیات به Customer آرش علیدادی مرتبط می‌شوند ولی B/L ممکن است نام Shipper و Consignee دیگری داشته باشد.

Invoice باید برای Customer صادر شود و در Profile / Ledger او قرار بگیرد.

در Profile مشتری باید بتوان عملیات و رابطه مالی با آن Customer را دید، از جمله Invoiceها، پرداخت‌ها، بدهی/بستانکاری، Ledger و سوابق مرتبط.

---

## 2.10 ETOZ / Job Number

برای بعضی Shipmentها از ابتدا تا پایان یک فرآیند چند هفته یا چند ماه طول می‌کشد و هزینه‌های مختلفی در مسیر ایجاد می‌شود.

برای این فرآیند باید Job Number وجود داشته باشد.

Job Number باید مانند یک پرونده تجمیعی عمل کند تا هزینه‌های مختلف، مثل Repairing، Customs، Lowbed، Transport، Ship، Crane و سایر هزینه‌ها روی همان کار جمع شوند.

در زمان صدور Invoice، حسابدار باید بتواند Job Numberهای مرتبط را ببیند و هزینه‌ها را در Invoice لحاظ کند.

---

## 2.11 B/L و Manifest

پس از Finalized شدن Loading List، کالاهای بارگیری‌شده وارد مرحله B/L و Manifest می‌شوند.

B/L شامل اطلاعاتی مثل:
- Shipper
- Consignee
- Notify Party
- Vessel
- Voyage
- Port of Loading
- Port of Discharge
- B/L Number
- Description
- Quantity
- Marks & Numbers
- Net/Gross Weight
- CBM
- Place of B/L Issue
- Date of B/L Issue
- Freight Charges (Collect/Prepaid)
- Stamp / Signature

B/L ابتدا باید به صورت Draft صادر شود و Watermark `DRAFT` داشته باشد. سپس برای Customer ارسال می‌شود تا بررسی و اصلاح شود. پس از Approval/Finalization، Draft از بین می‌رود و B/L نهایی صادر می‌شود.

شماره B/L باید طبق Format تعریف‌شده برای مقصد تولید شود.

Manifest نیز شامل Header مثل Vessel، Voyage، Port of Loading، Port of Discharge، Manifest Number و Date است.

ردیف‌های Manifest باید از B/Lهای صادرشده ساخته شوند و شامل B/L Number، Description، Shipper، Consignee، Units/Packages و Gross Weight باشند.

در پایان Manifest باید Total Units، Total Packages و Total Weight نمایش داده شود.

اگر یک Vessel چند شرکت یا Forwarder مختلف را حمل می‌کند، Manifest یکی است ولی B/Lهای شرکت‌های مختلف می‌توانند Format شماره متفاوت داشته باشند.

---

## 2.12 Document Output / Templates

برای هر سند شرکت یک Format خاص دارد و کارفرما می‌خواهد Templateها قابل Upload باشند.

از جمله:
- Loading List
- B/L
- Manifest
- Invoice
- Delivery Order
- Release Order
- Salary Slip
- Voucher
- Payment
- Receipt
- Ledger

برای هر سند باید بتوان Format چاپ، PDF و Excel را طبق Template شرکت تعریف کرد.

برای PDF، Stamp/Mark/Signature می‌تواند اتوماتیک داخل خروجی باشد.

برای Print فیزیکی ممکن است Stamp دیجیتال حذف شود تا مهر زنده و امضا به‌صورت فیزیکی انجام شود.

---

## 2.13 Accounting / Invoice

Invoice می‌تواند دو حالت داشته باشد:

1. Invoice مرتبط با B/L / Manifest / Job Number
2. Invoice مستقل از B/L و Job Number

برای Invoiceهای مرتبط با بارنامه، بعد از Issued شدن B/L، Invoice می‌تواند ابتدا به صورت Draft ساخته شود تا حسابدار آن را با Job Numberهای مرتبط Match کند.

Invoice باید اطلاعاتی مثل Invoice Number، Date، Customer، B/L/Manifest Reference، Description، Rate، Quantity، Amount، VAT، Subtotal و Total داشته باشد.

برخی Invoiceها VAT دارند و برخی ندارند.

سیستم باید گزارش VAT بر اساس بازه زمانی/فصل/ماه بدهد؛ مثلاً Total VAT دریافتی و پرداختی.

Invoice صادرشده باید در Customer Ledger به عنوان Debit بنشیند.

Payment/Receipt در Ledger به عنوان Credit یا مطابق قواعد حسابداری ثبت می‌شود و Balance محاسبه می‌شود.

---

## 2.14 Ledger / General Journal

Customer Profile باید Ledger کامل داشته باشد تا بتوان دید:
- چه Invoiceهایی صادر شده
- چه پرداخت‌هایی انجام شده
- چه مبلغی بدهکار است
- چه مبلغی بستانکار است
- Balance فعلی چیست
- آخرین Invoice چه زمانی صادر شده
- Invoice Paid / Unpaid / Partial Payment است یا نه

علاوه بر Invoice و Payment، باید امکان General Journal برای ثبت پرداخت/دریافت خارج از چرخه مستقیم Invoice وجود داشته باشد.

اگر شرکت به یک شخص پول پرداخت کند، می‌تواند در Ledger به عنوان Debit ثبت شود؛ اگر شخصی پولی به شرکت پرداخت کند، به عنوان Credit ثبت شود.

هزینه‌های جاری شرکت مثل هزینه‌های دفتری نیز باید در سیستم ثبت شوند تا در پایان سال به عنوان هزینه‌های شرکت در محاسبه سود و زیان لحاظ شوند.

---

## 2.15 Payment / Receipt Voucher

Payment Voucher و Receipt Voucher هرکدام سند مالی مستقل دارند.

در Payment باید امکان ثبت/Upload تصویر یا مدرک ID Card گیرنده وجود داشته باشد، ترجیحاً پشت و رو.

بعد امضای دریافت‌کننده نیز باید گرفته و ثبت شود.

همین منطق برای Salary Slip هم وجود دارد: در زمان صدور Salary Slip، تصویر پشت و روی ID Card کارمند قابل Upload یا ثبت با دوربین باشد و در نسخه چاپی نیز همراه با امضای کارمند نشان داده شود تا دریافت حقوق مشخص باشد.

---

## 2.16 Release Order

پس از رسیدن Vessel به مقصد و تخلیه کالا، اگر Customer مبلغ Invoice را کامل پرداخت کند، Release Order صادر می‌شود.

ممکن است:
- Full Payment / Paid
- Partial Payment
- Unpaid / Credit

باشد.

Release Order باید وضعیت پرداخت را نشان دهد و سیستم باید بتواند Released / Paid / Partial / Unpaid را گزارش دهد و برای بدهی‌های معوق Alert/Notice داشته باشد.

Agent مقصد باید بتواند فقط اسناد مربوط به Port خودش را ببیند.

مثلاً Agent خرمشهر فقط بارنامه‌ها و Releaseهای خرمشهر را ببیند.

---

## 2.17 Delivery Order

برای کالاهایی که در بندر شرکت/محل مربوطه تخلیه شده‌اند و باید به مشتری/Consignee تحویل شوند، Delivery Order صادر می‌شود.

Delivery Order دارای شماره، تاریخ، Port و اطلاعات استاندارد خود شرکت است و همراه سایر اسناد به مشتری/Consignee تحویل می‌شود.

---

## 2.18 Agent Access

Agentهای مقصد باید Login مستقل داشته باشند.

هر Agent فقط باید داده‌های مربوط به مقصد خودش را ببیند، به‌خصوص B/L، Manifest و Release Order.

هدف این است که Agent به جای تماس تلفنی مداوم با دفتر مرکزی، خودش وضعیت Release را ببیند و به Customer پاسخ بدهد.

---

## 2.19 Reports / Voyage Profitability

برای هر Manifest / Vessel / Voyage باید گزارش مالی وجود داشته باشد.

هزینه‌های Vessel می‌تواند شامل:
- Vessel Hire
- Port Use
- Port Handling
- Lashing
- سایر هزینه‌های مرتبط با سفر

باشد.

درآمد نیز از مجموع Invoiceهای صادرشده برای بارنامه‌های همان Manifest/Voyage محاسبه می‌شود.

هدف: محاسبه Profit/Loss به ازای هر Vessel/Voyage/Manifest و امکان استخراج گزارش‌های مالی و مالیاتی با Filter.

---

## 2.20 Archive / Company Archive

عنوان «بایگانی شرکت» نیز مطرح شده و قرار است جزئیات آن در فایل بعدی/منبع بعدی تعریف شود.

---

# 3. Real Document Evidence

## 3.1 Bill of Lading — BL-1X D155A CH NO 8308-1

- B/L No: `KHS/26-110`
- Shipper: `RAS AL KHAIMAH MACHINERIES LLC`
- Consignee: `JOINT MECHANIC CO`
- Notify Party: `SAME AS CONSIGNEE`
- Destination Agent: `BADBAN ARVAND ROOD SHIPPING CO`
- Vessel: `MEHDI 11`
- Voyage: `02/26`
- Port of Loading: `HAMRIYA PORT, DUBAI, UAE`
- Port of Discharge: `KHORRAM SHAHR, PERSIAN GULF, IRAN`
- Goods: `USED KOMATSU D155A BULLDOZER`
- Chassis No: `KMT0D105EMC088308`
- Quantity: `1 UNIT`
- Gross Weight: `42,000 KGS`
- On Deck: Yes
- Place of B/L Issue: `DUBAI`
- Date of B/L Issue: `29-AUG-26`
- Freight Charge: `FREIGHT PREPAID`
- No. of Original B/L: `1`
- Stamp & Signature: As Agent

## 3.2 Manifest — MAN-MEHDI 11 KHO-26-006

- Vessel: `BARGE - MEHDI 11`
- Tug: `LAYAN GULF`
- Voyage: `02/26`
- Manifest No: `DSMAN/KHO-26-006`
- Date: `05-Sep-26`
- Port of Loading: `HAMRIYA, DUBAI, UAE`
- Port of Discharge: `KHORRAM SHAHR, PERSIAN GULF, IRAN`
- Company: `DUNA SHIPPING LLC`
- Address: `AL NOKHITHA BLDG, HAMRIYA PORT, DUBAI, UAE`
- Contact / Mobile / Email are present.
- Table fields: `#`, `BL`, `DESCRIPTION OF GOODS`, `CONSIGNEE`, `SHIPPER`, `UNIT/PKGS`, `GROSS WEIGHT (KGS)`.
- 45 numbered rows are represented in the source text.
- Total shown: `32 UNITS AND 79 PKGS`, with `111` in total unit/pkg column and `991,886 KGS` gross weight.

## 3.3 Receipt Voucher

- Company: `RUKN ALHMREYA TRANSPORT L.L.C`
- TRN: `104652986100003`
- Voucher No: `477`
- Date: `6-Aug-26`
- Account: `DUNA SHIPPING`
- Amount: `AED 1,600.00`
- References: `1517`, `1526`, `Advance 477`
- Through: `Cash`
- On Account of: `CASH RECEIVED FROM DUNA SHIPPING AGT`
- Authorised Signature present.

## 3.4 Ledger Account / SOA

- Account: `DUNA SHIPPING`
- Period: `1-Jul-26 to 7-Sep-26`
- Transactions contain Sales and Receipt entries.
- Closing Balance shown: `683.50 Dr`
- Totals shown: Debit `4,903.50`, Credit `4,220.00`.
- Particulars include trailer, forklift, lowbed, cargo shifting, loading and voyage-specific work.

## 3.5 Tax Invoice

- Bill To: `MR. SHAHOKH SHAHVARAEI`
- Invoice No: `DSINV/26-172`
- Date: `6-Aug-26`
- Currency: `AED`
- TRN: `100353243700003`
- Reference: `BOE/DEC/BL#: KHS/26-108`
- Manifest: `DSKHS-26-005`
- Vessel: `DAHAR 10`
- Voyage: `02/26`
- Loading Port: `HAMRIYA`
- Discharge Port: `KHORRAM SHAHR`
- Goods: `USED TRUCK CRANE + 1 PKG`
- Charges: Freight, Storage, Customs Documentation, Transportation Jebel Ali → Hamriyah
- Sub Total: `27,370.00 AED`
- VAT: `0.00 AED`
- Total: `27,370.00 AED`

## 3.6 Proforma Invoice

- Seller: `DUNA SHIPPING LLC`
- PI No: `DSPRO/26-001`
- Date: `22-AUG-26`
- Buyer: `MR. RAMIN AHMADABADI`
- Origin: `INDIA`
- Terms of Delivery: `FOB`
- Payment: `100% ADVANCE PAYMENT`
- Currency: `AED`
- Port/Airport of Discharge: `BANDAR ABBAS, PERSIAN GULF, IRAN`
- Final Delivery Place: `MAKU FREE ZONE`
- Items include Hyundai R340L Excavator, Hydraulic Breaker, Quick Coupler.
- Grand Total: `690,000.00 AED`

## 3.7 Quotation

- Quotation No: `DSQUO/25-017`
- Date: `20-NOV-25`
- To: `MR. SHADMAN MEABADI`
- Subject: `1 UNIT USED VOLVO FINISHER`
- Items include Land Transport to Dubai Hamriyah Port, Freight Hamriyah → Bushehr, Documentation and Exit Charge.
- Grand Total: `7,700.00 AED`

---

# 4. Legacy Dashboard — What Exists

## 4.1 Existing / Partial Modules

- Operations → Yard Inventory
- Operations → Load List
- Operations → Yard
- Operations → Port
- B/L
- Manifest
- Shipper
- Agent
- Consignee
- Invoice
- Fin / Voucher
- Proforma
- Quotation
- Customer/user-related functionality
- Users / Roles / Permissions
- Customer Portal

## 4.2 Legacy Gaps

- Vessel as proper entity/model
- Ledger as independent accounting entity
- Delivery Order
- Release Order as independent document/workflow
- Salary
- Financial Reports
- Letters
- Robust Customer CRM/profile
- Clean Customer/Party separation
- API layer

## 4.3 Legacy Workflow

`Loading → Admin Review → Approved → BL → Manifest → Invoice → Fin`

Legacy Loading has parallel status concepts:
- admin_status: PENDING → APPROVED
- status: LOADED / IN_YARD
- in_status: PENDING / DONE / LOCAL ED / NO NEED

Legacy B/L: PENDING → RELEASED
Legacy Invoice: PAID / UNPAID

## 4.4 Legacy Auto Generation

- Manifest number by destination/Port sequence
- Voyage by Shipper + destination
- Invoice code sequential

## 4.5 Legacy UI / Access

- AdminLTE-style RTL interface
- Select2 / DataTables
- AJAX-driven selections
- PDF-ready print/preview pages
- Customer portal
- RBAC permissions
- User-scoped records

---

# 5. Important Evidence Conflicts / Items to Verify

این بخش‌ها عمداً به‌عنوان «Fact to Verify» نگه داشته شده‌اند و نباید بدون سؤال از کارفرما قطعی تلقی شوند:

1. فرمت دقیق Customer Code؛ در ویس چند نمونه متفاوت مثل `CUST 3.1` و `CUST 3SF-2` گفته شد.
2. منطق دقیق Voyage Number؛ یک‌جا وابسته به مقصد بیان شده ولی جزئیات Counter آن نیاز به تعریف دقیق دارد.
3. فرمت دقیق B/L Number برای هر Port.
4. فرمت دقیق Manifest Number.
5. تفاوت دقیق `Voyage` با `Manifest Number`.
6. وضعیت دقیق Document Status و انواع اسناد ورودی Cargo.
7. معنی دقیق `Nagle / Package` در گفتار؛ باید از کارفرما و سند واقعی قطعی شود.
8. اصطلاح ETOZ/ETDZ نیازمند تعیین نام صحیح و معنای دقیق فرآیند است.
9. اینکه `Customer Ledger` دقیقاً از چه حساب‌هایی تشکیل می‌شود و چه چیزی General Ledger است.
10. اینکه Invoice در تمام موارد به یک B/L متصل است یا ممکن است چند B/L / Shipment / Job را پوشش دهد.
11. اینکه یک Manifest چند Customer و چند Shipper/Consignee می‌تواند داشته باشد.
12. اینکه Approval توسط چه کسی و با چه شرایطی انجام می‌شود.
13. اینکه یک Loading List در نهایت Version History دارد یا فقط یک رکورد Edit می‌شود.
14. اینکه چه کسی می‌تواند Comment را Edit/Delete کند و آیا Audit Trail لازم است.
15. قواعد دقیق Release در Full / Partial / Credit.
16. محدوده دسترسی Agent و امکان Download/Print اسناد.
17. جزئیات Delivery Order و ارتباط آن با Cargo/B/L/Consignee.
18. VAT: چه Invoiceهایی مشمول‌اند، چه نرخ‌هایی، و آیا VAT روی Line یا کل Invoice محاسبه می‌شود.
19. ساختار هزینه‌های Vessel/Voyage و اینکه هر هزینه در کدام سطح ثبت می‌شود.
20. بایگانی شرکت و سیاست نگهداری اسناد هنوز کامل نشده است.
