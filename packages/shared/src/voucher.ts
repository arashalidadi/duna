import type { PaginatedResult } from './api';

/** Money in (from customer) / money out (refund to customer). */
export type VoucherType = 'RECEIPT' | 'PAYMENT';

export type VoucherMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

/** Vouchers post immediately; CANCELLED is terminal (audit). */
export type VoucherStatus = 'POSTED' | 'CANCELLED';

export interface Voucher {
  id: string;
  /** RCP-YYMM-##### (RECEIPT) / PMT-YYMM-##### (PAYMENT). */
  voucherNumber: string;
  type: VoucherType;
  status: VoucherStatus;
  customerId: string;
  /** Optional settlement document; null = standalone deposit/advance. */
  invoiceId: string | null;
  /** Denormalized from invoice.voyageId at creation (filter aid only). */
  voyageId: string | null;
  /** Always positive; sign comes from type. Money Decimal(18,2) as string. */
  amount: string;
  currencyCode: string;
  /** Base-currency units per 1 original unit. Decimal(24,12), immutable at posting. */
  exchangeRate: string;
  /** Null on genuinely historical records lacking verifiable FX provenance. */
  baseCurrencyCode: string | null;
  baseAmount: string | null;
  rateEffectiveAt: string | null;
  rateSource: string | null;
  currencyRateId: string | null;
  rateOverrideReason: string | null;
  billOfLadingId: string | null;
  allocatedAmount: string;
  unallocatedAmount: string;
  allocations: VoucherAllocation[];
  adjustments: VoucherAmountAdjustment[];
  method: VoucherMethod;
  /** Cheque / transfer trace number. */
  reference: string | null;
  description: string | null;
  note: string | null;
  voucherDate: string;
  cancelReason: string | null;
  createdById: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  invoice?: { id: string; invoiceNumber: string; status: string; totalAmount: string; paidAmount?: string } | null;
  createdBy?: { id: string; fullName: string } | null;
  cancelledBy?: { id: string; fullName: string } | null;
}

export interface VoucherAllocation {
  id: string;
  invoiceId: string | null;
  billOfLadingId: string | null;
  amount: string;
  createdAt: string;
  createdById: string | null;
  reversedAt: string | null;
  reversedById: string | null;
  reversalReason: string | null;
  invoice?: { id: string; invoiceNumber: string } | null;
  billOfLading?: { id: string; billNumber: string } | null;
}

export interface VoucherAmountAdjustment {
  id: string;
  previousAmount: string;
  newAmount: string;
  previousBaseAmount: string | null;
  newBaseAmount: string | null;
  reason: string;
  createdById: string;
  createdAt: string;
}

/** Legacy derived statement. Shadow postings are reconciled before any read-path change. */
export interface LedgerEntry {
  /** Sortable ISO date for the entry. */
  date: string;
  /** 'invoice' (charge) | 'voucher' (settlement) | 'balance' (opening/closing). */
  kind: 'invoice' | 'voucher' | 'balance';
  documentNumber: string;
  documentId: string;
  description: string;
  /** Debit: customer owes more (invoice issued). 0 when credit side. */
  debit: string;
  /** Legacy derived credit: any POSTED voucher, including PAYMENT. Kept unchanged pending reconciliation. */
  credit: string;
  /** Running balance in the requested currency (owes more = positive). */
  balance: string;
  currencyCode?: string;
  invoiceId: string | null;
  voucherId: string | null;
}

export interface LedgerSummary {
  customerId: string;
  customerName: string;
  fromDate: string | null;
  toDate: string | null;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  currencyCode: string;
  /** When MIXED, the numeric legacy aggregate must not be treated as money. */
  currencyTotals?: Record<string, { openingBalance: string; totalDebit: string; totalCredit: string; closingBalance: string }>;
  warning?: string;
}

export interface CreateVoucherDto {
  type: VoucherType;
  customerId: string;
  invoiceId?: string;
  billOfLadingId?: string;
  /** Prefer decimal strings; numeric JSON remains accepted for older clients. */
  allocations?: { invoiceId?: string; billOfLadingId?: string; amount: string | number }[];
  allocationMode?: 'MANUAL' | 'AUTO' | 'NONE';
  amount: string | number;
  currencyCode?: string;
  exchangeRate?: string | number;
  rateOverrideReason?: string;
  method?: VoucherMethod;
  reference?: string;
  description?: string;
  note?: string;
  voucherDate?: string;
}

export interface UpdateVoucherDto {
  method?: VoucherMethod;
  reference?: string;
  description?: string;
  note?: string;
  voucherDate?: string;
  amount?: number;
  exchangeRate?: number;
}

export type VoucherListResult = PaginatedResult<Voucher>;
