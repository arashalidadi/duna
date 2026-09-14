// Agent portal types (Phase 20, ADR-040). These mirror the payloads returned
// by PortalService: bookings submitted by the linked company, manifests where
// the company is the booking agent, and the scoped ledger statement.

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
  type: string | null;
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
