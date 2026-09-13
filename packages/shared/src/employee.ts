// Employee — HR master data for the salary module (Phase 16, ADR-036).
// Self-contained payroll: employees are NOT customers and never touch the
// customer ledger; payment facts (method/reference/paidAt) live on SalaryRecord.

export const EmployeeStatusValues = ['ACTIVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof EmployeeStatusValues)[number];

export interface Employee {
  id: string;
  code: string; // EMP-##### (auto-generated unless provided)
  name: string;
  nationalId: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  hireDate: string | null;
  baseSalary: string;
  currencyCode: string;
  status: EmployeeStatus;
  notes: string | null;
  salaryRecordsCount?: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResult {
  data: Employee[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
