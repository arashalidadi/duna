// Agent portal types (Phase 20, ADR-040). These mirror the payloads returned
// by PortalService: bookings submitted by the linked company, manifests where
// the company is the booking agent, and the scoped ledger statement.
import type { BillStatus, BillType } from './bill';
import type { DeliveryReleaseStatus, ReleasePaymentState } from './delivery-release';

export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'];

export interface ListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface BookingPortRef { id: string; name: string; code: string; country: string }
export interface BookingCustomerRef { id: string; name: string; code: string }

export interface BookingRequest {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  cargoDescription: string;
  containers: number | null;
  weightKg: number | null;
  requestedShipDate: string | null;
  notes: string | null;
  responseNote: string | null;
  handledAt: string | null;
  /** fullName of the staff member who responded, when answered */
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
  customer: BookingCustomerRef;
  originPort: BookingPortRef | null;
  destinationPort: BookingPortRef | null;
}

export interface BookingListResult {
  data: BookingRequest[];
  meta: ListMeta;
}

/** GET /portal/me payload */
export interface PortalCustomer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  personKind: 'NATURAL' | 'LEGAL' | null;
}

export interface PortalSummary {
  bookingsTotal: number;
  bookingsPending: number;
  approvedManifests: number;
  balanceDue: number;
  currencyCode: string;
}

export interface PortalMe {
  customer: PortalCustomer;
  summary: PortalSummary;
}

/** GET /portal/shipments row — a manifest where the company is the agent */
export interface PortalShipment {
  id: string;
  manifestNumber: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CANCELLED';
  vesselName: string;
  voyageNumber: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  pol: { id: string; name: string; code: string } | null;
  pod: { id: string; name: string; code: string } | null;
  totalWeight: number;
  totalQuantity: number;
  timeline: {
    createdAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    cancelledAt: string | null;
  };
}

export interface PortalShipmentListResult {
  data: PortalShipment[];
  meta: ListMeta;
}

/** A reason code, not a localized message; the portal UI translates it. */
export type PortalReadEmptyReason =
  | 'CUSTOMER_ONLY'
  | 'NO_ACTIVE_DESTINATIONS'
  | 'NO_DOCUMENTS'
  | 'PAGE_OUT_OF_RANGE'
  | 'NO_LABELS';

export interface PortalReadListResult<T> {
  data: T[];
  meta: ListMeta;
  emptyState: { reason: PortalReadEmptyReason } | null;
}

/** Agent-safe B/L fields, including the active release authorization if present. */
export interface PortalBillOfLading {
  id: string;
  billNumber: string;
  voyageId: string;
  destinationPortId: string | null;
  status: BillStatus;
  billType: BillType;
  vesselName: string;
  dateOfIssue: string | null;
  createdAt: string;
  hasActiveRelease: boolean;
  activeRelease: {
    id: string;
    docNumber: string;
    releaseDate: string;
    paymentState: ReleasePaymentState | null;
  } | null;
}

/** Internal financial override reasons and unrelated B/L details are not exposed. */
export interface PortalReleaseOrder {
  id: string;
  docNumber: string;
  billOfLadingId: string;
  releaseDate: string;
  status: DeliveryReleaseStatus;
  paymentState: ReleasePaymentState | null;
  cancelledAt: string | null;
  billOfLading: {
    id: string;
    billNumber: string;
    destinationPortId: string | null;
    status: BillStatus;
  };
}

export type PortalBillOfLadingListResult = PortalReadListResult<PortalBillOfLading>;
export type PortalReleaseOrderListResult = PortalReadListResult<PortalReleaseOrder>;
export type PortalManifestListResult = PortalReadListResult<PortalShipment>;

export interface PortalBlLabel {
  code: BillStatus;
  label: string;
  sortOrder: number;
}

export interface PortalBlLabelListResult {
  data: PortalBlLabel[];
  emptyState: { reason: PortalReadEmptyReason } | null;
}

/** Create-booking form payload (agent portal) */
export interface CreateBookingInput {
  cargoDescription: string;
  originPortId?: string;
  destinationPortId?: string;
  requestedShipDate?: string;
  containers?: number;
  weightKg?: number;
  notes?: string;
}

import type { LedgerEntry, LedgerSummary } from './voucher';
export type { LedgerEntry, LedgerSummary };

/** GET /portal/statement payload — same shape as the office ledger view */
export interface PortalStatement {
  summary: LedgerSummary;
  entries: LedgerEntry[];
}
