/**
 * Cargo + Yard Inventory contract types (Phase 4). Shared between the API and
 * the web client. Mirror the /cargo and /yard-inventory endpoints.
 *
 * Lifecycle is documented in docs/workflows.md (ADR-019). The readiness fields
 * (inspectionStatus, loadingStatus, manifestNumber) are Phase 4 scaffolding for
 * later-phase workflows (Inspection, Load List, Actual Loading, Manifest) and
 * are explicitly NOT driven by business workflows yet.
 */

export type CargoStatus =
  | 'REGISTERED'
  | 'AT_YARD'
  | 'READY'
  | 'LOADED'
  | 'DELIVERED'
  | 'CANCELLED';

export type CargoType =
  | 'GENERAL'
  | 'VEHICLE'
  | 'HEAVY_LIFT'
  | 'CONTAINER'
  | 'BULK'
  | 'PROJECT';

export type InspectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type LoadingStatus = 'NOT_LOADED' | 'LOADED';

export type WeightUnit = 'KG' | 'MT';

export type InventoryStatus = 'IN_YARD' | 'RESERVED';

/** Compact reference to a customer master record. */
export interface CargoCustomerRef {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
}

/** Compact reference to a port master record. */
export interface CargoPortRef {
  id: string;
  code: string;
  name: string;
  country: string;
  city: string | null;
}

/** Compact reference to a yard master record. */
export interface CargoYardRef {
  id: string;
  code: string;
  name: string;
}

export interface CargoListItem {
  id: string;
  reference: string;
  cargoType: CargoType;
  specification: string | null;
  serialNumber: string | null;
  chassisNumber: string | null;
  vin: string | null;
  weight: string | null;
  weightUnit: WeightUnit | null;
  quantity: number | null;
  packages: number | null;
  arrivalDate: string | null;
  inspectionStatus: InspectionStatus;
  loadingStatus: LoadingStatus;
  status: CargoStatus;
  customer: CargoCustomerRef;
  port: CargoPortRef;
  yard: CargoYardRef | null;
  destinationPort: CargoPortRef | null;
  /** Current yard-inventory record, if the cargo is physically in a yard. */
  inventory: CargoInventoryRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface CargoDetail extends CargoListItem {
  packageType: string | null;
  arrivalReference: string | null;
  manifestNumber: string | null;
  comments: string | null;
  deletedAt: string | null;
  inventory: CargoInventoryRef | null;
}

/** Compact reference to the current inventory record for a cargo. */
export interface CargoInventoryRef {
  id: string;
  yardId: string;
  portId: string;
  status: InventoryStatus;
  enteredAt: string;
}

/** Inventory list row. */
export interface InventoryListItem {
  id: string;
  status: InventoryStatus;
  enteredAt: string;
  locationLabel: string | null;
  notes: string | null;
  cargo: CargoInventoryCargoRef;
  yard: CargoYardRef;
  port: CargoPortRef;
}

/** Compact cargo reference surfaced inside inventory rows. */
export interface CargoInventoryCargoRef {
  id: string;
  reference: string;
  cargoType: CargoType;
  status: CargoStatus;
  inspectionStatus: InspectionStatus;
  customer: CargoCustomerRef;
}

export type InventoryDetail = InventoryListItem;