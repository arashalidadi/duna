#!/usr/bin/env python3
"""Merge the proforma namespace into apps/web/messages/{en,fa,ar}.json (Phase 14)."""
import json
from pathlib import Path

MSG = Path(__file__).resolve().parent.parent / "apps" / "web" / "messages"

EN = {
    "page": {
        "title": "Proforma Invoices",
        "description": "Quotes and pre-invoices — convert into real invoices with one click.",
    },
    "list": {
        "title": "Proforma list",
        "subtitle": "DRAFT proformas are editable; issuing freezes them for conversion.",
        "search": "Search by number, title or customer",
        "allStatuses": "All statuses",
        "unconvertedOnly": "Unconverted only",
        "empty": {"title": "No proforma invoices", "description": "Create your first quote to get started."},
    },
    "fields": {
        "number": "Number",
        "title": "Title",
        "customer": "Customer",
        "status": "Status",
        "currency": "Currency",
        "issueDate": "Issue date",
        "validUntil": "Valid until",
        "total": "Total",
        "discount": "Discount",
        "taxRate": "Tax rate %",
        "description": "Description",
        "notes": "Notes",
        "cancelReason": "Cancellation reason",
        "convertedTo": "Converted to",
    },
    "status": {"DRAFT": "Draft", "ISSUED": "Issued", "CANCELLED": "Cancelled"},
    "actions": {"create": "New proforma", "issue": "Issue", "convert": "Convert to invoice", "cancelOrder": "Cancel proforma", "cancelling": "Cancelling…"},
    "totals": {"subtotal": "Subtotal", "tax": "Tax", "total": "Total"},
    "create": {
        "title": "New proforma invoice",
        "description": "Add lines and optional tax/discount — totals are computed automatically.",
        "selectCustomer": "Select customer…",
        "titlePlaceholder": "e.g. Freight quote — MV Ali / voyage 12",
        "itemsTitle": "Lines",
        "addItem": "Add line",
        "itemDescription": "Description",
        "qty": "Qty",
        "unitPrice": "Unit price",
        "creating": "Creating…",
        "errors": {"customerRequired": "A customer is required", "itemsRequired": "Add at least one line"},
    },
    "detail": {"title": "Proforma details", "items": "Lines", "lineTotal": "Amount", "convertedBadge": "Converted"},
    "convert": {
        "title": "Convert to invoice",
        "description": "This creates a DRAFT invoice with the same lines and totals.",
        "body": "The proforma will be marked as converted. This can only be done once.",
        "converting": "Converting…",
        "resultTitle": "Invoice created",
        "resultLine": "Draft invoice {number} was created from this proforma.",
        "resultHint": "Review it on the invoices page, then issue it.",
    },
    "confirm": {
        "issue": {"title": "Issue proforma?", "description": "After issuing, lines and header are frozen."},
        "cancel": {
            "title": "Cancel proforma?",
            "description": "A cancelled proforma is terminal and can be deleted afterwards.",
            "reason": "Reason",
            "reasonPlaceholder": "Why is this proforma being cancelled?",
        },
    },
}

FA = {
    "page": {"title": "پیش‌فاکتورها", "description": "پیش‌فاکتور و استعلام قیمت — با یک کلیک به فاکتور رسمی تبدیل می‌شوند."},
    "list": {
        "title": "فهرست پیش‌فاکتورها",
        "subtitle": "پیش‌فاکتورهای پیش‌نویس قابل ویرایش‌اند؛ پس از صدور، برای تبدیل قفل می‌شوند.",
        "search": "جستجو با شماره، عنوان یا مشتری",
        "allStatuses": "همه وضعیت‌ها",
        "unconvertedOnly": "فقط تبدیل‌نشده‌ها",
        "empty": {"title": "پیش‌فاکتوری ثبت نشده", "description": "برای شروع، اولین پیش‌فاکتور را بسازید."},
    },
    "fields": {
        "number": "شماره",
        "title": "عنوان",
        "customer": "مشتری",
        "status": "وضعیت",
        "currency": "واحد پول",
        "issueDate": "تاریخ صدور",
        "validUntil": "اعتبار تا",
        "total": "مبلغ کل",
        "discount": "تخفیف",
        "taxRate": "نرخ مالیات ٪",
        "description": "توضیحات",
        "notes": "یادداشت‌ها",
        "cancelReason": "دلیل ابطال",
        "convertedTo": "تبدیل‌شده به",
    },
    "status": {"DRAFT": "پیش‌نویس", "ISSUED": "صادرشده", "CANCELLED": "باطل‌شده"},
    "actions": {"create": "پیش‌فاکتور جدید", "issue": "صدور", "convert": "تبدیل به فاکتور", "cancelOrder": "ابطال پیش‌فاکتور", "cancelling": "در حال ابطال…"},
    "totals": {"subtotal": "جمع سطرها", "tax": "مالیات", "total": "مبلغ کل"},
    "create": {
        "title": "پیش‌فاکتور جدید",
        "description": "سطرها و در صورت نیاز مالیات/تخفیف را اضافه کنید — جمع‌ها خودکار محاسبه می‌شوند.",
        "selectCustomer": "انتخاب مشتری…",
        "titlePlaceholder": "مثلاً استعلام کرایه — کشتی علی / سفر ۱۲",
        "itemsTitle": "سطرها",
        "addItem": "افزودن سطر",
        "itemDescription": "شرح",
        "qty": "تعداد",
        "unitPrice": "بهای واحد",
        "creating": "در حال ساخت…",
        "errors": {"customerRequired": "انتخاب مشتری الزامی است", "itemsRequired": "حداقل یک سطر اضافه کنید"},
    },
    "detail": {"title": "جزئیات پیش‌فاکتور", "items": "سطرها", "lineTotal": "مبلغ", "convertedBadge": "تبدیل‌شده"},
    "convert": {
        "title": "تبدیل به فاکتور",
        "description": "با این کار یک فاکتور پیش‌نویس با همان سطرها و مبالغ ساخته می‌شود.",
        "body": "این پیش‌فاکتور «تبدیل‌شده» علامت می‌خورد؛ تبدیل فقط یک‌بار ممکن است.",
        "converting": "در حال تبدیل…",
        "resultTitle": "فاکتور ساخته شد",
        "resultLine": "فاکتور پیش‌نویس {number} از این پیش‌فاکتور ساخته شد.",
        "resultHint": "در صفحه فاکتورها بازبینی و سپس صادرش کنید.",
    },
    "confirm": {
        "issue": {"title": "صدور پیش‌فاکتور؟", "description": "پس از صدور، سطرهای عنوان و شرح قفل می‌شوند."},
        "cancel": {
            "title": "ابطال پیش‌فاکتور؟",
            "description": "پیش‌فاکتور باطل‌شده غیرقابل بازگشت است و بعداً قابل حذف است.",
            "reason": "دلیل",
            "reasonPlaceholder": "چرا این پیش‌فاکتور باطل می‌شود؟",
        },
    },
}

AR = {
    "page": {"title": "الفواتير الأولية", "description": "عروض وفواتير أولية — تُحوَّل إلى فاتورة فعلية بنقرة واحدة."},
    "list": {
        "title": "قائمة الفواتير الأولية",
        "subtitle": "المسودات قابلة للتحرير؛ بعد الإصدار تُجمَّد للتحويل.",
        "search": "ابحث بالرقم أو العنوان أو العميل",
        "allStatuses": "كل الحالات",
        "unconvertedOnly": "غير المحوَّلة فقط",
        "empty": {"title": "لا توجد فواتير أولية", "description": "أنشئ أول عرض للسعر للبدء."},
    },
    "fields": {
        "number": "الرقم",
        "title": "العنوان",
        "customer": "العميل",
        "status": "الحالة",
        "currency": "العملة",
        "issueDate": "تاريخ الإصدار",
        "validUntil": "صالح حتى",
        "total": "الإجمالي",
        "discount": "الخصم",
        "taxRate": "نسبة الضريبة ٪",
        "description": "الوصف",
        "notes": "ملاحظات",
        "cancelReason": "سبب الإلغاء",
        "convertedTo": "حوِّلت إلى",
    },
    "status": {"DRAFT": "مسودة", "ISSUED": "صادر", "CANCELLED": "ملغى"},
    "actions": {"create": "فاتورة أولية جديدة", "issue": "إصدار", "convert": "تحويل إلى فاتورة", "cancelOrder": "إلغاء الفاتورة الأولية", "cancelling": "جارٍ الإلغاء…"},
    "totals": {"subtotal": "المجموع الفرعي", "tax": "الضريبة", "total": "الإجمالي"},
    "create": {
        "title": "فاتورة أولية جديدة",
        "description": "أضف بنودًا وضريبة/خصمًا اختياريًا — تُحسب المجاميع تلقائيًا.",
        "selectCustomer": "اختر العميل…",
        "titlePlaceholder": "مثال: عرض سعر الشحن — السفينة علي / الرحلة 12",
        "itemsTitle": "البنود",
        "addItem": "إضافة بند",
        "itemDescription": "الوصف",
        "qty": "الكمية",
        "unitPrice": "سعر الوحدة",
        "creating": "جارٍ الإنشاء…",
        "errors": {"customerRequired": "اختيار العميل إلزامي", "itemsRequired": "أضف بندًا واحدًا على الأقل"},
    },
    "detail": {"title": "تفاصيل الفاتورة الأولية", "items": "البنود", "lineTotal": "المبلغ", "convertedBadge": "محوَّلة"},
    "convert": {
        "title": "التحويل إلى فاتورة",
        "description": "ينشئ هذا فاتورة مسودة بنفس البنود والمجاميع.",
        "body": "سيُعلَّم المستند كمحوَّل؛ التحويل يمكن مرة واحدة فقط.",
        "converting": "جارٍ التحويل…",
        "resultTitle": "تم إنشاء الفاتورة",
        "resultLine": "أُنشئت الفاتورة المسودة {number} من هذا المستند.",
        "resultHint": "راجعها في صفحة الفواتير ثم أصدرها.",
    },
    "confirm": {
        "issue": {"title": "إصدار الفاتورة الأولية؟", "description": "بعد الإصدار تُجمَّد البنود والترويسة."},
        "cancel": {
            "title": "إلغاء الفاتورة الأولية؟",
            "description": "الإلغاء نهائي ويمكن الحذف بعده.",
            "reason": "السبب",
            "reasonPlaceholder": "لماذا تُلغى هذه الفاتورة الأولية؟",
        },
    },
}

def set_deep(dst, src, prefix=""):
    added = 0
    for k, v in src.items():
        if isinstance(v, dict):
            added += set_deep(dst.setdefault(k, {}), v, f"{prefix}{k}.")
        else:
            if k not in dst:
                added += 1
            elif isinstance(dst[k], dict):
                raise SystemExit(f"CONFLICT object vs str at {prefix}{k}")
            dst[k] = v
    return added

def leaves(d):
    n = 0
    for v in d.values():
        n += leaves(v) if isinstance(v, dict) else 1
    return n

total = None
for loc, data in (("en", EN), ("fa", FA), ("ar", AR)):
    p = MSG / f"{loc}.json"
    msgs = json.loads(p.read_text(encoding="utf-8"))
    ns = msgs.setdefault("proforma", {})
    added = set_deep(ns, data)
    # nav label
    msgs["nav"]["proformas"] = data["page"]["title"] if False else {
        "en": "Proforma Invoices", "fa": "پیش‌فاکتورها", "ar": "الفواتير الأولية"
    }[loc]
    p.write_text(json.dumps(msgs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n = leaves(msgs["proforma"])
    assert n == leaves(EN), f"{loc} leaf mismatch {n} != {leaves(EN)}"
    print(f"{loc}: proforma={n} leaves (new {added}), nav.proformas set")
print("proforma namespace merged OK")
