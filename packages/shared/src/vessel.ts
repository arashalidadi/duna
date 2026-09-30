/**
 * Vessel contract types (Phase 6). Shared between the API and the web client.
 * Mirror the /vessels endpoints.
 *
 * Architecture: Vessel is operational master / registry data. It is identified
 * by a unique, stable `code` (mirroring Port/Customer codes) and optionally an
 * IMO number (unique when supplied). `flag` is a plain country string,
 * consistent with Port.country.
 *
 * Lifecycle: active/inactive via isActive. Deactivation is guarded: a vessel
 * with an unfinished voyage (DRAFT/SCHEDULED/IN_PROGRESS) cannot be
 * deactivated (409); completed historical voyages do not block deactivation
 * and remain readable. Vessels are not hard-deleted while referenced by any
 * voyage (history preserved).
 *
 * `capacityTeu` is declared master-data stowage capacity (informational only;
 * no slot allocation / utilization logic — that belongs to Load Planning).
 */

/** Controlled vessel category (matches the VesselType DB enum). */
export type VesselType =
  | 'CONTAINER'
  | 'BULK'
  | 'TANKER'
  | 'RORO'
  | 'GENERAL'
  | 'PROJECT'
  | 'OTHER'
  // Tug/barge modeling (Phase 2). The plan requires Tug, Barge and Landing
  // Craft alongside the self-propelled categories above.
  | 'TUG'
  | 'BARGE'
  | 'LANDING_CRAFT';

/** Vessel list row. */
export interface VesselListItem {
  id: string;
  code: string;
  name: string;
  imo: string | null;
  flag: string;
  vesselType: VesselType;
  capacityTeu: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Full vessel detail (adds notes; no extra daily-priced fields yet). */
export interface VesselDetail extends VesselListItem {
  notes: string | null;
}

/** Compact vessel reference embeddable in other contracts (e.g. Voyage). */
export interface VesselRef {
  id: string;
  code: string;
  name: string;
  imo: string | null;
  flag: string;
  vesselType: VesselType;
  isActive: boolean;
}