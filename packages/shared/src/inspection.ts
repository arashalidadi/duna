/**
 * Inspection contract types (Phase 5). Shared between the API and the web client.
 * Mirror the /inspections endpoints.
 *
 * Architecture: Inspection rows are the *traceable history* of inspection
 * attempts against a Cargo. Cargo.inspectionStatus (Phase 4 field) is the single
 * authoritative *current* readiness state; the lifecycle actions (book/done/fail/
 * needs-re-inspection) update both in one transaction so they can never diverge
 * (ADR-024).
 *
 * Shipped lifecycle (Phase 3A — matches prisma enum InspectionStatus; the status
 * union itself lives in cargo.ts):
 *   PENDING --book--> BOOKED --done--> DONE (terminal)
 *   PENDING | BOOKED --fail(reason required)--> FAILED
 *   FAILED --needs-re-inspection--> NEEDS_REINSPECTION --book|fail--> ...
 * Cargo.inspectionStatus mirrors the row status (DONE => loading-eligible).
 */

import type {
  CargoCustomerRef,
  CargoPortRef,
  CargoYardRef,
  CargoInventoryRef,
  CargoStatus,
  CargoType,
  InspectionStatus,
} from './cargo';

/** Compact reference to the user who performed an inspection action. */
export interface InspectionUserRef {
  id: string;
  email: string;
  fullName: string;
}

/** Compact reference to the inspected cargo with its current readiness. */
export interface InspectionCargoRef {
  id: string;
  reference: string;
  cargoType: CargoType;
  status: CargoStatus;
  inspectionStatus: InspectionStatus;
  serialNumber: string | null;
  chassisNumber: string | null;
  vin: string | null;
  customer: CargoCustomerRef;
  port: CargoPortRef;
  destinationPort: CargoPortRef | null;
  yard: CargoYardRef | null;
  inventory: CargoInventoryRef | null;
}

/** Immutable readiness contract for future Load Planning (Phase 7+). */
export interface CargoLoadReadiness {
  cargoId: string;
  inspectionApproved: boolean;
}

/** Inspection list row. */
export interface InspectionListItem {
  id: string;
  inspectionNumber: string;
  status: InspectionStatus;
  inspectionDate: string;
  inspectorName: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  cargo: InspectionCargoRef;
  createdBy: InspectionUserRef | null;
}

/** Full inspection detail. */
export interface InspectionDetail extends InspectionListItem {
  findings: string | null;
  condition: string | null;
  verificationNotes: string | null;
  remarks: string | null;
  rejectionReason: string | null;
  inspectorId: string | null;
  approvedById: string | null;
  rejectedById: string | null;
  approvedBy: InspectionUserRef | null;
  rejectedBy: InspectionUserRef | null;
  updatedAt: string;
}