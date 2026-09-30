import type { UserRef } from './auth';
import type { PaginatedResult } from './api';

export type BillStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';
export type BillType = 'MASTER' | 'HOUSE';
export type FreightTerms = 'PREPAID' | 'COLLECT';

export interface BillOfLadingItem {
  id: string;
  billOfLadingId: string;
  manifestItemId: string;
  cargoId: string;
  sequence: number;
  goodsDescription: string | null;
  marksAndNumbers: string | null;
  packages: number | null;
  packageType: string | null;
  grossWeight: string | null;
  volume: string | null;
  createdAt: string;
  updatedAt: string;
  cargo?: { id: string; reference: string; specification: string | null; cargoType?: string };
  manifestItem?: { id: string; blNumber: string | null; sequence: number };
}

export interface BillOfLading {
  id: string;
  billNumber: string;
  manifestId: string;
  voyageId: string;
  status: BillStatus;
  billType: BillType;
  vesselName: string;
  vesselImo: string | null;
  shipperId: string | null;
  consigneeId: string | null;
  notifyParty: string | null;
  freightTerms: FreightTerms | null;
  carrierName: string | null;
  placeOfIssue: string | null;
  dateOfIssue: string | null;
  originals: number | null;
  freightAmount: string | null;
  currencyCode: string | null;
  goodsDescription: string | null;
  shipmentMarks: string | null;
  totalPackages: number;
  totalGrossWeight: string;
  totalVolume: string;
  cancelReason: string | null;
  notes: string | null;
  createdById: string | null;
  issuedById: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  manifest?: {
    id: string;
    manifestNumber: string;
    status: string;
    polPort?: { id: string; code: string; name: string };
    podPort?: { id: string; code: string; name: string };
  };
  voyage?: {
    id: string;
    voyageNumber: string;
    status: string;
  };
  // Master refs (Shipper/Consignee) — no shortName (party-cutover-plan.md §9).
  shipper?: { id: string; code: string; name: string };
  consignee?: { id: string; code: string; name: string };
  items?: BillOfLadingItem[];
  createdBy?: UserRef;
  issuedBy?: UserRef;
  cancelledBy?: UserRef;
  _count?: { items: number };
}

export interface BillOfLadingDetail extends BillOfLading {
  items: BillOfLadingItem[];
}

export interface PaginatedBillResult {
  data: BillOfLading[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ListBillQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BillStatus;
  manifestId?: string;
  voyageId?: string;
  shipperId?: string;
  consigneeId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateBillDto {
  manifestId: string;
  billType?: BillType;
  shipperId?: string;
  consigneeId?: string;
  notifyParty?: string;
  freightTerms?: FreightTerms;
  carrierName?: string;
  placeOfIssue?: string;
  dateOfIssue?: string;
  originals?: number;
  freightAmount?: string | number | null;
  currencyCode?: string;
  goodsDescription?: string;
  shipmentMarks?: string;
  notes?: string;
}

export interface UpdateBillDto {
  billType?: BillType;
  shipperId?: string | null;
  consigneeId?: string | null;
  notifyParty?: string | null;
  freightTerms?: FreightTerms | null;
  carrierName?: string | null;
  placeOfIssue?: string | null;
  dateOfIssue?: string | null;
  originals?: number | null;
  freightAmount?: string | number | null;
  currencyCode?: string | null;
  goodsDescription?: string | null;
  shipmentMarks?: string | null;
  notes?: string | null;
}

export interface AddBillItemDto {
  manifestItemId: string;
  goodsDescription?: string;
  marksAndNumbers?: string;
  packages?: number;
  packageType?: string;
  grossWeight?: string | number;
  volume?: string | number;
}

export interface UpdateBillItemDto {
  goodsDescription?: string | null;
  marksAndNumbers?: string | null;
  packages?: number | null;
  packageType?: string | null;
  grossWeight?: string | number | null;
  volume?: string | number | null;
}

export interface CancelBillDto {
  cancelReason: string;
}

export interface BillApiResult {
  success: boolean;
  data: BillOfLading | BillOfLadingDetail | BillOfLading[] | PaginatedResult<BillOfLading>;
  meta?: { timestamp: string };
}

export interface BillItemApiResult {
  success: boolean;
  data: BillOfLadingItem;
  meta?: { timestamp: string };
}

/**
 * Manifest items eligible for a new B/L: belong to the given manifest and
 * are not yet claimed by another live (non-cancelled, non-deleted) bill.
 */
export interface BillEligibleManifestItem {
  id: string;
  manifestId: string;
  cargoId: string;
  sequence: number;
  blNumber: string | null;
  weight: string | null;
  quantity: number | null;
  packages: number | null;
  packageType: string | null;
  cargo?: {
    id: string;
    reference: string;
    specification: string | null;
    cargoType?: string;
  };
}

/** APPROVED manifests available for issuing B/Ls (create-dialog picker). */
export interface BillManifestOption {
  id: string;
  manifestNumber: string;
  voyageId: string;
  vesselName: string;
  polPort?: { id: string; code: string; name: string };
  podPort?: { id: string; code: string; name: string };
  shipper?: { id: string; code: string; name: string } | null;
  consignee?: { id: string; code: string; name: string } | null;
  totalPackages: number;
  totalWeight: string;
  totalQuantity: number;
  approvedAt: string | null;
  _count?: { items: number };
}
