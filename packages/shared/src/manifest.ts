import type { CargoListItem } from './cargo';
import type { UserRef } from './auth';
import type { PaginatedResult } from './api';

export type ManifestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CANCELLED';

/** ADR-047 d4 (P5-U3): party master as rendered by manifest items and partySummary. */
export interface ManifestParty {
  id: string;
  code: string;
  name: string;
}

export interface ManifestItem {
  id: string;
  manifestId: string;
  cargoId: string;
  sequence: number;
  blNumber: string | null;
  weight: string | null;
  quantity: number | null;
  packages: number | null;
  packageType: string | null;
  notes: string | null;
  actualLoadingItemId: string | null;
  // ADR-047 d3+d4 (P5-U2): consolidation reference + per-item parties
  billOfLadingItemId?: string | null;
  shipperId?: string | null;
  consigneeId?: string | null;
  // ADR-047 d4 (P5-U3): per-row party objects (code + name) for the items table;
  // null falls back to the manifest header when rendered.
  shipper?: ManifestParty | null;
  consignee?: ManifestParty | null;
  createdAt: string;
  updatedAt: string;
  cargo?: CargoListItem;
}

export interface Manifest {
  id: string;
  manifestNumber: string;
  voyageId: string;
  status: ManifestStatus;
  vesselName: string;
  vesselImo: string | null;
  polPortId: string;
  podPortId: string;
  shipperId: string | null;
  consigneeId: string | null;
  agentId: string | null;
  notifyParty: string | null;
  description: string | null;
  gasCost: string | null;
  lashingCost: string | null;
  shipperCost: string | null;
  podCost: string | null;
  polCost: string | null;
  currencyCode: string | null;
  totalWeight: string;
  totalQuantity: number;
  totalPackages: number;
  cancelReason: string | null;
  notes: string | null;
  createdById: string | null;
  submittedById: string | null;
  approvedById: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  // ADR-047 d6 (P5-U2): the manifest document's own date (defaults to voyage.plannedDepartureAt)
  manifestDate?: string | null;
  voyage?: {
    id: string;
    voyageNumber: string;
    status: string;
    plannedDepartureAt: string | null;
    plannedArrivalAt: string | null;
    vessel: { id: string; code: string; name: string; imo: string | null; vesselType: string };
    originPort: { id: string; code: string; name: string; country: string | null; city: string | null };
    destinationPort: { id: string; code: string; name: string; country: string | null; city: string | null };
  };
  polPort?: { id: string; code: string; name: string };
  podPort?: { id: string; code: string; name: string };
  // Party refs are master rows (Shipper/Consignee/Agent) — no shortName there
  // (party-cutover-plan.md §9).
  shipper?: { id: string; code: string; name: string };
  consignee?: { id: string; code: string; name: string };
  agent?: { id: string; code: string; name: string };
  // ADR-047 d4 (P5-U3): derived distinct-parties summary across the items rows
  // (per-row party with header fallback, distinct by master id). Display-time
  // aggregation only — never persisted, "not a schema group".
  partySummary?: { shippers: ManifestParty[]; consignees: ManifestParty[] };
  items?: ManifestItem[];
  createdBy?: UserRef;
  submittedBy?: UserRef;
  approvedBy?: UserRef;
  cancelledBy?: UserRef;
  _count?: { items: number };
}

export interface ManifestDetail extends Manifest {
  items: ManifestItem[];
}

export interface PaginatedManifestResult {
  data: Manifest[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ListManifestQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ManifestStatus;
  voyageId?: string;
  shipperId?: string;
  consigneeId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateManifestDto {
  voyageId: string;
  shipperId?: string;
  consigneeId?: string;
  agentId?: string;
  notifyParty?: string;
  description?: string;
  notes?: string;
  // ADR-047 d1 (P5-U2): consolidation path — APPROVED B/L ids on the same voyage;
  // when present the consolidation path runs, otherwise the legacy cargo path stays.
  billIds?: string[];
  // manifestDate is server-set from voyage.plannedDepartureAt (technical default).
}

export interface UpdateManifestDto {
  // ADR-047 d6: manifest document date, editable on DRAFT
  manifestDate?: string | null;
  shipperId?: string | null;
  consigneeId?: string | null;
  agentId?: string | null;
  notifyParty?: string | null;
  description?: string | null;
  notes?: string | null;
  gasCost?: string | null;
  lashingCost?: string | null;
  shipperCost?: string | null;
  podCost?: string | null;
  polCost?: string | null;
  currencyCode?: string | null;
}

export interface AddManifestItemDto {
  cargoId: string;
  blNumber?: string;
  notes?: string;
}

export interface UpdateManifestItemDto {
  blNumber?: string | null;
  notes?: string | null;
}

export interface CancelManifestDto {
  cancelReason: string;
}

export interface ManifestApiResult {
  success: boolean;
  data: Manifest | ManifestDetail | Manifest[] | PaginatedResult<Manifest>;
  meta?: { timestamp: string };
}

export interface ManifestItemApiResult {
  success: boolean;
  data: ManifestItem;
  meta?: { timestamp: string };
}

/** Cargo eligible to be manifested on a voyage (loaded, not yet manifested). */
export interface ManifestEligibleCargo {
  id: string;
  reference: string;
  cargoType: string;
  status: string;
  loadingStatus: string;
  weight: string | null;
  weightUnit: string | null;
  quantity: number | null;
  packages: number | null;
  packageType: string | null;
  customer?: { id: string; code: string; name: string; shortName: string | null };
  port?: { id: string; code: string; name: string };
  destinationPort?: { id: string; code: string; name: string };
  actualLoadingItemId?: string | null;
}
