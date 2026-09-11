import type { VoyageListItem } from './voyage';
import type { CargoListItem } from './cargo';
import type { UserRef } from './auth';
import type { PaginatedResult } from './api';

export type LoadListStatus = 'DRAFT' | 'FINALIZED' | 'CANCELLED';

export interface LoadList {
  id: string;
  loadListNumber: string;
  voyageId: string;
  status: LoadListStatus;
  notes: string | null;
  createdById: string | null;
  finalizedById: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  voyage?: VoyageListItem;
  items?: LoadListItem[];
  createdBy?: UserRef;
  finalizedBy?: UserRef;
  cancelledBy?: UserRef;
  _count?: { items: number };
}

export interface LoadListItem {
  id: string;
  loadListId: string;
  cargoId: string;
  plannedQuantity: number | null;
  sequence: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cargo?: CargoListItem;
}

export interface LoadListDetail extends LoadList {
  items: LoadListItem[];
}

export interface CargoEligibleItem extends CargoListItem {
  selected?: boolean;
}

export interface EligibleCargoQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  customerId?: string;
  yardId?: string;
  cargoType?: string;
  eligibleOnly?: 'true' | 'false';
}

export interface ListLoadListQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LoadListStatus;
  voyageId?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: 'loadListNumber' | 'status' | 'createdAt' | 'finalizedAt';
  order?: 'asc' | 'desc';
}

export interface CreateLoadListDto {
  voyageId: string;
  notes?: string;
}

export interface UpdateLoadListDto {
  notes?: string;
}

export interface AddLoadListItemDto {
  cargoId: string;
  plannedQuantity?: number;
  sequence?: number;
  notes?: string;
}

export interface BulkAddLoadListItemsDto {
  items: AddLoadListItemDto[];
}

export interface CancelLoadListDto {
  cancelReason: string;
}

export interface LoadListApiResult {
  success: boolean;
  data: LoadList | LoadListDetail | LoadList[] | PaginatedResult<LoadList>;
  meta?: { timestamp: string };
}

export interface CargoEligibleApiResult {
  success: boolean;
  data: CargoEligibleItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    timestamp: string;
  };
}

export interface LoadListItemApiResult {
  success: boolean;
  data: LoadListItem;
  meta?: { timestamp: string };
}

export interface BulkAddResult {
  added: number;
  failed: Array<{ cargoId: string; reason: string }>;
}