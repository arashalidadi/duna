#!/usr/bin/env python3
"""Merge the `jobs` namespace + nav.jobs into apps/web/messages/{en,fa,ar}.json (Phase 18)."""
import json
from pathlib import Path

MSG = Path(__file__).resolve().parent.parent / "apps" / "web" / "messages"

DICT = {
    "en": {
        "page": {
            "title": "Jobs & Costing",
            "description": "Customer jobs with income/cost lines and live profit per job",
        },
        "actions": {
            "create": "New Job", "edit": "Edit", "delete": "Delete", "view": "View",
            "start": "Open", "complete": "Complete", "cancel": "Cancel job", "addItem": "Add line",
        },
        "status": {
            "DRAFT": "Draft", "OPEN": "Open", "COMPLETED": "Completed", "CANCELLED": "Cancelled",
        },
        "type": {
            "IMPORT_CLEARANCE": "Import clearance", "EXPORT": "Export",
            "TRANSIT": "Transit", "CUSTOMS": "Customs affairs", "TRANSPORT": "Transport", "OTHER": "Other",
        },
        "fields": {
            "number": "Job #", "title": "Title", "description": "Description",
            "jobType": "Job type", "customer": "Customer", "voyage": "Voyage",
            "currency": "Currency", "status": "Status",
            "openingDate": "Opening date", "notes": "Notes",
            "income": "Income", "cost": "Cost", "profit": "Profit",
            "totalIncome": "Income", "totalCost": "Cost",
            "completedOn": "Completed", "cancelledOn": "Cancelled",
        },
        "list": {
            "search": "Number, title or customer…", "allStatuses": "All statuses",
            "empty": {"title": "No jobs yet", "description": "Create the first job to start costing."},
        },
        "items": {
            "title": "Costing lines",
            "addTitle": "Add line", "editTitle": "Edit line", "editing": "Editing line…", "add": "Add",
            "empty": "No lines yet — add income and cost lines to compute profit.",
            "kind": {"INCOME": "Income", "COST": "Cost"},
            "INCOME": "Income", "COST": "Cost",
            "totals": "Totals",
            "category": "Category", "description": "Description", "amount": "Amount",
            "date": "Date",
            "errors": {
                "descriptionRequired": "Description is required",
                "descAmountRequired": "Description and amount are required",
                "badAmount": "Enter a valid amount",
            },
        },
        "form": {
            "title": "Create Job", "editTitle": "Edit Job",
            "description": "Lines are added after creation; profit is computed server-side.",
            "noType": "(no type)", "noCustomer": "— none —", "noVoyage": "— none —",
            "errors": {"titleRequired": "Title is required"},
        },
        "cancel": {
            "title": "Cancel job", "description": "Provide a cancel reason (audit).",
            "reason": "Cancel reason", "reasonPlaceholder": "e.g. customer cancelled",
        },
        "detail": {
            "title": "Job",
            "openedOn": "Opened", "completedOn": "Completed on", "cancelledOn": "Cancelled on",
        },
        "confirm": {
            "start": {"title": "Open job", "description": "Open {number}? Income/cost lines can still be adjusted."},
            "complete": {"title": "Complete job", "description": "Complete {number} with profit {profit} {currency}? Lines freeze after completion."},
            "delete": {"title": "Delete job", "description": "Delete {number}? Only DRAFT jobs can be deleted."},
        },
    },
    "fa": {
        "page": {
            "title": "پروژه‌ها و هزینه‌یابی",
            "description": "پروژه‌های مشتری با ردیف‌های درآمد/هزینه و سود زنده برای هر پروژه",
        },
        "actions": {
            "create": "پروژه جدید", "edit": "ویرایش", "delete": "حذف", "view": "مشاهده",
            "start": "بازگشایی", "complete": "تکمیل", "cancel": "لغو پروژه", "addItem": "افزودن ردیف",
        },
        "status": {
            "DRAFT": "پیش‌نویس", "OPEN": "باز", "COMPLETED": "تکمیل‌شده", "CANCELLED": "لغوشده",
        },
        "type": {
            "IMPORT_CLEARANCE": "ترخیص واردات", "EXPORT": "صادرات",
            "TRANSIT": "ترانزیت", "CUSTOMS": "امور گمرکی", "TRANSPORT": "حمل‌ونقل", "OTHER": "سایر",
        },
        "fields": {
            "number": "شماره پروژه", "title": "عنوان", "description": "توضیحات",
            "jobType": "نوع پروژه", "customer": "مشتری", "voyage": "سفر",
            "currency": "واحد پول", "status": "وضعیت",
            "openingDate": "تاریخ شروع", "notes": "یادداشت",
            "income": "درآمد", "cost": "هزینه", "profit": "سود",
            "totalIncome": "درآمد", "totalCost": "هزینه",
            "completedOn": "تاریخ تکمیل", "cancelledOn": "تاریخ لغو",
        },
        "list": {
            "search": "شماره، عنوان یا مشتری…", "allStatuses": "همه وضعیت‌ها",
            "empty": {"title": "پروژه‌ای ثبت نشده است", "description": "برای شروع هزینه‌یابی، اولین پروژه را ثبت کنید."},
        },
        "items": {
            "title": "ردیف‌های هزینه‌یابی",
            "addTitle": "افزودن ردیف", "editTitle": "ویرایش ردیف", "editing": "ویرایش ردیف…", "add": "افزودن",
            "empty": "هنوز ردیفی ثبت نشده — برای محاسبه سود، ردیف درآمد و هزینه اضافه کنید.",
            "kind": {"INCOME": "درآمد", "COST": "هزینه"},
            "INCOME": "درآمد", "COST": "هزینه",
            "totals": "جمع کل",
            "category": "دسته", "description": "شرح", "amount": "مبلغ",
            "date": "تاریخ",
            "errors": {
                "descriptionRequired": "شرح الزامی است",
                "descAmountRequired": "شرح و مبلغ الزامی است",
                "badAmount": "مبلغ معتبر وارد کنید",
            },
        },
        "form": {
            "title": "ایجاد پروژه", "editTitle": "ویرایش پروژه",
            "description": "ردیف‌ها پس از ایجاد اضافه می‌شوند؛ سود سمت سرور محاسبه می‌شود.",
            "noType": "(بدون نوع)", "noCustomer": "— بدون مشتری —", "noVoyage": "— بدون سفر —",
            "errors": {"titleRequired": "عنوان الزامی است"},
        },
        "cancel": {
            "title": "لغو پروژه", "description": "دلیل لغو را وارد کنید (حسابرسی).",
            "reason": "دلیل لغو", "reasonPlaceholder": "مثلاً: انصراف مشتری",
        },
        "detail": {
            "title": "پروژه",
            "openedOn": "تاریخ بازگشایی", "completedOn": "تاریخ تکمیل", "cancelledOn": "تاریخ لغو",
        },
        "confirm": {
            "start": {"title": "بازگشایی پروژه", "description": "پروژه {number} باز شود؟ ردیف‌های درآمد/هزینه همچنان قابل ویرایش‌اند."},
            "complete": {"title": "تکمیل پروژه", "description": "پروژه {number} با سود {profit} {currency} تکمیل شود؟ پس از تکمیل، ردیف‌ها قفل می‌شوند."},
            "delete": {"title": "حذف پروژه", "description": "پروژه {number} حذف شود؟ فقط پروژه‌های پیش‌نویس قابل حذف‌اند."},
        },
    },
    "ar": {
        "page": {
            "title": "الخدمات والتكلفة",
            "description": "خدمات العملاء مع بنود الإيراد/التكلفة وربح مباشر لكل خدمة",
        },
        "actions": {
            "create": "خدمة جديدة", "edit": "تعديل", "delete": "حذف", "view": "عرض",
            "start": "فتح", "complete": "إنجاز", "cancel": "إلغاء الخدمة", "addItem": "إضافة بند",
        },
        "status": {
            "DRAFT": "مسودة", "OPEN": "مفتوحة", "COMPLETED": "منجزة", "CANCELLED": "ملغاة",
        },
        "type": {
            "IMPORT_CLEARANCE": "تخليص واردات", "EXPORT": "صادرات",
            "TRANSIT": "ترانزيت", "CUSTOMS": "شؤون جمركية", "TRANSPORT": "نقل", "OTHER": "أخرى",
        },
        "fields": {
            "number": "رقم الخدمة", "title": "العنوان", "description": "الوصف",
            "jobType": "نوع الخدمة", "customer": "العميل", "voyage": "الرحلة",
            "currency": "العملة", "status": "الحالة",
            "openingDate": "تاريخ الفتح", "notes": "ملاحظات",
            "income": "الإيراد", "cost": "التكلفة", "profit": "الربح",
            "totalIncome": "الإيراد", "totalCost": "التكلفة",
            "completedOn": "تاريخ الإنجاز", "cancelledOn": "تاريخ الإلغاء",
        },
        "list": {
            "search": "الرقم أو العنوان أو العميل…", "allStatuses": "كل الحالات",
            "empty": {"title": "لا توجد خدمات", "description": "أنشئ أول خدمة لبدء التكلفة."},
        },
        "items": {
            "title": "بنود التكلفة",
            "addTitle": "إضافة بند", "editTitle": "تعديل البند", "editing": "تعديل البند…", "add": "إضافة",
            "empty": "لا بنود بعد — أضف بنود الإيراد والتكلفة لحساب الربح.",
            "kind": {"INCOME": "إيراد", "COST": "تكلفة"},
            "INCOME": "إيراد", "COST": "تكلفة",
            "totals": "الإجماليات",
            "category": "الفئة", "description": "الشرح", "amount": "المبلغ",
            "date": "التاريخ",
            "errors": {
                "descriptionRequired": "الشرح مطلوب",
                "descAmountRequired": "الشرح والمبلغ مطلوبان",
                "badAmount": "أدخل مبلغًا صالحًا",
            },
        },
        "form": {
            "title": "إنشاء خدمة", "editTitle": "تعديل الخدمة",
            "description": "تُضاف البنود بعد الإنشاء؛ ويُحسب الربح في الخادم.",
            "noType": "(بلا نوع)", "noCustomer": "— بلا عميل —", "noVoyage": "— بلا رحلة —",
            "errors": {"titleRequired": "العنوان مطلوب"},
        },
        "cancel": {
            "title": "إلغاء الخدمة", "description": "أدخل سبب الإلغاء (للتدقيق).",
            "reason": "سبب الإلغاء", "reasonPlaceholder": "مثال: ألغى العميل",
        },
        "detail": {
            "title": "الخدمة",
            "openedOn": "تاريخ الفتح", "completedOn": "تاريخ الإنجاز", "cancelledOn": "تاريخ الإلغاء",
        },
        "confirm": {
            "start": {"title": "فتح الخدمة", "description": "فتح {number}؟ ما زالت بنود الإيراد/التكلفة قابلة للتعديل."},
            "complete": {"title": "إنجاز الخدمة", "description": "إنجاز {number} بربح {profit} {currency}؟ تُقفل البنود بعد الإنجاز."},
            "delete": {"title": "حذف الخدمة", "description": "حذف {number}؟ يمكن حذف مسودات الخدمات فقط."},
        },
    },
}

NAV = {
    "en": {"jobs": "Jobs & Costing"},
    "fa": {"jobs": "پروژه‌ها و هزینه‌یابی"},
    "ar": {"jobs": "الخدمات والتكلفة"},
}

for lang, data in DICT.items():
    p = MSG / f"{lang}.json"
    msgs = json.loads(p.read_text(encoding="utf-8"))
    msgs["jobs"] = data
    msgs["nav"]["jobs"] = NAV[lang]["jobs"]
    p.write_text(json.dumps(msgs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    def count_keys(d):
        n = 0
        for v in d.values():
            n += 1 if not isinstance(v, dict) else count_keys(v)
        return n
    print(f"{lang}: jobs={count_keys(data)} keys, nav.jobs merged")
print("done")
