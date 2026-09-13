// SalaryRecord — a monthly payslip per employee (Phase 16, ADR-036).
// Lifecycle: DRAFT -> APPROVED -> PAID ; CANCELLED from DRAFT/APPROVED.
// net = base + additions - deductions, always recomputed server-side.

export const SalaryStatusValues = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'] as const;
export type SalaryStatus = (typeof SalaryStatusValues)[number];

export const SalaryPaymentMethodValues = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;
export type SalaryPaymentMethod = (typeof SalaryPaymentMethodValues)[number];

export interface SalaryEmployeeRef {
  id: string;
  code: string;
  name: string;
}

export interface SalaryRecord {
  id: string;
  recordNumber: string; // SAL-YYMM-#####
  employeeId: string;
  employee?: SalaryEmployeeRef | null;
  year: number;
  month: number;
  status: SalaryStatus;
  base: string;
  additions: string;
  deductions: string;
  net: string;
  currencyCode: string;
  paymentMethod: SalaryPaymentMethod | null;
  paymentRef: string | null;
  notes: string | null;
  createdById: string | null;
  approvedById: string | null;
  paidById: string | null;
  cancelledById: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRecordListResult {
  data: SalaryRecord[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
