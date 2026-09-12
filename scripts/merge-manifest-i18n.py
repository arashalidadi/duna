#!/usr/bin/env python3
"""Merge the manifest module namespace into fa/en/ar message files.

en is the canonical source; fa and ar are translated FROM the English.
Also fixes two broken Arabic nav keys (manifest/billOfLading were mistranslated).
"""
import json
from pathlib import Path

BASE = Path('/home/arash/shipping-dashboard/new-erp/apps/web/messages')

MANIFEST_EN = {
    "title": "Manifests",
    "subtitle": "Build the official cargo manifest for a voyage from completed loadings, then submit and approve it.",
    "register": "Manifest register",
    "registerHint": "Official cargo manifests. One manifest per voyage.",
    "searchPlaceholder": "Search manifest no., voyage no., vessel name",
    "allStatuses": "All statuses",
    "allVoyages": "All voyages",
    "new": "New manifest",
    "loading": "Loading…",
    "createdFrom": "From",
    "createdTo": "To",
    "empty": {
        "title": "No manifests found",
        "description": "Try a different search or filter, or create a manifest for a voyage with completed loadings."
    },
    "status": {
        "DRAFT": "Draft",
        "SUBMITTED": "Submitted",
        "APPROVED": "Approved",
        "CANCELLED": "Cancelled"
    },
    "table": {
        "no": "No.",
        "voyage": "Voyage / Vessel",
        "route": "Route",
        "status": "Status",
        "items": "Items",
        "totalWeight": "Total weight",
        "created": "Created",
        "actions": "Actions"
    },
    "create": {
        "title": "New manifest",
        "description": "Select the voyage to manifest. Vessel, route and ports are snapshotted from the voyage.",
        "voyage": "Voyage *",
        "selectVoyage": "Select voyage…",
        "noVoyages": "No voyages available.",
        "shipper": "Shipper",
        "consignee": "Consignee",
        "agent": "Agent",
        "selectCustomer": "None",
        "notifyParty": "Notify party",
        "descriptionField": "Description",
        "notes": "Notes",
        "submit": "Create manifest",
        "errorVoyage": "Select a voyage."
    },
    "detail": {
        "draftHint": "Draft — editable. Add cargo, then submit.",
        "submittedHint": "Submitted — awaiting approval.",
        "immutable": "Approved or cancelled manifests are immutable.",
        "cancelReason": "Cancellation reason",
        "submittedAt": "Submitted",
        "approvedAt": "Approved",
        "parties": "Parties",
        "costs": "Costs",
        "gasCost": "Gas cost",
        "lashingCost": "Lashing cost",
        "shipperCost": "Shipper cost",
        "podCost": "POD cost",
        "polCost": "POL cost",
        "currency": "Currency",
        "totalWeight": "Total weight",
        "totalQuantity": "Total quantity",
        "totalPackages": "Total packages"
    },
    "items": {
        "title": "Manifest items",
        "addTitle": "Add cargo to manifest",
        "selectEligible": "Select cargo…",
        "eligibleEmpty": "No eligible cargo. Complete an actual loading for this voyage first.",
        "addLabel": "Add cargo",
        "blNumber": "B/L number",
        "empty": "No items yet. Add loaded cargo to build the manifest.",
        "seq": "#",
        "cargo": "Cargo",
        "weight": "Weight",
        "quantity": "Qty",
        "packages": "Pkgs",
        "notes": "Notes",
        "remove": "Remove",
        "actions": "Actions"
    },
    "actions": {
        "view": "View",
        "submit": "Submit",
        "approve": "Approve",
        "cancel": "Cancel",
        "delete": "Delete",
        "close": "Close",
        "save": "Save"
    },
    "confirm": {
        "submitTitle": "Submit manifest",
        "submitBody": "Submit {no} for approval? After submission the manifest becomes read-only.",
        "approveTitle": "Approve manifest",
        "approveBody": "Approve {no}? Approved manifests are final and immutable.",
        "cancelTitle": "Cancel manifest",
        "cancelBody": "Cancel {no}? A reason is required. Cancelled manifests are immutable.",
        "deleteTitle": "Delete manifest",
        "deleteBody": "Delete draft {no}? The manifest and its items will be soft-deleted.",
        "reason": "Cancellation reason *",
        "keep": "Keep",
        "confirmSubmit": "Submit",
        "confirmApprove": "Approve",
        "confirmCancel": "Cancel manifest",
        "confirmDelete": "Delete"
    },
    "errors": {
        "loadList": "Failed to load manifests",
        "loadDetail": "Failed to load manifest",
        "create": "Failed to create manifest",
        "save": "Failed to save",
        "addItem": "Failed to add cargo",
        "removeItem": "Failed to remove item",
        "submit": "Failed to submit",
        "approve": "Failed to approve",
        "cancel": "Failed to cancel",
        "delete": "Failed to delete",
        "reasonRequired": "A cancellation reason is required.",
        "blOrNotes": "Enter a B/L number or notes to save."
    }
}

# Farsi translated from English
MANIFEST_FA = {
    "title": "مانیفست‌ها",
    "subtitle": "مانیفست رسمی بارِ هر سفر را از بارگیری‌های تکمیل‌شده بسازید، سپس ارسال و تأیید کنید.",
    "register": "دفتر مانیفست‌ها",
    "registerHint": "مانیفست‌های رسمی بار — یک مانیفست به ازای هر سفر.",
    "searchPlaceholder": "جستجوی شماره مانیفست، شماره سفر، نام کشتی",
    "allStatuses": "همه وضعیت‌ها",
    "allVoyages": "همه سفرها",
    "new": "مانیفست جدید",
    "loading": "در حال بارگذاری…",
    "createdFrom": "از",
    "createdTo": "تا",
    "empty": {
        "title": "مانیفستی یافت نشد",
        "description": "جستجو یا فیلتر دیگری را امتحان کنید، یا برای سفری که بارگیری تکمیل‌شده دارد مانیفست بسازید."
    },
    "status": {
        "DRAFT": "پیش‌نویس",
        "SUBMITTED": "ارسال‌شده",
        "APPROVED": "تأییدشده",
        "CANCELLED": "لغوشده"
    },
    "table": {
        "no": "شماره",
        "voyage": "سفر / کشتی",
        "route": "مسیر",
        "status": "وضعیت",
        "items": "قلم‌ها",
        "totalWeight": "وزن کل",
        "created": "تاریخ ایجاد",
        "actions": "عملیات"
    },
    "create": {
        "title": "مانیفست جدید",
        "description": "سفر موردنظر را انتخاب کنید. کشتی، مسیر و بنادر از سفر برداشت می‌شوند.",
        "voyage": "سفر *",
        "selectVoyage": "انتخاب سفر…",
        "noVoyages": "سفری موجود نیست.",
        "shipper": "فرستنده",
        "consignee": "گیرنده",
        "agent": "کارگزار",
        "selectCustomer": "هیچ‌کدام",
        "notifyParty": "طرف اطلاع‌رسانی",
        "descriptionField": "توضیحات",
        "notes": "یادداشت‌ها",
        "submit": "ایجاد مانیفست",
        "errorVoyage": "یک سفر انتخاب کنید."
    },
    "detail": {
        "draftHint": "پیش‌نویس — قابل ویرایش. بار را اضافه و سپس ارسال کنید.",
        "submittedHint": "ارسال‌شده — در انتظار تأیید.",
        "immutable": "مانیفست تأییدشده یا لغوشده قابل ویرایش نیست.",
        "cancelReason": "دلیل لغو",
        "submittedAt": "تاریخ ارسال",
        "approvedAt": "تاریخ تأیید",
        "parties": "طرف‌ها",
        "costs": "هزینه‌ها",
        "gasCost": "هزینه سوخت",
        "lashingCost": "هزینه مهاربندی",
        "shipperCost": "هزینه فرستنده",
        "podCost": "هزینه بندر تخلیه",
        "polCost": "هزینه بندر بارگیری",
        "currency": "واحد پول",
        "totalWeight": "وزن کل",
        "totalQuantity": "تعداد کل",
        "totalPackages": "تعداد بسته‌ها"
    },
    "items": {
        "title": "قلم‌های مانیفست",
        "addTitle": "افزودن بار به مانیفست",
        "selectEligible": "انتخاب بار…",
        "eligibleEmpty": "بار مجازی وجود ندارد. ابتدا بارگیری واقعی این سفر را تکمیل کنید.",
        "addLabel": "افزودن بار",
        "blNumber": "شماره B/L",
        "empty": "هنوز قلمی نیست. بارهای بارگیری‌شده را برای ساخت مانیفست بیفزایید.",
        "seq": "ردیف",
        "cargo": "بار",
        "weight": "وزن",
        "quantity": "تعداد",
        "packages": "بسته‌ها",
        "notes": "یادداشت",
        "remove": "حذف",
        "actions": "عملیات"
    },
    "actions": {
        "view": "مشاهده",
        "submit": "ارسال",
        "approve": "تأیید",
        "cancel": "لغو",
        "delete": "حذف",
        "close": "بستن",
        "save": "ذخیره"
    },
    "confirm": {
        "submitTitle": "ارسال مانیفست",
        "submitBody": "مانیفست {no} برای تأیید ارسال شود؟ پس از ارسال، فقط‌خواندنی می‌شود.",
        "approveTitle": "تأیید مانیفست",
        "approveBody": "مانیفست {no} تأیید شود؟ مانیفست تأییدشده قطعی و غیرقابل‌ویرایش است.",
        "cancelTitle": "لغو مانیفست",
        "cancelBody": "مانیفست {no} لغو شود؟ ذکر دلیل الزامی است. مانیفست لغوشده غیرقابل‌ویرایش است.",
        "deleteTitle": "حذف مانیفست",
        "deleteBody": "پیش‌نویس {no} حذف شود؟ مانیفست و قلم‌های آن به‌صورت نرم حذف می‌شوند.",
        "reason": "دلیل لغو *",
        "keep": "نگه داشتن",
        "confirmSubmit": "ارسال",
        "confirmApprove": "تأیید",
        "confirmCancel": "لغو مانیفست",
        "confirmDelete": "حذف"
    },
    "errors": {
        "loadList": "بارگذاری مانیفست‌ها ناموفق بود",
        "loadDetail": "بارگذاری مانیفست ناموفق بود",
        "create": "ایجاد مانیفست ناموفق بود",
        "save": "ذخیره ناموفق بود",
        "addItem": "افزودن بار ناموفق بود",
        "removeItem": "حذف قلم ناموفق بود",
        "submit": "ارسال ناموفق بود",
        "approve": "تأیید ناموفق بود",
        "cancel": "لغو ناموفق بود",
        "delete": "حذف ناموفق بود",
        "reasonRequired": "دلیل لغو الزامی است.",
        "blOrNotes": "برای ذخیره، شماره B/L یا یادداشت وارد کنید."
    }
}

# Arabic translated from English (real Arabic, not Persian)
MANIFEST_AR = {
    "title": "المانيفستات",
    "subtitle": "أنشئ المانيفست الرسمي لحمولة الرحلة من عمليات التحميل المكتملة، ثم أرسله للاعتماد.",
    "register": "سجل المانيفستات",
    "registerHint": "الموانيفست الرسمية للحمولة. مانيفست واحد لكل رحلة.",
    "searchPlaceholder": "ابحث برقم المانيفست أو رقم الرحلة أو اسم السفينة",
    "allStatuses": "جميع الحالات",
    "allVoyages": "جميع الرحلات",
    "new": "مانيفست جديد",
    "loading": "جارٍ التحميل…",
    "createdFrom": "من",
    "createdTo": "إلى",
    "empty": {
        "title": "لا توجد موانيفست",
        "description": "جرّب بحثًا أو تصفية أخرى، أو أنشئ مانيفستًا لرحلة بها عمليات تحميل مكتملة."
    },
    "status": {
        "DRAFT": "مسودة",
        "SUBMITTED": "مُرسَل",
        "APPROVED": "معتمَد",
        "CANCELLED": "ملغى"
    },
    "table": {
        "no": "الرقم",
        "voyage": "الرحلة / السفينة",
        "route": "المسار",
        "status": "الحالة",
        "items": "الأصناف",
        "totalWeight": "الوزن الإجمالي",
        "created": "تاريخ الإنشاء",
        "actions": "الإجراءات"
    },
    "create": {
        "title": "مانيفست جديد",
        "description": "اختر الرحلة المراد إنشاء مانيفست لها. تُؤخذ السفينة والمسار والموانئ من الرحلة.",
        "voyage": "الرحلة *",
        "selectVoyage": "اختر الرحلة…",
        "noVoyages": "لا توجد رحلات متاحة.",
        "shipper": "الشاحن",
        "consignee": "المرسل إليه",
        "agent": "الوكيل",
        "selectCustomer": "بدون",
        "notifyParty": "الجهة المُخطَرة",
        "descriptionField": "الوصف",
        "notes": "ملاحظات",
        "submit": "إنشاء المانيفست",
        "errorVoyage": "اختر رحلة."
    },
    "detail": {
        "draftHint": "مسودة — قابلة للتعديل. أضف البضائع ثم أرسلها.",
        "submittedHint": "مُرسَلة — بانتظار الاعتماد.",
        "immutable": "الموانيفست المعتمدة أو الملغاة غير قابلة للتعديل.",
        "cancelReason": "سبب الإلغاء",
        "submittedAt": "تاريخ الإرسال",
        "approvedAt": "تاريخ الاعتماد",
        "parties": "الأطراف",
        "costs": "التكاليف",
        "gasCost": "تكلفة الوقود",
        "lashingCost": "تكلفة التثبيت",
        "shipperCost": "تكلفة الشاحن",
        "podCost": "تكلفة ميناء التفريغ",
        "polCost": "تكلفة ميناء الشحن",
        "currency": "العملة",
        "totalWeight": "الوزن الإجمالي",
        "totalQuantity": "العدد الإجمالي",
        "totalPackages": "إجمالي الطرود"
    },
    "items": {
        "title": "أصناف المانيفست",
        "addTitle": "إضافة بضاعة إلى المانيفست",
        "selectEligible": "اختر البضاعة…",
        "eligibleEmpty": "لا توجد بضائع مؤهلة. أكمل عملية تحميل فعلية لهذه الرحلة أولاً.",
        "addLabel": "إضافة بضاعة",
        "blNumber": "رقم بوليصة الشحن",
        "empty": "لا توجد أصناف بعد. أضف البضائع المحمّلة لبناء المانيفست.",
        "seq": "#",
        "cargo": "البضاعة",
        "weight": "الوزن",
        "quantity": "العدد",
        "packages": "الطرود",
        "notes": "ملاحظات",
        "remove": "إزالة",
        "actions": "الإجراءات"
    },
    "actions": {
        "view": "عرض",
        "submit": "إرسال",
        "approve": "اعتماد",
        "cancel": "إلغاء",
        "delete": "حذف",
        "close": "إغلاق",
        "save": "حفظ"
    },
    "confirm": {
        "submitTitle": "إرسال المانيفست",
        "submitBody": "إرسال {no} للاعتماد؟ بعد الإرسال يصبح المانيفست للقراءة فقط.",
        "approveTitle": "اعتماد المانيفست",
        "approveBody": "اعتماد {no}؟ الموانيفست المعتمدة نهائية وغير قابلة للتعديل.",
        "cancelTitle": "إلغاء المانيفست",
        "cancelBody": "إلغاء {no}؟ يجب ذكر السبب. الموانيفست الملغاة غير قابلة للتعديل.",
        "deleteTitle": "حذف المانيفست",
        "deleteBody": "حذف المسودة {no}؟ سيُحذف المانيفست وأصنافه حذفًا منطقيًا.",
        "reason": "سبب الإلغاء *",
        "keep": "إبقاء",
        "confirmSubmit": "إرسال",
        "confirmApprove": "اعتماد",
        "confirmCancel": "إلغاء المانيفست",
        "confirmDelete": "حذف"
    },
    "errors": {
        "loadList": "فشل تحميل الموانيفست",
        "loadDetail": "فشل تحميل المانيفست",
        "create": "فشل إنشاء المانيفست",
        "save": "فشل الحفظ",
        "addItem": "فشلت إضافة البضاعة",
        "removeItem": "فشلت إزالة الصنف",
        "submit": "فشل الإرسال",
        "approve": "فشل الاعتماد",
        "cancel": "فشل الإلغاء",
        "delete": "فشل الحذف",
        "reasonRequired": "سبب الإلغاء مطلوب.",
        "blOrNotes": "أدخل رقم بوليصة الشحن أو ملاحظات للحفظ."
    }
}

# Fix broken Arabic nav keys: manifest was B/L, billOfLading was Persian.
NAV_FIX_AR = {
    "manifest": "المانيفست",
    "billOfLading": "بوليصة الشحن",
}


def count_leaves(obj):
    n = 0
    if isinstance(obj, dict):
        for v in obj.values():
            n += count_leaves(v)
    else:
        n = 1
    return n


def merge(path, manifest_block, nav_fix=None):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    data['manifest'] = manifest_block
    if nav_fix:
        data.setdefault('nav', {}).update(nav_fix)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return count_leaves(manifest_block)


n_en = merge(BASE / 'en.json', MANIFEST_EN)
n_fa = merge(BASE / 'fa.json', MANIFEST_FA)
n_ar = merge(BASE / 'ar.json', MANIFEST_AR, NAV_FIX_AR)
print(f'manifest namespace merged: en={n_en} fa={n_fa} ar={n_ar} leaves')
print('ar nav.manifest =', json.load(open(BASE / 'ar.json', encoding='utf-8'))['nav']['manifest'])
print('ar nav.billOfLading =', json.load(open(BASE / 'ar.json', encoding='utf-8'))['nav']['billOfLading'])
