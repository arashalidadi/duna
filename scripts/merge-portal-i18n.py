#!/usr/bin/env python3
"""Phase 20 — merge portal/bookings/booking i18n keys into en/fa/ar messages.

Namespaces added:
  portal.*    — agent portal page (summary, tabs, forms, statement)
  bookings.*  — office booking desk
  booking.*   — shared booking status/manifest status labels
  nav.*       — portal group + agentPortal/bookings items (only missing)
  common.*    — generic keys used by both pages (only missing)

After merging it re-extracts every t()/tc()/tb() key from both pages
(including dynamic status./manifest. loops) and verifies 0 missing.
"""
import json
import re
import sys
from pathlib import Path

R = Path(__file__).resolve().parents[1]
MSGS = R / 'apps/web/messages'
PAGES = {
    'portal': R / 'apps/web/src/app/[locale]/(dashboard)/portal/page.tsx',
    'bookings': R / 'apps/web/src/app/[locale]/(dashboard)/bookings/page.tsx',
}
EN = 'en'
D = {}  # filled per namespace

portal_en = {
    'title': 'Agent Portal',
    'notLinked': 'This account is not linked to a portal company.',
    'newBooking': 'New Booking',
    'cancelBooking': 'Cancel booking',
    'tabs': {'bookings': 'Bookings', 'shipments': 'Shipments', 'statement': 'Statement'},
    'summary': {
        'bookingsTotal': 'Total bookings',
        'pending': 'Awaiting reply',
        'approvedManifests': 'Approved manifests',
        'balanceDue': 'Balance due',
    },
    'fields': {
        'number': 'Number',
        'cargo': 'Cargo',
        'route': 'Route',
        'shipDate': 'Ship date',
        'containers': 'Containers',
        'status': 'Status',
        'response': 'Office reply',
        'actions': 'Actions',
    },
    'form': {
        'cargoDescription': 'Cargo description',
        'cargoDescriptionPlaceholder': 'e.g. steel coils, 4x 20ft containers',
        'originPort': 'Port of loading',
        'destinationPort': 'Port of discharge',
        'requestedShipDate': 'Requested ship date',
        'containers': 'Containers (approx.)',
        'containersHint': 'approx. count',
        'weightKg': 'Weight (kg)',
        'notes': 'Notes',
        'notesPlaceholder': 'Special requirements, remarks…',
    },
    'create': {
        'title': 'New booking request',
        'hint': 'Your request goes to the booking desk and will be answered shortly.',
        'submit': 'Submit request',
    },
    'list': {
        'allStatuses': 'All statuses',
        'empty': 'No bookings yet',
        'emptyHint': 'Submit your first booking request',
    },
    'shipments': {
        'empty': 'No shipments recorded for your company yet',
        'manifest': 'Manifest',
        'status': 'Status',
        'vessel': 'Vessel',
        'route': 'Route',
        'etd': 'ETD',
        'eta': 'ETA',
        'weight': 'Weight',
        'units': 'Units',
    },
    'statement': {
        'date': 'Date',
        'doc': 'Document',
        'description': 'Description',
        'debit': 'Debit',
        'credit': 'Credit',
        'balance': 'Balance',
        'opening': 'Opening balance',
        'debits': 'Total debit',
        'credits': 'Total credit',
        'closing': 'Closing balance',
        'empty': 'No ledger movements',
    },
    'status': {
        'PENDING': 'Pending',
        'ACCEPTED': 'Accepted',
        'DECLINED': 'Declined',
        'CANCELLED': 'Cancelled',
    },
    'manifest': {
        'DRAFT': 'Draft',
        'SUBMITTED': 'Submitted',
        'APPROVED': 'Approved',
        'CANCELLED': 'Cancelled',
    },
}

portal_fa = {
    'title': 'پورتال ایجنت',
    'notLinked': 'این حساب به شرکت پورتال متصل نیست.',
    'newBooking': 'رزرو جدید',
    'cancelBooking': 'لغو رزرو',
    'tabs': {'bookings': 'رزروها', 'shipments': 'حمل‌ها', 'statement': 'صورت‌حساب'},
    'summary': {
        'bookingsTotal': 'کل رزروها',
        'pending': 'در انتظار پاسخ',
        'approvedManifests': 'مانیفست‌های تأییدشده',
        'balanceDue': 'مانده بدهی',
    },
    'fields': {
        'number': 'شماره',
        'cargo': 'بار',
        'route': 'مسیر',
        'shipDate': 'تاریخ حمل',
        'containers': 'کانتینر',
        'status': 'وضعیت',
        'response': 'پاسخ دفتر',
        'actions': 'اقدامات',
    },
    'form': {
        'cargoDescription': 'شرح بار',
        'cargoDescriptionPlaceholder': 'مثلاً: کویل فولاد، ۴ کانتینر ۲۰ فوتی',
        'originPort': 'بندر مبدأ',
        'destinationPort': 'بندر مقصد',
        'requestedShipDate': 'تاریخ حمل درخواستی',
        'containers': 'تعداد کانتینر (تقریبی)',
        'containersHint': 'تعداد تقریبی',
        'weightKg': 'وزن (کیلوگرم)',
        'notes': 'توضیحات',
        'notesPlaceholder': 'نکات خاص و درخواست‌ها…',
    },
    'create': {
        'title': 'ثبت درخواست رزرو',
        'hint': 'درخواست شما به میز رزرو ارسال می‌شود و به‌زودی پاسخ داده خواهد شد.',
        'submit': 'ارسال درخواست',
    },
    'list': {
        'allStatuses': 'همه وضعیت‌ها',
        'empty': 'هنوز رزروی ثبت نشده است',
        'emptyHint': 'اولین درخواست رزرو خود را ثبت کنید',
    },
    'shipments': {
        'empty': 'هنوز حملی برای شرکت شما ثبت نشده است',
        'manifest': 'مانیفست',
        'status': 'وضعیت',
        'vessel': 'شناور',
        'route': 'مسیر',
        'etd': 'تاریخ حرکت',
        'eta': 'تاریخ ورود',
        'weight': 'وزن',
        'units': 'تعداد',
    },
    'statement': {
        'date': 'تاریخ',
        'doc': 'سند',
        'description': 'شرح',
        'debit': 'بدهکار',
        'credit': 'بستانکار',
        'balance': 'مانده',
        'opening': 'مانده ابتدای دوره',
        'debits': 'جمع بدهکار',
        'credits': 'جمع بستانکار',
        'closing': 'مانده پایان دوره',
        'empty': 'گردش حسابی موجود نیست',
    },
    'status': {
        'PENDING': 'در انتظار',
        'ACCEPTED': 'تأییدشده',
        'DECLINED': 'ردشده',
        'CANCELLED': 'لغوشده',
    },
    'manifest': {
        'DRAFT': 'پیش‌نویس',
        'SUBMITTED': 'ارسال‌شده',
        'APPROVED': 'تأییدشده',
        'CANCELLED': 'لغوشده',
    },
}

portal_ar = {
    'title': 'بوابة الوكيل',
    'notLinked': 'هذا الحساب غير مرتبط بشركة البوابة.',
    'newBooking': 'حجز جديد',
    'cancelBooking': 'إلغاء الحجز',
    'tabs': {'bookings': 'الحجوزات', 'shipments': 'الشحنات', 'statement': 'كشف الحساب'},
    'summary': {
        'bookingsTotal': 'إجمالي الحجوزات',
        'pending': 'بانتظار الرد',
        'approvedManifests': 'البيانات المعتمدة',
        'balanceDue': 'الرصيد المستحق',
    },
    'fields': {
        'number': 'الرقم',
        'cargo': 'البضاعة',
        'route': 'المسار',
        'shipDate': 'تاريخ الشحن',
        'containers': 'الحاويات',
        'status': 'الحالة',
        'response': 'رد المكتب',
        'actions': 'الإجراءات',
    },
    'form': {
        'cargoDescription': 'وصف البضاعة',
        'cargoDescriptionPlaceholder': 'مثال: لفائف فولاذ، 4 حاويات 20 قدم',
        'originPort': 'ميناء الشحن',
        'destinationPort': 'ميناء الوصول',
        'requestedShipDate': 'تاريخ الشحن المطلوب',
        'containers': 'عدد الحاويات (تقريبي)',
        'containersHint': 'عدد تقريبي',
        'weightKg': 'الوزن (كغم)',
        'notes': 'ملاحظات',
        'notesPlaceholder': 'متطلبات وملاحظات خاصة…',
    },
    'create': {
        'title': 'طلب حجز جديد',
        'hint': 'سيُرسَل طلبك إلى مكتب الحجوزات وسيتم الرد عليه قريباً.',
        'submit': 'إرسال الطلب',
    },
    'list': {
        'allStatuses': 'كل الحالات',
        'empty': 'لا توجد حجوزات بعد',
        'emptyHint': 'سجّل أول طلب حجز لك',
    },
    'shipments': {
        'empty': 'لا توجد شحنات مسجلة لشركتك بعد',
        'manifest': 'البيان',
        'status': 'الحالة',
        'vessel': 'السفينة',
        'route': 'المسار',
        'etd': 'تاريخ الإبحار',
        'eta': 'تاريخ الوصول',
        'weight': 'الوزن',
        'units': 'الكمية',
    },
    'statement': {
        'date': 'التاريخ',
        'doc': 'المستند',
        'description': 'الوصف',
        'debit': 'مدين',
        'credit': 'دائن',
        'balance': 'الرصيد',
        'opening': 'الرصيد الافتتاحي',
        'debits': 'إجمالي المدين',
        'credits': 'إجمالي الدائن',
        'closing': 'الرصيد الختامي',
        'empty': 'لا توجد حركات حساب',
    },
    'status': {
        'PENDING': 'بانتظار الرد',
        'ACCEPTED': 'مقبول',
        'DECLINED': 'مرفوض',
        'CANCELLED': 'ملغى',
    },
    'manifest': {
        'DRAFT': 'مسودة',
        'SUBMITTED': 'مُرسَل',
        'APPROVED': 'معتمد',
        'CANCELLED': 'ملغى',
    },
}

bookings_en = {
    'title': 'Agent Bookings',
    'subtitle': 'Review and respond to booking requests submitted by agent companies',
    'allCompanies': 'All companies',
    'allStatuses': 'All statuses',
    'searchPlaceholder': 'Search booking no. or cargo…',
    'detail': 'Details',
    'detailTitle': 'Booking',
    'empty': 'No booking requests',
    'fields': {
        'number': 'Number',
        'company': 'Company',
        'cargo': 'Cargo',
        'route': 'Route',
        'shipDate': 'Ship date',
        'status': 'Status',
        'containers': 'Containers',
        'weightKg': 'Weight (kg)',
        'created': 'Submitted',
        'notes': 'Notes',
        'response': 'Reply',
        'responseNote': 'Reply note',
    },
    'respond': {
        'title': 'Respond to request',
        'accept': 'Accept',
        'decline': 'Decline',
        'notePlaceholder': 'Reply note (optional)…',
        'submit': 'Send response',
        'noPermission': 'You need booking:respond permission to answer requests.',
    },
}

bookings_fa = {
    'title': 'رزروهای ایجنت‌ها',
    'subtitle': 'بررسی و پاسخ به درخواست‌های رزرو شرکت‌های ایجنت',
    'allCompanies': 'همه شرکت‌ها',
    'allStatuses': 'همه وضعیت‌ها',
    'searchPlaceholder': 'جستجوی شماره رزرو یا شرح بار…',
    'detail': 'جزئیات',
    'detailTitle': 'رزرو',
    'empty': 'درخواست رزروی وجود ندارد',
    'fields': {
        'number': 'شماره',
        'company': 'شرکت',
        'cargo': 'بار',
        'route': 'مسیر',
        'shipDate': 'تاریخ حمل',
        'status': 'وضعیت',
        'containers': 'کانتینر',
        'weightKg': 'وزن (کیلوگرم)',
        'created': 'تاریخ ثبت',
        'notes': 'توضیحات',
        'response': 'پاسخ',
        'responseNote': 'متن پاسخ',
    },
    'respond': {
        'title': 'پاسخ به درخواست',
        'accept': 'تأیید',
        'decline': 'رد',
        'notePlaceholder': 'متن پاسخ (اختیاری)…',
        'submit': 'ثبت پاسخ',
        'noPermission': 'برای پاسخ به درخواست‌ها نیاز به مجوز booking:respond دارید.',
    },
}

bookings_ar = {
    'title': 'حجوزات الوكلاء',
    'subtitle': 'مراجعة طلبات الحجز المقدمة من شركات الوكلاء والرد عليها',
    'allCompanies': 'كل الشركات',
    'allStatuses': 'كل الحالات',
    'searchPlaceholder': 'ابحث برقم الحجز أو وصف البضاعة…',
    'detail': 'التفاصيل',
    'detailTitle': 'الحجز',
    'empty': 'لا توجد طلبات حجز',
    'fields': {
        'number': 'الرقم',
        'company': 'الشركة',
        'cargo': 'البضاعة',
        'route': 'المسار',
        'shipDate': 'تاريخ الشحن',
        'status': 'الحالة',
        'containers': 'الحاويات',
        'weightKg': 'الوزن (كغم)',
        'created': 'تاريخ التقديم',
        'notes': 'ملاحظات',
        'response': 'الرد',
        'responseNote': 'نص الرد',
    },
    'respond': {
        'title': 'الرد على الطلب',
        'accept': 'قبول',
        'decline': 'رفض',
        'notePlaceholder': 'نص الرد (اختياري)…',
        'submit': 'إرسال الرد',
        'noPermission': 'تحتاج صلاحية booking:respond للرد على الطلبات.',
    },
}

# booking.status.* (used by the office desk via useTranslations('booking'))
status_labels = {
    'en': {'PENDING': 'Pending', 'ACCEPTED': 'Accepted', 'DECLINED': 'Declined', 'CANCELLED': 'Cancelled'},
    'fa': {'PENDING': 'در انتظار', 'ACCEPTED': 'تأییدشده', 'DECLINED': 'ردشده', 'CANCELLED': 'لغوشده'},
    'ar': {'PENDING': 'بانتظار الرد', 'ACCEPTED': 'مقبول', 'DECLINED': 'مرفوض', 'CANCELLED': 'ملغى'},
}

# nav.* — only missing entries are added
nav_new = {
    'en': {'portal': 'Portal', 'agentPortal': 'Agent Portal', 'bookings': 'Agent Bookings'},
    'fa': {'portal': 'پورتال', 'agentPortal': 'پورتال ایجنت', 'bookings': 'رزروهای ایجنت‌ها'},
    'ar': {'portal': 'البوابة', 'agentPortal': 'بوابة الوكيل', 'bookings': 'حجوزات الوكلاء'},
}

# common.* — only missing entries are added (pages use these)
common_new = {
    'en': {'cancel': 'Cancel', 'loading': 'Loading…', 'saving': 'Saving…', 'select': 'Select…', 'reset': 'Reset', 'actions': 'Actions', 'errors': {'generic': 'Something went wrong'}},
    'fa': {'cancel': 'لغو', 'loading': 'در حال بارگذاری…', 'saving': 'در حال ذخیره…', 'select': 'انتخاب کنید…', 'reset': 'بازنشانی', 'actions': 'اقدامات', 'errors': {'generic': 'خطایی رخ داد. دوباره تلاش کنید.'}},
    'ar': {'cancel': 'إلغاء', 'loading': 'جارٍ التحميل…', 'saving': 'جارٍ الحفظ…', 'select': 'اختر…', 'reset': 'إعادة تعيين', 'actions': 'الإجراءات', 'errors': {'generic': 'حدث خطأ. حاول مرة أخرى.'}},
}

NS = {
    'portal': {'en': portal_en, 'fa': portal_fa, 'ar': portal_ar},
    'bookings': {'en': bookings_en, 'fa': bookings_fa, 'ar': bookings_ar},
}


def deep_set(root, value, path):
    node = root
    for part in path[:-1]:
        node = node.setdefault(part, {})
    node[path[-1]] = value


def deep_has(root, path):
    node = root
    for part in path:
        if not isinstance(node, dict) or part not in node:
            return False
        node = node[part]
    return True


def flatten(prefix, obj, out):
    for k, v in obj.items():
        p = prefix + [k]
        if isinstance(v, dict):
            flatten(p, v, out)
        else:
            out.append('.'.join(p))


def main():
    for lang in ('en', 'fa', 'ar'):
        f = MSGS / f'{lang}.json'
        data = json.loads(f.read_text(encoding='utf-8'))
        added = 0
        # full namespaces: overwrite/merge
        for ns, packs in NS.items():
            pack = packs[lang]
            keys = []
            flatten([], pack, keys)
            for key in keys:
                parts = key.split('.')
                if not deep_has(data, [ns] + parts) or data.get(ns, {}).get(parts[0], None) is None:
                    pass
                # always set (idempotent re-run yields same result)
                deep_set(data.setdefault(ns, {}), deep_get(pack, parts), parts)
                added += 1
            data[ns] = data.get(ns, {})
        # booking.status
        for st, label in status_labels[lang].items():
            deep_set(data.setdefault('booking', {}).setdefault('status', {}), label, [st])
            added += 1
        # nav + common: only missing
        for k, v in nav_new[lang].items():
            if not deep_has(data, ['nav', k]):
                deep_set(data.setdefault('nav', {}), v, [k])
                added += 1
        ckeys = []
        flatten([], common_new[lang], ckeys)
        for ck in ckeys:
            parts = ck.split('.')
            if not deep_has(data, ['common'] + parts):
                deep_set(data.setdefault('common', {}), deep_get(common_new[lang], parts), parts)
                added += 1
        f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{lang}: merged {added} entries')
    verify()


def deep_get(obj, parts):
    node = obj
    for p in parts:
        node = node[p]
    return node


def verify():
    dyn_status = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']
    dyn_manifest = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED']
    ns_map = {'portal': {}, 'bookings': {}}
    # alias→namespace from source
    for page in ('portal', 'bookings'):
        src = PAGES[page].read_text(encoding='utf-8')
        aliases = dict(re.findall(r'const (\w+) = useTranslations\( \'?(\w+)\'? \)', src))
        ns_map[page] = aliases
    missing = []
    for lang in ('en', 'fa', 'ar'):
        data = json.loads((MSGS / f'{lang}.json').read_text(encoding='utf-8'))
        for page, aliases in ns_map.items():
            src = PAGES[page].read_text(encoding='utf-8')
            for alias, ns in aliases.items():
                for key in re.findall(rf'\b{alias}\(\s*[\'"]([a-zA-Z0-9_.]+)[\'"]\s*\)', src):
                    if not deep_has(data, [ns] + key.split('.')):
                        missing.append(f'{lang}:{page}:{ns}.{key}')
                if alias == 't' and ns == 'portal':
                    for st in dyn_status + dyn_manifest:
                        if not deep_has(data, [ns, 'status', st]):
                            missing.append(f'{lang}:{page}:portal.status.{st}')
                        if not deep_has(data, [ns, 'manifest', st]):
                            missing.append(f'{lang}:{page}:portal.manifest.{st}')
                if alias == 'tb' and ns == 'booking':
                    for st in dyn_status:
                        if not deep_has(data, [ns, 'status', st]):
                            missing.append(f'{lang}:{page}:booking.status.{st}')
    if missing:
        print('MISSING KEYS:')
        for m in sorted(set(missing)):
            print(' -', m)
        sys.exit(1)
    print('VERIFY: 0 missing keys across en/fa/ar — portal i18n complete')


if __name__ == '__main__':
    main()
