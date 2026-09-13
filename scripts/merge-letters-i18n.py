#!/usr/bin/env python3
"""Phase 17 — merge `letters` i18n namespace (en/fa/ar) + nav keys. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MESSAGES = ROOT / "apps" / "web" / "messages"

LETTERS = {
    "en": {
        "page": {"title": "Letters", "description": "Official correspondence register — incoming and outgoing"},
        "actions": {"create": "New Letter", "edit": "Edit", "send": "Send", "archive": "Archive", "reply": "Reply", "view": "View"},
        "status": {"DRAFT": "Draft", "SENT": "Sent", "RECEIVED": "Received", "ARCHIVED": "Archived"},
        "direction": {"INCOMING": "Incoming", "OUTGOING": "Outgoing"},
        "fields": {"number": "Number", "direction": "Direction", "subject": "Subject", "date": "Date",
                   "contact": "Correspondent", "fromContact": "From (organization/person)",
                   "toContact": "To (organization/person)", "refNumber": "Reference No.", "body": "Body",
                   "notes": "Notes", "status": "Status", "customer": "Customer"},
        "list": {"title": "Letters", "subtitle": "Filter by direction, status and text",
                 "search": "Search number, subject, reference...", "allStatuses": "All statuses",
                 "allDirections": "All directions",
                 "empty": {"title": "No letters yet", "description": "Register the first incoming or outgoing letter."}},
        "form": {"title": "New Letter", "editTitle": "Edit Letter", "description": "Incoming letters are filed as Received immediately; outgoing ones start as Draft.",
                 "replyDescription": "Reply is created as an outgoing draft threaded to the original letter.",
                 "errors": {"subjectRequired": "Subject is required"}},
        "confirm": {"delete": {"title": "Delete letter", "description": "Delete {number}? Only DRAFT letters can be deleted."}},
        "detail": {"inReplyTo": "In reply to", "sentOn": "Sent on", "archivedOn": "Archived on"},
    },
    "fa": {
        "page": {"title": "نامه‌ها", "description": "دفتر ثبت مکاتبات رسمی — وارده و صادره"},
        "actions": {"create": "نامه جدید", "edit": "ویرایش", "send": "ارسال", "archive": "بایگانی", "reply": "پاسخ", "view": "مشاهده"},
        "status": {"DRAFT": "پیش‌نویس", "SENT": "ارسال‌شده", "RECEIVED": "دریافت‌شده", "ARCHIVED": "بایگانی‌شده"},
        "direction": {"INCOMING": "وارده", "OUTGOING": "صادره"},
        "fields": {"number": "شماره", "direction": "جهت", "subject": "موضوع", "date": "تاریخ",
                   "contact": "طرف مکاتبه", "fromContact": "از (سازمان/شخص)",
                   "toContact": "به (سازمان/شخص)", "refNumber": "شماره مرجع", "body": "متن",
                   "notes": "یادداشت", "status": "وضعیت", "customer": "مشتری"},
        "list": {"title": "نامه‌ها", "subtitle": "فیلتر بر اساس جهت، وضعیت و متن",
                 "search": "جستجوی شماره، موضوع، مرجع...", "allStatuses": "همه وضعیت‌ها",
                 "allDirections": "همه جهت‌ها",
                 "empty": {"title": "نامه‌ای ثبت نشده است", "description": "اولین نامه‌ی وارده یا صادره را ثبت کنید."}},
        "form": {"title": "نامه جدید", "editTitle": "ویرایش نامه", "description": "نامه‌های وارده بلافاصله «دریافت‌شده» ثبت می‌شوند؛ صادره از پیش‌نویس شروع می‌شود.",
                 "replyDescription": "پاسخ به‌صورت پیش‌نویس صادره و متصل به نامه‌ی اصلی ایجاد می‌شود.",
                 "errors": {"subjectRequired": "موضوع الزامی است"}},
        "confirm": {"delete": {"title": "حذف نامه", "description": "نامه {number} حذف شود؟ فقط پیش‌نویس‌ها قابل حذف‌اند."}},
        "detail": {"inReplyTo": "در پاسخ به", "sentOn": "تاریخ ارسال", "archivedOn": "تاریخ بایگانی"},
    },
    "ar": {
        "page": {"title": "الرسائل", "description": "سجل المراسلات الرسمية — الواردة والصادرة"},
        "actions": {"create": "رسالة جديدة", "edit": "تعديل", "send": "إرسال", "archive": "أرشفة", "reply": "رد", "view": "عرض"},
        "status": {"DRAFT": "مسودة", "SENT": "مُرسلة", "RECEIVED": "واردة", "ARCHIVED": "مؤرشفة"},
        "direction": {"INCOMING": "واردة", "OUTGOING": "صادرة"},
        "fields": {"number": "الرقم", "direction": "الاتجاه", "subject": "الموضوع", "date": "التاريخ",
                   "contact": "المراسِل", "fromContact": "من (جهة/شخص)",
                   "toContact": "إلى (جهة/شخص)", "refNumber": "رقم المرجع", "body": "النص",
                   "notes": "ملاحظات", "status": "الحالة", "customer": "العميل"},
        "list": {"title": "الرسائل", "subtitle": "تصفية حسب الاتجاه والحالة والنص",
                 "search": "بحث بالرقم أو الموضوع أو المرجع...", "allStatuses": "كل الحالات",
                 "allDirections": "كل الاتجاهات",
                 "empty": {"title": "لا توجد رسائل", "description": "سجّل أول رسالة واردة أو صادرة."}},
        "form": {"title": "رسالة جديدة", "editTitle": "تعديل الرسالة", "description": "الرسائل الواردة تُسجَّل «واردة» فورًا؛ والصادرة تبدأ مسودة.",
                 "replyDescription": "يُنشأ الرد كمسودة صادرة مرتبطة بالرسالة الأصلية.",
                 "errors": {"subjectRequired": "الموضوع مطلوب"}},
        "confirm": {"delete": {"title": "حذف الرسالة", "description": "حذف {number}؟ يمكن حذف المسودات فقط."}},
        "detail": {"inReplyTo": "ردًا على", "sentOn": "تاريخ الإرسال", "archivedOn": "تاريخ الأرشفة"},
    },
}

NAV = {
    "en": {"correspondence": "Correspondence", "letters": "Letters"},
    "fa": {"correspondence": "مکاتبات", "letters": "نامه‌ها"},
    "ar": {"correspondence": "المراسلات", "letters": "الرسائل"},
}


def deep_merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict):
            deep_merge(dst.setdefault(k, {}), v)
        else:
            dst[k] = v


def count_leaves(d):
    return sum(count_leaves(v) if isinstance(v, dict) else 1 for v in d.values())


def main():
    for lang in ("en", "fa", "ar"):
        path = MESSAGES / f"{lang}.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        deep_merge(doc, {"letters": LETTERS[lang]})
        nav = doc.get("nav")
        assert isinstance(nav, dict), "nav namespace missing"
        nav.update(NAV[lang])
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: letters={count_leaves(LETTERS[lang])} nav+=2")
    print("done")


if __name__ == "__main__":
    main()
