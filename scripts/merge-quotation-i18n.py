#!/usr/bin/env python3
"""Phase 15 — merge the `quotation` i18n namespace (en/fa/ar) + nav.quotations.

Mechanically mirrors merge-proforma-i18n.py: builds the full nested dict per
language, merges under top-level "quotation" in apps/web/messages/{en,fa,ar}.json,
and inserts nav.quotations next to the existing nav.proformas entry wherever the
`proformas` nav label lives (nav may live at top level or under `common`).
Idempotent: re-running just overwrites the same keys.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MESSAGES = ROOT / "apps" / "web" / "messages"

EN = {
    "page": {"title": "Quotations", "description": "Price quotes sent to customers — convertible to proforma invoices"},
    "actions": {"create": "New Quotation", "send": "Send", "accept": "Accept", "reject": "Reject",
                "convert": "Convert", "cancelling": "Cancelling...", "rejecting": "Rejecting..."},
    "status": {"DRAFT": "Draft", "SENT": "Sent", "ACCEPTED": "Accepted", "REJECTED": "Rejected", "CANCELLED": "Cancelled"},
    "list": {"title": "Quotation List", "subtitle": "Search, filter and manage quotations", "search": "Search...",
             "allStatuses": "All statuses", "convertibleOnly": "Convertible only",
             "empty": {"title": "No quotations yet", "description": "Create a quotation to get started."}},
    "fields": {"number": "Number", "customer": "Customer", "issueDate": "Issue date", "validUntil": "Valid until",
               "total": "Total", "status": "Status", "currency": "Currency", "title": "Title",
               "taxRate": "Tax rate %", "discount": "Discount", "notes": "Notes", "description": "Description",
               "cancelReason": "Cancel reason", "rejectReason": "Reject reason", "convertedTo": "Converted to"},
    "create": {"title": "Create Quotation", "description": "Fill header and lines; totals compute automatically.",
               "creating": "Creating...", "selectCustomer": "Select customer...", "itemsTitle": "Line items",
               "itemDescription": "Item description", "qty": "Qty", "unitPrice": "Unit price", "addItem": "Add item",
               "errors": {"customerRequired": "Customer is required", "itemsRequired": "At least one line is required"}},
    "totals": {"subtotal": "Subtotal", "tax": "Tax", "total": "Total"},
    "detail": {"items": "Line items", "lineTotal": "Line total", "convertedBadge": "Converted to {number}"},
    "convert": {"title": "Convert to proforma", "description": "Converts this accepted quotation into a DRAFT proforma (one time).",
                "body": "Convert quotation {number} (total {total} {currency}) into a proforma invoice?",
                "converting": "Converting...", "resultTitle": "Converted", "resultLine": "Proforma {number} created.",
                "resultHint": "The proforma starts as DRAFT; issue it before converting to an invoice."},
    "confirm": {
        "send": {"title": "Send quotation", "description": "Once sent, the lines and amounts are frozen."},
        "accept": {"title": "Accept quotation", "description": "Accepting enables conversion to a proforma invoice."},
        "reject": {"title": "Reject quotation", "description": "Provide a reject reason.",
                   "reason": "Reject reason", "reasonPlaceholder": "e.g. Price above customer budget"},
        "cancel": {"title": "Cancel quotation", "description": "Provide a cancel reason.",
                   "reason": "Cancel reason", "reasonPlaceholder": "e.g. Superseded"},
    },
}

FA = {
    "page": {"title": "استعلام‌بها", "description": "استعلام‌بهای ارسال‌شده برای مشتری — قابل تبدیل به پیش‌فاکتور"},
    "actions": {"create": "استعلام جدید", "send": "ارسال", "accept": "پذیرش", "reject": "رد",
                "convert": "تبدیل", "cancelling": "در حال لغو...", "rejecting": "در حال رد..."},
    "status": {"DRAFT": "پیش‌نویس", "SENT": "ارسال‌شده", "ACCEPTED": "پذیرفته‌شده", "REJECTED": "ردشده", "CANCELLED": "لغوشده"},
    "list": {"title": "فهرست استعلام‌بها", "subtitle": "جستجو، فیلتر و مدیریت استعلام‌بها", "search": "جستجو...",
             "allStatuses": "همه وضعیت‌ها", "convertibleOnly": "فقط قابل تبدیل",
             "empty": {"title": "استعلام‌بهایی ثبت نشده است", "description": "برای شروع، یک استعلام‌بها ایجاد کنید."}},
    "fields": {"number": "شماره", "customer": "مشتری", "issueDate": "تاریخ ارسال", "validUntil": "اعتبار تا",
               "total": "مجموع", "status": "وضعیت", "currency": "واحد پول", "title": "عنوان",
               "taxRate": "نرخ مالیات %", "discount": "تخفیف", "notes": "یادداشت", "description": "شرح",
               "cancelReason": "دلیل لغو", "rejectReason": "دلیل رد", "convertedTo": "تبدیل‌شده به"},
    "create": {"title": "ایجاد استعلام‌بها", "description": "سربرگ و اقلام را وارد کنید؛ مجموع‌ها خودکار محاسبه می‌شوند.",
               "creating": "در حال ایجاد...", "selectCustomer": "انتخاب مشتری...", "itemsTitle": "اقلام",
               "itemDescription": "شرح قلم", "qty": "تعداد", "unitPrice": "قیمت واحد", "addItem": "افزودن قلم",
               "errors": {"customerRequired": "انتخاب مشتری الزامی است", "itemsRequired": "حداقل یک قلم لازم است"}},
    "totals": {"subtotal": "جمع فرعی", "tax": "مالیات", "total": "مجموع کل"},
    "detail": {"items": "اقلام", "lineTotal": "مجموع خط", "convertedBadge": "تبدیل‌شده به {number}"},
    "convert": {"title": "تبدیل به پیش‌فاکتور", "description": "این استعلام‌بهای پذیرفته‌شده یک‌بار به پیش‌فاکتور پیش‌نویس تبدیل می‌شود.",
                "body": "استعلام {number} با مجموع {total} {currency} به پیش‌فاکتور تبدیل شود؟",
                "converting": "در حال تبدیل...", "resultTitle": "تبدیل انجام شد", "resultLine": "پیش‌فاکتور {number} ساخته شد.",
                "resultHint": "پیش‌فاکتور در وضعیت پیش‌نویس است و پس از صدور قابل تبدیل به فاکتور است."},
    "confirm": {
        "send": {"title": "ارسال استعلام‌بها", "description": "پس از ارسال، اقلام و مبالغ قابل ویرایش نیستند."},
        "accept": {"title": "پذیرش استعلام‌بها", "description": "با پذیرش، امکان تبدیل به پیش‌فاکتور فراهم می‌شود."},
        "reject": {"title": "رد استعلام‌بها", "description": "دلیل رد را وارد کنید.",
                   "reason": "دلیل رد", "reasonPlaceholder": "مثلاً: قیمت بالاتر از بودجه مشتری"},
        "cancel": {"title": "لغو استعلام‌بها", "description": "دلیل لغو را وارد کنید.",
                   "reason": "دلیل لغو", "reasonPlaceholder": "مثلاً: جایگزین شد"},
    },
}

AR = {
    "page": {"title": "عروض الأسعار", "description": "عروض أسعار مُرسلة إلى العملاء — قابلة للتحويل إلى فواتير أولية"},
    "actions": {"create": "عرض سعر جديد", "send": "إرسال", "accept": "قبول", "reject": "رفض",
                "convert": "تحويل", "cancelling": "جارٍ الإلغاء...", "rejecting": "جارٍ الرفض..."},
    "status": {"DRAFT": "مسودة", "SENT": "مُرسل", "ACCEPTED": "مقبول", "REJECTED": "مرفوض", "CANCELLED": "ملغي"},
    "list": {"title": "قائمة عروض الأسعار", "subtitle": "بحث وتصفية وإدارة عروض الأسعار", "search": "بحث...",
             "allStatuses": "كل الحالات", "convertibleOnly": "القابلة للتحويل فقط",
             "empty": {"title": "لا توجد عروض أسعار", "description": "أنشئ عرض سعر للبدء."}},
    "fields": {"number": "الرقم", "customer": "العميل", "issueDate": "تاريخ الإرسال", "validUntil": "صالح حتى",
               "total": "الإجمالي", "status": "الحالة", "currency": "العملة", "title": "العنوان",
               "taxRate": "نسبة الضريبة %", "discount": "الخصم", "notes": "ملاحظات", "description": "الوصف",
               "cancelReason": "سبب الإلغاء", "rejectReason": "سبب الرفض", "convertedTo": "حُوّل إلى"},
    "create": {"title": "إنشاء عرض سعر", "description": "أدخل الرأس والبنود؛ تُحتسب الإجماليات تلقائياً.",
               "creating": "جارٍ الإنشاء...", "selectCustomer": "اختر العميل...", "itemsTitle": "البنود",
               "itemDescription": "وصف البند", "qty": "الكمية", "unitPrice": "سعر الوحدة", "addItem": "إضافة بند",
               "errors": {"customerRequired": "اختيار العميل مطلوب", "itemsRequired": "مطلوب بند واحد على الأقل"}},
    "totals": {"subtotal": "المجموع الفرعي", "tax": "الضريبة", "total": "الإجمالي"},
    "detail": {"items": "البنود", "lineTotal": "إجمالي السطر", "convertedBadge": "حُوّل إلى {number}"},
    "convert": {"title": "التحويل إلى فاتورة أولية", "description": "يُحوَّل هذا العرض المقبول مرة واحدة إلى فاتورة أولية مسودة.",
                "body": "تحويل العرض {number} بإجمالي {total} {currency} إلى فاتورة أولية؟",
                "converting": "جارٍ التحويل...", "resultTitle": "تم التحويل", "resultLine": "أُنشئت الفاتورة الأولية {number}.",
                "resultHint": "الفاتورة الأولية مسودة؛ أصدِرْها قبل تحويلها إلى فاتورة."},
    "confirm": {
        "send": {"title": "إرسال عرض السعر", "description": "بعد الإرسال لا يمكن تعديل البنود أو المبالغ."},
        "accept": {"title": "قبول عرض السعر", "description": "بعد القبول يصبح التحويل إلى فاتورة أولية ممكناً."},
        "reject": {"title": "رفض عرض السعر", "description": "أدخل سبب الرفض.",
                   "reason": "سبب الرفض", "reasonPlaceholder": "مثال: السعر أعلى من ميزانية العميل"},
        "cancel": {"title": "إلغاء عرض السعر", "description": "أدخل سبب الإلغاء.",
                   "reason": "سبب الإلغاء", "reasonPlaceholder": "مثال: استُبدل بغيره"},
    },
}

NAV_LABELS = {"en": "Quotations", "fa": "استعلام‌بها", "ar": "عروض الأسعار"}


def deep_merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict):
            node = dst.setdefault(k, {})
            deep_merge(node, v)
        else:
            dst[k] = v


def count_leaves(d):
    n = 0
    for v in d.values():
        n += count_leaves(v) if isinstance(v, dict) else 1
    return n


def find_nav_map(doc):
    """Return the dict that already holds the proformas nav label."""
    if isinstance(doc.get("nav"), dict) and "proformas" in doc["nav"]:
        return doc["nav"]
    common = doc.get("common")
    if isinstance(common, dict) and isinstance(common.get("nav"), dict) and "proformas" in common["nav"]:
        return common["nav"]
    raise SystemExit("nav.proformas not found — check messages shape")


def main():
    bodies = {"en": EN, "fa": FA, "ar": AR}
    for lang in ("en", "fa", "ar"):
        path = MESSAGES / f"{lang}.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        deep_merge(doc, {"quotation": bodies[lang]})
        nav = find_nav_map(doc)
        nav["quotations"] = NAV_LABELS[lang]
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: quotation leaves merged = {count_leaves(bodies[lang])}, nav.quotations set")
    print("done")


if __name__ == "__main__":
    main()
