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
import type { VesselRef, VesselType } from './vessel';

/** Voyage lifecycle status (matches the VoyageStatus DB enum). */
export type VoyageStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/** Compact tug/barge reference embedded in a voyage (Phase 2 pairing). */
export interface VoyageTugBargeRef {
  id: string;
  code: string;
  name: string;
  vesselType: VesselType;
}

/** Port reference embedded in a destination leg (matches the voyage port selects). */
export interface VoyageLegPortRef {
  id: string;
  code: string;
  name: string;
  country: string;
  city: string | null;
  abbreviation: string | null;
}

/**
 * One destination leg of a voyage (Phase 2 per-destination numbering).
 * `voyageNumber` is the destination-scoped document number (e.g. `1/26`,
 * `2/26`); backfilled legs carry the parent voyageNumber instead.
 * `legNumber` is sequential from 1 — leg 1 is the primary destination
 * (= Voyage.destinationPortId).
 */
export interface VoyageDestination {
  id: string;
  legNumber: number;
  voyageNumber: string;
  destinationPortId: string;
  destinationPort: VoyageLegPortRef;
}

/**
 * Voyage list row (no cargo; cargo assignment is Phase 7).
 *
 * `tugVessel` / `bargeVessel` are the optional per-voyage pairing: a tug
 * pushes/pulls a barge on this sailing. Both are null for plain
 * self-propelled voyages (the shape every pre-existing voyage has).
 * `legs` carries the destination legs with their per-destination numbers.
 */
export interface VoyageListItem {
  id: string;
  voyageNumber: string;
  status: VoyageStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  createdAt: string;
  updatedAt: string;
  vessel: VesselRef;
  tugVessel: VoyageTugBargeRef | null;
  bargeVessel: VoyageTugBargeRef | null;
  originPort: CargoPortRef;
  destinationPort: CargoPortRef;
  /** Destination legs with per-destination numbers (ordered by legNumber). */
  legs: VoyageDestination[];
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