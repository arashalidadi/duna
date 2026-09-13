// Job & costing (Phase 18, ADR-038).
// Lifecycle: DRAFT -> OPEN -> COMPLETED ; CANCELLED from DRAFT/OPEN.
// profit = sum(INCOME items) - sum(COST items), server-computed, job currency.

export const JobStatusValues = ['DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED'] as const;
export type JobStatus = (typeof JobStatusValues)[number];

export const JobItemKindValues = ['COST', 'INCOME'] as const;
export type JobItemKind = (typeof JobItemKindValues)[number];

export interface JobCustomerRef {
  id: string;
  code: string;
  name: string;
}

export interface JobVoyageRef {
  id: string;
  voyageNumber: string;
  vessel?: { name: string } | null;
}

export interface JobCostItem {
  id: string;
  jobId: string;
  kind: JobItemKind;
  category: string | null;
  description: string;
  amount: string;
  itemDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Job {
  id: string;
  jobNumber: string; // JOB-YYMM-#####
  title: string;
  jobType?: string | null;
  description: string | null;
  customerId: string | null;
  customer?: JobCustomerRef | null;
  voyageId: string | null;
  voyage?: JobVoyageRef | null;
  status: JobStatus;
  currencyCode: string;
  openingDate: string;
  completedAt: string | null;
  completedById: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount?: number;
  items?: JobCostItem[];
  totalIncome?: string;
  totalCost?: string;
  profit?: string;
}

export interface JobListResult {
  data: Job[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
