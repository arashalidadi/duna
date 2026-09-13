// Phase 19 — Discharge (unloading at destination). Shared API shapes.

export type DischargeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export const DischargeStatusValues: DischargeStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export type DischargeResult = 'NOT_DISCHARGED' | 'FULL' | 'PARTIAL';
export const DischargeResultValues: DischargeResult[] = ['NOT_DISCHARGED', 'FULL', 'PARTIAL'];

/** Voyage/vessel reference embedded via the actual loading chain. */
export interface DischargeVoyageRef {
  id: string;
  voyageNumber: string;
  status: string;
  vessel?: { id: string; code: string; name: string } | null;
  originPort?: { id: string; code: string; name: string } | null;
  destinationPort?: { id: string; code: string; name: string } | null;
}

export interface DischargeActualLoadingRef {
  id: string;
  actualLoadingNumber: string;
  status: string;
  loadList?: {
    id: string;
    loadListNumber: string;
    status: string;
    voyage?: DischargeVoyageRef | null;
  } | null;
}

export interface DischargeCargoRef {
  id: string;
  reference: string;
  cargoType: string;
  customer?: { id: string; code: string; name: string } | null;
}

export interface DischargeItem {
  id: string;
  dischargeId: string;
  actualLoadingItemId: string;
  cargoId: string;
  expectedQuantity: number | null;
  dischargeQuantity: number | null;
  result: DischargeResult;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cargo?: DischargeCargoRef | null;
}

export interface Discharge {
  id: string;
  dischargeNumber: string;
  actualLoadingId: string;
  status: DischargeStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  items?: DischargeItem[];
  itemsCount?: number;
  /** summed discharged quantities (computed in service flatten) */
  expectedTotal?: number | null;
  dischargedTotal?: number | null;
  actualLoading?: DischargeActualLoadingRef | null;
  createdBy?: { id: string; email: string; fullName: string | null } | null;
  completedBy?: { id: string; email: string; fullName: string | null } | null;
  cancelledBy?: { id: string; email: string; fullName: string | null } | null;
}

export interface DischargeListResult {
  data: Discharge[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
