export enum NumberingScopeType {
  GLOBAL = 'GLOBAL',
  DESTINATION = 'DESTINATION',
  YEAR = 'YEAR',
  YEAR_PERIOD = 'YEAR_PERIOD',
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
