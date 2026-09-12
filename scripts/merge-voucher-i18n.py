#!/usr/bin/env python3
"""Merge the `voucher` + `ledger` namespaces into apps/web/messages/{en,fa,ar}.json.

en is canonical; fa and ar are translated FROM english (never Arabic-from-Farsi).
Idempotent: replaces the whole namespace key on every run. Also fills
nav.vouchers / nav.ledger label keys.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MSG = ROOT / "apps" / "web" / "messages"

VOUCHER_EN = {
    "page": {"title": "Vouchers", "description": "Receipt & payment vouchers"},
    "list": {
        "title": "Voucher register",
        "subtitle": "Posted money documents against customers and invoices",
        "search": "Search by number, reference or description",
        "allTypes": "All types",
        "allStatuses": "All statuses",
        "empty": {"title": "No vouchers yet", "description": "Register the first receipt or payment voucher."},
    },
    "type": {"RECEIPT": "Receipt", "PAYMENT": "Payment"},
    "status": {"POSTED": "Posted", "CANCELLED": "Cancelled"},
    "method": {
        "CASH": "Cash",
        "BANK_TRANSFER": "Bank transfer",
        "CHEQUE": "Cheque",
        "OTHER": "Other",
    },
    "fields": {
        "voucherNumber": "Voucher No.",
        "type": "Type",
        "customer": "Customer",
        "invoice": "Invoice",
        "amount": "Amount",
        "currencyCode": "Currency",
        "method": "Method",
        "reference": "Reference",
        "description": "Description",
        "note": "Note",
        "voucherDate": "Value date",
        "status": "Status",
        "cancelReason": "Cancellation reason",
    },
    "actions": {
        "create": "New voucher",
        "save": "Save",
        "cancelVoucher": "Cancel voucher",
        "cancelling": "Cancelling…",
    },
    "create": {
        "title": "Create voucher",
        "description": "Receipt (money in) or payment (refund). Link an invoice to settle it.",
        "selectCustomer": "Select customer",
        "noInvoice": "No invoice (standalone)",
        "creating": "Creating…",
        "errors": {
            "customerRequired": "A customer is required",
            "amountRequired": "A positive amount is required",
        },
    },
    "confirm": {
        "cancel": {
            "title": "Cancel this voucher?",
            "description": "Its effect on the invoice is reversed; the row stays for audit.",
            "reason": "Cancellation reason",
            "reasonPlaceholder": "Why is this voucher cancelled?",
        },
        "delete": {
            "title": "Delete this cancelled voucher?",
            "description": "Removes the cancelled row permanently.",
        },
    },
}

LEDGER_EN = {
    "page": {"title": "Ledger", "description": "Customer statements — invoices and settlements"},
    "filters": {
        "title": "Statement filters",
        "description": "Pick a customer; optionally a currency and date range.",
    },
    "fields": {
        "customer": "Customer",
        "currency": "Currency",
        "fromDate": "From",
        "toDate": "To",
    },
    "selectCustomer": "Select a customer to build the statement",
    "allCurrencies": "All currencies",
    "actions": {"run": "Build statement", "print": "Print"},
    "columns": {
        "date": "Date",
        "kind": "Type",
        "document": "Document",
        "description": "Description",
        "debit": "Debit",
        "credit": "Credit",
        "balance": "Balance",
    },
    "kind": {"invoice": "Invoice", "voucher": "Voucher", "balance": "Balance"},
    "statement": {
        "title": "Statement — {customer}",
        "subtitle": "{count} entries in range",
        "opening": "Opening balance",
        "period": "In range",
        "closing": "Closing balance",
    },
    "list": {
        "loading": "Building statement…",
        "empty": {"title": "No entries", "description": "No invoices or vouchers match these filters."},
    },
}

VOUCHER_FA = {
    "page": {"title": "حواله‌ها", "description": "رسید و پرداخت"},
    "list": {
        "title": "دفتر حواله",
        "subtitle": "اسناد مالی ثبت‌شده برای مشتریان و فاکتورها",
        "search": "جستجو با شماره، ارجاع یا توضیحات",
        "allTypes": "همه انواع",
        "allStatuses": "همه وضعیت‌ها",
        "empty": {"title": "هنوز حواله‌ای نیست", "description": "اولین رسید یا پرداخت را ثبت کنید."},
    },
    "type": {"RECEIPT": "رسید", "PAYMENT": "پرداخت"},
    "status": {"POSTED": "ثبت‌شده", "CANCELLED": "لغوشده"},
    "method": {
        "CASH": "نقدی",
        "BANK_TRANSFER": "انتقال بانکی",
        "CHEQUE": "چک",
        "OTHER": "سایر",
    },
    "fields": {
        "voucherNumber": "شماره حواله",
        "type": "نوع",
        "customer": "مشتری",
        "invoice": "فاکتور",
        "amount": "مبلغ",
        "currencyCode": "واحد پول",
        "method": "روش",
        "reference": "ارجاع",
        "description": "توضیحات",
        "note": "یادداشت",
        "voucherDate": "تاریخ ارزش",
        "status": "وضعیت",
        "cancelReason": "دلیل لغو",
    },
    "actions": {
        "create": "حواله جدید",
        "save": "ذخیره",
        "cancelVoucher": "لغو حواله",
        "cancelling": "در حال لغو…",
    },
    "create": {
        "title": "ساخت حواله",
        "description": "رسید (ورود پول) یا پرداخت (بازگشت). با اتصال فاکتور، تسویه می‌شود.",
        "selectCustomer": "انتخاب مشتری",
        "noInvoice": "بدون فاکتور (مستقل)",
        "creating": "در حال ساخت…",
        "errors": {
            "customerRequired": "انتخاب مشتری الزامی است",
            "amountRequired": "مبلغ باید مثبت باشد",
        },
    },
    "confirm": {
        "cancel": {
            "title": "این حواله لغو شود؟",
            "description": "اثر آن روی فاکتور برمی‌گردد؛ ردیف برای ممیزی می‌ماند.",
            "reason": "دلیل لغو",
            "reasonPlaceholder": "چرا این حواله لغو می‌شود؟",
        },
        "delete": {
            "title": "این حواله لغوشده حذف شود؟",
            "description": "ردیف لغوشده برای همیشه حذف می‌شود.",
        },
    },
}

LEDGER_FA = {
    "page": {"title": "دفتر", "description": "صورت‌حساب مشتری — فاکتورها و تسویه‌ها"},
    "filters": {
        "title": "فیلترهای صورت‌حساب",
        "description": "یک مشتری انتخاب کنید؛ اختیاری: واحد پول و بازه تاریخ.",
    },
    "fields": {
        "customer": "مشتری",
        "currency": "واحد پول",
        "fromDate": "از",
        "toDate": "تا",
    },
    "selectCustomer": "برای ساخت صورت‌حساب یک مشتری انتخاب کنید",
    "allCurrencies": "همه واحدها",
    "actions": {"run": "ساخت صورت‌حساب", "print": "چاپ"},
    "columns": {
        "date": "تاریخ",
        "kind": "نوع",
        "document": "سند",
        "description": "توضیحات",
        "debit": "بدهکار",
        "credit": "بستانکار",
        "balance": "مانده",
    },
    "kind": {"invoice": "فاکتور", "voucher": "حواله", "balance": "مانده"},
    "statement": {
        "title": "صورت‌حساب — {customer}",
        "subtitle": "{count} ردیف در بازه",
        "opening": "مانده ابتدای دوره",
        "period": "در بازه",
        "closing": "مانده پایان دوره",
    },
    "list": {
        "loading": "در حال ساخت صورت‌حساب…",
        "empty": {"title": "ردیفی نیست", "description": "فاکتور یا حواله‌ای با این فیلترها نیست."},
    },
}

VOUCHER_AR = {
    "page": {"title": "السندات", "description": "سندات القبض والدفع"},
    "list": {
        "title": "سجل السندات",
        "subtitle": "المستندات المالية المسجلة للعملاء والفواتير",
        "search": "بحث برقم أو مرجع أو وصف",
        "allTypes": "كل الأنواع",
        "allStatuses": "كل الحالات",
        "empty": {"title": "لا سندات بعد", "description": "سجّل أول سند قبض أو دفع."},
    },
    "type": {"RECEIPT": "قبض", "PAYMENT": "دفع"},
    "status": {"POSTED": "مُسجّل", "CANCELLED": "ملغى"},
    "method": {
        "CASH": "نقدي",
        "BANK_TRANSFER": "حوالة بنكية",
        "CHEQUE": "شيك",
        "OTHER": "أخرى",
    },
    "fields": {
        "voucherNumber": "رقم السند",
        "type": "النوع",
        "customer": "العميل",
        "invoice": "الفاتورة",
        "amount": "المبلغ",
        "currencyCode": "العملة",
        "method": "الطريقة",
        "reference": "المرجع",
        "description": "الوصف",
        "note": "ملاحظة",
        "voucherDate": "تاريخ القيمة",
        "status": "الحالة",
        "cancelReason": "سبب الإلغاء",
    },
    "actions": {
        "create": "سند جديد",
        "save": "حفظ",
        "cancelVoucher": "إلغاء السند",
        "cancelling": "جارٍ الإلغاء…",
    },
    "create": {
        "title": "إنشاء سند",
        "description": "قبض (دخول مال) أو دفع (استرداد). اربط فاتورة لتسويتها.",
        "selectCustomer": "اختر العميل",
        "noInvoice": "بدون فاتورة (مستقل)",
        "creating": "جارٍ الإنشاء…",
        "errors": {
            "customerRequired": "اختيار العميل إلزامي",
            "amountRequired": "يجب أن يكون المبلغ موجبًا",
        },
    },
    "confirm": {
        "cancel": {
            "title": "إلغاء هذا السند؟",
            "description": "يُعكس أثره على الفاتورة؛ ويبقى الصف للتدقيق.",
            "reason": "سبب الإلغاء",
            "reasonPlaceholder": "لماذا يُلغى هذا السند؟",
        },
        "delete": {
            "title": "حذف هذا السند الملغى؟",
            "description": "يُحذف الصف الملغى نهائيًا.",
        },
    },
}

LEDGER_AR = {
    "page": {"title": "الدفاتر", "description": "كشوف حساب العملاء — الفواتير والتسويات"},
    "filters": {
        "title": "مرشحات كشف الحساب",
        "description": "اختر عميلاً؛ اختياريًا عملة وفترة زمنية.",
    },
    "fields": {
        "customer": "العميل",
        "currency": "العملة",
        "fromDate": "من",
        "toDate": "إلى",
    },
    "selectCustomer": "اختر عميلاً لبناء كشف الحساب",
    "allCurrencies": "كل العملات",
    "actions": {"run": "بناء كشف الحساب", "print": "طباعة"},
    "columns": {
        "date": "التاريخ",
        "kind": "النوع",
        "document": "المستند",
        "description": "الوصف",
        "debit": "مدين",
        "credit": "دائن",
        "balance": "الرصيد",
    },
    "kind": {"invoice": "فاتورة", "voucher": "سند", "balance": "رصيد"},
    "statement": {
        "title": "كشف حساب — {customer}",
        "subtitle": "{count} قيدًا في الفترة",
        "opening": "رصيد افتتاحي",
        "period": "خلال الفترة",
        "closing": "رصيد ختامي",
    },
    "list": {
        "loading": "جارٍ بناء كشف الحساب…",
        "empty": {"title": "لا قيود", "description": "لا فواتير أو سندات تطابق هذه المرشحات."},
    },
}


def leaf_count(d):
    return sum(leaf_count(v) if isinstance(v, dict) else 1 for v in d.values())


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
            if isinstance(tv, dict) or not isinstance(tv, str) or not tv.strip():
                errors.append(f"{name}: {path}{k} must be a non-empty string")
    return errors


def main():
    errs = validate(VOUCHER_FA, VOUCHER_EN, "fa.voucher") + validate(VOUCHER_AR, VOUCHER_EN, "ar.voucher")
    errs += validate(LEDGER_FA, LEDGER_EN, "fa.ledger") + validate(LEDGER_AR, LEDGER_EN, "ar.ledger")
    if errs:
        raise SystemExit("\n".join(errs))

    nav_labels = {
        "en": {"vouchers": "Vouchers", "ledger": "Ledger"},
        "fa": {"vouchers": "حواله‌ها", "ledger": "دفتر"},
        "ar": {"vouchers": "السندات", "ledger": "الدفاتر"},
    }
    for loc in ("en", "fa", "ar"):
        p = MSG / f"{loc}.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        data["voucher"] = VOUCHER_FA if loc == "fa" else VOUCHER_AR if loc == "ar" else VOUCHER_EN
        data["ledger"] = LEDGER_FA if loc == "fa" else LEDGER_AR if loc == "ar" else LEDGER_EN
        for k, v in nav_labels[loc].items():
            data.setdefault("nav", {})[k] = v
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{loc}: voucher={leaf_count(data['voucher'])} leaves, ledger={leaf_count(data['ledger'])} leaves, nav keys set")

    print("voucher + ledger namespaces merged OK")


if __name__ == "__main__":
    main()
