import type { VoyageListItem } from './voyage';
import type { CargoListItem } from './cargo';
import type { UserRef } from './auth';
import type { PaginatedResult } from './api';
import type { LoadListDetail } from './load-planning';

export type ActualLoadingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type LoadingResult = 'FULL' | 'PARTIAL' | 'NOT_LOADED';

export interface ActualLoading {
  id: string;
  actualLoadingNumber: string;
  loadListId: string;
  status: ActualLoadingStatus;
  notes: string | null;
  createdById: string | null;
  completedById: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  loadList?: LoadListDetail;
  items: ActualLoadingItem[];
  createdBy?: UserRef;
  completedBy?: UserRef;
  cancelledBy?: UserRef;
  _count?: { items: number };
}

export interface ActualLoadingItem {
  id: string;
  actualLoadingId: string;
  loadListItemId: string;
  cargoId: string;
  actualQuantity: number | null;
  result: LoadingResult;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  loadListItem?: {
    id: string;
    plannedQuantity: number | null;
    sequence: number | null;
  };
  cargo?: CargoListItem;
}

export interface PaginatedActualLoadingResult {
  data: ActualLoading[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ActualLoadingDetail extends ActualLoading {
  items: ActualLoadingItem[];
}

export interface ActualLoadingQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ActualLoadingStatus;
  loadListId?: string;
  voyageId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateActualLoadingDto {
  loadListId: string;
  notes?: string;
}

export interface UpdateActualLoadingItemDto {
  actualQuantity?: number;
  notes?: string;
}

export interface BulkUpdateActualLoadingItemsDto {
  items: Array<{
    loadListItemId: string;
    actualQuantity?: number;
    notes?: string;
  }>;
}

export interface CompleteActualLoadingDto {
  notes?: string;
}

export interface CancelActualLoadingDto {
  cancelReason: string;
}

export interface ActualLoadingApiResult {
  success: boolean;
  data: ActualLoading | ActualLoadingDetail | ActualLoading[] | PaginatedResult<ActualLoading>;
  meta?: { timestamp: string };
}

export interface ActualLoadingItemApiResult {
  success: boolean;
  data: ActualLoadingItem;
  meta?: { timestamp: string };
}

export interface BulkUpdateResult {
  updated: number;
  failed: Array<{ loadListItemId: string; reason: string }>;
}

export interface CompleteActualLoadingResult {
  success: boolean;
  data: ActualLoadingDetail;
  meta?: { timestamp: string };
}

export interface CancelActualLoadingResult {
  success: boolean;
  data: ActualLoadingDetail;
  meta?: { timestamp: string };
}