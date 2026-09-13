#!/usr/bin/env python3
"""Phase 16 — merge `employee` + `salary` i18n namespaces (en/fa/ar) + nav keys.

Adds: top-level "employee" and "salary" namespaces, and nav.people/employees/
salaryRecords next to the existing nav labels. Idempotent.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MESSAGES = ROOT / "apps" / "web" / "messages"

# ------------------------------------------------------------------ employee
EMPLOYEE = {
    "en": {
        "page": {"title": "Employees", "description": "HR master data — staff, base salaries and status"},
        "actions": {"create": "New Employee", "edit": "Edit", "delete": "Delete"},
        "fields": {"code": "Code", "name": "Name", "nationalId": "National ID", "position": "Position",
                   "phone": "Phone", "email": "Email", "hireDate": "Hire Date", "baseSalary": "Base Salary",
                   "currency": "Currency", "status": "Status", "notes": "Notes", "salaryRecordsCount": "Payslips"},
        "status": {"ACTIVE": "Active", "INACTIVE": "Inactive"},
        "list": {"title": "Employee List", "subtitle": "Search and manage staff records", "search": "Search...",
                 "allStatuses": "All statuses",
                 "empty": {"title": "No employees yet", "description": "Create the first employee to start payroll."}},
        "form": {"title": "Create Employee", "editTitle": "Edit Employee",
                 "description": "Base salary and currency drive payslip defaults.", "saving": "Saving...",
                 "codePlaceholder": "Auto (EMP-#####)", "errors": {"nameRequired": "Name is required"}},
        "confirm": {"delete": {"title": "Delete employee", "description": "Delete {name}? This cannot be undone."}},
    },
    "fa": {
        "page": {"title": "کارکنان", "description": "اطلاعات پایه منابع انسانی — پرسنل، حقوق پایه و وضعیت"},
        "actions": {"create": "کارمند جدید", "edit": "ویرایش", "delete": "حذف"},
        "fields": {"code": "کد", "name": "نام", "nationalId": "کد ملی", "position": "سمت",
                   "phone": "تلفن", "email": "ایمیل", "hireDate": "تاریخ استخدام", "baseSalary": "حقوق پایه",
                   "currency": "واحد پول", "status": "وضعیت", "notes": "یادداشت", "salaryRecordsCount": "فیش‌های حقوقی"},
        "status": {"ACTIVE": "فعال", "INACTIVE": "غیرفعال"},
        "list": {"title": "فهرست کارکنان", "subtitle": "جستجو و مدیریت پرسنل", "search": "جستجو...",
                 "allStatuses": "همه وضعیت‌ها",
                 "empty": {"title": "کارمندی ثبت نشده است", "description": "برای شروع چرخه حقوق، اولین کارمند را ثبت کنید."}},
        "form": {"title": "ایجاد کارمند", "editTitle": "ویرایش کارمند",
                 "description": "حقوق پایه و واحد پول، پیش‌فرض فیش حقوقی را تعیین می‌کنند.", "saving": "در حال ذخیره...",
                 "codePlaceholder": "خودکار (EMP-#####)", "errors": {"nameRequired": "نام الزامی است"}},
        "confirm": {"delete": {"title": "حذف کارمند", "description": "«{name}» حذف شود؟ این عمل قابل بازگشت نیست."}},
    },
    "ar": {
        "page": {"title": "الموظفون", "description": "بيانات الموارد البشرية — الموظفون والرواتب الأساسية والحالة"},
        "actions": {"create": "موظف جديد", "edit": "تعديل", "delete": "حذف"},
        "fields": {"code": "الرمز", "name": "الاسم", "nationalId": "الرقم الوطني", "position": "المنصب",
                   "phone": "الهاتف", "email": "البريد الإلكتروني", "hireDate": "تاريخ التعيين", "baseSalary": "الراتب الأساسي",
                   "currency": "العملة", "status": "الحالة", "notes": "ملاحظات", "salaryRecordsCount": "قسائم الرواتب"},
        "status": {"ACTIVE": "نشط", "INACTIVE": "غير نشط"},
        "list": {"title": "قائمة الموظفين", "subtitle": "بحث وإدارة بيانات الموظفين", "search": "بحث...",
                 "allStatuses": "كل الحالات",
                 "empty": {"title": "لا يوجد موظفون", "description": "أنشئ أول موظف لبدء مسير الرواتب."}},
        "form": {"title": "إنشاء موظف", "editTitle": "تعديل الموظف",
                 "description": "الراتب الأساسي والعملة يحددان افتراضيات قسيمة الراتب.", "saving": "جارٍ الحفظ...",
                 "codePlaceholder": "تلقائي (EMP-#####)", "errors": {"nameRequired": "الاسم مطلوب"}},
        "confirm": {"delete": {"title": "حذف الموظف", "description": "حذف {name}؟ لا يمكن التراجع عن هذا الإجراء."}},
    },
}

# ------------------------------------------------------------------- salary
SALARY = {
    "en": {
        "page": {"title": "Salary Records", "description": "Monthly payslips — draft, approve, pay"},
        "actions": {"create": "New Payslip", "approve": "Approve", "pay": "Pay", "cancel": "Cancel",
                    "cancelling": "Cancelling...", "delete": "Delete", "view": "View"},
        "status": {"DRAFT": "Draft", "APPROVED": "Approved", "PAID": "Paid", "CANCELLED": "Cancelled"},
        "list": {"title": "Payslips", "subtitle": "Filter by period, employee and status", "search": "Search...",
                 "allStatuses": "All statuses", "allYears": "All years", "allMonths": "All months",
                 "allEmployees": "All employees",
                 "empty": {"title": "No payslips yet", "description": "Create the first payslip to start payroll."}},
        "fields": {"number": "Number", "employee": "Employee", "period": "Period", "base": "Base",
                   "additions": "Additions", "deductions": "Deductions", "net": "Net pay", "currency": "Currency",
                   "status": "Status", "notes": "Notes", "year": "Year", "month": "Month",
                   "paymentMethod": "Payment method", "paymentRef": "Payment reference", "cancelReason": "Cancel reason"},
        "method": {"CASH": "Cash", "BANK_TRANSFER": "Bank transfer", "CHEQUE": "Cheque", "OTHER": "Other"},
        "create": {"title": "Create Payslip", "description": "Base and currency default to the employee's.",
                   "creating": "Creating...", "selectEmployee": "Select employee...",
                   "errors": {"employeeRequired": "Employee is required"}},
        "confirm": {"approve": {"title": "Approve payslip", "description": "Approve {number} with net {net}? It will be frozen."},
                    "delete": {"title": "Delete payslip", "description": "Delete {number}? Only DRAFT payslips can be deleted."}},
        "pay": {"title": "Record payment", "description": "Records the payment fact on the payslip.",
                "paying": "Recording...", "referencePlaceholder": "e.g. TRF-12345"},
        "cancel": {"title": "Cancel payslip", "description": "Provide a cancel reason (audit).",
                   "reason": "Cancel reason", "reasonPlaceholder": "e.g. left the company"},
        "detail": {"title": "Payslip", "approvedOn": "Approved on", "paidOn": "Paid on",
                   "cancelledOn": "Cancelled on", "createdAt": "Created"},
    },
    "fa": {
        "page": {"title": "فیش‌های حقوقی", "description": "فیش ماهانه — پیش‌نویس، تأیید، پرداخت"},
        "actions": {"create": "فیش جدید", "approve": "تأیید", "pay": "پرداخت", "cancel": "لغو",
                    "cancelling": "در حال لغو...", "delete": "حذف", "view": "مشاهده"},
        "status": {"DRAFT": "پیش‌نویس", "APPROVED": "تأییدشده", "PAID": "پرداخت‌شده", "CANCELLED": "لغوشده"},
        "list": {"title": "فیش‌های حقوقی", "subtitle": "فیلتر بر اساس دوره، کارمند و وضعیت", "search": "جستجو...",
                 "allStatuses": "همه وضعیت‌ها", "allYears": "همه سال‌ها", "allMonths": "همه ماه‌ها",
                 "allEmployees": "همه کارکنان",
                 "empty": {"title": "فیشی ثبت نشده است", "description": "برای شروع چرخه حقوق، اولین فیش را ثبت کنید."}},
        "fields": {"number": "شماره", "employee": "کارمند", "period": "دوره", "base": "پایه",
                   "additions": "افزودنی‌ها", "deductions": "کسورات", "net": "خالص پرداختی", "currency": "واحد پول",
                   "status": "وضعیت", "notes": "یادداشت", "year": "سال", "month": "ماه",
                   "paymentMethod": "روش پرداخت", "paymentRef": "مرجع پرداخت", "cancelReason": "دلیل لغو"},
        "method": {"CASH": "نقدی", "BANK_TRANSFER": "انتقال بانکی", "CHEQUE": "چک", "OTHER": "سایر"},
        "create": {"title": "ایجاد فیش حقوقی", "description": "پایه و واحد پول از پروفایل کارمند پیش‌فرض می‌شوند.",
                   "creating": "در حال ایجاد...", "selectEmployee": "انتخاب کارمند...",
                   "errors": {"employeeRequired": "انتخاب کارمند الزامی است"}},
        "confirm": {"approve": {"title": "تأیید فیش", "description": "فیش {number} با خالص {net} تأیید شود؟ پس از تأیید قابل ویرایش نیست."},
                    "delete": {"title": "حذف فیش", "description": "فیش {number} حذف شود؟ فقط فیش‌های پیش‌نویس قابل حذف‌اند."}},
        "pay": {"title": "ثبت پرداخت", "description": "ماهیت پرداخت روی فیش ثبت می‌شود.",
                "paying": "در حال ثبت...", "referencePlaceholder": "مثلاً TRF-12345"},
        "cancel": {"title": "لغو فیش", "description": "دلیل لغو را وارد کنید (حسابرسی).",
                   "reason": "دلیل لغو", "reasonPlaceholder": "مثلاً: ترک کار"},
        "detail": {"title": "فیش حقوقی", "approvedOn": "تاریخ تأیید", "paidOn": "تاریخ پرداخت",
                   "cancelledOn": "تاریخ لغو", "createdAt": "تاریخ ایجاد"},
    },
    "ar": {
        "page": {"title": "قسائم الرواتب", "description": "قسائم شهرية — مسودة، اعتماد، دفع"},
        "actions": {"create": "قسيمة جديدة", "approve": "اعتماد", "pay": "دفع", "cancel": "إلغاء",
                    "cancelling": "جارٍ الإلغاء...", "delete": "حذف", "view": "عرض"},
        "status": {"DRAFT": "مسودة", "APPROVED": "معتمدة", "PAID": "مدفوعة", "CANCELLED": "ملغاة"},
        "list": {"title": "القسائم", "subtitle": "تصفية حسب الفترة والموظف والحالة", "search": "بحث...",
                 "allStatuses": "كل الحالات", "allYears": "كل السنوات", "allMonths": "كل الأشهر",
                 "allEmployees": "كل الموظفين",
                 "empty": {"title": "لا توجد قسائم", "description": "أنشئ أول قسيمة لبدء مسير الرواتب."}},
        "fields": {"number": "الرقم", "employee": "الموظف", "period": "الفترة", "base": "الأساسي",
                   "additions": "الإضافات", "deductions": "الاستقطاعات", "net": "الصافي", "currency": "العملة",
                   "status": "الحالة", "notes": "ملاحظات", "year": "السنة", "month": "الشهر",
                   "paymentMethod": "طريقة الدفع", "paymentRef": "مرجع الدفع", "cancelReason": "سبب الإلغاء"},
        "method": {"CASH": "نقدي", "BANK_TRANSFER": "تحويل بنكي", "CHEQUE": "شيك", "OTHER": "أخرى"},
        "create": {"title": "إنشاء قسيمة", "description": "يُفترض الأساسي والعملة من ملف الموظف.",
                   "creating": "جارٍ الإنشاء...", "selectEmployee": "اختر الموظف...",
                   "errors": {"employeeRequired": "اختيار الموظف مطلوب"}},
        "confirm": {"approve": {"title": "اعتماد القسيمة", "description": "اعتماد {number} بصافي {net}؟ لن تكون قابلة للتعديل بعد الاعتماد."},
                    "delete": {"title": "حذف القسيمة", "description": "حذف {number}؟ يمكن حذف المسودات فقط."}},
        "pay": {"title": "تسجيل الدفع", "description": "يُسجَّل واقِع الدفع على القسيمة.",
                "paying": "جارٍ التسجيل...", "referencePlaceholder": "مثال: TRF-12345"},
        "cancel": {"title": "إلغاء القسيمة", "description": "أدخل سبب الإلغاء (للتدقيق).",
                   "reason": "سبب الإلغاء", "reasonPlaceholder": "مثال: ترك العمل"},
        "detail": {"title": "قسيمة الراتب", "approvedOn": "تاريخ الاعتماد", "paidOn": "تاريخ الدفع",
                   "cancelledOn": "تاريخ الإلغاء", "createdAt": "تاريخ الإنشاء"},
    },
}

NAV = {
    "en": {"people": "People & Payroll", "employees": "Employees", "salaryRecords": "Salary Records"},
    "fa": {"people": "کارکنان و حقوق", "employees": "کارکنان", "salaryRecords": "فیش‌های حقوقی"},
    "ar": {"people": "الموظفون والرواتب", "employees": "الموظفون", "salaryRecords": "قسائم الرواتب"},
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
        deep_merge(doc, {"employee": EMPLOYEE[lang], "salary": SALARY[lang]})
        nav = doc.get("nav")
        assert isinstance(nav, dict), "nav namespace missing"
        nav.update(NAV[lang])
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: employee={count_leaves(EMPLOYEE[lang])} salary={count_leaves(SALARY[lang])} nav+=3")
    print("done")


if __name__ == "__main__":
    main()
