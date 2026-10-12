import type { Prisma } from '@prisma/client';

export enum NumberingScopeType {
  GLOBAL = 'GLOBAL',
  DESTINATION = 'DESTINATION',
  YEAR = 'YEAR',
  YEAR_PERIOD = 'YEAR_PERIOD',
  VESSEL_DESTINATION = 'VESSEL_DESTINATION',
}

export enum NumberingPeriod {
  YYYY = 'YYYY',
  YY = 'YY',
  YYYYMM = 'YYYYMM',
  QUARTER = 'QUARTER',
}

export interface AllocateNumberRequest {
  name: string;
  documentType: string;
  scopeType: string;
  scopeValue?: string | null;
  prefix?: string;
  padding?: number;
  format?: string;
  period?: string;
  companyId?: string | null;
  /**
   * Runs ONLY when the sequence row is created. Returns the first number to
   * issue (existing max + 1 for the document family), so a row created later
   * on a database that already holds numbers never restarts at 1 (DEC-026).
   */
  seedNextSequence?: (tx: Prisma.TransactionClient) => Promise<number>;
  /** Join the caller's transaction so the number and the document commit or roll back together. */
  tx?: Prisma.TransactionClient;
}

export interface AllocatedNumber {
  sequence: string;
  rawSequence: number;
  sequenceName: string;
  scopeType: string;
  scopeValue: string | null;
  prefix: string;
  padding: number;
  format: string;
  period: string;
}
