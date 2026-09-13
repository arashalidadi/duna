#!/usr/bin/env python3
"""Merge the `discharge` namespace + nav.discharges into apps/web/messages/{en,fa,ar}.json (Phase 19)."""
import json
from pathlib import Path

MSG = Path(__file__).resolve().parent.parent / "apps" / "web" / "messages"

DICT = {
    "en": {
        "page": {
            "title": "Discharge",
            "description": "Unloading at the destination port — mirrors what was actually loaded",
        },
        "actions": {
            "create": "New Discharge", "view": "View", "start": "Start unloading",
            "complete": "Complete", "cancel": "Cancel discharge", "delete": "Delete",
        },
        "status": {
            "NOT_STARTED": "Not started", "IN_PROGRESS": "In progress",
            "COMPLETED": "Completed", "CANCELLED": "Cancelled",
        },
        "fields": {
            "number": "Discharge #", "loading": "Actual loading", "voyage": "Voyage",
            "vessel": "Vessel", "status": "Status", "lines": "Lines",
            "expected": "Expected", "discharged": "Discharged", "notes": "Notes", "pod": "Destination port",
        },
        "list": {
            "search": "Discharge #, loading, voyage, vessel…", "allStatuses": "All statuses",
            "empty": {"title": "No discharges yet", "description": "Create a discharge when a completed loading arrives at the destination port."},
        },
        "create": {
            "title": "New Discharge", "description": "Pre-populates expected lines from what was actually loaded.",
            "loadingLabel": "Actual loading (completed)", "loadingPlaceholder": "— select —",
            "noLoadings": "No completed actual loadings available for discharge.",
            "errors": {"loadingRequired": "Select an actual loading"},
        },
        "items": {
            "cargo": "Cargo", "result": "Result", "expected": "Expected", "discharged": "Discharged",
            "totals": "Totals",
            "result": {"FULL": "Full", "PARTIAL": "Partial", "NOT_DISCHARGED": "Not discharged"},
            "errors": {"nonnegative": "Quantity must be a non-negative integer", "exceeds": "Discharged quantity exceeds expected ({expected})"},
        },
        "detail": {
            "title": "Discharge", "createdOn": "Created", "completedOn": "Completed on", "cancelledOn": "Cancelled on",
        },
        "confirm": {
            "start": {"title": "Start unloading", "description": "Start unloading {number}? Lines stay editable while in progress."},
            "complete": {"title": "Complete discharge", "description": "Complete {number}? Fully discharged cargo becomes DELIVERED; shortfalls stay open for claims."},
            "delete": {"title": "Delete discharge", "description": "Delete {number}? Only unstarted/in-progress discharges can be deleted."},
        },
        "cancel": {
            "title": "Cancel discharge", "description": "Provide a cancel reason (audit).",
            "reason": "Cancel reason", "reasonPlaceholder": "e.g. berth reassigned",
        },
    },
    "fa": {
        "page": {
            "title": "تخلیه",
            "description": "تخلیه بار در بندر مقصد — آینه‌ی بارگیری واقعی",
        },
        "actions": {
            "create": "تخلیه جدید", "view": "مشاهده", "start": "شروع تخلیه",
            "complete": "تکمیل", "cancel": "لغو تخلیه", "delete": "حذف",
        },
        "status": {
            "NOT_STARTED": "شروع‌نشده", "IN_PROGRESS": "در حال انجام",
            "COMPLETED": "تکمیل‌شده", "CANCELLED": "لغوشده",
        },
        "fields": {
            "number": "شماره تخلیه", "loading": "بارگیری واقعی", "voyage": "سفر",
            "vessel": "شناور", "status": "وضعیت", "lines": "ردیف",
            "expected": "مورد انتظار", "discharged": "تخلیه‌شده", "notes": "یادداشت", "pod": "بندر مقصد",
        },
        "list": {
            "search": "شماره تخلیه، بارگیری، سفر، شناور…", "allStatuses": "همه وضعیت‌ها",
            "empty": {"title": "تخلیه‌ای ثبت نشده است", "description": "پس از رسیدن بارگیری تکمیل‌شده به بندر مقصد، تخلیه را ثبت کنید."},
        },
        "create": {
            "title": "تخلیه جدید", "description": "ردیف‌های مورد انتظار از بار واقعاً بارگیری‌شده پیش‌پر می‌شوند.",
            "loadingLabel": "بارگیری واقعی (تکمیل‌شده)", "loadingPlaceholder": "— انتخاب —",
            "noLoadings": "بارگیری واقعی تکمیل‌شده‌ای برای تخلیه موجود نیست.",
            "errors": {"loadingRequired": "انتخاب بارگیری الزامی است"},
        },
        "items": {
            "cargo": "بار", "result": "نتیجه", "expected": "مورد انتظار", "discharged": "تخلیه‌شده",
            "totals": "جمع کل",
            "result": {"FULL": "کامل", "PARTIAL": "جزئی", "NOT_DISCHARGED": "تخلیه‌نشده"},
            "errors": {"nonnegative": "تعداد باید عدد صحیح نامنفی باشد", "exceeds": "تعداد تخلیه از مورد انتظار بیشتر است ({expected})"},
        },
        "detail": {
            "title": "تخلیه", "createdOn": "تاریخ ثبت", "completedOn": "تاریخ تکمیل", "cancelledOn": "تاریخ لغو",
        },
        "confirm": {
            "start": {"title": "شروع تخلیه", "description": "تخلیه {number} شروع شود؟ در حال انجام، ردیف‌ها قابل ویرایش می‌مانند."},
            "complete": {"title": "تکمیل تخلیه", "description": "تخلیه {number} تکمیل شود؟ بارهای کاملاً تخلیه‌شده «تحویل‌شده» می‌شوند؛ کسری‌ها برای پیگیری ادعای باقی می‌مانند."},
            "delete": {"title": "حذف تخلیه", "description": "تخلیه {number} حذف شود؟ فقط تخلیه‌های شروع‌نشده/در حال انجام قابل حذف‌اند."},
        },
        "cancel": {
            "title": "لغو تخلیه", "description": "دلیل لغو را وارد کنید (حسابرسی).",
            "reason": "دلیل لغو", "reasonPlaceholder": "مثلاً: تغییر پهلو",
        },
    },
    "ar": {
        "page": {
            "title": "التفريغ",
            "description": "تفريغ البضاعة في ميناء الوصول — مرآة التحميل الفعلي",
        },
        "actions": {
            "create": "تفريغ جديد", "view": "عرض", "start": "بدء التفريغ",
            "complete": "إنجاز", "cancel": "إلغاء التفريغ", "delete": "حذف",
        },
        "status": {
            "NOT_STARTED": "لم يبدأ", "IN_PROGRESS": "قيد التنفيذ",
            "COMPLETED": "منجز", "CANCELLED": "ملغى",
        },
        "fields": {
            "number": "رقم التفريغ", "loading": "التحميل الفعلي", "voyage": "الرحلة",
            "vessel": "السفينة", "status": "الحالة", "lines": "البنود",
            "expected": "المتوقع", "discharged": "المفرَّغ", "notes": "ملاحظات", "pod": "ميناء الوصول",
        },
        "list": {
            "search": "رقم التفريغ أو التحميل أو الرحلة أو السفينة…", "allStatuses": "كل الحالات",
            "empty": {"title": "لا عمليات تفريغ", "description": "أنشئ تفريغًا عند وصول تحميل منجز إلى ميناء الوصول."},
        },
        "create": {
            "title": "تفريغ جديد", "description": "تُملأ البنود المتوقعة تلقائيًا مما حُمّل فعليًا.",
            "loadingLabel": "التحميل الفعلي (منجز)", "loadingPlaceholder": "— اختر —",
            "noLoadings": "لا تحميلات فعلية منجزة متاحة للتفريغ.",
            "errors": {"loadingRequired": "اختيار التحميل مطلوب"},
        },
        "items": {
            "cargo": "البضاعة", "result": "النتيجة", "expected": "المتوقع", "discharged": "المفرَّغ",
            "totals": "الإجماليات",
            "result": {"FULL": "كامل", "PARTIAL": "جزئي", "NOT_DISCHARGED": "غير مفرَّغ"},
            "errors": {"nonnegative": "يجب أن يكون العدد عددًا صحيحًا غير سالب", "exceeds": "العدد المفرَّغ يتجاوز المتوقع ({expected})"},
        },
        "detail": {
            "title": "التفريغ", "createdOn": "تاريخ الإنشاء", "completedOn": "تاريخ الإنجاز", "cancelledOn": "تاريخ الإلغاء",
        },
        "confirm": {
            "start": {"title": "بدء التفريغ", "description": "بدء تفريغ {number}؟ تبقى البنود قابلة للتعديل أثناء التنفيذ."},
            "complete": {"title": "إنجاز التفريغ", "description": "إنجاز تفريغ {number}؟ البضائع المفرَّغة بالكامل تصبح \"تم التسليم\"؛ والنواقص تبقى لمتابعة المطالبات."},
            "delete": {"title": "حذف التفريغ", "description": "حذف تفريغ {number}؟ يمكن حذف عمليات التفريغ غير المبدوءة/قيد التنفيذ فقط."},
        },
        "cancel": {
            "title": "إلغاء التفريغ", "description": "أدخل سبب الإلغاء (للتدقيق).",
            "reason": "سبب الإلغاء", "reasonPlaceholder": "مثال: تغيير الرصيف",
        },
    },
}

NAV = {
    "en": {"discharges": "Discharge"},
    "fa": {"discharges": "تخلیه"},
    "ar": {"discharges": "التفريغ"},
}

for lang, data in DICT.items():
    p = MSG / f"{lang}.json"
    msgs = json.loads(p.read_text(encoding="utf-8"))
    msgs["discharge"] = data
    msgs["nav"]["discharges"] = NAV[lang]["discharges"]
    p.write_text(json.dumps(msgs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    def count_keys(d):
        n = 0
        for v in d.values():
            n += 1 if not isinstance(v, dict) else count_keys(v)
        return n
    print(f"{lang}: discharge={count_keys(data)} keys, nav.discharges merged")
print("done")
