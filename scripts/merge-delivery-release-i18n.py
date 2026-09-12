#!/usr/bin/env python3
"""Merge the `deliveryOrder` + `releaseOrder` namespaces into apps/web/messages/{en,fa,ar}.json.

en is canonical; fa and ar are translated FROM english (never Arabic-from-Farsi).
Idempotent: replaces the whole namespace key on every run. Also fills
nav.delivery / nav.release label keys.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MSG = ROOT / "apps" / "web" / "messages"

DO_EN = {
    "page": {"title": "Delivery Orders", "description": "Cargo hand-over permits against B/Ls (D/O)"},
    "list": {
        "title": "D/O register",
        "subtitle": "Issued delivery orders; one active per B/L",
        "search": "Search by number, recipient or plate",
        "allStatuses": "All statuses",
        "empty": {"title": "No delivery orders", "description": "Issue the first delivery order against an ISSUED B/L."},
    },
    "status": {"ISSUED": "Issued", "CANCELLED": "Cancelled"},
    "fields": {
        "docNumber": "D/O No.",
        "bill": "B/L",
        "recipient": "Recipient",
        "vehiclePlate": "Vehicle plate",
        "issueDate": "Issue date",
        "notes": "Notes",
        "status": "Status",
        "cancelReason": "Cancellation reason",
    },
    "actions": {"create": "New D/O", "cancelOrder": "Cancel D/O", "cancelling": "Cancelling…"},
    "create": {
        "title": "Create delivery order",
        "description": "The B/L must be ISSUED; one active D/O per B/L.",
        "selectBill": "Select B/L",
        "recipientPlaceholder": "Who receives the cargo?",
        "creating": "Creating…",
        "errors": {"billRequired": "A B/L is required", "recipientRequired": "Recipient is required"},
    },
    "confirm": {
        "cancel": {
            "title": "Cancel this D/O?",
            "description": "The B/L becomes deliverable again; the row stays for audit.",
            "reason": "Cancellation reason",
            "reasonPlaceholder": "Why is this D/O cancelled?",
        },
        "delete": {"title": "Delete this cancelled D/O?", "description": "Removes the cancelled row permanently."},
    },
    "detail": {"headerTitle": "Delivery order"},
}

RO_EN = {
    "page": {"title": "Release Orders", "description": "Cargo release permits against B/Ls (R/O) — settled or authorized override"},
    "list": {
        "title": "R/O register",
        "subtitle": "One active release per B/L; money rule enforced",
        "search": "Search by number or notes",
        "allStatuses": "All statuses",
        "empty": {"title": "No release orders", "description": "Issue a release once the B/L invoices are settled."},
    },
    "status": {"ISSUED": "Issued", "CANCELLED": "Cancelled"},
    "fields": {
        "docNumber": "R/O No.",
        "bill": "B/L",
        "releaseDate": "Release date",
        "financial": "Financial",
        "override": "Override",
        "settled": "Settled",
        "invoicesTotal": "Invoiced",
        "invoicesPaid": "Paid",
        "overrideReason": "Override reason",
        "notes": "Notes",
        "status": "Status",
        "cancelReason": "Cancellation reason",
    },
    "actions": {"create": "New R/O", "cancelOrder": "Cancel R/O", "view": "View"},
    "create": {
        "title": "Create release order",
        "description": "Requires every ISSUED invoice on the B/L to be fully paid, or an authorized override.",
        "selectBill": "Select B/L",
        "creating": "Creating…",
        "checkingEligibility": "Checking settlement…",
        "blockedTitle": "Outstanding balance",
        "readyTitle": "Ready to release",
        "eligibilityLine": "Invoiced {total} — paid {paid} — outstanding {outstanding}",
        "blockedNeedsForce": "Invoices unpaid: tick the override box and give a reason, or settle first.",
        "forceOverride": "Override the payment requirement (audited)",
        "overrideReasonPlaceholder": "Why release despite the outstanding balance?",
        "errors": {
            "billRequired": "A B/L is required",
            "overrideReasonRequired": "An override reason is required",
        },
    },
    "confirm": {
        "cancel": {
            "title": "Cancel this R/O?",
            "description": "The B/L becomes releasable again; the row stays for audit.",
            "reason": "Cancellation reason",
            "reasonPlaceholder": "Why is this R/O cancelled?",
        },
        "delete": {"title": "Delete this cancelled R/O?", "description": "Removes the cancelled row permanently."},
    },
    "detail": {"headerTitle": "Release order"},
}

DO_FA = {
    "page": {"title": "حواله تحویل کالا", "description": "مجوز تحویل بار بر اساس بارنامه (D/O)"},
    "list": {
        "title": "دفتر حواله تحویل",
        "subtitle": "حواله‌های صادرشده؛ یک حواله فعال برای هر بارنامه",
        "search": "جستجو با شماره، تحویل‌گیرنده یا پلاک",
        "allStatuses": "همه وضعیت‌ها",
        "empty": {"title": "حواله تحویلی نیست", "description": "برای یک بارنامه صادرشده، اولین حواله تحویل را ثبت کنید."},
    },
    "status": {"ISSUED": "صادرشده", "CANCELLED": "لغوشده"},
    "fields": {
        "docNumber": "شماره حواله",
        "bill": "بارنامه",
        "recipient": "تحویل‌گیرنده",
        "vehiclePlate": "پلاک خودرو",
        "issueDate": "تاریخ صدور",
        "notes": "یادداشت",
        "status": "وضعیت",
        "cancelReason": "دلیل لغو",
    },
    "actions": {"create": "حواله جدید", "cancelOrder": "لغو حواله", "cancelling": "در حال لغو…"},
    "create": {
        "title": "ساخت حواله تحویل",
        "description": "بارنامه باید صادرشده باشد؛ یک حواله فعال برای هر بارنامه.",
        "selectBill": "انتخاب بارنامه",
        "recipientPlaceholder": "چه کسی بار را تحویل می‌گیرد؟",
        "creating": "در حال ساخت…",
        "errors": {"billRequired": "انتخاب بارنامه الزامی است", "recipientRequired": "تحویل‌گیرنده الزامی است"},
    },
    "confirm": {
        "cancel": {
            "title": "این حواله لغو شود؟",
            "description": "بارنامه دوباره قابل تحویل می‌شود؛ ردیف برای ممیزی می‌ماند.",
            "reason": "دلیل لغو",
            "reasonPlaceholder": "چرا این حواله لغو می‌شود؟",
        },
        "delete": {"title": "این حواله لغوشده حذف شود؟", "description": "ردیف لغوشده برای همیشه حذف می‌شود."},
    },
    "detail": {"headerTitle": "حواله تحویل"},
}

RO_FA = {
    "page": {"title": "مجوز ترخیص کالا", "description": "مجوز خروج بار بر اساس بارنامه (R/O) — تسویه‌شده یا با تأیید ویژه"},
    "list": {
        "title": "دفتر مجوز ترخیص",
        "subtitle": "یک مجوز فعال برای هر بارنامه؛ قاعده مالی اجرا می‌شود",
        "search": "جستجو با شماره یا یادداشت",
        "allStatuses": "همه وضعیت‌ها",
        "empty": {"title": "مجوز ترخیصی نیست", "description": "پس از تسویه فاکتورهای بارنامه، مجوز صادر کنید."},
    },
    "status": {"ISSUED": "صادرشده", "CANCELLED": "لغوشده"},
    "fields": {
        "docNumber": "شماره مجوز",
        "bill": "بارنامه",
        "releaseDate": "تاریخ ترخیص",
        "financial": "مالی",
        "override": "تأیید ویژه",
        "settled": "تسویه‌شده",
        "invoicesTotal": "فاکتورشده",
        "invoicesPaid": "پرداخت‌شده",
        "overrideReason": "دلیل تأیید ویژه",
        "notes": "یادداشت",
        "status": "وضعیت",
        "cancelReason": "دلیل لغو",
    },
    "actions": {"create": "مجوز جدید", "cancelOrder": "لغو مجوز", "view": "مشاهده"},
    "create": {
        "title": "ساخت مجوز ترخیص",
        "description": "همه فاکتورهای صادرشده بارنامه باید تسویه باشند، یا با تأیید ویژه صادر شود.",
        "selectBill": "انتخاب بارنامه",
        "creating": "در حال ساخت…",
        "checkingEligibility": "بررسی تسویه…",
        "blockedTitle": "مانده بدهی",
        "readyTitle": "آماده ترخیص",
        "eligibilityLine": "فاکتورشده {total} — پرداخت‌شده {paid} — مانده {outstanding}",
        "blockedNeedsForce": "فاکتورها پرداخت‌نشده‌اند: یا تسویه کنید، یا گزینه تأیید ویژه را با دلیل فعال کنید.",
        "forceOverride": "عبور از الزام پرداخت (ثبت برای ممیزی)",
        "overrideReasonPlaceholder": "چرا با وجود مانده بدهی ترخیص شود؟",
        "errors": {
            "billRequired": "انتخاب بارنامه الزامی است",
            "overrideReasonRequired": "دلیل تأیید ویژه الزامی است",
        },
    },
    "confirm": {
        "cancel": {
            "title": "این مجوز لغو شود؟",
            "description": "بارنامه دوباره قابل ترخیص می‌شود؛ ردیف برای ممیزی می‌ماند.",
            "reason": "دلیل لغو",
            "reasonPlaceholder": "چرا این مجوز لغو می‌شود؟",
        },
        "delete": {"title": "این مجوز لغوشده حذف شود؟", "description": "ردیف لغوشده برای همیشه حذف می‌شود."},
    },
    "detail": {"headerTitle": "مجوز ترخیص"},
}

DO_AR = {
    "page": {"title": "أوامر التسليم", "description": "تصاريح تسليم البضاعة مقابل بوليصات الشحن (D/O)"},
    "list": {
        "title": "سجل أوامر التسليم",
        "subtitle": "أوامر صادرة؛ أمر واحد نشط لكل بوليصة",
        "search": "بحث برقم أو مستلم أو لوحة",
        "allStatuses": "كل الحالات",
        "empty": {"title": "لا أوامر تسليم", "description": "أصدر أول أمر تسليم مقابل بوليصة صادرة."},
    },
    "status": {"ISSUED": "صادر", "CANCELLED": "ملغى"},
    "fields": {
        "docNumber": "رقم الأمر",
        "bill": "البوليصة",
        "recipient": "المستلم",
        "vehiclePlate": "لوحة المركبة",
        "issueDate": "تاريخ الإصدار",
        "notes": "ملاحظات",
        "status": "الحالة",
        "cancelReason": "سبب الإلغاء",
    },
    "actions": {"create": "أمر جديد", "cancelOrder": "إلغاء الأمر", "cancelling": "جارٍ الإلغاء…"},
    "create": {
        "title": "إنشاء أمر تسليم",
        "description": "يجب أن تكون البوليصة صادرة؛ أمر واحد نشط لكل بوليصة.",
        "selectBill": "اختر البوليصة",
        "recipientPlaceholder": "من يستلم البضاعة؟",
        "creating": "جارٍ الإنشاء…",
        "errors": {"billRequired": "اختيار البوليصة إلزامي", "recipientRequired": "المستلم إلزامي"},
    },
    "confirm": {
        "cancel": {
            "title": "إلغاء هذا الأمر؟",
            "description": "تصبح البوليصة قابلة للتسليم مجددًا؛ ويبقى الصف للتدقيق.",
            "reason": "سبب الإلغاء",
            "reasonPlaceholder": "لماذا يُلغى هذا الأمر؟",
        },
        "delete": {"title": "حذف هذا الأمر الملغى؟", "description": "يُحذف الصف الملغى نهائيًا."},
    },
    "detail": {"headerTitle": "أمر تسليم"},
}

RO_AR = {
    "page": {"title": "أوامر الإفراج", "description": "تصاريح إفراج البضاعة مقابل بوليصات الشحن (R/O) — مسددة أو بتجاوز معتمد"},
    "list": {
        "title": "سجل أوامر الإفراج",
        "subtitle": "أمر إفراج واحد نشط لكل بوليصة؛ مع تطبيق قاعدة المال",
        "search": "بحث برقم أو ملاحظات",
        "allStatuses": "كل الحالات",
        "empty": {"title": "لا أوامر إفراج", "description": "أصدر أمر إفراج بعد تسوية فواتير البوليصة."},
    },
    "status": {"ISSUED": "صادر", "CANCELLED": "ملغى"},
    "fields": {
        "docNumber": "رقم الأمر",
        "bill": "البوليصة",
        "releaseDate": "تاريخ الإفراج",
        "financial": "المالية",
        "override": "تجاوز معتمد",
        "settled": "مسدد",
        "invoicesTotal": "مُفوتر",
        "invoicesPaid": "مدفوع",
        "overrideReason": "سبب التجاوز",
        "notes": "ملاحظات",
        "status": "الحالة",
        "cancelReason": "سبب الإلغاء",
    },
    "actions": {"create": "أمر جديد", "cancelOrder": "إلغاء الأمر", "view": "عرض"},
    "create": {
        "title": "إنشاء أمر إفراج",
        "description": "يتطلب سداد كل الفواتير الصادرة على البوليصة، أو تجاوزًا معتمدًا.",
        "selectBill": "اختر البوليصة",
        "creating": "جارٍ الإنشاء…",
        "checkingEligibility": "جارٍ فحص التسوية…",
        "blockedTitle": "رصيد مستحق",
        "readyTitle": "جاهز للإفراج",
        "eligibilityLine": "مُفوتر {total} — مدفوع {paid} — مستحق {outstanding}",
        "blockedNeedsForce": "فواتير غير مسددة: إما أن تسدد، أو فعّل التجاوز مع السبب.",
        "forceOverride": "تجاوز شرط السداد (مُدقَّق)",
        "overrideReasonPlaceholder": "لماذا الإفراج رغم الرصيد المستحق؟",
        "errors": {
            "billRequired": "اختيار البوليصة إلزامي",
            "overrideReasonRequired": "سبب التجاوز إلزامي",
        },
    },
    "confirm": {
        "cancel": {
            "title": "إلغاء هذا الأمر؟",
            "description": "تصبح البوليصة قابلة للإفراج مجددًا؛ ويبقى الصف للتدقيق.",
            "reason": "سبب الإلغاء",
            "reasonPlaceholder": "لماذا يُلغى هذا الأمر؟",
        },
        "delete": {"title": "حذف هذا الأمر الملغى؟", "description": "يُحذف الصف الملغى نهائيًا."},
    },
    "detail": {"headerTitle": "أمر إفراج"},
}


def leaf_count(d):
    return sum(leaf_count(v) if isinstance(v, dict) else 1 for v in d.values())


def validate(tree, ref, name, path=""):
    errs = []
    for k, v in ref.items():
        if k not in tree:
            errs.append(f"{name}: missing {path}{k}")
            continue
        tv = tree[k]
        if isinstance(v, dict):
            if not isinstance(tv, dict):
                errs.append(f"{name}: {path}{k} should be object")
            else:
                errs.extend(validate(tv, v, name, f"{path}{k}."))
        else:
            if isinstance(tv, dict) or not isinstance(tv, str) or not tv.strip():
                errs.append(f"{name}: {path}{k} must be a non-empty string")
    return errs


def main():
    errs = validate(DO_FA, DO_EN, "fa.deliveryOrder") + validate(DO_AR, DO_EN, "ar.deliveryOrder")
    errs += validate(RO_FA, RO_EN, "fa.releaseOrder") + validate(RO_AR, RO_EN, "ar.releaseOrder")
    if errs:
        raise SystemExit("\n".join(errs))

    nav_labels = {
        "en": {"delivery": "Delivery Orders", "release": "Release Orders"},
        "fa": {"delivery": "حواله تحویل کالا", "release": "مجوز ترخیص کالا"},
        "ar": {"delivery": "أوامر التسليم", "release": "أوامر الإفراج"},
    }
    for loc in ("en", "fa", "ar"):
        p = MSG / f"{loc}.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        data["deliveryOrder"] = {"en": DO_EN, "fa": DO_FA, "ar": DO_AR}[loc]
        data["releaseOrder"] = {"en": RO_EN, "fa": RO_FA, "ar": RO_AR}[loc]
        for k, v in nav_labels[loc].items():
            data.setdefault("nav", {})[k] = v
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{loc}: deliveryOrder={leaf_count(data['deliveryOrder'])} leaves, releaseOrder={leaf_count(data['releaseOrder'])} leaves")

    print("deliveryOrder + releaseOrder namespaces merged OK")


if __name__ == "__main__":
    main()
