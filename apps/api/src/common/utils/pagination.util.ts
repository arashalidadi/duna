import { BadRequestException } from '@nestjs/common';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/**
 * Parse and validate pagination query parameters with sane limits.
 */
export function parsePagination(params: PaginationParams): Pagination {
  const page = Math.max(1, Number(params.page ?? DEFAULT_PAGE) || DEFAULT_PAGE);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE)
  );

  if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
    throw new BadRequestException('page and pageSize must be integers');
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export interface PaginatedOutput<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Build a consistent paginated response shape.
 */
export function buildPaginated<T>(
  data: T[],
  totalItems: number,
  pagination: Pagination
): PaginatedOutput<T> {
  return {
    data,
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pagination.pageSize),
    },
  };
}
