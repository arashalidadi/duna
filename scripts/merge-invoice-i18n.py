#!/usr/bin/env python3
"""Merge the `invoice` namespace into apps/web/messages/{en,fa,ar}.json.

en is canonical; fa and ar are translated FROM english (never Arabic-from-Farsi).
Idempotent: replaces the whole `invoice` key on every run.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MSG = ROOT / "apps" / "web" / "messages"

EN = {
    "page": {"title": "Invoices", "description": "Customer billing documents"},
    "list": {
        "title": "Invoices",
        "search": "Search by number, title or customer",
        "allStatuses": "All statuses",
        "allPayments": "Paid + unpaid",
        "unpaid": "Unpaid only",
        "allDue": "Any due date",
        "overdue": "Overdue only",
        "empty": {"title": "No invoices yet", "description": "Create the first invoice for a customer."},
    },
    "status": {"DRAFT": "Draft", "ISSUED": "Issued", "CANCELLED": "Cancelled"},
    "fields": {
        "invoiceNumber": "Invoice No.",
        "customer": "Customer",
        "title": "Title",
        "description": "Description",
        "status": "Status",
        "currencyCode": "Currency",
        "issueDate": "Issue date",
        "dueDate": "Due date",
        "subtotal": "Subtotal",
        "taxRate": "Tax rate %",
        "taxAmount": "Tax",
        "discountAmount": "Discount",
        "totalAmount": "Total",
        "paidAmount": "Paid",
        "manifest": "Manifest",
        "bill": "B/L",
        "notes": "Notes",
    },
    "detail": {
        "headerTitle": "Invoice header",
        "loading": "Loading…",
        "saving": "Saving…",
        "paid": "Paid",
        "unpaid": "Unpaid",
    },
    "actions": {
        "create": "New invoice",
        "save": "Save",
        "close": "Close",
        "issue": "Issue",
        "cancel": "Cancel invoice",
        "delete": "Delete",
    },
    "create": {
        "title": "Create invoice",
        "description": "Pick a customer; optionally anchor to a manifest or B/L.",
        "selectCustomer": "Select customer",
        "selectManifest": "No manifest",
        "selectBill": "No B/L",
        "noAnchor": "Anchor links are optional.",
        "creating": "Creating…",
        "errors": {"customerRequired": "A customer is required"},
    },
    "items": {
        "title": "Invoice lines",
        "empty": "No lines yet.",
        "add": "Add line",
        "addTitle": "Add invoice line",
        "addDescription": "Description, quantity and unit price; the line amount is computed.",
        "description": "Description",
        "quantity": "Qty",
        "unitPrice": "Unit price",
        "amount": "Amount",
        "remove": "Remove",
        "saveAll": "Save changes",
        "adding": "Adding…",
        "errors": {"lineRequired": "Description and a positive unit price are required"},
    },
    "confirm": {
        "issue": {
            "title": "Issue invoice?",
            "description": "Issued invoices are locked and enter the payment ledger.",
        },
        "cancel": {
            "title": "Cancel invoice?",
            "reason": "Cancellation reason",
            "reasonPlaceholder": "Why is this invoice cancelled?",
            "description": "Cancelled invoices are terminal and stay for audit.",
        },
        "delete": {
            "title": "Delete this draft invoice?",
            "description": "Soft-deleted; never shown again.",
        },
        "removeItem": {
            "title": "Remove this line?",
            "description": "Totals will be recalculated.",
        },
    },
}

FA = {
    "page": {"title": "فاکتورها", "description": "اسناد فاکتور مشتری"},
    "list": {
        "title": "فاکتورها",
        "search": "جستجو با شماره، عنوان یا مشتری",
        "allStatuses": "همه وضعیت‌ها",
        "allPayments": "پرداخت‌شده و پرداخت‌نشده",
        "unpaid": "فقط پرداخت‌نشده",
        "allDue": "هر سررسیدی",
        "overdue": "فقط معوق",
        "empty": {"title": "هنوز فاکتوری نیست", "description": "اولین فاکتور را برای یک مشتری بسازید."},
    },
    "status": {"DRAFT": "پیش‌نویس", "ISSUED": "صادرشده", "CANCELLED": "لغوشده"},
    "fields": {
        "invoiceNumber": "شماره فاکتور",
        "customer": "مشتری",
        "title": "عنوان",
        "description": "توضیحات",
        "status": "وضعیت",
        "currencyCode": "واحد پول",
        "issueDate": "تاریخ صدور",
        "dueDate": "تاریخ سررسید",
        "subtotal": "جمع جزء",
        "taxRate": "نرخ مالیات ٪",
        "taxAmount": "مالیات",
        "discountAmount": "تخفیف",
        "totalAmount": "مبلغ کل",
        "paidAmount": "پرداخت‌شده",
        "manifest": "مانیفست",
        "bill": "بارنامه",
        "notes": "یادداشت‌ها",
    },
    "detail": {
        "headerTitle": "سربرگ فاکتور",
        "loading": "در حال بارگذاری…",
        "saving": "در حال ذخیره…",
        "paid": "پرداخت‌شده",
        "unpaid": "پرداخت‌نشده",
    },
    "actions": {
        "create": "فاکتور جدید",
        "save": "ذخیره",
        "close": "بستن",
        "issue": "صدور",
        "cancel": "لغو فاکتور",
        "delete": "حذف",
    },
    "create": {
        "title": "ساخت فاکتور",
        "description": "یک مشتری انتخاب کنید؛ اختیاری: اتصال به مانیفست یا بارنامه.",
        "selectCustomer": "انتخاب مشتری",
        "selectManifest": "بدون مانیفست",
        "selectBill": "بدون بارنامه",
        "noAnchor": "اتصال‌ها اختیاری هستند.",
        "creating": "در حال ساخت…",
        "errors": {"customerRequired": "انتخاب مشتری الزامی است"},
    },
    "items": {
        "title": "ردیف‌های فاکتور",
        "empty": "هنوز ردیفی نیست.",
        "add": "افزودن ردیف",
        "addTitle": "افزودن ردیف فاکتور",
        "addDescription": "شرح، تعداد و نرخ واحد؛ مبلغ ردیف محاسبه می‌شود.",
        "description": "شرح",
        "quantity": "تعداد",
        "unitPrice": "نرخ واحد",
        "amount": "مبلغ",
        "remove": "برداشتن",
        "saveAll": "ذخیره تغییرات",
        "adding": "در حال افزودن…",
        "errors": {"lineRequired": "شرح و نرخ واحد مثبت الزامی است"},
    },
    "confirm": {
        "issue": {
            "title": "صادر شود؟",
            "description": "فاکتور صادرشده قفل می‌شود و وارد دفتر پرداخت می‌گردد.",
        },
        "cancel": {
            "title": "فاکتور لغو شود؟",
            "reason": "دلیل لغو",
            "reasonPlaceholder": "چرا این فاکتور لغو می‌شود؟",
            "description": "فاکتور لغوشده بازگشت‌ناپذیر است و برای ممیزی می‌ماند.",
        },
        "delete": {
            "title": "این فاکتور پیش‌نویس حذف شود؟",
            "description": "حذف نرم؛ دیگر نمایش داده نمی‌شود.",
        },
        "removeItem": {
            "title": "این ردیف برداشته شود؟",
            "description": "جمع‌ها دوباره محاسبه می‌شوند.",
        },
    },
}

AR = {
    "page": {"title": "الفواتير", "description": "مستندات فوترة العملاء"},
    "list": {
        "title": "الفواتير",
        "search": "بحث برقم أو عنوان أو عميل",
        "allStatuses": "كل الحالات",
        "allPayments": "مدفوعة وغير مدفوعة",
        "unpaid": "غير المدفوعة فقط",
        "allDue": "أي تاريخ استحقاق",
        "overdue": "المتأخرة فقط",
        "empty": {"title": "لا فواتير بعد", "description": "أنشئ أول فاتورة لعميل."},
    },
    "status": {"DRAFT": "مسودة", "ISSUED": "صادرة", "CANCELLED": "ملغاة"},
    "fields": {
        "invoiceNumber": "رقم الفاتورة",
        "customer": "العميل",
        "title": "العنوان",
        "description": "الوصف",
        "status": "الحالة",
        "currencyCode": "العملة",
        "issueDate": "تاريخ الإصدار",
        "dueDate": "تاريخ الاستحقاق",
        "subtotal": "المجموع الفرعي",
        "taxRate": "نسبة الضريبة ٪",
        "taxAmount": "الضريبة",
        "discountAmount": "الخصم",
        "totalAmount": "الإجمالي",
        "paidAmount": "المدفوع",
        "manifest": "المانيفست",
        "bill": "بوليصة الشحن",
        "notes": "ملاحظات",
    },
    "detail": {
        "headerTitle": "ترويسة الفاتورة",
        "loading": "جارٍ التحميل…",
        "saving": "جارٍ الحفظ…",
        "paid": "مدفوعة",
        "unpaid": "غير مدفوعة",
    },
    "actions": {
        "create": "فاتورة جديدة",
        "save": "حفظ",
        "close": "إغلاق",
        "issue": "إصدار",
        "cancel": "إلغاء الفاتورة",
        "delete": "حذف",
    },
    "create": {
        "title": "إنشاء فاتورة",
        "description": "اختر عميلاً؛ اختياري: ربط بمانيفست أو بوليصة.",
        "selectCustomer": "اختر العميل",
        "selectManifest": "بدون مانيفست",
        "selectBill": "بدون بوليصة",
        "noAnchor": "الروابط اختيارية.",
        "creating": "جارٍ الإنشاء…",
        "errors": {"customerRequired": "اختيار العميل إلزامي"},
    },
    "items": {
        "title": "بنود الفاتورة",
        "empty": "لا بنود بعد.",
        "add": "إضافة بند",
        "addTitle": "إضافة بند فاتورة",
        "addDescription": "الوصف والكمية وسعر الوحدة؛ يُحسب مبلغ البند.",
        "description": "الوصف",
        "quantity": "الكمية",
        "unitPrice": "سعر الوحدة",
        "amount": "المبلغ",
        "remove": "إزالة",
        "saveAll": "حفظ التغييرات",
        "adding": "جارٍ الإضافة…",
        "errors": {"lineRequired": "الوصف وسعر وحدة موجب إلزاميان"},
    },
    "confirm": {
        "issue": {
            "title": "إصدار الفاتورة؟",
            "description": "الفواتير الصادرة مقفلة وتدخل سجل المدفوعات.",
        },
        "cancel": {
            "title": "إلغاء الفاتورة؟",
            "reason": "سبب الإلغاء",
            "reasonPlaceholder": "لماذا تُلغى هذه الفاتورة؟",
            "description": "الفواتير الملغاة نهائية وتبقى للتدقيق.",
        },
        "delete": {
            "title": "حذف هذه المسودة؟",
            "description": "حذف ناعم؛ لن تظهر مجددًا.",
        },
        "removeItem": {
            "title": "إزالة هذا البند؟",
            "description": "سيُعاد حساب المجاميع.",
        },
    },
}


def leaf_count(d, prefix=""):
    n = 0
    for v in d.values():
        n += leaf_count(v, prefix) if isinstance(v, dict) else 1
    return n


def validate(tree, ref, name, path=""):
    errors = []
    for k, v in ref.items():
        if k not in tree:
            errors.append(f"{name}: missing {path}{k}")
            continue
        tv = tree[k]
        if isinstance(v, dict):
            if not isinstance(tv, dict):
                errors.append(f"{name}: {path}{k} should be object")
            else:
                errors.extend(validate(tv, v, name, f"{path}{k}."))
        else:
            if isinstance(tv, dict):
                errors.append(f"{name}: {path}{k} should be string")
            elif not isinstance(tv, str) or not tv.strip():
                errors.append(f"{name}: {path}{k} empty")
    return errors


def main():
    count = leaf_count(EN)
    errs = validate(FA, EN, "fa") + validate(AR, EN, "ar")
    if errs:
        raise SystemExit("\n".join(errs))
    for loc, ns in (("en", EN), ("fa", FA), ("ar", AR)):
        p = MSG / f"{loc}.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        data["invoice"] = ns
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{loc}: invoice={count} leaves")
    # nav key for invoices page label already exists; verify
    en = json.loads((MSG / "en.json").read_text(encoding="utf-8"))
    assert "invoices" in en.get("nav", {}), "nav.invoices missing"
    ar = json.loads((MSG / "ar.json").read_text(encoding="utf-8"))
    nav_ar = ar["nav"]["invoices"]
    if "الفواتير" not in nav_ar:
        ar["nav"]["invoices"] = "الفواتير"
        (MSG / "ar.json").write_text(json.dumps(ar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("invoice namespace merged OK")


if __name__ == "__main__":
    main()
