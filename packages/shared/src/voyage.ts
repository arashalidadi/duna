/**
 * Voyage contract types (Phase 6). Shared between the API and the web client.
 * Mirror the /voyages endpoints.
 *
 * Architecture: A Voyage is an operational sailing of a Vessel between an
 * origin and a destination Port. It carries the vessel + port relationships
 * that Phase 7 (Load Planning) will consume, but NO cargo assignment (that is
 * explicitly Phase 7).
 *
 * Lifecycle (ADR-026):
 *   DRAFT      -> SCHEDULED | CANCELLED
 *   SCHEDULED  -> IN_PROGRESS | CANCELLED
 *   IN_PROGRESS-> COMPLETED
 *   COMPLETED / CANCELLED are terminal historical states.
 * Status changes are dedicated operations (schedule/start/complete/cancel),
 * never an arbitrary status edit.
 *
 * Dates are planned scheduling times (UTC). plannedDepartureAt and
 * plannedArrivalAt are required to SCHEDULE. A vessel may not have two
 * overlapping unfinished voyages (ADR-027).
 */

import type { CargoPortRef } from './cargo';
import type { VesselRef } from './vessel';

/** Voyage lifecycle status (matches the VoyageStatus DB enum). */
export type VoyageStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/** Voyage list row (no cargo; cargo assignment is Phase 7). */
export interface VoyageListItem {
  id: string;
  voyageNumber: string;
  status: VoyageStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  createdAt: string;
  updatedAt: string;
  vessel: VesselRef;
  originPort: CargoPortRef;
  destinationPort: CargoPortRef;
}

/** Full voyage detail (adds cancellation/notes/audit fields). */
export interface VoyageDetail extends VoyageListItem {
  cancelReason: string | null;
  notes: string | null;
  createdBy: {
    id: string;
    email: string;
    fullName: string;
  } | null;
}