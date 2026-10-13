import type { PaginatedResult } from './api';

/** D/O and R/O share one lifecycle: issued directly, cancellable with reason. */
export type DeliveryReleaseStatus = 'ISSUED' | 'CANCELLED';

/** Payment condition recorded at release (REQ-182). Keep in step with the API DTO. */
export type ReleasePaymentState = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface DeliveryOrder {
  id: string;
  /** DO-YYMM-#####. */
  docNumber: string;
  billOfLadingId: string;
  status: DeliveryReleaseStatus;
  issueDate: string;
  /** Party physically receiving the cargo (free text, legacy recipient). */
  recipient: string;
  recipientId: string | null;
  vehiclePlate: string | null;
  /** Port stated on the D/O (REQ-186). Null on delivery orders created before Phase 5. */
  portId: string | null;
  /** Port name at issue (snapshot). */
  portName: string | null;
  notes: string | null;
  cancelReason: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  billOfLading?: { id: string; billNumber: string; status: string } | null;
  recipientCustomer?: { id: string; name: string } | null;
}

export interface ReleaseOrder {
  id: string;
  /** RO-YYMM-#####. */
  docNumber: string;
  billOfLadingId: string;
  status: DeliveryReleaseStatus;
  releaseDate: string;
  /** Payment condition recorded at release (REQ-182). Null on releases created before Phase 5. */
  paymentState: ReleasePaymentState | null;
  /** True when issued despite unpaid invoices (requires reason). */
  financialOverride: boolean;
  overrideReason: string | null;
  notes: string | null;
  cancelReason: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  billOfLading?: { id: string; billNumber: string; status: string } | null;
  /** Settlement snapshot at issue time (computed on read). */
  financials?: {
    invoicesTotal: string;
    invoicesPaid: string;
    fullyPaid: boolean;
  } | null;
}

export interface CreateDeliveryOrderDto {
  billOfLadingId: string;
  /** Port from the Ports master (REQ-186). Required for every new delivery order. */
  portId: string;
  recipient: string;
  recipientId?: string;
  vehiclePlate?: string;
  notes?: string;
  issueDate?: string;
}

export interface UpdateDeliveryOrderDto {
  recipient?: string;
  recipientId?: string | null;
  vehiclePlate?: string;
  notes?: string;
  issueDate?: string;
}

export interface CreateReleaseOrderDto {
  billOfLadingId: string;
  /** Required for every new release (REQ-182). */
  paymentState: ReleasePaymentState;
  releaseDate?: string;
  notes?: string;
  /** Set true to bypass the fully-paid guard (requires release:override + reason). */
  force?: boolean;
  /** Required when force=true and invoices are unpaid. */
  overrideReason?: string;
}

/** Pre-check shown before issuing a Release Order. */
export interface ReleaseEligibility {
  billOfLadingId: string;
  billNumber: string;
  invoicesTotal: string;
  invoicesPaid: string;
  outstanding: string;
  /** All ISSUED invoices on the B/L are settled (or none billed yet). */
  fullyPaid: boolean;
  /** Money rule blocks the release; needs an authorized override. */
  needsOverride: boolean;
  canRelease: boolean;
}

export interface UpdateReleaseOrderDto {
  notes?: string;
  releaseDate?: string;
}

export type DeliveryOrderListResult = PaginatedResult<DeliveryOrder>;
export type ReleaseOrderListResult = PaginatedResult<ReleaseOrder>;
